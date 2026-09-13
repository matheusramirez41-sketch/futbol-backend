const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/partido/directo', async (req, res) => {
  try {
    const response = await axios.get('https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard');
    const eventos = response.data?.events || [];
    
    let listaPartidos = [];

    for (const evento of eventos) {
      const competencia = evento.competitions?.[0] || {};
      const id = evento.id;
      const ligaInfo = evento.leagues?.[0] || evento.season || {};
      const nombreLiga = ligaInfo.name || evento.name || 'Fútbol';
      const estadoDetalle = competencia.status?.type?.detail || 'En vivo';

      const competitors = competencia.competitors || [];
      const local = competitors.find(c => c.homeAway === 'home') || competitors[0] || {};
      const visitante = competitors.find(c => c.homeAway === 'away') || competitors[1] || {};

      let hechosDetallados = [];
      let estadisticasLocal = [];
      let estadisticasVisitante = [];

      // 1. Extrayendo jugadas, goles, tarjetas y comentarios detallados
      if (competencia.details && Array.isArray(competencia.details)) {
        hechosDetallados = competencia.details.map(det => ({
          minuto: det.clock?.displayValue ? `${det.clock.displayValue}'` : (det.time?.elapsed ? `${det.time.elapsed}'` : ''),
          tipo: det.type?.text || det.qualifiers?.[0] || 'Momento destacable',
          jugador: det.athletesInvolved?.[0]?.displayName || det.player?.name || '',
          equipo: det.team?.displayName || '',
          fotoJugador: det.athletesInvolved?.[0]?.headshot || null,
          comentario: det.text || det.headline || ''
        }));
      }

      // 2. Extrayendo estadísticas del partido (posesión, tiros al arco, faltas, etc.)
      if (competencia.situation && competencia.situation.statistics) {
        // Algunas estructuras de ESPN devuelven estadísticas aquí
      }
      
      // Si la competencia trae un resumen por equipos con estadísticas completas
      if (competitors.length > 0) {
        if (local.statistics && Array.isArray(local.statistics)) {
          estadisticasLocal = local.statistics.map(stat => ({
            nombre: stat.name || stat.label,
            valor: stat.displayValue || stat.value
          }));
        }
        if (visitante.statistics && Array.isArray(visitante.statistics)) {
          estadisticasVisitante = visitante.statistics.map(stat => ({
            nombre: stat.name || stat.label,
            valor: stat.displayValue || stat.value
          }));
        }
      }

      // 3. Extrayendo alineaciones completas (titulares y suplentes)
      let alineacionLocalData = null;
      let alineacionVisitanteData = null;

      if (competencia.rosters && Array.isArray(competencia.rosters)) {
        const rLocal = competencia.rosters.find(r => r.team?.id === local.team?.id);
        const rVisitante = competencia.rosters.find(r => r.team?.id === visitante.team?.id);

        if (rLocal) {
          alineacionLocalData = {
            formacion: rLocal.formation || '4-3-3',
            titulares: (rLocal.roster || []).filter(p => p.starter).map(p => ({
              nombre: p.athlete?.displayName || '',
              numero: p.jersey || '',
              posicion: p.position?.abbreviation || ''
            })),
            suplentes: (rLocal.roster || []).filter(p => !p.starter).map(p => ({
              nombre: p.athlete?.displayName || '',
              numero: p.jersey || '',
              posicion: p.position?.abbreviation || ''
            }))
          };
        }

        if (rVisitante) {
          alineacionVisitanteData = {
            formacion: rVisitante.formation || '4-3-3',
            titulares: (rVisitante.roster || []).filter(p => p.starter).map(p => ({
              nombre: p.athlete?.displayName || '',
              numero: p.jersey || '',
              posicion: p.position?.abbreviation || ''
            })),
            suplentes: (rVisitante.roster || []).filter(p => !p.starter).map(p => ({
              nombre: p.athlete?.displayName || '',
              numero: p.jersey || '',
              posicion: p.position?.abbreviation || ''
            }))
          };
        }
      }

      listaPartidos.push({
        id: `espn-${id}`,
        liga: nombreLiga,
        equipoLocal: local.team?.displayName || 'Local',
        logoLocal: local.team?.logo || '',
        golesLocal: String(local.score ?? '0'),
        equipoVisitante: visitante.team?.displayName || 'Visitante',
        logoVisitante: visitante.team?.logo || '',
        golesVisitante: String(visitante.score ?? '0'),
        minuto: estadoDetalle,
        hechos: hechosDetallados,
        estadisticas: {
          local: estadisticasLocal,
          visitante: estadisticasVisitante
        },
        alineaciones: {
          local: alineacionLocalData,
          visitante: alineacionVisitanteData
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
