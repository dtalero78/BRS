import { useState, useEffect } from 'react';
import FlowLayout from '../../components/FlowLayout';
import FlowQuestion from '../../components/FlowQuestion';
import FlowOption from '../../components/FlowOption';
import FlowStats from '../../components/FlowStats';
import useFlowKeyboard from '../../hooks/useFlowKeyboard';
import {
  BuildingOfficeIcon,
  UserGroupIcon,
  Cog6ToothIcon,
  CheckCircleIcon,
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
  const [showSystem, setShowSystem] = useState(false);
  const [loadingBaremos, setLoadingBaremos] = useState(false);
  const [loadingQuestionnaires, setLoadingQuestionnaires] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      try { setUser(JSON.parse(userData)); } catch {}
    }
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
        toast.success('Baremos oficiales cargados exitosamente');
        fetchSystemConfigs();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Error cargando baremos');
      }
    } catch (error) {
      toast.error('Error de conexion');
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
        toast.success('Datos de cuestionarios cargados exitosamente');
        fetchSystemConfigs();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Error cargando cuestionarios');
      }
    } catch (error) {
      toast.error('Error de conexion');
    } finally {
      setLoadingQuestionnaires(false);
    }
  };

  useFlowKeyboard([
    { key: 'A', href: '/admin/companies' },
    { key: 'B', href: '/admin/users' },
    { key: 'C', onClick: () => setShowSystem(!showSystem) },
  ]);

  if (loading) {
    return (
      <FlowLayout showBack={false}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </FlowLayout>
    );
  }

  return (
    <FlowLayout showBack={false}>
      <FlowQuestion
        greeting={`Hola, ${user?.email || 'Admin'}`}
        question="Que deseas hacer?"
      />

      <div className="space-y-3">
        <FlowOption
          letter="A"
          title="Gestionar Empresas"
          description="Crear, editar y administrar empresas registradas"
          href="/admin/companies"
          icon={BuildingOfficeIcon}
          badge={`${stats.totalCompanies} registradas`}
        />

        <FlowOption
          letter="B"
          title="Gestionar Usuarios"
          description="Administrar usuarios del sistema"
          href="/admin/users"
          icon={UserGroupIcon}
          badge={`${stats.totalUsers} activos`}
        />

        <FlowOption
          letter="C"
          title="Estado del Sistema"
          description="Salud del sistema, baremos y configuraciones"
          onClick={() => setShowSystem(!showSystem)}
          icon={Cog6ToothIcon}
          badge={stats.systemHealth.status === 'OK' ? 'OK' : 'Error'}
          badgeColor={stats.systemHealth.status === 'OK' ? 'green' : 'red'}
        />
      </div>

      {/* System panel (expandable) */}
      {showSystem && (
        <div className="mt-6 animate-slide-down space-y-4">
          {/* System health */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Estado del Sistema</h3>
            <div className="grid grid-cols-3 gap-4 text-center text-sm">
              <div>
                <p className="text-gray-500">Base de Datos</p>
                <p className={`font-medium ${stats.systemHealth.database === 'Connected' ? 'text-green-600' : 'text-red-600'}`}>
                  {stats.systemHealth.database === 'Connected' ? 'Conectada' : 'Error'}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Configuraciones</p>
                <p className="font-medium text-blue-600">
                  {stats.systemHealth.configs.filter(c => c.exists && c.hasValue).length} / {stats.systemHealth.configs.length}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Baremos</p>
                <p className="font-medium text-green-600">Cargados</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Acciones</h3>
            <div className="flex gap-3">
              <button
                onClick={loadBaremos}
                disabled={loadingBaremos}
                className="flex-1 btn-primary disabled:opacity-50"
              >
                {loadingBaremos ? 'Cargando...' : 'Cargar Baremos'}
              </button>
              <button
                onClick={loadQuestionnaires}
                disabled={loadingQuestionnaires}
                className="flex-1 btn-secondary disabled:opacity-50"
              >
                {loadingQuestionnaires ? 'Cargando...' : 'Cargar Cuestionarios'}
              </button>
            </div>
          </div>

          {/* Configs list */}
          {configs.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Configuraciones</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {configs.map((config, index) => (
                  <div key={index} className="flex items-center justify-between py-1.5 text-sm">
                    <span className="text-gray-700">{config.key}</span>
                    <div className="flex items-center gap-2">
                      {config.hasValue && (
                        <span className="text-xs text-gray-400">
                          {config.valueSize > 1000 ? `${Math.round(config.valueSize / 1024)}KB` : `${config.valueSize}B`}
                        </span>
                      )}
                      <CheckCircleIcon className={`h-4 w-4 ${config.hasValue ? 'text-green-500' : 'text-gray-300'}`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <FlowStats stats={[
        { label: 'Empresas', value: stats.totalCompanies },
        { label: 'Usuarios', value: stats.totalUsers },
        { label: 'Evaluaciones', value: stats.totalEvaluations },
        { label: 'Participantes', value: stats.totalParticipants },
      ]} />
    </FlowLayout>
  );
}
