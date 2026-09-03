import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import FlowLayout from '../../components/FlowLayout';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  ChartBarIcon,
  CalendarIcon,
  UsersIcon,
  ClockIcon,
  BuildingOfficeIcon,
  ArrowUpTrayIcon,
  DocumentArrowUpIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  CameraIcon,
  DocumentTextIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import PhotoImportModal from '../../components/PhotoImportModal';
import ManualEntryModal from '../../components/ManualEntryModal';

interface Company {
  id: number;
  name: string;
}

interface Evaluation {
  id: number;
  name: string;
  description: string;
  companyId: number;
  companyName: string;
  startDate: string;
  endDate: string;
  status: 'active' | 'completed' | 'cancelled';
  paid: boolean;
  /** Pruebas pagadas por Wompi y completadas que siguen sin pagar. */
  paidParticipants?: number;
  unpaidCompletedParticipants?: number;
  includeCoping: boolean;
  totalParticipants: number;
  completedParticipants: number;
  progress: number;
  createdAt: string;
  updatedAt: string;
}

export default function EvaluatorEvaluations() {
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEvaluation, setEditingEvaluation] = useState<Evaluation | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    startDate: '',
    endDate: '',
    companyId: '',
    // El Brief COPE viene marcado por defecto para no cambiarle el alcance a
    // quien ya lo venia aplicando; se desmarca en la campana que no lo contrato.
    includeCoping: true
  });

  // Excel import state
  const [showImportModal, setShowImportModal] = useState(false);

  // Editor del consentimiento informado por evaluacion. El default lo arma el
  // backend con el nombre de la empresa; el evaluador puede reemplazarlo porque
  // el texto es responsabilidad del profesional que firma la medicion.
  const [consentEvalId, setConsentEvalId] = useState<number | null>(null);
  const [consentTexto, setConsentTexto] = useState('');
  const [consentDefault, setConsentDefault] = useState('');
  const [consentEsPropio, setConsentEsPropio] = useState(false);
  const [consentCargando, setConsentCargando] = useState(false);
  const [consentGuardando, setConsentGuardando] = useState(false);
  const [importEvaluationId, setImportEvaluationId] = useState<number | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [importStep, setImportStep] = useState<'select' | 'preview' | 'result'>('select');
  const [previewing, setPreviewing] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  // Dirección de la escala numérica del Excel (A10). 'inverted' = formato oficial
  // del Ministerio (Siempre=0); 'direct' = Excel ya en escala BRS (Siempre=4).
  const [numericScale, setNumericScale] = useState<'inverted' | 'direct'>('inverted');

  // Photo import (Claude Vision) state
  const [photoEvaluationId, setPhotoEvaluationId] = useState<number | null>(null);
  const [manualEvaluationId, setManualEvaluationId] = useState<number | null>(null);

  useEffect(() => {
    fetchEvaluations();
    fetchCompanies();
  }, []);

  const fetchEvaluations = async () => {
    try {
      const token = localStorage.getItem('token');
      // limit explícito: el API pagina de a 10 y esta pantalla no tiene
      // paginador, así que sin esto la evaluación número 11 en adelante
      // simplemente no existía para el evaluador.
      const response = await fetch('/api/evaluations?limit=200', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setEvaluations(data.evaluations);
      } else {
        toast.error('Error al cargar evaluaciones');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanies = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/companies/mine', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setCompanies(data.companies);
      }
    } catch (error) {
      console.error('Error fetching companies:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const token = localStorage.getItem('token');
      const url = editingEvaluation 
        ? `/api/evaluations/${editingEvaluation.id}`
        : '/api/evaluations';
      
      const method = editingEvaluation ? 'PUT' : 'POST';

      // La empresa no se puede cambiar al editar y el schema del PUT rechaza
      // claves desconocidas, asi que solo se envian los campos editables.
      const payload = editingEvaluation
        ? {
            name: formData.name,
            description: formData.description,
            startDate: formData.startDate,
            endDate: formData.endDate || null,
            includeCoping: formData.includeCoping
          }
        : { ...formData, endDate: formData.endDate || null };

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        toast.success(
          editingEvaluation 
            ? 'Evaluación actualizada exitosamente' 
            : 'Evaluación creada exitosamente'
        );
        setShowModal(false);
        setEditingEvaluation(null);
        setFormData({ name: '', description: '', startDate: '', endDate: '', companyId: '', includeCoping: true });
        fetchEvaluations();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Error al guardar evaluación');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error de conexión');
    }
  };

  const abrirConsentimiento = async (evaluationId: number) => {
    setConsentEvalId(evaluationId);
    setConsentCargando(true);
    setConsentTexto('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/evaluations/${evaluationId}/consent-text`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('No se pudo cargar el consentimiento');
      const data = await res.json();
      setConsentTexto(data.text || '');
      setConsentDefault(data.defaultText || '');
      setConsentEsPropio(!!data.isCustom);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error de conexion');
      setConsentEvalId(null);
    } finally {
      setConsentCargando(false);
    }
  };

  const guardarConsentimiento = async () => {
    if (consentEvalId == null) return;
    setConsentGuardando(true);
    try {
      const token = localStorage.getItem('token');
      // Enviar el texto igual al default se guarda como null: asi la evaluacion
      // sigue heredando futuras mejoras de la plantilla en vez de congelarse.
      const esIgualAlDefault = consentTexto.trim() === consentDefault.trim();
      const res = await fetch(`/api/evaluations/${consentEvalId}/consent-text`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: esIgualAlDefault ? '' : consentTexto })
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'No se pudo guardar');
      }
      toast.success('Consentimiento guardado');
      setConsentEvalId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error de conexion');
    } finally {
      setConsentGuardando(false);
    }
  };

  const handleEdit = (evaluation: Evaluation) => {
    setEditingEvaluation(evaluation);
    setFormData({
      name: evaluation.name,
      description: evaluation.description,
      startDate: evaluation.startDate.split('T')[0],
      endDate: evaluation.endDate ? evaluation.endDate.split('T')[0] : '',
      companyId: String(evaluation.companyId),
      includeCoping: evaluation.includeCoping !== false
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Estás seguro de que quieres eliminar esta evaluación?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/evaluations/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        toast.success('Evaluación eliminada exitosamente');
        fetchEvaluations();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Error al eliminar evaluación');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error de conexión');
    }
  };

  const handlePreviewExcel = async () => {
    if (!importEvaluationId || !importFile) return;

    setPreviewing(true);
    setPreviewData(null);

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', importFile);

      const response = await fetch(`/api/evaluations/${importEvaluationId}/preview-excel`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      const data = await response.json();

      if (response.ok) {
        setPreviewData(data);
        setImportStep('preview');
      } else {
        toast.error(data.error || 'Error al analizar archivo');
      }
    } catch (error) {
      console.error('Preview error:', error);
      toast.error('Error de conexión al analizar archivo');
    } finally {
      setPreviewing(false);
    }
  };

  const handleImportExcel = async () => {
    if (!importEvaluationId || !importFile) return;

    setImporting(true);
    setImportResult(null);

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('numericScale', numericScale);

      const response = await fetch(`/api/evaluations/${importEvaluationId}/import-excel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json();

      if (response.ok) {
        setImportResult(data);
        setImportStep('result');
        if (data.totalCreated > 0) {
          toast.success(`${data.totalCreated} participantes importados exitosamente`);
          fetchEvaluations();
        }
        if (data.totalErrors > 0) {
          toast.error(`${data.totalErrors} errores durante la importación`);
        }
      } else {
        toast.error(data.error || 'Error al importar');
        setImportResult({ error: data.error });
        setImportStep('result');
      }
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Error de conexión al importar');
    } finally {
      setImporting(false);
    }
  };

  const resetImportModal = () => {
    setShowImportModal(false);
    setImportFile(null);
    setImportResult(null);
    setPreviewData(null);
    setImportStep('select');
    setNumericScale('inverted');
  };

  const openImportModal = (evaluationId: number) => {
    setImportEvaluationId(evaluationId);
    setImportFile(null);
    setImportResult(null);
    setPreviewData(null);
    setImportStep('select');
    setShowImportModal(true);
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      active: 'bg-green-100 text-green-800',
      completed: 'bg-blue-100 text-blue-800',
      cancelled: 'bg-red-100 text-red-800'
    };

    const labels = {
      active: 'Activa',
      completed: 'Completada',
      cancelled: 'Cancelada'
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badges[status as keyof typeof badges]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
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
        <div className="sm:flex sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Evaluaciones</h1>
            <p className="mt-2 text-sm text-gray-600">
              Gestiona las evaluaciones de riesgo psicosocial de tus empresas
            </p>
          </div>
          <div className="mt-4 sm:mt-0">
            <button
              onClick={() => {
                setEditingEvaluation(null);
                setFormData({ name: '', description: '', startDate: '', endDate: '', companyId: '', includeCoping: true });
                setShowModal(true);
              }}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Nueva Evaluación
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <ChartBarIcon className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Total Evaluaciones
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {evaluations?.length || 0}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <ClockIcon className="h-6 w-6 text-green-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Activas
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {evaluations?.filter(e => e.status === 'active')?.length || 0}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <UsersIcon className="h-6 w-6 text-blue-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Participantes
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {evaluations?.reduce((sum, e) => sum + (e.totalParticipants || 0), 0) || 0}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <ChartBarIcon className="h-6 w-6 text-purple-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Completadas
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {evaluations?.filter(e => e.status === 'completed')?.length || 0}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Evaluations Table */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          {evaluations.length === 0 ? (
            <div className="text-center py-12">
              <ChartBarIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                No hay evaluaciones
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Comienza creando tu primera evaluación de riesgo psicosocial.
              </p>
              <div className="mt-6">
                <button
                  onClick={() => {
                    setEditingEvaluation(null);
                    setFormData({ name: '', description: '', startDate: '', endDate: '', companyId: '', includeCoping: true });
                    setShowModal(true);
                  }}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Nueva Evaluación
                </button>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {evaluations.map((evaluation) => (
                <li key={evaluation.id}>
                  <div className="px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="h-10 w-10 flex items-center justify-center rounded-full bg-blue-100">
                          <ChartBarIcon className="h-6 w-6 text-blue-600" />
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="flex items-center">
                          <div className="text-sm font-medium text-gray-900">
                            {evaluation.name}
                          </div>
                          <div className="ml-2">
                            {getStatusBadge(evaluation.status)}
                          </div>
                          <div className="ml-2">
                            {/* `paid` es el interruptor del admin para toda la
                                evaluacion; sin el, el estado sale del pago por
                                prueba (Wompi): cuantas completadas faltan. */}
                            {evaluation.paid ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                                Pagada
                              </span>
                            ) : (evaluation.unpaidCompletedParticipants || 0) > 0 ? (
                              <Link
                                href="/evaluator/payments"
                                onClick={(e) => e.stopPropagation()}
                                title="Ir a pagar las pruebas pendientes"
                                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 hover:bg-amber-200"
                              >
                                {evaluation.unpaidCompletedParticipants} por pagar
                              </Link>
                            ) : (evaluation.paidParticipants || 0) > 0 ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                                {evaluation.paidParticipants} pagada(s)
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                                Sin pagos
                              </span>
                            )}
                          </div>
                          {/* Solo se marca cuando el COPE esta activo: es el caso
                              que agrega 28 preguntas al participante. */}
                          {evaluation.includeCoping && (
                            <div className="ml-2">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                                Con Brief COPE
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">
                          {evaluation.description}
                        </div>
                        <div className="flex items-center mt-1 text-xs text-gray-400">
                          <BuildingOfficeIcon className="h-3.5 w-3.5 mr-1" />
                          {evaluation.companyName}
                        </div>
                        <div className="flex items-center mt-1 text-sm text-gray-500">
                          <CalendarIcon className="h-4 w-4 mr-1" />
                          {formatDate(evaluation.startDate)} - {evaluation.endDate ? formatDate(evaluation.endDate) : 'Sin fecha fin'}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {evaluation.totalParticipants > 0 && (
                        <div className="text-sm text-gray-500">
                          <div className="flex items-center">
                            <UsersIcon className="h-4 w-4 mr-1" />
                            {evaluation.completedParticipants}/{evaluation.totalParticipants}
                          </div>
                          <div className="w-20 bg-gray-200 rounded-full h-2 mt-1">
                            <div 
                              className="bg-blue-600 h-2 rounded-full" 
                              style={{ width: `${evaluation.progress || 0}%` }}
                            ></div>
                          </div>
                        </div>
                      )}
                      
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => openImportModal(evaluation.id)}
                          className="text-gray-400 hover:text-green-600"
                          title="Subir Excel"
                        >
                          <ArrowUpTrayIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => setPhotoEvaluationId(evaluation.id)}
                          className="text-gray-400 hover:text-purple-600"
                          title="Subir foto / PDF de hoja física"
                        >
                          <CameraIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => setManualEvaluationId(evaluation.id)}
                          className="text-gray-400 hover:text-indigo-600"
                          title="Ingresar respuestas manualmente"
                        >
                          <DocumentTextIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => abrirConsentimiento(evaluation.id)}
                          className="text-gray-400 hover:text-emerald-600"
                          title="Consentimiento informado"
                        >
                          <ShieldCheckIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleEdit(evaluation)}
                          className="text-gray-400 hover:text-blue-600"
                          title="Editar"
                        >
                          <PencilIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(evaluation.id)}
                          className="text-gray-400 hover:text-red-600"
                          title="Eliminar"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 text-center mb-4">
                {editingEvaluation ? 'Editar Evaluación' : 'Nueva Evaluación'}
              </h3>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                {!editingEvaluation && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Empresa *
                    </label>
                    <select
                      required
                      value={formData.companyId}
                      onChange={(e) => setFormData({ ...formData, companyId: e.target.value })}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Selecciona una empresa</option>
                      {companies.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    {companies.length === 0 && (
                      <p className="mt-1 text-xs text-amber-600">
                        No tienes empresas. Crea una primero en la sección de Empresas.
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Nombre *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder=""
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Descripción
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder=""
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Fecha de Inicio *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Fecha de Fin
                  </label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Pruebas adicionales a la bateria oficial */}
                <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.includeCoping}
                      onChange={(e) => setFormData({ ...formData, includeCoping: e.target.checked })}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm">
                      <span className="font-medium text-gray-800">
                        Aplicar Brief COPE (28 preguntas)
                      </span>
                      <span className="block text-xs text-gray-500 mt-0.5">
                        Estrategias de afrontamiento. No hace parte de la bateria oficial del
                        Ministerio: si lo desactivas, los participantes no veran este
                        cuestionario y su seccion no aparecera en el informe.
                      </span>
                    </span>
                  </label>
                  {editingEvaluation && !formData.includeCoping && editingEvaluation.includeCoping && (
                    <p className="mt-2 text-xs text-amber-700">
                      Las respuestas del Brief COPE ya guardadas no se borran; solo dejan de
                      ofrecerse y de imprimirse. Si vuelves a activarlo, reaparecen.
                    </p>
                  )}
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditingEvaluation(null);
                      setFormData({ name: '', description: '', startDate: '', endDate: '', companyId: '', includeCoping: true });
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    {editingEvaluation ? 'Actualizar' : 'Crear'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {/* Import Excel Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className={`relative top-10 mx-auto p-5 border w-full ${importStep === 'preview' ? 'max-w-3xl' : 'max-w-lg'} shadow-lg rounded-md bg-white mb-10`}>
            <div className="mt-3">
              <div className="flex items-center justify-center mb-4">
                <div className="h-12 w-12 flex items-center justify-center rounded-full bg-green-100">
                  <DocumentArrowUpIcon className="h-6 w-6 text-green-600" />
                </div>
              </div>
              <h3 className="text-lg font-medium text-gray-900 text-center mb-2">
                {importStep === 'select'  && 'Importar desde Excel'}
                {importStep === 'preview' && 'Previsualización del archivo'}
                {importStep === 'result'  && 'Resultado de la importación'}
              </h3>

              {/* STEP: select file */}
              {importStep === 'select' && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-500 text-center mb-2">
                    Sube un archivo Excel con las hojas <strong>FA</strong> (Forma A) y/o <strong>FB</strong> (Forma B).
                    El sistema detectará automáticamente las columnas y mostrará una previsualización antes de importar.
                  </p>

                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-green-400 transition-colors">
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                      className="hidden"
                      id="excel-upload"
                    />
                    <label htmlFor="excel-upload" className="cursor-pointer">
                      <ArrowUpTrayIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      {importFile ? (
                        <p className="text-sm font-medium text-green-600">{importFile.name}</p>
                      ) : (
                        <p className="text-sm text-gray-500">Click para seleccionar archivo Excel</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">.xlsx o .xls (máximo 10MB)</p>
                    </label>
                  </div>

                  <div className="bg-blue-50 rounded-lg p-3">
                    <p className="text-xs text-blue-700">
                      <strong>Acepta dos formatos:</strong> valores numéricos (0-4) o etiquetas de texto
                      ("Siempre", "Casi siempre", "Algunas veces", "Casi nunca", "Nunca"). El detector
                      identifica las columnas por el nombre del header, no por posición.
                    </p>
                  </div>

                  <div className="flex justify-end space-x-3 pt-2">
                    <button
                      type="button"
                      onClick={resetImportModal}
                      className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handlePreviewExcel}
                      disabled={!importFile || previewing}
                      className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center"
                    >
                      {previewing ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Analizando...
                        </>
                      ) : (
                        <>
                          <EyeIcon className="h-4 w-4 mr-2" />
                          Previsualizar
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* STEP: preview */}
              {importStep === 'preview' && previewData && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-500 text-center">
                    Revisa lo que se detectó en <strong>{importFile?.name}</strong>. Si algo no coincide,
                    cancela y corrige el Excel antes de importar.
                  </p>

                  {previewData.previews.map((p: any) => (
                    <div key={p.formKey} className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center justify-between">
                        <h4 className="font-semibold text-gray-700">
                          Hoja {p.formKey}: <span className="font-normal text-gray-500">"{p.sheetName}"</span>
                        </h4>
                        <span className="text-xs text-gray-500">
                          Header en fila {p.headerRow}, datos desde fila {p.dataStartRow}
                        </span>
                      </div>

                      <div className="p-4 space-y-3">
                        {/* Counts */}
                        <div className="grid grid-cols-4 gap-2">
                          <div className="bg-blue-50 rounded p-2 text-center">
                            <p className="text-xl font-bold text-blue-700">{p.totalDataRows}</p>
                            <p className="text-xs text-blue-600">Participantes</p>
                          </div>
                          <div className={`rounded p-2 text-center ${p.layout.intraItemCount === p.expected.intra ? 'bg-green-50' : 'bg-yellow-50'}`}>
                            <p className={`text-xl font-bold ${p.layout.intraItemCount === p.expected.intra ? 'text-green-700' : 'text-yellow-700'}`}>
                              {p.layout.intraItemCount}/{p.expected.intra}
                            </p>
                            <p className={`text-xs ${p.layout.intraItemCount === p.expected.intra ? 'text-green-600' : 'text-yellow-600'}`}>Intralaboral</p>
                          </div>
                          <div className={`rounded p-2 text-center ${p.layout.extraItemCount === p.expected.extra ? 'bg-green-50' : 'bg-yellow-50'}`}>
                            <p className={`text-xl font-bold ${p.layout.extraItemCount === p.expected.extra ? 'text-green-700' : 'text-yellow-700'}`}>
                              {p.layout.extraItemCount}/{p.expected.extra}
                            </p>
                            <p className={`text-xs ${p.layout.extraItemCount === p.expected.extra ? 'text-green-600' : 'text-yellow-600'}`}>Extralaboral</p>
                          </div>
                          <div className={`rounded p-2 text-center ${p.layout.stressItemCount === p.expected.stress ? 'bg-green-50' : 'bg-yellow-50'}`}>
                            <p className={`text-xl font-bold ${p.layout.stressItemCount === p.expected.stress ? 'text-green-700' : 'text-yellow-700'}`}>
                              {p.layout.stressItemCount}/{p.expected.stress}
                            </p>
                            <p className={`text-xs ${p.layout.stressItemCount === p.expected.stress ? 'text-green-600' : 'text-yellow-600'}`}>Estrés</p>
                          </div>
                        </div>

                        <div className="text-xs text-gray-600">
                          <span className="font-medium">{p.newRows}</span> nuevos · <span className="font-medium">{p.duplicateRows}</span> ya importados (se omitirán)
                          {p.layout.filterCols.length > 0 && (
                            <> · <span className="font-medium">{p.layout.filterCols.length}</span> columna(s) filtro detectada(s) (se ignorarán)</>
                          )}
                        </div>

                        {/* Warnings */}
                        {p.warnings && p.warnings.length > 0 && (
                          <div className="bg-red-50 border border-red-200 rounded p-2">
                            <p className="text-xs font-medium text-red-700 mb-1">⚠ Advertencias:</p>
                            {p.warnings.map((w: string, i: number) => (
                              <p key={i} className="text-xs text-red-600">• {w}</p>
                            ))}
                          </div>
                        )}

                        {p.missingIntraItems && p.missingIntraItems.length > 0 && (
                          <div className="bg-yellow-50 border border-yellow-200 rounded p-2">
                            <p className="text-xs text-yellow-700">
                              <strong>Items intralaboral faltantes:</strong> {p.missingIntraItems.join(', ')}
                              <br/><span className="text-yellow-600">(probablemente headers mal numerados en el Excel)</span>
                            </p>
                          </div>
                        )}

                        {/* Sample participants */}
                        {p.sampleParticipants && p.sampleParticipants.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-gray-700 mb-1">Vista previa de los primeros participantes:</p>
                            <div className="overflow-x-auto">
                              <table className="min-w-full text-xs border border-gray-200">
                                <thead className="bg-gray-50">
                                  <tr>
                                    <th className="px-2 py-1 text-left text-gray-600">Fila</th>
                                    <th className="px-2 py-1 text-left text-gray-600">Documento</th>
                                    <th className="px-2 py-1 text-left text-gray-600">Nombre</th>
                                    <th className="px-2 py-1 text-left text-gray-600">Sexo</th>
                                    <th className="px-2 py-1 text-left text-gray-600">Año</th>
                                    <th className="px-2 py-1 text-left text-gray-600">Cargo</th>
                                    <th className="px-2 py-1 text-center text-gray-600">Intra</th>
                                    <th className="px-2 py-1 text-center text-gray-600">Extra</th>
                                    <th className="px-2 py-1 text-center text-gray-600">Estrés</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {p.sampleParticipants.map((sp: any, i: number) => (
                                    <tr key={i} className="border-t border-gray-200">
                                      <td className="px-2 py-1 text-gray-500">{sp.rowIndex}</td>
                                      <td className="px-2 py-1 text-gray-800">{sp.documento || '—'}</td>
                                      <td className="px-2 py-1 text-gray-800">{sp.nombre || '—'}</td>
                                      <td className="px-2 py-1 text-gray-600">{sp.sexo || '—'}</td>
                                      <td className="px-2 py-1 text-gray-600">{sp.birthYear || '—'}</td>
                                      <td className="px-2 py-1 text-gray-600">{sp.cargo ? sp.cargo.slice(0, 25) : '—'}</td>
                                      <td className="px-2 py-1 text-center">
                                        <span className={sp.intralaboral.invalid > 0 ? 'text-yellow-700' : 'text-green-700'}>
                                          {sp.intralaboral.ok}{sp.intralaboral.invalid > 0 ? `/${sp.intralaboral.invalid}✗` : ''}
                                        </span>
                                      </td>
                                      <td className="px-2 py-1 text-center">
                                        <span className={sp.extralaboral.invalid > 0 ? 'text-yellow-700' : 'text-green-700'}>
                                          {sp.extralaboral.ok}
                                        </span>
                                      </td>
                                      <td className="px-2 py-1 text-center">
                                        <span className={sp.estres.invalid > 0 ? 'text-yellow-700' : 'text-green-700'}>
                                          {sp.estres.ok}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-md text-sm">
                    <p className="font-medium text-amber-900 mb-2">Escala de las respuestas numéricas</p>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="numericScale"
                        className="mt-1"
                        checked={numericScale === 'inverted'}
                        onChange={() => setNumericScale('inverted')}
                      />
                      <span className="text-gray-700"><b>Formato oficial (recomendado)</b> — el Excel usa Siempre=0 … Nunca=4.</span>
                    </label>
                    <label className="flex items-start gap-2 cursor-pointer mt-1">
                      <input
                        type="radio"
                        name="numericScale"
                        className="mt-1"
                        checked={numericScale === 'direct'}
                        onChange={() => setNumericScale('direct')}
                      />
                      <span className="text-gray-700"><b>Escala directa</b> — el Excel ya usa Siempre=4 … Nunca=0 (escala BRS).</span>
                    </label>
                    <p className="text-xs text-amber-700 mt-2">Si eliges la escala equivocada, los resultados se importan al revés. Las respuestas en texto ("Siempre", "Nunca") no se ven afectadas.</p>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                    <button
                      type="button"
                      onClick={() => {
                        setImportStep('select');
                        setPreviewData(null);
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    >
                      ← Cambiar archivo
                    </button>
                    <div className="flex space-x-3">
                      <button
                        type="button"
                        onClick={resetImportModal}
                        className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleImportExcel}
                        disabled={importing}
                        className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-300 flex items-center"
                      >
                        {importing ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Importando...
                          </>
                        ) : (
                          <>
                            <CheckCircleIcon className="h-4 w-4 mr-2" />
                            Confirmar e importar
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP: result */}
              {importStep === 'result' && importResult && (
                <div className="space-y-4">
                  {importResult.error ? (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex items-center">
                        <ExclamationTriangleIcon className="h-5 w-5 text-red-600 mr-2" />
                        <p className="text-sm text-red-700 font-medium">Error en la importación</p>
                      </div>
                      <p className="text-sm text-red-600 mt-1">{importResult.error}</p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                          <CheckCircleIcon className="h-6 w-6 text-green-600 mx-auto" />
                          <p className="text-lg font-bold text-green-700">{importResult.totalCreated}</p>
                          <p className="text-xs text-green-600">Creados</p>
                        </div>
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center">
                          <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600 mx-auto" />
                          <p className="text-lg font-bold text-yellow-700">{importResult.totalSkipped}</p>
                          <p className="text-xs text-yellow-600">Omitidos</p>
                        </div>
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                          <ExclamationTriangleIcon className="h-6 w-6 text-red-600 mx-auto" />
                          <p className="text-lg font-bold text-red-700">{importResult.totalErrors}</p>
                          <p className="text-xs text-red-600">Errores</p>
                        </div>
                      </div>

                      {importResult.errors && importResult.errors.length > 0 && (
                        <div className="bg-red-50 rounded-lg p-3 max-h-32 overflow-y-auto">
                          <p className="text-xs font-medium text-red-700 mb-1">Detalle de errores:</p>
                          {importResult.errors.map((err: any, i: number) => (
                            <p key={i} className="text-xs text-red-600">
                              Fila {err.row} ({err.name}): {err.error}
                            </p>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  <div className="flex justify-end pt-2">
                    <button
                      onClick={resetImportModal}
                      className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                    >
                      Cerrar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {photoEvaluationId !== null && (
        <PhotoImportModal
          open={photoEvaluationId !== null}
          onClose={() => setPhotoEvaluationId(null)}
          evaluationId={photoEvaluationId}
          onSuccess={() => fetchEvaluations()}
        />
      )}

      {manualEvaluationId !== null && (
        <ManualEntryModal
          open={manualEvaluationId !== null}
          onClose={() => setManualEvaluationId(null)}
          evaluationId={manualEvaluationId}
          onSuccess={() => fetchEvaluations()}
        />
      )}

      {/* Editor del consentimiento informado de la evaluacion */}
      {consentEvalId != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Consentimiento informado</h3>
                <p className="text-sm text-gray-500">
                  Es lo primero que ve el participante al abrir su enlace.
                </p>
              </div>
              <button onClick={() => setConsentEvalId(null)} className="text-gray-400 hover:text-gray-600" aria-label="Cerrar">
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {consentCargando ? (
                <p className="py-8 text-center text-sm text-gray-500">Cargando…</p>
              ) : (
                <>
                  <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    El texto por defecto es un <strong>borrador de referencia</strong>, no asesoria
                    legal. Revisalo y ajustalo bajo tu criterio profesional antes de aplicar la
                    bateria: como psicologo responsable, este documento es tu respaldo ante la
                    Resolucion 2646 de 2008 y la Ley 1581 de 2012.
                  </div>

                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                      {consentEsPropio ? 'Texto propio' : 'Texto por defecto'}
                    </span>
                    {consentTexto.trim() !== consentDefault.trim() && (
                      <button
                        onClick={() => setConsentTexto(consentDefault)}
                        className="text-xs font-medium text-blue-600 hover:text-blue-800"
                      >
                        Restaurar el texto por defecto
                      </button>
                    )}
                  </div>

                  <textarea
                    value={consentTexto}
                    onChange={(e) => setConsentTexto(e.target.value)}
                    rows={20}
                    spellCheck
                    className="w-full rounded-xl border border-gray-300 p-4 font-mono text-xs leading-relaxed focus:border-blue-500 focus:outline-none"
                  />

                  <p className="mt-2 text-xs text-gray-400">
                    Formato: <code>## Titulo</code> para secciones, <code>- </code> para vinetas,
                    <code>**negrita**</code>. Linea en blanco = parrafo nuevo.
                  </p>
                  <p className="mt-3 text-xs text-gray-500">
                    Editar el texto no invalida los consentimientos ya aceptados: de cada uno se
                    guarda copia de lo que esa persona leyo.
                  </p>
                </>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button
                onClick={() => setConsentEvalId(null)}
                className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={guardarConsentimiento}
                disabled={consentGuardando || consentCargando}
                className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
              >
                {consentGuardando ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </FlowLayout>
  );
}