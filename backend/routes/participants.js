const express = require('express');
const router = express.Router();
const Joi = require('joi');
const { auth, authorize } = require('../middleware/auth');
const db = require('../config/database');

// Validation schema for creating participant
const createParticipantSchema = Joi.object({
  evaluationId: Joi.string().uuid().required(),
  firstName: Joi.string().required(),
  lastName: Joi.string().required(),
  documentType: Joi.string().valid('CC', 'CE', 'Pasaporte').required(),
  documentNumber: Joi.string().required(),
  birthYear: Joi.number().integer().min(1940).max(new Date().getFullYear()).required(),
  gender: Joi.string().valid('Masculino', 'Femenino', 'Otro').required(),
  maritalStatus: Joi.string().valid('Soltero(a)', 'Casado(a)', 'Unión libre', 'Separado(a)', 'Divorciado(a)', 'Viudo(a)').required(),
  educationLevel: Joi.string().required(),
  department: Joi.string().required(),
  position: Joi.string().required(),
  contractType: Joi.string().required(),
  employmentType: Joi.string().required(),
  tenureMonths: Joi.number().integer().min(0).required(),
  salaryRange: Joi.string().required(),
  workHoursPerDay: Joi.number().integer().min(1).max(24).required(),
  workDaysPerWeek: Joi.number().integer().min(1).max(7).required(),
  formType: Joi.string().valid('A', 'B').required()
});

// Create participant
router.post('/', auth, authorize('admin', 'evaluator'), async (req, res) => {
  try {
    const { error } = createParticipantSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { evaluationId, ...participantData } = req.body;

    // Check if evaluation exists and belongs to company
    const evaluation = await db('evaluations')
      .where('id', evaluationId)
      .where('company_id', req.user.companyId)
      .first();

    if (!evaluation) {
      return res.status(404).json({ error: 'Evaluación no encontrada' });
    }

    // Check if participant already exists in this evaluation
    const existingParticipant = await db('participants')
      .where('evaluation_id', evaluationId)
      .where('document_type', participantData.documentType)
      .where('document_number', participantData.documentNumber)
      .first();

    if (existingParticipant) {
      return res.status(409).json({ error: 'El participante ya existe en esta evaluación' });
    }

    const [participant] = await db('participants')
      .insert({
        evaluation_id: evaluationId,
        first_name: participantData.firstName,
        last_name: participantData.lastName,
        document_type: participantData.documentType,
        document_number: participantData.documentNumber,
        birth_year: participantData.birthYear,
        gender: participantData.gender,
        marital_status: participantData.maritalStatus,
        education_level: participantData.educationLevel,
        department: participantData.department,
        position: participantData.position,
        contract_type: participantData.contractType,
        employment_type: participantData.employmentType,
        tenure_months: participantData.tenureMonths,
        salary_range: participantData.salaryRange,
        work_hours_per_day: participantData.workHoursPerDay,
        work_days_per_week: participantData.workDaysPerWeek,
        form_type: participantData.formType,
        status: 'pending'
      })
      .returning('*');

    // Update evaluation total participants count
    await db('evaluations')
      .where('id', evaluationId)
      .increment('total_participants', 1);

    // Log creation
    await db('audit_logs').insert({
      user_id: req.user.userId,
      action: 'create_participant',
      entity_type: 'participant',
      entity_id: participant.id,
      details: {
        evaluationId,
        name: `${participantData.firstName} ${participantData.lastName}`,
        document: `${participantData.documentType}-${participantData.documentNumber}`
      }
    });

    res.status(201).json({
      id: participant.id,
      firstName: participant.first_name,
      lastName: participant.last_name,
      documentType: participant.document_type,
      documentNumber: participant.document_number,
      department: participant.department,
      position: participant.position,
      formType: participant.form_type,
      status: participant.status,
      completionPercentage: 0,
      createdAt: participant.created_at
    });

  } catch (error) {
    console.error('Create participant error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Get participants for an evaluation
router.get('/evaluation/:evaluationId', auth, async (req, res) => {
  try {
    const { evaluationId } = req.params;
    const { page = 1, limit = 10, status } = req.query;
    const offset = (page - 1) * limit;

    // Check if evaluation belongs to company
    const evaluation = await db('evaluations')
      .where('id', evaluationId)
      .where('company_id', req.user.companyId)
      .first();

    if (!evaluation) {
      return res.status(404).json({ error: 'Evaluación no encontrada' });
    }

    let query = db('participants')
      .where('evaluation_id', evaluationId)
      .orderBy('created_at', 'desc');

    if (status) {
      query = query.where('status', status);
    }

    const participants = await query
      .limit(limit)
      .offset(offset)
      .select('*');

    // Get total count
    const totalQuery = db('participants')
      .where('evaluation_id', evaluationId)
      .count('* as count');
    
    if (status) {
      totalQuery.where('status', status);
    }

    const [{ count }] = await totalQuery;

    res.json({
      participants: participants.map(p => ({
        id: p.id,
        firstName: p.first_name,
        lastName: p.last_name,
        documentType: p.document_type,
        documentNumber: p.document_number,
        department: p.department,
        position: p.position,
        formType: p.form_type,
        status: p.status,
        completionPercentage: p.completion_percentage,
        startedAt: p.started_at,
        completedAt: p.completed_at,
        createdAt: p.created_at
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(count),
        pages: Math.ceil(count / limit)
      }
    });

  } catch (error) {
    console.error('Get participants error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Get participant by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const participant = await db('participants')
      .join('evaluations', 'participants.evaluation_id', 'evaluations.id')
      .where('participants.id', id)
      .where('evaluations.company_id', req.user.companyId)
      .select('participants.*', 'evaluations.name as evaluation_name')
      .first();

    if (!participant) {
      return res.status(404).json({ error: 'Participante no encontrado' });
    }

    res.json({
      id: participant.id,
      evaluationId: participant.evaluation_id,
      evaluationName: participant.evaluation_name,
      firstName: participant.first_name,
      lastName: participant.last_name,
      documentType: participant.document_type,
      documentNumber: participant.document_number,
      birthYear: participant.birth_year,
      gender: participant.gender,
      maritalStatus: participant.marital_status,
      educationLevel: participant.education_level,
      department: participant.department,
      position: participant.position,
      contractType: participant.contract_type,
      employmentType: participant.employment_type,
      tenureMonths: participant.tenure_months,
      salaryRange: participant.salary_range,
      workHoursPerDay: participant.work_hours_per_day,
      workDaysPerWeek: participant.work_days_per_week,
      formType: participant.form_type,
      status: participant.status,
      completionPercentage: participant.completion_percentage,
      startedAt: participant.started_at,
      completedAt: participant.completed_at,
      createdAt: participant.created_at,
      updatedAt: participant.updated_at
    });

  } catch (error) {
    console.error('Get participant error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Update participant
router.put('/:id', auth, authorize('admin', 'evaluator'), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if participant exists and belongs to company
    const existingParticipant = await db('participants')
      .join('evaluations', 'participants.evaluation_id', 'evaluations.id')
      .where('participants.id', id)
      .where('evaluations.company_id', req.user.companyId)
      .select('participants.*')
      .first();

    if (!existingParticipant) {
      return res.status(404).json({ error: 'Participante no encontrado' });
    }

    const updateData = {};
    const allowedFields = [
      'firstName', 'lastName', 'department', 'position', 'contractType',
      'employmentType', 'tenureMonths', 'salaryRange', 'workHoursPerDay',
      'workDaysPerWeek', 'formType'
    ];

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        const dbField = field.replace(/([A-Z])/g, '_$1').toLowerCase();
        updateData[dbField] = req.body[field];
      }
    });

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No hay datos para actualizar' });
    }

    const [participant] = await db('participants')
      .where('id', id)
      .update(updateData)
      .returning('*');

    // Log update
    await db('audit_logs').insert({
      user_id: req.user.userId,
      action: 'update_participant',
      entity_type: 'participant',
      entity_id: id,
      details: updateData
    });

    res.json({
      id: participant.id,
      firstName: participant.first_name,
      lastName: participant.last_name,
      department: participant.department,
      position: participant.position,
      formType: participant.form_type,
      status: participant.status,
      completionPercentage: participant.completion_percentage,
      updatedAt: participant.updated_at
    });

  } catch (error) {
    console.error('Update participant error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Delete participant
router.delete('/:id', auth, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if participant exists and belongs to company
    const participant = await db('participants')
      .join('evaluations', 'participants.evaluation_id', 'evaluations.id')
      .where('participants.id', id)
      .where('evaluations.company_id', req.user.companyId)
      .select('participants.*')
      .first();

    if (!participant) {
      return res.status(404).json({ error: 'Participante no encontrado' });
    }

    await db.transaction(async (trx) => {
      // Delete responses first
      await trx('responses').where('participant_id', id).del();
      
      // Delete results
      await trx('results').where('participant_id', id).del();
      
      // Delete participant
      await trx('participants').where('id', id).del();
      
      // Update evaluation participants count
      await trx('evaluations')
        .where('id', participant.evaluation_id)
        .decrement('total_participants', 1);
        
      // If participant was completed, also decrement completed count
      if (participant.status === 'completed') {
        await trx('evaluations')
          .where('id', participant.evaluation_id)
          .decrement('completed_participants', 1);
      }
    });

    // Log deletion
    await db('audit_logs').insert({
      user_id: req.user.userId,
      action: 'delete_participant',
      entity_type: 'participant',
      entity_id: id,
      details: {
        name: `${participant.first_name} ${participant.last_name}`,
        evaluationId: participant.evaluation_id
      }
    });

    res.json({ message: 'Participante eliminado exitosamente' });

  } catch (error) {
    console.error('Delete participant error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;