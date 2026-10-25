# Installe (ou met a jour) La Grimpe sur Windows, puis lance la demo.
# A lancer avec Windows + R :
#   powershell -ExecutionPolicy Bypass -c "irm https://raw.githubusercontent.com/mwa-c-mwa-57-jpg/Empira-studio/refs/heads/claude/la-grimpe-live/la-grimpe/installer-windows.ps1|iex"
# Une mise a jour garde config.json (ton pseudo, tes reglages) et la partie sauvegardee (donnees/).

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ProgressPreference = 'SilentlyContinue'

$branche = 'claude/la-grimpe-live'
$zipUrl = "https://github.com/mwa-c-mwa-57-jpg/Empira-studio/archive/refs/heads/$branche.zip"
$dest = Join-Path $HOME 'La-Grimpe'

function Etape($t) { Write-Host ''; Write-Host "==> $t" -ForegroundColor Cyan }
function RafraichirPath {
  $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
}

try {
  Write-Host '=== Installation de La Grimpe ===' -ForegroundColor Yellow

  # 1. Node.js
  Etape 'Verification de Node.js'
  RafraichirPath
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    $ok = $false
    if (Get-Command winget -ErrorAction SilentlyContinue) {
      Write-Host 'Installation de Node.js LTS avec winget (accepte la fenetre de Windows si elle apparait)...'
      winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements --silent
      RafraichirPath
      $ok = [bool](Get-Command node -ErrorAction SilentlyContinue)
    }
    if (-not $ok) {
      Write-Host 'Telechargement de Node.js LTS depuis nodejs.org...'
      $lts = (Invoke-RestMethod 'https://nodejs.org/dist/index.json' | Where-Object { $_.lts } | Select-Object -First 1).version
      $msi = Join-Path $env:TEMP "node-$lts-x64.msi"
      Invoke-WebRequest "https://nodejs.org/dist/$lts/node-$lts-x64.msi" -OutFile $msi
      Start-Process msiexec.exe -ArgumentList '/i', "`"$msi`"", '/passive', '/norestart' -Wait
      RafraichirPath
    }
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
      throw "Node.js n'a pas pu etre installe. Installe-le a la main depuis https://nodejs.org/fr puis relance cette commande."
    }
  }
  Write-Host ("Node.js " + (node --version) + " OK") -ForegroundColor Green

  # 2. Telechargement
  Etape 'Telechargement de La Grimpe'
  $tmp = Join-Path $env:TEMP ('la-grimpe-' + [guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path $tmp | Out-Null
  $zip = Join-Path $tmp 'la-grimpe.zip'
  Invoke-WebRequest $zipUrl -OutFile $zip
  Expand-Archive -Path $zip -DestinationPath $tmp -Force
  $source = Get-ChildItem $tmp -Directory | ForEach-Object { Join-Path $_.FullName 'la-grimpe' } | Where-Object { Test-Path $_ } | Select-Object -First 1
  if (-not $source) { throw 'Dossier la-grimpe introuvable dans le telechargement.' }

  # 3. Copie (en gardant la config et la sauvegarde si c'est une mise a jour)
  Etape "Installation dans $dest"
  $configGardee = $null
  if (Test-Path (Join-Path $dest 'config.json')) {
    $configGardee = Join-Path $tmp 'config-gardee.json'
    Copy-Item (Join-Path $dest 'config.json') $configGardee
    Write-Host 'Mise a jour : ta config.json est conservee.'
  }
  New-Item -ItemType Directory -Path $dest -Force | Out-Null
  Copy-Item (Join-Path $source '*') $dest -Recurse -Force
  if ($configGardee) {
    Copy-Item $dest\config.json (Join-Path $dest 'config.nouvelle-version.json') -Force
    Copy-Item $configGardee (Join-Path $dest 'config.json') -Force
  }
  Get-ChildItem $dest -Recurse -File | Unblock-File
  Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue

  # 4. Dependances
  Etape 'Installation des dependances (1 minute environ)'
  Push-Location $dest
  & npm install --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { Pop-Location; throw 'npm install a echoue.' }
  Pop-Location

  # 5. Raccourcis sur le Bureau
  Etape 'Raccourcis sur le Bureau'
  $bureau = [Environment]::GetFolderPath('Desktop')
  $shell = New-Object -ComObject WScript.Shell
  $raccourcis = @(
    @{ Nom = 'La Grimpe - DEMO'; Cible = 'demo-windows.bat' },
    @{ Nom = 'La Grimpe - LIVE'; Cible = 'lancer-windows.bat' },
    @{ Nom = 'La Grimpe - Fenetre overlay'; Cible = 'fenetre-overlay-windows.bat' },
    @{ Nom = 'La Grimpe - Dossier'; Cible = '' }
  )
  foreach ($r in $raccourcis) {
    $lnk = $shell.CreateShortcut((Join-Path $bureau ($r.Nom + '.lnk')))
    $lnk.TargetPath = if ($r.Cible) { Join-Path $dest $r.Cible } else { $dest }
    $lnk.WorkingDirectory = $dest
    $lnk.Save()
    Write-Host ('  ' + $r.Nom)
  }

  Write-Host ''
  Write-Host '=== La Grimpe est installee ! ===' -ForegroundColor Green
  Write-Host "Dossier : $dest"
  Write-Host 'Lancement de la demo...'
  Start-Process (Join-Path $dest 'demo-windows.bat') -WorkingDirectory $dest
}
catch {
  Write-Host ''
  Write-Host ('ERREUR : ' + $_.Exception.Message) -ForegroundColor Red
  Write-Host "Fais une capture de cette fenetre et envoie-la a Claude."
}
Write-Host ''
Read-Host 'Appuie sur Entree pour fermer cette fenetre'
