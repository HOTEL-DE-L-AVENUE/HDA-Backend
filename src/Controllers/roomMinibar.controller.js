const RoomMinibar = require('../Models/roomMinibar.model');
const Room = require('../Models/room.model');
const Product = require('../Models/product.model');

// =============================================
// Récupérer tous les minibars
// =============================================
const getRoomMinibars = async (req, res) => {
  try {
    const { room_id, product_id, seuil_alerte } = req.query;
    const filters = {};
    if (room_id) filters.room_id = parseInt(room_id);
    if (product_id) filters.product_id = parseInt(product_id);
    if (seuil_alerte) filters.seuil_alerte = true;

    const minibars = await RoomMinibar.findAll(filters);

    res.status(200).json({
      success: true,
      count: minibars.length,
      data: minibars
    });
  } catch (error) {
    console.error('❌ Erreur getRoomMinibars:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des minibars',
      error: error.message
    });
  }
};

// =============================================
// Récupérer un minibar par ID
// =============================================
const getRoomMinibarById = async (req, res) => {
  try {
    const { id } = req.params;
    const minibar = await RoomMinibar.findById(id);

    if (!minibar) {
      return res.status(404).json({
        success: false,
        message: 'Minibar non trouvé'
      });
    }

    res.status(200).json({
      success: true,
      data: minibar
    });
  } catch (error) {
    console.error('❌ Erreur getRoomMinibarById:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du minibar',
      error: error.message
    });
  }
};

// =============================================
// Récupérer le minibar d'une chambre
// =============================================
const getRoomMinibarByRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    const minibar = await RoomMinibar.findByRoomId(roomId);

    res.status(200).json({
      success: true,
      count: minibar.length,
      data: minibar
    });
  } catch (error) {
    console.error('❌ Erreur getRoomMinibarByRoom:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du minibar de la chambre',
      error: error.message
    });
  }
};

// =============================================
// Récupérer les alertes stock
// =============================================
const getMinibarAlerts = async (req, res) => {
  try {
    const alerts = await RoomMinibar.getAlertItems();

    res.status(200).json({
      success: true,
      count: alerts.length,
      data: alerts
    });
  } catch (error) {
    console.error('❌ Erreur getMinibarAlerts:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des alertes',
      error: error.message
    });
  }
};

// =============================================
// Créer un produit dans le minibar
// =============================================
const createRoomMinibar = async (req, res) => {
  try {
    const { room_id, product_id, quantite = 0, seuil_alerte = 1 } = req.body;

    if (!room_id || !product_id) {
      return res.status(400).json({
        success: false,
        message: 'Champs requis: room_id, product_id'
      });
    }

    // Vérifier si la chambre existe
    const room = await Room.findById(room_id);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: `Chambre avec ID ${room_id} non trouvée`
      });
    }

    // Vérifier si le produit existe
    const product = await Product.findById(product_id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: `Produit avec ID ${product_id} non trouvé`
      });
    }

    // Vérifier si le produit existe déjà dans la chambre
    const exists = await RoomMinibar.exists(room_id, product_id);
    if (exists) {
      return res.status(400).json({
        success: false,
        message: 'Ce produit est déjà dans le minibar de cette chambre'
      });
    }

    const minibarId = await RoomMinibar.create({
      room_id,
      product_id,
      quantite,
      seuil_alerte
    });

    const newMinibar = await RoomMinibar.findById(minibarId);

    res.status(201).json({
      success: true,
      message: 'Produit ajouté au minibar avec succès',
      data: newMinibar
    });
  } catch (error) {
    console.error('❌ Erreur createRoomMinibar:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'ajout du produit au minibar',
      error: error.message
    });
  }
};

// =============================================
// Mettre à jour un produit du minibar
// =============================================
const updateRoomMinibar = async (req, res) => {
  try {
    const { id } = req.params;

    const minibar = await RoomMinibar.findById(id);
    if (!minibar) {
      return res.status(404).json({
        success: false,
        message: 'Minibar non trouvé'
      });
    }

    const updated = await RoomMinibar.update(id, req.body);
    if (!updated) {
      return res.status(400).json({
        success: false,
        message: 'Aucune modification apportée'
      });
    }

    const updatedMinibar = await RoomMinibar.findById(id);

    res.status(200).json({
      success: true,
      message: 'Minibar mis à jour avec succès',
      data: updatedMinibar
    });
  } catch (error) {
    console.error('❌ Erreur updateRoomMinibar:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du minibar',
      error: error.message
    });
  }
};

// =============================================
// Mettre à jour la quantité
// =============================================
const updateMinibarQuantity = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantite } = req.body;

    if (quantite === undefined) {
      return res.status(400).json({
        success: false,
        message: 'La quantité est requise'
      });
    }

    if (quantite < 0) {
      return res.status(400).json({
        success: false,
        message: 'La quantité ne peut pas être négative'
      });
    }

    const minibar = await RoomMinibar.findById(id);
    if (!minibar) {
      return res.status(404).json({
        success: false,
        message: 'Minibar non trouvé'
      });
    }

    const updated = await RoomMinibar.updateQuantity(id, quantite);
    if (!updated) {
      return res.status(400).json({
        success: false,
        message: 'Erreur lors de la mise à jour de la quantité'
      });
    }

    const updatedMinibar = await RoomMinibar.findById(id);

    res.status(200).json({
      success: true,
      message: 'Quantité mise à jour avec succès',
      data: updatedMinibar
    });
  } catch (error) {
    console.error('❌ Erreur updateMinibarQuantity:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de la quantité',
      error: error.message
    });
  }
};

// =============================================
// Supprimer un produit du minibar
// =============================================
const deleteRoomMinibar = async (req, res) => {
  try {
    const { id } = req.params;

    const minibar = await RoomMinibar.findById(id);
    if (!minibar) {
      return res.status(404).json({
        success: false,
        message: 'Minibar non trouvé'
      });
    }

    const deleted = await RoomMinibar.delete(id);
    if (!deleted) {
      return res.status(400).json({
        success: false,
        message: 'Erreur lors de la suppression'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Produit supprimé du minibar avec succès'
    });
  } catch (error) {
    console.error('❌ Erreur deleteRoomMinibar:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du produit du minibar',
      error: error.message
    });
  }
};

// =============================================
// Statistiques
// =============================================
const getRoomMinibarStats = async (req, res) => {
  try {
    const stats = await RoomMinibar.getStats();

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('❌ Erreur getRoomMinibarStats:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques',
      error: error.message
    });
  }
};

module.exports = {
  getRoomMinibars,
  getRoomMinibarById,
  getRoomMinibarByRoom,
  getMinibarAlerts,
  createRoomMinibar,
  updateRoomMinibar,
  updateMinibarQuantity,
  deleteRoomMinibar,
  getRoomMinibarStats
};  