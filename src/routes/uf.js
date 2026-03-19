const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/auth');

// Valores UF por grado según Federación de Judo - Año 2026
const LICENSE_UF_VALUES = {
  '6_kyu': 0.31,
  '5_kyu': 0.35,
  '4_kyu': 0.44,
  '3_kyu': 0.50,
  '2_kyu': 0.56,
  '1_kyu': 0.60,
  '1_dan': 0.73,
  '2_dan': 0.94,
  '3_dan': 1.13,
  '4_dan': 1.26,
  '5_dan': 1.89,
  '6_dan': 2.51
};

// Obtener valor UF del día desde mindicador.cl
router.get('/valor', async (req, res) => {
  try {
    // API de mindicador.cl
    const response = await fetch('https://mindicador.cl/api/uf');
    
    if (!response.ok) {
      throw new Error('Error al obtener UF de mindicador.cl');
    }
    
    const data = await response.json();
    
    // mindicador devuelve: { serie: [{ valor: 39841.72, fecha: '2026-03-19' }] }
    const ufValue = data.serie[0].valor;

    res.json({
      success: true,
      uf_value: parseFloat(ufValue),
      date: new Date().toISOString().split('T')[0]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Obtener valores de licencias en pesos chilenos
router.get('/licencias', async (req, res) => {
  try {
    // API de mindicador.cl
    const response = await fetch('https://mindicador.cl/api/uf');
    
    if (!response.ok) {
      throw new Error('Error al obtener UF de mindicador.cl');
    }
    
    const data = await response.json();
    const ufValue = data.serie[0].valor;

    const licenses = {};
    for (const [grade, ufAmount] of Object.entries(LICENSE_UF_VALUES)) {
      licenses[grade] = {
        uf_value: ufAmount,
        clp_value: Math.round(ufAmount * ufValue)
      };
    }

    res.json({
      success: true,
      uf_value: ufValue,
      date: new Date().toISOString().split('T')[0],
      licenses
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Obtener tabla completa de valores UF (admin only)
router.get('/tabla-completa', requireAdmin, async (req, res) => {
  try {
    // API de mindicador.cl
    const response = await fetch('https://mindicador.cl/api/uf');
    
    if (!response.ok) {
      throw new Error('Error al obtener UF de mindicador.cl');
    }
    
    const data = await response.json();
    const ufValue = data.serie[0].valor;

    const tabla = [
      { grado: '6 KYU', uf: 0.31, clp: Math.round(0.31 * ufValue) },
      { grado: '5 KYU', uf: 0.35, clp: Math.round(0.35 * ufValue) },
      { grado: '4 KYU', uf: 0.44, clp: Math.round(0.44 * ufValue) },
      { grado: '3 KYU', uf: 0.50, clp: Math.round(0.50 * ufValue) },
      { grado: '2 KYU', uf: 0.56, clp: Math.round(0.56 * ufValue) },
      { grado: '1 KYU', uf: 0.60, clp: Math.round(0.60 * ufValue) },
      { grado: '1 DAN', uf: 0.73, clp: Math.round(0.73 * ufValue) },
      { grado: '2 DAN', uf: 0.94, clp: Math.round(0.94 * ufValue) },
      { grado: '3 DAN', uf: 1.13, clp: Math.round(1.13 * ufValue) },
      { grado: '4 DAN', uf: 1.26, clp: Math.round(1.26 * ufValue) },
      { grado: '5 DAN', uf: 1.89, clp: Math.round(1.89 * ufValue) },
      { grado: '6 DAN', uf: 2.51, clp: Math.round(2.51 * ufValue) }
    ];

    res.json({
      success: true,
      uf_value: ufValue,
      date: new Date().toISOString().split('T')[0],
      tabla
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
