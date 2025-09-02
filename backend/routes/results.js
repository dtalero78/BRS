const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const db = require('../config/database');
const calculateResults = require('../utils/calculate-results');

// Calculate and save results for a participant
router.post('/calculate/:participantId', auth, async (req, res) => {
  try {
    const { participantId } = req.params;

    // Check if participant exists and belongs to company
    const participant = await db('participants')
      .join('evaluations', 'participants.evaluation_id', 'evaluations.id')
      .where('participants.id', participantId)
      .where('evaluations.company_id', req.user.companyId)
      .select('participants.*')
      .first();

    if (!participant) {
      return res.status(404).json({ error: 'Participante no encontrado' });
    }

    // Get all responses for the participant
    const responses = await db('responses')
      .where('participant_id', participantId)
      .select('*');

    if (responses.length === 0) {
      return res.status(400).json({ error: 'No hay respuestas para calcular' });
    }

    // Group responses by questionnaire type
    const responsesByType = responses.reduce((acc, response) => {
      if (!acc[response.questionnaire_type]) {
        acc[response.questionnaire_type] = [];
      }
      acc[response.questionnaire_type].push(response);
      return acc;
    }, {});

    // Calculate results for each questionnaire type
    const results = [];

    for (const [questionnaireType, questionnaireResponses] of Object.entries(responsesByType)) {
      try {
        const calculatedResults = await calculateResults(questionnaireType, questionnaireResponses);
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
      await trx('results').where('participant_id', participantId).del();

      // Insert new results
      const resultData = results.map(result => ({
        participant_id: participantId,
        questionnaire_type: result.questionnaireType,
        dimension: result.dimension,
        raw_score: result.rawScore,
        transformed_score: result.transformedScore,
        percentile: result.percentile,
        risk_level: result.riskLevel
      }));

      await trx('results').insert(resultData);
    });

    // Log calculation
    await db('audit_logs').insert({
      user_id: req.user.userId,
      action: 'calculate_results',
      entity_type: 'participant',
      entity_id: participantId,
      details: {
        calculatedDimensions: results.length
      }
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
      .join('evaluations', 'participants.evaluation_id', 'evaluations.id')
      .where('participants.id', participantId)
      .where('evaluations.company_id', req.user.companyId)
      .select('participants.*', 'evaluations.name as evaluation_name')
      .first();

    if (!participant) {
      return res.status(404).json({ error: 'Participante no encontrado' });
    }

    // Get calculated results
    const results = await db('results')
      .where('participant_id', participantId)
      .orderBy('questionnaire_type')
      .orderBy('dimension')
      .select('*');

    // Group results by questionnaire type
    const groupedResults = results.reduce((acc, result) => {
      if (!acc[result.questionnaire_type]) {
        acc[result.questionnaire_type] = [];
      }
      acc[result.questionnaire_type].push({
        dimension: result.dimension,
        rawScore: result.raw_score,
        transformedScore: result.transformed_score,
        percentile: result.percentile,
        riskLevel: result.risk_level,
        calculatedAt: result.calculated_at
      });
      return acc;
    }, {});

    res.json({
      participantId,
      participant: {
        firstName: participant.first_name,
        lastName: participant.last_name,
        formType: participant.form_type,
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

    // Check if evaluation belongs to company
    const evaluation = await db('evaluations')
      .where('id', evaluationId)
      .where('company_id', req.user.companyId)
      .first();

    if (!evaluation) {
      return res.status(404).json({ error: 'Evaluación no encontrada' });
    }

    // Get all results for participants in this evaluation
    const results = await db('results')
      .join('participants', 'results.participant_id', 'participants.id')
      .where('participants.evaluation_id', evaluationId)
      .select(
        'results.*',
        'participants.first_name',
        'participants.last_name',
        'participants.department',
        'participants.position'
      );

    // Calculate statistics by dimension and risk level
    const statistics = {};

    results.forEach(result => {
      const key = `${result.questionnaire_type}_${result.dimension}`;
      
      if (!statistics[key]) {
        statistics[key] = {
          dimension: result.dimension,
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

      statistics[key].riskLevels[result.risk_level]++;
      statistics[key].totalParticipants++;
      statistics[key].scores.push(result.transformed_score);
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

module.exports = router;