@echo off
echo ======================================================================
echo   RAILOPT-X 2.0 - Railway Operations Intelligence Studio
echo   Launching Backend API (Port 8000) & Frontend Studio (Port 5173)...
echo ======================================================================

start "RAILOPT-X Backend API" cmd /k ".venv\Scripts\python.exe -m uvicorn backend.api.app:app --host 127.0.0.1 --port 8000 --reload"
timeout /t 2 >nul
start "RAILOPT-X Frontend Studio" cmd /k "npm run dev"

echo.
echo Application launched!
echo Access the UI at: http://localhost:5173
echo Access the API at: http://127.0.0.1:8000/docs
echo.
pause
