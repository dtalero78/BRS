/**
 * Piezas compartidas entre /evaluator/payments y /evaluator/payments/result.
 * Viven fuera de las paginas porque Next no admite exports con nombre
 * arbitrarios en un archivo de `pages/`.
 */

export interface Payment {
  id: number;
  reference: string;
  status: 'pending' | 'approved' | 'declined' | 'voided' | 'error';
  quantity: number;
  unitPriceCop: number;
  amountCop: number;
  transactionId: string | null;
  paymentMethod: string | null;
  createdAt: string;
  approvedAt: string | null;
  items?: PaymentItem[];
}

export interface PaymentItem {
  participantEvaluationId: number;
  firstName: string;
  lastName: string;
  documentNumber: string;
  status: string;
  paidAt: string | null;
  evaluationName: string;
}

/** Referencia de la orden en curso: se guarda antes de saltar a Wompi. */
export const PENDING_PAYMENT_REF_KEY = 'brs_pending_payment_ref';

export const formatCop = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);

export const formatDateTime = (d?: string | null) => {
  if (!d) return '';
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? '' : dt.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
};

export const PAYMENT_STATUS: Record<Payment['status'], { cls: string; label: string }> = {
  approved: { cls: 'bg-emerald-100 text-emerald-800', label: 'Aprobado' },
  pending: { cls: 'bg-amber-100 text-amber-800', label: 'Pendiente' },
  declined: { cls: 'bg-red-100 text-red-800', label: 'Rechazado' },
  voided: { cls: 'bg-gray-100 text-gray-700', label: 'Anulado' },
  error: { cls: 'bg-red-100 text-red-800', label: 'Error' },
};

export function PaymentStatusBadge({ status }: { status: Payment['status'] }) {
  const s = PAYMENT_STATUS[status] || PAYMENT_STATUS.pending;
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>{s.label}</span>;
}
