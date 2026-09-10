const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();

app.use(cors());
app.use(express.json());

// TU API KEY PUESTA DIRECTAMENTE AQUÍ
const API_KEY = 'd71e9537dbmsh26bc0ede22ab993p1c0f2fjsn17e6b52c14be';

const apiCliente = axios.create({
  baseURL: 'https://v3.football.api-sports.io',
  headers: {
    'x-rapidapi-key': API_KEY,
    'x-rapidapi-host': 'v3.football.api-sports.io'
  }
});

app.get('/api/partido/directo', async (req, res) => {
  const fixtureId = req.query.id;

  try {
    const endpoint = fixtureId ? '/fixtures/events' : '/fixtures';
    const params = fixtureId ? { fixture: fixtureId } : { live: 'all' };

    const respuesta = await apiCliente.get(endpoint, { params });
    const datosRaw = respuesta.data.response || [];

    if (!fixtureId) {
      const partidosEnVivo = datosRaw.map((item) => ({
        id: item.fixture?.id?.toString(),
        minuto: item.fixture?.status?.elapsed || 0,
        equipoLocal: item.teams?.home?.name,
        escudoLocal: item.teams?.home?.logo,
        equipoVisitante: item.teams?.away?.name,
        escudoVisitante: item.teams?.away?.logo,
        golesLocal: item.goals?.home ?? 0,
        golesVisitante: item.goals?.away ?? 0,
        liga: item.league?.name
      }));

      return res.json({
        status: 'ok',
        tipo: 'lista_en_vivo',
        partidos: partidosEnVivo
      });
    }

    const eventosMapeados = datosRaw.map((e, index) => ({
      id: index.toString(),
      minuto: e.time?.elapsed || 0,
      tiempoAdicional: e.time?.extra || null,
      tipo: e.type?.toLowerCase() || '',
      titulo: e.detail || e.type || '',
      descripcion: `${e.player?.name || ''} (${e.team?.name || ''})`,
      jugador: e.player?.name || '',
      equipo: e.team?.name || '',
      escudoEquipo: e.team?.logo || null
    }));

    res.json({
      status: 'ok',
      tipo: 'eventos_partido',
      eventos: eventosMapeados
    });

  } catch (error) {
    console.error('Error consultando la API:', error.message);
    res.json({
      status: 'error',
      mensaje: 'Error conectando a los partidos',
      eventos: [],
      partidos: []
    });
  }
});

app.get('/', (req, res) => {
  res.send('Servidor activo con API Key lista.');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor en puerto ${PORT}`);
});
