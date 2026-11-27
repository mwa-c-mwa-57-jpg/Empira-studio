@echo off
set "P=%~dp0"
set "P=%P:\=/%"
start "" msedge "file:///%P%sapin-de-noel.html?demo&admin"
