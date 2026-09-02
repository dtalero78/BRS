/**
 * Integracion con Wompi (pasarela de pagos, Colombia).
 *
 * Flujo:
 *   1. El evaluador elige pruebas → `POST /api/payments/checkout` crea una
 *      orden (`payments`) con una referencia unica y devuelve la URL del Web
 *      Checkout de Wompi con el monto ya fijado y firmado (integridad).
 *   2. Wompi cobra y devuelve al evaluador a `redirect-url?id=<transaccion>`.
 *   3. Dos caminos confirman el pago, y ambos llegan a `applyTransaction()`:
 *      - el webhook de eventos (`POST /api/payments/wompi/events`), firmado con
 *        el secreto de eventos;
 *      - la verificacion post-redirect: el frontend manda el id y el backend
 *        consulta la transaccion DIRECTAMENTE a Wompi (nunca confia en lo que
 *        trae el navegador).
 *   4. APROBADA → las pruebas de la orden quedan con `paid_at` (liberadas).
 *
 * Todo es idempotente: el webhook reintenta hasta 3 veces y el evaluador puede
 * recargar la pagina de resultado cuantas veces quiera.
 *
 * Env vars:
 *   WOMPI_PUBLIC_KEY        pub_test_... (sandbox) | pub_prod_... (produccion)
 *   WOMPI_INTEGRITY_SECRET  firma del monto en el checkout
 *   WOMPI_EVENTS_SECRET     firma de los webhooks
 *   BRS_TEST_PRICE_COP      precio por prueba en pesos (entero, sin IVA)
 *   BRS_PUBLIC_URL          base de la redirect-url (fallback: host del request)
 */
const crypto = require('crypto');
const db = require('../config/database');

const CHECKOUT_URL = 'https://checkout.wompi.co/p/';
const CURRENCY = 'COP';
const REQUEST_TIMEOUT_MS = 10000;

function publicKey() { return (process.env.WOMPI_PUBLIC_KEY || '').trim(); }
function integritySecret() { return (process.env.WOMPI_INTEGRITY_SECRET || '').trim(); }
function eventsSecret() { return (process.env.WOMPI_EVENTS_SECRET || '').trim(); }

// El ambiente lo decide la llave, no otra env var: con dos variables la app
// podria firmar con el secreto de un ambiente y cobrar en el otro.
function isSandbox(key = publicKey()) {
  return key.startsWith('pub_test_');
}

function apiBase(key = publicKey()) {
  return isSandbox(key) ? 'https://sandbox.wompi.co/v1' : 'https://production.wompi.co/v1';
}

function envUnitPriceCop() {
  const n = parseInt(process.env.BRS_TEST_PRICE_COP || '0', 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Precio por prueba en pesos. `system_configs.wompi_unit_price_cop` manda
 * sobre la env var para poder cambiarlo sin redeploy; sin ninguna de las dos
 * el modulo queda desactivado (no se puede cobrar $0).
 */
async function getUnitPriceCop() {
  try {
    const row = await db('system_configs').where('config_key', 'wompi_unit_price_cop').first();
    const n = row ? parseInt(row.config_value, 10) : 0;
    if (Number.isFinite(n) && n > 0) return n;
  } catch (e) {
    // La tabla existe desde el esquema inicial; si falla, cae a la env var.
  }
  return envUnitPriceCop();
}

function isConfigured(unitPriceCop) {
  return Boolean(publicKey() && integritySecret() && unitPriceCop > 0);
}

/**
 * Firma de integridad del checkout: SHA256("<ref><monto><moneda><secreto>").
 * Sin ella cualquiera podria editar `amount-in-cents` en la URL y pagar $1.
 */
function integritySignature(reference, amountInCents, currency = CURRENCY, secret = integritySecret(), expirationTime) {
  const base = expirationTime
    ? `${reference}${amountInCents}${currency}${expirationTime}${secret}`
    : `${reference}${amountInCents}${currency}${secret}`;
  return crypto.createHash('sha256').update(base).digest('hex');
}

function buildCheckoutUrl({ reference, amountInCents, redirectUrl, customerEmail, key = publicKey(), secret = integritySecret() }) {
  const params = new URLSearchParams();
  params.set('public-key', key);
  params.set('currency', CURRENCY);
  params.set('amount-in-cents', String(amountInCents));
  params.set('reference', reference);
  params.set('signature:integrity', integritySignature(reference, amountInCents, CURRENCY, secret));
  if (redirectUrl) params.set('redirect-url', redirectUrl);
  if (customerEmail) params.set('customer-data:email', customerEmail);
  return `${CHECKOUT_URL}?${params.toString()}`;
}

function getPath(obj, dotted) {
  return dotted.split('.').reduce((acc, k) => (acc == null ? undefined : acc[k]), obj);
}

/**
 * Verifica el checksum de un evento de Wompi:
 * SHA256(valores de `signature.properties` en orden + timestamp + secreto), hex
 * en mayusculas. Comparacion en tiempo constante.
 */
function verifyEventChecksum(body, secret = eventsSecret()) {
  if (!secret || !body || !body.signature || !Array.isArray(body.signature.properties)) return false;
  const provided = String(body.signature.checksum || '');
  if (!/^[0-9a-fA-F]{64}$/.test(provided)) return false;
  const concatenated = body.signature.properties
    .map((prop) => {
      const v = getPath(body.data, prop);
      return v === undefined || v === null ? '' : String(v);
    })
    .join('') + String(body.timestamp) + secret;
  const expected = crypto.createHash('sha256').update(concatenated).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected.toUpperCase()), Buffer.from(provided.toUpperCase()));
}

/** Consulta una transaccion a Wompi por id (endpoint publico de lectura). */
async function fetchTransaction(transactionId) {
  const id = String(transactionId || '').trim();
  if (!/^[A-Za-z0-9\-_]{4,80}$/.test(id)) {
    const err = new Error('transactionId invalido');
    err.code = 'INVALID_ID';
    throw err;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${apiBase()}/transactions/${encodeURIComponent(id)}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (res.status === 404) {
      const err = new Error('Transaccion no encontrada en Wompi');
      err.code = 'NOT_FOUND';
      throw err;
    }
    if (!res.ok) {
      const err = new Error(`Wompi respondio ${res.status}`);
      err.code = 'UPSTREAM';
      throw err;
    }
    const json = await res.json();
    return json && json.data ? json.data : null;
  } finally {
    clearTimeout(timer);
  }
}

const STATUS_MAP = {
  APPROVED: 'approved',
  DECLINED: 'declined',
  VOIDED: 'voided',
  ERROR: 'error',
  PENDING: 'pending',
};

/**
 * Aplica el estado de una transaccion de Wompi a la orden local.
 *
 * Devuelve `{ payment, released }` o `null` si la referencia no es nuestra.
 * Si la transaccion viene APROBADA pero el monto o la moneda no cuadran con la
 * orden, NO libera: queda en `error` con el payload guardado para revisarlo a
 * mano. Es el caso de alguien que manipulo el checkout y Wompi igual cobro.
 */
async function applyTransaction(transaction) {
  if (!transaction || !transaction.reference) return null;

  return db.transaction(async (trx) => {
    const payment = await trx('payments').where('reference', transaction.reference).forUpdate().first();
    if (!payment) return null;

    const wompiStatus = String(transaction.status || '').toUpperCase();
    let status = STATUS_MAP[wompiStatus] || 'pending';

    const amountOk = Number(transaction.amount_in_cents) === Number(payment.amount_in_cents);
    const currencyOk = String(transaction.currency || CURRENCY).toUpperCase() === String(payment.currency).toUpperCase();
    if (status === 'approved' && !(amountOk && currencyOk)) {
      console.error(`⚠️ Wompi: transaccion ${transaction.id} aprobada con monto/moneda distintos a la orden ${payment.reference}`);
      status = 'error';
    }

    // Una orden ya aprobada no retrocede: los webhooks pueden llegar fuera de
    // orden (PENDING despues de APPROVED) y un reintento no debe des-liberar.
    if (payment.status === 'approved') {
      return { payment, released: 0, alreadyApproved: true };
    }

    const update = {
      status,
      wompi_transaction_id: transaction.id || payment.wompi_transaction_id,
      payment_method: transaction.payment_method_type || payment.payment_method,
      wompi_payload: JSON.stringify(transaction),
      updated_at: trx.fn.now(),
    };
    let released = 0;

    if (status === 'approved') {
      update.approved_at = transaction.finalized_at ? new Date(transaction.finalized_at) : new Date();
      const itemIds = (await trx('payment_items').where('payment_id', payment.id).pluck('participant_evaluation_id'));
      if (itemIds.length) {
        released = await trx('participant_evaluations')
          .whereIn('id', itemIds)
          .whereNull('paid_at')
          .update({ paid_at: update.approved_at, payment_id: payment.id, updated_at: trx.fn.now() });
      }
    }

    await trx('payments').where('id', payment.id).update(update);
    const fresh = await trx('payments').where('id', payment.id).first();
    return { payment: fresh, released };
  });
}

module.exports = {
  CHECKOUT_URL,
  CURRENCY,
  publicKey,
  isSandbox,
  apiBase,
  getUnitPriceCop,
  isConfigured,
  integritySignature,
  buildCheckoutUrl,
  verifyEventChecksum,
  fetchTransaction,
  applyTransaction,
};
