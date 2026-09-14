const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();

app.use(cors());
app.use(express.json());

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || 'd71e9537dbmsh26bc0ede22ab9p1';

// Función para formatear horas a horario local (12h)
const formatearHora = (fechaISO) => {
  if (!fechaISO) return 'Por definir';
  const fecha = new Date(fechaISO);
  return fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: true });
};

// 1. PARTIDOS EN DIRECTO Y AGENDA POR FECHA (ESPN + Escudos enriquecidos)
app.get('/api/partido/directo', async (req, res) => {
  try {
    const fechaParam = req.query.fecha; // Formato YYYYMMDD opcional
    const url = fechaParam 
      ? `https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard?dates=${fechaParam}`
      : 'https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard';

    const response = await axios.get(url);
    const eventos = response.data?.events || [];
    let listaPartidos = [];

    for (const evento of eventos) {
      const competencia = evento.competitions?.[0] || {};
      const id = evento.id;
      const estadoInfo = competencia.status?.type || {};
      const esEnVivo = estadoInfo.state === 'in';
      const esFuturo = estadoInfo.state === 'pre';

      const competitors = competencia.competitors || [];
      const local = competitors.find(c => c.homeAway === 'home') || competitors[0] || {};
      const visitante = competitors.find(c => c.homeAway === 'away') || competitors[1] || {};

      // Si no ha empezado, mostramos la hora asignada
      let tiempoDisplay = 'Programado';
      if (esEnVivo) {
        tiempoDisplay = estadoInfo.detail || 'En Vivo';
      } else if (esFuturo) {
        tiempoDisplay = formatearHora(evento.date);
      } else {
        tiempoDisplay = 'Finalizado';
      }

      listaPartidos.push({
        id: `espn-${id}`,
        liga: evento.leagues?.[0]?.name || 'Fútbol',
        equipoLocal: local.team?.displayName || 'Local',
        logoLocal: local.team?.logo || 'https://media.api-sports.io/football/teams/default.png',
        golesLocal: String(local.score ?? '0'),
        equipoVisitante: visitante.team?.displayName || 'Visitante',
        logoVisitante: visitante.team?.logo || 'https://media.api-sports.io/football/teams/default.png',
        golesVisitante: String(visitante.score ?? '0'),
        estado: estadoInfo.state, // 'pre', 'in', 'post'
        minutoDisplay: tiempoDisplay,
        minutoTranscurrido: estadoInfo.clock || 0,
        fechaInicioISO: evento.date
      });
    }

    res.json({ status: 'ok', partidos: listaPartidos });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 2. DETALLE "SUPER DIRECTO" (Jugada a jugada hasta el evento más mínimo)
app.get('/api/partido/detalle/:id', async (req, res) => {
  try {
    const id = req.params.id.replace('espn-', '');
    const response = await axios.get(`https://site.api.espn.com/apis/site/v2/sports/soccer/all/summary?event=${id}`);
    
    const comentariosData = response.data?.commentary || [];
    let comentariosDirecto = comentariosData.map(jugada => ({
      minuto: jugada.time?.displayValue ? `${jugada.time.displayValue}'` : '',
      comentario: jugada.text || 'Acción en campo',
      tipo: jugada.type?.text || 'Incidencia',
      equipo: jugada.team?.displayName || null
    }));

    res.json({ status: 'ok', directo: comentariosDirecto });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 3. FUENTES COMPLEMENTARIAS (FotMob / RapidAPI para respaldo de escudos/datos)
app.get('/api/fuente/fotmob', async (req, res) => {
  try {
    const response = await axios.get('https://fotmob-api.p.rapidapi.com/matches/live', {
      headers: {
        'x-rapidapi-key': RAPIDAPI_KEY,
        'x-rapidapi-host': 'fotmob-api.p.rapidapi.com'
      }
    });
    res.json({ status: 'ok', datos: response.data });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor activo en puerto ${PORT}`));
      
