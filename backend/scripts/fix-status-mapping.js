#!/usr/bin/env node
/**
 * Script para actualizar estados de participantes y agregar in_progress
 */

require('dotenv').config();
const knex = require('../config/database');

async function updateParticipantStatuses() {
  console.log('🔄 Actualizando estados de participantes...\n');

  try {
    // Obtener todos los participant_evaluations
    const participantEvaluations = await knex('participant_evaluations')
      .select('id', 'participant_id', 'status');

    console.log(`📊 Total participant_evaluations: ${participantEvaluations.length}\n`);

    const results = {
      total: participantEvaluations.length,
      assigned: 0,
      in_progress: 0,
      completed: 0,
      updated: 0
    };

    for (const pe of participantEvaluations) {
      // Obtener participante para determinar tipo de forma
      const participant = await knex('participants')
        .where('id', pe.participant_id)
        .first();

      if (!participant) {
        console.log(`⚠️ Participante ${pe.participant_id} no encontrado`);
        continue;
      }

      // Obtener demographic_data para el tipo de forma
      let demographicData = {};
      try {
        demographicData = typeof participant.demographic_data === 'string'
          ? JSON.parse(participant.demographic_data)
          : participant.demographic_data || {};
      } catch (e) {
        console.log(`⚠️ Error parseando demographic_data para participante ${participant.id}`);
      }

      const formType = demographicData.formType || 'A';

      // Obtener respuestas
      const responses = await knex('responses')
        .where('participant_evaluation_id', pe.id);

      // Definir cuestionarios requeridos
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
      
      // Calcular progreso
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

      // Determinar el estado correcto
      let correctStatus;
      if (completionPercentage === 0) {
        correctStatus = 'assigned';
        results.assigned++;
      } else if (completionPercentage === 100) {
        correctStatus = 'completed';
        results.completed++;
      } else {
        correctStatus = 'in_progress';
        results.in_progress++;
      }

      // Actualizar si es necesario
      if (pe.status !== correctStatus) {
        const updateData = {
          status: correctStatus,
          updated_at: new Date()
        };

        if (correctStatus === 'completed') {
          updateData.completed_at = new Date();
        }

        await knex('participant_evaluations')
          .where('id', pe.id)
          .update(updateData);

        console.log(`✅ Participante ${participant.first_name} ${participant.last_name}:`);
        console.log(`   ${pe.status} → ${correctStatus} (${completionPercentage}% completado)`);
        results.updated++;
      }
    }

    console.log('\n📋 RESUMEN:');
    console.log('═══════════════════════');
    console.log(`Total procesados: ${results.total}`);
    console.log(`📝 Asignados (assigned): ${results.assigned}`);
    console.log(`⏳ En progreso (in_progress): ${results.in_progress}`);
    console.log(`✅ Completados (completed): ${results.completed}`);
    console.log(`🔄 Actualizados: ${results.updated}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await knex.destroy();
  }
}

// Ejecutar el script
updateParticipantStatuses()
  .then(() => {
    console.log('\n✨ Actualización completada');
    process.exit(0);
  })
  .catch(error => {
    console.error('Error fatal:', error);
    process.exit(1);
  });