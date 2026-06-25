const RoomType = require('../Models/roomtype.model');

// Récupérer tous les types de chambres
const getRoomTypes = async (req, res) => {
  try {
    const roomTypes = await RoomType.findAll();

    res.status(200).json({
      success: true,
      count: roomTypes.length,
      data: roomTypes
    });
  } catch (error) { 
    console.error('❌ Erreur getRoomTypes:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des types de chambres',
      error: error.message
    });
  }
};

// Récupérer un type par ID
const getRoomTypeById = async (req, res) => {
  try {
    const { id } = req.params;
    const roomType = await RoomType.findById(id);

    if (!roomType) {
      return res.status(404).json({
        success: false,
        message: 'Type de chambre non trouvé'
      });
    }

    res.status(200).json({
      success: true,
      data: roomType
    });
  } catch (error) {
    console.error('❌ Erreur getRoomTypeById:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du type de chambre',
      error: error.message
    });
  }
};

// Créer un type de chambre
const createRoomType = async (req, res) => {
  try {
    const { nom, description } = req.body;

    if (!nom) {
      return res.status(400).json({
        success: false,
        message: 'Le nom est requis'
      });
    }

    const roomTypeId = await RoomType.create({ nom, description });
    const newRoomType = await RoomType.findById(roomTypeId);

    res.status(201).json({
      success: true,
      message: 'Type de chambre créé avec succès',
      data: newRoomType
    });
  } catch (error) {
    console.error('❌ Erreur createRoomType:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du type de chambre',
      error: error.message
    });
  }
};

// Mettre à jour un type de chambre
const updateRoomType = async (req, res) => {
  try {
    const { id } = req.params;
    const { nom, description } = req.body;

    const roomType = await RoomType.findById(id);
    if (!roomType) {
      return res.status(404).json({
        success: false,
        message: 'Type de chambre non trouvé'
      });
    }

    const updated = await RoomType.update(id, { nom, description });
    if (!updated) {
      return res.status(400).json({
        success: false,
        message: 'Aucune modification apportée'
      });
    }

    const updatedRoomType = await RoomType.findById(id);

    res.status(200).json({
      success: true,
      message: 'Type de chambre mis à jour avec succès',
      data: updatedRoomType
    });
  } catch (error) {
    console.error('❌ Erreur updateRoomType:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du type de chambre',
      error: error.message
    });
  }
};

// Supprimer un type de chambre
const deleteRoomType = async (req, res) => {
  try {
    const { id } = req.params;

    const roomType = await RoomType.findById(id);
    if (!roomType) {
      return res.status(404).json({
        success: false,
        message: 'Type de chambre non trouvé'
      });
    }

    const deleted = await RoomType.delete(id);
    if (!deleted) {
      return res.status(400).json({
        success: false,
        message: 'Erreur lors de la suppression'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Type de chambre supprimé avec succès'
    });
  } catch (error) {
    console.error('❌ Erreur deleteRoomType:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du type de chambre',
      error: error.message
    });
  }
};

module.exports = {
  getRoomTypes,
  getRoomTypeById,
  createRoomType,
  updateRoomType,
  deleteRoomType
};