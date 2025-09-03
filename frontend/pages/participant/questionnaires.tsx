import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';

interface Question {
  id: number;
  numero: number;
  pregunta: string;
  dimension?: string;
  dominio?: string;
}

interface QuestionnaireOption {
  label: string;
  value: number;
}

interface QuestionnaireData {
  type: string;
  questionnaire: {
    nombre: string;
    total_preguntas: number;
    instrucciones?: string;
    opciones_respuesta?: QuestionnaireOption[];
    secciones?: Question[];
    preguntas?: Question[];
  };
  opciones_respuesta: {
    escala_principal: string[];
    escala_estres: string[];
  };
}

interface ParticipantData {
  id: string;
  evaluationId: string;
  firstName: string;
  lastName: string;
  formType: 'A' | 'B';
}

const QuestionnairesPage = () => {
  const router = useRouter();
  const [participant, setParticipant] = useState<ParticipantData | null>(null);
  const [availableQuestionnaires, setAvailableQuestionnaires] = useState<any[]>([]);
  const [currentQuestionnaire, setCurrentQuestionnaire] = useState<QuestionnaireData | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [responses, setResponses] = useState<{[key: string]: number}>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);

  // Questions per page for pagination
  const QUESTIONS_PER_PAGE = 5;

  useEffect(() => {
    const participantId = router.query.participantId as string;
    if (participantId) {
      loadParticipantData(participantId);
    }
  }, [router.query.participantId]);

  const loadParticipantData = async (participantId: string) => {
    try {
      setLoading(true);
      
      // Get participant data
      const participantResponse = await fetch(`/api/participants/${participantId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!participantResponse.ok) {
        throw new Error('Error al cargar datos del participante');
      }

      const participantData = await participantResponse.json();
      setParticipant(participantData);

      // Load available questionnaires based on form type
      const questionnairesResponse = await fetch('/api/questionnaires/', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!questionnairesResponse.ok) {
        throw new Error('Error al cargar cuestionarios');
      }

      const questionnairesData = await questionnairesResponse.json();
      
      // Determine which questionnaires are available based on form type
      const available = [];
      
      if (participantData.formType === 'A') {
        available.push({
          id: 'forma-a',
          name: questionnairesData.questionnaires['forma-a'].nombre,
          description: questionnairesData.questionnaires['forma-a'].descripcion,
          totalQuestions: questionnairesData.questionnaires['forma-a'].total_preguntas
        });
      } else {
        available.push({
          id: 'forma-b',
          name: questionnairesData.questionnaires['forma-b'].nombre,
          description: questionnairesData.questionnaires['forma-b'].descripcion,
          totalQuestions: questionnairesData.questionnaires['forma-b'].total_preguntas
        });
      }

      // All participants get extralaboral and stress questionnaires
      available.push({
        id: 'extralaboral',
        name: questionnairesData.questionnaires['extralaboral'].nombre,
        description: questionnairesData.questionnaires['extralaboral'].descripcion,
        totalQuestions: questionnairesData.questionnaires['extralaboral'].total_preguntas
      });

      available.push({
        id: 'estres',
        name: questionnairesData.questionnaires['estres'].nombre,
        description: questionnairesData.questionnaires['estres'].descripcion,
        totalQuestions: questionnairesData.questionnaires['estres'].total_preguntas
      });

      setAvailableQuestionnaires(available);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const loadQuestionnaire = async (questionnaireId: string) => {
    try {
      setLoading(true);
      
      const response = await fetch(`/api/questionnaires/${questionnaireId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Error al cargar el cuestionario');
      }

      const data = await response.json();
      setCurrentQuestionnaire(data);
      setCurrentQuestionIndex(0);
      setResponses({});
      setProgress(0);
      
      // Load existing responses if any
      await loadExistingResponses(questionnaireId);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar cuestionario');
    } finally {
      setLoading(false);
    }
  };

  const loadExistingResponses = async (questionnaireId: string) => {
    if (!participant) return;

    try {
      const questionnaireTypeMap: {[key: string]: string} = {
        'forma-a': 'intralaboral_a',
        'forma-b': 'intralaboral_b',
        'extralaboral': 'extralaboral',
        'estres': 'stress'
      };

      const response = await fetch(
        `/api/responses/participant/${participant.id}?questionnaireType=${questionnaireTypeMap[questionnaireId]}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        const existingResponses = data.responses[questionnaireTypeMap[questionnaireId]] || [];
        
        const responseMap: {[key: string]: number} = {};
        existingResponses.forEach((resp: any) => {
          responseMap[`q_${resp.questionNumber}`] = resp.responseValue;
        });

        setResponses(responseMap);
        
        // Update progress
        const totalQuestions = currentQuestionnaire?.questionnaire.total_preguntas || 0;
        const completedQuestions = Object.keys(responseMap).length;
        setProgress((completedQuestions / totalQuestions) * 100);
      }
    } catch (err) {
      console.error('Error loading existing responses:', err);
    }
  };

  const handleResponseChange = (questionNumber: number, value: number) => {
    const key = `q_${questionNumber}`;
    const newResponses = { ...responses, [key]: value };
    setResponses(newResponses);

    // Update progress
    const totalQuestions = currentQuestionnaire?.questionnaire.total_preguntas || 0;
    const completedQuestions = Object.keys(newResponses).length;
    setProgress((completedQuestions / totalQuestions) * 100);

    // Auto-save after a short delay
    setTimeout(() => saveResponses(newResponses), 1000);
  };

  const saveResponses = async (responsesToSave = responses) => {
    if (!currentQuestionnaire || !participant) return;

    try {
      const questionnaireTypeMap: {[key: string]: string} = {
        'forma-a': 'intralaboral_a',
        'forma-b': 'intralaboral_b',
        'extralaboral': 'extralaboral',
        'estres': 'stress'
      };

      const questionsData = currentQuestionnaire.questionnaire.secciones || currentQuestionnaire.questionnaire.preguntas || [];
      const formattedResponses = Object.entries(responsesToSave).map(([key, value]) => {
        const questionNumber = parseInt(key.replace('q_', ''));
        const question = questionsData.find((q: Question) => q.numero === questionNumber);
        
        return {
          questionNumber,
          responseValue: value,
          dimension: question?.dimension || '',
          domain: question?.dominio || ''
        };
      });

      const response = await fetch('/api/responses/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          participantId: participant.id,
          questionnaireType: questionnaireTypeMap[currentQuestionnaire.type],
          responses: formattedResponses
        })
      });

      if (!response.ok) {
        throw new Error('Error al guardar respuestas');
      }

      setSuccess('Respuestas guardadas automáticamente');
      setTimeout(() => setSuccess(''), 2000);

    } catch (err) {
      console.error('Error saving responses:', err);
    }
  };

  const submitQuestionnaire = async () => {
    if (!currentQuestionnaire || !participant) return;

    setIsSubmitting(true);
    try {
      await saveResponses();
      setSuccess('Cuestionario completado exitosamente');
      
      // Return to questionnaire selection after 2 seconds
      setTimeout(() => {
        setCurrentQuestionnaire(null);
        setSuccess('');
      }, 2000);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar cuestionario');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getCurrentPageQuestions = () => {
    if (!currentQuestionnaire) return [];

    const questions = currentQuestionnaire.questionnaire.secciones || currentQuestionnaire.questionnaire.preguntas || [];
    const startIndex = currentQuestionIndex;
    const endIndex = Math.min(startIndex + QUESTIONS_PER_PAGE, questions.length);
    
    return questions.slice(startIndex, endIndex);
  };

  const canNavigateNext = () => {
    if (!currentQuestionnaire) return false;
    
    const questions = currentQuestionnaire.questionnaire.secciones || currentQuestionnaire.questionnaire.preguntas || [];
    return currentQuestionIndex + QUESTIONS_PER_PAGE < questions.length;
  };

  const canNavigatePrev = () => {
    return currentQuestionIndex > 0;
  };

  const goToNextPage = () => {
    if (canNavigateNext()) {
      setCurrentQuestionIndex(currentQuestionIndex + QUESTIONS_PER_PAGE);
    }
  };

  const goToPrevPage = () => {
    if (canNavigatePrev()) {
      setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - QUESTIONS_PER_PAGE));
    }
  };

  const getResponseOptions = () => {
    if (!currentQuestionnaire) return [];

    const isStressQuestionnaire = currentQuestionnaire.type === 'estres';
    const options = isStressQuestionnaire 
      ? currentQuestionnaire.opciones_respuesta.escala_estres
      : currentQuestionnaire.opciones_respuesta.escala_principal;

    return options.map((label: string, index: number) => ({
      label,
      value: options.length - 1 - index // Reverse scoring: Siempre=4, Nunca=0
    }));
  };
  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  if (!participant) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto mt-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-lg font-medium text-red-800 mb-2">Error</h2>
            <p className="text-red-600">No se encontraron datos del participante.</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto p-6">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-green-800">{success}</p>
              </div>
            </div>
          </div>
        )}

        {!currentQuestionnaire ? (
          // Questionnaire selection view
          <div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Evaluación de Riesgo Psicosocial
              </h1>
              <p className="text-gray-600 mb-4">
                Participante: {participant.firstName} {participant.lastName}
              </p>
              <p className="text-sm text-gray-500">
                Forma asignada: {participant.formType} 
                {participant.formType === 'A' ? ' (Jefes, profesionales y técnicos)' : ' (Auxiliares y operarios)'}
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {availableQuestionnaires.map((questionnaire) => (
                <div key={questionnaire.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {questionnaire.name}
                  </h3>
                  <p className="text-gray-600 mb-4">
                    {questionnaire.description}
                  </p>
                  <p className="text-sm text-gray-500 mb-4">
                    Total de preguntas: {questionnaire.totalQuestions}
                  </p>
                  <button
                    onClick={() => loadQuestionnaire(questionnaire.id)}
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-200"
                  >
                    Comenzar Cuestionario
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          // Questionnaire taking view
          <div>
            {/* Header with progress */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => setCurrentQuestionnaire(null)}
                  className="text-blue-600 hover:text-blue-800 font-medium"
                >
                  ← Volver a cuestionarios
                </button>
                <div className="text-sm text-gray-500">
                  Página {Math.floor(currentQuestionIndex / QUESTIONS_PER_PAGE) + 1} de {Math.ceil((currentQuestionnaire.questionnaire.total_preguntas || 0) / QUESTIONS_PER_PAGE)}
                </div>
              </div>

              <h2 className="text-xl font-bold text-gray-900 mb-2">
                {currentQuestionnaire.questionnaire.nombre}
              </h2>

              {currentQuestionnaire.questionnaire.instrucciones && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <p className="text-blue-800 text-sm">
                    {currentQuestionnaire.questionnaire.instrucciones}
                  </p>
                </div>
              )}

              {/* Progress bar */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Progreso</span>
                  <span className="text-sm font-medium text-gray-900">
                    {Math.round(progress)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              </div>
            </div>

            {/* Questions */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
              <div className="space-y-8">
                {getCurrentPageQuestions().map((question: Question) => (
                  <div key={question.numero} className="border-b border-gray-100 last:border-b-0 pb-6 last:pb-0">
                    <div className="mb-4">
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        {question.numero}. {question.pregunta}
                      </h3>
                      {question.dimension && (
                        <p className="text-sm text-gray-500">
                          Dimensión: {question.dimension}
                        </p>
                      )}
                    </div>

                    <div className="grid gap-2">
                      {getResponseOptions().map((option) => (
                        <label
                          key={option.value}
                          className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                        >
                          <input
                            type="radio"
                            name={`question_${question.numero}`}
                            value={option.value}
                            checked={responses[`q_${question.numero}`] === option.value}
                            onChange={() => handleResponseChange(question.numero, option.value)}
                            className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                          />
                          <span className="ml-3 text-gray-900">
                            {option.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center">
              <button
                onClick={goToPrevPage}
                disabled={!canNavigatePrev()}
                className="flex items-center px-4 py-2 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ← Página Anterior
              </button>

              {canNavigateNext() ? (
                <button
                  onClick={goToNextPage}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Página Siguiente →
                </button>
              ) : (
                <button
                  onClick={submitQuestionnaire}
                  disabled={isSubmitting || progress < 100}
                  className="flex items-center px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Enviando...
                    </>
                  ) : (
                    'Finalizar Cuestionario'
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default QuestionnairesPage;