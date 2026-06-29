// Routes/consumption.routes.js
const express = require('express');
const router = express.Router();
const Consumption = require('../Models/consumption.model');


// GET /api/consumptions - Liste des consommations
router.get('/', async (req, res) => {
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

// GET /api/consumptions/room/:roomId - Consommations d'une chambre
router.get('/room/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    const consumptions = await Consumption.findByRoomId(roomId);
    res.json({ success: true, count: consumptions.length, data: consumptions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/consumptions - Créer une consommation
router.post('/', async (req, res) => {
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

// PATCH /api/consumptions/:id/bill - Marquer comme facturée
router.patch('/:id/bill', async (req, res) => {
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

// DELETE /api/consumptions/:id - Supprimer une consommation
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Consumption.delete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Consommation non trouvée' });
    }
    res.json({ success: true, message: 'Consommation supprimée' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;