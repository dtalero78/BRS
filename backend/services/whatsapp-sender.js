/**
 * Envio de invitaciones por WhatsApp via Twilio.
 *
 * Se usa la API REST directamente (Node >= 18 trae fetch global) para no sumar
 * el SDK de Twilio como dependencia: el unico llamado que hacemos es un POST
 * de formulario.
 *
 * Los mensajes son business-initiated (el participante nunca escribio primero),
 * asi que WhatsApp EXIGE una plantilla aprobada; texto libre no se entrega. De
 * ahi que se mande `ContentSid` + `ContentVariables` y no `Body`.
 *
 * Config por instancia (sin estas env vars el endpoint responde 503):
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_WHATSAPP_FROM              ej. whatsapp:+15559533027
 *   TWILIO_TEMPLATE_BRS_INVITACION    SID de la plantilla (HX...)
 */

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM;
const TEMPLATE_SID = process.env.TWILIO_TEMPLATE_BRS_INVITACION;

/** El envio masivo solo se habilita si la instancia tiene Twilio configurado. */
function isConfigured() {
  return Boolean(ACCOUNT_SID && AUTH_TOKEN && WHATSAPP_FROM && TEMPLATE_SID);
}

/**
 * Normaliza a E.164 colombiano.
 *
 * Los numeros llegan del Excel del cliente en formatos variados: "3001234567",
 * "300 123 4567", "573001234567", "+57 300 1234567". Solo se acepta lo que
 * quede como movil colombiano de 10 digitos empezando en 3; cualquier otra
 * cosa devuelve null y se reporta como fallo en vez de mandarse a ciegas.
 */
function normalizarCelular(raw) {
  // Algunos registros traen dos numeros ("A / B"); se toma el primero.
  let d = String(raw || '').split('/')[0].replace(/\D/g, '');
  if (d.startsWith('57') && d.length === 12) d = d.slice(2);
  if (d.length !== 10 || !d.startsWith('3')) return null;
  return `+57${d}`;
}

/**
 * Envia una invitacion. Devuelve { ok, sid } o { ok:false, error }.
 *
 * `token` viaja como variable {{3}} y la plantilla lo concatena a la URL base;
 * WhatsApp exige que la parte dinamica de un boton URL sea un sufijo, por eso
 * no se manda el link completo.
 */
async function enviarInvitacion({ telefono, nombre, empresa, token }) {
  if (!isConfigured()) return { ok: false, error: 'Twilio no configurado en esta instancia' };

  const to = normalizarCelular(telefono);
  if (!to) return { ok: false, error: `Celular invalido: ${telefono || '(vacio)'}` };
  if (!token) return { ok: false, error: 'El participante no tiene link generado' };

  const body = new URLSearchParams({
    To: `whatsapp:${to}`,
    From: WHATSAPP_FROM,
    ContentSid: TEMPLATE_SID,
    ContentVariables: JSON.stringify({
      1: nombre || 'colaborador',
      2: empresa || 'tu empresa',
      3: token,
    }),
  });

  try {
    const resp = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
        signal: AbortSignal.timeout(20000),
      }
    );

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      // Twilio devuelve {code, message}; el code sirve para diagnosticar
      // (63016 = fuera de ventana sin plantilla, 21211 = numero invalido).
      return { ok: false, error: data.message || `HTTP ${resp.status}`, code: data.code };
    }
    return { ok: true, sid: data.sid, status: data.status };
  } catch (err) {
    return { ok: false, error: err.name === 'TimeoutError' ? 'Timeout de Twilio' : err.message };
  }
}

module.exports = { isConfigured, normalizarCelular, enviarInvitacion, WHATSAPP_FROM };
