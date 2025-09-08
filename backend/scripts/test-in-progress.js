#!/usr/bin/env node

const axios = require('axios');

async function testInProgress() {
  try {
    // Login
    const loginResponse = await axios.post('http://localhost:3000/api/auth/login', {
      email: 'admin@brsdigital.com',
      password: 'admin123'
    });

    const token = loginResponse.data.token;

    // Test in_progress filter
    const response = await axios.get('http://localhost:3000/api/participants?status=in_progress', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    console.log('🧪 Test filtro in_progress:');
    console.log(`   Participantes encontrados: ${response.data.participants.length}`);
    
    response.data.participants.forEach(p => {
      console.log(`   - ${p.firstName} ${p.lastName}: ${p.status} (${p.completionPercentage}%)`);
    });

  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testInProgress();