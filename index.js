const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();

app.use(cors());
app.use(express.json());

// Tu API Key real de RapidAPI tomada de tu repositorio
const RAPIDAPI_KEY = 'd71e9537dbmsh26bc0ede22ab9p1...'; // Mantiene la clave de tu archivo

const obtenerHeaders = (host) => ({
  'x-rapidapi-key': RAPIDAPI_KEY,
  'x-rapidapi-host': host
});

app.get('/api/partido/directo', async (req, res) => {
  try {
    const [resEspn, resApiFootball] = await Promise.allSettled([
      axios.get('https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard'),
      axios.get('https://v3.football.api-sports.io/fixtures?live=all', {
        headers: obtenerHeaders('v3.football.api-sports.io')
      })
    ]);

    let listaPartidos = [];

    // 1. Mapeo ESPN
    if (resEspn.status === 'fulfilled' && resEspn.value.data?.events) {
      resEspn.value.data.events.forEach(e => {
        const comp = e.competitions?.[0] || {};
        const local = comp.competitors?.find(c => c.homeAway === 'home');
        const visitante = comp.competitors?.find(c => c.homeAway === 'away');

        listaPartidos.push({
          id: `espn-${e.id}`,
          liga: String(e.league?.name || 'ESPN League'),
          equipoLocal: local?.team?.displayName || 'Local',
          golesLocal: String(local?.score ?? '0'),
          equipoVisitante: visitante?.team?.displayName || 'Visitante',
          golesVisitante: String(visitante?.score ?? '0'),
          minuto: String(e.status?.type?.shortDetail || '0'),
          fuente: 'ESPN',
          estadisticas: null,
          alineaciones: null
        });
      });
    }

    // 2. Mapeo API-Football
    if (resApiFootball.status === 'fulfilled' && resApiFootball.value.data?.response) {
      const partidosAF = resApiFootball.value.data.response;

      for (const item of partidosAF) {
        const fixtureId = item.fixture?.id;

        let estadisticasExtra = null;
        let alineacionesExtra = null;

        if (fixtureId) {
          try {
            const [resStats, resLineups] = await Promise.allSettled([
              axios.get(`https://v3.football.api-sports.io/fixtures/statistics?fixture=${fixtureId}`, {
                headers: obtenerHeaders('v3.football.api-sports.io')
              }),
              axios.get(`https://v3.football.api-sports.io/fixtures/lineups?fixture=${fixtureId}`, {
                headers: obtenerHeaders('v3.football.api-sports.io')
              })
            ]);

            if (resStats.status === 'fulfilled' && resStats.value.data?.response) {
              estadisticasExtra = resStats.value.data.response;
            }

            if (resLineups.status === 'fulfilled' && resLineups.value.data?.response) {
              alineacionesExtra = resLineups.value.data.response;
            }
          } catch (err) {
            console.log(`Error en detalles del fixture ${fixtureId}`);
          }
        }

        listaPartidos.push({
          id: `af-${fixtureId}`,
          liga: String(item.league?.name || 'API-Football'),
          equipoLocal: item.teams?.home?.name || 'Local',
          golesLocal: String(item.goals?.home ?? '0'),
          equipoVisitante: item.teams?.away?.name || 'Visitante',
          golesVisitante: String(item.goals?.away ?? '0'),
          minuto: `${item.fixture?.status?.elapsed || 0}'`,
          fuente: 'API-Football',
          estadisticas: estadisticasExtra,
          alineaciones: alineacionesExtra
        });
      }
    }

    res.json({
      status: 'ok',
      partidos: listaPartidos,
      eventos: listaPartidos,
      data: listaPartidos
    });

  } catch (error) {
    res.json({ status: 'error', partidos: [], error: error.message });
  }
});

app.get('/api/radios', async (req, res) => {
  const busqueda = req.query.q || 'deportes';
  try {
    const resRadio = await axios.get(`https://de1.api.radio-browser.info/json/stations/byname/${busqueda}`);
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
  res.send('Servidor OK');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));
                
