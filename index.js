const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();

app.use(cors());
app.use(express.json());

// Convierte la fecha ISO a formato de hora (ej: 03:30 PM)
const formatearHora = (fechaIso) => {
  if (!fechaIso) return 'Por empezar';
  const fecha = new Date(fechaIso);
  return fecha.toLocaleTimeString('es-ES', { 
    hour: '2-digit', 
    minute: '2-digit', 
    hour12: true 
  });
};

const traducirEstado = (estadoRaw, fechaIso) => {
  if (!estadoRaw) return 'En vivo';
  const e = estadoRaw.toUpperCase();
  if (e.includes('FT') || e.includes('FINAL')) return 'Finalizado';
  if (e.includes('HT') || e.includes('HALFTIME')) return 'Entretiempo';
  if (e.includes('1H')) return '1ª Parte';
  if (e.includes('2H')) return '2ª Parte';
  
  if (e.includes('SCHEDULED') || e.includes('PRE') || e.includes('POSTPONED')) {
    return formatearHora(fechaIso);
  }
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
        let alineacionLocal = null;
        let alineacionVisitante = null;

        try {
          const resDetalle = await axios.get(`https://site.api.espn.com/apis/site/v2/sports/soccer/all/summary?event=${e.id}&lang=es`);
          
          // --- NARRACIÓN / EVENTOS ---
          const plays = resDetalle.data?.commentary || resDetalle.data?.plays || [];
          hechosDetallados = plays.map(p => {
            const texto = p.text || p.description || '';
            let tipoEvento = 'Momento destacable';
            
            if (texto.toLowerCase().includes('tarjeta amarilla')) tipoEvento = 'Tarjeta amarilla';
            else if (texto.toLowerCase().includes('tarjeta roja')) tipoEvento = 'Tarjeta roja';
            else if (texto.toLowerCase().includes('¡gol!') || texto.toLowerCase().includes('gol de')) tipoEvento = 'Gol';
            else if (texto.toLowerCase().includes('descanso')) tipoEvento = 'Descanso';

            return {
              minuto: p.clock?.displayValue || p.time?.displayValue || '•',
              tipo: tipoEvento,
              jugador: p.athletesIn?.[0]?.displayName || p.athlete?.displayName || '',
              equipo: p.team?.displayName || '',
              fotoJugador: p.athletesIn?.[0]?.headshot?.href || p.athlete?.headshot?.href || null,
              comentario: texto
            };
          });

          // --- ALINEACIONES ---
          const rosters = resDetalle.data?.rosters || [];
          const rLocal = rosters.find(r => String(r.team?.id) === String(local?.team?.id));
          const rVisitante = rosters.find(r => String(r.team?.id) === String(visitante?.team?.id));

          if (rLocal) {
            alineacionLocal = {
              formacion: rLocal.formation || '',
              titulares: (rLocal.roster || []).filter(j => j.starter).map(j => ({
                nombre: j.athlete?.displayName || '',
                numero: j.jersey || '',
                posicion: j.position?.abbreviation || ''
              })),
              suplentes: (rLocal.roster || []).filter(j => !j.starter).map(j => ({
                nombre: j.athlete?.displayName || '',
                numero: j.jersey || '',
                posicion: j.position?.abbreviation || ''
              }))
            };
          }

          if (rVisitante) {
            alineacionVisitante = {
              formacion: rVisitante.formation || '',
              titulares: (rVisitante.roster || []).filter(j => j.starter).map(j => ({
                nombre: j.athlete?.displayName || '',
                numero: j.jersey || '',
                posicion: j.position?.abbreviation || ''
              })),
              suplentes: (rVisitante.roster || []).filter(j => !j.starter).map(j => ({
                nombre: j.athlete?.displayName || '',
                numero: j.jersey || '',
                posicion: j.position?.abbreviation || ''
              }))
            };
          }

        } catch (err) {
          hechosDetallados = [];
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
          minuto: traducirEstado(e.status?.type?.shortDetail || e.status?.type?.detail, e.date),
          hechos: hechosDetallados,
          alineaciones: {
            local: alineacionLocal,
            visitante: alineacionVisitante
          },
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor activo en puerto ${PORT}`));
  
