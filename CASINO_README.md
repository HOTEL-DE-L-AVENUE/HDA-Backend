# API Casino — `casinoRoutes.js`

Toutes les routes sont montées sous `/api/casino` et protégées par
`requireAuth` (header `Authorization: Bearer <token>`). Le token JWT
décodé fournit `req.user = { id_admin, role, email }`.

Format des montants : entiers en Ariary (pas de décimales). Dates : `datetime`
MySQL (`YYYY-MM-DD HH:MM:SS`) ou `date` (`YYYY-MM-DD`).

---

## Tableau de bord & consolidation

### `GET /dashboard`
Vue d'ensemble temps réel.
**Sortie 200**
```json
{
  "salles_total": 5,
  "salles_ouvertes": 3,
  "sessions_ouvertes": 2,
  "produit_net_jour": 450000,
  "encours_credit_total": 1200000,
  "incidents_ouverts": 1
}
```

### `GET /reports/produit-net?salle=&du=&au=`
Produit net par salle/jour. `salle` = nom de salle (optionnel), `du`/`au` = dates `YYYY-MM-DD`.
**Sortie 200** : tableau de `{ room_id, salle, jour, total_entrees, total_sorties, produit_net }`.

### `GET /reports/ecarts-caisse?salle=&session_id=`
Écarts de caisse (déclaré vs théorique) par session.
**Sortie 200** : tableau de `{ session_id, caisse, salle, user_id, ouverture_at, fermeture_at, fond_initial, fond_final_theorique, fond_final_declare, ecart }`.

### `GET /reports/encours-credit`
Encours de crédit joueur, agrégé par client.
**Sortie 200** : tableau de `{ client_id, client, nb_credits_actifs, encours_total, prochaine_echeance }`.

### `GET /reports/flux-a-synchroniser`
Écritures casino dont la `ref_flux_global` n'a pas encore de contrepartie dans
`financial_transactions` (batch de réconciliation si le webhook interne a échoué).
**Sortie 200** : tableau de `{ source, id, ref_flux_global, montant, created_at }`.

---

## Salles & caisses

### `/rooms` (CRUD standard)
| Méthode | Entrée (body) | Sortie |
|---|---|---|
| GET / | — | liste des salles |
| GET /:id | — | `{ id, code, nom, type_salle, statut, created_at, updated_at }` |
| POST / | `{ code, nom, type_salle, statut }` | salle créée (201) |
| PUT /:id | champs à modifier | salle mise à jour |
| DELETE /:id | — | 204 |

`type_salle` ∈ `VIP, POKER, MACHINES, TABLE_JEUX, AUTRE`. `statut` ∈ `OUVERTE, FERMEE, EN_TRAVAUX`.

### `/cashiers` (CRUD standard)
Champs : `room_id, code, nom, statut` (`statut` ∈ `OUVERTE, FERMEE, MAINTENANCE`).

---

## Sessions de caisse

### `GET /sessions/active?cashier_id=`
**Sortie 200** : tableau de sessions `statut = 'OUVERTE'`.

### `POST /sessions/open`
**Entrée** `{ "cashier_id": 3, "fond_initial": 200000 }`
**Sortie 201** : la session créée. **409** si une session est déjà ouverte pour cette caisse.

### `POST /sessions/:id/close`
**Entrée** `{ "fond_final_declare": 850000, "commentaire": "RAS" }`
**Sortie 200**
```json
{
  "id": 12, "cashier_id": 3, "user_id": 7,
  "ouverture_at": "2026-07-07 08:00:00", "fermeture_at": "2026-07-07 20:00:00",
  "fond_initial": 200000, "fond_final_theorique": 830000,
  "fond_final_declare": 850000, "ecart": 20000, "statut": "FERMEE"
}
```
`fond_final_theorique = fond_initial + entrées − sorties` (buy-in/dépôts/remboursements en entrée ; cash-out/avances en sortie ; jetons achetés en entrée, jetons repris en sortie). `ecart = déclaré − théorique`.

### `GET /sessions/:id/summary`
**Sortie 200** : `{ session, total_entrees, total_sorties, solde_theorique }` (calcul en direct, session ouverte ou fermée).

### `GET /sessions/:id/transactions`
**Sortie 200** : tableau fusionné opérations cash + jetons, triées par date :
`{ source: 'cash_operation'|'chip_transaction', id, type_operation, montant, moyen_paiement, client_id, client_libre, created_at }`.

### `/sessions` (CRUD générique, historique)
Champs : `cashier_id, user_id, ouverture_at, fermeture_at, fond_initial, fond_final_declare, statut, commentaire`.

---

## Clients en caisse (sélection simple / ajout rapide, sans carte)

### `GET /clients/search?q=`
Recherche sur `nom, prenom, telephone, code_client`.
**Sortie 200** : jusqu'à 20 clients `{ id, code_client, nom, prenom, telephone, is_casino_player, statut }`.

### `POST /clients/quick-add`
**Entrée** `{ "nom": "Rakoto", "prenom": "Jean", "telephone": "034..." }` (`nom` requis)
**Sortie 201** : client créé (`is_casino_player = 1`).

### `GET /clients/:id/profile`
**Sortie 200** : `{ client, profile, card, dernier_score }` (`profile`/`card`/`dernier_score` = `null` si absents).

### `GET /clients/:id/history`
**Sortie 200** : `{ visites: [...], salles_frequentees: [{ id, nom, nb_visites }] }`.

### `GET /clients/:id/consumption`
Habitudes F&B/bar (basées sur `orders.source_module IN ('RESTAURANT','BAR')`).
**Sortie 200** : `{ nb_commandes, panier_moyen, premiere_commande, derniere_commande }`.

### `GET /clients/:id/incidents`
**Sortie 200** : tableau d'incidents/litiges du client.

---

## Cartes de fidélité + scan QR

### `GET /cards/scan/:qrCode`
**Sortie 200** : `{ card, client, profile }`. **404** si QR inconnu.

### `GET /cards/by-client/:clientId`
**Sortie 200** : la carte du client. **404** si aucune carte.

### `POST /cards/:id/points`
**Entrée** `{ "points": 50 }` (peut être négatif pour retirer des points)
**Sortie 200** : carte mise à jour.

### `/cards` (CRUD standard)
Champs : `client_id, numero_carte, qr_code, niveau, plafond_credit, statut, date_emission`.
`niveau` ∈ `STANDARD, SILVER, GOLD, VIP`. `statut` ∈ `ACTIVE, SUSPENDUE, PERDUE`.

---

## Antécédents client (statut & incidents)

### `POST /client-profiles/:clientId/statut`
Décision humaine explicite (jamais automatique).
**Entrée** `{ "statut_special": "A_SURVEILLER", "motif": "Comportement suspect le 05/07" }`
`statut_special` ∈ `NORMAL, VIP, A_SURVEILLER, EXCLU, AUTO_EXCLU`.
**Sortie 200** : profil mis à jour (`decide_par` = caissier connecté).

### `/client-profiles` (CRUD standard)
### `/incidents` (CRUD standard)
Champs incidents : `client_id, session_id, type (INCIDENT|LITIGE), gravite (FAIBLE|MOYENNE|ELEVEE), description, statut (OUVERT|EN_COURS|RESOLU), resolved_at`.

---

## Jetons

### `/chip-types` (CRUD standard)
Champs : `code, nom, valeur_nominale, couleur, statut (ACTIF|INACTIF)`.

### `POST /chips/buy` — le client prend des jetons (cash → jetons)
**Entrée**
```json
{ "session_id": 12, "chip_type_id": 2, "quantite": 20,
  "client_id": 55, "moyen_paiement": "ESPECES" }
```
(`client_id` OU `client_libre`, les deux optionnels). **Sortie 201** : mouvement créé, `montant_total` calculé (`quantite × valeur_nominale`), écriture financière générée.

### `POST /chips/sell` — reprise de jetons (jetons → cash)
Même forme que `/buy`. **Sortie 201**.

### `GET /chips/by-client/:clientId`
**Sortie 200** : historique des mouvements de jetons du client, avec `type_jeton`.

### `/chips` (CRUD **lecture seule** — 405 sur create/update/remove)

---

## Opérations de caisse

### `POST /operations/buy-in`
**Entrée** `{ "session_id": 12, "montant": 100000, "moyen_paiement": "ESPECES", "client_id": 55 }`
**Sortie 201** : opération créée + écriture financière (entrée).

### `POST /operations/cash-out`
Même forme. Traitée comme une **sortie**.

### `POST /operations/deposit`
Même forme. Traitée comme une **entrée**.

Toutes nécessitent une session `OUVERTE` (`session_id`), sinon **400**.

### `/operations` (CRUD **lecture seule**)

---

## Crédits joueur

### `POST /credits/grant`
**Entrée** `{ "client_id": 55, "montant": 300000, "echeance": "2026-08-01", "session_id": 12 }`
Vérifie `encours actuel + montant ≤ plafond` (plafond de la carte ou, à défaut, `plafond_credit_defaut` de la config). **409** si dépassement.
**Sortie 201** : crédit créé (`statut: 'ACTIF'`).

### `POST /credits/:id/draw`
Tirage sur un crédit déjà accordé. **Entrée** `{ "session_id": 12, "montant": 50000, "moyen_paiement": "ESPECES" }`.
**Sortie 201** : opération de caisse `AVANCE_CREDIT` créée + écriture financière (sortie).

### `POST /credits/:id/repay`
**Entrée** `{ "montant": 100000, "moyen_paiement": "ESPECES", "session_id": 12 }` (`session_id` optionnel : si fourni, trace aussi une opération de caisse `REMBOURSEMENT_CREDIT`).
**Sortie 201** : le remboursement créé, avec `delai_jours` (retard vs échéance, négatif si en avance). Le crédit voit son `encours` diminuer et son `statut` passer à `SOLDE` si `encours = 0`.

### `GET /credits/by-client/:clientId/active`
**Sortie 200** : crédits `ACTIF`/`EN_RETARD` du client.

### `/credits` (CRUD standard)

---

## Scoring de crédit joueur

### `GET /scoring/config`
**Sortie 200** : tableau `{ cle, valeur, description, updated_by, updated_at }` (poids, seuils, plafond par défaut — tous paramétrables).

### `PUT /scoring/config` — **rôle `admin`/`manager` requis**
**Entrée** `{ "cle": "seuil_bon_payeur", "valeur": "80" }`
**Sortie 200** : paramètre mis à jour. **404** si `cle` inconnue.

### `POST /scoring/:clientId/compute`
Recalcule le score à partir des faits enregistrés (remboursements, retards, encours vs plafond, ancienneté, régularité des visites).
**Sortie 201**
```json
{
  "id": 8, "client_id": 55, "score": "72.40", "categorie": "MOYEN",
  "facteurs": {
    "ratio_remboursement": { "valeur": 0.9, "poids": 0.4 },
    "retard_moyen_jours": { "valeur": 3, "score": 0.9, "poids": 0.25 },
    "encours_vs_plafond": { "encours": 100000, "plafond": 500000, "ratio": 0.2, "poids": 0.2 },
    "anciennete_mois": { "valeur": 14, "poids": 0.1 },
    "regularite_visites_12m": { "valeur": 18, "poids": 0.05 },
    "seuils": { "seuil_bon_payeur": 75, "seuil_moyen_payeur": 50 }
  },
  "calcule_le": "2026-07-07 10:15:00",
  "decision": "AUCUNE"
}
```
**Ce calcul ne modifie jamais** `casino_client_profiles.statut_special` : toute conséquence (VIP, surveillance, exclusion) exige un appel séparé et explicite à `POST /client-profiles/:clientId/statut`.

### `GET /scoring/:clientId/history`
**Sortie 200** : tous les scores calculés pour ce client, plus récents en premier.

### `POST /scoring/:scoreId/decision`
Décision humaine sur un score (validation, contestation ou annulation).
**Entrée** `{ "decision": "CONTESTEE", "commentaire": "Client conteste le calcul, cf. pièce jointe" }`
`decision` ∈ `VALIDEE, CONTESTEE, ANNULEE`.
**Sortie 200** : score mis à jour (`decide_par`, `decide_le`, `commentaire_contestation`).

### `/scoring` (CRUD **lecture seule** sur `casino_scores`)

---

## Visites de salle

### `POST /visits/check-in`
**Entrée (avec carte)** `{ "room_id": 2, "qr_code": "QR-ABC123" }`
**Entrée (sans carte)** `{ "room_id": 2, "client_id": 55, "entree_via": "MANUEL" }`
**Sortie 201** : visite créée (`entree_via` déduit automatiquement à `QR` si `qr_code` fourni).

### `POST /visits/:id/check-out`
**Sortie 200** : visite avec `sortie_at` renseigné. **404** si déjà clôturée.

### `GET /visits/in-room/:roomId`
**Sortie 200** : clients actuellement dans la salle (`sortie_at IS NULL`), avec `nom`/`prenom`.

### `/visits` (CRUD standard)

---

## Codes d'erreur communs

| Code | Cas |
|---|---|
| 400 | Champ requis manquant, montant invalide, session fermée/introuvable pour une opération |
| 401 | Token manquant/invalide (`requireAuth`) |
| 403 | Rôle insuffisant (`requireRole`) ou action interdite sur une route CRUD en lecture seule |
| 404 | Ressource introuvable (session, carte, client, crédit, score, paramètre…) |
| 409 | Conflit métier (session déjà ouverte, plafond de crédit dépassé) |

> Les erreurs sont levées via `ApiError` (`utils/ApiError`) et transmises à `next(err)` — le format exact de la réponse JSON dépend de ton middleware d'erreur centralisé.