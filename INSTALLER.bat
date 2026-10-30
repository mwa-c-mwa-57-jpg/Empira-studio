@echo off
rem ============================================================
rem  EMPIRA CONQUEST - installation sur ce PC (Windows 10 / 11)
rem  Double-cliquez sur ce fichier apres avoir extrait le ZIP
rem  dans votre dossier des lives.
rem ============================================================
setlocal
cd /d "%~dp0"
set "EMPIRA_DIR=%CD%"
title Installation Empira Conquest
echo.
echo   EMPIRA CONQUEST - installation
echo   Dossier : %CD%
echo.

rem --- 1. Node.js ------------------------------------------------
where node >nul 2>nul
if errorlevel 1 if exist "%ProgramFiles%\nodejs\node.exe" set "PATH=%ProgramFiles%\nodejs;%PATH%"
where node >nul 2>nul
if errorlevel 1 (
  echo [1/4] Node.js n'est pas installe. Installation de la version LTS...
  where winget >nul 2>nul
  if errorlevel 1 (
    echo       winget est indisponible sur ce PC : installez Node.js LTS a la main
    echo       depuis https://nodejs.org puis relancez INSTALLER.bat.
    start "" https://nodejs.org
    pause
    exit /b 1
  )
  winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
  if exist "%ProgramFiles%\nodejs\node.exe" set "PATH=%ProgramFiles%\nodejs;%PATH%"
)
where node >nul 2>nul
if errorlevel 1 (
  echo       Node.js est installe mais pas encore reconnu : fermez cette fenetre
  echo       et relancez INSTALLER.bat.
  pause
  exit /b 1
)
for /f "delims=" %%v in ('node -v') do echo [1/4] Node.js %%v : OK

rem --- 2. Connexion TikTok (optionnelle) ------------------------------
echo.
echo [2/4] Connexion a un vrai live TikTok (bibliotheque communautaire, non officielle).
choice /c ON /m "      Installer maintenant ? (O = oui, N = plus tard)"
if errorlevel 2 (
  echo       Ignore : start-tiktok.bat l'installera au premier lancement.
) else (
  call npm install --no-save --no-audit --no-fund tiktok-live-connector
)

rem --- 3. Voix francaise de Windows ------------------------------------
echo.
echo [3/4] Verification de la voix francaise de Windows...
powershell -NoProfile -Command "Add-Type -AssemblyName System.Speech; $v = (New-Object System.Speech.Synthesis.SpeechSynthesizer).GetInstalledVoices() | Where-Object { $_.VoiceInfo.Culture.Name -like 'fr*' } | Select-Object -First 1; if ($v) { '      Voix trouvee : ' + $v.VoiceInfo.Name } else { '      Aucune voix francaise : Parametres > Heure et langue > Voix > ajouter une voix francaise.' }"

rem --- 4. Raccourcis sur le Bureau -----------------------------------
echo.
echo [4/4] Creation des raccourcis sur le Bureau...
powershell -NoProfile -Command "$d = [Environment]::GetFolderPath('Desktop'); $s = New-Object -ComObject WScript.Shell; foreach ($x in @(@('Empira - Jeu (test)', 'start.bat'), @('Empira - Live TikTok', 'start-tiktok.bat'))) { $l = $s.CreateShortcut((Join-Path $d ($x[0] + '.lnk'))); $l.TargetPath = (Join-Path $env:EMPIRA_DIR $x[1]); $l.WorkingDirectory = $env:EMPIRA_DIR; $l.Save() }; '      OK : ' + $d"

echo.
echo   ============================================================
echo    Installation terminee.
echo    - Tester sans TikTok : raccourci "Empira - Jeu (test)"
echo    - Pendant un live    : raccourci "Empira - Live TikTok"
echo    - Dans OBS : Source Navigateur, URL http://localhost:3000/?obs
echo      largeur 1080, hauteur 1920, et garder "Audio du bureau" actif.
echo   ============================================================
echo.
choice /c ON /m "Lancer le jeu maintenant pour tester ?"
if errorlevel 2 exit /b 0
start "" "%CD%\start.bat"
