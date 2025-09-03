const express = require('express');
const router = express.Router();
const db = require('../config/database');

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
        secciones: questionnaire.secciones || questionnaire.preguntas,
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
      .select('participants.*')
      .first();

    if (!participantEvaluation) {
      return res.status(404).json({ error: 'Token inválido o expirado' });
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

    // All participants must start with demographic questionnaire  
    const available = [];
    
    available.push({
      id: 'ficha-datos',
      name: questionnairesData.cuestionarios.ficha_datos_generales?.nombre || 'Ficha de Datos Generales',
      description: 'Información demográfica y laboral',
      totalQuestions: questionnairesData.cuestionarios.ficha_datos_generales?.campos?.length || 18
    });

    // Determine available questionnaires based on form type
    if (formType === 'A') {
      available.push({
        id: 'forma-a',
        name: questionnairesData.cuestionarios.forma_a_intralaboral.nombre,
        description: 'Para jefes, profesionales y técnicos',
        totalQuestions: questionnairesData.cuestionarios.forma_a_intralaboral.total_preguntas
      });
    } else {
      available.push({
        id: 'forma-b',
        name: questionnairesData.cuestionarios.forma_b_intralaboral?.nombre || 'Cuestionario Forma B',
        description: 'Para auxiliares y operarios',
        totalQuestions: questionnairesData.cuestionarios.forma_b_intralaboral?.total_preguntas || 97
      });
    }

    // All participants get extralaboral and stress questionnaires
    available.push({
      id: 'extralaboral',
      name: questionnairesData.cuestionarios.extralaboral?.nombre || 'Cuestionario Extralaboral',
      description: 'Factores externos al trabajo',
      totalQuestions: questionnairesData.cuestionarios.extralaboral?.total_preguntas || 31
    });

    available.push({
      id: 'estres',
      name: questionnairesData.cuestionarios.estres?.nombre || 'Cuestionario de Estrés',
      description: 'Síntomas de estrés ocupacional',
      totalQuestions: questionnairesData.cuestionarios.estres?.total_preguntas || 31
    });

    res.json({
      participant: {
        id: participantEvaluation.id,
        firstName: demographicData.firstName || 'N/A',
        lastName: demographicData.lastName || 'N/A',
        formType: formType
      },
      questionnaires: available,
      opciones_respuesta: questionnairesData.opciones_respuesta
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
      .select('participants.*', 'participant_evaluations.id as pe_id')
      .first();

    if (!participantEvaluation) {
      return res.status(404).json({ error: 'Token inválido o expirado' });
    }

    await db.transaction(async (trx) => {
      // Check if response already exists for this questionnaire type
      const existingResponse = await trx('responses')
        .where('participant_evaluation_id', participantEvaluation.pe_id)
        .where('questionnaire_type', questionnaireType)
        .first();

      const responseData = {
        participant_evaluation_id: participantEvaluation.pe_id,
        questionnaire_type: questionnaireType,
        responses: JSON.stringify(responses),
        completed_at: new Date()
      };

      if (existingResponse) {
        await trx('responses')
          .where('id', existingResponse.id)
          .update(responseData);
      } else {
        await trx('responses').insert(responseData);
      }

      // Update participant progress
      const totalQuestionsByType = {
        'ficha_datos': 18,
        'intralaboral_a': 123,
        'intralaboral_b': 97,
        'extralaboral': 31,
        'estres': 31,
        'stress': 31
      };

      const completedQuestionnaires = await trx('responses')
        .where('participant_evaluation_id', participantEvaluation.pe_id)
        .select('questionnaire_type', 'responses');

      let totalCompleted = 0;
      let totalRequired = 0;

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

      // Determine required questionnaires based on form type
      const requiredQuestionnaires = formType === 'A' 
        ? ['ficha_datos', 'intralaboral_a', 'extralaboral', 'estres']
        : ['ficha_datos', 'intralaboral_b', 'extralaboral', 'estres'];

      requiredQuestionnaires.forEach(type => {
        const completed = completedQuestionnaires.find(q => q.questionnaire_type === type);
        if (completed && completed.responses) {
          try {
            const parsedResponses = JSON.parse(completed.responses);
            totalCompleted += parsedResponses.length;
          } catch (e) {
            // Skip if responses can't be parsed
          }
        }
        totalRequired += totalQuestionsByType[type === 'estres' ? 'stress' : type] || 0;
      });

      const completionPercentage = totalRequired > 0 ? Math.round((totalCompleted / totalRequired) * 100) : 0;
      const isCompleted = completionPercentage === 100;

      // Update participant evaluation status
      const updateData = {};

      if (participantEvaluation.status === 'assigned' && totalCompleted > 0) {
        updateData.status = 'in_progress';
      }

      if (isCompleted) {
        updateData.status = 'completed';
        updateData.completed_at = new Date();
      }

      if (Object.keys(updateData).length > 0) {
        await trx('participant_evaluations')
          .where('id', participantEvaluation.pe_id)
          .update(updateData);
      }
    });

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