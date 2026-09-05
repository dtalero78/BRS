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

      // Sin `limit` el backend devuelve solo 10 (su default), asi que esta
      // pantalla no paginada dejaba fuera las evaluaciones mas antiguas: los
      // contadores marcaban 10/10/10 y los participantes de las evaluaciones
      // ocultas no aparecian en el selector del informe individual.
      const evaluationsResponse = await fetch(`${apiUrl}/api/evaluations?limit=500`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (evaluationsResponse.ok) {
        const evaluationsData = await evaluationsResponse.json();
        const evaluationsArray = Array.isArray(evaluationsData) ? evaluationsData : evaluationsData.evaluations || [];
        setEvaluations(evaluationsArray);

        const allParticipantsData: Participant[] = [];
        let totalParticipants = 0;
        let completedParticipants = 0;

        // Una peticion por evaluacion, en lotes paralelos. En serie eran tantas
        // esperas encadenadas como evaluaciones tuviera el evaluador, y al subir
        // el tope a 500 eso volveria la pantalla inusable.
        const LOTE = 8;
        const pedirParticipantes = async (evaluation: Evaluation) => {
          try {
            const participantsResponse = await fetch(`${apiUrl}/api/participants/evaluation/${evaluation.id}?limit=1000`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!participantsResponse.ok) return [];
            const participantsData = await participantsResponse.json();
            const participantsArray = Array.isArray(participantsData) ? participantsData : participantsData.participants || [];

            // Etiquetamos cada participante con su evaluación para poder
            // filtrarlos después (el endpoint no devuelve el evaluation_id).
            return participantsArray.map((p: Participant) => ({ ...p, evaluationId: evaluation.id }));
          } catch (error) {
            console.error(`Error fetching participants for evaluation ${evaluation.id}:`, error);
            return [];
          }
        };

        for (let i = 0; i < evaluationsArray.length; i += LOTE) {
          const lote = evaluationsArray.slice(i, i + LOTE);
          const resultados = await Promise.all(lote.map(pedirParticipantes));
          for (const grupo of resultados) {
            allParticipantsData.push(...grupo);
            totalParticipants += grupo.length;
            completedParticipants += grupo.filter((p: Participant) => p.status === 'completed').length;
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
