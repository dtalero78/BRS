const { groupEducation } = require('../utils/report-data-aggregator');

// El mismo nivel entra escrito de tres formas distintas segun la puerta: el
// formulario del participante, la carga del evaluador y los Excel de cada
// empresa. Estos son valores REALES de produccion (33 variantes sobre 2.219
// fichas); 617 de ellas caian en barras sueltas en la grafica del informe.
describe('groupEducation: variantes reales de produccion', () => {
  test('todas las formas de escribir posgrado caen en Posgrado', () => {
    for (const v of ['Posgrado completo', 'Posgrado incompleto', 'POSTGRADO COMPLETO',
      'POSTGRADO INCOMPLETO', 'POSTGRADO INCOMPLE', 'Post-grado completo',
      'Post-grado incompleto', 'Maestría', 'Doctorado', 'Especialización']) {
      expect(groupEducation(v)).toBe('Posgrado');
    }
  });

  test('tecnico y tecnologico, con o sin tilde, espacios o mayusculas', () => {
    for (const v of ['Técnico / tecnológico completo', 'Técnico/tecnológico completo',
      'TÉCNICO/TECNOLÓGICO INCOMPLETO', 'TÉCNICO/TECNOLOGICO INCOMPLE', 'Técnico',
      'Técnico / tecnólogo completo']) {
      expect(groupEducation(v)).toBe('Técnico/Tecnológico');
    }
  });

  test('profesional y universitario son pregrado', () => {
    for (const v of ['Profesional completo', 'PROFESIONAL INCOMPLE', 'Universitario']) {
      expect(groupEducation(v)).toBe('Pregrado');
    }
  });

  test('las abreviaturas de primaria del Excel de un cliente', () => {
    for (const v of ['Primaria completa', 'PRI COMPLETA', 'PRI INCOMPLE']) {
      expect(groupEducation(v)).toBe('Primaria');
    }
  });

  test('bachillerato es secundaria', () => {
    for (const v of ['Bachillerato completo', 'BACHILLERATO INCOMPLE', 'Secundaria']) {
      expect(groupEducation(v)).toBe('Secundaria');
    }
  });

  // 'profesional/posgrado' debe contar como posgrado: era el proposito del
  // guard viejo `profesional && !posgrado`, y hay que conservarlo.
  test('un valor que menciona profesional Y posgrado cuenta como posgrado', () => {
    expect(groupEducation('Profesional con posgrado')).toBe('Posgrado');
  });

  // 'Bachiller' NO se agrupa a proposito: 334 fichas lo traen del default viejo
  // del formulario de participantes, no de una respuesta. Meterlo en Secundaria
  // afirmaria una escolaridad que esas personas nunca dieron; dejarlo visible
  // es la senal de que hay que limpiar ese dato.
  test('un valor desconocido se devuelve tal cual, no se esconde', () => {
    expect(groupEducation('Bachiller')).toBe('Bachiller');
    expect(groupEducation('cualquier cosa')).toBe('cualquier cosa');
  });

  test('no se cae con vacio', () => {
    expect(groupEducation('')).toBe('');
  });
});
