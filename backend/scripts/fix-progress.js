#!/usr/bin/env node
/**
 * Script para diagnosticar y corregir el progreso de participantes
 * Problema: Los participantes muestran 0% aunque han completado cuestionarios
 */

require('dotenv').config();
const knex = require('../config/database');

async function calculateParticipantProgress(participantEvaluationId) {
  try {
    // Obtener el participant_evaluation
    const participantEvaluation = await knex('participant_evaluations')
      .where('id', participantEvaluationId)
      .first();

    if (!participantEvaluation) {
      console.log(`❌ No se encontró participant_evaluation con ID ${participantEvaluationId}`);
      return null;
    }

    // Obtener participant para el form_type
    const participant = await knex('participants')
      .where('id', participantEvaluation.participant_id)
      .first();

    // Obtener demographic_data para determinar el tipo de forma
    let demographicData = {};
    try {
      demographicData = typeof participant.demographic_data === 'string'
        ? JSON.parse(participant.demographic_data)
        : participant.demographic_data || {};
    } catch (e) {
      console.log(`⚠️ Error parseando demographic_data para participante ${participant.id}`);
    }

    const formType = demographicData.formType || 'A';

    // Obtener todas las respuestas del participante
    const responses = await knex('responses')
      .where('participant_evaluation_id', participantEvaluationId);

    // Definir cuestionarios requeridos según el tipo de forma
    const requiredQuestionnaires = {
      'A': ['ficha_datos', 'intralaboral_a', 'extralaboral', 'estres'],
      'B': ['ficha_datos', 'intralaboral_b', 'extralaboral', 'estres']
    };

    const totalQuestionsByType = {
      'ficha_datos': 18,
      'intralaboral_a': 123,
      'intralaboral_b': 97,
      'extralaboral': 31,
      'estres': 31
    };

    const requiredTypes = requiredQuestionnaires[formType];
    const completedTypes = responses.map(r => r.questionnaire_type);
    
    // Calcular progreso real
    let totalCompleted = 0;
    let totalRequired = 0;

    requiredTypes.forEach(type => {
      if (completedTypes.includes(type)) {
        totalCompleted += totalQuestionsByType[type];
      }
      totalRequired += totalQuestionsByType[type];
    });

    const completionPercentage = totalRequired > 0 
      ? Math.round((totalCompleted / totalRequired) * 100) 
      : 0;

    // Determinar status correcto
    let status = participantEvaluation.status;
    if (completionPercentage === 0) {
      status = 'assigned';
    } else if (completionPercentage === 100) {
      status = 'completed';
    } else {
      status = 'in_progress';
    }

    return {
      id: participantEvaluationId,
      participant_id: participant.id,
      name: `${participant.first_name} ${participant.last_name}`,
      formType,
      requiredTypes,
      completedTypes,
      completionPercentage,
      currentStatus: participantEvaluation.status,
      correctStatus: status,
      needsUpdate: participantEvaluation.status !== status
    };
  } catch (error) {
    console.error(`Error calculando progreso para ${participantEvaluationId}:`, error);
    return null;
  }
}

async function fixAllParticipantsProgress() {
  console.log('🔍 Iniciando diagnóstico de progreso de participantes...\n');

  try {
    // Obtener todos los participant_evaluations
    const participantEvaluations = await knex('participant_evaluations')
      .select('id');

    console.log(`📊 Total de participantes en evaluaciones: ${participantEvaluations.length}\n`);

    const results = {
      total: participantEvaluations.length,
      correct: 0,
      updated: 0,
      errors: 0,
      details: []
    };

    for (const pe of participantEvaluations) {
      const progress = await calculateParticipantProgress(pe.id);
      
      if (!progress) {
        results.errors++;
        continue;
      }

      results.details.push(progress);

      if (progress.needsUpdate) {
        console.log(`⚠️ Participante ${progress.name} (ID: ${progress.participant_id}):`);
        console.log(`   Forma: ${progress.formType}`);
        console.log(`   Progreso real: ${progress.completionPercentage}%`);
        console.log(`   Status actual: ${progress.currentStatus} → Debería ser: ${progress.correctStatus}`);
        console.log(`   Cuestionarios completados: ${progress.completedTypes.join(', ') || 'ninguno'}`);
        
        // Actualizar en la base de datos
        const updateData = {
          status: progress.correctStatus,
          updated_at: new Date()
        };

        if (progress.correctStatus === 'completed' && !pe.completed_at) {
          updateData.completed_at = new Date();
        }

        await knex('participant_evaluations')
          .where('id', pe.id)
          .update(updateData);

        console.log(`   ✅ Actualizado\n`);
        results.updated++;
      } else {
        results.correct++;
      }
    }

    // Resumen
    console.log('\n📋 RESUMEN DEL DIAGNÓSTICO:');
    console.log('═══════════════════════════════════════');
    console.log(`Total participantes analizados: ${results.total}`);
    console.log(`✅ Correctos: ${results.correct}`);
    console.log(`🔄 Actualizados: ${results.updated}`);
    console.log(`❌ Errores: ${results.errors}`);

    // Estadísticas de progreso
    const progressStats = results.details.reduce((acc, detail) => {
      const range = detail.completionPercentage === 0 ? '0%' :
                   detail.completionPercentage === 100 ? '100%' :
                   `${Math.floor(detail.completionPercentage / 25) * 25}-${Math.floor(detail.completionPercentage / 25) * 25 + 24}%`;
      
      acc[range] = (acc[range] || 0) + 1;
      return acc;
    }, {});

    console.log('\n📊 DISTRIBUCIÓN DE PROGRESO:');
    console.log('═══════════════════════════════════════');
    Object.entries(progressStats).sort().forEach(([range, count]) => {
      console.log(`${range}: ${count} participantes`);
    });

    // Actualizar vista del frontend
    console.log('\n💡 NOTA: Los cambios se reflejarán automáticamente en el frontend');
    console.log('   URL: https://automatic-fiesta-v4x7g75pq7wfw999-3000.app.github.dev/evaluator/participants');

  } catch (error) {
    console.error('❌ Error durante el diagnóstico:', error);
  } finally {
    await knex.destroy();
  }
}

// Ejecutar el script
fixAllParticipantsProgress()
  .then(() => {
    console.log('\n✨ Diagnóstico completado');
    process.exit(0);
  })
  .catch(error => {
    console.error('Error fatal:', error);
    process.exit(1);
  });