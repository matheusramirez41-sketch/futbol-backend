const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de Middlewares
app.use(cors());
app.use(express.json());

// Claves de API integradas
const RAPIDAPI_KEY = 'd71e9537dbmsh26bc0ede22ab993p1c0f2fjsn17e6b52c14be';
const RAPIDAPI_HOST = 'v3.football.api-sports.io'; // O api-football-v1.p.rapidapi.com

// Base de datos temporal en memoria (Cache)
const cache = {};
const CACHE_DURATION_MS = 3 * 60 * 1000; // 3 minutos

// Ruta base de estado
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'online',
    system: 'Futbol Backend Proxy v1.0',
    timestamp: new Date().toISOString()
  });
});

/**
 * 1. AGENDA DE PARTIDOS POR FECHA (ESPN API)
 * GET /api/agenda?fecha=YYYYMMDD
 */
app.get('/api/agenda', async (req, res) => {
  const { fecha } = req.query;
  
  if (!fecha) {
    return res.status(400).json({ error: 'Debes proporcionar una fecha en formato YYYYMMDD' });
  }

  const cacheKey = `agenda_${fecha}`;
  if (cache[cacheKey] && (Date.now() - cache[cacheKey].timestamp < CACHE_DURATION_MS)) {
    return res.json({ source: 'cache', data: cache[cacheKey].data });
  }

  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard?dates=${fecha}`;
    const response = await axios.get(url);
    
    // Almacenamos en cache la respuesta exitosa
    cache[cacheKey] = {
      timestamp: Date.now(),
      data: response.data
    };

    res.json({ source: 'live', data: response.data });
  } catch (error) {
    console.error('Error al consultar agenda de ESPN:', error.message);
    res.status(500).json({ error: 'No se pudo obtener el calendario de partidos' });
  }
});

/**
 * 2. ALINEACIONES Y COORDENADAS 2D (Sports API / RapidAPI)
 * GET /api/alineaciones?fixtureId=12345
 */
app.get('/api/alineaciones', async (req, res) => {
  const { fixtureId } = req.query;

  if (!fixtureId) {
    return res.status(400).json({ error: 'Debes enviar el ID del partido (fixtureId)' });
  }

  const cacheKey = `alineacion_${fixtureId}`;
  if (cache[cacheKey] && (Date.now() - cache[cacheKey].timestamp < CACHE_DURATION_MS)) {
    return res.json({ source: 'cache', data: cache[cacheKey].data });
  }

  try {
    const response = await axios.get(`https://${RAPIDAPI_HOST}/fixtures/lineups`, {
      params: { fixture: fixtureId },
      headers: {
        'x-rapidapi-key': RAPIDAPI_KEY,
        'x-rapidapi-host': RAPIDAPI_HOST
      }
    });

    cache[cacheKey] = {
      timestamp: Date.now(),
      data: response.data.response
    };

    res.json({ source: 'live', data: response.data.response });
  } catch (error) {
    console.error('Error al consultar Sports API:', error.message);
    res.status(500).json({ error: 'Error al consultar alineaciones y posiciones tácticas' });
  }
});

/**
 * 3. RADIOS EN VIVO (Radio Browser API Proxy)
 * GET /api/radios?pais=Venezuela
 */
app.get('/api/radios', async (req, res) => {
  const pais = req.query.pais || 'Venezuela';
  try {
    const url = `https://de1.api.radio-browser.info/json/stations/bycountry/${encodeURIComponent(pais)}`;
    const response = await axios.get(url);
    
    // Filtrar solo emisoras con tags deportivos o generales
    const radiosDeportivas = response.data.filter(station => 
      station.tags.includes('sports') || 
      station.tags.includes('futbol') || 
      station.tags.includes('news') ||
      station.name.toLowerCase().includes('deporte')
    );

    res.json({ total: radiosDeportivas.length, emisoras: radiosDeportivas });
  } catch (error) {
    console.error('Error al obtener emisoras de radio:', error.message);
    res.status(500).json({ error: 'No se pudieron recuperar las estaciones de radio' });
  }
});

// Inicio del Servidor
app.listen(PORT, () => {
  console.log(`=================================`);
  console.log(`Servidor activo en puerto: ${PORT}`);
  console.log(`Rutas habilitadas: /api/agenda, /api/alineaciones, /api/radios`);
  console.log(`=================================`);
});
      
