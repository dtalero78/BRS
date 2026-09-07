/**
 * Las respuestas viven en `responses.responses` con DOS formas distintas segun
 * quien las haya escrito, y ambas son validas:
 *
 *   - Mapa   `{"1": 4, "2": 3}`  — lo escriben el ingreso manual / foto
 *     (`photo-import`), la importacion de Excel y `POST /api/responses`.
 *   - Arreglo `[{questionNumber, responseValue}]` — lo escribe la pantalla del
 *     participante, que guarda tal cual lo que manda el navegador.
 *
 * Los lectores que asumian una sola forma devolvian una lista vacia con la
 * otra, y eso no era cosmetico: la pantalla del participante creia que el
 * cuestionario estaba en blanco y su primer autoguardado REEMPLAZABA la fila
 * entera, borrando lo que el psicologo habia digitado a mano.
 *
 * Ademas la columna es de tipo `json`, asi que `pg` ya entrega un objeto: el
 * `JSON.parse` que hacian los lectores reventaba con
 * `"[object Object]" is not valid JSON` y caia al `catch` -> lista vacia.
 * Por eso aqui solo se parsea cuando de verdad llega un string.
 */

/** Convierte cualquiera de las dos formas a `[{questionNumber, responseValue}]`. */
function toResponseList(raw) {
  const data = parseIfString(raw);
  if (!data) return [];

  if (Array.isArray(data)) {
    return data
      .map(item => ({
        questionNumber: Number(item.questionNumber ?? item.question_number),
        responseValue: item.responseValue ?? item.response_value,
        dimension: item.dimension,
        domain: item.domain,
      }))
      .filter(item => Number.isFinite(item.questionNumber));
  }

  if (typeof data === 'object') {
    return Object.entries(data)
      .map(([questionNumber, responseValue]) => ({
        questionNumber: Number(questionNumber),
        responseValue,
        dimension: undefined,
        domain: undefined,
      }))
      .filter(item => Number.isFinite(item.questionNumber));
  }

  return [];
}

/** Convierte cualquiera de las dos formas al mapa `{numeroDePregunta: valor}`. */
function toResponseMap(raw) {
  const map = {};
  for (const item of toResponseList(raw)) {
    map[item.questionNumber] = item.responseValue;
  }
  return map;
}

function parseIfString(raw) {
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

module.exports = { toResponseList, toResponseMap };
