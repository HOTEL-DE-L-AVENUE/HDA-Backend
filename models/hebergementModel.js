const { pool, withTransaction } = require('../config/db');
const { createCrudModel } = require('./crudFactory');
const stockModel = require('./stockModel');

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

const reservationsFindAll = Reservations.findAll;
const reservationsFindById = Reservations.findById;
const reservationsCreate = Reservations.create;
const reservationsUpdate = Reservations.update;

async function findReservationWithDetails(id) {
  const [rows] = await pool.query(
    `SELECT r.*, c.nom AS client_nom, c.prenom AS client_prenom, room.numero AS room_numero,
            EXISTS(
              SELECT 1 FROM financial_transactions ft
              WHERE ft.module = 'HEBERGEMENT'
                AND ft.ref_flux_global = CONCAT('HEBERGEMENT-RESERVATION-', r.id)
            ) AS est_payee
     FROM reservations r
     LEFT JOIN clients c ON c.id = r.client_id
     LEFT JOIN rooms room ON room.id = r.room_id
     WHERE r.id = ? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

Reservations.findAll = async function(options) {
  const rows = await reservationsFindAll.call(this, options);
  return Promise.all(rows.map((row) => findReservationWithDetails(row.id)));
};

Reservations.findById = findReservationWithDetails;
Reservations.create = async function(data) {
  const row = await reservationsCreate.call(this, data);
  return findReservationWithDetails(row.id);
};
Reservations.update = async function(id, data) {
  await reservationsUpdate.call(this, id, data);
  return findReservationWithDetails(id);
};
Reservations.remove = async function(id) {
  return withTransaction(async (conn) => {
    const [rows] = await conn.query('SELECT room_id FROM reservations WHERE id = ? LIMIT 1', [id]);
    if (!rows[0]) return false;

    await conn.query('DELETE FROM stays WHERE reservation_id = ?', [id]);
    await conn.query(
      `DELETE FROM financial_transactions
       WHERE module = 'HEBERGEMENT' AND ref_flux_global = ?`,
      [`HEBERGEMENT-RESERVATION-${id}`]
    );
    const [result] = await conn.query('DELETE FROM reservations WHERE id = ?', [id]);
    await conn.query(
      'UPDATE rooms SET statut = "LIBRE" WHERE id = ? AND statut = "RESERVEE"',
      [rows[0].room_id]
    );

    return result.affectedRows > 0;
  });
};

Rooms.remove = async function(id) {
  return withTransaction(async (conn) => {
    const [rooms] = await conn.query('SELECT id FROM rooms WHERE id = ? LIMIT 1', [id]);
    if (!rooms[0]) return false;

    await conn.query(
      'DELETE FROM reservation_guests WHERE reservation_id IN (SELECT id FROM reservations WHERE room_id = ?)',
      [id]
    );
    await conn.query(
      'DELETE FROM stays WHERE reservation_id IN (SELECT id FROM reservations WHERE room_id = ?)',
      [id]
    );
    await conn.query('DELETE FROM reservations WHERE room_id = ?', [id]);
    await conn.query('DELETE FROM room_equipments WHERE room_id = ?', [id]);
    await conn.query('DELETE FROM room_minibar WHERE room_id = ?', [id]);
    await conn.query('DELETE FROM housekeeping_tasks WHERE room_id = ?', [id]);
    await conn.query('DELETE FROM lost_and_found WHERE room_id = ?', [id]);
    await conn.query('DELETE FROM minibar_consumptions WHERE room_id = ?', [id]);
    await conn.query('DELETE FROM room_maintenance WHERE room_id = ?', [id]);
    await conn.query('DELETE FROM room_status_history WHERE room_id = ?', [id]);

    const [result] = await conn.query('DELETE FROM rooms WHERE id = ?', [id]);
    return result.affectedRows > 0;
  });
};

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
  fields: ['room_id', 'client_id', 'product_id', 'quantite', 'prix_unitaire', 'montant', 'facturee'],
  sortable: ['id', 'consumed_at', 'facturee'],
});

// Custom create method for minibar consumptions to auto-set consumed_at
MinibarConsumptions.create = async function(data) {
  const cols = this.fields.filter((f) => data[f] !== undefined);
  if (!cols.length) throw new Error(`Aucun champ valide fourni pour ${this.table}`);
  
  // Auto-calculate montant if not provided
  if (!data.montant && data.quantite && data.prix_unitaire) {
    data.montant = data.quantite * data.prix_unitaire;
  }
  
  // Convert boolean facturee to integer for database
  if (data.facturee !== undefined && typeof data.facturee === 'boolean') {
    data.facturee = data.facturee ? 1 : 0;
  }
  
  const placeholders = cols.map(() => '?').join(', ') + ', NOW()';
  const values = cols.map((c) => data[c]);
  const sqlCols = cols.map((c) => `\`${c}\``).join(', ') + ', `consumed_at`';
  
  const [result] = await pool.query(
    `INSERT INTO \`${this.table}\` (${sqlCols}) VALUES (${placeholders})`,
    values
  );
  return this.findById(result.insertId);
};

// Custom update method to handle boolean to integer conversion
const originalUpdate = MinibarConsumptions.update;
MinibarConsumptions.update = async function(id, data) {
  // Convert boolean facturee to integer for database
  if (data.facturee !== undefined && typeof data.facturee === 'boolean') {
    data.facturee = data.facturee ? 1 : 0;
  }
  return originalUpdate.call(this, id, data);
};

// Custom findById to convert integer facturee back to boolean
const originalFindById = MinibarConsumptions.findById;
MinibarConsumptions.findById = async function(id) {
  const row = await originalFindById.call(this, id);
  if (row && row.facturee !== undefined) {
    row.facturee = row.facturee === 1 || row.facturee === true;
  }
  return row;
};

// Custom findAll to convert integer facturee back to boolean
const originalFindAll = MinibarConsumptions.findAll;
MinibarConsumptions.findAll = async function(options) {
  const rows = await originalFindAll.call(this, options);
  return rows.map(row => {
    if (row && row.facturee !== undefined) {
      row.facturee = row.facturee === 1 || row.facturee === true;
    }
    return row;
  });
};

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
async function createReservationWithGuests({ clientId, roomId, dateArrivee, dateDepart, montantTotal, statut, guests = [] }) {
  return withTransaction(async (conn) => {
    // Utilise le statut envoyé par le contrôleur ou 'EN_COURS' par défaut
    const statusValue = statut || 'EN_COURS';

    const [result] = await conn.query(
      `INSERT INTO reservations (client_id, room_id, date_arrivee, date_depart, montant_total, statut)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [clientId, roomId, dateArrivee, dateDepart, montantTotal, statusValue]
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

async function recordReservationPayment(reservationId) {
  return withTransaction(async (conn) => {
    const [[reservation]] = await conn.query(
      'SELECT id, client_id, montant_total, statut FROM reservations WHERE id = ? FOR UPDATE',
      [reservationId]
    );
    if (!reservation) throw new Error(`Réservation #${reservationId} introuvable`);
    if (['ANNULEE', 'TERMINEE'].includes(String(reservation.statut || '').toUpperCase())) {
      throw new Error('Cette réservation ne peut plus être encaissée');
    }
    if (Number(reservation.montant_total) <= 0) throw new Error('Montant de réservation invalide');

    await conn.query(
      `INSERT IGNORE INTO financial_transactions
         (client_id, module, type_flux, montant, reference_id, ref_flux_global, description, statut_sync, created_at)
       VALUES (?, 'HEBERGEMENT', 'ENTREE', ?, ?, ?, ?, 'SYNCED', NOW())`,
      [reservation.client_id, reservation.montant_total, reservation.id,
        `HEBERGEMENT-RESERVATION-${reservation.id}`,
        `Encaissement réservation hébergement #${reservation.id}`]
    );
    return { reservation_id: reservation.id, montant: Number(reservation.montant_total), est_payee: true };
  });
}

// Check-in : crée le séjour, passe la réservation en cours et prépare la
// facture d'hébergement. Le règlement reste une étape distincte après
// l'arrivée du client.
async function checkIn(reservationId) {
  return withTransaction(async (conn) => {
    const [resRows] = await conn.query('SELECT * FROM reservations WHERE id = ? FOR UPDATE', [reservationId]);
    const reservation = resRows[0];
    if (!reservation) throw new Error(`Réservation #${reservationId} introuvable`);

    if (String(reservation.statut || '').toUpperCase() !== 'CONFIRMEE') {
      throw new Error('Seule une réservation confirmée peut être enregistrée en check-in');
    }

    const [activeStays] = await conn.query(
      'SELECT id FROM stays WHERE reservation_id = ? AND checkout_at IS NULL FOR UPDATE',
      [reservationId]
    );
    if (activeStays.length) throw new Error('Cette réservation possède déjà un séjour en cours');

    const [result] = await conn.query(
      'INSERT INTO stays (reservation_id, checkin_at) VALUES (?, NOW())',
      [reservationId]
    );
    await conn.query('UPDATE reservations SET statut = "EN_COURS" WHERE id = ?', [reservationId]);
    await conn.query('UPDATE rooms SET statut = "OCCUPEE" WHERE id = ?', [reservation.room_id]);
    await conn.query(
      `INSERT INTO room_status_history (room_id, ancien_statut, nouveau_statut, changed_at)
       VALUES (?, 'RESERVEE', 'OCCUPEE', NOW())`,
      [reservation.room_id]
    );

    let invoice = null;
    const total = Number(reservation.montant_total || 0);
    if (total > 0) {
      const description = `Hébergement - Réservation #${reservationId}`;
      const [existingInvoices] = await conn.query(
        `SELECT i.* FROM invoices i
         JOIN invoice_items ii ON ii.invoice_id = i.id
         WHERE ii.description = ? LIMIT 1 FOR UPDATE`,
        [description]
      );
      if (existingInvoices[0]) {
        invoice = existingInvoices[0];
      } else {
        const [invoiceResult] = await conn.query(
          `INSERT INTO invoices (client_id, montant_total, statut) VALUES (?, ?, 'EN_ATTENTE')`,
          [reservation.client_id, total]
        );
        await conn.query(
          `INSERT INTO invoice_items (invoice_id, description, montant) VALUES (?, ?, ?)`,
          [invoiceResult.insertId, description, total]
        );
        const [invoiceRows] = await conn.query('SELECT * FROM invoices WHERE id = ?', [invoiceResult.insertId]);
        invoice = invoiceRows[0];
      }
    }

    const [stay] = await conn.query('SELECT * FROM stays WHERE id = ?', [result.insertId]);
    return { ...stay[0], invoice };
  });
}

// Check-out : clôture le séjour, passe la réservation en "TERMINEE" et la chambre en "NETTOYAGE"
async function checkOut(stayId) {
  return withTransaction(async (conn) => {
    const [stayRows] = await conn.query('SELECT s.*, r.room_id, r.id as reservation_id, r.client_id, r.montant_total FROM stays s JOIN reservations r ON r.id = s.reservation_id WHERE s.id = ?', [stayId]);
    const stay = stayRows[0];
    if (!stay) throw new Error(`Séjour #${stayId} introuvable`);

    await conn.query('UPDATE stays SET checkout_at = NOW() WHERE id = ?', [stayId]);
    await conn.query('UPDATE reservations SET statut = "TERMINEE" WHERE id = ?', [stay.reservation_id]);
    await conn.query('UPDATE rooms SET statut = "NETTOYAGE" WHERE id = ?', [stay.room_id]);
    await conn.query(
      `INSERT INTO room_status_history (room_id, ancien_statut, nouveau_statut, changed_at)
       VALUES (?, 'OCCUPEE', 'NETTOYAGE', NOW())`,
      [stay.room_id]
    );

    // Create financial transaction for accommodation checkout revenue
    const montant = Number(stay.montant_total) || 0;
    if (montant > 0) {
      await conn.query(
        `INSERT INTO financial_transactions
           (client_id, module, type_flux, montant, reference_id, ref_flux_global, description, statut_sync, created_at)
         VALUES (?, 'HEBERGEMENT', 'ENTREE', ?, ?, ?, ?, 'SYNCED', NOW())`,
        [stay.client_id, montant, stay.reservation_id,
          `HEBERGEMENT-CHECKOUT-${stay.reservation_id}`,
          `Encaissement séjour hébergement #${stay.reservation_id}`]
      );
    }

    const [updated] = await conn.query('SELECT * FROM stays WHERE id = ?', [stayId]);
    return updated[0];
  });
}

// Met à jour uniquement le statut d'une maintenance.
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

// Statistiques agrégées des maintenances
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

// Statistiques agrégées des réservations
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

// Met à jour uniquement le statut d'une chambre
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

// Récupère un équipement par son code
async function getEquipmentByCode(code) {
  const [rows] = await pool.query('SELECT * FROM equipments WHERE code = ?', [code]);
  if (!rows[0]) throw new Error(`Équipement de code "${code}" introuvable`);
  return rows[0];
}

// Liste des catégories d'équipements distinctes
async function getEquipmentCategories() {
  const [rows] = await pool.query(
    `SELECT DISTINCT categorie FROM equipments
     WHERE categorie IS NOT NULL AND categorie != '' ORDER BY categorie`
  );
  return rows.map((r) => r.categorie);
}

// Statistiques agrégées des équipements
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

// Statistiques agrégées sur le parc de chambres
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

// Met à jour uniquement le statut d'une tâche de housekeeping
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

// Statistiques agrégées des tâches de housekeeping
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

// --- Minibar Stock Management ---

// Transfer stock from source location (restaurant/bar) to hotel minibar location
async function transferStockToMinibar({ productId, sourceLocationId, quantity, roomId, userId }) {
  return withTransaction(async (conn) => {
    // Check if there's enough stock in source location
    const [sourceStock] = await conn.query(
      'SELECT quantite FROM stocks WHERE product_id = ? AND location_id = ? FOR UPDATE',
      [productId, sourceLocationId]
    );
    
    if (!sourceStock[0] || sourceStock[0].quantite < quantity) {
      throw new Error('Stock insuffisant dans la source');
    }

    // Deduct from source location
    await conn.query(
      'UPDATE stocks SET quantite = quantite - ? WHERE product_id = ? AND location_id = ?',
      [quantity, productId, sourceLocationId]
    );

    // Add to hotel location (location_id = 5 for Hotel)
    const [hotelStock] = await conn.query(
      'SELECT quantite FROM stocks WHERE product_id = ? AND location_id = 5 FOR UPDATE',
      [productId]
    );
    
    if (hotelStock[0]) {
      await conn.query(
        'UPDATE stocks SET quantite = quantite + ? WHERE product_id = ? AND location_id = 5',
        [quantity, productId]
      );
    } else {
      await conn.query(
        'INSERT INTO stocks (product_id, location_id, quantite) VALUES (?, 5, ?)',
        [productId, quantity]
      );
    }

    // Record stock movement
    await conn.query(
      `INSERT INTO stock_movements (product_id, location_id, type_mouvement, quantite, source_module, reference_id, created_at)
       VALUES (?, 5, 'ENTREE', ?, 'MINIBAR', ?, NOW())`,
      [productId, quantity, roomId]
    );

    // Record stock movement from source
    await conn.query(
      `INSERT INTO stock_movements (product_id, location_id, type_mouvement, quantite, source_module, reference_id, created_at)
       VALUES (?, ?, 'SORTIE', ?, 'MINIBAR', ?, NOW())`,
      [productId, sourceLocationId, quantity, roomId]
    );

    return { success: true, message: 'Stock transféré avec succès' };
  });
}

// Handle minibar consumption with stock movement tracking
async function handleMinibarConsumption({ roomId, productId, quantity, clientId, price }) {
  return withTransaction(async (conn) => {
    // Check if product exists in room minibar
    const [minibarItem] = await conn.query(
      'SELECT quantite FROM room_minibar WHERE room_id = ? AND product_id = ? FOR UPDATE',
      [roomId, productId]
    );

    if (!minibarItem[0] || minibarItem[0].quantite < quantity) {
      throw new Error('Stock insuffisant dans le minibar');
    }

    // Deduct from room minibar
    await conn.query(
      'UPDATE room_minibar SET quantite = quantite - ? WHERE room_id = ? AND product_id = ?',
      [quantity, roomId, productId]
    );

    // Deduct from hotel stock location
    await conn.query(
      'UPDATE stocks SET quantite = quantite - ? WHERE product_id = ? AND location_id = 5',
      [quantity, productId]
    );

    // Record consumption
    const montant = quantity * price;
    const [consumption] = await conn.query(
      `INSERT INTO minibar_consumptions (room_id, client_id, product_id, quantite, prix_unitaire, montant, facturee, consumed_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, NOW())`,
      [roomId, clientId, productId, quantity, price, montant]
    );

    // Record stock movement
    await conn.query(
      `INSERT INTO stock_movements (product_id, location_id, type_mouvement, quantite, source_module, reference_id, created_at)
       VALUES (?, 5, 'SORTIE', ?, 'MINIBAR_CONSUMPTION', ?, NOW())`,
      [productId, quantity, consumption.insertId]
    );

    // A minibar consumption is charged to the guest and therefore belongs in
    // the Hotel revenue stream without needing a manual Finance operation.
    await conn.query(
      `INSERT IGNORE INTO financial_transactions
         (client_id, module, type_flux, montant, reference_id, ref_flux_global, description, statut_sync, created_at)
       VALUES (?, 'HOTEL', 'ENTREE', ?, ?, ?, ?, 'SYNCED', NOW())`,
      [clientId, montant, consumption.insertId, `HOTEL-MINIBAR-${consumption.insertId}`, `Consommation minibar #${consumption.insertId}`]
    );

    return consumption.insertId;
  });
}

// Get minibar items with low stock alerts
async function getMinibarWithAlerts() {
  const [rows] = await pool.query(`
    SELECT rm.*, p.nom as product_nom, p.prix_vente, r.numero as room_numero,
           CASE WHEN rm.quantite <= rm.seuil_alerte THEN 1 ELSE 0 END as alert
    FROM room_minibar rm
    JOIN products p ON rm.product_id = p.id
    JOIN rooms r ON rm.room_id = r.id
    ORDER BY alert DESC, r.numero, p.nom
  `);
  return rows;
}

// Get only low stock minibar items for notifications
async function getLowStockMinibarItems() {
  const [rows] = await pool.query(`
    SELECT rm.*, p.nom as product_nom, p.prix_vente, r.numero as room_numero
    FROM room_minibar rm
    JOIN products p ON rm.product_id = p.id
    JOIN rooms r ON rm.room_id = r.id
    WHERE rm.quantite <= rm.seuil_alerte
    ORDER BY rm.quantite ASC, r.numero, p.nom
  `);
  return rows;
}

// Restock minibar from hotel stock location
async function restockMinibar({ roomId, productId, quantity, userId }) {
  return withTransaction(async (conn) => {
    // Check hotel stock
    const [hotelStock] = await conn.query(
      'SELECT quantite FROM stocks WHERE product_id = ? AND location_id = 5 FOR UPDATE',
      [productId]
    );

    if (!hotelStock[0] || hotelStock[0].quantite < quantity) {
      throw new Error('Stock insuffisant dans le stock hôtel');
    }

    // Deduct from hotel stock
    await conn.query(
      'UPDATE stocks SET quantite = quantite - ? WHERE product_id = ? AND location_id = 5',
      [quantity, productId]
    );

    // Add to room minibar
    const [minibarItem] = await conn.query(
      'SELECT quantite FROM room_minibar WHERE room_id = ? AND product_id = ? FOR UPDATE',
      [roomId, productId]
    );

    if (minibarItem[0]) {
      await conn.query(
        'UPDATE room_minibar SET quantite = quantite + ? WHERE room_id = ? AND product_id = ?',
        [quantity, roomId, productId]
      );
    } else {
      await conn.query(
        'INSERT INTO room_minibar (room_id, product_id, quantite, seuil_alerte) VALUES (?, ?, ?, 1)',
        [roomId, productId, quantity]
      );
    }

    // Record stock movement
    await conn.query(
      `INSERT INTO stock_movements (product_id, location_id, type_mouvement, quantite, source_module, reference_id, created_at)
       VALUES (?, 5, 'SORTIE', ?, 'MINIBAR_RESTOCK', ?, NOW())`,
      [productId, quantity, roomId]
    );

    return { success: true, message: 'Minibar réapprovisionné avec succès' };
  });
}

module.exports = {
  RoomTypes, Rooms, Equipments, RoomEquipments, RoomMaintenance, RoomMinibar,
  RoomStatusHistory, Reservations, ReservationGuests, Stays, HousekeepingTasks,
  LostAndFound, MinibarConsumptions,
  isRoomAvailable, createReservationWithGuests, recordReservationPayment, checkIn, checkOut, availableRooms,
  updateMaintenanceStatus, getMaintenanceStats, getReservationStats,
  updateRoomStatus, getEquipmentByCode, getEquipmentCategories, getEquipmentStats,
  updateRoomEquipmentStatus, getRoomStats, updateHousekeepingStatus, getHousekeepingStats,
  transferStockToMinibar, handleMinibarConsumption, getMinibarWithAlerts, getLowStockMinibarItems, restockMinibar,
};
