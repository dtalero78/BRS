import { useState, useEffect } from 'react';
import FlowLayout from '../../components/FlowLayout';
import FlowQuestion from '../../components/FlowQuestion';
import FlowOption from '../../components/FlowOption';
import FlowStats from '../../components/FlowStats';
import useFlowKeyboard from '../../hooks/useFlowKeyboard';
import {
  DocumentTextIcon,
  UserGroupIcon,
  ChartBarIcon,
  DocumentChartBarIcon,
  BuildingOfficeIcon,
} from '@heroicons/react/24/outline';

import { API_URL } from '../../config/api';

interface DashboardStats {
  totalEvaluations: number;
  activeEvaluations: number;
  totalParticipants: number;
  completedAssessments: number;
  pendingAssessments: number;
  averageCompletion: number;
  totalCompanies: number;
}

export default function EvaluatorDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalEvaluations: 0,
    activeEvaluations: 0,
    totalParticipants: 0,
    completedAssessments: 0,
    pendingAssessments: 0,
    averageCompletion: 0,
    totalCompanies: 0,
  });
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      try { setUser(JSON.parse(userData)); } catch {}
    }
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/evaluator/dashboard`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useFlowKeyboard([
    { key: 'A', href: '/evaluator/companies' },
    { key: 'B', href: '/evaluator/evaluations' },
    { key: 'C', href: '/evaluator/participants' },
    { key: 'D', href: '/evaluator/results' },
    { key: 'E', href: '/evaluator/reports' },
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

  const subtitle = stats.activeEvaluations > 0 || stats.pendingAssessments > 0
    ? `Tienes ${stats.activeEvaluations} evaluacion${stats.activeEvaluations !== 1 ? 'es' : ''} activa${stats.activeEvaluations !== 1 ? 's' : ''} y ${stats.pendingAssessments} participante${stats.pendingAssessments !== 1 ? 's' : ''} pendiente${stats.pendingAssessments !== 1 ? 's' : ''}`
    : undefined;

  return (
    <FlowLayout showBack={false}>
      <FlowQuestion
        question="¿Qué deseas hacer?"
        subtitle={subtitle}
      />

      <div className="space-y-3">
        <FlowOption
          letter="A"
          title="Empresas"
          description="Crear y gestionar las empresas a las que les aplicas baterías"
          href="/evaluator/companies"
          icon={BuildingOfficeIcon}
          badge={`${stats.totalCompanies} empresas`}
        />

        <FlowOption
          letter="B"
          title="Evaluaciones"
          description="Crear, ver y editar evaluaciones de riesgo psicosocial"
          href="/evaluator/evaluations"
          icon={DocumentTextIcon}
          badge={`${stats.activeEvaluations} activas`}
          badgeColor="blue"
        />

        <FlowOption
          letter="C"
          title="Participantes"
          description="Agregar participantes y asignar a evaluaciones"
          href="/evaluator/participants"
          icon={UserGroupIcon}
          badge={`${stats.totalParticipants} registrados`}
        />

        <FlowOption
          letter="D"
          title="Resultados"
          description="Ver, calcular y explorar resultados por participante"
          href="/evaluator/results"
          icon={ChartBarIcon}
          badge={`${stats.completedAssessments} completados`}
          badgeColor="green"
        />

        <FlowOption
          letter="E"
          title="Reportes PDF"
          description="Generar reportes individuales y organizacionales"
          href="/evaluator/reports"
          icon={DocumentChartBarIcon}
        />
      </div>

      <FlowStats stats={[
        { label: 'Empresas', value: stats.totalCompanies },
        { label: 'Evaluaciones', value: stats.totalEvaluations },
        { label: 'Participantes', value: stats.totalParticipants },
        { label: 'Completados', value: stats.completedAssessments },
      ]} />
    </FlowLayout>
  );
}
