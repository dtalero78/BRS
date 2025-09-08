import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import { 
  UserCircle, 
  Activity, 
  AlertTriangle, 
  TrendingUp,
  Download,
  Eye,
  RefreshCw,
  BarChart3,
  Users,
  Calendar
} from 'lucide-react';

// Dynamic API URL detection
const getApiUrl = (): string => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname.includes('github.dev')) {
      return `https://${hostname.replace('-3000', '-5000')}`;
    }
  }
  
  return 'http://localhost:5000';
};

interface Participant {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  formType: string;
  completedAt: string | null;
  hasResults: boolean;
}

interface Evaluation {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  totalParticipants: number;
  completedParticipants: number;
  participantsWithResults: number;
}

export default function ResultsDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [selectedEvaluation, setSelectedEvaluation] = useState<number | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [calculating, setCalculating] = useState<number | null>(null);

  useEffect(() => {
    fetchEvaluations();
  }, []);

  useEffect(() => {
    if (selectedEvaluation) {
      fetchParticipants(selectedEvaluation);
    }
  }, [selectedEvaluation]);

  const fetchEvaluations = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${getApiUrl()}/api/evaluations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Extract evaluations from response (handle both array and object format)
      const evaluationsArray = Array.isArray(response.data) ? response.data : response.data.evaluations || [];
      
      // Enrich evaluations with participant results count
      const evaluationsWithResults = await Promise.all(
        evaluationsArray.map(async (evaluation: any) => {
          try {
            // Get participants data to get real counts
            const participantsRes = await axios.get(
              `${getApiUrl()}/api/participants/evaluation/${evaluation.id}`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            
            const participantsArray = Array.isArray(participantsRes.data) ? 
              participantsRes.data : 
              participantsRes.data.participants || [];
              
            const totalParticipants = participantsArray.length;
            const completedParticipants = participantsArray.filter(p => p.completedAt || p.status === 'completed').length;

            // Get results data
            const resultsRes = await axios.get(
              `${getApiUrl()}/api/results/evaluation/${evaluation.id}`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            
            const hasStatistics = resultsRes.data.statistics && resultsRes.data.statistics.length > 0;
            const participantsWithResults = hasStatistics ? completedParticipants : 0;
            
            return {
              ...evaluation,
              totalParticipants,
              completedParticipants,
              participantsWithResults
            };
          } catch (error) {
            console.error(`Error processing evaluation ${evaluation.id}:`, error);
            return { 
              ...evaluation, 
              totalParticipants: 0,
              completedParticipants: 0,
              participantsWithResults: 0 
            };
          }
        })
      );
      
      setEvaluations(evaluationsWithResults);
      if (evaluationsWithResults.length > 0) {
        setSelectedEvaluation(evaluationsWithResults[0].id);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching evaluations:', error);
      setLoading(false);
    }
  };

  const fetchParticipants = async (evaluationId: number) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${getApiUrl()}/api/participants/evaluation/${evaluationId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Extract participants from response (handle both array and object format)
      const participantsArray = Array.isArray(response.data) ? 
        response.data : 
        response.data.participants || [];
      
      // Check which participants have results
      const participantsWithStatus = await Promise.all(
        participantsArray.map(async (participant: any) => {
          try {
            const resultsRes = await axios.get(
              `${getApiUrl()}/api/results/participant/${participant.id}`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            
            const hasResults = Object.keys(resultsRes.data.results || {}).length > 0;
            let demographicData: any = {};
            try {
              demographicData = typeof participant.demographic_data === 'string' 
                ? JSON.parse(participant.demographic_data)
                : (participant.demographic_data || {});
            } catch (e) {
              console.warn('Error parsing demographic_data:', e);
              demographicData = {};
            }
            
            return {
              id: participant.id,
              email: participant.email,
              firstName: demographicData.firstName || participant.firstName || 'Sin nombre',
              lastName: demographicData.lastName || participant.lastName || '',
              formType: demographicData.formType || participant.formType || 'A',
              completedAt: participant.completed_at,
              hasResults
            };
          } catch {
            let demographicData: any = {};
            try {
              demographicData = typeof participant.demographic_data === 'string' 
                ? JSON.parse(participant.demographic_data)
                : (participant.demographic_data || {});
            } catch {
              demographicData = {};
            }
            return {
              id: participant.id,
              email: participant.email,
              firstName: demographicData.firstName || participant.firstName || 'Sin nombre',
              lastName: demographicData.lastName || participant.lastName || '',
              formType: demographicData.formType || participant.formType || 'A',
              completedAt: participant.completed_at,
              hasResults: false
            };
          }
        })
      );
      
      setParticipants(participantsWithStatus);
    } catch (error) {
      console.error('Error fetching participants:', error);
    }
  };

  const calculateResults = async (participantId: number) => {
    try {
      setCalculating(participantId);
      const token = localStorage.getItem('token');
      
      await axios.post(
        `${getApiUrl()}/api/results/calculate/${participantId}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Refresh participants to update status
      if (selectedEvaluation) {
        await fetchParticipants(selectedEvaluation);
      }
    } catch (error: any) {
      console.error('Error calculating results:', error);
      alert(error.response?.data?.error || 'Error al calcular resultados');
    } finally {
      setCalculating(null);
    }
  };

  const viewResults = (participantId: number) => {
    router.push(`/evaluator/results/${participantId}`);
  };

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'sin_riesgo': return 'bg-green-100 text-green-800';
      case 'riesgo_bajo': return 'bg-yellow-100 text-yellow-800';
      case 'riesgo_medio': return 'bg-orange-100 text-orange-800';
      case 'riesgo_alto': return 'bg-red-100 text-red-800';
      case 'riesgo_muy_alto': return 'bg-red-200 text-red-900';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCompletionPercentage = (evaluation: Evaluation) => {
    const total = evaluation.totalParticipants || 0;
    const completed = evaluation.completedParticipants || 0;
    if (total === 0) return 0;
    return Math.round((completed / total) * 100);
  };

  const getResultsPercentage = (evaluation: Evaluation) => {
    const completed = evaluation.completedParticipants || 0;
    const withResults = evaluation.participantsWithResults || 0;
    if (completed === 0) return 0;
    return Math.round((withResults / completed) * 100);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando dashboard de resultados...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <BarChart3 className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Dashboard de Resultados BRS</h1>
                <p className="text-sm text-gray-600">Análisis de Riesgo Psicosocial</p>
              </div>
            </div>
            <button
              onClick={() => router.push('/evaluator/dashboard')}
              className="px-4 py-2 text-gray-600 hover:text-gray-900 transition"
            >
              Volver al Dashboard
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Evaluation Selector */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Seleccionar Evaluación
          </label>
          <select
            value={selectedEvaluation || ''}
            onChange={(e) => setSelectedEvaluation(Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Seleccione una evaluación</option>
            {evaluations.map((evaluation) => (
              <option key={evaluation.id} value={evaluation.id}>
                {evaluation.name} ({getCompletionPercentage(evaluation)}% completado)
              </option>
            ))}
          </select>
        </div>

        {selectedEvaluation && (
          <>
            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Participantes</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {evaluations.find(e => e.id === selectedEvaluation)?.totalParticipants || 0}
                    </p>
                  </div>
                  <Users className="h-8 w-8 text-blue-500" />
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Evaluaciones Completadas</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {evaluations.find(e => e.id === selectedEvaluation)?.completedParticipants || 0}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {getCompletionPercentage(evaluations.find(e => e.id === selectedEvaluation)!)}%
                    </p>
                  </div>
                  <Activity className="h-8 w-8 text-green-500" />
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Con Resultados</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {evaluations.find(e => e.id === selectedEvaluation)?.participantsWithResults || 0}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {getResultsPercentage(evaluations.find(e => e.id === selectedEvaluation)!)}%
                    </p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-purple-500" />
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Pendientes</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {participants.filter(p => p.completedAt && !p.hasResults).length}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Por calcular</p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-orange-500" />
                </div>
              </div>
            </div>

            {/* Participants Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-6 py-4 border-b">
                <h2 className="text-lg font-semibold text-gray-900">
                  Participantes y Resultados
                </h2>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Participante
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Forma
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Estado Evaluación
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Resultados
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {participants.map((participant) => (
                      <tr key={participant.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <UserCircle className="h-8 w-8 text-gray-400 mr-3" />
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {participant.firstName} {participant.lastName}
                              </div>
                              <div className="text-sm text-gray-500">
                                {participant.email}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                            Forma {participant.formType}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {participant.completedAt ? (
                            <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">
                              Completado
                            </span>
                          ) : (
                            <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded">
                              Pendiente
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {participant.hasResults ? (
                            <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded">
                              Calculados
                            </span>
                          ) : participant.completedAt ? (
                            <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded">
                              Sin calcular
                            </span>
                          ) : (
                            <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded">
                              N/A
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex space-x-2">
                            {participant.hasResults ? (
                              <>
                                <button
                                  onClick={() => viewResults(participant.id)}
                                  className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                >
                                  <Eye className="h-3 w-3 mr-1" />
                                  Ver Resultados
                                </button>
                                <button
                                  onClick={() => calculateResults(participant.id)}
                                  disabled={calculating === participant.id}
                                  className="inline-flex items-center px-3 py-1 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                >
                                  <RefreshCw className={`h-3 w-3 mr-1 ${calculating === participant.id ? 'animate-spin' : ''}`} />
                                  Recalcular
                                </button>
                              </>
                            ) : participant.completedAt ? (
                              <button
                                onClick={() => calculateResults(participant.id)}
                                disabled={calculating === participant.id}
                                className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                              >
                                {calculating === participant.id ? (
                                  <>
                                    <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                                    Calculando...
                                  </>
                                ) : (
                                  <>
                                    <Activity className="h-3 w-3 mr-1" />
                                    Calcular Resultados
                                  </>
                                )}
                              </button>
                            ) : (
                              <span className="text-gray-400 text-xs">
                                Evaluación pendiente
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}