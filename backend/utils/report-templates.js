/**
 * Report Templates - Static content, dimension mappings, and intervention recommendations
 * for the organizational BRS report.
 */
const { BRAND_NAME } = require('../config/brand');

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
// INTERVENTION PLAN (structured action plan by domain / factor)
// ============================================================
const INTERVENTION_PLAN = {
  demandas_trabajo: {
    objetivo: 'Garantizar una adecuada organización, distribución y claridad de las demandas laborales, reduciendo la sobrecarga y previniendo la fatiga física y mental.',
    acciones: [
      'Redistribución y priorización de las cargas laborales según los perfiles, los tiempos reales y las capacidades del equipo.',
      'Planificación operativa clara: cronogramas realistas, con tiempos límite definidos y retroalimentación periódica entre líderes y equipos.',
      'Pausas activas estructuradas para disminuir la fatiga física y cognitiva.',
      'Taller de manejo del estrés laboral (técnicas de respiración, distensión muscular y micro-descansos).',
      'Capacitación en gestión del tiempo y productividad saludable.'
    ]
  },
  liderazgo_relaciones_sociales: {
    objetivo: 'Fortalecer las habilidades de liderazgo, comunicación y cohesión grupal para mejorar el clima laboral y disminuir las tensiones interpersonales.',
    acciones: [
      'Taller de liderazgo y comunicación asertiva para jefes y coordinadores (retroalimentación efectiva, escucha activa y gestión emocional).',
      'Entrenamiento en resolución de conflictos y construcción de acuerdos.',
      'Reuniones de equipo con estructura clara para revisar avances, dificultades y compromisos.',
      'Canal de comunicación interna para expresar inconformidades, sugerencias o alertas.',
      'Jornadas de integración y fortalecimiento del compañerismo y el trabajo colaborativo.'
    ]
  },
  control_trabajo: {
    objetivo: 'Incrementar la autonomía, la claridad del rol y la participación del personal en las decisiones relacionadas con su propio trabajo.',
    acciones: [
      'Clarificación de funciones y responsabilidades: actualizar los perfiles de cargo por escrito y socializarlos.',
      'Espacios periódicos de participación donde los trabajadores propongan mejoras de los procesos.',
      'Capacitación en empoderamiento laboral y toma de decisiones.',
      'Planes de capacitación acordes a las necesidades del cargo (inducción, reinducción y formación específica).',
      'Revisión de los protocolos de trabajo para eliminar tareas duplicadas o innecesarias.'
    ]
  },
  recompensas: {
    objetivo: 'Promover prácticas de reconocimiento justo, retroalimentación oportuna y sentido de estabilidad y valor dentro de la organización.',
    acciones: [
      'Sistema de reconocimiento periódico que resalte logros, buenas prácticas y aportes significativos.',
      'Retroalimentación estructurada del desempeño con enfoque constructivo.',
      'Capacitación en motivación laboral y bienestar emocional.',
      'Socialización clara de las rutas de crecimiento, desarrollo interno y formación.',
      'Encuestas de clima laboral para valorar la percepción de justicia organizacional y ajustar acciones.'
    ]
  },
  extralaboral: {
    objetivo: 'Aunque los factores extralaborales no dependen totalmente de la organización, promover ajustes que mejoren el equilibrio entre la vida laboral y personal.',
    acciones: [
      'Actividades de bienestar social que involucren a los núcleos familiares de los trabajadores.',
      'Promoción del aprovechamiento del tiempo libre (deporte, arte, cultura).',
      'Canales de comunicación para conocer las necesidades y preferencias de los trabajadores.',
      'Fomento de la participación de los trabajadores y sus familias en las actividades de la organización.'
    ]
  },
  estres: {
    objetivo: 'Prevenir y controlar las manifestaciones de estrés, fortaleciendo las estrategias de afrontamiento y autocuidado.',
    acciones: [
      'Ruta de atención psicológica prioritaria para los trabajadores con signos de estrés elevado.',
      'Sesiones grupales de psicoeducación (respiración, relajación, regulación emocional y afrontamiento adaptativo).',
      'Capacitación en autocuidado y balance vida–trabajo.',
      'Seguimiento dentro del Sistema de Vigilancia Epidemiológica (SVE) en riesgo psicosocial.',
      'Fomento de hábitos saludables (sueño, alimentación, actividad física) y revisión de las cargas cuando se detecten síntomas persistentes.'
    ]
  }
};

// Order in which the plan blocks are rendered.
const INTERVENTION_PLAN_ORDER = ['demandas_trabajo', 'liderazgo_relaciones_sociales', 'control_trabajo', 'recompensas', 'extralaboral', 'estres'];
const INTERVENTION_PLAN_TITLES = {
  demandas_trabajo: 'Demandas del Trabajo',
  liderazgo_relaciones_sociales: 'Liderazgo y Relaciones Sociales en el Trabajo',
  control_trabajo: 'Control sobre el Trabajo',
  recompensas: 'Recompensas',
  extralaboral: 'Condiciones Extralaborales',
  estres: 'Sintomatología Asociada al Estrés'
};

// ============================================================
// MARCO LEGAL (reference table of applicable regulations)
// ============================================================
const MARCO_LEGAL_ROWS = [
  ['Ley 1010 de 2006', 'Medidas para prevenir, corregir y sancionar el acoso laboral y otros hostigamientos en el marco de las relaciones de trabajo.'],
  ['Ley 100 de 1993', 'Sistema de Seguridad Social Integral (Art. 83 y 84).'],
  ['Ley 1562 de 2012', 'Modifica el Sistema de Riesgos Laborales y dicta disposiciones en materia de salud ocupacional.'],
  ['Ley 1616 de 2013', 'Ley de Salud Mental y otras disposiciones.'],
  ['Resolución 2646 de 2008', 'Disposiciones y responsabilidades para la identificación, evaluación, prevención, intervención y monitoreo permanente de la exposición a factores de riesgo psicosocial y la determinación del origen de las patologías causadas por el estrés ocupacional.'],
  ['Resolución 652 y 1356 de 2012', 'Conformación y funcionamiento del Comité de Convivencia Laboral en entidades públicas y privadas.'],
  ['Resolución 2404 de 2019', 'Adopta la Batería de Instrumentos para la Evaluación de Factores de Riesgo Psicosocial y la Guía Técnica General.'],
  ['Resolución 2764 de 2022', 'Actualiza la Batería de Instrumentos y establece los aspectos técnicos necesarios para su aplicación.'],
  ['Decreto 1072 de 2015', 'Decreto Único Reglamentario del Sector Trabajo — implementación del Sistema de Gestión de Seguridad y Salud en el Trabajo (SG-SST).'],
  ['Decreto 1832 de 1994', 'Adopta la Tabla de Enfermedades Profesionales (incluye patologías causadas por estrés en el trabajo).'],
  ['Decreto 614 de 1984', 'Bases para la organización y administración de la salud ocupacional en el país.']
];

function writeMarcoLegal(doc, pageW, drawTableFn) {
  const m = doc.page.margins.left;
  doc.fontSize(10).fillColor('#374151').font('Helvetica');
  doc.text('En Colombia, la legislación en seguridad y salud en el trabajo ha señalado la importancia de evaluar e intervenir los factores psicosociales dentro de las políticas de prevención de riesgos laborales. A continuación se relacionan las principales normas aplicables:', { width: pageW, align: 'justify' });
  doc.moveDown(0.5);
  drawTableFn(doc, m, doc.y, pageW,
    [{ label: 'NORMA', width: 0.28 }, { label: 'OBJETO', width: 0.72 }],
    MARCO_LEGAL_ROWS,
    { headerBgColor: '#BFDBFE', rowHeight: 14, fontSize: 7 }
  );
}

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

function writeObjetivosMetodologia(doc, pageW, texts = {}) {
  const objetivoGeneral = texts.objetivoGeneral || '';
  const objetivosEspecificos = Array.isArray(texts.objetivosEspecificos) ? texts.objetivosEspecificos : [];
  const metodologiaInstrumento = texts.metodologiaInstrumento || '';

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
  doc.text(`• ${objetivoGeneral}`, doc.page.margins.left, ly, { width: colW, align: 'justify' });
  ly = doc.y + 10;

  doc.fontSize(9).font('Helvetica-Bold').fillColor('#1F2937');
  doc.text('ESPECÍFICOS', doc.page.margins.left, ly, { width: colW });
  ly += 14;
  doc.fontSize(8).font('Helvetica').fillColor('#374151');
  objetivosEspecificos.forEach(t => {
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
  doc.text(metodologiaInstrumento, rightX, ry, { width: colW, align: 'justify' });
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

function writeProcedimientos(doc, pageW, texts = {}) {
  const paras = Array.isArray(texts.procedimiento) ? texts.procedimiento : [];
  const criterios = texts.criteriosInclusionExclusion || '';

  doc.fontSize(9).font('Helvetica').fillColor('#374151');
  paras.forEach(p => {
    doc.text(p, { width: pageW, align: 'justify' });
    doc.moveDown(0.5);
  });

  doc.fontSize(9).font('Helvetica-Bold').fillColor('#1F2937');
  doc.text('Criterios de inclusión y exclusión', { width: pageW });
  doc.moveDown(0.2);
  doc.fontSize(8).font('Helvetica').fillColor('#374151');
  doc.text(criterios, { width: pageW, align: 'justify' });
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

  p(`El cuestionario utilizado fue La Batería de Riesgo Psicosocial, avalada por el Ministerio del Trabajo y la Universidad Javeriana para poder determinar el nivel de riesgo psicosocial a los que se encuentran expuestos los trabajadores. Esta herramienta fue aplicada de forma digital a través de la plataforma ${BRAND_NAME}, garantizando la confidencialidad de las respuestas individuales.`);

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
// EDITABLE ORGANIZATIONAL REPORT TEXTS
// ============================================================
// The curated set of prose sections an evaluator can review and edit before
// printing the organizational report. Charts, tables and computed percentages
// are NOT editable — only the narrative text.
//
// `kind`:
//   'paragraph'  -> a single string, rendered as one justified paragraph
//   'paragraphs' -> string[], each entry rendered as its own justified paragraph
//   'list'       -> string[], each entry rendered as a bullet / numbered item
// Array fields ('paragraphs' and 'list') are edited as "one line = one entry".

// Último recurso para la ciudad de la portada: solo se usa cuando ninguna ficha
// de datos trae ciudad de trabajo.
const DEFAULT_REPORT_CITY = 'BOGOTÁ D.C.';

// Ciudad más frecuente entre las fichas de datos de la evaluación.
// `demographics.ciudadTrabajo` es un mapa { 'Tumaco, Nariño': 5, ... } que arma
// aggregateExtendedDemographics; se elige la de mayor conteo (empate -> la
// primera alfabéticamente, para que el mismo dato no produzca portadas distintas).
function resolveReportCity(demographics) {
  const counts = (demographics && demographics.ciudadTrabajo) || {};
  const entries = Object.entries(counts).filter(([city, n]) => city && n > 0);
  if (!entries.length) return '';
  entries.sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0], 'es'));
  return entries[0][0];
}

const ORG_TEXT_FIELDS = [
  { key: 'ciudad', group: 'Descripción de la empresa', label: 'Ciudad del informe', kind: 'paragraph', help: 'Aparece en la portada, junto al mes y año. Por defecto se toma la ciudad de trabajo más frecuente en las fichas de datos.' },
  { key: 'direccion', group: 'Descripción de la empresa', label: 'Dirección', kind: 'paragraph', help: 'Opcional. Se muestra en la ficha de la empresa.' },
  { key: 'actividadEconomica', group: 'Descripción de la empresa', label: 'Actividad económica', kind: 'paragraph', help: 'Opcional.' },
  { key: 'mision', group: 'Descripción de la empresa', label: 'Misión', kind: 'paragraph', help: 'Opcional.' },
  { key: 'vision', group: 'Descripción de la empresa', label: 'Visión', kind: 'paragraph', help: 'Opcional.' },
  { key: 'introduccion', group: 'Introducción', label: 'Introducción', kind: 'paragraphs', help: 'Un párrafo por línea.' },
  { key: 'justificacion', group: 'Justificación', label: 'Justificación', kind: 'paragraphs', help: 'Un párrafo por línea.' },
  { key: 'objetivoGeneral', group: 'Objetivos y Metodología', label: 'Objetivo general', kind: 'paragraph' },
  { key: 'objetivosEspecificos', group: 'Objetivos y Metodología', label: 'Objetivos específicos', kind: 'list', help: 'Una viñeta por línea.' },
  { key: 'metodologiaInstrumento', group: 'Objetivos y Metodología', label: 'Metodología · Instrumento', kind: 'paragraph' },
  { key: 'procedimiento', group: 'Procedimientos', label: 'Procedimiento', kind: 'paragraphs', help: 'Un párrafo por línea.' },
  { key: 'criteriosInclusionExclusion', group: 'Procedimientos', label: 'Criterios de inclusión y exclusión', kind: 'paragraph' },
  { key: 'recomendaciones', group: 'Recomendaciones', label: 'Recomendaciones', kind: 'list', help: 'Una recomendación por línea (se numeran automáticamente).' },
  { key: 'intervencionPrioritaria', group: 'Recomendaciones', label: 'Intervención prioritaria', kind: 'paragraph' },
  { key: 'conclusiones', group: 'Conclusiones', label: 'Conclusiones', kind: 'paragraphs', help: 'Un párrafo por línea. La lista de dimensiones en mayor riesgo se agrega automáticamente antes del último párrafo.' },
];

const ORG_TEXT_FIELD_MAP = ORG_TEXT_FIELDS.reduce((acc, f) => { acc[f.key] = f; return acc; }, {});

// Builds the default texts with company name and population count already
// resolved, so the evaluator edits WYSIWYG strings (not tokens).
function buildDefaultOrgTexts({ companyName = 'la organización', totalEvaluated = 0, city = '' } = {}) {
  const empresa = companyName || 'la organización';
  return {
    // Ciudad de la portada. Antes era 'BOGOTÁ D.C.' fijo en el PDF, lo que
    // firmaba desde Bogotá informes de empresas de cualquier parte del país.
    // Se deriva de las fichas y el evaluador puede corregirla.
    ciudad: city || DEFAULT_REPORT_CITY,
    // Descripción de la empresa — vacíos por defecto (los diligencia el evaluador)
    direccion: '',
    actividadEconomica: '',
    mision: '',
    vision: '',
    justificacion: [
      `Los riesgos psicosociales son una realidad presente en la mayoría de los entornos laborales. Los trabajadores pueden estar expuestos a factores como el estrés, la presión por el cumplimiento de metas y responsabilidades, la atención a usuarios y la gestión constante de procesos, los cuales pueden tener consecuencias sobre su salud física y mental —estrés crónico, ansiedad, agotamiento emocional— así como sobre la productividad y la calidad del servicio.`,
      `Por lo anterior, es fundamental que ${empresa} identifique y controle los factores de riesgo psicosocial en el lugar de trabajo. Al hacerlo, la organización no solo cumple con la normatividad vigente (Resolución 2646 de 2008 y Resolución 2764 de 2022), sino que también mejora la salud y el bienestar de sus colaboradores, fortalece el clima organizacional y protege su desempeño institucional.`
    ],
    introduccion: [
      'Los factores de riesgo psicosocial en el trabajo han sido definidos por la OMS como las interacciones entre el trabajo, su medio ambiente, la satisfacción en el trabajo y las condiciones de la organización. Por otra parte, se han definido como las capacidades del trabajador, sus necesidades, su cultura y su situación personal fuera del trabajo; todo lo cual, a través de percepciones y experiencias particulares, los cuales pueden influir en la salud, el rendimiento y la satisfacción en el trabajo.',
      'Las normas colombianas han establecido reglas claras para que las empresas protejan a sus trabajadores contra los diferentes factores de riesgo psicosocial identificando, evaluando, previniendo, interviniendo y monitoreando de manera permanente la exposición a factores de riesgo psicosocial en el trabajo y determinando el origen de las patologías presuntamente causadas por el estrés, razón por la cual las organizaciones deben evaluar a sus trabajadores en materia de riesgo psicosocial laboral.',
      'Para dar cumplimiento al programa de intervención en riesgos psicosociales y en cumplimiento de la normatividad vigente, se aplica la Batería de Instrumentos para la Evaluación de Factores de Riesgo Psicosocial del Ministerio de la Protección Social, con el fin de determinar posibles situaciones críticas e intervenir oportunamente los factores de riesgo, los cuales se presentan en tres modalidades de análisis: factores intralaborales, factores extralaborales y el nivel de estrés.'
    ],
    objetivoGeneral: `Identificar la percepción de riesgo psicosocial de los colaboradores de la ${empresa}.`,
    objetivosEspecificos: [
      `Evaluar los posibles factores de riesgo intralaborales y extralaborales, presentes en los colaboradores de la ${empresa}.`,
      `Reconocer las probables sintomatologías asociadas al estrés en la ${empresa}.`,
      `Recomendar a la empresa pautas de acción claras para la mitigación de la percepción de los riesgos identificados.`
    ],
    metodologiaInstrumento: 'Para la medición de la percepción de riesgos psicosociales y de acuerdo con la Resolución 2764/2022, se utilizó la fase I de la batería de instrumentos diseñados por el Ministerio de la Protección Social, denominados Batería de Instrumentos para la Evaluación de Factores de Riesgo Psicosocial, (2010).',
    procedimiento: [
      'Para llevar a cabo la presente medición, se realizó una sensibilización a todos los colaboradores donde se especificó ampliamente el proceso a seguir, los instrumentos a emplear, la importancia de los resultados obtenidos y la confidencialidad de la información. Seguido a ello, se aplicó el consentimiento informado, donde los colaboradores autorizaron su participación voluntaria en el estudio y se clarificó desde el marco legal las condiciones éticas de la medición.',
      `Luego de haberse realizado el proceso descrito, se aplicó la Batería para la Evaluación de Riesgo Psicosocial de la Universidad Javeriana - Ministerio de la Protección Social (2010), a través de la plataforma ${BRAND_NAME}. Una vez consolidada la información se procede a la realización del informe general de la percepción de riesgo psicosocial.`
    ],
    criteriosInclusionExclusion: 'Para la medición de riesgo psicosocial se tuvieron en cuenta criterios de inclusión tales como: Que el trabajador se encontrara en la nómina de la empresa, que estuviera ejerciendo sus labores y que su vinculación laboral no fuera menor a 3 meses. Como criterios de exclusión, no se tuvieron en cuenta los trabajadores que se encontraran en licencia de maternidad, licencia por luto e incapacitados el día de la medición.',
    recomendaciones: [
      `Implementar un programa de vigilancia epidemiológica en riesgo psicosocial para los funcionarios de ${empresa}, de acuerdo con la Resolución 2764 de 2022.`,
      'Abordar de manera prioritaria las dimensiones que presentan niveles de riesgo alto y muy alto, mediante intervenciones tanto a nivel organizacional como individual.',
      'Diseñar programas de promoción y prevención orientados a fortalecer los factores protectores identificados y disminuir los factores de riesgo.',
      'Realizar evaluaciones de seguimiento cada 12 meses para monitorear la evolución de los indicadores de riesgo.',
      'Implementar estrategias de intervención diferenciadas por áreas, teniendo en cuenta las particularidades de cada grupo poblacional.'
    ],
    intervencionPrioritaria: 'Se entiende como intervención prioritaria aquella que se dirige a las dimensiones que presentan niveles de riesgo alto y muy alto en un porcentaje significativo de la población evaluada. Estas dimensiones requieren atención inmediata y acciones de intervención a corto plazo.',
    conclusiones: [
      `Se realizó la evaluación de riesgo psicosocial a ${totalEvaluated} trabajadores de ${empresa}, mediante la aplicación de la Batería de Instrumentos para la Evaluación de Factores de Riesgo Psicosocial del Ministerio de la Protección Social, en cumplimiento de la Resolución 2764 de 2022 (Art. 3).`,
      'Los resultados obtenidos permiten identificar las condiciones de riesgo psicosocial que requieren intervención, así como los factores protectores que deben ser fortalecidos. Se recomienda estructurar un plan de acción enmarcado en el Sistema de Gestión de Seguridad y Salud en el Trabajo.',
      `Es fundamental que ${empresa} implemente las acciones de intervención sugeridas de manera oportuna, priorizando las dimensiones con mayor nivel de riesgo y garantizando el seguimiento continuo de la salud psicosocial de sus trabajadores.`
    ]
  };
}

// Coerces an arbitrary value to the shape expected by a field kind, dropping
// junk. Used both when persisting (PUT) and when accepting inline overrides.
function sanitizeOrgTexts(input) {
  const out = {};
  if (!input || typeof input !== 'object') return out;
  for (const field of ORG_TEXT_FIELDS) {
    if (!(field.key in input)) continue;
    const value = input[field.key];
    if (field.kind === 'paragraph') {
      if (value == null) continue;
      out[field.key] = String(value);
    } else {
      // paragraphs | list -> array of non-empty trimmed strings
      const arr = Array.isArray(value)
        ? value
        : (value == null ? [] : String(value).split('\n'));
      out[field.key] = arr.map(v => String(v).trim()).filter(Boolean);
    }
  }
  return out;
}

// Merges saved/inline overrides over the resolved defaults, field by field.
function mergeOrgTexts(defaults, overrides) {
  const merged = { ...defaults };
  const clean = sanitizeOrgTexts(overrides);
  for (const key of Object.keys(clean)) {
    merged[key] = clean[key];
  }
  return merged;
}

// ============================================================
// QUALITATIVE NARRATIVE ENGINE (per dimension / domain / form)
// ============================================================
// Produces the professional prose interpretation expected in a Colombian
// psychosocial technical report (Res. 2646/2764): a paragraph per dimension
// keyed off the group's risk level, a conclusion per domain, and a general
// analysis per form. Grounded in the actual distribution so it stays honest.

// Per-dimension fragments: `concern` = what the dimension is about (slots after
// "relacionado con / respecto a"); `risk` = consequence when the risk is high.
const DIMENSION_NARRATIVE = {
  // Liderazgo y relaciones sociales
  caracteristicas_liderazgo: { concern: 'la forma en que los jefes orientan y asignan el trabajo, toman decisiones, acompañan y se comunican con su equipo', risk: 'incertidumbre, disminución de la motivación y baja confianza hacia las directrices, afectando el clima laboral' },
  relaciones_sociales_trabajo: { concern: 'la calidad de las interacciones, la comunicación y la cooperación entre compañeros', risk: 'tensiones en la comunicación, conflictos no resueltos y menor apoyo social dentro del equipo' },
  'retroalimentacion_desempeño': { concern: 'la claridad y la frecuencia de la información que reciben los trabajadores sobre su rendimiento', risk: 'desorientación respecto a las expectativas del rol, desmotivación y dificultades para mejorar el desempeño' },
  relacion_colaboradores: { concern: 'la gestión, la comunicación y la interacción de la jefatura con sus colaboradores', risk: 'dificultades de coordinación y comunicación entre jefes y colaboradores que afectan los resultados del equipo' },
  // Control sobre el trabajo
  claridad_rol: { concern: 'la definición y comunicación de las funciones, responsabilidades y expectativas del cargo', risk: 'confusión en la ejecución de las tareas, inseguridad en la toma de decisiones y dificultad para priorizar actividades' },
  capacitacion: { concern: 'las actividades de formación y entrenamiento que la organización brinda para el desempeño del cargo', risk: 'sensación de falta de preparación, menor confianza en las competencias y percepción de desactualización' },
  participacion_manejo_cambio: { concern: 'la participación de los trabajadores en las decisiones y la forma en que se gestionan los cambios organizacionales', risk: 'sensación de imposición, resistencia al cambio y menor compromiso con las transformaciones institucionales' },
  oportunidades_desarrollo: { concern: 'las posibilidades de aplicar, fortalecer y desarrollar habilidades y conocimientos en el trabajo', risk: 'desmotivación, estancamiento laboral y disminución del sentido de logro personal' },
  control_autonomia: { concern: 'el margen de decisión sobre el orden, el ritmo y la forma de realizar las tareas', risk: 'reducción de la sensación de dominio sobre el propio trabajo, mayor tensión laboral y menor motivación' },
  // Demandas del trabajo
  demandas_ambientales: { concern: 'las condiciones del entorno físico y el esfuerzo corporal que exige la labor', risk: 'fatiga física, incomodidad y desgaste que pueden afectar la eficacia en el desempeño' },
  demandas_emocionales: { concern: 'las situaciones que exigen regulación y control emocional constante', risk: 'cansancio emocional y disminución progresiva de los recursos psicológicos disponibles' },
  demandas_cuantitativas: { concern: 'la cantidad de trabajo a realizar en relación con el tiempo y los recursos disponibles', risk: 'sobrecarga laboral, presión por el cumplimiento y mayor probabilidad de errores por saturación' },
  demandas_carga_mental: { concern: 'las exigencias de concentración, atención y procesamiento de información que implica la tarea', risk: 'fatiga mental, saturación cognitiva y dificultad para tomar decisiones de manera eficiente' },
  exigencias_responsabilidad: { concern: 'el grado de compromiso y las responsabilidades críticas asociadas al cargo', risk: 'aumento de la carga psicológica y tensión sostenida, especialmente ante la falta de recursos o apoyos' },
  demandas_jornada: { concern: 'la duración, la intensidad y la distribución de la jornada laboral', risk: 'cansancio acumulado, menor tiempo de recuperación y afectación del rendimiento entre jornadas' },
  consistencia_rol: { concern: 'la compatibilidad entre las distintas exigencias y expectativas del cargo', risk: 'ambigüedad, incertidumbre y dificultad para organizar prioridades' },
  influencia_trabajo_entorno: { concern: 'la manera en que las exigencias del trabajo repercuten en la vida personal, familiar y social', risk: 'dificultad para desconectarse del trabajo y desequilibrio entre la vida laboral y personal' },
  // Recompensas
  reconocimiento_compensacion: { concern: 'el reconocimiento, la valoración y la compensación que recibe el trabajador por su labor', risk: 'la percepción de que el esfuerzo no es valorado, con impacto en la motivación y la satisfacción laboral' },
  recompensas_pertenencia: { concern: 'el sentido de pertenencia, el orgullo y la estabilidad derivados de vincularse a la organización', risk: 'disminución del compromiso y del sentido de identidad y propósito con la organización' },
  // Extralaboral
  tiempo_fuera_trabajo: { concern: 'el tiempo disponible para el descanso, la familia y las actividades de recreación fuera del trabajo', risk: 'menor recuperación y desequilibrio entre la vida personal y laboral' },
  relaciones_familiares: { concern: 'la calidad de las interacciones con el núcleo familiar', risk: 'tensiones familiares que pueden afectar el bienestar del trabajador' },
  comunicacion_relaciones_interpersonales: { concern: 'la comunicación y las relaciones con allegados y amigos', risk: 'redes de apoyo social debilitadas' },
  situacion_economica: { concern: 'la disponibilidad de medios económicos para cubrir los gastos del grupo familiar', risk: 'preocupación económica que puede incidir en el bienestar y la concentración' },
  caracteristicas_vivienda: { concern: 'las condiciones de la vivienda y de su entorno', risk: 'condiciones del hogar que pueden afectar el descanso y el bienestar' },
  influencia_entorno_trabajo: { concern: 'la manera en que las exigencias del entorno familiar y personal influyen en el trabajo', risk: 'interferencia del entorno personal en la actividad y el bienestar laboral' },
  desplazamiento_vivienda_trabajo: { concern: 'las condiciones, la comodidad y la duración del traslado entre la vivienda y el trabajo', risk: 'desgaste y reducción del tiempo disponible por desplazamientos exigentes' }
};

// What each domain concerns, used in the domain-level conclusion.
const DOMAIN_NARRATIVE_CONCERN = {
  liderazgo_relaciones_sociales: 'las dinámicas de dirección, la interacción social, la retroalimentación y el reconocimiento',
  control_trabajo: 'la claridad del rol, la capacitación, la participación, la autonomía y las oportunidades de desarrollo',
  demandas_trabajo: 'las exigencias físicas, cognitivas, emocionales y cuantitativas del cargo',
  recompensas: 'el reconocimiento, la compensación y el sentido de pertenencia a la organización'
};

// Classifies a group risk-count distribution into a single representative tier
// + label, mirroring how a psychologist reads a dimension's group result.
function classifyGroupRisk(counts) {
  const c = counts || {};
  const total = (c.sin_riesgo || 0) + (c.riesgo_bajo || 0) + (c.riesgo_medio || 0) + (c.riesgo_alto || 0) + (c.riesgo_muy_alto || 0);
  if (total === 0) return { tier: 'favorable', label: 'bajo', total: 0, highPct: '0.0', lowPct: '0.0' };
  const high = (c.riesgo_alto || 0) + (c.riesgo_muy_alto || 0);
  const low = (c.sin_riesgo || 0) + (c.riesgo_bajo || 0);
  const highPct = high / total * 100;
  const lowPct = low / total * 100;
  const order = ['sin_riesgo', 'riesgo_bajo', 'riesgo_medio', 'riesgo_alto', 'riesgo_muy_alto'];
  let predom = 'sin_riesgo', max = -1;
  order.forEach(l => { if ((c[l] || 0) > max) { max = c[l] || 0; predom = l; } });
  let tier, label;
  if (highPct >= 40) { tier = 'riesgo'; label = (c.riesgo_muy_alto || 0) > (c.riesgo_alto || 0) ? 'muy alto' : 'alto'; }
  else if (highPct >= 20 || predom === 'riesgo_medio' || predom === 'riesgo_alto' || predom === 'riesgo_muy_alto') { tier = 'medio'; label = 'medio'; }
  else { tier = 'favorable'; label = 'bajo'; }
  return { tier, label, total, highPct: highPct.toFixed(1), lowPct: lowPct.toFixed(1) };
}

function generateDimensionNarrative(dimKey, counts) {
  const frag = DIMENSION_NARRATIVE[dimKey];
  const name = DIMENSION_DISPLAY_NAMES[dimKey] || dimKey;
  const r = classifyGroupRisk(counts);
  if (r.total === 0) return null;
  const concern = frag ? frag.concern : `los aspectos evaluados en la dimensión ${name.toLowerCase()}`;
  const riskConseq = frag ? frag.risk : 'condiciones que pueden afectar el bienestar del trabajador';

  if (r.tier === 'riesgo') {
    return `En la dimensión ${name} los trabajadores perciben un nivel de riesgo ${r.label}, relacionado con ${concern}. Esta situación puede generar ${riskConseq}, e incrementar la probabilidad de respuestas de estrés. En este grupo, el ${r.highPct}% se ubica en riesgo alto o muy alto.`;
  }
  if (r.tier === 'medio') {
    return `En la dimensión ${name} se identifica un nivel de riesgo medio en relación con ${concern}. Aunque no representa una afectación severa, evidencia condiciones que requieren observación y acciones preventivas para evitar ${riskConseq}. El ${r.highPct}% del grupo se ubica en riesgo alto o muy alto y el ${r.lowPct}% en niveles sin riesgo o de riesgo bajo.`;
  }
  return `En la dimensión ${name} los trabajadores perciben condiciones favorables respecto a ${concern}, lo que constituye un factor protector para el bienestar y el desempeño laboral. El ${r.lowPct}% del grupo se ubica en niveles sin riesgo o de riesgo bajo.`;
}

function generateDomainConclusion(domainKey, counts) {
  const name = DOMAIN_DISPLAY_NAMES[domainKey] || domainKey;
  const concern = DOMAIN_NARRATIVE_CONCERN[domainKey] || 'las condiciones evaluadas en este dominio';
  const r = classifyGroupRisk(counts);
  if (r.total === 0) return null;
  if (r.tier === 'riesgo') {
    return `En conclusión, el dominio ${name} presenta un nivel de riesgo ${r.label}, lo que evidencia que ${concern} presentan condiciones que pueden afectar el bienestar de los trabajadores y requieren medidas de intervención prioritarias.`;
  }
  if (r.tier === 'medio') {
    return `En conclusión, el dominio ${name} presenta un nivel de riesgo medio; aunque no se identifican afectaciones severas, ${concern} requieren atención y acciones preventivas para evitar su progresión hacia niveles de riesgo más altos.`;
  }
  return `En conclusión, el dominio ${name} presenta un nivel de riesgo bajo, lo que indica condiciones favorables en ${concern}. Se recomienda mantener las buenas prácticas que sostienen estos resultados.`;
}

function generateFormGeneralAnalysis(factor, overallCounts, formLabel) {
  const r = classifyGroupRisk(overallCounts);
  if (r.total === 0) return null;
  const factorName = factor === 'extralaboral' ? 'extralaboral' : 'intralaboral';
  const suffix = formLabel ? ` (${formLabel})` : '';
  if (factor === 'extralaboral') {
    if (r.tier === 'favorable') {
      return `El resultado global del factor de riesgo psicosocial ${factorName}${suffix} se ubica en un nivel sin riesgo. En general, las condiciones externas al trabajo —el tiempo personal, la dinámica familiar, la comunicación, la situación económica, la vivienda y los desplazamientos— no representan una carga significativa y favorecen el equilibrio entre la vida personal y laboral.`;
    }
    if (r.tier === 'medio') {
      return `El resultado global del factor de riesgo psicosocial ${factorName}${suffix} se ubica en un nivel de riesgo medio. Algunas condiciones del entorno extralaboral empiezan a generar carga sobre los trabajadores y ameritan seguimiento para evitar que afecten el equilibrio entre la vida personal y laboral.`;
    }
    return `El resultado global del factor de riesgo psicosocial ${factorName}${suffix} se ubica en un nivel de riesgo ${r.label}. Las condiciones del entorno extralaboral representan una carga relevante que puede repercutir en el bienestar y el desempeño, por lo que se requieren acciones de acompañamiento.`;
  }
  // intralaboral
  if (r.tier === 'riesgo') {
    return `El resultado global del factor de riesgo psicosocial intralaboral${suffix} se ubica en un nivel de riesgo ${r.label}. Las exigencias del cargo y las condiciones internas del trabajo requieren intervención prioritaria para proteger el bienestar y el desempeño de los trabajadores.`;
  }
  if (r.tier === 'medio') {
    return `El resultado global del factor de riesgo psicosocial intralaboral${suffix} se ubica en un nivel de riesgo medio. Aunque no se identifican situaciones críticas, existen condiciones que requieren fortalecimiento para evitar que las tensiones cotidianas evolucionen hacia niveles de riesgo mayores.`;
  }
  return `El resultado global del factor de riesgo psicosocial intralaboral${suffix} se ubica en un nivel de riesgo bajo, lo que refleja un entorno laboral favorable. Se recomienda mantener las condiciones que sostienen este resultado.`;
}

// Two paragraphs (result + general analysis) matching the stress section style.
function generateStressAnalysis(counts, formLabel) {
  const r = classifyGroupRisk(counts);
  if (r.total === 0) return [];
  const suffix = formLabel ? ` (${formLabel})` : '';
  if (r.tier === 'riesgo') {
    return [
      `El resultado obtenido${suffix} evidencia un nivel de riesgo ${r.label} en la sintomatología asociada al estrés, lo que indica la presencia de manifestaciones frecuentes o intensas posiblemente asociadas a las demandas del trabajo, la gestión del tiempo o la percepción de recursos insuficientes. El ${r.highPct}% del grupo se ubica en riesgo alto o muy alto. Esta intensidad puede afectar la concentración, la calidad del sueño, la regulación emocional y el desempeño.`,
      `Este nivel de riesgo indica la necesidad de implementar acciones prioritarias para reducir la sobrecarga emocional y prevenir el estrés crónico, fortaleciendo estrategias de regulación emocional, manejo del tiempo, pausas activas y, cuando corresponda, ajustes organizacionales.`
    ];
  }
  if (r.tier === 'medio') {
    return [
      `El resultado${suffix} ubica al grupo en un nivel de riesgo medio de estrés. Aunque no alcanza un nivel crítico, evidencia una carga emocional y mental persistente que puede manifestarse en cansancio frecuente, disminución de la concentración o sensación de sobrecarga. El ${r.highPct}% se ubica en riesgo alto o muy alto y el ${r.lowPct}% sin riesgo o en riesgo bajo.`,
      `Este nivel requiere una intervención preventiva —autocuidado, pausas activas y cargas laborales equilibradas— que permita evitar la progresión hacia niveles más altos de desgaste emocional.`
    ];
  }
  return [
    `El resultado${suffix} ubica al grupo en un nivel de riesgo bajo de estrés: el ${r.lowPct}% se encuentra sin riesgo o en riesgo bajo, lo que indica que las manifestaciones de estrés se mantienen en niveles manejables.`,
    `Se recomienda mantener las estrategias de autocuidado y los factores protectores que sostienen este resultado, con seguimiento periódico dentro del sistema de vigilancia epidemiológica.`
  ];
}

// ============================================================
// SOCIODEMOGRAPHIC ANALYSIS TEXT
// ============================================================
// Per-variable metadata used to build a broader, data-driven explanation under
// each sociodemographic chart: an intro lead-in and a professional sentence on
// why the variable matters when interpreting psychosocial risk.
const DEMOGRAPHIC_ANALYSIS_META = {
  gender: {
    intro: 'La composición por género de la población evaluada se distribuye de la siguiente manera:',
    context: 'La distribución por género es un dato relevante en la evaluación psicosocial, dado que las demandas del trabajo, la influencia del trabajo sobre el entorno extralaboral y las condiciones familiares pueden manifestarse de forma diferente entre hombres y mujeres, lo que orienta el diseño de acciones de intervención más equitativas.'
  },
  estadoCivil: {
    intro: 'Según el estado civil, la población evaluada se distribuye así:',
    context: 'El estado civil aporta contexto sobre las redes de apoyo y las responsabilidades familiares del trabajador, aspectos que se relacionan con dimensiones extralaborales como las relaciones familiares y la situación económica del grupo familiar.'
  },
  education: {
    intro: 'En cuanto al último nivel de escolaridad alcanzado, la distribución es la siguiente:',
    context: 'El nivel educativo se asocia con las oportunidades para el uso y desarrollo de habilidades, la claridad del rol y las demandas de carga mental del cargo, por lo que resulta útil para interpretar los resultados intralaborales y focalizar los programas de capacitación.'
  },
  estrato: {
    intro: 'De acuerdo con el estrato socioeconómico de residencia, la población se distribuye así:',
    context: 'El estrato socioeconómico ofrece una aproximación a las condiciones materiales de vida del trabajador y su familia, y se vincula con dimensiones extralaborales como la situación económica del grupo familiar y las características de la vivienda y de su entorno.'
  },
  ageRanges: {
    intro: 'La población evaluada se distribuye por rangos de edad de la siguiente forma:',
    context: 'La estructura etaria es relevante porque las expectativas laborales, la percepción del riesgo y las estrategias de afrontamiento suelen variar con la edad; una población predominantemente joven o de mayor edad puede requerir enfoques de intervención diferenciados.'
  },
  dependents: {
    intro: 'Respecto al número de personas que dependen económicamente del trabajador, la distribución es la siguiente:',
    context: 'El número de personas a cargo se relaciona con la carga y la responsabilidad económica del trabajador, factores que inciden en la situación económica del grupo familiar y en la influencia del entorno extralaboral sobre el trabajo.'
  },
  tipoCargo: {
    intro: 'Según el tipo de cargo desempeñado, la población se distribuye así:',
    context: 'El tipo de cargo determina el instrumento aplicado (Forma A para jefaturas y personal profesional, Forma B para auxiliares y operarios) y condiciona el nivel de exigencias, autonomía y responsabilidad, por lo que es un criterio central para interpretar el dominio de demandas del trabajo.'
  },
  tipoContrato: {
    intro: 'De acuerdo con el tipo de contrato, la población se distribuye de la siguiente manera:',
    context: 'La modalidad de contratación se asocia con la percepción de estabilidad laboral y con las recompensas derivadas de la pertenencia a la organización, dimensiones que influyen en la motivación y el compromiso del trabajador.',
    topN: 6
  },
  antiguedadEmpresa: {
    intro: 'En relación con la antigüedad en la empresa, la distribución es la siguiente:',
    context: 'La antigüedad aporta información sobre el nivel de adaptación y arraigo del trabajador; una baja antigüedad o alta rotación puede reflejarse en la claridad del rol y en la participación y manejo del cambio.'
  },
  horasTrabajo: {
    intro: 'Respecto a la jornada diaria de trabajo, la población se distribuye así:',
    context: 'La duración de la jornada se relaciona directamente con las demandas de la jornada de trabajo y con la influencia del trabajo sobre el entorno extralaboral, especialmente cuando se superan las jornadas legalmente establecidas.'
  },
  departamento: {
    intro: 'Por área o departamento de trabajo, la población se concentra principalmente en:',
    context: 'La distribución por área permite focalizar organizacionalmente las acciones de intervención, priorizando las dependencias con mayor número de trabajadores o con mayor exposición a los factores de riesgo.',
    topN: 6
  }
};

// Builds a multi-sentence explanation for a sociodemographic distribution:
// full breakdown (category, count, %) + dominant group + coverage note + the
// contextual relevance sentence. Returns null when there is no data.
function generateDemographicAnalysis(kind, distribution, populationTotal) {
  const meta = DEMOGRAPHIC_ANALYSIS_META[kind];
  if (!meta) return null;

  const entries = Object.entries(distribution || {})
    .filter(([, v]) => Number(v) > 0)
    .sort((a, b) => b[1] - a[1]);
  const answered = entries.reduce((sum, [, v]) => sum + Number(v), 0);
  if (answered === 0) return null;

  const topN = meta.topN || 99;
  const shown = entries.slice(0, topN);
  const parts = shown.map(([label, count]) => `${label} (${count}; ${(count / answered * 100).toFixed(1)}%)`);
  const remaining = entries.length - shown.length;
  let breakdown = parts.join(', ');
  if (remaining > 0) breakdown += `, entre otras ${remaining} categoría${remaining > 1 ? 's' : ''}`;

  const [topLabel, topCount] = entries[0];
  const topPct = (topCount / answered * 100).toFixed(1);
  const dominant = entries.length > 1
    ? `El grupo predominante corresponde a ${topLabel}, que concentra el ${topPct}% de los casos.`
    : `La totalidad de la población reportada corresponde a ${topLabel}.`;

  const coverageNote = (populationTotal && answered < populationTotal)
    ? ` Este dato fue reportado por ${answered} de los ${populationTotal} participantes evaluados.`
    : '';

  return `${meta.intro} ${breakdown}. ${dominant}${coverageNote} ${meta.context}`;
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
  INTERVENTION_PLAN,
  INTERVENTION_PLAN_ORDER,
  INTERVENTION_PLAN_TITLES,
  MARCO_LEGAL_ROWS,
  writeMarcoLegal,
  INTRALABORAL_DEFINITIONS,
  EXTRALABORAL_DEFINITIONS,
  DEMOGRAPHIC_COLORS,
  ORG_TEXT_FIELDS,
  ORG_TEXT_FIELD_MAP,
  buildDefaultOrgTexts,
  sanitizeOrgTexts,
  mergeOrgTexts,
  resolveReportCity,
  DEFAULT_REPORT_CITY,
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
  generateOverallRiskText,
  generateDemographicAnalysis,
  classifyGroupRisk,
  generateDimensionNarrative,
  generateDomainConclusion,
  generateFormGeneralAnalysis,
  generateStressAnalysis
};
