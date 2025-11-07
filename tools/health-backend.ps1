Write-Host "=== G3: Backend Health ===" -ForegroundColor Cyan

# Alembic head?

try {

  Set-Location ..\backend

  $head = alembic heads

  Write-Host "Alembic head: $head" -ForegroundColor Green

} catch {

  Write-Host "Alembic not runnable here. Activate venv & run from backend." -ForegroundColor Yellow

}

Write-Host "Tables of interest (should exist later): quotes, quote_days, quote_lines." -ForegroundColor Gray

