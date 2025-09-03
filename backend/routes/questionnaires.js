const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const fs = require('fs');
const path = require('path');

// Load questionnaires data
let questionnairesData = null;

const loadQuestionnairesData = () => {
  if (!questionnairesData) {
    try {
      const dataPath = path.join(__dirname, '../../bateria_riesgo_psicosocial_preguntas.json');
      const rawData = fs.readFileSync(dataPath, 'utf8');
      questionnairesData = JSON.parse(rawData);
    } catch (error) {
      console.error('Error loading questionnaires data:', error);
      throw new Error('No se pudieron cargar los datos de cuestionarios');
    }
  }
  return questionnairesData;
};

// Get questionnaire by type
router.get('/:type', auth, async (req, res) => {
  try {
    const { type } = req.params;
    const data = loadQuestionnairesData();

    let questionnaire = null;

    switch (type) {
      case 'ficha-datos':
        questionnaire = data.cuestionarios.ficha_datos_generales;
        break;
      case 'forma-a':
        questionnaire = data.cuestionarios.forma_a_intralaboral;
        break;
      case 'forma-b':
        questionnaire = data.cuestionarios.forma_b_intralaboral;
        break;
      case 'extralaboral':
        questionnaire = data.cuestionarios.extralaboral;
        break;
      case 'estres':
        questionnaire = data.cuestionarios.estres;
        break;
      default:
        return res.status(404).json({ error: 'Tipo de cuestionario no encontrado' });
    }

    if (!questionnaire) {
      return res.status(404).json({ error: 'Cuestionario no encontrado' });
    }

    res.json({
      type,
      questionnaire: {
        nombre: questionnaire.nombre,
        descripcion: questionnaire.descripcion,
        total_preguntas: questionnaire.total_preguntas,
        instrucciones: questionnaire.instrucciones,
        opciones_respuesta: questionnaire.opciones_respuesta,
        secciones: questionnaire.secciones || questionnaire.preguntas,
        campos: questionnaire.campos // For demographic form
      },
      opciones_respuesta: data.opciones_respuesta
    });

  } catch (error) {
    console.error('Get questionnaire error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Get all questionnaire types with basic info
router.get('/', auth, async (req, res) => {
  try {
    const data = loadQuestionnairesData();

    const questionnaires = {
      'forma-a': {
        nombre: data.cuestionarios.forma_a_intralaboral.nombre,
        total_preguntas: data.cuestionarios.forma_a_intralaboral.total_preguntas,
        descripcion: 'Para jefes, profesionales y técnicos'
      },
      'forma-b': {
        nombre: data.cuestionarios.forma_b_intralaboral?.nombre || 'Cuestionario Forma B',
        total_preguntas: data.cuestionarios.forma_b_intralaboral?.total_preguntas || 97,
        descripcion: 'Para auxiliares y operarios'
      },
      'extralaboral': {
        nombre: data.cuestionarios.extralaboral?.nombre || 'Cuestionario Extralaboral',
        total_preguntas: data.cuestionarios.extralaboral?.total_preguntas || 31,
        descripcion: 'Factores externos al trabajo'
      },
      'estres': {
        nombre: data.cuestionarios.estres?.nombre || 'Cuestionario de Estrés',
        total_preguntas: data.cuestionarios.estres?.total_preguntas || 31,
        descripcion: 'Síntomas de estrés ocupacional'
      }
    };

    res.json({
      questionnaires,
      opciones_respuesta: data.opciones_respuesta
    });

  } catch (error) {
    console.error('Get questionnaires error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Get demographic form (ficha de datos generales)
router.get('/demographic/form', auth, async (req, res) => {
  try {
    const data = loadQuestionnairesData();
    
    const demographicForm = data.cuestionarios.ficha_datos_generales || {
      nombre: 'Ficha de Datos Generales',
      campos: [
        { id: 'firstName', label: 'Nombres', tipo: 'text', requerido: true },
        { id: 'lastName', label: 'Apellidos', tipo: 'text', requerido: true },
        { id: 'documentType', label: 'Tipo de documento', tipo: 'select', opciones: ['CC', 'CE', 'Pasaporte'], requerido: true },
        { id: 'documentNumber', label: 'Número de documento', tipo: 'text', requerido: true },
        { id: 'birthYear', label: 'Año de nacimiento', tipo: 'number', requerido: true },
        { id: 'gender', label: 'Sexo', tipo: 'select', opciones: ['Masculino', 'Femenino', 'Otro'], requerido: true },
        { id: 'maritalStatus', label: 'Estado civil', tipo: 'select', opciones: ['Soltero(a)', 'Casado(a)', 'Unión libre', 'Separado(a)', 'Divorciado(a)', 'Viudo(a)'], requerido: true },
        { id: 'educationLevel', label: 'Nivel de escolaridad', tipo: 'select', opciones: ['Sin estudios', 'Primaria incompleta', 'Primaria completa', 'Bachillerato incompleto', 'Bachillerato completo', 'Técnico', 'Tecnológico', 'Universitario', 'Posgrado'], requerido: true },
        { id: 'department', label: 'Área/Departamento', tipo: 'text', requerido: true },
        { id: 'position', label: 'Cargo', tipo: 'text', requerido: true },
        { id: 'contractType', label: 'Tipo de contrato', tipo: 'select', opciones: ['Término indefinido', 'Término fijo', 'Prestación de servicios', 'Temporal'], requerido: true },
        { id: 'employmentType', label: 'Tipo de vinculación', tipo: 'select', opciones: ['Tiempo completo', 'Medio tiempo', 'Por horas'], requerido: true },
        { id: 'tenureMonths', label: 'Antigüedad en meses', tipo: 'number', requerido: true },
        { id: 'salaryRange', label: 'Rango salarial', tipo: 'select', opciones: ['Menos de 1 SMMLV', '1-2 SMMLV', '2-4 SMMLV', '4-6 SMMLV', '6-8 SMMLV', 'Más de 8 SMMLV'], requerido: true },
        { id: 'workHoursPerDay', label: 'Horas de trabajo por día', tipo: 'number', requerido: true },
        { id: 'workDaysPerWeek', label: 'Días de trabajo por semana', tipo: 'number', requerido: true }
      ]
    };

    res.json(demographicForm);

  } catch (error) {
    console.error('Get demographic form error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;