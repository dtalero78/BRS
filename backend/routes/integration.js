/**
 * Integraciones server-to-server con sistemas externos (ej. BSL-PLATAFORMA2).
 *
 * POST /api/integration/participant
 *   Provisiona un participant + participant_evaluation en una empresa existente
 *   y devuelve el token de acceso para que el sistema externo redirija al paciente.
 *
 * Auth: header X-Api-Key contra BRS_INTEGRATION_API_KEY.
 *
 * Idempotencia por externalRef: si ya existe un participant_evaluation con el
 * mismo externalRef en integration_metadata → devuelve el existente sin crear
 * uno nuevo. Esto permite reintentos seguros desde el caller.
 */
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../config/database');
const apiKeyAuth = require('../middleware/api-key');

const TOKEN_TTL_DAYS = 90;

function publicBaseUrl(req) {
  if (process.env.BRS_PUBLIC_URL) return process.env.BRS_PUBLIC_URL.replace(/\/+$/, '');
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  return `${proto}://${req.get('host')}`;
}

router.post('/participant', apiKeyAuth, async (req, res) => {
  try {
    const {
      externalRef,
      tenantId,
      documentNumber,
      firstName,
      lastName,
      formType,
      email,
      phone,
      evaluatorEmail,
      companyName,
      callbackUrl,
      returnUrl
    } = req.body || {};

    if (!externalRef || !documentNumber || !firstName || !lastName || !formType) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['externalRef', 'documentNumber', 'firstName', 'lastName', 'formType']
      });
    }
    if (formType !== 'A' && formType !== 'B') {
      return res.status(400).json({ error: 'formType must be "A" or "B"' });
    }

    const resolvedEvaluatorEmail = (evaluatorEmail || process.env.BRS_INTEGRATION_DEFAULT_EVALUATOR || '').toLowerCase().trim();
    const resolvedCompanyName = (companyName || process.env.BRS_INTEGRATION_DEFAULT_COMPANY || '').trim();
    if (!resolvedEvaluatorEmail || !resolvedCompanyName) {
      return res.status(400).json({ error: 'evaluatorEmail and companyName are required (or set BRS_INTEGRATION_DEFAULT_EVALUATOR / BRS_INTEGRATION_DEFAULT_COMPANY env vars)' });
    }

    // Idempotency: si ya hay un PE con este externalRef, devolverlo
    const existing = await db('participant_evaluations')
      .whereRaw(`integration_metadata->>'externalRef' = ?`, [String(externalRef)])
      .first();

    if (existing) {
      return res.json({
        token: existing.access_token,
        participantId: existing.participant_id,
        participantEvaluationId: existing.id,
        evaluationId: existing.evaluation_id,
        url: `${publicBaseUrl(req)}/participant/evaluation/${existing.access_token}`,
        expiresAt: existing.token_expires_at,
        status: existing.status,
        isNew: false
      });
    }

    // Evaluador: debe existir
    const evaluator = await db('users')
      .whereRaw('LOWER(email) = ?', [resolvedEvaluatorEmail])
      .first();
    if (!evaluator) {
      return res.status(404).json({ error: `Evaluator not found: ${resolvedEvaluatorEmail}` });
    }

    // Empresa: debe existir (no la auto-creamos para evitar typos del caller)
    const company = await db('companies')
      .whereRaw('LOWER(name) = ?', [resolvedCompanyName.toLowerCase()])
      .first();
    if (!company) {
      return res.status(404).json({ error: `Company not found: ${resolvedCompanyName}` });
    }

    // Evaluación contenedora: una sola por empresa+evaluador para todos los
    // participantes provisionados por integración. Se auto-crea si no existe.
    const evaluationName = `${company.name} - Integración BSL`;
    let evaluation = await db('evaluations')
      .where({ company_id: company.id, name: evaluationName })
      .first();
    if (!evaluation) {
      const [created] = await db('evaluations').insert({
        company_id: company.id,
        created_by: evaluator.id,
        name: evaluationName,
        description: 'Evaluaciones auto-provisionadas por integración con BSL-PLATAFORMA2. No editar manualmente.',
        status: 'active'
      }).returning('*');
      evaluation = created;
    }

    // Participant: upsert por (company_id, email).
    // El email puede ser el real (si vino en el request) o un sintético tipo
    // cc_<documento>@temp.com — mismo patrón que usa el importador de Excel
    // de BRS (ver participants.js línea 621).
    const docNum = String(documentNumber).trim();
    const resolvedEmail = (email && email.trim()) ? email.trim().toLowerCase() : `cc_${docNum}@temp.com`;
    const resolvedPhone = phone ? String(phone).trim() : '';

    const demographicData = {
      firstName: String(firstName).trim(),
      lastName: String(lastName).trim(),
      documentType: 'CC',
      documentNumber: docNum,
      formType,
      phone: resolvedPhone
    };

    let participant = await db('participants')
      .where({ company_id: company.id, email: resolvedEmail })
      .first();

    if (!participant) {
      const [created] = await db('participants').insert({
        company_id: company.id,
        email: resolvedEmail,
        demographic_data: JSON.stringify(demographicData)
      }).returning('*');
      participant = created;
    } else {
      // Si el formType cambió (caso poco común: paciente re-creó orden marcando distinto)
      // actualizar para que el cuestionario que se sirva sea el correcto.
      await db('participants')
        .where('id', participant.id)
        .update({
          demographic_data: JSON.stringify(demographicData),
          updated_at: new Date()
        });
    }

    // participant_evaluation: token único de 64 chars (mismo formato que el resto del repo)
    const accessToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiresAt = new Date(Date.now() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

    const integrationMetadata = {
      source: 'BSL',
      externalRef: String(externalRef),
      tenantId: tenantId ? String(tenantId) : null,
      callbackUrl: callbackUrl || null,
      returnUrl: returnUrl || null,
      createdAt: new Date().toISOString()
    };

    // Si ya existe un PE para este (evaluation_id, participant_id) — caso
    // típico: misma persona, segunda orden de Platzi. La UNIQUE(evaluation_id,
    // participant_id) impide tener dos filas, así que tenemos que reusar la fila.
    // Política: si el token sigue válido, lo REUSAMOS (no regeneramos), porque
    // regenerar invalidaría sesiones en vuelo y dejaría la orden previa con un
    // brs_access_token apuntando a 404. Solo regeneramos si el token expiró.
    const existingPe = await db('participant_evaluations')
      .where({ evaluation_id: evaluation.id, participant_id: participant.id })
      .first();

    let pe;
    let finalToken;
    let finalExpiresAt;
    if (existingPe) {
      const tokenStillValid = existingPe.access_token
        && existingPe.token_expires_at
        && new Date(existingPe.token_expires_at) > new Date();

      if (tokenStillValid) {
        // Reusar token existente; solo actualizar metadata para reflejar el
        // externalRef más reciente (último wins) y mantener trazabilidad.
        [pe] = await db('participant_evaluations')
          .where('id', existingPe.id)
          .update({
            integration_metadata: JSON.stringify(integrationMetadata),
            updated_at: new Date()
          })
          .returning('*');
        finalToken = existingPe.access_token;
        finalExpiresAt = existingPe.token_expires_at;
      } else {
        // Token expirado o ausente → regenerar.
        [pe] = await db('participant_evaluations')
          .where('id', existingPe.id)
          .update({
            access_token: accessToken,
            token_expires_at: tokenExpiresAt,
            integration_metadata: JSON.stringify(integrationMetadata),
            updated_at: new Date()
          })
          .returning('*');
        finalToken = accessToken;
        finalExpiresAt = tokenExpiresAt;
      }
    } else {
      // Race con UNIQUE en (integration_metadata->>'externalRef'): si dos
      // POSTs concurrentes con mismo externalRef pasan el SELECT inicial al
      // mismo tiempo, uno hará el INSERT y el otro chocará con la UNIQUE.
      // Manejamos la violación re-queryando y devolviendo el ganador.
      try {
        [pe] = await db('participant_evaluations').insert({
          evaluation_id: evaluation.id,
          participant_id: participant.id,
          status: 'assigned',
          assigned_at: new Date(),
          access_token: accessToken,
          token_expires_at: tokenExpiresAt,
          integration_metadata: JSON.stringify(integrationMetadata)
        }).returning('*');
        finalToken = accessToken;
        finalExpiresAt = tokenExpiresAt;
      } catch (insertErr) {
        const isUniqueViolation = insertErr && (insertErr.code === '23505' || /uniq_pe_external_ref|duplicate key/i.test(insertErr.message || ''));
        if (!isUniqueViolation) throw insertErr;

        const winner = await db('participant_evaluations')
          .whereRaw(`integration_metadata->>'externalRef' = ?`, [String(externalRef)])
          .first();
        if (!winner) {
          // Carrera improbable: la fila ganadora desapareció entre el insert y el re-query.
          throw new Error('UNIQUE violation but ganador no encontrado al re-query');
        }
        return res.json({
          token: winner.access_token,
          participantId: winner.participant_id,
          participantEvaluationId: winner.id,
          evaluationId: winner.evaluation_id,
          companyId: company.id,
          url: `${publicBaseUrl(req)}/participant/evaluation/${winner.access_token}`,
          expiresAt: winner.token_expires_at,
          status: winner.status,
          isNew: false,
          raceWinner: true
        });
      }
    }

    return res.json({
      token: finalToken,
      participantId: participant.id,
      participantEvaluationId: pe.id,
      evaluationId: evaluation.id,
      companyId: company.id,
      url: `${publicBaseUrl(req)}/participant/evaluation/${finalToken}`,
      expiresAt: finalExpiresAt,
      status: pe.status,
      isNew: !existingPe
    });

  } catch (error) {
    console.error('[integration] POST /participant error:', error);
    return res.status(500).json({ error: 'Internal server error', detail: error.message });
  }
});

module.exports = router;
