const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();

app.use(cors());
app.use(express.json());

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || 'd71e9537dbmsh26bc0ede22ab9p14b609jsn18ae6cfebc32';

const obtenerHeaders = (host) => ({
  'x-rapidapi-key': RAPIDAPI_KEY,
  'x-rapidapi-host': host
});

// Función auxiliar para traducir el estado del partido
const traducirEstado = (estadoRaw) => {
  if (!estadoRaw) return 'En vivo';
  const e = estadoRaw.toUpperCase();
  if (e.includes('FT') || e.includes('FINAL')) return 'Finalizado';
  if (e.includes('HT') || e.includes('HALFTIME')) return 'Entretiempo';
  if (e.includes('1H')) return '1ª Parte';
  if (e.includes('2H')) return '2ª Parte';
  if (e.includes('POSTPONED')) return 'Aplazado';
  if (e.includes('CANCELLED')) return 'Cancelado';
  if (e.includes('SCHEDULED') || e.includes('PRE')) return 'Por empezar';
  return estadoRaw;
};

// Función para formatear el nombre de la liga
const formatearLiga = (nombre) => {
  if (!nombre) return 'Liga';
  let limpia = nombre.replace(/\d{4}-\d{2,4}-?/g, '').replace(/-/g, ' ').trim();
  if (limpia.toLowerCase().includes('laliga')) return 'LaLiga EA Sports';
  if (limpia.toLowerCase().includes('premier')) return 'Premier League';
  if (limpia.toLowerCase().includes('champions')) return 'UEFA Champions League';
  return limpia.charAt(0).toUpperCase() + limpia.slice(1);
};

// Endpoint de Partidos en Directo
app.get('/api/partido/directo', async (req, res) => {
  try {
    const [resEspn, resApiFootball] = await Promise.allSettled([
      // Se añade lang=es para solicitar respuestas en español
      axios.get('https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard?lang=es'),
      axios.get('https://v3.football.api-sports.io/fixtures?live=all', {
        headers: obtenerHeaders('v3.football.api-sports.io')
      })
    ]);

    let listaPartidos = [];

    if (resEspn.status === 'fulfilled' && resEspn.value.data?.events) {
      resEspn.value.data.events.forEach(e => {
        const comp = e.competitions?.[0] || {};
        const local = comp.competitors?.find(c => c.homeAway === 'home');
        const visitante = comp.competitors?.find(c => c.homeAway === 'away');

        const hechos = (comp.details || []).map(det => ({
          minuto: det.clock?.displayValue || '•',
          tipo: det.type?.text || 'Incidencia',
          jugador: det.athletesIn?.[0]?.displayName || det.team?.displayName || '',
          equipo: det.team?.displayName || '',
          fotoJugador: det.athletesIn?.[0]?.headshot?.href || null,
          comentario: det.text || `${det.type?.text || 'Evento'} registrado en el partido.`
        }));

        const minDetalle = e.status?.type?.shortDetail || e.status?.type?.detail || '';

        listaPartidos.push({
          id: `espn-${e.id}`,
          liga: formatearLiga(e.league?.name || e.season?.slug),
          equipoLocal: local?.team?.displayName || 'Local',
          logoLocal: local?.team?.logo || null,
          golesLocal: String(local?.score ?? '0'),
          equipoVisitante: visitante?.team?.displayName || 'Visitante',
          logoVisitante: visitante?.team?.logo || null,
          golesVisitante: String(visitante?.score ?? '0'),
          minuto: traducirEstado(minDetalle),
          fuente: 'ESPN',
          hechos: hechos,
          estadisticas: (local?.statistics && visitante?.statistics) ? [
            { statistics: local.statistics.map(s => ({ type: s.label || s.name, value: s.displayValue || s.value })) },
            { statistics: visitante.statistics.map(s => ({ type: s.label || s.name, value: s.displayValue || s.value })) }
          ] : null
        });
      });
    }

    if (resApiFootball.status === 'fulfilled' && resApiFootball.value.data?.response) {
      resApiFootball.value.data.response.forEach(item => {
        const fixtureId = item.fixture?.id;
        const hechos = (item.events || []).map(ev => ({
          minuto: `${ev.time?.elapsed || ''}'`,
          tipo: ev.type || 'Evento',
          jugador: ev.player?.name || '',
          equipo: ev.team?.name || '',
          fotoJugador: null,
          comentario: `${ev.type} de ${ev.player?.name || 'jugador'} (${ev.team?.name || ''})`
        }));

        const estadoShort = item.fixture?.status?.short;

        listaPartidos.push({
          id: `af-${fixtureId}`,
          liga: formatearLiga(item.league?.name),
          equipoLocal: item.teams?.home?.name || 'Local',
          logoLocal: item.teams?.home?.logo || null,
          golesLocal: String(item.goals?.home ?? '0'),
          equipoVisitante: item.teams?.away?.name || 'Visitante',
          logoVisitante: item.teams?.away?.logo || null,
          golesVisitante: String(item.goals?.away ?? '0'),
          minuto: traducirEstado(estadoShort) === 'En vivo' ? `${item.fixture?.status?.elapsed || 0}'` : traducirEstado(estadoShort),
          fuente: 'API-Football',
          hechos: hechos,
          estadisticas: null
        });
      });
    }

    res.json({ status: 'ok', partidos: listaPartidos });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Endpoint para la Tabla de Clasificación Real
app.get('/api/clasificacion', async (req, res) => {
  try {
    const response = await axios.get('https://site.api.espn.com/apis/v2/sports/soccer/esp.1/standings?lang=es');
    const standings = response.data?.children?.[0]?.standings?.entries || [];

    const tabla = standings.map(entry => {
      const stats = entry.stats || [];
      const j = stats.find(s => s.name === 'gamesPlayed')?.value ?? 0;
      const dg = stats.find(s => s.name === 'pointDifferential')?.displayValue ?? '0';
      const pts = stats.find(s => s.name === 'points')?.value ?? 0;

      return {
        pos: entry.stats?.find(s => s.name === 'rank')?.value || '•',
        nombre: entry.team?.displayName,
        logo: entry.team?.logos?.[0]?.href || null,
        j: j,
        dg: dg,
        pts: pts
      };
    });

    res.json({ status: 'ok', clasificacion: tabla });
  } catch (error) {
    res.json({ status: 'error', clasificacion: [] });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor activo en puerto ${PORT}`));
  
