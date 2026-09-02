import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import FlowLayout from '../../components/FlowLayout';
import {
  CreditCardIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  LockOpenIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { API_URL } from '../../config/api';
import {
  Payment,
  PENDING_PAYMENT_REF_KEY,
  formatCop,
  formatDateTime as formatDate,
  PaymentStatusBadge,
} from '../../components/PaymentShared';

/**
 * Pagos del evaluador (Wompi).
 *
 * Lista las pruebas sin pagar agrupadas por evaluacion, deja marcar cuales
 * pagar, muestra el total y manda al Web Checkout de Wompi con ese monto ya
 * firmado. Al volver, `payments/result` confirma contra el backend y las
 * pruebas quedan liberadas.
 */

interface PendingItem {
  participantEvaluationId: number;
  participantId: number;
  firstName: string;
  lastName: string;
  documentNumber: string;
  email: string;
  formType: 'A' | 'B';
  status: 'assigned' | 'in_progress' | 'completed';
  completedAt: string | null;
  hasResults: boolean;
  evaluationId: number;
  evaluationName: string;
  evaluationStatus: string;
  companyId: number;
  companyName: string;
}

interface PaymentsConfig {
  enabled: boolean;
  requirePaidEvaluation: boolean;
  configured: boolean;
  sandbox: boolean;
  unitPriceCop: number;
  currency: string;
}

const statusLabel = (s: PendingItem['status']) =>
  s === 'completed' ? 'Completada' : s === 'in_progress' ? 'En progreso' : 'Sin iniciar';

export default function EvaluatorPayments() {
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<PaymentsConfig | null>(null);
  const [items, setItems] = useState<PendingItem[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [checkingOut, setCheckingOut] = useState(false);
  const [onlyCompleted, setOnlyCompleted] = useState(true);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const [pendingRes, historyRes] = await Promise.all([
        fetch(`${API_URL}/api/payments/pending`, { headers }),
        fetch(`${API_URL}/api/payments`, { headers }),
      ]);
      if (pendingRes.ok) {
        const data = await pendingRes.json();
        setConfig(data.config);
        setItems(data.items || []);
        // Por defecto quedan marcadas las completadas: son las que bloquean
        // el informe. Las demas se pueden agregar a mano.
        setSelected(new Set((data.items || []).filter((i: PendingItem) => i.status === 'completed').map((i: PendingItem) => i.participantEvaluationId)));
      } else {
        toast.error('No se pudo cargar la lista de pruebas pendientes');
      }
      if (historyRes.ok) {
        const data = await historyRes.json();
        setPayments(data.payments || []);
      }
    } catch (e) {
      toast.error('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const visibleItems = useMemo(
    () => (onlyCompleted ? items.filter((i) => i.status === 'completed') : items),
    [items, onlyCompleted]
  );

  // Agrupadas por empresa + evaluacion, en el orden en que llegan.
  const groups = useMemo(() => {
    const map = new Map<number, { key: number; companyName: string; evaluationName: string; items: PendingItem[] }>();
    visibleItems.forEach((it) => {
      if (!map.has(it.evaluationId)) {
        map.set(it.evaluationId, { key: it.evaluationId, companyName: it.companyName, evaluationName: it.evaluationName, items: [] });
      }
      map.get(it.evaluationId)!.items.push(it);
    });
    return Array.from(map.values());
  }, [visibleItems]);

  const selectedCount = selected.size;
  const unitPrice = config?.unitPriceCop || 0;
  const total = selectedCount * unitPrice;

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleGroup = (groupItems: PendingItem[]) => {
    const ids = groupItems.map((i) => i.participantEvaluationId);
    const allOn = ids.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (allOn ? next.delete(id) : next.add(id)));
      return next;
    });
  };

  const selectAllVisible = () => setSelected(new Set(visibleItems.map((i) => i.participantEvaluationId)));
  const clearSelection = () => setSelected(new Set());

  const handleCheckout = async () => {
    if (selectedCount === 0) {
      toast.error('Selecciona al menos una prueba');
      return;
    }
    setCheckingOut(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/payments/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ participantEvaluationIds: Array.from(selected) }),
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        toast.error(data.message || data.error || 'No se pudo iniciar el pago');
        if (res.status === 409) fetchAll();
        return;
      }
      try { sessionStorage.setItem(PENDING_PAYMENT_REF_KEY, data.payment.reference); } catch {}
      // Sale de la app: Wompi cobra y devuelve a /evaluator/payments/result.
      window.location.href = data.checkoutUrl;
    } catch (e) {
      toast.error('Error de conexión');
    } finally {
      setCheckingOut(false);
    }
  };

  if (loading) {
    return (
      <FlowLayout backHref="/evaluator/dashboard" backLabel="Volver al menu" maxWidth="full">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </FlowLayout>
    );
  }

  return (
    <FlowLayout backHref="/evaluator/dashboard" backLabel="Volver al menu" maxWidth="full">
      <div className="space-y-6">
        <div className="sm:flex sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Pagos</h1>
            <p className="mt-2 text-sm text-gray-600">
              Paga las pruebas aplicadas para liberar sus resultados e informes. El pago se hace en Wompi
              (tarjeta, PSE, Nequi y otros medios).
            </p>
          </div>
          {config && config.enabled && (
            <div className="mt-4 sm:mt-0 text-right">
              <div className="text-xs uppercase tracking-wide text-gray-500">Valor por prueba</div>
              <div className="text-2xl font-bold text-gray-900">{formatCop(unitPrice)}</div>
              {config.sandbox && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                  Ambiente de pruebas (sandbox)
                </span>
              )}
            </div>
          )}
        </div>

        {config && !config.enabled && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex gap-3">
            <ExclamationTriangleIcon className="h-6 w-6 text-amber-600 flex-shrink-0" />
            <div className="text-sm text-amber-900">
              {config.requirePaidEvaluation
                ? 'La pasarela de pagos todavía no está configurada en esta instancia. Escribe al administrador para habilitar tus pruebas.'
                : 'Esta instancia no cobra por prueba: todas tus evaluaciones están habilitadas.'}
            </div>
          </div>
        )}

        {/* Pendientes */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-4 border-b border-gray-200 sm:flex sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Pruebas pendientes de pago</h2>
              <p className="text-sm text-gray-500">
                {items.length === 0
                  ? 'No tienes pruebas pendientes de pago.'
                  : `${items.length} prueba(s) sin pagar, ${items.filter((i) => i.status === 'completed').length} completada(s).`}
              </p>
            </div>
            {items.length > 0 && (
              <div className="mt-3 sm:mt-0 flex flex-wrap items-center gap-2 text-sm">
                <label className="inline-flex items-center gap-2 text-gray-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    checked={onlyCompleted}
                    onChange={(e) => setOnlyCompleted(e.target.checked)}
                  />
                  Solo completadas
                </label>
                <button onClick={selectAllVisible} className="px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50">
                  Seleccionar todas
                </button>
                <button onClick={clearSelection} className="px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50">
                  Limpiar
                </button>
                <button onClick={fetchAll} title="Recargar" className="p-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50">
                  <ArrowPathIcon className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {items.length > 0 && (
            <div className="overflow-auto max-h-[55vh]">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-2 w-10"></th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Participante</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Documento</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Forma</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Completada</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Valor</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {groups.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-sm text-gray-500">
                        Ninguna prueba completada sin pagar. Desmarca "Solo completadas" para ver las demás.
                      </td>
                    </tr>
                  )}
                  {groups.map((g) => {
                    const allOn = g.items.every((i) => selected.has(i.participantEvaluationId));
                    const someOn = !allOn && g.items.some((i) => selected.has(i.participantEvaluationId));
                    return (
                      <FragmentGroup key={g.key}>
                        <tr className="bg-blue-50/60">
                          <td className="px-4 py-2">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              checked={allOn}
                              ref={(el) => { if (el) el.indeterminate = someOn; }}
                              onChange={() => toggleGroup(g.items)}
                              aria-label={`Seleccionar todas las pruebas de ${g.evaluationName}`}
                            />
                          </td>
                          <td colSpan={6} className="px-4 py-2 text-sm">
                            <span className="font-semibold text-gray-900">{g.evaluationName}</span>
                            <span className="text-gray-500"> · {g.companyName} · {g.items.length} prueba(s)</span>
                          </td>
                        </tr>
                        {g.items.map((it) => (
                          <tr
                            key={it.participantEvaluationId}
                            className={`cursor-pointer ${selected.has(it.participantEvaluationId) ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                            onClick={() => toggle(it.participantEvaluationId)}
                          >
                            <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                checked={selected.has(it.participantEvaluationId)}
                                onChange={() => toggle(it.participantEvaluationId)}
                              />
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {it.firstName || it.lastName ? `${it.firstName} ${it.lastName}`.trim() : it.email}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-600">{it.documentNumber || '—'}</td>
                            <td className="px-4 py-2 text-sm text-gray-600">{it.formType}</td>
                            <td className="px-4 py-2 text-sm">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                it.status === 'completed' ? 'bg-green-100 text-green-800'
                                : it.status === 'in_progress' ? 'bg-blue-100 text-blue-800'
                                : 'bg-gray-100 text-gray-700'
                              }`}>
                                {statusLabel(it.status)}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-600">{formatDate(it.completedAt) || '—'}</td>
                            <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatCop(unitPrice)}</td>
                          </tr>
                        ))}
                      </FragmentGroup>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {items.length > 0 && (
            <div className="px-4 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg sm:flex sm:items-center sm:justify-between gap-4">
              <div className="text-sm text-gray-700">
                <span className="font-semibold">{selectedCount}</span> prueba(s) seleccionada(s) × {formatCop(unitPrice)}
              </div>
              <div className="mt-3 sm:mt-0 flex items-center gap-4">
                <div className="text-right">
                  <div className="text-xs uppercase tracking-wide text-gray-500">Total a pagar</div>
                  <div className="text-2xl font-bold text-gray-900">{formatCop(total)}</div>
                </div>
                <button
                  onClick={handleCheckout}
                  disabled={checkingOut || selectedCount === 0 || !config?.enabled}
                  className="inline-flex items-center px-5 py-2.5 rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <CreditCardIcon className="h-5 w-5 mr-2" />
                  {checkingOut ? 'Redirigiendo a Wompi…' : 'Pagar con Wompi'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Historial */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Historial de pagos</h2>
          </div>
          {payments.length === 0 ? (
            <div className="px-4 py-6 text-sm text-gray-500">Todavía no has realizado pagos.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Referencia</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pruebas</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Valor</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Medio</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td className="px-4 py-2 text-sm text-gray-600 whitespace-nowrap">{formatDate(p.createdAt)}</td>
                      <td className="px-4 py-2 text-sm font-mono text-gray-700">{p.reference}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{p.quantity}</td>
                      <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatCop(p.amountCop)}</td>
                      <td className="px-4 py-2 text-sm text-gray-600">{p.paymentMethod || '—'}</td>
                      <td className="px-4 py-2 text-sm">
                        <span className="inline-flex items-center gap-1">
                          {p.status === 'approved' ? <CheckCircleIcon className="h-4 w-4 text-emerald-600" />
                            : p.status === 'pending' ? <ClockIcon className="h-4 w-4 text-amber-600" />
                            : <ExclamationTriangleIcon className="h-4 w-4 text-red-600" />}
                          <PaymentStatusBadge status={p.status} />
                        </span>
                      </td>
                      <td className="px-4 py-2 text-sm text-right">
                        <Link
                          href={`/evaluator/payments/result/?ref=${encodeURIComponent(p.reference)}${p.transactionId ? `&id=${encodeURIComponent(p.transactionId)}` : ''}`}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          {p.status === 'pending' ? 'Verificar' : 'Ver detalle'}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 flex gap-3 text-sm text-gray-600">
          <LockOpenIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
          <p>
            Al aprobarse el pago, las pruebas quedan marcadas como pagadas y se liberan de inmediato la exportación
            y los informes PDF individuales. El informe organizacional se libera cuando todas las pruebas con resultados
            de la evaluación estén pagadas.
          </p>
        </div>
      </div>
    </FlowLayout>
  );
}

// <tbody> no admite un <div> envolvente; un fragmento con key si.
function FragmentGroup({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
