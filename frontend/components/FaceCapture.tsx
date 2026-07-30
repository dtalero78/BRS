import { useEffect, useRef, useState } from 'react';
import { Camera, Loader2, RefreshCw } from 'lucide-react';

interface FaceCaptureProps {
  /** Recibe la selfie como data URL JPEG (base64). */
  onCapture: (dataUrl: string) => void;
  /** El padre está procesando (deshabilita el botón y muestra spinner). */
  busy?: boolean;
  /** Texto del botón cuando no está procesando. */
  label?: string;
}

/**
 * Captura una selfie con la cámara frontal (getUserMedia + canvas, sin
 * dependencias). Portado de BODYTECH-PREPAGADAS.
 *
 * 640×480 JPEG calidad 0.8 — suficiente para Rekognition y liviano para subir
 * desde un celular con datos móviles, que es como responde la mayoría de
 * participantes.
 */
export default function FaceCapture({ onCapture, busy, label = 'Tomar foto' }: FaceCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError('');
      setReady(false);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setReady(true);
        }
      } catch (err) {
        // El nombre del error distingue "dijo que no" de "no hay cámara": son
        // dos problemas distintos y la instrucción para resolverlos también.
        const name = (err as { name?: string })?.name;
        if (name === 'NotAllowedError' || name === 'SecurityError') {
          setError('Bloqueaste el acceso a la cámara. Habilítalo en los permisos del navegador y vuelve a intentar.');
        } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
          setError('No encontramos una cámara en este dispositivo. Intenta desde tu celular.');
        } else {
          setError('No se pudo acceder a la cámara. Revisa los permisos del navegador.');
        }
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [attempt]);

  function capturar() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    onCapture(canvas.toDataURL('image/jpeg', 0.8));
  }

  if (error) {
    return (
      <div className="space-y-3">
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
        <button
          type="button"
          onClick={() => setAttempt((n) => n + 1)}
          className="mx-auto flex items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw size={16} />
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="text-center">
      <div className="mx-auto mb-4 overflow-hidden rounded-2xl bg-black" style={{ maxWidth: 360 }}>
        {/* scaleX(-1): efecto espejo, para que el participante se vea como en un espejo */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="block w-full"
          style={{ transform: 'scaleX(-1)' }}
        />
      </div>
      <button
        type="button"
        onClick={capturar}
        disabled={!ready || busy}
        className="mx-auto flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-base font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {busy ? <Loader2 className="animate-spin" size={20} /> : <Camera size={20} />}
        {busy ? 'Verificando…' : label}
      </button>
    </div>
  );
}
