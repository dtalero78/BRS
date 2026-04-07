import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import FlowLayout from '../../../components/FlowLayout';
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

const getRiskLevelColor = (riskLevel: string) => {
  switch (riskLevel) {
    case 'sin_riesgo': return 'bg-green-100 text-green-800 border-green-200';
    case 'riesgo_bajo': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'riesgo_medio': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'riesgo_alto': return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'riesgo_muy_alto': return 'bg-red-100 text-red-800 border-red-200';
    case 'muy_bajo': return 'bg-green-100 text-green-800 border-green-200';
    case 'bajo': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'medio': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'alto': return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'muy_alto': return 'bg-red-100 text-red-800 border-red-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const getRiskLevelLabel = (riskLevel: string) => {
  switch (riskLevel) {
    case 'sin_riesgo': return 'Sin Riesgo';
    case 'riesgo_bajo': return 'Riesgo Bajo';
    case 'riesgo_medio': return 'Riesgo Medio';
    case 'riesgo_alto': return 'Riesgo Alto';
    case 'riesgo_muy_alto': return 'Riesgo Muy Alto';
    case 'muy_bajo': return 'Muy Bajo';
    case 'bajo': return 'Bajo';
    case 'medio': return 'Medio';
    case 'alto': return 'Alto';
    case 'muy_alto': return 'Muy Alto';
    default: return riskLevel;
  }
};

const formatDimensionName = (dimension: string) => {
  if (COPING_DIMENSION_NAMES[dimension]) return COPING_DIMENSION_NAMES[dimension];
  return dimension
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const getQuestionnaireLabel = (type: string) => {
  switch (type) {
    case 'intralaboral_a': return 'Forma A - Intralaboral';
    case 'intralaboral_b': return 'Forma B - Intralaboral';
    case 'forma_a': return 'Forma A - Intralaboral';
    case 'forma_b': return 'Forma B - Intralaboral';
    case 'extralaboral': return 'Extralaboral';
    case 'estres': return 'Estrés';
    case 'coping': return 'Brief COPE - Afrontamiento';
    default: return type;
  }
};

const COPING_DIMENSION_NAMES: { [key: string]: string } = {
  afrontamiento_activo: 'Afrontamiento activo',
  planificacion: 'Planificación',
  apoyo_instrumental: 'Apoyo instrumental',
  reinterpretacion_positiva: 'Reinterpretación positiva',
  apoyo_emocional: 'Apoyo emocional',
  desahogo: 'Desahogo',
  aceptacion: 'Aceptación',
  humor: 'Humor',
  religion: 'Religión',
  autoinculpacion: 'Auto-inculpación',
  autodistraccion: 'Auto-distracción',
  negacion: 'Negación',
  desconexion_conductual: 'Desconexión conductual',
  uso_sustancias: 'Uso de sustancias',
  problem_focused_total: 'Afrontamiento centrado en el problema',
  emotion_focused_total: 'Afrontamiento centrado en la emoción',
  avoidant_total: 'Afrontamiento evitativo',
  puntaje_total_coping: 'Puntaje Total Coping'
};

export default function ParticipantResults() {
  const router = useRouter();
  const { participantId } = router.query;
  const [resultsData, setResultsData] = useState<ResultsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedQuestionnaire, setSelectedQuestionnaire] = useState<string>('');

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
      
      // Set first questionnaire as default
      if (data.results && Object.keys(data.results).length > 0) {
        setSelectedQuestionnaire(Object.keys(data.results)[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  const isCopingSelected = selectedQuestionnaire === 'coping';

  const calculateRiskSummary = (results: Result[]) => {
    if (isCopingSelected) {
      const summary = { muy_bajo: 0, bajo: 0, medio: 0, alto: 0, muy_alto: 0 };
      results.forEach(result => {
        if (result.riskLevel in summary) {
          summary[result.riskLevel as keyof typeof summary]++;
        }
      });
      return summary;
    }
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

  const calculateAverageScore = (results: Result[]) => {
    if (results.length === 0) return 0;
    const sum = results.reduce((acc, result) => acc + (result.transformedScore || 0), 0);
    return (sum / results.length).toFixed(2);
  };

  if (loading) return <FlowLayout backHref="/evaluator/results" backLabel="Volver" maxWidth="full"><div className="text-center py-8">Cargando resultados...</div></FlowLayout>;
  if (error) return <FlowLayout backHref="/evaluator/results" backLabel="Volver" maxWidth="full"><div className="text-red-600 text-center py-8">{error}</div></FlowLayout>;
  if (!resultsData) return <FlowLayout backHref="/evaluator/results" backLabel="Volver" maxWidth="full"><div className="text-center py-8">No se encontraron resultados</div></FlowLayout>;

  const selectedResults = selectedQuestionnaire ? resultsData.results[selectedQuestionnaire] || [] : [];
  const riskSummary = calculateRiskSummary(selectedResults);
  const averageScore = calculateAverageScore(selectedResults);

  return (
    <FlowLayout backHref="/evaluator/results" backLabel="Volver" maxWidth="full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="bg-white shadow-sm rounded-lg px-6 py-4 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold text-gray-900">Resultados de Evaluación BRS</h1>
            <button
              onClick={() => router.back()}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Volver
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
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
              <p className="font-semibold">{resultsData.participant.formType === 'A' || resultsData.participant.formType === 'forma_a' ? 'Forma A' : 'Forma B'}</p>
            </div>
          </div>
        </div>

        {/* Questionnaire Tabs */}
        <div className="bg-white shadow-sm rounded-lg mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6" aria-label="Tabs">
              {Object.keys(resultsData.results).map((type) => (
                <button
                  key={type}
                  onClick={() => setSelectedQuestionnaire(type)}
                  className={`
                    py-4 px-1 border-b-2 font-medium text-sm
                    ${selectedQuestionnaire === type
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  {getQuestionnaireLabel(type)}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {selectedResults.length > 0 ? (
          <>
            {/* Risk Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6">
              <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
                <div className="text-2xl font-bold text-gray-900">{averageScore}</div>
                <div className="text-sm text-gray-500">Puntaje Promedio</div>
              </div>
              
              {Object.entries(riskSummary).map(([level, count]) => (
                <div key={level} className={`rounded-lg shadow-sm p-4 border ${getRiskLevelColor(level)}`}>
                  <div className="text-2xl font-bold">{count}</div>
                  <div className="text-sm">{getRiskLevelLabel(level)}</div>
                </div>
              ))}
            </div>

            {/* Results Table */}
            <div className="bg-white shadow-sm rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  Resultados por Dimensión - {getQuestionnaireLabel(selectedQuestionnaire)}
                </h2>
              </div>
              
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
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Indicador Visual
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {selectedResults.map((result, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {formatDimensionName(result.dimension)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-500">
                          {result.rawScore ?? 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900 font-semibold">
                          {result.transformedScore != null ? result.transformedScore.toFixed(2) : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-500">
                          {result.percentile ?? 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRiskLevelColor(result.riskLevel)}`}>
                            {getRiskLevelLabel(result.riskLevel)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div
                              className={`h-2.5 rounded-full ${
                                result.riskLevel === 'sin_riesgo' || result.riskLevel === 'muy_bajo' ? 'bg-green-500' :
                                result.riskLevel === 'riesgo_bajo' || result.riskLevel === 'bajo' ? 'bg-blue-500' :
                                result.riskLevel === 'riesgo_medio' || result.riskLevel === 'medio' ? 'bg-yellow-500' :
                                result.riskLevel === 'riesgo_alto' || result.riskLevel === 'alto' ? 'bg-orange-500' :
                                'bg-red-500'
                              }`}
                              style={{ width: `${result.transformedScore || 0}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Export Actions */}
            <div className="mt-6 flex justify-end space-x-4">
              <button
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                onClick={() => window.print()}
              >
                Imprimir Resultados
              </button>
              <button
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                onClick={() => {/* TODO: Implement PDF export */}}
              >
                Exportar PDF
              </button>
            </div>
          </>
        ) : (
          <div className="bg-white shadow-sm rounded-lg p-8 text-center text-gray-500">
            No se encontraron resultados para este cuestionario
          </div>
        )}
      </div>
    </FlowLayout>
  );
}