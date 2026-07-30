const express = require('express');
const router = express.Router();
const Joi = require('joi');
const { auth, authorize, getOwnedCompanyIds, isSuperAdmin } = require('../middleware/auth');
const db = require('../config/database');
const multer = require('multer');
const XLSX = require('xlsx');
const whatsappSender = require('../services/whatsapp-sender');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  // Solo aceptar archivos Excel (.xlsx/.xls) por extensión o mimetype.
  // Mitiga subida de tipos arbitrarios hacia el parser XLSX.
  fileFilter: (req, file, cb) => {
    const name = (file.originalname || '').toLowerCase();
    const validExt = name.endsWith('.xlsx') || name.endsWith('.xls');
    const excelMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ];
    if (validExt || excelMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido. Solo se aceptan archivos Excel (.xlsx, .xls)'));
    }
  }
});

// Helper to get the base URL for participant evaluation links
function getBaseUrl(req) {
  if (process.env.FRONTEND_URL) return process.env.FRONTEND_URL;
  const protocol = req.get('x-forwarded-proto') || req.protocol;
  const host = req.get('x-forwarded-host') || req.get('host');
  return `${protocol}://${host}`;
}

// Valida que un parámetro de ruta sea un entero positivo (evita 500 opacos de Postgres)
function isValidId(value) {
  return /^\d+$/.test(String(value));
}

// Normaliza page/limit: enteros positivos, con limit acotado a un máximo razonable
function parsePagination(query, defaultLimit = 50, maxLimit = 200) {
  let page = parseInt(query.page, 10);
  let limit = parseInt(query.limit, 10);
  if (!Number.isInteger(page) || page < 1) page = 1;
  if (!Number.isInteger(limit) || limit < 1) limit = defaultLimit;
  if (limit > maxLimit) limit = maxLimit;
  return { page, limit, offset: (page - 1) * limit };
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
  formType: Joi.string().valid('A', 'B').required(),
  phone: Joi.string().allow('').optional()
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
        formType: participantData.formType,
        phone: participantData.phone || ''
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
      const existingDemo = typeof participant.demographic_data === 'string'
        ? JSON.parse(participant.demographic_data)
        : (participant.demographic_data || {});
      const fullName = `${existingDemo.firstName || ''} ${existingDemo.lastName || ''}`.trim() || participant.email;
      return res.status(409).json({
        error: `${fullName} (${existingDemo.documentType || ''} ${existingDemo.documentNumber || ''}) ya está asignado a esta evaluación`,
        code: 'PARTICIPANT_ALREADY_ASSIGNED',
        existingParticipant: {
          id: participant.id,
          firstName: existingDemo.firstName || '',
          lastName: existingDemo.lastName || '',
          documentType: existingDemo.documentType || '',
          documentNumber: existingDemo.documentNumber || '',
          email: participant.email,
          evaluationId: evaluationId
        }
      });
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
    const { status, evaluationId } = req.query;
    const { page, limit, offset } = parsePagination(req.query, 50, 200);

    const companyIds = await getOwnedCompanyIds(req.user.userId);
    const superAdmin = isSuperAdmin(req.user);

    // Determinar el tipo de JOIN basado en los filtros
    const joinType = (status || evaluationId) ? 'join' : 'leftJoin';

    let query = db('participants')
      [joinType]('participant_evaluations as pe', 'participants.id', 'pe.participant_id')
      [joinType]('evaluations', 'pe.evaluation_id', 'evaluations.id')
      .leftJoin('companies', 'participants.company_id', 'companies.id')
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
        'evaluations.paid as evaluation_paid',
        'pe.status as evaluation_status',
        'pe.assigned_at',
        'pe.completed_at',
        'pe.access_token',
        'companies.name as company_name'
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
          const requiredTypes = formType === 'A'
            ? ['intralaboral_a', 'extralaboral', 'estres']
            : ['intralaboral_b', 'extralaboral', 'estres'];

          const completedTypes = responses.map(r => r.questionnaire_type);
          const completedRequired = requiredTypes.filter(t => completedTypes.includes(t)).length;
          completionPercentage = Math.round((completedRequired / requiredTypes.length) * 100);
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
        phone: demographicData.phone || '',
        evaluationId: p.evaluation_id,
        evaluationName: p.evaluation_name,
        evaluationPaid: superAdmin ? true : !!p.evaluation_paid,
        companyName: p.company_name || '',
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
    if (!isValidId(evaluationId)) {
      return res.status(400).json({ error: 'ID de evaluación inválido' });
    }
    const { status } = req.query;
    const { page, limit, offset } = parsePagination(req.query, 1000, 1000);

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
      .select('participant_evaluation_id', 'questionnaire_type', 'results');

    // Group responses and results by participant_evaluation_id
    const responsesByParticipant = {};
    const resultsByParticipant = {};
    const overallRiskByParticipant = {};

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

      // Extract overall risk level from intralaboral results (puntaje_total)
      try {
        const parsed = typeof result.results === 'string' ? JSON.parse(result.results) : (result.results || []);
        for (const dim of parsed) {
          if (dim.dimension && dim.dimension.startsWith('puntaje_total_intralaboral')) {
            overallRiskByParticipant[result.participant_evaluation_id] = dim.riskLevel;
          }
        }
      } catch (e) {}
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
          overall_risk_level: overallRiskByParticipant[p.pe_id] || null,
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

// ─── Excel Import ────────────────────────────────────────────────────────────

const FIELD_KEYWORDS = {
  documentType:    [/tipo.*(doc|cc|c[eé]dula)/i, /tipo documento/i],
  documentNumber:  [/n[uú]mero.*(doc|cc)/i, /n[uú]m.*doc/i, /no.*doc/i, /^c[eé]dula$/i, /^cc$/i, /^documento$/i, /^n[uú]mero$/i],
  firstName:       [/^nombres?$/i, /first.*name/i],
  lastName:        [/^apellidos?$/i, /last.*name/i],
  birthYear:       [/a[ñn]o.*nac/i, /nacimiento/i, /birth/i],
  gender:          [/^g[eé]nero$/i, /^sexo$/i, /sex$/i],
  maritalStatus:   [/estado.*civil/i, /civil/i, /marital/i],
  educationLevel:  [/nivel.*educ/i, /educac/i, /escolar/i, /estudio/i],
  department:      [/^[aá]rea$/i, /departamento/i, /department/i],
  position:        [/^cargo$/i, /^puesto$/i, /^rol$/i, /position/i],
  contractType:    [/tipo.*contrato/i, /contrato/i],
  employmentType:  [/tipo.*empleo/i, /tipo.*vinc/i, /vinculaci/i],
  tenureMonths:    [/meses/i, /antig[uü]edad/i, /tenure/i],
  salaryRange:     [/salario/i, /sueldo/i, /rango.*sal/i, /salary/i],
  workHoursPerDay: [/horas.*(d[ií]a|day)/i, /horas\/d/i],
  workDaysPerWeek: [/d[ií]as.*semana/i, /d[ií]as\/sem/i],
  formType:        [/^forma$/i, /^formulario$/i, /^form$/i, /tipo.*forma/i],
  phone:           [/tel[eé]fono/i, /celular/i, /m[oó]vil/i, /^tel$/i, /^phone$/i, /whatsapp/i],
};

function detectColumn(header) {
  const h = String(header).trim();
  for (const [field, patterns] of Object.entries(FIELD_KEYWORDS)) {
    if (patterns.some(p => p.test(h))) return field;
  }
  return null;
}

function normalizeGender(v) {
  const u = String(v).trim().toUpperCase();
  if (u === 'M' || /^MAS|^HOM/i.test(u)) return 'Masculino';
  if (u === 'F' || /^FEM|^MUJ/i.test(u)) return 'Femenino';
  return 'Otro';
}
function normalizeMaritalStatus(v) {
  const l = String(v).trim().toLowerCase();
  if (/cas/.test(l)) return 'Casado(a)';
  if (/uni|libre|convi/.test(l)) return 'Unión libre';
  if (/sep/.test(l)) return 'Separado(a)';
  if (/div/.test(l)) return 'Divorciado(a)';
  if (/viu/.test(l)) return 'Viudo(a)';
  return 'Soltero(a)';
}
function normalizeEducation(v) {
  const l = String(v).trim().toLowerCase();
  if (/doc/.test(l)) return 'Doctorado';
  if (/maes|master/.test(l)) return 'Maestría';
  if (/espec|posg/.test(l)) return 'Especialización';
  if (/univ|prof|licenc/.test(l)) return 'Universitario';
  if (/tecno.*log/.test(l)) return 'Tecnólogo';
  if (/tecn/.test(l)) return 'Técnico';
  if (/bach|secu|media/.test(l)) return 'Bachiller';
  if (/prim/.test(l)) return 'Primaria';
  return String(v).trim() || 'Bachiller';
}
function normalizeContract(v) {
  const l = String(v).trim().toLowerCase();
  if (/indef/.test(l)) return 'Indefinido';
  if (/fijo/.test(l)) return 'Fijo';
  if (/prest|servic|honor/.test(l)) return 'Prestación de servicios';
  if (/aprendiz|sena|pasant/.test(l)) return 'Aprendizaje';
  return 'Otro';
}

router.get('/import-excel/template', (req, res) => {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ['Tipo Documento','Número Documento','Nombres','Apellidos','Año Nacimiento','Género','Estado Civil','Nivel Educativo','Área/Departamento','Cargo','Tipo Contrato','Tipo Empleo','Meses en Cargo','Rango Salarial','Horas/Día','Días/Semana','Forma (A/B)','Teléfono/Celular'],
    ['CC','10234567','Juan','Pérez García','1990','Masculino','Soltero(a)','Universitario','Administración','Coordinador','Indefinido','Tiempo completo','24','3-Entre 2 y 3 SM','8','5','A','3001234567'],
    ['CC','98765432','María','López Torres','1985','Femenino','Casado(a)','Técnico','Operaciones','Auxiliar','Fijo','Tiempo completo','12','2-Entre 1 y 2 SM','8','5','B','3109876543'],
  ]);
  ws['!cols'] = Array(18).fill({ wch: 20 });
  XLSX.utils.book_append_sheet(wb, ws, 'Participantes');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename="plantilla_participantes.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
});

router.post('/import-excel', auth, authorize('admin', 'evaluator'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se recibió archivo' });
    const { evaluationId } = req.body;
    if (!evaluationId) return res.status(400).json({ error: 'evaluationId es requerido' });

    const companyIds = await getOwnedCompanyIds(req.user.userId);
    const evaluation = await db('evaluations')
      .where('id', evaluationId)
      .whereIn('company_id', companyIds)
      .first();
    if (!evaluation) return res.status(404).json({ error: 'Evaluación no encontrada' });

    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    if (rows.length < 2) return res.status(400).json({ error: 'El archivo no tiene datos' });

    // Map headers to fields
    const headers = rows[0];
    const colMap = {};
    headers.forEach((h, i) => {
      const field = detectColumn(h);
      if (field && !(field in colMap)) colMap[field] = i;
    });

    if (!colMap.documentNumber) {
      return res.status(400).json({ error: 'No se encontró columna de número de documento. Revisa la plantilla.' });
    }

    const results = { created: 0, skipped: 0, errors: [] };

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const docNum = String(row[colMap.documentNumber] ?? '').trim();
      if (!docNum) continue;

      try {
        const docType = colMap.documentType !== undefined
          ? (() => { const v = String(row[colMap.documentType]).trim().toUpperCase(); return v.includes('EX') || v === 'CE' ? 'CE' : v.includes('PAS') ? 'Pasaporte' : 'CC'; })()
          : 'CC';
        const firstName   = colMap.firstName   !== undefined ? String(row[colMap.firstName]).trim()   : 'Sin nombre';
        const lastName    = colMap.lastName    !== undefined ? String(row[colMap.lastName]).trim()    : 'Sin apellido';
        const birthYear   = colMap.birthYear   !== undefined ? parseInt(row[colMap.birthYear]) || 1990 : 1990;
        const gender      = colMap.gender      !== undefined ? normalizeGender(row[colMap.gender])   : 'Masculino';
        const maritalStatus    = colMap.maritalStatus    !== undefined ? normalizeMaritalStatus(row[colMap.maritalStatus])    : 'Soltero(a)';
        const educationLevel   = colMap.educationLevel   !== undefined ? normalizeEducation(row[colMap.educationLevel])      : 'Bachiller';
        const department       = colMap.department       !== undefined ? String(row[colMap.department]).trim()               : 'General';
        const position         = colMap.position         !== undefined ? String(row[colMap.position]).trim()                 : 'Empleado';
        const contractType     = colMap.contractType     !== undefined ? normalizeContract(row[colMap.contractType])         : 'Indefinido';
        const employmentType   = colMap.employmentType   !== undefined ? String(row[colMap.employmentType]).trim() || 'Tiempo completo' : 'Tiempo completo';
        const tenureMonths     = colMap.tenureMonths     !== undefined ? parseInt(row[colMap.tenureMonths]) || 0              : 0;
        const salaryRange      = colMap.salaryRange      !== undefined ? String(row[colMap.salaryRange]).trim()               : '';
        const workHoursPerDay  = colMap.workHoursPerDay  !== undefined ? parseInt(row[colMap.workHoursPerDay]) || 8           : 8;
        const workDaysPerWeek  = colMap.workDaysPerWeek  !== undefined ? parseInt(row[colMap.workDaysPerWeek]) || 5           : 5;
        const formType         = colMap.formType         !== undefined ? (String(row[colMap.formType]).trim().toUpperCase() === 'B' ? 'B' : 'A') : 'A';

        const email = `cc_${docNum}@temp.com`.toLowerCase();
        const phone = colMap.phone !== undefined ? String(row[colMap.phone] ?? '').trim() : '';
        const demographicData = { firstName, lastName, documentType: docType, documentNumber: docNum, birthYear, gender, maritalStatus, educationLevel, department, position, contractType, employmentType, tenureMonths, salaryRange, workHoursPerDay, workDaysPerWeek, formType, phone };

        // Upsert participant
        let participant = await db('participants').where({ company_id: evaluation.company_id, email }).first();
        if (!participant) {
          [participant] = await db('participants').insert({ company_id: evaluation.company_id, email, demographic_data: JSON.stringify(demographicData) }).returning('*');
        } else {
          await db('participants').where('id', participant.id).update({ demographic_data: JSON.stringify(demographicData), updated_at: new Date() });
        }

        // Assign to evaluation if not already assigned
        const existing = await db('participant_evaluations').where({ evaluation_id: evaluationId, participant_id: participant.id }).first();
        if (!existing) {
          const { v4: uuidv4 } = require('uuid');
          const accessToken = uuidv4();
          const tokenExpiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
          await db('participant_evaluations').insert({ evaluation_id: evaluationId, participant_id: participant.id, status: 'assigned', assigned_at: new Date(), access_token: accessToken, token_expires_at: tokenExpiresAt });
          results.created++;
        } else {
          results.skipped++;
        }
      } catch (rowErr) {
        results.errors.push({ row: r + 1, error: rowErr.message });
      }
    }

    res.json({ message: 'Importación completada', ...results });
  } catch (error) {
    console.error('Import participants excel error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

// Get participant by ID
// Le dice al frontend si mostrar el boton de envio masivo.
// OJO: va ANTES de '/:id' o Express lo captura como si 'whatsapp-status'
// fuera el id de un participante y nunca llega aqui.
router.get('/whatsapp-status', auth, authorize('admin', 'evaluator'), (req, res) => {
  res.json({ enabled: whatsappSender.isConfigured(), from: whatsappSender.WHATSAPP_FROM || null });
});

router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

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
    if (!isValidId(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

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
      table_name: 'participants',
      record_id: id,
      new_values: { updatedFields: Object.keys(req.body) }
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
router.delete('/:id', auth, authorize('admin', 'evaluator'), async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    // Admins can delete any participant; evaluators only their own companies'.
    const query = db('participants')
      .leftJoin('participant_evaluations as pe', 'participants.id', 'pe.participant_id')
      .where('participants.id', id)
      .select('participants.*', 'pe.evaluation_id', 'pe.status as evaluation_status');

    if (req.user.role !== 'admin') {
      const ownedIds = await getOwnedCompanyIds(req.user.userId);
      query.whereIn('participants.company_id', ownedIds);
    }

    const participant = await query.first();

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

    // Log deletion (best-effort: la operación principal ya se commiteó,
    // un fallo del audit_log no debe propagar un 500 al usuario)
    try {
      await db('audit_logs').insert({
        user_id: req.user.userId,
        action: 'delete_participant',
        table_name: 'participants',
        record_id: id,
        old_values: {
          name: `${demographicData.firstName || 'N/A'} ${demographicData.lastName || 'N/A'}`,
          evaluationId: participant.evaluation_id
        }
      });
    } catch (auditError) {
      console.error('Audit log (delete_participant) failed:', auditError);
    }

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
    if (!isValidId(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    // Check if participant exists and belongs to evaluator's companies
    const ownedIds = await getOwnedCompanyIds(req.user.userId);
    const participant = await db('participants')
      .join('participant_evaluations as pe', 'participants.id', 'pe.participant_id')
      .join('evaluations', 'pe.evaluation_id', 'evaluations.id')
      .where('participants.id', id)
      .whereIn('evaluations.company_id', ownedIds)
      .select('participants.*', 'pe.id as pe_id', 'pe.access_token', 'pe.token_expires_at')
      .first();

    if (!participant) {
      return res.status(404).json({ error: 'Participante no encontrado' });
    }

    let accessToken = participant.access_token;
    // Al reusar un token existente, devolver su expiración real (no una recalculada)
    let tokenExpiresAt = participant.token_expires_at;

    // Generate new token if none exists
    if (!accessToken) {
      const crypto = require('crypto');
      accessToken = crypto.randomBytes(32).toString('hex');
      tokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

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


// ---------------------------------------------------------------------------
// Envio masivo de invitaciones por WhatsApp (Twilio)
// ---------------------------------------------------------------------------
// Se procesa por lotes desde el frontend (tope de 50 por peticion) en vez de
// mandar los 703 de una: una sola request sincrona con cientos de llamadas a
// Twilio se pasa del timeout del proxy, y por lotes el usuario ve avance real.
const LOTE_MAXIMO = 50;

router.post('/send-whatsapp', auth, authorize('admin', 'evaluator'), async (req, res) => {
  try {
    if (!whatsappSender.isConfigured()) {
      return res.status(503).json({ error: 'El envio por WhatsApp no esta habilitado en esta instancia' });
    }

    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items es requerido' });
    }
    if (items.length > LOTE_MAXIMO) {
      return res.status(400).json({ error: `Maximo ${LOTE_MAXIMO} participantes por peticion` });
    }

    const companyIds = await getOwnedCompanyIds(req.user.userId);
    const superAdmin = isSuperAdmin(req.user);

    // Se re-resuelve todo contra la BD: el telefono y el token NO se aceptan
    // del cliente, para que nadie pueda mandar mensajes a numeros arbitrarios
    // ni filtrar tokens de otra empresa.
    let query = db('participant_evaluations as pe')
      .join('participants as p', 'p.id', 'pe.participant_id')
      .join('evaluations as e', 'e.id', 'pe.evaluation_id')
      .leftJoin('companies as c', 'c.id', 'p.company_id')
      .whereIn('pe.participant_id', items.map(i => Number(i.participantId)).filter(Boolean))
      .select(
        'pe.participant_id', 'pe.evaluation_id', 'pe.access_token', 'pe.token_expires_at',
        'p.demographic_data', 'c.name as company_name'
      );

    if (!superAdmin) query = query.whereIn('p.company_id', companyIds);

    const filas = await query;
    const porParticipante = new Map(filas.map(f => [Number(f.participant_id), f]));

    const resultados = [];
    for (const item of items) {
      const pid = Number(item.participantId);
      const fila = porParticipante.get(pid);

      if (!fila) {
        resultados.push({ participantId: pid, ok: false, error: 'No encontrado o sin permiso' });
        continue;
      }
      if (fila.token_expires_at && new Date(fila.token_expires_at) < new Date()) {
        resultados.push({ participantId: pid, ok: false, error: 'El link ya vencio, regeneralo antes de enviar' });
        continue;
      }

      const demo = typeof fila.demographic_data === 'string'
        ? JSON.parse(fila.demographic_data)
        : (fila.demographic_data || {});

      const envio = await whatsappSender.enviarInvitacion({
        telefono: demo.phone,
        nombre: (demo.firstName || '').split(' ')[0] || demo.firstName,
        empresa: fila.company_name,
        token: fila.access_token,
      });

      resultados.push({
        participantId: pid,
        nombre: `${demo.firstName || ''} ${demo.lastName || ''}`.trim(),
        ...envio,
      });
    }

    res.json({
      enviados: resultados.filter(r => r.ok).length,
      fallidos: resultados.filter(r => !r.ok).length,
      resultados,
    });
  } catch (error) {
    console.error('Send whatsapp error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});


module.exports = router;