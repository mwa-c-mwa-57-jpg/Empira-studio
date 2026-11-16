@echo off
rem La Guerre des Departements - demarre le serveur du jeu puis ouvre la fenetre de pilotage
cd /d "%~dp0"
title La Guerre des Departements - serveur (laisser ouvert pendant le live)
set "NODE=%~dp0outils\node.exe"
if not exist "%NODE%" set "NODE=node"
"%NODE%" "%~dp0outils\serveur.cjs"
if errorlevel 1 pause
