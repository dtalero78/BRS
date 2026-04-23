import { FICHA_FIELDS, FichaValues } from './fichaFields';

interface Props {
  values: FichaValues;
  onChange: (name: string, value: string) => void;
}

export default function FichaDatosForm({ values, onChange }: Props) {
  return (
    <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
      {FICHA_FIELDS.map((f) => {
        const v = values[f.name] ?? '';
        return (
          <div key={f.name}>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              {f.label}
            </label>
            {f.kind === 'select' ? (
              <select
                value={v}
                onChange={(e) => onChange(f.name, e.target.value)}
                className="block w-full border-gray-300 rounded-md shadow-sm text-sm focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">— sin dato —</option>
                {(f.options || []).map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={v}
                placeholder={f.placeholder || ''}
                onChange={(e) => onChange(f.name, e.target.value)}
                className="block w-full border-gray-300 rounded-md shadow-sm text-sm focus:ring-blue-500 focus:border-blue-500"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
