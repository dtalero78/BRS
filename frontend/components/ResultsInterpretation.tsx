import React from 'react';

interface Result {
  dimension: string;
  rawScore: number | null;
  transformedScore: number | null;
  percentile: number | null;
  riskLevel: string;
}

interface DomainGroup {
  name: string;
  dimensions: Result[];
  averageRisk: string;
  totalDimensions: number;
}

interface ResultsInterpretationProps {
  domainGroups: DomainGroup[];
  participantName: string;
  allResults: Result[];
}

const getRiskLevelLabel = (riskLevel: string) => {
  switch (riskLevel) {
    case 'sin_riesgo': return 'Sin Riesgo';
    case 'riesgo_bajo': return 'Riesgo Bajo';
    case 'riesgo_medio': return 'Riesgo Medio';
    case 'riesgo_alto': return 'Riesgo Alto';
    case 'riesgo_muy_alto': return 'Riesgo Muy Alto';
    case 'no_calculable': return 'No calculable';
    default: return riskLevel;
  }
};

const getRiskIcon = (riskLevel: string) => {
  switch (riskLevel) {
    case 'sin_riesgo': return '✅';
    case 'riesgo_bajo': return '🟡';
    case 'riesgo_medio': return '🟠';
    case 'riesgo_alto': return '🔴';
    case 'riesgo_muy_alto': return '🚨';
    case 'no_calculable': return '—';
    default: return '—';
  }
};

const generateDomainInterpretation = (domain: DomainGroup): string => {
  const riskLevel = domain.averageRisk;
  const domainName = domain.name;

  if (riskLevel === 'no_calculable') {
    return `El dominio ${domainName} no es calculable por falta de respuestas suficientes según el manual oficial.`;
  }

  switch (domainName) {
    case 'Demandas del Trabajo':
      switch (riskLevel) {
        case 'sin_riesgo':
          return 'Las demandas del trabajo se encuentran en niveles apropiados. El ambiente de trabajo permite un desempeño adecuado sin generar sobrecarga.';
        case 'riesgo_bajo':
          return 'Se identifican demandas laborales moderadas que requieren atención preventiva para evitar su escalamiento.';
        case 'riesgo_medio':
          return 'Las demandas del trabajo presentan niveles que pueden afectar el bienestar. Se requieren ajustes en la carga laboral.';
        case 'riesgo_alto':
          return 'Las demandas laborales están generando presión significativa. Se necesita intervención inmediata para reducir la sobrecarga.';
        case 'riesgo_muy_alto':
          return 'Las demandas del trabajo están en niveles críticos que comprometen seriamente el bienestar del trabajador. Se requiere intervención urgente.';
      }
      break;
      
    case 'Control sobre el Trabajo':
      switch (riskLevel) {
        case 'sin_riesgo':
          return 'El trabajador cuenta con autonomía y control adecuado sobre sus tareas, lo que favorece su bienestar laboral.';
        case 'riesgo_bajo':
          return 'El nivel de control sobre el trabajo es aceptable, pero se pueden fortalecer algunos aspectos de autonomía.';
        case 'riesgo_medio':
          return 'Se identifican limitaciones en el control sobre el trabajo que pueden generar estrés. Se requiere mayor participación en decisiones.';
        case 'riesgo_alto':
          return 'La falta de control sobre el trabajo está afectando significativamente el bienestar. Se necesita mayor autonomía y participación.';
        case 'riesgo_muy_alto':
          return 'El trabajador presenta muy poco control sobre sus tareas, generando altos niveles de estrés. Requiere intervención inmediata.';
      }
      break;
      
    case 'Liderazgo y Relaciones Sociales':
      switch (riskLevel) {
        case 'sin_riesgo':
          return 'Las relaciones laborales y el liderazgo son positivos, contribuyendo a un ambiente de trabajo saludable.';
        case 'riesgo_bajo':
          return 'Las relaciones sociales en el trabajo son generalmente buenas, con oportunidades menores de mejora.';
        case 'riesgo_medio':
          return 'Se identifican aspectos del liderazgo y relaciones sociales que requieren atención para mejorar el clima laboral.';
        case 'riesgo_alto':
          return 'Las relaciones sociales y el liderazgo presentan problemas significativos que afectan el bienestar laboral.';
        case 'riesgo_muy_alto':
          return 'Existen problemas graves en las relaciones laborales y liderazgo que requieren intervención inmediata y estructural.';
      }
      break;
      
    case 'Recompensas':
      switch (riskLevel) {
        case 'sin_riesgo':
          return 'El sistema de recompensas y reconocimiento es adecuado y satisface las expectativas del trabajador.';
        case 'riesgo_bajo':
          return 'Las recompensas laborales son aceptables, con oportunidades menores de mejora en el reconocimiento.';
        case 'riesgo_medio':
          return 'Se identifican deficiencias en el sistema de recompensas que pueden afectar la motivación laboral.';
        case 'riesgo_alto':
          return 'El sistema de recompensas presenta serias deficiencias que afectan significativamente la satisfacción laboral.';
        case 'riesgo_muy_alto':
          return 'Las recompensas laborales son inadecuadas, generando alta insatisfacción y riesgo de desvinculación.';
      }
      break;
      
    case 'Extralaboral':
      switch (riskLevel) {
        case 'sin_riesgo':
          return 'Los factores extralaborales favorecen el bienestar y no interfieren con el desempeño laboral.';
        case 'riesgo_bajo':
          return 'Los aspectos extralaborales son generalmente favorables, con aspectos menores que pueden optimizarse.';
        case 'riesgo_medio':
          return 'Se identifican factores extralaborales que pueden estar interfiriendo con el bienestar laboral.';
        case 'riesgo_alto':
          return 'Los factores extralaborales están afectando significativamente el desempeño y bienestar en el trabajo.';
        case 'riesgo_muy_alto':
          return 'Los aspectos extralaborales presentan serios problemas que comprometen el bienestar integral del trabajador.';
      }
      break;
      
    case 'Estrés':
      switch (riskLevel) {
        case 'sin_riesgo':
          return 'Los síntomas de estrés están en niveles normales y no comprometen el bienestar del trabajador.';
        case 'riesgo_bajo':
          return 'Se presentan síntomas leves de estrés que requieren monitoreo y medidas preventivas básicas.';
        case 'riesgo_medio':
          return 'Los síntomas de estrés son moderados y requieren atención profesional y medidas de manejo.';
        case 'riesgo_alto':
          return 'Se presentan síntomas importantes de estrés que requieren intervención profesional inmediata.';
        case 'riesgo_muy_alto':
          return 'Los síntomas de estrés son severos y representan un riesgo significativo para la salud mental del trabajador.';
      }
      break;
  }
  
  return `El dominio ${domainName} presenta un nivel de ${getRiskLevelLabel(riskLevel).toLowerCase()}.`;
};

const generateOverallRecommendations = (domainGroups: DomainGroup[]): string[] => {
  const recommendations: string[] = [];
  const highRiskDomains = domainGroups.filter(d => 
    d.averageRisk === 'riesgo_alto' || d.averageRisk === 'riesgo_muy_alto'
  );
  const mediumRiskDomains = domainGroups.filter(d => d.averageRisk === 'riesgo_medio');
  
  if (highRiskDomains.length > 0) {
    recommendations.push('Se requiere intervención inmediata en los dominios de alto riesgo identificados.');
    recommendations.push('Establecer un plan de seguimiento mensual para evaluar la efectividad de las intervenciones.');
    recommendations.push('Considerar derivación a profesionales de salud ocupacional o psicología organizacional.');
  }
  
  if (mediumRiskDomains.length > 0) {
    recommendations.push('Implementar medidas preventivas en los dominios de riesgo medio para evitar su escalamiento.');
    recommendations.push('Capacitar a supervisores y trabajadores en técnicas de manejo de estrés laboral.');
  }
  
  if (highRiskDomains.length === 0 && mediumRiskDomains.length === 0) {
    recommendations.push('Mantener las condiciones laborales actuales que favorecen el bienestar del trabajador.');
    recommendations.push('Realizar seguimiento periódico para preservar los niveles de riesgo bajos.');
    recommendations.push('Considerar al trabajador como modelo para buenas prácticas en bienestar laboral.');
  }
  
  recommendations.push('Programar re-evaluación en 6 meses para monitorear la evolución de los factores de riesgo.');
  
  return recommendations;
};

export default function ResultsInterpretation({ domainGroups, participantName, allResults }: ResultsInterpretationProps) {
  const overallRecommendations = generateOverallRecommendations(domainGroups);
  const priorityDomains = domainGroups
    .filter(d => d.averageRisk === 'riesgo_alto' || d.averageRisk === 'riesgo_muy_alto')
    .sort((a, b) => {
      const riskOrder = { 'riesgo_muy_alto': 4, 'riesgo_alto': 3, 'riesgo_medio': 2, 'riesgo_bajo': 1, 'sin_riesgo': 0, 'no_calculable': -1 };
      return riskOrder[b.averageRisk as keyof typeof riskOrder] - riskOrder[a.averageRisk as keyof typeof riskOrder];
    });

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Interpretación de Resultados BRS
        </h2>
        <p className="text-gray-600">
          Análisis profesional basado en la metodología oficial del Ministerio de la Protección Social de Colombia
        </p>
      </div>

      {/* Priority Alerts */}
      {priorityDomains.length > 0 && (
        <div className="mb-6 p-4 border border-red-200 rounded-lg bg-red-50">
          <div className="flex items-center mb-3">
            <span className="text-2xl mr-2">🚨</span>
            <h3 className="text-lg font-semibold text-red-900">Áreas de Atención Prioritaria</h3>
          </div>
          <div className="space-y-2">
            {priorityDomains.map((domain) => (
              <div key={domain.name} className="flex items-center text-red-800">
                <span className="mr-2">{getRiskIcon(domain.averageRisk)}</span>
                <span className="font-medium">{domain.name}</span>
                <span className="ml-2 text-sm">({getRiskLevelLabel(domain.averageRisk)})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Domain Interpretations */}
      <div className="space-y-6 mb-8">
        <h3 className="text-lg font-semibold text-gray-900">Análisis por Dominios</h3>
        {domainGroups.map((domain) => (
          <div key={domain.name} className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center">
                <span className="text-xl mr-2">{getRiskIcon(domain.averageRisk)}</span>
                <h4 className="font-semibold text-gray-900">{domain.name}</h4>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                domain.averageRisk === 'sin_riesgo' ? 'bg-green-100 text-green-800' :
                domain.averageRisk === 'riesgo_bajo' ? 'bg-blue-100 text-blue-800' :
                domain.averageRisk === 'riesgo_medio' ? 'bg-yellow-100 text-yellow-800' :
                domain.averageRisk === 'riesgo_alto' ? 'bg-orange-100 text-orange-800' :
                domain.averageRisk === 'riesgo_muy_alto' ? 'bg-red-100 text-red-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {getRiskLevelLabel(domain.averageRisk)}
              </span>
            </div>
            <p className="text-gray-700 text-sm leading-relaxed">
              {generateDomainInterpretation(domain)}
            </p>
            <div className="mt-2 text-xs text-gray-500">
              Evaluado en {domain.totalDimensions} dimensiones
            </div>
          </div>
        ))}
      </div>

      {/* Overall Recommendations */}
      <div className="border-t border-gray-200 pt-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recomendaciones Profesionales</h3>
        <div className="space-y-3">
          {overallRecommendations.map((recommendation, index) => (
            <div key={index} className="flex items-start">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full text-xs font-bold flex items-center justify-center mr-3 mt-0.5">
                {index + 1}
              </span>
              <p className="text-gray-700 text-sm leading-relaxed">{recommendation}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Methodology Note */}
      <div className="mt-8 p-4 bg-gray-50 rounded-lg">
        <h4 className="font-medium text-gray-900 mb-2">Nota Metodológica</h4>
        <p className="text-xs text-gray-600 leading-relaxed">
          Esta interpretación se basa en la Batería de Instrumentos para la Evaluación de Factores de Riesgo Psicosocial 
          del Ministerio de la Protección Social de Colombia (Resolución 2646 de 2008). Los resultados deben ser 
          interpretados por profesionales calificados en salud ocupacional y requieren análisis contextual específico 
          de cada organización y puesto de trabajo.
        </p>
      </div>
    </div>
  );
}