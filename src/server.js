require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { connectDatabase } = require('./Config/connectDatabase');

// Import des routes
const authRoutes = require('./Routes/authRoutes');
const roomRoutes = require('./Routes/roomRoutes');
const reservationRoutes = require('./Routes/reservationRoutes');

const app = express();
const PORT = process.env.PORT || 4000;

// ============================================
// MIDDLEWARES - SOLUTION ULTIME
// ============================================

// CORS
app.use(cors());

// ⚠️⚠️⚠️ SOLUTION ULTIME - Middleware manuel pour parser le JSON ⚠️⚠️⚠️
app.use((req, res, next) => {
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    let body = '';
    
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        if (body) {
          req.body = JSON.parse(body);
          console.log('✅ Body parsé manuellement:', req.body);
        } else {
          req.body = {};
          console.log('⚠️ Body vide');
        }
        next();
      } catch (error) {
        console.error('❌ Erreur de parsing JSON:', error);
        return res.status(400).json({
          success: false,
          message: 'JSON invalide',
          error: error.message
        });
      }
    });
  } else {
    next();
  }
});

// Logging des requêtes
app.use((req, res, next) => {
  console.log(`📡 ${req.method} ${req.url}`);
  if (req.body) {
    console.log('📥 Body:', req.body);
  }
  next();
});

// ============================================
// ROUTES
// ============================================
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/reservations', reservationRoutes);

// ============================================
// ROUTE DE TEST
// ============================================
app.post('/api/test-body', (req, res) => {
  console.log('🧪 Test body reçu:', req.body);
  res.json({
    success: true,
    message: 'Body reçu avec succès !',
    data: req.body
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'API HDA est en ligne',
    timestamp: new Date().toISOString()
  });
});

// ============================================
// GESTION DES ERREURS
// ============================================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route non trouvée'
  });
});

app.use((err, req, res, next) => {
  console.error('❌ Erreur:', err);
  res.status(500).json({
    success: false,
    message: 'Erreur interne du serveur',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ============================================
// DÉMARRAGE
// ============================================
const startServer = async () => {
  try {
    await connectDatabase();
    app.listen(PORT, () => {
      console.log('='.repeat(50));
      console.log(`🚀 Serveur démarré sur le port ${PORT}`);
      console.log(`🌐 http://localhost:${PORT}`);
      console.log(`🧪 Test body: http://localhost:${PORT}/api/test-body`);
      console.log('='.repeat(50));
    });
  } catch (error) {
    console.error('❌ Erreur de démarrage:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;