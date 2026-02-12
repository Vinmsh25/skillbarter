@echo off
echo Stopping all development servers...
echo.

:: Kill Node processes (frontend)
taskkill /F /IM node.exe 2>nul
if %errorlevel% equ 0 (
    echo Stopped Node.js processes
) else (
    echo No Node.js processes found
)

:: Kill Python processes (backend)
taskkill /F /IM python.exe 2>nul
if %errorlevel% equ 0 (
    echo Stopped Python processes
) else (
    echo No Python processes found
)

echo.
echo All development servers stopped.
pause
