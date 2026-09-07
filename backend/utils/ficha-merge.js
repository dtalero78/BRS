// Fusión de la ficha sociodemográfica leída por OCR con la que ya está guardada.
//
// El OCR no siempre logra leer todos los campos y `transformFichaToResponseMap`
// escribe '' en los que faltan. Reemplazar la ficha completa con ese mapa borraba
// datos buenos: el 2026-09-07 una recarga dejó a 18 personas de Esfera Color sin
// sexo, edad, cargo ni contrato, conservando únicamente el nivel de estudios.
// Aquí un campo vacío nunca pisa uno que ya tenía valor.
//
// El merge es SEMÁNTICO, no por número de pregunta: la ficha guardada puede usar
// la numeración 'official' (19 campos, otro orden — allí la 5 es la ocupación,
// mientras que en la hoja OCR es el estado civil), así que mezclar por posición
// corrompería los datos. Se reescribe en el esquema que ya traía la ficha, para
// no perder los campos que solo existen en él (nombre, tipo de salario).
const { resolveFicha, FICHA_FIELD_MAP } = require('./report-data-aggregator');
const { FICHA_FIELDS } = require('./answer-sheet-ocr');

const tieneValor = (v) => v !== undefined && v !== null && String(v).trim() !== '';

/**
 * @param {object|string|null} guardadaRaw  responses de la ficha ya guardada (jsonb, array o string). null si no hay.
 * @param {object} nuevoMap                 mapa { '1': valor, ... } en la numeración de FICHA_FIELDS.
 * @returns {object} mapa listo para guardar.
 */
function fusionarFicha(guardadaRaw, nuevoMap) {
  if (!guardadaRaw) return nuevoMap;

  const vieja = resolveFicha(guardadaRaw);
  const esquema = vieja._scheme === 'official' ? 'official' : 'photo';
  const mapa = FICHA_FIELD_MAP[esquema];

  const nuevaPorNombre = {};
  for (const f of FICHA_FIELDS) nuevaPorNombre[f.name] = nuevoMap[String(f.key)];

  const salida = {};
  for (const [campo, num] of Object.entries(mapa)) {
    if (tieneValor(nuevaPorNombre[campo])) salida[num] = String(nuevaPorNombre[campo]);
    else if (tieneValor(vieja[campo])) salida[num] = String(vieja[campo]);
    else salida[num] = '';
  }
  return salida;
}

module.exports = { fusionarFicha };
