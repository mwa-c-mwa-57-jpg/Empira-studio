# La Guerre des Départements — serveur local Windows (PowerShell 5.1, sans installation).
# Sert les fichiers du jeu sur http://localhost:8911 et ajoute :
#   /parler?t=texte&voix=nom   lit le texte avec une voix Windows (System.Speech)
#   /voix                      liste des voix installées (nom, genre, langue)
#   /musiques                  liste des MP3 du dossier « musique »
#   /licence                   état de la licence ; POST /licence/activer {cle}, POST /licence/desactiver
#   /etat                      le serveur répond (utilisé par la page de démarrage)
param([int]$Port = 8911)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$Host.UI.RawUI.WindowTitle = 'La Guerre des Départements — serveur (laisser ouvert pendant le live)'
$Version = '1.0.0'
$Racine = Split-Path -Parent $PSScriptRoot
$DossierMusique = Join-Path $Racine 'musique'

# --- Licence Lemon Squeezy : à renseigner par Empira avant la vente -------------------------
$LemonProduitId = ''        # identifiant du produit Lemon Squeezy ; vide = ne pas vérifier le produit
$ToleranceJours = 5         # jours de fonctionnement sans connexion Internet
$VerifierLicence = $true    # $false uniquement pour une copie de démonstration interne
$DossierDonnees = Join-Path $env:APPDATA 'EmpiraGuerreDesDepartements'
$FichierLicence = Join-Path $DossierDonnees 'licence.json'
# ---------------------------------------------------------------------------------------------

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
# fichiers téléchargés depuis Internet : on retire le blocage Windows pour éviter les avertissements à chaque lancement
Get-ChildItem -LiteralPath $Racine -Recurse -File -ErrorAction SilentlyContinue | Unblock-File -ErrorAction SilentlyContinue

Add-Type -AssemblyName System.Speech
$Synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$Synth.Rate = 1
$Paroles = New-Object System.Collections.ArrayList
$CacheLicence = $null

$Types = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.css' = 'text/css; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'; '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.jpeg' = 'image/jpeg'
  '.svg' = 'image/svg+xml'; '.mp3' = 'audio/mpeg'; '.txt' = 'text/plain; charset=utf-8'; '.ico' = 'image/x-icon'
}

function Envoyer($Ctx, [int]$Code, [byte[]]$Octets, [string]$Type) {
  $r = $Ctx.Response
  $r.StatusCode = $Code
  $r.ContentType = $Type
  $r.Headers['Cache-Control'] = 'no-store'
  $r.Headers['X-Content-Type-Options'] = 'nosniff'
  $r.ContentLength64 = $Octets.Length
  try { $r.OutputStream.Write($Octets, 0, $Octets.Length) } catch {}
  try { $r.OutputStream.Close() } catch {}
}

function EnvoyerJson($Ctx, $Objet, [int]$Code = 200) {
  $json = ConvertTo-Json -InputObject $Objet -Depth 5 -Compress
  Envoyer $Ctx $Code ([Text.Encoding]::UTF8.GetBytes($json)) 'application/json; charset=utf-8'
}

function LireParametres($Url) {
  $q = @{}
  foreach ($p in $Url.Query.TrimStart('?').Split('&')) {
    if (-not $p) { continue }
    $kv = $p.Split('=', 2)
    $k = [Uri]::UnescapeDataString($kv[0].Replace('+', ' '))
    $v = ''
    if ($kv.Length -gt 1) { $v = [Uri]::UnescapeDataString($kv[1].Replace('+', ' ')) }
    $q[$k] = $v
  }
  return $q
}

function LireCorps($Req) {
  $lecteur = New-Object IO.StreamReader($Req.InputStream, [Text.Encoding]::UTF8)
  $texte = $lecteur.ReadToEnd()
  if ($texte.Length -gt 10000) { return $null }
  try { return $texte | ConvertFrom-Json } catch { return $null }
}

# ------------------------------------------------------------------ voix

function Parler($Ctx, $Q) {
  $texte = [string]$Q['t']
  $texte = ($texte -replace '[\x00-\x1F]', ' ').Trim()
  if (-not $texte) { EnvoyerJson $Ctx @{ ok = $false } 400; return }
  if ($texte.Length -gt 220) { $texte = $texte.Substring(0, 220) }
  for ($i = $Paroles.Count - 1; $i -ge 0; $i--) { if ($Paroles[$i].IsCompleted) { $Paroles.RemoveAt($i) } }
  # au plus 3 phrases en attente : au-delà, la phrase est ignorée plutôt que de prendre du retard
  if ($Paroles.Count -ge 3) { EnvoyerJson $Ctx @{ ok = $true; ignore = $true }; return }
  $pb = New-Object System.Speech.Synthesis.PromptBuilder
  $nom = [string]$Q['voix']
  $voixOk = $false
  if ($nom) {
    foreach ($v in $Synth.GetInstalledVoices()) { if ($v.Enabled -and $v.VoiceInfo.Name -eq $nom) { $voixOk = $true } }
  }
  if ($voixOk) { $pb.StartVoice($nom) }
  $pb.AppendText($texte)
  if ($voixOk) { $pb.EndVoice() }
  [void]$Paroles.Add($Synth.SpeakAsync($pb))
  EnvoyerJson $Ctx @{ ok = $true }
}

function ListeVoix() {
  $liste = @()
  foreach ($v in $Synth.GetInstalledVoices()) {
    if ($v.Enabled) { $liste += [pscustomobject]@{ nom = $v.VoiceInfo.Name; genre = [string]$v.VoiceInfo.Gender; langue = $v.VoiceInfo.Culture.Name } }
  }
  return , $liste
}

function ListeMusiques() {
  $liste = @()
  if (Test-Path -LiteralPath $DossierMusique) {
    foreach ($f in Get-ChildItem -LiteralPath $DossierMusique -Filter '*.mp3' -File) { $liste += 'musique/' + [Uri]::EscapeDataString($f.Name) }
  }
  return , $liste
}

# ------------------------------------------------------------------ licence (Lemon Squeezy, 2 PC par clé)

function AppelLemon([string]$Action, [hashtable]$Corps) {
  try {
    $r = Invoke-RestMethod -Method Post -Uri "https://api.lemonsqueezy.com/v1/licenses/$Action" -Body $Corps -Headers @{ Accept = 'application/json' } -TimeoutSec 8
    return @{ reseau = $true; reponse = $r }
  } catch {
    # erreur HTTP : Lemon Squeezy a répondu (clé invalide, limite atteinte…) ; sinon pas de réseau
    if ($_.Exception.Response) {
      $msg = $null
      try { $msg = $_.ErrorDetails.Message | ConvertFrom-Json } catch {}
      return @{ reseau = $true; reponse = $msg }
    }
    return @{ reseau = $false; reponse = $null }
  }
}

function LireLicence() {
  if (-not (Test-Path -LiteralPath $FichierLicence)) { return $null }
  try { return Get-Content -LiteralPath $FichierLicence -Raw -Encoding UTF8 | ConvertFrom-Json } catch { return $null }
}

function EcrireLicence($L) {
  New-Item -ItemType Directory -Force -Path $DossierDonnees | Out-Null
  ConvertTo-Json -InputObject $L -Compress | Set-Content -LiteralPath $FichierLicence -Encoding UTF8
}

function ProduitOk($Meta) {
  if (-not $LemonProduitId) { return $true }
  return ($Meta -and [string]$Meta.product_id -eq $LemonProduitId)
}

function EtatLicence() {
  if (-not $VerifierLicence) { return @{ ok = $true } }
  if ($script:CacheLicence -and $script:CacheLicence.expire -gt (Get-Date)) { return $script:CacheLicence.etat }
  $L = LireLicence
  if (-not $L) { return @{ ok = $false; raison = 'Aucune clé de licence sur ce PC : entrez votre clé sur la page de démarrage.' } }
  $res = AppelLemon 'validate' @{ license_key = $L.cle; instance_id = $L.instance }
  $etat = $null
  if ($res.reseau -and $res.reponse) {
    $r = $res.reponse
    if ($r.valid -and $r.license_key.status -eq 'active' -and (ProduitOk $r.meta)) {
      $L.verifie = (Get-Date).ToString('o')
      EcrireLicence $L
      $etat = @{ ok = $true }
    } else {
      $etat = @{ ok = $false; raison = 'Licence invalide, expirée ou désactivée. Contactez Empira.' }
    }
  } else {
    # pas de connexion : tolérance de quelques jours depuis la dernière vérification réussie
    $derniere = [datetime]::MinValue
    try { $derniere = [datetime]::Parse($L.verifie) } catch {}
    if (((Get-Date) - $derniere).TotalDays -le $ToleranceJours) { $etat = @{ ok = $true; horsLigne = $true } }
    else { $etat = @{ ok = $false; raison = "Connexion Internet nécessaire pour vérifier la licence (plus de $ToleranceJours jours sans vérification)." } }
  }
  $script:CacheLicence = @{ etat = $etat; expire = (Get-Date).AddMinutes(10) }
  return $etat
}

function ActiverLicence($Corps) {
  $cle = ([string]$Corps.cle).Trim()
  if ($cle.Length -lt 8 -or $cle.Length -gt 100) { return @{ ok = $false; raison = 'Clé de licence invalide.' } }
  $res = AppelLemon 'activate' @{ license_key = $cle; instance_name = $env:COMPUTERNAME }
  if (-not $res.reseau) { return @{ ok = $false; raison = 'Pas de connexion Internet : l’activation doit se faire en ligne.' } }
  $r = $res.reponse
  if ($r -and $r.activated -and (ProduitOk $r.meta)) {
    EcrireLicence @{ cle = $cle; instance = $r.instance.id; pc = $env:COMPUTERNAME; verifie = (Get-Date).ToString('o') }
    $script:CacheLicence = $null
    return @{ ok = $true }
  }
  $erreur = ''
  if ($r -and $r.error) { $erreur = [string]$r.error }
  if ($erreur -match 'limit') { return @{ ok = $false; raison = 'Cette clé est déjà activée sur 2 PC. Désactivez-la sur un autre PC ou contactez Empira.' } }
  return @{ ok = $false; raison = 'Clé refusée. Vérifiez la clé reçue par e-mail.' }
}

function DesactiverLicence() {
  $L = LireLicence
  if (-not $L) { return @{ ok = $true } }
  $res = AppelLemon 'deactivate' @{ license_key = $L.cle; instance_id = $L.instance }
  if (-not $res.reseau) { return @{ ok = $false; raison = 'Pas de connexion Internet.' } }
  Remove-Item -LiteralPath $FichierLicence -Force -ErrorAction SilentlyContinue
  $script:CacheLicence = $null
  return @{ ok = $true }
}

# ------------------------------------------------------------------ fichiers

function Fichier($Ctx, [string]$Chemin) {
  if ($Chemin -eq '/') { $Chemin = '/demarrer.html' }
  $relatif = $Chemin.TrimStart('/').Replace('/', '\')
  if ($relatif -match '(^|\\)outils(\\|$)') { Envoyer $Ctx 404 ([byte[]]@()) 'text/plain'; return }
  $complet = [IO.Path]::GetFullPath((Join-Path $Racine $relatif))
  # protection contre la traversée de dossier (..)
  if (-not $complet.StartsWith($Racine + '\', [StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $complet -PathType Leaf)) {
    Envoyer $Ctx 404 ([Text.Encoding]::UTF8.GetBytes('Introuvable')) 'text/plain; charset=utf-8'
    return
  }
  $ext = [IO.Path]::GetExtension($complet).ToLowerInvariant()
  $type = $Types[$ext]
  if (-not $type) { $type = 'application/octet-stream' }
  Envoyer $Ctx 200 ([IO.File]::ReadAllBytes($complet)) $type
}

function Traiter($Ctx) {
  $req = $Ctx.Request
  # une page web d'un autre site ne doit pas pouvoir piloter ce serveur
  if ($req.Headers['Sec-Fetch-Site'] -eq 'cross-site') { Envoyer $Ctx 403 ([byte[]]@()) 'text/plain'; return }
  $chemin = [Uri]::UnescapeDataString($req.Url.AbsolutePath)
  $q = LireParametres $req.Url
  switch ($chemin) {
    '/parler' { Parler $Ctx $q; return }
    '/voix' { EnvoyerJson $Ctx (ListeVoix); return }
    '/musiques' { EnvoyerJson $Ctx (ListeMusiques); return }
    '/etat' { EnvoyerJson $Ctx @{ ok = $true; version = $Version }; return }
    '/licence' { EnvoyerJson $Ctx (EtatLicence); return }
    '/licence/activer' {
      if ($req.HttpMethod -ne 'POST') { EnvoyerJson $Ctx @{ ok = $false } 405; return }
      EnvoyerJson $Ctx (ActiverLicence (LireCorps $req)); return
    }
    '/licence/desactiver' {
      if ($req.HttpMethod -ne 'POST') { EnvoyerJson $Ctx @{ ok = $false } 405; return }
      EnvoyerJson $Ctx (DesactiverLicence); return
    }
  }
  if ($req.HttpMethod -ne 'GET' -and $req.HttpMethod -ne 'HEAD') { EnvoyerJson $Ctx @{ ok = $false } 405; return }
  Fichier $Ctx $chemin
}

# ------------------------------------------------------------------ démarrage

$adresse = "http://localhost:$Port/"
$ecoute = New-Object System.Net.HttpListener
$ecoute.Prefixes.Add($adresse)
try {
  $ecoute.Start()
} catch {
  # déjà lancé ? on ouvre simplement la page de démarrage
  try {
    Invoke-RestMethod -Uri ($adresse + 'etat') -TimeoutSec 3 | Out-Null
    Start-Process ($adresse + 'demarrer.html')
    exit 0
  } catch {
    Write-Host "Le port $Port est occupé par un autre programme. Fermez-le puis relancez le jeu." -ForegroundColor Red
    Read-Host 'Appuyez sur Entrée pour fermer'
    exit 1
  }
}

Write-Host ''
Write-Host '  LA GUERRE DES DÉPARTEMENTS — serveur démarré' -ForegroundColor Yellow
Write-Host "  Page de démarrage : ${adresse}demarrer.html"
Write-Host '  Laissez cette fenêtre ouverte pendant le live. Fermez-la pour arrêter le jeu.'
Write-Host ''
Start-Process ($adresse + 'demarrer.html')

while ($ecoute.IsListening) {
  $ctx = $null
  try {
    $ctx = $ecoute.GetContext()
    Traiter $ctx
  } catch {
    if ($ctx) { try { EnvoyerJson $ctx @{ ok = $false; erreur = 'erreur interne' } 500 } catch {} }
  }
}
