const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const scrapingRoutes = require('../routes/scraping');

function createApp({ basePath = '/api/scraping' } = {}) {
  const app = express();

  // Segurança
  app.use(helmet());

  // CORS amplo (ajuste conforme necessário em produção)
  app.use(cors());

  // Logs
  app.use(morgan('combined'));

  // Body parsers
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Health
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development'
    });
  });

  // Rotas de scraping com base configurável
  app.use(basePath, scrapingRoutes);

  // 404
  app.use((req, res) => {
    res.status(404).json({
      error: 'Endpoint não encontrado',
      path: req.originalUrl,
      method: req.method
    });
  });

  // Error handler
  app.use((err, req, res, next) => {
    console.error('Erro na API:', err);
    res.status(err.status || 500).json({
      error: 'Erro interno do servidor',
      message: process.env.NODE_ENV === 'development' ? err.message : 'Algo deu errado',
      timestamp: new Date().toISOString()
    });
  });

  return app;
}

module.exports = { createApp };

