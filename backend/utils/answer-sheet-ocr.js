const AnthropicModule = require('@anthropic-ai/sdk');
const Anthropic = AnthropicModule.default || AnthropicModule;

const QUESTIONNAIRE_META = {
  intralaboral_a: { label: 'Intralaboral Forma A (Jefes / Profesionales / Técnicos)', count: 123, scale: 'intra' },
  intralaboral_b: { label: 'Intralaboral Forma B (Auxiliares / Operarios)',          count: 97,  scale: 'intra' },
  extralaboral:   { label: 'Extralaboral',                                            count: 31,  scale: 'intra' },
  estres:         { label: 'Estrés',                                                  count: 31,  scale: 'stress' },
};

// Orden canónico en el que se devuelven los cuestionarios detectados.
const LIKERT_TYPES = ['intralaboral_a', 'intralaboral_b', 'extralaboral', 'estres'];

// Títulos con los que cada sección aparece impresa en las hojas oficiales.
// Se usan tanto en el pase de índice como en los pases de extracción.
const SECTION_TITLES = {
  intralaboral_a: '"CUESTIONARIO DE FACTORES DE RIESGO PSICOSOCIAL INTRALABORAL" con encabezado "FORMA A" (Jefes/Profesionales/Técnicos)',
  intralaboral_b: '"CUESTIONARIO DE FACTORES DE RIESGO PSICOSOCIAL INTRALABORAL" con encabezado "FORMA B" (Auxiliares/Operarios)',
  extralaboral:   '"CUESTIONARIO DE FACTORES PSICOSOCIALES EXTRALABORALES"',
  estres:         '"CUESTIONARIO PARA LA EVALUACIÓN DEL ESTRÉS - TERCERA VERSIÓN"',
  ficha_datos:    '"FICHA DE DATOS GENERALES" (o "DATOS GENERALES" / "SOCIODEMOGRÁFICOS")',
};

const FICHA_FIELDS = [
  { key: 1,  name: 'fecha',            label: 'Fecha de aplicación' },
  { key: 2,  name: 'sexo',             label: 'Sexo (Masculino, Femenino u Otro)' },
  { key: 3,  name: 'birthYear',        label: 'Año de nacimiento (o fecha completa si aparece)' },
  { key: 4,  name: 'education',        label: 'Último nivel de estudios' },
  { key: 5,  name: 'maritalStatus',    label: 'Estado civil' },
  { key: 6,  name: 'ocupacion',        label: 'Ocupación o profesión' },
  { key: 7,  name: 'ciudadResidencia', label: 'Ciudad/municipio y departamento de residencia' },
  { key: 8,  name: 'estrato',          label: 'Estrato (1..6, Finca o No sé)' },
  { key: 9,  name: 'dependientes',     label: 'Número de personas que dependen económicamente' },
  { key: 10, name: 'tipoVivienda',     label: 'Tipo de vivienda (Propia, En arriendo, Familiar)' },
  { key: 11, name: 'ciudadTrabajo',    label: 'Ciudad/municipio y departamento de trabajo' },
  { key: 12, name: 'anosEmpresa',      label: 'Cuántos años (o meses) lleva en la empresa' },
  { key: 13, name: 'cargo',            label: 'Nombre del cargo' },
  { key: 14, name: 'tipoCargo',        label: 'Tipo de cargo (Jefatura, Profesional/analista/técnico, Auxiliar/asistente, Operario/operador)' },
  { key: 15, name: 'anosCargo',        label: 'Cuántos años (o meses) en el cargo actual' },
  { key: 16, name: 'departamento',     label: 'Departamento/área/sección de la empresa' },
  { key: 17, name: 'tipoContrato',     label: 'Tipo de contrato (Temporal <1, Temporal ≥1, Indefinido, Cooperado, Prestación de servicios, No sé)' },
  { key: 18, name: 'horasTrabajo',     label: 'Horas diarias de trabajo' },
];
const FICHA_FIELD_NAMES = FICHA_FIELDS.map(f => f.name);

const SCALE_DESCRIPTIONS = {
  intra: [
    'Siempre        = 4',
    'Casi siempre   = 3',
    'Algunas veces  = 2',
    'Casi nunca     = 1',
    'Nunca          = 0',
  ].join('\n'),
  stress: [
    'Siempre        = 3',
    'Casi siempre   = 2',
    'A veces        = 1',
    'Nunca          = 0',
  ].join('\n'),
};

function detectFileKind(buffer) {
  if (!buffer || buffer.length < 4) return { type: 'image', mediaType: 'image/jpeg' };
  const b = buffer;
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) {
    return { type: 'document', mediaType: 'application/pdf' };
  }
  if (b[0] === 0xff && b[1] === 0xd8) return { type: 'image', mediaType: 'image/jpeg' };
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { type: 'image', mediaType: 'image/png' };
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return { type: 'image', mediaType: 'image/gif' };
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46) return { type: 'image', mediaType: 'image/webp' };
  return { type: 'image', mediaType: 'image/jpeg' };
}

function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY no está configurada en el servidor.');
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

function ocrModel() {
  return process.env.OCR_MODEL || 'claude-sonnet-4-6';
}

// La API de Anthropic rechaza requests de más de 32 MB, y base64 infla ~33%.
// Se valida una sola vez antes de gastar llamadas.
const MAX_PAYLOAD_BYTES = 22 * 1024 * 1024;

function assertPayloadSize(imageBuffers) {
  const total = imageBuffers.reduce((sum, b) => sum + (b ? b.length : 0), 0);
  if (total > MAX_PAYLOAD_BYTES) {
    throw new Error(
      `Los archivos pesan ${Math.round(total / (1024 * 1024))} MB en total; el máximo procesable es ${MAX_PAYLOAD_BYTES / (1024 * 1024)} MB. ` +
      'Reduce la resolución del escaneo o divide el PDF.',
    );
  }
}

function buildFileBlocks(imageBuffers) {
  return imageBuffers.map(buf => {
    const kind = detectFileKind(buf);
    return {
      type: kind.type,
      source: {
        type: 'base64',
        media_type: kind.mediaType,
        data: buf.toString('base64'),
      },
    };
  });
}

/**
 * Una sola llamada al modelo, forzada a devolver `tool`.
 * Devuelve { input, usage }.
 */
async function callModel({ client, imageBuffers, systemPrompt, tool, userText, maxTokens = 16000 }) {
  const response = await client.messages.create({
    model: ocrModel(),
    max_tokens: maxTokens,
    system: [
      { type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } },
    ],
    tools: [tool],
    tool_choice: { type: 'tool', name: tool.name },
    messages: [
      {
        role: 'user',
        content: [
          ...buildFileBlocks(imageBuffers),
          { type: 'text', text: userText },
        ],
      },
    ],
  });

  const toolBlock = response.content.find(b => b.type === 'tool_use' && b.name === tool.name);
  if (!toolBlock) {
    const textBlock = response.content.find(b => b.type === 'text');
    throw new Error(
      'El modelo no devolvió el resultado estructurado. ' +
      (textBlock ? `Texto recibido: ${String(textBlock.text).slice(0, 200)}` : ''),
    );
  }

  return { input: toolBlock.input || {}, usage: response.usage || {} };
}

function emptyUsage() {
  return { inputTokens: 0, outputTokens: 0, cacheReadInputTokens: 0, cacheCreationInputTokens: 0, calls: 0 };
}

function addUsage(acc, usage) {
  acc.calls += 1;
  acc.inputTokens += usage.input_tokens || 0;
  acc.outputTokens += usage.output_tokens || 0;
  acc.cacheReadInputTokens += usage.cache_read_input_tokens || 0;
  acc.cacheCreationInputTokens += usage.cache_creation_input_tokens || 0;
  return acc;
}

/**
 * Ejecuta `fn` sobre cada item con concurrencia limitada.
 * Los PDFs escaneados pesan mucho en tokens de entrada; lanzar 4 pases en
 * paralelo puede reventar el límite de tokens/minuto de la cuenta.
 */
async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

// ---------------------------------------------------------------------------
// Extracción de un cuestionario Likert
// ---------------------------------------------------------------------------

function buildSystemPrompt(questionnaireType, expectedCount, scale, expectParticipantInfo, opts = {}) {
  const meta = QUESTIONNAIRE_META[questionnaireType];
  const scaleDesc = SCALE_DESCRIPTIONS[scale];
  const maxValue = scale === 'stress' ? 3 : 4;
  const { multiDocument = false, locationHint = '' } = opts;

  const lines = [
    'Eres un asistente experto en leer hojas físicas de respuestas de la Batería de Riesgo Psicosocial del Ministerio de Protección Social de Colombia (Resolución 2646 de 2008).',
    '',
    `Cuestionario objetivo: ${meta.label}`,
    `Se identifica por el título ${SECTION_TITLES[questionnaireType]}.`,
    `Número de preguntas esperadas: ${expectedCount} (numeradas de 1 a ${expectedCount}).`,
    'Escala Likert de este cuestionario (devuelve el valor numérico, NO el texto):',
    scaleDesc,
    '',
  ];

  if (multiDocument) {
    lines.push(
      'IMPORTANTE: el archivo adjunto contiene VARIOS cuestionarios distintos (ficha de datos, intralaboral, extralaboral, estrés).',
      'Cada cuestionario tiene su propia numeración que empieza en 1. Extrae ÚNICAMENTE el cuestionario objetivo indicado arriba',
      'e ignora por completo las páginas de los demás cuestionarios. NO mezcles preguntas de otras secciones.',
    );
    if (locationHint) lines.push(`Ubicación aproximada del cuestionario objetivo en el archivo: ${locationHint}.`);
    lines.push('');
  }

  lines.push(
    'Reglas estrictas:',
    '1. Cada pregunta tiene UNA sola marca (X, círculo o similar) en la columna correspondiente a una opción Likert.',
    `2. Devuelve responseValue como entero entre 0 y ${maxValue}, según la escala de arriba.`,
    '3. Si una pregunta no tiene ninguna marca, o tiene múltiples marcas ambiguas, OMÍTELA del array "responses". NO inventes una respuesta.',
    '4. Si la marca existe pero es dudosa (borrosa, tachada, parcial), inclúyela con confidence = "low".',
    '5. Si la marca es clara e inequívoca, confidence = "high". Si es legible pero no perfecta, "medium".',
    `6. Los números de pregunta deben ser enteros 1..${expectedCount}. Si reconoces el número pero no la respuesta, NO lo incluyas.`,
    '7. Recorre TODAS las páginas del cuestionario objetivo de principio a fin. No te detengas antes de llegar a la última pregunta.',
    '8. Reporta en "warnings" cualquier observación general (hoja rota, mancha, columna cortada, preguntas sin marcar, etc).',
    expectParticipantInfo
      ? '9. Además extrae los datos del encabezado: número de documento (solo dígitos), primer nombre y primer apellido si están escritos. Usa confidence apropiada. Si no hay encabezado visible, devuelve participantInfo con cadenas vacías y confidence = "low".'
      : '9. NO devuelvas participantInfo — el participante ya fue seleccionado en el sistema.',
    '',
    'Devuelve SIEMPRE tu respuesta usando la herramienta save_extracted_answers con el esquema exacto. No escribas prosa fuera de la llamada a la herramienta.',
  );

  return lines.join('\n');
}

function buildTool(expectParticipantInfo) {
  const schema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      responses: {
        type: 'array',
        description: 'Lista de preguntas detectadas con su respuesta. Omite preguntas sin marca o ambiguas.',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            questionNumber: { type: 'integer', description: 'Número de la pregunta, entre 1 y N.' },
            responseValue:  { type: 'integer', description: 'Valor en la escala BRS: 0..4 para intra/extralaboral, 0..3 para estrés.' },
            confidence:     { type: 'string', enum: ['high', 'medium', 'low'] },
          },
          required: ['questionNumber', 'responseValue', 'confidence'],
        },
      },
      warnings: {
        type: 'array',
        items: { type: 'string' },
        description: 'Observaciones generales sobre la hoja o la extracción.',
      },
    },
    required: ['responses', 'warnings'],
  };

  if (expectParticipantInfo) {
    schema.properties.participantInfo = {
      type: 'object',
      additionalProperties: false,
      description: 'Datos del encabezado de la hoja.',
      properties: {
        documentNumber: { type: 'string', description: 'Solo dígitos, sin puntos ni espacios. Vacío si no es legible.' },
        firstName:      { type: 'string' },
        lastName:       { type: 'string' },
        confidence:     { type: 'string', enum: ['high', 'medium', 'low'] },
      },
      required: ['documentNumber', 'firstName', 'lastName', 'confidence'],
    };
    schema.required.push('participantInfo');
  }

  return {
    name: 'save_extracted_answers',
    description: 'Guarda las respuestas extraídas de la hoja física. Úsala exactamente una vez.',
    strict: true,
    input_schema: schema,
  };
}

function cleanResponses(rawResponses, expectedCount, maxValue, seen = new Set()) {
  const cleaned = [];
  for (const r of Array.isArray(rawResponses) ? rawResponses : []) {
    const qn = Number(r.questionNumber);
    const rv = Number(r.responseValue);
    if (!Number.isInteger(qn) || qn < 1 || qn > expectedCount) continue;
    if (!Number.isInteger(rv) || rv < 0 || rv > maxValue) continue;
    if (seen.has(qn)) continue;
    seen.add(qn);
    cleaned.push({
      questionNumber: qn,
      responseValue: rv,
      confidence: ['high', 'medium', 'low'].includes(r.confidence) ? r.confidence : 'medium',
    });
  }
  return cleaned;
}

function summarizeResponses(responses, expectedCount, warnings) {
  const sorted = [...responses].sort((a, b) => a.questionNumber - b.questionNumber);
  const seen = new Set(sorted.map(r => r.questionNumber));

  const missing = [];
  for (let i = 1; i <= expectedCount; i++) {
    if (!seen.has(i)) missing.push(i);
  }

  const lowConfidenceCount = sorted.filter(r => r.confidence === 'low').length;

  return {
    responses: sorted,
    missing,
    warnings: (warnings || []).filter(w => typeof w === 'string'),
    summary: {
      totalDetected: sorted.length,
      totalExpected: expectedCount,
      lowConfidenceCount,
      missingCount: missing.length,
    },
  };
}

/**
 * Extrae un cuestionario Likert completo, con un reintento dirigido a las
 * preguntas que quedaron sin detectar en el primer pase.
 */
async function extractOneQuestionnaire({
  client,
  imageBuffers,
  questionnaireType,
  expectParticipantInfo = false,
  multiDocument = false,
  locationHint = '',
  usageAcc,
}) {
  const meta = QUESTIONNAIRE_META[questionnaireType];
  const maxValue = meta.scale === 'stress' ? 3 : 4;
  const systemPrompt = buildSystemPrompt(
    questionnaireType, meta.count, meta.scale, expectParticipantInfo, { multiDocument, locationHint },
  );
  const tool = buildTool(expectParticipantInfo);

  const firstText = expectParticipantInfo
    ? `Lee el/los archivo(s) adjunto(s) y extrae: (1) los datos del encabezado (documento y nombre) y (2) todas las marcas de respuesta del cuestionario ${meta.label}, con su número de pregunta. Esperas ${meta.count} preguntas numeradas. Si el PDF tiene varias páginas, recórrelas todas.`
    : `Lee el/los archivo(s) adjunto(s) y extrae todas las marcas de respuesta del cuestionario ${meta.label}, con su número de pregunta. Esperas ${meta.count} preguntas numeradas. Si el PDF tiene varias páginas, recórrelas todas.`;

  const first = await callModel({ client, imageBuffers, systemPrompt, tool, userText: firstText });
  if (usageAcc) addUsage(usageAcc, first.usage);

  const seen = new Set();
  const responses = cleanResponses(first.input.responses, meta.count, maxValue, seen);
  const warnings = Array.isArray(first.input.warnings) ? first.input.warnings.slice() : [];

  // Reintento dirigido: si quedaron huecos, se le pide al modelo únicamente
  // esas preguntas. Cubre el caso típico de un pase que "se cansa" a mitad de
  // un cuestionario largo (Forma A tiene 123 ítems).
  const missing = [];
  for (let i = 1; i <= meta.count; i++) if (!seen.has(i)) missing.push(i);

  if (missing.length >= 3) {
    try {
      const retryTool = buildTool(false);
      const retryText = [
        `En una lectura previa del cuestionario ${meta.label} quedaron sin extraer las siguientes preguntas:`,
        missing.join(', '),
        '',
        'Vuelve a revisar el archivo y devuelve ÚNICAMENTE esas preguntas con su marca.',
        'Si alguna realmente no tiene marca (por ejemplo una sección que el participante no debía responder), omítela y explícalo en "warnings".',
      ].join('\n');

      const retry = await callModel({
        client,
        imageBuffers,
        systemPrompt: buildSystemPrompt(
          questionnaireType, meta.count, meta.scale, false, { multiDocument, locationHint },
        ),
        tool: retryTool,
        userText: retryText,
      });
      if (usageAcc) addUsage(usageAcc, retry.usage);

      responses.push(...cleanResponses(retry.input.responses, meta.count, maxValue, seen));
      if (Array.isArray(retry.input.warnings)) warnings.push(...retry.input.warnings);
    } catch (err) {
      console.error(`Retry OCR ${questionnaireType} falló:`, err.message);
      warnings.push('No se pudo completar el segundo intento de lectura de las preguntas faltantes.');
    }
  }

  const summarized = summarizeResponses(responses, meta.count, warnings);

  if (expectParticipantInfo && first.input.participantInfo) {
    const p = first.input.participantInfo;
    summarized.participantInfo = {
      documentNumber: (p.documentNumber || '').toString().replace(/\D+/g, ''),
      firstName: (p.firstName || '').toString().trim(),
      lastName: (p.lastName || '').toString().trim(),
      confidence: ['high', 'medium', 'low'].includes(p.confidence) ? p.confidence : 'low',
    };
  }

  return summarized;
}

/**
 * Modo "un solo cuestionario": el evaluador ya eligió el tipo en la UI.
 */
async function extractAnswersFromSheet(imageBuffers, options) {
  const { questionnaireType, expectParticipantInfo = false } = options || {};

  const meta = QUESTIONNAIRE_META[questionnaireType];
  if (!meta) throw new Error(`Tipo de cuestionario no soportado: ${questionnaireType}`);
  if (!Array.isArray(imageBuffers) || imageBuffers.length === 0) {
    throw new Error('Debe enviar al menos una imagen.');
  }
  assertPayloadSize(imageBuffers);

  const client = getClient();
  const usageAcc = emptyUsage();

  const result = await extractOneQuestionnaire({
    client,
    imageBuffers,
    questionnaireType,
    expectParticipantInfo,
    // Aunque el evaluador eligió un tipo, el PDF puede traer la batería
    // completa: hay que decirle al modelo que ignore las demás secciones.
    multiDocument: true,
    usageAcc,
  });

  result.usage = usageAcc;
  return result;
}

// ---------------------------------------------------------------------------
// Pase de índice: qué secciones trae el archivo + ficha + encabezado
// ---------------------------------------------------------------------------

function buildIndexSystemPrompt(expectParticipantInfo) {
  const fichaBullets = FICHA_FIELDS.map(f => `     - ${f.name}: ${f.label}`).join('\n');
  return [
    'Eres un asistente experto en clasificar PDFs o imágenes que contienen cuestionarios de la Batería de Riesgo Psicosocial del Ministerio de Protección Social de Colombia (Resolución 2646 de 2008).',
    '',
    'Un mismo archivo suele traer VARIOS cuestionarios encuadernados uno detrás de otro. Tu trabajo en este paso NO es extraer las respuestas Likert,',
    'sino (1) inventariar qué secciones están presentes y en qué páginas, y (2) transcribir la Ficha de Datos Generales.',
    '',
    'Secciones posibles:',
    `1. intralaboral_a — ${SECTION_TITLES.intralaboral_a}. 123 preguntas Likert.`,
    `2. intralaboral_b — ${SECTION_TITLES.intralaboral_b}. 97 preguntas Likert.`,
    `3. extralaboral   — ${SECTION_TITLES.extralaboral}. 31 preguntas Likert.`,
    `4. estres         — ${SECTION_TITLES.estres}. 31 preguntas Likert.`,
    `5. ficha_datos    — ${SECTION_TITLES.ficha_datos}. Campos estructurados, sin escala Likert:`,
    fichaBullets,
    '',
    'Reglas estrictas:',
    '1. Recorre TODAS las páginas del archivo antes de responder. Las secciones pueden aparecer en cualquier orden.',
    '2. Incluye en "sections" una entrada por CADA sección que aparezca en el archivo, aunque solo veas su portada.',
    '3. En "location" describe dónde está (por ejemplo "páginas 6 a 11" o "última mitad del documento"). Si no puedes precisarlo, cadena vacía.',
    '4. Forma A y Forma B son mutuamente excluyentes: un mismo participante responde una u otra, nunca ambas. Elige la que realmente aparece impresa.',
    '5. Si ves el título de una sección pero está completamente en blanco (sin ninguna marca ni dato), NO la incluyas.',
    '6. Si detectas la Ficha de Datos Generales, pon "fichaDatos.detected" = true y transcribe cada campo en "fichaDatos.fields". Campo sin dato = cadena vacía. NO inventes valores.',
    '7. Para campos categóricos marcados con X (sexo, estado civil, estudios, estrato, tipo vivienda, tipo cargo, tipo contrato), escribe EL LITERAL EXACTO de la opción marcada (por ejemplo "Masculino", "Unión libre", "Bachillerato completo", "Operario, operador, ayudante, servicios generales", "Término indefinido").',
    '8. Para campos de texto manuscrito, transcribe tal cual. Para campos numéricos (dependientes, horas), devuelve solo el número como string.',
    '9. Para campos de ciudad/residencia/trabajo con dos subcampos, concaténalos como "Ciudad, Departamento".',
    '10. NO extraigas respuestas Likert en este paso — eso se hace después en otra llamada.',
    expectParticipantInfo
      ? '11. Extrae además los datos de identificación del participante: documento (solo dígitos), primer nombre y primer apellido. Usa el "Nombre completo" de la Ficha si existe; si no, el encabezado ("Número de identificación del respondiente"). Si nada es legible, cadenas vacías y confidence="low".'
      : '11. NO devuelvas participantInfo — el participante ya fue seleccionado en el sistema.',
    '',
    'Devuelve SIEMPRE el resultado llamando la herramienta save_document_index. No escribas prosa fuera de la llamada.',
  ].join('\n');
}

function buildIndexTool(expectParticipantInfo) {
  const fichaFieldsSchema = {
    type: 'object',
    additionalProperties: false,
    description: 'Valor transcrito de cada campo de la Ficha. Vacío si no está presente.',
    properties: {},
    required: [],
  };
  for (const f of FICHA_FIELDS) {
    fichaFieldsSchema.properties[f.name] = { type: 'string', description: f.label };
    fichaFieldsSchema.required.push(f.name);
  }

  const schema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      sections: {
        type: 'array',
        description: 'Una entrada por cada sección presente en el archivo.',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            type: {
              type: 'string',
              enum: ['intralaboral_a', 'intralaboral_b', 'extralaboral', 'estres', 'ficha_datos'],
            },
            location: { type: 'string', description: 'Dónde está la sección (páginas). Vacío si no se puede precisar.' },
            confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
          },
          required: ['type', 'location', 'confidence'],
        },
      },
      fichaDatos: {
        type: 'object',
        additionalProperties: false,
        description: 'Ficha de Datos Generales. Si no aparece en el archivo, detected=false y fields con cadenas vacías.',
        properties: {
          detected: { type: 'boolean' },
          fields: fichaFieldsSchema,
          warnings: { type: 'array', items: { type: 'string' } },
        },
        required: ['detected', 'fields', 'warnings'],
      },
      warnings: {
        type: 'array',
        items: { type: 'string' },
      },
    },
    required: ['sections', 'fichaDatos', 'warnings'],
  };

  if (expectParticipantInfo) {
    schema.properties.participantInfo = {
      type: 'object',
      additionalProperties: false,
      properties: {
        documentNumber: { type: 'string' },
        firstName:      { type: 'string' },
        lastName:       { type: 'string' },
        confidence:     { type: 'string', enum: ['high', 'medium', 'low'] },
      },
      required: ['documentNumber', 'firstName', 'lastName', 'confidence'],
    };
    schema.required.push('participantInfo');
  }

  return {
    name: 'save_document_index',
    description: 'Guarda el inventario de secciones del archivo y la ficha de datos. Úsala exactamente una vez.',
    strict: true,
    input_schema: schema,
  };
}

/**
 * Modo "auto": el archivo puede traer la batería completa.
 *
 * Estrategia multi-pase — un solo prompt pidiéndole al modelo los ~280 ítems
 * de la batería completa hacía que se limitara a un cuestionario y reportara
 * "solo se extrajo la Forma B". Ahora:
 *   1. Un pase de índice barato: qué secciones hay, dónde, + ficha + encabezado.
 *   2. Un pase de extracción por cada cuestionario Likert detectado (con
 *      reintento dirigido a las preguntas que falten).
 *
 * La forma del objeto devuelto es la misma de antes, así que el frontend
 * (pestañas por cuestionario) no cambia.
 */
async function extractAllQuestionnairesFromSheet(imageBuffers, options) {
  const { expectParticipantInfo = false } = options || {};

  if (!Array.isArray(imageBuffers) || imageBuffers.length === 0) {
    throw new Error('Debe enviar al menos una imagen o PDF.');
  }
  assertPayloadSize(imageBuffers);

  const client = getClient();
  const usageAcc = emptyUsage();

  // --- Pase 1: índice + ficha + encabezado ---------------------------------
  const index = await callModel({
    client,
    imageBuffers,
    systemPrompt: buildIndexSystemPrompt(expectParticipantInfo),
    tool: buildIndexTool(expectParticipantInfo),
    userText: expectParticipantInfo
      ? 'Revisa TODAS las páginas del/los archivo(s) adjunto(s) e inventaría qué cuestionarios de la batería contienen, transcribe la Ficha de Datos Generales y extrae los datos de identificación del participante.'
      : 'Revisa TODAS las páginas del/los archivo(s) adjunto(s) e inventaría qué cuestionarios de la batería contienen y transcribe la Ficha de Datos Generales.',
  });
  addUsage(usageAcc, index.usage);

  const rawIndex = index.input;
  const warnings = Array.isArray(rawIndex.warnings) ? rawIndex.warnings.filter(w => typeof w === 'string') : [];

  const locationByType = {};
  const detectedLikert = [];
  for (const s of (rawIndex.sections || [])) {
    if (!LIKERT_TYPES.includes(s.type)) continue;
    if (detectedLikert.includes(s.type)) continue;
    detectedLikert.push(s.type);
    locationByType[s.type] = typeof s.location === 'string' ? s.location : '';
  }
  // Orden canónico, no el que devolvió el modelo.
  const targets = LIKERT_TYPES.filter(t => detectedLikert.includes(t));

  // --- Pase 2..N: un cuestionario por llamada ------------------------------
  const extracted = await mapWithConcurrency(targets, 2, async (type) => {
    try {
      const meta = QUESTIONNAIRE_META[type];
      const data = await extractOneQuestionnaire({
        client,
        imageBuffers,
        questionnaireType: type,
        expectParticipantInfo: false,
        multiDocument: true,
        locationHint: locationByType[type] || '',
        usageAcc,
      });
      return {
        type,
        label: meta.label,
        expectedCount: meta.count,
        scale: meta.scale,
        ...data,
      };
    } catch (err) {
      console.error(`Extracción OCR de ${type} falló:`, err.message);
      warnings.push(`No se pudo leer el cuestionario ${QUESTIONNAIRE_META[type].label}: ${err.message}`);
      return null;
    }
  });

  const byType = {};
  for (const item of extracted) {
    if (item) byType[item.type] = item;
  }

  // Forma A y Forma B son excluyentes: si el índice reportó ambas, se queda la
  // que tenga mayor proporción de respuestas realmente detectadas.
  if (byType.intralaboral_a && byType.intralaboral_b) {
    const ratio = t => byType[t].summary.totalDetected / byType[t].expectedCount;
    const loser = ratio('intralaboral_a') >= ratio('intralaboral_b') ? 'intralaboral_b' : 'intralaboral_a';
    warnings.push(
      `Se detectaron Forma A y Forma B en el mismo archivo (son excluyentes). Se descartó ${QUESTIONNAIRE_META[loser].label} por tener menos respuestas legibles.`,
    );
    delete byType[loser];
  }

  const detectedTypes = LIKERT_TYPES.filter(t => byType[t]);

  // --- Ficha de datos ------------------------------------------------------
  let fichaDatos = null;
  if (rawIndex.fichaDatos && rawIndex.fichaDatos.detected === true) {
    const rawFields = rawIndex.fichaDatos.fields || {};
    const fields = {};
    let filled = 0;
    for (const f of FICHA_FIELDS) {
      const v = typeof rawFields[f.name] === 'string' ? rawFields[f.name].trim() : '';
      fields[f.name] = v;
      if (v) filled++;
    }
    fichaDatos = {
      detected: true,
      fields,
      filledCount: filled,
      totalCount: FICHA_FIELDS.length,
      warnings: Array.isArray(rawIndex.fichaDatos.warnings)
        ? rawIndex.fichaDatos.warnings.filter(w => typeof w === 'string')
        : [],
    };
  }

  const result = {
    detectedTypes,
    byType,
    fichaDatos,
    warnings,
    usage: usageAcc,
  };

  if (expectParticipantInfo && rawIndex.participantInfo) {
    const p = rawIndex.participantInfo;
    result.participantInfo = {
      documentNumber: (p.documentNumber || '').toString().replace(/\D+/g, ''),
      firstName: (p.firstName || '').toString().trim(),
      lastName: (p.lastName || '').toString().trim(),
      confidence: ['high', 'medium', 'low'].includes(p.confidence) ? p.confidence : 'low',
    };
  }

  return result;
}

module.exports = {
  extractAnswersFromSheet,
  extractAllQuestionnairesFromSheet,
  QUESTIONNAIRE_META,
  FICHA_FIELDS,
  FICHA_FIELD_NAMES,
};
