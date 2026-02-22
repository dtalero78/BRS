const express = require('express');
const router = express.Router();
const Joi = require('joi');
const { auth, authorize, getOwnedCompanyIds } = require('../middleware/auth');
const db = require('../config/database');

// Helper to get the base URL for participant evaluation links
function getBaseUrl(req) {
  if (process.env.FRONTEND_URL) return process.env.FRONTEND_URL;
  const protocol = req.get('x-forwarded-proto') || req.protocol;
  const host = req.get('x-forwarded-host') || req.get('host');
  return `${protocol}://${host}`;
}

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

    // Check if evaluation exists and belongs to evaluator's companies
    const companyIds = await getOwnedCompanyIds(req.user.userId);
    const evaluation = await db('evaluations')
      .where('id', evaluationId)
      .whereIn('company_id', companyIds)
      .first();

    if (!evaluation) {
      return res.status(404).json({ error: 'Evaluación no encontrada' });
    }

    // Create unique email from document (temporary solution)
    const email = `${participantData.documentType}_${participantData.documentNumber}@temp.com`.toLowerCase();

    // Check if participant already exists by email in the evaluation's company
    const existingParticipant = await db('participants')
      .where('email', email)
      .where('company_id', evaluation.company_id)
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
          company_id: evaluation.company_id,
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
      evaluationUrl: `${getBaseUrl(req)}/participant/evaluation/${accessToken}`
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

    const companyIds = await getOwnedCompanyIds(req.user.userId);

    // Determinar el tipo de JOIN basado en los filtros
    const joinType = (status || evaluationId) ? 'join' : 'leftJoin';

    let query = db('participants')
      [joinType]('participant_evaluations as pe', 'participants.id', 'pe.participant_id')
      [joinType]('evaluations', 'pe.evaluation_id', 'evaluations.id')
      .whereIn('participants.company_id', companyIds)
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

    // Get total count usando el mismo tipo de JOIN
    let countQuery = db('participants')
      [joinType]('participant_evaluations as pe', 'participants.id', 'pe.participant_id')
      [joinType]('evaluations', 'pe.evaluation_id', 'evaluations.id')
      .whereIn('participants.company_id', companyIds)
      .count('* as count');
    
    if (status) {
      countQuery = countQuery.where('pe.status', status);
    }

    if (evaluationId) {
      countQuery = countQuery.where('pe.evaluation_id', evaluationId);
    }

    const [{ count }] = await countQuery;

    // Calcular progreso real para cada participante
    const participantsWithProgress = await Promise.all(participants.map(async (p) => {
      let demographicData = {};
      try {
        demographicData = typeof p.demographic_data === 'string' 
          ? JSON.parse(p.demographic_data) 
          : (p.demographic_data || {});
      } catch (e) {
        demographicData = {};
      }

      // Calcular progreso real basado en cuestionarios completados
      let completionPercentage = 0;
      
      if (p.evaluation_id) {
        // Obtener el participant_evaluation_id
        const participantEvaluation = await db('participant_evaluations')
          .where({
            participant_id: p.id,
            evaluation_id: p.evaluation_id
          })
          .first();

        if (participantEvaluation) {
          // Obtener respuestas completadas
          const responses = await db('responses')
            .where('participant_evaluation_id', participantEvaluation.id)
            .select('questionnaire_type');

          const formType = demographicData.formType || 'A';
          const requiredQuestionnaires = {
            'A': ['ficha_datos', 'intralaboral_a', 'extralaboral', 'estres'],
            'B': ['ficha_datos', 'intralaboral_b', 'extralaboral', 'estres']
          };

          const totalQuestionsByType = {
            'ficha_datos': 18,
            'intralaboral_a': 123,
            'intralaboral_b': 97,
            'extralaboral': 31,
            'estres': 31
          };

          const requiredTypes = requiredQuestionnaires[formType];
          const completedTypes = responses.map(r => r.questionnaire_type);
          
          let totalCompleted = 0;
          let totalRequired = 0;

          requiredTypes.forEach(type => {
            if (completedTypes.includes(type)) {
              totalCompleted += totalQuestionsByType[type];
            }
            totalRequired += totalQuestionsByType[type];
          });

          completionPercentage = totalRequired > 0 
            ? Math.round((totalCompleted / totalRequired) * 100) 
            : 0;
        }
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
        completionPercentage: completionPercentage,
        startedAt: p.assigned_at,
        completedAt: p.completed_at,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
        accessToken: p.access_token,
        evaluationUrl: p.access_token ? `${getBaseUrl(req)}/participant/evaluation/${p.access_token}` : null
      };
    }));

    res.json({
      participants: participantsWithProgress,
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

    // Check if evaluation belongs to evaluator's companies
    const companyIds = await getOwnedCompanyIds(req.user.userId);
    const evaluation = await db('evaluations')
      .where('id', evaluationId)
      .whereIn('company_id', companyIds)
      .first();

    if (!evaluation) {
      return res.status(404).json({ error: 'Evaluación no encontrada' });
    }

    let query = db('participants')
      .join('participant_evaluations', 'participants.id', 'participant_evaluations.participant_id')
      .where('participant_evaluations.evaluation_id', evaluationId)
      .orderBy('participants.created_at', 'desc');

    if (status) {
      query = query.where('status', status);
    }

    const participants = await query
      .limit(limit)
      .offset(offset)
      .select('participants.*', 'participant_evaluations.status', 'participant_evaluations.assigned_at', 'participant_evaluations.completed_at', 'participant_evaluations.access_token', 'participant_evaluations.id as pe_id');

    // Get completed questionnaires and results for each participant
    const participantIds = participants.map(p => p.pe_id);
    
    const responses = await db('responses')
      .whereIn('participant_evaluation_id', participantIds)
      .select('participant_evaluation_id', 'questionnaire_type', 'completed_at');

    const results = await db('results')
      .whereIn('participant_evaluation_id', participantIds)
      .select('participant_evaluation_id', 'questionnaire_type');

    // Group responses and results by participant_evaluation_id
    const responsesByParticipant = {};
    const resultsByParticipant = {};
    
    responses.forEach(response => {
      if (!responsesByParticipant[response.participant_evaluation_id]) {
        responsesByParticipant[response.participant_evaluation_id] = [];
      }
      responsesByParticipant[response.participant_evaluation_id].push(response.questionnaire_type);
    });

    results.forEach(result => {
      if (!resultsByParticipant[result.participant_evaluation_id]) {
        resultsByParticipant[result.participant_evaluation_id] = [];
      }
      resultsByParticipant[result.participant_evaluation_id].push(result.questionnaire_type);
    });

    // Get total count
    const totalQuery = db('participants')
      .join('participant_evaluations', 'participants.id', 'participant_evaluations.participant_id')
      .where('participant_evaluations.evaluation_id', evaluationId)
      .count('* as count');
    
    if (status) {
      totalQuery.where('participant_evaluations.status', status);
    }

    const [{ count }] = await totalQuery;

    res.json({
      participants: participants.map(p => {
        // Parse demographic data
        let demographicData = {};
        try {
          demographicData = typeof p.demographic_data === 'string'
            ? JSON.parse(p.demographic_data)
            : (p.demographic_data || {});
        } catch (e) {
          demographicData = {};
        }

        const completedQuestionnaires = responsesByParticipant[p.pe_id] || [];
        const hasResults = Boolean(resultsByParticipant[p.pe_id] && resultsByParticipant[p.pe_id].length > 0);

        // Temporary debug log for Daniel Talero
        if (p.id === 4) {
          console.log(`DEBUG - Daniel Talero (ID: ${p.id}, PE: ${p.pe_id}):`);
          console.log(`  completed_questionnaires:`, completedQuestionnaires);
          console.log(`  hasResults:`, hasResults);
        }

        return {
          id: p.id,
          participant_evaluation_id: p.pe_id,
          email: `${demographicData.documentType || ''}_${demographicData.documentNumber || ''}@temp.com`.toLowerCase(),
          firstName: demographicData.firstName || 'N/A',
          lastName: demographicData.lastName || 'N/A',
          documentType: demographicData.documentType || 'N/A',
          documentNumber: demographicData.documentNumber || 'N/A',
          department: demographicData.department || 'N/A',
          position: demographicData.position || 'N/A',
          formType: demographicData.formType || 'A',
          status: p.status || 'assigned',
          completed_questionnaires: completedQuestionnaires,
          hasResults: hasResults,
          completionPercentage: 0,
          startedAt: p.assigned_at,
          completedAt: p.completed_at,
          completed_at: p.completed_at,
          createdAt: p.created_at,
          accessToken: p.access_token,
          evaluationUrl: p.access_token ? `${getBaseUrl(req)}/participant/evaluation/${p.access_token}` : null
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

// Get participant by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const ownedIds = await getOwnedCompanyIds(req.user.userId);
    const participant = await db('participants')
      .leftJoin('participant_evaluations as pe', 'participants.id', 'pe.participant_id')
      .leftJoin('evaluations', 'pe.evaluation_id', 'evaluations.id')
      .where('participants.id', id)
      .whereIn('participants.company_id', ownedIds)
      .select('participants.*', 'evaluations.name as evaluation_name', 'pe.evaluation_id', 'pe.status as evaluation_status', 'pe.assigned_at', 'pe.completed_at')
      .first();

    if (!participant) {
      return res.status(404).json({ error: 'Participante no encontrado' });
    }

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
      id: participant.id,
      evaluationId: participant.evaluation_id,
      evaluationName: participant.evaluation_name,
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
      status: participant.evaluation_status || 'assigned',
      completionPercentage: 0,
      startedAt: participant.assigned_at,
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

    // Check if participant exists and belongs to evaluator's companies
    const ownedIds = await getOwnedCompanyIds(req.user.userId);
    const existingParticipant = await db('participants')
      .where('participants.id', id)
      .whereIn('participants.company_id', ownedIds)
      .select('participants.*')
      .first();

    if (!existingParticipant) {
      return res.status(404).json({ error: 'Participante no encontrado' });
    }

    // Parse existing demographic data
    let demographicData = {};
    try {
      demographicData = typeof existingParticipant.demographic_data === 'string'
        ? JSON.parse(existingParticipant.demographic_data)
        : (existingParticipant.demographic_data || {});
    } catch (e) {
      demographicData = {};
    }

    // Update demographic data with new values
    const allowedFields = [
      'firstName', 'lastName', 'department', 'position', 'contractType',
      'employmentType', 'tenureMonths', 'salaryRange', 'workHoursPerDay',
      'workDaysPerWeek', 'formType', 'gender', 'maritalStatus', 'educationLevel'
    ];

    let hasChanges = false;
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        demographicData[field] = req.body[field];
        hasChanges = true;
      }
    });

    if (!hasChanges) {
      return res.status(400).json({ error: 'No hay datos para actualizar' });
    }

    const [participant] = await db('participants')
      .where('id', id)
      .update({
        demographic_data: JSON.stringify(demographicData),
        updated_at: new Date()
      })
      .returning('*');

    // Log update
    await db('audit_logs').insert({
      user_id: req.user.userId,
      action: 'update_participant',
      entity_type: 'participant',
      entity_id: id,
      details: { updatedFields: Object.keys(req.body) }
    });

    res.json({
      id: participant.id,
      firstName: demographicData.firstName || 'N/A',
      lastName: demographicData.lastName || 'N/A',
      department: demographicData.department || 'N/A',
      position: demographicData.position || 'N/A',
      formType: demographicData.formType || 'A',
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

    // Check if participant exists and belongs to evaluator's companies
    const ownedIds = await getOwnedCompanyIds(req.user.userId);
    const participant = await db('participants')
      .leftJoin('participant_evaluations as pe', 'participants.id', 'pe.participant_id')
      .where('participants.id', id)
      .whereIn('participants.company_id', ownedIds)
      .select('participants.*', 'pe.evaluation_id', 'pe.status as evaluation_status')
      .first();

    if (!participant) {
      return res.status(404).json({ error: 'Participante no encontrado' });
    }

    // Parse demographic data for logging
    let demographicData = {};
    try {
      demographicData = typeof participant.demographic_data === 'string'
        ? JSON.parse(participant.demographic_data)
        : (participant.demographic_data || {});
    } catch (e) {
      demographicData = {};
    }

    await db.transaction(async (trx) => {
      // Delete responses first (using participant_evaluation_id)
      await trx('responses')
        .whereIn('participant_evaluation_id', 
          trx('participant_evaluations')
            .select('id')
            .where('participant_id', id)
        ).del();
      
      // Delete results (using participant_evaluation_id)
      await trx('results')
        .whereIn('participant_evaluation_id', 
          trx('participant_evaluations')
            .select('id')
            .where('participant_id', id)
        ).del();
        
      // Delete participant_evaluations
      await trx('participant_evaluations').where('participant_id', id).del();
      
      // Delete participant
      await trx('participants').where('id', id).del();
    });

    // Log deletion
    await db('audit_logs').insert({
      user_id: req.user.userId,
      action: 'delete_participant',
      entity_type: 'participant',
      entity_id: id,
      details: {
        name: `${demographicData.firstName || 'N/A'} ${demographicData.lastName || 'N/A'}`,
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

    // Check if participant exists and belongs to evaluator's companies
    const ownedIds = await getOwnedCompanyIds(req.user.userId);
    const participant = await db('participants')
      .join('participant_evaluations as pe', 'participants.id', 'pe.participant_id')
      .join('evaluations', 'pe.evaluation_id', 'evaluations.id')
      .where('participants.id', id)
      .whereIn('evaluations.company_id', ownedIds)
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
      evaluationUrl: `${getBaseUrl(req)}/participant/evaluation/${accessToken}`,
      expiresAt: tokenExpiresAt
    });

  } catch (error) {
    console.error('Generate token error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;