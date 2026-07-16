import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import FlowLayout from '../../../components/FlowLayout';
import { 
  Building2, 
  Users, 
  TrendingUp, 
  TrendingDown,
  AlertTriangle,
  Shield,
  BarChart3,
  PieChart,
  Filter,
  Download,
  RefreshCw,
  Calendar,
  Target,
  Activity
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart as RePieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart
} from 'recharts';

import { API_URL } from '../../../config/api';

interface OrganizationalMetrics {
  totalParticipants: number;
  completedEvaluations: number;
  averageCompletionRate: number;
  riskDistribution: {
    sin_riesgo: number;
    riesgo_bajo: number;
    riesgo_medio: number;
    riesgo_alto: number;
    riesgo_muy_alto: number;
  };
  criticalAreas: string[];
  topDimensions: Array<{
    dimension: string;
    averageScore: number;
    riskLevel: string;
    affectedParticipants: number;
    riskCounts: RiskCounts;
  }>;
  departmentStats?: Array<{
    department: string;
    participants: number;
    averageRisk: string;
    criticalCount: number;
  }>;
}

interface EvaluationSummary {
  id: number;
  name: string;
  totalParticipants: number;
  completedParticipants: number;
  completionRate: number;
  averageRiskLevel: string;
  criticalParticipants: number;
  startDate: string;
  endDate: string;
}

const RISK_COLORS: { [key: string]: string } = {
  'sin_riesgo': '#10B981',
  'riesgo_bajo': '#FCD34D',
  'riesgo_medio': '#FB923C',
  'riesgo_alto': '#EF4444',
  'riesgo_muy_alto': '#991B1B',
  'muy_bajo': '#10B981',
  'bajo': '#FCD34D',
  'medio': '#FB923C',
  'alto': '#EF4444',
  'muy_alto': '#991B1B'
};

const RISK_LABELS: { [key: string]: string } = {
  'sin_riesgo': 'Sin Riesgo',
  'riesgo_bajo': 'Riesgo Bajo',
  'riesgo_medio': 'Riesgo Medio',
  'riesgo_alto': 'Riesgo Alto',
  'riesgo_muy_alto': 'Riesgo Muy Alto',
  'muy_bajo': 'Muy Bajo',
  'bajo': 'Bajo',
  'medio': 'Medio',
  'alto': 'Alto',
  'muy_alto': 'Muy Alto'
};

interface RiskCounts {
  sin_riesgo?: number;
  riesgo_bajo?: number;
  riesgo_medio?: number;
  riesgo_alto?: number;
  riesgo_muy_alto?: number;
}

// Clasifica el nivel de riesgo de una dimensión a partir de la distribución
// REAL de participantes por baremos, no del promedio del transformedScore.
// Consistente con getAtRiskDimensions del reporte PDF y con la columna
// "Participantes afectados": una dimensión sin nadie en alto/muy_alto nunca
// puede salir como Muy Alto/Crítica.
function riskLevelFromDistribution(counts?: RiskCounts): string {
  if (!counts) return 'sin_riesgo';
  const muyAlto = counts.riesgo_muy_alto || 0;
  const alto = counts.riesgo_alto || 0;
  const medio = counts.riesgo_medio || 0;
  const bajo = counts.riesgo_bajo || 0;
  const sin = counts.sin_riesgo || 0;
  const total = muyAlto + alto + medio + bajo + sin;
  if (total === 0) return 'sin_riesgo';

  const pctHigh = ((alto + muyAlto) / total) * 100;         // % en riesgo alto/muy alto
  const pctAtRisk = ((medio + alto + muyAlto) / total) * 100; // incluye medio

  if (pctHigh >= 40) return 'riesgo_muy_alto';
  if (pctHigh >= 25) return 'riesgo_alto';
  if (pctHigh >= 10 || pctAtRisk >= 40) return 'riesgo_medio';
  if (pctAtRisk >= 15) return 'riesgo_bajo';
  return 'sin_riesgo';
}

function mergeRiskCounts(a?: RiskCounts, b?: RiskCounts): RiskCounts {
  return {
    sin_riesgo: (a?.sin_riesgo || 0) + (b?.sin_riesgo || 0),
    riesgo_bajo: (a?.riesgo_bajo || 0) + (b?.riesgo_bajo || 0),
    riesgo_medio: (a?.riesgo_medio || 0) + (b?.riesgo_medio || 0),
    riesgo_alto: (a?.riesgo_alto || 0) + (b?.riesgo_alto || 0),
    riesgo_muy_alto: (a?.riesgo_muy_alto || 0) + (b?.riesgo_muy_alto || 0),
  };
}

export default function OrganizationalDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<OrganizationalMetrics | null>(null);
  const [evaluations, setEvaluations] = useState<EvaluationSummary[]>([]);
  const [selectedEvaluation, setSelectedEvaluation] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchOrganizationalData();
  }, []);

  // Pre-select evaluation from query string
  useEffect(() => {
    if (router.query.evaluationId && !selectedEvaluation) {
      setSelectedEvaluation(parseInt(router.query.evaluationId as string));
    }
  }, [router.query.evaluationId]);

  useEffect(() => {
    if (selectedEvaluation) {
      fetchEvaluationMetrics(selectedEvaluation);
    }
  }, [selectedEvaluation]);

  const fetchOrganizationalData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      // Fetch evaluations
      const evaluationsResponse = await axios.get(`${API_URL}/api/evaluations`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Extract evaluations from response (handle both array and object format)
      const evaluationsArray = Array.isArray(evaluationsResponse.data) ? 
        evaluationsResponse.data : 
        evaluationsResponse.data.evaluations || [];

      const evaluationSummaries: EvaluationSummary[] = await Promise.all(
        evaluationsArray.map(async (evaluation: any) => {
          try {
            // Get evaluation results
            const resultsResponse = await axios.get(
              `${API_URL}/api/results/evaluation/${evaluation.id}`,
              { headers: { Authorization: `Bearer ${token}` } }
            );

            const totalParts = evaluation.totalParticipants || evaluation.total_participants || 0;
            const completedParts = evaluation.completedParticipants || evaluation.completed_participants || 0;
            const completionRate = totalParts > 0
              ? (completedParts / totalParts) * 100
              : 0;

            // Calculate average risk level from statistics
            const stats = resultsResponse.data.statistics || [];
            let dimensionCount = 0;
            let criticalParticipants = 0;
            let aggCounts: RiskCounts = {};

            stats.forEach((stat: any) => {
              dimensionCount++;

              // Count critical participants (high/very high risk) and aggregate the
              // real per-baremo distribution to derive the evaluation risk level.
              if (stat.riskLevels) {
                criticalParticipants += (stat.riskLevels.riesgo_alto || 0) + (stat.riskLevels.riesgo_muy_alto || 0);
                aggCounts = mergeRiskCounts(aggCounts, stat.riskLevels);
              }
            });

            // Nivel de riesgo de la evaluación: a partir de la distribución real de
            // participantes por baremos (no del promedio del transformedScore).
            const averageRiskLevel = riskLevelFromDistribution(aggCounts);

            return {
              id: evaluation.id,
              name: evaluation.name,
              totalParticipants: totalParts,
              completedParticipants: completedParts,
              completionRate: Math.round(completionRate),
              averageRiskLevel,
              criticalParticipants: Math.round(criticalParticipants / (dimensionCount || 1)),
              startDate: evaluation.startDate || evaluation.start_date,
              endDate: evaluation.endDate || evaluation.end_date
            };
          } catch (error) {
            console.error(`Error fetching results for evaluation ${evaluation.id}:`, error);
            return {
              id: evaluation.id,
              name: evaluation.name,
              totalParticipants: evaluation.totalParticipants || evaluation.total_participants || 0,
              completedParticipants: evaluation.completedParticipants || evaluation.completed_participants || 0,
              completionRate: 0,
              averageRiskLevel: 'sin_riesgo',
              criticalParticipants: 0,
              startDate: evaluation.start_date,
              endDate: evaluation.end_date
            };
          }
        })
      );

      setEvaluations(evaluationSummaries);
      
      // Set first evaluation as selected if available
      if (evaluationSummaries.length > 0) {
        setSelectedEvaluation(evaluationSummaries[0].id);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching organizational data:', error);
      setLoading(false);
    }
  };

  const fetchEvaluationMetrics = async (evaluationId: number) => {
    try {
      const token = localStorage.getItem('token');
      
      // Get detailed results for the selected evaluation
      const resultsResponse = await axios.get(
        `${API_URL}/api/results/evaluation/${evaluationId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const statistics = resultsResponse.data.statistics || [];

      // Risk distribution: use only puntaje_total_intralaboral (overall participant risk)
      const riskDistribution = {
        sin_riesgo: 0,
        riesgo_bajo: 0,
        riesgo_medio: 0,
        riesgo_alto: 0,
        riesgo_muy_alto: 0
      };

      // Display names for dimensions
      const DIMENSION_NAMES: Record<string, string> = {
        'caracteristicas_liderazgo': 'Características del Liderazgo',
        'relaciones_sociales_trabajo': 'Relaciones Sociales en el Trabajo',
        'retroalimentacion_desempeño': 'Retroalimentación del Desempeño',
        'relacion_colaboradores': 'Relación con Colaboradores',
        'claridad_rol': 'Claridad del Rol',
        'capacitacion': 'Capacitación',
        'participacion_manejo_cambio': 'Participación y Manejo del Cambio',
        'oportunidades_desarrollo': 'Oportunidades de Desarrollo',
        'control_autonomia': 'Control y Autonomía',
        'demandas_cuantitativas': 'Demandas Cuantitativas',
        'demandas_carga_mental': 'Demandas de Carga Mental',
        'demandas_emocionales': 'Demandas Emocionales',
        'exigencias_responsabilidad': 'Exigencias de Responsabilidad',
        'demandas_ambientales': 'Demandas Ambientales',
        'demandas_jornada': 'Demandas de la Jornada',
        'consistencia_rol': 'Consistencia del Rol',
        'influencia_trabajo_entorno': 'Influencia del Trabajo sobre el Entorno',
        'reconocimiento_compensacion': 'Reconocimiento y Compensación',
        'recompensas_pertenencia': 'Recompensas y Pertenencia',
        'tiempo_fuera_trabajo': 'Tiempo Fuera del Trabajo',
        'relaciones_familiares': 'Relaciones Familiares',
        'comunicacion_relaciones': 'Comunicación y Relaciones',
        'comunicacion_relaciones_interpersonales': 'Comunicación y Relaciones Interpersonales',
        'situacion_economica': 'Situación Económica',
        'caracteristicas_vivienda': 'Características de la Vivienda',
        'influencia_entorno_extralaboral': 'Influencia del Entorno Extralaboral',
        'influencia_entorno_trabajo': 'Influencia del Entorno sobre el Trabajo',
        'desplazamiento_vivienda_trabajo': 'Desplazamiento Vivienda-Trabajo',
        'capacitacion': 'Capacitación',
        'relacion_colaboradores': 'Relación con Colaboradores',
        'retroalimentacion_desempeño': 'Retroalimentación del Desempeño',
      };

      const dimensionScores: Array<{
        dimension: string;
        averageScore: number;
        riskLevel: string;
        affectedParticipants: number;
      }> = [];

      let totalParticipants = 0;
      let completedEvaluations = 0;

      statistics.forEach((stat: any) => {
        const dim = stat.dimension || '';

        // For overall risk distribution chart: only use puntaje_total_intralaboral
        if (dim.startsWith('puntaje_total_intralaboral')) {
          Object.keys(riskDistribution).forEach(riskLevel => {
            riskDistribution[riskLevel as keyof typeof riskDistribution] +=
              stat.riskLevels?.[riskLevel] || 0;
          });
        }

        // Skip _total and puntaje_total dimensions for the detailed dimension list
        if (dim.endsWith('_total') || dim.startsWith('puntaje_total')) {
          totalParticipants = Math.max(totalParticipants, stat.totalParticipants || 0);
          return;
        }

        // Collect individual dimension data. El PUNTAJE PROMEDIO sigue siendo el
        // promedio del transformedScore (métrica informativa), pero el NIVEL DE
        // RIESGO se deriva de la distribución real de participantes por baremos,
        // consistente con la columna "Participantes afectados".
        const avgScore = stat.averageScore || 0;
        const riskCounts: RiskCounts = stat.riskLevels || {};
        const riskLevel = riskLevelFromDistribution(riskCounts);

        const displayName = DIMENSION_NAMES[dim] || dim.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

        const affected = (riskCounts.riesgo_alto || 0) + (riskCounts.riesgo_muy_alto || 0);

        dimensionScores.push({
          dimension: displayName,
          averageScore: avgScore,
          riskLevel,
          affectedParticipants: affected,
          riskCounts
        });

        totalParticipants = Math.max(totalParticipants, stat.totalParticipants || 0);
      });

      completedEvaluations = totalParticipants;

      // Sort dimensions by risk level and score
      dimensionScores.sort((a, b) => {
        const riskOrder = {
          'riesgo_muy_alto': 4,
          'riesgo_alto': 3,
          'riesgo_medio': 2,
          'riesgo_bajo': 1,
          'sin_riesgo': 0
        };
        return riskOrder[b.riskLevel as keyof typeof riskOrder] -
               riskOrder[a.riskLevel as keyof typeof riskOrder] ||
               b.averageScore - a.averageScore;
      });

      // Deduplicate dimensions (same dimension from forma A and B): merge by averaging
      const mergedDimensions: typeof dimensionScores = [];
      const seen = new Map<string, number>();
      dimensionScores.forEach(d => {
        const existing = seen.get(d.dimension);
        if (existing !== undefined) {
          const prev = mergedDimensions[existing];
          prev.averageScore = (prev.averageScore + d.averageScore) / 2;
          prev.affectedParticipants = prev.affectedParticipants + d.affectedParticipants;
          // Fusionar la distribución por baremos y reclasificar desde los conteos
          // combinados (no desde el promedio).
          prev.riskCounts = mergeRiskCounts(prev.riskCounts, d.riskCounts);
          prev.riskLevel = riskLevelFromDistribution(prev.riskCounts);
        } else {
          seen.set(d.dimension, mergedDimensions.length);
          mergedDimensions.push({ ...d });
        }
      });

      // Re-sort after merge
      mergedDimensions.sort((a, b) => {
        const riskOrder = {
          'riesgo_muy_alto': 4, 'riesgo_alto': 3, 'riesgo_medio': 2,
          'riesgo_bajo': 1, 'sin_riesgo': 0
        };
        return riskOrder[b.riskLevel as keyof typeof riskOrder] -
               riskOrder[a.riskLevel as keyof typeof riskOrder] ||
               b.averageScore - a.averageScore;
      });

      // Identify critical areas
      const criticalAreas = mergedDimensions
        .filter(d => d.riskLevel === 'riesgo_alto' || d.riskLevel === 'riesgo_muy_alto')
        .slice(0, 5)
        .map(d => d.dimension);

      const organizationalMetrics: OrganizationalMetrics = {
        totalParticipants,
        completedEvaluations,
        averageCompletionRate: totalParticipants > 0 ? 100 : 0,
        riskDistribution,
        criticalAreas,
        topDimensions: mergedDimensions.slice(0, 10)
      };

      setMetrics(organizationalMetrics);
    } catch (error) {
      console.error('Error fetching evaluation metrics:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchOrganizationalData();
    setRefreshing(false);
  };

  const getRiskColor = (riskLevel: string) => {
    return RISK_COLORS[riskLevel as keyof typeof RISK_COLORS] || '#6B7280';
  };

  const getRiskBadgeClass = (riskLevel: string) => {
    switch (riskLevel) {
      case 'sin_riesgo': case 'muy_bajo': return 'bg-green-100 text-green-800';
      case 'riesgo_bajo': case 'bajo': return 'bg-yellow-100 text-yellow-800';
      case 'riesgo_medio': case 'medio': return 'bg-orange-100 text-orange-800';
      case 'riesgo_alto': case 'alto': return 'bg-red-100 text-red-800';
      case 'riesgo_muy_alto': case 'muy_alto': return 'bg-red-200 text-red-900';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const prepareRiskDistributionData = () => {
    if (!metrics) return [];
    
    return Object.entries(metrics.riskDistribution).map(([level, count]) => ({
      name: RISK_LABELS[level as keyof typeof RISK_LABELS],
      value: count,
      fill: RISK_COLORS[level as keyof typeof RISK_COLORS]
    })).filter(item => item.value > 0);
  };

  const prepareTopDimensionsData = () => {
    if (!metrics) return [];
    
    return metrics.topDimensions.slice(0, 8).map(dim => ({
      name: dim.dimension.substring(0, 15),
      score: dim.averageScore,
      participants: dim.affectedParticipants,
      fill: getRiskColor(dim.riskLevel)
    }));
  };

  if (loading) {
    return (
      <FlowLayout backHref="/evaluator/dashboard" backLabel="Volver al menu" maxWidth="full">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Cargando dashboard organizacional...</p>
          </div>
        </div>
      </FlowLayout>
    );
  }

  const selectedEval = evaluations.find(e => e.id === selectedEvaluation);

  return (
    <FlowLayout backHref="/evaluator/dashboard" backLabel="Volver al menu" maxWidth="full">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <Building2 className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Dashboard Organizacional BRS</h1>
                <p className="text-sm text-gray-600">Análisis Consolidado de Riesgo Psicosocial</p>
              </div>
            </div>
            <div className="flex space-x-4">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Actualizar
              </button>
              <button
                onClick={() => router.push('/evaluator/dashboard')}
                className="px-4 py-2 text-gray-600 hover:text-gray-900 transition"
              >
                Volver al Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Evaluation Selector */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Seleccionar Evaluación para Análisis Organizacional
          </label>
          <select
            value={selectedEvaluation || ''}
            onChange={(e) => setSelectedEvaluation(Number(e.target.value))}
            className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Seleccione una evaluación</option>
            {evaluations.map((evaluation) => (
              <option key={evaluation.id} value={evaluation.id}>
                {evaluation.name} ({evaluation.completionRate}% completado)
              </option>
            ))}
          </select>
        </div>

        {selectedEval && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Participantes</p>
                    <p className="text-3xl font-bold text-gray-900">{selectedEval.totalParticipants}</p>
                  </div>
                  <Users className="h-8 w-8 text-blue-500" />
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Evaluaciones Completadas</p>
                    <p className="text-3xl font-bold text-gray-900">{selectedEval.completedParticipants}</p>
                    <p className="text-sm text-green-600">{selectedEval.completionRate}%</p>
                  </div>
                  <Activity className="h-8 w-8 text-green-500" />
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Nivel de Riesgo Promedio</p>
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getRiskBadgeClass(selectedEval.averageRiskLevel)}`}>
                      {RISK_LABELS[selectedEval.averageRiskLevel as keyof typeof RISK_LABELS]}
                    </span>
                  </div>
                  <Target className="h-8 w-8 text-orange-500" />
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Participantes en Riesgo Alto</p>
                    <p className="text-3xl font-bold text-red-600">{selectedEval.criticalParticipants}</p>
                    <p className="text-sm text-gray-500">Requieren intervención</p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-red-500" />
                </div>
              </div>
            </div>

            {metrics && (
              <>
                {/* Critical Areas Alert */}
                {metrics.criticalAreas.length > 0 && (
                  <div className="mb-8 p-6 border border-red-200 rounded-lg bg-red-50">
                    <div className="flex items-center mb-4">
                      <AlertTriangle className="h-6 w-6 text-red-600 mr-2" />
                      <h3 className="text-lg font-semibold text-red-900">Áreas Críticas Identificadas</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {metrics.criticalAreas.map((area, index) => (
                        <div key={index} className="bg-white rounded p-3 border border-red-200">
                          <span className="text-sm font-medium text-red-800">
                            {area}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Charts Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                  {/* Risk Distribution */}
                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Distribución de Riesgo Organizacional</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <RePieChart>
                        <Pie
                          data={prepareRiskDistributionData()}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(1)}%)`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {prepareRiskDistributionData().map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </RePieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Top Risk Dimensions */}
                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Dimensiones de Mayor Riesgo</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={prepareTopDimensionsData()}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="name" 
                          angle={-45}
                          textAnchor="end"
                          height={80}
                          fontSize={11}
                        />
                        <YAxis domain={[0, 100]} />
                        <Tooltip 
                          formatter={(value, name) => [
                            name === 'score' ? `${value}%` : value,
                            name === 'score' ? 'Puntaje Promedio' : 'Participantes'
                          ]}
                        />
                        <Bar dataKey="score" name="score" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Detailed Dimensions Table */}
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <div className="px-6 py-4 border-b">
                    <h3 className="text-lg font-semibold text-gray-900">Análisis Detallado por Dimensión</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Dimensión
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Puntaje Promedio
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Nivel de Riesgo
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Participantes Afectados
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Prioridad
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {metrics.topDimensions.map((dimension, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {dimension.dimension}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {dimension.averageScore.toFixed(1)}%
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 py-1 text-xs font-medium rounded ${getRiskBadgeClass(dimension.riskLevel)}`}>
                                {RISK_LABELS[dimension.riskLevel as keyof typeof RISK_LABELS]}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {dimension.affectedParticipants}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {dimension.riskLevel === 'riesgo_muy_alto' ? (
                                <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  Crítica
                                </span>
                              ) : dimension.riskLevel === 'riesgo_alto' ? (
                                <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-orange-100 text-orange-800 rounded">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  Alta
                                </span>
                              ) : dimension.riskLevel === 'riesgo_medio' ? (
                                <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded">
                                  <TrendingUp className="h-3 w-3 mr-1" />
                                  Media
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">
                                  <Shield className="h-3 w-3 mr-1" />
                                  Baja
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </FlowLayout>
  );
}