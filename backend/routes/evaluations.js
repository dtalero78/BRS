const express = require('express');
const router = express.Router();
const Joi = require('joi');
const { auth, authorize, getOwnedCompanyIds } = require('../middleware/auth');
const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const XLSX = require('xlsx');
const calculateResults = require('../utils/calculate-results');

// Multer config for Excel uploads (memory storage, max 10MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.mimetype === 'application/vnd.ms-excel' ||
        file.originalname.endsWith('.xlsx') || file.originalname.endsWith('.xls')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos Excel (.xlsx, .xls)'));
    }
  }
});

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
      .select(
        'evaluations.*',
        'companies.name as company_name',
        db.raw('(SELECT COUNT(*) FROM participant_evaluations pe WHERE pe.evaluation_id = evaluations.id) as total_participants'),
        db.raw("(SELECT COUNT(*) FROM participant_evaluations pe WHERE pe.evaluation_id = evaluations.id AND pe.status = 'completed') as completed_participants")
      );

    // Get total count
    const totalQuery = db('evaluations')
      .whereIn('company_id', companyIds)
      .count('* as count');

    if (status) {
      totalQuery.where('status', status);
    }

    const [{ count }] = await totalQuery;

    res.json({
      evaluations: evaluations.map(evaluation => {
        const total = parseInt(evaluation.total_participants) || 0;
        const completed = parseInt(evaluation.completed_participants) || 0;
        return {
          id: evaluation.id,
          companyId: evaluation.company_id,
          companyName: evaluation.company_name,
          name: evaluation.name,
          description: evaluation.description,
          startDate: evaluation.start_date,
          endDate: evaluation.end_date,
          status: evaluation.status,
          totalParticipants: total,
          completedParticipants: completed,
          progress: total > 0 ? Math.round((completed / total) * 100) : 0,
          createdAt: evaluation.created_at,
          updatedAt: evaluation.updated_at
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

    // Get participant counts from participant_evaluations
    const peCounts = await db('participant_evaluations')
      .where('evaluation_id', id)
      .select(
        db.raw('COUNT(*) as total'),
        db.raw("COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed")
      )
      .first();
    const total = parseInt(peCounts.total) || 0;
    const completed = parseInt(peCounts.completed) || 0;

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
      totalParticipants: total,
      completedParticipants: completed,
      progress: total > 0
        ? Math.round((completed / total) * 100)
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

    // Get participant counts from participant_evaluations
    const peCountsUpdate = await db('participant_evaluations')
      .where('evaluation_id', id)
      .select(
        db.raw('COUNT(*) as total'),
        db.raw("COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed")
      )
      .first();
    const totalUpdate = parseInt(peCountsUpdate.total) || 0;
    const completedUpdate = parseInt(peCountsUpdate.completed) || 0;

    res.json({
      id: evaluation.id,
      name: evaluation.name,
      description: evaluation.description,
      startDate: evaluation.start_date,
      endDate: evaluation.end_date,
      status: evaluation.status,
      totalParticipants: totalUpdate,
      completedParticipants: completedUpdate,
      progress: totalUpdate > 0
        ? Math.round((completedUpdate / totalUpdate) * 100)
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

// ============================================================
// IMPORT PARTICIPANTS FROM EXCEL
// ============================================================

/**
 * Maps Excel demographic columns to the ficha_datos questionnaire format.
 * The ficha_datos uses questionNumber-based responses that our report-data-aggregator reads.
 * Q2=sexo, Q3=año nacimiento, Q4=estudios, Q5=estado civil, Q9=dependientes, etc.
 */
function buildFichaFromExcelRow(row) {
  // row is array from Excel, cols 0-24 are sociodemographic
  // Map Excel columns to ficha_datos question numbers
  const fichaMap = {};

  // Q1: Fecha de aplicación (col 1)
  fichaMap['1'] = row[1] || '';
  // Q2: Sexo (col 5) - text value like "FEMENINO", "MASCULINO"
  fichaMap['2'] = row[5] || '';
  // Q3: Año de nacimiento (col 6)
  fichaMap['3'] = row[6] != null ? String(row[6]) : '';
  // Q4: Último nivel de estudios (col 8)
  fichaMap['4'] = row[8] || '';
  // Q5: Estado civil (col 7)
  fichaMap['5'] = row[7] || '';
  // Q6: Ocupación o profesión (col 9)
  fichaMap['6'] = row[9] || '';
  // Q7: Ciudad de residencia (col 10)
  fichaMap['7'] = row[10] || '';
  // Q8: Estrato (col 12)
  fichaMap['8'] = row[12] != null ? String(row[12]) : '';
  // Q9: Número de personas que dependen económicamente (col 14)
  fichaMap['9'] = row[14] != null ? String(row[14]) : '0';
  // Q10: Tipo de vivienda (col 13)
  fichaMap['10'] = row[13] || '';
  // Q11: Ciudad donde trabaja (col 15)
  fichaMap['11'] = row[15] || '';
  // Q12: Hace cuantos años que trabaja en esta empresa (col 17)
  fichaMap['12'] = row[17] || '';
  // Q13: Nombre del cargo (col 18)
  fichaMap['13'] = row[18] || '';
  // Q14: Tipo de cargo (col 19)
  fichaMap['14'] = row[19] || '';
  // Q15: Hace cuantos años desempeña el cargo (col 20)
  fichaMap['15'] = row[20] || '';
  // Q16: Departamento de la empresa (col 21)
  fichaMap['16'] = row[21] || '';
  // Q17: Tipo de contrato (col 22)
  fichaMap['17'] = row[22] || '';
  // Q18: Horas de trabajo diarias (col 23)
  fichaMap['18'] = row[23] != null ? String(row[23]) : '';

  return fichaMap;
}

/**
 * Determine the formType (A or B) based on the tipo de cargo field.
 * Forma A: Jefes, profesionales, técnicos
 * Forma B: Auxiliares, operarios
 */
function determineFormType(tipoCargo) {
  if (!tipoCargo) return 'B'; // default to B if unknown
  const upper = tipoCargo.toString().toUpperCase();
  if (upper.includes('JEFATURA') || upper.includes('PROFESIONAL') || upper.includes('TÉCNICO') || upper.includes('TECNICO')) {
    return 'A';
  }
  return 'B';
}

/**
 * Map gender text from Excel to our standard values.
 */
function mapGender(sexo) {
  if (!sexo) return 'Otro';
  const upper = sexo.toString().toUpperCase().trim();
  if (upper === 'FEMENINO' || upper === 'F') return 'Femenino';
  if (upper === 'MASCULINO' || upper === 'M') return 'Masculino';
  return 'Otro';
}

/**
 * Map marital status from Excel to our valid enum values.
 */
function mapMaritalStatus(status) {
  if (!status) return 'Soltero(a)';
  const upper = status.toString().toUpperCase().trim();
  if (upper.includes('SOLTERO')) return 'Soltero(a)';
  if (upper.includes('CASADO')) return 'Casado(a)';
  if (upper.includes('UNIÓN') || upper.includes('UNION')) return 'Unión libre';
  if (upper.includes('SEPARADO')) return 'Separado(a)';
  if (upper.includes('DIVORCIADO')) return 'Divorciado(a)';
  if (upper.includes('VIUDO')) return 'Viudo(a)';
  return 'Soltero(a)';
}

/**
 * Convert an Excel serial date number to a JS Date string (YYYY-MM-DD).
 */
function excelDateToString(serial) {
  if (!serial || typeof serial !== 'number') return new Date().toISOString().split('T')[0];
  // Excel epoch starts 1900-01-01, but has a leap year bug at 1900-02-29
  const utcDays = Math.floor(serial - 25569);
  const d = new Date(utcDays * 86400 * 1000);
  return d.toISOString().split('T')[0];
}

// POST /api/evaluations/:evaluationId/import-excel
router.post('/:evaluationId/import-excel', auth, authorize('admin', 'evaluator'), upload.single('file'), async (req, res) => {
  try {
    const { evaluationId } = req.params;

    // Validate evaluation exists and belongs to evaluator
    const companyIds = await getOwnedCompanyIds(req.user.userId);
    const evaluation = await db('evaluations')
      .where('id', evaluationId)
      .whereIn('company_id', companyIds)
      .first();

    if (!evaluation) {
      return res.status(404).json({ error: 'Evaluación no encontrada' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No se envió ningún archivo' });
    }

    // Parse Excel
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetNames = workbook.SheetNames;

    // Detect FA/FB sheets
    const sheets = {};
    for (const name of sheetNames) {
      const upper = name.toUpperCase().trim();
      if (upper.startsWith('FA')) sheets.FA = name;
      else if (upper.startsWith('FB')) sheets.FB = name;
    }

    if (!sheets.FA && !sheets.FB) {
      return res.status(400).json({
        error: 'El archivo Excel debe tener hojas llamadas "FA" (Forma A) y/o "FB" (Forma B)'
      });
    }

    // Column layout (based on analysis of the standard Excel format):
    // Cols 0-24: Sociodemographic (25 columns)
    // FA: Cols 25-147: Intralaboral A (123 items), Cols 148-178: Extralaboral (31), Cols 179-209: Estrés (31)
    // FB: Cols 25-121: Intralaboral B (97 items), Cols 122-152: Extralaboral (31), Cols 153-183: Estrés (31)
    const LAYOUT = {
      FA: { intraStart: 25, intraCount: 123, extraStart: 148, extraCount: 31, stressStart: 179, stressCount: 31, type: 'intralaboral_a' },
      FB: { intraStart: 25, intraCount: 97, extraStart: 122, extraCount: 31, stressStart: 153, stressCount: 31, type: 'intralaboral_b' }
    };

    const crypto = require('crypto');
    let totalCreated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    const errors = [];
    const created = [];

    // Pre-fetch existing participants and assignments in bulk (avoids per-row DB queries)
    const existingParticipants = await db('participants')
      .where('company_id', evaluation.company_id)
      .select('id', 'email');
    const participantsByEmail = {};
    existingParticipants.forEach(p => { participantsByEmail[p.email] = p; });

    const existingPEs = await db('participant_evaluations')
      .where('evaluation_id', evaluationId)
      .select('participant_id');
    const assignedParticipantIds = new Set(existingPEs.map(pe => pe.participant_id));

    // Collect all rows to process
    const rowsToProcess = [];

    for (const [formKey, sheetName] of Object.entries(sheets)) {
      const layout = LAYOUT[formKey];
      const ws = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

      for (let rowIdx = 2; rowIdx < data.length; rowIdx++) {
        const row = data[rowIdx];
        if (!row || row[0] === undefined || row[0] === '' || row[0] === null) continue;

        const rowNum = rowIdx + 1;
        const nombre = (row[3] || '').toString().trim();
        const docId = (row[2] || '').toString().trim();

        if (!nombre && !docId) {
          totalSkipped++;
          continue;
        }

        const documentNumber = docId || `IMPORT_${rowIdx}`;
        const email = `cc_${documentNumber}@temp.com`.toLowerCase();

        // Check if already assigned using pre-fetched data
        const existingP = participantsByEmail[email];
        if (existingP && assignedParticipantIds.has(existingP.id)) {
          totalSkipped++;
          continue;
        }

        rowsToProcess.push({ row, rowNum, nombre, docId, documentNumber, email, formKey, layout });
      }
    }

    // Process new participants in a single transaction with batch inserts
    if (rowsToProcess.length > 0) {
      await db.transaction(async (trx) => {
        // Batch: create all new participants at once
        const newParticipantInserts = [];
        const existingEmailSet = new Set(Object.keys(participantsByEmail));

        for (const item of rowsToProcess) {
          if (!existingEmailSet.has(item.email)) {
            const nameParts = item.nombre.split(' ');
            const firstName = nameParts.slice(0, Math.ceil(nameParts.length / 2)).join(' ') || item.nombre;
            const lastName = nameParts.slice(Math.ceil(nameParts.length / 2)).join(' ') || '';
            const formType = item.formKey === 'FA' ? 'A' : 'B';

            newParticipantInserts.push({
              company_id: evaluation.company_id,
              email: item.email,
              demographic_data: JSON.stringify({
                firstName, lastName,
                documentType: 'CC',
                documentNumber: item.documentNumber,
                birthYear: parseInt(item.row[6]) || 1990,
                gender: mapGender(item.row[5]),
                maritalStatus: mapMaritalStatus(item.row[7]),
                educationLevel: (item.row[8] || '').toString(),
                department: (item.row[4] || '').toString(),
                position: (item.row[18] || '').toString(),
                contractType: (item.row[22] || '').toString(),
                employmentType: (item.row[19] || '').toString(),
                tenureMonths: 0,
                salaryRange: (item.row[24] || '').toString(),
                workHoursPerDay: parseInt(item.row[23]) || 8,
                workDaysPerWeek: 5,
                formType
              }),
              active: true
            });
            existingEmailSet.add(item.email);
          }
        }

        if (newParticipantInserts.length > 0) {
          const inserted = await trx('participants').insert(newParticipantInserts).returning('*');
          inserted.forEach(p => { participantsByEmail[p.email] = p; });
        }

        // Batch: create all participant_evaluations at once
        const peInserts = rowsToProcess.map(item => ({
          evaluation_id: parseInt(evaluationId),
          participant_id: participantsByEmail[item.email].id,
          status: 'completed',
          assigned_at: new Date(),
          completed_at: new Date(),
          access_token: crypto.randomBytes(32).toString('hex'),
          token_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        }));

        const insertedPEs = await trx('participant_evaluations').insert(peInserts).returning('*');

        // Build a map from participant_id to pe.id
        const peByParticipantId = {};
        insertedPEs.forEach(pe => { peByParticipantId[pe.participant_id] = pe; });

        // Batch: build all responses and results, then insert in bulk
        const allResponseInserts = [];
        const allResultInserts = [];

        for (const item of rowsToProcess) {
          const participant = participantsByEmail[item.email];
          const pe = peByParticipantId[participant.id];
          if (!pe) continue;

          const { row, layout, formKey } = item;
          const formType = formKey === 'FA' ? 'A' : 'B';
          const occupationalGroup = formType === 'B' ? 'auxiliares' : 'jefes';

          try {
            // Ficha de datos
            allResponseInserts.push({
              participant_evaluation_id: pe.id,
              questionnaire_type: 'ficha_datos',
              responses: JSON.stringify(buildFichaFromExcelRow(row)),
              completed_at: new Date()
            });

            // Intralaboral (Excel: Siempre=0..Nunca=4 → BRS: Siempre=4..Nunca=0)
            const intraResponses = {};
            for (let i = 0; i < layout.intraCount; i++) {
              const val = row[layout.intraStart + i];
              if (val !== undefined && val !== null && val !== '') {
                intraResponses[String(i + 1)] = 4 - (parseInt(val) || 0);
              }
            }
            allResponseInserts.push({
              participant_evaluation_id: pe.id,
              questionnaire_type: layout.type,
              responses: JSON.stringify(intraResponses),
              completed_at: new Date()
            });

            // Extralaboral (Excel: Siempre=0..Nunca=4 → BRS: Siempre=4..Nunca=0)
            const extraResponses = {};
            for (let i = 0; i < layout.extraCount; i++) {
              const val = row[layout.extraStart + i];
              if (val !== undefined && val !== null && val !== '') {
                extraResponses[String(i + 1)] = 4 - (parseInt(val) || 0);
              }
            }
            allResponseInserts.push({
              participant_evaluation_id: pe.id,
              questionnaire_type: 'extralaboral',
              responses: JSON.stringify(extraResponses),
              completed_at: new Date()
            });

            // Estrés (Excel: Siempre=0..Nunca=3 → BRS: Siempre=3..Nunca=0)
            const stressResponses = {};
            for (let i = 0; i < layout.stressCount; i++) {
              const val = row[layout.stressStart + i];
              if (val !== undefined && val !== null && val !== '') {
                stressResponses[String(i + 1)] = 3 - (parseInt(val) || 0);
              }
            }
            allResponseInserts.push({
              participant_evaluation_id: pe.id,
              questionnaire_type: 'estres',
              responses: JSON.stringify(stressResponses),
              completed_at: new Date()
            });

            // Calculate results (CPU-only, no DB)
            const allResults = [];
            const intraFormatted = Object.entries(intraResponses).map(([qn, rv]) => ({
              question_number: parseInt(qn), response_value: parseInt(rv)
            }));
            if (intraFormatted.length > 0) {
              const r = await calculateResults(layout.type, intraFormatted, { occupationalGroup });
              allResults.push(...r);
            }
            const extraFormatted = Object.entries(extraResponses).map(([qn, rv]) => ({
              question_number: parseInt(qn), response_value: parseInt(rv)
            }));
            if (extraFormatted.length > 0) {
              const r = await calculateResults('extralaboral', extraFormatted, { occupationalGroup });
              allResults.push(...r);
            }
            const stressFormatted = Object.entries(stressResponses).map(([qn, rv]) => ({
              question_number: parseInt(qn), response_value: parseInt(rv)
            }));
            if (stressFormatted.length > 0) {
              const r = await calculateResults('estres', stressFormatted, { occupationalGroup });
              allResults.push(...r);
            }

            // Group results by type
            const resultsByType = {};
            allResults.forEach(r => {
              if (!resultsByType[r.questionnaireType]) resultsByType[r.questionnaireType] = [];
              resultsByType[r.questionnaireType].push({
                dimension: r.dimension, rawScore: r.rawScore,
                transformedScore: r.transformedScore, percentile: r.percentile, riskLevel: r.riskLevel
              });
            });
            Object.entries(resultsByType).forEach(([qt, typeResults]) => {
              allResultInserts.push({
                participant_evaluation_id: pe.id,
                questionnaire_type: qt,
                results: JSON.stringify(typeResults),
                calculated_at: new Date()
              });
            });

            totalCreated++;
            created.push({ row: item.rowNum, name: item.nombre, form: formKey });
          } catch (err) {
            totalErrors++;
            errors.push({ row: item.rowNum, name: item.nombre, error: err.message });
            console.error(`Import error row ${item.rowNum} (${item.nombre}):`, err.message);
          }
        }

        // Batch insert all responses (in chunks of 100 to avoid query size limits)
        for (let i = 0; i < allResponseInserts.length; i += 100) {
          await trx('responses').insert(allResponseInserts.slice(i, i + 100));
        }
        for (let i = 0; i < allResultInserts.length; i += 100) {
          await trx('results').insert(allResultInserts.slice(i, i + 100));
        }
      });
    }

    // Log the import
    await db('audit_logs').insert({
      user_id: req.user.userId,
      action: 'import_excel',
      table_name: 'evaluations',
      record_id: parseInt(evaluationId),
      new_values: JSON.stringify({ totalCreated, totalSkipped, totalErrors, fileName: req.file.originalname })
    });

    res.json({
      message: `Importación completada: ${totalCreated} participantes creados, ${totalSkipped} omitidos, ${totalErrors} errores`,
      totalCreated,
      totalSkipped,
      totalErrors,
      errors: errors.slice(0, 20),
      created: created.slice(0, 20)
    });

  } catch (error) {
    console.error('Import Excel error:', error);
    if (error.message && error.message.includes('Solo se permiten archivos Excel')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Error al importar archivo Excel: ' + error.message });
  }
});

module.exports = router;