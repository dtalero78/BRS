const express = require('express');
const router = express.Router();
const db = require('../config/database');
const calculateResults = require('../utils/calculate-results');
const { calculateCopingResults } = require('../utils/calculate-coping');
const { isQuestionnaireComplete } = require('../utils/questionnaire-totals');
const { notifyEvaluationCompleted } = require('../services/webhook-emitter');

async function autoCalculateResults(peId) {
  try {
    const responses = await db('responses').where('participant_evaluation_id', peId).select('*');
    const toProcess = responses.filter(r => r.questionnaire_type !== 'ficha_datos');
    if (toProcess.length === 0) return;

    const hasBForm = toProcess.some(r => r.questionnaire_type === 'intralaboral_b');
    const occupationalGroup = hasBForm ? 'auxiliares' : 'jefes';
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
router.post('/:token/responses', async (req, res) => {
  try {
    const { token } = req.params;
    const { questionnaireType, responses } = req.body;

    // Find participant by token
    const participantEvaluation = await db('participant_evaluations')
      .join('participants', 'participant_evaluations.participant_id', 'participants.id')
      .where('participant_evaluations.access_token', token)
      .where('participant_evaluations.token_expires_at', '>', new Date())
      .select('participants.*', 'participant_evaluations.id as pe_id', 'participant_evaluations.status as pe_status')
      .first();

    if (!participantEvaluation) {
      return res.status(404).json({ error: 'Token inválido o expirado' });
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
      const requiredQuestionnaires = formType === 'A'
        ? ['intralaboral_a', 'extralaboral', 'estres']
        : ['intralaboral_b', 'extralaboral', 'estres'];

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