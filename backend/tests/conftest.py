"""
Fixtures partagées pour tous les tests.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Base de données de test en mémoire SQLite
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

# Créer un moteur SQLite en mémoire pour les tests
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Importer Base après avoir créé le moteur de test
from ..src.models.db import Base


@pytest.fixture(scope="function")
def db():
    """
    Crée une nouvelle base de données pour chaque test.
    La base est créée au début et supprimée à la fin pour garantir l'isolation.
    """
    # Créer toutes les tables
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.rollback()  # Annuler toute transaction en cours
        db.close()
        # Nettoyer toutes les tables après le test
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db, monkeypatch):
    """
    Crée un client de test FastAPI avec une base de données isolée.
    Remplace SessionLocal et get_db pour utiliser notre base de test.
    """
    # Remplacer SessionLocal dans src.models.db avant l'import de app
    from ..src import models
    monkeypatch.setattr(models.db, "SessionLocal", TestingSessionLocal)
    
    # Remplacer aussi dans src.db si nécessaire
    from ..src import db as db_module
    monkeypatch.setattr(db_module, "SessionLocal", TestingSessionLocal)
    
    # Maintenant importer app (qui utilisera notre SessionLocal de test)
    from ..main import app
    from ..src.db import get_db as original_get_db
    
    def override_get_db():
        """
        Override de get_db qui utilise notre session de test.
        """
        try:
            yield db
        finally:
            # Ne pas fermer la session ici, elle sera fermée dans la fixture db
            pass
    
    # Remplacer la dépendance get_db par notre version de test
    app.dependency_overrides[original_get_db] = override_get_db
    
    with TestClient(app) as test_client:
        yield test_client
    
    # Nettoyer les overrides après le test
    app.dependency_overrides.clear()

