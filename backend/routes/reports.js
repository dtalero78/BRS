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
    const { evaluationId, includeIndividualSummaries } = req.body;

    if (!evaluationId) {
      return res.status(400).json({ error: 'evaluationId es requerido' });
    }

    // Get evaluation + company data
    const evaluationQuery = db('evaluations as e')
      .join('companies as c', 'e.company_id', 'c.id')
      .where('e.id', evaluationId)
      .select(
        'e.id', 'e.name', 'e.description', 'e.start_date', 'e.end_date', 'e.status', 'e.paid',
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
      evaluator: evaluatorObj
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
// PDF GENERATION HELPERS
// ============================================================

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

function generateOrganizationalPDF(doc, { evaluation, demographics, aggResults, atRiskDimensions, stressTypology, riskMatrix, areaResults, demandasPorCargo, totalParticipants, completedParticipants, evaluator }) {
  const m = doc.page.margins.left;
  const pageW = doc.page.width - m * 2;

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
  // PAGE 2: OBJETIVOS + METODOLOGÍA (two columns)
  // ==========================================================
  doc.addPage();
  templates.writeObjetivosMetodologia(doc, pageW, evaluation.company_name);

  // ==========================================================
  // PAGE 3: PROCEDIMIENTOS
  // ==========================================================
  doc.addPage();
  templates.writeProcedimientos(doc, pageW);

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
  doc.text('A continuación se presenta el perfil sociodemográfico de la población evaluada:', { width: pageW, align: 'justify' });
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

    const majorGender = Object.entries(demographics.gender).sort((a, b) => b[1] - a[1])[0];
    if (majorGender) {
      const pct = demographics.total > 0 ? ((majorGender[1] / demographics.total) * 100).toFixed(1) : 0;
      doc.fontSize(9).fillColor('#374151').font('Helvetica');
      doc.text(`La mayoría de la población evaluada son ${majorGender[0]} con un ${pct}% del total.`, { width: pageW, align: 'justify' });
    }
    doc.moveDown(1);
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

    const majorEdu = Object.entries(demographics.education).sort((a, b) => b[1] - a[1])[0];
    if (majorEdu) {
      const pct = demographics.total > 0 ? ((majorEdu[1] / demographics.total) * 100).toFixed(1) : 0;
      doc.fontSize(9).fillColor('#374151').font('Helvetica');
      doc.text(`El nivel de estudio predominante es ${majorEdu[0]} con un ${pct}% de la población.`, { width: pageW, align: 'justify' });
    }
    doc.moveDown(1);
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
  // CONDICIONES INTRALABORALES - Color-Coded Table
  // ==========================================================
  doc.addPage();
  drawSectionBanner(doc, m, doc.y, pageW, 'CONDICIONES INTRALABORALES');
  doc.y += 40;
  doc.moveDown(0.5);

  doc.fontSize(10).fillColor('#374151').font('Helvetica');
  doc.text('Los factores intralaborales son entendidos como aquellas características del trabajo y de su organización que influyen en la salud y bienestar del individuo. A continuación se presenta la distribución porcentual de riesgo por dominio y dimensión.', { width: pageW, align: 'justify' });
  doc.moveDown(0.5);

  // Build data for color-coded table
  const intraTableData = [];
  templates.DOMAIN_ORDER.forEach(domainKey => {
    const domainName = templates.DOMAIN_DISPLAY_NAMES[domainKey];
    // Domain total row
    const domainCounts = {};
    for (const level of RISK_ORDER) {
      domainCounts[level] = ((aggResults.intralaboralA.domains[domainKey] || {})[level] || 0) + ((aggResults.intralaboralB.domains[domainKey] || {})[level] || 0);
    }
    intraTableData.push({ isDomain: true, label: domainName });

    // Get all dimensions for this domain (combine A and B lists, deduplicate)
    const allDims = [...new Set([
      ...(templates.DOMAIN_DIMENSIONS[domainKey].A || []),
      ...(templates.DOMAIN_DIMENSIONS[domainKey].B || [])
    ])];

    allDims.forEach(dimKey => {
      const counts = getCombinedDimCounts(dimKey);
      const total = sumCounts(counts);
      if (total === 0) return;
      const dimName = templates.DIMENSION_DISPLAY_NAMES[dimKey] || dimKey;
      intraTableData.push({
        label: dimName,
        sin_riesgo: counts.sin_riesgo || 0,
        riesgo_bajo: counts.riesgo_bajo || 0,
        riesgo_medio: counts.riesgo_medio || 0,
        riesgo_alto: counts.riesgo_alto || 0,
        riesgo_muy_alto: counts.riesgo_muy_alto || 0
      });
    });
  });

  drawColorCodedRiskTable(doc, m, doc.y, pageW, intraTableData);

  // ==========================================================
  // DIMENSION ANALYSIS TEXT
  // ==========================================================
  doc.moveDown(1);
  ensureSpace(doc, 100);
  if (doc.y > 650) doc.addPage();

  doc.fontSize(10).fillColor('#1F2937').font('Helvetica-Bold');
  doc.text('Análisis por Dimensión', { width: pageW });
  doc.moveDown(0.5);
  doc.fontSize(8).fillColor('#374151').font('Helvetica');

  templates.DOMAIN_ORDER.forEach(domainKey => {
    const allDims = [...new Set([
      ...(templates.DOMAIN_DIMENSIONS[domainKey].A || []),
      ...(templates.DOMAIN_DIMENSIONS[domainKey].B || [])
    ])];
    allDims.forEach(dimKey => {
      const counts = getCombinedDimCounts(dimKey);
      const total = sumCounts(counts);
      if (total === 0) return;
      ensureSpace(doc, 25);
      const dimName = templates.DIMENSION_DISPLAY_NAMES[dimKey] || dimKey;
      const highPct = (((counts.riesgo_alto || 0) + (counts.riesgo_muy_alto || 0)) / total * 100).toFixed(1);
      const lowPct = (((counts.sin_riesgo || 0) + (counts.riesgo_bajo || 0)) / total * 100).toFixed(1);
      doc.font('Helvetica-Bold').text(`• ${dimName}: `, { continued: true, width: pageW });
      doc.font('Helvetica').text(`${lowPct}% sin riesgo/bajo, ${highPct}% alto/muy alto.`, { width: pageW });
      doc.moveDown(0.2);
    });
  });

  doc.moveDown(0.5);
  doc.fontSize(8).fillColor('#6B7280').font('Helvetica');
  doc.text('Nota: Los resultados se interpretan de acuerdo a los baremos oficiales de la Resolución 2764 de 2022.', { width: pageW, align: 'justify' });

  // ==========================================================
  // CONDICIONES EXTRALABORALES - Color-Coded Table
  // ==========================================================
  doc.addPage();
  drawSectionBanner(doc, m, doc.y, pageW, 'CONDICIONES EXTRALABORALES');
  doc.y += 40;
  doc.moveDown(0.5);

  doc.fontSize(10).fillColor('#374151').font('Helvetica');
  doc.text('Comprenden los aspectos del entorno familiar, social y económico del trabajador. A su vez, abarcan las condiciones del lugar de vivienda, que pueden influir en la salud y bienestar del individuo.', { width: pageW, align: 'justify' });
  doc.moveDown(0.5);

  // Extralaboral total box
  const extraOverall = aggResults.extralaboral.general.overall || {};
  const extraOverallTotal = sumCounts(extraOverall);
  if (extraOverallTotal > 0) {
    // Find dominant risk level
    let maxLevel = 'sin_riesgo';
    let maxCount = 0;
    for (const level of RISK_ORDER) {
      if ((extraOverall[level] || 0) > maxCount) {
        maxCount = extraOverall[level];
        maxLevel = level;
      }
    }
    doc.save();
    doc.rect(m, doc.y, pageW, 30).fillColor('#E0F2F1').fill();
    doc.rect(m, doc.y, pageW, 30).strokeColor('#0D9488').lineWidth(1).stroke();
    doc.fontSize(9).fillColor('#004D40').font('Helvetica-Bold');
    doc.text(`Total cuestionario EXTRALABORAL: ${RISK_LABELS[maxLevel]} (${((maxCount / extraOverallTotal) * 100).toFixed(1)}% de la población)`, m + 10, doc.y + 9, { width: pageW - 20 });
    doc.restore();
    doc.y += 40;
    doc.moveDown(0.5);
  }

  // Build extralaboral color-coded table
  const extraTableData = [];
  const extraDimKeys = templates.EXTRALABORAL_DIMENSIONS.filter(dk => aggResults.extralaboral.general.dimensions[dk]);

  extraDimKeys.forEach(dimKey => {
    const counts = aggResults.extralaboral.general.dimensions[dimKey];
    const total = sumCounts(counts);
    if (total === 0) return;
    const dimName = templates.DIMENSION_DISPLAY_NAMES[dimKey] || dimKey;
    extraTableData.push({
      label: dimName,
      sin_riesgo: counts.sin_riesgo || 0,
      riesgo_bajo: counts.riesgo_bajo || 0,
      riesgo_medio: counts.riesgo_medio || 0,
      riesgo_alto: counts.riesgo_alto || 0,
      riesgo_muy_alto: counts.riesgo_muy_alto || 0
    });
  });

  if (extraTableData.length > 0) {
    drawColorCodedRiskTable(doc, m, doc.y, pageW, extraTableData);
  }

  // Extralaboral analysis text
  doc.moveDown(1);
  ensureSpace(doc, 60);
  doc.fontSize(8).fillColor('#374151').font('Helvetica');
  extraDimKeys.forEach(dk => {
    const rc = aggResults.extralaboral.general.dimensions[dk];
    if (!rc) return;
    const total = sumCounts(rc);
    if (total === 0) return;
    ensureSpace(doc, 20);
    const dimName = templates.DIMENSION_DISPLAY_NAMES[dk] || dk;
    const highPct = (((rc.riesgo_alto || 0) + (rc.riesgo_muy_alto || 0)) / total * 100).toFixed(1);
    const lowPct = (((rc.sin_riesgo || 0) + (rc.riesgo_bajo || 0)) / total * 100).toFixed(1);
    doc.font('Helvetica-Bold').text(`• ${dimName}: `, { continued: true, width: pageW });
    doc.font('Helvetica').text(`${lowPct}% sin riesgo/bajo, ${highPct}% alto/muy alto.`, { width: pageW });
    doc.moveDown(0.2);
  });

  // ==========================================================
  // ESTRÉS
  // ==========================================================
  doc.addPage();
  drawSectionBanner(doc, m, doc.y, pageW, 'PERCEPCIÓN DE SINTOMATOLOGÍA ASOCIADA AL ESTRÉS');
  doc.y += 40;
  doc.moveDown(0.5);

  doc.fontSize(10).fillColor('#374151').font('Helvetica');
  doc.text('El estrés es una respuesta del organismo ante situaciones que generan tensión. Puede producir enfermedad a través de respuestas fisiológicas prolongadas y conductas de riesgo.', { width: pageW, align: 'justify' });
  doc.moveDown(0.5);

  if (stressTotal > 0) {
    // Simple 5-bar chart for stress — start 20px lower to leave room for the title (drawn at y-12)
    doc.y += 20;
    drawSimpleRiskBars(doc, m + 50, doc.y, pageW - 100, 170, stressGeneral, stressTotal, {
      title: 'Sintomatología Asociada al Estrés'
    });
    doc.x = m;
    doc.y += 185;
    doc.moveDown(0.5);

    const stHighPct = (((stressGeneral.riesgo_alto || 0) + (stressGeneral.riesgo_muy_alto || 0)) / stressTotal * 100).toFixed(1);
    const stLowPct = (((stressGeneral.sin_riesgo || 0) + (stressGeneral.riesgo_bajo || 0)) / stressTotal * 100).toFixed(1);
    doc.fontSize(9).fillColor('#374151').font('Helvetica');
    doc.text(`El ${stLowPct}% de la población se encuentra sin riesgo o en riesgo bajo de estrés. El ${stHighPct}% presenta riesgo alto o muy alto y requiere intervención prioritaria.`, m, doc.y, { width: pageW, align: 'justify' });
    doc.moveDown(1);

    // Stress typology chart
    if (stressTypology && Object.keys(stressTypology).length > 0) {
      ensureSpace(doc, 200);
      if (doc.y > 500) doc.addPage();

      doc.fontSize(10).fillColor('#1F2937').font('Helvetica-Bold');
      doc.text('Tipología de Síntomas de Estrés', { width: pageW });
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

      // TOP 3 symptoms text
      const sortedTypes = Object.entries(stressTypology).sort((a, b) => b[1] - a[1]);
      doc.fontSize(9).fillColor('#374151').font('Helvetica');
      doc.text('Los principales tipos de sintomatología reportados son:', m, doc.y, { width: pageW });
      doc.moveDown(0.2);
      sortedTypes.slice(0, 3).forEach(([name, pct], i) => {
        doc.text(`  ${i + 1}. ${name}: ${pct}%`, m, doc.y, { width: pageW });
      });
    }
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
  // RECOMENDACIONES
  // ==========================================================
  doc.addPage();
  drawSectionBanner(doc, m, doc.y, pageW, 'RECOMENDACIONES');
  doc.y += 40;
  doc.moveDown(0.5);

  doc.fontSize(10).fillColor('#374151').font('Helvetica');
  doc.text('Con base en los resultados obtenidos se recomienda:', { width: pageW, align: 'justify' });
  doc.moveDown(0.5);

  const priorities = [
    `Implementar un programa de vigilancia epidemiológica en riesgo psicosocial para los funcionarios de ${evaluation.company_name}, de acuerdo con la Resolución 2764 de 2022.`,
    'Abordar de manera prioritaria las dimensiones que presentan niveles de riesgo alto y muy alto, mediante intervenciones tanto a nivel organizacional como individual.',
    'Diseñar programas de promoción y prevención orientados a fortalecer los factores protectores identificados y disminuir los factores de riesgo.',
    'Realizar evaluaciones de seguimiento cada 12 meses para monitorear la evolución de los indicadores de riesgo.',
    'Implementar estrategias de intervención diferenciadas por áreas, teniendo en cuenta las particularidades de cada grupo poblacional.'
  ];
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
  doc.text('Se entiende como intervención prioritaria aquella que se dirige a las dimensiones que presentan niveles de riesgo alto y muy alto en un porcentaje significativo de la población evaluada. Estas dimensiones requieren atención inmediata y acciones de intervención a corto plazo.', { width: pageW, align: 'justify' });

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
  const totalEvaluated = aggResults.population.total;

  doc.text(`Se realizó la evaluación de riesgo psicosocial a ${totalEvaluated} trabajadores de ${evaluation.company_name}, mediante la aplicación de la Batería de Instrumentos para la Evaluación de Factores de Riesgo Psicosocial del Ministerio de la Protección Social, en cumplimiento de la Resolución 2764 de 2022 (Art. 3).`, { width: pageW, align: 'justify' });
  doc.moveDown(0.5);

  doc.text('Los resultados obtenidos permiten identificar las condiciones de riesgo psicosocial que requieren intervención, así como los factores protectores que deben ser fortalecidos. Se recomienda estructurar un plan de acción enmarcado en el Sistema de Gestión de Seguridad y Salud en el Trabajo.', { width: pageW, align: 'justify' });
  doc.moveDown(0.5);

  if (topRisk.length > 0) {
    doc.text('Las dimensiones que requieren mayor atención son:', { width: pageW });
    doc.moveDown(0.2);
    topRisk.slice(0, 5).forEach(d => {
      const name = templates.DIMENSION_DISPLAY_NAMES[d.dimension] || d.dimension;
      doc.text(`  • ${name} (${d.highRiskPct.toFixed(0)}% en riesgo alto/muy alto)`, { width: pageW });
    });
    doc.moveDown(0.5);
  }

  doc.text(`Es fundamental que ${evaluation.company_name} implemente las acciones de intervención sugeridas de manera oportuna, priorizando las dimensiones con mayor nivel de riesgo y garantizando el seguimiento continuo de la salud psicosocial de sus trabajadores.`, { width: pageW, align: 'justify' });

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
