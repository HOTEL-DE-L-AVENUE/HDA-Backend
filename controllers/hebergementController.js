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

async function updateMaintenanceStatusHandler(req, res) {
  const { statut } = req.body;
  if (!statut) throw ApiError.badRequest('statut est requis');
  try {
    const maintenance = await heb.updateMaintenanceStatus(req.params.id, statut);
    return ok(res, maintenance);
  } catch (err) {
    throw ApiError.badRequest(err.message);
  }
}

async function maintenanceStatsHandler(req, res) {
  const stats = await heb.getMaintenanceStats();
  return ok(res, stats);
}

async function reservationStatsHandler(req, res) {
  const stats = await heb.getReservationStats();
  return ok(res, stats);
}

async function updateRoomStatusHandler(req, res) {
  const { statut } = req.body;
  if (!statut) throw ApiError.badRequest('statut est requis');
  try {
    const room = await heb.updateRoomStatus(req.params.id, statut);
    return ok(res, room);
  } catch (err) {
    throw ApiError.badRequest(err.message);
  }
}

async function equipmentByCodeHandler(req, res) {
  try {
    const equipment = await heb.getEquipmentByCode(req.params.code);
    return ok(res, equipment);
  } catch (err) {
    throw ApiError.notFound(err.message);
  }
}

async function equipmentCategoriesHandler(req, res) {
  const categories = await heb.getEquipmentCategories();
  return ok(res, categories);
}

async function equipmentStatsHandler(req, res) {
  const stats = await heb.getEquipmentStats();
  return ok(res, stats);
}

async function updateRoomEquipmentStatusHandler(req, res) {
  const { statut } = req.body;
  if (!statut) throw ApiError.badRequest('statut est requis');
  try {
    const roomEquipment = await heb.updateRoomEquipmentStatus(req.params.id, statut);
    return ok(res, roomEquipment);
  } catch (err) {
    throw ApiError.badRequest(err.message);
  }
}

async function roomStatsHandler(req, res) {
  const stats = await heb.getRoomStats();
  return ok(res, stats);
}

async function updateHousekeepingStatusHandler(req, res) {
  const { statut } = req.body;
  if (!statut) throw ApiError.badRequest('statut est requis');
  try {
    const task = await heb.updateHousekeepingStatus(req.params.id, statut);
    return ok(res, task);
  } catch (err) {
    throw ApiError.badRequest(err.message);
  }
}

async function housekeepingStatsHandler(req, res) {
  const stats = await heb.getHousekeepingStats();
  return ok(res, stats);
}

module.exports = {
  roomTypesCrud, roomsCrud, equipmentsCrud, roomEquipmentsCrud, roomMaintenanceCrud,
  roomMinibarCrud, roomStatusHistoryCrud, reservationsCrud, reservationGuestsCrud,
  staysCrud, housekeepingCrud, lostAndFoundCrud, minibarConsumptionsCrud,
  availabilityHandler, availableRoomsHandler, createReservationHandler, checkInHandler, checkOutHandler,
  updateMaintenanceStatusHandler, maintenanceStatsHandler, reservationStatsHandler,
  updateRoomStatusHandler, equipmentByCodeHandler, equipmentCategoriesHandler,
  equipmentStatsHandler, updateRoomEquipmentStatusHandler,
  roomStatsHandler, updateHousekeepingStatusHandler, housekeepingStatsHandler,
};