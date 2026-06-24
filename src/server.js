// src/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { testConnection } = require('./Config/connectDatabase');

// Import des routes
const authRoutes = require('./Routes/auth.routes');
const adminRoutes = require('./Routes/admin.routes');

const app = express();
const PORT = process.env.PORT || 4000;

// ==================== MIDDLEWARES ====================

// CORS
app.use(cors({
    origin: process.env.CORS_ORIGINS || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Parser JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logger
app.use((req, res, next) => {
    console.log(`📝 ${req.method} ${req.url}`);
    next();
});

// ==================== ROUTES ====================

// Routes publiques
app.use('/api/auth', authRoutes);

// Routes protégées
app.use('/api/admin', adminRoutes);

// Route de test
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'API Finance Pour Tous est opérationnelle',
        timestamp: new Date().toISOString(),
        env: process.env.NODE_ENV
    });
});

// Route 404
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Route non trouvée'
    });
});

// Middleware de gestion d'erreurs
app.use((err, req, res, next) => {
    console.error('❌ Erreur:', err.message);
    res.status(500).json({
        success: false,
        error: 'Erreur interne du serveur',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// ==================== DÉMARRAGE DU SERVEUR ====================

async function startServer() {
    try {
        // Tester la connexion à la base de données
        const dbConnected = await testConnection();
        
        if (!dbConnected) {
            console.warn('⚠️  Le serveur démarre mais la base de données est inaccessible');
        }

        // Démarrer le serveur
        app.listen(PORT, () => {
            console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
            console.log(`📊 Environnement: ${process.env.NODE_ENV || 'development'}`);
            console.log(`🔗 Base de données: ${dbConnected ? '✅ Connectée' : '❌ Déconnectée'}`);
            console.log(`\n📋 Routes disponibles:`);
            console.log(`\n🔐 Routes publiques:`);
            console.log(`   POST   /api/auth/login`);
            console.log(`   GET    /api/health`);
            console.log(`\n🔒 Routes protégées (Admin):`);
            console.log(`   GET    /api/admin`);
            console.log(`   GET    /api/admin/:id`);
            console.log(`   POST   /api/admin`);
            console.log(`   PUT    /api/admin/:id`);
            console.log(`   DELETE /api/admin/:id`);
            console.log(`   PATCH  /api/admin/:id/status`);
            console.log(`   POST   /api/admin/:id/reset-password`);
            console.log(`\n🔒 Routes protégées (Auth):`);
            console.log(`   POST   /api/auth/logout`);
            console.log(`   POST   /api/auth/refresh-token`);
            console.log(`   POST   /api/auth/change-password`);
            console.log(`   GET    /api/auth/verify-token`);
            console.log(`   GET    /api/auth/profile`);
        });
    } catch (error) {
        console.error('❌ Erreur lors du démarrage du serveur:', error.message);
        process.exit(1);
    }
}

startServer();

// Gestion des arrêts propre
process.on('SIGINT', () => {
    console.log('🛑 Arrêt du serveur...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('🛑 Arrêt du serveur...');
    process.exit(0);
});