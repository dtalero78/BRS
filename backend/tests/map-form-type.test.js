const { mapFormTypeFromTipoCargo } = require('../utils/map-form-type');

// Las 4 opciones oficiales del campo "tipo de cargo" de la ficha
// (bateria_riesgo_psicosocial_preguntas.json). La 3a contiene la palabra
// "tecnico" dentro de su redaccion oficial pero es Forma B, no A: el bug
// original clasificaba a TODA persona que la marcara como Forma A.
describe('mapFormTypeFromTipoCargo: las 4 opciones oficiales', () => {
  test('Jefatura -> A', () => {
    expect(mapFormTypeFromTipoCargo('Jefatura - tiene personal a cargo')).toBe('A');
  });
  test('Profesional, analista, tecnico, tecnologo -> A', () => {
    expect(mapFormTypeFromTipoCargo('Profesional, analista, técnico, tecnólogo')).toBe('A');
  });
  // El caso reportado: Elymar Rodriguez (LOGYSCOOP, 2026-10-16) quedo
  // marcada Forma A con esta opcion exacta, aunque respondio el
  // cuestionario de 97 items (Forma B) completo.
  test('Auxiliar, asistente administrativo, asistente tecnico -> B (no A)', () => {
    expect(mapFormTypeFromTipoCargo('Auxiliar, asistente administrativo, asistente técnico')).toBe('B');
  });
  test('Operario, operador, ayudante, servicios generales -> B', () => {
    expect(mapFormTypeFromTipoCargo('Operario, operador, ayudante, servicios generales')).toBe('B');
  });

  test('variantes sin tildes / mayusculas / espacios de la 3a opcion siguen dando B', () => {
    expect(mapFormTypeFromTipoCargo('AUXILIAR, ASISTENTE ADMINISTRATIVO, ASISTENTE TECNICO')).toBe('B');
    expect(mapFormTypeFromTipoCargo('  auxiliar, asistente administrativo, asistente técnico  ')).toBe('B');
  });

  test('texto libre que menciona "tecnico" junto con "auxiliar" sigue dando B', () => {
    expect(mapFormTypeFromTipoCargo('auxiliar tecnico de mantenimiento')).toBe('B');
  });

  test('texto libre que es claramente un profesional tecnico (sin auxiliar/asistente) da A', () => {
    expect(mapFormTypeFromTipoCargo('tecnico de sistemas')).toBe('A');
  });

  test('sin dato', () => {
    expect(mapFormTypeFromTipoCargo('')).toBeNull();
    expect(mapFormTypeFromTipoCargo(null)).toBeNull();
    expect(mapFormTypeFromTipoCargo(undefined)).toBeNull();
  });

  test('texto que no coincide con nada devuelve null (no inventa una forma)', () => {
    expect(mapFormTypeFromTipoCargo('gerente de ventas regionales')).toBeNull();
  });
});
