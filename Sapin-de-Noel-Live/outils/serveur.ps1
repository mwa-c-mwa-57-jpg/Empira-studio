# Petit serveur local pour TikTok LIVE Studio (ne pas fermer la fenêtre pendant le live)
param([int]$Port = 8765, [string]$Racine = (Split-Path -Parent $PSScriptRoot))
$Racine = (Resolve-Path $Racine).Path
$types = @{ '.html'='text/html; charset=utf-8'; '.js'='application/javascript'; '.css'='text/css';
            '.png'='image/png'; '.jpg'='image/jpeg'; '.svg'='image/svg+xml'; '.mp3'='audio/mpeg'; '.json'='application/json' }
$l = New-Object System.Net.HttpListener
$l.Prefixes.Add("http://localhost:$Port/")
try { $l.Start() } catch { Write-Host "Le port $Port est deja utilise : le serveur tourne peut-etre deja." -ForegroundColor Yellow; Read-Host "Entree pour fermer"; exit }
Write-Host ""
Write-Host "  Serveur du Sapin de Noel lance !" -ForegroundColor Green
Write-Host "  Adresse a coller dans TikTok LIVE Studio :" -ForegroundColor Green
Write-Host "  http://localhost:$Port/sapin-de-noel.html" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Laisse cette fenetre ouverte pendant tout le live."
while ($l.IsListening) {
  $ctx = $l.GetContext(); $res = $ctx.Response
  try {
    $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
    if ($rel -eq '') { $rel = 'sapin-de-noel.html' }
    $f = [IO.Path]::GetFullPath((Join-Path $Racine $rel))
    if ($f.StartsWith($Racine) -and (Test-Path $f -PathType Leaf)) {
      $b = [IO.File]::ReadAllBytes($f)
      $ext = [IO.Path]::GetExtension($f).ToLower()
      $res.ContentType = if ($types[$ext]) { $types[$ext] } else { 'application/octet-stream' }
      $res.Headers.Add('Cache-Control', 'no-store')
      $res.OutputStream.Write($b, 0, $b.Length)
    } else { $res.StatusCode = 404 }
  } catch { $res.StatusCode = 500 }
  $res.Close()
}
