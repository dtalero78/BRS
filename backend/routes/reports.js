const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const db = require('../config/database');
const { auth, getOwnedCompanyIds, isSuperAdmin } = require('../middleware/auth');
const { drawPieChart, drawBarChart, drawHorizontalBarChart, drawGroupedBarChart, drawTable, createRiskSeries, drawDonutChart, drawSemicircleGauge, drawSimpleRiskBars, drawColorCodedRiskTable, drawRiskPrioritizationMatrix, drawSectionBanner, RISK_COLORS, RISK_ORDER, RISK_LABELS } = require('../utils/pdf-charts');
const { aggregateDemographics, aggregateExtendedDemographics, aggregateResultsByForm, getAtRiskDimensions, aggregateStressTypology, buildRiskPrioritizationMatrix, aggregateResultsByArea, aggregateResultsByCargo, buildDemandasPorCargo, resolveFicha, sumCounts } = require('../utils/report-data-aggregator');
const templates = require('../utils/report-templates');

// ============================================================
// INDIVIDUAL REPORT - PDF for a single participant
// ============================================================
router.post('/individual', auth, async (req, res) => {
  try {
    const { participantEvaluationId } = req.body;

    if (!participantEvaluationId) {
      return res.status(400).json({ error: 'participantEvaluationId es requerido' });
    }

    // Get participant + evaluation + company data
    const participantQuery = db('participant_evaluations as pe')
      .join('participants as p', 'pe.participant_id', 'p.id')
      .join('evaluations as e', 'pe.evaluation_id', 'e.id')
      .join('companies as c', 'e.company_id', 'c.id')
      .where('pe.id', participantEvaluationId)
      .select(
        'pe.id as pe_id',
        'pe.status',
        'pe.completed_at',
        'p.email',
        'p.demographic_data',
        'e.id as evaluation_id',
        'e.name as evaluation_name',
        'e.description as evaluation_description',
        'e.paid as evaluation_paid',
        'c.name as company_name',
        'c.nit as company_nit'
      );

    if (!isSuperAdmin(req.user)) {
      participantQuery.whereIn('e.company_id', await getOwnedCompanyIds(req.user.userId));
    }

    const participant = await participantQuery.first();

    if (!participant) {
      return res.status(404).json({ error: 'Participante no encontrado' });
    }

    if (!participant.evaluation_paid && !isSuperAdmin(req.user)) {
      return res.status(403).json({
        error: 'payment_required',
        message: 'Esta evaluación no está habilitada para descarga. Contacta al administrador.'
      });
    }

    // Get pre-calculated results from DB
    const resultRows = await db('results')
      .where('participant_evaluation_id', participantEvaluationId)
      .orderBy('questionnaire_type')
      .select('*');

    if (resultRows.length === 0) {
      return res.status(400).json({ error: 'No hay resultados calculados. Primero calcule los resultados del participante.' });
    }

    // Parse results
    const resultsByType = {};
    resultRows.forEach(row => {
      const parsed = typeof row.results === 'string' ? JSON.parse(row.results) : (row.results || []);
      resultsByType[row.questionnaire_type] = parsed;
    });

    // Parse demographic data
    const demo = typeof participant.demographic_data === 'string'
      ? JSON.parse(participant.demographic_data)
      : (participant.demographic_data || {});

    // Get ficha_datos responses for this participant (for sociodemographic section)
    const fichaRow = await db('responses')
      .where('participant_evaluation_id', participantEvaluationId)
      .where('questionnaire_type', 'ficha_datos')
      .select('responses')
      .first();
    const ficha = fichaRow ? resolveFicha(fichaRow.responses) : null;

    // Get evaluator info
    const evaluatorRow = await db('users')
      .where('id', req.user.userId)
      .select('email', 'full_name', 'professional_title', 'license_number', 'signature_image')
      .first();
    const evaluator = {
      email: evaluatorRow?.email || '',
      fullName: evaluatorRow?.full_name || evaluatorRow?.email || 'Evaluador BRS Digital',
      title: evaluatorRow?.professional_title || 'Especialista en Psicología Ocupacional y Organizacional',
      license: evaluatorRow?.license_number || null,
      signatureImage: evaluatorRow?.signature_image || null,
    };

    // Generate PDF
    const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Reporte_BRS_Individual_${Date.now()}.pdf`);
    doc.pipe(res);

    generateIndividualPDF(doc, {
      participant,
      demo,
      resultsByType,
      ficha,
      evaluator,
    });

    doc.end();

  } catch (error) {
    console.error('Error generating individual report:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
});

// ============================================================
// ORGANIZATIONAL REPORT - PDF for an entire evaluation
// ============================================================
router.post('/organizational', auth, async (req, res) => {
  try {
    const { evaluationId, includeIndividualSummaries, texts: inlineTexts } = req.body;

    if (!evaluationId) {
      return res.status(400).json({ error: 'evaluationId es requerido' });
    }

    // Get evaluation + company data
    const evaluationQuery = db('evaluations as e')
      .join('companies as c', 'e.company_id', 'c.id')
      .where('e.id', evaluationId)
      .select(
        'e.id', 'e.name', 'e.description', 'e.start_date', 'e.end_date', 'e.status', 'e.paid',
        'e.report_text_overrides',
        'c.name as company_name', 'c.nit as company_nit'
      );

    if (!isSuperAdmin(req.user)) {
      evaluationQuery.whereIn('e.company_id', await getOwnedCompanyIds(req.user.userId));
    }

    const evaluation = await evaluationQuery.first();

    if (evaluation && !evaluation.paid && !isSuperAdmin(req.user)) {
      return res.status(403).json({
        error: 'payment_required',
        message: 'Esta evaluación no está habilitada para descarga. Contacta al administrador.'
      });
    }

    if (!evaluation) {
      return res.status(404).json({ error: 'Evaluación no encontrada' });
    }

    // Get all results for all participants in this evaluation
    const allResults = await db('results')
      .join('participant_evaluations as pe', 'results.participant_evaluation_id', 'pe.id')
      .join('participants as p', 'pe.participant_id', 'p.id')
      .where('pe.evaluation_id', evaluationId)
      .select('results.*', 'p.demographic_data', 'p.email');

    // Fetch per-participant data only if individual summaries are requested
    let participantSummaries = [];
    if (includeIndividualSummaries) {
      const completedPEs = await db('participant_evaluations as pe')
        .join('participants as p', 'pe.participant_id', 'p.id')
        .join('evaluations as e', 'pe.evaluation_id', 'e.id')
        .join('companies as c', 'e.company_id', 'c.id')
        .where('pe.evaluation_id', evaluationId)
        .where('pe.status', 'completed')
        .select(
          'pe.id as pe_id', 'pe.completed_at', 'pe.status',
          'p.email', 'p.demographic_data',
          'e.name as evaluation_name',
          'c.name as company_name', 'c.nit as company_nit'
        );

      for (const pe of completedPEs) {
        const resultRows = await db('results')
          .where('participant_evaluation_id', pe.pe_id)
          .select('*');
        if (resultRows.length === 0) continue;
        const resultsByType = {};
        resultRows.forEach(row => {
          resultsByType[row.questionnaire_type] = typeof row.results === 'string' ? JSON.parse(row.results) : (row.results || []);
        });
        const fichaRow = await db('responses')
          .where('participant_evaluation_id', pe.pe_id)
          .where('questionnaire_type', 'ficha_datos')
          .select('responses')
          .first();
        const ficha = fichaRow ? resolveFicha(fichaRow.responses) : null;
        const demo = typeof pe.demographic_data === 'string' ? JSON.parse(pe.demographic_data) : (pe.demographic_data || {});
        participantSummaries.push({ participant: pe, demo, resultsByType, ficha });
      }
    }

    const totalParticipants = await db('participant_evaluations')
      .where('evaluation_id', evaluationId)
      .count('id as count')
      .first();

    const completedParticipants = await db('participant_evaluations')
      .where('evaluation_id', evaluationId)
      .where('status', 'completed')
      .count('id as count')
      .first();

    // Get ficha_datos responses for demographic analysis
    const fichaResponses = await db('responses')
      .join('participant_evaluations as pe', 'responses.participant_evaluation_id', 'pe.id')
      .where('pe.evaluation_id', evaluationId)
      .where('responses.questionnaire_type', 'ficha_datos')
      .select('responses.responses', 'pe.participant_id', 'pe.id as participant_evaluation_id');

    // Get stress responses for typology analysis
    const stressResponses = await db('responses')
      .join('participant_evaluations as pe', 'responses.participant_evaluation_id', 'pe.id')
      .where('pe.evaluation_id', evaluationId)
      .where('responses.questionnaire_type', 'estres')
      .select('responses.responses', 'pe.participant_id');

    // Get evaluator info
    const evaluator = await db('users')
      .where('id', req.user.userId)
      .select('email', 'full_name', 'professional_title', 'license_number', 'signature_image')
      .first();

    // Aggregate data
    const demographics = aggregateExtendedDemographics(fichaResponses);
    const aggResults = aggregateResultsByForm(allResults);
    const atRiskDimensions = getAtRiskDimensions(aggResults);

    // Resolve editable report texts: defaults <- saved overrides <- inline (unsaved editor) overrides
    const defaultTexts = templates.buildDefaultOrgTexts({
      companyName: evaluation.company_name,
      totalEvaluated: aggResults.population.total
    });
    const savedOverrides = parseJsonMaybe(evaluation.report_text_overrides);
    let reportTexts = templates.mergeOrgTexts(defaultTexts, savedOverrides);
    if (inlineTexts) {
      reportTexts = templates.mergeOrgTexts(reportTexts, inlineTexts);
    }
    const stressTypology = aggregateStressTypology(stressResponses);
    const riskMatrix = buildRiskPrioritizationMatrix(aggResults);
    const areaResults = aggregateResultsByArea(allResults, fichaResponses);
    const cargoResults = aggregateResultsByCargo(allResults, fichaResponses);
    const demandasPorCargo = buildDemandasPorCargo(cargoResults);

    // Generate PDF
    const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });

    doc.on('error', (err) => console.error('PDFKit error:', err));
    res.on('error', (err) => console.error('Response stream error:', err));

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Informe_BRS_${evaluation.company_name.replace(/\s+/g, '_')}_${Date.now()}.pdf`);
    doc.pipe(res);

    const evaluatorObj = {
      email: evaluator?.email || '',
      fullName: evaluator?.full_name || evaluator?.email || 'Evaluador BRS Digital',
      title: evaluator?.professional_title || 'Especialista en Psicología Ocupacional y Organizacional',
      license: evaluator?.license_number || null,
      signatureImage: evaluator?.signature_image || null,
    };

    generateOrganizationalPDF(doc, {
      evaluation,
      demographics,
      aggResults,
      atRiskDimensions,
      stressTypology,
      riskMatrix,
      areaResults,
      demandasPorCargo,
      totalParticipants: parseInt(totalParticipants.count),
      completedParticipants: parseInt(completedParticipants.count),
      evaluator: evaluatorObj,
      texts: reportTexts
    });

    // Append individual summaries if requested
    if (includeIndividualSummaries && participantSummaries.length > 0) {
      doc.addPage();
      const m2 = doc.page.margins.left;
      const pageW2 = doc.page.width - m2 * 2;
      doc.fontSize(18).fillColor('#1E40AF').font('Helvetica-Bold')
        .text('RESÚMENES INDIVIDUALES', m2, doc.y, { width: pageW2, align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(10).fillColor('#6B7280').font('Helvetica')
        .text(`${participantSummaries.length} participante(s) con resultados calculados`, m2, doc.y, { width: pageW2, align: 'center' });

      for (const { participant, demo, resultsByType, ficha } of participantSummaries) {
        doc.addPage();
        generateIndividualPDF(doc, { participant, demo, resultsByType, ficha, evaluator: evaluatorObj, skipFooters: true });
      }
    }

    // Single footer pass covering all pages (org + individual summaries if any)
    addFooters(doc);

    doc.end();

  } catch (error) {
    console.error('Error generating organizational report:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error interno del servidor' });
    } else {
      try { res.destroy(); } catch (_) {}
    }
  }
});

// ============================================================
// EDITABLE ORGANIZATIONAL REPORT TEXTS
// ============================================================

// GET the editable prose texts for an evaluation's organizational report:
// computed defaults merged with any saved overrides, plus the field schema so
// the frontend can render the editor.
router.get('/organizational/texts', auth, async (req, res) => {
  try {
    const { evaluationId } = req.query;
    if (!evaluationId) {
      return res.status(400).json({ error: 'evaluationId es requerido' });
    }

    const evalQuery = db('evaluations as e')
      .join('companies as c', 'e.company_id', 'c.id')
      .where('e.id', evaluationId)
      .select('e.id', 'e.report_text_overrides', 'c.name as company_name');

    if (!isSuperAdmin(req.user)) {
      evalQuery.whereIn('e.company_id', await getOwnedCompanyIds(req.user.userId));
    }

    const evaluation = await evalQuery.first();
    if (!evaluation) {
      return res.status(404).json({ error: 'Evaluación no encontrada' });
    }

    // total evaluated = unique participant_evaluations that have results (matches population.total)
    const totalRow = await db('results')
      .join('participant_evaluations as pe', 'results.participant_evaluation_id', 'pe.id')
      .where('pe.evaluation_id', evaluationId)
      .countDistinct('results.participant_evaluation_id as count')
      .first();
    const totalEvaluated = parseInt(totalRow?.count || 0, 10);

    const defaults = templates.buildDefaultOrgTexts({
      companyName: evaluation.company_name,
      totalEvaluated
    });
    const savedOverrides = parseJsonMaybe(evaluation.report_text_overrides);
    const texts = templates.mergeOrgTexts(defaults, savedOverrides);

    res.json({
      fields: templates.ORG_TEXT_FIELDS,
      texts,
      defaults,
      isCustomized: !!savedOverrides && Object.keys(savedOverrides).length > 0
    });
  } catch (error) {
    console.error('Error fetching organizational report texts:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PUT persists (or resets, with { reset: true }) the editable texts for an
// evaluation's organizational report.
router.put('/organizational/texts', auth, async (req, res) => {
  try {
    const { evaluationId, texts, reset } = req.body;
    if (!evaluationId) {
      return res.status(400).json({ error: 'evaluationId es requerido' });
    }

    const evalQuery = db('evaluations as e')
      .where('e.id', evaluationId)
      .select('e.id', 'e.company_id');

    if (!isSuperAdmin(req.user)) {
      evalQuery.whereIn('e.company_id', await getOwnedCompanyIds(req.user.userId));
    }

    const evaluation = await evalQuery.first();
    if (!evaluation) {
      return res.status(404).json({ error: 'Evaluación no encontrada' });
    }

    const sanitized = reset ? null : templates.sanitizeOrgTexts(texts);
    await db('evaluations')
      .where('id', evaluationId)
      .update({ report_text_overrides: sanitized ? JSON.stringify(sanitized) : null });

    res.json({ success: true, isCustomized: !!sanitized });
  } catch (error) {
    console.error('Error saving organizational report texts:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ============================================================
// PDF GENERATION HELPERS
// ============================================================

function parseJsonMaybe(value) {
  if (value == null) return null;
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return null; }
  }
  return value;
}

const QUESTIONNAIRE_TITLES = {
  'intralaboral_a': 'Cuestionario Intralaboral - Forma A',
  'intralaboral_b': 'Cuestionario Intralaboral - Forma B',
  'extralaboral': 'Cuestionario de Factores Extralaborales',
  'estres': 'Cuestionario de Síntomas de Estrés',
  'coping': 'Brief COPE - Estrategias de Afrontamiento'
};

// Coping uses a different classification scale
const COPING_LEVEL_LABELS = {
  muy_bajo: 'Muy Bajo',
  bajo: 'Bajo',
  medio: 'Medio',
  alto: 'Alto',
  muy_alto: 'Muy Alto'
};

const COPING_LEVEL_COLORS = {
  muy_bajo: '#22C55E',
  bajo: '#84CC16',
  medio: '#EAB308',
  alto: '#F97316',
  muy_alto: '#EF4444'
};

function formatDimensionName(dim) {
  return templates.DIMENSION_DISPLAY_NAMES[dim] || dim
    .replace(/^puntaje_total_/, 'Puntaje Total ')
    .replace(/_total$/, ' (Total Dominio)')
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function getRiskLabel(level) {
  return RISK_LABELS[level] || COPING_LEVEL_LABELS[level] || level;
}

function getRiskColor(level) {
  return RISK_COLORS[level] || COPING_LEVEL_COLORS[level] || '#6B7280';
}

function ensureSpace(doc, needed) {
  if (doc.y > doc.page.height - doc.page.margins.bottom - needed) {
    doc.addPage();
  }
}

function drawHorizontalLine(doc) {
  const x = doc.page.margins.left;
  const w = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  doc.moveTo(x, doc.y).lineTo(x + w, doc.y).strokeColor('#E5E7EB').stroke();
  doc.moveDown(0.5);
}

function formatBirthYear(val) {
  if (val == null || val === '') return null;
  const s = String(val);
  const m = s.match(/(19|20)\d{2}/);
  return m ? m[0] : s;
}

function drawRiskBar(doc, x, y, width, score, riskLevel) {
  const barHeight = 10;
  // Background
  doc.rect(x, y, width, barHeight).fillColor('#E5E7EB').fill();
  // Filled portion
  const fillWidth = (score / 100) * width;
  doc.rect(x, y, fillWidth, barHeight).fillColor(RISK_COLORS[riskLevel] || COPING_LEVEL_COLORS[riskLevel] || '#6B7280').fill();
}

// ============================================================
// INDIVIDUAL PDF
// ============================================================
function generateIndividualPDF(doc, { participant, demo, resultsByType, ficha, evaluator, skipFooters = false }) {
  const m = doc.page.margins.left;
  const pageW = doc.page.width - m * 2;

  // ---- COVER PAGE ----
  doc.moveDown(4);
  doc.fontSize(28).fillColor('#1E40AF').text('REPORTE INDIVIDUAL', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(18).fillColor('#4B5563').text('Batería de Riesgo Psicosocial', { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(11).fillColor('#6B7280').text('Ministerio de la Protección Social - República de Colombia', { align: 'center' });

  doc.moveDown(3);
  drawHorizontalLine(doc);
  doc.moveDown(1);

  // Participant info box
  doc.fontSize(14).fillColor('#1F2937').text('DATOS DEL PARTICIPANTE');
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor('#374151');

  const infoLines = [
    ['Nombre', `${demo.firstName || ''} ${demo.lastName || ''}`.trim() || demo.nombre || participant.email],
    ['Empresa', participant.company_name],
    ['Evaluación', participant.evaluation_name],
    ['Fecha', participant.completed_at ? new Date(participant.completed_at).toLocaleDateString('es-CO') : 'N/A'],
  ];
  if (demo.cargo || demo.position) infoLines.push(['Cargo', demo.cargo || demo.position]);
  if (demo.departamento || demo.department) infoLines.push(['Departamento', demo.departamento || demo.department]);
  if (demo.edad || demo.age) infoLines.push(['Edad', `${demo.edad || demo.age} años`]);
  if (demo.sexo || demo.gender) infoLines.push(['Sexo', demo.sexo || demo.gender]);

  infoLines.forEach(([label, value]) => {
    doc.font('Helvetica-Bold').text(`${label}: `, { continued: true });
    doc.font('Helvetica').text(value || 'N/A');
  });

  // ---- SOCIODEMOGRAPHIC PAGE (Ficha de Datos Generales) ----
  if (ficha && Object.keys(ficha).filter(k => k !== '_scheme').length > 0) {
    doc.addPage();
    doc.fontSize(16).fillColor('#1E40AF').text('FICHA DE DATOS GENERALES');
    doc.moveDown(0.3);
    drawHorizontalLine(doc);
    doc.moveDown(0.5);

    doc.fontSize(9).fillColor('#6B7280').font('Helvetica');
    doc.text(
      'Información general del trabajador y de su ocupación recopilada como parte del instrumento de información sociodemográfica del Ministerio de la Protección Social.',
      { width: pageW, align: 'justify' }
    );
    doc.moveDown(1);

    const fichaSections = [
      {
        title: 'Información personal',
        rows: [
          ['Nombre completo', ficha.nombre],
          ['Sexo', ficha.sexo],
          ['Año de nacimiento', formatBirthYear(ficha.birthYear)],
          ['Último nivel de estudios', ficha.education],
          ['Estado civil', ficha.maritalStatus],
          ['Ocupación o profesión', ficha.ocupacion],
          ['Lugar de residencia', ficha.ciudadResidencia],
          ['Estrato', ficha.estrato != null ? String(ficha.estrato) : null],
          ['Tipo de vivienda', ficha.tipoVivienda],
          ['Personas que dependen económicamente', ficha.dependientes != null ? String(ficha.dependientes) : null],
        ],
      },
      {
        title: 'Información laboral',
        rows: [
          ['Ciudad / departamento de trabajo', ficha.ciudadTrabajo],
          ['Antigüedad en la empresa', ficha.anosEmpresa],
          ['Cargo', ficha.cargo],
          ['Tipo de cargo', ficha.tipoCargo],
          ['Antigüedad en el cargo', ficha.anosCargo],
          ['Departamento / área / sección', ficha.departamento],
          ['Tipo de contrato', ficha.tipoContrato],
          ['Horas diarias de trabajo', ficha.horasTrabajo != null ? String(ficha.horasTrabajo) : null],
          ['Tipo de salario', ficha.tipoSalario],
        ],
      },
    ];

    fichaSections.forEach(section => {
      const visibleRows = section.rows.filter(([, v]) => v != null && v !== '');
      if (visibleRows.length === 0) return;
      ensureSpace(doc, 30 + visibleRows.length * 16);
      doc.fontSize(11).fillColor('#1F2937').font('Helvetica-Bold').text(section.title);
      doc.moveDown(0.3);
      doc.fontSize(10).font('Helvetica').fillColor('#374151');
      visibleRows.forEach(([label, value]) => {
        ensureSpace(doc, 18);
        doc.font('Helvetica-Bold').text(`${label}: `, { continued: true });
        doc.font('Helvetica').text(String(value));
      });
      doc.moveDown(0.7);
    });
  }

  // ---- RESULTS PAGES ----
  for (const [qType, dimensions] of Object.entries(resultsByType)) {
    doc.addPage();
    const title = QUESTIONNAIRE_TITLES[qType] || qType;
    doc.fontSize(16).fillColor('#1E40AF').text(title.toUpperCase());
    doc.moveDown(0.3);
    drawHorizontalLine(doc);
    doc.moveDown(0.5);

    // Separate dimensions, domain totals, and overall totals
    const overallTotals = dimensions.filter(d => d.dimension.startsWith('puntaje_total'));
    const dimResults = dimensions.filter(d => !d.dimension.endsWith('_total') && !d.dimension.startsWith('puntaje_total'));
    const domainResults = dimensions.filter(d => d.dimension.endsWith('_total'));

    // Risk summary for this questionnaire
    const isCoping = qType === 'coping';
    const riskCounts = isCoping
      ? { muy_bajo: 0, bajo: 0, medio: 0, alto: 0, muy_alto: 0 }
      : { sin_riesgo: 0, riesgo_bajo: 0, riesgo_medio: 0, riesgo_alto: 0, riesgo_muy_alto: 0 };
    dimResults.forEach(d => { if (riskCounts[d.riskLevel] !== undefined) riskCounts[d.riskLevel]++; });

    doc.fontSize(12).fillColor('#1F2937').text(isCoping ? 'Resumen de Niveles de Uso:' : 'Resumen de Niveles de Riesgo:');
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor('#374151');
    Object.entries(riskCounts).forEach(([level, count]) => {
      if (count > 0) {
        doc.fillColor(getRiskColor(level)).text(`  ● ${getRiskLabel(level)}: ${count} ${isCoping ? 'subescalas' : 'dimensiones'}`, { continued: false });
      }
    });
    doc.fillColor('#374151');
    doc.moveDown(1);

    // Domain/category totals (if any)
    if (domainResults.length > 0) {
      doc.fontSize(12).fillColor('#1F2937').text(isCoping ? 'Resultados por Categoría:' : 'Resultados por Dominio:');
      doc.moveDown(0.5);

      domainResults.forEach(d => {
        ensureSpace(doc, 40);
        const name = formatDimensionName(d.dimension);
        const score = d.transformedScore != null ? d.transformedScore.toFixed(1) : '0';
        const risk = getRiskLabel(d.riskLevel);

        doc.fontSize(10).fillColor('#1F2937').font('Helvetica-Bold').text(name);
        doc.font('Helvetica').fillColor(getRiskColor(d.riskLevel))
          .text(`  Puntaje: ${score}%  |  ${risk}`);

        drawRiskBar(doc, m, doc.y + 2, pageW * 0.6, parseFloat(score), d.riskLevel);
        doc.moveDown(1.5);
      });

      doc.moveDown(0.5);
    }

    // Overall total (puntaje total) if present
    if (overallTotals.length > 0) {
      overallTotals.forEach(d => {
        ensureSpace(doc, 50);
        const name = formatDimensionName(d.dimension);
        const score = d.transformedScore != null ? d.transformedScore.toFixed(1) : '0';
        const risk = getRiskLabel(d.riskLevel);

        doc.fontSize(13).fillColor('#1E40AF').font('Helvetica-Bold').text(name.toUpperCase());
        doc.font('Helvetica').fontSize(11).fillColor(getRiskColor(d.riskLevel))
          .text(`  Puntaje transformado: ${score}%  |  ${risk}`);

        drawRiskBar(doc, m, doc.y + 2, pageW * 0.7, parseFloat(score), d.riskLevel);
        doc.moveDown(2);
      });
    }

    // Dimension detail table
    doc.fontSize(12).fillColor('#1F2937').text(isCoping ? 'Detalle por Subescala:' : 'Detalle por Dimensión:');
    doc.moveDown(0.5);

    // Table header
    const colX = [m, m + 200, m + 290, m + 370];
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#6B7280');
    doc.text(isCoping ? 'Subescala' : 'Dimensión', colX[0], doc.y);
    doc.text('Puntaje', colX[1], doc.y - doc.currentLineHeight());
    doc.text(isCoping ? 'Puntaje Bruto' : 'Percentil', colX[2], doc.y - doc.currentLineHeight());
    doc.text(isCoping ? 'Nivel' : 'Nivel de Riesgo', colX[3], doc.y - doc.currentLineHeight());
    doc.moveDown(0.5);
    drawHorizontalLine(doc);

    dimResults.forEach(d => {
      ensureSpace(doc, 20);
      const y = doc.y;
      const score = d.transformedScore != null ? d.transformedScore.toFixed(1) + '%' : 'N/A';
      const col3Value = isCoping ? (d.rawScore != null ? String(d.rawScore) : 'N/A') : (d.percentile != null ? d.percentile.toFixed(1) : 'N/A');
      const risk = getRiskLabel(d.riskLevel);

      doc.fontSize(8).font('Helvetica').fillColor('#374151');
      doc.text(formatDimensionName(d.dimension), colX[0], y, { width: 190 });
      doc.text(score, colX[1], y);
      doc.text(col3Value, colX[2], y);
      doc.fillColor(getRiskColor(d.riskLevel)).font('Helvetica-Bold');
      doc.text(risk, colX[3], y);
      doc.font('Helvetica').fillColor('#374151');
      doc.moveDown(0.3);
    });
  }

  // ---- INTERPRETATION PAGE ----
  doc.addPage();
  doc.fontSize(16).fillColor('#1E40AF').text('INTERPRETACIÓN Y RECOMENDACIONES');
  doc.moveDown(0.3);
  drawHorizontalLine(doc);
  doc.moveDown(1);

  doc.fontSize(10).fillColor('#374151').font('Helvetica');
  doc.text(
    'Los resultados de esta evaluación de riesgo psicosocial se basan en la metodología oficial ' +
    'del Ministerio de la Protección Social de Colombia (Resolución 2646 de 2008). Cada cuestionario ' +
    'evalúa diferentes aspectos del ambiente laboral y extralaboral que pueden impactar la salud ' +
    'mental y física del trabajador.',
    { width: pageW, align: 'justify' }
  );
  doc.moveDown(1);

  doc.fontSize(12).fillColor('#1F2937').font('Helvetica-Bold').text('Significado de los Niveles de Riesgo:');
  doc.moveDown(0.5);
  doc.font('Helvetica').fontSize(9);

  const riskDescriptions = [
    ['Sin Riesgo', '#10B981', 'Las condiciones del ambiente de trabajo no representan riesgo para la salud del trabajador.'],
    ['Riesgo Bajo', '#3B82F6', 'Las condiciones de riesgo están presentes de forma leve. Se recomienda mantener sistemas de vigilancia.'],
    ['Riesgo Medio', '#EAB308', 'Las condiciones de riesgo están presentes de forma moderada. Se requieren acciones de intervención a mediano plazo.'],
    ['Riesgo Alto', '#F97316', 'Las condiciones de riesgo están presentes de forma importante. Se requieren acciones de intervención a corto plazo.'],
    ['Riesgo Muy Alto', '#EF4444', 'Las condiciones de riesgo están presentes de forma crítica. Se requieren acciones de intervención inmediatas.'],
  ];

  riskDescriptions.forEach(([label, color, desc]) => {
    ensureSpace(doc, 30);
    doc.fillColor(color).font('Helvetica-Bold').text(`● ${label}: `, { continued: true });
    doc.fillColor('#374151').font('Helvetica').text(desc);
    doc.moveDown(0.3);
  });

  doc.moveDown(1);
  doc.fontSize(12).fillColor('#1F2937').font('Helvetica-Bold').text('Recomendaciones Generales:');
  doc.moveDown(0.5);
  doc.font('Helvetica').fontSize(9).fillColor('#374151');
  doc.text(
    'Es importante implementar programas de vigilancia epidemiológica en salud mental y programas ' +
    'de intervención basados en los factores de riesgo identificados. Se recomienda realizar ' +
    'seguimiento periódico y evaluaciones de efectividad de las medidas implementadas.',
    { width: pageW, align: 'justify' }
  );

  // Evaluator signature
  if (evaluator) {
    ensureSpace(doc, 120);
    drawEvaluatorSignature(doc, evaluator, pageW, m);
  }

  if (!skipFooters) addFooters(doc);
}

// ============================================================
// ORGANIZATIONAL PDF - Full professional report (~35 pages)
// ============================================================
function drawEvaluatorSignature(doc, evaluator, pageW, m) {
  doc.moveDown(3);
  const lineY = doc.y;
  doc.moveTo(m + pageW * 0.25, lineY).lineTo(m + pageW * 0.75, lineY)
    .strokeColor('#9CA3AF').lineWidth(0.5).stroke();
  doc.moveDown(0.5);

  if (evaluator.signatureImage) {
    try {
      const base64Data = evaluator.signatureImage.replace(/^data:image\/\w+;base64,/, '');
      const imgBuffer = Buffer.from(base64Data, 'base64');
      const imgX = m + (pageW - 160) / 2;
      doc.image(imgBuffer, imgX, doc.y, { fit: [160, 65] });
      doc.moveDown(3.5);
    } catch (e) {
      // Skip image if corrupt
    }
  }

  doc.fontSize(12).fillColor('#1F2937').font('Helvetica-Bold');
  doc.text(evaluator.fullName, { align: 'center' });
  doc.fontSize(10).fillColor('#6B7280').font('Helvetica');
  doc.text(evaluator.title, { align: 'center' });
  if (evaluator.license) {
    doc.text(`T.P. No. ${evaluator.license}`, { align: 'center' });
  }
}

function generateOrganizationalPDF(doc, { evaluation, demographics, aggResults, atRiskDimensions, stressTypology, riskMatrix, areaResults, demandasPorCargo, totalParticipants, completedParticipants, evaluator, texts }) {
  const m = doc.page.margins.left;
  const pageW = doc.page.width - m * 2;
  const t = texts || templates.buildDefaultOrgTexts({ companyName: evaluation.company_name, totalEvaluated: aggResults.population.total });

  // Renders a justified analysis paragraph under a chart, with a page-break guard.
  const writeChartAnalysis = (text) => {
    if (!text) return;
    ensureSpace(doc, 90);
    doc.x = m;
    doc.fontSize(9).fillColor('#374151').font('Helvetica');
    doc.text(text, m, doc.y, { width: pageW, align: 'justify' });
    doc.moveDown(1);
  };

  // Justified narrative paragraph (for the qualitative interpretation prose).
  const writeNarrative = (text, opts = {}) => {
    if (!text) return;
    ensureSpace(doc, opts.space || 70);
    doc.x = m;
    doc.fontSize(opts.size || 9.5).fillColor(opts.color || '#374151').font(opts.font || 'Helvetica');
    doc.text(text, m, doc.y, { width: pageW, align: 'justify' });
    doc.moveDown(opts.gap != null ? opts.gap : 0.55);
  };
  const writeSubheading = (text) => {
    ensureSpace(doc, 46);
    doc.x = m;
    doc.fontSize(11).fillColor('#1E40AF').font('Helvetica-Bold');
    doc.text(text, m, doc.y, { width: pageW });
    doc.moveDown(0.4);
  };

  // Renders one intralaboral form (A/B): per-form risk table + qualitative
  // interpretation per dimension, domain conclusions and form general analysis.
  // Returns true if it rendered anything.
  const renderIntralaboralForm = (form) => {
    const formAgg = form === 'A' ? aggResults.intralaboralA : aggResults.intralaboralB;
    const n = formAgg.participantCount || 0;
    if (n === 0) return false;

    ensureSpace(doc, 120);
    if (doc.y > 620) doc.addPage();
    writeSubheading(`Cuestionario Intralaboral – Forma ${form} (n = ${n})`);
    writeNarrative(
      form === 'A'
        ? 'Aplicado a trabajadores con cargos de jefatura, profesionales o técnicos.'
        : 'Aplicado a trabajadores con cargos auxiliares u operarios.',
      { size: 8.5, color: '#6B7280', gap: 0.5 }
    );

    // Per-form color-coded risk table
    const tableData = [];
    templates.DOMAIN_ORDER.forEach(domainKey => {
      tableData.push({ isDomain: true, label: templates.DOMAIN_DISPLAY_NAMES[domainKey] });
      const dims = templates.DOMAIN_DIMENSIONS[domainKey][form] || [];
      dims.forEach(dimKey => {
        const counts = formAgg.dimensions[dimKey];
        if (!counts || sumCounts(counts) === 0) return;
        tableData.push({
          label: templates.DIMENSION_DISPLAY_NAMES[dimKey] || dimKey,
          sin_riesgo: counts.sin_riesgo || 0, riesgo_bajo: counts.riesgo_bajo || 0,
          riesgo_medio: counts.riesgo_medio || 0, riesgo_alto: counts.riesgo_alto || 0,
          riesgo_muy_alto: counts.riesgo_muy_alto || 0
        });
      });
    });
    ensureSpace(doc, 140);
    drawColorCodedRiskTable(doc, m, doc.y, pageW, tableData);
    doc.moveDown(1);

    // Qualitative interpretation: dimension paragraphs + domain conclusions
    templates.DOMAIN_ORDER.forEach(domainKey => {
      const dims = templates.DOMAIN_DIMENSIONS[domainKey][form] || [];
      dims.forEach(dimKey => {
        const counts = formAgg.dimensions[dimKey];
        if (!counts || sumCounts(counts) === 0) return;
        writeNarrative(templates.generateDimensionNarrative(dimKey, counts));
      });
      const dCounts = formAgg.domains[domainKey];
      if (dCounts && sumCounts(dCounts) > 0) {
        writeNarrative(templates.generateDomainConclusion(domainKey, dCounts), { color: '#1F2937' });
      }
    });

    // Form-level general analysis
    if (formAgg.overall && sumCounts(formAgg.overall) > 0) {
      writeNarrative(templates.generateFormGeneralAnalysis('intralaboral', formAgg.overall, `Forma ${form}`), { color: '#1F2937' });
    }
    doc.moveDown(0.5);
    return true;
  };

  // Renders one extralaboral form (A/B): per-form table + dimension narrative + general analysis.
  const renderExtralaboralForm = (form) => {
    const formAgg = form === 'A' ? aggResults.extralaboral.formaA : aggResults.extralaboral.formaB;
    const dimKeys = templates.EXTRALABORAL_DIMENSIONS.filter(dk => formAgg.dimensions[dk] && sumCounts(formAgg.dimensions[dk]) > 0);
    if (dimKeys.length === 0) return false;

    ensureSpace(doc, 120);
    if (doc.y > 620) doc.addPage();
    writeSubheading(`Cuestionario Extralaboral – Forma ${form}`);

    const tableData = dimKeys.map(dimKey => {
      const counts = formAgg.dimensions[dimKey];
      return {
        label: templates.DIMENSION_DISPLAY_NAMES[dimKey] || dimKey,
        sin_riesgo: counts.sin_riesgo || 0, riesgo_bajo: counts.riesgo_bajo || 0,
        riesgo_medio: counts.riesgo_medio || 0, riesgo_alto: counts.riesgo_alto || 0,
        riesgo_muy_alto: counts.riesgo_muy_alto || 0
      };
    });
    ensureSpace(doc, 100);
    drawColorCodedRiskTable(doc, m, doc.y, pageW, tableData);
    doc.moveDown(1);

    dimKeys.forEach(dimKey => writeNarrative(templates.generateDimensionNarrative(dimKey, formAgg.dimensions[dimKey])));

    if (formAgg.overall && sumCounts(formAgg.overall) > 0) {
      writeNarrative(templates.generateFormGeneralAnalysis('extralaboral', formAgg.overall, `Forma ${form}`), { color: '#1F2937' });
    }
    doc.moveDown(0.5);
    return true;
  };

  // Renders one stress form (A/B): per-form risk bars + narrative (result + general analysis).
  const renderStressForm = (form) => {
    const counts = form === 'A' ? aggResults.estres.formaA : aggResults.estres.formaB;
    const total = sumCounts(counts);
    if (total === 0) return false;

    ensureSpace(doc, 230);
    if (doc.y > 540) doc.addPage();
    writeSubheading(`Cuestionario de Estrés – Forma ${form} (n = ${total})`);
    doc.y += 12;
    drawSimpleRiskBars(doc, m + 50, doc.y, pageW - 100, 150, counts, total, {
      title: `Sintomatología de Estrés – Forma ${form}`
    });
    doc.x = m;
    doc.y += 165;
    doc.moveDown(0.3);
    templates.generateStressAnalysis(counts, `Forma ${form}`).forEach(p => writeNarrative(p, { color: '#1F2937' }));
    doc.moveDown(0.5);
    return true;
  };

  // Helper to combine A+B risk counts for a dimension
  function getCombinedDimCounts(dimKey) {
    const a = aggResults.intralaboralA.dimensions[dimKey] || { sin_riesgo: 0, riesgo_bajo: 0, riesgo_medio: 0, riesgo_alto: 0, riesgo_muy_alto: 0 };
    const b = aggResults.intralaboralB.dimensions[dimKey] || { sin_riesgo: 0, riesgo_bajo: 0, riesgo_medio: 0, riesgo_alto: 0, riesgo_muy_alto: 0 };
    const combined = {};
    for (const level of RISK_ORDER) {
      combined[level] = (a[level] || 0) + (b[level] || 0);
    }
    return combined;
  }

  // ==========================================================
  // PAGE 1: PORTADA
  // ==========================================================
  doc.moveDown(6);
  doc.fontSize(14).fillColor('#1E293B').font('Helvetica-Bold');
  doc.text('INFORME DE MEDICIÓN, EVALUACIÓN Y DIAGNÓSTICO', { align: 'center' });
  doc.text('DE FACTORES DE RIESGO PSICOSOCIAL', { align: 'center' });
  doc.moveDown(4);
  doc.fontSize(22).fillColor('#1F2937');
  doc.text(evaluation.company_name.toUpperCase(), { align: 'center' });
  doc.moveDown(4);
  doc.fontSize(12).fillColor('#4B5563').font('Helvetica');
  doc.text(evaluator.fullName, { align: 'center' });
  doc.text(evaluator.title, { align: 'center' });
  if (evaluator.license) {
    doc.text(`T.P. No. ${evaluator.license}`, { align: 'center' });
  }
  doc.moveDown(6);
  const now = new Date();
  const months = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
  doc.fontSize(12).fillColor('#4B5563');
  doc.text(`BOGOTÁ D.C., ${months[now.getMonth()]} ${now.getFullYear()}`, { align: 'center' });

  // ==========================================================
  // DESCRIPCIÓN DE LA EMPRESA
  // ==========================================================
  doc.addPage();
  drawSectionBanner(doc, m, doc.y, pageW, 'DESCRIPCIÓN DE LA EMPRESA');
  doc.y += 40;
  doc.x = m;
  doc.moveDown(0.5);

  doc.fontSize(10);
  const descLines = [
    ['Razón social', evaluation.company_name],
    ['NIT', evaluation.company_nit],
    ['Dirección', t.direccion],
  ];
  descLines.forEach(([label, value]) => {
    if (!value) return;
    doc.font('Helvetica-Bold').fillColor('#1F2937').text(`${label}: `, m, doc.y, { continued: true });
    doc.font('Helvetica').fillColor('#374151').text(String(value));
  });
  doc.moveDown(0.6);

  [['Actividad económica', t.actividadEconomica], ['Misión', t.mision], ['Visión', t.vision]].forEach(([label, value]) => {
    if (!value) return;
    ensureSpace(doc, 50);
    doc.x = m;
    doc.fontSize(11).fillColor('#1E40AF').font('Helvetica-Bold').text(label, m, doc.y, { width: pageW });
    doc.moveDown(0.2);
    doc.fontSize(10).fillColor('#374151').font('Helvetica').text(String(value), m, doc.y, { width: pageW, align: 'justify' });
    doc.moveDown(0.6);
  });

  // ==========================================================
  // INTRODUCCIÓN (editable)
  // ==========================================================
  const introParas = Array.isArray(t.introduccion) ? t.introduccion.filter(Boolean) : [];
  if (introParas.length > 0) {
    doc.addPage();
    drawSectionBanner(doc, m, doc.y, pageW, 'INTRODUCCIÓN');
    doc.y += 40;
    doc.x = m;
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#374151').font('Helvetica');
    introParas.forEach(p => {
      doc.text(p, m, doc.y, { width: pageW, align: 'justify' });
      doc.moveDown(0.5);
    });
  }

  // ==========================================================
  // JUSTIFICACIÓN (editable)
  // ==========================================================
  const justParas = Array.isArray(t.justificacion) ? t.justificacion.filter(Boolean) : [];
  if (justParas.length > 0) {
    doc.addPage();
    drawSectionBanner(doc, m, doc.y, pageW, 'JUSTIFICACIÓN');
    doc.y += 40;
    doc.x = m;
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#374151').font('Helvetica');
    justParas.forEach(p => {
      doc.text(p, m, doc.y, { width: pageW, align: 'justify' });
      doc.moveDown(0.5);
    });
  }

  // ==========================================================
  // PAGE 2: OBJETIVOS + METODOLOGÍA (two columns)
  // ==========================================================
  doc.addPage();
  templates.writeObjetivosMetodologia(doc, pageW, t);

  // ==========================================================
  // PAGE 3: PROCEDIMIENTOS
  // ==========================================================
  doc.addPage();
  templates.writeProcedimientos(doc, pageW, t);

  // ==========================================================
  // MARCO LEGAL
  // ==========================================================
  doc.addPage();
  drawSectionBanner(doc, m, doc.y, pageW, 'MARCO LEGAL');
  doc.y += 40;
  doc.x = m;
  doc.moveDown(0.5);
  templates.writeMarcoLegal(doc, pageW, drawTable);

  // ==========================================================
  // MARCO TEÓRICO Y CONCEPTUAL
  // ==========================================================
  doc.addPage();
  drawSectionBanner(doc, m, doc.y, pageW, 'MARCO TEÓRICO Y CONCEPTUAL');
  doc.y += 40;
  doc.x = m;
  doc.moveDown(0.5);
  templates.writeMarcoTeorico(doc, pageW);

  // ==========================================================
  // PAGES 4-5: DEFINICIONES
  // ==========================================================
  doc.addPage();
  templates.writeDefinicionesIntralaborales(doc, pageW, drawTable);

  doc.addPage();
  templates.writeDefinicionesExtralaborales(doc, pageW, drawTable);

  // ==========================================================
  // DATOS SOCIODEMOGRÁFICOS
  // ==========================================================
  doc.addPage();
  drawSectionBanner(doc, m, doc.y, pageW, 'DATOS SOCIODEMOGRÁFICOS');
  doc.y += 40;
  doc.moveDown(0.5);

  doc.fontSize(10).fillColor('#374151').font('Helvetica');
  doc.text(
    `La caracterización sociodemográfica describe las condiciones individuales de la población evaluada. Si bien estas variables no constituyen por sí mismas factores de riesgo, permiten contextualizar e interpretar adecuadamente los resultados de los factores intralaborales, extralaborales y de estrés, y focalizar las acciones de intervención en los grupos que así lo requieran. A continuación se presenta el perfil sociodemográfico de los ${aggResults.population.total} participantes evaluados, acompañado del análisis de cada variable:`,
    { width: pageW, align: 'justify' }
  );
  doc.moveDown(1);

  // Donut chart: Género
  if (Object.keys(demographics.gender).length > 0) {
    const genderData = Object.entries(demographics.gender).map(([label, value], i) => ({
      label, value, color: templates.DEMOGRAPHIC_COLORS[i]
    }));
    const genderCX = m + 100;
    const genderCY = doc.y + 80;
    drawDonutChart(doc, genderCX, genderCY, 70, 35, genderData, {
      title: 'Participación por Género'
    });
    doc.y = genderCY + 90;
    doc.moveDown(0.5);

    writeChartAnalysis(templates.generateDemographicAnalysis('gender', demographics.gender, demographics.total));
  }

  // Bar chart: Estado Civil
  if (demographics.estadoCivil && Object.keys(demographics.estadoCivil).length > 0) {
    ensureSpace(doc, 200);
    const civilData = Object.entries(demographics.estadoCivil).map(([label, value], i) => ({
      label, value, color: templates.DEMOGRAPHIC_COLORS[i % templates.DEMOGRAPHIC_COLORS.length]
    }));
    drawBarChart(doc, m, doc.y + 10, pageW, 160, civilData, {
      title: 'Participación por Estado Civil', showValues: true
    });
    doc.y += 180;
    doc.moveDown(0.5);
    writeChartAnalysis(templates.generateDemographicAnalysis('estadoCivil', demographics.estadoCivil, demographics.total));
  }

  // Bar chart: Nivel de Estudio (education)
  if (Object.keys(demographics.education).length > 0) {
    ensureSpace(doc, 210);
    if (doc.y > 550) doc.addPage();
    const eduData = Object.entries(demographics.education).map(([label, value], i) => ({
      label, value, color: templates.DEMOGRAPHIC_COLORS[i % templates.DEMOGRAPHIC_COLORS.length]
    }));
    drawBarChart(doc, m, doc.y + 10, pageW, 160, eduData, {
      title: 'Distribución por Nivel de Estudio', showValues: true
    });
    doc.y += 180;
    doc.moveDown(0.5);
    writeChartAnalysis(templates.generateDemographicAnalysis('education', demographics.education, demographics.total));
  }

  // Bar chart: Estrato
  if (demographics.estrato && Object.keys(demographics.estrato).length > 0) {
    ensureSpace(doc, 210);
    if (doc.y > 550) doc.addPage();
    const estratoData = Object.entries(demographics.estrato).sort((a, b) => a[0].localeCompare(b[0])).map(([label, value], i) => ({
      label, value, color: templates.DEMOGRAPHIC_COLORS[i % templates.DEMOGRAPHIC_COLORS.length]
    }));
    drawBarChart(doc, m, doc.y + 10, pageW, 160, estratoData, {
      title: 'Participación por Estrato Socioeconómico', showValues: true
    });
    doc.y += 180;
    doc.moveDown(0.5);
    writeChartAnalysis(templates.generateDemographicAnalysis('estrato', demographics.estrato, demographics.total));
  }

  // Bar chart: Rangos de edad
  if (demographics.ageRanges && Object.values(demographics.ageRanges).some(v => v > 0)) {
    ensureSpace(doc, 210);
    if (doc.y > 550) doc.addPage();
    const ageData = Object.entries(demographics.ageRanges).map(([label, value], i) => ({
      label, value, color: templates.DEMOGRAPHIC_COLORS[i % templates.DEMOGRAPHIC_COLORS.length]
    }));
    drawBarChart(doc, m, doc.y + 10, pageW, 160, ageData, {
      title: 'Distribución por Rangos de Edad', showValues: true
    });
    doc.y += 180;
    doc.moveDown(0.5);
    writeChartAnalysis(templates.generateDemographicAnalysis('ageRanges', demographics.ageRanges, demographics.total));
  }

  // Bar chart: Personas que dependen económicamente
  if (demographics.dependents && Object.keys(demographics.dependents).length > 0) {
    ensureSpace(doc, 210);
    if (doc.y > 550) doc.addPage();
    const depOrder = ['Ninguna', 'Uno', 'Dos', 'Tres', 'Cuatro o más'];
    const depData = depOrder
      .filter(k => demographics.dependents[k] != null)
      .map((label, i) => ({
        label, value: demographics.dependents[label] || 0,
        color: templates.DEMOGRAPHIC_COLORS[i % templates.DEMOGRAPHIC_COLORS.length]
      }));
    drawBarChart(doc, m, doc.y + 10, pageW, 160, depData, {
      title: 'Personas que dependen económicamente', showValues: true
    });
    doc.y += 180;
    doc.moveDown(0.5);
    writeChartAnalysis(templates.generateDemographicAnalysis('dependents', demographics.dependents, demographics.total));
  }

  // Bar chart: Tipo de cargo
  if (demographics.tipoCargo && Object.keys(demographics.tipoCargo).length > 0) {
    ensureSpace(doc, 210);
    if (doc.y > 550) doc.addPage();
    const cargoData = Object.entries(demographics.tipoCargo).map(([label, value], i) => ({
      label, value, color: templates.DEMOGRAPHIC_COLORS[i % templates.DEMOGRAPHIC_COLORS.length]
    }));
    drawBarChart(doc, m, doc.y + 10, pageW, 160, cargoData, {
      title: 'Distribución por Tipo de Cargo', showValues: true
    });
    doc.y += 180;
    doc.moveDown(0.5);
    writeChartAnalysis(templates.generateDemographicAnalysis('tipoCargo', demographics.tipoCargo, demographics.total));
  }

  // Horizontal bar chart: Tipo de contrato (many categories with long names)
  if (demographics.tipoContrato && Object.keys(demographics.tipoContrato).length > 0) {
    const contratoData = Object.entries(demographics.tipoContrato)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([label, value], i) => ({
        label, value, color: templates.DEMOGRAPHIC_COLORS[i % templates.DEMOGRAPHIC_COLORS.length]
      }));
    const contratoH = contratoData.length * 19 + 30;
    if (doc.y + contratoH + 40 > 750) doc.addPage();
    drawHorizontalBarChart(doc, m, doc.y + 18, pageW, contratoData, {
      title: 'Distribución por Tipo de Contrato', showValues: true, labelWidth: 130
    });
    doc.moveDown(1);
    writeChartAnalysis(templates.generateDemographicAnalysis('tipoContrato', demographics.tipoContrato, demographics.total));
  }

  // Bar chart: Antigüedad en la empresa
  if (demographics.antiguedadEmpresa && Object.values(demographics.antiguedadEmpresa).some(v => v > 0)) {
    ensureSpace(doc, 210);
    if (doc.y > 550) doc.addPage();
    const antData = Object.entries(demographics.antiguedadEmpresa).map(([label, value], i) => ({
      label, value, color: templates.DEMOGRAPHIC_COLORS[i % templates.DEMOGRAPHIC_COLORS.length]
    }));
    drawBarChart(doc, m, doc.y + 10, pageW, 160, antData, {
      title: 'Antigüedad en la empresa', showValues: true
    });
    doc.y += 180;
    doc.moveDown(0.5);
    writeChartAnalysis(templates.generateDemographicAnalysis('antiguedadEmpresa', demographics.antiguedadEmpresa, demographics.total));
  }

  // Bar chart: Horas diarias de trabajo
  if (demographics.horasTrabajo && Object.values(demographics.horasTrabajo).some(v => v > 0)) {
    ensureSpace(doc, 210);
    if (doc.y > 550) doc.addPage();
    const hData = Object.entries(demographics.horasTrabajo).map(([label, value], i) => ({
      label, value, color: templates.DEMOGRAPHIC_COLORS[i % templates.DEMOGRAPHIC_COLORS.length]
    }));
    drawBarChart(doc, m, doc.y + 10, pageW, 160, hData, {
      title: 'Horas diarias de trabajo', showValues: true
    });
    doc.y += 180;
    doc.moveDown(0.5);
    writeChartAnalysis(templates.generateDemographicAnalysis('horasTrabajo', demographics.horasTrabajo, demographics.total));
  }

  // Top departamentos / áreas
  if (demographics.departamento && Object.keys(demographics.departamento).length > 0) {
    ensureSpace(doc, 210);
    if (doc.y > 550) doc.addPage();
    const topDeps = Object.entries(demographics.departamento)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([label, value], i) => ({
        label, value, color: templates.DEMOGRAPHIC_COLORS[i % templates.DEMOGRAPHIC_COLORS.length]
      }));
    drawBarChart(doc, m, doc.y + 10, pageW, 160, topDeps, {
      title: 'Distribución por Departamento / Área (Top 8)', showValues: true
    });
    doc.y += 180;
    doc.moveDown(0.5);
    writeChartAnalysis(templates.generateDemographicAnalysis('departamento', demographics.departamento, demographics.total));
  }

  // ==========================================================
  // FACTORES DE RIESGO PSICOSOCIAL - Overview
  // ==========================================================
  doc.addPage();
  drawSectionBanner(doc, m, doc.y, pageW, 'FACTORES DE RIESGO PSICOSOCIAL');
  doc.y += 40;
  doc.moveDown(0.5);

  // Semicircle gauge with total participants
  const gaugeX = m + pageW / 2;
  const gaugeY = doc.y + 55;
  drawSemicircleGauge(doc, gaugeX, gaugeY, 50, completedParticipants, {
    label: 'Participantes Evaluados'
  });
  doc.y = gaugeY + 45;
  doc.moveDown(1);

  // 3 simple risk bar charts side by side
  const chartW = (pageW - 20) / 3;
  const chartH = 160;
  const chartsY = doc.y;

  // Combine A+B intralaboral
  const generalIntra = {};
  for (const level of RISK_ORDER) {
    generalIntra[level] = (aggResults.intralaboralA.overall[level] || 0) + (aggResults.intralaboralB.overall[level] || 0);
  }
  const intraTotal = sumCounts(generalIntra);

  // Combine A+B extralaboral
  const generalExtra = {};
  for (const level of RISK_ORDER) {
    generalExtra[level] = (aggResults.extralaboral.general.overall[level] || 0);
  }
  const extraTotal = sumCounts(generalExtra);

  // Stress
  const stressGeneral = aggResults.estres.general;
  const stressTotal = sumCounts(stressGeneral);

  // Draw 3 charts
  drawSimpleRiskBars(doc, m, chartsY, chartW, chartH, generalIntra, intraTotal, {
    title: 'Condiciones Intralaborales'
  });
  drawSimpleRiskBars(doc, m + chartW + 10, chartsY, chartW, chartH, generalExtra, extraTotal, {
    title: 'Condiciones Extralaborales'
  });
  drawSimpleRiskBars(doc, m + (chartW + 10) * 2, chartsY, chartW, chartH, stressGeneral, stressTotal, {
    title: 'Estrés'
  });

  doc.y = chartsY + chartH + 15;
  doc.x = m;
  doc.moveDown(0.5);

  // Interpretive text
  doc.fontSize(9).fillColor('#374151').font('Helvetica');
  const intraHighPct = intraTotal > 0 ? (((generalIntra.riesgo_alto || 0) + (generalIntra.riesgo_muy_alto || 0)) / intraTotal * 100).toFixed(1) : 0;
  const extraHighPct = extraTotal > 0 ? (((generalExtra.riesgo_alto || 0) + (generalExtra.riesgo_muy_alto || 0)) / extraTotal * 100).toFixed(1) : 0;
  const stressHighPct = stressTotal > 0 ? (((stressGeneral.riesgo_alto || 0) + (stressGeneral.riesgo_muy_alto || 0)) / stressTotal * 100).toFixed(1) : 0;
  doc.text(`De los ${completedParticipants} participantes evaluados: el ${intraHighPct}% presenta riesgo alto o muy alto en condiciones intralaborales, el ${extraHighPct}% en condiciones extralaborales, y el ${stressHighPct}% en sintomatología asociada al estrés.`, m, doc.y, { width: pageW, align: 'justify' });

  // ==========================================================
  // CONDICIONES INTRALABORALES - Per-form tables + narrative
  // ==========================================================
  doc.addPage();
  drawSectionBanner(doc, m, doc.y, pageW, 'CONDICIONES INTRALABORALES');
  doc.y += 40;
  doc.x = m;
  doc.moveDown(0.5);

  doc.fontSize(10).fillColor('#374151').font('Helvetica');
  doc.text('Los factores intralaborales son entendidos como aquellas características del trabajo y de su organización que influyen en la salud y bienestar del individuo. Los resultados se presentan de forma separada para la Forma A (jefaturas, profesionales y técnicos) y la Forma B (auxiliares y operarios), con su interpretación por dominio y dimensión.', m, doc.y, { width: pageW, align: 'justify' });
  doc.moveDown(0.8);

  const renderedIntraA = renderIntralaboralForm('A');
  const renderedIntraB = renderIntralaboralForm('B');

  // Fallback: if per-form detection produced nothing, show the combined table.
  if (!renderedIntraA && !renderedIntraB) {
    const intraTableData = [];
    templates.DOMAIN_ORDER.forEach(domainKey => {
      intraTableData.push({ isDomain: true, label: templates.DOMAIN_DISPLAY_NAMES[domainKey] });
      const allDims = [...new Set([
        ...(templates.DOMAIN_DIMENSIONS[domainKey].A || []),
        ...(templates.DOMAIN_DIMENSIONS[domainKey].B || [])
      ])];
      allDims.forEach(dimKey => {
        const counts = getCombinedDimCounts(dimKey);
        if (sumCounts(counts) === 0) return;
        intraTableData.push({
          label: templates.DIMENSION_DISPLAY_NAMES[dimKey] || dimKey,
          sin_riesgo: counts.sin_riesgo || 0, riesgo_bajo: counts.riesgo_bajo || 0,
          riesgo_medio: counts.riesgo_medio || 0, riesgo_alto: counts.riesgo_alto || 0,
          riesgo_muy_alto: counts.riesgo_muy_alto || 0
        });
      });
    });
    if (intraTableData.length > templates.DOMAIN_ORDER.length) {
      drawColorCodedRiskTable(doc, m, doc.y, pageW, intraTableData);
    }
  }

  doc.moveDown(0.5);
  ensureSpace(doc, 30);
  doc.x = m;
  doc.fontSize(8).fillColor('#6B7280').font('Helvetica');
  doc.text('Nota: Los resultados se interpretan de acuerdo con los baremos oficiales de la Resolución 2764 de 2022.', m, doc.y, { width: pageW, align: 'justify' });

  // ==========================================================
  // CONDICIONES EXTRALABORALES - Per-form tables + narrative
  // ==========================================================
  doc.addPage();
  drawSectionBanner(doc, m, doc.y, pageW, 'CONDICIONES EXTRALABORALES');
  doc.y += 40;
  doc.x = m;
  doc.moveDown(0.5);

  doc.fontSize(10).fillColor('#374151').font('Helvetica');
  doc.text('Comprenden los aspectos del entorno familiar, social y económico del trabajador, así como las condiciones del lugar de vivienda, que pueden influir en su salud y bienestar. Los resultados se presentan separados por forma.', m, doc.y, { width: pageW, align: 'justify' });
  doc.moveDown(0.8);

  const renderedExtraA = renderExtralaboralForm('A');
  const renderedExtraB = renderExtralaboralForm('B');

  // Fallback: combined extralaboral table + narrative if no per-form data
  if (!renderedExtraA && !renderedExtraB) {
    const extraDimKeys = templates.EXTRALABORAL_DIMENSIONS.filter(dk =>
      aggResults.extralaboral.general.dimensions[dk] && sumCounts(aggResults.extralaboral.general.dimensions[dk]) > 0);
    const extraTableData = extraDimKeys.map(dimKey => {
      const counts = aggResults.extralaboral.general.dimensions[dimKey];
      return {
        label: templates.DIMENSION_DISPLAY_NAMES[dimKey] || dimKey,
        sin_riesgo: counts.sin_riesgo || 0, riesgo_bajo: counts.riesgo_bajo || 0,
        riesgo_medio: counts.riesgo_medio || 0, riesgo_alto: counts.riesgo_alto || 0,
        riesgo_muy_alto: counts.riesgo_muy_alto || 0
      };
    });
    if (extraTableData.length > 0) {
      drawColorCodedRiskTable(doc, m, doc.y, pageW, extraTableData);
      doc.moveDown(1);
      extraDimKeys.forEach(dimKey => writeNarrative(templates.generateDimensionNarrative(dimKey, aggResults.extralaboral.general.dimensions[dimKey])));
    }
  }

  // ==========================================================
  // ESTRÉS
  // ==========================================================
  doc.addPage();
  drawSectionBanner(doc, m, doc.y, pageW, 'PERCEPCIÓN DE SINTOMATOLOGÍA ASOCIADA AL ESTRÉS');
  doc.y += 40;
  doc.moveDown(0.5);

  doc.fontSize(10).fillColor('#374151').font('Helvetica');
  doc.text('El estrés es una respuesta del organismo ante situaciones que generan tensión. Puede producir enfermedad a través de respuestas fisiológicas prolongadas y conductas de riesgo. Los resultados se presentan separados por forma.', m, doc.y, { width: pageW, align: 'justify' });
  doc.moveDown(0.8);

  const renderedStressA = renderStressForm('A');
  const renderedStressB = renderStressForm('B');

  // Fallback: combined stress bars + narrative if no per-form data
  if (!renderedStressA && !renderedStressB && stressTotal > 0) {
    doc.y += 20;
    drawSimpleRiskBars(doc, m + 50, doc.y, pageW - 100, 170, stressGeneral, stressTotal, {
      title: 'Sintomatología Asociada al Estrés'
    });
    doc.x = m;
    doc.y += 185;
    doc.moveDown(0.5);
    templates.generateStressAnalysis(stressGeneral, null).forEach(p => writeNarrative(p, { color: '#1F2937' }));
  }

  // Stress typology chart (combined across both forms)
  if (stressTypology && Object.keys(stressTypology).length > 0 && stressTotal > 0) {
    ensureSpace(doc, 200);
    if (doc.y > 500) doc.addPage();

    doc.x = m;
    doc.fontSize(10).fillColor('#1F2937').font('Helvetica-Bold');
    doc.text('Tipología de Síntomas de Estrés (general)', m, doc.y, { width: pageW });
    doc.moveDown(0.5);

    const typologyColors = ['#EF4444', '#F97316', '#3B82F6', '#8B5CF6'];
    const typologyData = Object.entries(stressTypology).map(([label, value], i) => ({
      label, value, color: typologyColors[i % typologyColors.length]
    }));

    drawBarChart(doc, m, doc.y + 10, pageW, 160, typologyData, {
      title: 'Contribución por Tipo de Síntoma (%)', showValues: true
    });
    doc.x = m;
    doc.y += 180;
    doc.moveDown(0.5);

    const sortedTypes = Object.entries(stressTypology).sort((a, b) => b[1] - a[1]);
    doc.fontSize(9).fillColor('#374151').font('Helvetica');
    doc.text('Los principales tipos de sintomatología reportados son:', m, doc.y, { width: pageW });
    doc.moveDown(0.2);
    sortedTypes.slice(0, 3).forEach(([name, pct], i) => {
      doc.text(`  ${i + 1}. ${name}: ${pct}%`, m, doc.y, { width: pageW });
    });
  }

  // ==========================================================
  // MATRIZ DE RIESGO PARA PRIORIZACIÓN
  // ==========================================================
  doc.addPage();
  drawSectionBanner(doc, m, doc.y, pageW, 'MATRIZ DE RIESGO PARA PRIORIZACIÓN');
  doc.y += 40;
  doc.moveDown(0.5);

  doc.fontSize(10).fillColor('#374151').font('Helvetica');
  doc.text('La siguiente matriz permite priorizar las intervenciones considerando la magnitud del riesgo (proporción de trabajadores en riesgo medio, alto y muy alto) por cada dimensión evaluada.', { width: pageW, align: 'justify' });
  doc.moveDown(0.5);

  if (riskMatrix && riskMatrix.length > 0) {
    // Sort by magnitud descending
    const sortedMatrix = [...riskMatrix].sort((a, b) => b.magnitud - a.magnitud);
    // Map dimension keys to display names
    const matrixDisplayData = sortedMatrix.map(item => ({
      ...item,
      label: templates.DIMENSION_DISPLAY_NAMES[item.dimension] || item.dimension
    }));
    drawRiskPrioritizationMatrix(doc, m, doc.y, pageW, matrixDisplayData);
  }

  doc.moveDown(1);
  ensureSpace(doc, 60);
  doc.fontSize(8).fillColor('#6B7280').font('Helvetica');
  doc.text('Magnitud: % de trabajadores en riesgo medio + alto + muy alto. Verde: <40%, Amarillo: 40-60%, Naranja: 60-80%, Rojo: >80%.', { width: pageW, align: 'justify' });

  // ==========================================================
  // DEMANDAS DEL TRABAJO POR TIPO DE CARGO
  // ==========================================================
  if (demandasPorCargo && demandasPorCargo.length > 0) {
    doc.addPage();
    drawSectionBanner(doc, m, doc.y, pageW, 'DEMANDAS DEL TRABAJO POR TIPO DE CARGO');
    doc.y += 40;
    doc.moveDown(0.5);

    doc.fontSize(10).fillColor('#374151').font('Helvetica');
    doc.text(
      'Esta sección desglosa los resultados del dominio Demandas del Trabajo por tipo de cargo (Jefatura, Profesional / Técnico, Auxiliar / Asistente, Operario / Servicios generales). Es información de referencia para los Programas de Vigilancia Epidemiológica (PVE) y para sustentar solicitudes ante el Ministerio del Trabajo, ya que permite identificar grupos ocupacionales con mayor exposición a las exigencias del puesto.',
      { width: pageW, align: 'justify' }
    );
    doc.moveDown(1);

    // Resumen consolidado por cargo (gráfica de barras agrupadas: cargos × niveles de riesgo)
    const cargoLabels = demandasPorCargo.map(c => `${c.cargo} (n=${c.participantCount})`);
    const cargoSeries = RISK_ORDER.map(level => ({
      label: RISK_LABELS[level],
      color: RISK_COLORS[level],
      values: demandasPorCargo.map(c => c.domainCounts[level] || 0)
    }));

    ensureSpace(doc, 260);
    drawGroupedBarChart(doc, m, doc.y + 10, pageW, 220, cargoLabels, cargoSeries, {
      title: 'Distribución de riesgo en Demandas del Trabajo (Total dominio)',
      showLegend: true, showValues: true
    });
    doc.y += 245;
    doc.x = m;
    doc.moveDown(0.5);

    // Texto interpretativo
    ensureSpace(doc, 80);
    doc.fontSize(9).fillColor('#374151').font('Helvetica');
    demandasPorCargo.forEach(c => {
      const total = sumCounts(c.domainCounts);
      if (total === 0) return;
      const high = (c.domainCounts.riesgo_alto || 0) + (c.domainCounts.riesgo_muy_alto || 0);
      const highPct = (high / total * 100).toFixed(1);
      const low = (c.domainCounts.sin_riesgo || 0) + (c.domainCounts.riesgo_bajo || 0);
      const lowPct = (low / total * 100).toFixed(1);
      ensureSpace(doc, 22);
      doc.font('Helvetica-Bold').text(`• ${c.cargo} (n=${c.participantCount}): `, { continued: true, width: pageW });
      doc.font('Helvetica').text(`${highPct}% en riesgo alto/muy alto, ${lowPct}% sin riesgo o riesgo bajo en Demandas del Trabajo.`, { width: pageW });
      doc.moveDown(0.2);
    });
    doc.moveDown(1);

    // Tabla detallada por dimensión × cargo
    demandasPorCargo.forEach(c => {
      const dimensionEntries = Object.entries(c.dimensions);
      if (dimensionEntries.length === 0) return;

      ensureSpace(doc, 100);
      if (doc.y > 600) doc.addPage();

      doc.fontSize(11).fillColor('#1F2937').font('Helvetica-Bold');
      doc.text(`${c.cargo} — Detalle por dimensión (n=${c.participantCount})`, m, doc.y, { width: pageW });
      doc.moveDown(0.5);

      const tableData = dimensionEntries.map(([dimKey, counts]) => ({
        label: templates.DIMENSION_DISPLAY_NAMES[dimKey] || dimKey,
        sin_riesgo: counts.sin_riesgo || 0,
        riesgo_bajo: counts.riesgo_bajo || 0,
        riesgo_medio: counts.riesgo_medio || 0,
        riesgo_alto: counts.riesgo_alto || 0,
        riesgo_muy_alto: counts.riesgo_muy_alto || 0
      }));

      drawColorCodedRiskTable(doc, m, doc.y, pageW, tableData);
      doc.moveDown(1);
    });

    doc.moveDown(0.5);
    ensureSpace(doc, 60);
    doc.fontSize(8).fillColor('#6B7280').font('Helvetica');
    doc.text('Nota: La clasificación por tipo de cargo proviene del campo "Tipo de cargo" diligenciado en la Ficha de Datos Generales (Resolución 2646/2008). Los participantes sin tipo de cargo registrado no se incluyen en esta tabla.', { width: pageW, align: 'justify' });
  }

  // ==========================================================
  // RESULTADOS POR ÁREA (if applicable)
  // ==========================================================
  if (areaResults && Object.keys(areaResults).length > 0) {
    for (const [areaName, areaAgg] of Object.entries(areaResults)) {
      doc.addPage();
      drawSectionBanner(doc, m, doc.y, pageW, `RESULTADOS: ${areaName.toUpperCase()}`);
      doc.y += 40;
      doc.moveDown(0.5);

      // Semicircle gauge for area
      const areaPop = areaAgg.population.total;
      const areaGaugeX = m + pageW / 2;
      const areaGaugeY = doc.y + 50;
      drawSemicircleGauge(doc, areaGaugeX, areaGaugeY, 40, areaPop, {
        label: 'Participantes'
      });
      doc.y = areaGaugeY + 40;
      doc.moveDown(0.5);

      // 3 bar charts for area
      const aChartW = (pageW - 20) / 3;
      const aChartH = 140;
      const aChartsY = doc.y;

      const areaIntra = {};
      for (const level of RISK_ORDER) {
        areaIntra[level] = (areaAgg.intralaboralA.overall[level] || 0) + (areaAgg.intralaboralB.overall[level] || 0);
      }
      const areaIntraTotal = sumCounts(areaIntra);

      const areaExtra = areaAgg.extralaboral.general.overall || {};
      const areaExtraTotal = sumCounts(areaExtra);

      const areaStress = areaAgg.estres.general;
      const areaStressTotal = sumCounts(areaStress);

      drawSimpleRiskBars(doc, m, aChartsY, aChartW, aChartH, areaIntra, areaIntraTotal, {
        title: 'Intralaboral'
      });
      drawSimpleRiskBars(doc, m + aChartW + 10, aChartsY, aChartW, aChartH, areaExtra, areaExtraTotal, {
        title: 'Extralaboral'
      });
      drawSimpleRiskBars(doc, m + (aChartW + 10) * 2, aChartsY, aChartW, aChartH, areaStress, areaStressTotal, {
        title: 'Estrés'
      });
      doc.y = aChartsY + aChartH + 15;
      doc.x = m;

      // Intralaboral color-coded table for area
      doc.addPage();
      doc.fontSize(10).fillColor('#1F2937').font('Helvetica-Bold');
      doc.text(`Condiciones Intralaborales - ${areaName}`, m, doc.y, { width: pageW });
      doc.moveDown(0.5);

      const areaIntraTable = [];
      templates.DOMAIN_ORDER.forEach(domainKey => {
        const domainName = templates.DOMAIN_DISPLAY_NAMES[domainKey];
        areaIntraTable.push({ isDomain: true, label: domainName });

        const allDims = [...new Set([
          ...(templates.DOMAIN_DIMENSIONS[domainKey].A || []),
          ...(templates.DOMAIN_DIMENSIONS[domainKey].B || [])
        ])];

        allDims.forEach(dimKey => {
          const a = areaAgg.intralaboralA.dimensions[dimKey] || { sin_riesgo: 0, riesgo_bajo: 0, riesgo_medio: 0, riesgo_alto: 0, riesgo_muy_alto: 0 };
          const b = areaAgg.intralaboralB.dimensions[dimKey] || { sin_riesgo: 0, riesgo_bajo: 0, riesgo_medio: 0, riesgo_alto: 0, riesgo_muy_alto: 0 };
          const counts = {};
          for (const level of RISK_ORDER) counts[level] = (a[level] || 0) + (b[level] || 0);
          const total = sumCounts(counts);
          if (total === 0) return;
          areaIntraTable.push({
            label: templates.DIMENSION_DISPLAY_NAMES[dimKey] || dimKey,
            sin_riesgo: counts.sin_riesgo || 0,
            riesgo_bajo: counts.riesgo_bajo || 0,
            riesgo_medio: counts.riesgo_medio || 0,
            riesgo_alto: counts.riesgo_alto || 0,
            riesgo_muy_alto: counts.riesgo_muy_alto || 0
          });
        });
      });

      if (areaIntraTable.length > 1) {
        drawColorCodedRiskTable(doc, m, doc.y, pageW, areaIntraTable);
      }

      // Extralaboral color-coded table for area
      doc.moveDown(1);
      ensureSpace(doc, 100);
      if (doc.y > 500) doc.addPage();

      doc.fontSize(10).fillColor('#1F2937').font('Helvetica-Bold');
      doc.text(`Condiciones Extralaborales - ${areaName}`, m, doc.y, { width: pageW });
      doc.moveDown(0.5);

      const areaExtraTable = [];
      const areaExtraDims = templates.EXTRALABORAL_DIMENSIONS.filter(dk => areaAgg.extralaboral.general.dimensions[dk]);
      areaExtraDims.forEach(dimKey => {
        const counts = areaAgg.extralaboral.general.dimensions[dimKey];
        const total = sumCounts(counts);
        if (total === 0) return;
        areaExtraTable.push({
          label: templates.DIMENSION_DISPLAY_NAMES[dimKey] || dimKey,
          sin_riesgo: counts.sin_riesgo || 0,
          riesgo_bajo: counts.riesgo_bajo || 0,
          riesgo_medio: counts.riesgo_medio || 0,
          riesgo_alto: counts.riesgo_alto || 0,
          riesgo_muy_alto: counts.riesgo_muy_alto || 0
        });
      });

      if (areaExtraTable.length > 0) {
        drawColorCodedRiskTable(doc, m, doc.y, pageW, areaExtraTable);
      }
    }
  }

  // ==========================================================
  // ESTRATEGIAS DE AFRONTAMIENTO (COPING)
  // ==========================================================
  const copingTotal = sumCounts(aggResults.coping.overall);
  if (copingTotal > 0) {
    doc.addPage();
    drawSectionBanner(doc, m, doc.y, pageW, 'ESTRATEGIAS DE AFRONTAMIENTO (BRIEF COPE)');
    doc.y += 40;
    doc.moveDown(0.5);

    doc.fontSize(10).fillColor('#374151').font('Helvetica');
    doc.text('El Brief COPE (COPE-28) evalúa las estrategias de afrontamiento ante situaciones de estrés. Se compone de 14 subescalas agrupadas en: afrontamiento centrado en el problema, centrado en la emoción, y evitativo.', { width: pageW, align: 'justify' });
    doc.moveDown(1);

    // Coping overall pie chart
    const chartRadius = 70;
    const chartCenterX = m + chartRadius + 10;
    const COPING_ORDER = ['muy_bajo', 'bajo', 'medio', 'alto', 'muy_alto'];
    const copingPieData = COPING_ORDER.map(key => ({
      label: COPING_LEVEL_LABELS[key],
      value: aggResults.coping.overall[key],
      color: COPING_LEVEL_COLORS[key]
    }));

    const copingY = doc.y + chartRadius + 5;
    drawPieChart(doc, chartCenterX, copingY, chartRadius, copingPieData, {
      showPercentages: true,
      showLegend: true,
      legendX: chartCenterX + chartRadius + 30,
      legendY: copingY - 40,
      title: 'Nivel General de Estrategias de Afrontamiento'
    });
    doc.y = copingY + chartRadius + 30;
    doc.moveDown(0.5);

    // Category summary
    const categoryEntries = Object.entries(aggResults.coping.categories);
    if (categoryEntries.length > 0) {
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#1F2937').text('Resultados por Categoría:');
      doc.moveDown(0.3);
      doc.fontSize(9).font('Helvetica').fillColor('#374151');

      const catNames = {
        problem_focused_total: 'Centrado en el problema',
        emotion_focused_total: 'Centrado en la emoción',
        avoidant_total: 'Evitativo'
      };

      categoryEntries.forEach(([catKey, counts]) => {
        const catTotal = sumCounts(counts);
        const highUse = (counts.alto || 0) + (counts.muy_alto || 0);
        const highPct = catTotal > 0 ? ((highUse / catTotal) * 100).toFixed(0) : 0;
        const catName = catNames[catKey] || catKey;
        doc.text(`  • ${catName}: ${highPct}% uso alto o muy alto.`, { width: pageW });
        doc.moveDown(0.2);
      });
      doc.moveDown(0.5);
    }

    // Subscale grouped bar chart
    const subscaleEntries = Object.entries(aggResults.coping.subscales);
    if (subscaleEntries.length > 0) {
      ensureSpace(doc, 250);
      if (doc.y > 480) doc.addPage();

      const copingSubLabels = subscaleEntries.map(([key]) => {
        const name = templates.DIMENSION_DISPLAY_NAMES[key] || key;
        return name.length > 18 ? name.substring(0, 16) + '...' : name;
      });

      const copingSubKeys = subscaleEntries.map(([key]) => key);
      const copingSubRiskCounts = {};
      subscaleEntries.forEach(([key, counts]) => { copingSubRiskCounts[key] = counts; });

      const copingSeries = COPING_ORDER.map(riskKey => ({
        label: COPING_LEVEL_LABELS[riskKey],
        color: COPING_LEVEL_COLORS[riskKey],
        values: copingSubKeys.map(dk => (copingSubRiskCounts[dk] || {})[riskKey] || 0)
      }));

      drawGroupedBarChart(doc, m, doc.y + 15, pageW, 220, copingSubLabels, copingSeries, {
        title: 'Subescalas de Afrontamiento (Brief COPE)', showLegend: true, showValues: true
      });
      doc.y += 245;
    }
  }

  // ==========================================================
  // PLAN DE ACCIÓN DE INTERVENCIÓN PSICOSOCIAL
  // ==========================================================
  doc.addPage();
  drawSectionBanner(doc, m, doc.y, pageW, 'PLAN DE ACCIÓN DE INTERVENCIÓN PSICOSOCIAL');
  doc.y += 40;
  doc.x = m;
  doc.moveDown(0.5);
  writeNarrative('A partir de los resultados obtenidos se propone el siguiente plan de acción, organizado por dominio y por factor, con el objetivo y las acciones sugeridas para la intervención y el monitoreo del riesgo psicosocial. El nivel de riesgo indicado corresponde al resultado medido en la población evaluada.');

  const planLevelFor = (key) => {
    let counts;
    if (key === 'extralaboral') counts = aggResults.extralaboral.general.overall || {};
    else if (key === 'estres') counts = aggResults.estres.general || {};
    else {
      counts = {};
      for (const level of RISK_ORDER) {
        counts[level] = ((aggResults.intralaboralA.domains[key] || {})[level] || 0) + ((aggResults.intralaboralB.domains[key] || {})[level] || 0);
      }
    }
    const r = templates.classifyGroupRisk(counts);
    return r.total > 0 ? r.label : null;
  };

  templates.INTERVENTION_PLAN_ORDER.forEach(key => {
    const plan = templates.INTERVENTION_PLAN[key];
    if (!plan) return;
    const title = templates.INTERVENTION_PLAN_TITLES[key] || key;
    const level = planLevelFor(key);

    ensureSpace(doc, 120);
    if (doc.y > 630) doc.addPage();
    doc.x = m;
    doc.fontSize(11).fillColor('#1E40AF').font('Helvetica-Bold');
    doc.text(level ? `${title}  (nivel de riesgo ${level})` : title, m, doc.y, { width: pageW });
    doc.moveDown(0.3);

    doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#1F2937').text('Objetivo:', m, doc.y, { width: pageW });
    doc.font('Helvetica').fillColor('#374151').text(plan.objetivo, m, doc.y, { width: pageW, align: 'justify' });
    doc.moveDown(0.3);

    doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#1F2937').text('Acciones:', m, doc.y, { width: pageW });
    doc.moveDown(0.15);
    doc.fontSize(9).font('Helvetica').fillColor('#374151');
    plan.acciones.forEach((a, i) => {
      ensureSpace(doc, 22);
      doc.text(`${i + 1}. ${a}`, m, doc.y, { width: pageW, align: 'justify' });
      doc.moveDown(0.12);
    });
    doc.moveDown(0.6);
  });

  // ==========================================================
  // RECOMENDACIONES
  // ==========================================================
  doc.addPage();
  drawSectionBanner(doc, m, doc.y, pageW, 'RECOMENDACIONES');
  doc.y += 40;
  doc.moveDown(0.5);

  doc.fontSize(10).fillColor('#374151').font('Helvetica');
  doc.text('Con base en los resultados obtenidos se recomienda:', { width: pageW, align: 'justify' });
  doc.moveDown(0.5);

  const priorities = Array.isArray(t.recomendaciones) ? t.recomendaciones.filter(Boolean) : [];
  priorities.forEach((p, i) => {
    ensureSpace(doc, 30);
    doc.fontSize(10).fillColor('#374151').font('Helvetica');
    doc.text(`${i + 1}. ${p}`, { width: pageW, align: 'justify' });
    doc.moveDown(0.3);
  });

  doc.moveDown(0.5);
  doc.fontSize(10).fillColor('#1F2937').font('Helvetica-Bold');
  doc.text('Intervención prioritaria:', { width: pageW });
  doc.moveDown(0.3);
  doc.fontSize(9).fillColor('#374151').font('Helvetica');
  doc.text(t.intervencionPrioritaria || '', { width: pageW, align: 'justify' });

  // List priority dimensions
  const topRisk = atRiskDimensions.filter(d => d.highRiskPct > 20).slice(0, 10);
  if (topRisk.length > 0) {
    doc.moveDown(0.5);
    topRisk.forEach(d => {
      ensureSpace(doc, 15);
      const name = templates.DIMENSION_DISPLAY_NAMES[d.dimension] || d.dimension;
      doc.text(`  • ${name} (${d.highRiskPct.toFixed(0)}% en riesgo alto/muy alto)`, { width: pageW });
    });
  }

  // ==========================================================
  // CONCLUSIONES
  // ==========================================================
  doc.addPage();
  drawSectionBanner(doc, m, doc.y, pageW, 'CONCLUSIONES');
  doc.y += 40;
  doc.moveDown(0.5);

  doc.fontSize(10).fillColor('#374151').font('Helvetica');

  const renderTopRiskList = () => {
    if (topRisk.length === 0) return;
    doc.text('Las dimensiones que requieren mayor atención son:', { width: pageW });
    doc.moveDown(0.2);
    topRisk.slice(0, 5).forEach(d => {
      const name = templates.DIMENSION_DISPLAY_NAMES[d.dimension] || d.dimension;
      doc.text(`  • ${name} (${d.highRiskPct.toFixed(0)}% en riesgo alto/muy alto)`, { width: pageW });
    });
    doc.moveDown(0.5);
  };

  const conclParas = Array.isArray(t.conclusiones) ? t.conclusiones.filter(Boolean) : [];
  if (conclParas.length === 0) {
    renderTopRiskList();
  } else {
    // Weave the auto-generated at-risk-dimension list in just before the
    // closing (last) paragraph, matching the reference report layout.
    const lastIdx = conclParas.length - 1;
    conclParas.forEach((p, i) => {
      if (i === lastIdx) renderTopRiskList();
      doc.text(p, { width: pageW, align: 'justify' });
      doc.moveDown(0.5);
    });
  }

  // Signature
  drawEvaluatorSignature(doc, evaluator, pageW, m);
}

function fmtDate(d) {
  if (!d) return 'N/A';
  try { return new Date(d).toLocaleDateString('es-CO'); } catch { return 'N/A'; }
}

function addFooters(doc) {
  const pages = doc.bufferedPageRange();
  const totalPages = pages.count;
  const dateStr = new Date().toLocaleString('es-CO');

  // Prevent PDFKit from creating new pages during footer/switchToPage writing
  const origAddPage = doc.addPage;
  doc.addPage = function() { return doc; };

  for (let i = 0; i < totalPages; i++) {
    doc.switchToPage(i);
    doc.fontSize(7).fillColor('#9CA3AF');
    doc.text(
      `Fecha: ${dateStr} | Página ${i + 1} de ${totalPages}`,
      doc.page.margins.left,
      doc.page.height - 25,
      { width: doc.page.width - doc.page.margins.left * 2, align: 'center', lineBreak: false }
    );
  }

  doc.addPage = origAddPage;
}

module.exports = router;
