const serverless = require('serverless-http');
const { createApp } = require('../server/app');

// No Vercel, o caminho da função é '/api/scraping'.
// Montamos as rotas no root '/' para que '/start', '/status/:jobId', etc. funcionem sob '/api/scraping'.
const app = createApp({ basePath: '/' });

module.exports = serverless(app);

