import { useState, useEffect } from 'react';
import FlowLayout from '../../components/FlowLayout';
import ReportGenerator from '../../components/ReportGenerator';

import { API_URL } from '../../config/api';

interface Evaluation {
  id: string;
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  status: string;
}

interface Participant {
  id: string;
  participant_evaluation_id: string;
  evaluationId?: string | number;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  hasResults: boolean;
  completed_at: string;
  completedAt: string;
}

export default function ReportsPage() {
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [allParticipants, setAllParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalEvaluations: 0,
    totalParticipants: 0,
    completedParticipants: 0
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const apiUrl = API_URL;

      const evaluationsResponse = await fetch(`${apiUrl}/api/evaluations`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (evaluationsResponse.ok) {
        const evaluationsData = await evaluationsResponse.json();
        const evaluationsArray = Array.isArray(evaluationsData) ? evaluationsData : evaluationsData.evaluations || [];
        setEvaluations(evaluationsArray);

        const allParticipantsData: Participant[] = [];
        let totalParticipants = 0;
        let completedParticipants = 0;

        for (const evaluation of evaluationsArray) {
          try {
            const participantsResponse = await fetch(`${apiUrl}/api/participants/evaluation/${evaluation.id}?limit=1000`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });

            if (participantsResponse.ok) {
              const participantsData = await participantsResponse.json();
              const participantsArray = Array.isArray(participantsData) ? participantsData : participantsData.participants || [];

              // Etiquetamos cada participante con su evaluación para poder
              // filtrarlos después (el endpoint no devuelve el evaluation_id).
              allParticipantsData.push(
                ...participantsArray.map((p: Participant) => ({ ...p, evaluationId: evaluation.id }))
              );
              totalParticipants += participantsArray.length;
              completedParticipants += participantsArray.filter((p: Participant) => p.status === 'completed').length;
            }
          } catch (error) {
            console.error(`Error fetching participants for evaluation ${evaluation.id}:`, error);
          }
        }

        setAllParticipants(allParticipantsData);

        setStats({
          totalEvaluations: evaluationsArray.length,
          totalParticipants,
          completedParticipants
        });
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <FlowLayout backHref="/evaluator/dashboard" backLabel="Volver al menu">
        <div className="flex h-64 items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
        </div>
      </FlowLayout>
    );
  }

  return (
    <FlowLayout backHref="/evaluator/dashboard" backLabel="Volver al menu">
      {/* Encabezado */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Reportes</h1>
        <p className="mt-1 text-gray-500">
          Informes PDF según la metodología oficial del Ministerio de la Protección Social
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <span className="text-gray-500">
            <strong className="font-semibold text-gray-900">{stats.totalEvaluations}</strong> evaluaciones
          </span>
          <span className="h-4 w-px bg-gray-200" />
          <span className="text-gray-500">
            <strong className="font-semibold text-gray-900">{stats.totalParticipants}</strong> participantes
          </span>
          <span className="h-4 w-px bg-gray-200" />
          <span className="text-gray-500">
            <strong className="font-semibold text-gray-900">{stats.completedParticipants}</strong> completados
          </span>
        </div>
      </div>

      <ReportGenerator
        evaluations={evaluations}
        participants={allParticipants}
      />
    </FlowLayout>
  );
}
