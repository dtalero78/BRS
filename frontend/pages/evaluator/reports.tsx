import { useState, useEffect } from 'react';
import FlowLayout from '../../components/FlowLayout';
import ReportGenerator from '../../components/ReportGenerator';
import { FileText, Calendar, Users, TrendingUp } from 'lucide-react';

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
    completedEvaluations: 0,
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

      // Fetch evaluations
      const evaluationsResponse = await fetch(`${apiUrl}/api/evaluations`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (evaluationsResponse.ok) {
        const evaluationsData = await evaluationsResponse.json();
        const evaluationsArray = Array.isArray(evaluationsData) ? evaluationsData : evaluationsData.evaluations || [];
        setEvaluations(evaluationsArray);

        // Fetch participants for all evaluations
        const allParticipantsData: Participant[] = [];
        let totalParticipants = 0;
        let completedParticipants = 0;

        for (const evaluation of evaluationsArray) {
          try {
            const participantsResponse = await fetch(`${apiUrl}/api/participants/evaluation/${evaluation.id}?limit=100`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });

            if (participantsResponse.ok) {
              const participantsData = await participantsResponse.json();
              const participantsArray = Array.isArray(participantsData) ? participantsData : participantsData.participants || [];
              
              allParticipantsData.push(...participantsArray);
              totalParticipants += participantsArray.length;
              completedParticipants += participantsArray.filter((p: Participant) => p.status === 'completed').length;
            }
          } catch (error) {
            console.error(`Error fetching participants for evaluation ${evaluation.id}:`, error);
          }
        }

        setAllParticipants(allParticipantsData);

        // Calculate stats
        setStats({
          totalEvaluations: evaluationsArray.length,
          completedEvaluations: evaluationsArray.filter(e => e.status === 'completed').length,
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
      <FlowLayout backHref="/evaluator/dashboard" backLabel="Volver al menu" maxWidth="full">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </FlowLayout>
    );
  }

  return (
    <FlowLayout backHref="/evaluator/dashboard" backLabel="Volver al menu" maxWidth="full">
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-lg shadow-lg p-6 text-white">
          <h2 className="text-2xl font-bold mb-2">
            Sistema de Reportes
          </h2>
          <p className="text-blue-100">
            Genera reportes profesionales basados en la metodología oficial del Ministerio de la Protección Social
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex items-center">
              <div className="p-3 rounded-lg bg-blue-100">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">
                  Total Evaluaciones
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.totalEvaluations}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex items-center">
              <div className="p-3 rounded-lg bg-green-100">
                <Calendar className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">
                  Evaluaciones Completadas
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.completedEvaluations}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex items-center">
              <div className="p-3 rounded-lg bg-purple-100">
                <Users className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">
                  Total Participantes
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.totalParticipants}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex items-center">
              <div className="p-3 rounded-lg bg-orange-100">
                <TrendingUp className="h-6 w-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">
                  Evaluaciones Completadas
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.completedParticipants}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Report Types Info */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Tipos de Reportes Disponibles
            </h3>
            
            <div className="space-y-4">
              <div className="border-l-4 border-blue-500 pl-4">
                <h4 className="font-medium text-gray-900">Reporte Individual</h4>
                <p className="text-sm text-gray-600 mt-1">
                  Análisis detallado de un participante específico con resultados por dimensiones, 
                  dominios y recomendaciones personalizadas basadas en los cuestionarios BRS.
                </p>
                <ul className="text-xs text-gray-500 mt-2 list-disc list-inside">
                  <li>Información demográfica del participante</li>
                  <li>Resultados por cuestionario (Forma A/B, Extralaboral, Estrés)</li>
                  <li>Clasificación de riesgo por dimensiones y dominios</li>
                  <li>Interpretación profesional y recomendaciones</li>
                </ul>
              </div>

              <div className="border-l-4 border-green-500 pl-4">
                <h4 className="font-medium text-gray-900">Reporte Organizacional</h4>
                <p className="text-sm text-gray-600 mt-1">
                  Análisis consolidado de toda la evaluación con estadísticas organizacionales, 
                  distribución de riesgo y recomendaciones para la empresa.
                </p>
                <ul className="text-xs text-gray-500 mt-2 list-disc list-inside">
                  <li>Estadísticas generales de la evaluación</li>
                  <li>Distribución de niveles de riesgo</li>
                  <li>Análisis por departamentos o grupos</li>
                  <li>Recomendaciones organizacionales prioritarias</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Características del Sistema
            </h3>
            
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">Metodología Oficial</p>
                  <p className="text-xs text-gray-600">
                    Basado en la Batería de Riesgo Psicosocial del Ministerio de la Protección Social (Resolución 2646 de 2008)
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">Cálculos Automáticos</p>
                  <p className="text-xs text-gray-600">
                    Transformación automática de puntajes y clasificación según baremos oficiales
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">Formato Profesional</p>
                  <p className="text-xs text-gray-600">
                    Reportes en PDF con diseño profesional, gráficos y interpretaciones especializadas
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-orange-500 rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">Recomendaciones Automáticas</p>
                  <p className="text-xs text-gray-600">
                    Sugerencias de intervención basadas en los niveles de riesgo identificados
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Report Generator */}
        <ReportGenerator 
          evaluations={evaluations}
          participants={allParticipants}
        />

        {/* Usage Instructions */}
        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Instrucciones de Uso
          </h3>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Para Reportes Individuales:</h4>
              <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
                <li>Selecciona "Reporte Individual"</li>
                <li>Elige la evaluación de interés</li>
                <li>Selecciona el participante específico</li>
                <li>Configura las opciones del reporte</li>
                <li>Haz clic en "Generar Reporte PDF"</li>
              </ol>
            </div>
            
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Para Reportes Organizacionales:</h4>
              <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
                <li>Selecciona "Reporte Organizacional"</li>
                <li>Elige la evaluación a analizar</li>
                <li>Configura las opciones avanzadas si es necesario</li>
                <li>Haz clic en "Generar Reporte PDF"</li>
                <li>El reporte incluirá todos los participantes completados</li>
              </ol>
            </div>
          </div>
          
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-800">
              <strong>Nota:</strong> Los reportes se generan en tiempo real y incluyen solo participantes 
              que hayan completado al menos un cuestionario. El proceso puede tomar algunos segundos 
              dependiendo de la cantidad de datos.
            </p>
          </div>
        </div>
      </div>
    </FlowLayout>
  );
}