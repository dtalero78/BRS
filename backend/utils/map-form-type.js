/**
 * Deriva la Forma (A/B) del campo "tipo de cargo" de la ficha de datos.
 *
 * Usada al crear un participante por foto/entrada manual cuando no viene
 * otro dato mas confiable (que cuestionario intralaboral respondio de
 * verdad) que indique su forma.
 */
function mapFormTypeFromTipoCargo(tc) {
  if (!tc) return null;
  const u = String(tc).toUpperCase().trim();

  // Las 4 opciones oficiales del campo "tipo de cargo" de la ficha (ver
  // bateria_riesgo_psicosocial_preguntas.json), comparadas exactas primero.
  // La 3a es justamente "Auxiliar, asistente administrativo, asistente
  // TÉCNICO" — contiene la palabra "técnico", que el heurístico de abajo usa
  // para detectar Forma A. Sin esta comparación exacta, TODA persona que
  // marca esa opción (la más común: auxiliares y asistentes) quedaba
  // clasificada como Forma A en vez de B. Reportado el 2026-10-16 (Elymar
  // Rodriguez, LOGYSCOOP): el PDF salía bien —no usa este campo— pero el
  // % de avance y la insignia "Forma" en Participantes sí, y se quedaban
  // trabados en 67% aunque la persona hubiera respondido todo.
  if (u === 'JEFATURA - TIENE PERSONAL A CARGO') return 'A';
  if (u === 'PROFESIONAL, ANALISTA, TÉCNICO, TECNÓLOGO' || u === 'PROFESIONAL, ANALISTA, TECNICO, TECNOLOGO') return 'A';
  if (u === 'AUXILIAR, ASISTENTE ADMINISTRATIVO, ASISTENTE TÉCNICO' || u === 'AUXILIAR, ASISTENTE ADMINISTRATIVO, ASISTENTE TECNICO') return 'B';
  if (u === 'OPERARIO, OPERADOR, AYUDANTE, SERVICIOS GENERALES') return 'B';

  // Heurístico por palabra suelta, para texto libre (Excel de cliente, OCR
  // impreciso, etc.) que no calce exacto con ninguna de las 4 de arriba.
  // AUXILIAR/ASISTENTE/OPERARIO van primero a propósito: "asistente técnico"
  // es la redacción oficial de Auxiliar (Forma B), así que si se mira
  // "técnico" antes se vuelve a caer en el mismo bug.
  if (u.includes('AUXILIAR') || u.includes('ASISTENT') || u.includes('OPERARI') || u.includes('OPERAD') || u.includes('AYUDANT')) return 'B';
  if (u.includes('JEFATURA') || u.includes('PROFESIONAL') || u.includes('TÉCNIC') || u.includes('TECNIC')) return 'A';
  return null;
}

module.exports = { mapFormTypeFromTipoCargo };
