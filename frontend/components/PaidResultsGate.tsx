import Link from 'next/link';
import { LockClosedIcon, CreditCardIcon } from '@heroicons/react/24/outline';

/**
 * Velo sobre los resultados de una prueba que todavía no se ha pagado.
 *
 * Detrás del velo NO hay datos: el backend (`GET /api/results/participant/:id`)
 * devuelve `paymentRequired` y deja `results` vacío. Lo que se difumina es un
 * esqueleto decorativo. Difuminar los resultados de verdad los dejaría a un
 * DevTools de distancia, y el punto del cobro es justamente que no se vean.
 *
 * Se muestra en las dos vistas individuales —Análisis y Ver Tabla—, que hasta
 * ahora enseñaban el resultado completo gratis mientras el PDF sí cobraba.
 */
export default function PaidResultsGate({
  firstName,
  lastName,
  evaluationName,
  hasResults = true,
}: {
  firstName?: string;
  lastName?: string;
  evaluationName?: string;
  hasResults?: boolean;
}) {
  const nombre = [firstName, lastName].filter(Boolean).join(' ').trim();

  return (
    <div className="relative">
      {/* Esqueleto decorativo: da la forma del informe sin contener ningún dato. */}
      <div className="blur-[6px] select-none pointer-events-none" aria-hidden="true">
        <div className="bg-white shadow rounded-lg p-6 mb-4">
          <div className="h-5 w-56 bg-gray-300 rounded mb-4" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {['bg-emerald-200', 'bg-amber-200', 'bg-orange-200', 'bg-red-200'].map((c, i) => (
              <div key={i} className="rounded-lg p-4 bg-gray-50">
                <div className={`h-10 w-10 rounded-full ${c} mb-3`} />
                <div className="h-3 w-20 bg-gray-300 rounded mb-2" />
                <div className="h-6 w-12 bg-gray-400 rounded" />
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white shadow rounded-lg p-6">
          <div className="h-5 w-44 bg-gray-300 rounded mb-5" />
          {[78, 52, 91, 64, 38, 83].map((w, i) => (
            <div key={i} className="flex items-center gap-3 mb-3">
              <div className="h-3 w-40 bg-gray-200 rounded" />
              <div className="flex-1 h-4 bg-gray-100 rounded overflow-hidden">
                <div
                  className={`h-full rounded ${i % 3 === 0 ? 'bg-red-300' : i % 3 === 1 ? 'bg-amber-300' : 'bg-emerald-300'}`}
                  style={{ width: `${w}%` }}
                />
              </div>
              <div className="h-3 w-10 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Mensaje encima del velo */}
      <div className="absolute inset-0 flex items-start justify-center pt-16 px-4">
        <div className="bg-white/95 backdrop-blur-sm shadow-xl rounded-xl border border-gray-200 max-w-md w-full p-7 text-center">
          <div className="mx-auto h-14 w-14 rounded-full bg-amber-100 flex items-center justify-center mb-4">
            <LockClosedIcon className="h-7 w-7 text-amber-600" />
          </div>

          <h2 className="text-xl font-bold text-gray-900">
            {hasResults ? 'Esta prueba está pendiente de pago' : 'Resultados no disponibles'}
          </h2>

          {nombre && (
            <p className="mt-2 text-sm text-gray-700">
              <span className="font-medium">{nombre}</span>
              {evaluationName ? <span className="text-gray-500"> · {evaluationName}</span> : null}
            </p>
          )}

          <p className="mt-3 text-sm text-gray-600">
            {hasResults
              ? 'Los resultados ya están calculados. Paga esta prueba para ver el análisis completo, la tabla de dimensiones y descargar el informe.'
              : 'Todavía no hay resultados calculados para esta prueba.'}
          </p>

          {hasResults && (
            <Link
              href="/evaluator/payments"
              className="mt-5 inline-flex items-center px-5 py-2.5 rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              <CreditCardIcon className="h-5 w-5 mr-2" />
              Ir a Pagos
            </Link>
          )}

          <p className="mt-4 text-xs text-gray-500">
            El participante sí puede responder su batería con normalidad: el pago solo afecta lo que ve el evaluador.
          </p>
        </div>
      </div>
    </div>
  );
}
