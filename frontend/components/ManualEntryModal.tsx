import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { XMarkIcon, DocumentTextIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import FichaDatosForm from './FichaDatosForm';
import { FichaValues, emptyFicha } from './fichaFields';

type QuestionnaireType = 'intralaboral_a' | 'intralaboral_b' | 'extralaboral' | 'estres';
type EntryType = QuestionnaireType | 'ficha_datos';

const QUESTIONNAIRE_LABELS: Record<EntryType, string> = {
  intralaboral_a: 'Intralaboral Forma A (123 preguntas — Jefes/Profesionales/Técnicos)',
  intralaboral_b: 'Intralaboral Forma B (97 preguntas — Auxiliares/Operarios)',
  extralaboral: 'Extralaboral (31 preguntas)',
  estres: 'Estrés (31 preguntas)',
  ficha_datos: 'Ficha de Datos Generales (18 campos sociodemográficos)',
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
  { value: 4, label: 'Siempre' },
  { value: 3, label: 'Casi siempre' },
  { value: 2, label: 'Algunas veces' },
  { value: 1, label: 'Casi nunca' },
  { value: 0, label: 'Nunca' },
];

const STRESS_OPTIONS = [
  { value: 3, label: 'Siempre' },
  { value: 2, label: 'Casi siempre' },
  { value: 1, label: 'A veces' },
  { value: 0, label: 'Nunca' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  evaluationId: number;
  participantId?: number;
  participantLabel?: string;
  defaultQuestionnaireType?: EntryType;
  onSuccess?: () => void;
}

type Step = 'entry' | 'result';

export default function ManualEntryModal({
  open,
  onClose,
  evaluationId,
  participantId,
  participantLabel,
  defaultQuestionnaireType = 'estres',
  onSuccess,
}: Props) {
  const [step, setStep] = useState<Step>('entry');
  const [questionnaireType, setQuestionnaireType] = useState<EntryType>(defaultQuestionnaireType);
  const [edits, setEdits] = useState<Record<number, number>>({});
  const [fichaEdits, setFichaEdits] = useState<FichaValues>(emptyFicha());
  const [editedInfo, setEditedInfo] = useState<{ documentNumber: string; firstName: string; lastName: string }>({
    documentNumber: '',
    firstName: '',
    lastName: '',
  });
  const [committing, setCommitting] = useState(false);
  const [result, setResult] = useState<any>(null);

  const isFicha = questionnaireType === 'ficha_datos';

  useEffect(() => {
    if (!open) return;
    setStep('entry');
    setQuestionnaireType(defaultQuestionnaireType);
    setEdits({});
    setFichaEdits(emptyFicha());
    setEditedInfo({ documentNumber: '', firstName: '', lastName: '' });
    setResult(null);
  }, [open, defaultQuestionnaireType]);

  useEffect(() => {
    setEdits({});
    setFichaEdits(emptyFicha());
  }, [questionnaireType]);

  const expectedCount = isFicha ? 18 : QUESTIONNAIRE_COUNTS[questionnaireType as QuestionnaireType];
  const scale = !isFicha ? QUESTIONNAIRE_SCALES[questionnaireType as QuestionnaireType] : 'intra';
  const scaleOptions = scale === 'stress' ? STRESS_OPTIONS : INTRA_OPTIONS;

  const savedCount = useMemo(() => {
    if (isFicha) return Object.values(fichaEdits).filter(v => v && String(v).trim().length > 0).length;
    return Object.values(edits).filter((v) => v !== undefined && v !== null).length;
  }, [edits, fichaEdits, isFicha]);

  const handleSetAll = (value: number) => {
    const next: Record<number, number> = {};
    for (let i = 1; i <= expectedCount; i++) next[i] = value;
    setEdits(next);
  };

  const handleCommit = async () => {
    if (isFicha) {
      if (savedCount === 0) return toast.error('Llena al menos un campo de la ficha.');
    } else {
      const responses = Object.entries(edits)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([qn, v]) => ({ questionNumber: Number(qn), responseValue: v }));
      if (responses.length === 0) return toast.error('No hay respuestas para guardar.');
    }

    if (!participantId && !editedInfo.documentNumber.trim()) {
      return toast.error('Escribe el número de documento del participante.');
    }

    setCommitting(true);
    try {
      const token = localStorage.getItem('token');
      const body: any = isFicha
        ? { questionnaireType: 'ficha_datos', fichaDatos: fichaEdits }
        : {
            questionnaireType,
            responses: Object.entries(edits)
              .filter(([, v]) => v !== undefined && v !== null)
              .map(([qn, v]) => ({ questionNumber: Number(qn), responseValue: v })),
          };
      if (participantId) body.participantId = participantId;
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
      toast.success(isFicha ? 'Ficha guardada.' : `Se guardaron ${data.responsesSaved} respuestas.`);
      onSuccess && onSuccess();
    } catch (err) {
      console.error(err);
      toast.error('Error de conexión al guardar.');
    } finally {
      setCommitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-gray-700 bg-opacity-60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[95vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <div className="flex items-center gap-2">
            <DocumentTextIcon className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Ingreso manual de respuestas</h3>
            {participantLabel && (
              <span className="ml-2 text-sm text-gray-500">para {participantLabel}</span>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {step === 'entry' && (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="p-5 space-y-4 border-b">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cuestionario</label>
                <select
                  value={questionnaireType}
                  onChange={(e) => setQuestionnaireType(e.target.value as EntryType)}
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                >
                  {(Object.keys(QUESTIONNAIRE_LABELS) as EntryType[]).map((v) => (
                    <option key={v} value={v}>{QUESTIONNAIRE_LABELS[v]}</option>
                  ))}
                </select>
              </div>

              {!participantId && (
                <div className="bg-blue-50 rounded-md p-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600">Documento *</label>
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

              <div className="flex items-center justify-between bg-gray-50 rounded-md p-3 text-sm">
                <div>
                  <span className="text-gray-500">Progreso:</span>{' '}
                  <b className={savedCount === expectedCount ? 'text-green-700' : ''}>{savedCount}</b> / {expectedCount} {isFicha ? 'campos llenos' : 'respondidas'}
                </div>
                {!isFicha && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Asignar a todas:</span>
                    {scaleOptions.map((o) => (
                      <button
                        key={o.value}
                        onClick={() => handleSetAll(o.value)}
                        className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-100"
                        title={`Asigna ${o.label} a todas las preguntas`}
                      >
                        {o.label} ({o.value})
                      </button>
                    ))}
                    <button
                      onClick={() => setEdits({})}
                      className="text-xs px-2 py-1 rounded border border-red-300 text-red-700 hover:bg-red-50"
                      title="Borra todas las respuestas"
                    >
                      Limpiar
                    </button>
                  </div>
                )}
                {isFicha && (
                  <button
                    onClick={() => setFichaEdits(emptyFicha())}
                    className="text-xs px-2 py-1 rounded border border-red-300 text-red-700 hover:bg-red-50"
                  >
                    Limpiar ficha
                  </button>
                )}
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-md p-2 text-xs text-amber-900 flex items-start gap-2">
                <ExclamationTriangleIcon className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>
                  Si el participante ya tiene respuestas para este cuestionario, se reemplazarán al guardar.
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-auto">
              {isFicha ? (
                <FichaDatosForm
                  values={fichaEdits}
                  onChange={(name, value) => setFichaEdits((prev) => ({ ...prev, [name]: value }))}
                />
              ) : (
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-100 sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2 text-left w-16">#</th>
                      <th className="px-3 py-2 text-left">Respuesta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: expectedCount }, (_, i) => i + 1).map((qn) => {
                      const value = edits[qn];
                      const missing = value === undefined || value === null;
                      return (
                        <tr key={qn} className={`border-b border-gray-100 ${missing ? 'bg-red-50' : ''}`}>
                          <td className="px-3 py-1.5 font-mono text-gray-700">{qn}</td>
                          <td className="px-3 py-1.5">
                            <select
                              value={missing ? '' : value}
                              onChange={(e) => {
                                const v = e.target.value;
                                setEdits((prev) => {
                                  if (v === '') {
                                    const next = { ...prev };
                                    delete next[qn];
                                    return next;
                                  }
                                  return { ...prev, [qn]: Number(v) };
                                });
                              }}
                              className="border-gray-300 rounded-md text-sm py-1 w-56"
                            >
                              <option value="">— sin respuesta —</option>
                              {scaleOptions.map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label} ({o.value})
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="px-5 py-3 border-t flex justify-end gap-2">
              <button onClick={onClose} className="px-4 py-2 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50">
                Cancelar
              </button>
              <button
                onClick={handleCommit}
                disabled={committing || savedCount === 0}
                className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {committing ? 'Guardando…' : `Guardar (${savedCount})`}
              </button>
            </div>
          </div>
        )}

        {step === 'result' && result && (
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3 text-green-700">
              <CheckCircleIcon className="h-8 w-8" />
              <div>
                <h4 className="font-semibold text-lg">Respuestas guardadas</h4>
                <p className="text-sm text-gray-600">Quedaron registradas en el participante con sus dimensiones calculadas.</p>
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
