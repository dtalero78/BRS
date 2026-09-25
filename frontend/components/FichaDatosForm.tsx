import { FICHA_FIELDS, FichaValues, matchFichaOption } from './fichaFields';

interface Props {
  values: FichaValues;
  onChange: (name: string, value: string) => void;
}

export default function FichaDatosForm({ values, onChange }: Props) {
  return (
    <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
      {FICHA_FIELDS.map((f) => {
        const v = values[f.name] ?? '';
        // Lo guardado puede estar escrito distinto a la opción ('Posgrado' vs
        // 'Post-grado'): se busca su equivalente para que quede seleccionada.
        const canonico = f.kind === 'select' ? matchFichaOption(f.options, v) : null;
        // Y si de plano no es ninguna de la lista (el 'Bachiller' que ponía por
        // defecto el formulario de participantes), se muestra igual como opción
        // aparte. Un <select> con un valor que no está entre sus <option> se
        // pinta vacío, y eso se lee como "se perdió el dato" cuando en realidad
        // está guardado: es justo lo que hay que dejarle ver al evaluador.
        const fueraDeLista = f.kind === 'select' && v !== '' && canonico === null;
        return (
          <div key={f.name}>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              {f.label}
            </label>
            {f.kind === 'select' ? (
              <select
                value={canonico ?? v}
                onChange={(e) => onChange(f.name, e.target.value)}
                className={`block w-full rounded-md shadow-sm text-sm focus:ring-blue-500 focus:border-blue-500 ${
                  fueraDeLista ? 'border-amber-400 bg-amber-50' : 'border-gray-300'
                }`}
              >
                <option value="">— sin dato —</option>
                {fueraDeLista && (
                  <option value={v}>{v} (dato guardado, fuera de la lista oficial)</option>
                )}
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
