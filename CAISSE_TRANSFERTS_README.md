# API Transferts inter-caisses — `caisseTransfersRoutes.js`

Module **transversal**, indépendant du casino : permet de transférer des
fonds physiques entre la caisse d'un département et celle d'un autre (ex :
la cage casino avance de la monnaie au tiroir restaurant, ou l'inverse en
fin de service). Ce n'est **pas** un crédit client — aucun `client_id`
n'intervient, c'est un mouvement interne entre deux caisses de
l'établissement.

Toutes les routes sont montées sous `/api/caisse-transfers` et protégées par
`requireAuth` (header `Authorization: Bearer <token>`). Le token JWT décodé
fournit `req.user = { id_admin, role, email }`.

Format des montants : entiers en Ariary (pas de décimales). Dates : `datetime`
MySQL (`YYYY-MM-DD HH:MM:SS`).

---

## Principe : déclaration puis confirmation

Un transfert suit toujours deux étapes, comme une remise d'espèces physique :

1. **`POST /`** — la caisse source **déclare** l'envoi (`statut: 'EN_ATTENTE'`).
   L'argent est annoncé mais pas encore compté par la caisse destination.
2. **`POST /:id/confirm`** — la caisse destination **confirme** avoir
   physiquement reçu et recompté la somme. C'est ce moment précis qui génère
   les écritures dans `financial_transactions` et, côté casino, le mouvement
   correspondant dans `casino_cash_operations` (`TRANSFERT_SORTANT` /
   `TRANSFERT_ENTRANT`).

Ce découplage évite qu'un transfert annoncé mais jamais physiquement remis
ne fausse le solde théorique d'une caisse.

`module_source` / `module_destination` ∈ `CASINO, RESTAURANT, BAR, BOUTIQUE,
HEBERGEMENT`. **Seuls `CASINO` et `RESTAURANT` sont pris en charge
aujourd'hui** — Boutique et Hébergement n'ont pas encore de table de session
de caisse dédiée en base ; un transfert impliquant ces modules renvoie
**400**.

Chaque objet transfert renvoyé (par tous les endpoints de lecture/écriture
ci-dessous) est **enrichi côté serveur** avec le code de la caisse, quand il
est résolvable :

| Champ | Description |
|---|---|
| `cashier_source_code` / `cashier_source_nom` | Résolus par jointure `casino_cashier_sessions → casino_cashiers` si `module_source = 'CASINO'`, sinon `null` |
| `cashier_destination_code` / `cashier_destination_nom` | Idem pour `module_destination` |

Seul **CASINO** est résolu pour l'instant — les autres modules n'ont pas de
table de caisse dédiée exploitable de la même façon. Le frontend doit
toujours prévoir un repli sur `module_x (session #id)` quand ces champs sont
`null`.

---

## Contrôle de solde à la déclaration

Quand `module_source = 'CASINO'`, `POST /` vérifie que `montant` ne dépasse
pas le **solde théorique disponible** de la caisse émettrice avant
d'accepter la déclaration :

```
solde_disponible = fond_initial + entrées − sorties − transferts_sortants_EN_ATTENTE
```

- `entrées`/`sorties` répliquent exactement le calcul de
  `computeSessionTotals()` (`casinoController.js`) : opérations de caisse
  (`BUY_IN`, `DEPOT`, `REMBOURSEMENT_CREDIT`, `TRANSFERT_ENTRANT` en
  entrée ; `CASH_OUT`, `AVANCE_CREDIT`, `TRANSFERT_SORTANT` en sortie) **et**
  mouvements de jetons (`ACHAT` en entrée, `REPRISE` en sortie).
- `transferts_sortants_EN_ATTENTE` : somme des transferts déjà déclarés
  depuis cette même session mais pas encore confirmés. Sans cette
  déduction, deux transferts déclarés coup sur coup (avant confirmation du
  premier) pourraient ensemble dépasser le solde réel — seule la
  **confirmation** écrit dans `casino_cash_operations`, la déclaration seule
  ne réserve rien par défaut.
- La session source est verrouillée (`FOR UPDATE`) le temps du calcul, pour
  qu'une déclaration concurrente sur la même caisse ne contourne pas le
  contrôle.
- **Non appliqué** si `module_source ≠ 'CASINO'` : pas de ledger
  équivalent à `casino_cash_operations` pour les autres modules (même
  limitation que documentée plus bas).

**409** si dépassement :
```json
{ "message": "Fonds insuffisants en caisse (disponible : 150000 Ar, demandé : 200000 Ar)" }
```

---

## `POST /`

Déclare un transfert (`session_source_id` / `session_destination_id` sont
les identifiants de session **dans leur table respective** : une
`casino_cashier_sessions.id` si le module est `CASINO`, une
`restaurant_sessions.id` si le module est `RESTAURANT`, etc.).

**Entrée**
```json
{
  "module_source": "CASINO",
  "session_source_id": 6,
  "module_destination": "RESTAURANT",
  "session_destination_id": 14,
  "montant": 200000,
  "motif": "Appoint pour le service du soir"
}
```

**Sortie 201**
```json
{
  "id": 3,
  "module_source": "CASINO",
  "session_source_id": 6,
  "module_destination": "RESTAURANT",
  "session_destination_id": 14,
  "montant": 200000,
  "motif": "Appoint pour le service du soir",
  "statut": "EN_ATTENTE",
  "ref_flux_global_source": null,
  "ref_flux_global_destination": null,
  "created_by": 1,
  "confirmed_by": null,
  "created_at": "2026-07-10 18:02:11",
  "confirmed_at": null,
  "cashier_source_code": "CAISSE-02",
  "cashier_source_nom": "Caisse N-02",
  "cashier_destination_code": null,
  "cashier_destination_nom": null
}
```
(`cashier_destination_*` à `null` ici car `RESTAURANT` n'est pas encore résolu — voir « Enrichissement » ci-dessus.)

**400** si :
- `montant` invalide (absent, ≤ 0)
- `module_source`/`module_destination` hors de la liste `CASINO, RESTAURANT, BAR, BOUTIQUE, HEBERGEMENT`
- caisse source et destination identiques (même module + même session)
- module non pris en charge (pas de table de session dédiée — cas actuel de `BAR`/`BOUTIQUE`/`HEBERGEMENT`)
- session source ou destination introuvable / fermée
  ```json
  { "message": "Session RESTAURANT #14 introuvable ou fermée" }
  ```

**409** si `module_source = 'CASINO'` et `montant` dépasse le solde
disponible de la caisse émettrice (voir « Contrôle de solde » ci-dessus) :
```json
{ "message": "Fonds insuffisants en caisse (disponible : 150000 Ar, demandé : 200000 Ar)" }
```

---

## `POST /:id/confirm`

Confirme la réception physique. Aucun corps requis.

**Sortie 200**
```json
{
  "id": 3,
  "module_source": "CASINO",
  "session_source_id": 6,
  "module_destination": "RESTAURANT",
  "session_destination_id": 14,
  "montant": 200000,
  "motif": "Appoint pour le service du soir",
  "statut": "CONFIRME",
  "ref_flux_global_source": "b7e2b0b0-1a2e-4c3d-9f4e-5a6b7c8d9e0f",
  "ref_flux_global_destination": "c8f3c1c1-2b3f-5d4e-0a5f-6b7c8d9e0f1a",
  "created_by": 1,
  "confirmed_by": 4,
  "created_at": "2026-07-10 18:02:11",
  "confirmed_at": "2026-07-10 18:05:47",
  "cashier_source_code": "CAISSE-02",
  "cashier_source_nom": "Caisse N-02",
  "cashier_destination_code": null,
  "cashier_destination_nom": null
}
```

Effets de bord :
- **Côté casino** (si `module_source` ou `module_destination` = `CASINO`) :
  une ligne `casino_cash_operations` est créée avec `type_operation:
  'TRANSFERT_SORTANT'` (source) ou `'TRANSFERT_ENTRANT'` (destination),
  `transfer_id` pointant vers ce transfert. Le calcul du solde théorique de
  session (`GET /api/casino/sessions/:id/summary`) en tient compte
  automatiquement.
- **Deux écritures** dans `financial_transactions` : une `SORTIE_TRANSFERT_CAISSE`
  imputée à `module_source`, une `ENTREE_TRANSFERT_CAISSE` imputée à
  `module_destination` — chacune avec sa propre `ref_flux_global`.

**404** si le transfert n'existe pas.
**409** si le transfert n'est plus `EN_ATTENTE` (déjà confirmé/refusé) :
```json
{ "message": "Transfert déjà CONFIRME" }
```

---

## `POST /:id/reject`

Refuse un transfert encore en attente (ex : la caisse destination constate
un montant physique différent de ce qui a été déclaré).

**Entrée**
```json
{ "motif_refus": "Montant physique compté : 180 000 Ar, écart non justifié" }
```

**Sortie 200**
```json
{
  "id": 3,
  "statut": "REFUSE",
  "motif": "Appoint pour le service du soir | refus: Montant physique compté : 180 000 Ar, écart non justifié",
  "...": "..."
}
```

**409** si le transfert n'est plus `EN_ATTENTE`.

### Corriger un transfert sortant déjà déclaré (pas de `PUT`)

Il n'existe volontairement aucune route de modification d'un transfert
`EN_ATTENTE` — un transfert déclaré est immuable, pour la traçabilité. Le
correctif standard, utilisé par le frontend (bouton **« Procéder »** sur un
transfert sortant), est :

1. `POST /` avec les valeurs corrigées → nouveau transfert
2. `POST /:id/reject` sur l'ancien, avec `motif_refus: "Remplacé par le transfert #<nouvel_id>"`

Cette séquence n'est pas atomique côté serveur (deux appels distincts) : si
l'étape 2 échoue après un succès de l'étape 1, les deux transferts restent
visibles (l'ancien encore `EN_ATTENTE`) — c'est acceptable car aucune
écriture financière n'a lieu avant confirmation, et l'incohérence reste
visible et corrigible manuellement via un nouveau `reject`.

---

## `GET /`

Historique, filtrable.

**Requête** : `GET /api/caisse-transfers?module=CASINO&statut=EN_ATTENTE&limit=50`

| Paramètre | Description |
|---|---|
| `module` | Filtre les transferts où ce module est source **ou** destination |
| `statut` | `EN_ATTENTE`, `CONFIRME`, `REFUSE`, `ANNULE` |
| `limit`, `offset` | Pagination (défaut `limit=100`, `offset=0`) |

**Sortie 200** : tableau d'objets transfert (même forme que `POST /`).

---

## `GET /:id`

**Sortie 200** : un objet transfert. **404** si introuvable.

---

## `GET /pending/casino/:sessionId`

Raccourci pratique pour l'UI casino : transferts `EN_ATTENTE` touchant une
session de caisse casino donnée (comme source **ou** destination) — utile
pour afficher une pastille « transfert à confirmer » sur l'écran de caisse
sans devoir tout lister puis filtrer côté client.

**Requête** : `GET /api/caisse-transfers/pending/casino/6`

**Sortie 200**
```json
[
  {
    "id": 3,
    "module_source": "CASINO",
    "session_source_id": 6,
    "module_destination": "RESTAURANT",
    "session_destination_id": 14,
    "montant": 200000,
    "motif": "Appoint pour le service du soir",
    "statut": "EN_ATTENTE",
    "created_by": 1,
    "created_at": "2026-07-10 18:02:11",
    "cashier_source_code": "CAISSE-02",
    "cashier_source_nom": "Caisse N-02",
    "cashier_destination_code": null,
    "cashier_destination_nom": null
  }
]
```

---

## Codes d'erreur communs

| Code | Cas |
|---|---|
| 400 | Montant invalide, module inconnu ou non pris en charge, caisse source = caisse destination, session introuvable/fermée |
| 401 | Token manquant/invalide |
| 404 | Transfert introuvable |
| 409 | Transfert déjà confirmé/refusé (le workflow ne peut être rejoué) ; ou fonds insuffisants en caisse casino émettrice (`POST /`) |

---

## Limitation connue

Contrairement au casino (`casino_cash_operations`), le module **Restaurant
n'a pas de ledger d'opérations de caisse**. Un transfert confirmé impliquant
`RESTAURANT` génère bien l'écriture `financial_transactions`, mais
n'ajuste aucun « solde théorique » restaurant — cette notion n'existe pas
encore côté restaurant. Si ce calcul devient nécessaire, il faudra soit
construire l'équivalent de `casino_cash_operations` pour ce module, soit
faire calculer son solde théorique en intégrant directement `caisse_transfers`
(`SUM` des transferts confirmés où `module_destination`/`module_source` =
`'RESTAURANT'` et `session_destination_id`/`session_source_id` = la session
courante).

Même limitation pour l'enrichissement `cashier_*_code`/`cashier_*_nom` :
seul `CASINO` est résolu (jointure vers `casino_cashiers`). Tant que
`RESTAURANT`/`BAR`/`BOUTIQUE`/`HEBERGEMENT` n'ont pas de table de caisse
avec un champ `code` équivalent, ces champs resteront `null` pour eux — ce
n'est pas un bug, c'est l'état actuel du schéma.