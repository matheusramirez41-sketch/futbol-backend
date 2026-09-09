const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || 'd71e9537dbmsh26bc0ede22ab993p1c0f2fjsn17e6b52c14be';

// Endpoint principal para listar partidos
app.get('/api/partidos', async (req, res) => {
  try {
    const response = await axios.get(
      'https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard',
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );

    const events = response.data?.events || [];
    const partidos = events.map((event) => {
      const comp = event.competitions[0];
      const home = comp.competitors.find(c => c.homeAway === 'home') || comp.competitors[0];
      const away = comp.competitors.find(c => c.homeAway === 'away') || comp.competitors[1];

      return {
        id: event.id,
        homeName: home.team.shortDisplayName || home.team.name,
        homeLogo: home.team.logo || '',
        homeScore: home.score || '0',
        awayName: away.team.shortDisplayName || away.team.name,
        awayLogo: away.team.logo || '',
        awayScore: away.score || '0',
        status: event.status.type.shortDetail || 'Programado',
      };
    });

    res.json({ success: true, matches: partidos });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error cargando partidos desde el servidor' });
  }
});

app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));
           
