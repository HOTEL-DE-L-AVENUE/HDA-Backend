const Reservation = require('../Models/Reservation');
const Room = require('../Models/Room');

// Créer une réservation
const createReservation = async (req, res) => {
  try {
    console.log('📥 Création réservation - Données reçues:', req.body);

    const { 
      client_id, room_id, date_arrivee, date_depart, 
      montant_total, statut, notes 
    } = req.body;

    // Validation
    if (!client_id || !room_id || !date_arrivee || !date_depart || !montant_total) {
      return res.status(400).json({
        success: false,
        message: 'Champs requis: client_id, room_id, date_arrivee, date_depart, montant_total'
      });
    }

    // Vérifier si la chambre existe
    const roomExists = await Room.exists(room_id);
    if (!roomExists) {
      return res.status(404).json({
        success: false,
        message: 'Chambre non trouvée'
      });
    }

    // Vérifier la disponibilité de la chambre
    const availableRooms = await Room.findAvailable(date_arrivee, date_depart);
    const isAvailable = availableRooms.some(r => r.id === parseInt(room_id));
    if (!isAvailable) {
      return res.status(400).json({
        success: false,
        message: 'La chambre n\'est pas disponible pour ces dates'
      });
    }

    const reservationId = await Reservation.create({
      client_id,
      room_id,
      date_arrivee,
      date_depart,
      montant_total,
      statut: statut || 'confirmee',
      notes
    });

    // Mettre à jour le statut de la chambre
    await Room.updateStatus(room_id, 'reservée');

    const newReservation = await Reservation.findById(reservationId);

    res.status(201).json({
      success: true,
      message: 'Réservation créée avec succès',
      data: newReservation
    });
  } catch (error) {
    console.error('❌ Erreur lors de la création de la réservation:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de la réservation',
      error: error.message
    });
  }
};

// Récupérer toutes les réservations
const getReservations = async (req, res) => {
  try {
    const { statut, room_id, client_id, date_arrivee, date_depart } = req.query;
    
    const filters = {};
    if (statut) filters.statut = statut;
    if (room_id) filters.room_id = parseInt(room_id);
    if (client_id) filters.client_id = parseInt(client_id);
    if (date_arrivee) filters.date_arrivee = date_arrivee;
    if (date_depart) filters.date_depart = date_depart;

    const reservations = await Reservation.findAll(filters);

    res.status(200).json({
      success: true,
      count: reservations.length,
      data: reservations
    });
  } catch (error) {
    console.error('❌ Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des réservations'
    });
  }
};

// Récupérer une réservation par ID
const getReservationById = async (req, res) => {
  try {
    const { id } = req.params;
    const reservation = await Reservation.findById(parseInt(id));
    
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
    console.error('❌ Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de la réservation'
    });
  }
};

// Mettre à jour une réservation
const updateReservation = async (req, res) => {
  try {
    const { id } = req.params;
    
    const reservationExists = await Reservation.exists(parseInt(id));
    if (!reservationExists) {
      return res.status(404).json({
        success: false,
        message: 'Réservation non trouvée'
      });
    }

    const updated = await Reservation.update(parseInt(id), req.body);
    if (!updated) {
      return res.status(400).json({
        success: false,
        message: 'Aucune modification apportée'
      });
    }

    const updatedReservation = await Reservation.findById(parseInt(id));

    res.status(200).json({
      success: true,
      message: 'Réservation mise à jour avec succès',
      data: updatedReservation
    });
  } catch (error) {
    console.error('❌ Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de la réservation'
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

    const validStatus = ['confirmee', 'en_cours', 'terminee', 'annulee'];
    if (!validStatus.includes(statut)) {
      return res.status(400).json({
        success: false,
        message: `Statut invalide. Valeurs autorisées: ${validStatus.join(', ')}`
      });
    }

    const reservation = await Reservation.findById(parseInt(id));
    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: 'Réservation non trouvée'
      });
    }

    const updated = await Reservation.updateStatus(parseInt(id), statut);
    if (!updated) {
      return res.status(400).json({
        success: false,
        message: 'Erreur lors de la mise à jour du statut'
      });
    }

    // Mettre à jour le statut de la chambre
    if (statut === 'en_cours') {
      await Room.updateStatus(reservation.room_id, 'occupee');
    } else if (statut === 'terminee' || statut === 'annulee') {
      await Room.updateStatus(reservation.room_id, 'disponible');
    }

    const updatedReservation = await Reservation.findById(parseInt(id));

    res.status(200).json({
      success: true,
      message: 'Statut mis à jour avec succès',
      data: updatedReservation
    });
  } catch (error) {
    console.error('❌ Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du statut'
    });
  }
};

// Supprimer une réservation
const deleteReservation = async (req, res) => {
  try {
    const { id } = req.params;
    
    const reservationExists = await Reservation.exists(parseInt(id));
    if (!reservationExists) {
      return res.status(404).json({
        success: false,
        message: 'Réservation non trouvée'
      });
    }

    const reservation = await Reservation.findById(parseInt(id));
    const deleted = await Reservation.delete(parseInt(id));
    
    if (!deleted) {
      return res.status(400).json({
        success: false,
        message: 'Erreur lors de la suppression'
      });
    }

    // Rendre la chambre disponible
    if (reservation && reservation.room_id) {
      const room = await Room.findById(reservation.room_id);
      if (room && (room.statut === 'reservée' || room.statut === 'occupee')) {
        await Room.updateStatus(reservation.room_id, 'disponible');
      }
    }

    res.status(200).json({
      success: true,
      message: 'Réservation supprimée avec succès'
    });
  } catch (error) {
    console.error('❌ Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de la réservation'
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
    console.error('❌ Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques'
    });
  }
};

module.exports = {
  createReservation,
  getReservations,
  getReservationById,
  updateReservation,
  updateReservationStatus,
  deleteReservation,
  getReservationStats
};