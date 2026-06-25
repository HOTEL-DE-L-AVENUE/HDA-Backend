// ✅ CORRECTION : Importer le bon modèle Equipment (catalogue)
const RoomEquipment = require('../Models/roomEquipment.model');
const Room = require('../Models/room.model');
const Equipment = require('../Models/equipment.model'); // <- ICI la correction

// =============================================
// Récupérer tous les équipements de chambre
// =============================================
const getRoomEquipments = async (req, res) => {
  try {
    const { room_id, statut, equipment_id } = req.query;
    const filters = {};
    if (room_id) filters.room_id = parseInt(room_id);
    if (statut) filters.statut = statut;
    if (equipment_id) filters.equipment_id = parseInt(equipment_id);

    const equipments = await RoomEquipment.findAll(filters);

    res.status(200).json({
      success: true,
      count: equipments.length,
      data: equipments
    });
  } catch (error) {
    console.error('❌ Erreur getRoomEquipments:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des équipements',
      error: error.message
    });
  }
};

// =============================================
// Récupérer un équipement par ID
// =============================================
const getRoomEquipmentById = async (req, res) => {
  try {
    const { id } = req.params;
    const equipment = await RoomEquipment.findById(id);

    if (!equipment) {
      return res.status(404).json({
        success: false,
        message: 'Équipement non trouvé'
      });
    }

    res.status(200).json({
      success: true,
      data: equipment
    });
  } catch (error) {
    console.error('❌ Erreur getRoomEquipmentById:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de l\'équipement',
      error: error.message
    });
  }
};

// =============================================
// Récupérer les équipements d'une chambre
// =============================================
const getRoomEquipmentsByRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    const equipments = await RoomEquipment.findByRoomId(roomId);

    res.status(200).json({
      success: true,
      count: equipments.length,
      data: equipments
    });
  } catch (error) {
    console.error('❌ Erreur getRoomEquipmentsByRoom:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des équipements de la chambre',
      error: error.message
    });
  }
};

// =============================================
// Créer un équipement de chambre
// =============================================
const createRoomEquipment = async (req, res) => {
  try {
    const { room_id, equipment_id, quantite = 1, statut = 'BON' } = req.body;

    console.log('📥 [createRoomEquipment] Données reçues:', { room_id, equipment_id, quantite, statut });

    if (!room_id || !equipment_id) {
      return res.status(400).json({
        success: false,
        message: 'Champs requis: room_id, equipment_id'
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

    // ✅ Vérifier si l'équipement existe dans le catalogue (table equipments)
    const equipment = await Equipment.findById(equipment_id);
    if (!equipment) {
      return res.status(404).json({
        success: false,
        message: `Équipement avec ID ${equipment_id} non trouvé dans le catalogue`
      });
    }

    // Vérifier si l'équipement a un nom valide
    if (!equipment.nom) {
      return res.status(400).json({
        success: false,
        message: 'L\'équipement sélectionné n\'a pas de nom valide'
      });
    }

    // Vérifier si l'équipement existe déjà dans la chambre
    const exists = await RoomEquipment.exists(room_id, equipment_id);
    if (exists) {
      return res.status(400).json({
        success: false,
        message: 'Cet équipement est déjà présent dans cette chambre'
      });
    }

    const equipmentId = await RoomEquipment.create({
      room_id,
      equipment_id,
      quantite,
      statut
    });

    const newEquipment = await RoomEquipment.findById(equipmentId);

    res.status(201).json({
      success: true,
      message: 'Équipement ajouté avec succès',
      data: newEquipment
    });
  } catch (error) {
    console.error('❌ Erreur createRoomEquipment:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'ajout de l\'équipement',
      error: error.message
    });
  }
};

// =============================================
// Mettre à jour un équipement
// =============================================
const updateRoomEquipment = async (req, res) => {
  try {
    const { id } = req.params;

    const equipment = await RoomEquipment.findById(id);
    if (!equipment) {
      return res.status(404).json({
        success: false,
        message: 'Équipement non trouvé'
      });
    }

    const updated = await RoomEquipment.update(id, req.body);
    if (!updated) {
      return res.status(400).json({
        success: false,
        message: 'Aucune modification apportée'
      });
    }

    const updatedEquipment = await RoomEquipment.findById(id);

    res.status(200).json({
      success: true,
      message: 'Équipement mis à jour avec succès',
      data: updatedEquipment
    });
  } catch (error) {
    console.error('❌ Erreur updateRoomEquipment:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de l\'équipement',
      error: error.message
    });
  }
};

// =============================================
// Mettre à jour le statut d'un équipement
// =============================================
const updateRoomEquipmentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { statut } = req.body;

    if (!statut) {
      return res.status(400).json({
        success: false,
        message: 'Le statut est requis'
      });
    }

    const validStatus = ['BON', 'EN_PANNE', 'REMPLACE', 'HORS_SERVICE'];
    if (!validStatus.includes(statut)) {
      return res.status(400).json({
        success: false,
        message: `Statut invalide. Valeurs autorisées: ${validStatus.join(', ')}`
      });
    }

    const equipment = await RoomEquipment.findById(id);
    if (!equipment) {
      return res.status(404).json({
        success: false,
        message: 'Équipement non trouvé'
      });
    }

    const updated = await RoomEquipment.updateStatus(id, statut);
    if (!updated) {
      return res.status(400).json({
        success: false,
        message: 'Erreur lors de la mise à jour du statut'
      });
    }

    const updatedEquipment = await RoomEquipment.findById(id);

    res.status(200).json({
      success: true,
      message: 'Statut mis à jour avec succès',
      data: updatedEquipment
    });
  } catch (error) {
    console.error('❌ Erreur updateRoomEquipmentStatus:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du statut',
      error: error.message
    });
  }
};

// =============================================
// Supprimer un équipement
// =============================================
const deleteRoomEquipment = async (req, res) => {
  try {
    const { id } = req.params;

    const equipment = await RoomEquipment.findById(id);
    if (!equipment) {
      return res.status(404).json({
        success: false,
        message: 'Équipement non trouvé'
      });
    }

    const deleted = await RoomEquipment.delete(id);
    if (!deleted) {
      return res.status(400).json({
        success: false,
        message: 'Erreur lors de la suppression'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Équipement supprimé avec succès'
    });
  } catch (error) {
    console.error('❌ Erreur deleteRoomEquipment:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de l\'équipement',
      error: error.message
    });
  }
};

// =============================================
// Statistiques
// =============================================
const getRoomEquipmentStats = async (req, res) => {
  try {
    const stats = await RoomEquipment.getStats();

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('❌ Erreur getRoomEquipmentStats:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques',
      error: error.message
    });
  }
};

module.exports = {
  getRoomEquipments,
  getRoomEquipmentById,
  getRoomEquipmentsByRoom,
  createRoomEquipment,
  updateRoomEquipment,
  updateRoomEquipmentStatus,
  deleteRoomEquipment,
  getRoomEquipmentStats
};