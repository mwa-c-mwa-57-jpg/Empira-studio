@echo off
chcp 65001 >nul
title La Grimpe - LIVE
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js n'est pas installe : https://nodejs.org/fr & pause & exit /b)
if not exist node_modules (echo Installation des dependances, patiente... & call npm install --no-audit --no-fund)
node server.js
pause
