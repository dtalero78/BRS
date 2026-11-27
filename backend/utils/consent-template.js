/**
 * Texto por defecto del consentimiento informado del participante.
 *
 * ⚠️ BORRADOR DE REFERENCIA, NO ASESORÍA LEGAL. Cubre lo que exigen la
 * Resolución 2646 de 2008, la Ley 1090 de 2006 y la Ley 1581 de 2012, pero
 * debe revisarlo el psicólogo responsable (y ojalá el área jurídica del
 * licenciatario) antes de usarlo en producción. Cada evaluador puede
 * reemplazarlo por el suyo: `evaluations.consent_text_override`.
 *
 * Formato: texto plano. Las líneas que empiezan con `## ` son títulos de
 * sección; el resto son párrafos separados por línea en blanco. El frontend
 * lo renderiza con ese contrato mínimo para que un evaluador pueda editarlo
 * sin saber HTML.
 */

const { BRAND_NAME } = require('../config/brand');
const { isFaceVerificationEnabled } = require('./rekognition');

/**
 * Arma el texto por defecto.
 *
 * @param {object} opts
 * @param {string} [opts.companyName] Empresa que contrata la medición.
 * @param {boolean} [opts.withBiometrics] Incluir la sección de datos
 *   biométricos. Por defecto se decide por la env var de verificación facial:
 *   pedir autorización para tratar la cara en una instancia que no captura
 *   caras confundiría al participante.
 * @param {'es'|'en'} [opts.language] Idioma de la evaluación (default 'es').
 *   En inglés no hay SOFI-SM (se apaga al elegir 'en'), así que esa rama
 *   ignora `withFatigue`.
 * @returns {string}
 */
function buildDefaultConsentText({ companyName, withBiometrics, withFatigue, language } = {}) {
  if (language === 'en') {
    const bio = withBiometrics === undefined ? isFaceVerificationEnabled() : !!withBiometrics;
    return buildEnglishConsentText({ companyName, biometricos: bio });
  }
  const empresa = (companyName || '').trim() || 'la empresa';
  // El SOFI-SM pregunta por síntomas (agotamiento, dolor, somnolencia): son
  // datos de salud, así que quien autoriza tiene que saber que se los piden.
  const fatiga = withFatigue
    ? ' También responderás un cuestionario corto sobre la fatiga que sientes al terminar tu jornada de trabajo.'
    : '';
  const biometricos = withBiometrics === undefined ? isFaceVerificationEnabled() : !!withBiometrics;

  const secciones = [];

  secciones.push(
`## Consentimiento informado

Antes de comenzar, léelo con calma. Al final decides si deseas participar.`
  );

  secciones.push(
`## De qué se trata

${empresa} está realizando una evaluación de factores de riesgo psicosocial con la Batería de Instrumentos del Ministerio de la Protección Social de Colombia, aplicada a través de la plataforma ${BRAND_NAME}. Su propósito es identificar condiciones del trabajo y del entorno que puedan afectar la salud de las personas, y definir acciones de prevención.

Responderás varios cuestionarios sobre tus condiciones de trabajo, tu vida fuera del trabajo y tus síntomas de estrés.${fatiga} Toma entre 20 y 40 minutos. Puedes hacerlo en varias sesiones: tus respuestas se guardan a medida que avanzas.`
  );

  secciones.push(
`## Tu participación es voluntaria

Puedes aceptar o negarte, y puedes suspender la evaluación en cualquier momento sin dar explicaciones. Negarte no acarrea ninguna consecuencia laboral: no afecta tu vinculación, tu evaluación de desempeño ni ningún beneficio.

No hay respuestas correctas ni incorrectas. Responde con sinceridad según tu experiencia real.`
  );

  secciones.push(
`## Qué pasa con tus respuestas

Tus respuestas individuales son confidenciales y las conoce únicamente el profesional en psicología con licencia vigente que dirige la medición, quien está sujeto al secreto profesional de la Ley 1090 de 2006.

${empresa} recibe un informe con resultados **agrupados**, que describe al conjunto de trabajadores o a áreas completas. Tu jefe y el área de recursos humanos no reciben tus respuestas individuales ni pueden identificarlas dentro del informe.

Los resultados se usan para diseñar el programa de vigilancia epidemiológica y las medidas de intervención, no para tomar decisiones sobre personas.`
  );

  const datosSensibles = biometricos
    ? `La información que entregas sobre tu salud y tu bienestar psicológico es un **dato sensible** según el artículo 5 de la Ley 1581 de 2012. Lo mismo aplica a la fotografía de tu rostro descrita en la sección siguiente.`
    : `La información que entregas sobre tu salud y tu bienestar psicológico es un **dato sensible** según el artículo 5 de la Ley 1581 de 2012.`;

  secciones.push(
`## Tratamiento de tus datos personales

${datosSensibles} La ley exige que autorices su tratamiento de forma previa, expresa e informada; eso es lo que estás haciendo con este documento.

Tus datos se tratan con la única finalidad de realizar esta evaluación, calcular sus resultados y elaborar los informes individual y organizacional. No se venden, no se comparten con terceros ajenos al proceso ni se usan con fines comerciales o publicitarios.

Se conservan por el tiempo que exija la normatividad de seguridad y salud en el trabajo, y luego se eliminan o anonimizan.`
  );

  if (biometricos) {
    secciones.push(
`## Verificación de identidad con reconocimiento facial

Esta evaluación usa verificación facial para confirmar que eres tú quien responde, y no otra persona en tu nombre.

Al iniciar el primer cuestionario tomarás una fotografía de tu rostro, que queda guardada como referencia. Al entrar a cada uno de los cuestionarios siguientes tomarás otra, que se compara automáticamente con esa referencia. La comparación la realiza el servicio Amazon Rekognition de Amazon Web Services.

Las fotografías se usan exclusivamente para esa comparación. No se publican, no se comparten con tu empleador, no alimentan ningún sistema de vigilancia y no se asocian a tus respuestas. De los intentos que no coinciden se conserva la fotografía como soporte del proceso.

Si prefieres no entregar tu fotografía, puedes negarte: en ese caso no podrás responder por este medio y deberás coordinar con el responsable de la medición una forma alternativa de participar.`
    );
  }

  secciones.push(
`## Tus derechos

Conforme a la Ley 1581 de 2012 puedes, en cualquier momento y de forma gratuita:

- Conocer, actualizar y rectificar tus datos personales.
- Solicitar prueba de esta autorización.
- Ser informado sobre el uso que se ha dado a tus datos.
- Presentar quejas ante la Superintendencia de Industria y Comercio.
- Revocar esta autorización y solicitar la supresión de tus datos, salvo cuando exista un deber legal de conservarlos.

Como los datos sensibles no son de suministro obligatorio, no estás obligado a autorizar su tratamiento.

Para ejercer estos derechos, comunícate con el responsable de la medición en ${empresa}.`
  );

  secciones.push(
`## Declaración

Al aceptar, declaras que leíste este documento, que entendiste en qué consiste la evaluación, que resolviste tus dudas con el responsable si las tenías, y que autorizas de forma libre, previa, expresa e informada el tratamiento de tus datos personales${biometricos ? ', incluidos los datos sensibles de salud y los datos biométricos de tu rostro' : ', incluidos los datos sensibles relacionados con tu salud'}, en los términos aquí descritos.`
  );

  return secciones.join('\n\n');
}

/**
 * Versión en inglés del mismo texto, para evaluaciones con `language = 'en'`.
 * Es traducción fiel del texto en español: cita las mismas leyes colombianas
 * porque la medición y el tratamiento de datos siguen ocurriendo bajo ellas,
 * aunque la persona responda en inglés. Mismo aviso: borrador, no asesoría legal.
 */
function buildEnglishConsentText({ companyName, biometricos }) {
  const empresa = (companyName || '').trim() || 'the company';

  const secciones = [];

  secciones.push(
`## Informed consent

Please read this carefully before you begin. At the end you will decide whether you wish to take part.`
  );

  secciones.push(
`## What this is about

${empresa} is carrying out an assessment of psychosocial risk factors using the Battery of Instruments of Colombia's Ministry of Social Protection, administered through the ${BRAND_NAME} platform. Its purpose is to identify working and living conditions that may affect people's health, and to define prevention actions.

You will answer several questionnaires about your working conditions, your life outside work and your stress symptoms. It takes between 20 and 40 minutes. You can do it in several sessions: your answers are saved as you go.`
  );

  secciones.push(
`## Your participation is voluntary

You may accept or decline, and you may stop the assessment at any time without giving any explanation. Declining has no employment consequences: it does not affect your job, your performance review or any benefit.

There are no right or wrong answers. Answer honestly, based on your real experience.`
  );

  secciones.push(
`## What happens to your answers

Your individual answers are confidential and are known only to the licensed psychologist who leads the assessment, who is bound by professional secrecy under Colombian Law 1090 of 2006.

${empresa} receives a report with **grouped** results, describing the workforce as a whole or entire areas. Your boss and the human resources department do not receive your individual answers and cannot identify them in the report.

The results are used to design the epidemiological surveillance program and intervention measures, not to make decisions about individuals.`
  );

  const datosSensibles = biometricos
    ? `The information you provide about your health and psychological well-being is **sensitive data** under article 5 of Colombian Law 1581 of 2012. The same applies to the photograph of your face described in the next section.`
    : `The information you provide about your health and psychological well-being is **sensitive data** under article 5 of Colombian Law 1581 of 2012.`;

  secciones.push(
`## Processing of your personal data

${datosSensibles} The law requires you to authorize its processing in a prior, express and informed manner; that is what you are doing with this document.

Your data is processed for the sole purpose of carrying out this assessment, calculating its results and preparing the individual and organizational reports. It is not sold, not shared with third parties outside the process and not used for commercial or advertising purposes.

It is kept for as long as occupational health and safety regulations require, and is then deleted or anonymized.`
  );

  if (biometricos) {
    secciones.push(
`## Identity verification with facial recognition

This assessment uses facial verification to confirm that it is you who is answering, and not someone else on your behalf.

When you start the first questionnaire you will take a photograph of your face, which is stored as a reference. When you open each of the following questionnaires you will take another one, which is automatically compared with that reference. The comparison is performed by the Amazon Rekognition service of Amazon Web Services.

The photographs are used exclusively for that comparison. They are not published, not shared with your employer, not fed into any surveillance system and not linked to your answers. For attempts that do not match, the photograph is kept as a record of the process.

If you prefer not to provide your photograph, you may decline: in that case you will not be able to answer through this channel and must arrange an alternative way to take part with the person responsible for the assessment.`
    );
  }

  secciones.push(
`## Your rights

Under Colombian Law 1581 of 2012 you may, at any time and free of charge:

- Access, update and correct your personal data.
- Request proof of this authorization.
- Be informed about how your data has been used.
- File complaints with Colombia's Superintendence of Industry and Commerce.
- Revoke this authorization and request the deletion of your data, except where there is a legal duty to keep it.

Since providing sensitive data is not mandatory, you are not required to authorize its processing.

To exercise these rights, contact the person responsible for the assessment at ${empresa}.`
  );

  secciones.push(
`## Declaration

By accepting, you declare that you have read this document, that you understand what the assessment involves, that you have cleared up any questions with the person responsible, and that you freely authorize, in a prior, express and informed manner, the processing of your personal data${biometricos ? ', including sensitive health data and the biometric data of your face' : ', including sensitive data related to your health'}, under the terms described here.`
  );

  return secciones.join('\n\n');
}

module.exports = { buildDefaultConsentText };
