import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import { 
  DocumentTextIcon,
  ClockIcon,
  CheckCircleIcon,
  PlayIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';

interface QuestionnaireAssignment {
  id: number;
  questionnaire_type: 'intralaboral_a' | 'intralaboral_b' | 'extralaboral' | 'estres';
  status: 'pending' | 'in_progress' | 'completed';
  progress?: number;
  completed_at?: string;
  evaluation: {
    id: number;
    name: string;
    description: string;
  };
}

interface QuestionnaireInfo {
  type: string;
  name: string;
  description: string;
  totalQuestions: number;
  dimensions: number;
  color: string;
}

export default function ParticipantQuestionnaires() {
  const router = useRouter();
  const [assignments, setAssignments] = useState<QuestionnaireAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAssignments();
  }, []);

  const fetchAssignments = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/participant/questionnaires', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setAssignments(data.assignments || []);
      }
    } catch (error) {
      console.error('Error fetching assignments:', error);
    } finally {
      setLoading(false);
    }
  };

  const getQuestionnaireInfo = (type: string): QuestionnaireInfo => {
    const info: Record<string, QuestionnaireInfo> = {
      intralaboral_a: {
        type: 'intralaboral_a',
        name: 'Cuestionario Intralaboral Forma A',
        description: 'Para jefes, profesionales y técnicos. Evalúa factores de riesgo psicosocial dentro del trabajo.',
        totalQuestions: 123,
        dimensions: 19,
        color: 'blue',
      },
      intralaboral_b: {
        type: 'intralaboral_b',
        name: 'Cuestionario Intralaboral Forma B',
        description: 'Para auxiliares y operarios. Evalúa factores de riesgo psicosocial dentro del trabajo.',
        totalQuestions: 97,
        dimensions: 15,
        color: 'green',
      },
      extralaboral: {
        type: 'extralaboral',
        name: 'Cuestionario de Factores Extralaborales',
        description: 'Evalúa condiciones externas al trabajo que pueden afectar el desempeño laboral.',
        totalQuestions: 31,
        dimensions: 7,
        color: 'purple',
      },
      estres: {
        type: 'estres',
        name: 'Cuestionario para la Evaluación del Estrés',
        description: 'Identifica síntomas fisiológicos, de comportamiento social, intelectuales y psicoemocionales del estrés.',
        totalQuestions: 31,
        dimensions: 4,
        color: 'orange',
      },
    };
    
    return info[type] || info.intralaboral_a;
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'pending':
        return {
          label: 'Pendiente',
          icon: ClockIcon,
          className: 'text-yellow-600 bg-yellow-100',
          buttonText: 'Iniciar Cuestionario',
          buttonIcon: PlayIcon,
          buttonClass: 'btn-primary',
        };
      case 'in_progress':
        return {
          label: 'En Progreso',
          icon: DocumentTextIcon,
          className: 'text-blue-600 bg-blue-100',
          buttonText: 'Continuar',
          buttonIcon: PlayIcon,
          buttonClass: 'btn-primary',
        };
      case 'completed':
        return {
          label: 'Completado',
          icon: CheckCircleIcon,
          className: 'text-green-600 bg-green-100',
          buttonText: 'Ver Respuestas',
          buttonIcon: EyeIcon,
          buttonClass: 'btn-secondary',
        };
      default:
        return {
          label: 'Desconocido',
          icon: ClockIcon,
          className: 'text-gray-600 bg-gray-100',
          buttonText: 'Iniciar',
          buttonIcon: PlayIcon,
          buttonClass: 'btn-primary',
        };
    }
  };

  const handleQuestionnaireAction = (assignment: QuestionnaireAssignment) => {
    if (assignment.status === 'completed') {
      router.push(`/participant/questionnaires/${assignment.id}/responses`);
    } else {
      router.push(`/participant/questionnaires/${assignment.id}`);
    }
  };

  if (loading) {
    return (
      <Layout title="Cuestionarios">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Mis Cuestionarios">
      <div className="space-y-6">
        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-start">
            <DocumentTextIcon className="h-6 w-6 text-blue-600 mt-1 mr-3 flex-shrink-0" />
            <div>
              <h3 className="text-lg font-semibold text-blue-900 mb-2">
                Instrucciones para Completar los Cuestionarios
              </h3>
              <div className="text-blue-800 space-y-2 text-sm">
                <p>• Responde todas las preguntas de manera honesta y reflexiva</p>
                <p>• Puedes guardar tu progreso y continuar más tarde</p>
                <p>• Cada cuestionario evalúa diferentes aspectos de tu entorno laboral</p>
                <p>• Los resultados son confidenciales y se utilizan únicamente para fines evaluativos</p>
              </div>
            </div>
          </div>
        </div>

        {/* Questionnaire Cards */}
        <div className="grid gap-6">
          {assignments.length === 0 ? (
            <div className="text-center py-12">
              <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                No hay cuestionarios asignados
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Contacta a tu evaluador para que te asigne cuestionarios.
              </p>
            </div>
          ) : (
            assignments.map((assignment) => {
              const info = getQuestionnaireInfo(assignment.questionnaire_type);
              const status = getStatusInfo(assignment.status);
              
              return (
                <div key={assignment.id} className="card border-2 hover:border-gray-300 transition-colors">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center mb-2">
                        <h3 className="text-xl font-semibold text-gray-900">
                          {info.name}
                        </h3>
                        <span className={`ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status.className}`}>
                          <status.icon className="h-4 w-4 mr-1" />
                          {status.label}
                        </span>
                      </div>
                      <p className="text-gray-600 mb-3">
                        {info.description}
                      </p>
                      <div className="flex items-center space-x-6 text-sm text-gray-500">
                        <span>📋 {info.totalQuestions} preguntas</span>
                        <span>📊 {info.dimensions} dimensiones</span>
                        {assignment.status === 'in_progress' && assignment.progress && (
                          <span>⏳ {Math.round(assignment.progress)}% completado</span>
                        )}
                        {assignment.completed_at && (
                          <span>✅ Completado el {new Date(assignment.completed_at).toLocaleDateString('es-ES')}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar for in-progress questionnaires */}
                  {assignment.status === 'in_progress' && assignment.progress !== undefined && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                        <span>Progreso</span>
                        <span>{Math.round(assignment.progress)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="questionnaire-progress h-2 rounded-full transition-all duration-300"
                          style={{ width: `${assignment.progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Evaluation Info */}
                  <div className="bg-gray-50 rounded-lg p-3 mb-4">
                    <h4 className="font-medium text-gray-900 mb-1">
                      {assignment.evaluation.name}
                    </h4>
                    <p className="text-sm text-gray-600">
                      {assignment.evaluation.description}
                    </p>
                  </div>

                  {/* Action Button */}
                  <button
                    onClick={() => handleQuestionnaireAction(assignment)}
                    className={`w-full ${status.buttonClass} flex items-center justify-center`}
                  >
                    <status.buttonIcon className="h-5 w-5 mr-2" />
                    {status.buttonText}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </Layout>
  );
}