/**
 * Emite webhooks a sistemas externos cuando una evaluación de integración
 * (provisionada vía /api/integration) llega a estado 'completed'.
 *
 * Las URLs y secrets viven en integration_metadata del participant_evaluation:
 *   - callbackUrl: URL a la que se hace POST
 *   - El secret de firma viene del env var BRS_WEBHOOK_SECRET
 *
 * Firma: header X-Brs-Signature = HMAC-SHA256(secret, body_raw)
 *
 * Fire-and-forget: no bloquea el flujo del paciente. Errores se loguean.
 * Single retry: 1 reintento con backoff de 2 segundos si la primera falla.
 */
const crypto = require('crypto');
const db = require('../config/database');

const REQUEST_TIMEOUT_MS = 8000;

function signBody(secret, bodyString) {
  return crypto.createHmac('sha256', secret).update(bodyString).digest('hex');
}

async function postWithRetry(url, bodyString, signature, attempt = 1) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Brs-Signature': signature,
        'X-Brs-Event': 'evaluation.completed'
      },
      body: bodyString,
      signal: controller.signal
    });
    clearTimeout(timer);

    if (res.ok) {
      console.log(`[webhook-emitter] OK ${url} (attempt ${attempt})`);
      return true;
    }
    const text = await res.text().catch(() => '');
    console.warn(`[webhook-emitter] ${res.status} ${url} (attempt ${attempt}): ${text.slice(0, 200)}`);
  } catch (err) {
    clearTimeout(timer);
    console.warn(`[webhook-emitter] error ${url} (attempt ${attempt}): ${err.message}`);
  }

  if (attempt < 2) {
    await new Promise(r => setTimeout(r, 2000));
    return postWithRetry(url, bodyString, signature, attempt + 1);
  }
  return false;
}

/**
 * Notifica al sistema externo que una evaluación se completó.
 * Si el participant_evaluation no tiene integration_metadata.callbackUrl,
 * no hace nada (silencio para flujos no-integration).
 *
 * @param {number} participantEvaluationId
 */
async function notifyEvaluationCompleted(participantEvaluationId) {
  try {
    const pe = await db('participant_evaluations')
      .where('id', participantEvaluationId)
      .first();

    if (!pe) {
      console.warn(`[webhook-emitter] PE ${participantEvaluationId} no encontrado`);
      return;
    }

    let metadata = pe.integration_metadata;
    if (typeof metadata === 'string') {
      try { metadata = JSON.parse(metadata); } catch (e) { metadata = null; }
    }
    if (!metadata || !metadata.callbackUrl) {
      // No es una evaluación de integración — no hay a quién notificar.
      return;
    }

    const secret = process.env.BRS_WEBHOOK_SECRET;
    if (!secret) {
      console.error('[webhook-emitter] BRS_WEBHOOK_SECRET no configurado — webhook no enviado');
      return;
    }

    const payload = {
      event: 'evaluation.completed',
      source: metadata.source || 'BRS',
      externalRef: metadata.externalRef,
      // tenantId del sistema externo (ej. 'bsl', 'ipsVip'). Se incluye para que
      // el receiver pueda validar que el externalRef pertenece al tenant esperado
      // y no a otro — defense-in-depth contra un attacker con HMAC secret.
      tenantId: metadata.tenantId || null,
      participantEvaluationId: pe.id,
      evaluationId: pe.evaluation_id,
      participantId: pe.participant_id,
      status: pe.status,
      completedAt: pe.completed_at || new Date().toISOString(),
      timestamp: new Date().toISOString()
    };

    const bodyString = JSON.stringify(payload);
    const signature = signBody(secret, bodyString);

    // Fire and forget — pero con await para que los retries terminen antes
    // de soltar el handle del proceso. No bloqueamos el response al paciente
    // porque participant-access.js llama a esto SIN await.
    await postWithRetry(metadata.callbackUrl, bodyString, signature);
  } catch (err) {
    console.error(`[webhook-emitter] error notificando PE ${participantEvaluationId}:`, err.message);
  }
}

module.exports = {
  notifyEvaluationCompleted
};
