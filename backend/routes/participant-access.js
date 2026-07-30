const express = require('express');
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
  FACE_SESSION_MINUTES,
} = require('../utils/rekognition');

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

async function logFaceVerification({ peId, mode, verified, score, issues, capturedPhoto, ip }) {
  try {
    await db('face_verifications').insert({
      participant_evaluation_id: peId,
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
 * ¿Este PE tiene una verificación exitosa vigente?
 *
 * El participante se verifica una vez por sesión y responde varios
 * cuestionarios seguidos; se le vuelve a pedir selfie pasada la ventana
 * (FACE_SESSION_MINUTES). Esto es lo que hace cumplible el bloqueo en el
 * backend sin inventar un segundo token de sesión.
 */
async function hasValidFaceVerification(peId) {
  const since = new Date(Date.now() - FACE_SESSION_MINUTES * 60 * 1000);
  const row = await db('face_verifications')
    .where('participant_evaluation_id', peId)
    .where('verified', true)
    .where('created_at', '>', since)
    .orderBy('created_at', 'desc')
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

    // Una batería ya completada no vuelve a pedir selfie: no hay nada que escribir.
    if (pe.status === 'completed') return res.json({ required: false });

    if (!isRekognitionAvailable()) {
      return res.json({ required: true, available: false, enrolled: false, verified: false });
    }

    res.json({
      required: true,
      available: true,
      enrolled: !!pe.face_reference_photo,
      verified: await hasValidFaceVerification(pe.id),
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
  max: 12, // suficiente para reintentos legítimos por luz/encuadre
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

    const { photo } = req.body || {};
    if (typeof photo !== 'string' || photo.length < 100) {
      return res.status(400).json({ error: 'Foto inválida' });
    }

    const pe = await findPeByToken(req.params.token);
    if (!pe) return res.status(404).json({ error: 'Token inválido o expirado' });

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
          peId: pe.id, mode: 'enroll', verified: false,
          score: validation.confidence, issues: validation.issues, capturedPhoto: photo, ip,
        });
        return res.json({ mode: 'enroll', verified: false, issues: validation.issues });
      }

      await db('participant_evaluations')
        .where('id', pe.id)
        .update({ face_reference_photo: photo, face_reference_at: new Date() });
      await logFaceVerification({
        peId: pe.id, mode: 'enroll', verified: true,
        score: validation.confidence, capturedPhoto: photo, ip,
      });
      return res.json({ mode: 'enroll', verified: true, score: validation.confidence });
    }

    // ---- VERIFICAR (ingresos siguientes) ----
    const cmp = await compareFaces(pe.face_reference_photo, photo, FACE_MATCH_THRESHOLD);
    const score = Math.round(cmp.similarityScore * 100) / 100;
    await logFaceVerification({
      peId: pe.id, mode: 'verify', verified: cmp.isMatch, score,
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
      .where('participant_evaluations.access_token', token)
      .where('participant_evaluations.token_expires_at', '>', new Date())
      .select(
        'participants.*',
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

    // Una batería ya completada no admite más escrituras vía token: el access_token
    // sigue siendo válido (TTL 90 días) pero no debe permitir sobrescribir respuestas
    // ni forzar recálculos después de terminada.
    if (participantEvaluation.pe_status === 'completed') {
      return res.status(409).json({ error: 'La batería ya fue completada; no se admiten más respuestas.' });
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
      if (!(await hasValidFaceVerification(participantEvaluation.pe_id))) {
        return res.status(403).json({
          error: 'Debes verificar tu identidad antes de responder.',
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
      autoCalculateResults(participantEvaluation.pe_id);
      // Notificar al sistema externo (ej. BSL-PLATAFORMA2) sin bloquear la
      // respuesta. El emitter es no-op si el PE no tiene callbackUrl.
      notifyEvaluationCompleted(participantEvaluation.pe_id);
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