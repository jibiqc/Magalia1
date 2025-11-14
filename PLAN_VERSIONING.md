# Plan d'implémentation : Versioning des devis (Quote Versioning)

## Vue d'ensemble

Ce document décrit le plan d'implémentation pour ajouter un système de versioning complet aux devis dans Magal'IA. Le système permettra de créer, consulter, restaurer et gérer des versions (snapshots) de devis.

---

## 1. Architecture technique

### 1.1 Modèle de données backend

**Nouvelle table : `quote_versions`**

```sql
CREATE TABLE quote_versions (
    id INTEGER PRIMARY KEY,
    quote_id INTEGER NOT NULL,
    label VARCHAR(50) NOT NULL,              -- "v1", "v2", "v3", etc. (auto-généré, éditable)
    comment TEXT,                           -- Commentaire (obligatoire pour manuel, optionnel pour auto)
    created_at DATETIME NOT NULL,
    created_by VARCHAR(255),                -- Email de l'utilisateur
    type VARCHAR(50) NOT NULL,              -- "manual", "auto_export_word", "auto_export_pdf", "auto_export_excel", "auto_initial"
    export_type VARCHAR(20),                -- "word", "pdf", "excel", NULL
    export_file_name VARCHAR(255),          -- Nom du fichier exporté (optionnel)
    total_price DECIMAL(14,2),              -- Prix total au moment du snapshot
    snapshot_json JSON NOT NULL,            -- Snapshot complet du devis (QuoteOut format)
    archived_at DATETIME,                   -- NULL = actif, timestamp = archivé (soft delete)
    FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE
);

CREATE INDEX idx_quote_versions_quote_id ON quote_versions(quote_id);
CREATE INDEX idx_quote_versions_created_at ON quote_versions(created_at DESC);
CREATE INDEX idx_quote_versions_archived_at ON quote_versions(archived_at);
```

**Contraintes :**
- `label` unique par `quote_id` (sauf versions archivées)
- `snapshot_json` contient un JSON complet au format `QuoteOut` (identique à l'API GET `/quotes/{id}`)
- Pas de hard delete : toujours utiliser `archived_at` pour masquer

### 1.2 Modèle SQLAlchemy

**Fichier : `backend/src/models_quote.py`**

Ajouter la classe `QuoteVersion` :

```python
class QuoteVersion(Base):
    __tablename__ = "quote_versions"
    
    id = Column(Integer, primary_key=True, index=True)
    quote_id = Column(Integer, ForeignKey("quotes.id", ondelete="CASCADE"), nullable=False, index=True)
    label = Column(String(50), nullable=False)
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    created_by = Column(String(255), nullable=True)  # Email
    type = Column(String(50), nullable=False)  # manual, auto_export_word, etc.
    export_type = Column(String(20), nullable=True)  # word, pdf, excel, null
    export_file_name = Column(String(255), nullable=True)
    total_price = Column(DEC2, nullable=True)
    snapshot_json = Column(JSON, nullable=False)
    archived_at = Column(DateTime, nullable=True, index=True)
    
    quote = relationship("Quote", backref="versions")
```

### 1.3 Schémas Pydantic

**Fichier : `backend/src/api/schemas_quote.py`**

Ajouter les schémas suivants :

```python
class QuoteVersionOut(BaseModel):
    id: int
    quote_id: int
    label: str
    comment: Optional[str]
    created_at: str  # ISO format
    created_by: Optional[str]
    type: str
    export_type: Optional[str]
    export_file_name: Optional[str]
    total_price: Optional[float]
    archived_at: Optional[str]  # ISO format

class QuoteVersionIn(BaseModel):
    comment: str  # Obligatoire pour création manuelle

class QuoteVersionPatch(BaseModel):
    label: Optional[str] = None
    comment: Optional[str] = None

class QuoteVersionListOut(BaseModel):
    items: List[QuoteVersionOut]
    total: int
    has_more: bool
```

### 1.4 API Endpoints

**Fichier : `backend/src/api/quotes.py`**

Nouveaux endpoints à ajouter :

```
GET    /quotes/{quote_id}/versions           # Liste des versions (paginée, exclut archivées par défaut)
POST   /quotes/{quote_id}/versions            # Créer une version manuelle
GET    /quotes/{quote_id}/versions/{version_id}  # Détails d'une version
PATCH  /quotes/{quote_id}/versions/{version_id}  # Modifier label/comment
POST   /quotes/{quote_id}/versions/{version_id}/restore  # Restaurer une version
POST   /quotes/{quote_id}/versions/{version_id}/archive  # Archiver une version
```

### 1.5 Fonctions utilitaires backend

**Fichier : `backend/src/services/quote_versioning.py` (nouveau)**

Fonctions à créer :

1. `create_version(db, quote_id, type, comment, created_by, export_type=None, export_file_name=None)`
   - Génère automatiquement le `label` (v1, v2, v3...)
   - Calcule `total_price` depuis le devis
   - Crée le `snapshot_json` via `_to_out(q, db)`
   - Applique le throttle pour les versions automatiques
   - Retourne `QuoteVersion`

2. `get_next_version_label(db, quote_id)`
   - Trouve le prochain numéro de version (v1, v2, v3...)
   - Ignore les versions archivées

3. `should_create_auto_version(db, quote_id, type)`
   - Vérifie le throttle (max 1 version auto par heure pour le même quote)
   - Retourne booléen

4. `restore_version(db, quote_id, version_id, created_by)`
   - Crée d'abord une version auto du state actuel ("Auto: state before restore from vX")
   - Restaure ensuite le snapshot depuis `version_id`
   - Retourne le devis restauré

### 1.6 Intégration avec les exports

**Modifications dans :**
- `backend/src/api/quotes.py` : `export_quote_word()`, `export_quote_excel()`
- Ajouter la création automatique de version après export réussi

### 1.7 Intégration avec la création de devis

**Modification dans :**
- `backend/src/api/quotes.py` : `create_quote()`
- Créer une version initiale automatique après création

### 1.8 Logging (audit)

**Intégration avec :**
- `backend/src/services/audit.py` : `log_change()`
- Logger toutes les actions de versioning :
  - `version_created` (manual/auto)
  - `version_restored`
  - `version_archived`
  - `version_label_edited`
  - `version_comment_edited`

---

## 2. Frontend

### 2.1 Composant modal d'historique

**Fichier : `frontend/src/components/modals/QuoteVersionsModal.jsx` (nouveau)**

Composant full-screen modal avec :
- Liste paginée (10 versions par page, "Load more")
- Filtre pour afficher/masquer les versions archivées
- Actions par version : View, Restore, Rename, Edit comment, Archive
- Affichage : label, timestamp, user, type, comment (tronqué), total_price

### 2.2 Intégration dans QuoteEditor

**Fichier : `frontend/src/pages/QuoteEditor.jsx`**

- Ajouter un bouton "Versions / History" dans le header (à côté de "Export Word")
- Ouvrir le modal `QuoteVersionsModal` au clic

### 2.3 API client

**Fichier : `frontend/src/lib/api.js`**

Ajouter les méthodes :

```javascript
async getQuoteVersions(quoteId, limit = 10, offset = 0, includeArchived = false)
async createQuoteVersion(quoteId, comment)
async getQuoteVersion(quoteId, versionId)
async patchQuoteVersion(quoteId, versionId, { label, comment })
async restoreQuoteVersion(quoteId, versionId)
async archiveQuoteVersion(quoteId, versionId)
```

### 2.4 Bouton "Save version"

**Fichier : `frontend/src/pages/QuoteEditor.jsx`**

- Ajouter un bouton "Save version" dans le header
- Ouvrir un modal simple pour saisir le commentaire (obligatoire)
- Appeler `createQuoteVersion()` après validation

---

## 3. Plan d'implémentation par patches

### Patch 1 : Migration et modèle backend (≈45 min)
**Fichiers :**
- `backend/migrations/versions/XXXXX_add_quote_versions_table.py` (nouveau)
- `backend/src/models_quote.py` (ajout classe `QuoteVersion`)

**Actions :**
1. Créer la migration Alembic pour la table `quote_versions`
2. Ajouter le modèle SQLAlchemy `QuoteVersion`
3. Tester la migration (up/down)

**Validation :**
- Migration appliquée sans erreur
- Modèle accessible via SQLAlchemy

---

### Patch 2 : Schémas Pydantic et utilitaires de base (≈50 min)
**Fichiers :**
- `backend/src/api/schemas_quote.py` (ajout schémas)
- `backend/src/services/quote_versioning.py` (nouveau)

**Actions :**
1. Ajouter les schémas Pydantic (`QuoteVersionOut`, `QuoteVersionIn`, etc.)
2. Créer `get_next_version_label()` et `should_create_auto_version()`
3. Tests unitaires basiques pour ces fonctions

**Validation :**
- Schémas validés par Pydantic
- Fonctions utilitaires testées

---

### Patch 3 : Endpoints API de base (GET, POST) (≈55 min)
**Fichiers :**
- `backend/src/api/quotes.py` (ajout endpoints)
- `backend/src/services/quote_versioning.py` (fonction `create_version()`)

**Actions :**
1. Implémenter `create_version()` dans `quote_versioning.py`
2. Ajouter `POST /quotes/{quote_id}/versions` (création manuelle)
3. Ajouter `GET /quotes/{quote_id}/versions` (liste paginée)
4. Ajouter `GET /quotes/{quote_id}/versions/{version_id}` (détails)

**Validation :**
- Endpoints répondent correctement
- Création de version fonctionne
- Liste paginée fonctionne

---

### Patch 4 : Endpoints PATCH, archive, restore (≈60 min)
**Fichiers :**
- `backend/src/api/quotes.py` (ajout endpoints)
- `backend/src/services/quote_versioning.py` (fonction `restore_version()`)

**Actions :**
1. Implémenter `restore_version()` avec création de version "before restore"
2. Ajouter `PATCH /quotes/{quote_id}/versions/{version_id}`
3. Ajouter `POST /quotes/{quote_id}/versions/{version_id}/restore`
4. Ajouter `POST /quotes/{quote_id}/versions/{version_id}/archive`

**Validation :**
- Restore crée bien une version "before restore"
- Restore fonctionne correctement
- Archive fonctionne (soft delete)

---

### Patch 5 : Intégration création initiale et exports (≈50 min)
**Fichiers :**
- `backend/src/api/quotes.py` (modifications `create_quote()`, `export_quote_word()`, `export_quote_excel()`)

**Actions :**
1. Créer version initiale automatique dans `create_quote()` (après commit)
2. Créer version automatique dans `export_quote_word()` (après export réussi)
3. Demander confirmation utilisateur pour Excel (via paramètre optionnel `create_version=true`)
4. Appliquer le throttle (max 1 version auto/heure)

**Validation :**
- Version initiale créée à la création de devis
- Version créée après export Word
- Throttle fonctionne

---

### Patch 6 : Intégration audit logging (≈30 min)
**Fichiers :**
- `backend/src/api/quotes.py` (ajout appels `log_change()`)
- `backend/src/services/quote_versioning.py` (ajout appels `log_change()`)

**Actions :**
1. Logger `version_created` (manual/auto)
2. Logger `version_restored`
3. Logger `version_archived`
4. Logger `version_label_edited` et `version_comment_edited`

**Validation :**
- Toutes les actions sont loggées dans `audit_logs`

---

### Patch 7 : API client frontend (≈25 min)
**Fichiers :**
- `frontend/src/lib/api.js` (ajout méthodes)

**Actions :**
1. Ajouter toutes les méthodes API pour les versions
2. Tester les appels depuis la console

**Validation :**
- Toutes les méthodes API sont disponibles
- Appels fonctionnent depuis le navigateur

---

### Patch 8 : Modal d'historique des versions (≈60 min)
**Fichiers :**
- `frontend/src/components/modals/QuoteVersionsModal.jsx` (nouveau)

**Actions :**
1. Créer le composant modal full-screen
2. Implémenter la liste paginée (10 versions, "Load more")
3. Afficher les informations : label, timestamp, user, type, comment (tronqué), total_price
4. Implémenter les actions : View, Restore (avec confirmation), Rename, Edit comment, Archive
5. Filtre pour afficher/masquer les versions archivées

**Validation :**
- Modal s'ouvre et affiche les versions
- Pagination fonctionne
- Actions fonctionnent

---

### Patch 9 : Intégration dans QuoteEditor (≈35 min)
**Fichiers :**
- `frontend/src/pages/QuoteEditor.jsx` (ajout bouton et modal)

**Actions :**
1. Ajouter le bouton "Versions / History" dans le header
2. Intégrer `QuoteVersionsModal`
3. Gérer le rafraîchissement du devis après restore

**Validation :**
- Bouton visible et fonctionnel
- Modal s'ouvre correctement
- Restore rafraîchit le devis

---

### Patch 10 : Bouton "Save version" (≈30 min)
**Fichiers :**
- `frontend/src/pages/QuoteEditor.jsx` (ajout bouton)
- `frontend/src/components/modals/SaveVersionModal.jsx` (nouveau, optionnel)

**Actions :**
1. Ajouter le bouton "Save version" dans le header
2. Créer un modal simple pour saisir le commentaire (obligatoire)
3. Appeler `createQuoteVersion()` après validation
4. Afficher un message de succès

**Validation :**
- Bouton fonctionne
- Commentaire obligatoire validé
- Version créée avec succès

---

## 4. Détails techniques importants

### 4.1 Format du snapshot JSON

Le `snapshot_json` doit être identique au format retourné par `GET /quotes/{id}` (format `QuoteOut`). Utiliser `_to_out(q, db)` pour générer le snapshot.

### 4.2 Throttle pour versions automatiques

Règle : maximum 1 version automatique par heure pour le même `quote_id` et le même `type`.

Implémentation :
```python
def should_create_auto_version(db, quote_id, type):
    one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
    recent = db.query(QuoteVersion).filter(
        QuoteVersion.quote_id == quote_id,
        QuoteVersion.type == type,
        QuoteVersion.created_at >= one_hour_ago,
        QuoteVersion.archived_at.is_(None)
    ).first()
    return recent is None
```

### 4.3 Génération automatique des labels

Format : `v1`, `v2`, `v3`, etc.

Implémentation :
```python
def get_next_version_label(db, quote_id):
    # Trouver le dernier numéro (ignore archivées)
    last = db.query(QuoteVersion).filter(
        QuoteVersion.quote_id == quote_id,
        QuoteVersion.archived_at.is_(None)
    ).order_by(QuoteVersion.created_at.desc()).first()
    
    if not last:
        return "v1"
    
    # Extraire le numéro du label (ex: "v5" -> 5)
    import re
    match = re.match(r'v(\d+)', last.label)
    if match:
        next_num = int(match.group(1)) + 1
    else:
        next_num = 1
    
    return f"v{next_num}"
```

### 4.4 Restauration sécurisée

Lors de la restauration :
1. Créer une version automatique du state actuel avec commentaire : `"Auto: state before restore from {version_label}"`
2. Charger le `snapshot_json` de la version à restaurer
3. Utiliser `upsert_quote()` pour restaurer le devis (remplacer tous les days/lines)

### 4.5 Gestion des utilisateurs

Pour `created_by`, utiliser l'email de l'utilisateur connecté :
- Récupérer via `get_current_user(request, db)` dans les endpoints
- Si non authentifié, utiliser `"system"` ou `None`

### 4.6 Calcul du total_price

Utiliser `grand_total` du devis au moment du snapshot :
```python
total_price = float(q.grand_total) if q.grand_total is not None else None
```

---

## 5. Tests et validation

### 5.1 Tests backend (à faire manuellement)

1. Créer un devis → vérifier version initiale créée
2. Exporter Word → vérifier version créée
3. Exporter Excel avec `create_version=true` → vérifier version créée
4. Créer version manuelle → vérifier label auto-généré
5. Restaurer une version → vérifier version "before restore" créée
6. Archiver une version → vérifier `archived_at` défini
7. Modifier label/comment → vérifier mise à jour
8. Throttle : créer 2 exports Word en < 1h → vérifier seule la première crée une version

### 5.2 Tests frontend (à faire manuellement)

1. Ouvrir modal d'historique → vérifier liste des versions
2. Pagination "Load more" → vérifier chargement
3. Restaurer une version → vérifier confirmation et rafraîchissement
4. Archiver une version → vérifier disparition de la liste
5. Modifier label/comment → vérifier mise à jour
6. Créer version manuelle → vérifier apparition dans la liste

---

## 6. Notes de sécurité

- **Permissions** : Pour MVP, tout utilisateur authentifié peut gérer les versions d'un devis qu'il peut accéder
- **Soft delete uniquement** : Jamais de hard delete, toujours utiliser `archived_at`
- **Validation** : Valider que `quote_id` existe avant toute opération
- **Throttle** : Protéger contre la création excessive de versions automatiques

---

## 7. Ordre d'implémentation recommandé

1. **Backend d'abord** : Patches 1-6 (migration, modèles, API, intégrations)
2. **Frontend ensuite** : Patches 7-10 (API client, modals, intégration)
3. **Tests** : Valider chaque patch avant de passer au suivant

---

## 8. Estimation totale

- **Backend** : ~5h30 (patches 1-6)
- **Frontend** : ~2h30 (patches 7-10)
- **Total** : ~8h de développement

Chaque patch est conçu pour être ≤ 60 minutes, avec des marges de sécurité.

---

## 9. Fichiers impactés (résumé)

### Backend
- `backend/migrations/versions/XXXXX_add_quote_versions_table.py` (nouveau)
- `backend/src/models_quote.py` (ajout `QuoteVersion`)
- `backend/src/api/schemas_quote.py` (ajout schémas)
- `backend/src/api/quotes.py` (ajout endpoints, modifications exports)
- `backend/src/services/quote_versioning.py` (nouveau)
- `backend/src/services/audit.py` (utilisé, pas modifié)

### Frontend
- `frontend/src/lib/api.js` (ajout méthodes)
- `frontend/src/pages/QuoteEditor.jsx` (ajout boutons, intégration modal)
- `frontend/src/components/modals/QuoteVersionsModal.jsx` (nouveau)
- `frontend/src/components/modals/SaveVersionModal.jsx` (nouveau, optionnel)

---

**Fin du plan d'implémentation**

