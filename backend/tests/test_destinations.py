"""
Tests pour les endpoints de destinations.
"""
import pytest


def test_list_destinations_empty(client):
    """Test de liste vide de destinations."""
    response = client.get("/destinations")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
    assert len(response.json()) == 0


def test_create_destination(client):
    """Test de création d'une destination."""
    payload = {"name": "Paris"}
    response = client.post("/destinations", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Paris"
    assert "id" in data
    assert isinstance(data["id"], int)


def test_create_duplicate_destination(client):
    """Test que la création d'une destination dupliquée retourne l'existante."""
    payload = {"name": "Londres"}
    
    # Première création
    response1 = client.post("/destinations", json=payload)
    assert response1.status_code == 200
    first_id = response1.json()["id"]
    
    # Deuxième création (devrait retourner la même)
    response2 = client.post("/destinations", json=payload)
    assert response2.status_code == 200
    second_id = response2.json()["id"]
    
    # Les IDs doivent être identiques
    assert first_id == second_id


def test_create_destination_case_insensitive(client):
    """Test que la détection de doublons est insensible à la casse."""
    payload1 = {"name": "Paris"}
    payload2 = {"name": "PARIS"}
    payload3 = {"name": "paris"}
    
    response1 = client.post("/destinations", json=payload1)
    response2 = client.post("/destinations", json=payload2)
    response3 = client.post("/destinations", json=payload3)
    
    id1 = response1.json()["id"]
    id2 = response2.json()["id"]
    id3 = response3.json()["id"]
    
    # Tous doivent avoir le même ID
    assert id1 == id2 == id3


def test_list_destinations_with_data(client):
    """Test de liste de destinations avec des données."""
    # Créer plusieurs destinations
    destinations = ["Paris", "Londres", "Berlin", "Madrid"]
    for dest_name in destinations:
        client.post("/destinations", json={"name": dest_name})
    
    # Lister toutes les destinations
    response = client.get("/destinations")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 4
    
    # Vérifier que toutes les destinations sont présentes
    names = [d["name"] for d in data]
    for dest_name in destinations:
        assert dest_name in names


def test_list_destinations_with_query(client):
    """Test de filtrage des destinations par query."""
    # Créer des destinations
    destinations = ["Paris", "Londres", "Lyon", "Berlin"]
    for dest_name in destinations:
        client.post("/destinations", json={"name": dest_name})
    
    # Rechercher "Par"
    response = client.get("/destinations?query=Par")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert any("Par" in d["name"] for d in data)


def test_list_destinations_with_limit(client):
    """Test que la limite fonctionne correctement."""
    # Créer 10 destinations
    for i in range(10):
        client.post("/destinations", json={"name": f"Destination {i}"})
    
    # Demander seulement 5 destinations
    response = client.get("/destinations?limit=5")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 5


def test_list_destinations_sorted(client):
    """Test que les destinations sont triées par nom."""
    # Créer des destinations dans un ordre aléatoire
    destinations = ["Zürich", "Amsterdam", "Berlin", "Paris"]
    for dest_name in destinations:
        client.post("/destinations", json={"name": dest_name})
    
    # Lister les destinations
    response = client.get("/destinations")
    assert response.status_code == 200
    data = response.json()
    
    # Vérifier qu'elles sont triées par ordre alphabétique
    names = [d["name"] for d in data]
    assert names == sorted(names)


def test_create_destination_with_whitespace(client):
    """Test que les espaces en début/fin sont supprimés."""
    payload = {"name": "  New York  "}
    response = client.post("/destinations", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "New York"  # Les espaces doivent être supprimés


def test_list_destinations_query_case_insensitive(client):
    """Test que la recherche est insensible à la casse."""
    client.post("/destinations", json={"name": "Paris"})
    
    # Rechercher avec différentes casse
    for query in ["paris", "PARIS", "ParIs", "par"]:
        response = client.get(f"/destinations?query={query}")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        assert any("Paris" in d["name"] or "paris" in d["name"].lower() for d in data)

