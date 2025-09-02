import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import {
  BuildingOfficeIcon,
  UserGroupIcon,
  DocumentTextIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ServerIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface SystemStats {
  totalCompanies: number;
  totalUsers: number;
  totalEvaluations: number;
  totalParticipants: number;
  completedAssessments: number;
  pendingAssessments: number;
  systemHealth: {
    status: string;
    database: string;
    configs: Array<{
      key: string;
      exists: boolean;
      hasValue: boolean;
    }>;
  };
}

interface SystemConfig {
  key: string;
  description: string;
  hasValue: boolean;
  valueSize: number;
  updatedAt: string;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<SystemStats>({
    totalCompanies: 0,
    totalUsers: 0,
    totalEvaluations: 0,
    totalParticipants: 0,
    completedAssessments: 0,
    pendingAssessments: 0,
    systemHealth: {
      status: 'OK',
      database: 'Connected',
      configs: [],
    },
  });
  const [configs, setConfigs] = useState<SystemConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingBaremos, setLoadingBaremos] = useState(false);
  const [loadingQuestionnaires, setLoadingQuestionnaires] = useState(false);

  useEffect(() => {
    fetchDashboardData();
    fetchSystemConfigs();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('token');
      const [statsResponse, healthResponse] = await Promise.all([
        fetch('/api/admin/stats', {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch('/api/system/health', {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
      ]);

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(prev => ({ ...prev, ...statsData }));
      }

      if (healthResponse.ok) {
        const healthData = await healthResponse.json();
        setStats(prev => ({
          ...prev,
          systemHealth: healthData,
        }));
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSystemConfigs = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/system/config', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setConfigs(data.configs || []);
      }
    } catch (error) {
      console.error('Error fetching system configs:', error);
    }
  };

  const loadBaremos = async () => {
    setLoadingBaremos(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/system/load-baremos', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        toast.success('Baremos oficiales cargados exitosamente');
        console.log('Baremos loaded:', data);
        fetchSystemConfigs();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Error cargando baremos');
      }
    } catch (error) {
      toast.error('Error de conexión');
    } finally {
      setLoadingBaremos(false);
    }
  };

  const loadQuestionnaires = async () => {
    setLoadingQuestionnaires(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/system/load-questionnaires', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        toast.success('Datos de cuestionarios cargados exitosamente');
        console.log('Questionnaires loaded:', data);
        fetchSystemConfigs();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Error cargando cuestionarios');
      }
    } catch (error) {
      toast.error('Error de conexión');
    } finally {
      setLoadingQuestionnaires(false);
    }
  };

  const statCards = [
    {
      name: 'Empresas Registradas',
      value: stats.totalCompanies,
      icon: BuildingOfficeIcon,
      color: 'text-blue-600',
      bg: 'bg-blue-100',
    },
    {
      name: 'Usuarios Activos',
      value: stats.totalUsers,
      icon: UserGroupIcon,
      color: 'text-green-600',
      bg: 'bg-green-100',
    },
    {
      name: 'Evaluaciones Creadas',
      value: stats.totalEvaluations,
      icon: DocumentTextIcon,
      color: 'text-purple-600',
      bg: 'bg-purple-100',
    },
    {
      name: 'Participantes',
      value: stats.totalParticipants,
      icon: UserGroupIcon,
      color: 'text-orange-600',
      bg: 'bg-orange-100',
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
      color: 'text-yellow-600',
      bg: 'bg-yellow-100',
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
    <Layout title="Dashboard Administrativo">
      <div className="space-y-6">
        {/* Welcome */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-lg shadow-lg p-6 text-white">
          <h2 className="text-2xl font-bold mb-2">
            Panel de Administración BRS
          </h2>
          <p className="text-blue-100">
            Gestión del sistema de evaluación psicosocial con metodología oficial del Ministerio
          </p>
        </div>

        {/* System Health */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <ServerIcon className="h-6 w-6 mr-2" />
              Estado del Sistema
            </h3>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              stats.systemHealth.status === 'OK' 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              {stats.systemHealth.status}
            </span>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-sm text-gray-600">Base de Datos</div>
              <div className={`font-medium ${
                stats.systemHealth.database === 'Connected' 
                  ? 'text-green-600' 
                  : 'text-red-600'
              }`}>
                {stats.systemHealth.database}
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-600">Configuraciones</div>
              <div className="font-medium text-blue-600">
                {stats.systemHealth.configs.filter(c => c.exists && c.hasValue).length} de {stats.systemHealth.configs.length}
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-600">Baremos BRS</div>
              <div className="font-medium text-purple-600">
                Oficiales Cargados
              </div>
            </div>
          </div>
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

        {/* System Management */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Cog6ToothIcon className="h-6 w-6 mr-2" />
              Configuración del Sistema
            </h3>
            <div className="space-y-3">
              <button
                onClick={loadBaremos}
                disabled={loadingBaremos}
                className={`w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed ${
                  loadingBaremos ? 'opacity-75' : ''
                }`}
              >
                {loadingBaremos ? 'Cargando...' : 'Cargar Baremos Oficiales BRS'}
              </button>
              <button
                onClick={loadQuestionnaires}
                disabled={loadingQuestionnaires}
                className={`w-full btn-secondary disabled:opacity-50 disabled:cursor-not-allowed ${
                  loadingQuestionnaires ? 'opacity-75' : ''
                }`}
              >
                {loadingQuestionnaires ? 'Cargando...' : 'Cargar Datos de Cuestionarios'}
              </button>
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Configuraciones del Sistema
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {configs.map((config, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">
                      {config.key}
                    </div>
                    <div className="text-xs text-gray-500">
                      {config.description}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      config.hasValue 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {config.hasValue ? '✓' : '✗'}
                    </span>
                    {config.hasValue && (
                      <span className="text-xs text-gray-500">
                        {config.valueSize > 1000 
                          ? `${Math.round(config.valueSize / 1024)}KB`
                          : `${config.valueSize}B`}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* BRS Info */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Implementación BRS Oficial
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-600">282</div>
              <div className="text-sm text-gray-600">Preguntas Implementadas</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">45</div>
              <div className="text-sm text-gray-600">Dimensiones Totales</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-600">10</div>
              <div className="text-sm text-gray-600">Dominios Evaluados</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-600">5</div>
              <div className="text-sm text-gray-600">Niveles de Riesgo</div>
            </div>
          </div>
          <div className="mt-4 text-center">
            <p className="text-sm text-gray-600">
              Implementación completa con baremos oficiales del Ministerio de la Protección Social (Tablas 29-34)
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}