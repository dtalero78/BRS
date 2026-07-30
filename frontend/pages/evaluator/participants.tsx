import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import FlowLayout from '../../components/FlowLayout';
import { BRAND } from '../../config/brand';
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
  FunnelIcon,
  CameraIcon,
  DocumentTextIcon,
  ArrowUpTrayIcon,
  ArrowDownTrayIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  PaperAirplaneIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import PhotoImportModal from '../../components/PhotoImportModal';
import ManualEntryModal from '../../components/ManualEntryModal';

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
  phone?: string;
  evaluationId: string;
  evaluationName?: string;
  evaluationPaid?: boolean;
  evaluationUrl?: string;
  email?: string;
  companyName?: string;
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
  // Total real segun el backend, no el tamano del lote cargado.
  const [totalParticipants, setTotalParticipants] = useState(0);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [evaluationFilter, setEvaluationFilter] = useState<string>('all');
  const [formTypeFilter, setFormTypeFilter] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null);
  const [photoTarget, setPhotoTarget] = useState<Participant | null>(null);
  const [manualTarget, setManualTarget] = useState<Participant | null>(null);
  // Alta de participante: 'form' = llenar el formulario a mano; 'photo' = subir
  // la prueba escaneada y dejar que la IA cree la persona desde el encabezado.
  const [newMode, setNewMode] = useState<'form' | 'photo'>('form');
  // Evaluación elegida para el alta por foto/PDF (participante aún inexistente).
  const [photoCreateEvaluationId, setPhotoCreateEvaluationId] = useState<number | null>(null);

  // WhatsApp selection state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  // Envio masivo por Twilio. `enabled` lo confirma el backend: la marca decide
  // si se muestra el boton, pero si faltan credenciales el endpoint da 503.
  const [waBulkEnabled, setWaBulkEnabled] = useState(false);
  const [sendingBulk, setSendingBulk] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ hechos: 0, total: 0, ok: 0, fallidos: 0 });
  const [bulkErrors, setBulkErrors] = useState<{ nombre: string; error: string }[]>([]);
  const [showWaModal, setShowWaModal] = useState(false);

  // Excel import state
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [excelEvaluationId, setExcelEvaluationId] = useState('');
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelLoading, setExcelLoading] = useState(false);
  const [excelResult, setExcelResult] = useState<{ created: number; skipped: number; errors: { row: number; error: string }[] } | null>(null);
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
    formType: 'A' as 'A' | 'B',
    phone: ''
  });

  useEffect(() => {
    fetchEvaluations();
  }, []);

  // Efecto para cargar participantes al montar y refetch cuando cambian los filtros.
  // fetchParticipants() se llama solo aquí para evitar el doble fetch en el montaje.
  useEffect(() => {
    fetchParticipants();
  }, [statusFilter, evaluationFilter]);

  const fetchParticipants = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // Construir parámetros de query
      // El backend topa en 200 por pagina (parsePagination en routes/participants.js).
      // Con una sola peticion quedaban invisibles los participantes por encima de
      // 200, y las 4 tarjetas de estadistica —que se calculan sobre este array—
      // mostraban el tamano de la pagina en vez del total.
      //
      // Se pide la pagina 1 para conocer el total y el resto en paralelo, en vez
      // de en cadena: con 703 participantes son 4 peticiones, y secuenciales
      // sumaban varios segundos de espera al abrir la pantalla.
      const PAGE_SIZE = 200;
      const MAX_PAGINAS = 50; // tope de seguridad: 10.000 participantes

      const construirUrl = (pagina: number) => {
        const qp = new URLSearchParams();
        qp.append('limit', String(PAGE_SIZE));
        qp.append('page', String(pagina));
        if (statusFilter !== 'all') qp.append('status', statusFilter);
        if (evaluationFilter !== 'all') qp.append('evaluationId', evaluationFilter);
        return `/api/participants?${qp.toString()}`;
      };

      const pedir = async (pagina: number) => {
        const res = await fetch(construirUrl(pagina), {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      };

      const primera = await pedir(1);
      // El total autoritativo lo da el backend; no se infiere del array.
      const total: number = primera.pagination?.total ?? (primera.participants || []).length;
      const acumulados: Participant[] = [...(primera.participants || [])];

      const paginasRestantes = Math.min(
        Math.ceil(total / PAGE_SIZE) - 1,
        MAX_PAGINAS - 1
      );

      if (paginasRestantes > 0) {
        const lotes = await Promise.all(
          Array.from({ length: paginasRestantes }, (_, i) => pedir(i + 2))
        );
        lotes.forEach(lote => acumulados.push(...(lote.participants || [])));
      }

      setParticipants(acumulados);
      setTotalParticipants(total);
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

        // Special handling: participant already exists in this evaluation —
        // offer to edit the existing one instead of erroring out.
        if (response.status === 409 && errorData.code === 'PARTICIPANT_ALREADY_ASSIGNED' && errorData.existingParticipant) {
          const ep = errorData.existingParticipant;
          const fullName = `${ep.firstName} ${ep.lastName}`.trim() || ep.email;
          const confirmEdit = window.confirm(
            `${fullName} (${ep.documentType} ${ep.documentNumber}) ya está asignado a esta evaluación.\n\n` +
            `¿Quieres editar sus datos en su lugar?`
          );
          if (confirmEdit) {
            await openEditForExistingParticipant(ep.id);
          }
          return;
        }

        toast.error(errorData.error || 'Error al guardar participante');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error de conexión');
    }
  };

  const openEditForExistingParticipant = async (participantId: number) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/participants/${participantId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        toast.error('No se pudo cargar el participante existente');
        return;
      }
      const existing = await res.json();
      handleEdit(existing);
    } catch (err) {
      console.error('Error loading existing participant:', err);
      toast.error('Error al cargar el participante existente');
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
      formType: participant.formType,
      phone: participant.phone || ''
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
      formType: 'A',
      phone: ''
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

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleExcelImport = async () => {
    if (!excelEvaluationId || !excelFile) {
      toast.error('Selecciona una evaluación y un archivo');
      return;
    }
    setExcelLoading(true);
    try {
      const token = localStorage.getItem('token');
      const body = new FormData();
      body.append('file', excelFile);
      body.append('evaluationId', excelEvaluationId);
      const response = await fetch('/api/participants/import-excel', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body,
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || 'Error al importar');
        return;
      }
      setExcelResult(data);
      fetchParticipants();
    } catch {
      toast.error('Error de conexión');
    } finally {
      setExcelLoading(false);
    }
  };

  const handleExportCsv = () => {
    if (!participants || participants.length === 0) {
      toast.error('No hay participantes para exportar');
      return;
    }

    // Gating por pago: solo se exportan participantes de evaluaciones habilitadas (pagadas).
    const exportable = filteredParticipants.filter(p => p.evaluationPaid);
    const excluded = filteredParticipants.length - exportable.length;

    if (exportable.length === 0) {
      toast.error('La exportación no está habilitada: ninguna de las evaluaciones tiene el pago registrado.');
      return;
    }

    const statusLabel = (s: string) =>
      s === 'completed' ? 'Completado'
      : s === 'in_progress' ? 'En progreso'
      : s === 'assigned' ? 'Asignado'
      : s === 'pending' ? 'Pendiente'
      : (s || '');

    const fmtDate = (d?: string) => {
      if (!d) return '';
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return '';
      return dt.toISOString().slice(0, 19).replace('T', ' ');
    };

    const headers = [
      'Empresa', 'Evaluación',
      'Tipo Documento', 'Número Documento',
      'Nombres', 'Apellidos',
      'Email', 'Teléfono',
      'Forma',
      'Año Nacimiento', 'Género', 'Estado Civil', 'Nivel Educativo',
      'Área/Departamento', 'Cargo',
      'Tipo Contrato', 'Tipo Empleo', 'Meses en Cargo', 'Rango Salarial',
      'Horas/Día', 'Días/Semana',
      'Estado', 'Progreso (%)',
      'Asignado en', 'Completado en',
      'Link de Acceso',
    ];

    const rows = exportable.map(p => [
      p.companyName || '',
      p.evaluationName || '',
      p.documentType || '',
      p.documentNumber || '',
      p.firstName || '',
      p.lastName || '',
      p.email || '',
      p.phone || '',
      p.formType || '',
      p.birthYear ? String(p.birthYear) : '',
      p.gender || '',
      p.maritalStatus || '',
      p.educationLevel || '',
      p.department || '',
      p.position || '',
      p.contractType || '',
      p.employmentType || '',
      p.tenureMonths != null ? String(p.tenureMonths) : '',
      p.salaryRange || '',
      p.workHoursPerDay != null ? String(p.workHoursPerDay) : '',
      p.workDaysPerWeek != null ? String(p.workDaysPerWeek) : '',
      statusLabel(p.status),
      p.completionPercentage != null ? String(p.completionPercentage) : '0',
      fmtDate(p.startedAt),
      fmtDate(p.completedAt),
      p.evaluationUrl || '',
    ]);

    const escape = (v: string) => {
      const s = String(v ?? '');
      return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const csv = [headers, ...rows].map(r => r.map(escape).join(';')).join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const ts = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `participantes_${ts}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Exportados ${rows.length} participantes`);
    if (excluded > 0) {
      toast(`${excluded} participante(s) no se exportaron: su evaluación no tiene el pago registrado.`, { icon: '⚠️' });
    }
  };

  // Filtrar solo por búsqueda local y tipo de formulario (los otros se filtran en el backend)
  const filteredParticipants = participants.filter((participant: Participant) => {
    const matchesSearch = searchTerm === '' || 
                         participant.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         participant.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         participant.documentNumber.includes(searchTerm) ||
                         participant.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         participant.position.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFormType = formTypeFilter === 'all' || participant.formType === formTypeFilter;
    
    return matchesSearch && matchesFormType;
  });

  const allFilteredSelected = filteredParticipants.length > 0 && filteredParticipants.every(p => selectedIds.has(p.id));
  const someFilteredSelected = filteredParticipants.some(p => selectedIds.has(p.id));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        filteredParticipants.forEach(p => next.delete(p.id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        filteredParticipants.forEach(p => next.add(p.id));
        return next;
      });
    }
  };

  const selectedParticipants = filteredParticipants.filter(p => selectedIds.has(p.id));

  // El envio automatico requiere que la marca lo habilite Y que el backend
  // tenga credenciales de Twilio; si no, el modal cae al flujo manual.
  const puedeEnviarAuto = BRAND.bulkWhatsApp && waBulkEnabled;
  const listosParaEnviar = selectedParticipants.filter(p => p.evaluationUrl);
  const sinLink = selectedParticipants.filter(p => !p.evaluationUrl);

  // Twilio solo se ofrece si la marca lo habilita Y el backend tiene las
  // credenciales; se consulta una vez al montar.
  useEffect(() => {
    if (!BRAND.bulkWhatsApp) return;
    const token = localStorage.getItem('token');
    fetch('/api/participants/whatsapp-status', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : null))
      .then(d => setWaBulkEnabled(Boolean(d?.enabled)))
      .catch(() => setWaBulkEnabled(false));
  }, []);

  // Se envia en lotes de 50 (tope del endpoint): una sola peticion con cientos
  // de llamadas a Twilio se pasaria del timeout, y por lotes se ve el avance.
  const enviarWhatsAppMasivo = async () => {
    const destinatarios = selectedParticipants.filter(p => p.evaluationUrl);
    if (destinatarios.length === 0) {
      toast.error('Ninguno de los seleccionados tiene link generado');
      return;
    }

    setSendingBulk(true);
    setBulkErrors([]);
    setBulkProgress({ hechos: 0, total: destinatarios.length, ok: 0, fallidos: 0 });

    const token = localStorage.getItem('token');
    const LOTE = 50;
    let ok = 0;
    let fallidos = 0;
    const errores: { nombre: string; error: string }[] = [];

    for (let i = 0; i < destinatarios.length; i += LOTE) {
      const lote = destinatarios.slice(i, i + LOTE);
      try {
        const res = await fetch('/api/participants/send-whatsapp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            items: lote.map(p => ({ participantId: p.id, evaluationId: p.evaluationId })),
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          // Un lote fallido no aborta el resto: se contabiliza y se sigue.
          fallidos += lote.length;
          errores.push({ nombre: `Lote ${Math.floor(i / LOTE) + 1}`, error: err.error || `HTTP ${res.status}` });
        } else {
          const data = await res.json();
          ok += data.enviados || 0;
          fallidos += data.fallidos || 0;
          (data.resultados || [])
            .filter((r: any) => !r.ok)
            .forEach((r: any) => errores.push({ nombre: r.nombre || `ID ${r.participantId}`, error: r.error }));
        }
      } catch (e: any) {
        fallidos += lote.length;
        errores.push({ nombre: `Lote ${Math.floor(i / LOTE) + 1}`, error: e.message || 'Error de red' });
      }

      setBulkProgress({ hechos: Math.min(i + LOTE, destinatarios.length), total: destinatarios.length, ok, fallidos });
    }

    setBulkErrors(errores);
    setSendingBulk(false);

    if (fallidos === 0) toast.success(`${ok} invitaciones enviadas`);
    else toast.error(`${ok} enviadas, ${fallidos} con error`);
  };

  const waMessage = (p: Participant) => {
    const empresa = p.companyName || 'tu empresa';
    const url = p.evaluationUrl || '';
    return `Hola! Vas a realizar la Batería de Riesgo Psicosocial de la empresa ${empresa}. Debes realizarla en el siguiente link ${url}`;
  };

  const waLink = (p: Participant) => {
    const msg = encodeURIComponent(waMessage(p));
    const phone = (p.phone || '').replace(/\D/g, '');
    return phone ? `https://wa.me/57${phone}?text=${msg}` : `https://wa.me/?text=${msg}`;
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
            <h1 className="text-3xl font-bold text-gray-900">Participantes</h1>
            <p className="mt-2 text-sm text-gray-600">
              Gestiona los participantes de las evaluaciones de riesgo psicosocial
            </p>
          </div>
          <div className="mt-4 sm:mt-0 flex gap-2">
            {selectedIds.size > 0 && (
              <button
                onClick={() => setShowWaModal(true)}
                disabled={sendingBulk}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.559 4.122 1.534 5.854L.046 23.953a.5.5 0 0 0 .612.612l6.1-1.488A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.9a9.878 9.878 0 0 1-5.031-1.374l-.36-.214-3.732.91.936-3.63-.235-.374A9.867 9.867 0 0 1 2.1 12C2.1 6.534 6.534 2.1 12 2.1S21.9 6.534 21.9 12 17.466 21.9 12 21.9z"/>
                </svg>
                {sendingBulk
                  ? `Enviando ${bulkProgress.hechos}/${bulkProgress.total}...`
                  : `Enviar por WhatsApp (${selectedIds.size})`}
              </button>
            )}
            <button
              onClick={handleExportCsv}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
              Exportar Excel
            </button>
            <button
              onClick={() => {
                setExcelFile(null);
                setExcelEvaluationId('');
                setExcelResult(null);
                setShowExcelModal(true);
              }}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <ArrowUpTrayIcon className="h-4 w-4 mr-2" />
              Importar Excel
            </button>
            <button
              onClick={() => {
                setEditingParticipant(null);
                resetForm();
                setNewMode('form');
                setShowModal(true);
              }}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Nuevo Participante
            </button>
          </div>
        </div>

        {/* Stats Cards */}        {(sendingBulk || bulkProgress.total > 0) && (
          <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-blue-900">
                {sendingBulk
                  ? `Enviando invitaciones... ${bulkProgress.hechos} de ${bulkProgress.total}`
                  : `Envio terminado: ${bulkProgress.ok} enviadas, ${bulkProgress.fallidos} con error`}
              </p>
              {!sendingBulk && (
                <button
                  onClick={() => { setBulkProgress({ hechos: 0, total: 0, ok: 0, fallidos: 0 }); setBulkErrors([]); }}
                  className="text-blue-600 hover:text-blue-800 text-xl leading-none"
                >
                  &times;
                </button>
              )}
            </div>
            <div className="mt-2 h-2 w-full rounded-full bg-blue-100">
              <div
                className="h-2 rounded-full bg-blue-600 transition-all"
                style={{ width: `${bulkProgress.total ? (bulkProgress.hechos / bulkProgress.total) * 100 : 0}%` }}
              />
            </div>
            {bulkErrors.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-blue-800">
                  Ver {bulkErrors.length} con error
                </summary>
                <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs text-gray-700">
                  {bulkErrors.map((e, i) => (
                    <li key={i}>
                      <span className="font-medium">{e.nombre}:</span> {e.error}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}


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
                      {totalParticipants || participants?.length || 0}
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
                      {participants?.filter(p => p.status === 'pending' || p.status === 'in_progress')?.length || 0}
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
                <option value="assigned">Asignado</option>
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
            <div className="overflow-auto h-[calc(100vh-260px)] min-h-[300px]">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={allFilteredSelected}
                        ref={el => { if (el) el.indeterminate = someFilteredSelected && !allFilteredSelected; }}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                    </th>
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
                      <tr key={participant.id} className={`hover:bg-gray-50 ${selectedIds.has(participant.id) ? 'bg-green-50' : ''}`}>
                        <td className="px-4 py-4 w-10">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(participant.id)}
                            onChange={() => toggleSelect(participant.id)}
                            className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                          />
                        </td>
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
                              onClick={() => setPhotoTarget(participant)}
                              className="text-gray-500 hover:text-green-700"
                              title="Subir foto / PDF de prueba física"
                            >
                              <CameraIcon className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => setManualTarget(participant)}
                              className="text-gray-500 hover:text-indigo-700"
                              title="Ingresar respuestas manualmente"
                            >
                              <DocumentTextIcon className="h-5 w-5" />
                            </button>
                            {participant.evaluationUrl && (
                              <a
                                href={waLink(participant)}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Enviar link por WhatsApp"
                                className="text-gray-400 hover:text-green-600"
                              >
                                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.559 4.122 1.534 5.854L.046 23.953a.5.5 0 0 0 .612.612l6.1-1.488A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.9a9.878 9.878 0 0 1-5.031-1.374l-.36-.214-3.732.91.936-3.63-.235-.374A9.867 9.867 0 0 1 2.1 12C2.1 6.534 6.534 2.1 12 2.1S21.9 6.534 21.9 12 17.466 21.9 12 21.9z"/>
                                </svg>
                              </a>
                            )}
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

              {!editingParticipant && (
                <div className="flex rounded-md border border-gray-200 p-1 bg-gray-50 mb-4">
                  <button
                    type="button"
                    onClick={() => setNewMode('form')}
                    className={`flex-1 px-3 py-1.5 text-sm font-medium rounded ${
                      newMode === 'form' ? 'bg-white shadow text-blue-700' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Llenar formulario
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewMode('photo')}
                    className={`flex-1 px-3 py-1.5 text-sm font-medium rounded flex items-center justify-center gap-1 ${
                      newMode === 'photo' ? 'bg-white shadow text-blue-700' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <CameraIcon className="h-4 w-4" />
                    Subir foto / PDF
                  </button>
                </div>
              )}

              {!editingParticipant && newMode === 'photo' ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Evaluación *
                    </label>
                    <select
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
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-blue-900">
                    La IA leerá el documento y el nombre del encabezado del formulario y creará
                    el participante automáticamente. Podrás revisar y corregir los datos antes de guardar.
                    Ideal para baterías completas escaneadas (ficha + intralaboral + extralaboral + estrés).
                  </div>
                  <div className="flex justify-end gap-2 pt-2 border-t">
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={!formData.evaluationId}
                      onClick={() => {
                        const evalId = Number(formData.evaluationId);
                        if (!evalId) return;
                        setShowModal(false);
                        setPhotoCreateEvaluationId(evalId);
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                    >
                      <CameraIcon className="h-4 w-4" />
                      Continuar a subir archivo
                    </button>
                  </div>
                </div>
              ) : (
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
                      placeholder=""
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
                      placeholder=""
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Teléfono / Celular
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      placeholder="3001234567"
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
              )}
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Modal */}
      {showWaModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-6 border w-full max-w-2xl shadow-lg rounded-md bg-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {puedeEnviarAuto
                  ? `Enviar invitaciones — ${selectedParticipants.length} participante(s)`
                  : `Enviar links por WhatsApp — ${selectedParticipants.length} participante(s)`}
              </h3>
              <button onClick={() => setShowWaModal(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>

            {puedeEnviarAuto ? (
              <div className="mb-4">
                <div className="rounded-lg bg-gray-50 border border-gray-200 p-4 text-sm">
                  <div className="flex justify-between py-1">
                    <span className="text-gray-500">Se envian ahora</span>
                    <span className="font-medium text-gray-900">{listosParaEnviar.length}</span>
                  </div>
                  {sinLink.length > 0 && (
                    <div className="flex justify-between py-1">
                      <span className="text-gray-500">Se omiten (sin link)</span>
                      <span className="font-medium text-red-600">{sinLink.length}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-1 border-t border-gray-200 mt-2 pt-2">
                    <span className="text-gray-500">Remitente</span>
                    <span className="font-medium text-gray-900">{BRAND.name}</span>
                  </div>
                </div>

                <p className="mt-3 text-xs text-gray-500">
                  Cada persona recibe su propio link, en un mensaje con la plantilla aprobada
                  por WhatsApp. No se abre ninguna conversacion: el envio es automatico.
                </p>

                {bulkProgress.total > 0 && (
                  <div className="mt-4">
                    <div className="h-2 w-full rounded-full bg-gray-200">
                      <div
                        className="h-2 rounded-full bg-green-600 transition-all"
                        style={{ width: `${(bulkProgress.hechos / bulkProgress.total) * 100}%` }}
                      />
                    </div>
                    <p className="mt-2 text-sm text-gray-700">
                      {sendingBulk
                        ? `Enviando ${bulkProgress.hechos} de ${bulkProgress.total}...`
                        : `${bulkProgress.ok} enviadas, ${bulkProgress.fallidos} con error`}
                    </p>
                    {bulkErrors.length > 0 && !sendingBulk && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs text-blue-600">
                          Ver {bulkErrors.length} con error
                        </summary>
                        <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-gray-700">
                          {bulkErrors.map((e, i) => (
                            <li key={i}><span className="font-medium">{e.nombre}:</span> {e.error}</li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500 mb-4">
                Haz clic en el ícono de WhatsApp de cada participante para abrir la conversación con el mensaje pre-cargado. O copia el link individualmente.
              </p>
            )}

            <div className={`space-y-2 max-h-[60vh] overflow-y-auto pr-1 ${puedeEnviarAuto ? 'hidden' : ''}`}>
              {selectedParticipants.map(p => (
                <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{p.firstName} {p.lastName}</p>
                    <p className="text-xs text-gray-500">{p.documentType}: {p.documentNumber} · {p.position}</p>
                    {p.evaluationUrl ? (
                      <p className="text-xs text-blue-600 truncate">{p.evaluationUrl}</p>
                    ) : (
                      <p className="text-xs text-red-500">Sin link generado</p>
                    )}
                  </div>
                  {p.evaluationUrl && (
                    <>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(p.evaluationUrl!);
                          toast.success('Link copiado');
                        }}
                        title="Copiar link"
                        className="flex-shrink-0 text-gray-400 hover:text-blue-600"
                      >
                        <DocumentTextIcon className="h-5 w-5" />
                      </button>
                      <a
                        href={waLink(p)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Enviar por WhatsApp"
                        className="flex-shrink-0 text-gray-400 hover:text-green-600"
                      >
                        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.559 4.122 1.534 5.854L.046 23.953a.5.5 0 0 0 .612.612l6.1-1.488A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.9a9.878 9.878 0 0 1-5.031-1.374l-.36-.214-3.732.91.936-3.63-.235-.374A9.867 9.867 0 0 1 2.1 12C2.1 6.534 6.534 2.1 12 2.1S21.9 6.534 21.9 12 17.466 21.9 12 21.9z"/>
                        </svg>
                      </a>
                    </>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center pt-4 border-t mt-4">
              <button
                className={puedeEnviarAuto ? 'hidden' : 'text-sm text-blue-600 hover:underline'}
                onClick={() => {
                  const text = selectedParticipants
                    .filter(p => p.evaluationUrl)
                    .map(p => waMessage(p))
                    .join('\n\n---\n\n');
                  navigator.clipboard.writeText(text);
                  toast.success('Todos los mensajes copiados');
                }}
              >
                Copiar todos los mensajes
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowWaModal(false)}
                  disabled={sendingBulk}
                  className="px-4 py-2 text-sm font-medium text-white bg-gray-600 rounded-md hover:bg-gray-700 disabled:opacity-60"
                >
                  {puedeEnviarAuto && bulkProgress.total > 0 && !sendingBulk ? 'Cerrar' : 'Cancelar'}
                </button>
                {puedeEnviarAuto && (
                  <button
                    onClick={enviarWhatsAppMasivo}
                    disabled={sendingBulk || listosParaEnviar.length === 0}
                    className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <PaperAirplaneIcon className="h-4 w-4 mr-2" />
                    {sendingBulk
                      ? `Enviando ${bulkProgress.hechos}/${bulkProgress.total}...`
                      : `Enviar ${listosParaEnviar.length} invitacion(es)`}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Excel Import Modal */}
      {showExcelModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-6 border w-full max-w-lg shadow-lg rounded-md bg-white">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Importar participantes desde Excel</h3>

            {!excelResult ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Evaluación *</label>
                  <select
                    value={excelEvaluationId}
                    onChange={(e) => setExcelEvaluationId(e.target.value)}
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  >
                    <option value="">Seleccionar evaluación</option>
                    {evaluations.filter(e => e.status === 'active').map(ev => (
                      <option key={ev.id} value={ev.id}>{ev.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Archivo Excel *</label>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={(e) => setExcelFile(e.target.files?.[0] ?? null)}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                  <p className="mt-1 text-xs text-gray-500">Formatos: .xlsx, .xls, .csv — máx. 5 MB</p>
                </div>

                <a
                  href="/api/participants/import-excel/template"
                  className="inline-flex items-center text-sm text-blue-600 hover:underline"
                  download
                >
                  <ArrowDownTrayIcon className="h-4 w-4 mr-1" />
                  Descargar plantilla de ejemplo
                </a>

                <div className="flex justify-end gap-2 pt-2 border-t">
                  <button
                    onClick={() => setShowExcelModal(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleExcelImport}
                    disabled={excelLoading || !excelEvaluationId || !excelFile}
                    className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {excelLoading ? (
                      <span className="flex items-center gap-2"><span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />Importando...</span>
                    ) : (
                      <><ArrowUpTrayIcon className="h-4 w-4 mr-1" />Importar</>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-green-50 rounded-lg p-3">
                    <p className="text-2xl font-bold text-green-700">{excelResult.created}</p>
                    <p className="text-xs text-green-600">Creados</p>
                  </div>
                  <div className="bg-yellow-50 rounded-lg p-3">
                    <p className="text-2xl font-bold text-yellow-700">{excelResult.skipped}</p>
                    <p className="text-xs text-yellow-600">Ya existían</p>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3">
                    <p className="text-2xl font-bold text-red-700">{excelResult.errors.length}</p>
                    <p className="text-xs text-red-600">Errores</p>
                  </div>
                </div>

                {excelResult.errors.length > 0 && (
                  <div className="max-h-32 overflow-y-auto rounded-md bg-red-50 p-3 space-y-1">
                    {excelResult.errors.map((e, i) => (
                      <p key={i} className="text-xs text-red-700">Fila {e.row}: {e.error}</p>
                    ))}
                  </div>
                )}

                {excelResult.created > 0 && (
                  <p className="flex items-center gap-1 text-sm text-green-700">
                    <CheckCircleIcon className="h-4 w-4" />
                    {excelResult.created} participante(s) asignado(s) a la evaluación
                  </p>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t">
                  <button
                    onClick={() => {
                      setExcelFile(null);
                      setExcelEvaluationId('');
                      setExcelResult(null);
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Importar otro
                  </button>
                  <button
                    onClick={() => { setShowExcelModal(false); setExcelResult(null); }}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {photoTarget && (
        <PhotoImportModal
          open={!!photoTarget}
          onClose={() => setPhotoTarget(null)}
          evaluationId={Number(photoTarget.evaluationId)}
          participantId={photoTarget.id}
          participantLabel={`${photoTarget.firstName} ${photoTarget.lastName} (${photoTarget.documentNumber})`}
          // Auto-detectar: los PDFs escaneados traen la batería completa (ficha +
          // intralaboral + extralaboral + estrés). Preseleccionar la forma del
          // participante hacía que solo se digitalizara ese cuestionario.
          // El evaluador puede forzar un tipo concreto desde el selector del modal.
          defaultQuestionnaireType="auto"
          onSuccess={() => fetchParticipants()}
        />
      )}

      {/* Alta de participante por foto/PDF: sin participantId, la IA crea la
          persona desde el documento/nombre detectados en el encabezado. */}
      {photoCreateEvaluationId !== null && (
        <PhotoImportModal
          open={photoCreateEvaluationId !== null}
          onClose={() => setPhotoCreateEvaluationId(null)}
          evaluationId={photoCreateEvaluationId}
          defaultQuestionnaireType="auto"
          onSuccess={() => fetchParticipants()}
        />
      )}

      {manualTarget && (
        <ManualEntryModal
          open={!!manualTarget}
          onClose={() => setManualTarget(null)}
          evaluationId={Number(manualTarget.evaluationId)}
          participantId={manualTarget.id}
          participantLabel={`${manualTarget.firstName} ${manualTarget.lastName} (${manualTarget.documentNumber})`}
          defaultQuestionnaireType={manualTarget.formType === 'B' ? 'intralaboral_b' : 'intralaboral_a'}
          onSuccess={() => fetchParticipants()}
        />
      )}
    </FlowLayout>
  );
}