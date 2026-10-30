// Local text-to-speech for the announcer, played on the PC speakers (captured by OBS "Desktop audio").
//  - Windows: built-in voices through System.Speech (a single PowerShell process kept open)
//  - macOS: the `say` command
//  - Linux: espeak-ng / espeak when installed
// Text is always passed through stdin or as an argument array, never through a shell string.

import { spawn, spawnSync } from 'node:child_process';

const MAX_PENDING = 3;

export function cleanSpeech(text) {
  return String(text ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[-\s]+/, '') // never let a phrase look like a command-line option
    .trim()
    .slice(0, 220);
}

const PS_SCRIPT = `
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$fr = $s.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Culture.Name -like 'fr*' } | Select-Object -First 1
if ($fr) { $s.SelectVoice($fr.VoiceInfo.Name); [Console]::Out.WriteLine('voice:' + $fr.VoiceInfo.Name) } else { [Console]::Out.WriteLine('voice:none') }
$s.Rate = [int]$env:EMPIRA_VOICE_RATE
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
while (($line = [Console]::In.ReadLine()) -ne $null) {
  try { $s.Speak($line) } catch {}
  [Console]::Out.WriteLine('done')
}
`;

export function createVoice({ log = console.log, platform = process.platform, rate = 1 } = {}) {
  let pending = 0;
  let info = { backend: 'none', voice: null };

  if (platform === 'win32') {
    const ps = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', PS_SCRIPT], {
      stdio: ['pipe', 'pipe', 'ignore'],
      env: { ...process.env, EMPIRA_VOICE_RATE: String(Math.round(rate)) },
      windowsHide: true,
    });
    info = { backend: 'windows', voice: null };
    let buffer = '';
    ps.stdout.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      let i;
      while ((i = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, i).trim();
        buffer = buffer.slice(i + 1);
        if (line === 'done') pending = Math.max(0, pending - 1);
        else if (line.startsWith('voice:')) {
          info.voice = line.slice(6);
          log(info.voice === 'none' ? '  [Voix] aucune voix française Windows trouvée : la voix par défaut sera utilisée.' : `  [Voix] ${info.voice}`);
        }
      }
    });
    ps.on('error', (err) => {
      info.backend = 'none';
      log(`  [Voix] indisponible : ${err.message}`);
    });
    ps.on('exit', () => (info.backend = 'none'));
    return {
      info,
      say(text) {
        const t = cleanSpeech(text);
        if (!t || info.backend === 'none' || pending >= MAX_PENDING) return false;
        pending++;
        ps.stdin.write(t + '\n', 'utf8');
        return true;
      },
      close: () => ps.kill(),
    };
  }

  const command = platform === 'darwin' ? ['say', ['-v', 'Thomas']] : ['espeak-ng', 'espeak'].map((c) => [c, ['-v', 'fr']]).find(([c]) => spawnSync(c, ['--version']).status === 0);
  if (!command) {
    log('  [Voix] aucun moteur de synthèse vocale trouvé sur ce système.');
    return { info, say: () => false, close() {} };
  }
  info = { backend: command[0], voice: command[1].join(' ') };
  const queue = [];
  let speaking = false;
  const next = () => {
    if (speaking || !queue.length) return;
    speaking = true;
    const child = spawn(command[0], [...command[1], queue.shift()], { stdio: 'ignore' });
    const done = () => {
      speaking = false;
      pending = Math.max(0, pending - 1);
      next();
    };
    child.on('exit', done);
    child.on('error', done);
  };
  return {
    info,
    say(text) {
      const t = cleanSpeech(text);
      if (!t || pending >= MAX_PENDING) return false;
      pending++;
      queue.push(t);
      next();
      return true;
    },
    close() {},
  };
}
