@echo off
:: SmartHabbit — one-shot launcher (Windows)
:: Opens two console windows (backend + frontend), then your browser.

setlocal
cd /d "%~dp0"

echo.
echo  ============================================
echo   SmartHabbit  -  one-shot launcher
echo  ============================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo  [error] Node.js is required. Install from https://nodejs.org
  pause
  exit /b 1
)

if not exist "backend\node_modules" (
  echo  Installing backend dependencies (one-time^)...
  pushd backend
  call npm install --silent
  popd
)

echo  Starting backend (port 3000^)...
start "SmartHabbit Backend" cmd /k "cd /d %~dp0backend && npm run dev"

echo  Waiting for backend to come up...
:waitloop
timeout /t 1 /nobreak >nul
curl -sf http://localhost:3000/health >nul 2>&1
if errorlevel 1 goto waitloop
echo  Backend ready.

echo  Starting frontend (port 5500^)...
start "SmartHabbit Frontend" cmd /k "cd /d %~dp0frontend && npx --yes http-server -p 5500 -s -c-1"

echo  Opening browser...
timeout /t 2 /nobreak >nul
start "" "http://localhost:5500/index.html"

echo.
echo  ============================================
echo   SmartHabbit is running.
echo   Backend : http://localhost:3000
echo   Frontend: http://localhost:5500
echo   Close the two terminal windows to stop.
echo  ============================================
echo.
pause >nul
