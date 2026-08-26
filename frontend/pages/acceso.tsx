import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Image from 'next/image';
import { BRAND, logoBox } from '../config/brand';

/**
 * Puerta general de acceso del participante.
 *
 * Un solo enlace (<dominio>/acceso) para toda la instancia: la persona escribe
 * su documento y entra a su batería, sin que nadie tenga que repartirle un
 * enlace individual. El backend resuelve el documento contra el token que ya
 * tenía asignado — aquí no se crea nada.
 *
 * Si el documento cae en dos evaluaciones abiertas (dos empresas, o una
 * repetición anual), se le muestran para que elija: adivinar por ella
 * arriesgaría meterla a contestar la batería equivocada.
 */

interface Match {
  token: string;
  url: string;
  evaluationId: number;
  evaluationName: string;
  companyName: string;
  status: 'assigned' | 'in_progress' | 'completed';
}

const STATUS_LABEL: Record<Match['status'], string> = {
  assigned: 'Sin empezar',
  in_progress: 'En progreso',
  completed: 'Completada',
};

export default function AccesoPage() {
  const router = useRouter();
  const [documentNumber, setDocumentNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [matches, setMatches] = useState<Match[] | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    setError('');
    setMatches(null);
    setIsLoading(true);

    try {
      const response = await fetch('/api/participant-access/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentNumber }),
      });
      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'No pudimos validar tu documento. Intenta de nuevo.');
        return;
      }

      const found: Match[] = result.matches || [];
      if (found.length === 0) {
        // Inalcanzable con el backend actual (sin coincidencias responde 404),
        // pero sin esta guarda un cambio allá dejaría al participante viendo
        // un selector vacío sin explicación.
        setError('No encontramos evaluaciones abiertas para ese documento.');
        return;
      }
      if (found.length === 1) {
        // replace y no push: el botón "atrás" del navegador no debe devolver a
        // la persona al formulario en mitad de la batería.
        router.replace(found[0].url);
        return;
      }
      setMatches(found);
    } catch {
      setError('No pudimos conectarnos. Revisa tu conexión e intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>{`Ingresar a mi batería | ${BRAND.name}`}</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="min-h-[100dvh] flex flex-col items-center px-5 py-10" style={{ backgroundColor: BRAND.surfaceHub }}>
        <Image src={BRAND.logo} alt={BRAND.name} {...logoBox(56)} className="h-[56px] w-auto" priority />

        <div className="w-full max-w-md mt-10 bg-white rounded-2xl shadow-xl border border-gray-100 p-7 sm:p-9">
          {!matches ? (
            <>
              <h1 className="text-2xl font-bold text-gray-900">Ingresa a tu batería</h1>
              <p className="mt-2 text-sm text-gray-500">
                Escribe tu número de documento para abrir los cuestionarios que tu empresa te asignó.
              </p>

              <form className="mt-7 space-y-4" onSubmit={handleSubmit}>
                <div>
                  <label htmlFor="documento" className="block text-sm font-medium text-gray-700 mb-1">
                    Número de documento
                  </label>
                  <input
                    id="documento"
                    // inputMode numeric: en celular abre el teclado de números,
                    // que es como la mayoría va a entrar. type="text" y no
                    // "number" para no perder los ceros a la izquierda ni
                    // heredar las flechitas de incremento.
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    autoFocus
                    value={documentNumber}
                    onChange={(e) => {
                      setDocumentNumber(e.target.value);
                      if (error) setError('');
                    }}
                    placeholder="Ej: 1020717226"
                    className="w-full rounded-lg border border-gray-200 px-4 py-3 text-lg tracking-wide text-gray-900 focus:outline-none focus:ring-2 focus:border-transparent"
                  />
                  <p className="mt-1.5 text-xs text-gray-400">Sin puntos ni espacios.</p>
                </div>

                {error && (
                  <div
                    role="alert"
                    className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700"
                  >
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading || documentNumber.replace(/\D/g, '').length < 4}
                  className="w-full rounded-full py-3.5 text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: BRAND.accent }}
                >
                  {isLoading ? 'Buscando…' : 'Continuar'}
                </button>
              </form>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-gray-900">Tienes más de una evaluación</h1>
              <p className="mt-2 text-sm text-gray-500">Elige a cuál quieres entrar.</p>

              <div className="mt-6 space-y-3">
                {matches.map((match) => (
                  <button
                    key={match.token}
                    onClick={() => router.replace(match.url)}
                    className="w-full text-left rounded-xl border border-gray-200 px-4 py-3.5 hover:border-gray-300 hover:bg-gray-50 transition-colors"
                  >
                    <p className="text-sm font-semibold text-gray-900">{match.evaluationName}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{match.companyName}</p>
                    <span className="inline-block mt-2 text-[11px] font-medium text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">
                      {STATUS_LABEL[match.status] || match.status}
                    </span>
                  </button>
                ))}
              </div>

              <button
                onClick={() => {
                  setMatches(null);
                  setDocumentNumber('');
                }}
                className="mt-6 text-sm text-gray-500 hover:underline"
              >
                Usar otro documento
              </button>
            </>
          )}
        </div>

        <p className="mt-8 max-w-md text-center text-xs text-gray-500">
          ¿Tu documento no aparece? Comunícate con el área de gestión humana de tu empresa.
        </p>
      </div>
    </>
  );
}
