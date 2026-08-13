// server.js
require('dotenv').config();
require('express-async-errors'); // permet d'utiliser des handlers async sans try/catch manuel

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const { checkConnection } = require('./config/db');
const apiRoutes = require('./routes');
const { notFoundHandler, errorHandler } = require('./middlewares/errorHandler');

const app = express();

app.use(helmet());
app.use(cors({ 
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000', 'http://127.0.0.1:3001'],
  credentials: true 
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api', apiRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 4000;

async function start() {
  try {
    await checkConnection();
    app.listen(PORT, () => console.log(`[server] API HDA démarrée sur http://localhost:${PORT}/api`));
  } catch (err) {
    console.error('[server] Échec de démarrage :', err.message);
    process.exit(1);
  }
}

start();

module.exports = app;
