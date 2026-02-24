/**
 * Brief COPE (COPE-28) - Calculation Engine
 *
 * Based on Carver (1997) Brief COPE Inventory
 * Spanish version: Morán, Landero & González (2010)
 *
 * 28 items, 14 subscales (2 items each), scale 0-3
 * Response scale: 0 = Nunca hago esto, 1 = Raramente, 2 = Frecuentemente, 3 = Siempre hago esto
 *
 * Each subscale score = sum of its 2 items (range 0-6)
 * Three macro categories: Problem-Focused, Emotion-Focused, Avoidant
 */

// 14 subscales with their item numbers
const SUBSCALES = {
  afrontamiento_activo: { items: [2, 10], name: 'Afrontamiento activo', category: 'problem_focused' },
  planificacion: { items: [6, 26], name: 'Planificación', category: 'problem_focused' },
  apoyo_instrumental: { items: [1, 28], name: 'Apoyo instrumental', category: 'problem_focused' },
  reinterpretacion_positiva: { items: [14, 18], name: 'Reinterpretación positiva', category: 'problem_focused' },
  apoyo_emocional: { items: [9, 17], name: 'Apoyo emocional', category: 'emotion_focused' },
  desahogo: { items: [12, 23], name: 'Desahogo', category: 'emotion_focused' },
  aceptacion: { items: [3, 21], name: 'Aceptación', category: 'emotion_focused' },
  humor: { items: [7, 19], name: 'Humor', category: 'emotion_focused' },
  religion: { items: [16, 20], name: 'Religión', category: 'emotion_focused' },
  autoinculpacion: { items: [8, 27], name: 'Auto-inculpación', category: 'emotion_focused' },
  autodistraccion: { items: [4, 22], name: 'Auto-distracción', category: 'avoidant' },
  negacion: { items: [5, 13], name: 'Negación', category: 'avoidant' },
  desconexion_conductual: { items: [11, 25], name: 'Desconexión conductual', category: 'avoidant' },
  uso_sustancias: { items: [15, 24], name: 'Uso de sustancias', category: 'avoidant' }
};

const CATEGORY_NAMES = {
  problem_focused: 'Afrontamiento centrado en el problema',
  emotion_focused: 'Afrontamiento centrado en la emoción',
  avoidant: 'Afrontamiento evitativo'
};

/**
 * Classify subscale score into interpretation level
 * Scale per subscale: 0-6 (sum of 2 items, each 0-3)
 */
function classifySubscaleScore(score) {
  if (score <= 1) return 'muy_bajo';
  if (score <= 2) return 'bajo';
  if (score <= 3) return 'medio';
  if (score <= 4) return 'alto';
  return 'muy_alto';
}

/**
 * Classify category score into interpretation level
 * Problem-focused: 4 subscales, max = 24
 * Emotion-focused: 6 subscales, max = 36
 * Avoidant: 4 subscales, max = 24
 */
function classifyCategoryScore(score, maxScore) {
  const pct = (score / maxScore) * 100;
  if (pct <= 20) return 'muy_bajo';
  if (pct <= 40) return 'bajo';
  if (pct <= 60) return 'medio';
  if (pct <= 80) return 'alto';
  return 'muy_alto';
}

/**
 * Calculate Brief COPE results
 * @param {Array} responses - [{question_number: 1, response_value: 2}, ...]
 * @returns {Array} - Results array compatible with BRS format
 */
function calculateCopingResults(responses) {
  // Build response map
  const responseMap = {};
  responses.forEach(r => {
    responseMap[r.question_number] = r.response_value;
  });

  const results = [];

  // Calculate each subscale
  for (const [key, subscale] of Object.entries(SUBSCALES)) {
    const itemScores = subscale.items.map(itemNum => responseMap[itemNum] || 0);
    const rawScore = itemScores.reduce((sum, val) => sum + val, 0);
    const transformedScore = (rawScore / 6) * 100; // Normalize to 0-100
    const level = classifySubscaleScore(rawScore);

    results.push({
      questionnaireType: 'coping',
      dimension: key,
      rawScore: rawScore,
      transformedScore: Math.round(transformedScore * 10) / 10,
      percentile: null,
      riskLevel: level
    });
  }

  // Calculate category totals
  const categoryScores = { problem_focused: 0, emotion_focused: 0, avoidant: 0 };
  const categoryCounts = { problem_focused: 0, emotion_focused: 0, avoidant: 0 };

  for (const [key, subscale] of Object.entries(SUBSCALES)) {
    const itemScores = subscale.items.map(itemNum => responseMap[itemNum] || 0);
    const rawScore = itemScores.reduce((sum, val) => sum + val, 0);
    categoryScores[subscale.category] += rawScore;
    categoryCounts[subscale.category]++;
  }

  // Add category totals
  for (const [category, score] of Object.entries(categoryScores)) {
    const maxScore = categoryCounts[category] * 6;
    const transformedScore = (score / maxScore) * 100;
    const level = classifyCategoryScore(score, maxScore);

    results.push({
      questionnaireType: 'coping',
      dimension: `${category}_total`,
      rawScore: score,
      transformedScore: Math.round(transformedScore * 10) / 10,
      percentile: null,
      riskLevel: level
    });
  }

  // Add overall total
  const totalScore = Object.values(categoryScores).reduce((sum, val) => sum + val, 0);
  const maxTotal = 84; // 28 items * 3 max
  const totalTransformed = (totalScore / maxTotal) * 100;

  results.push({
    questionnaireType: 'coping',
    dimension: 'puntaje_total_coping',
    rawScore: totalScore,
    transformedScore: Math.round(totalTransformed * 10) / 10,
    percentile: null,
    riskLevel: classifyCategoryScore(totalScore, maxTotal)
  });

  return results;
}

module.exports = { calculateCopingResults, SUBSCALES, CATEGORY_NAMES };
