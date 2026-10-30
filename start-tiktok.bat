@echo off
rem Empira Conquest - lancement connecte a un live TikTok (EXPERIMENTAL)
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js n est pas installe. Installez la version LTS depuis https://nodejs.org
  pause
  exit /b 1
)
if not exist node_modules\tiktok-live-connector (
  echo Installation de la bibliotheque communautaire tiktok-live-connector...
  call npm install --no-save tiktok-live-connector
)
set /p TTUSER=Nom du compte TikTok en live (sans @) : 
node server\server.js --open --tiktok %TTUSER%
pause
