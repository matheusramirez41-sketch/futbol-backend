const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();

app.use(cors());
app.use(express.json());

const RAPIDAPI_KEY = 'd71e9537dbmsh26bc0ede22ab993p1c0f2fjsn17e6b52c14be';

const obtenerHeaders = (host) => ({
  'x-rapidapi-key': RAPIDAPI_KEY,
  'x-rapidapi-host': host
});

app.get('/api/partido/directo', async (req, res) => {
  try {
    const [resEspn, resApiFootball] = await Promise.allSettled([
      axios.get('https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard', { timeout: 5000 }),
      axios.get('https://v3.football.api-sports.io/fixtures?live=all', { headers: obtenerHeaders('v3.football.api-sports.io'), timeout: 5000 })
    ]);

    let listaPartidos = [];

    // Mapeo ESPN
    if (resEspn.status === 'fulfilled' && resEspn.value.data?.events) {
      resEspn.value.data.events.forEach(e => {
        const comp = e.competitions?.[0] || {};
        const local = comp.competitors?.find(c => c.homeAway === 'home');
        const visitante = comp.competitors?.find(c => c.homeAway === 'away');

        const nomLocal = local?.team?.displayName || 'Local';
        const nomVisitante = visitante?.team?.displayName || 'Visitante';
        const gLocal = String(local?.score ?? '0');
        const gVisitante = String(visitante?.score ?? '0');
        const min = String(e.status?.displayClock || e.status?.type?.detail || 'En vivo');
        const nomLiga = String(e.league?.name || 'Fútbol');

        // Formato con marcador incluido en el nombre
        const textoPartido = `${nomLocal} ${gLocal} - ${gVisitante} ${nomVisitante} (${min})`;

        listaPartidos.push({
          id: `espn-${e.id}`,
          liga: nomLiga,
          league: nomLiga,
          title: nomLiga,
          name: textoPartido,
          descripcion: textoPartido,
          equipoLocal: nomLocal,
          golesLocal: gLocal,
          equipoVisitante: nomVisitante,
          golesVisitante: gVisitante,
          minuto: min,
          fuente: 'ESPN'
        });
      });
    }

    // Mapeo API-Football
    if (resApiFootball.status === 'fulfilled' && resApiFootball.value.data?.response) {
      resApiFootball.value.data.response.forEach(item => {
        const nomLocal = item.teams?.home?.name || 'Local';
        const nomVisitante = item.teams?.away?.name || 'Visitante';
        const gLocal = String(item.goals?.home ?? 0);
        const gVisitante = String(item.goals?.away ?? 0);
        const min = `${item.fixture?.status?.elapsed || 0}'`;
        const nomLiga = String(item.league?.name || 'Fútbol');

        const textoPartido = `${nomLocal} ${gLocal} - ${gVisitante} ${nomVisitante} (${min})`;

        listaPartidos.push({
          id: `af-${item.fixture?.id}`,
          liga: nomLiga,
          league: nomLiga,
          title: nomLiga,
          name: textoPartido,
          descripcion: textoPartido,
          equipoLocal: nomLocal,
          golesLocal: gLocal,
          equipoVisitante: nomVisitante,
          golesVisitante: gVisitante,
          minuto: min,
          fuente: 'API-Football'
        });
      });
    }

    res.json({
      status: 'ok',
      partidos: listaPartidos,
      eventos: listaPartidos,
      data: listaPartidos
    });

  } catch (error) {
    res.json({ status: 'error', partidos: [], eventos: [], data: [] });
  }
});

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
  res.send('Servidor OK');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));
    
