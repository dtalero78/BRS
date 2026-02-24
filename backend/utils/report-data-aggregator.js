/**
 * Data Aggregation for Organizational BRS Report
 * Processes raw database results into structured data for PDF generation.
 */

const { DOMAIN_DIMENSIONS, DOMAIN_ORDER, EXTRALABORAL_DIMENSIONS } = require('./report-templates');

// ============================================================
// DEMOGRAPHIC DATA AGGREGATION
// ============================================================

/**
 * Aggregate demographic data from ficha_datos responses.
 * Handles both array format [{questionNumber, responseValue}] and object format {"2": "value"}.
 */
function aggregateDemographics(fichaResponses) {
  const demographics = {
    gender: {},
    ageRanges: { '18 - 30 años': 0, '31 - 40 años': 0, '41 - 50 años': 0, 'Mayores de 51': 0 },
    education: {},
    dependents: {},
    total: 0
  };

  const currentYear = new Date().getFullYear();

  fichaResponses.forEach(row => {
    let parsed;
    try {
      parsed = typeof row.responses === 'string' ? JSON.parse(row.responses) : row.responses;
    } catch { return; }

    // Normalize to { questionNumber: responseValue } map
    let responseMap = {};
    if (Array.isArray(parsed)) {
      parsed.forEach(r => {
        const qn = r.questionNumber || r.question_number;
        const rv = r.responseValue || r.response_value;
        if (qn != null) responseMap[String(qn)] = rv;
      });
    } else if (typeof parsed === 'object') {
      responseMap = {};
      for (const [k, v] of Object.entries(parsed)) {
        responseMap[String(k)] = v;
      }
    }

    demographics.total++;

    // Q2: Sexo
    const gender = responseMap['2'];
    if (gender && typeof gender === 'string') {
      demographics.gender[gender] = (demographics.gender[gender] || 0) + 1;
    }

    // Q3: Año de nacimiento -> age range
    const birthYear = parseInt(responseMap['3']);
    if (birthYear && birthYear > 1900 && birthYear < currentYear) {
      const age = currentYear - birthYear;
      if (age >= 18 && age <= 30) demographics.ageRanges['18 - 30 años']++;
      else if (age >= 31 && age <= 40) demographics.ageRanges['31 - 40 años']++;
      else if (age >= 41 && age <= 50) demographics.ageRanges['41 - 50 años']++;
      else if (age > 50) demographics.ageRanges['Mayores de 51']++;
    }

    // Q4: Último nivel de estudios
    const edu = responseMap['4'];
    if (edu && typeof edu === 'string') {
      // Group education levels for cleaner chart
      const eduGroup = groupEducation(edu);
      demographics.education[eduGroup] = (demographics.education[eduGroup] || 0) + 1;
    }

    // Q9: Dependientes económicos
    const deps = responseMap['9'];
    if (deps != null) {
      const depsNum = parseInt(deps);
      let depsLabel;
      if (isNaN(depsNum) || depsNum === 0) depsLabel = 'Ninguna';
      else if (depsNum === 1) depsLabel = 'Uno';
      else if (depsNum === 2) depsLabel = 'Dos';
      else if (depsNum === 3) depsLabel = 'Tres';
      else depsLabel = 'Cuatro o más';
      demographics.dependents[depsLabel] = (demographics.dependents[depsLabel] || 0) + 1;
    }
  });

  return demographics;
}

function groupEducation(edu) {
  const lower = edu.toLowerCase();
  if (lower.includes('primaria')) return 'Primaria';
  if (lower.includes('bachillerato') || lower.includes('secundaria')) return 'Secundaria';
  if (lower.includes('técnico') || lower.includes('tecnológico') || lower.includes('tecnico') || lower.includes('tecnologico')) return 'Técnico/Tecnológico';
  if (lower.includes('profesional') && !lower.includes('posgrado')) return 'Pregrado';
  if (lower.includes('posgrado') || lower.includes('maestr') || lower.includes('doctor') || lower.includes('especiali')) return 'Posgrado';
  if (lower.includes('militar') || lower.includes('policía') || lower.includes('policia')) return 'Carrera militar/policía';
  if (lower.includes('ninguno')) return 'Ninguno';
  return edu; // return as-is if no match
}

// ============================================================
// RESULTS AGGREGATION BY FORM
// ============================================================

/**
 * Aggregate all results separated by form type (A/B).
 * @param {Array} allResults - rows from results table joined with participants
 * @returns structured results object
 */
function aggregateResultsByForm(allResults) {
  // First, determine which participants are Forma A vs Forma B
  // by checking their questionnaire_type entries
  const participantForms = {}; // participant_evaluation_id -> 'A' | 'B'

  allResults.forEach(row => {
    const peId = row.participant_evaluation_id;
    if (row.questionnaire_type === 'intralaboral_a') participantForms[peId] = 'A';
    if (row.questionnaire_type === 'intralaboral_b') participantForms[peId] = 'B';
  });

  const result = {
    population: { total: 0, formaA: 0, formaB: 0 },
    // Intralaboral A: per-dimension risk counts { dimKey: { sin_riesgo: N, ... } }
    intralaboralA: { dimensions: {}, domains: {}, overall: newRiskCounts(), participantCount: 0 },
    // Intralaboral B: same structure
    intralaboralB: { dimensions: {}, domains: {}, overall: newRiskCounts(), participantCount: 0 },
    // Extralaboral: general + by form
    extralaboral: {
      general: { dimensions: {} },
      formaA: { dimensions: {} },
      formaB: { dimensions: {} }
    },
    // Stress: general risk distribution
    estres: { general: newRiskCounts(), formaA: newRiskCounts(), formaB: newRiskCounts() },
    // Coping (Brief COPE): subscale-level counts using coping levels
    coping: { subscales: {}, categories: {}, overall: newCopingCounts(), participantCount: 0 },
    // All dimension averages for intervention planning
    dimensionAverages: {}
  };

  // Count unique participants per form
  const uniquePE = new Set();
  const formaACounted = new Set();
  const formaBCounted = new Set();
  const copingCounted = new Set();

  allResults.forEach(row => {
    const peId = row.participant_evaluation_id;
    const qType = row.questionnaire_type;
    const form = participantForms[peId]; // 'A' or 'B'

    if (!uniquePE.has(peId)) {
      uniquePE.add(peId);
      result.population.total++;
      if (form === 'A') { result.population.formaA++; }
      else if (form === 'B') { result.population.formaB++; }
    }

    const parsed = typeof row.results === 'string' ? JSON.parse(row.results) : (row.results || []);

    parsed.forEach(d => {
      const dimKey = d.dimension;
      const riskLevel = d.riskLevel;
      if (!riskLevel) return;

      // Track averages
      const avgKey = `${qType}_${dimKey}`;
      if (!result.dimensionAverages[avgKey]) {
        result.dimensionAverages[avgKey] = { questionnaireType: qType, dimension: dimKey, scores: [], risks: [] };
      }
      if (d.transformedScore != null) result.dimensionAverages[avgKey].scores.push(d.transformedScore);
      result.dimensionAverages[avgKey].risks.push(riskLevel);

      // Intralaboral A
      if (qType === 'intralaboral_a') {
        if (!formaACounted.has(peId)) { formaACounted.add(peId); result.intralaboralA.participantCount++; }

        if (dimKey === 'puntaje_total_intralaboral') {
          incrementRisk(result.intralaboralA.overall, riskLevel);
        } else if (dimKey.endsWith('_total')) {
          const domainKey = dimKey.replace('_total', '');
          if (!result.intralaboralA.domains[domainKey]) result.intralaboralA.domains[domainKey] = newRiskCounts();
          incrementRisk(result.intralaboralA.domains[domainKey], riskLevel);
        } else if (!dimKey.startsWith('puntaje_total')) {
          if (!result.intralaboralA.dimensions[dimKey]) result.intralaboralA.dimensions[dimKey] = newRiskCounts();
          incrementRisk(result.intralaboralA.dimensions[dimKey], riskLevel);
        }
      }

      // Intralaboral B
      if (qType === 'intralaboral_b') {
        if (!formaBCounted.has(peId)) { formaBCounted.add(peId); result.intralaboralB.participantCount++; }

        if (dimKey === 'puntaje_total_intralaboral') {
          incrementRisk(result.intralaboralB.overall, riskLevel);
        } else if (dimKey.endsWith('_total')) {
          const domainKey = dimKey.replace('_total', '');
          if (!result.intralaboralB.domains[domainKey]) result.intralaboralB.domains[domainKey] = newRiskCounts();
          incrementRisk(result.intralaboralB.domains[domainKey], riskLevel);
        } else if (!dimKey.startsWith('puntaje_total')) {
          if (!result.intralaboralB.dimensions[dimKey]) result.intralaboralB.dimensions[dimKey] = newRiskCounts();
          incrementRisk(result.intralaboralB.dimensions[dimKey], riskLevel);
        }
      }

      // Extralaboral
      if (qType === 'extralaboral' && !dimKey.startsWith('puntaje_total') && !dimKey.endsWith('_total')) {
        if (!result.extralaboral.general.dimensions[dimKey]) result.extralaboral.general.dimensions[dimKey] = newRiskCounts();
        incrementRisk(result.extralaboral.general.dimensions[dimKey], riskLevel);

        if (form === 'A') {
          if (!result.extralaboral.formaA.dimensions[dimKey]) result.extralaboral.formaA.dimensions[dimKey] = newRiskCounts();
          incrementRisk(result.extralaboral.formaA.dimensions[dimKey], riskLevel);
        } else if (form === 'B') {
          if (!result.extralaboral.formaB.dimensions[dimKey]) result.extralaboral.formaB.dimensions[dimKey] = newRiskCounts();
          incrementRisk(result.extralaboral.formaB.dimensions[dimKey], riskLevel);
        }
      }

      // Extralaboral total
      if (qType === 'extralaboral' && (dimKey === 'puntaje_total_extralaboral' || dimKey === 'extralaboral_total')) {
        if (!result.extralaboral.general.overall) result.extralaboral.general.overall = newRiskCounts();
        incrementRisk(result.extralaboral.general.overall, riskLevel);
      }

      // Stress
      if (qType === 'estres') {
        incrementRisk(result.estres.general, riskLevel);
        if (form === 'A') incrementRisk(result.estres.formaA, riskLevel);
        else if (form === 'B') incrementRisk(result.estres.formaB, riskLevel);
      }

      // Coping
      if (qType === 'coping') {
        if (!copingCounted.has(peId)) { copingCounted.add(peId); result.coping.participantCount++; }
        if (dimKey === 'puntaje_total_coping') {
          incrementCoping(result.coping.overall, riskLevel);
        } else if (dimKey.endsWith('_total')) {
          if (!result.coping.categories[dimKey]) result.coping.categories[dimKey] = newCopingCounts();
          incrementCoping(result.coping.categories[dimKey], riskLevel);
        } else {
          if (!result.coping.subscales[dimKey]) result.coping.subscales[dimKey] = newCopingCounts();
          incrementCoping(result.coping.subscales[dimKey], riskLevel);
        }
      }
    });
  });

  return result;
}

/**
 * Get list of at-risk dimensions for intervention plan.
 * @param {object} aggregatedResults - from aggregateResultsByForm
 * @param {number} threshold - minimum % of high risk to include (default 0 = include all)
 * @returns {Array<{dimension, form, riskCounts, highRiskPct, totalParticipants}>}
 */
function getAtRiskDimensions(aggregatedResults) {
  const atRisk = [];
  const r = aggregatedResults;

  // Intralaboral A dimensions
  for (const [dimKey, riskCounts] of Object.entries(r.intralaboralA.dimensions)) {
    const total = sumCounts(riskCounts);
    const highRisk = (riskCounts.riesgo_alto || 0) + (riskCounts.riesgo_muy_alto || 0);
    const highPct = total > 0 ? (highRisk / total) * 100 : 0;
    atRisk.push({ dimension: dimKey, form: 'A', riskCounts, highRiskPct: highPct, totalParticipants: total });
  }

  // Intralaboral B dimensions
  for (const [dimKey, riskCounts] of Object.entries(r.intralaboralB.dimensions)) {
    const total = sumCounts(riskCounts);
    const highRisk = (riskCounts.riesgo_alto || 0) + (riskCounts.riesgo_muy_alto || 0);
    const highPct = total > 0 ? (highRisk / total) * 100 : 0;
    // Check if this dimension already has an A entry; if so, mark as 'A y B'
    const existingA = atRisk.find(d => d.dimension === dimKey && d.form === 'A');
    if (existingA && highPct > 15) {
      existingA.form = 'A y B';
      // Merge counts
      for (const [level, count] of Object.entries(riskCounts)) {
        existingA.riskCounts[level] = (existingA.riskCounts[level] || 0) + count;
      }
      existingA.totalParticipants += total;
      existingA.highRiskPct = existingA.totalParticipants > 0
        ? ((existingA.riskCounts.riesgo_alto || 0) + (existingA.riskCounts.riesgo_muy_alto || 0)) / existingA.totalParticipants * 100
        : 0;
    } else {
      atRisk.push({ dimension: dimKey, form: 'B', riskCounts, highRiskPct: highPct, totalParticipants: total });
    }
  }

  // Extralaboral dimensions
  for (const [dimKey, riskCounts] of Object.entries(r.extralaboral.general.dimensions)) {
    const total = sumCounts(riskCounts);
    const highRisk = (riskCounts.riesgo_alto || 0) + (riskCounts.riesgo_muy_alto || 0);
    const highPct = total > 0 ? (highRisk / total) * 100 : 0;
    atRisk.push({ dimension: dimKey, form: 'TODOS', riskCounts, highRiskPct: highPct, totalParticipants: total });
  }

  // Sort by high risk percentage descending
  atRisk.sort((a, b) => b.highRiskPct - a.highRiskPct);

  return atRisk;
}

// ============================================================
// HELPERS
// ============================================================

function newRiskCounts() {
  return { sin_riesgo: 0, riesgo_bajo: 0, riesgo_medio: 0, riesgo_alto: 0, riesgo_muy_alto: 0 };
}

function newCopingCounts() {
  return { muy_bajo: 0, bajo: 0, medio: 0, alto: 0, muy_alto: 0 };
}

function incrementRisk(obj, riskLevel) {
  if (obj[riskLevel] !== undefined) obj[riskLevel]++;
}

function incrementCoping(obj, riskLevel) {
  if (obj[riskLevel] !== undefined) obj[riskLevel]++;
}

function sumCounts(riskCounts) {
  return Object.values(riskCounts).reduce((s, v) => s + v, 0);
}

module.exports = {
  aggregateDemographics,
  aggregateResultsByForm,
  getAtRiskDimensions,
  newRiskCounts,
  newCopingCounts,
  sumCounts
};
