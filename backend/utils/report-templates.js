/**
 * Report Templates - Static content, dimension mappings, and intervention recommendations
 * for the organizational BRS report.
 */

// ============================================================
// DIMENSION & DOMAIN DISPLAY NAMES
// ============================================================
const DIMENSION_DISPLAY_NAMES = {
  // Intralaboral - Liderazgo y Relaciones Sociales
  caracteristicas_liderazgo: 'Características del Liderazgo',
  relaciones_sociales_trabajo: 'Relaciones Sociales en el Trabajo',
  'retroalimentacion_desempeño': 'Retroalimentación del Desempeño',
  relacion_colaboradores: 'Relación con los Colaboradores',
  // Intralaboral - Control sobre el Trabajo
  claridad_rol: 'Claridad del Rol',
  capacitacion: 'Capacitación',
  participacion_manejo_cambio: 'Participación y Manejo del Cambio',
  oportunidades_desarrollo: 'Oportunidades para el Uso y Desarrollo de Habilidades y Conocimientos',
  control_autonomia: 'Control y Autonomía sobre el Trabajo',
  // Intralaboral - Demandas del Trabajo
  demandas_ambientales: 'Demandas Ambientales y de Esfuerzo Físico',
  demandas_emocionales: 'Demandas Emocionales',
  demandas_cuantitativas: 'Demandas Cuantitativas',
  demandas_carga_mental: 'Demandas de Carga Mental',
  exigencias_responsabilidad: 'Exigencias de Responsabilidad del Cargo',
  demandas_jornada: 'Demandas de la Jornada de Trabajo',
  consistencia_rol: 'Consistencia del Rol',
  influencia_trabajo_entorno: 'Influencia del Trabajo sobre el Entorno Extralaboral',
  // Intralaboral - Recompensas
  reconocimiento_compensacion: 'Reconocimiento y Compensación',
  recompensas_pertenencia: 'Recompensas Derivadas de la Pertenencia a la Organización y del Trabajo que se Realiza',
  // Extralaboral
  tiempo_fuera_trabajo: 'Tiempo Fuera del Trabajo',
  relaciones_familiares: 'Relaciones Familiares',
  comunicacion_relaciones_interpersonales: 'Comunicación y Relaciones Interpersonales',
  situacion_economica: 'Situación Económica del Grupo Familiar',
  caracteristicas_vivienda: 'Características de la Vivienda y de su Entorno',
  influencia_entorno_trabajo: 'Influencia del Entorno Extralaboral sobre el Trabajo',
  desplazamiento_vivienda_trabajo: 'Desplazamiento Vivienda - Trabajo - Vivienda',
  // Totals
  puntaje_total_intralaboral: 'Puntaje Total General Intralaboral',
  liderazgo_relaciones_sociales_total: 'Liderazgo y Relaciones Sociales en el Trabajo',
  control_trabajo_total: 'Control sobre el Trabajo',
  demandas_trabajo_total: 'Demandas del Trabajo',
  recompensas_total: 'Recompensas',
  puntaje_total_extralaboral: 'Puntaje Total Extralaboral',
  estres_total: 'Estrés Total',
  // Coping (Brief COPE)
  afrontamiento_activo: 'Afrontamiento Activo',
  planificacion: 'Planificación',
  apoyo_instrumental: 'Apoyo Instrumental',
  reinterpretacion_positiva: 'Reinterpretación Positiva',
  apoyo_emocional: 'Apoyo Emocional',
  desahogo: 'Desahogo',
  aceptacion: 'Aceptación',
  humor: 'Humor',
  religion: 'Religión',
  autoinculpacion: 'Auto-inculpación',
  autodistraccion: 'Auto-distracción',
  negacion: 'Negación',
  desconexion_conductual: 'Desconexión Conductual',
  uso_sustancias: 'Uso de Sustancias',
  problem_focused_total: 'Afrontamiento Centrado en el Problema',
  emotion_focused_total: 'Afrontamiento Centrado en la Emoción',
  avoidant_total: 'Afrontamiento Evitativo',
  puntaje_total_coping: 'Puntaje Total Coping'
};

const DOMAIN_DISPLAY_NAMES = {
  liderazgo_relaciones_sociales: 'Liderazgo y Relaciones Sociales en el Trabajo',
  control_trabajo: 'Control sobre el Trabajo',
  demandas_trabajo: 'Demandas del Trabajo',
  recompensas: 'Recompensas'
};

const DOMAIN_ORDER = ['liderazgo_relaciones_sociales', 'control_trabajo', 'demandas_trabajo', 'recompensas'];

// Domain → dimensions mapping per form
const DOMAIN_DIMENSIONS = {
  liderazgo_relaciones_sociales: {
    A: ['caracteristicas_liderazgo', 'relaciones_sociales_trabajo', 'retroalimentacion_desempeño', 'relacion_colaboradores'],
    B: ['caracteristicas_liderazgo', 'relaciones_sociales_trabajo', 'retroalimentacion_desempeño']
  },
  control_trabajo: {
    A: ['claridad_rol', 'capacitacion', 'participacion_manejo_cambio', 'oportunidades_desarrollo', 'control_autonomia'],
    B: ['claridad_rol', 'capacitacion', 'participacion_manejo_cambio', 'oportunidades_desarrollo', 'control_autonomia']
  },
  demandas_trabajo: {
    A: ['demandas_ambientales', 'demandas_emocionales', 'demandas_cuantitativas', 'influencia_trabajo_entorno', 'exigencias_responsabilidad', 'demandas_carga_mental', 'consistencia_rol', 'demandas_jornada'],
    B: ['demandas_ambientales', 'demandas_emocionales', 'demandas_cuantitativas', 'influencia_trabajo_entorno', 'demandas_carga_mental', 'demandas_jornada']
  },
  recompensas: {
    A: ['recompensas_pertenencia', 'reconocimiento_compensacion'],
    B: ['recompensas_pertenencia', 'reconocimiento_compensacion']
  }
};

const EXTRALABORAL_DIMENSIONS = [
  'tiempo_fuera_trabajo', 'relaciones_familiares', 'comunicacion_relaciones_interpersonales',
  'situacion_economica', 'caracteristicas_vivienda', 'influencia_entorno_trabajo',
  'desplazamiento_vivienda_trabajo'
];

// Short names for chart labels
const DIMENSION_SHORT_NAMES = {
  caracteristicas_liderazgo: 'Características del Liderazgo',
  relaciones_sociales_trabajo: 'Relaciones sociales en el trabajo',
  'retroalimentacion_desempeño': 'Retroalimentación del desempeño',
  relacion_colaboradores: 'Relación con los colaboradores',
  claridad_rol: 'Claridad del rol',
  capacitacion: 'Capacitación',
  participacion_manejo_cambio: 'Participación y manejo del cambio',
  oportunidades_desarrollo: 'Oportunidades de desarrollo de habilidades',
  control_autonomia: 'Control y autonomía sobre el trabajo',
  demandas_ambientales: 'Demandas ambientales y de esfuerzo físico',
  demandas_emocionales: 'Demandas emocionales',
  demandas_cuantitativas: 'Demandas cuantitativas',
  demandas_carga_mental: 'Demandas de carga mental',
  exigencias_responsabilidad: 'Exigencias de responsabilidad del cargo',
  demandas_jornada: 'Demandas de la jornada de trabajo',
  consistencia_rol: 'Consistencia del rol',
  influencia_trabajo_entorno: 'Influencia del trabajo sobre el entorno',
  reconocimiento_compensacion: 'Reconocimiento y compensación',
  recompensas_pertenencia: 'Recompensas de pertenencia a la organización',
  tiempo_fuera_trabajo: 'Tiempo fuera del trabajo',
  relaciones_familiares: 'Relaciones familiares',
  comunicacion_relaciones_interpersonales: 'Comunicación y relaciones interpersonales',
  situacion_economica: 'Situación económica del grupo familiar',
  caracteristicas_vivienda: 'Características de la vivienda y entorno',
  influencia_entorno_trabajo: 'Influencia del entorno extralaboral',
  desplazamiento_vivienda_trabajo: 'Desplazamiento vivienda-trabajo'
};

// ============================================================
// INTERVENTION RECOMMENDATIONS
// ============================================================
const INTERVENTION_RECOMMENDATIONS = {
  caracteristicas_liderazgo: 'Actividades de sensibilización y fortalecimiento de estilos de liderazgo. Implementar programas de desarrollo de competencias de liderazgo, comunicación asertiva e inteligencia emocional.',
  relaciones_sociales_trabajo: 'Realizar actividades de integración, fortalecimiento del trabajo en equipo y resolución de conflictos. Promover espacios de participación, comunicación e interacción social en el trabajo.',
  'retroalimentacion_desempeño': 'Implementar sistemas formales de retroalimentación del desempeño. Capacitar a los líderes en técnicas de retroalimentación constructiva y oportuna.',
  relacion_colaboradores: 'Fortalecer la comunicación y relación entre jefes y colaboradores. Promover la planificación conjunta, apoyo, motivación y reconocimiento en los equipos de trabajo.',
  claridad_rol: 'Revisar y socializar los perfiles de cargo, funciones y responsabilidades. Asegurar que cada trabajador conozca con claridad sus funciones y las expectativas del cargo.',
  capacitacion: 'Diseñar planes de capacitación acordes a las necesidades del cargo. Realizar inducción, reinducción y formación específica de forma regular.',
  participacion_manejo_cambio: 'Involucrar a los funcionarios en las decisiones que afectan su trabajo. Informar suficiente y oportunamente sobre los cambios organizacionales.',
  oportunidades_desarrollo: 'Enriquecer el contenido de los cargos para que permitan el desarrollo de habilidades y conocimientos. Implementar programas de desarrollo profesional.',
  control_autonomia: 'Evaluar la posibilidad de dar mayor autonomía en la toma de decisiones y el orden de las actividades. Revisar los niveles de supervisión.',
  demandas_ambientales: 'Gestión de las condiciones ambientales del puesto de trabajo. Realizar inspecciones ergonómicas y mediciones de higiene industrial.',
  demandas_emocionales: 'Implementar programas de apoyo psicológico y manejo emocional. Capacitar en técnicas de afrontamiento del estrés y regulación emocional.',
  demandas_cuantitativas: 'Revisar la distribución de cargas de trabajo y funciones. Evaluar la cantidad de trabajo en relación con el tiempo disponible y los recursos.',
  demandas_carga_mental: 'Analizar la complejidad de las tareas y la demanda de procesamiento cognitivo. Implementar pausas activas y rotación de tareas.',
  exigencias_responsabilidad: 'Revisar los niveles de responsabilidad asignados. Evaluar si las exigencias de responsabilidad son proporcionales al nivel del cargo y la autonomía.',
  demandas_jornada: 'Revisar los horarios de trabajo, la duración de la jornada y los turnos. Verificar el cumplimiento de las normas sobre jornada laboral.',
  consistencia_rol: 'Revisar que las funciones asignadas sean consistentes y compatibles entre sí. Evitar la asignación de tareas contradictorias.',
  influencia_trabajo_entorno: 'Implementar estrategias que permitan a los funcionarios mejorar la vida extralaboral y que esta no influya de manera negativa en el trabajo.',
  reconocimiento_compensacion: 'Fortalecer los sistemas de reconocimiento tangible e intangible. Revisar la equidad en la compensación y las políticas de remuneración.',
  recompensas_pertenencia: 'Desarrollar programas de bienestar laboral que generen sentido de pertenencia. Fomentar la estabilidad laboral y el sentido de propósito organizacional.',
  tiempo_fuera_trabajo: 'Promover actividades de ocio, descanso y recreación fuera del trabajo. Respetar los tiempos de descanso y vacaciones.',
  relaciones_familiares: 'Implementar programas de apoyo familiar y conciliación trabajo-familia. Facilitar la comunicación con la familia.',
  comunicacion_relaciones_interpersonales: 'Fortalecer las redes de apoyo social. Implementar actividades de integración comunitaria y relaciones interpersonales.',
  situacion_economica: 'Revisar las políticas de remuneración y beneficios. Implementar programas de educación financiera y apoyo económico.',
  caracteristicas_vivienda: 'Evaluar las condiciones de vivienda del trabajador. Gestionar programas de vivienda y mejoramiento del entorno.',
  influencia_entorno_trabajo: 'Analizar la influencia del entorno extralaboral sobre el trabajo. Implementar programas de apoyo y acompañamiento.',
  desplazamiento_vivienda_trabajo: 'Evaluar los tiempos y condiciones de desplazamiento. Considerar alternativas como teletrabajo, horarios flexibles o subsidios de transporte.'
};

// ============================================================
// INTRALABORAL DEFINITIONS (for definition tables)
// ============================================================
const INTRALABORAL_DEFINITIONS = {
  liderazgo_relaciones_sociales: {
    label: 'LIDERAZGO Y RELACIONES SOCIALES EN EL TRABAJO',
    dimensions: {
      'Características del liderazgo': 'Atributos de la gestión de los jefes inmediatos en relación con la planificación y asignación del trabajo, consecución de resultados, resolución de conflictos, participación, motivación, apoyo, interacción y comunicación con sus colaboradores.',
      'Relaciones sociales en el trabajo': 'Interacción que se establece con otras personas en el trabajo, posibilidad de establecer contacto con otras personas, calidad de las interacciones, apoyo social, trabajo en equipo, cohesión.',
      'Retroalimentación del desempeño': 'Información que un trabajador recibe sobre la forma como realiza su trabajo, la cual le permite identificar fortalezas y debilidades para tomar acciones para mantener o mejorar su desempeño.',
      'Relación con los colaboradores': 'Atributos de la gestión de los subordinados en relación con la ejecución del trabajo, consecución de resultados, interacción y formas de comunicación con la jefatura.'
    }
  },
  control_trabajo: {
    label: 'CONTROL SOBRE EL TRABAJO',
    dimensions: {
      'Capacitación': 'Actividades de inducción, entrenamiento y formación que la organización brinda al trabajador con el fin de desarrollar y fortalecer sus conocimientos y habilidades.',
      'Claridad de rol': 'Es la definición y comunicación del papel que se espera que el trabajador desempeñe en la organización, específicamente en torno a los objetivos del trabajo, las funciones y resultados, el margen de autonomía y el impacto del ejercicio del cargo en la empresa.',
      'Control y autonomía sobre el trabajo': 'Margen de decisión que tiene el trabajador sobre aspectos como el orden de las actividades, la cantidad, el ritmo, la forma de trabajar, las pausas durante la jornada.',
      'Oportunidades para el uso y desarrollo de habilidades y conocimiento': 'Posibilidad que el trabajo le brinda al trabajador de aplicar, aprender y desarrollar sus habilidades y conocimientos.',
      'Participación y manejo del cambio': 'Conjunto de mecanismos organizacionales orientados a incrementar la capacidad de adaptación de los colaboradores a las diferentes transformaciones que se presentan en el contexto laboral.'
    }
  },
  demandas_trabajo: {
    label: 'DEMANDAS DEL TRABAJO',
    dimensions: {
      'Consistencia del rol': 'Compatibilidad o consistencia entre las diversas exigencias relacionadas con los principios de eficiencia, calidad técnica y ética, propias del servicio o producto que tiene un trabajador en el desempeño de su cargo.',
      'Demandas ambientales y de esfuerzo físico': 'Condiciones del lugar de trabajo y carga física que involucran las actividades que se desarrollan, que bajo ciertas circunstancias exigen del individuo un esfuerzo de adaptación.',
      'Demandas cuantitativas': 'Exigencias relativas a la cantidad de trabajo que se debe ejecutar, en relación con el tiempo disponible para hacerlo.',
      'Demandas de carga mental': 'Exigencias de procesamiento cognitivo que implica la tarea y que involucra procesos mentales superiores de atención, memoria y análisis de información para generar una respuesta.',
      'Demandas de la jornada de trabajo': 'Exigencias del tiempo laboral que se hacen al individuo en términos de la duración de la jornada, así como los periodos destinados a pausas y descansos.',
      'Demandas emocionales': 'Situaciones afectivas y emocionales propias del contenido de la tarea que tienen el potencial de interferir con los sentimientos y emociones del trabajador.',
      'Exigencias de responsabilidad del cargo': 'Conjunto de obligaciones implícitas en el desempeño de un cargo cuyos resultados no pueden ser transferidos a otras personas. (Responsabilidad por resultados, dirección, bienes, información confidencial, etc.)',
      'Influencia del trabajo sobre el entorno extralaboral': 'Condición que se presenta cuando las exigencias de tiempo y esfuerzo que se hacen a un individuo en su trabajo impactan su vida extralaboral.'
    }
  },
  recompensas: {
    label: 'RECOMPENSA',
    dimensions: {
      'Recompensas derivadas de la pertenencia a la organización': 'Sentimiento de orgullo y percepción de estabilidad laboral que experimenta el trabajador por estar vinculado a la organización, así como de autorrealización por efectuar su trabajo.',
      'Reconocimiento y compensación': 'Conjunto de retribuciones que la organización otorga al trabajador en contraprestación por el esfuerzo realizado, tales como compensación económica, reconocimiento, servicios de bienestar y posibilidad de desarrollo.'
    }
  }
};

const EXTRALABORAL_DEFINITIONS = {
  'Características de la vivienda y de su entorno': 'Condiciones de infraestructura, ubicación y entorno de las instalaciones físicas del lugar habitual de residencia del trabajador y de su grupo familiar.',
  'Comunicación y relaciones interpersonales': 'Cualidades que caracterizan la comunicación e interacciones del individuo con sus allegados y amigos.',
  'Desplazamiento vivienda-trabajo-vivienda': 'Condiciones en que se realiza el traslado del trabajador desde su sitio de vivienda hasta su lugar de trabajo y viceversa. Facilidad y comodidad del transporte y duración del recorrido.',
  'Influencia del entorno extralaboral en el trabajo': 'Influencia de las exigencias de los roles familiares y personales en el bienestar y en la actividad laboral del trabajador.',
  'Relaciones familiares': 'Propiedades que caracterizan las interacciones del individuo con su núcleo familiar.',
  'Situación económica del grupo familiar': 'Disponibilidad de medios económicos para que el trabajador y su grupo familiar cubran sus gastos básicos.',
  'Tiempo fuera del trabajo': 'Tiempo que el trabajador dedica a actividades diferentes al trabajo para descansar, compartir con familia, amigos, atender responsabilidades domésticas, actividades de recreación y ocio.'
};

// ============================================================
// NEW CONCISE TEXT SECTIONS (matching reference informe)
// ============================================================

function writeObjetivosMetodologia(doc, pageW, companyName) {
  const colW = (pageW - 20) / 2;
  const startY = doc.y;
  const bannerH = 25;

  // LEFT: Objetivos
  doc.save();
  doc.rect(doc.page.margins.left, startY, colW, bannerH).fillColor('#B2DFDB').fill();
  doc.fontSize(11).fillColor('#004D40').font('Helvetica-Bold');
  doc.text('OBJETIVOS', doc.page.margins.left, startY + 7, { width: colW, align: 'center' });
  doc.restore();

  let ly = startY + bannerH + 10;
  doc.fontSize(9).font('Helvetica-Bold').fillColor('#1F2937');
  doc.text('GENERAL', doc.page.margins.left, ly, { width: colW });
  ly += 14;
  doc.fontSize(8).font('Helvetica').fillColor('#374151');
  doc.text(`• Identificar la percepción de riesgo psicosocial de los colaboradores de la ${companyName}.`, doc.page.margins.left, ly, { width: colW, align: 'justify' });
  ly = doc.y + 10;

  doc.fontSize(9).font('Helvetica-Bold').fillColor('#1F2937');
  doc.text('ESPECÍFICOS', doc.page.margins.left, ly, { width: colW });
  ly += 14;
  doc.fontSize(8).font('Helvetica').fillColor('#374151');
  const especificos = [
    `Evaluar los posibles factores de riesgo intralaborales y extralaborales, presentes en los colaboradores de la ${companyName}.`,
    `Reconocer las probables sintomatologías asociadas al estrés en la ${companyName}.`,
    `Recomendar a la empresa pautas de acción claras para la mitigación de la percepción de los riesgos identificados.`
  ];
  especificos.forEach(t => {
    doc.text(`• ${t}`, doc.page.margins.left, ly, { width: colW, align: 'justify' });
    ly = doc.y + 4;
  });

  // RIGHT: Metodología
  const rightX = doc.page.margins.left + colW + 20;
  doc.save();
  doc.rect(rightX, startY, colW, bannerH).fillColor('#B2DFDB').fill();
  doc.fontSize(11).fillColor('#004D40').font('Helvetica-Bold');
  doc.text('METODOLOGÍA', rightX, startY + 7, { width: colW, align: 'center' });
  doc.restore();

  let ry = startY + bannerH + 10;
  doc.fontSize(9).font('Helvetica-Bold').fillColor('#1F2937');
  doc.text('Instrumento:', rightX, ry, { width: colW });
  ry += 14;
  doc.fontSize(8).font('Helvetica').fillColor('#374151');
  doc.text('Para la medición de la percepción de riesgos psicosociales y de acuerdo con la Resolución 2764/2022, se utilizó la fase I de la batería de instrumentos diseñados por el Ministerio de la Protección Social, denominados Batería de Instrumentos para la Evaluación de Factores de Riesgo Psicosocial, (2010).', rightX, ry, { width: colW, align: 'justify' });
  ry = doc.y + 8;

  const instruments = [
    'Ficha de datos generales.',
    'Cuestionario para la evaluación de factores de riesgo psicosocial intralaboral (forma A y forma B).',
    'Cuestionario de factores de riesgo psicosocial extralaboral.',
    'Cuestionario para la evaluación del estrés.'
  ];
  instruments.forEach((inst, i) => {
    doc.fontSize(8).font('Helvetica').fillColor('#374151');
    doc.text(`${i + 1}. ${inst}`, rightX, ry, { width: colW });
    ry = doc.y + 3;
  });

  doc.y = Math.max(ly, ry) + 10;
}

function writeProcedimientos(doc, pageW) {
  doc.fontSize(9).font('Helvetica').fillColor('#374151');
  doc.text('Para llevar a cabo la presente medición, se realizó una sensibilización a todos los colaboradores donde se especificó ampliamente el proceso a seguir, los instrumentos a emplear, la importancia de los resultados obtenidos y la confidencialidad de la información. Seguido a ello, se aplicó el consentimiento informado, donde los colaboradores autorizaron su participación voluntaria en el estudio y se clarificó desde el marco legal las condiciones éticas de la medición.', { width: pageW, align: 'justify' });
  doc.moveDown(0.5);
  doc.text('Luego de haberse realizado el proceso descrito, se aplicó la Batería para la Evaluación de Riesgo Psicosocial de la Universidad Javeriana - Ministerio de la Protección Social (2010), a través de la plataforma BRS Digital. Una vez consolidada la información se procede a la realización del informe general de la percepción de riesgo psicosocial.', { width: pageW, align: 'justify' });
  doc.moveDown(0.5);

  doc.fontSize(9).font('Helvetica-Bold').fillColor('#1F2937');
  doc.text('Criterios de inclusión y exclusión', { width: pageW });
  doc.moveDown(0.2);
  doc.fontSize(8).font('Helvetica').fillColor('#374151');
  doc.text('Para la medición de riesgo psicosocial se tuvieron en cuenta criterios de inclusión tales como: Que el trabajador se encontrara en la nómina de la empresa, que estuviera ejerciendo sus labores y que su vinculación laboral no fuera menor a 3 meses. Como criterios de exclusión, no se tuvieron en cuenta los trabajadores que se encontraran en licencia de maternidad, licencia por luto e incapacitados el día de la medición.', { width: pageW, align: 'justify' });
  doc.moveDown(0.5);
}

function writeDefinicionesIntralaborales(doc, pageW, drawTableFn) {
  const m = doc.page.margins.left;
  const rows = [];
  for (const [domainKey, domain] of Object.entries(INTRALABORAL_DEFINITIONS)) {
    rows.push({ isDomain: true, label: domain.label });
    for (const [dimName, def] of Object.entries(domain.dimensions)) {
      rows.push([dimName, def]);
    }
  }

  // Draw as custom table with domain headers
  const fontSize = 6.5;
  const cellPad = 3;
  const headerH = 18;
  const rowH = 14;
  const headerBg = '#B2DFDB';
  const domainBg = '#E0F2F1';
  const borderColor = '#B0BEC5';
  const colWidths = [0.30, 0.70];

  // Table header
  doc.save();
  doc.rect(m, doc.y, pageW, headerH).fillColor(headerBg).fill();
  doc.rect(m, doc.y, pageW, headerH).strokeColor(borderColor).lineWidth(0.5).stroke();
  doc.fontSize(fontSize).font('Helvetica-Bold').fillColor('#004D40');
  doc.text('DOMINIO', m + cellPad, doc.y + cellPad, { width: pageW * 0.3 - cellPad * 2 });
  doc.restore();
  let currentY = doc.y + headerH;

  rows.forEach(row => {
    if (currentY + rowH * 2 > doc.page.height - doc.page.margins.bottom - 20) {
      doc.addPage();
      currentY = doc.page.margins.top;
    }

    if (row.isDomain) {
      doc.save();
      doc.rect(m, currentY, pageW, rowH).fillColor(domainBg).fill();
      doc.rect(m, currentY, pageW, rowH).strokeColor(borderColor).lineWidth(0.3).stroke();
      doc.fontSize(fontSize).font('Helvetica-Bold').fillColor('#004D40');
      doc.text(row.label, m + cellPad, currentY + cellPad, { width: pageW - cellPad * 2 });
      doc.restore();
      currentY += rowH;
    } else {
      const textHeight = doc.fontSize(fontSize).font('Helvetica').heightOfString(row[1], { width: pageW * colWidths[1] - cellPad * 2 });
      const actualRowH = Math.max(rowH, textHeight + cellPad * 2);

      if (currentY + actualRowH > doc.page.height - doc.page.margins.bottom - 20) {
        doc.addPage();
        currentY = doc.page.margins.top;
      }

      doc.save();
      doc.rect(m, currentY, pageW, actualRowH).strokeColor(borderColor).lineWidth(0.3).stroke();
      doc.fontSize(fontSize).font('Helvetica-Bold').fillColor('#374151');
      doc.text(row[0], m + cellPad, currentY + cellPad, { width: pageW * colWidths[0] - cellPad * 2 });
      doc.fontSize(fontSize).font('Helvetica').fillColor('#374151');
      doc.text(row[1], m + pageW * colWidths[0] + cellPad, currentY + cellPad, { width: pageW * colWidths[1] - cellPad * 2 });
      doc.restore();
      currentY += actualRowH;
    }
  });

  doc.y = currentY + 5;
}

function writeDefinicionesExtralaborales(doc, pageW, drawTableFn) {
  const m = doc.page.margins.left;
  const fontSize = 6.5;
  const cellPad = 3;
  const headerH = 18;
  const borderColor = '#B0BEC5';

  // Header
  doc.save();
  doc.rect(m, doc.y, pageW, headerH).fillColor('#B2DFDB').fill();
  doc.rect(m, doc.y, pageW, headerH).strokeColor(borderColor).lineWidth(0.5).stroke();
  doc.fontSize(fontSize).font('Helvetica-Bold').fillColor('#004D40');
  doc.text('DIMENSIÓN', m + cellPad, doc.y + cellPad, { width: pageW - cellPad * 2 });
  doc.restore();
  let currentY = doc.y + headerH;

  for (const [dimName, def] of Object.entries(EXTRALABORAL_DEFINITIONS)) {
    const textHeight = doc.fontSize(fontSize).font('Helvetica').heightOfString(def, { width: pageW * 0.7 - cellPad * 2 });
    const rowH = Math.max(14, textHeight + cellPad * 2);

    if (currentY + rowH > doc.page.height - doc.page.margins.bottom - 20) {
      doc.addPage();
      currentY = doc.page.margins.top;
    }

    doc.save();
    doc.rect(m, currentY, pageW, rowH).strokeColor(borderColor).lineWidth(0.3).stroke();
    doc.fontSize(fontSize).font('Helvetica-Bold').fillColor('#374151');
    doc.text(dimName.toUpperCase(), m + cellPad, currentY + cellPad, { width: pageW * 0.30 - cellPad * 2 });
    doc.fontSize(fontSize).font('Helvetica').fillColor('#374151');
    doc.text(def, m + pageW * 0.30 + cellPad, currentY + cellPad, { width: pageW * 0.70 - cellPad * 2 });
    doc.restore();
    currentY += rowH;
  }

  doc.y = currentY + 5;
}

// ============================================================
// STATIC TEXT SECTIONS (kept for backward compatibility)
// ============================================================

function writeIntroduccion(doc, pageW) {
  const p = (text) => {
    doc.fontSize(10).font('Helvetica').fillColor('#374151');
    doc.text(text, { width: pageW, align: 'justify' });
    doc.moveDown(0.5);
  };

  p('Los factores de riesgo psicosocial en el trabajo han sido definidos por la OMS como las interacciones entre el trabajo, su medio ambiente, la satisfacción en el trabajo y las condiciones de la organización. Por otra parte, se han definido como las capacidades del trabajador, sus necesidades, su cultura y su situación personal fuera del trabajo; todo lo cual, a través de percepciones y experiencias particulares, los cuales pueden influir en la salud, el rendimiento y la satisfacción en el trabajo.');

  p('Las normas colombianas han establecido reglas claras para que las empresas protejan a sus trabajadores contra los diferentes factores de riesgo psicosocial identificando, evaluando, previniendo, interviniendo y monitoreando de manera permanente la exposición a factores de riesgo psicosocial en el trabajo y determinando el origen de las patologías presuntamente causadas por el estrés, razón por la cual las organizaciones deben evaluar a sus trabajadores en materia de riesgo psicosocial laboral.');

  p('Para dar cumplimiento al programa de intervención en riesgos psicosociales y en cumplimiento de la normatividad vigente, se aplica la Batería de Instrumentos para la Evaluación de Factores de Riesgo Psicosocial del Ministerio de la Protección Social, con el fin de determinar posibles situaciones críticas e intervenir oportunamente los factores de riesgo, los cuales se presentan en tres modalidades de análisis: factores intralaborales, factores extralaborales y el nivel de estrés.');
}

function writeMarcoReferencial(doc, pageW) {
  const p = (text) => {
    doc.fontSize(10).font('Helvetica').fillColor('#374151');
    doc.text(text, { width: pageW, align: 'justify' });
    doc.moveDown(0.5);
  };

  const bullet = (text) => {
    doc.fontSize(10).font('Helvetica').fillColor('#374151');
    doc.text(`• ${text}`, { width: pageW - 10, align: 'justify', indent: 10 });
    doc.moveDown(0.4);
  };

  p('A partir de la expedición del Decreto 614 de 1984 sobre la organización y administración de la seguridad y salud en el trabajo, las normas se han encaminado a definir un conjunto de disposiciones mínimas para la prevención de riesgos psicosociales:');

  bullet('La Resolución 1016 de 1989 indica el sentido de los programas importantes de salud ocupacional. El empleador debe desarrollar un programa de salud ocupacional que incluya la organización, ejecución y evaluación de las actividades de medicina preventiva, medicina del trabajo, higiene industrial y seguridad industrial.');

  bullet('Con la reforma a la Seguridad Social y el nuevo Sistema General de Riesgos Profesionales, el Ministerio de Trabajo y Seguridad Social expidió el decreto 1832 de agosto de 1994, con la tabla de enfermedades profesionales incluyendo las patologías causadas por estrés en el trabajo.');

  bullet('En Julio 17 de 2008 se expide la Resolución número 002646, por la cual se establecen disposiciones y se definen responsabilidades para la identificación, evaluación, prevención, intervención y monitoreo permanente de la exposición a factores de riesgo psicosocial en el trabajo y la determinación del origen de las patologías causadas por estrés ocupacional.');

  bullet('En el año 2010, el Ministerio de la Protección Social contrató con la Pontificia Universidad Javeriana un estudio de investigación para la realización de una Batería válida y confiable para evaluar los factores de riesgo psicosocial en trabajadores del territorio colombiano.');

  bullet('El 23 de julio de 2019 el Ministerio del Trabajo expide la Resolución 2404 por la cual se adopta la Batería de Instrumentos para la Evaluación de Factores de Riesgo Psicosocial, la Guía Técnica General para la promoción, prevención e intervención de los factores psicosociales.');

  bullet('El 13 de julio de 2022 el Ministerio del Trabajo expide la Resolución 2764 por la cual se actualiza la Batería de Instrumentos para la Evaluación de Factores de Riesgo Psicosocial y se establecen los aspectos técnicos necesarios para su aplicación.');
}

function writeMarcoTeorico(doc, pageW) {
  const p = (text) => {
    doc.fontSize(10).font('Helvetica').fillColor('#374151');
    doc.text(text, { width: pageW, align: 'justify' });
    doc.moveDown(0.5);
  };

  const def = (term, desc) => {
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#1F2937');
    doc.text(`${term}: `, { continued: true, width: pageW });
    doc.font('Helvetica').fillColor('#374151');
    doc.text(desc, { width: pageW, align: 'justify' });
    doc.moveDown(0.4);
  };

  p('En general, cualquier definición de riesgo psicosocial que se utilice debe contemplar que condiciones relacionadas con el individuo, el medio ambiente extralaboral y el medio intralaboral pueden actuar como factores de riesgo o de protección. La interacción dinámica entre estos factores puede afectar la salud y la productividad de las personas.');

  p('El estrés puede producir enfermedad a través de dos vías. En primer lugar, los estados emocionales generados por el estrés condicionan la conducta de riesgo; y en segundo lugar, las respuestas fisiológicas de estrés, de ser prolongadas, conllevan a las condiciones de riesgo biológico y a la enfermedad.');

  doc.moveDown(0.5);
  doc.fontSize(12).font('Helvetica-Bold').fillColor('#1E40AF').text('DEFINICIONES');
  doc.moveDown(0.5);

  def('Trabajo', 'Toda actividad humana remunerada o no, dedicada a la producción, comercialización, transformación, venta o distribución de bienes o servicios.');
  def('Riesgo', 'Probabilidad de ocurrencia de una enfermedad, lesión o daño en un grupo dado.');
  def('Factor de riesgo', 'Posible causa o condición que puede ser responsable de la enfermedad, lesión o daño.');
  def('Factores de riesgo psicosocial', 'Condiciones psicosociales cuya identificación y evaluación muestra efectos negativos en la salud de los trabajadores o en el trabajo.');
  def('Factor protector psicosocial', 'Condiciones de trabajo que promueven la salud y el bienestar del trabajador.');
  def('Estrés', 'Respuesta de un trabajador tanto a nivel fisiológico, psicológico como conductual, en su intento de adaptarse a las demandas resultantes de la interacción de sus condiciones individuales, intralaborales y extralaborales.');
  def('Carga física', 'Esfuerzo fisiológico que demanda la ocupación, generalmente se da en términos de postura corporal, fuerza, movimiento y traslado de cargas.');
  def('Carga mental', 'Demanda de actividad cognoscitiva que implica la tarea. Algunas de las variables relacionadas con la carga mental son: las exigencias de procesamiento cognitivo, memoria, atención y toma de decisiones.');
  def('Acoso laboral', 'Toda conducta persistente y demostrable, ejercida sobre un empleado, un jefe o superior jerárquico inmediato o mediato, un compañero de trabajo o un subalterno, encaminada a infundir miedo, intimidación, terror y angustia.');
}

function writeMetodologia(doc, pageW, drawTableFn) {
  const p = (text) => {
    doc.fontSize(10).font('Helvetica').fillColor('#374151');
    doc.text(text, { width: pageW, align: 'justify' });
    doc.moveDown(0.5);
  };

  p('Para la identificación de los dominios y dimensiones que se evalúan con los instrumentos de la batería se toma como referencia la definición de factores psicosociales del Ministerio de la Protección Social. El modelo sobre el cual se basa el presente instrumento reconoce cuatro dominios de factores psicosociales intralaborales: demandas del trabajo, control sobre el trabajo, liderazgo y relaciones sociales en el trabajo y recompensas.');

  p('A continuación se relacionan los dominios y dimensiones que se evalúan en los factores intralaborales, extralaborales e individuales:');

  // Tabla 1: Condiciones Intralaborales
  doc.moveDown(0.3);
  doc.fontSize(9).font('Helvetica-Bold').fillColor('#1F2937').text('Tabla 1. Condiciones Intralaborales');
  doc.moveDown(0.3);

  const m = doc.page.margins.left;
  const intralaboralRows = [
    ['Liderazgo y Relaciones\nSociales en el Trabajo', 'Características del liderazgo\nRelaciones sociales en el trabajo\nRetroalimentación del desempeño\nRelación con los colaboradores (Forma A)'],
    ['Control sobre el Trabajo', 'Claridad de rol\nCapacitación\nParticipación y manejo del cambio\nOportunidades para el uso y desarrollo de habilidades\nControl y autonomía sobre el trabajo'],
    ['Demandas del Trabajo', 'Demandas ambientales y de esfuerzo físico\nDemandas emocionales\nDemandas cuantitativas\nInfluencia del trabajo sobre el entorno extralaboral\nExigencias de responsabilidad del cargo (Forma A)\nDemandas de carga mental\nConsistencia del rol (Forma A)\nDemandas de la jornada de trabajo'],
    ['Recompensas', 'Reconocimiento y compensación\nRecompensas derivadas de la pertenencia a la organización']
  ];

  drawTableFn(doc, m, doc.y, pageW,
    [{ label: 'DOMINIO', width: 0.3 }, { label: 'DIMENSIONES', width: 0.7 }],
    intralaboralRows,
    { headerBgColor: '#BFDBFE', rowHeight: 14, fontSize: 7 }
  );

  doc.moveDown(1);

  // Tabla 2: Condiciones Extralaborales
  doc.fontSize(9).font('Helvetica-Bold').fillColor('#1F2937').text('Tabla 2. Condiciones Extralaborales');
  doc.moveDown(0.3);

  const extralaboralRows = [
    ['Tiempo fuera del trabajo'],
    ['Relaciones familiares'],
    ['Comunicación y relaciones interpersonales'],
    ['Situación económica del grupo familiar'],
    ['Características de la vivienda y de su entorno'],
    ['Influencia del entorno extralaboral sobre el trabajo'],
    ['Desplazamiento vivienda - trabajo - vivienda']
  ];

  drawTableFn(doc, m, doc.y, pageW * 0.6,
    [{ label: 'CONDICIONES EXTRALABORALES', width: 1.0 }],
    extralaboralRows,
    { headerBgColor: '#BFDBFE', rowHeight: 14, fontSize: 7 }
  );

  doc.moveDown(1);

  // Tabla 3: Escala de medición
  doc.fontSize(9).font('Helvetica-Bold').fillColor('#1F2937').text('Tabla 3. Escala de Medición e Interpretación');
  doc.moveDown(0.3);

  const riskRows = [
    ['Sin Riesgo', 'Ausencia de riesgo o riesgo tan bajo que no amerita desarrollar actividades de intervención. Las dimensiones y dominios que se encuentren bajo esta categoría serán objeto de acciones o programas de promoción.'],
    ['Riesgo Bajo', 'No se espera que los factores psicosociales que obtengan puntuaciones de este nivel estén relacionados con síntomas o respuestas de estrés significativas. Las dimensiones y dominios que se encuentren bajo esta categoría serán objeto de acciones o programas de intervención a fin de mantenerlos en los niveles de riesgo más bajos posibles.'],
    ['Riesgo Medio', 'Nivel de riesgo en el que se esperaría una respuesta de estrés moderada. Las dimensiones y dominios que se encuentren bajo esta categoría ameritan observación y acciones sistemáticas de intervención para prevenir efectos perjudiciales en la salud.'],
    ['Riesgo Alto', 'Nivel de riesgo que tiene una importante posibilidad de asociación con respuestas de estrés alto y por tanto, las dimensiones y dominios que se encuentren bajo esta categoría requieren intervención en el marco de un sistema de vigilancia epidemiológica.'],
    ['Riesgo Muy Alto', 'Nivel de riesgo con amplia posibilidad de asociarse a respuestas muy altas de estrés. Por consiguiente, las dimensiones y dominios que se encuentren bajo esta categoría requieren intervención inmediata en el marco de un sistema de vigilancia epidemiológica.']
  ];

  drawTableFn(doc, m, doc.y, pageW,
    [{ label: 'NIVEL DE RIESGO', width: 0.2 }, { label: 'INTERPRETACIÓN', width: 0.8 }],
    riskRows,
    { headerBgColor: '#BFDBFE', rowHeight: 14, fontSize: 7 }
  );
}

function writeProcedimiento(doc, pageW) {
  const p = (text) => {
    doc.fontSize(10).font('Helvetica').fillColor('#374151');
    doc.text(text, { width: pageW, align: 'justify' });
    doc.moveDown(0.5);
  };

  p('El cuestionario utilizado fue La Batería de Riesgo Psicosocial, avalada por el Ministerio del Trabajo y la Universidad Javeriana para poder determinar el nivel de riesgo psicosocial a los que se encuentran expuestos los trabajadores. Esta herramienta fue aplicada de forma digital a través de la plataforma BRS Digital, garantizando la confidencialidad de las respuestas individuales.');

  p('Los resultados obtenidos se presentan organizados de la siguiente forma: Primero, un análisis general de los factores de riesgo intralaboral. Segundo, los resultados por dominio y dimensión, separados por tipo de formulario aplicado (Forma A y Forma B). Tercero, el análisis de los factores extralaborales. Cuarto, el análisis del nivel de estrés. Finalmente, se presenta el plan de acción sugerido con las recomendaciones de intervención.');
}

// ============================================================
// DYNAMIC ANALYSIS TEXT GENERATORS
// ============================================================

function generateDimensionAnalysis(dimensionKey, riskCounts, totalParticipants) {
  const displayName = DIMENSION_DISPLAY_NAMES[dimensionKey] || dimensionKey;
  const highRisk = (riskCounts.riesgo_alto || 0) + (riskCounts.riesgo_muy_alto || 0);
  const lowRisk = (riskCounts.sin_riesgo || 0) + (riskCounts.riesgo_bajo || 0);
  const highPct = totalParticipants > 0 ? ((highRisk / totalParticipants) * 100).toFixed(0) : 0;
  const lowPct = totalParticipants > 0 ? ((lowRisk / totalParticipants) * 100).toFixed(0) : 0;

  // Find predominant risk level
  let maxCount = 0;
  let predominant = 'sin_riesgo';
  for (const [level, count] of Object.entries(riskCounts)) {
    if (count > maxCount) { maxCount = count; predominant = level; }
  }

  const riskLabel = {
    sin_riesgo: 'SIN RIESGO',
    riesgo_bajo: 'BAJO',
    riesgo_medio: 'MEDIO',
    riesgo_alto: 'ALTO',
    riesgo_muy_alto: 'MUY ALTO'
  }[predominant] || predominant;

  if (highPct > 40) {
    return `${displayName}: se observa un nivel de riesgo ${riskLabel}, donde el ${highPct}% de los funcionarios se encuentra en riesgo alto o muy alto. Esta situación requiere intervención prioritaria e inmediata.`;
  } else if (highPct > 20) {
    return `${displayName}: presenta un riesgo ${riskLabel} con tendencia a incrementarse. El ${highPct}% de los funcionarios presenta niveles de riesgo alto o muy alto, lo cual amerita acciones de intervención a mediano plazo.`;
  } else {
    return `${displayName}: los funcionarios en general presentan un nivel de riesgo ${riskLabel}. El ${lowPct}% se encuentra en niveles de riesgo bajo o sin riesgo, indicando condiciones favorables en esta dimensión.`;
  }
}

function generateOverallRiskText(riskCounts, totalParticipants, label) {
  const highRisk = (riskCounts.riesgo_alto || 0) + (riskCounts.riesgo_muy_alto || 0);
  const lowRisk = (riskCounts.sin_riesgo || 0) + (riskCounts.riesgo_bajo || 0);
  const highPct = totalParticipants > 0 ? ((highRisk / totalParticipants) * 100).toFixed(0) : 0;
  const lowPct = totalParticipants > 0 ? ((lowRisk / totalParticipants) * 100).toFixed(0) : 0;

  let maxCount = 0;
  let predominant = 'sin_riesgo';
  for (const [level, count] of Object.entries(riskCounts)) {
    if (count > maxCount) { maxCount = count; predominant = level; }
  }

  const riskLabel = {
    sin_riesgo: 'RIESGO BAJO – SIN RIESGO',
    riesgo_bajo: 'RIESGO BAJO',
    riesgo_medio: 'RIESGO MEDIO',
    riesgo_alto: 'RIESGO ALTO',
    riesgo_muy_alto: 'RIESGO MUY ALTO'
  }[predominant];

  return `A nivel general de ${label} se encuentra en ${riskLabel}. El ${lowPct}% de los funcionarios se encuentra en niveles de riesgo bajo o sin riesgo, mientras que el ${highPct}% presenta niveles de riesgo alto o muy alto.`;
}

// ============================================================
// PIE CHART COLORS
// ============================================================
const DEMOGRAPHIC_COLORS = [
  '#3B82F6', '#EAB308', '#10B981', '#F97316', '#EF4444',
  '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16', '#F59E0B',
  '#6366F1', '#14B8A6'
];

module.exports = {
  DIMENSION_DISPLAY_NAMES,
  DIMENSION_SHORT_NAMES,
  DOMAIN_DISPLAY_NAMES,
  DOMAIN_ORDER,
  DOMAIN_DIMENSIONS,
  EXTRALABORAL_DIMENSIONS,
  INTERVENTION_RECOMMENDATIONS,
  INTRALABORAL_DEFINITIONS,
  EXTRALABORAL_DEFINITIONS,
  DEMOGRAPHIC_COLORS,
  writeIntroduccion,
  writeMarcoReferencial,
  writeMarcoTeorico,
  writeMetodologia,
  writeProcedimiento,
  writeObjetivosMetodologia,
  writeProcedimientos,
  writeDefinicionesIntralaborales,
  writeDefinicionesExtralaborales,
  generateDimensionAnalysis,
  generateOverallRiskText
};
