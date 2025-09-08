#!/usr/bin/env node
/**
 * Script para probar el endpoint /api/participants con diferentes filtros
 */

require('dotenv').config();
const axios = require('axios');

const BASE_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const API_URL = `${BASE_URL}/api`;

// Token de prueba (debes ajustar esto con un token válido)
let authToken = null;

async function login() {
  try {
    console.log('🔐 Iniciando sesión...');
    
    // Intenta hacer login con credenciales de prueba
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      email: 'admin@brsdigital.com', // Usuario admin existente
      password: 'admin123'
    });

    authToken = loginResponse.data.token;
    console.log('✅ Login exitoso');
    return true;
  } catch (error) {
    console.log('❌ Error en login:', error.response?.data?.error || error.message);
    console.log('💡 Asegúrate de tener un usuario válido en la base de datos');
    return false;
  }
}

async function testEndpoint(description, endpoint, expectedMessage = '') {
  try {
    console.log(`\n🧪 ${description}`);
    console.log(`   GET ${endpoint}`);
    
    const response = await axios.get(`${API_URL}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    const participants = response.data.participants || [];
    console.log(`   ✅ Respuesta: ${participants.length} participantes`);
    
    if (expectedMessage) {
      console.log(`   💬 ${expectedMessage}`);
    }

    // Mostrar detalles de algunos participantes
    if (participants.length > 0) {
      console.log('   📋 Participantes encontrados:');
      participants.slice(0, 3).forEach((p, index) => {
        console.log(`      ${index + 1}. ${p.firstName} ${p.lastName} - Eval: ${p.evaluationName || 'N/A'} - Status: ${p.status}`);
      });
      if (participants.length > 3) {
        console.log(`      ... y ${participants.length - 3} más`);
      }
    }

    return response.data;
  } catch (error) {
    console.log(`   ❌ Error: ${error.response?.status} - ${error.response?.data?.error || error.message}`);
    return null;
  }
}

async function runTests() {
  console.log('🚀 Probando endpoint /api/participants');
  console.log('═══════════════════════════════════════\n');

  // Intentar login
  const loginSuccess = await login();
  if (!loginSuccess) {
    console.log('\n❌ No se pudo hacer login. Abortando pruebas.');
    return;
  }

  // Obtener evaluaciones disponibles primero
  let evaluations = [];
  try {
    const evalResponse = await axios.get(`${API_URL}/evaluations`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    evaluations = evalResponse.data.evaluations || [];
    console.log(`\n📋 Evaluaciones disponibles: ${evaluations.length}`);
    evaluations.forEach(e => {
      console.log(`   - ID: ${e.id} | Nombre: ${e.name} | Participantes: ${e.totalParticipants || 0}`);
    });
  } catch (error) {
    console.log('⚠️ No se pudieron obtener evaluaciones');
  }

  // Test 1: Obtener todos los participantes
  await testEndpoint(
    'Test 1: Todos los participantes',
    '/participants',
    'Debe mostrar TODOS los participantes de la empresa'
  );

  // Test 2: Filtrar por evaluación (si hay evaluaciones disponibles)
  if (evaluations.length > 0) {
    const firstEvaluation = evaluations[0];
    await testEndpoint(
      `Test 2: Filtrar por evaluación (ID: ${firstEvaluation.id})`,
      `/participants?evaluationId=${firstEvaluation.id}`,
      `Solo debe mostrar participantes de "${firstEvaluation.name}"`
    );

    // Test con segunda evaluación si existe
    if (evaluations.length > 1) {
      const secondEvaluation = evaluations[1];
      await testEndpoint(
        `Test 3: Filtrar por evaluación (ID: ${secondEvaluation.id})`,
        `/participants?evaluationId=${secondEvaluation.id}`,
        `Solo debe mostrar participantes de "${secondEvaluation.name}"`
      );
    }
  }

  // Test 4: Filtrar por status
  await testEndpoint(
    'Test 4: Filtrar por status "completed"',
    '/participants?status=completed',
    'Solo debe mostrar participantes completados'
  );

  await testEndpoint(
    'Test 5: Filtrar por status "assigned"',
    '/participants?status=assigned',
    'Solo debe mostrar participantes asignados'
  );

  // Test 6: Combinar filtros
  if (evaluations.length > 0) {
    await testEndpoint(
      'Test 6: Combinar filtros (evaluationId + status)',
      `/participants?evaluationId=${evaluations[0].id}&status=completed`,
      'Participantes completados de la primera evaluación'
    );
  }

  // Test 7: Paginación
  await testEndpoint(
    'Test 7: Paginación (página 1, límite 2)',
    '/participants?page=1&limit=2',
    'Solo debe mostrar 2 participantes máximo'
  );

  console.log('\n✨ Pruebas completadas');
  console.log('\n💡 Revisa los logs del servidor para ver el SQL generado');
  console.log('📱 También prueba manualmente en: https://automatic-fiesta-v4x7g75pq7wfw999-3000.app.github.dev/evaluator/participants');
}

// Ejecutar las pruebas
runTests()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error('Error fatal:', error);
    process.exit(1);
  });