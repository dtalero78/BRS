import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
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
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

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
    companyId: ''
  });

  // Excel import state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importEvaluationId, setImportEvaluationId] = useState<number | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  useEffect(() => {
    fetchEvaluations();
    fetchCompanies();
  }, []);

  const fetchEvaluations = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/evaluations', {
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
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        toast.success(
          editingEvaluation 
            ? 'Evaluación actualizada exitosamente' 
            : 'Evaluación creada exitosamente'
        );
        setShowModal(false);
        setEditingEvaluation(null);
        setFormData({ name: '', description: '', startDate: '', endDate: '', companyId: '' });
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

  const handleEdit = (evaluation: Evaluation) => {
    setEditingEvaluation(evaluation);
    setFormData({
      name: evaluation.name,
      description: evaluation.description,
      startDate: evaluation.startDate.split('T')[0],
      endDate: evaluation.endDate ? evaluation.endDate.split('T')[0] : '',
      companyId: String(evaluation.companyId)
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

  const handleImportExcel = async () => {
    if (!importEvaluationId || !importFile) return;

    setImporting(true);
    setImportResult(null);

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', importFile);

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
      }
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Error de conexión al importar');
    } finally {
      setImporting(false);
    }
  };

  const openImportModal = (evaluationId: number) => {
    setImportEvaluationId(evaluationId);
    setImportFile(null);
    setImportResult(null);
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
                setFormData({ name: '', description: '', startDate: '', endDate: '', companyId: '' });
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
                    setFormData({ name: '', description: '', startDate: '', endDate: '', companyId: '' });
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

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditingEvaluation(null);
                      setFormData({ name: '', description: '', startDate: '', endDate: '', companyId: '' });
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
          <div className="relative top-20 mx-auto p-5 border w-full max-w-lg shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-center mb-4">
                <div className="h-12 w-12 flex items-center justify-center rounded-full bg-green-100">
                  <DocumentArrowUpIcon className="h-6 w-6 text-green-600" />
                </div>
              </div>
              <h3 className="text-lg font-medium text-gray-900 text-center mb-2">
                Importar desde Excel
              </h3>
              <p className="text-sm text-gray-500 text-center mb-4">
                Sube un archivo Excel con las hojas <strong>FA</strong> (Forma A) y/o <strong>FB</strong> (Forma B).
                Se crearán los participantes, sus respuestas y se calcularán los resultados automáticamente.
              </p>

              {!importResult ? (
                <div className="space-y-4">
                  {/* File Input */}
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
                        <p className="text-sm text-gray-500">
                          Click para seleccionar archivo Excel
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        .xlsx o .xls (máximo 10MB)
                      </p>
                    </label>
                  </div>

                  <div className="bg-blue-50 rounded-lg p-3">
                    <p className="text-xs text-blue-700">
                      <strong>Formato esperado:</strong> Columnas sociodemográficas (A-Y), seguidas de respuestas Intralaboral, Extralaboral y Estrés. Los valores deben ser numéricos (0-4 para intralaboral/extralaboral, 0-3 para estrés).
                    </p>
                  </div>

                  <div className="flex justify-end space-x-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowImportModal(false)}
                      className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleImportExcel}
                      disabled={!importFile || importing}
                      className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center"
                    >
                      {importing ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Importando...
                        </>
                      ) : (
                        <>
                          <ArrowUpTrayIcon className="h-4 w-4 mr-2" />
                          Importar
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Import Results */}
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
                      onClick={() => {
                        setShowImportModal(false);
                        setImportResult(null);
                        setImportFile(null);
                      }}
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
    </FlowLayout>
  );
}