const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const db = require('../config/database');
const { BAREMOS_BRS } = require('../utils/baremos-completos');
const fs = require('fs');
const path = require('path');

// Load questionnaires data into system config
router.post('/load-questionnaires', auth, authorize('admin'), async (req, res) => {
  try {
    // Load questionnaires data from JSON file
    const dataPath = path.join(__dirname, '../../bateria_riesgo_psicosocial_preguntas.json');
    const rawData = fs.readFileSync(dataPath, 'utf8');
    const questionnairesData = JSON.parse(rawData);

    // Update system config
    await db('system_configs')
      .where('config_key', 'cuestionarios_data')
      .update({
        config_value: JSON.stringify(questionnairesData),
        updated_at: new Date()
      });

    res.json({ 
      message: 'Datos de cuestionarios cargados exitosamente',
      loaded: {
        formaA: questionnairesData.cuestionarios?.forma_a_intralaboral?.total_preguntas || 0,
        formaB: questionnairesData.cuestionarios?.forma_b_intralaboral?.total_preguntas || 0,
        extralaboral: questionnairesData.cuestionarios?.extralaboral?.total_preguntas || 0,
        estres: questionnairesData.cuestionarios?.estres?.total_preguntas || 0
      }
    });

  } catch (error) {
    console.error('Load questionnaires error:', error);
    res.status(500).json({ error: 'Error cargando datos de cuestionarios' });
  }
});

// Load OFFICIAL BRS baremos data - COMPLETO
router.post('/load-baremos', auth, authorize('admin'), async (req, res) => {
  try {
    console.log('Cargando baremos oficiales BRS...');

    // Update system configs with OFFICIAL BRS BAREMOS
    await db.transaction(async (trx) => {
      // BAREMOS INTRALABORALES FORMA A
      await trx('system_configs')
        .where('config_key', 'baremos_intralaboral_forma_a')
        .update({
          config_value: JSON.stringify(BAREMOS_BRS.intralaboral_forma_a),
          updated_at: new Date()
        });

      // BAREMOS INTRALABORALES FORMA B  
      await trx('system_configs')
        .where('config_key', 'baremos_intralaboral_forma_b')
        .update({
          config_value: JSON.stringify(BAREMOS_BRS.intralaboral_forma_b),
          updated_at: new Date()
        });

      // BAREMOS EXTRALABORALES
      await trx('system_configs')
        .where('config_key', 'baremos_extralaboral')
        .update({
          config_value: JSON.stringify(BAREMOS_BRS.extralaboral),
          updated_at: new Date()
        });

      // BAREMOS ESTRÉS
      await trx('system_configs')
        .where('config_key', 'baremos_estres')
        .update({
          config_value: JSON.stringify(BAREMOS_BRS.estres),
          updated_at: new Date()
        });

      // PUNTAJES TOTALES GENERALES
      await trx('system_configs')
        .where('config_key', 'baremos_puntaje_total')
        .update({
          config_value: JSON.stringify(BAREMOS_BRS.puntaje_total_general),
          updated_at: new Date()
        });

      // Create missing configs if they don't exist
      const configsToCreate = [
        'baremos_intralaboral_forma_a',
        'baremos_intralaboral_forma_b',
        'baremos_extralaboral',
        'baremos_estres',
        'baremos_puntaje_total'
      ];

      for (const configKey of configsToCreate) {
        const exists = await trx('system_configs').where('config_key', configKey).first();
        if (!exists) {
          let configValue;
          switch (configKey) {
            case 'baremos_intralaboral_forma_a':
              configValue = BAREMOS_BRS.intralaboral_forma_a;
              break;
            case 'baremos_intralaboral_forma_b':
              configValue = BAREMOS_BRS.intralaboral_forma_b;
              break;
            case 'baremos_extralaboral':
              configValue = BAREMOS_BRS.extralaboral;
              break;
            case 'baremos_estres':
              configValue = BAREMOS_BRS.estres;
              break;
            case 'baremos_puntaje_total':
              configValue = BAREMOS_BRS.puntaje_total_general;
              break;
          }

          await trx('system_configs').insert({
            config_key: configKey,
            config_value: JSON.stringify(configValue),
            description: `Baremos oficiales BRS para ${configKey}`,
            updated_at: new Date()
          });
        }
      }
    });

    res.json({ 
      message: 'Baremos oficiales BRS cargados exitosamente',
      loaded: {
        forma_a_dimensiones: Object.keys(BAREMOS_BRS.intralaboral_forma_a.dimensiones).length,
        forma_a_dominios: Object.keys(BAREMOS_BRS.intralaboral_forma_a.dominios).length,
        forma_b_dimensiones: Object.keys(BAREMOS_BRS.intralaboral_forma_b.dimensiones).length,
        forma_b_dominios: Object.keys(BAREMOS_BRS.intralaboral_forma_b.dominios).length,
        extralaboral_dimensiones: Object.keys(BAREMOS_BRS.extralaboral.dimensiones).length,
        estres_categorias: Object.keys(BAREMOS_BRS.estres).length,
        puntajes_totales: Object.keys(BAREMOS_BRS.puntaje_total_general).length
      },
      details: {
        forma_a_dimensiones: Object.keys(BAREMOS_BRS.intralaboral_forma_a.dimensiones),
        forma_b_dimensiones: Object.keys(BAREMOS_BRS.intralaboral_forma_b.dimensiones),
        extralaboral_dimensiones: Object.keys(BAREMOS_BRS.extralaboral.dimensiones),
        estres_categorias: Object.keys(BAREMOS_BRS.estres)
      }
    });

  } catch (error) {
    console.error('Load baremos error:', error);
    res.status(500).json({ error: 'Error cargando baremos: ' + error.message });
  }
});

// Get system configuration
router.get('/config/:configKey', auth, async (req, res) => {
  try {
    const { configKey } = req.params;

    const config = await db('system_configs')
      .where('config_key', configKey)
      .first();

    if (!config) {
      return res.status(404).json({ error: 'Configuración no encontrada' });
    }

    res.json({
      key: config.config_key,
      value: config.config_value,
      description: config.description,
      updatedAt: config.updated_at
    });

  } catch (error) {
    console.error('Get system config error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Get all system configurations
router.get('/config', auth, authorize('admin'), async (req, res) => {
  try {
    const configs = await db('system_configs')
      .select('*')
      .orderBy('config_key');

    res.json({
      configs: configs.map(config => ({
        key: config.config_key,
        description: config.description,
        updatedAt: config.updated_at,
        hasValue: !!config.config_value,
        valueSize: config.config_value ? config.config_value.length : 0
      }))
    });

  } catch (error) {
    console.error('Get system configs error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Get BRS baremos summary
router.get('/baremos-summary', auth, async (req, res) => {
  try {
    const summary = {
      oficial_brs: {
        intralaboral_forma_a: {
          dimensiones: Object.keys(BAREMOS_BRS.intralaboral_forma_a.dimensiones).length,
          dominios: Object.keys(BAREMOS_BRS.intralaboral_forma_a.dominios).length,
          dimensiones_lista: Object.keys(BAREMOS_BRS.intralaboral_forma_a.dimensiones)
        },
        intralaboral_forma_b: {
          dimensiones: Object.keys(BAREMOS_BRS.intralaboral_forma_b.dimensiones).length,
          dominios: Object.keys(BAREMOS_BRS.intralaboral_forma_b.dominios).length,
          dimensiones_lista: Object.keys(BAREMOS_BRS.intralaboral_forma_b.dimensiones)
        },
        extralaboral: {
          dimensiones: Object.keys(BAREMOS_BRS.extralaboral.dimensiones).length,
          dimensiones_lista: Object.keys(BAREMOS_BRS.extralaboral.dimensiones)
        },
        estres: {
          categorias: Object.keys(BAREMOS_BRS.estres).length,
          categorias_lista: Object.keys(BAREMOS_BRS.estres)
        }
      },
      niveles_riesgo: ['sin_riesgo', 'riesgo_bajo', 'riesgo_medio', 'riesgo_alto', 'riesgo_muy_alto']
    };

    res.json(summary);

  } catch (error) {
    console.error('Get baremos summary error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Get specific baremos for a dimension
router.get('/baremos/:forma/:tipo/:dimension', auth, async (req, res) => {
  try {
    const { forma, tipo, dimension } = req.params;

    // Validate parameters
    if (!['A', 'B'].includes(forma.toUpperCase())) {
      return res.status(400).json({ error: 'Forma debe ser A o B' });
    }

    if (!['dimension', 'dominio', 'total'].includes(tipo)) {
      return res.status(400).json({ error: 'Tipo debe ser dimension, dominio o total' });
    }

    const formaKey = `intralaboral_forma_${forma.toLowerCase()}`;
    
    let baremos;
    
    if (tipo === 'dimension') {
      baremos = BAREMOS_BRS[formaKey]?.dimensiones?.[dimension];
    } else if (tipo === 'dominio') {
      baremos = BAREMOS_BRS[formaKey]?.dominios?.[dimension];
    } else if (tipo === 'total') {
      baremos = BAREMOS_BRS[formaKey]?.puntaje_total;
    }

    if (!baremos) {
      return res.status(404).json({ error: 'Baremos no encontrados' });
    }

    res.json({
      forma,
      tipo,
      dimension,
      baremos,
      niveles: {
        sin_riesgo: `${baremos.sin_riesgo[0]} - ${baremos.sin_riesgo[1]}`,
        riesgo_bajo: `${baremos.riesgo_bajo[0]} - ${baremos.riesgo_bajo[1]}`,
        riesgo_medio: `${baremos.riesgo_medio[0]} - ${baremos.riesgo_medio[1]}`,
        riesgo_alto: `${baremos.riesgo_alto[0]} - ${baremos.riesgo_alto[1]}`,
        riesgo_muy_alto: `${baremos.riesgo_muy_alto[0]} - ${baremos.riesgo_muy_alto[1]}`
      }
    });

  } catch (error) {
    console.error('Get specific baremos error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Test calculation with sample data
router.post('/test-calculation', auth, async (req, res) => {
  try {
    const { forma, responses } = req.body;

    if (!forma || !responses) {
      return res.status(400).json({ error: 'Se requiere forma y responses' });
    }

    // Import calculate function
    const calculateResults = require('../utils/calculate-results');
    
    const questionnaireType = forma === 'A' ? 'intralaboral_a' : 'intralaboral_b';
    
    // Test calculation
    const results = await calculateResults(questionnaireType, responses);

    res.json({
      message: 'Cálculo de prueba realizado exitosamente',
      questionnaireType,
      totalResults: results.length,
      results: results.map(result => ({
        dimension: result.dimension,
        domain: result.domain,
        rawScore: result.rawScore,
        transformedScore: result.transformedScore,
        percentile: result.percentile,
        riskLevel: result.riskLevel,
        isDomainTotal: result.isDomainTotal || false
      }))
    });

  } catch (error) {
    console.error('Test calculation error:', error);
    res.status(500).json({ error: 'Error en cálculo de prueba: ' + error.message });
  }
});

// Get system health check
router.get('/health', async (req, res) => {
  try {
    // Check database connection
    await db.raw('SELECT 1');

    // Check if required configs exist
    const requiredConfigs = [
      'cuestionarios_data', 
      'baremos_intralaboral_forma_a', 
      'baremos_intralaboral_forma_b',
      'baremos_extralaboral', 
      'baremos_estres'
    ];
    
    const configChecks = await Promise.all(
      requiredConfigs.map(async (key) => {
        const config = await db('system_configs').where('config_key', key).first();
        return {
          key,
          exists: !!config,
          hasValue: !!(config && config.config_value),
          size: config?.config_value ? config.config_value.length : 0
        };
      })
    );

    const allConfigsValid = configChecks.every(check => check.exists && check.hasValue);

    res.json({
      status: allConfigsValid ? 'OK' : 'WARNING',
      database: 'Connected',
      timestamp: new Date().toISOString(),
      configs: configChecks,
      brs_baremos: {
        forma_a_loaded: !!BAREMOS_BRS.intralaboral_forma_a,
        forma_b_loaded: !!BAREMOS_BRS.intralaboral_forma_b,
        extralaboral_loaded: !!BAREMOS_BRS.extralaboral,
        estres_loaded: !!BAREMOS_BRS.estres
      }
    });

  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      status: 'ERROR',
      database: 'Disconnected',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

module.exports = router;