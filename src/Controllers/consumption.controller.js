    // controllers/consumption.controller.js
const Consumption = require('../models/consumption.model');
const RoomMinibar = require('../Models/roomMinibar.model');

// Récupérer toutes les consommations
const getAllConsumptions = async (req, res) => {
  try {
    const { room_id, client_id, facturee } = req.query;
    const filters = {};
    if (room_id) filters.room_id = parseInt(room_id);
    if (client_id) filters.client_id = parseInt(client_id);
    if (facturee !== undefined) filters.facturee = facturee === 'true';

    const consumptions = await Consumption.findAll(filters);

    res.status(200).json({
      success: true,
      count: consumptions.length,
      data: consumptions
    });
  } catch (error) {
    console.error('❌ Erreur getAllConsumptions:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des consommations',
      error: error.message
    });
  }
};

// Récupérer les consommations d'une chambre
const getRoomConsumptions = async (req, res) => {
  try {
    const { roomId } = req.params;
    const consumptions = await Consumption.findByRoomId(roomId);

    res.status(200).json({
      success: true,
      count: consumptions.length,
      data: consumptions
    });
  } catch (error) {
    console.error('❌ Erreur getRoomConsumptions:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des consommations de la chambre',
      error: error.message
    });
  }
};

// Créer une consommation
const createConsumption = async (req, res) => {
  try {
    const { room_id, client_id, product_id, quantite, prix_unitaire } = req.body;

    if (!room_id || !client_id || !product_id || !quantite || !prix_unitaire) {
      return res.status(400).json({
        success: false,
        message: 'Champs requis: room_id, client_id, product_id, quantite, prix_unitaire'
      });
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

    res.status(201).json({
      success: true,
      message: 'Consommation enregistrée avec succès',
      data: newConsumption
    });
  } catch (error) {
    console.error('❌ Erreur createConsumption:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'enregistrement de la consommation',
      error: error.message
    });
  }
};

// Marquer comme facturée
const markAsBilled = async (req, res) => {
  try {
    const { id } = req.params;

    const consumption = await Consumption.findById(id);
    if (!consumption) {
      return res.status(404).json({
        success: false,
        message: 'Consommation non trouvée'
      });
    }

    const updated = await Consumption.markAsBilled(id);
    if (!updated) {
      return res.status(400).json({
        success: false,
        message: 'Erreur lors de la mise à jour'
      });
    }

    const updatedConsumption = await Consumption.findById(id);

    res.status(200).json({
      success: true,
      message: 'Consommation facturée avec succès',
      data: updatedConsumption
    });
  } catch (error) {
    console.error('❌ Erreur markAsBilled:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du marquage de la facturation',
      error: error.message
    });
  }
};

// Supprimer une consommation
const deleteConsumption = async (req, res) => {
  try {
    const { id } = req.params;

    const consumption = await Consumption.findById(id);
    if (!consumption) {
      return res.status(404).json({
        success: false,
        message: 'Consommation non trouvée'
      });
    }

    const deleted = await Consumption.delete(id);
    if (!deleted) {
      return res.status(400).json({
        success: false,
        message: 'Erreur lors de la suppression'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Consommation supprimée avec succès'
    });
  } catch (error) {
    console.error('❌ Erreur deleteConsumption:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de la consommation',
      error: error.message
    });
  }
};

// Récupérer le total des consommations d'une chambre
const getRoomTotal = async (req, res) => {
  try {
    const { roomId } = req.params;
    const total = await Consumption.getRoomTotal(roomId);

    res.status(200).json({
      success: true,
      data: total
    });
  } catch (error) {
    console.error('❌ Erreur getRoomTotal:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du calcul du total',
      error: error.message
    });
  }
};

module.exports = {
  getAllConsumptions,
  getRoomConsumptions,
  createConsumption,
  markAsBilled,
  deleteConsumption,
  getRoomTotal
};