const fs = require('fs');
const path = require('path');

let cache = null;

function loadTotals() {
  if (cache) return cache;
  const dataPath = path.join(__dirname, '../../bateria_riesgo_psicosocial_preguntas.json');
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  const c = data.cuestionarios || {};
  cache = {
    intralaboral_a: c.forma_a_intralaboral?.total_preguntas || 123,
    intralaboral_b: c.forma_b_intralaboral?.total_preguntas || 97,
    extralaboral: c.extralaboral?.total_preguntas || 31,
    estres: c.estres?.total_sintomas || 31,
    coping: c.coping?.total_preguntas || 28,
    ficha_datos: c.ficha_datos_generales?.campos?.length || 18,
  };
  return cache;
}

function getExpectedTotal(questionnaireType) {
  const totals = loadTotals();
  return totals[questionnaireType] || null;
}

function isQuestionnaireComplete(questionnaireType, responses) {
  const expected = getExpectedTotal(questionnaireType);
  if (!expected) return false;
  const count = Array.isArray(responses)
    ? responses.length
    : (responses && typeof responses === 'object' ? Object.keys(responses).length : 0);
  return count >= expected;
}

module.exports = { getExpectedTotal, isQuestionnaireComplete };
