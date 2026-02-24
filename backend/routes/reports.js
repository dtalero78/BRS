const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const db = require('../config/database');
const { auth, getOwnedCompanyIds } = require('../middleware/auth');
const { drawPieChart, drawBarChart, drawGroupedBarChart, drawTable, createRiskSeries, RISK_COLORS, RISK_ORDER, RISK_LABELS } = require('../utils/pdf-charts');
const { aggregateDemographics, aggregateResultsByForm, getAtRiskDimensions, sumCounts } = require('../utils/report-data-aggregator');
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
    const participant = await db('participant_evaluations as pe')
      .join('participants as p', 'pe.participant_id', 'p.id')
      .join('evaluations as e', 'pe.evaluation_id', 'e.id')
      .join('companies as c', 'e.company_id', 'c.id')
      .where('pe.id', participantEvaluationId)
      .whereIn('e.company_id', await getOwnedCompanyIds(req.user.userId))
      .select(
        'pe.id as pe_id',
        'pe.status',
        'pe.completed_at',
        'p.email',
        'p.demographic_data',
        'e.name as evaluation_name',
        'e.description as evaluation_description',
        'c.name as company_name',
        'c.nit as company_nit'
      )
      .first();

    if (!participant) {
      return res.status(404).json({ error: 'Participante no encontrado' });
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

    // Generate PDF
    const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Reporte_BRS_Individual_${Date.now()}.pdf`);
    doc.pipe(res);

    generateIndividualPDF(doc, {
      participant,
      demo,
      resultsByType,
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
    const { evaluationId } = req.body;

    if (!evaluationId) {
      return res.status(400).json({ error: 'evaluationId es requerido' });
    }

    // Get evaluation + company data
    const evaluation = await db('evaluations as e')
      .join('companies as c', 'e.company_id', 'c.id')
      .where('e.id', evaluationId)
      .whereIn('e.company_id', await getOwnedCompanyIds(req.user.userId))
      .select(
        'e.id', 'e.name', 'e.description', 'e.start_date', 'e.end_date', 'e.status',
        'c.name as company_name', 'c.nit as company_nit'
      )
      .first();

    if (!evaluation) {
      return res.status(404).json({ error: 'Evaluación no encontrada' });
    }

    // Get all results for all participants in this evaluation
    const allResults = await db('results')
      .join('participant_evaluations as pe', 'results.participant_evaluation_id', 'pe.id')
      .join('participants as p', 'pe.participant_id', 'p.id')
      .where('pe.evaluation_id', evaluationId)
      .select('results.*', 'p.demographic_data', 'p.email');

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
      .select('responses.responses', 'pe.participant_id');

    // Get evaluator info
    const evaluator = await db('users')
      .where('id', req.user.userId)
      .select('email')
      .first();

    // Aggregate data
    const demographics = aggregateDemographics(fichaResponses);
    const aggResults = aggregateResultsByForm(allResults);
    const atRiskDimensions = getAtRiskDimensions(aggResults);

    // Generate PDF
    const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Informe_BRS_${evaluation.company_name.replace(/\s+/g, '_')}_${Date.now()}.pdf`);
    doc.pipe(res);

    generateOrganizationalPDF(doc, {
      evaluation,
      demographics,
      aggResults,
      atRiskDimensions,
      totalParticipants: parseInt(totalParticipants.count),
      completedParticipants: parseInt(completedParticipants.count),
      evaluatorEmail: evaluator?.email || ''
    });

    doc.end();

  } catch (error) {
    console.error('Error generating organizational report:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error interno del servidor' });
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
function generateIndividualPDF(doc, { participant, demo, resultsByType }) {
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

  // Footer on all pages
  addFooters(doc);
}

// ============================================================
// ORGANIZATIONAL PDF - Full professional report (~35 pages)
// ============================================================
function generateOrganizationalPDF(doc, { evaluation, demographics, aggResults, atRiskDimensions, totalParticipants, completedParticipants, evaluatorEmail }) {
  const m = doc.page.margins.left;
  const pageW = doc.page.width - m * 2;
  const sections = [];
  let pageNum = 0;

  function sectionTitle(title) {
    doc.fontSize(14).fillColor('#1E40AF').font('Helvetica-Bold').text(title.toUpperCase());
    doc.moveDown(0.3);
    drawHorizontalLine(doc);
    doc.moveDown(0.5);
  }

  function newPage() {
    doc.addPage();
    pageNum++;
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
  doc.text(evaluatorEmail || 'Evaluador BRS Digital', { align: 'center' });
  doc.text('Especialista en Psicología Ocupacional y Organizacional', { align: 'center' });
  doc.moveDown(6);
  const now = new Date();
  const months = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
  doc.fontSize(12).fillColor('#4B5563');
  doc.text(`BOGOTÁ D.C., ${months[now.getMonth()]} ${now.getFullYear()}`, { align: 'center' });

  // ==========================================================
  // PAGE 2: TABLA DE CONTENIDO (placeholder - will backfill)
  // ==========================================================
  newPage();
  const tocPageIndex = pageNum;
  const tocStartY = doc.y;
  doc.fontSize(14).fillColor('#1E40AF').font('Helvetica-Bold').text('Contenido');
  doc.moveDown(1);
  // Reserve space - actual TOC written at the end via switchToPage
  doc.moveDown(20);

  // ==========================================================
  // INTRODUCCION
  // ==========================================================
  newPage();
  sections.push({ title: 'INTRODUCCIÓN', page: pageNum + 1 });
  sectionTitle('INTRODUCCIÓN');
  templates.writeIntroduccion(doc, pageW);

  // ==========================================================
  // MARCO REFERENCIAL
  // ==========================================================
  newPage();
  sections.push({ title: 'MARCO REFERENCIAL', page: pageNum + 1 });
  sectionTitle('MARCO REFERENCIAL');
  templates.writeMarcoReferencial(doc, pageW);

  // ==========================================================
  // MARCO TEORICO
  // ==========================================================
  newPage();
  sections.push({ title: 'MARCO TEÓRICO', page: pageNum + 1 });
  sectionTitle('MARCO TEÓRICO');
  templates.writeMarcoTeorico(doc, pageW);

  // ==========================================================
  // PARTE PRIMERA - ASPECTOS GENERALES
  // ==========================================================
  newPage();
  sections.push({ title: 'PARTE PRIMERA - ASPECTOS GENERALES', page: pageNum + 1 });
  doc.fontSize(14).fillColor('#1E40AF').font('Helvetica-Bold').text('PARTE PRIMERA');
  doc.fontSize(12).text('ASPECTOS GENERALES');
  doc.moveDown(0.5);
  drawHorizontalLine(doc);
  doc.moveDown(0.5);

  // A. OBJETIVO
  doc.fontSize(12).fillColor('#1F2937').font('Helvetica-Bold').text('A. OBJETIVO');
  doc.moveDown(0.3);
  doc.fontSize(10).fillColor('#374151').font('Helvetica');
  doc.text(`Identificar y evaluar los factores de riesgo psicosocial intralaboral, extralaboral y estrés, a través de la aplicación de la Batería de Instrumentos para la Evaluación de Factores de Riesgo Psicosocial del Ministerio de la Protección Social / Universidad Javeriana, a los funcionarios de ${evaluation.company_name}.`, { width: pageW, align: 'justify' });
  doc.moveDown(0.5);

  doc.fontSize(10).font('Helvetica-Bold').text('Objetivos específicos:');
  doc.moveDown(0.2);
  doc.font('Helvetica');
  const objectives = [
    `Identificar los factores de riesgo psicosocial a los que pueden estar expuestos los funcionarios de ${evaluation.company_name} por el trabajo desarrollado dentro de la Organización.`,
    'Identificar las situaciones estresantes en la población para diseñar acciones de afrontamiento adecuadas.',
    'Identificar los factores psicosociales protectores en la población general de la Organización.',
    `Generar un plan de intervención con el fin de disminuir el riesgo de condiciones de salud psicosocial, teniendo en cuenta los factores de riesgo en los funcionarios de ${evaluation.company_name}.`
  ];
  objectives.forEach(obj => {
    doc.text(`  • ${obj}`, { width: pageW - 10, align: 'justify' });
    doc.moveDown(0.3);
  });
  doc.moveDown(0.5);

  // B. ALCANCE
  doc.fontSize(12).fillColor('#1F2937').font('Helvetica-Bold').text('B. ALCANCE');
  doc.moveDown(0.3);
  doc.fontSize(10).fillColor('#374151').font('Helvetica');
  doc.text(`Aplica a todos los funcionarios vinculados a ${evaluation.company_name} que participaron en la evaluación "${evaluation.name}".`, { width: pageW, align: 'justify' });
  doc.moveDown(0.5);

  // C. POBLACION
  doc.fontSize(12).fillColor('#1F2937').font('Helvetica-Bold').text('C. POBLACIÓN');
  doc.moveDown(0.3);
  doc.fontSize(10).fillColor('#374151').font('Helvetica');
  doc.text(`${totalParticipants} funcionarios de ${evaluation.company_name} teniendo en cuenta la distribución en Forma A (${aggResults.population.formaA} funcionarios) y en Forma B (${aggResults.population.formaB} funcionarios). Del total, ${completedParticipants} completaron la evaluación.`, { width: pageW, align: 'justify' });

  // ==========================================================
  // RESULTADOS FICHA SOCIODEMOGRAFICOS
  // ==========================================================
  newPage();
  sections.push({ title: 'RESULTADOS FICHA SOCIODEMOGRÁFICOS', page: pageNum + 1 });
  sectionTitle('RESULTADOS FICHA SOCIODEMOGRÁFICOS');

  doc.fontSize(10).fillColor('#374151').font('Helvetica');
  doc.text('Se tienen en cuenta las variables sociodemográficas más relevantes para la interpretación y análisis de los riesgos psicosociales intralaborales y extralaborales, a continuación se presenta el perfil sociodemográfico:', { width: pageW, align: 'justify' });
  doc.moveDown(1);

  const chartRadius = 70;
  const chartCenterX = m + chartRadius + 10;

  // Pie Chart 1: Género
  if (Object.keys(demographics.gender).length > 0) {
    ensureSpace(doc, 200);
    const genderData = Object.entries(demographics.gender).map(([label, value], i) => ({
      label, value, color: templates.DEMOGRAPHIC_COLORS[i]
    }));
    const genderY = doc.y + chartRadius + 5;
    drawPieChart(doc, chartCenterX, genderY, chartRadius, genderData, {
      showPercentages: true,
      showLegend: true,
      legendX: chartCenterX + chartRadius + 30,
      legendY: genderY - 30,
      title: 'Gráfica No 1. Análisis de la población evaluada según género'
    });
    doc.y = genderY + chartRadius + 25;
    doc.moveDown(0.5);

    const majorGender = Object.entries(demographics.gender).sort((a, b) => b[1] - a[1])[0];
    if (majorGender) {
      const pct = demographics.total > 0 ? ((majorGender[1] / demographics.total) * 100).toFixed(0) : 0;
      doc.fontSize(9).fillColor('#374151').font('Helvetica');
      doc.text(`En cuanto a la población evaluada tenemos que la mayoría son ${majorGender[0]} con un ${pct}% del total de la población.`, { width: pageW, align: 'justify' });
    }
    doc.moveDown(1);
  }

  // Pie Chart 2: Edades
  const ageEntries = Object.entries(demographics.ageRanges).filter(([, v]) => v > 0);
  if (ageEntries.length > 0) {
    ensureSpace(doc, 220);
    const ageData = ageEntries.map(([label, value], i) => ({
      label, value, color: templates.DEMOGRAPHIC_COLORS[i]
    }));
    const ageY = doc.y + chartRadius + 5;
    drawPieChart(doc, chartCenterX, ageY, chartRadius, ageData, {
      showPercentages: true,
      showLegend: true,
      legendX: chartCenterX + chartRadius + 30,
      legendY: ageY - 30,
      title: 'Gráfica No 2. Distribución por edades'
    });
    doc.y = ageY + chartRadius + 25;
    doc.moveDown(0.5);

    const majorAge = ageEntries.sort((a, b) => b[1] - a[1])[0];
    if (majorAge) {
      const pct = demographics.total > 0 ? ((majorAge[1] / demographics.total) * 100).toFixed(0) : 0;
      doc.fontSize(9).fillColor('#374151').font('Helvetica');
      doc.text(`Se observa que el ${pct}% de la población evaluada corresponde a edades ${majorAge[0].toLowerCase()}.`, { width: pageW, align: 'justify' });
    }
    doc.moveDown(1);
  }

  // Pie Chart 3: Escolaridad
  if (Object.keys(demographics.education).length > 0) {
    newPage();
    const eduData = Object.entries(demographics.education).map(([label, value], i) => ({
      label, value, color: templates.DEMOGRAPHIC_COLORS[i]
    }));
    const eduY = doc.y + chartRadius + 20;
    drawPieChart(doc, chartCenterX, eduY, chartRadius, eduData, {
      showPercentages: true,
      showLegend: true,
      legendX: chartCenterX + chartRadius + 30,
      legendY: eduY - 40,
      title: 'Gráfica No 3. Análisis de la población evaluada según escolaridad'
    });
    doc.y = eduY + chartRadius + 25;
    doc.moveDown(0.5);

    const majorEdu = Object.entries(demographics.education).sort((a, b) => b[1] - a[1])[0];
    if (majorEdu) {
      const pct = demographics.total > 0 ? ((majorEdu[1] / demographics.total) * 100).toFixed(0) : 0;
      doc.fontSize(9).fillColor('#374151').font('Helvetica');
      doc.text(`Se evidencia que la mayoría de los funcionarios tienen grado de ${majorEdu[0]} con un ${pct}% de la población.`, { width: pageW, align: 'justify' });
    }
    doc.moveDown(1);
  }

  // Pie Chart 4: Personas a Cargo
  if (Object.keys(demographics.dependents).length > 0) {
    ensureSpace(doc, 220);
    const depData = Object.entries(demographics.dependents).map(([label, value], i) => ({
      label, value, color: templates.DEMOGRAPHIC_COLORS[i]
    }));
    const depY = doc.y + chartRadius + 5;
    drawPieChart(doc, chartCenterX, depY, chartRadius, depData, {
      showPercentages: true,
      showLegend: true,
      legendX: chartCenterX + chartRadius + 30,
      legendY: depY - 30,
      title: 'Gráfica No 4. Análisis de la población según Personas a Cargo'
    });
    doc.y = depY + chartRadius + 25;
    doc.moveDown(0.5);

    const majorDep = Object.entries(demographics.dependents).sort((a, b) => b[1] - a[1])[0];
    if (majorDep) {
      const pct = demographics.total > 0 ? ((majorDep[1] / demographics.total) * 100).toFixed(0) : 0;
      doc.fontSize(9).fillColor('#374151').font('Helvetica');
      doc.text(`De las personas que tienen a cargo los trabajadores, encontramos que el ${pct}% reporta ${majorDep[0].toLowerCase()} persona(s) a cargo.`, { width: pageW, align: 'justify' });
    }
  }

  // ==========================================================
  // METODOLOGIA
  // ==========================================================
  newPage();
  sections.push({ title: 'METODOLOGÍA', page: pageNum + 1 });
  sectionTitle('METODOLOGÍA');
  templates.writeMetodologia(doc, pageW, drawTable);

  // ==========================================================
  // PROCEDIMIENTO
  // ==========================================================
  newPage();
  sections.push({ title: 'PROCEDIMIENTO', page: pageNum + 1 });
  sectionTitle('PROCEDIMIENTO');
  templates.writeProcedimiento(doc, pageW);

  // ==========================================================
  // PARTE SEGUNDA - ANALISIS DE RESULTADOS
  // ==========================================================
  doc.moveDown(1);
  doc.fontSize(14).fillColor('#1E40AF').font('Helvetica-Bold').text('PARTE SEGUNDA');
  doc.fontSize(12).text('ANÁLISIS DE RESULTADOS');
  doc.moveDown(0.3);
  drawHorizontalLine(doc);
  doc.moveDown(0.5);

  doc.fontSize(12).fillColor('#1F2937').font('Helvetica-Bold');
  doc.text('IDENTIFICACIÓN Y EVALUACIÓN DE LOS FACTORES DE RIESGO PSICOSOCIAL');
  doc.moveDown(0.5);
  doc.fontSize(10).fillColor('#374151').font('Helvetica');
  doc.text('Se presentan a continuación los resultados de la medición de los factores evaluados a través de los cuestionarios intralaborales, extralaborales y de estrés, desglosados por tipo de formulario aplicado.', { width: pageW, align: 'justify' });

  // ==========================================================
  // CONDICIONES INTRALABORALES - General
  // ==========================================================
  newPage();
  sections.push({ title: 'CONDICIONES INTRALABORALES', page: pageNum + 1 });
  sectionTitle('CONDICIONES INTRALABORALES');

  doc.fontSize(10).fillColor('#374151').font('Helvetica');
  doc.text('Los factores intralaborales son entendidos como aquellas características del trabajo y de su organización que influyen en la salud y bienestar del individuo.', { width: pageW, align: 'justify' });
  doc.moveDown(0.5);

  // General intralaboral risk (combine A+B)
  const generalIntralaboral = {};
  for (const level of RISK_ORDER) {
    generalIntralaboral[level] = (aggResults.intralaboralA.overall[level] || 0) + (aggResults.intralaboralB.overall[level] || 0);
  }
  const generalTotal = sumCounts(generalIntralaboral);

  if (generalTotal > 0) {
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#1F2937');
    doc.text(templates.generateOverallRiskText(generalIntralaboral, generalTotal, 'riesgo intralaboral'), { width: pageW, align: 'justify' });
    doc.moveDown(0.5);

    const generalBarData = RISK_ORDER.map(key => ({
      label: RISK_LABELS[key], value: generalIntralaboral[key], color: RISK_COLORS[key]
    }));
    ensureSpace(doc, 200);
    drawBarChart(doc, m, doc.y + 15, pageW, 170, generalBarData, {
      title: 'Riesgo Psicosocial Intralaboral – General', showValues: true
    });
    doc.y += 195;
  }

  // Forma A intralaboral
  if (sumCounts(aggResults.intralaboralA.overall) > 0) {
    ensureSpace(doc, 210);
    const formaAData = RISK_ORDER.map(key => ({
      label: RISK_LABELS[key], value: aggResults.intralaboralA.overall[key], color: RISK_COLORS[key]
    }));
    drawBarChart(doc, m, doc.y + 15, pageW, 170, formaAData, {
      title: 'Riesgo Intralaboral – Forma A', showValues: true
    });
    doc.y += 195;
  }

  // Forma B intralaboral
  if (sumCounts(aggResults.intralaboralB.overall) > 0) {
    ensureSpace(doc, 210);
    const formaBData = RISK_ORDER.map(key => ({
      label: RISK_LABELS[key], value: aggResults.intralaboralB.overall[key], color: RISK_COLORS[key]
    }));
    drawBarChart(doc, m, doc.y + 15, pageW, 170, formaBData, {
      title: 'Riesgo Intralaboral – Forma B', showValues: true
    });
    doc.y += 195;
  }

  // ==========================================================
  // DOMINIOS POR FORMA
  // ==========================================================
  const domainLabels = templates.DOMAIN_ORDER.map(d => {
    const name = templates.DOMAIN_DISPLAY_NAMES[d];
    return name.length > 22 ? name.substring(0, 20) + '...' : name;
  });

  // Dominios Forma A
  if (Object.keys(aggResults.intralaboralA.domains).length > 0) {
    newPage();
    const riskCountsA = {};
    templates.DOMAIN_ORDER.forEach(dk => {
      riskCountsA[dk] = aggResults.intralaboralA.domains[dk] || { sin_riesgo: 0, riesgo_bajo: 0, riesgo_medio: 0, riesgo_alto: 0, riesgo_muy_alto: 0 };
    });
    const seriesA = createRiskSeries(riskCountsA, templates.DOMAIN_ORDER);

    drawGroupedBarChart(doc, m, doc.y + 15, pageW, 220, domainLabels, seriesA, {
      title: 'Dominios Forma A', showLegend: true, showValues: true
    });
    doc.y += 245;

    doc.fontSize(9).fillColor('#374151').font('Helvetica');
    templates.DOMAIN_ORDER.forEach(dk => {
      const rc = aggResults.intralaboralA.domains[dk];
      if (rc) {
        const t = sumCounts(rc);
        const highPct = t > 0 ? (((rc.riesgo_alto || 0) + (rc.riesgo_muy_alto || 0)) / t * 100).toFixed(0) : 0;
        if (highPct > 0) {
          doc.text(`  • ${templates.DOMAIN_DISPLAY_NAMES[dk]}: ${highPct}% en riesgo alto/muy alto.`, { width: pageW });
        }
      }
    });
    doc.moveDown(1);
  }

  // Dominios Forma B
  if (Object.keys(aggResults.intralaboralB.domains).length > 0) {
    ensureSpace(doc, 280);
    const riskCountsB = {};
    templates.DOMAIN_ORDER.forEach(dk => {
      riskCountsB[dk] = aggResults.intralaboralB.domains[dk] || { sin_riesgo: 0, riesgo_bajo: 0, riesgo_medio: 0, riesgo_alto: 0, riesgo_muy_alto: 0 };
    });
    const seriesB = createRiskSeries(riskCountsB, templates.DOMAIN_ORDER);

    drawGroupedBarChart(doc, m, doc.y + 15, pageW, 220, domainLabels, seriesB, {
      title: 'Dominios Forma B', showLegend: true, showValues: true
    });
    doc.y += 245;

    doc.fontSize(9).fillColor('#374151').font('Helvetica');
    templates.DOMAIN_ORDER.forEach(dk => {
      const rc = aggResults.intralaboralB.domains[dk];
      if (rc) {
        const t = sumCounts(rc);
        const highPct = t > 0 ? (((rc.riesgo_alto || 0) + (rc.riesgo_muy_alto || 0)) / t * 100).toFixed(0) : 0;
        if (highPct > 0) {
          doc.text(`  • ${templates.DOMAIN_DISPLAY_NAMES[dk]}: ${highPct}% en riesgo alto/muy alto.`, { width: pageW });
        }
      }
    });
  }

  // ==========================================================
  // PER-DOMAIN DETAILED ANALYSIS
  // ==========================================================
  templates.DOMAIN_ORDER.forEach(domainKey => {
    const domainName = templates.DOMAIN_DISPLAY_NAMES[domainKey];
    const dimsA = templates.DOMAIN_DIMENSIONS[domainKey].A;
    const dimsB = templates.DOMAIN_DIMENSIONS[domainKey].B;

    newPage();

    // Forma A dimensions chart
    if (dimsA.length > 0 && Object.keys(aggResults.intralaboralA.dimensions).length > 0) {
      const dimLabelsA = dimsA.map(d => {
        const name = templates.DIMENSION_SHORT_NAMES[d] || d;
        return name.length > 20 ? name.substring(0, 18) + '...' : name;
      });
      const riskCountsDimsA = {};
      dimsA.forEach(dk => {
        riskCountsDimsA[dk] = aggResults.intralaboralA.dimensions[dk] || { sin_riesgo: 0, riesgo_bajo: 0, riesgo_medio: 0, riesgo_alto: 0, riesgo_muy_alto: 0 };
      });
      const seriesDimsA = createRiskSeries(riskCountsDimsA, dimsA);

      drawGroupedBarChart(doc, m, doc.y + 15, pageW, 210, dimLabelsA, seriesDimsA, {
        title: `${domainName} Forma A`, showLegend: true, showValues: true
      });
      doc.y += 235;

      // Analysis text per dimension
      doc.fontSize(9).fillColor('#374151').font('Helvetica');
      dimsA.forEach(dk => {
        const rc = aggResults.intralaboralA.dimensions[dk];
        if (rc) {
          ensureSpace(doc, 30);
          doc.text(templates.generateDimensionAnalysis(dk, rc, aggResults.intralaboralA.participantCount), { width: pageW, align: 'justify' });
          doc.moveDown(0.3);
        }
      });
    }

    // Forma B dimensions chart
    if (dimsB.length > 0 && Object.keys(aggResults.intralaboralB.dimensions).length > 0) {
      ensureSpace(doc, 280);
      if (doc.y > 300) newPage();

      const dimLabelsB = dimsB.map(d => {
        const name = templates.DIMENSION_SHORT_NAMES[d] || d;
        return name.length > 20 ? name.substring(0, 18) + '...' : name;
      });
      const riskCountsDimsB = {};
      dimsB.forEach(dk => {
        riskCountsDimsB[dk] = aggResults.intralaboralB.dimensions[dk] || { sin_riesgo: 0, riesgo_bajo: 0, riesgo_medio: 0, riesgo_alto: 0, riesgo_muy_alto: 0 };
      });
      const seriesDimsB = createRiskSeries(riskCountsDimsB, dimsB);

      drawGroupedBarChart(doc, m, doc.y + 15, pageW, 210, dimLabelsB, seriesDimsB, {
        title: `${domainName} Forma B`, showLegend: true, showValues: true
      });
      doc.y += 235;

      doc.fontSize(9).fillColor('#374151').font('Helvetica');
      dimsB.forEach(dk => {
        const rc = aggResults.intralaboralB.dimensions[dk];
        if (rc) {
          ensureSpace(doc, 30);
          doc.text(templates.generateDimensionAnalysis(dk, rc, aggResults.intralaboralB.participantCount), { width: pageW, align: 'justify' });
          doc.moveDown(0.3);
        }
      });
    }
  });

  // ==========================================================
  // CONDICIONES EXTRALABORALES
  // ==========================================================
  newPage();
  sections.push({ title: 'CONDICIONES EXTRALABORALES', page: pageNum + 1 });
  sectionTitle('CONDICIONES EXTRALABORALES');

  doc.fontSize(10).fillColor('#374151').font('Helvetica');
  doc.text('Comprenden los aspectos del entorno familiar, social y económico del trabajador. A su vez, abarcan las condiciones del lugar de vivienda, que pueden influir en la salud y bienestar del individuo.', { width: pageW, align: 'justify' });
  doc.moveDown(0.5);

  // General extralaboral
  const extraDimKeys = templates.EXTRALABORAL_DIMENSIONS.filter(dk => aggResults.extralaboral.general.dimensions[dk]);
  if (extraDimKeys.length > 0) {
    const extraLabels = extraDimKeys.map(d => {
      const name = templates.DIMENSION_SHORT_NAMES[d] || d;
      return name.length > 20 ? name.substring(0, 18) + '...' : name;
    });
    const extraRiskCounts = {};
    extraDimKeys.forEach(dk => {
      extraRiskCounts[dk] = aggResults.extralaboral.general.dimensions[dk];
    });
    const extraSeries = createRiskSeries(extraRiskCounts, extraDimKeys);

    ensureSpace(doc, 250);
    drawGroupedBarChart(doc, m, doc.y + 15, pageW, 220, extraLabels, extraSeries, {
      title: 'Riesgo Psicosocial Extralaboral', showLegend: true, showValues: true
    });
    doc.y += 245;

    // Analysis per extralaboral dimension
    doc.fontSize(9).fillColor('#374151').font('Helvetica');
    extraDimKeys.forEach(dk => {
      const rc = aggResults.extralaboral.general.dimensions[dk];
      if (rc) {
        ensureSpace(doc, 30);
        doc.text(templates.generateDimensionAnalysis(dk, rc, sumCounts(rc)), { width: pageW, align: 'justify' });
        doc.moveDown(0.3);
      }
    });
  }

  // Extralaboral by Form A
  const extraAKeys = templates.EXTRALABORAL_DIMENSIONS.filter(dk => aggResults.extralaboral.formaA.dimensions[dk]);
  if (extraAKeys.length > 0) {
    newPage();
    const extraALabels = extraAKeys.map(d => {
      const name = templates.DIMENSION_SHORT_NAMES[d] || d;
      return name.length > 20 ? name.substring(0, 18) + '...' : name;
    });
    const extraARiskCounts = {};
    extraAKeys.forEach(dk => { extraARiskCounts[dk] = aggResults.extralaboral.formaA.dimensions[dk]; });
    const extraASeries = createRiskSeries(extraARiskCounts, extraAKeys);

    drawGroupedBarChart(doc, m, doc.y + 15, pageW, 210, extraALabels, extraASeries, {
      title: 'Riesgo Psicosocial Extralaboral Forma A', showLegend: true
    });
    doc.y += 235;
  }

  // Extralaboral by Form B
  const extraBKeys = templates.EXTRALABORAL_DIMENSIONS.filter(dk => aggResults.extralaboral.formaB.dimensions[dk]);
  if (extraBKeys.length > 0) {
    ensureSpace(doc, 260);
    const extraBLabels = extraBKeys.map(d => {
      const name = templates.DIMENSION_SHORT_NAMES[d] || d;
      return name.length > 20 ? name.substring(0, 18) + '...' : name;
    });
    const extraBRiskCounts = {};
    extraBKeys.forEach(dk => { extraBRiskCounts[dk] = aggResults.extralaboral.formaB.dimensions[dk]; });
    const extraBSeries = createRiskSeries(extraBRiskCounts, extraBKeys);

    drawGroupedBarChart(doc, m, doc.y + 15, pageW, 210, extraBLabels, extraBSeries, {
      title: 'Riesgo Psicosocial Extralaboral Forma B', showLegend: true
    });
    doc.y += 235;
  }

  // ==========================================================
  // EFECTOS POR LA EXPOSICION - ESTRES
  // ==========================================================
  newPage();
  sections.push({ title: 'EFECTOS POR LA EXPOSICIÓN (ESTRÉS)', page: pageNum + 1 });
  sectionTitle('EFECTOS POR LA EXPOSICIÓN');

  doc.fontSize(10).fillColor('#374151').font('Helvetica');
  doc.text('El estrés es una respuesta del organismo ante una situación que genera tensión. Puede producir enfermedad a través del desencadenamiento de respuestas fisiológicas prolongadas y conductas de riesgo. A continuación se presentan los niveles de estrés identificados en la población evaluada.', { width: pageW, align: 'justify' });
  doc.moveDown(1);

  // Stress pie chart
  const stressTotal = sumCounts(aggResults.estres.general);
  if (stressTotal > 0) {
    const stressData = RISK_ORDER.map(key => ({
      label: RISK_LABELS[key],
      value: aggResults.estres.general[key],
      color: RISK_COLORS[key]
    }));

    const stressY = doc.y + chartRadius + 5;
    drawPieChart(doc, chartCenterX, stressY, chartRadius, stressData, {
      showPercentages: true,
      showLegend: true,
      legendX: chartCenterX + chartRadius + 30,
      legendY: stressY - 40,
      title: 'Nivel Estrés'
    });
    doc.y = stressY + chartRadius + 30;
    doc.moveDown(0.5);

    doc.fontSize(10).font('Helvetica-Bold').fillColor('#1F2937').text('Posibles efectos en la Salud de los Trabajadores:');
    doc.moveDown(0.3);
    doc.fontSize(9).font('Helvetica').fillColor('#374151');

    const highStress = (aggResults.estres.general.riesgo_alto || 0) + (aggResults.estres.general.riesgo_muy_alto || 0);
    const highStressPct = stressTotal > 0 ? ((highStress / stressTotal) * 100).toFixed(0) : 0;
    doc.text(`En la gráfica se puede observar que, en relación con los niveles de sintomatología por estrés, el ${highStressPct}% de los funcionarios evaluados presentan riesgo alto o muy alto. Los trabajadores que se encuentran en un nivel de riesgo MEDIO y ALTO requieren implementar actividades de intervención y monitoreo.`, { width: pageW, align: 'justify' });
    doc.moveDown(0.5);

    doc.text('Los principales efectos del estrés en la salud pueden ser:', { width: pageW });
    doc.moveDown(0.2);
    ['Fisiológicos: los trastornos pueden ser de tipo cardiovascular o digestivo.',
     'Psicológicos: alteraciones en la memoria, dificultades de atención y concentración.',
     'Comportamentales: conductas de aislamiento, cambios en el estado de ánimo.'
    ].forEach(e => {
      doc.text(`  • ${e}`, { width: pageW });
      doc.moveDown(0.2);
    });
  }

  // ==========================================================
  // ESTRATEGIAS DE AFRONTAMIENTO (COPING)
  // ==========================================================
  const copingTotal = sumCounts(aggResults.coping.overall);
  if (copingTotal > 0) {
    newPage();
    sections.push({ title: 'ESTRATEGIAS DE AFRONTAMIENTO (BRIEF COPE)', page: pageNum + 1 });
    sectionTitle('ESTRATEGIAS DE AFRONTAMIENTO');

    doc.fontSize(10).fillColor('#374151').font('Helvetica');
    doc.text('El Brief COPE (COPE-28) es un instrumento que evalúa las estrategias de afrontamiento que utilizan las personas ante situaciones de estrés. Se compone de 14 subescalas agrupadas en tres macro-categorías: afrontamiento centrado en el problema, afrontamiento centrado en la emoción, y afrontamiento evitativo. Los resultados permiten identificar los estilos predominantes de afrontamiento en la población evaluada.', { width: pageW, align: 'justify' });
    doc.moveDown(1);

    // Coping overall pie chart
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
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#1F2937').text('Resultados por Categoría de Afrontamiento:');
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
        doc.text(`  • ${catName}: ${highPct}% de los funcionarios presentan uso alto o muy alto de estas estrategias.`, { width: pageW });
        doc.moveDown(0.2);
      });
      doc.moveDown(0.5);
    }

    // Subscale detail
    const subscaleEntries = Object.entries(aggResults.coping.subscales);
    if (subscaleEntries.length > 0) {
      ensureSpace(doc, 250);
      const copingSubLabels = subscaleEntries.map(([key]) => {
        const name = templates.DIMENSION_DISPLAY_NAMES[key] || key;
        return name.length > 18 ? name.substring(0, 16) + '...' : name;
      });

      const copingSubKeys = subscaleEntries.map(([key]) => key);
      const copingSubRiskCounts = {};
      subscaleEntries.forEach(([key, counts]) => { copingSubRiskCounts[key] = counts; });

      // Create series using coping levels
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
  // TERCERA PARTE - INTERVENCION SUGERIDA
  // ==========================================================
  newPage();
  sections.push({ title: 'PLAN DE ACCIÓN SUGERIDO', page: pageNum + 1 });
  doc.fontSize(14).fillColor('#1E40AF').font('Helvetica-Bold').text('TERCERA PARTE');
  doc.fontSize(12).text('INTERVENCIÓN SUGERIDA');
  doc.moveDown(0.3);
  drawHorizontalLine(doc);
  doc.moveDown(0.5);

  doc.fontSize(10).fillColor('#374151').font('Helvetica');
  doc.text('Con base en los resultados obtenidos, se presenta el siguiente plan de intervención con las recomendaciones específicas para cada dimensión que presenta niveles de riesgo significativos.', { width: pageW, align: 'justify' });
  doc.moveDown(0.5);

  doc.fontSize(11).font('Helvetica-Bold').fillColor('#1F2937').text('1. PLAN DE INTERVENCIÓN GLOBAL');
  doc.moveDown(0.5);

  // Intervention table
  const interventionRows = atRiskDimensions
    .filter(d => d.highRiskPct > 10)
    .slice(0, 20)
    .map(d => {
      const dimName = templates.DIMENSION_DISPLAY_NAMES[d.dimension] || d.dimension;
      const recommendation = templates.INTERVENTION_RECOMMENDATIONS[d.dimension] || 'Implementar acciones de prevención y monitoreo.';
      const population = d.form === 'A y B' || d.form === 'TODOS' ? 'TODOS' : `Forma ${d.form}`;
      return [dimName, recommendation, population];
    });

  if (interventionRows.length > 0) {
    drawTable(doc, m, doc.y, pageW,
      [
        { label: 'DIMENSIÓN', width: 0.22 },
        { label: 'RECOMENDACIÓN / INTERVENCIÓN MÍNIMA', width: 0.60 },
        { label: 'POBLACIÓN', width: 0.18, align: 'center' }
      ],
      interventionRows,
      { headerBgColor: '#BFDBFE', altRowColor: '#F0F9FF', fontSize: 6.5, rowHeight: 16 }
    );
  } else {
    doc.fontSize(10).fillColor('#10B981').font('Helvetica');
    doc.text('No se identificaron dimensiones con niveles significativos de riesgo alto. Se recomienda mantener las condiciones actuales y realizar seguimiento periódico.');
  }

  // ==========================================================
  // RECOMENDACION PRIORITARIA
  // ==========================================================
  newPage();
  sections.push({ title: 'RECOMENDACIÓN PRIORITARIA', page: pageNum + 1 });
  sectionTitle('RECOMENDACIÓN PRIORITARIA');

  doc.fontSize(10).fillColor('#374151').font('Helvetica');
  doc.text('Se recomienda enfatizar las recomendaciones dadas en este diagnóstico psicosocial de acuerdo al Sistema de Gestión de Seguridad y Salud en el Trabajo, contemplando las siguientes acciones prioritarias:', { width: pageW, align: 'justify' });
  doc.moveDown(0.5);

  const priorities = [
    'Intervención general: abordar las dimensiones en riesgo alto prioritario para la totalidad de la población.',
    `Estructurar programas de prevención y promoción de la salud mental y bienestar de los funcionarios de ${evaluation.company_name}.`,
    'Realizar evaluaciones de seguimiento cada 12 meses para monitorear la evolución de los indicadores de riesgo.',
    'Implementar un programa de vigilancia epidemiológica en riesgo psicosocial.',
    'Diversas estrategias basadas en las características de la población y la cultura organizacional.'
  ];
  priorities.forEach((p, i) => {
    doc.fontSize(10).fillColor('#374151').font('Helvetica');
    doc.text(`${i + 1}. ${p}`, { width: pageW, align: 'justify' });
    doc.moveDown(0.3);
  });

  // ==========================================================
  // CONCLUSIONES
  // ==========================================================
  newPage();
  sections.push({ title: 'CONCLUSIONES', page: pageNum + 1 });
  sectionTitle('CONCLUSIONES');

  doc.fontSize(10).fillColor('#374151').font('Helvetica');

  const totalEvaluated = aggResults.population.total;
  doc.text(`Se realizó la evaluación de riesgo psicosocial a ${totalEvaluated} trabajadores de ${evaluation.company_name}, teniendo en cuenta la distribución en Forma A (${aggResults.population.formaA}) y en Forma B (${aggResults.population.formaB}).`, { width: pageW, align: 'justify' });
  doc.moveDown(0.5);

  doc.text('Teniendo en cuenta los hallazgos significativos, se recomienda estructurar un plan de acción enmarcado bajo un sistema de vigilancia epidemiológica psicosocial donde se logre un cumplimiento regulatorio adecuado.', { width: pageW, align: 'justify' });
  doc.moveDown(0.5);

  doc.text('Realizando el análisis de resultados con los trabajadores, para en general su aumento o mantenimiento de riesgo significativo en las condiciones psicosociales, diseñando e implementando actividades que apunten a fortalecer los factores protectores y a disminuir los factores de riesgo identificados.', { width: pageW, align: 'justify' });
  doc.moveDown(0.5);

  const topRisk = atRiskDimensions.filter(d => d.highRiskPct > 20).slice(0, 5);
  if (topRisk.length > 0) {
    doc.text('Las dimensiones que requieren mayor atención son:', { width: pageW });
    doc.moveDown(0.2);
    topRisk.forEach(d => {
      const name = templates.DIMENSION_DISPLAY_NAMES[d.dimension] || d.dimension;
      doc.text(`  • ${name} (${d.highRiskPct.toFixed(0)}% en riesgo alto/muy alto)`, { width: pageW });
    });
    doc.moveDown(0.5);
  }

  doc.text(`Como conclusión general del análisis diagnóstico psicosocial de ${evaluation.company_name}, se puede observar que se deben tener en cuenta las dimensiones con mayor nivel de riesgo e implementar acciones oportunas de mejora, identificando las necesidades más importantes de la población.`, { width: pageW, align: 'justify' });

  // Signature
  doc.moveDown(4);
  doc.fontSize(12).fillColor('#1F2937').font('Helvetica-Bold');
  doc.text(evaluatorEmail || 'Evaluador BRS Digital', { align: 'center' });
  doc.fontSize(10).fillColor('#6B7280').font('Helvetica');
  doc.text('Especialista en Psicología Ocupacional y Organizacional', { align: 'center' });

  // ==========================================================
  // BACKFILL TABLE OF CONTENTS
  // ==========================================================
  // Prevent PDFKit from creating new pages during TOC backfill
  const origAddPage = doc.addPage;
  doc.addPage = function() { return doc; };

  doc.switchToPage(tocPageIndex);
  doc.y = doc.page.margins.top;
  let tocY = tocStartY + 25;
  doc.fontSize(10).fillColor('#374151').font('Helvetica');
  sections.forEach(section => {
    doc.y = doc.page.margins.top;
    doc.text(section.title, m, tocY, { lineBreak: false });
    doc.y = doc.page.margins.top;
    doc.text(String(section.page), m, tocY, { width: pageW, align: 'right', lineBreak: false });
    tocY += 18;
  });

  doc.addPage = origAddPage;

  // ==========================================================
  // FOOTERS
  // ==========================================================
  addFooters(doc);
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
    doc.y = doc.page.margins.top;
    doc.fontSize(7).fillColor('#9CA3AF');
    doc.text(
      'Generado por BRS Digital - Batería de Riesgo Psicosocial | Metodología oficial del Ministerio de la Protección Social',
      doc.page.margins.left,
      doc.page.height - 30,
      { width: doc.page.width - doc.page.margins.left * 2, align: 'center', lineBreak: false }
    );
    doc.y = doc.page.margins.top;
    doc.text(
      `Fecha: ${dateStr} | Página ${i + 1} de ${totalPages}`,
      doc.page.margins.left,
      doc.page.height - 20,
      { width: doc.page.width - doc.page.margins.left * 2, align: 'center', lineBreak: false }
    );
  }

  doc.addPage = origAddPage;
}

module.exports = router;
