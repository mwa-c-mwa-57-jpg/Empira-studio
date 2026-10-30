@echo off
rem Empira Conquest - lancement du jeu (mode test, sans TikTok)
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js n est pas installe. Installez la version LTS depuis https://nodejs.org puis relancez ce fichier.
  start "" https://nodejs.org
  pause
  exit /b 1
)
node server\server.js --open
pause
