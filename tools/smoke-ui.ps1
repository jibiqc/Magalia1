Write-Host "=== G1: UI Skeleton Smoke ===" -ForegroundColor Cyan

# Frontend dev server reachable?

try {

  $url = "http://localhost:5173"

  $res = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3

  if ($res.StatusCode -ge 200 -and $res.StatusCode -lt 400) {

    Write-Host "Dev server reachable at $url" -ForegroundColor Green

  } else {

    Write-Host "Dev server not OK (HTTP $($res.StatusCode))" -ForegroundColor Yellow

  }

} catch {

  Write-Host "Dev server unreachable. Run: npm run dev (frontend)" -ForegroundColor Yellow

}

Write-Host "Open your browser and visually confirm the 4 zones." -ForegroundColor Gray

