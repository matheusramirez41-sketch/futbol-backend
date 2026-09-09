const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;

app.get('/api/partidos', async (req, res) => {
  try {
    const response = await axios.get(
      'https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard'
    );

    const events = response.data.events || [];

    const matches = events.map((e) => {
      const comp = e.competitions[0];
      const home = comp.competitors.find((c) => c.homeAway === 'home');
      const away = comp.competitors.find((c) => c.homeAway === 'away');

      return {
        id: e.id,
        homeName: home?.team?.shortDisplayName || home?.team?.name || 'Local',
        homeLogo: home?.team?.logo || '',
        homeScore: home?.score || '0',
        awayName: away?.team?.shortDisplayName || away?.team?.name || 'Visitante',
        awayLogo: away?.team?.logo || '',
        awayScore: away?.score || '0',
        status: e.status?.type?.shortDetail || 'Programado',
      };
    });

    res.json({ success: true, matches });
  } catch (error) {
    console.error('Error en el proxy:', error.message);
    res.status(500).json({ success: false, error: 'Error al obtener datos' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
