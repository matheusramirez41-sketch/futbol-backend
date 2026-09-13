const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();

app.use(cors());
app.use(express.json());

// Tu clave de API-Football recuperada con éxito
const RAPIDAPI_KEY = 'D71e9537dbmsh26bc0ede22ab9p14b609jsn18ae6cfebc32';
const RAPIDAPI_HOST = 'v3.football.api-sports.io';

const headers = {
  'x-rapidapi-key': RAPIDAPI_KEY,
  'x-rapidapi-host': RAPIDAPI_HOST
};

const formatearHora = (fechaIso) => {
  if (!fechaIso) return 'Por empezar';
  const fecha = new Date(fechaIso);
  return fecha.toLocaleTimeString('es-ES', { 
    hour: '2-digit', 
    minute: '2-digit', 
    hour12: true 
  });
};

const traducirEstado = (estadoShort, fechaIso) => {
  if (!estadoShort) return 'En vivo';
  if (['FT', 'AET', 'PEN'].includes(estadoShort)) return 'Finalizado';
  if (['HT'].includes(estadoShort)) return 'Entretiempo';
  if (['1H', '2H', 'ET'].includes(estadoShort)) return estadoShort;
  if (['NS', 'TBD'].includes(estadoShort)) return formatearHora(fechaIso);
  return estadoShort;
};

app.get('/api/partido/directo', async (req, res) => {
  try {
    const hoy = new Date().toISOString().split('T')[0];
    
    const response = await axios.get(`https://v3.football.api-sports.io/fixtures?date=${hoy}`, { headers });
    const fixtures = response.data?.response || [];
    let listaPartidos = [];

    for (const fixture of fixtures) {
      const matchId = fixture.fixture.id;
      const estadoShort = fixture.fixture.status.short;
      const fechaIso = fixture.fixture.date;

      let hechosDetallados = [];
      let alineacionLocal = null;
      let alineacionVisitante = null;

      if (!['NS', 'TBD'].includes(estadoShort)) {
        try {
          // --- EVENTOS / GOLES / TARJETAS ---
          const resEvents = await axios.get(`https://v3.football.api-sports.io/fixtures/events?fixture=${matchId}`, { headers });
          hechosDetallados = (resEvents.data?.response || []).map(ev => ({
            minuto: `${ev.time.elapsed}${ev.time.extra ? '+' + ev.time.extra : ''}`,
            tipo: ev.type === 'Goal' ? 'Gol' : ev.type === 'Card' ? (ev.detail.includes('Yellow') ? 'Tarjeta amarilla' : 'Tarjeta roja') : 'Momento destacable',
            jugador: ev.player?.name || '',
            equipo: ev.team?.name || '',
            fotoJugador: null,
            comentario: `${ev.type}: ${ev.player?.name || ''} (${ev.detail || ''})`
          }));

          // --- ALINEACIONES ---
          const resLineups = await axios.get(`https://v3.football.api-sports.io/fixtures/lineups?fixture=${matchId}`, { headers });
          const lineups = resLineups.data?.response || [];

          const lLocal = lineups.find(l => l.team.id === fixture.teams.home.id);
          const lVisitante = lineups.find(l => l.team.id === fixture.teams.away.id);

          if (lLocal) {
            alineacionLocal = {
              formacion: lLocal.formation || '',
              titulares: (lLocal.startXI || []).map(p => ({
                nombre: p.player.name,
                numero: p.player.number,
                posicion: p.player.pos
              })),
              suplentes: (lLocal.substitutes || []).map(p => ({
                nombre: p.player.name,
                numero: p.player.number,
                posicion: p.player.pos
              }))
            };
          }

          if (lVisitante) {
            alineacionVisitante = {
              formacion: lVisitante.formation || '',
              titulares: (lVisitante.startXI || []).map(p => ({
                nombre: p.player.name,
                numero: p.player.number,
                posicion: p.player.pos
              })),
              suplentes: (lVisitante.substitutes || []).map(p => ({
                nombre: p.player.name,
                numero: p.player.number,
                posicion: p.player.pos
              }))
            };
          }

        } catch (e) {
          // Ignorar si un partido específico falla al traer detalles
        }
      }

      listaPartidos.push({
        id: `api-football-${matchId}`,
        liga: fixture.league?.name || 'Fútbol',
        equipoLocal: fixture.teams.home.name,
        logoLocal: fixture.teams.home.logo,
        golesLocal: String(fixture.goals.home ?? '0'),
        equipoVisitante: fixture.teams.away.name,
        logoVisitante: fixture.teams.away.logo,
        golesVisitante: String(fixture.goals.away ?? '0'),
        minuto: traducirEstado(estadoShort, fechaIso),
        hechos: hechosDetallados,
        alineaciones: {
          local: alineacionLocal,
          visitante: alineacionVisitante
        }
      });
    }

    res.json({ status: 'ok', partidos: listaPartidos });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor activo en puerto ${PORT}`));
                                    
