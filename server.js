require('dotenv').config();

const express = require('express');
const { connectDatabase } = require('./config/database');
const corsMiddleware = require('./src/Middleware/cors.middleware');

const app = express();

app.use(corsMiddleware);

app.use(express.json());

const startServer = async () => {
    await connectDatabase();

    app.listen(process.env.PORT, () => {
        console.log(`🚀 Serveur démarré sur le port ${process.env.PORT}`);
    });
};

startServer();