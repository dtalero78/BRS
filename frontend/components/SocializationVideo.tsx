import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Pause, Play } from 'lucide-react';

export interface SocializationConfig {
  required: boolean;
  watchedSeconds: number;
  seconds: number;
  title: string;
  horizontal: { src: string; poster?: string };
  vertical: { src: string; poster?: string };
}

interface Props {
  token: string;
  firstName: string;
  config: SocializationConfig;
  onCompleted: () => void;
}

const REPORT_EVERY_MS = 10000;

const mmss = (s: number) => {
  const t = Math.max(0, Math.floor(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

/**
 * Socialización obligatoria antes del consentimiento (instancias con
 * SOCIALIZATION_VIDEO en el backend).
 *
 * El video no tiene controles nativos a propósito: con ellos se puede arrastrar
 * la barra hasta el final. Solo hay play/pausa, y cualquier salto hacia
 * adelante de lo ya visto se devuelve. El avance se reporta al backend, que es
 * quien decide si se vio completo (lo valida contra su propio reloj); esta
 * pantalla solo muestra lo que el backend responde.
 *
 * Si la persona cierra a mitad, al volver retoma desde donde quedó.
 *
 * El corte (vertical u horizontal) se elige una vez al montar según la
 * orientación de la pantalla: cambiarlo a mitad reiniciaría la reproducción.
 */
export default function SocializationVideo({ token, firstName, config, onCompleted }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const maxWatchedRef = useRef(config.watchedSeconds || 0);
  const [variant] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(orientation: portrait)').matches
      ? config.vertical
      : config.horizontal
  );
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(config.watchedSeconds || 0);
  const [completed, setCompleted] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const report = async (pos: number) => {
    try {
      const res = await fetch(`/api/participant-access/${token}/socialization/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position: pos }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (data.completed) setCompleted(true);
      return !!data.completed;
    } catch {
      // Un reporte perdido no importa: el siguiente lleva la posición completa.
      return false;
    }
  };

  // Mientras se reproduce, reporta cada 10 s.
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      const v = videoRef.current;
      if (v) report(v.currentTime);
    }, REPORT_EVERY_MS);
    return () => clearInterval(id);
  }, [playing]);

  // Al terminar, el backend puede tardar un instante en darlo por completo (su
  // reloj manda): se reintenta hasta que lo confirme.
  useEffect(() => {
    if (!finishing || completed) return;
    let cancel = false;
    const intentar = async (n: number) => {
      if (cancel || n > 20) return;
      const ok = await report(config.seconds);
      if (!ok && !cancel) setTimeout(() => intentar(n + 1), 3000);
    };
    intentar(0);
    return () => { cancel = true; };
  }, [finishing, completed]);

  const onLoaded = () => {
    const v = videoRef.current;
    if (!v) return;
    // Retoma donde quedó, salvo que ya estuviera en los últimos segundos.
    if (maxWatchedRef.current > 1 && maxWatchedRef.current < v.duration - 3) {
      v.currentTime = maxWatchedRef.current;
    }
  };

  const onTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.currentTime > maxWatchedRef.current + 1.5) {
      v.currentTime = maxWatchedRef.current;
      return;
    }
    maxWatchedRef.current = Math.max(maxWatchedRef.current, v.currentTime);
    setPosition(v.currentTime);
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      setStarted(true);
      v.play().catch(() => setPlaying(false));
    } else {
      v.pause();
    }
  };

  const pct = Math.min(100, (position / config.seconds) * 100);

  return (
    <div className="fixed inset-0 z-40 flex h-[100dvh] flex-col bg-[#010d27] text-white">
      <div className="px-5 pt-5 pb-3 text-center sm:pt-8">
        <h1 className="text-xl font-bold sm:text-2xl">Hola, {firstName}</h1>
        <p className="mt-1 text-sm text-white/70 sm:text-base">
          Antes de empezar, mira este video completo ({Math.round(config.seconds / 60)} minutos).
        </p>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-3">
        <video
          ref={videoRef}
          src={variant.src}
          poster={variant.poster}
          playsInline
          preload="metadata"
          disablePictureInPicture
          controlsList="nodownload nofullscreen noplaybackrate"
          onLoadedMetadata={onLoaded}
          onTimeUpdate={onTimeUpdate}
          onSeeking={onTimeUpdate}
          onRateChange={() => { if (videoRef.current) videoRef.current.playbackRate = 1; }}
          onPlay={() => { setPlaying(true); report(videoRef.current?.currentTime || 0); }}
          onPause={() => { setPlaying(false); report(videoRef.current?.currentTime || 0); }}
          onEnded={() => { setPlaying(false); maxWatchedRef.current = config.seconds; setPosition(config.seconds); setFinishing(true); }}
          onClick={togglePlay}
          className="max-h-full max-w-full rounded-xl bg-black shadow-2xl"
        />

        {!playing && !completed && (
          <button
            onClick={togglePlay}
            aria-label={started ? 'Continuar video' : 'Reproducir video'}
            className="absolute inset-0 flex items-center justify-center"
          >
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-600/90 shadow-lg transition-transform active:scale-95 sm:hover:scale-105">
              <Play className="ml-1 h-9 w-9 text-white" fill="currentColor" />
            </span>
          </button>
        )}
      </div>

      <div className="mx-auto w-full max-w-xl px-5 pt-4 pb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={togglePlay}
            disabled={completed}
            aria-label={playing ? 'Pausar' : 'Reproducir'}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white/10 disabled:opacity-30"
          >
            {playing ? <Pause className="h-5 w-5" fill="currentColor" /> : <Play className="ml-0.5 h-5 w-5" fill="currentColor" />}
          </button>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/15" aria-hidden>
            <div className="h-full rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
          </div>
          <span className="w-24 text-right font-mono text-xs text-white/70 tabular-nums">
            {mmss(position)} / {mmss(config.seconds)}
          </span>
        </div>

        <button
          onClick={onCompleted}
          disabled={!completed}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-base font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-30"
        >
          {completed && <CheckCircle2 className="h-5 w-5" />}
          {completed ? 'Continuar' : finishing ? 'Registrando…' : 'Disponible al terminar el video'}
        </button>
      </div>
    </div>
  );
}
