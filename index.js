const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Endpoint de prueba
app.get('/', (req, res) => {
  res.json({ mensaje: 'Servidor futbol-backend activo y listo 🚀' });
});

// Endpoint para consultar partidos por fecha usando ESPN
app.get('/api/partidos', async (req, res) => {
  const fecha = req.query.fecha || '20260910'; // Formato YYYYMMDD
  try {
    const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard?dates=${fecha}`);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener partidos' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
