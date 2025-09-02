// BAREMOS OFICIALES COMPLETOS DE LA BATERÍA DE RIESGO PSICOSOCIAL
// Extraídos del documento oficial del Ministerio de la Protección Social

const BAREMOS_BRS = {
  
  // FORMA A - BAREMOS POR DIMENSIONES (Tabla 29)
  intralaboral_forma_a: {
    dimensiones: {
      'caracteristicas_liderazgo': {
        sin_riesgo: [0.0, 3.8],
        riesgo_bajo: [3.9, 15.4],
        riesgo_medio: [15.5, 30.8],
        riesgo_alto: [30.9, 46.2],
        riesgo_muy_alto: [46.3, 100]
      },
      'relaciones_sociales_trabajo': {
        sin_riesgo: [0.0, 5.4],
        riesgo_bajo: [5.5, 16.1],
        riesgo_medio: [16.2, 25.0],
        riesgo_alto: [25.1, 37.5],
        riesgo_muy_alto: [37.6, 100]
      },
      'retroalimentacion_desempeño': {
        sin_riesgo: [0.0, 10.0],
        riesgo_bajo: [10.1, 25.0],
        riesgo_medio: [25.1, 40.0],
        riesgo_alto: [40.1, 55.0],
        riesgo_muy_alto: [55.1, 100]
      },
      'relacion_colaboradores': {
        sin_riesgo: [0.0, 13.9],
        riesgo_bajo: [14.0, 25.0],
        riesgo_medio: [25.1, 33.3],
        riesgo_alto: [33.4, 47.2],
        riesgo_muy_alto: [47.3, 100]
      },
      'claridad_rol': {
        sin_riesgo: [0.0, 0.9],
        riesgo_bajo: [1.0, 10.7],
        riesgo_medio: [10.8, 21.4],
        riesgo_alto: [21.5, 39.3],
        riesgo_muy_alto: [39.4, 100]
      },
      'capacitacion': {
        sin_riesgo: [0.0, 0.9],
        riesgo_bajo: [1.0, 16.7],
        riesgo_medio: [16.8, 33.3],
        riesgo_alto: [33.4, 50.0],
        riesgo_muy_alto: [50.1, 100]
      },
      'participacion_manejo_cambio': {
        sin_riesgo: [0.0, 12.5],
        riesgo_bajo: [12.6, 25.0],
        riesgo_medio: [25.1, 37.5],
        riesgo_alto: [37.6, 50.0],
        riesgo_muy_alto: [50.1, 100]
      },
      'oportunidades_desarrollo': {
        sin_riesgo: [0.0, 0.9],
        riesgo_bajo: [1.0, 6.3],
        riesgo_medio: [6.4, 18.8],
        riesgo_alto: [18.9, 31.3],
        riesgo_muy_alto: [31.4, 100]
      },
      'control_autonomia': {
        sin_riesgo: [0.0, 8.3],
        riesgo_bajo: [8.4, 25.0],
        riesgo_medio: [25.1, 41.7],
        riesgo_alto: [41.8, 58.3],
        riesgo_muy_alto: [58.4, 100]
      },
      'demandas_ambientales': {
        sin_riesgo: [0.0, 14.6],
        riesgo_bajo: [14.7, 22.9],
        riesgo_medio: [23.0, 31.3],
        riesgo_alto: [31.4, 39.6],
        riesgo_muy_alto: [39.7, 100]
      },
      'demandas_emocionales': {
        sin_riesgo: [0.0, 16.7],
        riesgo_bajo: [16.8, 25.0],
        riesgo_medio: [25.1, 33.3],
        riesgo_alto: [33.4, 47.2],
        riesgo_muy_alto: [47.3, 100]
      },
      'demandas_cuantitativas': {
        sin_riesgo: [0.0, 25.0],
        riesgo_bajo: [25.1, 33.3],
        riesgo_medio: [33.4, 45.8],
        riesgo_alto: [45.9, 54.2],
        riesgo_muy_alto: [54.3, 100]
      },
      'influencia_trabajo_entorno': {
        sin_riesgo: [0.0, 18.8],
        riesgo_bajo: [18.9, 31.3],
        riesgo_medio: [31.4, 43.8],
        riesgo_alto: [43.9, 50.0],
        riesgo_muy_alto: [50.1, 100]
      },
      'exigencias_responsabilidad': {
        sin_riesgo: [0.0, 37.5],
        riesgo_bajo: [37.6, 54.2],
        riesgo_medio: [54.3, 66.7],
        riesgo_alto: [66.8, 79.2],
        riesgo_muy_alto: [79.3, 100]
      },
      'demandas_carga_mental': {
        sin_riesgo: [0.0, 60.0],
        riesgo_bajo: [60.1, 70.0],
        riesgo_medio: [70.1, 80.0],
        riesgo_alto: [80.1, 90.0],
        riesgo_muy_alto: [90.1, 100]
      },
      'consistencia_rol': {
        sin_riesgo: [0.0, 15.0],
        riesgo_bajo: [15.1, 25.0],
        riesgo_medio: [25.1, 35.0],
        riesgo_alto: [35.1, 45.0],
        riesgo_muy_alto: [45.1, 100]
      },
      'demandas_jornada': {
        sin_riesgo: [0.0, 8.3],
        riesgo_bajo: [8.4, 25.0],
        riesgo_medio: [25.1, 33.3],
        riesgo_alto: [33.4, 50.0],
        riesgo_muy_alto: [50.1, 100]
      },
      'recompensas_pertenencia': {
        sin_riesgo: [0.0, 0.9],
        riesgo_bajo: [1.0, 5.0],
        riesgo_medio: [5.1, 10.0],
        riesgo_alto: [10.1, 20.0],
        riesgo_muy_alto: [20.1, 100]
      },
      'reconocimiento_compensacion': {
        sin_riesgo: [0.0, 4.2],
        riesgo_bajo: [4.3, 16.7],
        riesgo_medio: [16.8, 25.0],
        riesgo_alto: [25.1, 37.5],
        riesgo_muy_alto: [37.6, 100]
      }
    },
    
    // DOMINIOS FORMA A (Tabla 31)
    dominios: {
      'liderazgo_relaciones_sociales': {
        sin_riesgo: [0.0, 8.3],
        riesgo_bajo: [8.4, 17.5],
        riesgo_medio: [17.6, 26.7],
        riesgo_alto: [26.8, 38.3],
        riesgo_muy_alto: [38.4, 100]
      },
      'control_trabajo': {
        sin_riesgo: [0.0, 19.4],
        riesgo_bajo: [19.5, 26.4],
        riesgo_medio: [26.5, 34.7],
        riesgo_alto: [34.8, 43.1],
        riesgo_muy_alto: [43.2, 100]
      },
      'demandas_trabajo': {
        sin_riesgo: [0.0, 26.9],
        riesgo_bajo: [27.0, 33.3],
        riesgo_medio: [33.4, 37.8],
        riesgo_alto: [37.9, 44.2],
        riesgo_muy_alto: [44.3, 100]
      },
      'recompensas': {
        sin_riesgo: [0.0, 2.5],
        riesgo_bajo: [2.6, 10.0],
        riesgo_medio: [10.1, 17.5],
        riesgo_alto: [17.6, 27.5],
        riesgo_muy_alto: [27.6, 100]
      }
    },
    
    // PUNTAJE TOTAL FORMA A (Tabla 33)
    puntaje_total: {
      sin_riesgo: [0.0, 19.7],
      riesgo_bajo: [19.8, 25.8],
      riesgo_medio: [25.9, 31.5],
      riesgo_alto: [31.6, 38.0],
      riesgo_muy_alto: [38.1, 100]
    }
  },

  // FORMA B - BAREMOS POR DIMENSIONES (Tabla 30)
  intralaboral_forma_b: {
    dimensiones: {
      'caracteristicas_liderazgo': {
        sin_riesgo: [0.0, 3.8],
        riesgo_bajo: [3.9, 13.5],
        riesgo_medio: [13.6, 25.0],
        riesgo_alto: [25.1, 38.5],
        riesgo_muy_alto: [38.6, 100]
      },
      'relaciones_sociales_trabajo': {
        sin_riesgo: [0.0, 6.3],
        riesgo_bajo: [6.4, 14.6],
        riesgo_medio: [14.7, 27.1],
        riesgo_alto: [27.2, 37.5],
        riesgo_muy_alto: [37.6, 100]
      },
      'retroalimentacion_desempeño': {
        sin_riesgo: [0.0, 5.0],
        riesgo_bajo: [5.1, 20.0],
        riesgo_medio: [20.1, 30.0],
        riesgo_alto: [30.1, 50.0],
        riesgo_muy_alto: [50.1, 100]
      },
      'claridad_rol': {
        sin_riesgo: [0.0, 0.9],
        riesgo_bajo: [1.0, 5.0],
        riesgo_medio: [5.1, 15.0],
        riesgo_alto: [15.1, 30.0],
        riesgo_muy_alto: [30.1, 100]
      },
      'capacitacion': {
        sin_riesgo: [0.0, 0.9],
        riesgo_bajo: [1.0, 16.7],
        riesgo_medio: [16.8, 25.0],
        riesgo_alto: [25.1, 50.0],
        riesgo_muy_alto: [50.1, 100]
      },
      'participacion_manejo_cambio': {
        sin_riesgo: [0.0, 16.7],
        riesgo_bajo: [16.8, 33.3],
        riesgo_medio: [33.4, 41.7],
        riesgo_alto: [41.8, 58.3],
        riesgo_muy_alto: [58.4, 100]
      },
      'oportunidades_desarrollo': {
        sin_riesgo: [0.0, 12.5],
        riesgo_bajo: [12.6, 25.0],
        riesgo_medio: [25.1, 37.5],
        riesgo_alto: [37.6, 56.3],
        riesgo_muy_alto: [56.4, 100]
      },
      'control_autonomia': {
        sin_riesgo: [0.0, 33.3],
        riesgo_bajo: [33.4, 50.0],
        riesgo_medio: [50.1, 66.7],
        riesgo_alto: [66.8, 75.0],
        riesgo_muy_alto: [75.1, 100]
      },
      'demandas_ambientales': {
        sin_riesgo: [0.0, 22.9],
        riesgo_bajo: [23.0, 31.3],
        riesgo_medio: [31.4, 39.6],
        riesgo_alto: [39.7, 47.9],
        riesgo_muy_alto: [48.0, 100]
      },
      'demandas_emocionales': {
        sin_riesgo: [0.0, 19.4],
        riesgo_bajo: [19.5, 27.8],
        riesgo_medio: [27.9, 38.9],
        riesgo_alto: [39.0, 47.2],
        riesgo_muy_alto: [47.3, 100]
      },
      'demandas_cuantitativas': {
        sin_riesgo: [0.0, 16.7],
        riesgo_bajo: [16.8, 33.3],
        riesgo_medio: [33.4, 41.7],
        riesgo_alto: [41.8, 50.0],
        riesgo_muy_alto: [50.1, 100]
      },
      'influencia_trabajo_entorno': {
        sin_riesgo: [0.0, 12.5],
        riesgo_bajo: [12.6, 25.0],
        riesgo_medio: [25.1, 31.3],
        riesgo_alto: [31.4, 50.0],
        riesgo_muy_alto: [50.1, 100]
      },
      'demandas_carga_mental': {
        sin_riesgo: [0.0, 50.0],
        riesgo_bajo: [50.1, 65.0],
        riesgo_medio: [65.1, 75.0],
        riesgo_alto: [75.1, 85.0],
        riesgo_muy_alto: [85.1, 100]
      },
      'demandas_jornada': {
        sin_riesgo: [0.0, 25.0],
        riesgo_bajo: [25.1, 37.5],
        riesgo_medio: [37.6, 45.8],
        riesgo_alto: [45.9, 58.3],
        riesgo_muy_alto: [58.4, 100]
      },
      'recompensas_pertenencia': {
        sin_riesgo: [0.0, 0.9],
        riesgo_bajo: [1.0, 6.3],
        riesgo_medio: [6.4, 12.5],
        riesgo_alto: [12.6, 18.8],
        riesgo_muy_alto: [18.9, 100]
      },
      'reconocimiento_compensacion': {
        sin_riesgo: [0.0, 0.9],
        riesgo_bajo: [1.0, 12.5],
        riesgo_medio: [12.6, 25.0],
        riesgo_alto: [25.1, 37.5],
        riesgo_muy_alto: [37.6, 100]
      }
    },
    
    // DOMINIOS FORMA B (Tabla 32)
    dominios: {
      'liderazgo_relaciones_sociales': {
        sin_riesgo: [0.0, 9.1],
        riesgo_bajo: [9.2, 17.7],
        riesgo_medio: [17.8, 25.6],
        riesgo_alto: [25.7, 34.8],
        riesgo_muy_alto: [34.9, 100]
      },
      'control_trabajo': {
        sin_riesgo: [0.0, 10.7],
        riesgo_bajo: [10.8, 19.0],
        riesgo_medio: [19.1, 29.8],
        riesgo_alto: [29.9, 40.5],
        riesgo_muy_alto: [40.6, 100]
      },
      'demandas_trabajo': {
        sin_riesgo: [0.0, 28.5],
        riesgo_bajo: [28.6, 35.0],
        riesgo_medio: [35.1, 41.5],
        riesgo_alto: [41.6, 47.5],
        riesgo_muy_alto: [47.6, 100]
      },
      'recompensas': {
        sin_riesgo: [0.0, 4.5],
        riesgo_bajo: [4.6, 11.4],
        riesgo_medio: [11.5, 20.5],
        riesgo_alto: [20.6, 29.5],
        riesgo_muy_alto: [29.6, 100]
      }
    },
    
    // PUNTAJE TOTAL FORMA B (Tabla 33)
    puntaje_total: {
      sin_riesgo: [0.0, 20.6],
      riesgo_bajo: [20.7, 26.0],
      riesgo_medio: [26.1, 31.2],
      riesgo_alto: [31.3, 38.7],
      riesgo_muy_alto: [38.8, 100]
    }
  },

  // PUNTAJE TOTAL GENERAL (INTRALABORAL + EXTRALABORAL) - Tabla 34
  puntaje_total_general: {
    forma_a_extralaboral: {
      sin_riesgo: [0.0, 18.8],
      riesgo_bajo: [18.9, 24.4],
      riesgo_medio: [24.5, 29.5],
      riesgo_alto: [29.6, 35.4],
      riesgo_muy_alto: [35.5, 100]
    },
    forma_b_extralaboral: {
      sin_riesgo: [0.0, 19.9],
      riesgo_bajo: [20.0, 24.8],
      riesgo_medio: [24.9, 29.5],
      riesgo_alto: [29.6, 35.4],
      riesgo_muy_alto: [35.5, 100]
    }
  },

  // BAREMOS EXTRALABORALES (valores estimados - pendiente de confirmación en documento)
  extralaboral: {
    dimensiones: {
      'tiempo_fuera_trabajo': {
        sin_riesgo: [0.0, 6.3],
        riesgo_bajo: [6.4, 25.0],
        riesgo_medio: [25.1, 37.5],
        riesgo_alto: [37.6, 50.0],
        riesgo_muy_alto: [50.1, 100]
      },
      'relaciones_familiares': {
        sin_riesgo: [0.0, 8.3],
        riesgo_bajo: [8.4, 25.0],
        riesgo_medio: [25.1, 33.3],
        riesgo_alto: [33.4, 50.0],
        riesgo_muy_alto: [50.1, 100]
      },
      'comunicacion_relaciones_interpersonales': {
        sin_riesgo: [0.0, 5.6],
        riesgo_bajo: [5.7, 16.7],
        riesgo_medio: [16.8, 25.0],
        riesgo_alto: [25.1, 41.7],
        riesgo_muy_alto: [41.8, 100]
      },
      'situacion_economica': {
        sin_riesgo: [0.0, 8.3],
        riesgo_bajo: [8.4, 25.0],
        riesgo_medio: [25.1, 41.7],
        riesgo_alto: [41.8, 58.3],
        riesgo_muy_alto: [58.4, 100]
      },
      'caracteristicas_vivienda': {
        sin_riesgo: [0.0, 5.0],
        riesgo_bajo: [5.1, 10.0],
        riesgo_medio: [10.1, 25.0],
        riesgo_alto: [25.1, 35.0],
        riesgo_muy_alto: [35.1, 100]
      },
      'influencia_entorno_trabajo': {
        sin_riesgo: [0.0, 12.5],
        riesgo_bajo: [12.6, 25.0],
        riesgo_medio: [25.1, 37.5],
        riesgo_alto: [37.6, 50.0],
        riesgo_muy_alto: [50.1, 100]
      },
      'desplazamiento_vivienda_trabajo': {
        sin_riesgo: [0.0, 0.9],
        riesgo_bajo: [1.0, 12.5],
        riesgo_medio: [12.6, 25.0],
        riesgo_alto: [25.1, 43.8],
        riesgo_muy_alto: [43.9, 100]
      }
    }
  },

  // BAREMOS DE ESTRÉS (valores estimados - pendiente de confirmación en documento)
  estres: {
    sintomas_fisiologicos: {
      sin_riesgo: [0.0, 25.0],
      riesgo_bajo: [25.1, 37.5],
      riesgo_medio: [37.6, 50.0],
      riesgo_alto: [50.1, 62.5],
      riesgo_muy_alto: [62.6, 100]
    },
    sintomas_comportamiento_social: {
      sin_riesgo: [0.0, 16.7],
      riesgo_bajo: [16.8, 25.0],
      riesgo_medio: [25.1, 41.7],
      riesgo_alto: [41.8, 58.3],
      riesgo_muy_alto: [58.4, 100]
    },
    sintomas_intelectuales_laborales: {
      sin_riesgo: [0.0, 33.3],
      riesgo_bajo: [33.4, 41.7],
      riesgo_medio: [41.8, 58.3],
      riesgo_alto: [58.4, 75.0],
      riesgo_muy_alto: [75.1, 100]
    },
    sintomas_psicoemocionales: {
      sin_riesgo: [0.0, 25.0],
      riesgo_bajo: [25.1, 35.0],
      riesgo_medio: [35.1, 45.0],
      riesgo_alto: [45.1, 60.0],
      riesgo_muy_alto: [60.1, 100]
    }
  }
};

// Función para obtener el nivel de riesgo basado en el puntaje
function getRiskLevel(score, baremos) {
  const levels = ['sin_riesgo', 'riesgo_bajo', 'riesgo_medio', 'riesgo_alto', 'riesgo_muy_alto'];
  
  for (const level of levels) {
    const range = baremos[level];
    if (score >= range[0] && score <= range[1]) {
      return level;
    }
  }
  
  // Fallback: si no encaja en ningún rango
  if (score < baremos.sin_riesgo[0]) return 'sin_riesgo';
  if (score > baremos.riesgo_muy_alto[1]) return 'riesgo_muy_alto';
  
  return 'riesgo_medio'; // Default
}

// Función para obtener baremos según forma y tipo
function getBaremos(forma, tipo, dimension) {
  const formaKey = `intralaboral_forma_${forma.toLowerCase()}`;
  
  if (!BAREMOS_BRS[formaKey]) {
    throw new Error(`Forma ${forma} no encontrada`);
  }
  
  if (tipo === 'dimension') {
    if (!BAREMOS_BRS[formaKey].dimensiones[dimension]) {
      throw new Error(`Dimensión ${dimension} no encontrada para forma ${forma}`);
    }
    return BAREMOS_BRS[formaKey].dimensiones[dimension];
  }
  
  if (tipo === 'dominio') {
    if (!BAREMOS_BRS[formaKey].dominios[dimension]) {
      throw new Error(`Dominio ${dimension} no encontrado para forma ${forma}`);
    }
    return BAREMOS_BRS[formaKey].dominios[dimension];
  }
  
  if (tipo === 'total') {
    return BAREMOS_BRS[formaKey].puntaje_total;
  }
  
  throw new Error(`Tipo ${tipo} no reconocido`);
}

module.exports = {
  BAREMOS_BRS,
  getRiskLevel,
  getBaremos
};