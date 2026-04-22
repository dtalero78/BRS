const express = require('express');
const router = express.Router();
const multer = require('multer');
const crypto = require('crypto');
const Joi = require('joi');
const { auth, authorize, getOwnedCompanyIds } = require('../middleware/auth');
const db = require('../config/database');
const calculateResults = require('../utils/calculate-results');
const { extractAnswersFromSheet, extractAllQuestionnairesFromSheet, QUESTIONNAIRE_META } = require('../utils/answer-sheet-ocr');

const VALID_TYPES = Object.keys(QUESTIONNAIRE_META);

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
      return res.status(500).json({ error: 'Error al analizar las imágenes: ' + error.message });
    }
  }
);

const commitSchema = Joi.object({
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
});

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

      const { questionnaireType, participantId, participantInfo, responses } = value;

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
            const formType = questionnaireType === 'intralaboral_b' ? 'B' : 'A';
            const demographicData = {
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
      return res.status(500).json({ error: 'Error al guardar respuestas: ' + error.message });
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
  })).min(1).required(),
});

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

      const { participantId, participantInfo, questionnaires } = value;

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

      const resolvedFormType = hasB ? 'B' : hasA ? 'A' : null;

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
            const [inserted] = await trx('participants').insert({
              company_id: evaluation.company_id,
              email: canonicalEmail,
              demographic_data: JSON.stringify({
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
              }),
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

        const demo = typeof participant.demographic_data === 'string'
          ? JSON.parse(participant.demographic_data)
          : (participant.demographic_data || {});
        const effectiveFormType = resolvedFormType || demo.formType || 'A';

        const summary = [];
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
      return res.status(500).json({ error: 'Error al guardar cuestionarios: ' + error.message });
    }
  }
);

module.exports = router;
