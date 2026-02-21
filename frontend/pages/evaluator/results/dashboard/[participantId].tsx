import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import FlowLayout from '../../../../components/FlowLayout';
import ResultsDimensionCard from '../../../../components/ResultsDimensionCard';
import ResultsDomainsChart from '../../../../components/ResultsDomainsChart';
import RiskSummaryChart from '../../../../components/RiskSummaryChart';
import { API_URL } from '../../../../config/api';

interface Participant {
  firstName: string;
  lastName: string;
  formType: string;
  evaluationName: string;
  department?: string;
  position?: string;
}

interface Result {
  dimension: string;
  rawScore: number;
  transformedScore: number;
  percentile: number;
  riskLevel: string;
  calculatedAt: string;
}

interface DomainResult {
  domain: string;
  averageScore: number;
  riskLevel: string;
  dimensionCount: number;
}

interface ResultsData {
  participantId: string;
  participant: Participant;
  results: { [key: string]: Result[] };
  calculatedAt: string;
}

const getQuestionnaireLabel = (type: string) => {
  const labels: { [key: string]: string } = {
    'intralaboral_a': 'Forma A - Intralaboral',
    'intralaboral_b': 'Forma B - Intralaboral',
    'extralaboral': 'Factores Extralaborales',
    'estres': 'Niveles de Estrés'
  };
  return labels[type] || type;
};

const calculateDomains = (results: Result[], questionnaireType: string): DomainResult[] => {
  // Domain mappings based on BRS official methodology
  const domainMappings: { [key: string]: { [key: string]: string[] } } = {
    intralaboral_a: {
      'liderazgo_relaciones_sociales': [
        'caracteristicas_liderazgo',
        'relaciones_sociales_trabajo',
        'retroalimentacion_desempeño',
        'relacion_colaboradores'
      ],
      'control_trabajo': [
        'control_autonomia',
        'oportunidades_desarrollo',
        'participacion_manejo_cambio',
        'claridad_rol',
        'capacitacion'
      ],
      'demandas_trabajo': [
        'demandas_ambientales',
        'demandas_cuantitativas',
        'demandas_carga_mental',
        'demandas_emocionales',
        'exigencias_responsabilidad',
        'demandas_jornada',
        'consistencia_rol',
        'influencia_trabajo_entorno'
      ],
      'recompensas': [
        'reconocimiento_compensacion',
        'recompensas_pertenencia'
      ]
    },
    intralaboral_b: {
      'liderazgo_relaciones_sociales': [
        'caracteristicas_liderazgo',
        'relaciones_sociales_trabajo',
        'retroalimentacion_desempeño'
      ],
      'control_trabajo': [
        'control_autonomia',
        'oportunidades_desarrollo',
        'participacion_manejo_cambio',
        'claridad_rol',
        'capacitacion'
      ],
      'demandas_trabajo': [
        'demandas_ambientales',
        'demandas_cuantitativas',
        'demandas_carga_mental',
        'demandas_emocionales',
        'demandas_jornada',
        'influencia_trabajo_entorno'
      ],
      'recompensas': [
        'reconocimiento_compensacion',
        'recompensas_pertenencia'
      ]
    }
  };

  const domains: DomainResult[] = [];
  const mappings = domainMappings[questionnaireType];
  
  if (!mappings) return [];

  Object.entries(mappings).forEach(([domainName, dimensions]) => {
    const domainResults = results.filter(r => dimensions.includes(r.dimension));
    
    if (domainResults.length > 0) {
      const averageScore = domainResults.reduce((sum, r) => sum + r.transformedScore, 0) / domainResults.length;
      
      // Classify domain risk level
      let riskLevel = 'sin_riesgo';
      if (averageScore > 80) riskLevel = 'riesgo_muy_alto';
      else if (averageScore > 60) riskLevel = 'riesgo_alto';
      else if (averageScore > 40) riskLevel = 'riesgo_medio';
      else if (averageScore > 20) riskLevel = 'riesgo_bajo';
      
      domains.push({
        domain: domainName,
        averageScore,
        riskLevel,
        dimensionCount: domainResults.length
      });
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
  const [selectedQuestionnaire, setSelectedQuestionnaire] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

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
      
      if (data.results && Object.keys(data.results).length > 0) {
        setSelectedQuestionnaire(Object.keys(data.results)[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
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

  const exportToPDF = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/reports/participant/${participantId}/pdf`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Error al generar el reporte');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reporte-brs-${participantId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Error al exportar el reporte: ' + (err instanceof Error ? err.message : 'Error desconocido'));
    }
  };

  if (loading) return <FlowLayout backHref="/evaluator/results" backLabel="Volver" maxWidth="full"><div className="text-center py-8">Cargando resultados...</div></FlowLayout>;
  if (error) return <FlowLayout backHref="/evaluator/results" backLabel="Volver" maxWidth="full"><div className="text-red-600 text-center py-8">{error}</div></FlowLayout>;
  if (!resultsData) return <FlowLayout backHref="/evaluator/results" backLabel="Volver" maxWidth="full"><div className="text-center py-8">No se encontraron resultados</div></FlowLayout>;

  const selectedResults = selectedQuestionnaire ? resultsData.results[selectedQuestionnaire] || [] : [];
  const riskSummary = calculateRiskSummary(selectedResults);
  const domains = calculateDomains(selectedResults, selectedQuestionnaire);

  return (
    <FlowLayout backHref="/evaluator/results" backLabel="Volver" maxWidth="full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="bg-white shadow-sm rounded-lg px-6 py-4 mb-6">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Dashboard de Resultados BRS
              </h1>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Participante:</span>
                  <p className="font-semibold">{resultsData.participant.firstName} {resultsData.participant.lastName}</p>
                </div>
                <div>
                  <span className="text-gray-500">Evaluación:</span>
                  <p className="font-semibold">{resultsData.participant.evaluationName}</p>
                </div>
                <div>
                  <span className="text-gray-500">Departamento:</span>
                  <p className="font-semibold">{resultsData.participant.department || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-gray-500">Cargo:</span>
                  <p className="font-semibold">{resultsData.participant.position || 'N/A'}</p>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => router.back()}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Volver
              </button>
              <button
                onClick={exportToPDF}
                className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-md"
              >
                Exportar PDF
              </button>
            </div>
          </div>
        </div>

        {/* Questionnaire Selector */}
        <div className="bg-white shadow-sm rounded-lg mb-6 overflow-hidden">
          <div className="flex justify-between items-center px-6 py-3 border-b border-gray-200">
            <div className="flex space-x-1">
              {Object.keys(resultsData.results).map((type) => (
                <button
                  key={type}
                  onClick={() => setSelectedQuestionnaire(type)}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    selectedQuestionnaire === type
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {getQuestionnaireLabel(type)}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1 text-sm rounded ${
                  viewMode === 'grid' ? 'bg-gray-200 text-gray-700' : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                Vista Grid
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-1 text-sm rounded ${
                  viewMode === 'table' ? 'bg-gray-200 text-gray-700' : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                Vista Tabla
              </button>
            </div>
          </div>
        </div>

        {selectedResults.length > 0 ? (
          <div className="space-y-6">
            {/* Summary Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Risk Distribution Chart */}
              <RiskSummaryChart 
                data={riskSummary}
                title="Distribución de Niveles de Riesgo"
                showPercentages={true}
              />

              {/* Domains Chart */}
              {domains.length > 0 && (
                <ResultsDomainsChart
                  domains={domains}
                  title="Análisis por Dominios"
                />
              )}
            </div>

            {/* Dimensions Results */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Resultados por Dimensión - {getQuestionnaireLabel(selectedQuestionnaire)}
              </h3>
              
              {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {selectedResults.map((result, index) => (
                    <ResultsDimensionCard
                      key={index}
                      dimension={result}
                      showDetails={true}
                    />
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Dimensión
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Puntaje Bruto
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Puntaje Transformado
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Percentil
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Nivel de Riesgo
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {selectedResults.map((result, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {result.dimension.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-500">
                            {result.rawScore}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900 font-semibold">
                            {result.transformedScore.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-500">
                            P{result.percentile}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              result.riskLevel === 'sin_riesgo' ? 'bg-green-100 text-green-800' :
                              result.riskLevel === 'riesgo_bajo' ? 'bg-blue-100 text-blue-800' :
                              result.riskLevel === 'riesgo_medio' ? 'bg-yellow-100 text-yellow-800' :
                              result.riskLevel === 'riesgo_alto' ? 'bg-orange-100 text-orange-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {result.riskLevel.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white shadow-sm rounded-lg p-8 text-center text-gray-500">
            No se encontraron resultados para este cuestionario
          </div>
        )}
      </div>
    </FlowLayout>
  );
}