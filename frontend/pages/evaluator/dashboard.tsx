import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { 
  DocumentTextIcon, 
  UserGroupIcon, 
  ChartBarIcon, 
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

interface DashboardStats {
  totalEvaluations: number;
  activeEvaluations: number;
  totalParticipants: number;
  completedAssessments: number;
  pendingAssessments: number;
  averageCompletion: number;
}

export default function EvaluatorDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalEvaluations: 0,
    activeEvaluations: 0,
    totalParticipants: 0,
    completedAssessments: 0,
    pendingAssessments: 0,
    averageCompletion: 0,
  });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/evaluator/dashboard', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
        setRecentActivity(data.recentActivity || []);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      name: 'Evaluaciones Totales',
      value: stats.totalEvaluations,
      icon: DocumentTextIcon,
      color: 'text-blue-600',
      bg: 'bg-blue-100',
    },
    {
      name: 'Evaluaciones Activas',
      value: stats.activeEvaluations,
      icon: ClockIcon,
      color: 'text-green-600',
      bg: 'bg-green-100',
    },
    {
      name: 'Participantes',
      value: stats.totalParticipants,
      icon: UserGroupIcon,
      color: 'text-purple-600',
      bg: 'bg-purple-100',
    },
    {
      name: 'Evaluaciones Completadas',
      value: stats.completedAssessments,
      icon: CheckCircleIcon,
      color: 'text-green-600',
      bg: 'bg-green-100',
    },
    {
      name: 'Evaluaciones Pendientes',
      value: stats.pendingAssessments,
      icon: ExclamationTriangleIcon,
      color: 'text-orange-600',
      bg: 'bg-orange-100',
    },
    {
      name: 'Promedio de Completado',
      value: `${stats.averageCompletion}%`,
      icon: ChartBarIcon,
      color: 'text-indigo-600',
      bg: 'bg-indigo-100',
    },
  ];

  if (loading) {
    return (
      <Layout title="Dashboard">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Dashboard del Evaluador">
      <div className="space-y-6">
        {/* Welcome Message */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-lg shadow-lg p-6 text-white">
          <h2 className="text-2xl font-bold mb-2">
            Bienvenido al Sistema BRS Digital
          </h2>
          <p className="text-blue-100">
            Gestiona evaluaciones psicosociales con la metodología oficial del Ministerio de la Protección Social
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {statCards.map((stat, index) => (
            <div key={index} className="card">
              <div className="flex items-center">
                <div className={`p-3 rounded-lg ${stat.bg}`}>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">
                    {stat.name}
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {stat.value}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Acciones Rápidas
            </h3>
            <div className="space-y-3">
              <button className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                <div className="flex items-center">
                  <DocumentTextIcon className="h-5 w-5 text-blue-600 mr-3" />
                  <span className="font-medium">Crear Nueva Evaluación</span>
                </div>
              </button>
              <button className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                <div className="flex items-center">
                  <UserGroupIcon className="h-5 w-5 text-green-600 mr-3" />
                  <span className="font-medium">Gestionar Participantes</span>
                </div>
              </button>
              <button className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                <div className="flex items-center">
                  <ChartBarIcon className="h-5 w-5 text-purple-600 mr-3" />
                  <span className="font-medium">Ver Resultados</span>
                </div>
              </button>
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Cuestionarios BRS
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div>
                  <div className="font-medium text-blue-900">Forma A</div>
                  <div className="text-sm text-blue-700">123 preguntas - Jefes y profesionales</div>
                </div>
                <div className="text-blue-600 font-bold">19 dimensiones</div>
              </div>
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div>
                  <div className="font-medium text-green-900">Forma B</div>
                  <div className="text-sm text-green-700">97 preguntas - Auxiliares y operarios</div>
                </div>
                <div className="text-green-600 font-bold">15 dimensiones</div>
              </div>
              <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                <div>
                  <div className="font-medium text-purple-900">Extralaboral</div>
                  <div className="text-sm text-purple-700">31 preguntas - Factores externos</div>
                </div>
                <div className="text-purple-600 font-bold">7 dimensiones</div>
              </div>
              <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                <div>
                  <div className="font-medium text-orange-900">Estrés</div>
                  <div className="text-sm text-orange-700">31 síntomas - Evaluación específica</div>
                </div>
                <div className="text-orange-600 font-bold">4 categorías</div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        {recentActivity.length > 0 && (
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Actividad Reciente
            </h3>
            <div className="space-y-3">
              {recentActivity.slice(0, 5).map((activity, index) => (
                <div key={index} className="flex items-center p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {activity.description}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(activity.created_at).toLocaleDateString('es-ES')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}