// Origen de la visita, para poder atribuir un registro sin depender de Google.
//
// Por que existe esto: la atribucion de Google Ads pierde el caso tipico de
// este producto —clic del anuncio en el celular, registro en el computador—,
// y ademas entre el 2026-07-20 y el 2026-08-27 el tag de GA4 estuvo roto y Ads
// no recibio nada: 20 dias reportando 0 conversiones mientras la base sumaba 14
// registros reales. Con esto la respuesta sale de nuestros propios datos.

export const ACQUISITION_KEY = 'brsAcquisition';

export interface Acquisition {
  gclid: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  landingPath: string | null;
  referrer: string | null;
  capturedAt: string;
}

/**
 * Guarda el origen si la URL trae algo que atribuir.
 *
 * En localStorage y no sessionStorage a proposito: entre el clic del anuncio y
 * el registro pueden pasar dias, y el evaluador suele volver en otra pestana.
 *
 * Solo escribe cuando hay gclid o utm_source, para no pisar el origen real con
 * una visita directa posterior: quien llega por el anuncio, vuelve escribiendo
 * el dominio y ahi si se registra, sigue contando como Ads.
 */
export function captureAcquisition(): void {
  if (typeof window === 'undefined') return;
  // En /participant/ el access_token viaja en la URL; esa ruta no se toca.
  if (window.location.pathname.startsWith('/participant/')) return;
  try {
    const p = new URLSearchParams(window.location.search);
    // gbraid/wbraid son los identificadores que Google usa en iOS cuando no hay
    // gclid disponible; sin ellos se pierde justo el trafico movil.
    const gclid = p.get('gclid') || p.get('gbraid') || p.get('wbraid');
    const utmSource = p.get('utm_source');
    if (!gclid && !utmSource) return;

    const value: Acquisition = {
      gclid: gclid || null,
      utmSource: utmSource || null,
      utmMedium: p.get('utm_medium') || null,
      utmCampaign: p.get('utm_campaign') || null,
      utmTerm: p.get('utm_term') || null,
      landingPath: window.location.pathname,
      referrer: (document.referrer || '').slice(0, 300) || null,
      capturedAt: new Date().toISOString(),
    };
    localStorage.setItem(ACQUISITION_KEY, JSON.stringify(value));
  } catch {
    // localStorage lanza en modo privado o con cookies bloqueadas. Un registro
    // sin atribucion es aceptable; perder el registro no lo es.
  }
}

/** Lee el origen guardado. Devuelve null si no hay o si esta corrupto. */
export function readAcquisition(): Acquisition | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(ACQUISITION_KEY);
    return raw ? (JSON.parse(raw) as Acquisition) : null;
  } catch {
    return null;
  }
}
