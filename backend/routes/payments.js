/**
 * Pagos del evaluador por prueba (Wompi).
 *
 *   GET  /api/payments/config              ¿esta activo el cobro? precio, ambiente
 *   GET  /api/payments/pending             pruebas sin pagar de sus empresas
 *   POST /api/payments/checkout            crea la orden y devuelve la URL de Wompi
 *   POST /api/payments/verify              tras el redirect: confirma contra Wompi
 *   GET  /api/payments                     historial de ordenes del evaluador
 *   GET  /api/payments/:reference          detalle de una orden
 *   POST /api/payments/wompi/events        webhook de Wompi (publico, firmado)
 *
 * Tarifa: precio por prueba, con un tramo por volumen que aplica a TODA la
 * orden cuando supera `bulkMinQty` (ver `services/wompi.js`). El monto lo
 * calcula siempre el backend a partir de las pruebas seleccionadas; el
 * frontend nunca manda un precio ni un total.
 *
 * "Pendiente de pago" = la prueba no tiene `paid_at` Y su evaluacion no fue
 * liberada a mano por el admin (`evaluations.paid`). Se listan pruebas en
 * cualquier estado: el evaluador decide si paga por adelantado o solo las
 * completadas (la UI ofrece ambos atajos). Lo unico que bloquea son las que
 * ya tienen resultados, asi que pagar solo las completadas alcanza para
 * descargar el informe de hoy.
 */
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const db = require('../config/database');
const { auth, authorize, getOwnedCompanyIds, isSuperAdmin } = require('../middleware/auth');
const { REQUIRE_PAID_EVALUATION } = require('../config/brand');
const wompi = require('../services/wompi');

const MAX_ITEMS_PER_CHECKOUT = 500;

function publicBaseUrl(req) {
  if (process.env.BRS_PUBLIC_URL) return process.env.BRS_PUBLIC_URL.replace(/\/+$/, '');
  if (process.env.FRONTEND_URL) return process.env.FRONTEND_URL.replace(/\/+$/, '');
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const host = req.get('x-forwarded-host') || req.get('host');
  return `${proto}://${host}`;
}

function parseDemo(raw) {
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : (raw || {});
  } catch (e) {
    return {};
  }
}

function serializePayment(p, items) {
  return {
    id: p.id,
    reference: p.reference,
    status: p.status,
    quantity: p.quantity,
    unitPriceCop: Math.round(p.unit_price_in_cents / 100),
    amountCop: Math.round(Number(p.amount_in_cents) / 100),
    amountInCents: Number(p.amount_in_cents),
    currency: p.currency,
    transactionId: p.wompi_transaction_id,
    paymentMethod: p.payment_method,
    createdAt: p.created_at,
    approvedAt: p.approved_at,
    ...(items ? { items } : {}),
  };
}

async function buildConfig() {
  const pricing = await wompi.getPricing();
  const configured = wompi.isConfigured(pricing.unitPriceCop);
  return {
    // Sin cobro por evaluacion (licenciatarios) no hay nada que pagar aunque
    // Wompi este configurado.
    enabled: REQUIRE_PAID_EVALUATION && configured,
    requirePaidEvaluation: REQUIRE_PAID_EVALUATION,
    configured,
    sandbox: configured ? wompi.isSandbox() : false,
    unitPriceCop: pricing.unitPriceCop,
    // Tramo por volumen (0 = sin tramo). Aplica a toda la orden cuando la
    // cantidad SUPERA bulkMinQty. La UI lo necesita para mostrar el precio
    // que de verdad se va a cobrar segun lo que el evaluador seleccione.
    bulkPriceCop: pricing.bulkPriceCop,
    bulkMinQty: pricing.bulkMinQty,
    currency: wompi.CURRENCY,
  };
}

// Pruebas sin pagar de las empresas del usuario (o de todas, para super-admin).
function pendingQuery(companyIds, superAdmin) {
  const q = db('participant_evaluations as pe')
    .join('participants as p', 'pe.participant_id', 'p.id')
    .join('evaluations as e', 'pe.evaluation_id', 'e.id')
    .join('companies as c', 'e.company_id', 'c.id')
    .whereNull('pe.paid_at')
    .where('e.paid', false);
  if (!superAdmin) q.whereIn('e.company_id', companyIds);
  return q;
}

// ---------------------------------------------------------------------------
// Webhook de Wompi. Publico: va ANTES de router.use(auth). Rate limit propio
// para que un bombardeo de eventos falsos no consuma el limite global.
// ---------------------------------------------------------------------------
const eventsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: { error: 'Too many requests' },
  validate: { trustProxy: false },
});

router.post('/wompi/events', eventsLimiter, async (req, res) => {
  const body = req.body || {};
  if (!wompi.verifyEventChecksum(body)) {
    // 401 a proposito: Wompi reintenta ante cualquier codigo != 200 y aqui
    // NO queremos que reintente un evento con firma invalida.
    console.warn('⚠️ Wompi: evento con checksum invalido o secreto no configurado');
    return res.status(401).json({ error: 'Firma invalida' });
  }

  try {
    if (body.event === 'transaction.updated' && body.data && body.data.transaction) {
      const result = await wompi.applyTransaction(body.data.transaction);
      if (result) {
        console.log(`💳 Wompi: orden ${result.payment.reference} → ${result.payment.status} (${result.released} pruebas liberadas)`);
      } else {
        console.warn(`⚠️ Wompi: referencia desconocida ${body.data.transaction.reference}`);
      }
    }
    // Siempre 200 una vez verificada la firma: un evento que no entendemos no
    // debe hacer que Wompi lo reintente tres veces.
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Wompi webhook error:', err);
    // 500 → Wompi reintenta (30 min, 3 h, 24 h). Correcto para un fallo de DB.
    res.status(500).json({ error: 'Error interno' });
  }
});

// ---------------------------------------------------------------------------
// Rutas del evaluador
// ---------------------------------------------------------------------------
router.use(auth, authorize('evaluator', 'admin'));

router.get('/config', async (req, res) => {
  try {
    res.json(await buildConfig());
  } catch (err) {
    console.error('Payments config error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/pending', async (req, res) => {
  try {
    const config = await buildConfig();
    const superAdmin = isSuperAdmin(req.user);
    const companyIds = superAdmin ? [] : await getOwnedCompanyIds(req.user.userId);

    const rows = await pendingQuery(companyIds, superAdmin)
      .select(
        'pe.id as pe_id',
        'pe.status',
        'pe.completed_at',
        'pe.assigned_at',
        'p.id as participant_id',
        'p.email',
        'p.demographic_data',
        'e.id as evaluation_id',
        'e.name as evaluation_name',
        'e.status as evaluation_status',
        'c.id as company_id',
        'c.name as company_name',
        db.raw('EXISTS (SELECT 1 FROM results r WHERE r.participant_evaluation_id = pe.id) as has_results')
      )
      .orderBy('c.name')
      .orderBy('e.created_at', 'desc')
      .orderBy('pe.completed_at', 'desc')
      .orderBy('pe.id', 'desc');

    const items = rows.map((r) => {
      const demo = parseDemo(r.demographic_data);
      return {
        participantEvaluationId: r.pe_id,
        participantId: r.participant_id,
        firstName: demo.firstName || '',
        lastName: demo.lastName || '',
        documentNumber: demo.documentNumber || '',
        email: r.email,
        formType: demo.formType || 'A',
        status: r.status,
        completedAt: r.completed_at,
        assignedAt: r.assigned_at,
        hasResults: !!r.has_results,
        evaluationId: r.evaluation_id,
        evaluationName: r.evaluation_name,
        evaluationStatus: r.evaluation_status,
        companyId: r.company_id,
        companyName: r.company_name,
      };
    });

    const completed = items.filter((i) => i.status === 'completed').length;
    res.json({
      config,
      items,
      totals: {
        count: items.length,
        completed,
        // Precio que aplicaria pagandolas todas de una: con el tramo por
        // volumen el total no es una simple multiplicacion por el precio base.
        unitPriceCop: wompi.unitPriceForQuantity(items.length, config),
        amountCop: items.length * wompi.unitPriceForQuantity(items.length, config),
      },
    });
  } catch (err) {
    console.error('Payments pending error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/checkout', async (req, res) => {
  try {
    const config = await buildConfig();
    if (!config.enabled) {
      return res.status(503).json({
        error: 'PAYMENTS_UNAVAILABLE',
        message: config.requirePaidEvaluation
          ? 'La pasarela de pagos no esta configurada en esta instancia. Contacta al administrador.'
          : 'Esta instancia no cobra por prueba.',
      });
    }

    const raw = Array.isArray(req.body && req.body.participantEvaluationIds) ? req.body.participantEvaluationIds : [];
    const ids = [...new Set(raw.map((v) => parseInt(v, 10)).filter((n) => Number.isInteger(n) && n > 0))];
    if (ids.length === 0) {
      return res.status(400).json({ error: 'Selecciona al menos una prueba para pagar' });
    }
    if (ids.length > MAX_ITEMS_PER_CHECKOUT) {
      return res.status(400).json({ error: `Maximo ${MAX_ITEMS_PER_CHECKOUT} pruebas por pago` });
    }

    const superAdmin = isSuperAdmin(req.user);
    const companyIds = superAdmin ? [] : await getOwnedCompanyIds(req.user.userId);

    // Solo se cobran pruebas que sean del usuario Y sigan sin pagar. Si alguna
    // no cumple se rechaza todo: cobrar de menos en silencio dejaria al
    // evaluador creyendo que pago algo que sigue bloqueado.
    const payable = await pendingQuery(companyIds, superAdmin).whereIn('pe.id', ids).pluck('pe.id');
    const rejected = ids.filter((id) => !payable.includes(id));
    if (rejected.length) {
      return res.status(409).json({
        error: 'ITEMS_NOT_PAYABLE',
        message: `${rejected.length} prueba(s) ya estan pagadas, no existen o no te pertenecen. Recarga la lista.`,
        rejected,
      });
    }

    // El precio lo decide la cantidad de la orden, no el frontend: `config`
    // trae los dos tramos y aqui se resuelve cual aplica.
    const unitPriceInCents = wompi.unitPriceForQuantity(ids.length, config) * 100;
    const amountInCents = unitPriceInCents * ids.length;
    const reference = `BRS-${req.user.userId}-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    const payment = await db.transaction(async (trx) => {
      const [row] = await trx('payments')
        .insert({
          user_id: req.user.userId,
          reference,
          amount_in_cents: amountInCents,
          currency: wompi.CURRENCY,
          unit_price_in_cents: unitPriceInCents,
          quantity: ids.length,
          status: 'pending',
        })
        .returning('*');
      await trx('payment_items').insert(ids.map((id) => ({ payment_id: row.id, participant_evaluation_id: id })));
      return row;
    });

    // Sin query string propio: Wompi le pega `?id=<transaccion>` al volver y
    // no esta documentado como se comporta si la URL ya trae parametros. La
    // referencia la guarda el frontend en sessionStorage antes de irse.
    const redirectUrl = `${publicBaseUrl(req)}/evaluator/payments/result/`;
    const checkoutUrl = wompi.buildCheckoutUrl({
      reference,
      amountInCents,
      redirectUrl,
      customerEmail: req.user.email,
    });

    res.status(201).json({
      payment: serializePayment(payment),
      checkoutUrl,
      redirectUrl,
      sandbox: config.sandbox,
    });
  } catch (err) {
    console.error('Payments checkout error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * Confirmacion tras el redirect. El navegador trae `?id=<transaccion>`; aqui
 * se consulta esa transaccion a Wompi y se aplica. Es la red de seguridad
 * cuando el webhook aun no llego (o no esta configurado).
 */
router.post('/verify', async (req, res) => {
  try {
    const { transactionId, reference } = req.body || {};
    const superAdmin = isSuperAdmin(req.user);

    let payment = null;
    if (transactionId) {
      let transaction;
      try {
        transaction = await wompi.fetchTransaction(transactionId);
      } catch (e) {
        if (e.code === 'INVALID_ID') return res.status(400).json({ error: 'transactionId invalido' });
        if (e.code === 'NOT_FOUND') return res.status(404).json({ error: 'Wompi no encontro esa transaccion' });
        console.error('Wompi fetchTransaction error:', e);
        return res.status(502).json({ error: 'No se pudo consultar a Wompi. Intenta de nuevo en un momento.' });
      }
      if (!transaction) return res.status(404).json({ error: 'Wompi no encontro esa transaccion' });

      const owner = await db('payments').where('reference', transaction.reference).first();
      if (!owner) return res.status(404).json({ error: 'La transaccion no corresponde a ninguna orden de esta plataforma' });
      if (!superAdmin && owner.user_id !== req.user.userId) {
        return res.status(403).json({ error: 'No autorizado' });
      }

      const result = await wompi.applyTransaction(transaction);
      payment = result ? result.payment : owner;
    } else if (reference) {
      const q = db('payments').where('reference', String(reference));
      if (!superAdmin) q.where('user_id', req.user.userId);
      payment = await q.first();
      if (!payment) return res.status(404).json({ error: 'Orden no encontrada' });
    } else {
      return res.status(400).json({ error: 'transactionId o reference es requerido' });
    }

    res.json({ payment: serializePayment(payment) });
  } catch (err) {
    console.error('Payments verify error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/', async (req, res) => {
  try {
    const superAdmin = isSuperAdmin(req.user);
    const q = db('payments as pay').leftJoin('users as u', 'pay.user_id', 'u.id');
    if (!superAdmin) q.where('pay.user_id', req.user.userId);
    const rows = await q
      .select('pay.*', 'u.email as user_email')
      .orderBy('pay.created_at', 'desc')
      .limit(200);
    res.json({
      payments: rows.map((p) => ({ ...serializePayment(p), userEmail: p.user_email })),
    });
  } catch (err) {
    console.error('Payments list error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/:reference', async (req, res) => {
  try {
    const superAdmin = isSuperAdmin(req.user);
    const q = db('payments').where('reference', String(req.params.reference));
    if (!superAdmin) q.where('user_id', req.user.userId);
    const payment = await q.first();
    if (!payment) return res.status(404).json({ error: 'Orden no encontrada' });

    const items = await db('payment_items as pi')
      .join('participant_evaluations as pe', 'pi.participant_evaluation_id', 'pe.id')
      .join('participants as p', 'pe.participant_id', 'p.id')
      .join('evaluations as e', 'pe.evaluation_id', 'e.id')
      .where('pi.payment_id', payment.id)
      .select('pe.id as pe_id', 'pe.paid_at', 'pe.status', 'p.demographic_data', 'e.name as evaluation_name')
      .orderBy('pe.id');

    res.json({
      payment: serializePayment(payment, items.map((r) => {
        const demo = parseDemo(r.demographic_data);
        return {
          participantEvaluationId: r.pe_id,
          firstName: demo.firstName || '',
          lastName: demo.lastName || '',
          documentNumber: demo.documentNumber || '',
          status: r.status,
          paidAt: r.paid_at,
          evaluationName: r.evaluation_name,
        };
      })),
    });
  } catch (err) {
    console.error('Payments detail error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
