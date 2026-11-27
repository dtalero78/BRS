const { getQuestionnaireData, EN_QUESTIONNAIRES, hubDescription } = require('../utils/questionnaire-data');

// La versión en inglés solo cambia lo que se MUESTRA. Si se desalinea del
// español, se guardan datos equivocados sin que nada falle a la vista:
//  - un `numero` distinto guarda la respuesta en otro ítem del motor de cálculo;
//  - una escala con otro largo invierte el puntaje (se guarda por posición);
//  - una opción de la ficha traducida en `opciones` rompe las gráficas del
//    informe, que agrupan por el literal oficial en español.

const es = getQuestionnaireData('es');
const en = getQuestionnaireData('en');

function questionNumbers(q) {
  if (q.campos) return q.campos.map((c) => c.numero);
  if (q.malestares) return q.malestares.map((m) => m.numero);
  return Object.values(q.secciones || {}).flatMap((s) => (s.preguntas || []).map((p) => p.numero));
}

/** Recorre dos árboles en paralelo y junta toda diferencia de forma. */
function shapeDiff(a, b, path = '', out = []) {
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) out.push(`${path}: largo ${a.length} vs ${b && b.length}`);
    else a.forEach((x, i) => shapeDiff(x, b[i], `${path}[${i}]`, out));
  } else if (a && typeof a === 'object') {
    if (!b || typeof b !== 'object') { out.push(`${path}: falta`); return out; }
    for (const k of Object.keys(a)) shapeDiff(a[k], b[k], `${path}.${k}`, out);
  } else if (typeof a !== 'string' && a !== b) {
    // Números y booleanos (numero, total_preguntas…) deben ser idénticos.
    out.push(`${path}: ${a} vs ${b}`);
  } else if (typeof a === 'string' && typeof b !== 'string') {
    out.push(`${path}: falta el texto`);
  }
  return out;
}

describe('versión en inglés de la batería', () => {
  test.each(EN_QUESTIONNAIRES)('%s tiene la misma estructura que en español', (key) => {
    expect(en.cuestionarios[key]).toBeDefined();
    expect(en.cuestionarios[key]).not.toBe(es.cuestionarios[key]);
    expect(questionNumbers(en.cuestionarios[key])).toEqual(questionNumbers(es.cuestionarios[key]));
    expect(shapeDiff(es.cuestionarios[key], en.cuestionarios[key])).toEqual([]);
  });

  test('las escalas tienen las mismas opciones en el mismo orden (se guardan por posición)', () => {
    expect(en.opciones_respuesta.escala_principal).toEqual(['Always', 'Almost always', 'Sometimes', 'Almost never', 'Never']);
    expect(en.opciones_respuesta.escala_estres).toEqual(['Always', 'Almost always', 'Sometimes', 'Never']);
    expect(en.opciones_respuesta.escala_principal).toHaveLength(es.opciones_respuesta.escala_principal.length);
    expect(en.opciones_respuesta.escala_estres).toHaveLength(es.opciones_respuesta.escala_estres.length);
  });

  test('la ficha guarda los literales oficiales en español y trae etiquetas en inglés aparte', () => {
    const walk = (esNode, enNode) => {
      if (Array.isArray(esNode)) return esNode.forEach((x, i) => walk(x, enNode[i]));
      if (!esNode || typeof esNode !== 'object') return;
      if (Array.isArray(esNode.opciones)) {
        expect(enNode.opciones).toEqual(esNode.opciones);
        expect(Array.isArray(enNode.opciones_en)).toBe(true);
        expect(enNode.opciones_en).toHaveLength(esNode.opciones.length);
      }
      for (const k of Object.keys(esNode)) walk(esNode[k], enNode[k]);
    };
    walk(es.cuestionarios.ficha_datos_generales, en.cuestionarios.ficha_datos_generales);
  });

  test('los textos de las preguntas sí están traducidos', () => {
    const textos = (q) => Object.values(q.secciones).flatMap((s) => s.preguntas.map((p) => p.texto));
    const esA = textos(es.cuestionarios.forma_a_intralaboral);
    const enA = textos(en.cuestionarios.forma_a_intralaboral);
    const iguales = enA.filter((t, i) => t === esA[i]);
    expect(iguales).toEqual([]);
  });

  test('el español no cambia y no hereda nada del inglés', () => {
    expect(es.opciones_respuesta.escala_principal[0]).toBe('Siempre');
    expect(es.cuestionarios.ficha_datos_generales.campos.some((c) => c.opciones_en)).toBe(false);
  });

  test('las descripciones del menú caen al español si no hay traducción', () => {
    expect(hubDescription('en', 'estres')).toBe('Occupational stress symptoms');
    expect(hubDescription('en', 'coping')).toBe('Estrategias de afrontamiento al estrés');
    expect(hubDescription('en', 'sofi')).toBe('Fatiga al terminar la jornada de trabajo');
    expect(hubDescription(undefined, 'estres')).toBe('Síntomas de estrés ocupacional');
  });
});

// El idioma es por persona: unos pocos en inglés dentro de una campaña en
// español. La misma regla decide el menú, los guards, la completitud del PE
// (participant-access.js) y finalizePeStatus() de la importación por foto.
const { participantLanguage } = require('../utils/questionnaire-data');

describe('participantLanguage: idioma de cada persona', () => {
  test('sin dato es español', () => {
    expect(participantLanguage(null)).toBe('es');
    expect(participantLanguage({})).toBe('es');
    expect(participantLanguage({ demographic_data: { formType: 'A' } })).toBe('es');
  });
  test('la persona marcada en inglés responde en inglés aunque la campaña sea en español', () => {
    expect(participantLanguage({ language: 'es', demographic_data: { language: 'en' } })).toBe('en');
  });
  test('demographic_data puede venir como texto JSON (o roto)', () => {
    expect(participantLanguage({ demographic_data: '{"language":"en"}' })).toBe('en');
    expect(participantLanguage({ demographic_data: '{roto' })).toBe('es');
  });
  test('una campaña completa en inglés (columna de la primera versión) sigue valiendo', () => {
    expect(participantLanguage({ language: 'en', demographic_data: { language: 'es' } })).toBe('en');
  });
});
