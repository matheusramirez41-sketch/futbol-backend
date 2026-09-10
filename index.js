const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();

app.use(cors());
app.use(express.json());

// Clave única de RapidAPI para todas tus suscripciones
const RAPIDAPI_KEY = 'd71e9537dbmsh26bc0ede22ab993p1c0f2fjsn17e6b52c14be';

// Función para generar los headers de RapidAPI según cada servicio
const obtenerHeaders = (host) => ({
  'x-rapidapi-key': RAPIDAPI_KEY,
  'x-rapidapi-host': host
});

// 1. ENDPOINT DE PARTIDOS (Combina ESPN + RapidAPI: API-Football, Sofascore, FotMob y Flashscore)
app.get('/api/partido/directo', async (req, res) => {
  const fixtureId = req.query.id;

  try {
    const [resEspn, resApiFootball, resSofascore, resFotmob, resFlashscore] = await Promise.allSettled([
      axios.get('https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard', { timeout: 4000 }),
      axios.get('https://v3.football.api-sports.io/fixtures?live=all', { headers: obtenerHeaders('v3.football.api-sports.io'), timeout: 4000 }),
      axios.get('https://sportapi7.p.rapidapi.com/api/v1/sport/football/events/live', { headers: obtenerHeaders('sportapi7.p.rapidapi.com'), timeout: 4000 }),
      axios.get('https://fotmob-api.p.rapidapi.com/matches/live', { headers: obtenerHeaders('fotmob-api.p.rapidapi.com'), timeout: 4000 }),
      axios.get('https://flashscore-api.p.rapidapi.com/live', { headers: obtenerHeaders('flashscore-api.p.rapidapi.com'), timeout: 4000 })
    ]);

    let listaPartidos = [];

    // Mapear datos de ESPN
    if (resEspn.status === 'fulfilled' && resEspn.value.data?.events) {
      resEspn.value.data.events.forEach(e => {
        const comp = e.competitions?.[0] || {};
        const local = comp.competitors?.find(c => c.homeAway === 'home');
        const visitante = comp.competitors?.find(c => c.homeAway === 'away');
        listaPartidos.push({
          id: `espn-${e.id}`,
          fuente: 'ESPN',
          liga: e.league?.name || 'Fútbol',
          minuto: e.status?.displayClock || '0\'',
          equipoLocal: local?.team?.displayName || 'Local',
          escudoLocal: local?.team?.logo || null,
          golesLocal: local?.score || '0',
          equipoVisitante: visitante?.team?.displayName || 'Visitante',
          escudoVisitante: visitante?.team?.logo || null,
          golesVisitante: visitante?.score || '0'
        });
      });
    }

    // Mapear datos de API-Football
    if (resApiFootball.status === 'fulfilled' && resApiFootball.value.data?.response) {
      resApiFootball.value.data.response.forEach(item => {
        listaPartidos.push({
          id: `af-${item.fixture?.id}`,
          fuente: 'API-Football',
          liga: item.league?.name,
          minuto: item.fixture?.status?.elapsed || 0,
          equipoLocal: item.teams?.home?.name,
          escudoLocal: item.teams?.home?.logo,
          golesLocal: item.goals?.home ?? 0,
          equipoVisitante: item.teams?.away?.name,
          escudoVisitante: item.teams?.away?.logo,
          golesVisitante: item.goals?.away ?? 0
        });
      });
    }

    res.json({
      status: 'ok',
      partidos: listaPartidos,
      eventos: listaPartidos
    });

  } catch (error) {
    console.error('Error unificando las APIs:', error.message);
    res.json({ status: 'error', mensaje: 'Error al consultar proveedores', partidos: [], eventos: [] });
  }
});

// 2. ENDPOINT DE RADIOS (Radio Browser)
app.get('/api/radios', async (req, res) => {
  const busqueda = req.query.q || 'deportes';
  try {
    const resRadio = await axios.get(`https://de1.api.radio-browser.info/json/stations/byname/${encodeURIComponent(busqueda)}?limit=15`);
    const emisoras = resRadio.data.map(st => ({
      id: st.stationuuid,
      nombre: st.name,
      urlStreaming: st.url_resolved || st.url,
      logo: st.favicon || null
    }));
    res.json({ status: 'ok', radios: emisoras });
  } catch (error) {
    res.json({ status: 'error', radios: [] });
  }
});

app.get('/', (req, res) => {
  res.send('Servidor Multi-API RapidAPI Activo');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));
      
