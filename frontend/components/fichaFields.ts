export interface FichaField {
  name: string;
  label: string;
  kind: 'text' | 'select';
  options?: string[];
  placeholder?: string;
}

export const FICHA_FIELDS: FichaField[] = [
  { name: 'fecha',            label: 'Fecha de aplicación',       kind: 'text', placeholder: 'DD/MM/AAAA' },
  { name: 'sexo',             label: 'Sexo',                      kind: 'select', options: ['Masculino', 'Femenino', 'Otro'] },
  { name: 'birthYear',        label: 'Año de nacimiento',         kind: 'text', placeholder: 'AAAA o DD/MM/AAAA' },
  { name: 'education',        label: 'Último nivel de estudios',  kind: 'select', options: [
    'Ninguno', 'Primaria incompleta', 'Primaria completa',
    'Bachillerato incompleto', 'Bachillerato completo',
    'Técnico/tecnológico incompleto', 'Técnico/tecnológico completo',
    'Profesional incompleto', 'Profesional completo',
    'Carrera militar/policía',
    'Post-grado incompleto', 'Post-grado completo',
  ] },
  { name: 'maritalStatus',    label: 'Estado civil',              kind: 'select', options: [
    'Soltero(a)', 'Casado(a)', 'Unión libre', 'Separado(a)', 'Divorciado(a)', 'Viudo(a)', 'Sacerdote/Monja',
  ] },
  { name: 'ocupacion',        label: 'Ocupación o profesión',     kind: 'text' },
  { name: 'ciudadResidencia', label: 'Ciudad y departamento de residencia', kind: 'text' },
  { name: 'estrato',          label: 'Estrato',                   kind: 'select', options: ['1','2','3','4','5','6','Finca','No sé'] },
  { name: 'dependientes',     label: 'Personas que dependen económicamente', kind: 'text', placeholder: 'Número' },
  { name: 'tipoVivienda',     label: 'Tipo de vivienda',          kind: 'select', options: ['Propia','En arriendo','Familiar'] },
  { name: 'ciudadTrabajo',    label: 'Ciudad y departamento de trabajo', kind: 'text' },
  { name: 'anosEmpresa',      label: 'Años/meses en la empresa',  kind: 'text', placeholder: 'Ej. "20 meses" o "2 años"' },
  { name: 'cargo',            label: 'Nombre del cargo',          kind: 'text' },
  { name: 'tipoCargo',        label: 'Tipo de cargo',             kind: 'select', options: [
    'Jefatura - tiene personal a cargo',
    'Profesional, analista, técnico, tecnólogo',
    'Auxiliar, asistente administrativo, asistente técnico',
    'Operario, operador, ayudante, servicios generales',
  ] },
  { name: 'anosCargo',        label: 'Años/meses en el cargo actual', kind: 'text', placeholder: 'Ej. "20 meses"' },
  { name: 'departamento',     label: 'Departamento/área/sección', kind: 'text' },
  { name: 'tipoContrato',     label: 'Tipo de contrato',          kind: 'select', options: [
    'Temporal de menos de 1 año',
    'Temporal de 1 año o más',
    'Término indefinido',
    'Cooperado (cooperativa)',
    'Prestación de servicios',
    'No sé',
  ] },
  { name: 'horasTrabajo',     label: 'Horas diarias de trabajo',  kind: 'text', placeholder: 'Ej. "8" o "12 horas"' },
];

export type FichaValues = Record<string, string>;

export const emptyFicha = (): FichaValues => {
  const out: FichaValues = {};
  for (const f of FICHA_FIELDS) out[f.name] = '';
  return out;
};
