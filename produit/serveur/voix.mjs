// Voix Windows (System.Speech) pilotée depuis Node par un seul processus PowerShell gardé ouvert.
// Les phrases passent en base64 (UTF-8) pour que les accents arrivent intacts, quelle que soit la console.

import { spawn, spawnSync } from 'node:child_process';

const MAX_EN_ATTENTE = 3;

export function nettoyerTexte(t) {
  return String(t ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 220);
}

const SCRIPT = `
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$s.Rate = 1
$noms = @{}
foreach ($v in $s.GetInstalledVoices()) { if ($v.Enabled) { $noms[$v.VoiceInfo.Name] = $true } }
while (($ligne = [Console]::In.ReadLine()) -ne $null) {
  try {
    $m = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($ligne)) | ConvertFrom-Json
    $pb = New-Object System.Speech.Synthesis.PromptBuilder
    $ok = $m.voix -and $noms.ContainsKey([string]$m.voix)
    if ($ok) { $pb.StartVoice([string]$m.voix) }
    $pb.AppendText([string]$m.texte)
    if ($ok) { $pb.EndVoice() }
    $s.Speak($pb)
  } catch {}
  [Console]::Out.WriteLine('fini')
}
`;

const LISTE = "[Console]::OutputEncoding = [Text.Encoding]::UTF8; Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $l = @(); foreach ($v in $s.GetInstalledVoices()) { if ($v.Enabled) { $l += [pscustomobject]@{ nom = $v.VoiceInfo.Name; genre = [string]$v.VoiceInfo.Gender; langue = $v.VoiceInfo.Culture.Name } } }; ConvertTo-Json -InputObject $l -Compress";

export function creerVoix({ plateforme = process.platform, journal = () => {} } = {}) {
  if (plateforme !== 'win32') {
    // hors Windows (développement) : pas de voix système
    return { parler: () => false, liste: () => [], fermer() {} };
  }
  let enAttente = 0;
  let ps = null;
  const demarrer = () => {
    ps = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', SCRIPT], { stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true });
    let tampon = '';
    ps.stdout.on('data', (c) => {
      tampon += c.toString('utf8');
      let i;
      while ((i = tampon.indexOf('\n')) >= 0) {
        if (tampon.slice(0, i).trim() === 'fini') enAttente = Math.max(0, enAttente - 1);
        tampon = tampon.slice(i + 1);
      }
    });
    ps.on('error', (e) => journal(`Voix indisponible : ${e.message}`));
    ps.on('exit', () => {
      ps = null;
      enAttente = 0;
    });
  };
  let cacheListe = null;
  return {
    parler(texte, voix = '') {
      const t = nettoyerTexte(texte);
      if (!t || enAttente >= MAX_EN_ATTENTE) return false;
      if (!ps) demarrer();
      enAttente++;
      ps.stdin.write(`${Buffer.from(JSON.stringify({ texte: t, voix: String(voix).slice(0, 100) })).toString('base64')}\n`);
      return true;
    },
    liste() {
      if (cacheListe) return cacheListe;
      const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', LISTE], { encoding: 'utf8', windowsHide: true, timeout: 15000 });
      try {
        const l = JSON.parse(r.stdout || '[]');
        cacheListe = Array.isArray(l) ? l : [l];
      } catch {
        cacheListe = [];
      }
      return cacheListe;
    },
    fermer() {
      ps?.kill();
    },
  };
}
