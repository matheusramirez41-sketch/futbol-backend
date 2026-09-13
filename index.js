const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();

app.use(cors());
app.use(express.json());

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || 'd71e9537dbmsh26bc0ede22ab9p1...'; // Tu clave aquí

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

    // 1. MAPEO ESPN (Incluye Logos, Hechos/Eventos y Alineaciones sin gastar créditos)
    if (resEspn.status === 'fulfilled' && resEspn.value.data?.events) {
      resEspn.value.data.events.forEach(e => {
        const comp = e.competitions?.[0] || {};
        const local = comp.competitors?.find(c => c.homeAway === 'home');
        const visitante = comp.competitors?.find(c => c.homeAway === 'away');

        // Mapear hechos/eventos (goles, tarjetas, etc.)
        const hechos = (comp.details || []).map(det => ({
          minuto: det.clock?.displayValue || '',
          tipo: det.type?.text || 'Evento',
          jugador: det.athletesIn?.[0]?.displayName || det.team?.displayName || '',
          equipo: det.team?.displayName || ''
        }));

        // Mapear alineaciones si están disponibles en ESPN
        const alineaciones = comp.competitors?.map(c => ({
          team: { name: c.team?.displayName, logo: c.team?.logo },
          formation: c.formation || 'N/A',
          startXI: (c.roster || []).map(p => ({
            player: {
              name: p.athlete?.displayName,
              number: p.jersey,
              pos: p.position?.abbreviation
            }
          }))
        }));

        listaPartidos.push({
          id: `espn-${e.id}`,
          liga: String(e.league?.name || e.season?.slug || 'ESPN League'),
          equipoLocal: local?.team?.displayName || 'Local',
          logoLocal: local?.team?.logo || null,
          golesLocal: String(local?.score ?? '0'),
          equipoVisitante: visitante?.team?.displayName || 'Visitante',
          logoVisitante: visitante?.team?.logo || null,
          golesVisitante: String(visitante?.score ?? '0'),
          minuto: String(e.status?.type?.shortDetail || '0'),
          fuente: 'ESPN',
          hechos: hechos,
          estadisticas: comp.statistics || null,
          alineaciones: alineaciones.some(a => a.startXI.length > 0) ? alineaciones : null
        });
      });
    }

    // 2. MAPEO API-FOOTBALL (Optimizado para no saturar la API)
    if (resApiFootball.status === 'fulfilled' && resApiFootball.value.data?.response) {
      const partidosAF = resApiFootball.value.data.response;

      partidosAF.forEach(item => {
        const fixtureId = item.fixture?.id;

        // Extraer hechos/eventos si la API los incluye directamente
        const hechos = (item.events || []).map(ev => ({
          minuto: `${ev.time?.elapsed || ''}'`,
          tipo: ev.type || 'Evento',
          jugador: ev.player?.name || '',
          equipo: ev.team?.name || ''
        }));

        listaPartidos.push({
          id: `af-${fixtureId}`,
          liga: String(item.league?.name || 'API-Football'),
          equipoLocal: item.teams?.home?.name || 'Local',
          logoLocal: item.teams?.home?.logo || null,
          golesLocal: String(item.goals?.home ?? '0'),
          equipoVisitante: item.teams?.away?.name || 'Visitante',
          logoVisitante: item.teams?.away?.logo || null,
          golesVisitante: String(item.goals?.away ?? '0'),
          minuto: `${item.fixture?.status?.elapsed || 0}'`,
          fuente: 'API-Football',
          hechos: hechos,
          estadisticas: null,
          alineaciones: null
        });
      });
    }

    res.json({
      status: 'ok',
      partidos: listaPartidos
    });

  } catch (error) {
    console.error('Error en el servidor:', error);
    res.status(500).json({ status: 'error', message: 'Error interno del servidor' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
    
    
