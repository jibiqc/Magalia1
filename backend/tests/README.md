# Protocole de Test pour Magalia

## Structure des Tests

Les tests sont organisés dans le dossier `backend/tests/` :

- `conftest.py` : Fixtures partagées (base de données de test, client HTTP)
- `test_health.py` : Tests pour l'endpoint de santé
- `test_quotes.py` : Tests pour les endpoints de devis
- `test_destinations.py` : Tests pour les endpoints de destinations

## Exécution des Tests

### Lancer tous les tests
```bash
cd backend
.\venv\Scripts\Activate.ps1
pytest
```

### Lancer avec verbosité
```bash
pytest -v
```

### Lancer un fichier spécifique
```bash
pytest tests/test_quotes.py
```

### Lancer un test spécifique
```bash
pytest tests/test_quotes.py::test_create_quote_minimal
```

### Lancer avec couverture de code
```bash
pytest --cov=src --cov-report=html
```

## Note sur la Base de Données

⚠️ **Important** : Actuellement, les tests utilisent la base de données réelle (`app.db`). 

Pour une isolation complète, il est recommandé de :
1. Utiliser une variable d'environnement pour pointer vers une base de test
2. Ou modifier `src/models/db.py` pour détecter un environnement de test

## Bonnes Pratiques

1. **Isolation** : Chaque test doit être indépendant
2. **Fixtures** : Utiliser `conftest.py` pour les ressources partagées
3. **Noms explicites** : `test_<fonctionnalité>_<scénario>`
4. **AAA Pattern** : Arrange, Act, Assert
5. **Tests de validation** : Tester les cas limites et erreurs

## Structure d'un Test

```python
def test_create_quote_minimal(client):
    """Test de création d'un devis avec les champs minimaux."""
    # Arrange : Préparer les données
    payload = {
        "title": "Test Quote",
        "pax": 2,
        "days": []
    }
    
    # Act : Exécuter l'action
    response = client.post("/quotes", json=payload)
    
    # Assert : Vérifier le résultat
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Test Quote"
    assert "id" in data
```

## Prochaines Étapes

- [ ] Configurer une base de données de test isolée
- [ ] Ajouter des tests pour les endpoints de services
- [ ] Ajouter des tests d'intégration pour les workflows complets
- [ ] Configurer la couverture de code dans CI/CD

