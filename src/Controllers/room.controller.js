const Room = require('../Models/room.model');
const RoomType = require('../Models/roomtype.model');

// =============================================
// Récupérer toutes les chambres
// =============================================
const getRooms = async (req, res) => {
  try {
    const { statut, room_type_id, min_price, max_price, capacite } = req.query;
    
    const filters = {};
    if (statut) filters.statut = statut;
    if (room_type_id) filters.room_type_id = parseInt(room_type_id);
    if (min_price) filters.min_price = parseFloat(min_price);
    if (max_price) filters.max_price = parseFloat(max_price);
    if (capacite) filters.capacite = parseInt(capacite);

    const rooms = await Room.findAll(filters);

    res.status(200).json({
      success: true,
      count: rooms.length,
      data: rooms
    });
  } catch (error) {
    console.error('❌ Erreur getRooms:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des chambres',
      error: error.message
    });
  }
};

// =============================================
// Récupérer une chambre par ID
// =============================================
const getRoomById = async (req, res) => {
  try {
    const { id } = req.params;
    const room = await Room.findById(id);

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
    console.error('❌ Erreur getRoomById:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de la chambre',
      error: error.message
    });
  }
};

// =============================================
// Créer une chambre
// =============================================
const createRoom = async (req, res) => {
  try {
    console.log('📥 [createRoom] req.body:', req.body);

    // Vérifier si req.body existe
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Body de la requête manquant ou vide. Vérifiez Content-Type: application/json'
      });
    }

    const { room_type_id, numero, capacite, prix_nuit, statut } = req.body;

    // Vérifier les champs requis
    if (!numero) {
      return res.status(400).json({
        success: false,
        message: 'Le champ "numero" est requis'
      });
    }

    if (!capacite) {
      return res.status(400).json({
        success: false,
        message: 'Le champ "capacite" est requis'
      });
    }

    if (!prix_nuit) {
      return res.status(400).json({
        success: false,
        message: 'Le champ "prix_nuit" est requis'
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

    // Vérifier si le type de chambre existe
    if (room_type_id) {
      const roomType = await RoomType.findById(room_type_id);
      if (!roomType) {
        return res.status(400).json({
          success: false,
          message: `Type de chambre avec ID ${room_type_id} non trouvé`
        });
      }
    }

    const roomId = await Room.create({
      room_type_id: room_type_id || null,
      numero,
      capacite: parseInt(capacite),
      prix_nuit: parseFloat(prix_nuit),
      statut: statut || 'LIBRE'
    });

    const newRoom = await Room.findById(roomId);

    res.status(201).json({
      success: true,
      message: 'Chambre créée avec succès',
      data: newRoom
    });
  } catch (error) {
    console.error('❌ Erreur createRoom:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de la chambre',
      error: error.message
    });
  }
};

// =============================================
// Mettre à jour une chambre
// =============================================
const updateRoom = async (req, res) => {
  try {
    const { id } = req.params;
    const { numero } = req.body;

    // Vérifier si la chambre existe
    const roomExists = await Room.exists(id);
    if (!roomExists) {
      return res.status(404).json({
        success: false,
        message: 'Chambre non trouvée'
      });
    }

    // Vérifier si le nouveau numéro existe déjà
    if (numero) {
      const numeroExists = await Room.numeroExists(numero, id);
      if (numeroExists) {
        return res.status(400).json({
          success: false,
          message: `Une chambre avec le numéro ${numero} existe déjà`
        });
      }
    }

    const updated = await Room.update(id, req.body);
    if (!updated) {
      return res.status(400).json({
        success: false,
        message: 'Aucune modification apportée'
      });
    }

    const updatedRoom = await Room.findById(id);

    res.status(200).json({
      success: true,
      message: 'Chambre mise à jour avec succès',
      data: updatedRoom
    });
  } catch (error) {
    console.error('❌ Erreur updateRoom:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de la chambre',
      error: error.message
    });
  }
};

// =============================================
// Mettre à jour le statut d'une chambre
// =============================================
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

    const validStatus = ['LIBRE', 'OCCUPEE', 'RESERVEE', 'NETTOYAGE', 'MAINTENANCE', 'HORS_SERVICE'];
    if (!validStatus.includes(statut)) {
      return res.status(400).json({
        success: false,
        message: `Statut invalide. Valeurs autorisées: ${validStatus.join(', ')}`
      });
    }

    // Vérifier si la chambre existe
    const roomExists = await Room.exists(id);
    if (!roomExists) {
      return res.status(404).json({
        success: false,
        message: 'Chambre non trouvée'
      });
    }

    const updated = await Room.updateStatus(id, statut);
    if (!updated) {
      return res.status(400).json({
        success: false,
        message: 'Erreur lors de la mise à jour du statut'
      });
    }

    const updatedRoom = await Room.findById(id);

    res.status(200).json({
      success: true,
      message: 'Statut mis à jour avec succès',
      data: updatedRoom
    });
  } catch (error) {
    console.error('❌ Erreur updateRoomStatus:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du statut',
      error: error.message
    });
  }
};

// =============================================
// Supprimer une chambre
// =============================================
const deleteRoom = async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier si la chambre existe
    const roomExists = await Room.exists(id);
    if (!roomExists) {
      return res.status(404).json({
        success: false,
        message: 'Chambre non trouvée'
      });
    }

    const deleted = await Room.delete(id);
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
    console.error('❌ Erreur deleteRoom:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de la chambre',
      error: error.message
    });
  }
};

// =============================================
// Récupérer les chambres disponibles
// =============================================
const getAvailableRooms = async (req, res) => {
  try {
    const { date_arrivee, date_depart, capacite, room_type_id } = req.query;

    if (!date_arrivee || !date_depart) {
      return res.status(400).json({
        success: false,
        message: 'Les dates sont requises : date_arrivee, date_depart'
      });
    }

    const rooms = await Room.findAvailable(
      date_arrivee,
      date_depart,
      capacite ? parseInt(capacite) : null,
      room_type_id ? parseInt(room_type_id) : null
    );

    res.status(200).json({
      success: true,
      count: rooms.length,
      data: rooms
    });
  } catch (error) {
    console.error('❌ Erreur getAvailableRooms:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des chambres disponibles',
      error: error.message
    });
  }
};

// =============================================
// Vérifier la disponibilité d'une chambre
// =============================================
const checkRoomAvailability = async (req, res) => {
  try {
    const { id } = req.params;
    const { date_arrivee, date_depart } = req.query;

    if (!date_arrivee || !date_depart) {
      return res.status(400).json({
        success: false,
        message: 'Les dates sont requises : date_arrivee, date_depart'
      });
    }

    // Vérifier si la chambre existe
    const roomExists = await Room.exists(id);
    if (!roomExists) {
      return res.status(404).json({
        success: false,
        message: 'Chambre non trouvée'
      });
    }

    const isAvailable = await Room.isAvailable(id, date_arrivee, date_depart);

    res.status(200).json({
      success: true,
      data: {
        room_id: id,
        date_arrivee,
        date_depart,
        isAvailable
      }
    });
  } catch (error) {
    console.error('❌ Erreur checkRoomAvailability:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification de disponibilité',
      error: error.message
    });
  }
};

// =============================================
// Statistiques des chambres
// =============================================
const getRoomStats = async (req, res) => {
  try {
    const stats = await Room.getStats();

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('❌ Erreur getRoomStats:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques',
      error: error.message
    });
  }
};

// =============================================
// EXPORT - TOUTES LES FONCTIONS
// =============================================
module.exports = {
  getRooms,
  getRoomById,
  createRoom,
  updateRoom,
  updateRoomStatus,
  deleteRoom,
  getAvailableRooms,
  checkRoomAvailability,
  getRoomStats
};