// controllers/hebergementController.js
const heb = require('../models/hebergementModel');
const stock = require('../models/stockModel');
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
  const { client_id, room_id, date_arrivee, date_depart, montant_total, guests, statut } = req.body;
  if (!client_id || !room_id || !date_arrivee || !date_depart) {
    throw ApiError.badRequest('client_id, room_id, date_arrivee, date_depart sont requis');
  }
  const disponible = await heb.isRoomAvailable(room_id, date_arrivee, date_depart);
  if (!disponible) throw ApiError.conflict('Chambre non disponible sur cette période');

  const reservation = await heb.createReservationWithGuests({
    clientId: client_id,
    roomId: room_id,
    dateArrivee: date_arrivee,
    dateDepart: date_depart,
    montantTotal: montant_total,
    statut: statut || 'EN_COURS',
    guests: guests || [],
  });
  const reservationWithDetails = await heb.Reservations.findById(reservation.id);
  return created(res, reservationWithDetails);
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

// --- Minibar Stock Management Handlers ---

async function transferStockToMinibarHandler(req, res) {
  const { product_id, source_location_id, quantity, room_id } = req.body;
  if (!product_id || !source_location_id || !quantity || !room_id) {
    throw ApiError.badRequest('product_id, source_location_id, quantity, room_id sont requis');
  }
  const result = await heb.transferStockToMinibar({
    productId: product_id,
    sourceLocationId: source_location_id,
    quantity: quantity,
    roomId: room_id,
    userId: req.user?.id,
  });
  return ok(res, result);
}

async function handleMinibarConsumptionHandler(req, res) {
  const { room_id, product_id, quantity, client_id, price } = req.body;
  if (!room_id || !product_id || !quantity || !client_id || !price) {
    throw ApiError.badRequest('room_id, product_id, quantity, client_id, price sont requis');
  }
  const consumptionId = await heb.handleMinibarConsumption({
    roomId: room_id,
    productId: product_id,
    quantity: quantity,
    clientId: client_id,
    price: price,
  });
  return created(res, { id: consumptionId, message: 'Consommation enregistrée avec succès' });
}

async function getMinibarWithAlertsHandler(req, res) {
  const items = await heb.getMinibarWithAlerts();
  return ok(res, items);
}

async function restockMinibarHandler(req, res) {
  const { room_id, product_id, quantity } = req.body;
  if (!room_id || !product_id || !quantity) {
    throw ApiError.badRequest('room_id, product_id, quantity sont requis');
  }
  const result = await heb.restockMinibar({
    roomId: room_id,
    productId: product_id,
    quantity: quantity,
    userId: req.user?.id,
  });
  return ok(res, result);
}

async function getLowStockMinibarHandler(req, res) {
  const items = await heb.getLowStockMinibarItems();
  return ok(res, items);
}

// --- Accommodation Stock Management Handlers ---

async function getHebergementStockHandler(req, res) {
  try {
    const { pool } = require('../config/db');
    const [rows] = await pool.query(`
      SELECT hp.*, hs.quantite, hs.seuil_minimum, hs.unite
      FROM hebergement_products hp
      LEFT JOIN hebergement_stock hs ON hs.product_id = hp.id
      ORDER BY hp.id DESC
    `);
    return ok(res, rows);
  } catch (err) {
    throw ApiError.internalError('Erreur lors de la récupération du stock hébergement');
  }
}

async function addHebergementStockHandler(req, res) {
  try {
    const { nom, categorie, quantite, prix, unite, seuil_minimum } = req.body;
    const { withTransaction } = require('../config/db');
    
    if (!nom || !categorie) {
      throw ApiError.badRequest('nom et categorie sont requis');
    }

    const result = await withTransaction(async (conn) => {
      const [productResult] = await conn.query(
        'INSERT INTO hebergement_products (nom, categorie, prix, source_module) VALUES (?, ?, ?, ?)',
        [nom, categorie, prix || 0, 'HEBERGEMENT']
      );
      const productId = productResult.insertId;
      
      await conn.query(
        'INSERT INTO hebergement_stock (product_id, quantite, seuil_minimum, unite) VALUES (?, ?, ?, ?)',
        [productId, quantite || 0, seuil_minimum || 5, unite || 'unités']
      );
      
      // Record financial transaction for stock addition (outflow)
      const totalValue = Number(prix || 0) * Number(quantite || 0);
      if (totalValue > 0) {
        await conn.query(
          `INSERT INTO financial_transactions
             (module, type_flux, montant, reference_id, ref_flux_global, description, statut_sync, created_at)
           VALUES (?, 'SORTIE', ?, ?, ?, ?, 'SYNCED', NOW())`,
          ['HEBERGEMENT', totalValue, productId,
            `HEBERGEMENT-STOCK-ADD-${productId}`,
            `Achat stock hébergement: ${nom} (${quantite || 0} ${unite || 'unités'})`
          ]
        );
      }
      
      return {
        id: productId,
        nom,
        categorie,
        prix: prix || 0,
        quantite: quantite || 0,
        seuil_minimum: seuil_minimum || 5,
        unite: unite || 'unités'
      };
    });
    
    return created(res, result);
  } catch (err) {
    throw ApiError.internalError('Erreur lors de la création du stock hébergement: ' + err.message);
  }
}

async function updateHebergementStockHandler(req, res) {
  try {
    const { id } = req.params;
    const { nom, categorie, quantite, prix, unite, seuil_minimum } = req.body;
    const { withTransaction } = require('../config/db');

    const result = await withTransaction(async (conn) => {
      // Get current stock and product info
      const [currentProduct] = await conn.query(
        'SELECT * FROM hebergement_products WHERE id = ?',
        [id]
      );
      const [currentStock] = await conn.query(
        'SELECT * FROM hebergement_stock WHERE product_id = ?',
        [id]
      );
      
      // Update product
      await conn.query(
        'UPDATE hebergement_products SET nom=?, categorie=?, prix=? WHERE id=?',
        [nom, categorie, prix || 0, id]
      );
      
      // Update stock - try update first, then insert if needed
      const [updateResult] = await conn.query(
        'UPDATE hebergement_stock SET quantite=?, seuil_minimum=?, unite=? WHERE product_id=?',
        [quantite || 0, seuil_minimum || 5, unite || 'unités', id]
      );
      
      if (updateResult.affectedRows === 0) {
        await conn.query(
          'INSERT INTO hebergement_stock (product_id, quantite, seuil_minimum, unite) VALUES (?, ?, ?, ?)',
          [id, quantite || 0, seuil_minimum || 5, unite || 'unités']
        );
      }
      
      // Record financial transaction for stock increase (outflow)
      const oldQuantity = currentStock[0] ? Number(currentStock[0].quantite || 0) : 0;
      const newQuantity = Number(quantite || 0);
      const quantityIncrease = newQuantity - oldQuantity;
      
      if (quantityIncrease > 0) {
        const totalValue = Number(prix || 0) * quantityIncrease;
        if (totalValue > 0) {
          await conn.query(
            `INSERT INTO financial_transactions
               (module, type_flux, montant, reference_id, ref_flux_global, description, statut_sync, created_at)
             VALUES (?, 'SORTIE', ?, ?, ?, ?, 'SYNCED', NOW())`,
            ['HEBERGEMENT', totalValue, id,
              `HEBERGEMENT-STOCK-UPDATE-${id}`,
              `Achat stock hébergement: ${nom} (+${quantityIncrease} ${unite || 'unités'})`
            ]
          );
        }
      }
      
      return {
        id,
        nom,
        categorie,
        prix: prix || 0,
        quantite: quantite || 0,
        seuil_minimum: seuil_minimum || 5,
        unite: unite || 'unités'
      };
    });
    
    return ok(res, result);
  } catch (err) {
    console.error('Update stock error:', err);
    throw ApiError.internalError('Erreur lors de la mise à jour du stock hébergement: ' + err.message);
  }
}

async function deleteHebergementStockHandler(req, res) {
  try {
    const { id } = req.params;
    const { withTransaction } = require('../config/db');
    
    await withTransaction(async (conn) => {
      // Get product info before deletion for financial transaction
      const [product] = await conn.query(
        'SELECT * FROM hebergement_products WHERE id = ?',
        [id]
      );
      const [stock] = await conn.query(
        'SELECT * FROM hebergement_stock WHERE product_id = ?',
        [id]
      );
      
      if (product[0] && stock[0]) {
        const totalValue = Number(product[0].prix || 0) * Number(stock[0].quantite || 0);
        
        // Create financial transaction for stock removal (refund/return)
        if (totalValue > 0) {
          await conn.query(
            `INSERT INTO financial_transactions
               (module, type_flux, montant, reference_id, ref_flux_global, description, statut_sync, created_at)
             VALUES (?, 'ENTREE', ?, ?, ?, ?, 'SYNCED', NOW())`,
            ['HEBERGEMENT', totalValue, id,
              `HEBERGEMENT-STOCK-DELETE-${id}`,
              `Remboursement stock hébergement: ${product[0].nom} (${stock[0].quantite} ${stock[0].unite || 'unités'})`]
          );
        }
      }
      
      await conn.query('DELETE FROM hebergement_stock WHERE product_id = ?', [id]);
      await conn.query('DELETE FROM hebergement_products WHERE id = ?', [id]);
    });
    
    return ok(res, { message: 'Stock supprimé avec succès' });
  } catch (err) {
    throw ApiError.internalError('Erreur lors de la suppression du stock hébergement: ' + err.message);
  }
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
  transferStockToMinibarHandler, handleMinibarConsumptionHandler, getMinibarWithAlertsHandler, restockMinibarHandler, getLowStockMinibarHandler,
  getHebergementStockHandler, addHebergementStockHandler, updateHebergementStockHandler, deleteHebergementStockHandler,
};

const hebergementModel = require('../models/hebergementModel');

exports.checkIn = async (req, res) => {
  try {
    const stay = await hebergementModel.checkIn(req.params.id);
    res.status(200).json({ message: 'Check-in réussi', stay });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};