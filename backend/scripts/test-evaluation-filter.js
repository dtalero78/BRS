#!/usr/bin/env node
/**
 * Script para probar el filtro de evaluaciones en el endpoint participants
 */

require('dotenv').config();
const knex = require('../config/database');

async function testEvaluationFilter() {
  console.log('🔍 Probando filtro de evaluaciones...\n');

  try {
    // Obtener todas las evaluaciones disponibles
    const evaluations = await knex('evaluations')
      .select('id', 'name', 'company_id');

    console.log('📋 EVALUACIONES DISPONIBLES:');
    console.log('══════════════════════════════');
    evaluations.forEach(eval => {
      console.log(`- ID: ${eval.id} | Nombre: ${eval.name} | Empresa: ${eval.company_id}`);
    });

    if (evaluations.length === 0) {
      console.log('❌ No hay evaluaciones en la base de datos');
      return;
    }

    console.log('\n📊 PARTICIPANTES POR EVALUACIÓN:');
    console.log('═══════════════════════════════════════');

    for (const evaluation of evaluations) {
      // Contar participantes en esta evaluación (usando el mismo query que el endpoint)
      const participantsCount = await knex('participants')
        .join('participant_evaluations as pe', 'participants.id', 'pe.participant_id')
        .join('evaluations', 'pe.evaluation_id', 'evaluations.id')
        .where('pe.evaluation_id', evaluation.id)
        .count('* as count');

      const count = participantsCount[0].count;

      console.log(`\n🔹 Evaluación: "${evaluation.name}" (ID: ${evaluation.id})`);
      console.log(`   Participantes: ${count}`);

      if (count > 0) {
        // Mostrar detalles de los participantes
        const participants = await knex('participants')
          .join('participant_evaluations as pe', 'participants.id', 'pe.participant_id')
          .join('evaluations', 'pe.evaluation_id', 'evaluations.id')
          .where('pe.evaluation_id', evaluation.id)
          .select(
            'participants.id',
            'participants.email',
            'participants.demographic_data',
            'pe.status',
            'pe.assigned_at'
          );

        participants.forEach((p, index) => {
          let name = 'N/A';
          try {
            const demographicData = typeof p.demographic_data === 'string' 
              ? JSON.parse(p.demographic_data) 
              : (p.demographic_data || {});
            name = `${demographicData.firstName || 'N/A'} ${demographicData.lastName || 'N/A'}`;
          } catch (e) {
            // Ignore parsing errors
          }

          console.log(`   ${index + 1}. ${name} (${p.email}) - Status: ${p.status}`);
        });
      }
    }

    console.log('\n🧪 SIMULANDO LLAMADA AL ENDPOINT:');
    console.log('═══════════════════════════════════════');

    if (evaluations.length > 0) {
      const testEvaluationId = evaluations[0].id;
      console.log(`\nProbando filtro con evaluationId=${testEvaluationId}:`);

      // Simular el query del endpoint
      const joinType = 'join'; // Porque estamos filtrando por evaluationId
      const filteredParticipants = await knex('participants')
        [joinType]('participant_evaluations as pe', 'participants.id', 'pe.participant_id')
        [joinType]('evaluations', 'pe.evaluation_id', 'evaluations.id')
        .where('pe.evaluation_id', testEvaluationId)
        .select(
          'participants.*',
          'evaluations.name as evaluation_name',
          'evaluations.id as evaluation_id',
          'pe.status as evaluation_status'
        );

      console.log(`\n✅ Resultado del filtro:`);
      console.log(`   Participantes encontrados: ${filteredParticipants.length}`);
      
      filteredParticipants.forEach((p, index) => {
        let name = 'N/A';
        try {
          const demographicData = typeof p.demographic_data === 'string' 
            ? JSON.parse(p.demographic_data) 
            : (p.demographic_data || {});
          name = `${demographicData.firstName || 'N/A'} ${demographicData.lastName || 'N/A'}`;
        } catch (e) {
          // Ignore parsing errors
        }

        console.log(`   ${index + 1}. ${name} - Evaluación: ${p.evaluation_name} - Status: ${p.evaluation_status}`);
      });

      console.log(`\n🌐 URL de prueba:`);
      console.log(`   GET /api/participants?evaluationId=${testEvaluationId}`);
    }

  } catch (error) {
    console.error('❌ Error durante la prueba:', error);
  } finally {
    await knex.destroy();
  }
}

// Ejecutar el test
testEvaluationFilter()
  .then(() => {
    console.log('\n✨ Test completado');
    process.exit(0);
  })
  .catch(error => {
    console.error('Error fatal:', error);
    process.exit(1);
  });