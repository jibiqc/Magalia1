Write-Host "=== Démarrage du Backend (FastAPI) ===" -ForegroundColor Cyan

Set-Location $PSScriptRoot\..\backend

$pythonPath = ".\venv\Scripts\python.exe"

if (-not (Test-Path $pythonPath)) {
    Write-Host "Erreur: venv introuvable à $pythonPath" -ForegroundColor Red
    Write-Host "Assurez-vous que l'environnement virtuel est créé." -ForegroundColor Yellow
    exit 1
}

Write-Host "Démarrage du serveur sur http://localhost:8000" -ForegroundColor Green
Write-Host "Appuyez sur Ctrl+C pour arrêter" -ForegroundColor Gray
Write-Host ""

& $pythonPath -m uvicorn main:app --reload --host 0.0.0.0 --port 8000

