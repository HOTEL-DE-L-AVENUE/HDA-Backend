const Room = require('../Models/Room');

const createRoom = async (req, res) => {
  console.log('📥 [createRoom] req.body:', req.body);
  console.log('📥 [createRoom] typeof req.body:', typeof req.body);
  
  try {
    // Vérification explicite
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'req.body est invalide',
        received: req.body,
        type: typeof req.body
      });
    }

    const { room_type_id, numero, capacite, prix_nuit, statut } = req.body;

    if (!room_type_id || !numero || !capacite || !prix_nuit) {
      return res.status(400).json({
        success: false,
        message: 'Champs requis manquants',
        required: ['room_type_id', 'numero', 'capacite', 'prix_nuit'],
        received: { room_type_id, numero, capacite, prix_nuit }
      });
    }

    // Vérifier si le numéro existe déjà
    const numeroExists = await Room.numeroExists(numero);
    if (numeroExists) {
      return res.status(400).json({
        success: false,
        message: `Une chambre avec le numéro ${numero} existe déjà`
      });
    }

    const roomId = await Room.create({ 
      room_type_id: parseInt(room_type_id), 
      numero, 
      capacite: parseInt(capacite), 
      prix_nuit: parseFloat(prix_nuit), 
      statut: statut || 'disponible'
    });
    
    const newRoom = await Room.findById(roomId);

    res.status(201).json({
      success: true,
      message: 'Chambre créée avec succès',
      data: newRoom
    });
  } catch (error) {
    console.error('❌ [createRoom] Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de la chambre',
      error: error.message
    });
  }
};

// Récupérer toutes les chambres
const getRooms = async (req, res) => {
  try {
    const rooms = await Room.findAll(req.query);
    res.status(200).json({
      success: true,
      count: rooms.length,
      data: rooms
    });
  } catch (error) {
    console.error('❌ [getRooms] Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des chambres'
    });
  }
};

// Récupérer une chambre par ID
const getRoomById = async (req, res) => {
  try {
    const { id } = req.params;
    const room = await Room.findById(parseInt(id));
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Chambre non trouvée'
      });
    }
    res.status(200).json({
      success: true,
      data: room
    });
  } catch (error) {
    console.error('❌ [getRoomById] Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de la chambre'
    });
  }
};

// Mettre à jour une chambre
const updateRoom = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await Room.update(parseInt(id), req.body);
    if (!updated) {
      return res.status(400).json({
        success: false,
        message: 'Aucune modification apportée'
      });
    }
    const updatedRoom = await Room.findById(parseInt(id));
    res.status(200).json({
      success: true,
      message: 'Chambre mise à jour avec succès',
      data: updatedRoom
    });
  } catch (error) {
    console.error('❌ [updateRoom] Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de la chambre'
    });
  }
};

// Mettre à jour le statut d'une chambre
const updateRoomStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { statut } = req.body;
    
    if (!statut) {
      return res.status(400).json({
        success: false,
        message: 'Le statut est requis'
      });
    }
    
    const updated = await Room.updateStatus(parseInt(id), statut);
    if (!updated) {
      return res.status(400).json({
        success: false,
        message: 'Erreur lors de la mise à jour du statut'
      });
    }
    
    const updatedRoom = await Room.findById(parseInt(id));
    res.status(200).json({
      success: true,
      message: 'Statut mis à jour avec succès',
      data: updatedRoom
    });
  } catch (error) {
    console.error('❌ [updateRoomStatus] Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du statut'
    });
  }
};

// Supprimer une chambre
const deleteRoom = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Room.delete(parseInt(id));
    if (!deleted) {
      return res.status(400).json({
        success: false,
        message: 'Erreur lors de la suppression'
      });
    }
    res.status(200).json({
      success: true,
      message: 'Chambre supprimée avec succès'
    });
  } catch (error) {
    console.error('❌ [deleteRoom] Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de la chambre'
    });
  }
};

// Récupérer les chambres disponibles
const getAvailableRooms = async (req, res) => {
  try {
    const { check_in, check_out, capacite, room_type_id } = req.query;
    if (!check_in || !check_out) {
      return res.status(400).json({
        success: false,
        message: 'Les dates check_in et check_out sont requises'
      });
    }
    const rooms = await Room.findAvailable(
      check_in,
      check_out,
      capacite ? parseInt(capacite) : null,
      room_type_id ? parseInt(room_type_id) : null
    );
    res.status(200).json({
      success: true,
      count: rooms.length,
      data: rooms
    });
  } catch (error) {
    console.error('❌ [getAvailableRooms] Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des chambres disponibles'
    });
  }
};

// Statistiques des chambres
const getRoomStats = async (req, res) => {
  try {
    const stats = await Room.getStats();
    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('❌ [getRoomStats] Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques'
    });
  }
};

module.exports = {
  createRoom,
  getRooms,
  getRoomById,
  updateRoom,
  updateRoomStatus,
  deleteRoom,
  getAvailableRooms,
  getRoomStats
};