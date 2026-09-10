const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();

app.use(cors());
app.use(express.json());

// Tu API Key de RapidAPI configurada directamente
const API_KEY = process.env.API_KEY || 'd71e9537dbmsh26bc0ede22ab993p1c0f2fjsn17e6b52c14be';

const apiCliente = axios.create({
  baseURL: 'https://v3.football.api-sports.io',
  headers: {
    'x-rapidapi-key': API_KEY,
    'x-rapidapi-host': 'v3.football.api-sports.io'
  }
});

// Ruta para eventos en vivo
app.get('/api/partido/directo', async (req, res) => {
  const fixtureId = req.query.id;

  if (!fixtureId) {
    return res.json({ status: 'error', mensaje: 'Falta el ID del partido', eventos: [] });
  }

  try {
    const [resEventos, resStats, resAlineaciones] = await Promise.allSettled([
      apiCliente.get('/fixtures/events', { params: { fixture: fixtureId } }),
      apiCliente.get('/fixtures/statistics', { params: { fixture: fixtureId } }),
      apiCliente.get('/fixtures/lineups', { params: { fixture: fixtureId } })
    ]);

    const eventosRaw = resEventos.status === 'fulfilled' ? resEventos.value.data.response : [];
    const statsRaw = resStats.status === 'fulfilled' ? resStats.value.data.response : [];
    const alineacionesRaw = resAlineaciones.status === 'fulfilled' ? resAlineaciones.value.data.response : [];

    const eventosMapeados = Array.isArray(eventosRaw) ? eventosRaw.map((e, index) => ({
      id: index.toString(),
      minuto: e.time?.elapsed || 0,
      tiempoAdicional: e.time?.extra || null,
      tipo: e.type?.toLowerCase() || '',
      titulo: e.detail || e.type || '',
      descripcion: `${e.player?.name || ''} (${e.team?.name || ''})`,
      jugador: e.player?.name || '',
      equipo: e.team?.name || '',
      escudoEquipo: e.team?.logo || null
    })) : [];

    res.json({
      status: 'ok',
      eventos: eventosMapeados,
      estadisticas: statsRaw,
      alineaciones: alineacionesRaw
    });

  } catch (error) {
    console.error('Error al consultar la API:', error.message);
    res.json({
      status: 'error',
      mensaje: 'Error procesando datos',
      eventos: []
    });
  }
});

app.get('/', (req, res) => {
  res.send('Backend de Fútbol funcionando con RapidAPI.');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});

      
