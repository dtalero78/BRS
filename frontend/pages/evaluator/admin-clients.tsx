import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import FlowLayout from '../../components/FlowLayout';
import toast from 'react-hot-toast';
import {
  UsersIcon,
  BuildingOfficeIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';
import { API_URL } from '../../config/api';

const SUPER_ADMIN_EMAILS = ['d_talero@yahoo.com'];
const isSuperAdmin = (u: any) =>
  !!u && (u.role === 'admin' || (u.email && SUPER_ADMIN_EMAILS.includes(String(u.email).toLowerCase())));

interface Stats {
  users: { total: number; admins: number; evaluators: number; participants: number };
  companies: number;
  evaluations: number;
  paidEvaluations: number;
  completedAssessments: number;
}

interface Evaluator {
  id: number;
  email: string;
  active: boolean;
  createdAt: string;
  companiesCount: number;
  evaluationsCount: number;
  participantsCount: number;
  completedCount: number;
  paidCount: number;
}

interface AdminEvaluation {
  id: number;
  name: string;
  status: string;
  paid: boolean;
  paidAt: string | null;
  paidByEmail: string | null;
  /** Pruebas de esta evaluación pagadas por la pasarela (independiente de `paid`). */
  wompiPaidCount: number;
  wompiFirstPaidAt: string | null;
  wompiLastPaidAt: string | null;
  wompiAmountCop: number;
  createdAt: string;
  companyId: number;
  companyName: string;
  evaluatorEmail: string;
  totalParticipants: number;
  completedParticipants: number;
}

type Tab = 'stats' | 'evaluators' | 'evaluations';

export default function AdminClients() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('stats');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [evaluators, setEvaluators] = useState<Evaluator[]>([]);
  const [evaluations, setEvaluations] = useState<AdminEvaluation[]>([]);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [filter, setFilter] = useState<'all' | 'paid' | 'unpaid'>('all');

  useEffect(() => {
    const userData = localStorage.getItem('user');
    let user: any = null;
    try { user = userData ? JSON.parse(userData) : null; } catch {}
    if (!isSuperAdmin(user)) {
      toast.error('No autorizado');
      router.replace('/evaluator/dashboard');
      return;
    }
    fetchAll();
  }, []);

  const authHeaders = () => {
    const token = localStorage.getItem('token');
    return { 'Authorization': `Bearer ${token}` };
  };

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [s, ev, ee] = await Promise.all([
        fetch(`${API_URL}/api/admin/stats`, { headers: authHeaders() }).then(r => r.json()),
        fetch(`${API_URL}/api/admin/evaluators`, { headers: authHeaders() }).then(r => r.json()),
        fetch(`${API_URL}/api/admin/evaluations`, { headers: authHeaders() }).then(r => r.json()),
      ]);
      setStats(s);
      setEvaluators(ev.evaluators || []);
      setEvaluations(ee.evaluations || []);
    } catch (err) {
      console.error(err);
      toast.error('Error cargando datos de administración');
    } finally {
      setLoading(false);
    }
  };

  const togglePayment = async (evalId: number, paid: boolean) => {
    setUpdatingId(evalId);
    try {
      const res = await fetch(`${API_URL}/api/admin/evaluations/${evalId}/payment`, {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ paid }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Error al actualizar');
      }
      const data = await res.json();
      setEvaluations(prev => prev.map(e => e.id === evalId ? { ...e, paid: data.paid, paidAt: data.paidAt } : e));
      toast.success(paid ? 'Marcada como pagada' : 'Marcada como no pagada');
    } catch (err: any) {
      toast.error(err.message || 'Error al actualizar pago');
    } finally {
      setUpdatingId(null);
    }
  };

  const formatDate = (s: string | null) => {
    if (!s) return '—';
    return new Date(s).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const filteredEvaluations = evaluations.filter(e => {
    // Una evaluación está cobrada si el admin la liberó a mano O si el cliente
    // pagó pruebas por Wompi. Mirando solo `paid`, las pagadas por la pasarela
    // caían en "pendientes de pago".
    const cobrada = e.paid || e.wompiPaidCount > 0;
    if (filter === 'paid') return cobrada;
    if (filter === 'unpaid') return !cobrada;
    return true;
  });

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
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Administración de clientes</h1>
          <p className="mt-2 text-sm text-gray-600">
            Vista global del sistema. Marca cada evaluación como pagada para habilitar la descarga de PDFs.
          </p>
        </div>

        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-6">
            {([
              { id: 'stats', label: 'Resumen' },
              { id: 'evaluators', label: 'Evaluadores' },
              { id: 'evaluations', label: 'Evaluaciones / Pagos' },
            ] as { id: Tab; label: string }[]).map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`py-3 px-1 border-b-2 text-sm font-medium ${
                  tab === t.id
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>

        {tab === 'stats' && stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <StatCard icon={UsersIcon} label="Usuarios totales" value={stats.users.total} sub={`${stats.users.evaluators} evaluadores · ${stats.users.participants} participantes · ${stats.users.admins} admins`} />
            <StatCard icon={BuildingOfficeIcon} label="Empresas creadas" value={stats.companies} />
            <StatCard icon={DocumentTextIcon} label="Evaluaciones" value={stats.evaluations} sub={`${stats.paidEvaluations} pagadas`} />
            <StatCard icon={CheckCircleIcon} label="Pruebas completadas" value={stats.completedAssessments} />
          </div>
        )}

        {tab === 'evaluators' && (
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="overflow-auto h-[calc(100vh-340px)] min-h-[300px]">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="sticky top-0 z-10 bg-gray-50 shadow-sm">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">Email</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">Registrado</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-600">Empresas</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-600">Evaluaciones</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-600">Pagadas</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-600">Participantes</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-600">Completados</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {evaluators.map(ev => (
                    <tr key={ev.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-gray-900">{ev.email}</td>
                      <td className="px-4 py-2 text-gray-500">{formatDate(ev.createdAt)}</td>
                      <td className="px-4 py-2 text-right text-gray-700">{ev.companiesCount}</td>
                      <td className="px-4 py-2 text-right text-gray-700">{ev.evaluationsCount}</td>
                      <td className="px-4 py-2 text-right">
                        <span className={ev.paidCount > 0 ? 'text-green-700 font-medium' : 'text-gray-400'}>
                          {ev.paidCount}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right text-gray-700">{ev.participantsCount}</td>
                      <td className="px-4 py-2 text-right text-gray-700">{ev.completedCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'evaluations' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Filtrar:</span>
              {(['all', 'unpaid', 'paid'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border ${
                    filter === f
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {f === 'all' ? 'Todas' : f === 'paid' ? 'Pagadas' : 'Pendientes de pago'}
                </button>
              ))}
              <span className="text-xs text-gray-500 ml-2">
                {filteredEvaluations.length} de {evaluations.length}
              </span>
            </div>

            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="overflow-auto h-[calc(100vh-380px)] min-h-[300px]">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="sticky top-0 z-10 bg-gray-50 shadow-sm">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-gray-600">Evaluación</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-600">Empresa</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-600">Evaluador</th>
                      <th className="px-4 py-2 text-right font-medium text-gray-600">Participantes</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-600">Estado</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-600">Pago</th>
                      <th className="px-4 py-2 text-center font-medium text-gray-600">Liberada a mano</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredEvaluations.map(ev => (
                      <tr key={ev.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2">
                          <div className="font-medium text-gray-900">{ev.name}</div>
                          <div className="text-xs text-gray-500">Creada {formatDate(ev.createdAt)}</div>
                        </td>
                        <td className="px-4 py-2 text-gray-700">{ev.companyName || '—'}</td>
                        <td className="px-4 py-2 text-gray-600">{ev.evaluatorEmail || '—'}</td>
                        <td className="px-4 py-2 text-right text-gray-700">
                          {ev.completedParticipants}/{ev.totalParticipants}
                        </td>
                        <td className="px-4 py-2">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                            ev.status === 'active' ? 'bg-green-100 text-green-700'
                              : ev.status === 'completed' ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {ev.status}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          <PaymentCell ev={ev} />
                        </td>
                        <td className="px-4 py-2 text-center">
                          <button
                            onClick={() => togglePayment(ev.id, !ev.paid)}
                            disabled={updatingId === ev.id}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                              ev.paid ? 'bg-green-500' : 'bg-gray-300'
                            } ${updatingId === ev.id ? 'opacity-50' : ''}`}
                            title={ev.paid
                              ? `Pagada ${formatDate(ev.paidAt)}${ev.paidByEmail ? ' por ' + ev.paidByEmail : ''}`
                              : 'Marcar como pagada'}
                          >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              ev.paid ? 'translate-x-6' : 'translate-x-1'
                            }`} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredEvaluations.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                          No hay evaluaciones en este filtro
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </FlowLayout>
  );
}

function StatCard({ icon: Icon, label, value, sub }: { icon: any; label: string; value: number; sub?: string }) {
  return (
    <div className="bg-white shadow rounded-lg p-5">
      <div className="flex items-center">
        <Icon className="h-6 w-6 text-gray-400" />
        <div className="ml-4">
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-semibold text-gray-900">{value}</p>
          {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

/**
 * Cuándo y por qué vía se cobró una evaluación.
 *
 * Hay dos caminos, y pueden coexistir: el interruptor manual del admin
 * (cortesías, convenios, transferencias por fuera de la plataforma) y el pago
 * por prueba con Wompi. Se muestran los dos porque responden preguntas
 * distintas: el manual dice "alguien decidió liberarla", el de Wompi dice
 * "entró plata, esta cantidad, este día".
 */
function PaymentCell({ ev }: { ev: AdminEvaluation }) {
  const fecha = (s: string | null) =>
    s ? new Date(s).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
  const cop = (n: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);

  const conWompi = ev.wompiPaidCount > 0;
  if (!ev.paid && !conWompi) {
    return <span className="text-gray-400">Sin pago</span>;
  }

  // Las pruebas de una orden se marcan todas a la vez, pero una evaluación
  // puede haberse pagado en varias tandas: ahí el rango dice más que una fecha.
  const mismoDia = fecha(ev.wompiFirstPaidAt) === fecha(ev.wompiLastPaidAt);

  return (
    <div className="space-y-0.5 text-xs">
      {conWompi && (
        <div>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-medium">
            Wompi
          </span>{' '}
          <span className="text-gray-900 font-medium">
            {mismoDia ? fecha(ev.wompiLastPaidAt) : `${fecha(ev.wompiFirstPaidAt)} → ${fecha(ev.wompiLastPaidAt)}`}
          </span>
          <div className="text-gray-600">
            {ev.wompiPaidCount}/{ev.totalParticipants} prueba(s) · {cop(ev.wompiAmountCop)}
          </div>
        </div>
      )}
      {ev.paid && (
        <div title={ev.paidByEmail ? `Liberada por ${ev.paidByEmail}` : undefined}>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-gray-200 text-gray-700 font-medium">
            Manual
          </span>{' '}
          <span className="text-gray-900">{fecha(ev.paidAt)}</span>
        </div>
      )}
    </div>
  );
}
