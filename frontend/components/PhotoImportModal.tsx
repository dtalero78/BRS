import { useEffect, useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import { XMarkIcon, ArrowLeftIcon, PhotoIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

type QuestionnaireType = 'intralaboral_a' | 'intralaboral_b' | 'extralaboral' | 'estres';

const QUESTIONNAIRE_LABELS: Record<QuestionnaireType, string> = {
  intralaboral_a: 'Intralaboral Forma A (123 preguntas — Jefes/Profesionales/Técnicos)',
  intralaboral_b: 'Intralaboral Forma B (97 preguntas — Auxiliares/Operarios)',
  extralaboral: 'Extralaboral (31 preguntas)',
  estres: 'Estrés (31 preguntas)',
};

const QUESTIONNAIRE_COUNTS: Record<QuestionnaireType, number> = {
  intralaboral_a: 123,
  intralaboral_b: 97,
  extralaboral: 31,
  estres: 31,
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

interface PreviewData {
  questionnaireType: QuestionnaireType;
  participantId: number | null;
  participant: { id: number; email: string; demographicData: any } | null;
  responses: DetectedResponse[];
  missing: number[];
  warnings: string[];
  summary: { totalDetected: number; totalExpected: number; lowConfidenceCount: number; missingCount: number };
  participantInfo?: { documentNumber: string; firstName: string; lastName: string; confidence: string };
}

interface Props {
  open: boolean;
  onClose: () => void;
  evaluationId: number;
  participantId?: number;
  participantLabel?: string;
  defaultQuestionnaireType?: QuestionnaireType;
  onSuccess?: () => void;
}

type Step = 'select' | 'preview' | 'result';

type EditedRow = { responseValue: number | null; confidence: 'high' | 'medium' | 'low' | 'user' };

export default function PhotoImportModal({
  open,
  onClose,
  evaluationId,
  participantId,
  participantLabel,
  defaultQuestionnaireType = 'estres',
  onSuccess,
}: Props) {
  const [step, setStep] = useState<Step>('select');
  const [files, setFiles] = useState<File[]>([]);
  const [questionnaireType, setQuestionnaireType] = useState<QuestionnaireType>(defaultQuestionnaireType);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [edits, setEdits] = useState<Record<number, EditedRow>>({});
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
    setQuestionnaireType(defaultQuestionnaireType);
    setPreview(null);
    setEdits({});
    setEditedInfo({ documentNumber: '', firstName: '', lastName: '' });
    setResult(null);
  }, [open, defaultQuestionnaireType]);

  const expectedCount = QUESTIONNAIRE_COUNTS[questionnaireType];
  const scaleOptions = questionnaireType === 'estres' ? STRESS_OPTIONS : INTRA_OPTIONS;

  const handlePreview = async () => {
    if (files.length === 0) return toast.error('Selecciona al menos una imagen.');
    setPreviewing(true);
    try {
      const token = localStorage.getItem('token');
      const fd = new FormData();
      fd.append('questionnaireType', questionnaireType);
      if (participantId) fd.append('participantId', String(participantId));
      files.forEach(f => fd.append('images', f));

      const response = await fetch(`/api/photo-import/${evaluationId}/preview`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || 'Error al analizar las imágenes');
        return;
      }
      setPreview(data);
      const initialEdits: Record<number, EditedRow> = {};
      for (const r of data.responses) {
        initialEdits[r.questionNumber] = { responseValue: r.responseValue, confidence: r.confidence };
      }
      for (const missing of data.missing) {
        initialEdits[missing] = { responseValue: null, confidence: 'low' };
      }
      setEdits(initialEdits);
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
      toast.error('Error de conexión al analizar imágenes.');
    } finally {
      setPreviewing(false);
    }
  };

  const handleCommit = async () => {
    if (!preview) return;
    const toSubmit = Object.entries(edits)
      .filter(([, row]) => row.responseValue !== null && row.responseValue !== undefined)
      .map(([qn, row]) => ({ questionNumber: Number(qn), responseValue: row.responseValue as number }));

    if (toSubmit.length === 0) return toast.error('No hay respuestas para guardar.');

    if (!preview.participantId) {
      if (!editedInfo.documentNumber.trim()) {
        return toast.error('Escribe el número de documento del participante.');
      }
    }

    setCommitting(true);
    try {
      const token = localStorage.getItem('token');
      const body: any = {
        questionnaireType: preview.questionnaireType,
        responses: toSubmit,
      };
      if (preview.participantId) body.participantId = preview.participantId;
      else body.participantInfo = editedInfo;

      const response = await fetch(`/api/photo-import/${evaluationId}/commit`, {
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
      toast.success(`Se guardaron ${data.responsesSaved} respuestas.`);
      onSuccess && onSuccess();
    } catch (err) {
      console.error(err);
      toast.error('Error de conexión al guardar.');
    } finally {
      setCommitting(false);
    }
  };

  const savedCount = useMemo(
    () => Object.values(edits).filter(r => r.responseValue !== null && r.responseValue !== undefined).length,
    [edits]
  );
  const lowConfCount = useMemo(
    () => Object.values(edits).filter(r => r.confidence === 'low' && r.responseValue !== null).length,
    [edits]
  );
  const missingCount = expectedCount - savedCount;

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-gray-700 bg-opacity-60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[95vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <div className="flex items-center gap-2">
            <PhotoIcon className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Subir foto de prueba física</h3>
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
                value={questionnaireType}
                onChange={(e) => setQuestionnaireType(e.target.value as QuestionnaireType)}
                className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              >
                {Object.entries(QUESTIONNAIRE_LABELS).map(([v, label]) => (
                  <option key={v} value={v}>{label}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Se esperan {expectedCount} preguntas numeradas. Puedes subir varias fotos si el cuestionario ocupa más de una página.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Foto(s) de la hoja de respuestas</label>
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setFiles(Array.from(e.target.files || []))}
                className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              {files.length > 0 && (
                <ul className="mt-2 text-xs text-gray-600 list-disc list-inside">
                  {files.map((f, i) => <li key={i}>{f.name} ({Math.round(f.size / 1024)} KB)</li>)}
                </ul>
              )}
            </div>

            {!participantId && (
              <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-900">
                <ExclamationTriangleIcon className="h-4 w-4 inline mr-1" />
                La IA intentará leer el documento/nombre escrito en el encabezado. Si no existe el participante, se creará automáticamente al confirmar.
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

        {step === 'preview' && preview && (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
              <div><span className="text-gray-500">Detectadas:</span> <b>{savedCount}</b> / {expectedCount}</div>
              <div><span className="text-gray-500">Baja confianza:</span> <b className="text-amber-700">{lowConfCount}</b></div>
              <div><span className="text-gray-500">Faltantes:</span> <b className={missingCount > 0 ? 'text-red-700' : ''}>{missingCount}</b></div>
              <div><span className="text-gray-500">Cuestionario:</span> <b>{preview.questionnaireType}</b></div>
            </div>

            {preview.warnings && preview.warnings.length > 0 && (
              <div className="px-5 py-2 bg-amber-50 border-b text-sm text-amber-900">
                <b>Advertencias:</b>
                <ul className="list-disc list-inside">
                  {preview.warnings.map((w, i) => <li key={i}>{w}</li>)}
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
                  {Array.from({ length: expectedCount }, (_, i) => i + 1).map((qn) => {
                    const row = edits[qn] || { responseValue: null, confidence: 'low' as const };
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
                              setEdits((prev) => ({
                                ...prev,
                                [qn]: v === ''
                                  ? { responseValue: null, confidence: 'user' }
                                  : { responseValue: Number(v), confidence: 'user' },
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
                <ArrowLeftIcon className="h-4 w-4" /> Cambiar fotos
              </button>
              <div className="flex gap-2">
                <button onClick={onClose} className="px-4 py-2 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50">
                  Cancelar
                </button>
                <button
                  onClick={handleCommit}
                  disabled={committing || savedCount === 0}
                  className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {committing ? 'Guardando…' : `Confirmar e importar (${savedCount})`}
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
