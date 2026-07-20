const express = require('express');
const router = express.Router();
const { auth, getOwnedCompanyIds } = require('../middleware/auth');
const db = require('../config/database');
const calculateResults = require('../utils/calculate-results');
const { calculateCopingResults } = require('../utils/calculate-coping');

// Calculate and save results for a participant
router.post('/calculate/:participantId', auth, async (req, res) => {
  try {
    const { participantId } = req.params;

    // Check if participant exists and belongs to company
    const participant = await db('participants')
      .leftJoin('participant_evaluations as pe', 'participants.id', 'pe.participant_id')
      .leftJoin('evaluations', 'pe.evaluation_id', 'evaluations.id')
      .where('participants.id', participantId)
      .whereIn('participants.company_id', await getOwnedCompanyIds(req.user.userId))
      .select('participants.*', 'pe.id as pe_id')
      .first();

    if (!participant) {
      return res.status(404).json({ error: 'Participante no encontrado' });
    }

    // Get all responses for the participant
    const responses = await db('responses')
      .where('participant_evaluation_id', participant.pe_id)
      .select('*');

    if (responses.length === 0) {
      return res.status(400).json({ error: 'No hay respuestas para calcular' });
    }

    // Group responses by questionnaire type (exclude ficha_datos - demographic data only)
    const responsesByType = responses
      .filter(response => response.questionnaire_type !== 'ficha_datos')
      .reduce((acc, response) => {
        acc[response.questionnaire_type] = response;
        return acc;
      }, {});

    // Check if we have BRS questionnaires to process (after excluding ficha_datos)
    if (Object.keys(responsesByType).length === 0) {
      return res.status(400).json({ error: 'No hay cuestionarios BRS completados para calcular' });
    }

    // Grupo ocupacional según el formType del participante (A=jefes/profesionales,
    // B=auxiliares/operarios); fallback a la presencia de intralaboral_b.
    let demoData = participant.demographic_data;
    if (typeof demoData === 'string') { try { demoData = JSON.parse(demoData); } catch (e) { demoData = {}; } }
    const formType = (demoData && demoData.formType) || null;
    const occupationalGroup = (formType === 'B' || (formType == null && responsesByType['intralaboral_b'])) ? 'auxiliares' : 'jefes';

    // Calculate results for each questionnaire type
    const results = [];

    for (const [questionnaireType, responseRecord] of Object.entries(responsesByType)) {
      try {

        // Parse the JSON responses and convert to the format expected by calculate-results.js
        let responseData;
        try {
          responseData = typeof responseRecord.responses === 'string'
            ? JSON.parse(responseRecord.responses)
            : responseRecord.responses;
        } catch (e) {
          console.error(`Error parsing responses JSON for ${questionnaireType}:`, e);
          continue;
        }

        // Handle different response data formats
        let formattedResponses;

        if (Array.isArray(responseData)) {
          // Format: [{questionNumber: 1, responseValue: 1, ...}, ...]
          formattedResponses = responseData.map(item => ({
            question_number: parseInt(item.questionNumber || item.question_number),
            response_value: parseInt(item.responseValue || item.response_value) || 0
          }));
        } else if (typeof responseData === 'object') {
          // Format: {1: 0, 2: 1, ...} or {"1": "0", "2": "1", ...}
          formattedResponses = Object.entries(responseData).map(([questionNumber, responseValue]) => ({
            question_number: parseInt(questionNumber),
            response_value: parseInt(responseValue) || 0
          }));
        } else {
          console.error(`DEBUG - Unexpected responseData format for ${questionnaireType}:`, typeof responseData);
          formattedResponses = [];
        }


        // Use coping-specific engine or BRS engine
        let calculatedResults;
        if (questionnaireType === 'coping') {
          calculatedResults = calculateCopingResults(formattedResponses);
        } else {
          // Pass occupational group for extralaboral and stress baremos selection
          calculatedResults = await calculateResults(questionnaireType, formattedResponses, { occupationalGroup });
        }

        results.push(...calculatedResults);
      } catch (error) {
        console.error(`Error calculating results for ${questionnaireType}:`, error);
        return res.status(400).json({
          error: `Error calculando resultados para ${questionnaireType}: ${error.message}`
        });
      }
    }


    // Save results to database
    await db.transaction(async (trx) => {
      // Delete existing results
      await trx('results').where('participant_evaluation_id', participant.pe_id).del();

      // Group results by questionnaire type and store as JSON
      const resultsByType = {};
      results.forEach(result => {
        if (!resultsByType[result.questionnaireType]) {
          resultsByType[result.questionnaireType] = [];
        }
        resultsByType[result.questionnaireType].push({
          dimension: result.dimension,
          rawScore: result.rawScore,
          transformedScore: result.transformedScore,
          percentile: result.percentile,
          riskLevel: result.riskLevel
        });
      });

      // Insert grouped results
      const resultData = Object.entries(resultsByType).map(([questionnaireType, typeResults]) => ({
        participant_evaluation_id: participant.pe_id,
        questionnaire_type: questionnaireType,
        results: JSON.stringify(typeResults),
        calculated_at: new Date()
      }));


      if (resultData.length > 0) {
        await trx('results').insert(resultData);
      } else {
      }
    });

    // Log calculation
    await db('audit_logs').insert({
      user_id: req.user.userId,
      action: 'calculate_results',
      table_name: 'participants',
      record_id: participantId,
      new_values: JSON.stringify({
        calculatedDimensions: results.length
      })
    });

    res.json({
      message: 'Resultados calculados exitosamente',
      results: results.map(result => ({
        dimension: result.dimension,
        questionnaireType: result.questionnaireType,
        rawScore: result.rawScore,
        transformedScore: result.transformedScore,
        percentile: result.percentile,
        riskLevel: result.riskLevel
      }))
    });

  } catch (error) {
    console.error('Calculate results error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Get results for a participant
router.get('/participant/:participantId', auth, async (req, res) => {
  try {
    const { participantId } = req.params;

    // Check if participant exists and belongs to company
    const participant = await db('participants')
      .leftJoin('participant_evaluations as pe', 'participants.id', 'pe.participant_id')
      .leftJoin('evaluations', 'pe.evaluation_id', 'evaluations.id')
      .where('participants.id', participantId)
      .whereIn('participants.company_id', await getOwnedCompanyIds(req.user.userId))
      .select('participants.*', 'evaluations.name as evaluation_name', 'pe.id as pe_id')
      .first();

    if (!participant) {
      return res.status(404).json({ error: 'Participante no encontrado' });
    }

    // Get calculated results using participant_evaluation_id
    const results = await db('results')
      .where('participant_evaluation_id', participant.pe_id)
      .orderBy('questionnaire_type')
      .select('*');

    // Process results from JSON format
    const groupedResults = {};
    
    results.forEach(result => {
      try {
        const parsedResults = typeof result.results === 'string' 
          ? JSON.parse(result.results) 
          : (result.results || []);
        
        if (!groupedResults[result.questionnaire_type]) {
          groupedResults[result.questionnaire_type] = [];
        }
        
        // Add each dimension result
        parsedResults.forEach(dimensionResult => {
          groupedResults[result.questionnaire_type].push({
            dimension: dimensionResult.dimension,
            rawScore: dimensionResult.rawScore,
            transformedScore: dimensionResult.transformedScore,
            percentile: dimensionResult.percentile,
            riskLevel: dimensionResult.riskLevel,
            calculatedAt: result.calculated_at
          });
        });
      } catch (e) {
        console.error('Error parsing results JSON:', e);
      }
    });

    // Parse demographic data
    let demographicData = {};
    try {
      demographicData = typeof participant.demographic_data === 'string'
        ? JSON.parse(participant.demographic_data)
        : (participant.demographic_data || {});
    } catch (e) {
      demographicData = {};
    }

    res.json({
      participantId,
      participant: {
        firstName: demographicData.firstName || 'N/A',
        lastName: demographicData.lastName || 'N/A',
        formType: demographicData.formType || 'A',
        evaluationName: participant.evaluation_name
      },
      results: groupedResults,
      calculatedAt: results.length > 0 ? results[0].calculated_at : null
    });

  } catch (error) {
    console.error('Get participant results error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Get aggregated results for an evaluation
router.get('/evaluation/:evaluationId', auth, async (req, res) => {
  try {
    const { evaluationId } = req.params;

    // Check if evaluation belongs to evaluator's companies
    const companyIds = await getOwnedCompanyIds(req.user.userId);
    const evaluation = await db('evaluations')
      .where('id', evaluationId)
      .whereIn('company_id', companyIds)
      .first();

    if (!evaluation) {
      return res.status(404).json({ error: 'Evaluación no encontrada' });
    }

    // Get all results for participants in this evaluation
    const results = await db('results')
      .join('participant_evaluations as pe', 'results.participant_evaluation_id', 'pe.id')
      .join('participants', 'pe.participant_id', 'participants.id')
      .where('pe.evaluation_id', evaluationId)
      .select('results.*', 'participants.id as participant_id');

    // Calculate statistics by dimension and risk level
    const statistics = {};

    results.forEach(result => {
      try {
        const parsedResults = typeof result.results === 'string' 
          ? JSON.parse(result.results) 
          : (result.results || []);

        parsedResults.forEach(dimensionResult => {
          const key = `${result.questionnaire_type}_${dimensionResult.dimension}`;
          
          if (!statistics[key]) {
            statistics[key] = {
              dimension: dimensionResult.dimension,
              questionnaireType: result.questionnaire_type,
              riskLevels: {
                'sin_riesgo': 0,
                'riesgo_bajo': 0,
                'riesgo_medio': 0,
                'riesgo_alto': 0,
                'riesgo_muy_alto': 0
              },
              totalParticipants: 0,
              averageScore: 0,
              scores: []
            };
          }

          // no_calculable no es un nivel de riesgo: no se cuenta en la distribucion
          // ni entra al promedio (evita NaN en riskLevels y sesgo en averageScore).
          if (statistics[key].riskLevels[dimensionResult.riskLevel] !== undefined) {
            statistics[key].riskLevels[dimensionResult.riskLevel]++;
          }
          statistics[key].totalParticipants++;
          if (dimensionResult.transformedScore != null) {
            statistics[key].scores.push(dimensionResult.transformedScore);
          }
        });
      } catch (e) {
        console.error('Error parsing results JSON:', e);
      }
    });

    // Calculate averages
    Object.values(statistics).forEach(stat => {
      stat.averageScore = stat.scores.length > 0 
        ? stat.scores.reduce((sum, score) => sum + score, 0) / stat.scores.length
        : 0;
      delete stat.scores; // Remove individual scores from response
    });

    res.json({
      evaluationId,
      evaluation: {
        name: evaluation.name,
        totalParticipants: evaluation.total_participants,
        completedParticipants: evaluation.completed_participants
      },
      statistics: Object.values(statistics),
      totalResults: results.length
    });

  } catch (error) {
    console.error('Get evaluation results error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Delete results for re-calculation (debug purposes)
router.delete('/participant/:participantId', auth, async (req, res) => {
  try {
    const { participantId } = req.params;

    // Check if participant exists and belongs to company
    const participant = await db('participants')
      .leftJoin('participant_evaluations as pe', 'participants.id', 'pe.participant_id')
      .leftJoin('evaluations', 'pe.evaluation_id', 'evaluations.id')
      .where('participants.id', participantId)
      .whereIn('participants.company_id', await getOwnedCompanyIds(req.user.userId))
      .select('participants.*', 'pe.id as pe_id')
      .first();

    if (!participant) {
      return res.status(404).json({ error: 'Participante no encontrado' });
    }

    // Delete results
    const deletedCount = await db('results')
      .where('participant_evaluation_id', participant.pe_id)
      .del();

    res.json({
      message: 'Resultados eliminados exitosamente',
      deletedCount
    });

  } catch (error) {
    console.error('Delete results error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;