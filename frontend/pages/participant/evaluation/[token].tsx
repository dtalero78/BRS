import { useState, useEffect, useRef, ReactNode } from 'react';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import { ClipboardList, Briefcase, HardHat, Home, Brain, Shield, FileText, CheckCircle2, ArrowLeft, ChevronLeft, ChevronDown, Check, LucideIcon } from 'lucide-react';
import { BRAND } from '../../../config/brand';

// Simple wrapper for participant pages (no auth required)
function ParticipantLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center">
          <img src={BRAND.logo} alt={BRAND.name} className="h-8 w-auto" />
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}

interface Question {
  id: number;
  numero: number;
  pregunta?: string;
  texto?: string;
  dimension?: string;
  dominio?: string;
  tipo?: string;
  opciones?: string[];
  subcampos?: any[];
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
    campos?: any[];
    malestares?: any[];
  };
  opciones_respuesta: {
    escala_principal: string[];
    escala_estres: string[];
    escala_coping?: string[];
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
  const [token, setToken] = useState<string | null>(null);
  const [participant, setParticipant] = useState<ParticipantData | null>(null);
  const [evaluation, setEvaluation] = useState<EvaluationData | null>(null);
  const [availableQuestionnaires, setAvailableQuestionnaires] = useState<any[]>([]);
  // returnUrl viene solo cuando el participant fue creado por integración externa
  // (BSL-PLATAFORMA2 / Platzi). Para evaluadores que se auto-registran este state
  // queda en null y el comportamiento legacy se mantiene (mensaje "Ya puedes
  // cerrar esta página").
  const [integrationReturnUrl, setIntegrationReturnUrl] = useState<string | null>(null);
  const [currentQuestionnaire, setCurrentQuestionnaire] = useState<QuestionnaireData | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [responses, setResponses] = useState<{[key: string]: number | string}>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  // Estado del autoguardado: se muestra como una línea discreta bajo el CTA para
  // que el participante sepa que su avance está a salvo sin generar layout shift.
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Auto-save timeout ref for debouncing
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // El scroll de la pregunta vive dentro de <main>, no en la página: `globals.css`
  // pone `overflow-x: hidden` en html/body y eso rompe `position: sticky`, así que
  // header y footer se fijan como hermanos flex de un contenedor sin scroll.
  const questionScrollRef = useRef<HTMLElement | null>(null);
  // Alto real del viewport visible. En iOS el teclado NO encoge `100dvh`: sin esto
  // el botón "Continuar" queda escondido detrás del teclado.
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);

  // Questions per page for pagination (changed to 1 for individual display)
  const QUESTIONS_PER_PAGE = 1;

  // Extract token from URL path (works with static export where router.query is empty)
  useEffect(() => {
    const pathToken = router.query.token as string | undefined;
    if (pathToken) {
      setToken(pathToken);
    } else if (typeof window !== 'undefined') {
      const pathParts = window.location.pathname.split('/');
      const evalIndex = pathParts.indexOf('evaluation');
      if (evalIndex !== -1 && pathParts[evalIndex + 1]) {
        setToken(pathParts[evalIndex + 1].replace(/\/$/, ''));
      }
    }
  }, [router.query.token]);

  useEffect(() => {
    if (token) {
      validateTokenAndLoadData(token);
    }
  }, [token]);

  // El redirect automático a la app externa (returnUrl) fue eliminado a propósito:
  // al completar la batería el participante se queda en la pantalla de éxito de BRS.
  // El webhook de finalización sigue notificando a la app externa desde el backend.

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Una pregunta = una pantalla: al avanzar/retroceder hay que volver arriba,
  // si no el participante cae a media pregunta cuando la anterior era larga.
  useEffect(() => {
    questionScrollRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [currentQuestionIndex, currentQuestionnaire?.type]);

  // Sigue el viewport visible (teclado virtual incluido) mientras se responde.
  useEffect(() => {
    if (!currentQuestionnaire || typeof window === 'undefined') return;
    const vv = window.visualViewport;
    if (!vv) return;

    const sync = () => setViewportHeight(vv.height);
    sync();
    vv.addEventListener('resize', sync);
    return () => {
      vv.removeEventListener('resize', sync);
      setViewportHeight(null);
    };
  }, [currentQuestionnaire]);

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
      // Solo si viene de integración el backend devuelve integration.returnUrl
      if (questionnairesData.integration && questionnairesData.integration.returnUrl) {
        setIntegrationReturnUrl(questionnairesData.integration.returnUrl);
      }

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
      const mergedResponses = await loadExistingResponses(questionnaireId, initialResponses, data.questionnaire);

      // Resume on the first unanswered question
      const questions = getQuestionsFromData(data.questionnaire);
      if (questions.length > 0 && mergedResponses && Object.keys(mergedResponses).length > 0) {
        const firstUnanswered = questions.findIndex(q => mergedResponses[`q_${q.numero}`] === undefined);
        if (firstUnanswered > 0) {
          setCurrentQuestionIndex(firstUnanswered);
        }
      }

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
        'estres': 'estres',
        'coping': 'coping'
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

        let finalResponses: {[key: string]: any} = {};

        // Merge with backup if exists and has more responses
        if (backupData) {
          const backupResponses = JSON.parse(backupData);
          if (Object.keys(backupResponses).length > Object.keys(responseMap).length) {
            console.log('Recovering responses from localStorage backup');
            finalResponses = backupResponses;
            setResponses(backupResponses);
            // Try to save the backup to server
            saveResponsesWithRetry(backupResponses);
            localStorage.removeItem(backupKey); // Clean up after recovery
          } else {
            finalResponses = { ...preFilledResponses, ...responseMap };
            setResponses(finalResponses);
            localStorage.removeItem(backupKey); // Clean up old backup
          }
        } else {
          finalResponses = { ...preFilledResponses, ...responseMap };
          setResponses(finalResponses);
        }

        // Update progress based on final merged responses
        const totalQuestionsCount = getTotalQuestionsFromData(questionnaireData) || getTotalQuestions();
        const finalResponseCount = Object.keys(finalResponses).length;
        const progressValue = totalQuestionsCount > 0 ? (finalResponseCount / totalQuestionsCount) * 100 : 0;
        setProgress(progressValue);

        return finalResponses;
      }
    } catch (err) {
      console.error('Error loading existing responses:', err);
    }
    return preFilledResponses;
  };

  // Build the question list directly from questionnaire data (without depending on currentQuestionnaire state)
  const getQuestionsFromData = (questionnaire: any): Question[] => {
    if (!questionnaire) return [];
    const { secciones, preguntas, campos, malestares } = questionnaire;

    if (campos && Array.isArray(campos)) {
      return campos.map((campo: any, index: number) => ({
        id: campo.numero || index + 1,
        numero: campo.numero,
        texto: campo.campo,
        tipo: campo.tipo,
        opciones: campo.opciones,
        subcampos: campo.subcampos
      }));
    }

    if (malestares && Array.isArray(malestares)) {
      return malestares.map((m: any, index: number) => ({
        id: m.numero || index + 1,
        numero: m.numero,
        texto: m.texto,
        pregunta: m.texto
      }));
    }

    if (preguntas && Array.isArray(preguntas)) {
      return preguntas;
    }

    if (secciones && typeof secciones === 'object') {
      const all: Question[] = [];
      Object.values(secciones).forEach((seccion: any) => {
        if (seccion?.preguntas && Array.isArray(seccion.preguntas)) {
          all.push(...seccion.preguntas);
        }
      });
      return all.sort((a, b) => (a.numero || 0) - (b.numero || 0));
    }

    return [];
  };

  const getTotalQuestionsFromData = (questionnaire: any): number => {
    if (!questionnaire) return 0;
    return questionnaire.total_preguntas
      || questionnaire.campos?.length
      || questionnaire.malestares?.length
      || getQuestionsFromData(questionnaire).length
      || 0;
  };

  const handleResponseChange = (questionNumber: number | string, value: number | string) => {
    const key = `q_${questionNumber}`;
    // Only convert to number if the value is actually numeric
    const parsedValue = typeof value === 'string' && value !== '' && !isNaN(Number(value))
      ? parseInt(value, 10)
      : value;
    const newResponses = { ...responses, [key]: parsedValue };
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
      const isRateLimit = error.message?.includes('429') || error.message?.includes('Too Many Requests');

      // Reintenta CUALQUIER fallo transitorio (rate limit, red, 5xx) con backoff exponencial.
      // Antes solo se reintentaba/respaldaba el caso 429 y cualquier otro error se perdía
      // en silencio (console.error) sin backup ni aviso al participante.
      if (retryCount < maxRetries) {
        const delay = baseDelay * Math.pow(2, retryCount);
        console.log(`Guardado falló (${isRateLimit ? 'rate limit' : error?.message}). Reintento en ${delay / 1000}s...`);
        setTimeout(() => {
          saveResponsesWithRetry(responsesToSave, retryCount + 1);
        }, delay);
        return;
      }

      // Reintentos agotados: respalda SIEMPRE en localStorage y avisa al usuario.
      console.error('Guardado fallido tras reintentos:', error);
      setSaveState('error');
      try {
        const backupKey = `brs_backup_${token}_${currentQuestionnaire?.type}`;
        localStorage.setItem(backupKey, JSON.stringify(responsesToSave));
      } catch (storageErr) {
        console.error('No se pudo respaldar en localStorage:', storageErr);
      }
      toast.error(
        'No pudimos guardar tus últimas respuestas (revisa tu conexión). Quedaron respaldadas ' +
        'en este dispositivo; no cierres esta pestaña e intenta continuar.',
        { duration: 8000 }
      );
    }
  };

  const saveResponses = async (responsesToSave = responses) => {
    if (!currentQuestionnaire || !token || typeof token !== 'string') return;

    setSaveState('saving');

    try {
      const questionnaireTypeMap: {[key: string]: string} = {
        'ficha-datos': 'ficha_datos',
        'forma-a': 'intralaboral_a',
        'forma-b': 'intralaboral_b',
        'extralaboral': 'extralaboral',
        'estres': 'estres',
        'coping': 'coping'
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
      setSaveState('saved');
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

      // Refrescar el estado de cuestionarios desde el backend para que el hub
      // muestre el cuestionario recién terminado como "Completado" y, si es el
      // último, dispare el useEffect de redirect a returnUrl (Platzi).
      // Sin esto, el state de availableQuestionnaires queda con el snapshot
      // del load inicial y el paciente cree que nada se guardó.
      try {
        const refetch = await fetch(`/api/participant-access/${token}/questionnaires`);
        if (refetch.ok) {
          const data = await refetch.json();
          setAvailableQuestionnaires(data.questionnaires);
          if (data.integration && data.integration.returnUrl) {
            setIntegrationReturnUrl(data.integration.returnUrl);
          }
        }
      } catch (refetchErr) {
        // Refetch best-effort: si falla, el paciente verá el state viejo pero
        // los datos están guardados en el backend (saveResponsesWithRetry ya OK).
      }

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
      return campos.map((campo: any, index: number) => ({
        id: campo.numero || index + 1,
        numero: campo.numero,
        texto: campo.campo,
        tipo: campo.tipo,
        opciones: campo.opciones,
        subcampos: campo.subcampos
      }));
    }
    
    // Handle stress questionnaire (malestares)
    if (malestares && Array.isArray(malestares)) {
      return malestares.map((malestar: any, index: number) => ({
        id: malestar.numero || index + 1,
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

  // Índice de la primera pregunta sin responder (-1 si están todas).
  const findFirstIncompleteIndex = () => {
    return getAllQuestions().findIndex((q) => !isQuestionComplete(q));
  };

  // Único handler del CTA principal: avanza, o finaliza si ya es la última.
  // Si al finalizar quedan preguntas sueltas, en vez de dejar el botón
  // bloqueado sin explicación, salta a la primera pendiente y lo dice.
  const handleContinue = () => {
    const question = getAllQuestions()[currentQuestionIndex];
    if (!question || !isQuestionComplete(question)) return;

    if (canNavigateNext()) {
      goToNextPage();
      return;
    }

    const pendingIndex = findFirstIncompleteIndex();
    if (pendingIndex !== -1) {
      setCurrentQuestionIndex(pendingIndex);
      toast('Falta responder esta pregunta para poder finalizar', { icon: '☝️' });
      return;
    }

    submitQuestionnaire();
  };

  const getResponseOptions = () => {
    if (!currentQuestionnaire) return [];

    const isCopingQuestionnaire = currentQuestionnaire.type === 'coping';
    const isStressQuestionnaire = currentQuestionnaire.type === 'estres';

    if (isCopingQuestionnaire) {
      const options = currentQuestionnaire.opciones_respuesta.escala_coping
        || ['Siempre hago esto', 'Frecuentemente', 'Raramente', 'Nunca hago esto'];
      return options.map((label: string, index: number) => ({
        label,
        value: options.length - 1 - index // Siempre=3, Nunca=0
      }));
    }

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
      <ParticipantLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
        </div>
      </ParticipantLayout>
    );
  }

  if (error) {
    return (
      <ParticipantLayout>
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
      </ParticipantLayout>
    );
  }

  if (!participant) {
    return (
      <ParticipantLayout>
        <div className="max-w-2xl mx-auto mt-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-lg font-medium text-red-800 mb-2">Error</h2>
            <p className="text-red-600">No se encontraron datos del participante.</p>
          </div>
        </div>
      </ParticipantLayout>
    );
  }

  // ---------------------------------------------------------------------------
  // Vista de aplicación: una pregunta = una pantalla.
  // Sale del ParticipantLayout a propósito: ocupa el viewport completo con
  // progreso fijo arriba y CTA fija abajo, para que en móvil nunca haya que
  // scrollear para encontrar el botón (antes eran tres tarjetas apiladas).
  // ---------------------------------------------------------------------------
  if (currentQuestionnaire) {
    const questions = getAllQuestions();
    const totalQuestions = questions.length;
    const question = questions[currentQuestionIndex];
    const position = totalQuestions > 0 ? Math.min(currentQuestionIndex + 1, totalQuestions) : 0;
    // La barra refleja la POSICIÓN, no el % de respuestas guardadas: con la ficha
    // pre-llenada por el evaluador el porcentaje viejo (63%) no cuadraba con
    // "pregunta 6 de 19" y se leía como un bug.
    const positionPct = totalQuestions > 0 ? (position / totalQuestions) * 100 : 0;
    const isLast = !canNavigateNext();
    const isAnswered = question ? isQuestionComplete(question) : false;
    // La rama demográfica se decide por el cuestionario, no por el campo: un
    // campo de ficha sin `tipo` ni `opciones` caía antes en el render de escala.
    const isDemographic = !!currentQuestionnaire.questionnaire.campos;
    const isFirstQuestion = currentQuestionIndex === 0;
    const instrucciones = currentQuestionnaire.questionnaire.instrucciones;

    const fieldClass =
      'w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3.5 text-[17px] text-gray-900 ' +
      'placeholder:text-gray-400 transition-colors focus:border-blue-600 focus:outline-none focus:ring-0';

    const optionCardClass = (selected: boolean) =>
      `flex w-full items-center gap-3 rounded-xl border-2 px-4 py-4 text-left transition-colors ` +
      (selected
        ? 'border-blue-600 bg-blue-50'
        : 'border-gray-200 bg-white active:bg-gray-50 sm:hover:border-blue-300');

    const optionBulletClass = (selected: boolean) =>
      `flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors ` +
      (selected ? 'border-blue-600 bg-blue-600' : 'border-gray-300 bg-white');

    // Enter avanza (en móvil el teclado muestra "ir/siguiente" y funciona igual).
    const handleFieldKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleContinue();
      }
    };

    const renderDemographicField = () => {
      if (!question) return null;
      const key = `q_${question.numero}`;

      // Varios subcampos (ciudad / departamento)
      if (question.subcampos) {
        return (
          <div className="space-y-5">
            {question.subcampos.map((subcampo: any, index: number) => (
              <div key={index}>
                <label
                  htmlFor={`field_${question.numero}_${index}`}
                  className="mb-2 block text-sm font-medium text-gray-600"
                >
                  {subcampo.campo}
                </label>
                <input
                  id={`field_${question.numero}_${index}`}
                  type="text"
                  autoFocus={index === 0}
                  autoCapitalize="words"
                  autoComplete={index === 0 ? 'address-level2' : 'address-level1'}
                  enterKeyHint={index === question.subcampos.length - 1 ? 'go' : 'next'}
                  value={responses[`q_${question.numero}_${index}`] || ''}
                  onChange={(e) => handleResponseChange(`${question.numero}_${index}`, e.target.value)}
                  className={fieldClass}
                />
              </div>
            ))}
          </div>
        );
      }

      // Opciones: pocas → tarjetas de un toque; muchas → select nativo
      if (question.opciones && question.opciones.length > 0) {
        const selectedOption = responses[key];
        const needsYears = selectedOption?.toString().includes('más de un año');

        return (
          <div className="space-y-5">
            {question.opciones.length <= 8 ? (
              <div className="space-y-2.5">
                {question.opciones.map((opcion: string, index: number) => {
                  const selected = selectedOption === opcion;
                  return (
                    <button
                      key={index}
                      type="button"
                      onClick={() => handleResponseChange(question.numero, opcion)}
                      aria-pressed={selected}
                      className={optionCardClass(selected)}
                    >
                      <span className={optionBulletClass(selected)}>
                        {selected && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
                      </span>
                      <span className={`text-[17px] ${selected ? 'font-medium text-blue-900' : 'text-gray-700'}`}>
                        {opcion}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="relative">
                <select
                  value={selectedOption || ''}
                  onChange={(e) => handleResponseChange(question.numero, e.target.value)}
                  className={`${fieldClass} appearance-none pr-12`}
                >
                  <option value="">Selecciona una opción</option>
                  {question.opciones.map((opcion: string, index: number) => (
                    <option key={index} value={opcion}>
                      {opcion}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              </div>
            )}

            {needsYears && (
              <div>
                <label htmlFor={`field_${question.numero}_years`} className="mb-2 block text-sm font-medium text-gray-600">
                  ¿Cuántos años exactamente?
                </label>
                <input
                  id={`field_${question.numero}_years`}
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max="50"
                  enterKeyHint="go"
                  value={responses[`q_${question.numero}_years`] || ''}
                  onChange={(e) => handleResponseChange(`${question.numero}_years`, e.target.value)}
                  className={fieldClass}
                  placeholder="Ej. 5"
                />
              </div>
            )}
          </div>
        );
      }

      if (question.tipo === 'numerico') {
        return (
          <input
            type="number"
            inputMode="numeric"
            autoFocus
            enterKeyHint="go"
            value={responses[key] || ''}
            onChange={(e) => handleResponseChange(question.numero, e.target.value)}
            className={fieldClass}
          />
        );
      }

      return (
        <input
          type="text"
          autoFocus
          autoCapitalize="sentences"
          enterKeyHint="go"
          value={responses[key] || ''}
          onChange={(e) => handleResponseChange(question.numero, e.target.value)}
          className={fieldClass}
        />
      );
    };

    const renderScaleOptions = () => {
      if (!question) return null;
      const key = `q_${question.numero}`;

      return (
        <fieldset className="border-0 p-0">
          <legend className="sr-only">{question.pregunta || question.texto}</legend>
          <div className="space-y-2.5">
            {getResponseOptions().map((option) => {
              const selected = responses[key] === option.value;
              return (
                <label key={option.value} className={`${optionCardClass(selected)} cursor-pointer`}>
                  <input
                    type="radio"
                    name={`question_${question.numero}`}
                    value={option.value}
                    checked={selected}
                    onChange={() => handleResponseChange(question.numero, option.value)}
                    className="peer sr-only"
                  />
                  <span
                    className={`${optionBulletClass(selected)} peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500 peer-focus-visible:ring-offset-2`}
                  >
                    {selected && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
                  </span>
                  <span className={`text-[17px] ${selected ? 'font-medium text-blue-900' : 'text-gray-700'}`}>
                    {option.label}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      );
    };

    const ctaLabel = isSubmitting
      ? 'Enviando…'
      : !isAnswered
        ? (isDemographic ? 'Completa la respuesta' : 'Selecciona una opción')
        : isLast
          ? 'Finalizar cuestionario'
          : 'Continuar';

    const saveHint =
      saveState === 'saving'
        ? 'Guardando…'
        : saveState === 'error'
          ? 'Sin conexión: guardado en este dispositivo'
          : saveState === 'saved'
            ? 'Respuestas guardadas'
            : 'Tus respuestas se guardan automáticamente';

    return (
      <div
        className="flex h-screen h-[100dvh] flex-col overflow-hidden bg-white"
        style={viewportHeight ? { height: `${viewportHeight}px` } : undefined}
      >
        {/* Barra superior: salida, cuestionario, posición y progreso */}
        <header className="flex-shrink-0 border-b border-gray-200 bg-white">
          <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-4 py-3 sm:px-8">
            <button
              onClick={() => setCurrentQuestionnaire(null)}
              aria-label="Volver a la lista de cuestionarios"
              className="-ml-2 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors active:bg-gray-100 sm:hover:bg-gray-100 sm:hover:text-gray-900"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <span className="flex-1 truncate text-sm font-medium text-gray-500">
              {currentQuestionnaire.questionnaire.nombre}
            </span>
            <span className="flex-shrink-0 text-sm font-semibold tabular-nums text-gray-900">
              {position}
              <span className="font-normal text-gray-400"> / {totalQuestions}</span>
            </span>
          </div>
          <div
            className="h-1 w-full bg-gray-100"
            role="progressbar"
            aria-valuenow={position}
            aria-valuemin={0}
            aria-valuemax={totalQuestions}
          >
            <div
              className="h-1 bg-blue-600 transition-all duration-300"
              style={{ width: `${positionPct}%` }}
            />
          </div>
        </header>

        {/* Pregunta. Anclada arriba a propósito: si se centrara verticalmente el
            título saltaría de posición entre una pregunta de 2 campos y una de 5
            opciones, y en 123 preguntas seguidas eso marea. */}
        <main ref={questionScrollRef} className="flex flex-1 items-start overflow-y-auto overscroll-contain">
          <div
            key={question?.numero ?? currentQuestionIndex}
            className="mx-auto w-full max-w-2xl px-5 pb-10 pt-8 sm:px-8 sm:pb-16 sm:pt-12"
          >
            {instrucciones && (
              isFirstQuestion ? (
                <p className="mb-7 rounded-xl bg-blue-50 px-4 py-3 text-sm leading-relaxed text-blue-900">
                  {instrucciones}
                </p>
              ) : (
                <details className="group mb-7">
                  <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-sm font-medium text-blue-600">
                    Ver instrucciones
                    <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="mt-3 rounded-xl bg-blue-50 px-4 py-3 text-sm leading-relaxed text-blue-900">
                    {instrucciones}
                  </p>
                </details>
              )
            )}

            {isFirstQuestion && currentQuestionnaire.type === 'ficha-datos' && (
              <p className="mb-7 text-sm leading-relaxed text-gray-500">
                Algunos datos ya vienen registrados por tu evaluador. Revísalos y corrige lo que no
                sea correcto.
              </p>
            )}

            <h1 className="text-[22px] font-semibold leading-snug tracking-tight text-gray-900 sm:text-3xl">
              {question?.pregunta || question?.texto}
            </h1>

            <div className="mt-7 sm:mt-9" onKeyDown={isDemographic ? handleFieldKeyDown : undefined}>
              {isDemographic ? renderDemographicField() : renderScaleOptions()}
            </div>

            {/* La mecánica se explica una sola vez: el CTA ya dice "Selecciona
                una opción" en las demás preguntas. */}
            {!isDemographic && isFirstQuestion && (
              <p className="mt-5 text-center text-sm text-gray-400">
                Al elegir una opción avanzas automáticamente
              </p>
            )}
          </div>
        </main>

        {/* Acciones: siempre al alcance del pulgar */}
        <footer className="flex-shrink-0 border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)]">
          <div className="mx-auto w-full max-w-2xl px-5 py-3 sm:px-8 sm:py-4">
            <div className="flex items-center gap-3">
              <button
                onClick={goToPrevPage}
                disabled={!canNavigatePrev()}
                aria-label="Pregunta anterior"
                className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl border-2 border-gray-200 text-gray-600 transition-colors active:bg-gray-50 disabled:border-gray-100 disabled:text-gray-300 sm:hover:enabled:border-gray-300"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={handleContinue}
                disabled={!isAnswered || isSubmitting}
                className={`flex h-14 flex-1 items-center justify-center gap-2 rounded-xl px-6 text-[17px] font-semibold transition-colors ${
                  !isAnswered || isSubmitting
                    ? 'cursor-not-allowed bg-gray-100 text-gray-400'
                    : isLast
                      ? 'bg-green-600 text-white active:bg-green-700 sm:hover:bg-green-700'
                      : 'bg-blue-600 text-white active:bg-blue-700 sm:hover:bg-blue-700'
                }`}
              >
                {ctaLabel}
                {isAnswered && !isSubmitting && isLast && <Check className="h-5 w-5" strokeWidth={2.5} />}
              </button>
            </div>
            <p className="mt-2 h-4 text-center text-xs text-gray-400" aria-live="polite">
              {saveHint}
            </p>
          </div>
        </footer>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Hub: selección de cuestionarios
  // ---------------------------------------------------------------------------
  return (
    <ParticipantLayout>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-4">
        <div className="max-w-4xl mx-auto px-6">
        {(() => {
            const completedCount = availableQuestionnaires.filter(q => q.completed).length;
            const totalCount = availableQuestionnaires.length;
            const allDone = totalCount > 0 && completedCount === totalCount;

            // El Brief COPE no hace parte de la batería oficial del Ministerio, así
            // que el progreso se muestra en dos barras: cuestionarios obligatorios
            // (todos menos el COPE) y el Brief COPE por separado.
            const requiredQuestionnaires = availableQuestionnaires.filter(q => q.id !== 'coping');
            const copingQuestionnaire = availableQuestionnaires.find(q => q.id === 'coping');
            const requiredDone = requiredQuestionnaires.filter(q => q.completed).length;
            const requiredTotal = requiredQuestionnaires.length;
            const requiredPct = requiredTotal > 0 ? Math.round((requiredDone / requiredTotal) * 100) : 0;
            const requiredAllDone = requiredTotal > 0 && requiredDone === requiredTotal;
            const copingDone = copingQuestionnaire?.completed ? 1 : 0;
            const copingPct = copingQuestionnaire ? copingDone * 100 : 0;

            const questionnaireIcons: Record<string, LucideIcon> = {
              'ficha-datos': ClipboardList,
              'forma-a': Briefcase,
              'forma-b': HardHat,
              'extralaboral': Home,
              'estres': Brain,
              'coping': Shield,
            };

            return (
              <div className="max-w-xl mx-auto">
                {/* Greeting */}
                <div className="mb-8 mt-4">
                  <h1 className="text-2xl font-bold text-gray-900 mb-1">
                    Hola, {participant.firstName}
                  </h1>
                  <p className="text-gray-500">
                    Selecciona un cuestionario para continuar
                  </p>
                </div>

                {/* Progress bars (compact) — obligatorios + Brief COPE por separado */}
                {completedCount > 0 && (
                  <div className="mb-6 space-y-4">
                    {/* Cuestionarios obligatorios (batería oficial, sin el Brief COPE) */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                          Cuestionarios obligatorios
                        </span>
                        <span className="text-xs font-semibold text-gray-700">
                          {requiredDone} de {requiredTotal} · {requiredPct}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-1.5 rounded-full transition-all duration-500 ${requiredAllDone ? 'bg-green-500' : 'bg-blue-600'}`}
                          style={{ width: `${requiredPct}%` }}
                        />
                      </div>
                    </div>

                    {/* Brief COPE (opcional, fuera de la batería oficial) */}
                    {copingQuestionnaire && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                            Brief COPE <span className="normal-case text-gray-400">(opcional)</span>
                          </span>
                          <span className="text-xs font-semibold text-gray-700">
                            {copingPct}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-1.5 rounded-full transition-all duration-500 ${copingDone ? 'bg-green-500' : 'bg-indigo-400'}`}
                            style={{ width: `${copingPct}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Vertical list of questionnaires */}
                <div className="space-y-3">
                  {availableQuestionnaires.map((q) => {
                    const Icon = questionnaireIcons[q.id] || FileText;
                    const isDone = q.completed;
                    return (
                      <button
                        key={q.id}
                        onClick={() => !isDone && loadQuestionnaire(q.id)}
                        disabled={isDone}
                        aria-disabled={isDone}
                        className={`group w-full flex items-center text-left border-2 rounded-2xl p-4 sm:p-5 transition-all duration-200 ${
                          isDone
                            ? 'border-gray-200 bg-gray-50 opacity-70 cursor-not-allowed pointer-events-none'
                            : 'border-gray-200 bg-white hover:border-blue-500 hover:shadow-md cursor-pointer'
                        }`}
                      >
                        <div
                          className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${
                            isDone ? 'bg-gray-100' : 'bg-blue-50 group-hover:bg-blue-100'
                          } transition-colors`}
                        >
                          <Icon
                            className={`w-6 h-6 ${isDone ? 'text-gray-400' : 'text-blue-600'}`}
                            strokeWidth={1.75}
                          />
                        </div>
                        <div className="flex-1 min-w-0 ml-4">
                          <div
                            className={`text-base font-semibold truncate ${
                              isDone ? 'text-gray-500 line-through decoration-1' : 'text-gray-900'
                            }`}
                          >
                            {q.name}
                          </div>
                          <div
                            className={`text-sm mt-0.5 flex items-center gap-1 ${
                              isDone ? 'text-green-600 font-medium' : 'text-gray-500'
                            }`}
                          >
                            {isDone ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2.25} />
                                Completado
                              </>
                            ) : (
                              `${q.totalQuestions} preguntas`
                            )}
                          </div>
                        </div>
                        <div className="flex-shrink-0 ml-3">
                          {isDone ? (
                            <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center">
                              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          ) : (
                            <svg className="w-5 h-5 text-gray-300 group-hover:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Completion message */}
                {allDone && (
                  <div className="mt-6 bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
                    <p className="text-green-800 font-medium text-sm">
                      {integrationReturnUrl
                        ? '¡Has completado todos los cuestionarios! Te estamos redirigiendo a tu portal de pruebas...'
                        : '¡Has completado todos los cuestionarios! Ya puedes cerrar esta página.'}
                    </p>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>
    </ParticipantLayout>
  );
};

export default ParticipantEvaluationPage;