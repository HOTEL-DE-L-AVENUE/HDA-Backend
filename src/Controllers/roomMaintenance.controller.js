const RoomMaintenance = require('../Models/roomMaintenance.model');
const Room = require('../Models/room.model');

// Récupérer toutes les maintenances
const getMaintenances = async (req, res) => {
  try {
    const { statut, room_id, type_intervention } = req.query;
    const filters = {};
    if (statut) filters.statut = statut;
    if (room_id) filters.room_id = parseInt(room_id);
    if (type_intervention) filters.type_intervention = type_intervention;

    const maintenances = await RoomMaintenance.findAll(filters);

    res.status(200).json({
      success: true,
      count: maintenances.length,
      data: maintenances
    });
  } catch (error) {
    console.error('❌ Erreur getMaintenances:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des maintenances',
      error: error.message
    });
  }
};

// Récupérer une maintenance par ID
const getMaintenanceById = async (req, res) => {
  try {
    const { id } = req.params;
    const maintenance = await RoomMaintenance.findById(id);

    if (!maintenance) {
      return res.status(404).json({
        success: false,
        message: 'Maintenance non trouvée'
      });
    }

    res.status(200).json({
      success: true,
      data: maintenance
    });
  } catch (error) {
    console.error('❌ Erreur getMaintenanceById:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de la maintenance',
      error: error.message
    });
  }
};

// Créer une maintenance
const createMaintenance = async (req, res) => {
  try {
    const {
      room_id, equipment_id, type_intervention, description,
      statut, date_declaration, cout, created_by
    } = req.body;

    if (!room_id || !type_intervention) {
      return res.status(400).json({
        success: false,
        message: 'Champs requis: room_id, type_intervention'
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

    const maintenanceId = await RoomMaintenance.create({
      room_id,
      equipment_id,
      type_intervention,
      description,
      statut: statut || 'OUVERT',
      date_declaration: date_declaration || new Date(),
      cout: cout || 0,
      created_by: created_by || req.user?.id || null
    });

    const newMaintenance = await RoomMaintenance.findById(maintenanceId);

    res.status(201).json({
      success: true,
      message: 'Maintenance créée avec succès',
      data: newMaintenance
    });
  } catch (error) {
    console.error('❌ Erreur createMaintenance:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de la maintenance',
      error: error.message
    });
  }
};

// Mettre à jour une maintenance
const updateMaintenance = async (req, res) => {
  try {
    const { id } = req.params;

    const maintenanceExists = await RoomMaintenance.exists ? await RoomMaintenance.exists(id) : true;
    if (!maintenanceExists) {
      return res.status(404).json({
        success: false,
        message: 'Maintenance non trouvée'
      });
    }

    const updated = await RoomMaintenance.update(id, req.body);
    if (!updated) {
      return res.status(400).json({
        success: false,
        message: 'Aucune modification apportée'
      });
    }

    const updatedMaintenance = await RoomMaintenance.findById(id);

    res.status(200).json({
      success: true,
      message: 'Maintenance mise à jour avec succès',
      data: updatedMaintenance
    });
  } catch (error) {
    console.error('❌ Erreur updateMaintenance:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de la maintenance',
      error: error.message
    });
  }
};

// Mettre à jour le statut d'une maintenance
const updateMaintenanceStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { statut } = req.body;

    if (!statut) {
      return res.status(400).json({
        success: false,
        message: 'Le statut est requis'
      });
    }

    const validStatus = ['OUVERT', 'EN_COURS', 'TERMINE', 'ANNULE'];
    if (!validStatus.includes(statut)) {
      return res.status(400).json({
        success: false,
        message: `Statut invalide. Valeurs autorisées: ${validStatus.join(', ')}`
      });
    }

    const updated = await RoomMaintenance.updateStatus(id, statut);
    if (!updated) {
      return res.status(400).json({
        success: false,
        message: 'Erreur lors de la mise à jour du statut'
      });
    }

    // Si la maintenance est terminée, mettre à jour la date de résolution
    if (statut === 'TERMINE') {
      await RoomMaintenance.resolve(id);
    }

    const updatedMaintenance = await RoomMaintenance.findById(id);

    res.status(200).json({
      success: true,
      message: 'Statut mis à jour avec succès',
      data: updatedMaintenance
    });
  } catch (error) {
    console.error('❌ Erreur updateMaintenanceStatus:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du statut',
      error: error.message    });
  }
};

// Supprimer une maintenance
const deleteMaintenance = async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await RoomMaintenance.delete(id);
    if (!deleted) {
      return res.status(400).json({
        success: false,
        message: 'Erreur lors de la suppression'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Maintenance supprimée avec succès'
    });
  } catch (error) {
    console.error('❌ Erreur deleteMaintenance:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de la maintenance',
      error: error.message
    });
  }
};

// Statistiques des maintenances
const getMaintenanceStats = async (req, res) => {
  try {
    const stats = await RoomMaintenance.getStats();

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('❌ Erreur getMaintenanceStats:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques',
      error: error.message
    });
  }
};

module.exports = {
  getMaintenances,
  getMaintenanceById,
  createMaintenance,
  updateMaintenance,
  updateMaintenanceStatus,
  deleteMaintenance,
  getMaintenanceStats
};