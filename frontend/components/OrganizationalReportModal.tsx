import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, RefreshCw, Save, Download, RotateCcw, Loader2, FileText } from 'lucide-react';
import { API_URL } from '../config/api';

type FieldKind = 'paragraph' | 'paragraphs' | 'list';

interface OrgTextField {
  key: string;
  group: string;
  label: string;
  kind: FieldKind;
  help?: string;
}

interface OrganizationalReportModalProps {
  evaluationId: string;
  evaluationName: string;
  includeCharts?: boolean;
  includeIndividualSummaries?: boolean;
  onClose: () => void;
}

type TextsPayload = Record<string, string | string[]>;

// texts object (strings / string[]) -> raw textarea strings (one entry per line)
function textsToEditor(texts: TextsPayload, fields: OrgTextField[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of fields) {
    const v = texts[f.key];
    if (f.kind === 'paragraph') {
      out[f.key] = typeof v === 'string' ? v : v == null ? '' : String(v);
    } else {
      out[f.key] = Array.isArray(v) ? v.join('\n') : v == null ? '' : String(v);
    }
  }
  return out;
}

// raw textarea strings -> texts object for the API
function editorToTexts(editor: Record<string, string>, fields: OrgTextField[]): TextsPayload {
  const out: TextsPayload = {};
  for (const f of fields) {
    const raw = editor[f.key] ?? '';
    if (f.kind === 'paragraph') {
      out[f.key] = raw;
    } else {
      out[f.key] = raw
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return out;
}

const OrganizationalReportModal: React.FC<OrganizationalReportModalProps> = ({
  evaluationId,
  evaluationName,
  includeCharts = true,
  includeIndividualSummaries = false,
  onClose,
}) => {
  const [fields, setFields] = useState<OrgTextField[]>([]);
  const [editor, setEditor] = useState<Record<string, string>>({});
  const [defaults, setDefaults] = useState<TextsPayload>({});
  const [loadingTexts, setLoadingTexts] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const previewUrlRef = useRef<string | null>(null);
  const previewBlobRef = useRef<Blob | null>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const setPreview = (blob: Blob | null) => {
    if (previewUrlRef.current) {
      window.URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    previewBlobRef.current = blob;
    if (blob) {
      const url = window.URL.createObjectURL(blob);
      previewUrlRef.current = url;
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  };

  // Lock body scroll + Esc to close
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
      if (previewUrlRef.current) window.URL.revokeObjectURL(previewUrlRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Generate the PDF preview from the current editor state. Returns the blob (or null on error).
  const generatePreview = async (overrideEditor?: Record<string, string>): Promise<Blob | null> => {
    setGenerating(true);
    setError(null);
    try {
      const texts = editorToTexts(overrideEditor ?? editor, fields);
      const response = await fetch(`${API_URL}/api/reports/organizational`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ evaluationId, includeCharts, includeIndividualSummaries, texts }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({} as any));
        if (response.status === 403 && data.error === 'payment_required') {
          setError(data.message || 'Esta evaluación no está habilitada para descarga. Contacta al administrador.');
        } else {
          setError(data.error || 'No se pudo generar la vista previa del informe.');
        }
        return null;
      }

      const blob = await response.blob();
      setPreview(blob);
      setDirty(false);
      return blob;
    } catch (e) {
      setError('Error de red al generar la vista previa.');
      return null;
    } finally {
      setGenerating(false);
    }
  };

  // Load editable texts + schema, then render the first preview.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingTexts(true);
      setError(null);
      try {
        const response = await fetch(
          `${API_URL}/api/reports/organizational/texts?evaluationId=${encodeURIComponent(evaluationId)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!response.ok) {
          const data = await response.json().catch(() => ({} as any));
          if (!cancelled) setError(data.error || 'No se pudieron cargar los textos del informe.');
          return;
        }
        const data = await response.json();
        if (cancelled) return;
        const loadedFields: OrgTextField[] = data.fields || [];
        const loadedEditor = textsToEditor(data.texts || {}, loadedFields);
        setFields(loadedFields);
        setDefaults(data.defaults || {});
        setEditor(loadedEditor);
        setLoadingTexts(false);
        // Kick off the first preview with the freshly loaded texts
        await generatePreview(loadedEditor);
      } catch (e) {
        if (!cancelled) setError('Error de red al cargar los textos del informe.');
      } finally {
        if (!cancelled) setLoadingTexts(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evaluationId]);

  const handleFieldChange = (key: string, value: string) => {
    setEditor((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const texts = editorToTexts(editor, fields);
      const response = await fetch(`${API_URL}/api/reports/organizational/texts`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ evaluationId, texts }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({} as any));
        setError(data.error || 'No se pudieron guardar los cambios.');
        return;
      }
      alert('Cambios guardados. Se usarán la próxima vez que generes este informe.');
    } catch (e) {
      setError('Error de red al guardar los cambios.');
    } finally {
      setSaving(false);
    }
  };

  const handleRestoreDefaults = () => {
    if (!confirm('¿Restaurar todos los textos a sus valores por defecto? Se perderán los cambios no guardados en el editor.')) {
      return;
    }
    setEditor(textsToEditor(defaults, fields));
    setDirty(true);
  };

  const handleDownload = async () => {
    // If there are unsaved edits (or no preview yet), regenerate so the download matches the editor.
    let blob = previewBlobRef.current;
    if (dirty || !blob) {
      blob = await generatePreview();
    }
    if (!blob) return;
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    const safeName = (evaluationName || 'Evaluacion').replace(/\s+/g, '_');
    a.download = `Reporte_Organizacional_BRS_${safeName}_${new Date().toISOString().split('T')[0]}.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const groupedFields = useMemo(() => {
    const groups: { group: string; fields: OrgTextField[] }[] = [];
    for (const f of fields) {
      let g = groups.find((x) => x.group === f.group);
      if (!g) {
        g = { group: f.group, fields: [] };
        groups.push(g);
      }
      g.fields.push(f);
    }
    return groups;
  }, [fields]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl h-[95vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="h-5 w-5 text-blue-600 flex-shrink-0" />
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-gray-900 truncate">Revisar informe organizacional</h3>
              <p className="text-xs text-gray-500 truncate">{evaluationName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body: editor + preview */}
        <div className="flex-1 flex flex-col lg:flex-row min-h-0">
          {/* Editor pane */}
          <div className="w-full lg:w-[42%] border-b lg:border-b-0 lg:border-r border-gray-200 flex flex-col min-h-0">
            <div className="px-5 py-2 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <span className="text-sm font-medium text-gray-700">Textos del informe</span>
              <button
                onClick={handleRestoreDefaults}
                disabled={loadingTexts}
                className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 disabled:opacity-50"
                title="Restaurar valores por defecto"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Restaurar
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
              {loadingTexts ? (
                <div className="flex items-center justify-center h-40 text-gray-500">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Cargando textos...
                </div>
              ) : (
                groupedFields.map((group) => (
                  <div key={group.group} className="space-y-4">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-blue-700 border-b border-gray-100 pb-1">
                      {group.group}
                    </h4>
                    {group.fields.map((f) => (
                      <div key={f.key}>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                        {f.help && <p className="text-xs text-gray-400 mb-1">{f.help}</p>}
                        <textarea
                          value={editor[f.key] ?? ''}
                          onChange={(e) => handleFieldChange(f.key, e.target.value)}
                          rows={f.kind === 'paragraph' ? 4 : 5}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y"
                        />
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Preview pane */}
          <div className="w-full lg:w-[58%] flex flex-col min-h-0 bg-gray-100">
            <div className="px-5 py-2 border-b border-gray-200 flex items-center justify-between flex-shrink-0 bg-white">
              <span className="text-sm font-medium text-gray-700">Vista previa (PDF)</span>
              {dirty && !generating && (
                <span className="text-xs text-amber-600">Cambios sin aplicar a la vista previa</span>
              )}
            </div>
            <div className="flex-1 relative min-h-[300px]">
              {error ? (
                <div className="absolute inset-0 flex items-center justify-center p-6">
                  <div className="max-w-md text-center bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
                    {error}
                  </div>
                </div>
              ) : previewUrl ? (
                <iframe title="Vista previa del informe" src={previewUrl} className="w-full h-full border-0" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
                  {generating ? '' : 'Sin vista previa'}
                </div>
              )}
              {generating && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                  <div className="flex items-center gap-2 text-gray-700 text-sm">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Generando vista previa...
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 px-5 py-3 border-t border-gray-200 flex-shrink-0 bg-white">
          <button
            onClick={() => generatePreview()}
            disabled={generating || loadingTexts}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md border border-blue-600 text-blue-700 hover:bg-blue-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
            Actualizar vista previa
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Cerrar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || loadingTexts}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar cambios
            </button>
            <button
              onClick={handleDownload}
              disabled={generating || loadingTexts || !!error}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              Descargar PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrganizationalReportModal;
