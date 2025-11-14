"""
Tests pour l'endpoint de santé (health check).
"""
from fastapi.testclient import TestClient


def test_health_returns_200(client):
    """Test que GET /health retourne HTTP 200."""
    response = client.get("/health")
    assert response.status_code == 200


def test_health_response_structure(client):
    """Test que la réponse de /health a la structure attendue."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert "ok" in data
    assert data["ok"] is True
    assert "origins" in data
    assert isinstance(data["origins"], list)


def test_health_origins_content(client):
    """Test que les origines CORS sont présentes dans la réponse."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    origins = data["origins"]
    assert len(origins) > 0
    # Vérifier que les origines attendues sont présentes
    assert any("localhost:5173" in origin for origin in origins)

