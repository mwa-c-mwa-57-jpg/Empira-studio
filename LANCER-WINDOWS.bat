@echo off
setlocal
title Print Booth Live
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 goto nonode

if exist "node_modules\.installed-v1" goto start
echo.
echo  Premiere installation : telechargement des composants, 1 a 2 minutes...
echo.
call npm install --omit=dev --no-audit --no-fund
if errorlevel 1 goto installfail
type nul > "node_modules\.installed-v1"

:start
node server\index.js --open
echo.
echo  Print Booth est arrete. Tu peux fermer cette fenetre.
pause
exit /b 0

:nonode
echo.
echo  Node.js n'est pas installe sur ce PC.
echo   1. Installe la version LTS depuis https://nodejs.org/fr/download
echo   2. Redemarre le PC
echo   3. Double-clique a nouveau sur LANCER-WINDOWS.bat
echo.
start "" "https://nodejs.org/fr/download"
pause
exit /b 1

:installfail
echo.
echo  L'installation a echoue. Verifie ta connexion internet puis relance ce fichier.
pause
exit /b 1
