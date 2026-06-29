require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { testConnection } = require('./Config/connectDatabase');

// Import des routes
const authRoutes = require('./Routes/auth.routes');
const adminRoutes = require('./Routes/admin.routes');
const roomRoutes = require('./Routes/room.routes');
const roomTypeRoutes = require('./Routes/roomType.routes');
const reservationRoutes = require('./Routes/reservation.routes');
const clientRoutes = require('./Routes/client.routes');
const equipmentRoutes = require('./Routes/equipment.routes');

// Import des nouvelles routes
const maintenanceRoutes = require('./Routes/roomMaintenance.routes');
const roomEquipmentRoutes = require('./Routes/roomEquipment.routes');
const minibarRoutes = require('./Routes/roomMinibar.routes');
const consumptionRoutes = require('./Routes/consumption.routes'); // AJOUTER CETTE LIGNE
const housekeepingRoutes = require('./Routes/housekeepingTask.routes');

const casinoRoomRoutes = require('./Routes/casinoRoom.routes');
const casinoCashierRoutes = require('./Routes/casinoCashier.routes');
const casinoSessionRoutes = require('./Routes/casinoSession.routes');
const casinoTransactionRoutes = require('./Routes/casinoTransaction.routes');

const app = express();
const PORT = process.env.PORT || 4000;

// =============================================
// 1. CORS
// =============================================
app.use(cors({
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// =============================================
// 2. MIDDLEWARE MANUEL POUR PARSER LE BODY
// =============================================
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
                    console.log('✅ [MANUAL PARSER] Body parsé avec succès:', req.body);
                } else {
                    req.body = {};
                    console.log('⚠️ [MANUAL PARSER] Body vide');
                }
                next();
            } catch (error) {
                console.error('❌ [MANUAL PARSER] Erreur de parsing:', error.message);
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

// =============================================
// 3. Parser JSON
// =============================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =============================================
// 4. Logger
// =============================================
app.use((req, res, next) => {
    console.log(`\n📝 ${req.method} ${req.url}`);
    console.log('📥 Headers Content-Type:', req.headers['content-type']);
    console.log('📥 Body reçu:', req.body);
    next();
});

// =============================================
// 5. Route de test
// =============================================
app.post('/api/test-body', (req, res) => {
    console.log('🧪 [TEST] Body reçu:', req.body);
    res.json({
        success: true,
        message: 'Body reçu avec succès !',
        data: req.body
    });
});

// =============================================
// 6. ROUTES
// =============================================

// Routes d'authentification
app.use('/api/auth', authRoutes);

// Routes Admin
app.use('/api/admin', adminRoutes);

// Routes Hébergement - Base
app.use('/api/rooms', roomRoutes);
app.use('/api/room-types', roomTypeRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/clients', clientRoutes);

// Routes Hébergement - Modules supplémentaires
app.use('/api/equipments', equipmentRoutes);
app.use('/api/maintenances', maintenanceRoutes);
app.use('/api/room-equipments', roomEquipmentRoutes);

// IMPORTANT: Utiliser le même nom que le frontend
app.use('/api/minibar', minibarRoutes); // Changé de 'minibars' à 'minibar'
app.use('/api/consumptions', consumptionRoutes); // AJOUTER CETTE LIGNE
app.use('/api/housekeeping', housekeepingRoutes);

// Routes Restaurant
app.use('/api/restaurant', require('./Routes/restaurant.routes'));

// Routes Casino
app.use('/api/casino/rooms', casinoRoomRoutes);
app.use('/api/casino/cashiers', casinoCashierRoutes);
app.use('/api/casino/sessions', casinoSessionRoutes);
app.use('/api/casino/transactions', casinoTransactionRoutes);

// =============================================
// 7. Health check
// =============================================
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'API HDA est opérationnelle',
        timestamp: new Date().toISOString(),
        env: process.env.NODE_ENV
    });
});

// =============================================
// 8. Route racine
// =============================================
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Bienvenue sur l\'API HDA Platform',
        version: '1.0.0',
        endpoints: {
            auth: {
                login: 'POST /api/auth/login',
                register: 'POST /api/auth/register',
                profile: 'GET /api/auth/profile',
                logout: 'POST /api/auth/logout',
                'verify-token': 'GET /api/auth/verify-token',
                'refresh-token': 'POST /api/auth/refresh-token',
                'change-password': 'POST /api/auth/change-password'
            },
            admin: {
                list: 'GET /api/admin',
                create: 'POST /api/admin',
                getOne: 'GET /api/admin/:id',
                update: 'PUT /api/admin/:id',
                delete: 'DELETE /api/admin/:id',
                status: 'PATCH /api/admin/:id/status',
                'reset-password': 'POST /api/admin/:id/reset-password',
                'by-role': 'GET /api/admin/role/:role',
                check: 'GET /api/admin/check'
            },
            equipments: {
                list: 'GET /api/equipments',
                create: 'POST /api/equipments',
                getOne: 'GET /api/equipments/:id',
                getByCode: 'GET /api/equipments/code/:code',
                update: 'PUT /api/equipments/:id',
                delete: 'DELETE /api/equipments/:id',
                categories: 'GET /api/equipments/categories',
                stats: 'GET /api/equipments/stats'
            },
            rooms: {
                list: 'GET /api/rooms',
                create: 'POST /api/rooms',
                getOne: 'GET /api/rooms/:id',
                update: 'PUT /api/rooms/:id',
                delete: 'DELETE /api/rooms/:id',
                status: 'PUT /api/rooms/:id/status',
                available: 'GET /api/rooms/available',
                stats: 'GET /api/rooms/stats',
                checkAvailability: 'GET /api/rooms/:id/availability'
            },
            roomTypes: {
                list: 'GET /api/room-types',
                create: 'POST /api/room-types',
                getOne: 'GET /api/room-types/:id',
                update: 'PUT /api/room-types/:id',
                delete: 'DELETE /api/room-types/:id'
            },
            reservations: {
                list: 'GET /api/reservations',
                create: 'POST /api/reservations',
                getOne: 'GET /api/reservations/:id',
                update: 'PUT /api/reservations/:id',
                delete: 'DELETE /api/reservations/:id',
                status: 'PUT /api/reservations/:id/status',
                stats: 'GET /api/reservations/stats'
            },
            clients: {
                list: 'GET /api/clients',
                create: 'POST /api/clients',
                getOne: 'GET /api/clients/:id',
                update: 'PUT /api/clients/:id',
                delete: 'DELETE /api/clients/:id'
            },
            maintenances: {
                list: 'GET /api/maintenances',
                create: 'POST /api/maintenances',
                getOne: 'GET /api/maintenances/:id',
                update: 'PUT /api/maintenances/:id',
                delete: 'DELETE /api/maintenances/:id',
                status: 'PUT /api/maintenances/:id/status',
                stats: 'GET /api/maintenances/stats'
            },
            roomEquipments: {
                list: 'GET /api/room-equipments',
                create: 'POST /api/room-equipments',
                getOne: 'GET /api/room-equipments/:id',
                update: 'PUT /api/room-equipments/:id',
                delete: 'DELETE /api/room-equipments/:id',
                status: 'PUT /api/room-equipments/:id/status',
                byRoom: 'GET /api/room-equipments/room/:roomId',
                stats: 'GET /api/room-equipments/stats'
            },
            minibar: {
                list: 'GET /api/minibar',
                create: 'POST /api/minibar',
                getOne: 'GET /api/minibar/:id',
                update: 'PUT /api/minibar/:id',
                delete: 'DELETE /api/minibar/:id',
                quantity: 'PATCH /api/minibar/:id/quantity', // Changé de PUT à PATCH
                byRoom: 'GET /api/minibar/room/:roomId',
                alerts: 'GET /api/minibar/alerts',
                stats: 'GET /api/minibar/stats'
            },
            consumptions: { // AJOUTER CETTE SECTION
                list: 'GET /api/consumptions',
                create: 'POST /api/consumptions',
                getOne: 'GET /api/consumptions/:id',
                byRoom: 'GET /api/consumptions/room/:roomId',
                bill: 'PATCH /api/consumptions/:id/bill',
                delete: 'DELETE /api/consumptions/:id',
                stats: 'GET /api/consumptions/stats/room/:roomId'
            },
            housekeeping: {
                list: 'GET /api/housekeeping',
                create: 'POST /api/housekeeping',
                getOne: 'GET /api/housekeeping/:id',
                update: 'PUT /api/housekeeping/:id',
                delete: 'DELETE /api/housekeeping/:id',
                status: 'PUT /api/housekeeping/:id/status',
                byRoom: 'GET /api/housekeeping/room/:roomId',
                byUser: 'GET /api/housekeeping/user/:userId',
                stats: 'GET /api/housekeeping/stats'
            },
            restaurant: {
                list: 'GET /api/restaurant',
                create: 'POST /api/restaurant',
                // ... autres endpoints restaurant
            },
            health: 'GET /api/health',
            test: 'POST /api/test-body'
        }
    });
});

// =============================================
// 9. 404 et erreurs
// =============================================
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route non trouvée',
        path: req.originalUrl
    });
});

app.use((err, req, res, next) => {
    console.error('❌ Erreur:', err.message);
    console.error('📚 Stack:', err.stack);
    res.status(500).json({
        success: false,
        message: 'Erreur interne du serveur',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// =============================================
// 10. Démarrage
// =============================================
async function startServer() {
    try {
        await testConnection();
        console.log('✅ Base de données connectée');

        app.listen(PORT, () => {
            console.log('='.repeat(70));
            console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
            console.log(`📊 Environnement: ${process.env.NODE_ENV || 'development'}`);
            console.log(`🔗 Base de données: ✅ Connectée`);
            console.log('='.repeat(70));
            
            console.log('\n📋 Routes disponibles:');
            
            console.log('\n🔐 Authentification:');
            console.log('   POST   /api/auth/login               - Connexion');
            console.log('   POST   /api/auth/register            - Inscription');
            console.log('   GET    /api/auth/profile             - Profil');
            console.log('   POST   /api/auth/logout              - Déconnexion');
            console.log('   GET    /api/auth/verify-token        - Vérifier token');
            console.log('   POST   /api/auth/refresh-token       - Rafraîchir token');
            console.log('   POST   /api/auth/change-password     - Changer mot de passe');
            
            console.log('\n👥 Administrateurs:');
            console.log('   POST   /api/admin                    - Créer un admin (public)');
            console.log('   GET    /api/admin/check              - Vérifier si des admins existent');
            console.log('   GET    /api/admin                    - Liste des admins');
            console.log('   GET    /api/admin/:id                - Détails d\'un admin');
            console.log('   PUT    /api/admin/:id                - Modifier un admin');
            console.log('   DELETE /api/admin/:id                - Supprimer un admin');
            console.log('   PATCH  /api/admin/:id/status         - Changer statut');
            console.log('   POST   /api/admin/:id/reset-password - Réinitialiser mot de passe');
            console.log('   GET    /api/admin/role/:role         - Admins par rôle');
            
            console.log('\n📦 Équipements (Catalogue):');
            console.log('   GET    /api/equipments               - Liste des équipements');
            console.log('   POST   /api/equipments               - Créer un équipement');
            console.log('   GET    /api/equipments/:id           - Détails d\'un équipement');
            console.log('   GET    /api/equipments/code/:code    - Recherche par code');
            console.log('   PUT    /api/equipments/:id           - Modifier un équipement');
            console.log('   DELETE /api/equipments/:id           - Supprimer un équipement');
            console.log('   GET    /api/equipments/categories    - Liste des catégories');
            console.log('   GET    /api/equipments/stats         - Statistiques');
            
            console.log('\n🏠 Chambres:');
            console.log('   GET    /api/rooms                    - Liste des chambres');
            console.log('   POST   /api/rooms                    - Créer une chambre');
            console.log('   GET    /api/rooms/:id                - Détails d\'une chambre');
            console.log('   PUT    /api/rooms/:id                - Modifier une chambre');
            console.log('   DELETE /api/rooms/:id                - Supprimer une chambre');
            console.log('   PUT    /api/rooms/:id/status         - Changer statut');
            console.log('   GET    /api/rooms/available          - Chambres disponibles');
            console.log('   GET    /api/rooms/stats              - Statistiques');
            console.log('   GET    /api/rooms/:id/availability   - Vérifier disponibilité');
            
            console.log('\n📐 Types de chambres:');
            console.log('   GET    /api/room-types               - Liste des types');
            console.log('   POST   /api/room-types               - Créer un type');
            console.log('   GET    /api/room-types/:id           - Détails d\'un type');
            console.log('   PUT    /api/room-types/:id           - Modifier un type');
            console.log('   DELETE /api/room-types/:id           - Supprimer un type');
            
            console.log('\n📅 Réservations:');
            console.log('   GET    /api/reservations             - Liste des réservations');
            console.log('   POST   /api/reservations             - Créer une réservation');
            console.log('   GET    /api/reservations/:id         - Détails d\'une réservation');
            console.log('   PUT    /api/reservations/:id         - Modifier une réservation');
            console.log('   DELETE /api/reservations/:id         - Supprimer une réservation');
            console.log('   PUT    /api/reservations/:id/status  - Changer statut');
            console.log('   GET    /api/reservations/stats       - Statistiques');
            
            console.log('\n👤 Clients:');
            console.log('   GET    /api/clients                  - Liste des clients');
            console.log('   POST   /api/clients                  - Créer un client');
            console.log('   GET    /api/clients/:id              - Détails d\'un client');
            console.log('   PUT    /api/clients/:id              - Modifier un client');
            console.log('   DELETE /api/clients/:id              - Supprimer un client');
            
            console.log('\n🔧 Maintenances:');
            console.log('   GET    /api/maintenances             - Liste des maintenances');
            console.log('   POST   /api/maintenances             - Créer une maintenance');
            console.log('   GET    /api/maintenances/:id         - Détails d\'une maintenance');
            console.log('   PUT    /api/maintenances/:id         - Modifier une maintenance');
            console.log('   DELETE /api/maintenances/:id         - Supprimer une maintenance');
            console.log('   PUT    /api/maintenances/:id/status  - Changer statut');
            console.log('   GET    /api/maintenances/stats       - Statistiques');
            
            console.log('\n🛋️ Équipements de chambre:');
            console.log('   GET    /api/room-equipments          - Liste des équipements');
            console.log('   POST   /api/room-equipments          - Ajouter un équipement');
            console.log('   GET    /api/room-equipments/:id      - Détails d\'un équipement');
            console.log('   PUT    /api/room-equipments/:id      - Modifier un équipement');
            console.log('   DELETE /api/room-equipments/:id      - Supprimer un équipement');
            console.log('   PUT    /api/room-equipments/:id/status - Changer statut');
            console.log('   GET    /api/room-equipments/room/:roomId - Équipements d\'une chambre');
            console.log('   GET    /api/room-equipments/stats    - Statistiques');
            
            console.log('\n🍾 Minibar:');
            console.log('   GET    /api/minibar                  - Liste des minibars');
            console.log('   POST   /api/minibar                  - Ajouter un produit');
            console.log('   GET    /api/minibar/:id              - Détails d\'un produit');
            console.log('   PUT    /api/minibar/:id              - Modifier un produit');
            console.log('   DELETE /api/minibar/:id              - Supprimer un produit');
            console.log('   PATCH  /api/minibar/:id/quantity     - Mettre à jour quantité');
            console.log('   GET    /api/minibar/room/:roomId     - Minibar d\'une chambre');
            console.log('   GET    /api/minibar/alerts           - Alertes stock');
            console.log('   GET    /api/minibar/stats            - Statistiques');
            
            console.log('\n📊 Consommations:');
            console.log('   GET    /api/consumptions             - Liste des consommations');
            console.log('   POST   /api/consumptions             - Créer une consommation');
            console.log('   GET    /api/consumptions/:id         - Détails d\'une consommation');
            console.log('   GET    /api/consumptions/room/:roomId - Consommations d\'une chambre');
            console.log('   PATCH  /api/consumptions/:id/bill    - Facturer une consommation');
            console.log('   DELETE /api/consumptions/:id         - Supprimer une consommation');
            console.log('   GET    /api/consumptions/stats/room/:roomId - Statistiques par chambre');
            
            console.log('\n🧹 Housekeeping:');
            console.log('   GET    /api/housekeeping             - Liste des tâches');
            console.log('   POST   /api/housekeeping             - Créer une tâche');
            console.log('   GET    /api/housekeeping/:id         - Détails d\'une tâche');
            console.log('   PUT    /api/housekeeping/:id         - Modifier une tâche');
            console.log('   DELETE /api/housekeeping/:id         - Supprimer une tâche');
            console.log('   PUT    /api/housekeeping/:id/status  - Changer statut');
            console.log('   GET    /api/housekeeping/room/:roomId - Tâches d\'une chambre');
            console.log('   GET    /api/housekeeping/user/:userId - Tâches d\'un utilisateur');
            console.log('   GET    /api/housekeeping/stats       - Statistiques');
            
            console.log('\n🍽️ Restaurant:');
            console.log('   GET    /api/restaurant               - Routes restaurant');
            
            console.log('\n🧪 Tests:');
            console.log('   POST   /api/test-body                - Tester le body');
            console.log('   GET    /api/health                   - Health check');
            console.log('   GET    /                             - Liste des endpoints');
            console.log('='.repeat(70));
        });
    } catch (error) {
        console.error('❌ Erreur de démarrage:', error.message);
        process.exit(1);
    }
}

startServer();

module.exports = app;