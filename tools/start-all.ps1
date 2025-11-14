Write-Host "=== Démarrage Backend + Frontend ===" -ForegroundColor Cyan
Write-Host ""

$backendScript = Join-Path $PSScriptRoot "start-backend.ps1"
$frontendScript = Join-Path $PSScriptRoot "start-frontend.ps1"

# Démarrer le backend dans une nouvelle fenêtre PowerShell
Write-Host "Démarrage du backend dans une nouvelle fenêtre..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-File", $backendScript

# Attendre un peu pour que le backend démarre
Start-Sleep -Seconds 2

# Démarrer le frontend dans une nouvelle fenêtre PowerShell
Write-Host "Démarrage du frontend dans une nouvelle fenêtre..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-File", $frontendScript

Write-Host ""
Write-Host "Les deux services sont en cours de démarrage dans des fenêtres séparées." -ForegroundColor Green
Write-Host "Backend: http://localhost:8000" -ForegroundColor Gray
Write-Host "Frontend: http://localhost:5173" -ForegroundColor Gray

