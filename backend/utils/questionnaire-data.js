/**
 * Textos de los cuestionarios en el idioma de la evaluación.
 *
 * La fuente sigue siendo `bateria_riesgo_psicosocial_preguntas.json` (español).
 * `bateria_riesgo_psicosocial_preguntas.en.json` trae SOLO la batería oficial
 * en inglés (ficha, Forma A, Forma B, extralaboral, estrés) y las dos escalas
 * Likert. El Brief COPE y el SOFI-SM no tienen versión en inglés: una
 * evaluación en inglés los deja apagados (ver `language` en routes/evaluations.js).
 *
 * Invariante que sostiene todo lo demás: el idioma cambia lo que se MUESTRA,
 * nunca lo que se GUARDA.
 *  - Escalas: se guardan como número por posición, así que basta traducir las
 *    etiquetas en el mismo orden.
 *  - Ficha: `opciones` conserva el literal oficial en español (es lo que se
 *    guarda y lo que agrupan los informes); la etiqueta en inglés viaja aparte
 *    en `opciones_en`, misma longitud y mismo orden.
 * `tests/questionnaire-data.test.js` falla si el archivo en inglés se
 * desalinea del español.
 */

const fs = require('fs');
const path = require('path');

const ES_PATH = path.join(__dirname, '../../bateria_riesgo_psicosocial_preguntas.json');
const EN_PATH = path.join(__dirname, '../../bateria_riesgo_psicosocial_preguntas.en.json');

/** Cuestionarios que existen en inglés (llaves de `cuestionarios`). */
const EN_QUESTIONNAIRES = [
  'ficha_datos_generales',
  'forma_a_intralaboral',
  'forma_b_intralaboral',
  'extralaboral',
  'estres',
];

const cache = {};

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function normalizeLanguage(language) {
  return language === 'en' ? 'en' : 'es';
}

/**
 * Datos completos de cuestionarios para un idioma, con la misma forma que el
 * JSON en español. En inglés, los cuestionarios sin traducción quedan en
 * español (no se ofrecen, pero así nada que los lea revienta).
 *
 * @param {'es'|'en'} [language]
 */
function getQuestionnaireData(language) {
  const lang = normalizeLanguage(language);
  if (cache[lang]) return cache[lang];

  const es = readJson(ES_PATH);
  if (lang === 'es') {
    cache.es = es;
    return es;
  }

  const en = readJson(EN_PATH);
  const merged = JSON.parse(JSON.stringify(es));
  merged.opciones_respuesta = { ...merged.opciones_respuesta, ...(en.opciones_respuesta || {}) };
  for (const key of EN_QUESTIONNAIRES) {
    if (en.cuestionarios && en.cuestionarios[key]) {
      merged.cuestionarios[key] = en.cuestionarios[key];
    }
  }
  cache.en = merged;
  return merged;
}

/** Textos del menú del participante que no viven en el JSON. */
const HUB_DESCRIPTIONS = {
  es: {
    'ficha-datos': 'Información demográfica y laboral',
    'forma-a': 'Para jefes, profesionales y técnicos',
    'forma-b': 'Para auxiliares y operarios',
    extralaboral: 'Factores externos al trabajo',
    estres: 'Síntomas de estrés ocupacional',
    coping: 'Estrategias de afrontamiento al estrés',
    sofi: 'Fatiga al terminar la jornada de trabajo',
  },
  en: {
    'ficha-datos': 'Demographic and job information',
    'forma-a': 'For managers, professionals and technicians',
    'forma-b': 'For assistants and operators',
    extralaboral: 'Factors outside of work',
    estres: 'Occupational stress symptoms',
  },
};

function hubDescription(language, id) {
  const lang = normalizeLanguage(language);
  return (HUB_DESCRIPTIONS[lang] && HUB_DESCRIPTIONS[lang][id]) || HUB_DESCRIPTIONS.es[id];
}

/**
 * Idioma en que responde ESTA persona: 'en' o 'es'.
 *
 * Se decide por participante (`participants.demographic_data.language`), no
 * por campaña: en una misma evaluación pueden convivir unas pocas personas
 * que responden en inglés con el resto en español. Igual que `formType`, vive
 * en los datos de la persona y lo fija el evaluador.
 *
 * `evaluations.language = 'en'` sigue valiendo como "toda la campaña en
 * inglés" (columna de la primera versión; hoy sin pantalla que la ponga).
 *
 * Recibe una fila con `demographic_data` (de `participants.*`) y, si la hay,
 * `language` de evaluations. La usan participant-access.js (menú, guards,
 * completitud) y finalizePeStatus() de photo-import.js: tienen que decidir lo
 * mismo, o un PE en inglés queda atascado esperando un COPE que nunca verá.
 */
function participantLanguage(row) {
  if (!row) return 'es';
  if (row.language === 'en') return 'en';
  let demo = row.demographic_data;
  if (typeof demo === 'string') {
    try { demo = JSON.parse(demo); } catch (e) { demo = null; }
  }
  return demo && demo.language === 'en' ? 'en' : 'es';
}

module.exports = { getQuestionnaireData, hubDescription, normalizeLanguage, participantLanguage, EN_QUESTIONNAIRES };
