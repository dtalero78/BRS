/**
 * Middleware de autenticación por API key para integraciones server-to-server.
 *
 * Verifica el header X-Api-Key contra la env var BRS_INTEGRATION_API_KEY.
 * Si no coincide, devuelve 401. Si la env var no está configurada, devuelve
 * 503 para evitar exponer el endpoint accidentalmente.
 *
 * Usar timing-safe compare para mitigar ataques de side-channel.
 */
const crypto = require('crypto');

function timingSafeEqual(a, b) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function apiKeyAuth(req, res, next) {
  const expected = process.env.BRS_INTEGRATION_API_KEY;
  if (!expected) {
    console.error('[api-key] BRS_INTEGRATION_API_KEY no configurada — endpoint deshabilitado');
    return res.status(503).json({ error: 'Integration API not configured' });
  }

  // x-api-key puede llegar como array si el header viene duplicado.
  // Coercer a string para no romper Buffer.from.
  const rawProvided = req.headers['x-api-key'];
  const provided = Array.isArray(rawProvided) ? rawProvided[0] : rawProvided;
  if (!provided || typeof provided !== 'string' || !timingSafeEqual(provided, expected)) {
    return res.status(401).json({ error: 'Invalid or missing API key' });
  }

  next();
}

module.exports = apiKeyAuth;
