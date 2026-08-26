const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const db = require('../config/database');
const calculateResults = require('../utils/calculate-results');
const { calculateCopingResults } = require('../utils/calculate-coping');
const { isQuestionnaireComplete } = require('../utils/questionnaire-totals');
const { notifyEvaluationCompleted } = require('../services/webhook-emitter');
const {
  isFaceVerificationEnabled,
  isRekognitionAvailable,
  validateFaceImage,
  compareFaces,
  FACE_MATCH_THRESHOLD,
} = require('../utils/rekognition');
const { buildDefaultConsentText } = require('../utils/consent-template');

// ---------------------------------------------------------------------------
// Puerta general: entrar con el número de documento
// ---------------------------------------------------------------------------
// Un solo enlace público (/acceso) para toda la instancia, en vez de repartir
// cientos de enlaces individuales. La persona escribe su documento y el backend
// le devuelve el token que ya tenía asignado.
//
// El documento NO es un secreto: va en cualquier planilla de nómina. Esta
// puerta se abre entonces con un dato público, y lo único que la separa de un
// barrido de cédulas es el límite de intentos de abajo. Se eligió así a
// sabiendas, priorizando que nadie quede varado sin su enlace. Si una instancia
// necesita más, el paso natural es pedir un segundo dato: el año de nacimiento
// ya viene en el demographic_data de toda planilla importada.

const LOOKUP_TOKEN_TTL_DAYS = 90;

// Solo cuentan los intentos FALLIDOS (skipSuccessfulRequests) y, además, un
// acierto BORRA los fallos ya acumulados de esa IP (el resetKey del handler).
// Las dos cosas apuntan a lo mismo: una empresa entera responde desde una sola
// IP de oficina, así que un contador limpio por IP se llenaría con los errores
// de tipeo de los primeros y dejaría bloqueados a los 500 restantes — que es
// justo el modo de falla que este enlace existe para evitar.
//
// El precio, sin adornos: quien ya conozca UNA cédula válida puede intercalar
// un acierto de vez en cuando para limpiar el contador y seguir barriendo.
// Esto frena al curioso, no al decidido. Con el documento como única llave de
// entrada no da para más; la defensa de fondo sería pedir un segundo dato (el
// año de nacimiento ya viene en demographic_data de toda planilla importada).
const lookupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  skipSuccessfulRequests: true,
  message: {
    error: 'Demasiados intentos fallidos. Espera unos minutos e intenta de nuevo.',
    code: 'RATE_LIMITED',
  },
  validate: { trustProxy: false },
});

/** La gente escribe "1.020.717.226" o "1 020 717 226". */
function onlyDigits(value) {
  return String(value ?? '').replace(/\D/g, '');
}

function lookupQuery() {
  return db('participant_evaluations')
    .join('participants', 'participant_evaluations.participant_id', 'participants.id')
    .join('evaluations', 'participant_evaluations.evaluation_id', 'evaluations.id')
    .join('companies', 'evaluations.company_id', 'companies.id')
    .select(
      'participant_evaluations.id as pe_id',
      'participant_evaluations.access_token',
      'participant_evaluations.token_expires_at',
      'participant_evaluations.status',
      'evaluations.id as evaluation_id',
      'evaluations.name as evaluation_name',
      'evaluations.status as evaluation_status',
      'companies.name as company_name'
    );
}

/**
 * POST /lookup  →  { documentNumber }  ⇒  { matches: [{ token, url, ... }] }
 *
 * Devuelve una lista y no un solo token porque una misma persona puede estar
 * en dos evaluaciones abiertas a la vez (dos empresas, o una repetición anual).
 * En ese caso el frontend le pregunta a cuál quiere entrar.
 */
router.post('/lookup', lookupLimiter, async (req, res) => {
  try {
    const raw = String(req.body?.documentNumber ?? '').trim();
    const digits = onlyDigits(raw);
    if (digits.length < 4) {
      return res.status(400).json({
        error: 'Escribe tu número de documento.',
        code: 'INVALID_DOCUMENT',
      });
    }

    // Igualdad exacta primero: así entra por el índice de expresión sobre
    // demographic_data->>'documentNumber' (migración 20260826000001).
    let rows = await lookupQuery()
      .whereRaw("participants.demographic_data->>'documentNumber' IN (?, ?)", [raw, digits]);

    if (rows.length === 0) {
      // El documento guardado puede traer puntos o espacios si el participante
      // se creó a mano desde el formulario. Normalizarlo en SQL obliga a un
      // escaneo secuencial, por eso solo se intenta cuando la búsqueda
      // indexada no encontró nada.
      rows = await lookupQuery().whereRaw(
        "regexp_replace(coalesce(participants.demographic_data->>'documentNumber', ''), '[^0-9]', '', 'g') = ?",
        [digits]
      );
    }

    if (rows.length === 0) {
      return res.status(404).json({
        error: 'No encontramos ese número de documento. Verifícalo o comunícate con el área de gestión humana de tu empresa.',
        code: 'NOT_FOUND',
      });
    }

    // Una batería de una evaluación cerrada no se puede contestar. Se responde
    // distinto de NOT_FOUND a propósito: "tu empresa todavía no la abrió" y
    // "ese documento no está en la lista" mandan a la persona a resolver cosas
    // distintas.
    const open = rows.filter((row) => row.evaluation_status === 'active');
    if (open.length === 0) {
      return res.status(409).json({
        error: 'Tu evaluación no está abierta en este momento. Comunícate con el área de gestión humana de tu empresa.',
        code: 'NOT_AVAILABLE',
      });
    }

    const now = new Date();
    const expiry = new Date(now.getTime() + LOOKUP_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
    const matches = [];

    for (const row of open) {
      let token = row.access_token;

      if (!token) {
        // PE anterior a la columna access_token: se le emite uno ahora, si no
        // esa persona nunca podría entrar por ningún medio.
        token = crypto.randomBytes(32).toString('hex');
        await db('participant_evaluations')
          .where('id', row.pe_id)
          .update({ access_token: token, token_expires_at: expiry });
      } else if (!row.token_expires_at || new Date(row.token_expires_at) <= now) {
        // Vencido: se corre la fecha en vez de generar un token nuevo, porque
        // regenerarlo dejaría en 404 el enlace individual que ya se había
        // enviado por WhatsApp.
        await db('participant_evaluations')
          .where('id', row.pe_id)
          .update({ token_expires_at: expiry });
      }

      matches.push({
        token,
        url: `/participant/evaluation/${token}`,
        evaluationId: row.evaluation_id,
        evaluationName: row.evaluation_name,
        companyName: row.company_name,
        status: row.status,
      });
    }

    // Ver la nota del limitador: un acierto limpia los fallos previos de esa
    // IP, para que los errores de tipeo de una oficina no terminen bloqueando
    // a los compañeros que todavía no han entrado.
    lookupLimiter.resetKey(req.ip);

    // No se devuelve el nombre de la persona. Con el documento como única
    // llave, devolverlo convertiría esta puerta en un directorio de "quién
    // trabaja dónde". Quien entra ve su nombre en la pantalla siguiente, que
    // ya exige el token.
    res.json({ matches });
  } catch (error) {
    console.error('Participant lookup error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ---------------------------------------------------------------------------
// Consentimiento informado (obligatorio en TODAS las instancias)
// ---------------------------------------------------------------------------
// Exigido por la Resolución 2646/2008 y la Ley 1090/2006 para aplicar la
// batería, y por la Ley 1581/2012 para tratar los datos. No es opt-in como la
// verificación facial: aplicar la batería sin consentimiento invalida la
// medición, y el informe organizacional ya afirma que se recogió.

/** Busca el PE por token con lo necesario para el consentimiento. */
async function findPeForConsent(token) {
  return db('participant_evaluations')
    .join('evaluations', 'participant_evaluations.evaluation_id', 'evaluations.id')
    .join('companies', 'evaluations.company_id', 'companies.id')
    .where('participant_evaluations.access_token', token)
    .where('participant_evaluations.token_expires_at', '>', new Date())
    .select(
      'participant_evaluations.id',
      'participant_evaluations.consent_accepted_at',
      'participant_evaluations.consent_declined_at',
      'evaluations.consent_text_override',
      'companies.name as company_name'
    )
    .first();
}

/**
 * Texto que se le muestra a ESTE participante: el del evaluador si lo definió,
 * si no el default de la plantilla.
 */
function consentTextFor(pe) {
  const override = (pe.consent_text_override || '').trim();
  if (override) return override;
  return buildDefaultConsentText({ companyName: pe.company_name });
}

/**
 * GET /:token/consent → qué mostrarle al participante antes del menú.
 */
router.get('/:token/consent', async (req, res) => {
  try {
    const pe = await findPeForConsent(req.params.token);
    if (!pe) return res.status(404).json({ error: 'Token inválido o expirado' });

    res.json({
      accepted: !!pe.consent_accepted_at,
      declined: !!pe.consent_declined_at,
      acceptedAt: pe.consent_accepted_at,
      text: consentTextFor(pe),
    });
  } catch (error) {
    console.error('Get consent error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * POST /:token/consent → registra la decisión. Body: `{ accepted: boolean }`.
 *
 * Al aceptar se guarda un SNAPSHOT del texto exacto que se mostró: el
 * evaluador puede editarlo después, y sin la copia no habría forma de probar
 * qué fue lo que la persona aceptó.
 *
 * Rechazar no es definitivo: aceptar más tarde limpia el rechazo. La
 * participación es voluntaria y cambiar de opinión hace parte de eso.
 */
router.post('/:token/consent', async (req, res) => {
  try {
    const { accepted } = req.body || {};
    if (typeof accepted !== 'boolean') {
      return res.status(400).json({ error: 'accepted debe ser booleano' });
    }

    const pe = await findPeForConsent(req.params.token);
    if (!pe) return res.status(404).json({ error: 'Token inválido o expirado' });

    const ahora = new Date();
    const update = accepted
      ? {
          consent_accepted_at: pe.consent_accepted_at || ahora,
          consent_declined_at: null,
          consent_ip: clientIp(req),
          consent_text: pe.consent_accepted_at ? undefined : consentTextFor(pe),
        }
      : {
          consent_accepted_at: null,
          consent_declined_at: ahora,
          consent_ip: clientIp(req),
        };
    // `undefined` no debe llegar a knex como columna a actualizar.
    Object.keys(update).forEach(k => update[k] === undefined && delete update[k]);

    await db('participant_evaluations').where('id', pe.id).update(update);
    res.json({ accepted, declined: !accepted });
  } catch (error) {
    console.error('Post consent error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/** ¿Este PE ya aceptó el consentimiento? */
async function hasConsent(peId) {
  const row = await db('participant_evaluations')
    .where('id', peId)
    .whereNotNull('consent_accepted_at')
    .first();
  return !!row;
}

// ---------------------------------------------------------------------------
// Verificación facial (opt-in por instancia vía FACE_VERIFICATION_ENABLED)
// ---------------------------------------------------------------------------

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  return (typeof fwd === 'string' && fwd.split(',')[0].trim()) || req.socket.remoteAddress || 'unknown';
}

/** Busca el PE por access_token vigente. Devuelve null si no existe o expiró. */
async function findPeByToken(token) {
  return db('participant_evaluations')
    .where('access_token', token)
    .where('token_expires_at', '>', new Date())
    .select(
      'id',
      'status',
      'face_reference_photo',
      'face_reference_at'
    )
    .first();
}

async function logFaceVerification({ peId, questionnaireType, mode, verified, score, issues, capturedPhoto, ip }) {
  try {
    await db('face_verifications').insert({
      participant_evaluation_id: peId,
      questionnaire_type: questionnaireType || null,
      mode,
      verified,
      score: score == null ? null : Math.round(score * 100) / 100,
      issues: issues && issues.length ? issues.join('; ') : null,
      captured_photo: capturedPhoto || null,
      ip: ip || null,
    });
  } catch (err) {
    // La bitácora no debe tumbar la verificación en sí.
    console.error('Face verification log error:', err.message);
  }
}

/**
 * ¿El participante ya mostró la cara para ESTE cuestionario?
 *
 * Una verificación por formulario, sin ventana de tiempo. La regla anterior era
 * temporal (una cada 4h) y resultó inútil: la batería completa toma 20-40 min,
 * o sea que cabía entera en una sola ventana y la cara se pedía una única vez
 * al principio. Atarla al cuestionario da 5 comprobaciones por batería, siempre
 * en el mismo punto y sin interrumpir a mitad de una pregunta.
 *
 * Es lo que hace cumplible el bloqueo desde el backend: sin el questionnaire_type
 * en la bitácora, un POST directo a /responses reusaría la verificación de otro
 * cuestionario.
 */
async function hasVerifiedFaceFor(peId, questionnaireType) {
  const row = await db('face_verifications')
    .where('participant_evaluation_id', peId)
    .where('questionnaire_type', questionnaireType)
    .where('verified', true)
    .first();
  return !!row;
}


/**
 * GET /:token/face-status → qué debe mostrar el frontend antes de dejar responder.
 *
 * `required` es la única señal que el front necesita: si es false, el flujo es
 * el de siempre. `available` distingue "módulo prendido pero mal configurado"
 * (sin credenciales de AWS) de "todo bien", para que el participante vea un
 * mensaje legible en vez de un error opaco.
 */
router.get('/:token/face-status', async (req, res) => {
  try {
    if (!isFaceVerificationEnabled()) {
      return res.json({ required: false });
    }

    const pe = await findPeByToken(req.params.token);
    if (!pe) return res.status(404).json({ error: 'Token inválido o expirado' });

    // OJO: aquí NO se corta por `status === 'completed'`. Se hacía cuando una
    // batería terminada no admitía ninguna escritura, pero el Brief COPE sí se
    // puede responder después (no cuenta para completarla). Con el atajo, la UI
    // se saltaba la selfie mientras el guard de /responses seguía exigiéndola:
    // el participante respondía las 28 preguntas y las perdía con un 403 que se
    // mostraba como "revisa tu conexión". Si ya no queda nada por responder, el
    // hub no deja entrar a ningún cuestionario y la selfie nunca se pide.

    if (!isRekognitionAvailable()) {
      return res.json({ required: true, available: false, enrolled: false });
    }

    // No se devuelve qué cuestionarios ya están verificados a propósito: el
    // frontend pide la cara al entrar a CADA cuestionario en cada sesión. Si
    // recordara las verificaciones viejas, quien abandona un cuestionario a
    // medias y vuelve después entraría sin mostrar la cara. El guard del
    // backend (una verificación por questionnaire_type) es la red de seguridad
    // contra POST directos, no el criterio de cuándo preguntar.
    res.json({
      required: true,
      available: true,
      enrolled: !!pe.face_reference_photo,
    });
  } catch (error) {
    console.error('Face status error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * Rate limit del endpoint facial. La clave es el TOKEN, no la IP: una empresa
 * entera respondiendo desde la oficina sale por una sola IP pública, y limitar
 * por IP dejaría fuera a los compañeros del que reintenta. Por token frena la
 * fuerza bruta contra un participante concreto y acota el gasto en Rekognition
 * (cada intento es una llamada facturada a AWS).
 */
const faceLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  // 5 cuestionarios = 5 verificaciones legítimas por batería, más reintentos
  // por luz/encuadre. Con el límite viejo (12, pensado para 1 sola verificación)
  // un participante rápido con un par de reintentos se bloqueaba a sí mismo.
  max: 25,
  keyGenerator: (req) => req.params.token,
  message: { error: 'Demasiados intentos de verificación. Espera unos minutos e intenta de nuevo.' },
  // `ip: false` porque la clave es el token, no una IP: sin esto la librería
  // avisa en cada arranque de que el keyGenerator no normaliza IPv6.
  validate: { trustProxy: false, ip: false },
});

/**
 * POST /:token/face → enrola (1er ingreso) o verifica (ingresos siguientes).
 *
 * Body: `{ photo: '<data URL base64>' }`.
 *
 * MODO BLOQUEANTE: si la selfie no coincide con la referencia, la respuesta
 * trae `verified: false` y el guard de POST /:token/responses no dejará
 * guardar. La válvula de escape es que el evaluador reinicie la foto de
 * referencia desde `POST /api/participants/:id/reset-face`.
 */
router.post('/:token/face', faceLimiter, async (req, res) => {
  try {
    if (!isFaceVerificationEnabled()) {
      return res.status(404).json({ error: 'Verificación facial no habilitada' });
    }

    const { photo, questionnaireType } = req.body || {};
    if (typeof photo !== 'string' || photo.length < 100) {
      return res.status(400).json({ error: 'Foto inválida' });
    }
    // La verificación es POR cuestionario: sin saber cuál, no se puede registrar
    // ni exigir después en el guard.
    if (!VALID_QUESTIONNAIRE_TYPES.includes(questionnaireType)) {
      return res.status(400).json({ error: 'questionnaireType inválido' });
    }

    const pe = await findPeByToken(req.params.token);
    if (!pe) return res.status(404).json({ error: 'Token inválido o expirado' });

    // La foto del rostro es un dato biométrico: dato SENSIBLE según el art. 5
    // de la Ley 1581/2012. No se captura ni se envía a AWS antes de que el
    // participante haya autorizado su tratamiento.
    if (!(await hasConsent(pe.id))) {
      return res.status(403).json({
        error: 'Debes aceptar el consentimiento informado antes de continuar.',
        code: 'CONSENT_REQUIRED'
      });
    }

    // Sin credenciales no se puede verificar a nadie. Se responde explícito en
    // vez de dejar pasar: el bloqueo es el control que la empresa contrató.
    if (!isRekognitionAvailable()) {
      return res.status(503).json({
        error: 'La verificación de identidad no está disponible en este momento. Contacta a tu evaluador.',
        code: 'FACE_UNAVAILABLE',
      });
    }

    const ip = clientIp(req);

    // ---- ENROLAR (primer ingreso) ----
    if (!pe.face_reference_photo) {
      const validation = await validateFaceImage(photo);
      if (!validation.isValid) {
        // No guardamos una referencia mala: con bloqueo, una referencia borrosa
        // haría fallar todas las verificaciones posteriores.
        await logFaceVerification({
          peId: pe.id, questionnaireType, mode: 'enroll', verified: false,
          score: validation.confidence, issues: validation.issues, capturedPhoto: photo, ip,
        });
        return res.json({ mode: 'enroll', verified: false, issues: validation.issues });
      }

      await db('participant_evaluations')
        .where('id', pe.id)
        .update({ face_reference_photo: photo, face_reference_at: new Date() });
      await logFaceVerification({
        peId: pe.id, questionnaireType, mode: 'enroll', verified: true,
        score: validation.confidence, capturedPhoto: photo, ip,
      });
      return res.json({ mode: 'enroll', verified: true, score: validation.confidence });
    }

    // ---- VERIFICAR (ingresos siguientes) ----
    const cmp = await compareFaces(pe.face_reference_photo, photo, FACE_MATCH_THRESHOLD);
    const score = Math.round(cmp.similarityScore * 100) / 100;
    await logFaceVerification({
      peId: pe.id, questionnaireType, mode: 'verify', verified: cmp.isMatch, score,
      issues: cmp.error ? [cmp.error] : null,
      // Solo se archiva la selfie que NO pasó: es la evidencia del intento.
      capturedPhoto: cmp.isMatch ? null : photo,
      ip,
    });

    res.json({
      mode: 'verify',
      verified: cmp.isMatch,
      score,
      issues: cmp.error === 'no_face' ? ['No se detectó ningún rostro en la foto'] : undefined,
    });
  } catch (error) {
    console.error('Face verification error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

async function autoCalculateResults(peId) {
  try {
    const responses = await db('responses').where('participant_evaluation_id', peId).select('*');
    const toProcess = responses.filter(r => r.questionnaire_type !== 'ficha_datos');
    if (toProcess.length === 0) return;

    // Grupo ocupacional según el formType del participante (A=jefes/profesionales,
    // B=auxiliares/operarios) — determina los baremos duales de extralaboral y estrés.
    // Se toma del formType real y solo se cae a la heurística por presencia de Forma B
    // si no hay formType registrado.
    const peRow = await db('participant_evaluations')
      .join('participants', 'participant_evaluations.participant_id', 'participants.id')
      .where('participant_evaluations.id', peId)
      .select('participants.demographic_data')
      .first();
    let formType = null;
    if (peRow) {
      let demo = peRow.demographic_data;
      if (typeof demo === 'string') { try { demo = JSON.parse(demo); } catch (e) { demo = {}; } }
      formType = (demo && demo.formType) || null;
    }
    const hasBForm = toProcess.some(r => r.questionnaire_type === 'intralaboral_b');
    const occupationalGroup = (formType === 'B' || (formType == null && hasBForm)) ? 'auxiliares' : 'jefes';
    const allResults = [];

    for (const responseRecord of toProcess) {
      let responseData = typeof responseRecord.responses === 'string'
        ? JSON.parse(responseRecord.responses)
        : responseRecord.responses;

      const formattedResponses = Array.isArray(responseData)
        ? responseData.map(item => ({
            question_number: parseInt(item.questionNumber || item.question_number),
            response_value: parseInt(item.responseValue || item.response_value) || 0
          }))
        : Object.entries(responseData).map(([q, v]) => ({
            question_number: parseInt(q),
            response_value: parseInt(v) || 0
          }));

      const calculated = responseRecord.questionnaire_type === 'coping'
        ? calculateCopingResults(formattedResponses)
        : await calculateResults(responseRecord.questionnaire_type, formattedResponses, { occupationalGroup });

      allResults.push(...calculated);
    }

    const resultsByType = {};
    allResults.forEach(r => {
      if (!resultsByType[r.questionnaireType]) resultsByType[r.questionnaireType] = [];
      resultsByType[r.questionnaireType].push({
        dimension: r.dimension,
        rawScore: r.rawScore,
        transformedScore: r.transformedScore,
        percentile: r.percentile,
        riskLevel: r.riskLevel
      });
    });

    await db.transaction(async (trx) => {
      await trx('results').where('participant_evaluation_id', peId).del();
      const rows = Object.entries(resultsByType).map(([qType, res]) => ({
        participant_evaluation_id: peId,
        questionnaire_type: qType,
        results: JSON.stringify(res),
        calculated_at: new Date()
      }));
      if (rows.length > 0) await trx('results').insert(rows);
    });
  } catch (err) {
    console.error('Auto-calculate error for PE', peId, ':', err.message);
  }
}

// Validate access token and get participant data
router.get('/validate/:token', async (req, res) => {
  try {
    const { token } = req.params;

    // Find participant evaluation by access token
    const participantEvaluation = await db('participant_evaluations')
      .join('participants', 'participant_evaluations.participant_id', 'participants.id')
      .join('evaluations', 'participant_evaluations.evaluation_id', 'evaluations.id')
      .join('companies', 'evaluations.company_id', 'companies.id')
      .where('participant_evaluations.access_token', token)
      .where('participant_evaluations.token_expires_at', '>', new Date())
      .select(
        'participants.*',
        'companies.name as company_name',
        'companies.logo_url as company_logo_url',
        'evaluations.id as evaluation_id',
        'evaluations.name as evaluation_name',
        'evaluations.description as evaluation_description',
        'participant_evaluations.status',
        'participant_evaluations.assigned_at',
        'participant_evaluations.completed_at'
      )
      .first();

    if (!participantEvaluation) {
      return res.status(404).json({ 
        error: 'Token inválido o expirado',
        code: 'INVALID_TOKEN'
      });
    }

    // Parse demographic data
    let demographicData = {};
    try {
      demographicData = typeof participantEvaluation.demographic_data === 'string'
        ? JSON.parse(participantEvaluation.demographic_data)
        : (participantEvaluation.demographic_data || {});
    } catch (e) {
      demographicData = {};
    }

    // Return participant data
    res.json({
      participant: {
        id: participantEvaluation.id,
        firstName: demographicData.firstName || 'N/A',
        lastName: demographicData.lastName || 'N/A',
        documentType: demographicData.documentType || 'N/A',
        documentNumber: demographicData.documentNumber || 'N/A',
        formType: demographicData.formType || 'A'
      },
      evaluation: {
        id: participantEvaluation.evaluation_id,
        name: participantEvaluation.evaluation_name,
        description: participantEvaluation.evaluation_description
      },
      // Co-marca: el logo de la empresa se muestra junto al de la plataforma en
      // la pantalla del participante. `logoUrl` en null = solo la plataforma.
      company: {
        name: participantEvaluation.company_name,
        logoUrl: participantEvaluation.company_logo_url || null
      },
      status: participantEvaluation.status,
      assignedAt: participantEvaluation.assigned_at,
      completedAt: participantEvaluation.completed_at
    });

  } catch (error) {
    console.error('Validate token error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Get specific questionnaire for participant by token
router.get('/:token/questionnaire/:type', async (req, res) => {
  try {
    const { token, type } = req.params;
    
    // Find participant by token
    const participantEvaluation = await db('participant_evaluations')
      .join('participants', 'participant_evaluations.participant_id', 'participants.id')
      .where('participant_evaluations.access_token', token)
      .where('participant_evaluations.token_expires_at', '>', new Date())
      .select('participants.*')
      .first();

    if (!participantEvaluation) {
      return res.status(404).json({ error: 'Token inválido o expirado' });
    }

    // Load questionnaire data
    const fs = require('fs');
    const path = require('path');
    
    let questionnairesData;
    try {
      const dataPath = path.join(__dirname, '../../bateria_riesgo_psicosocial_preguntas.json');
      const rawData = fs.readFileSync(dataPath, 'utf8');
      questionnairesData = JSON.parse(rawData);
    } catch (error) {
      return res.status(500).json({ error: 'No se pudieron cargar los datos de cuestionarios' });
    }

    let questionnaire = null;

    switch (type) {
      case 'ficha-datos':
        questionnaire = questionnairesData.cuestionarios.ficha_datos_generales;
        break;
      case 'forma-a':
        questionnaire = questionnairesData.cuestionarios.forma_a_intralaboral;
        break;
      case 'forma-b':
        questionnaire = questionnairesData.cuestionarios.forma_b_intralaboral;
        break;
      case 'extralaboral':
        questionnaire = questionnairesData.cuestionarios.extralaboral;
        break;
      case 'estres':
        questionnaire = questionnairesData.cuestionarios.estres;
        break;
      case 'coping':
        questionnaire = questionnairesData.cuestionarios.coping;
        break;
      default:
        return res.status(404).json({ error: 'Tipo de cuestionario no encontrado' });
    }

    if (!questionnaire) {
      return res.status(404).json({ error: 'Cuestionario no encontrado' });
    }

    // For demographic questionnaire, include existing participant data
    let existingData = {};
    if (type === 'ficha-datos') {
      try {
        const demographicData = typeof participantEvaluation.demographic_data === 'string'
          ? JSON.parse(participantEvaluation.demographic_data)
          : (participantEvaluation.demographic_data || {});
        existingData = demographicData;
      } catch (e) {
        existingData = {};
      }
    }

    res.json({
      type,
      questionnaire: {
        nombre: questionnaire.nombre,
        descripcion: questionnaire.descripcion,
        total_preguntas: questionnaire.total_preguntas,
        instrucciones: questionnaire.instrucciones,
        opciones_respuesta: questionnaire.opciones_respuesta,
        preguntas: questionnaire.preguntas || (questionnaire.secciones ? 
          Object.values(questionnaire.secciones).flatMap(s => s.preguntas || []) : []),
        secciones: questionnaire.secciones,
        campos: questionnaire.campos, // For demographic form
        malestares: questionnaire.malestares // For stress questionnaire
      },
      opciones_respuesta: questionnairesData.opciones_respuesta,
      existingData: existingData // Pre-fill data for demographic form
    });

  } catch (error) {
    console.error('Get questionnaire by token error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Get questionnaires for participant by token
router.get('/:token/questionnaires', async (req, res) => {
  try {
    const { token } = req.params;

    // Find participant by token
    const participantEvaluation = await db('participant_evaluations')
      .join('participants', 'participant_evaluations.participant_id', 'participants.id')
      .where('participant_evaluations.access_token', token)
      .where('participant_evaluations.token_expires_at', '>', new Date())
      .select(
        'participants.*',
        'participant_evaluations.id as participant_evaluation_id',
        'participant_evaluations.integration_metadata'
      )
      .first();

    if (!participantEvaluation) {
      return res.status(404).json({ error: 'Token inválido o expirado' });
    }

    // Si el participante fue creado por integración externa (ej. BSL-PLATAFORMA2),
    // exponer la returnUrl para que el frontend pueda redirigirlo de vuelta al
    // terminar todos los cuestionarios.
    let integrationReturnUrl = null;
    if (participantEvaluation.integration_metadata) {
      try {
        const meta = typeof participantEvaluation.integration_metadata === 'string'
          ? JSON.parse(participantEvaluation.integration_metadata)
          : participantEvaluation.integration_metadata;
        integrationReturnUrl = meta && meta.returnUrl ? String(meta.returnUrl) : null;
      } catch (e) {
        integrationReturnUrl = null;
      }
    }

    // Get completed questionnaires
    const completedResponses = await db('responses')
      .where('participant_evaluation_id', participantEvaluation.participant_evaluation_id)
      .whereNotNull('completed_at')
      .select('questionnaire_type');

    const completedTypes = completedResponses.map(r => r.questionnaire_type);

    // Parse demographic data to get form type
    let demographicData = {};
    try {
      demographicData = typeof participantEvaluation.demographic_data === 'string'
        ? JSON.parse(participantEvaluation.demographic_data)
        : (participantEvaluation.demographic_data || {});
    } catch (e) {
      demographicData = {};
    }

    const formType = demographicData.formType || 'A';

    // Load questionnaire data
    const fs = require('fs');
    const path = require('path');
    
    let questionnairesData;
    try {
      const dataPath = path.join(__dirname, '../../bateria_riesgo_psicosocial_preguntas.json');
      const rawData = fs.readFileSync(dataPath, 'utf8');
      questionnairesData = JSON.parse(rawData);
    } catch (error) {
      return res.status(500).json({ error: 'No se pudieron cargar los datos de cuestionarios' });
    }

    // Map frontend IDs to database questionnaire_type
    const idToType = {
      'ficha-datos': 'ficha_datos',
      'forma-a': 'intralaboral_a',
      'forma-b': 'intralaboral_b',
      'extralaboral': 'extralaboral',
      'estres': 'estres',
      'coping': 'coping',
    };

    // All participants must start with demographic questionnaire
    const available = [];

    available.push({
      id: 'ficha-datos',
      name: questionnairesData.cuestionarios.ficha_datos_generales?.nombre || 'Ficha de Datos Generales',
      description: 'Información demográfica y laboral',
      totalQuestions: questionnairesData.cuestionarios.ficha_datos_generales?.campos?.length || 18,
      completed: completedTypes.includes(idToType['ficha-datos']),
    });

    // Determine available questionnaires based on form type
    if (formType === 'A') {
      available.push({
        id: 'forma-a',
        name: questionnairesData.cuestionarios.forma_a_intralaboral.nombre,
        description: 'Para jefes, profesionales y técnicos',
        totalQuestions: questionnairesData.cuestionarios.forma_a_intralaboral.total_preguntas,
        completed: completedTypes.includes(idToType['forma-a']),
      });
    } else {
      available.push({
        id: 'forma-b',
        name: questionnairesData.cuestionarios.forma_b_intralaboral?.nombre || 'Cuestionario Forma B',
        description: 'Para auxiliares y operarios',
        totalQuestions: questionnairesData.cuestionarios.forma_b_intralaboral?.total_preguntas || 97,
        completed: completedTypes.includes(idToType['forma-b']),
      });
    }

    // All participants get extralaboral and stress questionnaires
    available.push({
      id: 'extralaboral',
      name: questionnairesData.cuestionarios.extralaboral?.nombre || 'Cuestionario Extralaboral',
      description: 'Factores externos al trabajo',
      totalQuestions: questionnairesData.cuestionarios.extralaboral?.total_preguntas || 31,
      completed: completedTypes.includes(idToType['extralaboral']),
    });

    available.push({
      id: 'estres',
      name: questionnairesData.cuestionarios.estres?.nombre || 'Cuestionario de Estrés',
      description: 'Síntomas de estrés ocupacional',
      totalQuestions: questionnairesData.cuestionarios.estres?.total_preguntas || 31,
      completed: completedTypes.includes(idToType['estres']),
    });

    available.push({
      id: 'coping',
      name: questionnairesData.cuestionarios.coping?.nombre || 'Brief COPE - Estrategias de Afrontamiento',
      description: 'Estrategias de afrontamiento al estrés',
      totalQuestions: questionnairesData.cuestionarios.coping?.total_preguntas || 28,
      completed: completedTypes.includes(idToType['coping']),
    });

    res.json({
      participant: {
        id: participantEvaluation.id,
        firstName: demographicData.firstName || 'N/A',
        lastName: demographicData.lastName || 'N/A',
        formType: formType
      },
      questionnaires: available,
      opciones_respuesta: questionnairesData.opciones_respuesta,
      // Si el participante viene de una integración externa, devolver la
      // URL a la que redirigir cuando todos los cuestionarios estén completos.
      integration: integrationReturnUrl ? { returnUrl: integrationReturnUrl } : null
    });

  } catch (error) {
    console.error('Get questionnaires by token error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Save responses by token
const VALID_QUESTIONNAIRE_TYPES = ['ficha_datos', 'intralaboral_a', 'intralaboral_b', 'extralaboral', 'estres', 'coping'];

router.post('/:token/responses', async (req, res) => {
  try {
    const { token } = req.params;
    const { questionnaireType, responses } = req.body;

    // Validación de entrada: sin esto, un body con un questionnaireType arbitrario
    // y claves basura podía persistirse y (según su forma) empujar el estado hacia
    // "completado", disparando cálculo y webhook con datos inválidos.
    if (!VALID_QUESTIONNAIRE_TYPES.includes(questionnaireType)) {
      return res.status(400).json({ error: 'questionnaireType inválido' });
    }
    if (responses == null || typeof responses !== 'object') {
      return res.status(400).json({ error: 'responses debe ser un objeto o arreglo' });
    }

    // Find participant by token
    const participantEvaluation = await db('participant_evaluations')
      .join('participants', 'participant_evaluations.participant_id', 'participants.id')
      .where('participant_evaluations.access_token', token)
      .where('participant_evaluations.token_expires_at', '>', new Date())
      .select(
        'participants.*',
        'participant_evaluations.id as pe_id',
        'participant_evaluations.status as pe_status',
        'participant_evaluations.integration_metadata as pe_integration_metadata'
      )
      .first();

    if (!participantEvaluation) {
      return res.status(404).json({ error: 'Token inválido o expirado' });
    }

    // Una batería ya completada no admite SOBRESCRIBIR lo ya respondido: el
    // access_token sigue siendo válido (TTL 90 días) pero no debe permitir
    // rehacer un cuestionario terminado ni forzar recálculos.
    //
    // El bloqueo es por cuestionario, no por batería. El Brief COPE es opcional
    // y NO cuenta para marcar la batería como completada, pero el hub lo sigue
    // ofreciendo después: bloquear por estado del PE hacía que quien lo dejaba
    // de último perdiera sus 28 respuestas con un 409 que el frontend mostraba
    // como "revisa tu conexión". Un cuestionario que nunca se terminó todavía
    // se puede terminar.
    if (participantEvaluation.pe_status === 'completed') {
      const yaTerminado = await db('responses')
        .where('participant_evaluation_id', participantEvaluation.pe_id)
        .where('questionnaire_type', questionnaireType)
        .whereNotNull('completed_at')
        .first();
      if (yaTerminado) {
        return res.status(409).json({ error: 'Este cuestionario ya fue completado; no se admiten más respuestas.' });
      }
    }

    // Guard de consentimiento informado. Va antes que el facial: sin
    // autorización no se debe tratar ningún dato, ni el de las respuestas ni
    // el biométrico.
    if (!(await hasConsent(participantEvaluation.pe_id))) {
      return res.status(403).json({
        error: 'Debes aceptar el consentimiento informado antes de responder.',
        code: 'CONSENT_REQUIRED'
      });
    }

    // Guard de verificación facial. El bloqueo se aplica AQUÍ, no solo en la UI:
    // el endpoint es público y sin este chequeo bastaría un POST directo para
    // saltarse la pantalla de la selfie.
    if (isFaceVerificationEnabled()) {
      if (!isRekognitionAvailable()) {
        return res.status(503).json({
          error: 'La verificación de identidad no está disponible en este momento. Contacta a tu evaluador.',
          code: 'FACE_UNAVAILABLE'
        });
      }
      if (!(await hasVerifiedFaceFor(participantEvaluation.pe_id, questionnaireType))) {
        return res.status(403).json({
          error: 'Debes verificar tu identidad antes de responder este cuestionario.',
          code: 'FACE_VERIFICATION_REQUIRED'
        });
      }
    }

    let isCompleted = false;

    const thisQuestionnaireDone = isQuestionnaireComplete(questionnaireType, responses);

    await db.transaction(async (trx) => {
      // Check if response already exists for this questionnaire type
      const existingResponse = await trx('responses')
        .where('participant_evaluation_id', participantEvaluation.pe_id)
        .where('questionnaire_type', questionnaireType)
        .first();

      // Only mark completed_at when the questionnaire is actually finished.
      // Partial autosaves keep completed_at = null so the participant can resume.
      // If a previous save already marked it complete, preserve that timestamp.
      const completedAt = thisQuestionnaireDone
        ? (existingResponse?.completed_at || new Date())
        : null;

      const responseData = {
        participant_evaluation_id: participantEvaluation.pe_id,
        questionnaire_type: questionnaireType,
        responses: JSON.stringify(responses),
        completed_at: completedAt
      };

      if (existingResponse) {
        await trx('responses')
          .where('id', existingResponse.id)
          .update(responseData);
      } else {
        await trx('responses').insert(responseData);
      }

      // Parse demographic data to get form type
      let demographicData = {};
      try {
        demographicData = typeof participantEvaluation.demographic_data === 'string'
          ? JSON.parse(participantEvaluation.demographic_data)
          : (participantEvaluation.demographic_data || {});
      } catch (e) {
        demographicData = {};
      }

      const formType = demographicData.formType || 'A';

      const allResponses = await trx('responses')
        .where('participant_evaluation_id', participantEvaluation.pe_id)
        .select('questionnaire_type', 'completed_at');

      const startedTypes = allResponses.map(q => q.questionnaire_type);
      const finishedTypes = allResponses
        .filter(q => q.completed_at)
        .map(q => q.questionnaire_type);

      // A required questionnaire counts as done only when its responses fill the
      // expected total (completed_at is set). Partial saves don't count.
      const baseRequired = formType === 'A'
        ? ['intralaboral_a', 'extralaboral', 'estres']
        : ['intralaboral_b', 'extralaboral', 'estres'];

      // Para pacientes provisionados por integración externa (ej. BSL-PLATAFORMA2 /
      // Platzi) los 5 cuestionarios son obligatorios — la empresa contratante
      // exige la batería completa, no solo el set mínimo del Ministerio.
      let integrationMeta = participantEvaluation.pe_integration_metadata;
      if (typeof integrationMeta === 'string') {
        try { integrationMeta = JSON.parse(integrationMeta); } catch (e) { integrationMeta = null; }
      }
      const esIntegracion = !!(integrationMeta && integrationMeta.source);
      const requiredQuestionnaires = esIntegracion
        ? ['ficha_datos', ...baseRequired, 'coping']
        : baseRequired;

      isCompleted = requiredQuestionnaires.every(type => finishedTypes.includes(type));

      // Update participant evaluation status
      const updateData = {};

      if (participantEvaluation.pe_status !== 'completed') {
        if (startedTypes.length > 0) updateData.status = 'in_progress';
        if (isCompleted) {
          updateData.status = 'completed';
          updateData.completed_at = new Date();
        }
      }

      if (Object.keys(updateData).length > 0) {
        updateData.updated_at = new Date();
        await trx('participant_evaluations')
          .where('id', participantEvaluation.pe_id)
          .update(updateData);
      }
    });

    if (isCompleted) {
      // Recalcular sí conviene siempre: un Brief COPE respondido después de
      // terminada la batería agrega sus resultados a los ya calculados.
      autoCalculateResults(participantEvaluation.pe_id);
      // El webhook solo en la TRANSICIÓN a completada. Sin esta condición, un
      // cuestionario opcional guardado después de terminar la batería volvería
      // a notificar al sistema externo un evento que ya emitimos.
      if (participantEvaluation.pe_status !== 'completed') {
        notifyEvaluationCompleted(participantEvaluation.pe_id);
      }
    }

    res.json({
      message: 'Respuestas guardadas exitosamente',
      saved: responses.length
    });

  } catch (error) {
    console.error('Save responses by token error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Get responses by token
router.get('/:token/responses', async (req, res) => {
  try {
    const { token } = req.params;
    const { questionnaireType } = req.query;

    // Find participant by token
    const participantEvaluation = await db('participant_evaluations')
      .join('participants', 'participant_evaluations.participant_id', 'participants.id')
      .where('participant_evaluations.access_token', token)
      .where('participant_evaluations.token_expires_at', '>', new Date())
      .select('participants.*', 'participant_evaluations.id as pe_id')
      .first();

    if (!participantEvaluation) {
      return res.status(404).json({ error: 'Token inválido o expirado' });
    }

    let query = db('responses').where('participant_evaluation_id', participantEvaluation.pe_id);

    if (questionnaireType) {
      query = query.where('questionnaire_type', questionnaireType);
    }

    const responses = await query
      .orderBy('questionnaire_type')
      .select('*');

    // Parse JSON responses and group by questionnaire type
    const groupedResponses = responses.reduce((acc, response) => {
      try {
        const parsedResponses = JSON.parse(response.responses);
        acc[response.questionnaire_type] = parsedResponses.map(r => ({
          questionNumber: r.questionNumber,
          responseValue: r.responseValue,
          dimension: r.dimension,
          domain: r.domain
        }));
      } catch (e) {
        console.error('Error parsing responses:', e);
        acc[response.questionnaire_type] = [];
      }
      return acc;
    }, {});

    res.json({
      participantId: participantEvaluation.id,
      responses: groupedResponses,
      totalResponses: responses.length
    });

  } catch (error) {
    console.error('Get responses by token error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;