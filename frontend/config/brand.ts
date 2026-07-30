/**
 * Configuración de marca por instancia (white-label).
 *
 * Todas las instancias despliegan del mismo repo/rama, así que la marca NO se
 * hardcodea: se elige con `NEXT_PUBLIC_BRAND` en tiempo de build. Cada app de
 * DigitalOcean compila por separado, por lo que el valor queda horneado en el
 * export estático de esa instancia.
 *
 * Sin la env var, la marca es `brs` — producción no cambia.
 *
 * Al agregar una marca nueva hay que tocar dos archivos: este y
 * `tailwind.config.js` (la paleta `blue`, que es la que usan las ~400 clases
 * de color existentes).
 */

export interface Brand {
  key: string;
  /** Nombre comercial mostrado al usuario */
  name: string;
  /** Lockup horizontal para fondos claros */
  logo: string;
  /** Lockup monocromo blanco para fondos oscuros */
  logoWhite: string;
  /** Tamaño intrínseco del lockup (para next/image; el alto real lo fija la clase) */
  logoWidth: number;
  logoHeight: number;
  /** Favicon (rel="icon") */
  favicon: string;
  /** Isotipo cuadrado para apple-touch-icon */
  icon: string;
  siteUrl: string;
  /** Color de acento sólido (avatar, chips) */
  accent: string;
  /** Fondo de las páginas hub */
  surfaceHub: string;
  /** Fondo de las páginas de datos */
  surfaceData: string;
  /** WhatsApp de soporte en formato internacional, sin '+' */
  supportWhatsApp: string;
  /**
   * Si la marca tiene sitio comercial propio (landing, blog, legales).
   * En `false`, la raíz `/` no muestra landing: manda directo al login.
   * El valor se resuelve en build, así que el HTML exportado de esa
   * instancia ni siquiera contiene el markup de la landing.
   */
  hasMarketingSite: boolean;
  /**
   * Envio masivo de invitaciones por WhatsApp (Twilio).
   *
   * Requiere sender propio aprobado y plantilla aprobada por WhatsApp, que se
   * configuran por instancia. El backend ademas responde 503 si le faltan las
   * credenciales, asi que esto solo controla si el boton se muestra.
   */
  bulkWhatsApp: boolean;
  /**
   * Video de instrucciones que se abre solo la primera vez que el participante
   * entra al panel de cuestionarios. Sin este campo la marca no muestra ningún
   * video y el panel abre directo (comportamiento de BRS).
   */
  introVideo?: string;
  /** Portada del `introVideo` (frame representativo). */
  introVideoPoster?: string;
}

const BRANDS: Record<string, Brand> = {
  brs: {
    key: 'brs',
    name: 'BRS Digital',
    logo: '/logo.png',
    logoWhite: '/logo.png',
    logoWidth: 1000,
    logoHeight: 400,
    favicon: '/favicon.ico',
    icon: '/logo.png',
    siteUrl: 'https://bateriariesgopsicosocial.com',
    accent: '#0a2d4e',
    surfaceHub: '#e6f4fd',
    surfaceData: '#f0f8ff',
    supportWhatsApp: '573008021701',
    hasMarketingSite: true,
    // BRS no tiene sender propio de WhatsApp aprobado.
    bulkWhatsApp: false,
  },
  shaddai: {
    key: 'shaddai',
    name: 'Shaddai Consultants',
    logo: '/brand/shaddai/logo.png',
    logoWhite: '/brand/shaddai/logo-white.png',
    logoWidth: 1789,
    logoHeight: 464,
    favicon: '/brand/shaddai/iso.png',
    icon: '/brand/shaddai/apple-touch-icon.png',
    siteUrl: 'https://shaddai.bateriariesgopsicosocial.com',
    // Paleta del manual de marca: índigo #1334F1, medianoche #010D27, polvo #C9E0F2.
    // El acento es el índigo: el manual lo usa como color de acción principal.
    accent: '#1334f1',
    surfaceHub: '#C9E0F2',
    surfaceData: '#EEF3FC',
    supportWhatsApp: '573008021701',
    // Shaddai no tiene landing: la raíz entra directo al login.
    hasMarketingSite: false,
    // Sender propio "Shaddai Consultants" (whatsapp:+15559533027).
    bulkWhatsApp: true,
    introVideo: '/brand/shaddai/intro.mp4',
    introVideoPoster: '/brand/shaddai/intro-poster.jpg',
  },
};

export const BRAND: Brand = BRANDS[process.env.NEXT_PUBLIC_BRAND || 'brs'] || BRANDS.brs;

/** Alto de render del lockup en el header, y su ancho proporcional. */
export function logoBox(height: number) {
  return {
    width: Math.round((BRAND.logoWidth * height) / BRAND.logoHeight),
    height,
  };
}
