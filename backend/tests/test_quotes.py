"""
Tests pour les endpoints de quotes (devis).
"""
import pytest
from datetime import date, timedelta


def test_create_quote_minimal(client):
    """Test de création d'un devis avec les champs minimaux."""
    payload = {
        "title": "Test Quote",
        "pax": 2,
        "days": []
    }
    response = client.post("/quotes", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Test Quote"
    assert data["pax"] == 2
    assert "id" in data
    assert data["days"] == []


def test_create_quote_with_dates(client):
    """Test de création d'un devis avec des dates."""
    payload = {
        "title": "Quote avec dates",
        "pax": 4,
        "display_title": "Voyage en Europe",
        "start_date": "2024-06-01",
        "end_date": "2024-06-15",
        "days": []
    }
    response = client.post("/quotes", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Quote avec dates"
    assert data["start_date"] == "2024-06-01"
    assert data["end_date"] == "2024-06-15"


def test_create_quote_with_days(client):
    """Test de création d'un devis avec des jours."""
    payload = {
        "title": "Quote avec jours",
        "pax": 2,
        "days": [
            {
                "position": 0,
                "date": "2024-06-01",
                "destination": "Paris",
                "decorative_images": [],
                "lines": []
            },
            {
                "position": 1,
                "date": "2024-06-02",
                "destination": "Londres",
                "decorative_images": [],
                "lines": []
            }
        ]
    }
    response = client.post("/quotes", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert len(data["days"]) == 2
    assert data["days"][0]["destination"] == "Paris"
    assert data["days"][1]["destination"] == "Londres"


def test_create_quote_with_lines(client):
    """Test de création d'un devis avec des lignes de service."""
    payload = {
        "title": "Quote avec lignes",
        "pax": 2,
        "days": [
            {
                "position": 0,
                "date": "2024-06-01",
                "destination": "Paris",
                "lines": [
                    {
                        "position": 0,
                        "category": "Flight",
                        "title": "Vol Paris - Londres",
                        "achat_eur": 200.0,
                        "currency": "EUR"
                    }
                ]
            }
        ]
    }
    response = client.post("/quotes", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert len(data["days"]) == 1
    assert len(data["days"][0]["lines"]) == 1
    assert data["days"][0]["lines"][0]["category"] == "Flight"


def test_get_quote_not_found(client):
    """Test de récupération d'un devis inexistant."""
    response = client.get("/quotes/99999")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_get_quote_success(client):
    """Test de récupération d'un devis existant."""
    # Créer un devis
    payload = {
        "title": "Quote à récupérer",
        "pax": 2,
        "days": []
    }
    create_response = client.post("/quotes", json=payload)
    quote_id = create_response.json()["id"]
    
    # Récupérer le devis
    response = client.get(f"/quotes/{quote_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == quote_id
    assert data["title"] == "Quote à récupérer"


def test_list_recent_quotes_empty(client):
    """Test de liste des devis récents quand il n'y en a pas."""
    response = client.get("/quotes/recent?limit=5")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert isinstance(data["items"], list)
    assert len(data["items"]) == 0


def test_list_recent_quotes_with_data(client):
    """Test de liste des devis récents avec des données."""
    # Créer plusieurs devis
    for i in range(3):
        payload = {
            "title": f"Quote {i+1}",
            "pax": 2,
            "days": []
        }
        client.post("/quotes", json=payload)
    
    # Récupérer les devis récents
    response = client.get("/quotes/recent?limit=10")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert len(data["items"]) == 3
    # Les devis doivent être triés par date de mise à jour décroissante
    assert all("id" in quote for quote in data["items"])


def test_list_recent_quotes_limit(client):
    """Test que la limite fonctionne correctement."""
    # Créer 5 devis
    for i in range(5):
        payload = {
            "title": f"Quote {i+1}",
            "pax": 2,
            "days": []
        }
        client.post("/quotes", json=payload)
    
    # Demander seulement 2 devis
    response = client.get("/quotes/recent?limit=2")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert len(data["items"]) == 2


def test_update_quote(client):
    """Test de mise à jour d'un devis."""
    # Créer un devis
    payload = {
        "title": "Quote originale",
        "pax": 2,
        "days": []
    }
    create_response = client.post("/quotes", json=payload)
    quote_id = create_response.json()["id"]
    
    # Mettre à jour le devis
    update_payload = {
        "title": "Quote modifiée",
        "pax": 4,
        "days": []
    }
    response = client.put(f"/quotes/{quote_id}", json=update_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Quote modifiée"
    assert data["pax"] == 4


def test_create_quote_with_metadata(client):
    """Test de création d'un devis avec les métadonnées (agence, conseiller, etc.)."""
    payload = {
        "title": "Quote avec métadonnées",
        "pax": 2,
        "travel_agency": "Agence Test",
        "travel_advisor": "Conseiller Test",
        "client_name": "Client Test",
        "fx_rate": 1.1,
        "internal_note": "Note interne",
        "days": []
    }
    response = client.post("/quotes", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["travel_agency"] == "Agence Test"
    assert data["travel_advisor"] == "Conseiller Test"
    assert data["client_name"] == "Client Test"
    assert data["fx_rate"] == 1.1
    assert data["internal_note"] == "Note interne"

