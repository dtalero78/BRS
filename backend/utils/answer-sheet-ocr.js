const AnthropicModule = require('@anthropic-ai/sdk');
const Anthropic = AnthropicModule.default || AnthropicModule;

const QUESTIONNAIRE_META = {
  intralaboral_a: { label: 'Intralaboral Forma A (Jefes / Profesionales / Técnicos)', count: 123, scale: 'intra' },
  intralaboral_b: { label: 'Intralaboral Forma B (Auxiliares / Operarios)',          count: 97,  scale: 'intra' },
  extralaboral:   { label: 'Extralaboral',                                            count: 31,  scale: 'intra' },
  estres:         { label: 'Estrés',                                                  count: 31,  scale: 'stress' },
};

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

function buildSystemPrompt(questionnaireType, expectedCount, scale, expectParticipantInfo) {
  const meta = QUESTIONNAIRE_META[questionnaireType];
  const scaleDesc = SCALE_DESCRIPTIONS[scale];
  const maxValue = scale === 'stress' ? 3 : 4;

  return [
    'Eres un asistente experto en leer hojas físicas de respuestas de la Batería de Riesgo Psicosocial del Ministerio de Protección Social de Colombia (Resolución 2646 de 2008).',
    '',
    `Cuestionario: ${meta.label}`,
    `Número de preguntas esperadas: ${expectedCount} (numeradas de 1 a ${expectedCount}).`,
    `Escala Likert de este cuestionario (devuelve el valor numérico, NO el texto):`,
    scaleDesc,
    '',
    'Reglas estrictas:',
    '1. Cada pregunta tiene UNA sola marca (X, círculo o similar) en la columna correspondiente a una opción Likert.',
    `2. Devuelve responseValue como entero entre 0 y ${maxValue}, según la escala de arriba.`,
    '3. Si una pregunta no tiene ninguna marca, o tiene múltiples marcas ambiguas, OMÍTELA del array "responses". NO inventes una respuesta.',
    '4. Si la marca existe pero es dudosa (borrosa, tachada, parcial), inclúyela con confidence = "low".',
    '5. Si la marca es clara e inequívoca, confidence = "high". Si es legible pero no perfecta, "medium".',
    '6. Los números de pregunta deben ser enteros 1..N, sin saltos. Si reconoces "15" pero no sabes la respuesta, NO lo incluyas.',
    '7. Reporta en "warnings" cualquier observación general (hoja rota, mancha, columna cortada, preguntas faltantes, idioma distinto, etc).',
    expectParticipantInfo
      ? '8. Además extrae los datos del encabezado: número de documento (solo dígitos), primer nombre y primer apellido si están escritos. Usa confidence apropiada. Si no hay encabezado visible, devuelve participantInfo con cadenas vacías y confidence = "low".'
      : '8. NO devuelvas participantInfo — el participante ya fue seleccionado en el sistema.',
    '',
    'Devuelve SIEMPRE tu respuesta usando la herramienta save_extracted_answers con el esquema exacto. No escribas prosa fuera de la llamada a la herramienta.',
  ].join('\n');
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

function summarize(rawResult, expectedCount) {
  const responses = Array.isArray(rawResult.responses) ? rawResult.responses : [];

  const seen = new Set();
  const cleaned = [];
  for (const r of responses) {
    const qn = Number(r.questionNumber);
    const rv = Number(r.responseValue);
    if (!Number.isInteger(qn) || qn < 1 || qn > expectedCount) continue;
    if (!Number.isInteger(rv) || rv < 0 || rv > 4) continue;
    if (seen.has(qn)) continue;
    seen.add(qn);
    cleaned.push({
      questionNumber: qn,
      responseValue: rv,
      confidence: ['high', 'medium', 'low'].includes(r.confidence) ? r.confidence : 'medium',
    });
  }
  cleaned.sort((a, b) => a.questionNumber - b.questionNumber);

  const missing = [];
  for (let i = 1; i <= expectedCount; i++) {
    if (!seen.has(i)) missing.push(i);
  }

  const lowConfidenceCount = cleaned.filter(r => r.confidence === 'low').length;

  return {
    responses: cleaned,
    missing,
    warnings: Array.isArray(rawResult.warnings) ? rawResult.warnings.filter(w => typeof w === 'string') : [],
    summary: {
      totalDetected: cleaned.length,
      totalExpected: expectedCount,
      lowConfidenceCount,
      missingCount: missing.length,
    },
  };
}

async function extractAnswersFromSheet(imageBuffers, options) {
  const {
    questionnaireType,
    expectParticipantInfo = false,
  } = options || {};

  const meta = QUESTIONNAIRE_META[questionnaireType];
  if (!meta) {
    throw new Error(`Tipo de cuestionario no soportado: ${questionnaireType}`);
  }
  if (!Array.isArray(imageBuffers) || imageBuffers.length === 0) {
    throw new Error('Debe enviar al menos una imagen.');
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY no está configurada en el servidor.');
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const systemPrompt = buildSystemPrompt(questionnaireType, meta.count, meta.scale, expectParticipantInfo);
  const tool = buildTool(expectParticipantInfo);

  const content = [
    ...imageBuffers.map(buf => {
      const kind = detectFileKind(buf);
      return {
        type: kind.type,
        source: {
          type: 'base64',
          media_type: kind.mediaType,
          data: buf.toString('base64'),
        },
      };
    }),
    {
      type: 'text',
      text: expectParticipantInfo
        ? `Lee el/los archivo(s) adjunto(s) (imagen o PDF) de la hoja física y extrae: (1) los datos del encabezado (documento y nombre) y (2) todas las marcas de respuesta con su número de pregunta. Esperas ${meta.count} preguntas numeradas. Si el PDF tiene varias páginas, recorre todas.`
        : `Lee el/los archivo(s) adjunto(s) (imagen o PDF) de la hoja física y extrae todas las marcas de respuesta con su número de pregunta. Esperas ${meta.count} preguntas numeradas. Si el PDF tiene varias páginas, recorre todas.`,
    },
  ];

  const response = await client.messages.create({
    model: process.env.OCR_MODEL || 'claude-sonnet-4-6',
    max_tokens: 16000,
    system: [
      { type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } },
    ],
    tools: [tool],
    tool_choice: { type: 'tool', name: 'save_extracted_answers' },
    messages: [{ role: 'user', content }],
  });

  const toolBlock = response.content.find(b => b.type === 'tool_use' && b.name === 'save_extracted_answers');
  if (!toolBlock) {
    const textBlock = response.content.find(b => b.type === 'text');
    throw new Error(
      'El modelo no devolvió el resultado estructurado. ' +
      (textBlock ? `Texto recibido: ${String(textBlock.text).slice(0, 200)}` : ''),
    );
  }

  const summarized = summarize(toolBlock.input || {}, meta.count);

  if (expectParticipantInfo && toolBlock.input && toolBlock.input.participantInfo) {
    const p = toolBlock.input.participantInfo;
    summarized.participantInfo = {
      documentNumber: (p.documentNumber || '').toString().replace(/\D+/g, ''),
      firstName: (p.firstName || '').toString().trim(),
      lastName: (p.lastName || '').toString().trim(),
      confidence: ['high', 'medium', 'low'].includes(p.confidence) ? p.confidence : 'low',
    };
  }

  summarized.usage = {
    inputTokens: response.usage?.input_tokens ?? null,
    outputTokens: response.usage?.output_tokens ?? null,
    cacheReadInputTokens: response.usage?.cache_read_input_tokens ?? null,
    cacheCreationInputTokens: response.usage?.cache_creation_input_tokens ?? null,
  };

  return summarized;
}

module.exports = {
  extractAnswersFromSheet,
  QUESTIONNAIRE_META,
};
