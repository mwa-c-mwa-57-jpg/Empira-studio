@echo off
chcp 65001 >nul
title La Grimpe - DEMO
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js n'est pas installe : https://nodejs.org/fr & pause & exit /b)
if not exist node_modules (echo Installation des dependances, patiente... & call npm install --no-audit --no-fund)
start "" /b cmd /c "timeout /t 3 >nul & start http://localhost:3000/regie.html & start http://localhost:3000/overlay.html"
node server.js --demo
pause
