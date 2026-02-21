import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import FlowLayout from '../../components/FlowLayout';
import { API_URL } from '../../config/api';

interface Evaluation {
  id: number;
  name: string;
  totalParticipants: number;
  completedParticipants: number;
}

interface ParticipantResult {
  participantId: number;
  firstName: string;
  lastName: string;
  department: string;
  position: string;
  evaluationName: string;
  completedQuestionnaires: string[];
  hasResults: boolean;
  overallRiskLevel?: string;
  lastCalculated?: string;
}

const getRiskLevelBadge = (riskLevel: string | undefined) => {
  if (!riskLevel) return null;
  
  const colors = {
    'sin_riesgo': 'bg-green-100 text-green-800',
    'riesgo_bajo': 'bg-blue-100 text-blue-800',
    'riesgo_medio': 'bg-yellow-100 text-yellow-800',
    'riesgo_alto': 'bg-orange-100 text-orange-800',
    'riesgo_muy_alto': 'bg-red-100 text-red-800'
  };

  const labels = {
    'sin_riesgo': 'Sin Riesgo',
    'riesgo_bajo': 'Riesgo Bajo',
    'riesgo_medio': 'Riesgo Medio',
    'riesgo_alto': 'Riesgo Alto',
    'riesgo_muy_alto': 'Riesgo Muy Alto'
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[riskLevel as keyof typeof colors] || 'bg-gray-100 text-gray-800'}`}>
      {labels[riskLevel as keyof typeof labels] || riskLevel}
    </span>
  );
};

export default function Results() {
  const router = useRouter();
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [participants, setParticipants] = useState<ParticipantResult[]>([]);
  const [selectedEvaluation, setSelectedEvaluation] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchEvaluations();
  }, []);

  useEffect(() => {
    if (selectedEvaluation) {
      fetchParticipants();
    }
  }, [selectedEvaluation]);

  const fetchEvaluations = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/evaluations`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Error al cargar las evaluaciones');
      }

      const data = await response.json();
      setEvaluations(data.evaluations || []);
      
      // Select first evaluation by default
      if (data.evaluations && data.evaluations.length > 0) {
        setSelectedEvaluation(data.evaluations[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  const fetchParticipants = async () => {
    if (!selectedEvaluation) return;
    
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      // Fetch participants for the selected evaluation
      const response = await fetch(`${API_URL}/api/participants/evaluation/${selectedEvaluation}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Error al cargar los participantes');
      }

      const data = await response.json();
      
      // Process participants to include result status
      const processedParticipants = data.participants?.map((p: any) => ({
        participantId: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        department: p.department,
        position: p.position,
        evaluationName: p.evaluationName,
        completedQuestionnaires: p.completed_questionnaires || [],
        hasResults: p.hasResults,
        overallRiskLevel: p.overall_risk_level,
        lastCalculated: p.last_calculated
      })) || [];

      setParticipants(processedParticipants);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  const calculateResults = async (participantId: number) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/results/calculate/${participantId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al calcular resultados');
      }

      const data = await response.json();
      alert('Resultados calculados exitosamente');
      
      // Refresh participants to show updated results
      fetchParticipants();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al calcular resultados');
    }
  };

  const filteredParticipants = participants.filter(p => 
    `${p.firstName} ${p.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.department?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.position?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedEvaluationData = evaluations.find(e => e.id === selectedEvaluation);
  const completionRate = selectedEvaluationData 
    ? ((selectedEvaluationData.completedParticipants / selectedEvaluationData.totalParticipants) * 100).toFixed(1)
    : '0';

  return (
    <FlowLayout backHref="/evaluator/dashboard" backLabel="Volver al menu" maxWidth="full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Resultados de Evaluaciones BRS</h1>
          <p className="mt-2 text-gray-600">Visualice y gestione los resultados de las evaluaciones de riesgo psicosocial</p>
        </div>

        {/* Evaluation Selector */}
        <div className="bg-white shadow-sm rounded-lg px-6 py-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="evaluation" className="block text-sm font-medium text-gray-700 mb-2">
                Seleccionar Evaluación
              </label>
              <select
                id="evaluation"
                value={selectedEvaluation || ''}
                onChange={(e) => setSelectedEvaluation(Number(e.target.value))}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="">Seleccione una evaluación</option>
                {evaluations.map((evaluation) => (
                  <option key={evaluation.id} value={evaluation.id}>
                    {evaluation.name}
                  </option>
                ))}
              </select>
            </div>
            
            {selectedEvaluationData && (
              <div className="flex items-end">
                <div className="flex-1">
                  <div className="text-sm text-gray-500">Progreso de Evaluación</div>
                  <div className="mt-1 flex items-center">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${completionRate}%` }}
                      />
                    </div>
                    <span className="ml-3 text-sm font-medium text-gray-700">
                      {completionRate}% ({selectedEvaluationData.completedParticipants}/{selectedEvaluationData.totalParticipants})
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {selectedEvaluation && (
          <>
            {/* Search and Actions */}
            <div className="bg-white shadow-sm rounded-lg px-6 py-4 mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex-1 max-w-lg">
                  <input
                    type="text"
                    placeholder="Buscar por nombre, departamento o cargo..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => router.push(`/evaluator/results/summary/${selectedEvaluation}`)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Ver Resumen General
                  </button>
                  <button
                    onClick={() => {/* TODO: Export all results */}}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                  >
                    Exportar Todos
                  </button>
                </div>
              </div>
            </div>

            {/* Results Table */}
            <div className="bg-white shadow-sm rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Participante
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Departamento
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cargo
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cuestionarios
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Nivel de Riesgo
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                        Cargando participantes...
                      </td>
                    </tr>
                  ) : filteredParticipants.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                        No se encontraron participantes
                      </td>
                    </tr>
                  ) : (
                    filteredParticipants.map((participant) => (
                      <tr key={participant.participantId} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {participant.firstName} {participant.lastName}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {participant.department || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {participant.position || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="text-sm text-gray-900">
                            {participant.completedQuestionnaires.length > 0 ? (
                              <span className="text-green-600 font-medium">
                                {participant.completedQuestionnaires.length} completados
                              </span>
                            ) : (
                              <span className="text-gray-400">Sin completar</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          {getRiskLevelBadge(participant.overallRiskLevel)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          {participant.hasResults ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Calculado
                            </span>
                          ) : participant.completedQuestionnaires.length > 0 ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              Pendiente
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              Sin datos
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end gap-2">
                            {participant.hasResults ? (
                              <>
                                <Link 
                                  href={`/evaluator/results-dashboard/${participant.participantId}`}
                                  className="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                >
                                  Dashboard
                                </Link>
                                <Link 
                                  href={`/evaluator/results/${participant.participantId}`}
                                  className="text-blue-600 hover:text-blue-900"
                                >
                                  Ver Tabla
                                </Link>
                              </>
                            ) : participant.completedQuestionnaires.length > 0 ? (
                              <button
                                onClick={() => calculateResults(participant.participantId)}
                                className="text-green-600 hover:text-green-900"
                              >
                                Calcular
                              </button>
                            ) : (
                              <span className="text-gray-400">No disponible</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </FlowLayout>
  );
}