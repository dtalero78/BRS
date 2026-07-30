import { useEffect, useRef, useState } from 'react';
import { Play, X } from 'lucide-react';

interface Props {
  src: string;
  /** Imagen de portada. Sin ella el navegador pinta el primer frame, que en
   *  videos con fundido de entrada es un rectángulo blanco vacío. */
  poster?: string;
  onClose: () => void;
}

/**
 * Video de instrucciones que se abre sobre el panel de cuestionarios.
 *
 * Mismo patrón que el formulario de BSL-PLATAFORMA (`public/script.js`): el
 * video NO arranca solo. Los navegadores bloquean el autoplay con sonido y el
 * video lleva voz, así que arrancarlo en `muted` para saltar el bloqueo dejaría
 * al participante viendo una explicación sin audio. Se muestra un botón de play
 * grande y el modal se cierra solo cuando el video termina.
 */
export default function IntroVideoModal({ src, poster, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);

  // El fondo no debe scrollear mientras el video está encima.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const play = () => {
    setStarted(true);
    videoRef.current?.play().catch(() => {
      // Si el navegador igual lo bloquea, quedan los controles nativos.
      setStarted(false);
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Video de instrucciones"
    >
      <div className="relative flex max-h-full w-full max-w-md flex-col items-center">
        <div className="relative w-full">
          <video
            ref={videoRef}
            src={src}
            poster={poster}
            controls={started}
            playsInline
            preload="metadata"
            onEnded={onClose}
            className="max-h-[75vh] w-full rounded-xl bg-black shadow-2xl"
          />

          {!started && (
            <button
              onClick={play}
              aria-label="Reproducir video de instrucciones"
              className="absolute inset-0 flex items-center justify-center rounded-xl transition-colors hover:bg-white/5"
            >
              <span className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-600/90 shadow-lg transition-transform active:scale-95 sm:hover:scale-105">
                <Play className="ml-1 h-9 w-9 text-white" fill="currentColor" />
              </span>
            </button>
          )}
        </div>

        <button
          onClick={onClose}
          className="mt-5 inline-flex items-center gap-2 rounded-full border-2 border-white/40 px-7 py-2.5 text-sm font-medium text-white/70 transition-colors active:bg-white/10 sm:hover:border-white/80 sm:hover:text-white"
        >
          <X className="h-4 w-4" />
          Omitir
        </button>
      </div>
    </div>
  );
}
