// controllers/hebergementController.js
const heb = require('../models/hebergementModel');
const { createCrudController } = require('./controllerFactory');
const ApiError = require('../utils/ApiError');
const { ok, created } = require('../utils/apiResponse');

const roomTypesCrud = createCrudController(heb.RoomTypes, {});
const roomsCrud = createCrudController(heb.Rooms, { filterable: ['statut', 'room_type_id'] });
const equipmentsCrud = createCrudController(heb.Equipments, { filterable: ['categorie'] });
const roomEquipmentsCrud = createCrudController(heb.RoomEquipments, { filterable: ['room_id', 'statut'] });
const roomMaintenanceCrud = createCrudController(heb.RoomMaintenance, { filterable: ['room_id', 'statut', 'type_intervention'] });
const roomMinibarCrud = createCrudController(heb.RoomMinibar, { filterable: ['room_id'] });
const roomStatusHistoryCrud = createCrudController(heb.RoomStatusHistory, { filterable: ['room_id'] });
const reservationsCrud = createCrudController(heb.Reservations, { filterable: ['client_id', 'room_id', 'statut'] });
const reservationGuestsCrud = createCrudController(heb.ReservationGuests, { filterable: ['reservation_id'] });
const staysCrud = createCrudController(heb.Stays, { filterable: ['reservation_id'] });
const housekeepingCrud = createCrudController(heb.HousekeepingTasks, { filterable: ['room_id', 'statut', 'assigned_user_id'] });
const lostAndFoundCrud = createCrudController(heb.LostAndFound, { filterable: ['room_id', 'statut'] });
const minibarConsumptionsCrud = createCrudController(heb.MinibarConsumptions, { filterable: ['room_id', 'client_id', 'facturee'] });

// --- Logique métier ----------------------------------------------------------

async function availabilityHandler(req, res) {
  const { room_id, date_arrivee, date_depart } = req.query;
  if (!room_id || !date_arrivee || !date_depart) throw ApiError.badRequest('room_id, date_arrivee, date_depart sont requis');
  const disponible = await heb.isRoomAvailable(room_id, date_arrivee, date_depart);
  return ok(res, { room_id: Number(room_id), disponible });
}

async function availableRoomsHandler(req, res) {
  const rows = await heb.availableRooms({ typeId: req.query.room_type_id });
  return ok(res, rows);
}

async function createReservationHandler(req, res) {
  const { client_id, room_id, date_arrivee, date_depart, montant_total, guests } = req.body;
  if (!client_id || !room_id || !date_arrivee || !date_depart) {
    throw ApiError.badRequest('client_id, room_id, date_arrivee, date_depart sont requis');
  }
  const disponible = await heb.isRoomAvailable(room_id, date_arrivee, date_depart);
  if (!disponible) throw ApiError.conflict('Chambre non disponible sur cette période');

  const reservation = await heb.createReservationWithGuests({
    clientId: client_id, roomId: room_id, dateArrivee: date_arrivee, dateDepart: date_depart,
    montantTotal: montant_total, guests: guests || [],
  });
  return created(res, reservation);
}

async function checkInHandler(req, res) {
  try {
    const stay = await heb.checkIn(req.params.reservationId);
    return created(res, stay);
  } catch (err) {
    throw ApiError.badRequest(err.message);
  }
}

async function checkOutHandler(req, res) {
  try {
    const stay = await heb.checkOut(req.params.stayId);
    return ok(res, stay);
  } catch (err) {
    throw ApiError.badRequest(err.message);
  }
}

module.exports = {
  roomTypesCrud, roomsCrud, equipmentsCrud, roomEquipmentsCrud, roomMaintenanceCrud,
  roomMinibarCrud, roomStatusHistoryCrud, reservationsCrud, reservationGuestsCrud,
  staysCrud, housekeepingCrud, lostAndFoundCrud, minibarConsumptionsCrud,
  availabilityHandler, availableRoomsHandler, createReservationHandler, checkInHandler, checkOutHandler,
};
