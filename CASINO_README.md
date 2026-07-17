# API Casino — `casinoRoutes.js`

Toutes les routes sont montées sous `/api/casino` et protégées par
`requireAuth` (header `Authorization: Bearer <token>`). Le token JWT
décodé fournit `req.user = { id_admin, role, email }`.

Format des montants : entiers en Ariary (pas de décimales). Dates : `datetime`
MySQL (`YYYY-MM-DD HH:MM:SS`) ou `date` (`YYYY-MM-DD`).

> Le transfert de fonds **entre caisses** (casino ↔ restaurant ↔ ...) n'est
> **pas** documenté ici : c'est un module transversal, monté sous
> `/api/caisse-transfers` (hors `/api/casino`). Voir `CAISSE_TRANSFERS_README.md`.

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

> Un **transfert de fonds reçu ou envoyé vers une autre caisse** (module
> `caisse-transfers`, hors `/api/casino`) compte aussi en entrée
> (`TRANSFERT_ENTRANT`) ou en sortie (`TRANSFERT_SORTANT`) une fois confirmé
> par la caisse destinataire. Voir `CAISSE_TRANSFERS_README.md`.

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
**Sortie 200** : `{ client, profile, card, dernier_score, solde_compte }` (`profile`/`card`/`dernier_score` = `null` si absents).
`solde_compte` = solde consolidé du client tous départements confondus (`client_accounts.solde`, positif = le client doit de l'argent à HDA — alimenté par les crédits casino accordés/tirés/remboursés). Voir section « Compte client consolidé ».

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
Champs : `code, nom, valeur_nominale, couleur, quantite_stock, statut (ACTIF|INACTIF)`.
`quantite_stock` = nombre de jetons physiquement disponibles pour ce type ;
décrémenté par `/chips/buy`, réincrémenté par `/chips/sell` et `/chips/pay`
(les jetons remis dans un autre département reviennent à la cage casino).

### `POST /chips/buy` — le client prend des jetons (cash → jetons)
**Entrée**
```json
{ "session_id": 12, "chip_type_id": 2, "quantite": 20,
  "client_id": 55, "moyen_paiement": "ESPECES" }
```
(`client_id` OU `client_libre`, les deux optionnels). **Sortie 201** : mouvement créé, `montant_total` calculé (`quantite × valeur_nominale`), écriture financière générée. **409** si `quantite_stock` insuffisant (verrou `FOR UPDATE` sur le type de jeton pour éviter la survente en cas d'opérations concurrentes).

### `POST /chips/sell` — reprise de jetons (jetons → cash)
Même forme que `/buy`. **Sortie 201**.

### `GET /chips/by-client/:clientId`
**Sortie 200** : historique des mouvements de jetons du client, avec `type_jeton`.

### `POST /chips/pay` — paiement en jetons dans un autre département
Utilisé par Restaurant/Bar/Boutique/Hébergement au moment du checkout d'une
commande réglée en jetons. **N'est pas rattaché à une session de caisse
casino** (`session_id` absent) — les jetons remis reviennent physiquement à
la cage casino, donc le stock du type de jeton est réincrémenté.
**Entrée**
```json
{ "client_id": 55, "chip_type_id": 2, "quantite": 10,
  "module_cible": "RESTAURANT", "reference_commande_id": 341 }
```
`client_id` **obligatoire** (contrairement à `/chips/buy` et `/chips/sell`, un
paiement en jetons ne peut pas être anonyme). `module_cible` ∈ `RESTAURANT,
BAR, BOUTIQUE, HEBERGEMENT`. `reference_commande_id` optionnel, permet de
rattacher le paiement à la commande du module cible.
**Sortie 201** : mouvement créé (`type_operation: 'PAIEMENT'`), `montant_total`
calculé, écriture financière générée **dans le module cible** (`module:
"RESTAURANT"`, etc.) et non dans `CASINO`, pour que le produit net casino ne
soit pas gonflé à tort. **400** si `client_id` manquant ou `module_cible`
invalide. **404** si type de jeton introuvable ou inactif.

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
**Sortie 201** : crédit créé (`statut: 'ACTIF'`). Incrémente `client_accounts.solde` du client de `montant` (voir « Compte client consolidé »).

### `POST /credits/:id/draw`
Tirage sur un crédit déjà accordé. **Entrée** `{ "session_id": 12, "montant": 50000, "moyen_paiement": "ESPECES" }`.
**Sortie 201** : opération de caisse `AVANCE_CREDIT` créée + écriture financière (sortie). Incrémente `client_accounts.solde` de `montant` (dette supplémentaire).

### `POST /credits/:id/repay`
**Entrée** `{ "montant": 100000, "moyen_paiement": "ESPECES", "session_id": 12 }` (`session_id` optionnel : si fourni, trace aussi une opération de caisse `REMBOURSEMENT_CREDIT`).
**Sortie 201** : le remboursement créé, avec `delai_jours` (retard vs échéance, négatif si en avance). Le crédit voit son `encours` diminuer et son `statut` passer à `SOLDE` si `encours = 0`. Décrémente `client_accounts.solde` de `montant`.

### `GET /credits/by-client/:clientId/active`
**Sortie 200** : crédits `ACTIF`/`EN_RETARD` du client.

### `/credits` (CRUD standard)

---

## Compte client consolidé

`client_accounts.solde` est la **source de vérité unique** du solde d'un
client tous départements confondus (positif = le client doit de l'argent à
HDA). Contrairement à `casino_credits.encours` (propre à un crédit donné),
`solde` est la somme vivante, mise à jour en temps réel à chaque octroi,
tirage ou remboursement de crédit — quel que soit le département qui
enregistre l'opération.

- Alimenté uniquement par les opérations de crédit casino pour l'instant
  (`/credits/grant`, `/credits/:id/draw` en `+`, `/credits/:id/repay` en `-`).
  Si d'autres départements développent leur propre mécanisme de crédit, ils
  doivent alimenter la **même** table via le même pattern
  (`INSERT ... ON DUPLICATE KEY UPDATE solde = solde + ?`), pour que
  `solde_compte` reste consolidé et non dupliqué par département.
- Exposé en lecture via `GET /clients/:id/profile` → `solde_compte`.
- Aucune route de modification directe n'est exposée : le solde ne se
  modifie qu'en conséquence d'une opération de crédit tracée (jamais en
  écriture libre), pour conserver la traçabilité complète.

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

## Tables de jeu & Caves/Recaves

Une **salle** peut contenir des **tables de jeu** (poker, blackjack, etc.).
Chaque table définit une **cave minimum** : le montant que le joueur doit
miser pour s'installer. S'il épuise ses jetons, il peut faire une
**recave** (réapprovisionnement), sans minimum imposé par défaut.

Chaque cave et chaque recave est un événement **tracé et signé** :
- Elle crée une ligne dans `casino_table_caves`.
- Si payée, elle génère une écriture de caisse (`casino_cash_operations`,
  type `BUY_IN`) exactement comme `/operations/buy-in`, rattachée à
  la même session de caisse casino.
- Elle exige une signature du joueur, enregistrée dans la table
  transversale `signatures` (`signable_type: 'casino_table_cave'`,
  `signable_id` = id de la cave) — même mécanisme que la signature KYC, via
  le composant réutilisable `src/components/SignaturePad.tsx`.

### `/tables-jeu` (CRUD standard, lecture/écriture partiellement surchargées — voir plus bas)
Champs : `room_id, numero, type_jeu, cave_minimum, salaire_horaire_croupier,
duree_jeu_simple_minutes, duree_prolongation_minutes, statut`.
`type_jeu` ∈ `POKER, BLACKJACK, ROULETTE, BACCARA, AUTRE`. `statut` ∈ `OUVERTE, FERMEE, ARCHIVEE`.

Deux temporisations distinctes, fixées à la création :
- `duree_jeu_simple_minutes` (défaut 120 = 2h) — le **temps de jeu simple,
  sans prolongation**, décompté depuis `created_at`. Tant qu'il n'est pas
  écoulé, le bouton « Prolongation » n'est pas proposé. À expiration :
  label « Temps de jeu terminé », le bouton apparaît pour la première fois.
- `duree_prolongation_minutes` (défaut 60) — la **durée d'une
  prolongation**, décomptée depuis `derniere_prolongation_at` une fois
  qu'au moins une prolongation a été accordée. À expiration : label
  « Timeout Pour la Prolongation », le bouton redevient disponible pour la
  prolongation suivante.

Voir « Prolongations » plus bas pour le détail de la logique serveur
(`calculerEtatProlongation`).

#### `GET /tables-jeu?room_id=`
Surcharge la liste générique du CRUD pour ajouter `a_historique` (booléen) à
chaque table : `true` si elle a au moins une cave, une prolongation ou un
pourboire. Le front s'en sert pour proposer « Archiver » plutôt que
« Supprimer » dès qu'une suppression physique casserait une FK.

### `POST /tables-jeu/:id/ouvrir` / `POST /tables-jeu/:id/fermer`
Bascule le statut de la table entre `OUVERTE` et `FERMEE`.

### `POST /tables-jeu/:id/archiver` / `POST /tables-jeu/:id/desarchiver`
Passe la table en `ARCHIVEE` (sort de la rotation active, aucune donnée
supprimée — caves, prolongations, pourboires et feuille de table restent
consultables) ou la remet en `FERMEE`. À utiliser à la place de la
suppression dès que `a_historique = true`.

### `DELETE /tables-jeu/:id`
Surcharge le delete générique du CRUD : vérifie d'abord l'absence de caves,
prolongations et pourboires liées. **409** (`ApiError.conflict`) avec un
message explicite si la table a un historique — sinon `casino_table_caves`
etc. bloqueraient la suppression via leur contrainte FK
(`fk_caves_table`/`fk_prolong_table`/`fk_pourboire_table`), ce qui
remontait auparavant une erreur SQL brute (`ER_ROW_IS_REFERENCED_2`,
1451) au lieu d'un message utilisable côté front. **204** si la suppression
a réussi.

### `POST /tables-jeu/:id/caves`
Enregistre une cave (si c'est la première du joueur, ce jour, à cette
table) ou une recave (sinon) — le serveur détermine `numero_cave`
automatiquement.

**Entrée**
```json
{
  "session_id": 12,
  "client_id": 55,
  "numero_adherent": "ADH-0231",
  "montant": 200000,
  "statut_paiement": "PAYE",
  "moyen_paiement": "ESPECES"
}
```
(`client_id` OU `client_libre`, l'un des deux. `numero_adherent` optionnel.)

**Logique serveur**
- `date_jeu` = date du jour. `numero_cave` = 1 + nombre de caves déjà
  enregistrées pour `(table_jeu_id, client_id/libre, date_jeu)`.
- `heure_arrivee` = figée à la 1ère cave du joueur ce jour-là sur cette
  table ; reprise telle quelle pour les recaves suivantes.
- Si `numero_cave === 1` : **400** si `montant < cave_minimum` de la
  table. Une recave n'a pas de minimum imposé.
- `montant_total_joueur` = somme des `montant_cave` du joueur sur
  `(table_jeu_id, date_jeu)`, mouvement courant inclus.
- Si `statut_paiement = 'PAYE'` : crée une `casino_cash_operations` de
  type `BUY_IN`, avec écriture financière globale (`ref_flux_global`)
  comme tout buy-in. Si `'NON_PAYE'` : aucune écriture de caisse tant que
  le solde n'est pas régularisé.

**Sortie 201** : la ligne cave créée, avec `numero_cave`, `heure_arrivee`,
`montant_total_joueur`.

### `GET /tables-jeu/:id/caves?date=`
Liste brute des caves/recaves de la table pour une date donnée
(`YYYY-MM-DD`, défaut = aujourd'hui).

### `GET /tables-jeu/:id/feuille?date=`
La **feuille de table** consolidée, prête à afficher/imprimer : par ligne,
`joueur, numero_adherent, heure_arrivee, heure, numero_cave, montant_cave,
montant_total_joueur, statut_paiement, moyen_paiement, signature_presente` ;
plus des `totaux` : `total_cashing_jetons, total_caves_encaissees,
montant_paye_especes, montant_paye_tpe, montant_non_paye`.

### `POST /table-caves/:caveId/signature`
**Entrée** `{ "signature_data": "data:image/png;base64,..." }`
**Sortie 201** : nouvelle ligne dans `signatures` (même table que le KYC,
`signable_type: 'casino_table_cave'`).

### `GET /table-caves/:caveId/signature`
Dernière signature de cette cave (`null` si absente — à afficher comme
alerte dans la feuille de table).

### Codes d'erreur spécifiques

| Code | Cas |
|---|---|
| 400 | `montant < cave_minimum` sur une 1ère cave, table fermée, `client_id`/`client_libre` manquants |
| 404 | Table de jeu ou cave introuvable |
| 409 | `numero` de table déjà utilisé dans la salle |

---

## Prolongations & Pourboires

### Prolongation (salaire horaire du croupier, à charge du joueur)

Chaque table fixe, à sa création, un `salaire_horaire_croupier`
(Ariary/heure), un `duree_jeu_simple_minutes` (défaut 120) et un
`duree_prolongation_minutes` (défaut 60). Deux phases, calculées côté
serveur par `calculerEtatProlongation(table)` (et répliquées côté front
dans `etatMinuteur`, pour l'affichage du compte à rebours sans appel
réseau) :

1. **Phase « jeu simple »** — tant qu'aucune prolongation n'a encore été
   accordée (`derniere_prolongation_at IS NULL`) : référence =
   `derniere_ouverture_at` (ou `created_at` si la table n'a jamais été
   ouverte explicitement via `/ouvrir`), durée = `duree_jeu_simple_minutes`.
   Le bouton « Prolongation » n'est pas affiché avant l'expiration. À
   expiration : badge « Temps de jeu terminé », le bouton apparaît pour la
   première fois.

   **Le timer se remet à zéro à chaque cycle ouverture/fermeture** :
   `POST /tables-jeu/:id/ouvrir` met à jour `derniere_ouverture_at = NOW()`
   et remet `derniere_prolongation_at` à `NULL` (nouvelle session de jeu =
   on repart en phase JEU_SIMPLE, l'historique de prolongation d'une
   session précédente ne compte plus). `POST /tables-jeu/:id/fermer` remet
   également `derniere_prolongation_at` à `NULL` par sécurité.
2. **Phase « prolongation »** — dès qu'au moins une prolongation existe :
   référence = `derniere_prolongation_at`, durée =
   `duree_prolongation_minutes`. Le bouton est masqué (remplacé par un
   compte à rebours mm:ss) tant que cette durée n'est pas écoulée ; à
   expiration : badge « Timeout Pour la Prolongation », le bouton
   redevient disponible.

Le serveur applique la même règle côté API (`400` si appelée trop tôt,
quelle que soit la phase) — le front n'est pas la seule barrière.

#### `POST /tables-jeu/:id/prolongations`
**Entrée** `{ session_id, client_id?|client_libre?, statut_paiement, moyen_paiement? }`
Le montant n'est **pas** dans le body : c'est toujours
`table.salaire_horaire_croupier` au moment de l'appel (snapshot en base).
**400** si la période en cours n'est pas terminée, ou si la table est
fermée. Génère une `casino_cash_operations` de type `PROLONGATION` si
payée (comme un buy-in), et relance le timer (`derniere_prolongation_at = NOW()`).
Exige une signature du joueur, comme les caves
(`signable_type: 'casino_table_prolongation'`).

#### `GET /tables-jeu/:id/prolongations?date=`
Liste brute des prolongations du jour.

#### `POST /table-prolongations/:prolongationId/signature`
Même mécanisme que `/table-caves/:caveId/signature`.

### Pourboires (déclaratif, jetons ou espèces)

Contrairement aux caves/prolongations, un pourboire ne génère **aucune**
écriture de caisse : l'argent a déjà transité par la caisse via les caves.
C'est une déclaration servant à isoler la part du croupier en fin de
service. Le front prompt ce montant juste avant la fermeture d'une table
(« Aucun pourboire » reste possible pour fermer sans rien déclarer).

#### `POST /tables-jeu/:id/pourboires`
**Entrée** `{ session_id, montant, type_pourboire: 'JETONS'|'ESPECES' }`

#### `GET /tables-jeu/:id/pourboires?date=`
Liste brute des pourboires du jour.

### `GET /tables-jeu/:id/feuille?date=` (mise à jour)
La feuille de table inclut désormais `prolongations` (même forme que
`lignes`, sans `numero_cave`/`numero_adherent`), `pourboires` (`{ total_jetons,
total_especes, total }`), et dans `totaux` : `total_prolongation,
total_prolongation_payee, total_prolongation_non_payee`.

---

## Présence par table & temps de jeu

`heure_arrivee` (sur `casino_table_caves`) donnait un début, mais rien
n'enregistrait de fin — impossible de totaliser un vrai temps de jeu.
`casino_table_visits` comble ce trou (même principe que `casino_visits` au
niveau salle) :
- **Arrivée automatique** : 1ère cave du joueur sur la table, le jour même
  → ouverture d'une présence (`entree_at`).
- **Départ** : manuel via `POST /table-visits/:visitId/terminer` (bouton
  « Terminer » dans « Joueurs actifs »), ou automatique à la fermeture de
  la table (`POST /tables-jeu/:id/fermer` clôture toutes les présences
  encore ouvertes de cette table).
- **Limite connue** : si un joueur revient sur la même table le même jour
  après un vrai départ, sa présence n'est pas rouverte (seule la 1ère cave
  du jour déclenche une arrivée) — le temps compté reste continu du 1er
  `entree_at` jusqu'au départ.

### `GET /tables-jeu/:id/joueurs-actifs`
Joueurs actuellement présents à la table (`sortie_at IS NULL`), avec
`minutes_ecoulees` depuis l'arrivée.

### `POST /table-visits/:visitId/terminer`
Départ manuel d'un joueur précis.

### `GET /reports/temps-jeu-joueur/:clientId?date=`
Temps de jeu total d'un joueur identifié. Sans `date`, cumul toutes dates
confondues. Renvoie aussi `type_jeu_prefere` et `par_type_jeu` (cumul par
`POKER/BLACKJACK/ROULETTE/BACCARA/AUTRE`, déterminé à partir des tables où
le joueur a une présence réelle enregistrée — jamais une inférence).
Affiché dans l'onglet « Temps de jeu » de la fiche client
(`ClientProfileModal.tsx`).

### `GET /reports/temps-jeu-jour?date=`
Temps de jeu total du jour (défaut aujourd'hui), toutes tables et tous
joueurs confondus, avec le détail par table. Affiché en bandeau en haut de
l'onglet « Tables de jeu ».

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