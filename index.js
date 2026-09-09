const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;

// 1. Endpoint principal: Partidos agrupados por liga y por fecha
app.get('/api/partidos', async (req, res) => {
  try {
    const { fecha } = req.query; 
    let url = 'https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard';
    
    if (fecha) {
      url += `?dates=${fecha}`;
    }

    const response = await axios.get(url);
    const events = response.data.events || [];

    // Agrupar los partidos por liga / competición
    const leaguesMap = {};

    events.forEach((e) => {
      const comp = e.competitions[0];
      const leagueName = e.league?.name || comp?.league?.name || 'Otras Ligas';
      const home = comp.competitors.find((c) => c.homeAway === 'home');
      const away = comp.competitors.find((c) => c.homeAway === 'away');

      const matchData = {
        id: e.id,
        homeName: home?.team?.shortDisplayName || home?.team?.name || 'Local',
        homeLogo: home?.team?.logo || '',
        homeScore: home?.score || '0',
        awayName: away?.team?.shortDisplayName || away?.team?.name || 'Visitante',
        awayLogo: away?.team?.logo || '',
        awayScore: away?.score || '0',
        status: e.status?.type?.shortDetail || e.status?.type?.detail || 'Programado',
      };

      if (!leaguesMap[leagueName]) {
        leaguesMap[leagueName] = [];
      }
      leaguesMap[leagueName].push(matchData);
    });

    const leagues = Object.keys(leaguesMap).map((leagueName) => ({
      name: leagueName,
      matches: leaguesMap[leagueName],
    }));

    res.json({ success: true, leagues });
  } catch (error) {
    console.error('Error en /api/partidos:', error.message);
    res.status(500).json({ success: false, error: 'Error al obtener partidos' });
  }
});

// 2. Endpoint secundario: Detalle completo de un partido por ID
app.get('/api/partido/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const response = await axios.get(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/all/summary?event=${id}`
    );
    res.json({ success: true, data: response.data });
  } catch (error) {
    console.error('Error en /api/partido/:id:', error.message);
    res.status(500).json({ success: false, error: 'Error al obtener detalle del partido' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
