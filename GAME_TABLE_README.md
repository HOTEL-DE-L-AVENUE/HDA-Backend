# Extension — Tables de jeu & Caves/Recaves

À ajouter à `CASINO_README.md`. Complète le module casino existant sans le
modifier : nouvelles routes sous `/api/casino`, mêmes conventions
(`requireAuth`, enveloppe `{ success, data }`, montants en Ariary entiers).

---

## Principe

Une **salle** peut contenir des **tables de jeu** (poker, blackjack, etc.).
Chaque table définit une **cave minimum** : le montant que le joueur doit
miser pour s'installer. S'il épuise ses jetons, il peut faire une
**recave** (réapprovisionnement), sans minimum imposé par défaut.

Chaque cave et chaque recave est un événement **tracé et signé** :
- Elle crée une ligne dans `casino_table_caves`.
- Si payée, elle génère une écriture de caisse (`casino_cash_operations`,
  type `BUY_IN`) exactement comme `/operations/buy-in`, avec en plus la
  référence de la table.
- Elle exige une signature du joueur, enregistrée via le module transversal
  déjà en place (`POST /api/clients/... /kyc/signature` généralisé ici à
  `signable_type: 'casino_table_cave'`).

---

## Tables de jeu

### `/tables-jeu` (CRUD standard)
Champs : `room_id, numero, type_jeu, cave_minimum, statut`.
`type_jeu` ∈ `POKER, BLACKJACK, ROULETTE, BACCARA, AUTRE`. `statut` ∈ `OUVERTE, FERMEE`.

### `POST /tables-jeu/:id/ouvrir` / `POST /tables-jeu/:id/fermer`
Bascule le statut. **409** si fermeture demandée alors que des caves du jour
n'ont pas de mouvement de sortie clôturé (à définir selon vos règles métier —
peut aussi être laissé libre si la fermeture de table n'implique pas de
clôture financière, celle-ci restant portée par la session de caisse).

---

## Caves & recaves

### `POST /tables-jeu/:id/caves`
Enregistre une cave (si c'est la première du joueur, ce jour, à cette table)
ou une recave (sinon) — le serveur détermine `numero_cave` automatiquement.

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
(`client_id` OU `client_libre`, l'un des deux. `numero_adherent` optionnel —
prérempli si le client a une carte de fidélité liée.)

**Logique serveur**
- `date_jeu` = date du jour.
- `numero_cave` = 1 + nombre de caves déjà enregistrées pour ce
  `(table_jeu_id, client_id/libre, date_jeu)`.
- `heure_arrivee` = si `numero_cave === 1`, l'heure actuelle ; sinon reprise
  de la valeur déjà enregistrée pour la première cave du joueur ce jour-là.
- Si `numero_cave === 1` : **400** si `montant < cave_minimum` de la table.
  Une recave n'a pas de minimum imposé par défaut.
- `montant_total_joueur` = somme des `montant_cave` du joueur sur
  `(table_jeu_id, date_jeu)`, mouvement courant inclus.
- `montant_jetons_remis` = `montant` par défaut (1 Ariary = 1 Ariary de
  jetons), surchageable si le body fournit `montant_jetons_remis` (arrondis,
  bonus, etc.).
- Si `statut_paiement = 'PAYE'` : crée une `casino_cash_operations` de type
  `BUY_IN` rattachée à `session_id`, avec `moyen_paiement`, et lie
  `cash_operation_id`. Écriture financière globale générée comme pour tout
  buy-in (`ref_flux_global`).
- Si `statut_paiement = 'NON_PAYE'` : aucune écriture de caisse n'est créée
  tant que le solde n'est pas réglé (à régulariser plus tard via un appel
  distinct, ou en pratique via une créance/`client_accounts` si vous
  souhaitez le tracer comme un crédit joueur — hors périmètre de cette
  extension).

**Sortie 201** : la ligne cave créée, y compris `numero_cave`,
`heure_arrivee`, `montant_total_joueur`.

### `GET /tables-jeu/:id/caves?date=`
Liste brute des caves/recaves de la table pour une date donnée
(`YYYY-MM-DD`, défaut = aujourd'hui).

### `GET /tables-jeu/:id/feuille?date=`
La **feuille de table** consolidée, prête à afficher/imprimer — reprend
exactement les colonnes demandées :

**Sortie 200**
```json
{
  "table": { "id": 3, "numero": "Table 1", "type_jeu": "POKER", "cave_minimum": 100000, "salle": "VIP" },
  "date": "2026-07-15",
  "lignes": [
    {
      "joueur": "Rakoto Jean",
      "numero_adherent": "ADH-0231",
      "heure_arrivee": "19:05",
      "heure": "19:05",
      "numero_cave": 1,
      "montant_cave": 200000,
      "montant_total_joueur": 200000,
      "statut_paiement": "PAYE",
      "moyen_paiement": "ESPECES",
      "signature_presente": true
    },
    {
      "joueur": "Rakoto Jean",
      "numero_adherent": "ADH-0231",
      "heure_arrivee": "19:05",
      "heure": "21:40",
      "numero_cave": 2,
      "montant_cave": 150000,
      "montant_total_joueur": 350000,
      "statut_paiement": "NON_PAYE",
      "moyen_paiement": null,
      "signature_presente": false
    }
  ],
  "totaux": {
    "total_cashing_jetons": 350000,
    "total_caves_encaissees": 200000,
    "montant_paye_especes": 200000,
    "montant_paye_tpe": 0,
    "montant_non_paye": 150000
  }
}
```
`total_caves_encaissees` = somme des `montant_cave` avec `statut_paiement = 'PAYE'`.
`total_cashing_jetons` = somme de `montant_jetons_remis`, payé ou non (jetons
physiquement sortis de la cage). `montant_non_paye` = somme des caves
`NON_PAYE`, pour relance/suivi.

---

## Signature d'une cave/recave

Réutilise le module transversal existant (voir `SIGNATURE_README.md`),
sans nouvelle table :

### `POST /table-caves/:caveId/signature`
**Entrée** `{ "signature_data": "data:image/png;base64,..." }`
**Sortie 201** : nouvelle ligne append-only, `signable_type: 'casino_table_cave'`.

### `GET /table-caves/:caveId/signature`
Dernière signature de cette cave (`null` si absente — la cave existe mais
n'est pas encore signée ; à afficher comme alerte dans la feuille de table).

---

## Codes d'erreur spécifiques

| Code | Cas |
|---|---|
| 400 | `montant < cave_minimum` sur une 1ère cave, salle/table fermée, `client_id`/`client_libre` manquants |
| 404 | Table de jeu introuvable |
| 409 | `numero` de table déjà utilisé dans la salle |