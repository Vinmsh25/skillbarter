@echo off
title Link & Learn - Development Servers
echo ========================================
echo   Link ^& Learn Development Environment
echo ========================================
echo.

:: Start Backend Server
echo Starting Backend Server (Daphne)...
start "Backend - Daphne" cmd /k "cd /d %~dp0backend && call venv\Scripts\activate && daphne -b 127.0.0.1 -p 8000 linklearn.asgi:application"

:: Wait a moment for backend to initialize
timeout /t 3 /nobreak > nul

:: Start Frontend Server
echo Starting Frontend Server (Vite)...
start "Frontend - Vite" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ========================================
echo   Both servers are starting...
echo   Backend: http://127.0.0.1:8000
echo   Frontend: http://localhost:3000
echo ========================================
echo.
echo Press any key to exit this window...
pause > nul
