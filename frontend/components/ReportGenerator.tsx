import React, { useState, useEffect, useMemo } from 'react';
import { Download, FileText, User, Users, Check, Eye, Search, AlertCircle } from 'lucide-react';
import { API_URL } from '../config/api';
import OrganizationalReportModal from './OrganizationalReportModal';

interface Evaluation {
  id: string;
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  status: string;
}

interface Participant {
  id: string;
  participant_evaluation_id: string;
  evaluationId?: string | number;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  hasResults: boolean;
  completed_at: string;
  completedAt: string;
}

interface ReportGeneratorProps {
  evaluations: Evaluation[];
  participants?: Participant[];
  selectedEvaluationId?: string;
}

const REPORT_TYPES = {
  individual: {
    icon: User,
    title: 'Individual',
    tagline: 'Una persona',
    includes: [
      'Información demográfica del participante',
      'Resultados por cuestionario (Forma A/B, Extralaboral, Estrés)',
      'Clasificación de riesgo por dimensiones y dominios',
      'Interpretación profesional y recomendaciones',
    ],
  },
  organizational: {
    icon: Users,
    title: 'Organizacional',
    tagline: 'Toda la evaluación',
    includes: [
      'Ficha sociodemográfica consolidada con gráficas',
      'Distribución de niveles de riesgo por forma A/B',
      'Detalle por dominio y dimensión con análisis',
      'Plan de intervención y recomendaciones prioritarias',
    ],
  },
} as const;

type ReportType = keyof typeof REPORT_TYPES;

function Step({ number, title, children, hint }: { number: number; title: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-blue-600">
        {number}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        {hint && <p className="mt-0.5 text-xs text-gray-400">{hint}</p>}
        <div className="mt-3">{children}</div>
      </div>
    </div>
  );
}

const ReportGenerator: React.FC<ReportGeneratorProps> = ({
  evaluations,
  participants = [],
  selectedEvaluationId
}) => {
  const [selectedEvaluation, setSelectedEvaluation] = useState<string>(selectedEvaluationId || '');
  const [selectedParticipant, setSelectedParticipant] = useState<string>('');
  const [participantQuery, setParticipantQuery] = useState('');
  const [reportType, setReportType] = useState<ReportType>('organizational');
  const [includeCharts, setIncludeCharts] = useState(true);
  const [includeIndividualSummaries, setIncludeIndividualSummaries] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showOrgModal, setShowOrgModal] = useState(false);

  // Participantes con resultados de LA evaluación seleccionada (antes se listaban
  // los de todas las evaluaciones a la vez).
  const availableParticipants = useMemo(() => {
    if (!selectedEvaluation) return [];
    return participants.filter(
      (p) =>
        String(p.evaluationId) === String(selectedEvaluation) &&
        (p.hasResults || p.status === 'completed' || p.status === 'in_progress')
    );
  }, [participants, selectedEvaluation]);

  const filteredParticipants = useMemo(() => {
    const q = participantQuery.trim().toLowerCase();
    if (!q) return availableParticipants;
    return availableParticipants.filter((p) =>
      `${p.firstName} ${p.lastName} ${p.email}`.toLowerCase().includes(q)
    );
  }, [availableParticipants, participantQuery]);

  useEffect(() => {
    setSelectedParticipant('');
    setParticipantQuery('');
  }, [selectedEvaluation, reportType]);

  const currentEvaluation = evaluations.find((e) => String(e.id) === String(selectedEvaluation));
  const currentParticipant = availableParticipants.find(
    (p) => String(p.participant_evaluation_id) === String(selectedParticipant)
  );

  const canGenerate =
    !!selectedEvaluation && (reportType === 'organizational' || !!selectedParticipant);

  const handleGenerateReport = async () => {
    if (!selectedEvaluation) return;

    // El informe organizacional abre el modal de revisión/edición en vez de
    // descargar directamente.
    if (reportType === 'organizational') {
      setShowOrgModal(true);
      return;
    }

    if (!selectedParticipant) return;

    setIsGenerating(true);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/reports/individual`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          participantEvaluationId: selectedParticipant,
          includeCharts,
          language: 'es'
        })
      });

      if (response.status === 403) {
        const errorData = await response.json().catch(() => ({} as any));
        if (errorData.error === 'payment_required') {
          alert(errorData.message || 'Esta evaluación no está habilitada para descarga. Contacta al administrador.');
          return;
        }
        throw new Error(errorData.error || 'No autorizado');
      }

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;

        const filename = currentParticipant
          ? `Reporte_Individual_BRS_${currentParticipant.firstName}_${currentParticipant.lastName}_${new Date().toISOString().split('T')[0]}.pdf`
          : `Reporte_BRS_${new Date().toISOString().split('T')[0]}.pdf`;

        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Error desconocido' }));
        throw new Error(errorData.error || 'Error al generar el reporte');
      }
    } catch (error) {
      console.error('Error generating report:', error);
      alert(`Error al generar el reporte: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="rounded-2xl bg-white p-6 sm:p-8 shadow-sm ring-1 ring-gray-100">
      <div className="space-y-8">
        {/* Paso 1 — Tipo de informe */}
        <Step number={1} title="¿Qué informe necesitas?">
          <div className="grid gap-3 sm:grid-cols-2">
            {(['organizational', 'individual'] as ReportType[]).map((type) => {
              const cfg = REPORT_TYPES[type];
              const Icon = cfg.icon;
              const active = reportType === type;
              return (
                <button
                  key={type}
                  onClick={() => setReportType(type)}
                  className={`relative rounded-xl border p-4 text-left transition-all ${
                    active
                      ? 'border-blue-600 bg-blue-50/60 ring-1 ring-blue-600'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${active ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className={`font-semibold ${active ? 'text-blue-900' : 'text-gray-900'}`}>{cfg.title}</p>
                      <p className="text-xs text-gray-500">{cfg.tagline}</p>
                    </div>
                  </div>
                  {active && (
                    <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600">
                      <Check className="h-3 w-3 text-white" strokeWidth={3} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Qué incluye el tipo seleccionado */}
          <div className="mt-3 rounded-xl bg-slate-50 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">El informe incluye</p>
            <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {REPORT_TYPES[reportType].includes.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-gray-600">
                  <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-green-600" strokeWidth={3} />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </Step>

        {/* Paso 2 — Evaluación */}
        <Step number={2} title="¿De cuál evaluación?">
          <select
            value={selectedEvaluation}
            onChange={(e) => setSelectedEvaluation(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            <option value="">Selecciona una evaluación</option>
            {evaluations.map((evaluation) => (
              <option key={evaluation.id} value={evaluation.id}>
                {evaluation.name}
              </option>
            ))}
          </select>
        </Step>

        {/* Paso 3 — Participante (solo individual) */}
        {reportType === 'individual' && (
          <Step
            number={3}
            title="¿De cuál participante?"
            hint="Solo aparecen participantes con al menos un cuestionario completado."
          >
            {!selectedEvaluation ? (
              <div className="rounded-xl border border-dashed border-gray-200 px-4 py-3 text-sm text-gray-400">
                Selecciona primero una evaluación
              </div>
            ) : availableParticipants.length === 0 ? (
              <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                Esta evaluación aún no tiene participantes con resultados
              </div>
            ) : (
              <div>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={participantQuery}
                    onChange={(e) => setParticipantQuery(e.target.value)}
                    placeholder={`Buscar entre ${availableParticipants.length} participantes…`}
                    className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-11 pr-4 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-gray-100">
                  {filteredParticipants.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-gray-400">Sin coincidencias</p>
                  ) : (
                    filteredParticipants.map((p) => {
                      const active = String(p.participant_evaluation_id) === String(selectedParticipant);
                      const date = p.completedAt || p.completed_at;
                      return (
                        <button
                          key={p.participant_evaluation_id}
                          onClick={() => setSelectedParticipant(String(p.participant_evaluation_id))}
                          className={`flex w-full items-center justify-between gap-3 border-b border-gray-50 px-4 py-2.5 text-left last:border-0 transition-colors ${
                            active ? 'bg-blue-50' : 'hover:bg-gray-50'
                          }`}
                        >
                          <span className={`truncate text-sm ${active ? 'font-medium text-blue-900' : 'text-gray-700'}`}>
                            {p.firstName} {p.lastName}
                          </span>
                          <span className="flex flex-shrink-0 items-center gap-2 text-xs text-gray-400">
                            {date ? new Date(date).toLocaleDateString('es-ES') : 'En progreso'}
                            {active && <Check className="h-4 w-4 text-blue-600" strokeWidth={3} />}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </Step>
        )}

        {/* Paso 4 — Opciones */}
        <Step number={reportType === 'individual' ? 4 : 3} title="¿Qué quieres incluir?">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setIncludeCharts(!includeCharts)}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors ${
                includeCharts
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              <span className={`flex h-4 w-4 items-center justify-center rounded-full ${includeCharts ? 'bg-blue-600' : 'border border-gray-300'}`}>
                {includeCharts && <Check className="h-2.5 w-2.5 text-white" strokeWidth={4} />}
              </span>
              Gráficos y visualizaciones
            </button>

            {reportType === 'organizational' && (
              <button
                onClick={() => setIncludeIndividualSummaries(!includeIndividualSummaries)}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors ${
                  includeIndividualSummaries
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                <span className={`flex h-4 w-4 items-center justify-center rounded-full ${includeIndividualSummaries ? 'bg-blue-600' : 'border border-gray-300'}`}>
                  {includeIndividualSummaries && <Check className="h-2.5 w-2.5 text-white" strokeWidth={4} />}
                </span>
                Resúmenes individuales
              </button>
            )}
          </div>
        </Step>

        {/* Resumen + CTA */}
        <div className="border-t border-gray-100 pt-6">
          {canGenerate && (
            <div className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-500">
              <FileText className="h-4 w-4 text-gray-400" />
              <span className="font-medium text-gray-900">
                {REPORT_TYPES[reportType].title}
              </span>
              <span className="text-gray-300">·</span>
              <span>{currentEvaluation?.name}</span>
              <span className="text-gray-300">·</span>
              <span>
                {reportType === 'individual'
                  ? `${currentParticipant?.firstName} ${currentParticipant?.lastName}`
                  : `${availableParticipants.length} participantes`}
              </span>
            </div>
          )}

          <button
            onClick={handleGenerateReport}
            disabled={isGenerating || !canGenerate}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3.5 font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
          >
            {isGenerating ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white"></div>
                Generando informe…
              </>
            ) : reportType === 'organizational' ? (
              <>
                <Eye className="h-4 w-4" />
                Revisar y generar informe
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Generar informe PDF
              </>
            )}
          </button>

          <p className="mt-3 text-center text-xs text-gray-400">
            {reportType === 'organizational'
              ? 'Se abrirá una vista previa donde podrás revisar y editar los textos antes de imprimir.'
              : 'El PDF se descarga automáticamente. Puede tardar unos segundos.'}
          </p>
        </div>
      </div>

      {showOrgModal && selectedEvaluation && (
        <OrganizationalReportModal
          evaluationId={selectedEvaluation}
          evaluationName={currentEvaluation?.name || ''}
          includeCharts={includeCharts}
          includeIndividualSummaries={includeIndividualSummaries}
          onClose={() => setShowOrgModal(false)}
        />
      )}
    </div>
  );
};

export default ReportGenerator;
