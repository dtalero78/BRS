const express = require('express');
const router = express.Router();
const Joi = require('joi');
const { auth, authorize, getOwnedCompanyIds } = require('../middleware/auth');
const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// Validation schemas
const createEvaluationSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().allow(''),
  startDate: Joi.date().required(),
  endDate: Joi.date().min(Joi.ref('startDate')).allow(null),
  companyId: Joi.number().integer().required()
});

const updateEvaluationSchema = Joi.object({
  name: Joi.string(),
  description: Joi.string().allow(''),
  startDate: Joi.date(),
  endDate: Joi.date().min(Joi.ref('startDate')).allow(null),
  status: Joi.string().valid('active', 'completed', 'cancelled')
});

// Get all evaluations for the evaluator's companies
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const offset = (page - 1) * limit;
    const companyIds = await getOwnedCompanyIds(req.user.userId);

    let query = db('evaluations')
      .leftJoin('companies', 'evaluations.company_id', 'companies.id')
      .whereIn('evaluations.company_id', companyIds)
      .orderBy('evaluations.created_at', 'desc');

    if (status) {
      query = query.where('evaluations.status', status);
    }

    const evaluations = await query
      .limit(limit)
      .offset(offset)
      .select('evaluations.*', 'companies.name as company_name');

    // Get total count
    const totalQuery = db('evaluations')
      .whereIn('company_id', companyIds)
      .count('* as count');

    if (status) {
      totalQuery.where('status', status);
    }

    const [{ count }] = await totalQuery;

    res.json({
      evaluations: evaluations.map(evaluation => ({
        id: evaluation.id,
        companyId: evaluation.company_id,
        companyName: evaluation.company_name,
        name: evaluation.name,
        description: evaluation.description,
        startDate: evaluation.start_date,
        endDate: evaluation.end_date,
        status: evaluation.status,
        totalParticipants: evaluation.total_participants,
        completedParticipants: evaluation.completed_participants,
        progress: evaluation.total_participants > 0
          ? Math.round((evaluation.completed_participants / evaluation.total_participants) * 100)
          : 0,
        createdAt: evaluation.created_at,
        updatedAt: evaluation.updated_at
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(count),
        pages: Math.ceil(count / limit)
      }
    });

  } catch (error) {
    console.error('Get evaluations error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Get evaluation by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const companyIds = await getOwnedCompanyIds(req.user.userId);
    const evaluation = await db('evaluations')
      .where('id', id)
      .whereIn('company_id', companyIds)
      .first();

    if (!evaluation) {
      return res.status(404).json({ error: 'Evaluación no encontrada' });
    }

    // Get participants
    const participants = await db('participants')
      .where('evaluation_id', id)
      .select('*');

    res.json({
      id: evaluation.id,
      name: evaluation.name,
      description: evaluation.description,
      startDate: evaluation.start_date,
      endDate: evaluation.end_date,
      status: evaluation.status,
      totalParticipants: evaluation.total_participants,
      completedParticipants: evaluation.completed_participants,
      progress: evaluation.total_participants > 0 
        ? Math.round((evaluation.completed_participants / evaluation.total_participants) * 100)
        : 0,
      createdAt: evaluation.created_at,
      updatedAt: evaluation.updated_at,
      participants: participants.map(p => ({
        id: p.id,
        firstName: p.first_name,
        lastName: p.last_name,
        department: p.department,
        position: p.position,
        status: p.status,
        completionPercentage: p.completion_percentage,
        formType: p.form_type,
        startedAt: p.started_at,
        completedAt: p.completed_at
      }))
    });

  } catch (error) {
    console.error('Get evaluation error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Create new evaluation
router.post('/', auth, authorize('admin', 'evaluator'), async (req, res) => {
  try {
    const { error } = createEvaluationSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { name, description, startDate, endDate, companyId } = req.body;

    // Validate company ownership
    if (!companyId) {
      return res.status(400).json({ error: 'companyId es requerido' });
    }
    const companyIds = await getOwnedCompanyIds(req.user.userId);
    if (!companyIds.includes(parseInt(companyId))) {
      return res.status(403).json({ error: 'No autorizado para esta empresa' });
    }

    const [evaluation] = await db('evaluations')
      .insert({
        company_id: companyId,
        created_by: req.user.userId,
        name,
        description,
        start_date: startDate,
        end_date: endDate,
        status: 'active'
      })
      .returning('*');

    // Log creation
    await db('audit_logs').insert({
      user_id: req.user.userId,
      action: 'create_evaluation',
      table_name: 'evaluations',
      record_id: evaluation.id,
      new_values: { name, startDate, endDate }
    });

    res.status(201).json({
      id: evaluation.id,
      name: evaluation.name,
      description: evaluation.description,
      startDate: evaluation.start_date,
      endDate: evaluation.end_date,
      status: evaluation.status,
      totalParticipants: 0,
      completedParticipants: 0,
      progress: 0,
      createdAt: evaluation.created_at,
      updatedAt: evaluation.updated_at
    });

  } catch (error) {
    console.error('Create evaluation error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Update evaluation
router.put('/:id', auth, authorize('admin', 'evaluator'), async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = updateEvaluationSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    // Check if evaluation exists and belongs to evaluator's companies
    const ownedIds = await getOwnedCompanyIds(req.user.userId);
    const existingEvaluation = await db('evaluations')
      .where('id', id)
      .whereIn('company_id', ownedIds)
      .first();

    if (!existingEvaluation) {
      return res.status(404).json({ error: 'Evaluación no encontrada' });
    }

    const updateData = {};
    if (req.body.name) updateData.name = req.body.name;
    if (req.body.description !== undefined) updateData.description = req.body.description;
    if (req.body.startDate) updateData.start_date = req.body.startDate;
    if (req.body.endDate !== undefined) updateData.end_date = req.body.endDate;
    if (req.body.status) updateData.status = req.body.status;

    const [evaluation] = await db('evaluations')
      .where('id', id)
      .update(updateData)
      .returning('*');

    // Log update
    await db('audit_logs').insert({
      user_id: req.user.userId,
      action: 'update_evaluation',
      table_name: 'evaluations',
      record_id: id,
      old_values: existingEvaluation,
      new_values: updateData
    });

    res.json({
      id: evaluation.id,
      name: evaluation.name,
      description: evaluation.description,
      startDate: evaluation.start_date,
      endDate: evaluation.end_date,
      status: evaluation.status,
      totalParticipants: evaluation.total_participants,
      completedParticipants: evaluation.completed_participants,
      progress: evaluation.total_participants > 0 
        ? Math.round((evaluation.completed_participants / evaluation.total_participants) * 100)
        : 0,
      createdAt: evaluation.created_at,
      updatedAt: evaluation.updated_at
    });

  } catch (error) {
    console.error('Update evaluation error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Delete evaluation
router.delete('/:id', auth, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if evaluation exists and belongs to evaluator's companies
    const ownedIds = await getOwnedCompanyIds(req.user.userId);
    const evaluation = await db('evaluations')
      .where('id', id)
      .whereIn('company_id', ownedIds)
      .first();

    if (!evaluation) {
      return res.status(404).json({ error: 'Evaluación no encontrada' });
    }

    // Check if evaluation has participants
    const participantCount = await db('participants')
      .where('evaluation_id', id)
      .count('* as count')
      .first();

    if (participantCount.count > 0) {
      return res.status(400).json({ 
        error: 'No se puede eliminar una evaluación con participantes. Considera cambiar el estado a "cancelada"' 
      });
    }

    await db('evaluations').where('id', id).del();

    // Log deletion
    await db('audit_logs').insert({
      user_id: req.user.userId,
      action: 'delete_evaluation',
      table_name: 'evaluations',
      record_id: id,
      old_values: { name: evaluation.name }
    });

    res.json({ message: 'Evaluación eliminada exitosamente' });

  } catch (error) {
    console.error('Delete evaluation error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Get dashboard statistics for evaluator
router.get('/dashboard', auth, async (req, res) => {
  try {
    const companyIds = await getOwnedCompanyIds(req.user.userId);

    // Get evaluation statistics
    const evaluationStats = await db('evaluations')
      .whereIn('company_id', companyIds)
      .select(
        db.raw('COUNT(*) as total_evaluations'),
        db.raw("COUNT(CASE WHEN status = 'active' THEN 1 END) as active_evaluations")
      )
      .first();

    // Get participant statistics
    const participantStats = await db('participants')
      .join('evaluations', 'participants.evaluation_id', 'evaluations.id')
      .whereIn('evaluations.company_id', companyIds)
      .select(
        db.raw('COUNT(DISTINCT participants.id) as total_participants'),
        db.raw('COUNT(DISTINCT CASE WHEN participants.completed_at IS NOT NULL THEN participants.id END) as completed_participants')
      )
      .first();

    // Get response statistics
    const responseStats = await db('responses')
      .join('participants', 'responses.participant_id', 'participants.id')
      .join('evaluations', 'participants.evaluation_id', 'evaluations.id')
      .whereIn('evaluations.company_id', companyIds)
      .select(
        db.raw('COUNT(*) as total_responses'),
        db.raw('COUNT(DISTINCT responses.participant_id) as participants_with_responses')
      )
      .first();

    // Calculate average completion rate
    const totalParticipants = parseInt(participantStats.total_participants) || 1;
    const completedParticipants = parseInt(participantStats.completed_participants) || 0;
    const averageCompletion = Math.round((completedParticipants / totalParticipants) * 100);

    // Get recent activity (last 10 participant completions)
    const recentActivity = await db('participants')
      .join('evaluations', 'participants.evaluation_id', 'evaluations.id')
      .whereIn('evaluations.company_id', companyIds)
      .whereNotNull('participants.completed_at')
      .select(
        'participants.first_name',
        'participants.last_name',
        'evaluations.name as evaluation_name',
        'participants.completed_at'
      )
      .orderBy('participants.completed_at', 'desc')
      .limit(10);

    const stats = {
      totalEvaluations: parseInt(evaluationStats.total_evaluations) || 0,
      activeEvaluations: parseInt(evaluationStats.active_evaluations) || 0,
      totalParticipants: parseInt(participantStats.total_participants) || 0,
      completedAssessments: parseInt(participantStats.completed_participants) || 0,
      pendingAssessments: totalParticipants - completedParticipants,
      averageCompletion: averageCompletion
    };

    res.json({
      stats,
      recentActivity
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;