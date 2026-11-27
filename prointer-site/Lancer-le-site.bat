@echo off
chcp 65001 >nul
title Site PRO-INTER
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js n'est pas installé sur ce PC.
  echo   Installez la version LTS depuis https://nodejs.org puis relancez ce fichier.
  echo.
  start "" https://nodejs.org/fr
  pause
  exit /b 1
)
if not defined ADMIN_PASSWORD set "ADMIN_PASSWORD=demo"
echo.
echo   Le site démarre. Gardez cette fenêtre ouverte : la fermer arrête le site.
echo   Espace agence : identifiant « agence », mot de passe « %ADMIN_PASSWORD% »
echo.
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:8080"
node server.mjs
pause
