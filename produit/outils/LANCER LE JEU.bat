@echo off
rem La Guerre des Departements - lance le serveur local puis ouvre la page de demarrage
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0outils\serveur.ps1"
if errorlevel 1 pause
