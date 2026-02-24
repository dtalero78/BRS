import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import FlowLayout from '../../../components/FlowLayout';
import ResultsDimensionCard from '../../../components/ResultsDimensionCard';
import RiskSummaryChart from '../../../components/RiskSummaryChart';
import ResultsInterpretation from '../../../components/ResultsInterpretation';
import { API_URL } from '../../../config/api';

interface Participant {
  firstName: string;
  lastName: string;
  formType: string;
  evaluationName: string;
}

interface Result {
  dimension: string;
  rawScore: number | null;
  transformedScore: number | null;
  percentile: number | null;
  riskLevel: string;
  calculatedAt: string;
}

interface ResultsData {
  participantId: string;
  participant: Participant;
  results: { [key: string]: Result[] };
  calculatedAt: string;
}

interface DomainGroup {
  name: string;
  dimensions: Result[];
  averageRisk: string;
  totalDimensions: number;
}

const getQuestionnaireLabel = (type: string) => {
  switch (type) {
    case 'intralaboral_a': return 'Intralaboral Forma A';
    case 'intralaboral_b': return 'Intralaboral Forma B';
    case 'extralaboral': return 'Extralaboral';
    case 'estres': return 'Estrés';
    case 'coping': return 'Brief COPE - Afrontamiento';
    default: return type;
  }
};

const COPING_CATEGORY_NAMES: { [key: string]: string } = {
  problem_focused_total: 'Afrontamiento centrado en el problema',
  emotion_focused_total: 'Afrontamiento centrado en la emoción',
  avoidant_total: 'Afrontamiento evitativo'
};

const getRiskLevelNumericValue = (riskLevel: string) => {
  switch (riskLevel) {
    case 'sin_riesgo': return 0;
    case 'riesgo_bajo': return 1;
    case 'riesgo_medio': return 2;
    case 'riesgo_alto': return 3;
    case 'riesgo_muy_alto': return 4;
    default: return 0;
  }
};

const getNumericRiskLabel = (value: number) => {
  if (value <= 0.5) return 'sin_riesgo';
  if (value <= 1.5) return 'riesgo_bajo';
  if (value <= 2.5) return 'riesgo_medio';  
  if (value <= 3.5) return 'riesgo_alto';
  return 'riesgo_muy_alto';
};

const calculateRiskSummary = (results: Result[]) => {
  const summary = {
    sin_riesgo: 0,
    riesgo_bajo: 0,
    riesgo_medio: 0,
    riesgo_alto: 0,
    riesgo_muy_alto: 0
  };

  results.forEach(result => {
    if (result.riskLevel in summary) {
      summary[result.riskLevel as keyof typeof summary]++;
    }
  });

  return summary;
};

const groupResultsByDomain = (results: { [key: string]: Result[] }): DomainGroup[] => {
  const domains: DomainGroup[] = [];
  
  Object.entries(results).forEach(([questionnaireType, questionnaireResults]) => {
    // Group by domains within questionnaire
    if (questionnaireType === 'intralaboral_a') {
      const demandas = questionnaireResults.filter(r => r.dimension.includes('demandas_') || r.dimension.includes('exigencias_') || r.dimension.includes('influencia_') || r.dimension.includes('consistencia_'));
      const control = questionnaireResults.filter(r => r.dimension.includes('control_') || r.dimension.includes('oportunidades_') || r.dimension.includes('participacion_') || r.dimension.includes('claridad_') || r.dimension.includes('capacitacion_'));
      const liderazgo = questionnaireResults.filter(r => r.dimension.includes('caracteristicas_liderazgo') || r.dimension.includes('relaciones_') || r.dimension.includes('retroalimentacion_'));
      const recompensas = questionnaireResults.filter(r => r.dimension.includes('reconocimiento_') || r.dimension.includes('recompensas_'));
      
      if (demandas.length > 0) {
        const avgRisk = demandas.reduce((sum, d) => sum + getRiskLevelNumericValue(d.riskLevel), 0) / demandas.length;
        domains.push({
          name: 'Demandas del Trabajo',
          dimensions: demandas,
          averageRisk: getNumericRiskLabel(avgRisk),
          totalDimensions: demandas.length
        });
      }
      
      if (control.length > 0) {
        const avgRisk = control.reduce((sum, d) => sum + getRiskLevelNumericValue(d.riskLevel), 0) / control.length;
        domains.push({
          name: 'Control sobre el Trabajo',
          dimensions: control,
          averageRisk: getNumericRiskLabel(avgRisk),
          totalDimensions: control.length
        });
      }
      
      if (liderazgo.length > 0) {
        const avgRisk = liderazgo.reduce((sum, d) => sum + getRiskLevelNumericValue(d.riskLevel), 0) / liderazgo.length;
        domains.push({
          name: 'Liderazgo y Relaciones Sociales',
          dimensions: liderazgo,
          averageRisk: getNumericRiskLabel(avgRisk),
          totalDimensions: liderazgo.length
        });
      }
      
      if (recompensas.length > 0) {
        const avgRisk = recompensas.reduce((sum, d) => sum + getRiskLevelNumericValue(d.riskLevel), 0) / recompensas.length;
        domains.push({
          name: 'Recompensas',
          dimensions: recompensas,
          averageRisk: getNumericRiskLabel(avgRisk),
          totalDimensions: recompensas.length
        });
      }
    } else if (questionnaireType === 'coping') {
      // Group coping into 3 macro categories
      const problemFocused = questionnaireResults.filter(r =>
        ['afrontamiento_activo', 'planificacion', 'apoyo_instrumental', 'reinterpretacion_positiva', 'problem_focused_total'].includes(r.dimension)
      );
      const emotionFocused = questionnaireResults.filter(r =>
        ['apoyo_emocional', 'desahogo', 'aceptacion', 'humor', 'religion', 'autoinculpacion', 'emotion_focused_total'].includes(r.dimension)
      );
      const avoidant = questionnaireResults.filter(r =>
        ['autodistraccion', 'negacion', 'desconexion_conductual', 'uso_sustancias', 'avoidant_total'].includes(r.dimension)
      );
      const total = questionnaireResults.filter(r => r.dimension === 'puntaje_total_coping');

      [
        { name: 'Coping: Centrado en Problema', dims: problemFocused },
        { name: 'Coping: Centrado en Emoción', dims: emotionFocused },
        { name: 'Coping: Evitativo', dims: avoidant },
        ...(total.length > 0 ? [{ name: 'Coping: Total', dims: total }] : [])
      ].forEach(({ name, dims }) => {
        if (dims.length > 0) {
          const avgRisk = dims.reduce((sum, d) => sum + getRiskLevelNumericValue(d.riskLevel), 0) / dims.length;
          domains.push({ name, dimensions: dims, averageRisk: getNumericRiskLabel(avgRisk), totalDimensions: dims.length });
        }
      });
    } else {
      // For other questionnaires, treat as single domain
      if (questionnaireResults.length > 0) {
        const avgRisk = questionnaireResults.reduce((sum, d) => sum + getRiskLevelNumericValue(d.riskLevel), 0) / questionnaireResults.length;
        domains.push({
          name: getQuestionnaireLabel(questionnaireType),
          dimensions: questionnaireResults,
          averageRisk: getNumericRiskLabel(avgRisk),
          totalDimensions: questionnaireResults.length
        });
      }
    }
  });
  
  return domains;
};

export default function ResultsDashboard() {
  const router = useRouter();
  const { participantId } = router.query;
  const [resultsData, setResultsData] = useState<ResultsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDomain, setSelectedDomain] = useState<string>('all');

  useEffect(() => {
    if (participantId) {
      fetchResults();
    }
  }, [participantId]);

  const fetchResults = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/results/participant/${participantId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Error al cargar los resultados');
      }

      const data = await response.json();
      setResultsData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <FlowLayout backHref="/evaluator/results-dashboard" backLabel="Volver" maxWidth="full"><div className="text-center py-8">Cargando resultados...</div></FlowLayout>;
  if (error) return <FlowLayout backHref="/evaluator/results-dashboard" backLabel="Volver" maxWidth="full"><div className="text-red-600 text-center py-8">{error}</div></FlowLayout>;
  if (!resultsData) return <FlowLayout backHref="/evaluator/results-dashboard" backLabel="Volver" maxWidth="full"><div className="text-center py-8">No se encontraron resultados</div></FlowLayout>;

  const allResults = Object.values(resultsData.results).flat();
  const riskSummary = calculateRiskSummary(allResults);
  const domainGroups = groupResultsByDomain(resultsData.results);
  const selectedResults = selectedDomain === 'all' ? allResults : 
    domainGroups.find(d => d.name === selectedDomain)?.dimensions || [];

  return (
    <FlowLayout backHref="/evaluator/results-dashboard" backLabel="Volver" maxWidth="full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="bg-white shadow-sm rounded-lg px-6 py-4 mb-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Dashboard de Resultados BRS</h1>
              <p className="text-gray-600 mt-1">Análisis detallado de factores de riesgo psicosocial</p>
            </div>
            <button
              onClick={() => router.back()}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Volver
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Participante:</span>
              <p className="font-semibold">{resultsData.participant.firstName} {resultsData.participant.lastName}</p>
            </div>
            <div>
              <span className="text-gray-500">Evaluación:</span>
              <p className="font-semibold">{resultsData.participant.evaluationName}</p>
            </div>
            <div>
              <span className="text-gray-500">Tipo de Forma:</span>
              <p className="font-semibold">{resultsData.participant.formType === 'forma_a' ? 'Forma A' : 'Forma B'}</p>
            </div>
            <div>
              <span className="text-gray-500">Calculado:</span>
              <p className="font-semibold">{new Date(resultsData.calculatedAt).toLocaleDateString('es-CO')}</p>
            </div>
          </div>
        </div>

        {/* Risk Summary Chart */}
        <div className="mb-6">
          <RiskSummaryChart 
            data={riskSummary}
            title="Resumen General de Riesgo"
          />
        </div>

        {/* Domain Navigation */}
        <div className="bg-white shadow-sm rounded-lg mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6 overflow-x-auto" aria-label="Dominios">
              <button
                onClick={() => setSelectedDomain('all')}
                className={`
                  py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap
                  ${selectedDomain === 'all'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                Todas las Dimensiones ({allResults.length})
              </button>
              {domainGroups.map((domain) => (
                <button
                  key={domain.name}
                  onClick={() => setSelectedDomain(domain.name)}
                  className={`
                    py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap
                    ${selectedDomain === domain.name
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  {domain.name} ({domain.totalDimensions})
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Results Grid */}
        {selectedResults.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {selectedResults.map((result, index) => (
              <ResultsDimensionCard
                key={`${result.dimension}-${index}`}
                dimension={result as any}
                showDetails={true}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white shadow-sm rounded-lg p-8 text-center text-gray-500">
            No se encontraron resultados para mostrar
          </div>
        )}

        {/* Analysis Summary */}
        {selectedDomain === 'all' && domainGroups.length > 0 && (
          <div className="mt-8 bg-white shadow-sm rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Análisis por Dominios</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {domainGroups.map((domain) => (
                <div key={domain.name} className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-2">{domain.name}</h3>
                  <div className="space-y-2">
                    <div>
                      <span className="text-sm text-gray-500">Dimensiones:</span>
                      <span className="ml-2 text-sm font-semibold">{domain.totalDimensions}</span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Riesgo promedio:</span>
                      <span className={`ml-2 px-2 py-0.5 rounded text-xs font-medium ${
                        domain.averageRisk === 'sin_riesgo' ? 'bg-green-100 text-green-800' :
                        domain.averageRisk === 'riesgo_bajo' ? 'bg-blue-100 text-blue-800' :
                        domain.averageRisk === 'riesgo_medio' ? 'bg-yellow-100 text-yellow-800' :
                        domain.averageRisk === 'riesgo_alto' ? 'bg-orange-100 text-orange-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {domain.averageRisk.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Professional Interpretation */}
        {domainGroups.length > 0 && (
          <div className="mt-8">
            <ResultsInterpretation
              domainGroups={domainGroups}
              participantName={`${resultsData.participant.firstName} ${resultsData.participant.lastName}`}
              allResults={allResults}
            />
          </div>
        )}

        {/* Export Actions */}
        <div className="mt-8 flex justify-end space-x-4">
          <button
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            onClick={() => window.print()}
          >
            Imprimir Dashboard
          </button>
          <button
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            onClick={() => {/* TODO: Implement PDF export */}}
          >
            Generar Reporte PDF
          </button>
        </div>
      </div>
    </FlowLayout>
  );
}