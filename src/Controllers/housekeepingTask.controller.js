// backend/Controllers/housekeepingTask.controller.js
const HousekeepingTask = require('../Models/housekeepingTask.model');
const Room = require('../Models/room.model');

// Récupérer toutes les tâches
const getTasks = async (req, res) => {
  try {
    console.log('📝 GET /api/housekeeping');
    
    const { statut, room_id, type_tache, assigned_user_id, planned_at } = req.query;
    const filters = {};
    if (statut) filters.statut = statut;
    if (room_id) filters.room_id = parseInt(room_id);
    if (type_tache) filters.type_tache = type_tache;
    if (assigned_user_id) filters.assigned_user_id = parseInt(assigned_user_id);
    if (planned_at) filters.planned_at = planned_at;

    const tasks = await HousekeepingTask.findAll(filters);

    res.status(200).json({
      success: true,
      count: tasks.length,
      data: tasks
    });
  } catch (error) {
    console.error('❌ Erreur getTasks:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des tâches',
      error: error.message
    });
  }
};

// Récupérer une tâche par ID
const getTaskById = async (req, res) => {
  try {
    const { id } = req.params;
    const task = await HousekeepingTask.findById(id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Tâche non trouvée'
      });
    }

    res.status(200).json({
      success: true,
      data: task
    });
  } catch (error) {
    console.error('❌ Erreur getTaskById:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de la tâche',
      error: error.message
    });
  }
};

// Récupérer les tâches d'une chambre
const getTasksByRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    const tasks = await HousekeepingTask.findByRoomId(roomId);

    res.status(200).json({
      success: true,
      count: tasks.length,
      data: tasks
    });
  } catch (error) {
    console.error('❌ Erreur getTasksByRoom:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des tâches de la chambre',
      error: error.message
    });
  }
};

// Récupérer les tâches d'un utilisateur
const getTasksByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const tasks = await HousekeepingTask.findByUserId(userId);

    res.status(200).json({
      success: true,
      count: tasks.length,
      data: tasks
    });
  } catch (error) {
    console.error('❌ Erreur getTasksByUser:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des tâches de l\'utilisateur',
      error: error.message
    });
  }
};

// Créer une tâche
const createTask = async (req, res) => {
  try {
    const {
      room_id, assigned_user_id, type_tache, statut = 'A_FAIRE',
      commentaire, planned_at
    } = req.body;

    if (!room_id || !type_tache) {
      return res.status(400).json({
        success: false,
        message: 'Champs requis: room_id, type_tache'
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

    const taskId = await HousekeepingTask.create({
      room_id,
      assigned_user_id: assigned_user_id || null,
      type_tache,
      statut,
      commentaire: commentaire || null,
      planned_at: planned_at || new Date()
    });

    const newTask = await HousekeepingTask.findById(taskId);

    res.status(201).json({
      success: true,
      message: 'Tâche créée avec succès',
      data: newTask
    });
  } catch (error) {
    console.error('❌ Erreur createTask:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de la tâche',
      error: error.message
    });
  }
};

// Mettre à jour une tâche
const updateTask = async (req, res) => {
  try {
    const { id } = req.params;

    const task = await HousekeepingTask.findById(id);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Tâche non trouvée'
      });
    }

    const updated = await HousekeepingTask.update(id, req.body);
    if (!updated) {
      return res.status(400).json({
        success: false,
        message: 'Aucune modification apportée'
      });
    }

    const updatedTask = await HousekeepingTask.findById(id);

    res.status(200).json({
      success: true,
      message: 'Tâche mise à jour avec succès',
      data: updatedTask
    });
  } catch (error) {
    console.error('❌ Erreur updateTask:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de la tâche',
      error: error.message
    });
  }
};

// Mettre à jour le statut d'une tâche
const updateTaskStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { statut } = req.body;

    if (!statut) {
      return res.status(400).json({
        success: false,
        message: 'Le statut est requis'
      });
    }

    const validStatus = ['A_FAIRE', 'EN_COURS', 'TERMINE'];
    if (!validStatus.includes(statut)) {
      return res.status(400).json({
        success: false,
        message: `Statut invalide. Valeurs autorisées: ${validStatus.join(', ')}`
      });
    }

    const task = await HousekeepingTask.findById(id);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Tâche non trouvée'
      });
    }

    if (statut === 'TERMINE') {
      await HousekeepingTask.complete(id);
    } else {
      await HousekeepingTask.updateStatus(id, statut);
    }

    const updatedTask = await HousekeepingTask.findById(id);

    res.status(200).json({
      success: true,
      message: 'Statut mis à jour avec succès',
      data: updatedTask
    });
  } catch (error) {
    console.error('❌ Erreur updateTaskStatus:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du statut',
      error: error.message
    });
  }
};

// Supprimer une tâche
const deleteTask = async (req, res) => {
  try {
    const { id } = req.params;

    const task = await HousekeepingTask.findById(id);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Tâche non trouvée'
      });
    }

    const deleted = await HousekeepingTask.delete(id);
    if (!deleted) {
      return res.status(400).json({
        success: false,
        message: 'Erreur lors de la suppression'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Tâche supprimée avec succès'
    });
  } catch (error) {
    console.error('❌ Erreur deleteTask:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de la tâche',
      error: error.message
    });
  }
};

// Statistiques
const getTaskStats = async (req, res) => {
  try {
    const stats = await HousekeepingTask.getStats();

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('❌ Erreur getTaskStats:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques',
      error: error.message
    });
  }
};

module.exports = {
  getTasks,
  getTaskById,
  getTasksByRoom,
  getTasksByUser,
  createTask,
  updateTask,
  updateTaskStatus,
  deleteTask,
  getTaskStats
};