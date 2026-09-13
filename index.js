const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();

app.use(cors());
app.use(express.json());

const traducirEstado = (estadoRaw) => {
  if (!estadoRaw) return 'En vivo';
  const e = estadoRaw.toUpperCase();
  if (e.includes('FT') || e.includes('FINAL')) return 'Finalizado';
  if (e.includes('HT') || e.includes('HALFTIME')) return 'Entretiempo';
  if (e.includes('1H')) return '1ª Parte';
  if (e.includes('2H')) return '2ª Parte';
  if (e.includes('SCHEDULED') || e.includes('PRE')) return 'Por empezar';
  return estadoRaw;
};

const formatearLiga = (nombre) => {
  if (!nombre) return 'Liga';
  let limpia = nombre.replace(/\d{4}-\d{2,4}-?/g, '').replace(/-/g, ' ').trim();
  if (limpia.toLowerCase().includes('laliga')) return 'LaLiga EA Sports';
  if (limpia.toLowerCase().includes('premier')) return 'Premier League';
  if (limpia.toLowerCase().includes('champions')) return 'UEFA Champions League';
  return limpia.charAt(0).toUpperCase() + limpia.slice(1);
};

// Endpoint de Partidos en Directo con Narración Completa
app.get('/api/partido/directo', async (req, res) => {
  try {
    const resEspn = await axios.get('https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard?lang=es');
    let listaPartidos = [];

    if (resEspn.status === 200 && resEspn.data?.events) {
      for (const e of resEspn.data.events) {
        const comp = e.competitions?.[0] || {};
        const local = comp.competitors?.find(c => c.homeAway === 'home');
        const visitante = comp.competitors?.find(c => c.homeAway === 'away');

        let hechosDetallados = [];

        try {
          const resDetalle = await axios.get(`https://site.api.espn.com/apis/site/v2/sports/soccer/all/summary?event=${e.id}&lang=es`);
          const plays = resDetalle.data?.commentary || resDetalle.data?.plays || [];

          hechosDetallados = plays.map(p => {
            const texto = p.text || p.description || '';
            let tipoEvento = 'Momento destacable';
            
            if (texto.toLowerCase().includes('tarjeta amarilla')) tipoEvento = 'Tarjeta amarilla';
            else if (texto.toLowerCase().includes('tarjeta roja')) tipoEvento = 'Tarjeta roja';
            else if (texto.toLowerCase().includes('¡gol!') || texto.toLowerCase().includes('gol de')) tipoEvento = 'Gol';
            else if (texto.toLowerCase().includes('descanso') || texto.toLowerCase().includes('final del primer tiempo')) tipoEvento = 'Descanso';
            else if (texto.toLowerCase().includes('resumen')) tipoEvento = 'Resumen';

            return {
              minuto: p.clock?.displayValue || p.time?.displayValue || '•',
              tipo: tipoEvento,
              jugador: p.athletesIn?.[0]?.displayName || p.athlete?.displayName || '',
              equipo: p.team?.displayName || '',
              fotoJugador: p.athletesIn?.[0]?.headshot?.href || p.athlete?.headshot?.href || null,
              comentario: texto
            };
          });
        } catch (err) {
          hechosDetallados = (comp.details || []).map(det => ({
            minuto: det.clock?.displayValue || '•',
            tipo: det.type?.text || 'Incidencia',
            jugador: det.athletesIn?.[0]?.displayName || det.team?.displayName || '',
            equipo: det.team?.displayName || '',
            fotoJugador: det.athletesIn?.[0]?.headshot?.href || null,
            comentario: det.text || `${det.type?.text || 'Evento'} registrado.`
          }));
        }

        listaPartidos.push({
          id: `espn-${e.id}`,
          liga: formatearLiga(e.league?.name || e.season?.slug),
          equipoLocal: local?.team?.displayName || 'Local',
          logoLocal: local?.team?.logo || null,
          golesLocal: String(local?.score ?? '0'),
          equipoVisitante: visitante?.team?.displayName || 'Visitante',
          logoVisitante: visitante?.team?.logo || null,
          golesVisitante: String(visitante?.score ?? '0'),
          minuto: traducirEstado(e.status?.type?.shortDetail || e.status?.type?.detail),
          hechos: hechosDetallados,
          estadisticas: (local?.statistics && visitante?.statistics) ? [
            { statistics: local.statistics.map(s => ({ type: s.label || s.name, value: s.displayValue || s.value })) },
            { statistics: visitante.statistics.map(s => ({ type: s.label || s.name, value: s.displayValue || s.value })) }
          ] : null
        });
      }
    }

    res.json({ status: 'ok', partidos: listaPartidos });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Endpoint de Clasificación
app.get('/api/clasificacion', async (req, res) => {
  try {
    const response = await axios.get('https://site.api.espn.com/apis/v2/sports/soccer/esp.1/standings?lang=es');
    const standings = response.data?.children?.[0]?.standings?.entries || [];

    const tabla = standings.map(entry => {
      const stats = entry.stats || [];
      return {
        pos: stats.find(s => s.name === 'rank')?.value || '•',
        nombre: entry.team?.displayName,
        logo: entry.team?.logos?.[0]?.href || null,
        j: stats.find(s => s.name === 'gamesPlayed')?.value ?? 0,
        dg: stats.find(s => s.name === 'pointDifferential')?.displayValue ?? '0',
        pts: stats.find(s => s.name === 'points')?.value ?? 0
      };
    });

    res.json({ status: 'ok', clasificacion: tabla });
  } catch (error) {
    res.json({ status: 'error', clasificacion: [] });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor activo en puerto ${PORT}`));
