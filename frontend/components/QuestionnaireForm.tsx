import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

interface Question {
  id: number;
  pregunta: string;
  dimension?: string;
  opciones_respuesta: Array<{
    valor: number;
    texto: string;
  }>;
}

interface QuestionnaireData {
  cuestionario: {
    tipo: string;
    titulo: string;
    instrucciones: string;
    total_preguntas: number;
  };
  preguntas: Question[];
}

interface QuestionnaireFormProps {
  participantEvaluationId: number;
  questionnaireType: string;
}

const QUESTIONS_PER_PAGE = 5;

export default function QuestionnaireForm({
  participantEvaluationId,
  questionnaireType,
}: QuestionnaireFormProps) {
  const router = useRouter();
  const [questionnaire, setQuestionnaire] = useState<QuestionnaireData | null>(null);
  const [responses, setResponses] = useState<Record<number, number>>({});
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { handleSubmit, register, watch, formState: { errors } } = useForm();

  useEffect(() => {
    fetchQuestionnaire();
    fetchExistingResponses();
  }, [questionnaireType]);

  const fetchQuestionnaire = async () => {
    try {
      const response = await fetch(`/api/questionnaires/${questionnaireType}`);
      if (response.ok) {
        const data = await response.json();
        setQuestionnaire(data);
      } else {
        toast.error('Error al cargar el cuestionario');
        router.back();
      }
    } catch (error) {
      toast.error('Error de conexión');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const fetchExistingResponses = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/responses/participant-evaluation/${participantEvaluationId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.responses) {
          setResponses(data.responses);
        }
      }
    } catch (error) {
      console.error('Error fetching existing responses:', error);
    }
  };

  const saveProgress = async () => {
    if (Object.keys(responses).length === 0) return;

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          participant_evaluation_id: participantEvaluationId,
          questionnaire_type: questionnaireType,
          responses: responses,
        }),
      });

      if (response.ok) {
        toast.success('Progreso guardado');
      } else {
        throw new Error('Error al guardar');
      }
    } catch (error) {
      toast.error('Error al guardar el progreso');
    } finally {
      setSaving(false);
    }
  };

  const submitQuestionnaire = async () => {
    if (!questionnaire) return;

    const totalQuestions = questionnaire.preguntas.length;
    const answeredQuestions = Object.keys(responses).length;

    if (answeredQuestions < totalQuestions) {
      toast.error(`Debes responder las ${totalQuestions} preguntas (${answeredQuestions}/${totalQuestions} respondidas)`);
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/responses/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          participant_evaluation_id: participantEvaluationId,
          questionnaire_type: questionnaireType,
          responses: responses,
        }),
      });

      if (response.ok) {
        toast.success('Cuestionario completado exitosamente');
        router.push('/participant/questionnaires');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Error al enviar el cuestionario');
      }
    } catch (error) {
      toast.error('Error de conexión');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResponseChange = (questionId: number, value: number) => {
    setResponses(prev => ({
      ...prev,
      [questionId]: value,
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!questionnaire) {
    return (
      <div className="text-center py-12">
        <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-red-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">
          Error al cargar el cuestionario
        </h3>
      </div>
    );
  }

  const totalPages = Math.ceil(questionnaire.preguntas.length / QUESTIONS_PER_PAGE);
  const currentQuestions = questionnaire.preguntas.slice(
    currentPage * QUESTIONS_PER_PAGE,
    (currentPage + 1) * QUESTIONS_PER_PAGE
  );
  const totalAnswered = Object.keys(responses).length;
  const progressPercentage = (totalAnswered / questionnaire.preguntas.length) * 100;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {questionnaire.cuestionario.titulo}
        </h1>
        
        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
            <span>Progreso: {totalAnswered} de {questionnaire.preguntas.length} preguntas</span>
            <span>{Math.round(progressPercentage)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="questionnaire-progress h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-blue-800 text-sm">
            {questionnaire.cuestionario.instrucciones}
          </p>
        </div>
      </div>

      {/* Questions */}
      <div className="space-y-6">
        {currentQuestions.map((question, index) => {
          const questionNumber = currentPage * QUESTIONS_PER_PAGE + index + 1;
          const isAnswered = responses[question.id] !== undefined;
          
          return (
            <div key={question.id} className={`card border-2 transition-colors ${
              isAnswered ? 'border-green-200 bg-green-50' : 'border-gray-200'
            }`}>
              <div className="flex items-start mb-4">
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  isAnswered ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'
                }`}>
                  {isAnswered ? <CheckCircleIcon className="h-5 w-5" /> : questionNumber}
                </div>
                <div className="ml-3 flex-1">
                  <h3 className="text-lg font-medium text-gray-900 mb-3">
                    {questionNumber}. {question.pregunta}
                  </h3>
                  {question.dimension && (
                    <div className="mb-3 text-xs text-gray-500 bg-gray-100 rounded px-2 py-1 inline-block">
                      Dimensión: {question.dimension}
                    </div>
                  )}
                </div>
              </div>

              {/* Answer Options */}
              <div className="ml-11 space-y-2">
                {question.opciones_respuesta.map((option) => (
                  <label
                    key={option.valor}
                    className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors hover:bg-gray-50 ${
                      responses[question.id] === option.valor 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200'
                    }`}
                  >
                    <input
                      type="radio"
                      value={option.valor}
                      checked={responses[question.id] === option.valor}
                      onChange={(e) => handleResponseChange(question.id, parseInt(e.target.value))}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <span className="ml-3 text-sm text-gray-700">
                      {option.texto}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8 pt-6 border-t">
        <div className="flex space-x-2">
          <button
            onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
            disabled={currentPage === 0}
            className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            <ChevronLeftIcon className="h-5 w-5 mr-1" />
            Anterior
          </button>
          
          <button
            onClick={saveProgress}
            disabled={saving}
            className="btn-secondary disabled:opacity-50 flex items-center"
          >
            {saving ? 'Guardando...' : 'Guardar Progreso'}
          </button>
        </div>

        <div className="text-sm text-gray-500">
          Página {currentPage + 1} de {totalPages}
        </div>

        <div className="flex space-x-2">
          {currentPage < totalPages - 1 ? (
            <button
              onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
              className="btn-primary flex items-center"
            >
              Siguiente
              <ChevronRightIcon className="h-5 w-5 ml-1" />
            </button>
          ) : (
            <button
              onClick={submitQuestionnaire}
              disabled={submitting || totalAnswered < questionnaire.preguntas.length}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {submitting ? 'Enviando...' : 'Completar Cuestionario'}
              <CheckCircleIcon className="h-5 w-5 ml-1" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}