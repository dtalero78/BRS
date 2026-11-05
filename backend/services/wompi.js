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
 *   BRS_TEST_PRICE_COP       precio por prueba en pesos (entero)
 *   BRS_TEST_PRICE_BULK_COP  precio por prueba en ordenes grandes (opcional)
 *   BRS_TEST_BULK_MIN_QTY    desde cuantas pruebas aplica ese precio (def. 250)
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

function envInt(name) {
  const n = parseInt(process.env[name] || '0', 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// Desde cuantas pruebas aplicaba el precio por volumen en el esquema viejo de
// dos env vars. El descuento entraba al SUPERAR este numero (251 con 250).
const DEFAULT_BULK_MIN_QTY = 250;

/**
 * Ordena los tramos y descarta los que no tienen sentido cobrar.
 *
 * Un tramo que cuesta igual o mas que el anterior le cobraria al evaluador
 * por comprar mas, que es justo lo contrario de un descuento por volumen: es
 * un error de configuracion y se ignora en vez de aplicarse.
 *
 * Si el tramo mas bajo no arranca en 1 no hay precio para una orden chica, y
 * una tarifa con huecos no se puede cobrar: se descarta entera para que el
 * calculo caiga al siguiente nivel (global, y luego env vars) en vez de
 * quedarse sin precio.
 */
function normalizeTiers(tiers) {
  const ordenados = (tiers || [])
    .map((t) => ({ minQty: parseInt(t.minQty, 10), unitPriceCop: parseInt(t.unitPriceCop, 10) }))
    .filter((t) => Number.isFinite(t.minQty) && t.minQty >= 1 && Number.isFinite(t.unitPriceCop) && t.unitPriceCop > 0)
    .sort((a, b) => a.minQty - b.minQty);

  if (!ordenados.length || ordenados[0].minQty !== 1) return [];

  const limpios = [ordenados[0]];
  for (const t of ordenados.slice(1)) {
    if (t.unitPriceCop < limpios[limpios.length - 1].unitPriceCop) limpios.push(t);
  }
  return limpios;
}

// Una tarifa mal cargada se avisa UNA vez, no en cada request: `getPricing`
// corre en cada /config, /pending y /checkout.
//
// La clave incluye los conteos, no solo el alcance: "se descarto entera" y
// "se ignoraron N tramos" son problemas distintos, y con la clave puesta en
// el alcance a secas el segundo quedaba mudo. Y arreglar la tarifa limpia la
// marca, para que un problema nuevo meses despues —el proceso vive semanas—
// vuelva a avisar en vez de pasar en silencio.
const avisados = new Set();
function avisarDescarte(alcance, pedidos, limpios) {
  if (pedidos.length === limpios.length) {
    // Tarifa sana: se olvida CUALQUIER aviso previo de este alcance. Borrar la
    // clave de este caso no serviria — solo se guardan claves de tarifas rotas,
    // y esta no lo esta. Si el mismo problema reaparece, vuelve a avisar.
    for (const k of avisados) if (k.startsWith(`${alcance}|`)) avisados.delete(k);
    return;
  }
  const clave = `${alcance}|${pedidos.length}|${limpios.length}`;
  if (avisados.has(clave)) return;
  avisados.add(clave);
  if (!limpios.length) {
    console.error(`⚠️ Wompi: la tarifa de ${alcance} se descarto entera — no arranca en min_qty = 1, ` +
      'asi que no cubre las ordenes chicas. Se usara la tarifa del nivel siguiente.');
  } else {
    console.error(`⚠️ Wompi: en la tarifa de ${alcance} se ignoraron ${pedidos.length - limpios.length} tramo(s): ` +
      'su precio no baja respecto al anterior, cobrarian mas por comprar mas.');
  }
}

/** Tramos guardados en `pricing_tiers`. `userId` null = tarifa de la instancia. */
async function loadTiers(userId) {
  const q = db('pricing_tiers').select('min_qty as minQty', 'unit_price_cop as unitPriceCop');
  if (userId == null) q.whereNull('user_id');
  else q.where('user_id', userId);

  const filas = await q;
  const limpios = normalizeTiers(filas);
  // Sin esto, borrar por error la fila `desde 1` de un acuerdo deja al
  // evaluador pagando la tarifa plena sin una linea en los logs que lo diga.
  avisarDescarte(userId == null ? 'la instancia' : `el evaluador ${userId}`, filas, limpios);
  return limpios;
}

/**
 * Tarifa del esquema viejo (env vars / system_configs), expresada como tramos.
 * Es el fallback cuando `pricing_tiers` esta vacia, asi que una instancia que
 * nunca toque la tabla sigue cobrando exactamente igual que antes.
 */
async function envTiers() {
  const cfg = {};
  try {
    const rows = await db('system_configs').whereIn('config_key', [
      'wompi_unit_price_cop', 'wompi_bulk_price_cop', 'wompi_bulk_min_qty',
    ]);
    rows.forEach((r) => {
      const n = parseInt(r.config_value, 10);
      if (Number.isFinite(n) && n > 0) cfg[r.config_key] = n;
    });
  } catch (e) {
    // La tabla existe desde el esquema inicial; si falla, caemos a env vars.
  }

  const unitPriceCop = cfg.wompi_unit_price_cop || envInt('BRS_TEST_PRICE_COP');
  if (!unitPriceCop) return [];

  const bulkPriceCop = cfg.wompi_bulk_price_cop || envInt('BRS_TEST_PRICE_BULK_COP');
  const bulkMinQty = cfg.wompi_bulk_min_qty || envInt('BRS_TEST_BULK_MIN_QTY') || DEFAULT_BULK_MIN_QTY;

  const tiers = [{ minQty: 1, unitPriceCop }];
  // El esquema viejo aplicaba el descuento al SUPERAR el umbral, no al
  // alcanzarlo: con 250 el precio bajaba en la prueba 251. Se conserva tal
  // cual para no cambiarle el cobro a quien ya esta usando las env vars.
  if (bulkPriceCop > 0) tiers.push({ minQty: bulkMinQty + 1, unitPriceCop: bulkPriceCop });
  return normalizeTiers(tiers);
}

/**
 * Tarifa que le aplica a un evaluador, en tramos por volumen.
 *
 * Tres niveles, de mas especifico a mas general: el acuerdo de ese evaluador
 * (`pricing_tiers` con su `user_id`), la tarifa de la instancia (las mismas
 * filas con `user_id NULL`) y, si no hay ninguna, las env vars de siempre.
 *
 * Un acuerdo propio REEMPLAZA a la tarifa global, no se mezcla con ella:
 * combinar tramos de dos tarifas daria precios que nadie negocio.
 *
 * `source` dice cual de los tres gano, para poder explicarlo en la UI y en un
 * "¿por que me cobraron esto?" dentro de seis meses.
 */
async function getPricing(userId = null) {
  let tiers = [];
  let source = 'env';

  try {
    if (userId != null) {
      tiers = await loadTiers(userId);
      if (tiers.length) source = 'user';
    }
    if (!tiers.length) {
      tiers = await loadTiers(null);
      if (tiers.length) source = 'global';
    }
  } catch (e) {
    // Que la tabla no exista todavia (instancia sin migrar) es esperado y cae
    // a las env vars. CUALQUIER otro fallo de base se propaga: tragarselo
    // cobraria la tarifa de la instancia —mas cara— a un evaluador con
    // acuerdo propio, y la orden quedaria indistinguible de una legitima.
    // Mejor un 500 y que reintente que un cobro silencioso de mas.
    if (!e || e.code !== '42P01') throw e;
  }

  if (!tiers.length) {
    tiers = await envTiers();
    source = 'env';
  }

  return {
    tiers,
    source,
    // Precio de una prueba suelta. Es tambien lo que decide si el modulo
    // esta configurado: sin el no se puede cobrar nada.
    unitPriceCop: tiers.length ? tiers[0].unitPriceCop : 0,
  };
}

/**
 * Precio unitario que aplica a una orden de `qty` pruebas: el del tramo mas
 * alto que la orden alcanza. Aplica a TODA la orden, no solo a las pruebas
 * que exceden el umbral.
 */
function unitPriceForQuantity(qty, pricing) {
  const n = Number(qty) || 0;
  const tiers = (pricing && pricing.tiers) || [];
  if (!tiers.length) return 0;
  let precio = tiers[0].unitPriceCop;
  for (const t of tiers) {
    if (n >= t.minQty) precio = t.unitPriceCop;
    else break;
  }
  return precio;
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
  getPricing,
  unitPriceForQuantity,
  normalizeTiers,
  isConfigured,
  integritySignature,
  buildCheckoutUrl,
  verifyEventChecksum,
  fetchTransaction,
  applyTransaction,
};
