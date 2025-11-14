Write-Host "=== Démarrage du Frontend (Vite/React) ===" -ForegroundColor Cyan

Set-Location $PSScriptRoot\..\frontend

if (-not (Test-Path "node_modules")) {
    Write-Host "Installation des dépendances npm..." -ForegroundColor Yellow
    npm install
}

Write-Host "Démarrage du serveur de développement sur http://localhost:5173" -ForegroundColor Green
Write-Host "Appuyez sur Ctrl+C pour arrêter" -ForegroundColor Gray
Write-Host ""

npm run dev

