const express = require('express');
const router = express.Router();
const Joi = require('joi');
const { auth, authorize, getOwnedCompanyIds } = require('../middleware/auth');
const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const XLSX = require('xlsx');
const calculateResults = require('../utils/calculate-results');
const excelDetector = require('../utils/excel-import-detector');

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
          paid: !!evaluation.paid,
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

    // Get participants a través de participant_evaluations (los participantes
    // se vinculan a la evaluación por esta tabla, no por una columna directa)
    const participants = await db('participant_evaluations as pe')
      .join('participants as p', 'p.id', 'pe.participant_id')
      .where('pe.evaluation_id', id)
      .select(
        'pe.id as participant_evaluation_id',
        'p.id as participant_id',
        'p.email',
        'p.demographic_data',
        'pe.status',
        'pe.assigned_at',
        'pe.completed_at'
      );

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
        id: p.participant_id,
        participantEvaluationId: p.participant_evaluation_id,
        email: p.email,
        demographicData: p.demographic_data,
        status: p.status,
        assignedAt: p.assigned_at,
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
router.delete('/:id', auth, authorize('admin', 'evaluator'), async (req, res) => {
  try {
    const { id } = req.params;

    // Admin can delete any evaluation; evaluator only their own companies' evaluations
    const baseQuery = db('evaluations').where('id', id);
    if (req.user.role !== 'admin') {
      const ownedIds = await getOwnedCompanyIds(req.user.userId);
      baseQuery.whereIn('company_id', ownedIds);
    }
    const evaluation = await baseQuery.first();

    if (!evaluation) {
      return res.status(404).json({ error: 'Evaluación no encontrada' });
    }

    // Block deletion if any participant has already submitted responses
    const completedRow = await db('responses')
      .join('participant_evaluations', 'responses.participant_evaluation_id', 'participant_evaluations.id')
      .where('participant_evaluations.evaluation_id', id)
      .count('* as count')
      .first();

    if (parseInt(completedRow.count) > 0) {
      return res.status(400).json({
        error: 'No se puede eliminar una evaluación con respuestas registradas. Considera cambiar el estado a "cancelada".'
      });
    }

    // FK cascade removes participant_evaluations, responses and results
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
/**
 * Build ficha_datos from an Excel row using a detected sociodemographic layout.
 * socio is { fieldName: colIndex } from excelDetector.detectLayout().
 */
function buildFichaFromExcelRow(row, socio) {
  const get = (field) => {
    const c = socio[field];
    if (c === undefined || row[c] == null) return '';
    return String(row[c]);
  };

  return {
    '1':  get('fecha'),
    '2':  get('sexo'),
    '3':  get('birthYear'),
    '4':  get('education'),
    '5':  get('maritalStatus'),
    '6':  get('ocupacion'),
    '7':  get('ciudadResidencia'),
    '8':  get('estrato'),
    '9':  get('dependientes') || '0',
    '10': get('tipoVivienda'),
    '11': get('ciudadTrabajo'),
    '12': get('anosEmpresa'),
    '13': get('cargo'),
    '14': get('tipoCargo'),
    '15': get('anosCargo'),
    '16': get('departamento'),
    '17': get('tipoContrato'),
    '18': get('horasTrabajo'),
  };
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
 * Parse the uploaded Excel buffer and detect FA/FB sheets with their layouts.
 * Shared between the preview and import endpoints.
 *
 * Returns { sheets: { FA?: { name, data, headerRow, layout }, FB?: {...} }, error? }
 */
function parseAndDetect(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetNames = workbook.SheetNames;

  const detected = {};
  for (const name of sheetNames) {
    const upper = name.toUpperCase().trim();
    let key = null;
    if (upper.startsWith('FA')) key = 'FA';
    else if (upper.startsWith('FB')) key = 'FB';
    if (!key || detected[key]) continue;

    const data = XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1 });
    const headerRow = excelDetector.findHeaderRow(data);
    const banners = excelDetector.detectSectionBanners(data, headerRow);
    const layout = excelDetector.detectLayout(data[headerRow] || [], banners);
    detected[key] = { name, data, headerRow, layout };
  }

  if (!detected.FA && !detected.FB) {
    return { error: 'El archivo Excel debe tener hojas llamadas "FA" (Forma A) y/o "FB" (Forma B)' };
  }
  return { sheets: detected };
}

// Intralaboral questionnaire type per form
const INTRA_TYPE = { FA: 'intralaboral_a', FB: 'intralaboral_b' };
// Expected item counts for BRS
const EXPECTED_ITEMS = {
  FA: { intra: 123, extra: 31, stress: 31 },
  FB: { intra: 97,  extra: 31, stress: 31 },
};

// POST /api/evaluations/:evaluationId/preview-excel
// Returns what the importer detected without persisting anything. Lets the
// user verify column mappings and sample data before committing.
router.post('/:evaluationId/preview-excel', auth, authorize('admin', 'evaluator'), upload.single('file'), async (req, res) => {
  try {
    const { evaluationId } = req.params;

    const companyIds = await getOwnedCompanyIds(req.user.userId);
    const evaluation = await db('evaluations')
      .where('id', evaluationId)
      .whereIn('company_id', companyIds)
      .first();

    if (!evaluation) return res.status(404).json({ error: 'Evaluación no encontrada' });
    if (!req.file)   return res.status(400).json({ error: 'No se envió ningún archivo' });

    const parsed = parseAndDetect(req.file.buffer);
    if (parsed.error) return res.status(400).json({ error: parsed.error });

    const existingPEs = await db('participant_evaluations')
      .where('evaluation_id', evaluationId)
      .join('participants', 'participant_evaluations.participant_id', 'participants.id')
      .select('participants.email');
    const assignedEmails = new Set(existingPEs.map(r => r.email));

    const previews = [];
    for (const [formKey, sheet] of Object.entries(parsed.sheets)) {
      const { data, layout, headerRow, name } = sheet;
      const preview = excelDetector.buildPreview(data, layout, formKey, 5, headerRow);
      preview.sheetName = name;
      preview.expected = EXPECTED_ITEMS[formKey];

      // Items missing vs. expected (help user spot gaps in their Excel)
      const missingIntra = [];
      for (let i = 1; i <= preview.expected.intra; i++) {
        if (layout.intra[i] === undefined) missingIntra.push(i);
      }
      preview.missingIntraItems = missingIntra;

      // How many rows are new vs. already assigned
      let newRows = 0;
      let dupRows = 0;
      const docCol = layout.socio.documento;
      for (let r = headerRow + 1; r < data.length; r++) {
        const row = data[r];
        if (!row) continue;
        const doc = docCol !== undefined ? String(row[docCol] || '').trim() : '';
        const nameVal = layout.socio.nombre !== undefined ? String(row[layout.socio.nombre] || '').trim() : '';
        if (!doc && !nameVal) continue;
        const docNumber = doc || `IMPORT_${r}`;
        const canonicalEmail = `cc_${docNumber}@temp.com`.toLowerCase();
        const suffixedEmail  = `cc_${docNumber}_c${evaluation.company_id}@temp.com`.toLowerCase();
        if (assignedEmails.has(canonicalEmail) || assignedEmails.has(suffixedEmail)) dupRows++; else newRows++;
      }
      preview.newRows = newRows;
      preview.duplicateRows = dupRows;

      previews.push(preview);
    }

    res.json({ previews });
  } catch (error) {
    console.error('Preview Excel error:', error);
    if (error.message && error.message.includes('Solo se permiten archivos Excel')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Error al analizar archivo Excel: ' + error.message });
  }
});

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

    if (!evaluation) return res.status(404).json({ error: 'Evaluación no encontrada' });
    if (!req.file)   return res.status(400).json({ error: 'No se envió ningún archivo' });

    const parsed = parseAndDetect(req.file.buffer);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const sheets = parsed.sheets;

    const crypto = require('crypto');
    // Dirección de la escala numérica del Excel. 'inverted' (default) = formato
    // oficial del Ministerio (Siempre=0). 'direct' para Excels ya en escala BRS
    // (Siempre=4). Los números 0-4 no se pueden auto-detectar; el evaluador la
    // declara explícitamente para no importar los resultados al revés.
    const numericScale = (req.body && req.body.numericScale === 'direct') ? 'direct' : 'inverted';
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

    for (const [formKey, sheet] of Object.entries(sheets)) {
      const { data, layout, headerRow } = sheet;
      const socio = layout.socio;
      const docCol = socio.documento;
      const nameCol = socio.nombre;

      for (let rowIdx = headerRow + 1; rowIdx < data.length; rowIdx++) {
        const row = data[rowIdx];
        if (!row) continue;

        const rowNum = rowIdx + 1;
        const docId = docCol !== undefined ? String(row[docCol] || '').trim() : '';
        const nombre = nameCol !== undefined ? String(row[nameCol] || '').trim() : '';

        if (!nombre && !docId) continue;

        const documentNumber = docId || `IMPORT_${rowIdx}`;
        // After migration 20260420000001 the unique constraint on
        // participants.email is scoped to (company_id, email), so the
        // simple cc_<doc>@temp.com format is safe again. We still check
        // the company-suffixed format to find participants created by
        // the previous workaround and reuse them.
        const canonicalEmail = `cc_${documentNumber}@temp.com`.toLowerCase();
        const suffixedEmail  = `cc_${documentNumber}_c${evaluation.company_id}@temp.com`.toLowerCase();
        const existingP = participantsByEmail[canonicalEmail] || participantsByEmail[suffixedEmail];
        const email = existingP ? existingP.email : canonicalEmail;

        // Check if already assigned using pre-fetched data
        if (existingP && assignedParticipantIds.has(existingP.id)) {
          totalSkipped++;
          continue;
        }

        rowsToProcess.push({ row, rowNum, nombre, docId, documentNumber, email, formKey, layout });
      }
    }

    // Dedupe por email dentro del archivo: un documento repetido (misma persona en
    // dos filas, o presente en FA y FB) genera dos filas con el mismo email. Sin
    // dedup, el insert de participant_evaluations produce dos PE con el mismo
    // participant_id → viola UNIQUE(evaluation_id, participant_id) y tumbaba TODA
    // la importación con 500. Nos quedamos con la primera y omitimos las demás.
    {
      const seenEmails = new Set();
      const duplicates = [];
      const dedupedRows = rowsToProcess.filter(item => {
        if (seenEmails.has(item.email)) { duplicates.push(item); return false; }
        seenEmails.add(item.email);
        return true;
      });
      if (duplicates.length > 0) {
        totalSkipped += duplicates.length;
        duplicates.forEach(item => {
          errors.push(`Fila ${item.rowNum}: documento ${item.documentNumber} duplicado en el archivo, se omitió (ya procesado en una fila anterior)`);
        });
        rowsToProcess.length = 0;
        rowsToProcess.push(...dedupedRows);
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
            const socio = item.layout.socio;
            const get = (field) => {
              const c = socio[field];
              return c !== undefined && item.row[c] != null ? String(item.row[c]) : '';
            };

            newParticipantInserts.push({
              company_id: evaluation.company_id,
              email: item.email,
              demographic_data: JSON.stringify({
                firstName, lastName,
                documentType: 'CC',
                documentNumber: item.documentNumber,
                birthYear: excelDetector.parseExcelYear(socio.birthYear !== undefined ? item.row[socio.birthYear] : null) || 1990,
                gender: mapGender(get('sexo')),
                maritalStatus: mapMaritalStatus(get('maritalStatus')),
                educationLevel: get('education'),
                department: get('departamento'),
                position: get('cargo'),
                contractType: get('tipoContrato'),
                employmentType: get('tipoCargo'),
                tenureMonths: 0,
                salaryRange: get('tipoSalario'),
                workHoursPerDay: parseInt(get('horasTrabajo')) || 8,
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
            const intraType = INTRA_TYPE[formKey];

            // Ficha de datos
            allResponseInserts.push({
              participant_evaluation_id: pe.id,
              questionnaire_type: 'ficha_datos',
              responses: JSON.stringify(buildFichaFromExcelRow(row, layout.socio)),
              completed_at: new Date()
            });

            // Build response maps by looking up each item's column in the detected layout
            // and converting whatever is there (numeric 0-4 or text "Siempre"..."Nunca")
            // to the BRS-scaled numeric value.
            const collectResponses = (itemMap, scale) => {
              const out = {};
              for (const [itemNumStr, col] of Object.entries(itemMap)) {
                const val = row[col];
                const parsed = excelDetector.parseResponseValue(val, scale, numericScale);
                if (parsed !== null) out[itemNumStr] = parsed;
              }
              return out;
            };

            const intraResponses  = collectResponses(layout.intra,  'intra');
            const extraResponses  = collectResponses(layout.extra,  'intra');
            const stressResponses = collectResponses(layout.stress, 'stress');

            allResponseInserts.push({
              participant_evaluation_id: pe.id,
              questionnaire_type: intraType,
              responses: JSON.stringify(intraResponses),
              completed_at: new Date()
            });
            allResponseInserts.push({
              participant_evaluation_id: pe.id,
              questionnaire_type: 'extralaboral',
              responses: JSON.stringify(extraResponses),
              completed_at: new Date()
            });
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
              const r = await calculateResults(intraType, intraFormatted, { occupationalGroup });
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