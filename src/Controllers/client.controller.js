const Client = require("../Models/Client.model");


// Récupérer tous les clients
const getClients = async (req, res) => {
  try {
    const { nom, statut, is_casino_player } = req.query;
    
    const filters = {};
    if (nom) filters.nom = nom;
    if (statut) filters.statut = statut;
    if (is_casino_player !== undefined) filters.is_casino_player = parseInt(is_casino_player);

    const clients = await Client.findAll(filters);

    res.status(200).json({
      success: true,
      count: clients.length,
      data: clients
    });
  } catch (error) {
    console.error('❌ Erreur getClients:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des clients',
      error: error.message
    });
  }
};

// Récupérer un client par ID
const getClientById = async (req, res) => {
  try {
    const { id } = req.params;
    const client = await Client.findById(id);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client non trouvé'
      });
    }

    res.status(200).json({
      success: true,
      data: client
    });
  } catch (error) {
    console.error('❌ Erreur getClientById:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du client',
      error: error.message
    });
  }
};

// Créer un client
const createClient = async (req, res) => {
  try {
    const { 
      code_client, nom, prenom, telephone, email,
      adresse, date_naissance, type_piece, numero_piece,
      photo_url, is_casino_player, statut 
    } = req.body;

    if (!nom) {
      return res.status(400).json({
        success: false,
        message: 'Le nom est requis'
      });
    }

    // Générer un code client si non fourni
    const clientCode = code_client || `CLI${Date.now().toString().slice(-6)}`;

    const clientId = await Client.create({
      code_client: clientCode,
      nom,
      prenom,
      telephone,
      email,
      adresse,
      date_naissance,
      type_piece,
      numero_piece,
      photo_url,
      is_casino_player: is_casino_player || 0,
      statut: statut || 'ACTIF'
    });

    const newClient = await Client.findById(clientId);

    res.status(201).json({
      success: true,
      message: 'Client créé avec succès',
      data: newClient
    });
  } catch (error) {
    console.error('❌ Erreur createClient:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du client',
      error: error.message
    });
  }
};

// Mettre à jour un client
const updateClient = async (req, res) => {
  try {
    const { id } = req.params;

    const clientExists = await Client.exists(id);
    if (!clientExists) {
      return res.status(404).json({
        success: false,
        message: 'Client non trouvé'
      });
    }

    const updated = await Client.update(id, req.body);
    if (!updated) {
      return res.status(400).json({
        success: false,
        message: 'Aucune modification apportée'
      });
    }

    const updatedClient = await Client.findById(id);

    res.status(200).json({
      success: true,
      message: 'Client mis à jour avec succès',
      data: updatedClient
    });
  } catch (error) {
    console.error('❌ Erreur updateClient:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du client',
      error: error.message
    });
  }
};

// Supprimer un client
const deleteClient = async (req, res) => {
  try {
    const { id } = req.params;

    const clientExists = await Client.exists(id);
    if (!clientExists) {
      return res.status(404).json({
        success: false,
        message: 'Client non trouvé'
      });
    }

    const deleted = await Client.delete(id);
    if (!deleted) {
      return res.status(400).json({
        success: false,
        message: 'Erreur lors de la suppression'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Client supprimé avec succès'
    });
  } catch (error) {
    console.error('❌ Erreur deleteClient:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du client',
      error: error.message
    });
  }
};

module.exports = {
  getClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient
};