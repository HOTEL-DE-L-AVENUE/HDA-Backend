// routes/api.routes.js
const express = require('express');
const router = express.Router();

// ============================================
// Routes Minibar
// ============================================
const RoomMinibar = require('../Models/roomMinibar.model');

router.get('/minibar', async (req, res) => {
  try {
    const { room_id, product_id, seuil_alerte } = req.query;
    const filters = {};
    if (room_id) filters.room_id = parseInt(room_id);
    if (product_id) filters.product_id = parseInt(product_id);
    if (seuil_alerte) filters.seuil_alerte = true;

    const minibars = await RoomMinibar.findAll(filters);
    res.json({ success: true, count: minibars.length, data: minibars });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/minibar/stats', async (req, res) => {
  try {
    const stats = await RoomMinibar.getStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/minibar/room/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    const minibar = await RoomMinibar.findByRoomId(roomId);
    res.json({ success: true, count: minibar.length, data: minibar });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.patch('/minibar/:id/quantity', async (req, res) => {
  try {
    const { id } = req.params;
    const { quantite } = req.body;
    
    if (quantite === undefined || quantite < 0) {
      return res.status(400).json({ success: false, message: 'Quantité invalide' });
    }
    
    const updated = await RoomMinibar.updateQuantity(id, quantite);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Minibar non trouvé' });
    }
    
    const updatedMinibar = await RoomMinibar.findById(id);
    res.json({ success: true, message: 'Quantité mise à jour', data: updatedMinibar });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/minibar/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await RoomMinibar.delete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Minibar non trouvé' });
    }
    res.json({ success: true, message: 'Produit supprimé' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// Routes Consommations
// ============================================
const Consumption = require('../Models/consumption.model');

router.get('/consumptions', async (req, res) => {
  try {
    const { room_id, client_id, facturee } = req.query;
    const filters = {};
    if (room_id) filters.room_id = parseInt(room_id);
    if (client_id) filters.client_id = parseInt(client_id);
    if (facturee !== undefined) filters.facturee = facturee === 'true';

    const consumptions = await Consumption.findAll(filters);
    res.json({ success: true, count: consumptions.length, data: consumptions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/consumptions/room/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    const consumptions = await Consumption.findByRoomId(roomId);
    res.json({ success: true, count: consumptions.length, data: consumptions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/consumptions', async (req, res) => {
  try {
    const { room_id, client_id, product_id, quantite, prix_unitaire } = req.body;
    
    if (!room_id || !client_id || !product_id || !quantite || !prix_unitaire) {
      return res.status(400).json({ success: false, message: 'Champs requis manquants' });
    }
    
    const montant = prix_unitaire * quantite;
    const consumptionId = await Consumption.create({
      room_id,
      client_id,
      product_id,
      quantite,
      prix_unitaire,
      montant,
      facturee: false
    });
    
    const newConsumption = await Consumption.findById(consumptionId);
    
    // Mettre à jour le stock du minibar
    const minibarItem = await RoomMinibar.findByRoomAndProduct(room_id, product_id);
    if (minibarItem) {
      const newQuantity = Math.max(0, minibarItem.quantite - quantite);
      await RoomMinibar.updateQuantity(minibarItem.id, newQuantity);
    }
    
    res.status(201).json({ success: true, message: 'Consommation enregistrée', data: newConsumption });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.patch('/consumptions/:id/bill', async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await Consumption.markAsBilled(id);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Consommation non trouvée' });
    }
    const updatedConsumption = await Consumption.findById(id);
    res.json({ success: true, message: 'Consommation facturée', data: updatedConsumption });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// Routes Réservations (pour les stats)
// ============================================
const Reservation = require('../Models/reservation.model');

router.get('/reservations/stats', async (req, res) => {
  try {
    // Simuler des stats si le modèle n'existe pas
    const stats = {
      total: 0,
      en_attente: 0,
      confirmees: 0,
      annulees: 0,
      terminees: 0,
      no_show: 0,
      taux_occupation: 0,
      revenu_total: 0
    };
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// Route de test
// ============================================
router.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

module.exports = router;