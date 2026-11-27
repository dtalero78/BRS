/**
 * Textos de la pantalla del participante, por idioma.
 *
 * El idioma lo fija el evaluador en la evaluación (`evaluations.language`) y
 * llega en `GET /api/participant-access/validate/:token` como
 * `evaluation.language`. Antes de esa respuesta (cargando, enlace inválido) no
 * se sabe el idioma y se usa español.
 *
 * Las preguntas y opciones NO viven aquí: las traduce el backend
 * (`backend/utils/questionnaire-data.js`). Esto es solo la interfaz.
 */

export type ParticipantLanguage = 'es' | 'en';

const es = {
  errorTitle: 'Error',
  goToDocumentAccess: 'Ingresar con mi número de documento',
  noParticipantData: 'No se encontraron datos del participante.',
  invalidToken: 'Token inválido',
  loadQuestionnairesError: 'Error al cargar cuestionarios',
  loadDataError: 'Error al cargar datos',
  loadQuestionnaireError: 'Error al cargar el cuestionario',
  submitError: 'Error al enviar cuestionario',

  hello: (name: string) => `Hola, ${name}`,

  // Consentimiento
  consentRegisterError: 'No se pudo registrar tu respuesta',
  consentDeclinedTitle: 'Registramos tu decisión',
  consentDeclinedBody: 'No autorizaste participar en la evaluación. Ya puedes cerrar esta página.',
  consentDeclinedNote:
    'Tu decisión no tiene ninguna consecuencia laboral. Si cambias de opinión, puedes volver a este enlace y aceptar.',
  consentReread: 'Volver a leer el consentimiento',
  consentSubtitle: 'Antes de empezar, necesitamos tu autorización',
  consentLoading: 'Cargando el consentimiento…',
  consentCheckbox:
    'Leí y entendí este documento, y autorizo de forma libre el tratamiento de mis datos en los términos descritos.',
  consentRegistering: 'Registrando…',
  consentAccept: 'Acepto y deseo participar',
  consentDecline: 'No autorizo participar',
  consentNoConsequence: 'Negarte no tiene ninguna consecuencia laboral.',

  // Verificación facial
  faceVerifyError: 'No se pudo verificar tu identidad',
  faceEnrolled: 'Identidad registrada. Ya puedes continuar.',
  faceVerified: 'Identidad verificada.',
  faceReverify: 'Por seguridad debemos verificar tu identidad otra vez.',
  thisQuestionnaire: 'este cuestionario',
  faceUnavailableTitle: 'Verificación no disponible',
  faceUnavailableBody:
    'No podemos verificar tu identidad en este momento. Contacta a tu evaluador para que habilite el acceso.',
  backToMenu: 'Volver al menú',
  verifyIdentity: 'Verifica tu identidad',
  toContinueWith: 'Para continuar con',
  registerFace: 'Registra tu rostro',
  confirmItsYou: 'Confirma que eres tú',
  faceEnrollHelp:
    'Mira a la cámara y toma una foto de tu rostro. La usaremos para confirmar que eres tú quien responde cada cuestionario de la batería. Busca buena luz y quítate gafas oscuras o gorra.',
  faceVerifyHelp:
    'Mira a la cámara y toma una foto. Te la pedimos al empezar cada cuestionario para confirmar que sigues siendo tú quien responde.',
  faceMismatchTitle: 'Tu rostro no coincide con el registrado.',
  faceMismatchBody:
    'Intenta de nuevo con mejor luz y de frente a la cámara. Si el problema continúa, contacta a tu evaluador para que reinicie tu registro.',
  tryAgain: 'Intentar de nuevo',
  takePhoto: 'Tomar foto',
  facePrivacy: 'Tu foto se usa únicamente para verificar tu identidad y no se comparte con tus respuestas.',

  // Guardado
  saveFailed:
    'No pudimos guardar tus últimas respuestas (revisa tu conexión). Quedaron respaldadas en este dispositivo; no cierres esta pestaña e intenta continuar.',
  saveRejected: 'El servidor rechazó el guardado',
  consentRequired: 'Consentimiento requerido',
  faceRequired: 'Verificación de identidad requerida',
  saveError: (status: number) => `Error al guardar respuestas: ${status}`,

  // Cuestionario
  answerToFinish: 'Falta responder esta pregunta para poder finalizar',
  selectOption: 'Selecciona una opción',
  howManyYears: '¿Cuántos años exactamente?',
  yearsPlaceholder: 'Ej. 5',
  sending: 'Enviando…',
  completeAnswer: 'Completa la respuesta',
  finishQuestionnaire: 'Finalizar cuestionario',
  continue: 'Continuar',
  saving: 'Guardando…',
  savedOnDevice: 'Sin conexión: guardado en este dispositivo',
  saved: 'Respuestas guardadas',
  autosave: 'Tus respuestas se guardan automáticamente',
  backToList: 'Volver a la lista de cuestionarios',
  seeInstructions: 'Ver instrucciones',
  fichaPrefilled: 'Algunos datos ya vienen registrados por tu evaluador. Revísalos y corrige lo que no sea correcto.',
  autoAdvance: 'Al elegir una opción avanzas automáticamente',
  previousQuestion: 'Pregunta anterior',

  // Menú
  selectQuestionnaire: 'Selecciona un cuestionario para continuar',
  watchIntroVideo: 'Ver video de instrucciones',
  requiredQuestionnaires: 'Cuestionarios obligatorios',
  doneOf: (done: number, total: number) => `${done} de ${total}`,
  optional: '(opcional)',
  completed: 'Completado',
  questionsCount: (n: number) => `${n} preguntas`,
  allDoneRedirect: '¡Has completado todos los cuestionarios! Te estamos redirigiendo a tu portal de pruebas...',
  allDone: '¡Has completado todos los cuestionarios! Ya puedes cerrar esta página.',
};

export type ParticipantStrings = typeof es;

const en: ParticipantStrings = {
  errorTitle: 'Error',
  goToDocumentAccess: 'Sign in with my ID number',
  noParticipantData: 'No participant data was found.',
  invalidToken: 'Invalid link',
  loadQuestionnairesError: 'Could not load the questionnaires',
  loadDataError: 'Could not load your data',
  loadQuestionnaireError: 'Could not load the questionnaire',
  submitError: 'Could not submit the questionnaire',

  hello: (name: string) => `Hello, ${name}`,

  consentRegisterError: 'We could not record your answer',
  consentDeclinedTitle: 'We have recorded your decision',
  consentDeclinedBody: 'You did not authorize taking part in the assessment. You can close this page now.',
  consentDeclinedNote:
    'Your decision has no employment consequences. If you change your mind, you can come back to this link and accept.',
  consentReread: 'Read the consent form again',
  consentSubtitle: 'Before you begin, we need your authorization',
  consentLoading: 'Loading the consent form…',
  consentCheckbox:
    'I have read and understood this document, and I freely authorize the processing of my data under the terms described.',
  consentRegistering: 'Recording…',
  consentAccept: 'I accept and wish to take part',
  consentDecline: 'I do not authorize taking part',
  consentNoConsequence: 'Declining has no employment consequences.',

  faceVerifyError: 'We could not verify your identity',
  faceEnrolled: 'Identity registered. You can continue now.',
  faceVerified: 'Identity verified.',
  faceReverify: 'For security reasons we need to verify your identity again.',
  thisQuestionnaire: 'this questionnaire',
  faceUnavailableTitle: 'Verification unavailable',
  faceUnavailableBody:
    'We cannot verify your identity right now. Please contact your assessor so they can enable access.',
  backToMenu: 'Back to menu',
  verifyIdentity: 'Verify your identity',
  toContinueWith: 'To continue with',
  registerFace: 'Register your face',
  confirmItsYou: "Confirm it's you",
  faceEnrollHelp:
    'Look at the camera and take a photo of your face. We will use it to confirm that it is you who answers each questionnaire in the battery. Find good lighting and remove sunglasses or caps.',
  faceVerifyHelp:
    'Look at the camera and take a photo. We ask for it at the start of each questionnaire to confirm that it is still you who is answering.',
  faceMismatchTitle: 'Your face does not match the registered one.',
  faceMismatchBody:
    'Try again with better lighting, facing the camera. If the problem continues, contact your assessor so they can reset your registration.',
  tryAgain: 'Try again',
  takePhoto: 'Take photo',
  facePrivacy: 'Your photo is used only to verify your identity and is not shared with your answers.',

  saveFailed:
    'We could not save your latest answers (check your connection). They are backed up on this device; do not close this tab and try to continue.',
  saveRejected: 'The server rejected the save',
  consentRequired: 'Consent required',
  faceRequired: 'Identity verification required',
  saveError: (status: number) => `Error saving answers: ${status}`,

  answerToFinish: 'You need to answer this question to finish',
  selectOption: 'Select an option',
  howManyYears: 'How many years exactly?',
  yearsPlaceholder: 'E.g. 5',
  sending: 'Sending…',
  completeAnswer: 'Complete your answer',
  finishQuestionnaire: 'Finish questionnaire',
  continue: 'Continue',
  saving: 'Saving…',
  savedOnDevice: 'Offline: saved on this device',
  saved: 'Answers saved',
  autosave: 'Your answers are saved automatically',
  backToList: 'Back to the list of questionnaires',
  seeInstructions: 'See instructions',
  fichaPrefilled: 'Some details were already entered by your assessor. Review them and correct anything that is wrong.',
  autoAdvance: 'Choosing an option takes you to the next question automatically',
  previousQuestion: 'Previous question',

  selectQuestionnaire: 'Select a questionnaire to continue',
  watchIntroVideo: 'Watch the instructions video',
  requiredQuestionnaires: 'Required questionnaires',
  doneOf: (done: number, total: number) => `${done} of ${total}`,
  optional: '(optional)',
  completed: 'Completed',
  questionsCount: (n: number) => `${n} questions`,
  allDoneRedirect: 'You have completed all the questionnaires! We are redirecting you to your testing portal...',
  allDone: 'You have completed all the questionnaires! You can close this page now.',
};

export const PARTICIPANT_STRINGS: Record<ParticipantLanguage, ParticipantStrings> = { es, en };

export function participantStrings(language?: string | null): ParticipantStrings {
  return language === 'en' ? en : es;
}
