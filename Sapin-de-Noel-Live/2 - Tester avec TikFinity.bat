@echo off
rem Ouvre d abord TikFinity (application) avant de lancer ce fichier.
set "P=%~dp0"
set "P=%P:\=/%"
start "" msedge "file:///%P%sapin-de-noel.html?admin"
