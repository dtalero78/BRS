const express = require('express');
const router = express.Router();
const Joi = require('joi');
const { auth, authorize } = require('../middleware/auth');
const db = require('../config/database');

// Validation schema for creating participant
const createParticipantSchema = Joi.object({
  evaluationId: Joi.alternatives().try(Joi.number().integer(), Joi.string()).required(),
  firstName: Joi.string().required(),
  lastName: Joi.string().required(),
  documentType: Joi.string().valid('CC', 'CE', 'Pasaporte').required(),
  documentNumber: Joi.string().required(),
  birthYear: Joi.number().integer().min(1940).max(new Date().getFullYear()).required(),
  gender: Joi.string().valid('Masculino', 'Femenino', 'Otro').required(),
  maritalStatus: Joi.string().valid('Soltero(a)', 'Casado(a)', 'Unión libre', 'Separado(a)', 'Divorciado(a)', 'Viudo(a)').required(),
  educationLevel: Joi.string().allow('').optional(),
  department: Joi.string().allow('').optional(),
  position: Joi.string().allow('').optional(), 
  contractType: Joi.string().allow('').optional(),
  employmentType: Joi.string().allow('').optional(),
  tenureMonths: Joi.number().integer().min(0).optional(),
  salaryRange: Joi.string().allow('').optional(),
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

    // Create unique email from document (temporary solution)
    const email = `${participantData.documentType}_${participantData.documentNumber}@temp.com`.toLowerCase();

    // Check if participant already exists by email
    const existingParticipant = await db('participants')
      .where('email', email)
      .where('company_id', req.user.companyId)
      .first();

    let participant;
    
    if (existingParticipant) {
      participant = existingParticipant;
    } else {
      // Create new participant
      const demographicData = {
        firstName: participantData.firstName,
        lastName: participantData.lastName,
        documentType: participantData.documentType,
        documentNumber: participantData.documentNumber,
        birthYear: participantData.birthYear,
        gender: participantData.gender,
        maritalStatus: participantData.maritalStatus,
        educationLevel: participantData.educationLevel,
        department: participantData.department,
        position: participantData.position,
        contractType: participantData.contractType,
        employmentType: participantData.employmentType,
        tenureMonths: participantData.tenureMonths,
        salaryRange: participantData.salaryRange,
        workHoursPerDay: participantData.workHoursPerDay,
        workDaysPerWeek: participantData.workDaysPerWeek,
        formType: participantData.formType
      };

      [participant] = await db('participants')
        .insert({
          company_id: req.user.companyId,
          email: email,
          demographic_data: JSON.stringify(demographicData),
          active: true
        })
        .returning('*');
    }

    // Check if participant is already assigned to this evaluation
    const existingAssignment = await db('participant_evaluations')
      .where('evaluation_id', evaluationId)
      .where('participant_id', participant.id)
      .first();

    if (existingAssignment) {
      return res.status(409).json({ error: 'El participante ya está asignado a esta evaluación' });
    }

    // Generate unique access token
    const crypto = require('crypto');
    const accessToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    // Assign participant to evaluation
    await db('participant_evaluations')
      .insert({
        evaluation_id: evaluationId,
        participant_id: participant.id,
        status: 'assigned',
        assigned_at: new Date(),
        access_token: accessToken,
        token_expires_at: tokenExpiresAt
      });

    // Log creation
    await db('audit_logs').insert({
      user_id: req.user.userId,
      action: 'assign_participant',
      table_name: 'participant_evaluations',
      record_id: participant.id,
      new_values: {
        evaluationId,
        name: `${participantData.firstName} ${participantData.lastName}`,
        document: `${participantData.documentType}-${participantData.documentNumber}`
      }
    });

    const demographicData = typeof participant.demographic_data === 'string' 
      ? JSON.parse(participant.demographic_data) 
      : (participant.demographic_data || {});

    res.status(201).json({
      id: participant.id,
      email: participant.email,
      firstName: demographicData.firstName || participantData.firstName,
      lastName: demographicData.lastName || participantData.lastName,
      documentType: demographicData.documentType || participantData.documentType,
      documentNumber: demographicData.documentNumber || participantData.documentNumber,
      department: demographicData.department || participantData.department,
      position: demographicData.position || participantData.position,
      formType: demographicData.formType || participantData.formType,
      evaluationId: evaluationId,
      status: 'assigned',
      completionPercentage: 0,
      createdAt: participant.created_at,
      accessToken: accessToken,
      evaluationUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/participant/evaluation/${accessToken}`
    });

  } catch (error) {
    console.error('Create participant error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Get all participants for company
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 50, status, evaluationId } = req.query;
    const offset = (page - 1) * limit;

    let query = db('participants')
      .leftJoin('participant_evaluations as pe', 'participants.id', 'pe.participant_id')
      .leftJoin('evaluations', 'pe.evaluation_id', 'evaluations.id')
      .where('participants.company_id', req.user.companyId)
      .orderBy('participants.created_at', 'desc');

    if (status) {
      query = query.where('pe.status', status);
    }

    if (evaluationId) {
      query = query.where('pe.evaluation_id', evaluationId);
    }

    const participants = await query
      .limit(limit)
      .offset(offset)
      .select(
        'participants.*',
        'evaluations.name as evaluation_name',
        'evaluations.id as evaluation_id',
        'pe.status as evaluation_status',
        'pe.assigned_at',
        'pe.completed_at',
        'pe.access_token'
      );

    // Get total count
    let countQuery = db('participants')
      .leftJoin('participant_evaluations as pe', 'participants.id', 'pe.participant_id')
      .leftJoin('evaluations', 'pe.evaluation_id', 'evaluations.id')
      .where('participants.company_id', req.user.companyId)
      .count('* as count');
    
    if (status) {
      countQuery = countQuery.where('pe.status', status);
    }

    if (evaluationId) {
      countQuery = countQuery.where('pe.evaluation_id', evaluationId);
    }

    const [{ count }] = await countQuery;

    res.json({
      participants: participants.map(p => {
        let demographicData = {};
        try {
          demographicData = typeof p.demographic_data === 'string' 
            ? JSON.parse(p.demographic_data) 
            : (p.demographic_data || {});
        } catch (e) {
          demographicData = {};
        }

        return {
          id: p.id,
          email: p.email,
          firstName: demographicData.firstName || 'N/A',
          lastName: demographicData.lastName || 'N/A',
          documentType: demographicData.documentType || 'N/A',
          documentNumber: demographicData.documentNumber || 'N/A',
          birthYear: demographicData.birthYear || 0,
          gender: demographicData.gender || 'N/A',
          maritalStatus: demographicData.maritalStatus || 'N/A',
          educationLevel: demographicData.educationLevel || 'N/A',
          department: demographicData.department || 'N/A',
          position: demographicData.position || 'N/A',
          contractType: demographicData.contractType || 'N/A',
          employmentType: demographicData.employmentType || 'N/A',
          tenureMonths: demographicData.tenureMonths || 0,
          salaryRange: demographicData.salaryRange || 'N/A',
          workHoursPerDay: demographicData.workHoursPerDay || 8,
          workDaysPerWeek: demographicData.workDaysPerWeek || 5,
          formType: demographicData.formType || 'A',
          evaluationId: p.evaluation_id,
          evaluationName: p.evaluation_name,
          status: p.evaluation_status || 'pending',
          completionPercentage: 0,
          startedAt: p.assigned_at,
          completedAt: p.completed_at,
          createdAt: p.created_at,
          updatedAt: p.updated_at,
          accessToken: p.access_token,
          evaluationUrl: p.access_token ? `${process.env.FRONTEND_URL || 'http://localhost:3000'}/participant/evaluation/${p.access_token}` : null
        };
      }),
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

// Generate access token for existing participant
router.post('/:id/generate-token', auth, authorize('admin', 'evaluator'), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if participant exists and belongs to company
    const participant = await db('participants')
      .join('participant_evaluations as pe', 'participants.id', 'pe.participant_id')
      .join('evaluations', 'pe.evaluation_id', 'evaluations.id')
      .where('participants.id', id)
      .where('evaluations.company_id', req.user.companyId)
      .select('participants.*', 'pe.id as pe_id', 'pe.access_token')
      .first();

    if (!participant) {
      return res.status(404).json({ error: 'Participante no encontrado' });
    }

    let accessToken = participant.access_token;
    let tokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    // Generate new token if none exists
    if (!accessToken) {
      const crypto = require('crypto');
      accessToken = crypto.randomBytes(32).toString('hex');
      
      // Update participant_evaluations with token
      await db('participant_evaluations')
        .where('id', participant.pe_id)
        .update({
          access_token: accessToken,
          token_expires_at: tokenExpiresAt
        });
    }

    // Log token generation
    await db('audit_logs').insert({
      user_id: req.user.userId,
      action: 'generate_token',
      table_name: 'participant_evaluations',
      record_id: participant.pe_id,
      new_values: {
        participantId: id,
        tokenGenerated: true
      }
    });

    res.json({
      success: true,
      accessToken: accessToken,
      evaluationUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/participant/evaluation/${accessToken}`,
      expiresAt: tokenExpiresAt
    });

  } catch (error) {
    console.error('Generate token error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;