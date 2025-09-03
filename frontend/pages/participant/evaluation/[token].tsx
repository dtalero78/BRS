import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../../components/Layout';

interface Question {
  id: number;
  numero: number;
  pregunta?: string;
  texto?: string;
  dimension?: string;
  dominio?: string;
}

interface QuestionnaireSection {
  descripcion?: string;
  preguntas: Question[];
}

interface QuestionnaireData {
  type: string;
  questionnaire: {
    nombre: string;
    total_preguntas: number;
    instrucciones?: string;
    secciones?: { [key: string]: QuestionnaireSection } | Question[];
    preguntas?: Question[];
  };
  opciones_respuesta: {
    escala_principal: string[];
    escala_estres: string[];
  };
}

interface ParticipantData {
  id: string;
  firstName: string;
  lastName: string;
  formType: 'A' | 'B';
}

interface EvaluationData {
  id: string;
  name: string;
  description: string;
}

const ParticipantEvaluationPage = () => {
  const router = useRouter();
  const { token } = router.query;
  const [participant, setParticipant] = useState<ParticipantData | null>(null);
  const [evaluation, setEvaluation] = useState<EvaluationData | null>(null);
  const [availableQuestionnaires, setAvailableQuestionnaires] = useState<any[]>([]);
  const [currentQuestionnaire, setCurrentQuestionnaire] = useState<QuestionnaireData | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [responses, setResponses] = useState<{[key: string]: number}>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);

  // Auto-save timeout ref for debouncing
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Questions per page for pagination (changed to 1 for individual display)
  const QUESTIONS_PER_PAGE = 1;

  useEffect(() => {
    if (token && typeof token === 'string') {
      validateTokenAndLoadData(token);
    }
  }, [token]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const validateTokenAndLoadData = async (accessToken: string) => {
    try {
      setLoading(true);
      
      // Validate token and get participant data
      const validateResponse = await fetch(`/api/participant-access/validate/${accessToken}`);
      
      if (!validateResponse.ok) {
        const errorData = await validateResponse.json();
        throw new Error(errorData.error || 'Token inválido');
      }

      const validationData = await validateResponse.json();
      setParticipant(validationData.participant);
      setEvaluation(validationData.evaluation);

      // Load available questionnaires
      const questionnairesResponse = await fetch(`/api/participant-access/${accessToken}/questionnaires`);
      
      if (!questionnairesResponse.ok) {
        throw new Error('Error al cargar cuestionarios');
      }

      const questionnairesData = await questionnairesResponse.json();
      setAvailableQuestionnaires(questionnairesData.questionnaires);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  // Map existing demographic data to questionnaire responses
  const mapExistingDataToResponses = (existingData: any, campos: any[]) => {
    const responses: {[key: string]: any} = {};
    
    // Mapping from existing system fields to BRS official fields
    const fieldMapping = {
      1: () => `${existingData.firstName || ''} ${existingData.lastName || ''}`.trim(), // Nombre completo
      2: () => existingData.gender || '', // Sexo
      3: () => existingData.birthYear || '', // Año de nacimiento
      4: () => existingData.educationLevel || '', // Nivel de estudios
      5: () => existingData.position || '', // Ocupación/profesión
      6: () => '', // Lugar de residencia - not captured, leave empty for user input
      7: () => '', // Estrato - not captured
      8: () => '', // Tipo de vivienda - not captured
      9: () => '', // Dependientes económicos - not captured
      10: () => '', // Lugar de trabajo - not captured, leave empty for user input
      11: () => existingData.tenureMonths ? Math.floor(existingData.tenureMonths / 12) : 0, // Años en empresa
      12: () => existingData.position || '', // Cargo
      13: () => existingData.formType === 'A' ? 'Jefatura - tiene personal a cargo' : 
                existingData.formType === 'B' ? 'Operario, operador, ayudante, servicios generales' : 
                'Profesional, analista, técnico, tecnólogo', // Tipo de cargo
      14: () => '', // Años en cargo actual - not captured separately
      15: () => existingData.department || '', // Área/sección
      16: () => existingData.contractType || '', // Tipo de contrato
      17: () => existingData.salaryRange || '', // Salario
      18: () => existingData.workHoursPerDay || '' // Horas de trabajo
    };

    campos?.forEach((campo: any) => {
      const mapper = fieldMapping[campo.numero as keyof typeof fieldMapping];
      if (mapper) {
        const value = mapper();
        if (value !== '' && value !== null && value !== undefined) {
          responses[`q_${campo.numero}`] = value;
        }
      }
    });

    return responses;
  };

  const loadQuestionnaire = async (questionnaireId: string) => {
    try {
      setLoading(true);
      
      // Use participant-access endpoint for public access
      const response = await fetch(`/api/participant-access/${token}/questionnaire/${questionnaireId}`);

      if (!response.ok) {
        throw new Error('Error al cargar el cuestionario');
      }

      const data = await response.json();
      setCurrentQuestionnaire(data);
      setCurrentQuestionIndex(0);
      
      // Pre-fill with existing demographic data for ficha-datos
      let initialResponses = {};
      if (questionnaireId === 'ficha-datos' && data.existingData) {
        initialResponses = mapExistingDataToResponses(data.existingData, data.questionnaire.campos);
      }
      
      // Load existing responses and merge with pre-filled data
      await loadExistingResponses(questionnaireId, initialResponses, data.questionnaire);
      
      // Progress will be calculated in loadExistingResponses with correct totals

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar cuestionario');
    } finally {
      setLoading(false);
    }
  };

  const loadExistingResponses = async (questionnaireId: string, preFilledResponses = {}, questionnaireData: any = null) => {
    if (!token || typeof token !== 'string') return preFilledResponses;

    try {
      const questionnaireTypeMap: {[key: string]: string} = {
        'ficha-datos': 'ficha_datos',
        'forma-a': 'intralaboral_a',
        'forma-b': 'intralaboral_b',
        'extralaboral': 'extralaboral',
        'estres': 'estres'
      };

      // First check localStorage for backup
      const backupKey = `brs_backup_${token}_${questionnaireId}`;
      const backupData = localStorage.getItem(backupKey);
      
      const response = await fetch(
        `/api/participant-access/${token}/responses?questionnaireType=${questionnaireTypeMap[questionnaireId]}`
      );

      if (response.ok) {
        const data = await response.json();
        const existingResponses = data.responses[questionnaireTypeMap[questionnaireId]] || [];
        
        const responseMap: {[key: string]: number} = {};
        existingResponses.forEach((resp: any) => {
          responseMap[`q_${resp.questionNumber}`] = resp.responseValue;
        });

        // Merge with backup if exists and has more responses
        if (backupData) {
          const backupResponses = JSON.parse(backupData);
          if (Object.keys(backupResponses).length > Object.keys(responseMap).length) {
            console.log('Recovering responses from localStorage backup');
            setResponses(backupResponses);
            // Try to save the backup to server
            saveResponsesWithRetry(backupResponses);
            localStorage.removeItem(backupKey); // Clean up after recovery
          } else {
            const mergedResponses = { ...preFilledResponses, ...responseMap };
            setResponses(mergedResponses);
            localStorage.removeItem(backupKey); // Clean up old backup
          }
        } else {
          // Merge existing saved responses with pre-filled data
          const mergedResponses = { ...preFilledResponses, ...responseMap };
          setResponses(mergedResponses);
        }
        
        // Update progress based on final merged responses
        const totalQuestions = questionnaireData?.total_preguntas || questionnaireData?.campos?.length || currentQuestionnaire?.questionnaire.total_preguntas || currentQuestionnaire?.questionnaire.campos?.length || 0;
        
        // Get the final responses that were set
        let finalResponseCount = 0;
        if (backupData && Object.keys(JSON.parse(backupData)).length > Object.keys(responseMap).length) {
          finalResponseCount = Object.keys(JSON.parse(backupData)).length;
        } else {
          const mergedResponses = { ...preFilledResponses, ...responseMap };
          finalResponseCount = Object.keys(mergedResponses).length;
        }
        
        const totalQuestionsCount = getTotalQuestions();
        const progressValue = totalQuestionsCount > 0 ? (finalResponseCount / totalQuestionsCount) * 100 : 0;
        setProgress(progressValue);
      }
    } catch (err) {
      console.error('Error loading existing responses:', err);
    }
  };

  const handleResponseChange = (questionNumber: number | string, value: number | string) => {
    const key = `q_${questionNumber}`;
    const newResponses = { ...responses, [key]: value };
    setResponses(newResponses);

    // Update progress
    const totalQuestions = getTotalQuestions();
    const completedQuestions = getCompletedQuestionsCount(newResponses);
    setProgress(totalQuestions > 0 ? (completedQuestions / totalQuestions) * 100 : 0);

    // Clear existing save timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Auto-save strategy to avoid rate limits:
    // 1. Save every 5 responses
    // 2. Or save after 5 seconds of inactivity
    // 3. Or save on last question
    const shouldSaveNow = 
      completedQuestions % 5 === 0 || // Every 5 responses
      !canNavigateNext(); // Last question

    if (shouldSaveNow) {
      // Save with a small delay to batch multiple quick changes
      saveTimeoutRef.current = setTimeout(() => {
        saveResponsesWithRetry(newResponses);
        saveTimeoutRef.current = null;
      }, 1000);
    } else {
      // Debounced save after 5 seconds of inactivity
      saveTimeoutRef.current = setTimeout(() => {
        saveResponsesWithRetry(newResponses);
        saveTimeoutRef.current = null;
      }, 5000);
    }

    // Check if this is a demographic questionnaire (has campos instead of preguntas)
    const isDemographicForm = currentQuestionnaire?.questionnaire.campos ? true : false;
    
    // Auto-advance to next question after a short delay (only for non-demographic forms)
    if (!isDemographicForm) {
      setTimeout(() => {
        if (canNavigateNext()) {
          goToNextPage();
        }
      }, 500); // Half second delay for visual feedback
    }
  };

  const saveResponsesWithRetry = async (responsesToSave = responses, retryCount = 0) => {
    const maxRetries = 3;
    const baseDelay = 2000; // 2 seconds
    
    try {
      await saveResponses(responsesToSave);
    } catch (error: any) {
      // Check if it's a rate limit error
      if (error.message?.includes('429') || error.message?.includes('Too Many Requests')) {
        if (retryCount < maxRetries) {
          // Exponential backoff: 2s, 4s, 8s
          const delay = baseDelay * Math.pow(2, retryCount);
          console.log(`Rate limited. Retrying in ${delay/1000}s...`);
          
          setTimeout(() => {
            saveResponsesWithRetry(responsesToSave, retryCount + 1);
          }, delay);
        } else {
          console.error('Max retries reached. Responses may not be saved.');
          // Store in localStorage as backup
          const backupKey = `brs_backup_${token}_${currentQuestionnaire?.type}`;
          localStorage.setItem(backupKey, JSON.stringify(responsesToSave));
          console.log('Responses backed up to localStorage');
        }
      } else {
        console.error('Save error:', error);
      }
    }
  };

  const saveResponses = async (responsesToSave = responses) => {
    if (!currentQuestionnaire || !token || typeof token !== 'string') return;

    try {
      const questionnaireTypeMap: {[key: string]: string} = {
        'ficha-datos': 'ficha_datos',
        'forma-a': 'intralaboral_a',
        'forma-b': 'intralaboral_b',
        'extralaboral': 'extralaboral',
        'estres': 'estres'
      };

      const questionsData = getAllQuestions();
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

      const response = await fetch(`/api/participant-access/${token}/responses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          questionnaireType: questionnaireTypeMap[currentQuestionnaire.type],
          responses: formattedResponses
        })
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('429: Too Many Requests');
        }
        throw new Error(`Error al guardar respuestas: ${response.status}`);
      }

      // Success message removed to prevent layout shift
      console.log('Responses saved successfully');

    } catch (err) {
      console.error('Error saving responses:', err);
      throw err; // Re-throw to be handled by retry logic
    }
  };

  const submitQuestionnaire = async () => {
    if (!currentQuestionnaire || !token) return;

    setIsSubmitting(true);
    try {
      await saveResponsesWithRetry();
      
      // Return to questionnaire selection immediately after saving
      setTimeout(() => {
        setCurrentQuestionnaire(null);
        setResponses({});
        setCurrentQuestionIndex(0);
        setProgress(0);
      }, 500);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar cuestionario');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getAllQuestions = (): Question[] => {
    if (!currentQuestionnaire) return [];

    const { secciones, preguntas, campos, malestares } = currentQuestionnaire.questionnaire;
    
    // Handle demographic form (campos)
    if (campos && Array.isArray(campos)) {
      return campos.map((campo: any) => ({
        numero: campo.numero,
        texto: campo.campo,
        tipo: campo.tipo,
        opciones: campo.opciones,
        subcampos: campo.subcampos
      }));
    }
    
    // Handle stress questionnaire (malestares)
    if (malestares && Array.isArray(malestares)) {
      return malestares.map((malestar: any) => ({
        numero: malestar.numero,
        texto: malestar.texto,
        pregunta: malestar.texto
      }));
    }
    
    if (preguntas && Array.isArray(preguntas)) {
      return preguntas;
    }

    if (secciones && typeof secciones === 'object' && !Array.isArray(secciones)) {
      // Handle secciones object format
      const allQuestions: Question[] = [];
      Object.values(secciones).forEach((section: QuestionnaireSection) => {
        if (section.preguntas && Array.isArray(section.preguntas)) {
          allQuestions.push(...section.preguntas);
        }
      });
      return allQuestions.sort((a, b) => a.numero - b.numero);
    }

    if (secciones && Array.isArray(secciones)) {
      return secciones;
    }

    return [];
  };

  const getCurrentPageQuestions = () => {
    const questions = getAllQuestions();
    const startIndex = currentQuestionIndex;
    const endIndex = Math.min(startIndex + QUESTIONS_PER_PAGE, questions.length);
    
    return questions.slice(startIndex, endIndex);
  };

  const canNavigateNext = () => {
    const questions = getAllQuestions();
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

  const isQuestionComplete = (question: Question) => {
    if (question.subcampos) {
      // For subcampos, check if all subfields are completed
      return question.subcampos.every((_, index) => {
        const key = `q_${question.numero}_${index}`;
        return responses[key] && responses[key].toString().trim() !== '';
      });
    } else if (question.opciones && !question.tipo) {
      // For special questions with opciones (like years questions)
      const key = `q_${question.numero}`;
      const selectedOption = responses[key];
      
      if (!selectedOption) return false;
      
      // If "more than a year" is selected, also need the numeric input
      if (selectedOption.toString().includes('más de un año')) {
        const yearsKey = `q_${question.numero}_years`;
        return responses[yearsKey] && responses[yearsKey].toString().trim() !== '';
      }
      
      // If "less than a year" is selected, no additional input needed
      return true;
    } else {
      // For regular questions
      const key = `q_${question.numero}`;
      return responses[key] !== undefined && responses[key] !== null;
    }
  };

  const getTotalQuestions = () => {
    if (!currentQuestionnaire) return 0;
    
    const { questionnaire } = currentQuestionnaire;
    
    // For demographic form, count campos
    if (questionnaire.campos && Array.isArray(questionnaire.campos)) {
      return questionnaire.campos.length;
    }
    
    // For stress questionnaire, count malestares
    if (questionnaire.malestares && Array.isArray(questionnaire.malestares)) {
      return questionnaire.malestares.length;
    }
    
    // For other questionnaires, use total_preguntas
    return questionnaire.total_preguntas || 0;
  };

  const getCompletedQuestionsCount = (responsesToCheck = responses) => {
    if (!currentQuestionnaire) return 0;
    
    const { questionnaire } = currentQuestionnaire;
    
    // For demographic form, count completed campos (not individual responses)
    if (questionnaire.campos && Array.isArray(questionnaire.campos)) {
      let completedCount = 0;
      questionnaire.campos.forEach((campo: any) => {
        if (campo.subcampos) {
          // For subcampos, check if all subfields are completed
          const allSubcamposCompleted = campo.subcampos.every((_: any, index: number) => {
            const key = `q_${campo.numero}_${index}`;
            return responsesToCheck[key] && responsesToCheck[key].toString().trim() !== '';
          });
          if (allSubcamposCompleted) completedCount++;
        } else if (campo.opciones && !campo.tipo) {
          // For special campos with opciones (like years questions)
          const key = `q_${campo.numero}`;
          const selectedOption = responsesToCheck[key];
          
          if (selectedOption) {
            // If "more than a year" is selected, also check the numeric input
            if (selectedOption.toString().includes('más de un año')) {
              const yearsKey = `q_${campo.numero}_years`;
              if (responsesToCheck[yearsKey] && responsesToCheck[yearsKey].toString().trim() !== '') {
                completedCount++;
              }
            } else {
              // If "less than a year" is selected, no additional input needed
              completedCount++;
            }
          }
        } else {
          // For regular campos, check if response exists
          const key = `q_${campo.numero}`;
          if (responsesToCheck[key] !== undefined && responsesToCheck[key] !== null && responsesToCheck[key].toString().trim() !== '') {
            completedCount++;
          }
        }
      });
      return completedCount;
    }
    
    // For stress questionnaire, count completed malestares
    if (questionnaire.malestares && Array.isArray(questionnaire.malestares)) {
      let completedCount = 0;
      questionnaire.malestares.forEach((malestar: any) => {
        const key = `q_${malestar.numero}`;
        if (responsesToCheck[key] !== undefined && responsesToCheck[key] !== null) {
          completedCount++;
        }
      });
      return completedCount;
    }
    
    // For other questionnaires, count all responses
    return Object.keys(responsesToCheck).length;
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

  if (error) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto mt-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-lg font-medium text-red-800 mb-2">Error</h2>
            <p className="text-red-600">{error}</p>
            <div className="mt-4">
              <button
                onClick={() => router.push('/')}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
              >
                Volver al inicio
              </button>
            </div>
          </div>
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-4">
        <div className="max-w-4xl mx-auto px-6">
        {!currentQuestionnaire ? (
          // Questionnaire selection view
          <div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Evaluación de Riesgo Psicosocial
              </h1>
              <p className="text-gray-600 mb-2">
                Participante: {participant.firstName} {participant.lastName}
              </p>
              <p className="text-gray-600 mb-4">
                Evaluación: {evaluation?.name}
              </p>
              <p className="text-sm text-gray-500">
                Forma asignada: {participant.formType} 
                {participant.formType === 'A' ? ' (Jefes, profesionales y técnicos)' : ' (Auxiliares y operarios)'}
              </p>
            </div>

            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
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
                  Página {Math.floor(currentQuestionIndex / QUESTIONS_PER_PAGE) + 1} de {Math.ceil(getAllQuestions().length / QUESTIONS_PER_PAGE)}
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

              {/* Special instructions for demographic form */}
              {currentQuestionnaire.type === 'ficha-datos' && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                  <div className="flex items-start">
                    <svg className="w-5 h-5 text-green-600 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <div>
                      <p className="text-green-800 text-sm font-medium">
                        ✅ Datos pre-llenados por el evaluador
                      </p>
                      <p className="text-green-700 text-xs mt-1">
                        Algunos campos ya están completados con la información que registró su evaluador. 
                        Por favor revise y corrija cualquier dato que no sea correcto.
                      </p>
                    </div>
                  </div>
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

            {/* Single Question Display */}
            <div className="bg-white rounded-lg shadow-lg border border-gray-200 mb-6">
              {getCurrentPageQuestions().map((question: Question) => (
                <div key={question.numero} className="p-8">
                  {/* Question Header */}
                  <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 text-blue-600 rounded-full mb-4 text-lg font-bold">
                      {question.numero}
                    </div>
                    <h2 className="text-2xl font-semibold text-gray-900 mb-3 leading-relaxed">
                      {question.pregunta || question.texto}
                    </h2>
                    {question.dimension && (
                      <p className="text-sm text-gray-500 bg-gray-50 inline-block px-3 py-1 rounded-full">
                        Dimensión: {question.dimension}
                      </p>
                    )}
                  </div>

                  {/* Render demographic field or regular question */}
                  {question.tipo || question.subcampos || question.opciones ? (
                    // Demographic Field Rendering
                    <div className="max-w-2xl mx-auto">
                      <div className="space-y-4">
                        {question.subcampos ? (
                          // Multiple sub-fields (like city/department)
                          <div className="space-y-4">
                            {question.subcampos.map((subcampo: any, index: number) => (
                              <div key={index}>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  {subcampo.campo}
                                </label>
                                <input
                                  type="text"
                                  value={responses[`q_${question.numero}_${index}`] || ''}
                                  onChange={(e) => handleResponseChange(`${question.numero}_${index}`, e.target.value)}
                                  className="w-full p-4 border-2 border-gray-300 rounded-lg text-lg focus:ring-blue-500 focus:border-blue-500"
                                  placeholder={`Ingresa ${subcampo.campo.toLowerCase()}`}
                                />
                              </div>
                            ))}
                          </div>
                        ) : (question.tipo === 'seleccion_unica' && question.opciones) || (!question.tipo && question.opciones) ? (
                          // Select dropdown for demographic field (either with tipo='seleccion_unica' or just opciones)
                          <div className="space-y-4">
                            <select
                              value={responses[`q_${question.numero}`] || ''}
                              onChange={(e) => handleResponseChange(question.numero, e.target.value)}
                              className="w-full p-4 border-2 border-gray-300 rounded-lg text-lg focus:ring-blue-500 focus:border-blue-500"
                            >
                              <option value="">Selecciona una opción</option>
                              {question.opciones.map((opcion: string, index: number) => (
                                <option key={index} value={opcion}>
                                  {opcion}
                                </option>
                              ))}
                            </select>
                            
                            {/* Conditional numeric input for years questions */}
                            {(responses[`q_${question.numero}`] && 
                              responses[`q_${question.numero}`].toString().includes('más de un año')) && (
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  ¿Cuántos años exactamente?
                                </label>
                                <input
                                  type="number"
                                  min="1"
                                  max="50"
                                  value={responses[`q_${question.numero}_years`] || ''}
                                  onChange={(e) => handleResponseChange(`${question.numero}_years`, e.target.value)}
                                  className="w-full p-4 border-2 border-gray-300 rounded-lg text-lg focus:ring-blue-500 focus:border-blue-500"
                                  placeholder="Ejemplo: 5"
                                />
                              </div>
                            )}
                          </div>
                        ) : question.tipo === 'numerico' ? (
                          // Number input for demographic field
                          <div>
                            <input
                              type="number"
                              value={responses[`q_${question.numero}`] || ''}
                              onChange={(e) => handleResponseChange(question.numero, e.target.value)}
                              className="w-full p-4 border-2 border-gray-300 rounded-lg text-lg focus:ring-blue-500 focus:border-blue-500"
                              placeholder="Ingresa un número"
                            />
                          </div>
                        ) : (
                          // Text input for demographic field
                          <div>
                            <input
                              type="text"
                              value={responses[`q_${question.numero}`] || ''}
                              onChange={(e) => handleResponseChange(question.numero, e.target.value)}
                              className="w-full p-4 border-2 border-gray-300 rounded-lg text-lg focus:ring-blue-500 focus:border-blue-500"
                              placeholder="Escribe tu respuesta"
                            />
                          </div>
                        )}
                        
                        {/* Navigation for demographic fields */}
                        <div className="flex justify-center mt-6">
                          <button
                            onClick={() => {
                              if (isQuestionComplete(question)) {
                                // Auto-advance after clicking continue
                                if (canNavigateNext()) {
                                  goToNextPage();
                                }
                              }
                            }}
                            disabled={!isQuestionComplete(question)}
                            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                          >
                            Continuar
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    // Regular Question Response Options - Vertical Layout with Cards
                    <div className="max-w-2xl mx-auto">
                      <p className="text-center text-sm text-gray-500 mb-6">
                        Selecciona una opción y avanzarás automáticamente
                      </p>
                      <div className="space-y-4">
                        {getResponseOptions().map((option) => (
                          <label
                            key={option.value}
                            className={`
                              flex items-center p-5 border-2 rounded-xl cursor-pointer transition-all duration-300 transform
                              ${responses[`q_${question.numero}`] === option.value 
                                ? 'border-blue-500 bg-blue-50 shadow-lg scale-105 ring-2 ring-blue-300 ring-opacity-50' 
                                : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50 hover:shadow-md hover:-translate-y-1'
                              }
                            `}
                          >
                            <input
                              type="radio"
                              name={`question_${question.numero}`}
                              value={option.value}
                              checked={responses[`q_${question.numero}`] === option.value}
                              onChange={() => handleResponseChange(question.numero, option.value)}
                              className="h-5 w-5 text-blue-600 border-2 border-gray-300 focus:ring-blue-500 focus:ring-2"
                            />
                            <span className={`ml-4 text-lg ${
                              responses[`q_${question.numero}`] === option.value 
                                ? 'text-blue-900 font-medium' 
                                : 'text-gray-700'
                            }`}>
                              {option.label}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Simplified Navigation */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex justify-between items-center">
                {/* Previous Button - Left Side */}
                <div className="flex-1">
                  <button
                    onClick={goToPrevPage}
                    disabled={!canNavigatePrev()}
                    className="inline-flex items-center px-6 py-3 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Pregunta Anterior
                  </button>
                </div>

                {/* Central Progress Indicator */}
                <div className="flex-1 text-center">
                  <div className="text-lg font-semibold text-gray-900">
                    Pregunta {currentQuestionIndex + 1} de {getAllQuestions().length}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    {Math.round(progress)}% completado
                  </div>
                  {!canNavigateNext() && (
                    <div className="text-xs text-blue-600 mt-2 font-medium">
                      ¡Última pregunta!
                    </div>
                  )}
                </div>

                {/* Right Side - Finish Button or Empty Space */}
                <div className="flex-1 text-right">
                  {!canNavigateNext() ? (
                    <button
                      onClick={submitQuestionnaire}
                      disabled={isSubmitting || progress < 100}
                      className="inline-flex items-center px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
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
                        <>
                          Finalizar Cuestionario
                          <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="text-sm text-gray-400 italic px-6 py-3">
                      Selecciona una respuesta para continuar
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </Layout>
  );
};

export default ParticipantEvaluationPage;