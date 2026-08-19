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
 * @returns {string}
 */
function buildDefaultConsentText({ companyName, withBiometrics } = {}) {
  const empresa = (companyName || '').trim() || 'la empresa';
  const biometricos = withBiometrics === undefined ? isFaceVerificationEnabled() : !!withBiometrics;

  const secciones = [];

  secciones.push(
`## Consentimiento informado

Antes de comenzar, léelo con calma. Al final decides si deseas participar.`
  );

  secciones.push(
`## De qué se trata

${empresa} está realizando una evaluación de factores de riesgo psicosocial con la Batería de Instrumentos del Ministerio de la Protección Social de Colombia, aplicada a través de la plataforma ${BRAND_NAME}. Su propósito es identificar condiciones del trabajo y del entorno que puedan afectar la salud de las personas, y definir acciones de prevención.

Responderás varios cuestionarios sobre tus condiciones de trabajo, tu vida fuera del trabajo y tus síntomas de estrés. Toma entre 20 y 40 minutos. Puedes hacerlo en varias sesiones: tus respuestas se guardan a medida que avanzas.`
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

module.exports = { buildDefaultConsentText };
