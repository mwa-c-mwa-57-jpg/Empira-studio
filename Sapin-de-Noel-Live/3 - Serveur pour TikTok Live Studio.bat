@echo off
title Serveur Sapin de Noel (port 8765)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0outils\serveur.ps1" -Port 8765 -Racine "%~dp0."
