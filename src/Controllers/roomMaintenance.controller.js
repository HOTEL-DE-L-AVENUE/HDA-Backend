// backend/Controllers/maintenance.controller.js
const RoomMaintenance = require('../Models/roomMaintenance.model');

// Récupérer toutes les maintenances
const getMaintenances = async (req, res) => {
  try {
    console.log('📝 [GET] /api/maintenances');
    console.log('📋 Query params:', req.query);
    
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
    console.error('❌ [GET] /api/maintenances - Erreur:', error);
    console.error('❌ Stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des maintenances',
      error: error.message,
      stack: error.stack
    });
  }
};

// Récupérer une maintenance par ID
const getMaintenanceById = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`📝 [GET] /api/maintenances/${id}`);

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
    console.error(`❌ [GET] /api/maintenances/${id} - Erreur:`, error);
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
    console.log('📝 [POST] /api/maintenances');
    console.log('📋 Body:', req.body);

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

    const maintenanceId = await RoomMaintenance.create({
      room_id,
      equipment_id: equipment_id || null,
      type_intervention,
      description: description || null,
      statut: statut || 'OUVERT',
      date_declaration: date_declaration || new Date(),
      cout: cout || 0,
      created_by: created_by || null
    });

    const newMaintenance = await RoomMaintenance.findById(maintenanceId);

    res.status(201).json({
      success: true,
      message: 'Maintenance créée avec succès',
      data: newMaintenance
    });
  } catch (error) {
    console.error('❌ [POST] /api/maintenances - Erreur:', error);
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
    console.log(`📝 [PUT] /api/maintenances/${id}`);
    console.log('📋 Body:', req.body);

    const maintenance = await RoomMaintenance.findById(id);
    if (!maintenance) {
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
    console.error(`❌ [PUT] /api/maintenances/${id} - Erreur:`, error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de la maintenance',
      error: error.message
    });
  }
};

// Mettre à jour le statut
const updateMaintenanceStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { statut } = req.body;
    console.log(`📝 [PUT] /api/maintenances/${id}/status`);
    console.log('📋 Body:', req.body);

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

    const maintenance = await RoomMaintenance.findById(id);
    if (!maintenance) {
      return res.status(404).json({
        success: false,
        message: 'Maintenance non trouvée'
      });
    }

    if (statut === 'TERMINE') {
      await RoomMaintenance.resolve(id);
    } else {
      await RoomMaintenance.updateStatus(id, statut);
    }

    const updatedMaintenance = await RoomMaintenance.findById(id);

    res.status(200).json({
      success: true,
      message: 'Statut mis à jour avec succès',
      data: updatedMaintenance
    });
  } catch (error) {
    console.error(`❌ [PUT] /api/maintenances/${id}/status - Erreur:`, error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du statut',
      error: error.message
    });
  }
};

// Supprimer une maintenance
const deleteMaintenance = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`📝 [DELETE] /api/maintenances/${id}`);

    const maintenance = await RoomMaintenance.findById(id);
    if (!maintenance) {
      return res.status(404).json({
        success: false,
        message: 'Maintenance non trouvée'
      });
    }

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
    console.error(`❌ [DELETE] /api/maintenances/${id} - Erreur:`, error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de la maintenance',
      error: error.message
    });
  }
};

// Statistiques
const getMaintenanceStats = async (req, res) => {
  try {
    console.log('📝 [GET] /api/maintenances/stats');

    const stats = await RoomMaintenance.getStats();

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('❌ [GET] /api/maintenances/stats - Erreur:', error);
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