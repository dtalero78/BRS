import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import FlowLayout from '../../../components/FlowLayout';
import {
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { API_URL } from '../../../config/api';
import {
  Payment,
  PENDING_PAYMENT_REF_KEY,
  formatCop,
  formatDateTime,
  PaymentStatusBadge,
} from '../../../components/PaymentShared';

/**
 * Pantalla a la que Wompi devuelve al evaluador (`redirect-url`).
 *
 * Wompi le pega `?id=<transaccion>` a la URL. Con ese id el backend consulta
 * la transaccion DIRECTAMENTE a Wompi y aplica el resultado: no se confia en
 * nada que traiga el navegador. Si el pago aun esta en proceso (PSE puede
 * tardar), se reintenta unas veces y se deja un boton para verificar a mano.
 *
 * Si no viene `id` (la persona cerro Wompi y volvio por el historial), se
 * muestra el estado guardado de la orden por referencia.
 */

const MAX_AUTO_RETRIES = 6;
const RETRY_MS = 5000;

export default function PaymentResult() {
  const [payment, setPayment] = useState<Payment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const retries = useRef(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    let ref = params.get('ref');
    if (!ref) {
      try { ref = sessionStorage.getItem(PENDING_PAYMENT_REF_KEY); } catch {}
    }
    setTransactionId(id);
    setReference(ref);
    verify(id, ref);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const verify = async (id: string | null, ref: string | null) => {
    setChecking(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      if (!id && !ref) {
        setError('No encontramos la referencia del pago. Revisa el historial en Pagos.');
        return;
      }
      const res = await fetch(`${API_URL}/api/payments/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(id ? { transactionId: id } : { reference: ref }),
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        setError(data.error || data.message || 'No se pudo verificar el pago.');
        return;
      }
      const p: Payment = data.payment;
      setPayment(p);

      if (p.status === 'approved' || p.status === 'declined' || p.status === 'voided' || p.status === 'error') {
        try { sessionStorage.removeItem(PENDING_PAYMENT_REF_KEY); } catch {}
        // Detalle con las pruebas liberadas.
        const det = await fetch(`${API_URL}/api/payments/${encodeURIComponent(p.reference)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (det.ok) {
          const d = await det.json();
          setPayment(d.payment);
        }
      } else if (id && retries.current < MAX_AUTO_RETRIES) {
        retries.current += 1;
        setTimeout(() => verify(id, ref), RETRY_MS);
      }
    } catch (e) {
      setError('Error de conexión al verificar el pago.');
    } finally {
      setChecking(false);
    }
  };

  const status = payment?.status;

  return (
    <FlowLayout backHref="/evaluator/payments" backLabel="Volver a pagos" maxWidth="3xl">
      <div className="bg-white shadow rounded-lg p-8 text-center space-y-4">
        {checking && !payment && (
          <>
            <div className="mx-auto animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <h1 className="text-2xl font-bold text-gray-900">Verificando tu pago…</h1>
            <p className="text-sm text-gray-600">Estamos confirmando la transacción con Wompi.</p>
          </>
        )}

        {!checking && error && !payment && (
          <>
            <XCircleIcon className="mx-auto h-14 w-14 text-red-500" />
            <h1 className="text-2xl font-bold text-gray-900">No pudimos verificar el pago</h1>
            <p className="text-sm text-gray-600">{error}</p>
            <div className="flex justify-center gap-3 pt-2">
              <button
                onClick={() => verify(transactionId, reference)}
                className="inline-flex items-center px-4 py-2 rounded-md border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <ArrowPathIcon className="h-4 w-4 mr-2" /> Reintentar
              </button>
              <Link href="/evaluator/payments" className="inline-flex items-center px-4 py-2 rounded-md bg-blue-600 text-sm font-medium text-white hover:bg-blue-700">
                Ir a pagos
              </Link>
            </div>
          </>
        )}

        {payment && status === 'approved' && (
          <>
            <CheckCircleIcon className="mx-auto h-14 w-14 text-emerald-500" />
            <h1 className="text-2xl font-bold text-gray-900">¡Pago aprobado!</h1>
            <p className="text-sm text-gray-600">
              {payment.quantity} prueba(s) quedaron marcadas como pagadas y ya están liberadas.
            </p>
          </>
        )}

        {payment && status === 'pending' && (
          <>
            <ClockIcon className="mx-auto h-14 w-14 text-amber-500" />
            <h1 className="text-2xl font-bold text-gray-900">Pago en proceso</h1>
            <p className="text-sm text-gray-600">
              Wompi todavía no confirma la transacción. Algunos medios (PSE, Bancolombia) pueden tardar unos minutos.
              Las pruebas se liberarán automáticamente cuando se apruebe.
            </p>
            <button
              onClick={() => verify(transactionId, reference)}
              disabled={checking}
              className="inline-flex items-center px-4 py-2 rounded-md border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <ArrowPathIcon className={`h-4 w-4 mr-2 ${checking ? 'animate-spin' : ''}`} /> Verificar de nuevo
            </button>
          </>
        )}

        {payment && (status === 'declined' || status === 'voided' || status === 'error') && (
          <>
            <XCircleIcon className="mx-auto h-14 w-14 text-red-500" />
            <h1 className="text-2xl font-bold text-gray-900">
              {status === 'declined' ? 'Pago rechazado' : status === 'voided' ? 'Pago anulado' : 'Pago con error'}
            </h1>
            <p className="text-sm text-gray-600">
              {status === 'error'
                ? 'La transacción no se pudo aplicar. Escribe al administrador con la referencia de abajo.'
                : 'No se realizó ningún cobro. Puedes intentarlo de nuevo desde la página de pagos.'}
            </p>
          </>
        )}

        {payment && (
          <div className="mt-4 text-left rounded-lg border border-gray-200 divide-y divide-gray-100 text-sm">
            <Row label="Referencia" value={<span className="font-mono">{payment.reference}</span>} />
            <Row label="Estado" value={<PaymentStatusBadge status={payment.status} />} />
            <Row label="Pruebas" value={`${payment.quantity} × ${formatCop(payment.unitPriceCop)}`} />
            <Row label="Total" value={<span className="font-semibold">{formatCop(payment.amountCop)}</span>} />
            {payment.paymentMethod && <Row label="Medio de pago" value={payment.paymentMethod} />}
            {payment.transactionId && <Row label="Transacción Wompi" value={<span className="font-mono">{payment.transactionId}</span>} />}
            {payment.approvedAt && <Row label="Aprobado" value={formatDateTime(payment.approvedAt)} />}
          </div>
        )}

        {payment?.items && payment.items.length > 0 && (
          <div className="mt-4 text-left">
            <h2 className="text-sm font-semibold text-gray-900 mb-2">Pruebas incluidas</h2>
            <div className="overflow-auto max-h-64 rounded-lg border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <tbody className="divide-y divide-gray-100">
                  {payment.items.map((it) => (
                    <tr key={it.participantEvaluationId}>
                      <td className="px-3 py-1.5 text-gray-900">{`${it.firstName} ${it.lastName}`.trim() || '—'}</td>
                      <td className="px-3 py-1.5 text-gray-600">{it.documentNumber || '—'}</td>
                      <td className="px-3 py-1.5 text-gray-600">{it.evaluationName}</td>
                      <td className="px-3 py-1.5 text-right">
                        {it.paidAt
                          ? <span className="text-emerald-700 font-medium">Pagada</span>
                          : <span className="text-amber-700">Pendiente</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {payment && (
          <div className="flex justify-center gap-3 pt-4">
            <Link href="/evaluator/payments" className="inline-flex items-center px-4 py-2 rounded-md border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Volver a pagos
            </Link>
            {status === 'approved' && (
              <Link href="/evaluator/reports" className="inline-flex items-center px-4 py-2 rounded-md bg-blue-600 text-sm font-medium text-white hover:bg-blue-700">
                Ir a reportes
              </Link>
            )}
          </div>
        )}
      </div>
    </FlowLayout>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-2">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-900">{value}</span>
    </div>
  );
}
