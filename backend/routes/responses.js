const express = require('express');
const router = express.Router();
const Joi = require('joi');
const { auth, getOwnedCompanyIds } = require('../middleware/auth');
const db = require('../config/database');

// Validation schema for saving responses
const saveResponsesSchema = Joi.object({
  participantId: Joi.string().uuid().required(),
  questionnaireType: Joi.string().valid('intralaboral_a', 'intralaboral_b', 'extralaboral', 'stress', 'coping').required(),
  responses: Joi.array().items(Joi.object({
    questionNumber: Joi.number().integer().min(1).required(),
    responseValue: Joi.number().integer().min(0).max(4).required(),
    dimension: Joi.string().allow(''),
    domain: Joi.string().allow('')
  })).min(1).required()
});

// Save participant responses
router.post('/', auth, async (req, res) => {
  try {
    const { error } = saveResponsesSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { participantId, questionnaireType, responses } = req.body;

    // Check if participant exists and belongs to company, get participant_evaluation_id
    const participantEvaluation = await db('participants')
      .leftJoin('participant_evaluations as pe', 'participants.id', 'pe.participant_id')
      .leftJoin('evaluations', 'pe.evaluation_id', 'evaluations.id')
      .where('participants.id', participantId)
      .whereIn('participants.company_id', await getOwnedCompanyIds(req.user.userId))
      .select('participants.*', 'pe.id as pe_id', 'evaluations.name as evaluation_name')
      .first();

    if (!participantEvaluation) {
      return res.status(404).json({ error: 'Participante no encontrado' });
    }

    if (!participantEvaluation.pe_id) {
      return res.status(400).json({ error: 'Participante no asignado a evaluación' });
    }

    await db.transaction(async (trx) => {
      // Convert responses to the format expected by calculate-results.js
      const responseMap = {};
      responses.forEach(response => {
        responseMap[response.questionNumber] = response.responseValue;
      });

      // Delete existing responses for this questionnaire type
      await trx('responses')
        .where('participant_evaluation_id', participantEvaluation.pe_id)
        .where('questionnaire_type', questionnaireType)
        .del();

      // Insert new responses as JSON
      await trx('responses').insert({
        participant_evaluation_id: participantEvaluation.pe_id,
        questionnaire_type: questionnaireType,
        responses: JSON.stringify(responseMap),
        completed_at: new Date()
      });

      // Update participant progress - get demographic data to determine form type
      let demographicData = {};
      try {
        demographicData = typeof participantEvaluation.demographic_data === 'string'
          ? JSON.parse(participantEvaluation.demographic_data)
          : (participantEvaluation.demographic_data || {});
      } catch (e) {
        demographicData = {};
      }

      const formType = demographicData.formType || 'A';

      const totalQuestionsByType = {
        'intralaboral_a': 123,
        'intralaboral_b': 97,
        'extralaboral': 31,
        'estres': 31,
        'coping': 28
      };

      const completedQuestionnaires = await trx('responses')
        .where('participant_evaluation_id', participantEvaluation.pe_id)
        .select('questionnaire_type');

      let totalCompleted = 0;
      let totalRequired = 0;
      const completedTypes = completedQuestionnaires.map(q => q.questionnaire_type);

      // Determine required questionnaires based on form type
      const requiredQuestionnaires = formType === 'A' 
        ? ['intralaboral_a', 'extralaboral', 'estres']
        : ['intralaboral_b', 'extralaboral', 'estres'];

      requiredQuestionnaires.forEach(type => {
        if (completedTypes.includes(type)) {
          totalCompleted += totalQuestionsByType[type];
        }
        totalRequired += totalQuestionsByType[type];
      });

      const completionPercentage = Math.round((totalCompleted / totalRequired) * 100);

      // Update participant_evaluation status
      const updateData = {};
      
      if (participantEvaluation.status === 'assigned' && completedTypes.length > 0) {
        updateData.status = 'in_progress';
      }

      if (completionPercentage === 100 && participantEvaluation.status !== 'completed') {
        updateData.status = 'completed';
        updateData.completed_at = new Date();
      }

      if (Object.keys(updateData).length > 0) {
        updateData.updated_at = new Date();
        await trx('participant_evaluations')
          .where('id', participantEvaluation.pe_id)
          .update(updateData);
      }
    });

    // Log response saving
    await db('audit_logs').insert({
      user_id: req.user.userId,
      action: 'save_responses',
      table_name: 'responses',
      record_id: participantId,
      new_values: {
        questionnaireType,
        responseCount: responses.length
      }
    });

    res.json({
      message: 'Respuestas guardadas exitosamente',
      saved: responses.length
    });

  } catch (error) {
    console.error('Save responses error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Get participant responses
router.get('/participant/:participantId', auth, async (req, res) => {
  try {
    const { participantId } = req.params;
    const { questionnaireType } = req.query;

    // Check if participant exists and belongs to company, get participant_evaluation_id
    const participantEvaluation = await db('participants')
      .leftJoin('participant_evaluations as pe', 'participants.id', 'pe.participant_id')
      .leftJoin('evaluations', 'pe.evaluation_id', 'evaluations.id')
      .where('participants.id', participantId)
      .whereIn('participants.company_id', await getOwnedCompanyIds(req.user.userId))
      .select('participants.*', 'pe.id as pe_id', 'evaluations.name as evaluation_name')
      .first();

    if (!participantEvaluation) {
      return res.status(404).json({ error: 'Participante no encontrado' });
    }

    if (!participantEvaluation.pe_id) {
      return res.status(400).json({ error: 'Participante no asignado a evaluación' });
    }

    let query = db('responses').where('participant_evaluation_id', participantEvaluation.pe_id);

    if (questionnaireType) {
      query = query.where('questionnaire_type', questionnaireType);
    }

    const responses = await query
      .orderBy('questionnaire_type')
      .select('*');

    // Parse JSON responses and convert to individual question format
    const groupedResponses = {};
    let totalResponses = 0;

    responses.forEach(response => {
      try {
        const responseData = typeof response.responses === 'string' 
          ? JSON.parse(response.responses)
          : (response.responses || {});
        
        const questionResponses = Object.entries(responseData).map(([questionNumber, responseValue]) => ({
          questionNumber: parseInt(questionNumber),
          responseValue: responseValue,
          createdAt: response.created_at
        }));

        groupedResponses[response.questionnaire_type] = questionResponses;
        totalResponses += questionResponses.length;
      } catch (e) {
        console.error('Error parsing response JSON:', e);
        groupedResponses[response.questionnaire_type] = [];
      }
    });

    res.json({
      participantId,
      responses: groupedResponses,
      totalResponses
    });

  } catch (error) {
    console.error('Get responses error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Get responses summary for evaluation
router.get('/evaluation/:evaluationId/summary', auth, async (req, res) => {
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

    // Get response statistics
    const stats = await db('responses')
      .join('participants', 'responses.participant_id', 'participants.id')
      .where('participants.evaluation_id', evaluationId)
      .groupBy('responses.questionnaire_type')
      .select(
        'responses.questionnaire_type',
        db.raw('COUNT(DISTINCT responses.participant_id) as participants_count'),
        db.raw('COUNT(*) as total_responses')
      );

    // Get completion rates by questionnaire type
    const completionRates = await db('participants')
      .where('evaluation_id', evaluationId)
      .groupBy('form_type', 'status')
      .select(
        'form_type',
        'status',
        db.raw('COUNT(*) as count')
      );

    res.json({
      evaluationId,
      responseStats: stats.map(stat => ({
        questionnaireType: stat.questionnaire_type,
        participantsCount: parseInt(stat.participants_count),
        totalResponses: parseInt(stat.total_responses)
      })),
      completionRates: completionRates.map(rate => ({
        formType: rate.form_type,
        status: rate.status,
        count: parseInt(rate.count)
      }))
    });

  } catch (error) {
    console.error('Get responses summary error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;