const Client = require('../Models/Client.model');
const Reservation = require('../Models/reservation.model');
const Room = require('../Models/room.model');
const Stay = require('../Models/Stay.model');

// Récupérer toutes les réservations
const getReservations = async (req, res) => {
  try {
    const { statut, client_id, room_id, date_arrivee, date_depart } = req.query;
    
    const filters = {};
    if (statut) filters.statut = statut;
    if (client_id) filters.client_id = parseInt(client_id);
    if (room_id) filters.room_id = parseInt(room_id);
    if (date_arrivee) filters.date_arrivee = date_arrivee;
    if (date_depart) filters.date_depart = date_depart;

    const reservations = await Reservation.findAll(filters);

    res.status(200).json({
      success: true,
      count: reservations.length,
      data: reservations
    });
  } catch (error) {
    console.error('❌ Erreur getReservations:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des réservations',
      error: error.message
    });
  }
};

// Récupérer une réservation par ID
const getReservationById = async (req, res) => {
  try {
    const { id } = req.params;
    const reservation = await Reservation.findById(id);

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: 'Réservation non trouvée'
      });
    }

    res.status(200).json({
      success: true,
      data: reservation
    });
  } catch (error) {
    console.error('❌ Erreur getReservationById:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de la réservation',
      error: error.message
    });
  }
};

// Créer une réservation
const createReservation = async (req, res) => {
  try {
    const { 
      client_id, room_id, date_arrivee, date_depart, 
      montant_total, statut 
    } = req.body;

    // Validation des champs requis
    if (!client_id || !room_id || !date_arrivee || !date_depart || !montant_total) {
      return res.status(400).json({
        success: false,
        message: 'Champs requis : client_id, room_id, date_arrivee, date_depart, montant_total'
      });
    }

    // Vérifier si le client existe
    const client = await Client.findById(client_id);
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client non trouvé'
      });
    }

    // Vérifier si la chambre existe
    const room = await Room.findById(room_id);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Chambre non trouvée'
      });
    }

    // Vérifier la disponibilité de la chambre
    const isAvailable = await Room.isAvailable(room_id, date_arrivee, date_depart);
    if (!isAvailable) {
      return res.status(400).json({
        success: false,
        message: 'La chambre n\'est pas disponible pour ces dates'
      });
    }

    // Créer la réservation
    const reservationId = await Reservation.create({
      client_id,
      room_id,
      date_arrivee,
      date_depart,
      montant_total,
      statut: statut || 'CONFIRMEE'
    });

    // Mettre à jour le statut de la chambre
    await Room.updateStatus(room_id, 'RESERVEE');

    const newReservation = await Reservation.findById(reservationId);

    res.status(201).json({
      success: true,
      message: 'Réservation créée avec succès',
      data: newReservation
    });
  } catch (error) {
    console.error('❌ Erreur createReservation:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de la réservation',
      error: error.message
    });
  }
};

// Mettre à jour une réservation
const updateReservation = async (req, res) => {
  try {
    const { id } = req.params;

    const reservationExists = await Reservation.exists(id);
    if (!reservationExists) {
      return res.status(404).json({
        success: false,
        message: 'Réservation non trouvée'
      });
    }

    const updated = await Reservation.update(id, req.body);
    if (!updated) {
      return res.status(400).json({
        success: false,
        message: 'Aucune modification apportée'
      });
    }

    const updatedReservation = await Reservation.findById(id);

    res.status(200).json({
      success: true,
      message: 'Réservation mise à jour avec succès',
      data: updatedReservation
    });
  } catch (error) {
    console.error('❌ Erreur updateReservation:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de la réservation',
      error: error.message
    });
  }
};

// Mettre à jour le statut d'une réservation
const updateReservationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { statut } = req.body;

    if (!statut) {
      return res.status(400).json({
        success: false,
        message: 'Le statut est requis'
      });
    }

    const validStatus = ['CONFIRMEE', 'EN_COURS', 'TERMINEE', 'ANNULEE'];
    if (!validStatus.includes(statut)) {
      return res.status(400).json({
        success: false,
        message: `Statut invalide. Valeurs autorisées: ${validStatus.join(', ')}`
      });
    }

    const reservation = await Reservation.findById(id);
    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: 'Réservation non trouvée'
      });
    }

    const updated = await Reservation.updateStatus(id, statut);
    if (!updated) {
      return res.status(400).json({
        success: false,
        message: 'Erreur lors de la mise à jour du statut'
      });
    }

    // Mettre à jour le statut de la chambre
    if (statut === 'EN_COURS') {
      await Room.updateStatus(reservation.room_id, 'OCCUPEE');
      // Créer le séjour
      await Stay.create({ reservation_id: id, checkin_at: new Date() });
    } else if (statut === 'TERMINEE' || statut === 'ANNULEE') {
      await Room.updateStatus(reservation.room_id, 'LIBRE');
      // Mettre à jour le séjour
      const stays = await Stay.findAll({ reservation_id: id });
      if (stays.length > 0) {
        await Stay.checkout(stays[0].id, new Date());
      }
    }

    const updatedReservation = await Reservation.findById(id);

    res.status(200).json({
      success: true,
      message: 'Statut mis à jour avec succès',
      data: updatedReservation
    });
  } catch (error) {
    console.error('❌ Erreur updateReservationStatus:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du statut',
      error: error.message
    });
  }
};

// Supprimer une réservation
const deleteReservation = async (req, res) => {
  try {
    const { id } = req.params;

    const reservationExists = await Reservation.exists(id);
    if (!reservationExists) {
      return res.status(404).json({
        success: false,
        message: 'Réservation non trouvée'
      });
    }

    const reservation = await Reservation.findById(id);
    const deleted = await Reservation.delete(id);

    if (!deleted) {
      return res.status(400).json({
        success: false,
        message: 'Erreur lors de la suppression'
      });
    }

    // Rendre la chambre disponible
    if (reservation && reservation.room_id) {
      const room = await Room.findById(reservation.room_id);
      if (room && (room.statut === 'RESERVEE' || room.statut === 'OCCUPEE')) {
        await Room.updateStatus(reservation.room_id, 'LIBRE');
      }
    }

    res.status(200).json({
      success: true,
      message: 'Réservation supprimée avec succès'
    });
  } catch (error) {
    console.error('❌ Erreur deleteReservation:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de la réservation',
      error: error.message
    });
  }
};

// Statistiques des réservations
const getReservationStats = async (req, res) => {
  try {
    const stats = await Reservation.getStats();

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('❌ Erreur getReservationStats:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques',
      error: error.message
    });
  }
};

module.exports = {
  getReservations,
  getReservationById,
  createReservation,
  updateReservation,
  updateReservationStatus,
  deleteReservation,
  getReservationStats
};