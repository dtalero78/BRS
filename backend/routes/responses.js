const express = require('express');
const router = express.Router();
const Joi = require('joi');
const { auth } = require('../middleware/auth');
const db = require('../config/database');

// Validation schema for saving responses
const saveResponsesSchema = Joi.object({
  participantId: Joi.string().uuid().required(),
  questionnaireType: Joi.string().valid('intralaboral_a', 'intralaboral_b', 'extralaboral', 'stress').required(),
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

    await db.transaction(async (trx) => {
      // Delete existing responses for this questionnaire type
      await trx('responses')
        .where('participant_id', participantId)
        .where('questionnaire_type', questionnaireType)
        .del();

      // Insert new responses
      const responseData = responses.map(response => ({
        participant_id: participantId,
        questionnaire_type: questionnaireType,
        question_number: response.questionNumber,
        response_value: response.responseValue,
        dimension: response.dimension || null,
        domain: response.domain || null
      }));

      await trx('responses').insert(responseData);

      // Update participant progress
      const totalQuestionsByType = {
        'intralaboral_a': 123,
        'intralaboral_b': 97,
        'extralaboral': 31,
        'stress': 31
      };

      const completedQuestionnaires = await trx('responses')
        .where('participant_id', participantId)
        .groupBy('questionnaire_type')
        .select('questionnaire_type', trx.raw('COUNT(*) as count'));

      let totalCompleted = 0;
      let totalRequired = 0;

      // Determine required questionnaires based on form type
      const requiredQuestionnaires = participant.form_type === 'A' 
        ? ['intralaboral_a', 'extralaboral', 'stress']
        : ['intralaboral_b', 'extralaboral', 'stress'];

      requiredQuestionnaires.forEach(type => {
        const completed = completedQuestionnaires.find(q => q.questionnaire_type === type);
        totalCompleted += completed ? parseInt(completed.count) : 0;
        totalRequired += totalQuestionsByType[type];
      });

      const completionPercentage = Math.round((totalCompleted / totalRequired) * 100);
      const isCompleted = completionPercentage === 100;

      // Update participant status
      const updateData = {
        completion_percentage: completionPercentage
      };

      if (participant.status === 'pending' && totalCompleted > 0) {
        updateData.status = 'in_progress';
        updateData.started_at = new Date();
      }

      if (isCompleted && participant.status !== 'completed') {
        updateData.status = 'completed';
        updateData.completed_at = new Date();
        
        // Update evaluation completed participants count
        await trx('evaluations')
          .where('id', participant.evaluation_id)
          .increment('completed_participants', 1);
      }

      await trx('participants')
        .where('id', participantId)
        .update(updateData);
    });

    // Log response saving
    await db('audit_logs').insert({
      user_id: req.user.userId,
      action: 'save_responses',
      entity_type: 'participant',
      entity_id: participantId,
      details: {
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

    let query = db('responses').where('participant_id', participantId);

    if (questionnaireType) {
      query = query.where('questionnaire_type', questionnaireType);
    }

    const responses = await query
      .orderBy('questionnaire_type')
      .orderBy('question_number')
      .select('*');

    // Group responses by questionnaire type
    const groupedResponses = responses.reduce((acc, response) => {
      if (!acc[response.questionnaire_type]) {
        acc[response.questionnaire_type] = [];
      }
      acc[response.questionnaire_type].push({
        questionNumber: response.question_number,
        responseValue: response.response_value,
        dimension: response.dimension,
        domain: response.domain,
        createdAt: response.created_at
      });
      return acc;
    }, {});

    res.json({
      participantId,
      responses: groupedResponses,
      totalResponses: responses.length
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

    // Check if evaluation belongs to company
    const evaluation = await db('evaluations')
      .where('id', evaluationId)
      .where('company_id', req.user.companyId)
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