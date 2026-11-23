/**
 * Preguntas con mayor proporción de respuestas de riesgo.
 *
 * Pedido de una empresa (nov-2026): "¿se pueden tener las preguntas que más
 * riesgo tuvieron?". La Batería oficial califica por DIMENSIÓN y no trae
 * baremos por ítem, así que esto NO es un nivel de riesgo: es un descriptivo
 * para orientar la intervención ("qué pregunta pesa más dentro de liderazgo").
 *
 * Respuesta de riesgo = la que suma puntaje alto con la misma regla del motor
 * (calculate-results.js), con la escala guardada Siempre=4 … Nunca=0:
 *   - Ítem redactado en negativo: Siempre o Casi siempre (valor ≥ 3).
 *   - Ítem protector (invertido, puntaje = 4 - valor): Nunca o Casi nunca.
 *   - Estrés (guardado Siempre=3 … Nunca=0): Siempre o Casi siempre (≥ 2).
 *
 * El porcentaje es sobre quienes respondieron ESE ítem: los de atención a
 * clientes y los de jefatura solo los responde quien aplica.
 */
const path = require('path');
const { ITEM_META } = require('./calculate-results');
const { toResponseList } = require('./response-format');

const PREGUNTAS = require(path.join(__dirname, '../../bateria_riesgo_psicosocial_preguntas.json')).cuestionarios;
const JSON_KEY = {
  intralaboral_a: 'forma_a_intralaboral',
  intralaboral_b: 'forma_b_intralaboral',
  extralaboral: 'extralaboral',
  estres: 'estres',
};

// Por debajo de esto un porcentaje no dice nada y además deja adivinar quién
// respondió qué. Mismo umbral que los resultados por área.
const MIN_RESPONDENTS = 5;

const cacheTextos = {};
function questionTexts(type) {
  if (cacheTextos[type]) return cacheTextos[type];
  const q = PREGUNTAS[JSON_KEY[type]] || {};
  const map = {};
  if (type === 'estres') {
    (q.malestares || []).forEach(x => { map[x.numero] = x.texto || x.malestar || x.sintoma; });
  } else {
    Object.values(q.secciones || {}).forEach(sec => {
      (sec.preguntas || []).forEach(x => { map[x.numero] = x.texto; });
    });
  }
  cacheTextos[type] = map;
  return map;
}

// Grupos de síntomas del cuestionario de estrés (Tabla 4 / STRESS_WEIGHT_GROUPS).
const STRESS_GROUPS = [
  { items: [1, 2, 3, 4, 5, 6, 7, 8], label: 'Síntomas fisiológicos' },
  { items: [9, 10, 11, 12], label: 'Síntomas de comportamiento social' },
  { items: [13, 14, 15, 16, 17, 18, 19, 20, 21, 22], label: 'Síntomas intelectuales y laborales' },
  { items: [23, 24, 25, 26, 27, 28, 29, 30, 31], label: 'Síntomas psicoemocionales' },
];

function itemDimension(type, numero) {
  if (type === 'estres') {
    const g = STRESS_GROUPS.find(x => x.items.includes(numero));
    return g ? g.label : null;
  }
  const meta = ITEM_META[type];
  if (!meta) return null;
  for (const [dim, def] of Object.entries(meta.dimensions)) {
    if ((def.questions || []).includes(numero)) return dim;
  }
  return null;
}

function isRiskAnswer(type, numero, valor) {
  if (type === 'estres') return valor >= 2;
  const meta = ITEM_META[type];
  const puntaje = meta && meta.inverted.has(numero) ? 4 - valor : valor;
  return puntaje >= 3;
}

/**
 * @param {string} type intralaboral_a | intralaboral_b | extralaboral | estres
 * @param {Array} responseRows filas con `.responses` (mapa o arreglo)
 * @returns {{respondents:number, items:Array}|null} null si hay menos de
 *   MIN_RESPONDENTS personas
 */
function analyzeItemRisk(type, responseRows, { top = 10, minRespondents = MIN_RESPONDENTS } = {}) {
  if (!JSON_KEY[type]) return null;
  const maxVal = type === 'estres' ? 3 : 4;
  const stats = {};
  let respondents = 0;
  for (const row of responseRows || []) {
    // Igual que buildResponseMap del motor: vacío no es respuesta (Number(null)
    // daría 0 = "Nunca" y contaría como riesgo en los ítems protectores), y un
    // ítem con dos valores distintos se descarta.
    const valores = {};
    const conflicto = new Set();
    for (const { questionNumber, responseValue } of toResponseList(row.responses)) {
      if (responseValue == null || String(responseValue).trim() === '') continue;
      const v = Number(responseValue);
      if (!Number.isInteger(v) || v < 0 || v > maxVal) continue;
      if (valores[questionNumber] === undefined) valores[questionNumber] = v;
      else if (valores[questionNumber] !== v) conflicto.add(questionNumber);
    }
    conflicto.forEach(q => { delete valores[q]; });
    let any = false;
    for (const [q, v] of Object.entries(valores)) {
      const questionNumber = Number(q);
      any = true;
      const s = stats[questionNumber] || (stats[questionNumber] = { respondieron: 0, enRiesgo: 0 });
      s.respondieron++;
      if (isRiskAnswer(type, questionNumber, v)) s.enRiesgo++;
    }
    if (any) respondents++;
  }
  if (respondents < minRespondents) return null;

  const textos = questionTexts(type);
  const items = Object.entries(stats)
    .map(([n, s]) => ({
      numero: Number(n),
      texto: textos[n] || `Pregunta ${n}`,
      dimension: itemDimension(type, Number(n)),
      // Qué respuesta cuenta como riesgo: sin esto, un ítem protector con 90%
      // ("Puedo expresar tristeza o enojo…") se lee al revés.
      respuestaRiesgo: type !== 'estres' && ITEM_META[type].inverted.has(Number(n))
        ? 'Nunca / Casi nunca' : 'Siempre / Casi siempre',
      respondieron: s.respondieron,
      enRiesgo: s.enRiesgo,
      pct: s.respondieron ? Math.round((s.enRiesgo / s.respondieron) * 1000) / 10 : 0,
    }))
    .filter(it => it.respondieron >= minRespondents && it.enRiesgo > 0)
    .sort((a, b) => b.pct - a.pct || b.enRiesgo - a.enRiesgo || a.numero - b.numero)
    .slice(0, top);

  return { respondents, items };
}

module.exports = { analyzeItemRisk, isRiskAnswer, questionTexts, itemDimension, MIN_RESPONDENTS };
