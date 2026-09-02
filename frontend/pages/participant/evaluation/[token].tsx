import { useState, useEffect, useRef, ReactNode } from 'react';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import { ClipboardList, Briefcase, HardHat, Home, Brain, Shield, FileText, CheckCircle2, ArrowLeft, ChevronLeft, ChevronDown, Check, ScanFace, ShieldAlert, PlayCircle, LucideIcon } from 'lucide-react';
import { BRAND } from '../../../config/brand';
import FaceCapture from '../../../components/FaceCapture';
import ConsentText from '../../../components/ConsentText';
import IntroVideoModal from '../../../components/IntroVideoModal';

// Simple wrapper for participant pages (no auth required)
//
// `coBrandLogo` es el logo de la EMPRESA evaluada (companies.logo_url), que se
// muestra junto al de la plataforma. Es distinto de BRAND, que es la marca de
// la instancia y se resuelve en build: dentro de una misma instancia cada
// empresa puede tener el suyo. En null se ve solo el de la plataforma.
function ParticipantLayout({ children, coBrandLogo }: { children: ReactNode; coBrandLogo?: string | null }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <img src={BRAND.logo} alt={BRAND.name} className="h-8 w-auto" />
          {coBrandLogo && (
            <>
              <span className="h-6 w-px flex-shrink-0 bg-gray-200" aria-hidden="true" />
              {/* alt vacio a proposito: el logotipo trae su propia razon social,
                  que no tiene por que coincidir con companies.name (aqui, por
                  ejemplo, la consultora que aplica la medicion y no la empresa
                  evaluada). Un alt inventado a partir del nombre en la base
                  leeria mal. La plataforma ya queda nombrada por el logo de al
                  lado. `rounded` porque el archivo trae su propio fondo solido
                  y sin esquinas se ve como una calcomania pegada al header. */}
              <img src={coBrandLogo} alt="" className="h-8 w-auto rounded" />
            </>
          )}
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

// IDs del frontend → questionnaire_type de la base. Se usa tanto al guardar
// respuestas como al verificar el rostro: la verificación facial es POR
// cuestionario y el backend la registra con este nombre.
const QUESTIONNAIRE_TYPE_MAP: { [key: string]: string } = {
  'ficha-datos': 'ficha_datos',
  'forma-a': 'intralaboral_a',
  'forma-b': 'intralaboral_b',
  'extralaboral': 'extralaboral',
  'estres': 'estres',
  'coping': 'coping',
};

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
  const [coBrandLogo, setCoBrandLogo] = useState<string | null>(null);
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

  // Consentimiento informado. Va ANTES del menú de cuestionarios y bloquea:
  // sin aceptar no se trata ningún dato. El backend aplica el mismo guard en
  // /responses y /face, así que esta pantalla es la cara visible de la regla.
  const [consentText, setConsentText] = useState('');
  const [consentAccepted, setConsentAccepted] = useState(true); // optimista hasta cargar
  const [consentDeclined, setConsentDeclined] = useState(false);
  const [consentBusy, setConsentBusy] = useState(false);
  const [consentLeido, setConsentLeido] = useState(false);

  // Verificación facial (opt-in por instancia: FACE_VERIFICATION_ENABLED en el
  // backend). Si `faceRequired` es false todo este bloque es inerte y el flujo
  // es el de siempre. Es BLOQUEANTE y va POR CUESTIONARIO: se pide la cara al
  // entrar a cada formulario que aún no esté verificado, y el backend rechaza
  // los POST de respuestas de un cuestionario sin su verificación.
  const [faceRequired, setFaceRequired] = useState(false);
  const [faceAvailable, setFaceAvailable] = useState(true);
  const [faceEnrolled, setFaceEnrolled] = useState(false);
  // Cuestionarios verificados EN ESTA SESIÓN. Arranca vacío en cada carga de
  // página a propósito: si se sembrara con las verificaciones viejas del
  // servidor, quien abandona un cuestionario a medias y vuelve más tarde
  // entraría sin mostrar la cara.
  const [verifiedQuestionnaires, setVerifiedQuestionnaires] = useState<string[]>([]);
  // Cuestionario que el participante quiere abrir y que está esperando su selfie.
  const [pendingQuestionnaireId, setPendingQuestionnaireId] = useState<string | null>(null);
  const [faceBusy, setFaceBusy] = useState(false);
  const [faceIssues, setFaceIssues] = useState<string[]>([]);
  const [faceFailed, setFaceFailed] = useState(false);

  const isFaceVerifiedFor = (questionnaireId: string) =>
    verifiedQuestionnaires.includes(QUESTIONNAIRE_TYPE_MAP[questionnaireId]);

  // Auto-save timeout ref for debouncing
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Marca que un guardado se cayó por verificación vencida: al re-verificar se
  // reintenta solo, sin que el participante tenga que volver a responder nada.
  const pendingSaveRef = useRef(false);
  // El scroll de la pregunta vive dentro de <main>, no en la página: `globals.css`
  // pone `overflow-x: hidden` en html/body y eso rompe `position: sticky`, así que
  // header y footer se fijan como hermanos flex de un contenedor sin scroll.
  const questionScrollRef = useRef<HTMLElement | null>(null);
  // Alto real del viewport visible. En iOS el teclado NO encoge `100dvh`: sin esto
  // el botón "Continuar" queda escondido detrás del teclado.
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);

  // Video de instrucciones sobre el panel de cuestionarios (solo marcas con
  // `BRAND.introVideo`). Se abre una vez por participante y dispositivo: al
  // terminar cada cuestionario se vuelve a este panel, y reproducirlo cinco
  // veces sería un castigo. Queda un botón para volver a verlo.
  const [showIntroVideo, setShowIntroVideo] = useState(false);
  const introVideoSeenKey = token ? `brs_intro_video_seen_${token}` : null;

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

  // Abre el video apenas el panel queda a la vista (token validado y sin
  // cuestionario en curso), no antes: si se abriera durante la carga el
  // participante vería el video sobre una pantalla en blanco.
  useEffect(() => {
    if (!BRAND.introVideo || !participant || currentQuestionnaire || !introVideoSeenKey) return;
    try {
      if (localStorage.getItem(introVideoSeenKey)) return;
    } catch (e) {
      // Safari en modo privado puede lanzar al leer localStorage: se muestra
      // el video igual, que es mejor que romper el panel.
    }
    setShowIntroVideo(true);
  }, [participant, currentQuestionnaire, introVideoSeenKey]);

  const closeIntroVideo = () => {
    setShowIntroVideo(false);
    try {
      if (introVideoSeenKey) localStorage.setItem(introVideoSeenKey, '1');
    } catch (e) {
      // Sin persistencia el video reaparecerá; no es motivo para fallar.
    }
  };

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
      setCoBrandLogo(validationData.company?.logoUrl || null);

      // Consentimiento informado: se carga siempre, en todas las instancias.
      try {
        const consentResponse = await fetch(`/api/participant-access/${accessToken}/consent`);
        if (consentResponse.ok) {
          const consentData = await consentResponse.json();
          setConsentText(consentData.text || '');
          setConsentAccepted(!!consentData.accepted);
          setConsentDeclined(!!consentData.declined);
        }
      } catch (consentErr) {
        console.error('Consent status error:', consentErr);
      }

      // Estado de la verificación facial. Si la instancia no la tiene prendida
      // el endpoint devuelve `{ required: false }` y no cambia nada del flujo.
      try {
        const faceResponse = await fetch(`/api/participant-access/${accessToken}/face-status`);
        if (faceResponse.ok) {
          const faceData = await faceResponse.json();
          setFaceRequired(!!faceData.required);
          setFaceAvailable(faceData.available !== false);
          setFaceEnrolled(!!faceData.enrolled);
        }
      } catch (faceErr) {
        // Un fallo consultando el estado no debe tumbar la carga de la batería.
        console.error('Face status error:', faceErr);
      }

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

  /**
   * Registra la decisión del participante sobre el consentimiento informado.
   * Rechazar no es definitivo: puede volver a entrar y aceptar.
   */
  const responderConsentimiento = async (accepted: boolean) => {
    if (!token) return;
    setConsentBusy(true);
    try {
      const response = await fetch(`/api/participant-access/${token}/consent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accepted })
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'No se pudo registrar tu respuesta');
      }
      setConsentAccepted(accepted);
      setConsentDeclined(!accepted);
      // Si un guardado se cayó por falta de consentimiento, se reintenta ahora.
      if (accepted && pendingSaveRef.current) {
        pendingSaveRef.current = false;
        saveResponsesWithRetry();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo registrar tu respuesta');
    } finally {
      setConsentBusy(false);
    }
  };

  /**
   * Punto de entrada a un cuestionario desde el hub. Si la instancia exige
   * verificación facial y este formulario todavía no la tiene, primero se pide
   * la selfie; el cuestionario se carga recién cuando la cara coincide.
   */
  const startQuestionnaire = (questionnaireId: string) => {
    if (faceRequired && !isFaceVerifiedFor(questionnaireId)) {
      setFaceIssues([]);
      setFaceFailed(false);
      setPendingQuestionnaireId(questionnaireId);
      return;
    }
    loadQuestionnaire(questionnaireId);
  };

  /**
   * Envía la selfie al backend, atada al cuestionario que se va a abrir. El
   * backend decide solo si es enrolamiento (primera vez, sin referencia) o
   * verificación contra la referencia ya guardada.
   */
  const submitFacePhoto = async (photo: string) => {
    if (!token || !pendingQuestionnaireId) return;
    const questionnaireId = pendingQuestionnaireId;
    setFaceBusy(true);
    setFaceIssues([]);
    setFaceFailed(false);

    try {
      const response = await fetch(`/api/participant-access/${token}/face`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo, questionnaireType: QUESTIONNAIRE_TYPE_MAP[questionnaireId] })
      });
      const data = await response.json();

      if (response.status === 503) {
        setFaceAvailable(false);
        return;
      }
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo verificar tu identidad');
      }

      if (data.verified) {
        setFaceEnrolled(true);
        setVerifiedQuestionnaires(prev => [...prev, QUESTIONNAIRE_TYPE_MAP[questionnaireId]]);
        setPendingQuestionnaireId(null);
        toast.success(
          data.mode === 'enroll'
            ? 'Identidad registrada. Ya puedes continuar.'
            : 'Identidad verificada.'
        );
        // Si un guardado se cayó porque faltaba la verificación, se reintenta
        // ahora; si no, se abre el cuestionario que el participante pidió.
        if (pendingSaveRef.current) {
          pendingSaveRef.current = false;
          saveResponsesWithRetry();
        } else {
          loadQuestionnaire(questionnaireId);
        }
        return;
      }

      // No pasó: en enrolamiento suele ser calidad de la foto (issues legibles);
      // en verificación es que la cara no coincide con la referencia.
      setFaceIssues(data.issues || []);
      setFaceFailed(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo verificar tu identidad');
    } finally {
      setFaceBusy(false);
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
      const { responses: mergedResponses, answered } = await loadExistingResponses(
        questionnaireId, initialResponses, data.questionnaire,
      );

      // Reanudar en la primera sin responder, contando SOLO lo que la persona
      // guardó — no lo pre-llenado. La ficha llega con los datos que cargó el
      // evaluador (nombre, sexo, año, estudios…), así que tomarlos por
      // respondidos abría la ficha en la pregunta 6 y la persona nunca veía
      // ni podía corregir su nivel de estudios, que además puede venir
      // deformado del Excel importado.
      const questions = getQuestionsFromData(data.questionnaire);
      if (questions.length > 0 && answered.size > 0) {
        const firstUnanswered = questions.findIndex(q => !answered.has(`q_${q.numero}`));
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

  /**
   * Devuelve las respuestas a pintar (pre-llenado + guardado) y, aparte, las
   * claves que SÍ están guardadas (servidor o respaldo local). Quien decide
   * dónde reanudar necesita esa distinción: lo pre-llenado se muestra, pero no
   * cuenta como contestado por la persona.
   */
  const loadExistingResponses = async (
    questionnaireId: string, preFilledResponses = {}, questionnaireData: any = null,
  ): Promise<{ responses: {[key: string]: any}; answered: Set<string> }> => {
    if (!token || typeof token !== 'string') return { responses: preFilledResponses, answered: new Set() };

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
        // Lo contestado por la persona: lo que ya está en el servidor o en el
        // respaldo local de este navegador. El pre-llenado queda fuera.
        let answeredKeys = new Set(Object.keys(responseMap));

        // Merge with backup if exists and has more responses
        if (backupData) {
          const backupResponses = JSON.parse(backupData);
          if (Object.keys(backupResponses).length > Object.keys(responseMap).length) {
            console.log('Recovering responses from localStorage backup');
            finalResponses = backupResponses;
            answeredKeys = new Set(Object.keys(backupResponses));
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

        return { responses: finalResponses, answered: answeredKeys };
      }
    } catch (err) {
      console.error('Error loading existing responses:', err);
    }
    return { responses: preFilledResponses, answered: new Set() };
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

  const handleResponseChange = (
    questionNumber: number | string,
    value: number | string,
    options?: { raw?: boolean }
  ) => {
    const key = `q_${questionNumber}`;
    // Only convert to number if the value is actually numeric.
    // `raw` desactiva la conversión para las opciones de selección: el estrato
    // tiene opciones "1".."6" y guardarlas como número rompía la comparación
    // con la opción (1 === '1' es false), así que la tarjeta nunca se marcaba.
    const parsedValue = !options?.raw && typeof value === 'string' && value !== '' && !isNaN(Number(value))
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
      // El backend rechazó el guardado por falta de verificación de ESTE
      // cuestionario (p. ej. el evaluador reinició el registro facial a mitad
      // de camino). No es un fallo transitorio: reintentar solo gastaría los 3
      // intentos para terminar culpando a la conexión. Se devuelve al
      // participante a la pantalla de selfie; sus respuestas siguen en memoria
      // y se reguardan al verificar.
      if (error?.consentRequired) {
        pendingSaveRef.current = true;
        setConsentAccepted(false);
        setConsentLeido(false);
        setSaveState('idle');
        return;
      }

      if (error?.faceVerificationRequired) {
        const tipo = QUESTIONNAIRE_TYPE_MAP[currentQuestionnaire?.type || ''];
        // El servidor no las va a aceptar hasta que se verifique; quedan en el
        // dispositivo por si el participante cierra o sale al menu.
        respaldarEnDispositivo(responsesToSave);
        pendingSaveRef.current = true;
        setFaceRequired(true);
        setVerifiedQuestionnaires(prev => prev.filter(t => t !== tipo));
        if (currentQuestionnaire) setPendingQuestionnaireId(currentQuestionnaire.type);
        setSaveState('idle');
        toast('Por seguridad debemos verificar tu identidad otra vez.', { icon: '🔒' });
        return;
      }

      // Rechazo explicito del servidor: reintentar no lo arregla y el mensaje
      // final culparia a la conexion.
      if (error?.noReintentar) {
        respaldarEnDispositivo(responsesToSave);
        setSaveState('error');
        toast.error(error.message, { duration: 8000 });
        return;
      }

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

  /**
   * Respalda en el dispositivo lo respondido hasta ahora. Se usa antes de
   * cualquier salida que no pueda guardar en el servidor (verificacion facial
   * pendiente): sin esto, salir al menu pierde las respuestas en memoria.
   */
  const respaldarEnDispositivo = (responsesToSave = responses) => {
    if (!currentQuestionnaire) return;
    try {
      localStorage.setItem(
        `brs_backup_${token}_${currentQuestionnaire.type}`,
        JSON.stringify(responsesToSave)
      );
    } catch (err) {
      console.error('No se pudo respaldar en localStorage:', err);
    }
  };

  const saveResponses = async (responsesToSave = responses) => {
    if (!currentQuestionnaire || !token || typeof token !== 'string') return;

    setSaveState('saving');

    try {
      const questionnaireTypeMap = QUESTIONNAIRE_TYPE_MAP;

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
        // 409 = "este cuestionario ya fue completado". No es un fallo: el
        // servidor está confirmando que el dato YA está guardado. Reintentar
        // nunca lo resuelve, y agotar los reintentos termina culpando a la
        // conexión y pidiéndole al participante que no cierre la pestaña —
        // el peor mensaje posible para el caso más benigno. Se trata como
        // éxito para que un guardado rezagado no alarme a quien ya terminó.
        if (response.status === 409) {
          setSaveState('saved');
          console.log('Guardado ignorado: el cuestionario ya estaba completado en el servidor');
          return;
        }
        if (response.status === 429) {
          throw new Error('429: Too Many Requests');
        }
        // 403/503 de verificación facial: se marca para que la capa de
        // reintentos no lo trate como fallo de red.
        if (response.status === 403 || response.status === 503) {
          const body = await response.json().catch(() => ({}));
          // Consentimiento revocado o nunca aceptado: se devuelve a esa pantalla.
          if (body.code === 'CONSENT_REQUIRED') {
            const consentError: any = new Error(body.error || 'Consentimiento requerido');
            consentError.consentRequired = true;
            throw consentError;
          }
          if (body.code === 'FACE_VERIFICATION_REQUIRED' || body.code === 'FACE_UNAVAILABLE') {
            const faceError: any = new Error(body.error || 'Verificación de identidad requerida');
            faceError.faceVerificationRequired = true;
            if (body.code === 'FACE_UNAVAILABLE') setFaceAvailable(false);
            throw faceError;
          }
          // Un 403 sin ese código sigue siendo un rechazo del servidor, no un
          // problema de red: reintentarlo 3 veces para terminar diciendo
          // "revisa tu conexión" desorienta a quien tiene señal perfecta.
          const rechazo: any = new Error(body.error || 'El servidor rechazó el guardado');
          rechazo.noReintentar = true;
          throw rechazo;
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

    // Cancela el autoguardado rezagado antes de enviar. Al responder la ultima
    // pregunta, handleResponse programa un guardado a 1s; si el participante
    // toca "Finalizar" antes de que dispare, ese timeout reenvia el mismo
    // cuestionario DESPUES de que este submit lo marco como completado, y el
    // backend lo rechaza con 409. En el ultimo cuestionario de la bateria eso
    // es sistematico, porque el submit tambien deja el PE en 'completed'.
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

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
      <ParticipantLayout coBrandLogo={coBrandLogo}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
        </div>
      </ParticipantLayout>
    );
  }

  if (error) {
    return (
      <ParticipantLayout coBrandLogo={coBrandLogo}>
        <div className="max-w-2xl mx-auto mt-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-lg font-medium text-red-800 mb-2">Error</h2>
            <p className="text-red-600">{error}</p>
            {/* Va a la puerta general, no a "/": el participante no tiene
                usuario, asi que el inicio es un login que no le sirve (y en
                las marcas sin sitio comercial, si el navegador tiene sesion
                de evaluador abierta, lo deja en el dashboard del evaluador).
                En /acceso entra con su documento y recupera su bateria, que
                es justo lo que necesita cuando el enlace no funciono. */}
            <div className="mt-4">
              <button
                onClick={() => router.push('/acceso')}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
              >
                Ingresar con mi número de documento
              </button>
            </div>
          </div>
        </div>
      </ParticipantLayout>
    );
  }

  if (!participant) {
    return (
      <ParticipantLayout coBrandLogo={coBrandLogo}>
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
  // Consentimiento informado (bloqueante).
  // Es la PRIMERA pantalla: va antes del gate facial y antes del menú, porque
  // sin autorización no se debe tratar ningún dato — ni las respuestas ni el
  // rostro. El backend rechaza /responses y /face con CONSENT_REQUIRED.
  // ---------------------------------------------------------------------------
  if (!consentAccepted) {
    // Rechazó: pantalla de salida, con la puerta abierta a cambiar de opinión.
    if (consentDeclined) {
      return (
        <ParticipantLayout coBrandLogo={coBrandLogo}>
          <div className="max-w-md mx-auto px-4 py-12">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">Registramos tu decisión</h2>
              <p className="mt-3 text-sm text-gray-600">
                No autorizaste participar en la evaluación. Ya puedes cerrar esta página.
              </p>
              <p className="mt-3 text-sm text-gray-500">
                Tu decisión no tiene ninguna consecuencia laboral. Si cambias de opinión,
                puedes volver a este enlace y aceptar.
              </p>
              <button
                onClick={() => { setConsentDeclined(false); setConsentLeido(false); }}
                className="mt-5 w-full rounded-xl border border-gray-300 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Volver a leer el consentimiento
              </button>
            </div>
          </div>
        </ParticipantLayout>
      );
    }

    return (
      <ParticipantLayout coBrandLogo={coBrandLogo}>
        <div className="min-h-screen bg-gray-50 py-6">
          <div className="max-w-2xl mx-auto px-4">
            <div className="mb-5">
              <h1 className="text-2xl font-bold text-gray-900 mb-1">
                Hola, {participant.firstName}
              </h1>
              <p className="text-gray-500">
                Antes de empezar, necesitamos tu autorización
              </p>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              {consentText
                ? <ConsentText text={consentText} />
                : <p className="text-sm text-gray-500">Cargando el consentimiento…</p>}

              {/* La casilla obliga a un acto deliberado. Un consentimiento que se
                  acepta de un clic reflejo no es informado. */}
              <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
                <input
                  type="checkbox"
                  checked={consentLeido}
                  onChange={(e) => setConsentLeido(e.target.checked)}
                  className="mt-0.5 h-5 w-5 flex-shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">
                  Leí y entendí este documento, y autorizo de forma libre el tratamiento
                  de mis datos en los términos descritos.
                </span>
              </label>

              <div className="mt-5 space-y-2">
                <button
                  onClick={() => responderConsentimiento(true)}
                  disabled={!consentLeido || consentBusy || !consentText}
                  className="w-full rounded-xl bg-blue-600 py-3.5 text-base font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  {consentBusy ? 'Registrando…' : 'Acepto y deseo participar'}
                </button>
                <button
                  onClick={() => responderConsentimiento(false)}
                  disabled={consentBusy}
                  className="w-full rounded-xl border border-gray-300 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                >
                  No autorizo participar
                </button>
              </div>

              <p className="mt-4 text-center text-xs text-gray-400">
                Negarte no tiene ninguna consecuencia laboral.
              </p>
            </div>
          </div>
        </div>
      </ParticipantLayout>
    );
  }

  // ---------------------------------------------------------------------------
  // Gate de verificación facial (bloqueante), UNA POR CUESTIONARIO.
  // Se interpone entre el hub y el cuestionario que el participante acaba de
  // elegir: no se carga hasta que la cara coincide. El backend aplica el mismo
  // bloqueo en POST /responses contra el questionnaire_type, así que esto es la
  // cara visible de la regla, no la regla misma.
  // ---------------------------------------------------------------------------
  if (faceRequired && pendingQuestionnaireId) {
    const nombreCuestionario =
      availableQuestionnaires.find(q => q.id === pendingQuestionnaireId)?.name || 'este cuestionario';
    // Módulo prendido pero mal configurado (sin credenciales de AWS). Se falla
    // cerrado a propósito: dejar pasar sin verificar anularía en silencio el
    // control que la empresa contrató.
    if (!faceAvailable) {
      return (
        <ParticipantLayout coBrandLogo={coBrandLogo}>
          <div className="max-w-md mx-auto px-4 py-10">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
              <ShieldAlert className="mx-auto mb-3 text-amber-500" size={44} />
              <h2 className="text-lg font-semibold text-amber-900">Verificación no disponible</h2>
              <p className="mt-2 text-sm text-amber-800">
                No podemos verificar tu identidad en este momento. Contacta a tu evaluador
                para que habilite el acceso.
              </p>
            </div>
          </div>
        </ParticipantLayout>
      );
    }

    const esEnrolamiento = !faceEnrolled;

    return (
      <ParticipantLayout coBrandLogo={coBrandLogo}>
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
          <div className="max-w-md mx-auto px-4">
            <button
              onClick={() => {
                // Sale al menu, no de vuelta al cuestionario. Cuando la selfie
                // se pide a mitad de camino (el guardado devolvio 403),
                // limpiar solo pendingQuestionnaireId dejaba al participante
                // adentro respondiendo algo que el servidor iba a rechazar en
                // cada guardado, con el aviso enganoso de "revisa tu conexion".
                respaldarEnDispositivo();
                setPendingQuestionnaireId(null);
                setCurrentQuestionnaire(null);
              }}
              className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
            >
              <ChevronLeft className="w-4 h-4" />
              Volver al menú
            </button>

            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-1">
                {esEnrolamiento ? `Hola, ${participant.firstName}` : 'Verifica tu identidad'}
              </h1>
              {/* Se nombra el cuestionario: la cara se pide en cada uno, y sin
                  decir para cuál el participante cree que es un error repetido. */}
              <p className="text-gray-500">
                Para continuar con <span className="font-medium text-gray-700">{nombreCuestionario}</span>
              </p>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2 text-gray-700">
                <ScanFace size={20} className="text-blue-600" />
                <h2 className="text-base font-semibold">
                  {esEnrolamiento ? 'Registra tu rostro' : 'Confirma que eres tú'}
                </h2>
              </div>

              <p className="mb-5 text-sm text-gray-500">
                {esEnrolamiento
                  ? 'Mira a la cámara y toma una foto de tu rostro. La usaremos para confirmar que eres tú quien responde cada cuestionario de la batería. Busca buena luz y quítate gafas oscuras o gorra.'
                  : 'Mira a la cámara y toma una foto. Te la pedimos al empezar cada cuestionario para confirmar que sigues siendo tú quien responde.'}
              </p>

              {/* Problemas de calidad de la foto: son accionables, se listan tal cual */}
              {faceFailed && faceIssues.length > 0 && (
                <ul className="mb-4 list-disc rounded-xl border border-amber-200 bg-amber-50 py-3 pl-8 pr-4 text-sm text-amber-800">
                  {faceIssues.map((issue, i) => (
                    <li key={i}>{issue}</li>
                  ))}
                </ul>
              )}

              {/* Rostro que no coincide: no es un problema de foto, es de identidad */}
              {faceFailed && faceIssues.length === 0 && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <p className="font-medium">Tu rostro no coincide con el registrado.</p>
                  <p className="mt-1">
                    Intenta de nuevo con mejor luz y de frente a la cámara. Si el problema
                    continúa, contacta a tu evaluador para que reinicie tu registro.
                  </p>
                </div>
              )}

              <FaceCapture
                onCapture={submitFacePhoto}
                busy={faceBusy}
                label={faceFailed ? 'Intentar de nuevo' : 'Tomar foto'}
              />

              <p className="mt-4 text-center text-xs text-gray-400">
                Tu foto se usa únicamente para verificar tu identidad y no se comparte
                con tus respuestas.
              </p>
            </div>
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

      // Opciones: tarjetas de un toque. El umbral cubre las 12 del nivel de
      // estudios a propósito: era el ÚNICO campo de la ficha que caía en el
      // <select> nativo, y en pantallas chicas el popup se corta — una psicóloga
      // reportó que "Carrera militar / policía" y los Posgrado (las últimas de
      // la lista) "no aparecían". Con tarjetas todo se ve en el scroll normal.
      if (question.opciones && question.opciones.length > 0) {
        const selectedOption = responses[key];
        const needsYears = selectedOption?.toString().includes('más de un año');

        return (
          <div className="space-y-5">
            {question.opciones.length <= 12 ? (
              <div className="space-y-2.5">
                {question.opciones.map((opcion: string, index: number) => {
                  // Comparación por string: hay respuestas viejas guardadas como
                  // número (el <select> anterior las convertía) que si no, no se
                  // verían marcadas al volver a la pregunta.
                  const selected = selectedOption !== undefined && String(selectedOption) === String(opcion);
                  return (
                    <button
                      key={index}
                      type="button"
                      onClick={() => handleResponseChange(question.numero, opcion, { raw: true })}
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
                  value={selectedOption === undefined ? '' : String(selectedOption)}
                  onChange={(e) => handleResponseChange(question.numero, e.target.value, { raw: true })}
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
    <ParticipantLayout coBrandLogo={coBrandLogo}>
      {BRAND.introVideo && showIntroVideo && (
        <IntroVideoModal
          src={BRAND.introVideo}
          poster={BRAND.introVideoPoster}
          onClose={closeIntroVideo}
        />
      )}
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
                  {BRAND.introVideo && (
                    <button
                      onClick={() => setShowIntroVideo(true)}
                      className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800"
                    >
                      <PlayCircle className="h-4 w-4" />
                      Ver video de instrucciones
                    </button>
                  )}
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
                        onClick={() => !isDone && startQuestionnaire(q.id)}
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