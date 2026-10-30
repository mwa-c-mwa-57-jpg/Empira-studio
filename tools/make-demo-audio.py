"""Builds the voice track of the demo video and muxes the final MP4.

    python3 tools/make-demo-audio.py <demoDir> <piper-voice.onnx> [title-font.ttf]

Reads <demoDir>/demo-raw.webm and <demoDir>/phrases.json (written by tools/make-demo-video.mjs),
speaks every phrase with Piper (offline neural TTS, `pip install piper-tts`), places each phrase at the
moment the game announced it (one after the other, like the real server voice), and writes
<demoDir>/empira-demo.mp4 (H.264 + AAC, 720x1280).
"""

import json
import os
import subprocess
import sys
import wave
from pathlib import Path

demo = Path(sys.argv[1])
voice = sys.argv[2]
font = sys.argv[3] if len(sys.argv) > 3 else None
phrases = json.loads((demo / 'phrases.json').read_text())
tts_dir = demo / 'tts'
tts_dir.mkdir(exist_ok=True)

RATE = 22050
track = bytearray()
cursor = 0.0  # seconds already written
log = []
for i, p in enumerate(phrases):
    wav = tts_dir / f'{i:02d}.wav'
    subprocess.run([sys.executable, '-m', 'piper', '-m', voice, '-f', str(wav)], input=p['text'].encode(), check=True, capture_output=True)
    with wave.open(str(wav)) as w:
        assert w.getframerate() == RATE and w.getsampwidth() == 2 and w.getnchannels() == 1
        frames = w.readframes(w.getnframes())
    start = max(p['t'] / 1000, cursor + 0.15)  # never overlap two phrases
    track += b'\x00\x00' * int((start - cursor) * RATE)
    track += frames
    cursor = start + len(frames) / 2 / RATE
    log.append(f'{start:6.1f}s → {cursor:6.1f}s  {p["text"]}')

with wave.open(str(demo / 'voice.wav'), 'wb') as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(RATE)
    w.writeframes(bytes(track))
print('\n'.join(log))

video_filter = 'fps=30'
if font:
    # the caption goes through a file: commas and colons would otherwise break the filter graph
    (demo / 'caption.txt').write_text('DÉMO — événements simulés, sans connexion TikTok', encoding='utf-8')
    video_filter += (f",drawtext=fontfile='{font}':textfile='{demo / 'caption.txt'}':fontcolor=white:fontsize=22:"
                     "box=1:boxcolor=black@0.55:boxborderw=12:x=(w-text_w)/2:y=h-46:enable='lt(t,6)'")
subprocess.run([
    'ffmpeg', '-v', 'error', '-y', '-i', str(demo / 'demo-raw.webm'), '-i', str(demo / 'voice.wav'),
    '-filter_complex', f'[0:v]{video_filter}[v];[1:a]apad,volume=1.6[a]', '-map', '[v]', '-map', '[a]',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '21', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k',
    # explicit duration (apad + -shortest can hang); DEMO_DURATION lets the video stop after a sentence
    '-t', os.environ.get('DEMO_DURATION', '85.8'), '-movflags', '+faststart', str(demo / 'empira-demo.mp4'),
], check=True)
print('→', demo / 'empira-demo.mp4')
