Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "  RAILOPT-X 2.0 — Section Dispatch Intelligence Studio" -ForegroundColor Green
Write-Host "  Launching Backend (Port 8000) & Frontend (Port 5173)..." -ForegroundColor Yellow
Write-Host "======================================================================" -ForegroundColor Cyan

Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host '--- RAILOPT-X Backend API ---' -ForegroundColor Green; .venv\Scripts\python.exe -m uvicorn backend.api.app:app --host 127.0.0.1 --port 8000 --reload"
Start-Sleep -Seconds 2
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host '--- RAILOPT-X Frontend Studio ---' -ForegroundColor Cyan; npm run dev"

Write-Host "`nServices started in dedicated terminals!" -ForegroundColor Green
Write-Host "Frontend Studio : http://localhost:5173" -ForegroundColor Yellow
Write-Host "Backend API docs: http://127.0.0.1:8000/docs" -ForegroundColor Yellow
