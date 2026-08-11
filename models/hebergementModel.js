// models/hebergementModel.js
const { pool, withTransaction } = require('../config/db');
const { createCrudModel } = require('./crudFactory');

const RoomTypes = createCrudModel({
  table: 'room_types', pk: 'id', fields: ['nom', 'description'], sortable: ['id', 'nom'],
});

const Rooms = createCrudModel({
  table: 'rooms', pk: 'id',
  fields: ['room_type_id', 'numero', 'capacite', 'prix_nuit', 'statut', 'etage'],
  sortable: ['id', 'numero', 'statut', 'prix_nuit', 'etage'],
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

// Met à jour uniquement le statut d'une maintenance.
// Si le nouveau statut est TERMINE (ou ANNULE) et qu'aucune date_resolution
// n'est encore renseignée, on la fixe automatiquement à NOW().
async function updateMaintenanceStatus(id, statut) {
  const [existing] = await pool.query('SELECT * FROM room_maintenance WHERE id = ?', [id]);
  if (!existing[0]) throw new Error(`Maintenance #${id} introuvable`);

  const shouldCloseNow = ['TERMINE', 'ANNULE'].includes(statut) && !existing[0].date_resolution;
  if (shouldCloseNow) {
    await pool.query(
      'UPDATE room_maintenance SET statut = ?, date_resolution = NOW() WHERE id = ?',
      [statut, id]
    );
  } else {
    await pool.query('UPDATE room_maintenance SET statut = ? WHERE id = ?', [statut, id]);
  }

  const [updated] = await pool.query('SELECT * FROM room_maintenance WHERE id = ?', [id]);
  return updated[0];
}

// Statistiques agrégées des maintenances : totaux, répartition par statut et par
// type d'intervention, coût cumulé.
async function getMaintenanceStats() {
  const [totals] = await pool.query(
    `SELECT COUNT(*) AS total, COALESCE(SUM(cout), 0) AS cout_total FROM room_maintenance`
  );
  const [parStatut] = await pool.query(
    `SELECT statut, COUNT(*) AS total, COALESCE(SUM(cout), 0) AS cout_total
     FROM room_maintenance GROUP BY statut`
  );
  const [parType] = await pool.query(
    `SELECT type_intervention, COUNT(*) AS total, COALESCE(SUM(cout), 0) AS cout_total
     FROM room_maintenance GROUP BY type_intervention`
  );
  return {
    total: totals[0].total,
    cout_total: totals[0].cout_total,
    par_statut: parStatut,
    par_type_intervention: parType,
  };
}

// Statistiques agrégées des réservations : totaux, chiffre d'affaires, répartition
// par statut.
async function getReservationStats() {
  const [totals] = await pool.query(
    `SELECT COUNT(*) AS total, COALESCE(SUM(montant_total), 0) AS montant_total,
            COALESCE(AVG(montant_total), 0) AS montant_moyen
     FROM reservations`
  );
  const [parStatut] = await pool.query(
    `SELECT statut, COUNT(*) AS total, COALESCE(SUM(montant_total), 0) AS montant_total
     FROM reservations GROUP BY statut`
  );
  return {
    total: totals[0].total,
    montant_total: totals[0].montant_total,
    montant_moyen: totals[0].montant_moyen,
    par_statut: parStatut,
  };
}

// Met à jour uniquement le statut d'une chambre, en journalisant le changement
// dans room_status_history (comme le font déjà checkIn/checkOut).
async function updateRoomStatus(id, statut) {
  const [existing] = await pool.query('SELECT * FROM rooms WHERE id = ?', [id]);
  if (!existing[0]) throw new Error(`Chambre #${id} introuvable`);
  const ancienStatut = existing[0].statut;
  if (ancienStatut === statut) return existing[0];

  return withTransaction(async (conn) => {
    await conn.query('UPDATE rooms SET statut = ? WHERE id = ?', [statut, id]);
    await conn.query(
      `INSERT INTO room_status_history (room_id, ancien_statut, nouveau_statut, changed_at)
       VALUES (?, ?, ?, NOW())`,
      [id, ancienStatut, statut]
    );
    const [updated] = await conn.query('SELECT * FROM rooms WHERE id = ?', [id]);
    return updated[0];
  });
}

// Récupère un équipement par son code (unique)
async function getEquipmentByCode(code) {
  const [rows] = await pool.query('SELECT * FROM equipments WHERE code = ?', [code]);
  if (!rows[0]) throw new Error(`Équipement de code "${code}" introuvable`);
  return rows[0];
}

// Liste des catégories d'équipements distinctes (pour peupler des filtres/selects)
async function getEquipmentCategories() {
  const [rows] = await pool.query(
    `SELECT DISTINCT categorie FROM equipments
     WHERE categorie IS NOT NULL AND categorie != '' ORDER BY categorie`
  );
  return rows.map((r) => r.categorie);
}

// Statistiques agrégées des équipements : total au référentiel, répartition par
// catégorie, et répartition par statut des installations en chambre (room_equipments).
async function getEquipmentStats() {
  const [totals] = await pool.query('SELECT COUNT(*) AS total FROM equipments');
  const [parCategorie] = await pool.query(
    `SELECT COALESCE(categorie, 'NON_CATEGORISE') AS categorie, COUNT(*) AS total
     FROM equipments GROUP BY categorie`
  );
  const [parStatutInstallation] = await pool.query(
    `SELECT statut, COUNT(*) AS total FROM room_equipments GROUP BY statut`
  );
  return {
    total_equipments: totals[0].total,
    par_categorie: parCategorie,
    installations_par_statut: parStatutInstallation,
  };
}

// Met à jour uniquement le statut d'un équipement installé dans une chambre
async function updateRoomEquipmentStatus(id, statut) {
  const [existing] = await pool.query('SELECT * FROM room_equipments WHERE id = ?', [id]);
  if (!existing[0]) throw new Error(`Équipement de chambre #${id} introuvable`);
  await pool.query('UPDATE room_equipments SET statut = ? WHERE id = ?', [statut, id]);
  const [updated] = await pool.query('SELECT * FROM room_equipments WHERE id = ?', [id]);
  return updated[0];
}

// Statistiques agrégées sur le parc de chambres : total, répartition par statut,
// taux d'occupation, répartition par type de chambre.
async function getRoomStats() {
  const [totals] = await pool.query('SELECT COUNT(*) AS total FROM rooms');
  const [parStatut] = await pool.query('SELECT statut, COUNT(*) AS total FROM rooms GROUP BY statut');
  const [parType] = await pool.query(
    `SELECT rt.nom AS room_type, COUNT(r.id) AS total
     FROM rooms r JOIN room_types rt ON rt.id = r.room_type_id
     GROUP BY rt.nom`
  );
  const total = totals[0].total;
  const occupees = parStatut.find((r) => r.statut === 'OCCUPEE')?.total || 0;
  const tauxOccupation = total > 0 ? Number((occupees / total).toFixed(4)) : 0;
  return {
    total,
    taux_occupation: tauxOccupation,
    par_statut: parStatut,
    par_type: parType,
  };
}

// Met à jour uniquement le statut d'une tâche de housekeeping.
// Si le nouveau statut est TERMINE et qu'aucune completed_at n'est encore posée,
// on la fixe automatiquement à NOW().
async function updateHousekeepingStatus(id, statut) {
  const [existing] = await pool.query('SELECT * FROM housekeeping_tasks WHERE id = ?', [id]);
  if (!existing[0]) throw new Error(`Tâche de housekeeping #${id} introuvable`);

  const shouldCompleteNow = statut === 'TERMINE' && !existing[0].completed_at;
  if (shouldCompleteNow) {
    await pool.query(
      'UPDATE housekeeping_tasks SET statut = ?, completed_at = NOW() WHERE id = ?',
      [statut, id]
    );
  } else {
    await pool.query('UPDATE housekeeping_tasks SET statut = ? WHERE id = ?', [statut, id]);
  }

  const [updated] = await pool.query('SELECT * FROM housekeeping_tasks WHERE id = ?', [id]);
  return updated[0];
}

// Statistiques agrégées des tâches de housekeeping : total, répartition par
// statut et par type de tâche.
async function getHousekeepingStats() {
  const [totals] = await pool.query('SELECT COUNT(*) AS total FROM housekeeping_tasks');
  const [parStatut] = await pool.query(
    'SELECT statut, COUNT(*) AS total FROM housekeeping_tasks GROUP BY statut'
  );
  const [parType] = await pool.query(
    'SELECT type_tache, COUNT(*) AS total FROM housekeeping_tasks GROUP BY type_tache'
  );
  return {
    total: totals[0].total,
    par_statut: parStatut,
    par_type_tache: parType,
  };
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
  updateMaintenanceStatus, getMaintenanceStats, getReservationStats,
  updateRoomStatus, getEquipmentByCode, getEquipmentCategories, getEquipmentStats,
  updateRoomEquipmentStatus, getRoomStats, updateHousekeepingStatus, getHousekeepingStats,
};