/**
 * SOFI-SM - Motor de cálculo
 *
 * Swedish Occupational Fatigue Inventory, versión española modificada.
 * Sebastián Cárdenas, Idoate García, Llano Lagares y Almanzor Elhadad (2008),
 * "SOFI-SM: cuestionario para el análisis de la fatiga laboral física, mental
 * y psíquica", 28 de abril. Revista Digital de Salud y Seguridad en el Trabajo, nº 2.
 *
 * 18 adjetivos, 6 dimensiones de 3 ítems, cada ítem de 0 (nada) a 10 (totalmente).
 * No hay ítems invertidos: más puntaje es siempre más fatiga.
 *
 * Decisiones propias (el artículo no las deja explícitas):
 * - Dimensión = suma de sus 3 ítems × 100 / 30. El artículo dice "de 0 a 100"
 *   sin dar la fórmula; esta es la única que cuadra con las medias que reporta.
 * - SSM-Index = suma de las 6 dimensiones × 100 / 600 (esta sí es del artículo).
 * - Los niveles se aplican al SSM-Index redondeado a entero, para que 25,4 no
 *   caiga en el hueco entre 25 y 26 de la tabla de los autores.
 * - Las mismas franjas se aplican a cada dimensión. El artículo solo las define
 *   para el SSM-Index: en dimensiones es una extensión nuestra y el informe lo dice.
 */

// Numeración = orden de aplicación del artículo original (los ítems de una
// misma dimensión van intercalados a propósito).
const DIMENSIONS = {
  falta_energia: { items: [1, 12, 15], name: 'Falta de energía' },
  cansancio_fisico: { items: [2, 10, 14], name: 'Cansancio físico' },
  disconfort_fisico: { items: [4, 7, 17], name: 'Disconfort físico' },
  falta_motivacion: { items: [5, 8, 18], name: 'Falta de motivación' },
  somnolencia: { items: [6, 9, 13], name: 'Somnolencia' },
  irritabilidad: { items: [3, 11, 16], name: 'Irritabilidad' }
};

const TOTAL_ITEMS = 18;
const MAX_ITEM = 10;

// Tabla de los autores (análoga a la del NASA-TLX de la Generalitat Valenciana).
const LEVELS = [
  { key: 'aceptable', max: 25, name: 'Nivel aceptable', action: 'No se requieren acciones' },
  { key: 'inadecuado', max: 50, name: 'Nivel inadecuado', action: 'Acciones aconsejadas' },
  { key: 'inadecuado_ii', max: 75, name: 'Nivel inadecuado II', action: 'Acciones prioritarias' },
  { key: 'inaceptable', max: 100, name: 'Nivel inaceptable', action: 'Acciones inmediatas' }
];

function classifyFatigue(score) {
  if (score === null || score === undefined) return null;
  const rounded = Math.round(score);
  return LEVELS.find(l => rounded <= l.max).key;
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

/**
 * Valor válido de un ítem: entero de 0 a 10. Cualquier otra cosa cuenta como
 * no respondido — rellenar con 0 subestimaría la fatiga en silencio.
 */
function itemValue(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= MAX_ITEM ? n : null;
}

/**
 * @param {Array} responses - [{question_number: 1, response_value: 7}, ...]
 * @returns {Array} - Resultados en el formato BRS: una fila por dimensión y
 *   `sofi_ssm_index` al final. Una dimensión con ítems sin responder queda en
 *   null, y con ella el SSM-Index.
 */
function calculateSofiResults(responses) {
  const responseMap = {};
  responses.forEach(r => {
    responseMap[r.question_number] = itemValue(r.response_value);
  });

  const results = [];
  let dimensionSum = 0;
  let complete = true;

  for (const [key, dimension] of Object.entries(DIMENSIONS)) {
    const values = dimension.items.map(item => responseMap[item] ?? null);
    const answered = values.every(v => v !== null);

    let rawScore = null;
    let transformedScore = null;
    if (answered) {
      rawScore = values.reduce((sum, v) => sum + v, 0);
      transformedScore = round1((rawScore * 100) / (dimension.items.length * MAX_ITEM));
      dimensionSum += transformedScore;
    } else {
      complete = false;
    }

    results.push({
      questionnaireType: 'sofi',
      dimension: key,
      rawScore,
      transformedScore,
      percentile: null,
      riskLevel: classifyFatigue(transformedScore)
    });
  }

  const ssmIndex = complete ? round1((dimensionSum * 100) / 600) : null;
  results.push({
    questionnaireType: 'sofi',
    dimension: 'sofi_ssm_index',
    rawScore: null,
    transformedScore: ssmIndex,
    percentile: null,
    riskLevel: classifyFatigue(ssmIndex)
  });

  return results;
}

module.exports = { calculateSofiResults, classifyFatigue, DIMENSIONS, LEVELS, TOTAL_ITEMS };
