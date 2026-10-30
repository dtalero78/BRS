/**
 * Socialización en video antes de la batería (opt-in por instancia).
 *
 * Se prende con `SOCIALIZATION_VIDEO=<clave>` en la app de esa instancia; la
 * clave elige uno de los videos de abajo. Sin la env var no se muestra nada y
 * el flujo del participante es el de siempre.
 *
 * El video vive aquí y no en `frontend/config/brand.ts` por la misma razón que
 * la verificación facial resuelve su flag en el backend: el guard de
 * POST /:token/responses necesita saber si la socialización es obligatoria y
 * cuánto dura. Con dos fuentes la pantalla podría pedir un video distinto (o
 * ninguno) del que el backend exige, y el participante quedaría bloqueado.
 */
const VIDEOS = {
  // Video de Shaddai Consultants (PA VIDEOS/ShaddaiRiesgos): la voz del video
  // original de socialización con la identidad de Shaddai. Dos cortes del mismo
  // video: el vertical para celular, el horizontal para computador.
  'shaddai-riesgos': {
    title: 'Socialización: evaluación de riesgos psicosociales',
    seconds: 409.7,
    horizontal: { src: '/brand/shaddai/socializacion-h.mp4', poster: '/brand/shaddai/socializacion-h-poster.jpg' },
    vertical: { src: '/brand/shaddai/socializacion-v.mp4', poster: '/brand/shaddai/socializacion-v-poster.jpg' },
  },
};

/** El video de esta instancia, o null si la socialización no está prendida. */
function getSocializationVideo() {
  const key = (process.env.SOCIALIZATION_VIDEO || '').trim();
  if (!key) return null;
  const video = VIDEOS[key];
  if (!video) {
    // Una clave mal escrita no debe dejar a todos los participantes frente a
    // un video que no existe: se apaga y se avisa en los logs.
    console.error(`SOCIALIZATION_VIDEO="${key}" no corresponde a ningún video; socialización desactivada.`);
    return null;
  }
  return video;
}

module.exports = { getSocializationVideo };
