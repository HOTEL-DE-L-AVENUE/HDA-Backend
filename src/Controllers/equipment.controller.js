const Equipment = require('../Models/equipment.model');

// =============================================
// Récupérer tous les équipements
// =============================================
const getEquipments = async (req, res) => {
  try {
    const { categorie, nom, code } = req.query;
    const filters = {};
    if (categorie) filters.categorie = categorie;
    if (nom) filters.nom = nom;
    if (code) filters.code = code;

    const equipments = await Equipment.findAll(filters);

    res.status(200).json({
      success: true,
      count: equipments.length,
      data: equipments
    });
  } catch (error) {
    console.error('❌ Erreur getEquipments:', error);
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
const getEquipmentById = async (req, res) => {
  try {
    const { id } = req.params;
    const equipment = await Equipment.findById(id);

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
    console.error('❌ Erreur getEquipmentById:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de l\'équipement',
      error: error.message
    });
  }
};

// =============================================
// Récupérer un équipement par code
// =============================================
const getEquipmentByCode = async (req, res) => {
  try {
    const { code } = req.params;
    const equipment = await Equipment.findByCode(code);

    if (!equipment) {
      return res.status(404).json({
        success: false,
        message: `Équipement avec le code ${code} non trouvé`
      });
    }

    res.status(200).json({
      success: true,
      data: equipment
    });
  } catch (error) {
    console.error('❌ Erreur getEquipmentByCode:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de l\'équipement',
      error: error.message
    });
  }
};

// =============================================
// Récupérer les catégories
// =============================================
const getEquipmentCategories = async (req, res) => {
  try {
    const categories = await Equipment.getCategories();

    res.status(200).json({
      success: true,
      count: categories.length,
      data: categories
    });
  } catch (error) {
    console.error('❌ Erreur getEquipmentCategories:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des catégories',
      error: error.message
    });
  }
};

// =============================================
// Créer un équipement
// =============================================
const createEquipment = async (req, res) => {
  try {
    const { code, nom, categorie, description } = req.body;

    if (!nom) {
      return res.status(400).json({
        success: false,
        message: 'Le champ "nom" est requis'
      });
    }

    // Vérifier si le code existe déjà
    if (code) {
      const existing = await Equipment.findByCode(code);
      if (existing) {
        return res.status(400).json({
          success: false,
          message: `Un équipement avec le code ${code} existe déjà`
        });
      }
    }

    const equipmentId = await Equipment.create({
      code,
      nom,
      categorie,
      description
    });

    const newEquipment = await Equipment.findById(equipmentId);

    res.status(201).json({
      success: true,
      message: 'Équipement créé avec succès',
      data: newEquipment
    });
  } catch (error) {
    console.error('❌ Erreur createEquipment:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de l\'équipement',
      error: error.message
    });
  }
};

// =============================================
// Mettre à jour un équipement
// =============================================
const updateEquipment = async (req, res) => {
  try {
    const { id } = req.params;

    const equipment = await Equipment.findById(id);
    if (!equipment) {
      return res.status(404).json({
        success: false,
        message: 'Équipement non trouvé'
      });
    }

    // Vérifier si le nouveau code existe déjà
    if (req.body.code) {
      const existing = await Equipment.findByCode(req.body.code);
      if (existing && existing.id !== parseInt(id)) {
        return res.status(400).json({
          success: false,
          message: `Un équipement avec le code ${req.body.code} existe déjà`
        });
      }
    }

    const updated = await Equipment.update(id, req.body);
    if (!updated) {
      return res.status(400).json({
        success: false,
        message: 'Aucune modification apportée'
      });
    }

    const updatedEquipment = await Equipment.findById(id);

    res.status(200).json({
      success: true,
      message: 'Équipement mis à jour avec succès',
      data: updatedEquipment
    });
  } catch (error) {
    console.error('❌ Erreur updateEquipment:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de l\'équipement',
      error: error.message
    });
  }
};

// =============================================
// Supprimer un équipement
// =============================================
const deleteEquipment = async (req, res) => {
  try {
    const { id } = req.params;

    const equipment = await Equipment.findById(id);
    if (!equipment) {
      return res.status(404).json({
        success: false,
        message: 'Équipement non trouvé'
      });
    }

    // Vérifier si l'équipement est utilisé
    const deleted = await Equipment.delete(id);
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
    console.error('❌ Erreur deleteEquipment:', error);
    if (error.message.includes('utilisé')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de l\'équipement',
      error: error.message
    });
  }
};

// =============================================
// Statistiques des équipements
// =============================================
const getEquipmentStats = async (req, res) => {
  try {
    const stats = await Equipment.getStats();

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('❌ Erreur getEquipmentStats:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques',
      error: error.message
    });
  }
};

module.exports = {
  getEquipments,
  getEquipmentById,
  getEquipmentByCode,
  getEquipmentCategories,
  createEquipment,
  updateEquipment,
  deleteEquipment,
  getEquipmentStats
};