// models/hebergementModel.js
const { pool, withTransaction } = require('../config/db');
const { createCrudModel } = require('./crudFactory');

const RoomTypes = createCrudModel({
  table: 'room_types', pk: 'id', fields: ['nom', 'description'], sortable: ['id', 'nom'],
});

const Rooms = createCrudModel({
  table: 'rooms', pk: 'id',
  fields: ['room_type_id', 'numero', 'capacite', 'prix_nuit', 'statut'],
  sortable: ['id', 'numero', 'statut', 'prix_nuit'],
});

const Equipments = createCrudModel({
  table: 'equipments', pk: 'id',
  fields: ['code', 'nom', 'categorie', 'description'],
  sortable: ['id', 'nom', 'categorie'],
});

const RoomEquipments = createCrudModel({
  table: 'room_equipments', pk: 'id',
  fields: ['room_id', 'equipment_id', 'quantite', 'statut'],
  sortable: ['id', 'statut'],
});

const RoomMaintenance = createCrudModel({
  table: 'room_maintenance', pk: 'id',
  fields: ['room_id', 'equipment_id', 'type_intervention', 'description', 'statut',
    'date_declaration', 'date_resolution', 'cout', 'created_by'],
  sortable: ['id', 'statut', 'date_declaration'],
});

const RoomMinibar = createCrudModel({
  table: 'room_minibar', pk: 'id',
  fields: ['room_id', 'product_id', 'quantite', 'seuil_alerte'],
  sortable: ['id', 'quantite'],
});

const RoomStatusHistory = createCrudModel({
  table: 'room_status_history', pk: 'id',
  fields: ['room_id', 'ancien_statut', 'nouveau_statut', 'commentaire', 'changed_by', 'changed_at'],
  sortable: ['id', 'changed_at'],
});

const Reservations = createCrudModel({
  table: 'reservations', pk: 'id',
  fields: ['client_id', 'room_id', 'date_arrivee', 'date_depart', 'montant_total', 'statut'],
  sortable: ['id', 'date_arrivee', 'date_depart', 'statut'],
});

const ReservationGuests = createCrudModel({
  table: 'reservation_guests', pk: 'id',
  fields: ['reservation_id', 'nom', 'prenom', 'date_naissance', 'type_piece', 'numero_piece'],
  sortable: ['id', 'nom'],
});

const Stays = createCrudModel({
  table: 'stays', pk: 'id',
  fields: ['reservation_id', 'checkin_at', 'checkout_at'],
  sortable: ['id', 'checkin_at', 'checkout_at'],
});

const HousekeepingTasks = createCrudModel({
  table: 'housekeeping_tasks', pk: 'id',
  fields: ['room_id', 'assigned_user_id', 'type_tache', 'statut', 'commentaire', 'planned_at', 'completed_at'],
  sortable: ['id', 'statut', 'planned_at'],
});

const LostAndFound = createCrudModel({
  table: 'lost_and_found', pk: 'id',
  fields: ['room_id', 'client_id', 'objet', 'description', 'date_trouvee', 'statut', 'date_restitution'],
  sortable: ['id', 'date_trouvee', 'statut'],
});

const MinibarConsumptions = createCrudModel({
  table: 'minibar_consumptions', pk: 'id',
  fields: ['room_id', 'client_id', 'product_id', 'quantite', 'prix_unitaire', 'montant', 'facturee', 'consumed_at'],
  sortable: ['id', 'consumed_at', 'facturee'],
});

// --- Logique métier -------------------------------------------------------

// Vérifie la disponibilité d'une chambre sur une période donnée
async function isRoomAvailable(roomId, dateArrivee, dateDepart, excludeReservationId = null) {
  let sql = `
    SELECT COUNT(*) AS conflits FROM reservations
    WHERE room_id = ? AND statut NOT IN ('ANNULEE', 'TERMINEE')
    AND NOT (date_depart <= ? OR date_arrivee >= ?)`;
  const params = [roomId, dateArrivee, dateDepart];
  if (excludeReservationId) {
    sql += ' AND id != ?';
    params.push(excludeReservationId);
  }
  const [rows] = await pool.query(sql, params);
  return rows[0].conflits === 0;
}

// Crée une réservation + ses accompagnants dans une transaction
async function createReservationWithGuests({ clientId, roomId, dateArrivee, dateDepart, montantTotal, guests = [] }) {
  return withTransaction(async (conn) => {
    const [result] = await conn.query(
      `INSERT INTO reservations (client_id, room_id, date_arrivee, date_depart, montant_total, statut)
       VALUES (?, ?, ?, ?, ?, 'CONFIRMEE')`,
      [clientId, roomId, dateArrivee, dateDepart, montantTotal]
    );
    const reservationId = result.insertId;
    for (const g of guests) {
      await conn.query(
        `INSERT INTO reservation_guests (reservation_id, nom, prenom, date_naissance, type_piece, numero_piece)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [reservationId, g.nom, g.prenom || null, g.date_naissance || null, g.type_piece || null, g.numero_piece || null]
      );
    }
    await conn.query('UPDATE rooms SET statut = "RESERVEE" WHERE id = ?', [roomId]);
    const [row] = await conn.query('SELECT * FROM reservations WHERE id = ?', [reservationId]);
    return row[0];
  });
}

// Check-in : crée le séjour et passe la chambre en "OCCUPEE"
async function checkIn(reservationId) {
  return withTransaction(async (conn) => {
    const [resRows] = await conn.query('SELECT * FROM reservations WHERE id = ?', [reservationId]);
    const reservation = resRows[0];
    if (!reservation) throw new Error(`Réservation #${reservationId} introuvable`);

    const [result] = await conn.query(
      'INSERT INTO stays (reservation_id, checkin_at) VALUES (?, NOW())',
      [reservationId]
    );
    await conn.query('UPDATE rooms SET statut = "OCCUPEE" WHERE id = ?', [reservation.room_id]);
    await conn.query(
      `INSERT INTO room_status_history (room_id, ancien_statut, nouveau_statut, changed_at)
       VALUES (?, 'RESERVEE', 'OCCUPEE', NOW())`,
      [reservation.room_id]
    );
    const [stay] = await conn.query('SELECT * FROM stays WHERE id = ?', [result.insertId]);
    return stay[0];
  });
}

// Check-out : clôture le séjour et passe la chambre en "NETTOYAGE"
async function checkOut(stayId) {
  return withTransaction(async (conn) => {
    const [stayRows] = await conn.query('SELECT s.*, r.room_id FROM stays s JOIN reservations r ON r.id = s.reservation_id WHERE s.id = ?', [stayId]);
    const stay = stayRows[0];
    if (!stay) throw new Error(`Séjour #${stayId} introuvable`);

    await conn.query('UPDATE stays SET checkout_at = NOW() WHERE id = ?', [stayId]);
    await conn.query('UPDATE rooms SET statut = "NETTOYAGE" WHERE id = ?', [stay.room_id]);
    await conn.query(
      `INSERT INTO room_status_history (room_id, ancien_statut, nouveau_statut, changed_at)
       VALUES (?, 'OCCUPEE', 'NETTOYAGE', NOW())`,
      [stay.room_id]
    );
    const [updated] = await conn.query('SELECT * FROM stays WHERE id = ?', [stayId]);
    return updated[0];
  });
}

async function availableRooms({ typeId } = {}) {
  let sql = `SELECT * FROM rooms WHERE statut = 'LIBRE'`;
  const params = [];
  if (typeId) {
    sql += ' AND room_type_id = ?';
    params.push(typeId);
  }
  const [rows] = await pool.query(sql, params);
  return rows;
}

module.exports = {
  RoomTypes, Rooms, Equipments, RoomEquipments, RoomMaintenance, RoomMinibar,
  RoomStatusHistory, Reservations, ReservationGuests, Stays, HousekeepingTasks,
  LostAndFound, MinibarConsumptions,
  isRoomAvailable, createReservationWithGuests, checkIn, checkOut, availableRooms,
};
