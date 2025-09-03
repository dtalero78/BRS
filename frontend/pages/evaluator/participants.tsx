import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import { 
  PlusIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  UserIcon,
  AcademicCapIcon,
  BriefcaseIcon,
  ClockIcon,
  MagnifyingGlassIcon,
  FunnelIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface Participant {
  id: number;
  firstName: string;
  lastName: string;
  documentType: string;
  documentNumber: string;
  birthYear: number;
  gender: string;
  maritalStatus: string;
  educationLevel: string;
  department: string;
  position: string;
  contractType: string;
  employmentType: string;
  tenureMonths: number;
  salaryRange: string;
  workHoursPerDay: number;
  workDaysPerWeek: number;
  formType: 'A' | 'B';
  evaluationId: string;
  status: 'pending' | 'in_progress' | 'completed';
  completionPercentage: number;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface Evaluation {
  id: string;
  name: string;
  status: string;
}

export default function EvaluatorParticipants() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [evaluationFilter, setEvaluationFilter] = useState<string>('all');
  const [formTypeFilter, setFormTypeFilter] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null);
  const [formData, setFormData] = useState({
    evaluationId: '',
    firstName: '',
    lastName: '',
    documentType: 'CC',
    documentNumber: '',
    birthYear: new Date().getFullYear() - 30,
    gender: 'Masculino',
    maritalStatus: 'Soltero(a)',
    educationLevel: 'Bachiller',
    department: 'General',
    position: 'Empleado',
    contractType: 'Indefinido',
    employmentType: 'Tiempo Completo',
    tenureMonths: 0,
    salaryRange: '1-2 SMMLV',
    workHoursPerDay: 8,
    workDaysPerWeek: 5,
    formType: 'A' as 'A' | 'B'
  });

  useEffect(() => {
    fetchParticipants();
    fetchEvaluations();
  }, []);

  const fetchParticipants = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/participants', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setParticipants(data.participants || []);
      } else {
        toast.error('Error al cargar participantes');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

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
        setEvaluations(data.evaluations || []);
      }
    } catch (error) {
      console.error('Error fetching evaluations:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const token = localStorage.getItem('token');
      const url = editingParticipant 
        ? `/api/participants/${editingParticipant.id}`
        : '/api/participants';
      
      const method = editingParticipant ? 'PUT' : 'POST';
      
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
          editingParticipant 
            ? 'Participante actualizado exitosamente' 
            : 'Participante creado exitosamente'
        );
        setShowModal(false);
        setEditingParticipant(null);
        resetForm();
        fetchParticipants();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Error al guardar participante');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error de conexión');
    }
  };

  const handleEdit = (participant: Participant) => {
    setEditingParticipant(participant);
    setFormData({
      evaluationId: participant.evaluationId,
      firstName: participant.firstName,
      lastName: participant.lastName,
      documentType: participant.documentType,
      documentNumber: participant.documentNumber,
      birthYear: participant.birthYear,
      gender: participant.gender,
      maritalStatus: participant.maritalStatus,
      educationLevel: participant.educationLevel,
      department: participant.department,
      position: participant.position,
      contractType: participant.contractType,
      employmentType: participant.employmentType,
      tenureMonths: participant.tenureMonths,
      salaryRange: participant.salaryRange,
      workHoursPerDay: participant.workHoursPerDay,
      workDaysPerWeek: participant.workDaysPerWeek,
      formType: participant.formType
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este participante?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/participants/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        toast.success('Participante eliminado exitosamente');
        fetchParticipants();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Error al eliminar participante');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error de conexión');
    }
  };

  const resetForm = () => {
    setFormData({
      evaluationId: '',
      firstName: '',
      lastName: '',
      documentType: 'CC',
      documentNumber: '',
      birthYear: new Date().getFullYear() - 30,
      gender: 'Masculino',
      maritalStatus: 'Soltero(a)',
      educationLevel: 'Bachiller',
      department: 'General',
      position: 'Empleado',
      contractType: 'Indefinido',
      employmentType: 'Tiempo Completo',
      tenureMonths: 0,
      salaryRange: '1-2 SMMLV',
      workHoursPerDay: 8,
      workDaysPerWeek: 5,
      formType: 'A'
    });
  };

  const generateToken = async (participantId: number) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/participants/${participantId}/generate-token`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        // Show success message and refresh participants
        alert(`URL generada: ${data.evaluationUrl}`);
        fetchParticipants();
      } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error de conexión');
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: 'bg-yellow-100 text-yellow-800',
      in_progress: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800'
    };

    const labels = {
      pending: 'Pendiente',
      in_progress: 'En Progreso',
      completed: 'Completado'
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badges[status as keyof typeof badges]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  const getFormTypeBadge = (formType: string) => {
    const color = formType === 'A' ? 'bg-purple-100 text-purple-800' : 'bg-orange-100 text-orange-800';
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>
        Forma {formType}
      </span>
    );
  };

  const filteredParticipants = participants.filter(participant => {
    const matchesSearch = participant.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         participant.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         participant.documentNumber.includes(searchTerm) ||
                         participant.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         participant.position.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || participant.status === statusFilter;
    const matchesEvaluation = evaluationFilter === 'all' || participant.evaluationId === evaluationFilter;
    const matchesFormType = formTypeFilter === 'all' || participant.formType === formTypeFilter;
    
    return matchesSearch && matchesStatus && matchesEvaluation && matchesFormType;
  });

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="sm:flex sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Participantes</h1>
            <p className="mt-2 text-sm text-gray-600">
              Gestiona los participantes de las evaluaciones de riesgo psicosocial
            </p>
          </div>
          <div className="mt-4 sm:mt-0">
            <button
              onClick={() => {
                setEditingParticipant(null);
                resetForm();
                setShowModal(true);
              }}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Nuevo Participante
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <UserIcon className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Total Participantes
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {participants?.length || 0}
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
                  <ClockIcon className="h-6 w-6 text-yellow-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Pendientes
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {participants?.filter(p => p.status === 'pending')?.length || 0}
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
                  <BriefcaseIcon className="h-6 w-6 text-blue-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      En Progreso
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {participants?.filter(p => p.status === 'in_progress')?.length || 0}
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
                  <AcademicCapIcon className="h-6 w-6 text-green-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Completados
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {participants?.filter(p => p.status === 'completed')?.length || 0}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar participantes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
            </div>

            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
                <option value="all">Todos los estados</option>
                <option value="pending">Pendiente</option>
                <option value="in_progress">En Progreso</option>
                <option value="completed">Completado</option>
              </select>
            </div>

            <div>
              <select
                value={evaluationFilter}
                onChange={(e) => setEvaluationFilter(e.target.value)}
                className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
                <option value="all">Todas las evaluaciones</option>
                {evaluations.map(evaluation => (
                  <option key={evaluation.id} value={evaluation.id}>
                    {evaluation.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={formTypeFilter}
                onChange={(e) => setFormTypeFilter(e.target.value)}
                className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
                <option value="all">Todas las formas</option>
                <option value="A">Forma A</option>
                <option value="B">Forma B</option>
              </select>
            </div>

            <div className="flex items-center text-sm text-gray-500">
              <FunnelIcon className="h-4 w-4 mr-1" />
              {filteredParticipants.length} resultado(s)
            </div>
          </div>
        </div>

        {/* Participants Table */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          {filteredParticipants.length === 0 ? (
            <div className="text-center py-12">
              <UserIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                No hay participantes
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchTerm || statusFilter !== 'all' || evaluationFilter !== 'all' || formTypeFilter !== 'all'
                  ? 'No se encontraron participantes con los filtros aplicados.'
                  : 'Comienza agregando participantes a tus evaluaciones.'}
              </p>
              {!searchTerm && statusFilter === 'all' && evaluationFilter === 'all' && formTypeFilter === 'all' && (
                <div className="mt-6">
                  <button
                    onClick={() => {
                      setEditingParticipant(null);
                      resetForm();
                      setShowModal(true);
                    }}
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <PlusIcon className="h-4 w-4 mr-2" />
                    Nuevo Participante
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Participante
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Evaluación
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Departamento
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Forma
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Progreso
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      URL de Evaluación
                    </th>
                    <th className="relative px-6 py-3">
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredParticipants.map((participant) => {
                    const evaluation = evaluations.find(e => e.id === participant.evaluationId);
                    return (
                      <tr key={participant.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="h-10 w-10 flex items-center justify-center rounded-full bg-gray-100">
                              <UserIcon className="h-6 w-6 text-gray-600" />
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
                                {participant.firstName} {participant.lastName}
                              </div>
                              <div className="text-sm text-gray-500">
                                {participant.documentType}: {participant.documentNumber}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {evaluation?.name || 'N/A'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{participant.department}</div>
                          <div className="text-sm text-gray-500">{participant.position}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(participant.status)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getFormTypeBadge(participant.formType)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="text-sm text-gray-900 mr-2">
                              {participant.completionPercentage || 0}%
                            </div>
                            <div className="w-16 bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-blue-600 h-2 rounded-full" 
                                style={{ width: `${participant.completionPercentage || 0}%` }}
                              ></div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {(participant as any).evaluationUrl ? (
                            <div className="flex items-center space-x-2">
                              <div className="text-xs text-gray-500 truncate max-w-xs" title={(participant as any).evaluationUrl}>
                                {(participant as any).evaluationUrl.substring(0, 50)}...
                              </div>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText((participant as any).evaluationUrl);
                                  // toast.success('URL copiada al portapapeles');
                                }}
                                className="text-blue-600 hover:text-blue-900 text-sm"
                                title="Copiar URL"
                              >
                                📋
                              </button>
                              <a
                                href={(participant as any).evaluationUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-green-600 hover:text-green-900 text-sm"
                                title="Abrir en nueva pestaña"
                              >
                                🔗
                              </a>
                            </div>
                          ) : (
                            <button
                              onClick={() => generateToken(participant.id)}
                              className="text-blue-600 hover:text-blue-900 text-sm underline"
                              title="Generar URL de evaluación"
                            >
                              Generar URL
                            </button>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleEdit(participant)}
                              className="text-blue-600 hover:text-blue-900"
                              title="Editar"
                            >
                              <PencilIcon className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => handleDelete(participant.id)}
                              className="text-red-600 hover:text-red-900"
                              title="Eliminar"
                            >
                              <TrashIcon className="h-5 w-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 text-center mb-4">
                {editingParticipant ? 'Editar Participante' : 'Nuevo Participante'}
              </h3>
              
              <form onSubmit={handleSubmit} className="space-y-4 max-h-96 overflow-y-auto">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Evaluación *
                    </label>
                    <select
                      required
                      value={formData.evaluationId}
                      onChange={(e) => setFormData({ ...formData, evaluationId: e.target.value })}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Seleccionar evaluación</option>
                      {evaluations.filter(e => e.status === 'active').map(evaluation => (
                        <option key={evaluation.id} value={evaluation.id}>
                          {evaluation.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Forma *
                    </label>
                    <select
                      required
                      value={formData.formType}
                      onChange={(e) => setFormData({ ...formData, formType: e.target.value as 'A' | 'B' })}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="A">Forma A (Jefes, Profesionales, Técnicos)</option>
                      <option value="B">Forma B (Auxiliares, Operarios)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Nombre *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Apellido *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Tipo de Documento *
                    </label>
                    <select
                      required
                      value={formData.documentType}
                      onChange={(e) => setFormData({ ...formData, documentType: e.target.value })}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="CC">Cédula de Ciudadanía</option>
                      <option value="CE">Cédula de Extranjería</option>
                      <option value="Pasaporte">Pasaporte</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Número de Documento *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.documentNumber}
                      onChange={(e) => setFormData({ ...formData, documentNumber: e.target.value })}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Año de Nacimiento *
                    </label>
                    <input
                      type="number"
                      required
                      min="1940"
                      max={new Date().getFullYear()}
                      value={formData.birthYear}
                      onChange={(e) => setFormData({ ...formData, birthYear: parseInt(e.target.value) })}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Género *
                    </label>
                    <select
                      required
                      value={formData.gender}
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="Masculino">Masculino</option>
                      <option value="Femenino">Femenino</option>
                      <option value="Otro">Otro</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Departamento *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Recursos Humanos"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Cargo *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.position}
                      onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Analista"
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditingParticipant(null);
                      resetForm();
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    {editingParticipant ? 'Actualizar' : 'Crear'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}