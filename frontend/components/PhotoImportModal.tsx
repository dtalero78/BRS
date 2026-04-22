import { useEffect, useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import { XMarkIcon, ArrowLeftIcon, PhotoIcon, CheckCircleIcon, ExclamationTriangleIcon, SparklesIcon } from '@heroicons/react/24/outline';

type QuestionnaireType = 'intralaboral_a' | 'intralaboral_b' | 'extralaboral' | 'estres';
type SelectMode = QuestionnaireType | 'auto';

const QUESTIONNAIRE_LABELS: Record<QuestionnaireType, string> = {
  intralaboral_a: 'Intralaboral Forma A (123 preguntas — Jefes/Profesionales/Técnicos)',
  intralaboral_b: 'Intralaboral Forma B (97 preguntas — Auxiliares/Operarios)',
  extralaboral: 'Extralaboral (31 preguntas)',
  estres: 'Estrés (31 preguntas)',
};

const SHORT_LABELS: Record<QuestionnaireType, string> = {
  intralaboral_a: 'Intra A',
  intralaboral_b: 'Intra B',
  extralaboral: 'Extralaboral',
  estres: 'Estrés',
};

const QUESTIONNAIRE_COUNTS: Record<QuestionnaireType, number> = {
  intralaboral_a: 123,
  intralaboral_b: 97,
  extralaboral: 31,
  estres: 31,
};

const QUESTIONNAIRE_SCALES: Record<QuestionnaireType, 'intra' | 'stress'> = {
  intralaboral_a: 'intra',
  intralaboral_b: 'intra',
  extralaboral: 'intra',
  estres: 'stress',
};

const INTRA_OPTIONS = [
  { value: 4, label: 'Siempre (4)' },
  { value: 3, label: 'Casi siempre (3)' },
  { value: 2, label: 'Algunas veces (2)' },
  { value: 1, label: 'Casi nunca (1)' },
  { value: 0, label: 'Nunca (0)' },
];

const STRESS_OPTIONS = [
  { value: 3, label: 'Siempre (3)' },
  { value: 2, label: 'Casi siempre (2)' },
  { value: 1, label: 'A veces (1)' },
  { value: 0, label: 'Nunca (0)' },
];

interface DetectedResponse {
  questionNumber: number;
  responseValue: number;
  confidence: 'high' | 'medium' | 'low';
}

interface TypeData {
  type: QuestionnaireType;
  label?: string;
  expectedCount: number;
  scale?: 'intra' | 'stress';
  responses: DetectedResponse[];
  missing: number[];
  warnings: string[];
  summary: { totalDetected: number; totalExpected: number; lowConfidenceCount: number; missingCount: number };
}

interface PreviewData {
  mode: 'single' | 'auto';
  questionnaireType: SelectMode;
  participantId: number | null;
  participant: { id: number; email: string; demographicData: any } | null;
  detectedTypes?: QuestionnaireType[];
  byType?: Record<QuestionnaireType, TypeData>;
  responses?: DetectedResponse[];
  missing?: number[];
  warnings: string[];
  summary?: { totalDetected: number; totalExpected: number; lowConfidenceCount: number; missingCount: number };
  participantInfo?: { documentNumber: string; firstName: string; lastName: string; confidence: string };
}

interface Props {
  open: boolean;
  onClose: () => void;
  evaluationId: number;
  participantId?: number;
  participantLabel?: string;
  defaultQuestionnaireType?: SelectMode;
  onSuccess?: () => void;
}

type Step = 'select' | 'preview' | 'result';
type EditedRow = { responseValue: number | null; confidence: 'high' | 'medium' | 'low' | 'user' };
type EditsByType = Partial<Record<QuestionnaireType, Record<number, EditedRow>>>;

export default function PhotoImportModal({
  open,
  onClose,
  evaluationId,
  participantId,
  participantLabel,
  defaultQuestionnaireType = 'auto',
  onSuccess,
}: Props) {
  const [step, setStep] = useState<Step>('select');
  const [files, setFiles] = useState<File[]>([]);
  const [selectedMode, setSelectedMode] = useState<SelectMode>(defaultQuestionnaireType);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [editsByType, setEditsByType] = useState<EditsByType>({});
  const [activeTab, setActiveTab] = useState<QuestionnaireType | null>(null);
  const [editedInfo, setEditedInfo] = useState<{ documentNumber: string; firstName: string; lastName: string }>({
    documentNumber: '',
    firstName: '',
    lastName: '',
  });
  const [committing, setCommitting] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    if (!open) return;
    setStep('select');
    setFiles([]);
    setSelectedMode(defaultQuestionnaireType);
    setPreview(null);
    setEditsByType({});
    setActiveTab(null);
    setEditedInfo({ documentNumber: '', firstName: '', lastName: '' });
    setResult(null);
  }, [open, defaultQuestionnaireType]);

  const buildInitialEdits = (t: TypeData): Record<number, EditedRow> => {
    const edits: Record<number, EditedRow> = {};
    for (const r of t.responses) {
      edits[r.questionNumber] = { responseValue: r.responseValue, confidence: r.confidence };
    }
    for (const m of t.missing) {
      edits[m] = { responseValue: null, confidence: 'low' };
    }
    return edits;
  };

  const handlePreview = async () => {
    if (files.length === 0) return toast.error('Selecciona al menos un archivo.');
    setPreviewing(true);
    try {
      const token = localStorage.getItem('token');
      const fd = new FormData();
      fd.append('questionnaireType', selectedMode);
      if (participantId) fd.append('participantId', String(participantId));
      files.forEach(f => fd.append('images', f));

      const response = await fetch(`/api/photo-import/${evaluationId}/preview`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data: PreviewData = await response.json();
      if (!response.ok) {
        toast.error((data as any).error || 'Error al analizar el archivo.');
        return;
      }

      if (data.mode === 'auto') {
        const detected = data.detectedTypes || [];
        if (detected.length === 0) {
          toast.error('La IA no detectó ningún cuestionario reconocible en el archivo.');
          return;
        }
        const initial: EditsByType = {};
        for (const t of detected) {
          if (data.byType && data.byType[t]) initial[t] = buildInitialEdits(data.byType[t]);
        }
        setEditsByType(initial);
        setActiveTab(detected[0]);
      } else {
        const t = data.questionnaireType as QuestionnaireType;
        const td: TypeData = {
          type: t,
          expectedCount: QUESTIONNAIRE_COUNTS[t],
          scale: QUESTIONNAIRE_SCALES[t],
          responses: data.responses || [],
          missing: data.missing || [],
          warnings: [],
          summary: data.summary!,
        };
        setEditsByType({ [t]: buildInitialEdits(td) });
        setActiveTab(t);
      }

      setPreview(data);
      if (data.participantInfo) {
        setEditedInfo({
          documentNumber: data.participantInfo.documentNumber || '',
          firstName: data.participantInfo.firstName || '',
          lastName: data.participantInfo.lastName || '',
        });
      }
      setStep('preview');
    } catch (err) {
      console.error(err);
      toast.error('Error de conexión al analizar archivo.');
    } finally {
      setPreviewing(false);
    }
  };

  const handleCommit = async () => {
    if (!preview) return;
    const submitTypes = Object.keys(editsByType) as QuestionnaireType[];
    const questionnaires = submitTypes
      .map(t => ({
        questionnaireType: t,
        responses: Object.entries(editsByType[t] || {})
          .filter(([, row]) => row.responseValue !== null && row.responseValue !== undefined)
          .map(([qn, row]) => ({ questionNumber: Number(qn), responseValue: row.responseValue as number })),
      }))
      .filter(q => q.responses.length > 0);

    if (questionnaires.length === 0) return toast.error('No hay respuestas para guardar.');

    if (!preview.participantId && !editedInfo.documentNumber.trim()) {
      return toast.error('Escribe el número de documento del participante.');
    }

    setCommitting(true);
    try {
      const token = localStorage.getItem('token');
      const isMulti = preview.mode === 'auto' || questionnaires.length > 1;
      const endpoint = isMulti ? 'commit-multi' : 'commit';
      const body: any = isMulti
        ? { questionnaires }
        : { questionnaireType: questionnaires[0].questionnaireType, responses: questionnaires[0].responses };
      if (preview.participantId) body.participantId = preview.participantId;
      else body.participantInfo = editedInfo;

      const response = await fetch(`/api/photo-import/${evaluationId}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || 'Error al guardar respuestas.');
        return;
      }
      setResult(data);
      setStep('result');
      toast.success(isMulti ? `Se guardaron ${questionnaires.length} cuestionarios.` : `Se guardaron ${questionnaires[0].responses.length} respuestas.`);
      onSuccess && onSuccess();
    } catch (err) {
      console.error(err);
      toast.error('Error de conexión al guardar.');
    } finally {
      setCommitting(false);
    }
  };

  const activeTypeData: TypeData | null = useMemo(() => {
    if (!preview || !activeTab) return null;
    if (preview.mode === 'auto' && preview.byType) return preview.byType[activeTab] || null;
    return {
      type: activeTab,
      expectedCount: QUESTIONNAIRE_COUNTS[activeTab],
      scale: QUESTIONNAIRE_SCALES[activeTab],
      responses: preview.responses || [],
      missing: preview.missing || [],
      warnings: [],
      summary: preview.summary!,
    };
  }, [preview, activeTab]);

  const activeEdits = (activeTab && editsByType[activeTab]) || {};
  const activeExpected = activeTab ? QUESTIONNAIRE_COUNTS[activeTab] : 0;
  const activeScale = activeTab ? QUESTIONNAIRE_SCALES[activeTab] : 'intra';
  const scaleOptions = activeScale === 'stress' ? STRESS_OPTIONS : INTRA_OPTIONS;

  const activeSavedCount = Object.values(activeEdits).filter(r => r.responseValue !== null && r.responseValue !== undefined).length;
  const activeLowConf = Object.values(activeEdits).filter(r => r.confidence === 'low' && r.responseValue !== null).length;
  const activeMissing = activeExpected - activeSavedCount;

  const totalSaved = useMemo(() => {
    let sum = 0;
    for (const t of Object.keys(editsByType) as QuestionnaireType[]) {
      sum += Object.values(editsByType[t] || {}).filter(r => r.responseValue !== null).length;
    }
    return sum;
  }, [editsByType]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-gray-700 bg-opacity-60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[95vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <div className="flex items-center gap-2">
            <PhotoIcon className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Subir foto / PDF de prueba física</h3>
            {participantLabel && (
              <span className="ml-2 text-sm text-gray-500">para {participantLabel}</span>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {step === 'select' && (
          <div className="p-6 space-y-5 overflow-y-auto">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cuestionario</label>
              <select
                value={selectedMode}
                onChange={(e) => setSelectedMode(e.target.value as SelectMode)}
                className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="auto">✨ Auto-detectar (la IA identifica todos los cuestionarios en el archivo)</option>
                {(Object.keys(QUESTIONNAIRE_LABELS) as QuestionnaireType[]).map(v => (
                  <option key={v} value={v}>{QUESTIONNAIRE_LABELS[v]}</option>
                ))}
              </select>
              {selectedMode === 'auto' ? (
                <p className="mt-1 text-xs text-gray-500 flex items-start gap-1">
                  <SparklesIcon className="h-4 w-4 flex-shrink-0 text-purple-500 mt-0.5" />
                  Ideal para baterías completas: la IA reconoce Intralaboral A/B, Extralaboral y Estrés en el mismo archivo y los procesa todos.
                </p>
              ) : (
                <p className="mt-1 text-xs text-gray-500">
                  Se esperan {QUESTIONNAIRE_COUNTS[selectedMode as QuestionnaireType]} preguntas numeradas.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Archivo(s) de la hoja de respuestas</label>
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(e) => setFiles(Array.from(e.target.files || []))}
                className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              <p className="mt-1 text-xs text-gray-500">
                Formatos: JPG, PNG, WebP, PDF. Máximo 32 MB por archivo. Los PDFs multi-página se procesan completos.
              </p>
              {files.length > 0 && (
                <ul className="mt-2 text-xs text-gray-600 list-disc list-inside">
                  {files.map((f, i) => <li key={i}>{f.name} ({Math.round(f.size / 1024)} KB)</li>)}
                </ul>
              )}
            </div>

            {!participantId && (
              <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-900">
                <ExclamationTriangleIcon className="h-4 w-4 inline mr-1" />
                La IA intentará leer el documento/nombre del encabezado. Si no existe el participante, se creará automáticamente al confirmar.
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t">
              <button onClick={onClose} className="px-4 py-2 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50">
                Cancelar
              </button>
              <button
                onClick={handlePreview}
                disabled={previewing || files.length === 0}
                className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {previewing ? 'Analizando con IA…' : 'Analizar con IA'}
              </button>
            </div>
          </div>
        )}

        {step === 'preview' && preview && activeTypeData && activeTab && (
          <div className="flex flex-col flex-1 overflow-hidden">
            {preview.mode === 'auto' && preview.detectedTypes && preview.detectedTypes.length > 0 && (
              <div className="px-5 pt-3 border-b flex gap-1 flex-wrap">
                {preview.detectedTypes.map((t) => {
                  const tEdits = editsByType[t] || {};
                  const saved = Object.values(tEdits).filter(r => r.responseValue !== null).length;
                  const expected = QUESTIONNAIRE_COUNTS[t];
                  const missingCount = expected - saved;
                  const isActive = activeTab === t;
                  return (
                    <button
                      key={t}
                      onClick={() => setActiveTab(t)}
                      className={`px-3 py-1.5 text-sm rounded-t-md border-b-2 transition ${
                        isActive
                          ? 'border-blue-600 text-blue-700 font-semibold bg-blue-50'
                          : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                      }`}
                    >
                      {SHORT_LABELS[t]}{' '}
                      <span className={`text-xs ${missingCount > 0 ? 'text-amber-700' : 'text-green-700'}`}>
                        ({saved}/{expected})
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="px-5 py-3 bg-gray-50 border-b grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
              <div><span className="text-gray-500">Detectadas:</span> <b>{activeSavedCount}</b> / {activeExpected}</div>
              <div><span className="text-gray-500">Baja confianza:</span> <b className="text-amber-700">{activeLowConf}</b></div>
              <div><span className="text-gray-500">Faltantes:</span> <b className={activeMissing > 0 ? 'text-red-700' : ''}>{activeMissing}</b></div>
              <div><span className="text-gray-500">Cuestionario:</span> <b>{activeTab}</b></div>
            </div>

            {(activeTypeData.warnings?.length || preview.warnings?.length) && (
              <div className="px-5 py-2 bg-amber-50 border-b text-sm text-amber-900">
                <b>Advertencias:</b>
                <ul className="list-disc list-inside">
                  {[...(preview.warnings || []), ...(activeTypeData.warnings || [])].map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            )}

            {!preview.participantId && (
              <div className="px-5 py-3 bg-blue-50 border-b grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <div>
                  <label className="block text-xs text-gray-600">Documento detectado</label>
                  <input
                    type="text"
                    value={editedInfo.documentNumber}
                    onChange={(e) => setEditedInfo({ ...editedInfo, documentNumber: e.target.value.replace(/\D+/g, '') })}
                    className="block w-full border-gray-300 rounded-md shadow-sm text-sm"
                    placeholder="Solo dígitos"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600">Nombre</label>
                  <input
                    type="text"
                    value={editedInfo.firstName}
                    onChange={(e) => setEditedInfo({ ...editedInfo, firstName: e.target.value })}
                    className="block w-full border-gray-300 rounded-md shadow-sm text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600">Apellido</label>
                  <input
                    type="text"
                    value={editedInfo.lastName}
                    onChange={(e) => setEditedInfo({ ...editedInfo, lastName: e.target.value })}
                    className="block w-full border-gray-300 rounded-md shadow-sm text-sm"
                  />
                </div>
              </div>
            )}

            <div className="flex-1 overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2 text-left w-16">#</th>
                    <th className="px-3 py-2 text-left">Respuesta</th>
                    <th className="px-3 py-2 text-left w-32">Confianza</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: activeExpected }, (_, i) => i + 1).map((qn) => {
                    const row = activeEdits[qn] || { responseValue: null, confidence: 'low' as const };
                    const missing = row.responseValue === null || row.responseValue === undefined;
                    const rowClass = missing
                      ? 'bg-red-50'
                      : row.confidence === 'low'
                      ? 'bg-amber-50'
                      : row.confidence === 'medium'
                      ? 'bg-yellow-50'
                      : '';
                    return (
                      <tr key={qn} className={`border-b border-gray-100 ${rowClass}`}>
                        <td className="px-3 py-1.5 font-mono text-gray-700">{qn}</td>
                        <td className="px-3 py-1.5">
                          <select
                            value={row.responseValue === null || row.responseValue === undefined ? '' : row.responseValue}
                            onChange={(e) => {
                              const v = e.target.value;
                              setEditsByType((prev) => ({
                                ...prev,
                                [activeTab]: {
                                  ...(prev[activeTab] || {}),
                                  [qn]: v === ''
                                    ? { responseValue: null, confidence: 'user' }
                                    : { responseValue: Number(v), confidence: 'user' },
                                },
                              }));
                            }}
                            className="border-gray-300 rounded-md text-sm py-1"
                          >
                            <option value="">— sin respuesta —</option>
                            {scaleOptions.map(o => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-1.5">
                          {missing ? (
                            <span className="text-red-700 text-xs">Faltante</span>
                          ) : row.confidence === 'user' ? (
                            <span className="text-blue-700 text-xs">Manual</span>
                          ) : row.confidence === 'high' ? (
                            <span className="text-green-700 text-xs">Alta</span>
                          ) : row.confidence === 'medium' ? (
                            <span className="text-yellow-700 text-xs">Media</span>
                          ) : (
                            <span className="text-amber-700 text-xs">Baja</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="px-5 py-3 border-t flex justify-between items-center">
              <button onClick={() => setStep('select')} className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1">
                <ArrowLeftIcon className="h-4 w-4" /> Cambiar archivos
              </button>
              <div className="flex gap-2">
                <button onClick={onClose} className="px-4 py-2 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50">
                  Cancelar
                </button>
                <button
                  onClick={handleCommit}
                  disabled={committing || totalSaved === 0}
                  className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {committing
                    ? 'Guardando…'
                    : preview.mode === 'auto'
                    ? `Confirmar e importar todos (${totalSaved} respuestas)`
                    : `Confirmar e importar (${totalSaved})`}
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 'result' && result && (
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3 text-green-700">
              <CheckCircleIcon className="h-8 w-8" />
              <div>
                <h4 className="font-semibold text-lg">Importación completada</h4>
                <p className="text-sm text-gray-600">Las respuestas y resultados quedaron guardados en el participante.</p>
              </div>
            </div>
            {Array.isArray(result.questionnaires) ? (
              <div className="space-y-2">
                {result.questionnaires.map((q: any, i: number) => (
                  <div key={i} className="bg-gray-50 p-3 rounded flex justify-between items-center text-sm">
                    <div><b>{SHORT_LABELS[q.questionnaireType as QuestionnaireType] || q.questionnaireType}</b></div>
                    <div className="text-gray-600">{q.responsesSaved} respuestas · {q.resultsCalculated} dimensiones</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-gray-500">Respuestas guardadas</div>
                  <div className="text-2xl font-semibold">{result.responsesSaved}</div>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-gray-500">Dimensiones calculadas</div>
                  <div className="text-2xl font-semibold">{result.resultsCalculated}</div>
                </div>
              </div>
            )}
            <div className="flex justify-end pt-3 border-t">
              <button onClick={onClose} className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700">
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
