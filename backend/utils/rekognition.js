/**
 * Verificación facial con AWS Rekognition para el link público del participante.
 *
 * Portado de BODYTECH-PREPAGADAS (`backend/src/helpers/rekognition.ts`), pasado
 * a CommonJS. El matching es imagen-contra-imagen (CompareFaces); no se guardan
 * descriptores ni se usan colecciones de Rekognition.
 *
 * Dos operaciones:
 *  - validateFaceImage → DetectFaces: gate de calidad/pose (1 rostro nítido, de
 *    frente, ojos abiertos, sin oclusión). Se usa ANTES de enrolar la foto de
 *    referencia para no guardar una referencia mala — con verificación
 *    bloqueante, una referencia borrosa condena al participante a fallar
 *    siempre.
 *  - compareFaces → CompareFaces: similitud entre la referencia y la selfie en
 *    vivo. Umbral por defecto 90% (estricto, anti-suplantación).
 *
 * El módulo es opt-in por instancia: `FACE_VERIFICATION_ENABLED=true`. Sin la
 * env var, todo lo de aquí queda inerte y el flujo del participante es el de
 * siempre. Ver `isFaceVerificationEnabled()`.
 */

const {
  RekognitionClient,
  CompareFacesCommand,
  DetectFacesCommand,
} = require('@aws-sdk/client-rekognition');

const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID || '';
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY || '';

/** Umbral de similitud (CompareFaces). Configurable para calibrar sin redeploy de código. */
const FACE_MATCH_THRESHOLD = Number(process.env.FACE_MATCH_THRESHOLD || 90);

/**
 * Ventana de validez de una verificación, en minutos. El participante se
 * verifica una vez por sesión y puede responder varios cuestionarios seguidos;
 * pasada la ventana, el backend vuelve a exigir selfie.
 */
const FACE_SESSION_MINUTES = Number(process.env.FACE_SESSION_MINUTES || 240);

let client = null;
function getClient() {
  if (!client) {
    client = new RekognitionClient({
      region: AWS_REGION,
      credentials: {
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY,
      },
    });
  }
  return client;
}

/** El módulo está activo solo si la instancia lo prendió explícitamente. */
function isFaceVerificationEnabled() {
  return String(process.env.FACE_VERIFICATION_ENABLED || '').toLowerCase() === 'true';
}

/** Rekognition solo responde si hay credenciales configuradas. */
function isRekognitionAvailable() {
  return Boolean(AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY);
}

/** base64 (con o sin prefijo data:image/...) → Buffer, con validación de tamaño. */
function base64ToBuffer(base64Image) {
  let data = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
  data = data.replace(/[^A-Za-z0-9+/=]/g, '');
  if (!data) throw new Error('Imagen base64 vacía');
  if (data.length < 100) throw new Error('Imagen demasiado pequeña');
  if (data.length > 10000000) throw new Error('Imagen demasiado grande'); // ~7.5MB
  const buffer = Buffer.from(data, 'base64');
  if (buffer.length === 0) throw new Error('Buffer de imagen vacío');
  return buffer;
}

/**
 * Valida calidad y pose de una imagen (DetectFaces). Exige exactamente un
 * rostro, de frente, nítido, con ojos abiertos y sin oclusión.
 *
 * @returns {Promise<{isValid: boolean, confidence: number, issues: string[]}>}
 */
async function validateFaceImage(imageBase64) {
  try {
    const buffer = base64ToBuffer(imageBase64);
    const result = await getClient().send(new DetectFacesCommand({
      Image: { Bytes: buffer },
      Attributes: ['ALL'],
    }));
    const faces = result.FaceDetails || [];
    const issues = [];

    if (faces.length === 0) {
      return { isValid: false, confidence: 0, issues: ['No se detectó ningún rostro en la foto'] };
    }
    if (faces.length > 1) {
      return { isValid: false, confidence: 0, issues: ['Se detectó más de un rostro. Debes estar solo en la foto'] };
    }

    const face = faces[0];
    const confidence = face.Confidence || 0;
    if (confidence < 90) issues.push('Calidad de imagen insuficiente para verificación');

    if (face.Pose) {
      const { Roll, Yaw, Pitch } = face.Pose;
      if (Math.abs(Roll || 0) > 20) issues.push('Cabeza muy inclinada lateralmente');
      if (Math.abs(Yaw || 0) > 25) issues.push('Rostro no está de frente (girado hacia un lado)');
      if (Math.abs(Pitch || 0) > 25) issues.push('Cabeza muy inclinada hacia arriba o abajo');
    }
    if (face.Quality) {
      const { Brightness, Sharpness } = face.Quality;
      if ((Brightness || 0) < 15) issues.push('Foto muy oscura, busca mejor luz');
      if ((Brightness || 0) > 95) issues.push('Foto sobreexpuesta, evita la luz directa detrás de ti');
      if ((Sharpness || 0) < 20) issues.push('Foto muy borrosa, mantén el celular quieto');
    }
    if (face.EyesOpen && face.EyesOpen.Value === false) issues.push('Los ojos deben estar abiertos');
    if (face.FaceOccluded && face.FaceOccluded.Value === true && (face.FaceOccluded.Confidence || 0) > 80) {
      issues.push('El rostro está cubierto. Quítate gafas oscuras, gorra o tapabocas');
    }

    return { isValid: issues.length === 0, confidence, issues };
  } catch (error) {
    console.error('Error validando imagen (DetectFaces):', error);
    return { isValid: false, confidence: 0, issues: ['Error técnico en validación de imagen'] };
  }
}

/**
 * Compara dos rostros (CompareFaces). `sourceImage` = foto de referencia,
 * `targetImage` = selfie en vivo.
 *
 * @returns {Promise<{isMatch: boolean, similarityScore: number, faceMatches: number, error?: string}>}
 */
async function compareFaces(sourceImage, targetImage, similarityThreshold = FACE_MATCH_THRESHOLD) {
  try {
    if (!isRekognitionAvailable()) throw new Error('Credenciales de AWS no configuradas');

    const result = await getClient().send(new CompareFacesCommand({
      SourceImage: { Bytes: base64ToBuffer(sourceImage) },
      TargetImage: { Bytes: base64ToBuffer(targetImage) },
      SimilarityThreshold: similarityThreshold,
    }));
    const matches = result.FaceMatches || [];
    const best = matches.reduce(
      (b, c) => ((c.Similarity || 0) > ((b && b.Similarity) || 0) ? c : b),
      matches[0]
    );
    const similarityScore = (best && best.Similarity) || 0;
    return {
      isMatch: matches.length > 0 && similarityScore >= similarityThreshold,
      similarityScore,
      faceMatches: matches.length,
    };
  } catch (error) {
    const name = error && error.name;
    // Sin rostro detectable en alguna imagen ⇒ no es match, no es error crítico.
    if (name === 'InvalidParameterException') {
      return { isMatch: false, similarityScore: 0, faceMatches: 0, error: 'no_face' };
    }
    if (name === 'InvalidImageFormatException') {
      return { isMatch: false, similarityScore: 0, faceMatches: 0, error: 'invalid_format' };
    }
    console.error('Error en AWS Rekognition (CompareFaces):', error);
    return {
      isMatch: false,
      similarityScore: 0,
      faceMatches: 0,
      error: error instanceof Error ? error.message : 'unknown',
    };
  }
}

module.exports = {
  isFaceVerificationEnabled,
  isRekognitionAvailable,
  validateFaceImage,
  compareFaces,
  FACE_MATCH_THRESHOLD,
  FACE_SESSION_MINUTES,
};
