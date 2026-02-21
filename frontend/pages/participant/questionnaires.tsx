import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import FlowLayout from '../../components/FlowLayout';
import FlowQuestion from '../../components/FlowQuestion';
import FlowOption from '../../components/FlowOption';

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

      const questionnairesResponse = await fetch('/api/questionnaires/', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!questionnairesResponse.ok) {
        throw new Error('Error al cargar cuestionarios');
      }

      const questionnairesData = await questionnairesResponse.json();

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

    const totalQuestions = currentQuestionnaire?.questionnaire.total_preguntas || 0;
    const completedQuestions = Object.keys(newResponses).length;
    setProgress((completedQuestions / totalQuestions) * 100);

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

      setSuccess('Respuestas guardadas automaticamente');
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
      value: options.length - 1 - index
    }));
  };

  if (loading) {
    return (
      <FlowLayout showBack={!currentQuestionnaire}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </FlowLayout>
    );
  }

  if (!participant) {
    return (
      <FlowLayout showBack={false}>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <h2 className="text-lg font-medium text-red-800 mb-2">Error</h2>
          <p className="text-red-600">No se encontraron datos del participante.</p>
        </div>
      </FlowLayout>
    );
  }

  // Questionnaire selection view (Typeform style)
  if (!currentQuestionnaire) {
    const letters = ['A', 'B', 'C', 'D', 'E'];
    const pendingCount = availableQuestionnaires.length;

    return (
      <FlowLayout showBack={false}>
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800">
            {success}
          </div>
        )}

        <FlowQuestion
          greeting={`Hola, ${participant.firstName}`}
          question={`Tienes ${pendingCount} cuestionarios disponibles`}
          subtitle={`Forma asignada: ${participant.formType} - ${participant.formType === 'A' ? 'Jefes, profesionales y tecnicos' : 'Auxiliares y operarios'}`}
        />

        <div className="space-y-3">
          {availableQuestionnaires.map((questionnaire, index) => (
            <FlowOption
              key={questionnaire.id}
              letter={letters[index]}
              title={questionnaire.name}
              description={`${questionnaire.totalQuestions} preguntas`}
              onClick={() => loadQuestionnaire(questionnaire.id)}
            />
          ))}
        </div>
      </FlowLayout>
    );
  }

  // Questionnaire taking view
  return (
    <FlowLayout
      showBack={true}
      backLabel="Volver a cuestionarios"
      backHref="#"
      maxWidth="3xl"
    >
      {/* Override back to return to selection instead of navigating */}
      <div className="mb-6">
        <button
          onClick={() => setCurrentQuestionnaire(null)}
          className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          &larr; Volver a cuestionarios
        </button>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800">
          {success}
        </div>
      )}

      {/* Header with progress */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">
            {currentQuestionnaire.questionnaire.nombre}
          </h2>
          <span className="text-sm text-gray-500">
            Pagina {Math.floor(currentQuestionIndex / QUESTIONS_PER_PAGE) + 1} de {Math.ceil((currentQuestionnaire.questionnaire.total_preguntas || 0) / QUESTIONS_PER_PAGE)}
          </span>
        </div>

        {currentQuestionnaire.questionnaire.instrucciones && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <p className="text-blue-800 text-sm">
              {currentQuestionnaire.questionnaire.instrucciones}
            </p>
          </div>
        )}

        {/* Progress bar */}
        <div>
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
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="space-y-8">
          {getCurrentPageQuestions().map((question: Question) => (
            <div key={question.numero} className="border-b border-gray-100 last:border-b-0 pb-6 last:pb-0">
              <div className="mb-4">
                <h3 className="text-lg font-medium text-gray-900 mb-1">
                  {question.numero}. {question.pregunta}
                </h3>
              </div>

              <div className="grid gap-2">
                {getResponseOptions().map((option) => (
                  <label
                    key={option.value}
                    className={`flex items-center p-3 border-2 rounded-lg cursor-pointer transition-all ${
                      responses[`q_${question.numero}`] === option.value
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
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
          className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          &larr; Anterior
        </button>

        {canNavigateNext() ? (
          <button
            onClick={goToNextPage}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Siguiente &rarr;
          </button>
        ) : (
          <button
            onClick={submitQuestionnaire}
            disabled={isSubmitting || progress < 100}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? 'Enviando...' : 'Finalizar Cuestionario'}
          </button>
        )}
      </div>
    </FlowLayout>
  );
};

export default QuestionnairesPage;
