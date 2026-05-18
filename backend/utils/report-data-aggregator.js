/**
 * Data Aggregation for Organizational BRS Report
 * Processes raw database results into structured data for PDF generation.
 */

const { DOMAIN_DIMENSIONS, DOMAIN_ORDER, EXTRALABORAL_DIMENSIONS } = require('./report-templates');

// ============================================================
// FICHA_DATOS FIELD RESOLUTION
// ============================================================
// The ficha_datos questionnaire is saved with TWO different numbering schemes
// depending on the capture flow:
//
//  - Web/token flow (participant-access) uses the OFFICIAL numbering from the
//    JSON questionnaire definition (Q1=Nombre, Q2=Sexo, ..., Q12=Cargo, Q13=TipoCargo,
//    Q15=Departamento, Q16=Contrato, Q7=Estrato).
//  - Photo/manual flow (answer-sheet-ocr.js) uses an internal mapping
//    (key1=fecha, key5=maritalStatus, key8=estrato, key13=cargo, key14=tipoCargo,
//    key16=departamento, key17=contrato).
//
// We normalise both into a `ficha` object with semantic keys before consuming.

function buildResponseMap(rawResponses) {
  let parsed;
  try {
    parsed = typeof rawResponses === 'string' ? JSON.parse(rawResponses) : rawResponses;
  } catch { return {}; }
  if (!parsed) return {};
  const map = {};
  if (Array.isArray(parsed)) {
    parsed.forEach(r => {
      const qn = r.questionNumber || r.question_number;
      const rv = r.responseValue !== undefined ? r.responseValue : r.response_value;
      if (qn != null) map[String(qn)] = rv;
    });
  } else if (typeof parsed === 'object') {
    for (const [k, v] of Object.entries(parsed)) map[String(k)] = v;
  }
  return map;
}

// Heuristic detector: photo/manual flow stores Q1 as "fecha" (a date string),
// the official flow stores Q1 as a person's full name. tipoCargo also lives in
// different question numbers per flow.
function detectFichaScheme(responseMap) {
  const q1 = (responseMap['1'] || '').toString().trim();
  if (/^\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}$/.test(q1)) return 'photo';
  // tipoCargo value is one of 4 known options; presence in Q14 (photo) vs Q13 (official)
  const q13 = (responseMap['13'] || '').toString();
  const q14 = (responseMap['14'] || '').toString();
  const isTipoCargo = (s) => /jefatura|profesional|auxiliar|operario|tecnic|asistent|ayudant/i.test(s);
  if (isTipoCargo(q14) && !isTipoCargo(q13)) return 'photo';
  if (isTipoCargo(q13) && !isTipoCargo(q14)) return 'official';
  return 'official';
}

const FICHA_FIELD_MAP = {
  official: {
    nombre: '1', sexo: '2', birthYear: '3', education: '4', ocupacion: '5',
    ciudadResidencia: '6', estrato: '7', tipoVivienda: '8', dependientes: '9',
    ciudadTrabajo: '10', anosEmpresa: '11', cargo: '12', tipoCargo: '13',
    anosCargo: '14', departamento: '15', tipoContrato: '16', horasTrabajo: '17',
    tipoSalario: '18'
  },
  photo: {
    fecha: '1', sexo: '2', birthYear: '3', education: '4', maritalStatus: '5',
    ocupacion: '6', ciudadResidencia: '7', estrato: '8', dependientes: '9',
    tipoVivienda: '10', ciudadTrabajo: '11', anosEmpresa: '12', cargo: '13',
    tipoCargo: '14', anosCargo: '15', departamento: '16', tipoContrato: '17',
    horasTrabajo: '18'
  }
};

function resolveFicha(rawResponses) {
  const responseMap = buildResponseMap(rawResponses);
  const scheme = detectFichaScheme(responseMap);
  const fields = FICHA_FIELD_MAP[scheme];
  const ficha = { _scheme: scheme };
  for (const [name, qn] of Object.entries(fields)) {
    const v = responseMap[qn];
    if (v !== undefined && v !== null && v !== '') ficha[name] = v;
  }
  return ficha;
}

// ============================================================
// DEMOGRAPHIC DATA AGGREGATION
// ============================================================

/**
 * Aggregate demographic data from ficha_datos responses.
 * Resolves both numbering schemes (web/photo) into semantic field names.
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
    const ficha = resolveFicha(row.responses);
    demographics.total++;

    if (ficha.sexo && typeof ficha.sexo === 'string') {
      demographics.gender[ficha.sexo] = (demographics.gender[ficha.sexo] || 0) + 1;
    }

    const birthYear = extractYear(ficha.birthYear);
    if (birthYear && birthYear > 1900 && birthYear < currentYear) {
      const age = currentYear - birthYear;
      if (age >= 18 && age <= 30) demographics.ageRanges['18 - 30 años']++;
      else if (age >= 31 && age <= 40) demographics.ageRanges['31 - 40 años']++;
      else if (age >= 41 && age <= 50) demographics.ageRanges['41 - 50 años']++;
      else if (age > 50) demographics.ageRanges['Mayores de 51']++;
    }

    if (ficha.education && typeof ficha.education === 'string') {
      const eduGroup = groupEducation(ficha.education);
      demographics.education[eduGroup] = (demographics.education[eduGroup] || 0) + 1;
    }

    if (ficha.dependientes != null) {
      const depsNum = parseInt(ficha.dependientes);
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

function extractYear(val) {
  if (val == null) return null;
  const s = String(val);
  const m = s.match(/(19|20)\d{2}/);
  if (m) return parseInt(m[0], 10);
  const n = parseInt(s);
  return isNaN(n) ? null : n;
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
      general: { dimensions: {}, overall: newRiskCounts() },
      formaA: { dimensions: {}, overall: newRiskCounts() },
      formaB: { dimensions: {}, overall: newRiskCounts() }
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

// ============================================================
// STRESS TYPOLOGY AGGREGATION
// ============================================================
/**
 * Categorize stress symptoms into 4 groups based on item numbers.
 * Items: 1-8 Fisiológico, 9-12 Intelectuales y laborales, 13-22 Comportamiento social, 23-31 Psicoemocionales
 */
function aggregateStressTypology(stressResponses) {
  const groups = {
    'Fisiológico': { items: [1,2,3,4,5,6,7,8], total: 0, count: 0 },
    'Intelectuales y laborales': { items: [9,10,11,12], total: 0, count: 0 },
    'Comportamiento Social': { items: [13,14,15,16,17,18,19,20,21,22], total: 0, count: 0 },
    'Psicoemocionales': { items: [23,24,25,26,27,28,29,30,31], total: 0, count: 0 }
  };

  stressResponses.forEach(row => {
    let parsed;
    try {
      parsed = typeof row.responses === 'string' ? JSON.parse(row.responses) : row.responses;
    } catch { return; }

    let responseMap = {};
    if (Array.isArray(parsed)) {
      parsed.forEach(r => {
        const qn = parseInt(r.questionNumber || r.question_number);
        const rv = parseInt(r.responseValue || r.response_value) || 0;
        if (qn) responseMap[qn] = rv;
      });
    } else if (typeof parsed === 'object') {
      for (const [k, v] of Object.entries(parsed)) {
        responseMap[parseInt(k)] = parseInt(v) || 0;
      }
    }

    for (const [groupName, group] of Object.entries(groups)) {
      let groupSum = 0;
      let groupCount = 0;
      for (const item of group.items) {
        if (responseMap[item] !== undefined) {
          groupSum += responseMap[item];
          groupCount++;
        }
      }
      if (groupCount > 0) {
        group.total += groupSum;
        group.count++;
      }
    }
  });

  // Calculate contribution percentages
  const totalAll = Object.values(groups).reduce((s, g) => s + g.total, 0);
  const result = {};
  for (const [name, group] of Object.entries(groups)) {
    result[name] = totalAll > 0 ? Math.round(group.total / totalAll * 100) : 0;
  }
  return result;
}

// ============================================================
// RISK PRIORITIZATION MATRIX
// ============================================================
function buildRiskPrioritizationMatrix(aggregatedResults) {
  const r = aggregatedResults;
  const matrix = [];

  // Helper to get combined A+B risk counts for a dimension
  function getCombinedCounts(dimKey) {
    const a = r.intralaboralA.dimensions[dimKey] || newRiskCounts();
    const b = r.intralaboralB.dimensions[dimKey] || newRiskCounts();
    const combined = newRiskCounts();
    for (const level of Object.keys(combined)) {
      combined[level] = (a[level] || 0) + (b[level] || 0);
    }
    return combined;
  }

  // All intralaboral dimensions from both forms
  const allDims = new Set([
    ...Object.keys(r.intralaboralA.dimensions),
    ...Object.keys(r.intralaboralB.dimensions)
  ]);

  // Stress total counts
  const stressTotal = sumCounts(r.estres.general);
  const stressHighCount = (r.estres.general.riesgo_medio || 0) + (r.estres.general.riesgo_alto || 0) + (r.estres.general.riesgo_muy_alto || 0);

  for (const dimKey of allDims) {
    const counts = getCombinedCounts(dimKey);
    const total = sumCounts(counts);
    if (total === 0) continue;

    const medio = counts.riesgo_medio || 0;
    const alto = counts.riesgo_alto || 0;
    const muyAlto = counts.riesgo_muy_alto || 0;
    const magnitud = (medio + alto + muyAlto) / total * 100;

    // Simplified association index (0.3-0.7 based on magnitud overlap with stress)
    const indiceAsociacion = magnitud > 50 ? 0.5 : magnitud > 30 ? 0.4 : 0.3;

    // Stress count: approximate as proportion of high-stress participants
    const stressEstimate = Math.round(stressHighCount * (magnitud / 100));

    matrix.push({
      dimension: dimKey,
      magnitud,
      indiceAsociacion,
      estres: stressEstimate,
      intra: alto + muyAlto
    });
  }

  return matrix;
}

// ============================================================
// AGGREGATE BY AREA/SEDE
// ============================================================
function aggregateResultsByArea(allResults, fichaResponses) {
  const peToArea = {};

  fichaResponses.forEach(row => {
    const ficha = resolveFicha(row.responses);
    const area = ficha.ciudadTrabajo || ficha.departamento;
    if (area && typeof area === 'string' && area.trim()) {
      const normalized = area.trim().charAt(0).toUpperCase() + area.trim().slice(1).toLowerCase();
      peToArea[row.participant_evaluation_id] = normalized;
    }
  });

  const areaGroups = {};
  allResults.forEach(row => {
    const area = peToArea[row.participant_evaluation_id];
    if (!area) return;
    if (!areaGroups[area]) areaGroups[area] = [];
    areaGroups[area].push(row);
  });

  const result = {};
  for (const [area, rows] of Object.entries(areaGroups)) {
    if (rows.length < 5) continue;
    result[area] = aggregateResultsByForm(rows);
  }

  return result;
}

// ============================================================
// AGGREGATE BY CARGO (TIPO DE CARGO)
// ============================================================
/**
 * Group all results by tipoCargo (Jefatura / Profesional-Técnico /
 * Auxiliar-Asistente / Operario), which is what PVE programs typically
 * expect. Returns the same shape as aggregateResultsByForm, plus a
 * `demandasTrabajo` slice with the dominio Demandas del trabajo and its
 * dimensions per cargo.
 */
function aggregateResultsByCargo(allResults, fichaResponses, options = {}) {
  const minPerGroup = options.minPerGroup ?? 1;
  const peToCargo = {};

  fichaResponses.forEach(row => {
    const ficha = resolveFicha(row.responses);
    const cargo = normalizeTipoCargo(ficha.tipoCargo);
    if (cargo) peToCargo[row.participant_evaluation_id] = cargo;
  });

  const cargoGroups = {};
  allResults.forEach(row => {
    const cargo = peToCargo[row.participant_evaluation_id];
    if (!cargo) return;
    if (!cargoGroups[cargo]) cargoGroups[cargo] = [];
    cargoGroups[cargo].push(row);
  });

  const result = {};
  for (const [cargo, rows] of Object.entries(cargoGroups)) {
    const peCount = new Set(rows.map(r => r.participant_evaluation_id)).size;
    if (peCount < minPerGroup) continue;
    result[cargo] = aggregateResultsByForm(rows);
  }
  return result;
}

/**
 * Build the "Demandas del trabajo por cargo" slice ready to render.
 * Returns an array per cargo with:
 *   - cargo (normalized name)
 *   - participantCount
 *   - domainCounts (combined A+B for demandas_trabajo total)
 *   - dimensions: { dimKey: combinedRiskCounts }
 */
function buildDemandasPorCargo(cargoResults) {
  const out = [];
  const demandasDimsA = (DOMAIN_DIMENSIONS.demandas_trabajo && DOMAIN_DIMENSIONS.demandas_trabajo.A) || [];
  const demandasDimsB = (DOMAIN_DIMENSIONS.demandas_trabajo && DOMAIN_DIMENSIONS.demandas_trabajo.B) || [];
  const allDims = [...new Set([...demandasDimsA, ...demandasDimsB])];

  for (const [cargo, agg] of Object.entries(cargoResults)) {
    const peCount = (agg.intralaboralA.participantCount || 0) + (agg.intralaboralB.participantCount || 0);

    const domainCounts = newRiskCounts();
    const a = agg.intralaboralA.domains.demandas_trabajo || newRiskCounts();
    const b = agg.intralaboralB.domains.demandas_trabajo || newRiskCounts();
    for (const k of Object.keys(domainCounts)) {
      domainCounts[k] = (a[k] || 0) + (b[k] || 0);
    }

    const dimensions = {};
    for (const d of allDims) {
      const da = agg.intralaboralA.dimensions[d] || newRiskCounts();
      const db = agg.intralaboralB.dimensions[d] || newRiskCounts();
      const combined = newRiskCounts();
      for (const k of Object.keys(combined)) combined[k] = (da[k] || 0) + (db[k] || 0);
      const total = sumCounts(combined);
      if (total > 0) dimensions[d] = combined;
    }

    out.push({ cargo, participantCount: peCount, domainCounts, dimensions });
  }

  // Stable order: Jefatura first, then Profesional, Auxiliar, Operario
  const order = ['Jefatura', 'Profesional / Técnico', 'Auxiliar / Asistente', 'Operario / Servicios generales'];
  out.sort((a, b) => order.indexOf(a.cargo) - order.indexOf(b.cargo));
  return out;
}

function normalizeEstrato(raw) {
  const s = String(raw).trim();
  // Extract first digit 1-6 (handles "1", "1.0", "Estrato 1", "ESTRATO_2", etc.)
  const m = s.match(/[1-6]/);
  return m ? 'Estrato ' + m[0] : 'Sin información';
}

function normalizeContractType(raw) {
  const lower = String(raw).toLowerCase().trim();
  if (!lower) return 'Sin información';
  if (lower.includes('indefinido')) return 'Término indefinido';
  if (lower.includes('fijo') || lower.includes('temporal')) return 'Término fijo';
  if (lower.includes('obra') || lower.includes('labor')) return 'Obra y labor';
  if (lower.includes('prestaci') || lower.includes('honorario')) return 'Prestación de servicios';
  if (lower.includes('cooper') || lower.includes('cta')) return 'Cooperado';
  if (lower.includes('aprendiz')) return 'Aprendizaje';
  if (lower.includes('pasant')) return 'Pasantía';
  // Fallback: capitalize first word to group minor variations
  const words = String(raw).trim().split(/\s+/);
  const key = words.slice(0, 4).join(' ');
  return key || 'Otro';
}

// ============================================================
// EXTENDED DEMOGRAPHICS
// ============================================================
function aggregateExtendedDemographics(fichaResponses) {
  const base = aggregateDemographics(fichaResponses);

  base.estadoCivil = {};
  base.estrato = {};
  base.tipoVivienda = {};
  base.tipoCargo = {};
  base.tipoContrato = {};
  base.departamento = {};
  base.ciudadTrabajo = {};
  base.cargo = {};
  base.antiguedadEmpresa = { 'Menos de 1 año': 0, '1 a 5 años': 0, '6 a 10 años': 0, 'Más de 10 años': 0 };
  base.horasTrabajo = { '8 horas o menos': 0, '9 a 10 horas': 0, '11 a 12 horas': 0, 'Más de 12 horas': 0 };

  fichaResponses.forEach(row => {
    const ficha = resolveFicha(row.responses);

    // Estado civil — solo presente en flujo foto/manual
    if (ficha.maritalStatus && typeof ficha.maritalStatus === 'string') {
      base.estadoCivil[ficha.maritalStatus] = (base.estadoCivil[ficha.maritalStatus] || 0) + 1;
    }

    if (ficha.estrato != null && ficha.estrato !== '') {
      const estratoLabel = normalizeEstrato(ficha.estrato);
      base.estrato[estratoLabel] = (base.estrato[estratoLabel] || 0) + 1;
    }

    if (ficha.tipoVivienda) {
      base.tipoVivienda[ficha.tipoVivienda] = (base.tipoVivienda[ficha.tipoVivienda] || 0) + 1;
    }

    if (ficha.tipoCargo) {
      const norm = normalizeTipoCargo(ficha.tipoCargo);
      if (norm) base.tipoCargo[norm] = (base.tipoCargo[norm] || 0) + 1;
    }

    if (ficha.tipoContrato) {
      const normC = normalizeContractType(ficha.tipoContrato);
      base.tipoContrato[normC] = (base.tipoContrato[normC] || 0) + 1;
    }

    if (ficha.departamento && typeof ficha.departamento === 'string') {
      const dep = ficha.departamento.trim();
      if (dep) base.departamento[dep] = (base.departamento[dep] || 0) + 1;
    }

    if (ficha.ciudadTrabajo && typeof ficha.ciudadTrabajo === 'string') {
      const c = ficha.ciudadTrabajo.trim();
      if (c) base.ciudadTrabajo[c] = (base.ciudadTrabajo[c] || 0) + 1;
    }

    if (ficha.cargo && typeof ficha.cargo === 'string') {
      const c = ficha.cargo.trim();
      if (c) base.cargo[c] = (base.cargo[c] || 0) + 1;
    }

    const yrs = parseYearsValue(ficha.anosEmpresa);
    if (yrs !== null) {
      if (yrs < 1) base.antiguedadEmpresa['Menos de 1 año']++;
      else if (yrs <= 5) base.antiguedadEmpresa['1 a 5 años']++;
      else if (yrs <= 10) base.antiguedadEmpresa['6 a 10 años']++;
      else base.antiguedadEmpresa['Más de 10 años']++;
    }

    const h = parseHoursValue(ficha.horasTrabajo);
    if (h !== null) {
      if (h <= 8) base.horasTrabajo['8 horas o menos']++;
      else if (h <= 10) base.horasTrabajo['9 a 10 horas']++;
      else if (h <= 12) base.horasTrabajo['11 a 12 horas']++;
      else base.horasTrabajo['Más de 12 horas']++;
    }
  });

  return base;
}

function normalizeTipoCargo(s) {
  if (!s) return null;
  const u = String(s).toUpperCase();
  if (u.includes('JEFATURA')) return 'Jefatura';
  // Order matters: the official "Auxiliar..." option also contains "técnico",
  // so check auxiliar/operario first.
  if (u.includes('AUXILIAR') || u.includes('ASISTENT')) return 'Auxiliar / Asistente';
  if (u.includes('OPERARI') || u.includes('OPERAD') || u.includes('AYUDANT') || u.includes('SERVICIOS GENERALES')) return 'Operario / Servicios generales';
  if (u.includes('PROFESIONAL') || u.includes('ANALISTA') || u.includes('TÉCNIC') || u.includes('TECNIC') || u.includes('TECNOLOG')) return 'Profesional / Técnico';
  return null;
}

function parseYearsValue(val) {
  if (val == null || val === '') return null;
  const s = String(val).toLowerCase();
  const monthMatch = s.match(/(\d+)\s*mes/);
  if (monthMatch) return parseInt(monthMatch[1], 10) / 12;
  const yearMatch = s.match(/(\d+)\s*(año|anio|an[oó])/);
  if (yearMatch) return parseInt(yearMatch[1], 10);
  const bare = s.match(/^\s*(\d+)(?:[\.,](\d+))?\s*$/);
  if (bare) return parseFloat(bare[1] + (bare[2] ? '.' + bare[2] : ''));
  return null;
}

function parseHoursValue(val) {
  if (val == null || val === '') return null;
  const m = String(val).match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

module.exports = {
  aggregateDemographics,
  aggregateExtendedDemographics,
  aggregateResultsByForm,
  getAtRiskDimensions,
  aggregateStressTypology,
  buildRiskPrioritizationMatrix,
  aggregateResultsByArea,
  aggregateResultsByCargo,
  buildDemandasPorCargo,
  resolveFicha,
  normalizeTipoCargo,
  newRiskCounts,
  newCopingCounts,
  sumCounts
};
