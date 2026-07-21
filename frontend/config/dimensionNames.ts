// Fuente única de verdad para los nombres "bonitos" de dimensiones/dominios.
// DEBE mantenerse alineado con backend/utils/report-templates.js (DIMENSION_DISPLAY_NAMES),
// que es el que usa el PDF legal. Antes cada página del frontend tenía su propio
// mapa y ya habían divergido (el PDF y el dashboard llamaban distinto a la misma
// dimensión). Todas las vistas de resultados deben importar de aquí.
export const DIMENSION_NAMES: Record<string, string> = {
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
  // Totales
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
  puntaje_total_coping: 'Puntaje Total Coping',
};

// Devuelve el nombre legible de una dimensión, con un fallback humanizado
// (reemplaza guiones bajos y capitaliza) si la clave no está en el mapa.
export function dimensionName(key: string): string {
  if (DIMENSION_NAMES[key]) return DIMENSION_NAMES[key];
  return String(key).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
