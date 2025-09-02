const express = require('express');
const router = express.Router();
const Joi = require('joi');
const { auth, authorize } = require('../middleware/auth');
const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// Validation schemas
const createEvaluationSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().allow(''),
  startDate: Joi.date().required(),
  endDate: Joi.date().min(Joi.ref('startDate')).allow(null)
});

const updateEvaluationSchema = Joi.object({
  name: Joi.string(),
  description: Joi.string().allow(''),
  startDate: Joi.date(),
  endDate: Joi.date().min(Joi.ref('startDate')).allow(null),
  status: Joi.string().valid('active', 'completed', 'cancelled')
});

// Get all evaluations for the company
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const offset = (page - 1) * limit;

    let query = db('evaluations')
      .where('company_id', req.user.companyId)
      .orderBy('created_at', 'desc');

    if (status) {
      query = query.where('status', status);
    }

    const evaluations = await query
      .limit(limit)
      .offset(offset)
      .select('*');

    // Get total count
    const totalQuery = db('evaluations')
      .where('company_id', req.user.companyId)
      .count('* as count');
    
    if (status) {
      totalQuery.where('status', status);
    }

    const [{ count }] = await totalQuery;

    res.json({
      evaluations: evaluations.map(evaluation => ({
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

    const evaluation = await db('evaluations')
      .where('id', id)
      .where('company_id', req.user.companyId)
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

    const { name, description, startDate, endDate } = req.body;

    const [evaluation] = await db('evaluations')
      .insert({
        company_id: req.user.companyId,
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
      entity_type: 'evaluation',
      entity_id: evaluation.id,
      details: { name, startDate, endDate }
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

    // Check if evaluation exists and belongs to company
    const existingEvaluation = await db('evaluations')
      .where('id', id)
      .where('company_id', req.user.companyId)
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
      entity_type: 'evaluation',
      entity_id: id,
      details: updateData
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

    // Check if evaluation exists and belongs to company
    const evaluation = await db('evaluations')
      .where('id', id)
      .where('company_id', req.user.companyId)
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
      entity_type: 'evaluation',
      entity_id: id,
      details: { name: evaluation.name }
    });

    res.json({ message: 'Evaluación eliminada exitosamente' });

  } catch (error) {
    console.error('Delete evaluation error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;