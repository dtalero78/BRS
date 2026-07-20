const express = require('express');
const router = express.Router();
const multer = require('multer');
const crypto = require('crypto');
const Joi = require('joi');
const { auth, authorize, getOwnedCompanyIds } = require('../middleware/auth');
const db = require('../config/database');
const calculateResults = require('../utils/calculate-results');
const { extractAnswersFromSheet, extractAllQuestionnairesFromSheet, QUESTIONNAIRE_META, FICHA_FIELDS, FICHA_FIELD_NAMES } = require('../utils/answer-sheet-ocr');

const VALID_TYPES = Object.keys(QUESTIONNAIRE_META);
const VALID_TYPES_WITH_FICHA = [...VALID_TYPES, 'ficha_datos'];

function transformFichaToResponseMap(fichaFields) {
  const map = {};
  for (const f of FICHA_FIELDS) {
    const v = fichaFields[f.name];
    map[String(f.key)] = typeof v === 'string' ? v : '';
  }
  return map;
}

function extractBirthYear(val) {
  if (!val) return null;
  const s = String(val);
  const match4 = s.match(/(19|20)\d{2}/);
  if (match4) return parseInt(match4[0], 10);
  return null;
}

function parseTenureMonths(val) {
  if (!val) return null;
  const s = String(val).toLowerCase();
  const monthMatch = s.match(/(\d+)\s*mes/);
  if (monthMatch) return parseInt(monthMatch[1], 10);
  const yearMatch = s.match(/(\d+)\s*(año|anio|an[oó])/);
  if (yearMatch) return parseInt(yearMatch[1], 10) * 12;
  const bareNum = s.match(/^\s*(\d+)\s*$/);
  if (bareNum) return parseInt(bareNum[1], 10) * 12;
  return null;
}

function parseHoursPerDay(val) {
  if (!val) return null;
  const s = String(val);
  const m = s.match(/(\d+)/);
  if (m) return parseInt(m[1], 10);
  return null;
}

function mapGender(sexo) {
  if (!sexo) return null;
  const u = String(sexo).toUpperCase().trim();
  if (u.startsWith('MASC') || u === 'M') return 'Masculino';
  if (u.startsWith('FEM') || u === 'F') return 'Femenino';
  return null;
}

function mapMaritalStatus(st) {
  if (!st) return null;
  const u = String(st).toUpperCase();
  if (u.includes('SOLTER')) return 'Soltero(a)';
  if (u.includes('CASAD')) return 'Casado(a)';
  if (u.includes('UNION') || u.includes('UNIÓN') || u.includes('UNI')) return 'Unión libre';
  if (u.includes('SEPARAD')) return 'Separado(a)';
  if (u.includes('DIVORCIAD')) return 'Divorciado(a)';
  if (u.includes('VIUD')) return 'Viudo(a)';
  return null;
}

function mapFormTypeFromTipoCargo(tc) {
  if (!tc) return null;
  const u = String(tc).toUpperCase();
  if (u.includes('JEFATURA') || u.includes('PROFESIONAL') || u.includes('TÉCNIC') || u.includes('TECNIC')) return 'A';
  if (u.includes('AUXILIAR') || u.includes('ASISTENT') || u.includes('OPERARI') || u.includes('OPERAD') || u.includes('AYUDANT')) return 'B';
  return null;
}

function mergeDemographicFromFicha(currentDemo, fichaFields) {
  const demo = { ...(currentDemo || {}) };
  const gender = mapGender(fichaFields.sexo);
  if (gender) demo.gender = gender;
  const birth = extractBirthYear(fichaFields.birthYear);
  if (birth) demo.birthYear = birth;
  const ms = mapMaritalStatus(fichaFields.maritalStatus);
  if (ms) demo.maritalStatus = ms;
  if (fichaFields.education) demo.educationLevel = fichaFields.education;
  if (fichaFields.cargo) demo.position = fichaFields.cargo;
  if (fichaFields.departamento) demo.department = fichaFields.departamento;
  if (fichaFields.tipoContrato) demo.contractType = fichaFields.tipoContrato;
  if (fichaFields.tipoCargo) demo.employmentType = fichaFields.tipoCargo;
  const tenure = parseTenureMonths(fichaFields.anosEmpresa);
  if (tenure !== null) demo.tenureMonths = tenure;
  const hours = parseHoursPerDay(fichaFields.horasTrabajo);
  if (hours !== null) demo.workHoursPerDay = hours;
  const ft = mapFormTypeFromTipoCargo(fichaFields.tipoCargo);
  if (ft) demo.formType = ft;
  return demo;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 32 * 1024 * 1024,
    files: 10,
  },
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|png|webp|jpg)$/i.test(file.mimetype) || /^application\/pdf$/i.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes JPG, PNG, WebP o PDF.'));
    }
  },
});

async function loadEvaluationForUser(evaluationId, userId, role) {
  const evaluation = await db('evaluations').where('id', evaluationId).first();
  if (!evaluation) return null;
  if (role === 'admin') return evaluation;
  const companyIds = await getOwnedCompanyIds(userId);
  if (!companyIds.includes(evaluation.company_id)) return null;
  return evaluation;
}

function occupationalGroupFor(questionnaireType, formType) {
  if (questionnaireType === 'intralaboral_a') return 'jefes';
  if (questionnaireType === 'intralaboral_b') return 'auxiliares';
  return formType === 'B' ? 'auxiliares' : 'jefes';
}

function parseIntegrationMeta(raw) {
  if (!raw) return null;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch (e) { return null; }
  }
  return raw;
}

/**
 * Recalcula el estado del participant_evaluation a partir de sus respuestas.
 * Espeja la lógica de participant-access.js (flujo de token): un cuestionario
 * cuenta como terminado solo si tiene completed_at. Sin esto, las importaciones
 * por foto guardaban respuestas + resultados pero dejaban el PE en 'assigned'/
 * 'in_progress' para siempre → "Completo sin estado" en el panel del evaluador.
 */
async function finalizePeStatus(trx, peId, formType, integrationMetaRaw) {
  const allResponses = await trx('responses')
    .where('participant_evaluation_id', peId)
    .select('questionnaire_type', 'completed_at');

  const startedTypes = allResponses.map(q => q.questionnaire_type);
  const finishedTypes = allResponses
    .filter(q => q.completed_at)
    .map(q => q.questionnaire_type);

  const baseRequired = formType === 'B'
    ? ['intralaboral_b', 'extralaboral', 'estres']
    : ['intralaboral_a', 'extralaboral', 'estres'];

  const integrationMeta = parseIntegrationMeta(integrationMetaRaw);
  const esIntegracion = !!(integrationMeta && integrationMeta.source);
  const requiredQuestionnaires = esIntegracion
    ? ['ficha_datos', ...baseRequired, 'coping']
    : baseRequired;

  const isCompleted = requiredQuestionnaires.every(type => finishedTypes.includes(type));

  const current = await trx('participant_evaluations')
    .where('id', peId)
    .select('status')
    .first();
  if (current && current.status === 'completed') return;

  const updateData = {};
  if (startedTypes.length > 0) updateData.status = 'in_progress';
  if (isCompleted) {
    updateData.status = 'completed';
    updateData.completed_at = new Date();
  }

  if (Object.keys(updateData).length > 0) {
    updateData.updated_at = new Date();
    await trx('participant_evaluations').where('id', peId).update(updateData);
  }
}

router.post(
  '/:evaluationId/preview',
  auth,
  authorize('admin', 'evaluator'),
  (req, res, next) => {
    upload.array('images', 10)(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message });
      next();
    });
  },
  async (req, res) => {
    try {
      const { evaluationId } = req.params;
      const evaluation = await loadEvaluationForUser(evaluationId, req.user.userId, req.user.role);
      if (!evaluation) return res.status(404).json({ error: 'Evaluación no encontrada' });

      const questionnaireType = req.body.questionnaireType;
      const isAuto = questionnaireType === 'auto';
      if (!isAuto && !VALID_TYPES.includes(questionnaireType)) {
        return res.status(400).json({ error: 'questionnaireType inválido' });
      }

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'Debe enviar al menos una imagen.' });
      }

      const participantIdRaw = req.body.participantId;
      let participant = null;
      if (participantIdRaw) {
        participant = await db('participants')
          .where('id', participantIdRaw)
          .where('company_id', evaluation.company_id)
          .first();
        if (!participant) {
          return res.status(404).json({ error: 'Participante no encontrado en esta empresa.' });
        }
      }

      const imageBuffers = req.files.map(f => f.buffer);
      const participantEcho = participant
        ? {
            id: participant.id,
            email: participant.email,
            demographicData: typeof participant.demographic_data === 'string'
              ? JSON.parse(participant.demographic_data)
              : (participant.demographic_data || {}),
          }
        : null;

      if (isAuto) {
        const result = await extractAllQuestionnairesFromSheet(imageBuffers, {
          expectParticipantInfo: !participant,
        });
        return res.json({
          mode: 'auto',
          questionnaireType: 'auto',
          participantId: participant ? participant.id : null,
          participant: participantEcho,
          ...result,
        });
      }

      const result = await extractAnswersFromSheet(imageBuffers, {
        questionnaireType,
        expectParticipantInfo: !participant,
      });

      return res.json({
        mode: 'single',
        questionnaireType,
        participantId: participant ? participant.id : null,
        participant: participantEcho,
        ...result,
      });
    } catch (error) {
      console.error('Photo preview error:', error);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
);

const fichaFieldsJoi = Joi.object(Object.fromEntries(
  FICHA_FIELD_NAMES.map(n => [n, Joi.string().allow('')])
)).unknown(false);

const commitSchema = Joi.alternatives().try(
  Joi.object({
    questionnaireType: Joi.string().valid(...VALID_TYPES).required(),
    participantId: Joi.number().integer().optional(),
    participantInfo: Joi.object({
      documentNumber: Joi.string().allow(''),
      firstName: Joi.string().allow(''),
      lastName: Joi.string().allow(''),
    }).optional(),
    responses: Joi.array().items(Joi.object({
      questionNumber: Joi.number().integer().min(1).required(),
      responseValue: Joi.number().integer().min(0).max(4).required(),
    })).min(1).required(),
  }),
  Joi.object({
    questionnaireType: Joi.string().valid('ficha_datos').required(),
    participantId: Joi.number().integer().optional(),
    participantInfo: Joi.object({
      documentNumber: Joi.string().allow(''),
      firstName: Joi.string().allow(''),
      lastName: Joi.string().allow(''),
    }).optional(),
    fichaDatos: fichaFieldsJoi.required(),
  })
);

router.post(
  '/:evaluationId/commit',
  auth,
  authorize('admin', 'evaluator'),
  async (req, res) => {
    try {
      const { evaluationId } = req.params;
      const evaluation = await loadEvaluationForUser(evaluationId, req.user.userId, req.user.role);
      if (!evaluation) return res.status(404).json({ error: 'Evaluación no encontrada' });

      const { error, value } = commitSchema.validate(req.body);
      if (error) return res.status(400).json({ error: error.details[0].message });

      const { questionnaireType, participantId, participantInfo, responses, fichaDatos } = value;
      const isFicha = questionnaireType === 'ficha_datos';

      if (!participantId && (!participantInfo || !participantInfo.documentNumber)) {
        return res.status(400).json({
          error: 'Se requiere participantId o participantInfo.documentNumber para identificar al participante.',
        });
      }

      const result = await db.transaction(async (trx) => {
        let participant = null;
        if (participantId) {
          participant = await trx('participants')
            .where('id', participantId)
            .where('company_id', evaluation.company_id)
            .first();
          if (!participant) throw new Error('Participante no encontrado en esta empresa.');
        } else {
          const docDigits = String(participantInfo.documentNumber).replace(/\D+/g, '');
          if (!docDigits) throw new Error('El número de documento no es válido.');

          const canonicalEmail = `cc_${docDigits}@temp.com`;
          const legacyEmail = `cc_${docDigits}_c${evaluation.company_id}@temp.com`;

          participant = await trx('participants')
            .where('company_id', evaluation.company_id)
            .whereIn('email', [canonicalEmail, legacyEmail])
            .first();

          if (!participant) {
            let formType = 'A';
            if (isFicha) formType = mapFormTypeFromTipoCargo(fichaDatos.tipoCargo) || 'A';
            else if (questionnaireType === 'intralaboral_b') formType = 'B';
            const baseDemo = {
              firstName: (participantInfo.firstName || 'Participante').trim() || 'Participante',
              lastName: (participantInfo.lastName || docDigits).trim() || docDigits,
              documentType: 'CC',
              documentNumber: docDigits,
              birthYear: 1990,
              gender: 'Otro',
              maritalStatus: 'Soltero(a)',
              educationLevel: '',
              department: '',
              position: '',
              contractType: '',
              employmentType: '',
              tenureMonths: 0,
              salaryRange: '',
              workHoursPerDay: 8,
              workDaysPerWeek: 5,
              formType,
            };
            const demographicData = isFicha ? mergeDemographicFromFicha(baseDemo, fichaDatos) : baseDemo;
            const [inserted] = await trx('participants').insert({
              company_id: evaluation.company_id,
              email: canonicalEmail,
              demographic_data: JSON.stringify(demographicData),
              active: true,
            }).returning('*');
            participant = inserted;
          }
        }

        let pe = await trx('participant_evaluations')
          .where('evaluation_id', evaluation.id)
          .where('participant_id', participant.id)
          .first();

        if (!pe) {
          const [insertedPE] = await trx('participant_evaluations').insert({
            evaluation_id: evaluation.id,
            participant_id: participant.id,
            status: 'in_progress',
            assigned_at: new Date(),
            access_token: crypto.randomBytes(32).toString('hex'),
            token_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          }).returning('*');
          pe = insertedPE;
        }

        if (isFicha) {
          const responseMap = transformFichaToResponseMap(fichaDatos);

          await trx('responses')
            .where('participant_evaluation_id', pe.id)
            .where('questionnaire_type', 'ficha_datos')
            .del();

          await trx('responses').insert({
            participant_evaluation_id: pe.id,
            questionnaire_type: 'ficha_datos',
            responses: JSON.stringify(responseMap),
            completed_at: new Date(),
          });

          const currentDemo = typeof participant.demographic_data === 'string'
            ? JSON.parse(participant.demographic_data)
            : (participant.demographic_data || {});
          const mergedDemo = mergeDemographicFromFicha(currentDemo, fichaDatos);
          await trx('participants')
            .where('id', participant.id)
            .update({ demographic_data: JSON.stringify(mergedDemo) });

          await finalizePeStatus(trx, pe.id, mergedDemo.formType || 'A', pe.integration_metadata);

          return {
            participantId: participant.id,
            participantEvaluationId: pe.id,
            email: participant.email,
            questionnaireType: 'ficha_datos',
            responsesSaved: Object.keys(responseMap).length,
            resultsCalculated: 0,
            demographicUpdated: true,
          };
        }

        const responseMap = {};
        responses.forEach(r => { responseMap[r.questionNumber] = r.responseValue; });

        await trx('responses')
          .where('participant_evaluation_id', pe.id)
          .where('questionnaire_type', questionnaireType)
          .del();

        await trx('responses').insert({
          participant_evaluation_id: pe.id,
          questionnaire_type: questionnaireType,
          responses: JSON.stringify(responseMap),
          completed_at: new Date(),
        });

        const demo = typeof participant.demographic_data === 'string'
          ? JSON.parse(participant.demographic_data)
          : (participant.demographic_data || {});
        const occupationalGroup = occupationalGroupFor(questionnaireType, demo.formType);

        const formatted = responses.map(r => ({
          question_number: r.questionNumber,
          response_value: r.responseValue,
        }));

        const computed = await calculateResults(questionnaireType, formatted, { occupationalGroup });
        const typeResults = computed.map(r => ({
          dimension: r.dimension,
          rawScore: r.rawScore,
          transformedScore: r.transformedScore,
          percentile: r.percentile,
          riskLevel: r.riskLevel,
        }));

        await trx('results')
          .where('participant_evaluation_id', pe.id)
          .where('questionnaire_type', questionnaireType)
          .del();

        await trx('results').insert({
          participant_evaluation_id: pe.id,
          questionnaire_type: questionnaireType,
          results: JSON.stringify(typeResults),
          calculated_at: new Date(),
        });

        await finalizePeStatus(trx, pe.id, demo.formType || (questionnaireType === 'intralaboral_b' ? 'B' : 'A'), pe.integration_metadata);

        return {
          participantId: participant.id,
          participantEvaluationId: pe.id,
          email: participant.email,
          responsesSaved: responses.length,
          resultsCalculated: typeResults.length,
        };
      });

      return res.json({ message: 'Respuestas guardadas correctamente.', ...result });
    } catch (error) {
      console.error('Photo commit error:', error);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
);

const commitMultiSchema = Joi.object({
  participantId: Joi.number().integer().optional(),
  participantInfo: Joi.object({
    documentNumber: Joi.string().allow(''),
    firstName: Joi.string().allow(''),
    lastName: Joi.string().allow(''),
  }).optional(),
  questionnaires: Joi.array().items(Joi.object({
    questionnaireType: Joi.string().valid(...VALID_TYPES).required(),
    responses: Joi.array().items(Joi.object({
      questionNumber: Joi.number().integer().min(1).required(),
      responseValue: Joi.number().integer().min(0).max(4).required(),
    })).min(1).required(),
  })).default([]),
  fichaDatos: fichaFieldsJoi.optional(),
}).or('questionnaires', 'fichaDatos');

router.post(
  '/:evaluationId/commit-multi',
  auth,
  authorize('admin', 'evaluator'),
  async (req, res) => {
    try {
      const { evaluationId } = req.params;
      const evaluation = await loadEvaluationForUser(evaluationId, req.user.userId, req.user.role);
      if (!evaluation) return res.status(404).json({ error: 'Evaluación no encontrada' });

      const { error, value } = commitMultiSchema.validate(req.body);
      if (error) return res.status(400).json({ error: error.details[0].message });

      const { participantId, participantInfo, questionnaires, fichaDatos } = value;

      if (!participantId && (!participantInfo || !participantInfo.documentNumber)) {
        return res.status(400).json({
          error: 'Se requiere participantId o participantInfo.documentNumber.',
        });
      }

      const hasA = questionnaires.some(q => q.questionnaireType === 'intralaboral_a');
      const hasB = questionnaires.some(q => q.questionnaireType === 'intralaboral_b');
      if (hasA && hasB) {
        return res.status(400).json({ error: 'No se puede guardar Forma A y Forma B juntas para el mismo participante.' });
      }

      const fichaFormType = fichaDatos ? mapFormTypeFromTipoCargo(fichaDatos.tipoCargo) : null;
      const resolvedFormType = hasB ? 'B' : hasA ? 'A' : fichaFormType;

      const outcome = await db.transaction(async (trx) => {
        let participant = null;
        if (participantId) {
          participant = await trx('participants')
            .where('id', participantId)
            .where('company_id', evaluation.company_id)
            .first();
          if (!participant) throw new Error('Participante no encontrado en esta empresa.');
        } else {
          const docDigits = String(participantInfo.documentNumber).replace(/\D+/g, '');
          if (!docDigits) throw new Error('El número de documento no es válido.');

          const canonicalEmail = `cc_${docDigits}@temp.com`;
          const legacyEmail = `cc_${docDigits}_c${evaluation.company_id}@temp.com`;

          participant = await trx('participants')
            .where('company_id', evaluation.company_id)
            .whereIn('email', [canonicalEmail, legacyEmail])
            .first();

          if (!participant) {
            const formType = resolvedFormType || 'A';
            const baseDemo = {
              firstName: (participantInfo.firstName || 'Participante').trim() || 'Participante',
              lastName: (participantInfo.lastName || docDigits).trim() || docDigits,
              documentType: 'CC',
              documentNumber: docDigits,
              birthYear: 1990,
              gender: 'Otro',
              maritalStatus: 'Soltero(a)',
              educationLevel: '',
              department: '',
              position: '',
              contractType: '',
              employmentType: '',
              tenureMonths: 0,
              salaryRange: '',
              workHoursPerDay: 8,
              workDaysPerWeek: 5,
              formType,
            };
            const demographicData = fichaDatos ? mergeDemographicFromFicha(baseDemo, fichaDatos) : baseDemo;
            const [inserted] = await trx('participants').insert({
              company_id: evaluation.company_id,
              email: canonicalEmail,
              demographic_data: JSON.stringify(demographicData),
              active: true,
            }).returning('*');
            participant = inserted;
          }
        }

        let pe = await trx('participant_evaluations')
          .where('evaluation_id', evaluation.id)
          .where('participant_id', participant.id)
          .first();

        if (!pe) {
          const [insertedPE] = await trx('participant_evaluations').insert({
            evaluation_id: evaluation.id,
            participant_id: participant.id,
            status: 'in_progress',
            assigned_at: new Date(),
            access_token: crypto.randomBytes(32).toString('hex'),
            token_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          }).returning('*');
          pe = insertedPE;
        }

        let demo = typeof participant.demographic_data === 'string'
          ? JSON.parse(participant.demographic_data)
          : (participant.demographic_data || {});

        if (fichaDatos) {
          demo = mergeDemographicFromFicha(demo, fichaDatos);
          await trx('participants')
            .where('id', participant.id)
            .update({ demographic_data: JSON.stringify(demo) });

          const fichaMap = transformFichaToResponseMap(fichaDatos);
          await trx('responses')
            .where('participant_evaluation_id', pe.id)
            .where('questionnaire_type', 'ficha_datos')
            .del();
          await trx('responses').insert({
            participant_evaluation_id: pe.id,
            questionnaire_type: 'ficha_datos',
            responses: JSON.stringify(fichaMap),
            completed_at: new Date(),
          });
        }

        const effectiveFormType = resolvedFormType || demo.formType || 'A';

        const summary = [];
        if (fichaDatos) {
          summary.push({
            questionnaireType: 'ficha_datos',
            responsesSaved: FICHA_FIELDS.length,
            resultsCalculated: 0,
          });
        }
        for (const q of questionnaires) {
          const { questionnaireType, responses } = q;

          const responseMap = {};
          responses.forEach(r => { responseMap[r.questionNumber] = r.responseValue; });

          await trx('responses')
            .where('participant_evaluation_id', pe.id)
            .where('questionnaire_type', questionnaireType)
            .del();

          await trx('responses').insert({
            participant_evaluation_id: pe.id,
            questionnaire_type: questionnaireType,
            responses: JSON.stringify(responseMap),
            completed_at: new Date(),
          });

          const occupationalGroup = occupationalGroupFor(questionnaireType, effectiveFormType);
          const formatted = responses.map(r => ({
            question_number: r.questionNumber,
            response_value: r.responseValue,
          }));
          const computed = await calculateResults(questionnaireType, formatted, { occupationalGroup });
          const typeResults = computed.map(r => ({
            dimension: r.dimension,
            rawScore: r.rawScore,
            transformedScore: r.transformedScore,
            percentile: r.percentile,
            riskLevel: r.riskLevel,
          }));

          await trx('results')
            .where('participant_evaluation_id', pe.id)
            .where('questionnaire_type', questionnaireType)
            .del();

          await trx('results').insert({
            participant_evaluation_id: pe.id,
            questionnaire_type: questionnaireType,
            results: JSON.stringify(typeResults),
            calculated_at: new Date(),
          });

          summary.push({
            questionnaireType,
            responsesSaved: responses.length,
            resultsCalculated: typeResults.length,
          });
        }

        await finalizePeStatus(trx, pe.id, effectiveFormType, pe.integration_metadata);

        return {
          participantId: participant.id,
          participantEvaluationId: pe.id,
          email: participant.email,
          questionnaires: summary,
        };
      });

      return res.json({ message: 'Cuestionarios guardados correctamente.', ...outcome });
    } catch (error) {
      console.error('Photo commit-multi error:', error);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
);

module.exports = router;
