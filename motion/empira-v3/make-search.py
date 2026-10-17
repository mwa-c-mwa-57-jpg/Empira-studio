"""Images de la scène « recherche » à partir d'un enregistrement d'écran TikTok.
Remplace les suggestions d'amis (tiers) et la ligne des compteurs par des éléments inventés au même style.
Usage : python3 -I motion/empira-v3/make-search.py <enregistrement.mp4>"""
import glob, os, subprocess, sys, tempfile
from PIL import Image, ImageDraw, ImageFont

src = sys.argv[1]
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = f'{HERE}/footage/search'
os.makedirs(OUT, exist_ok=True)
for f in glob.glob(f'{OUT}/*.jpg'): os.remove(f)
FONT = '/usr/share/fonts/opentype/inter/'
f_row = ImageFont.truetype(FONT + 'Inter-Medium.otf', 52)
f_sub = ImageFont.truetype(FONT + 'Inter-Regular.otf', 44)
ROSE = (254, 51, 82)

def suggestion(d, y, rest):
    d.rectangle((170, y - 50, 1080, y + 58), fill=(0, 0, 0))
    d.text((182, y), 'emp', font=f_row, fill=ROSE, anchor='lm')
    d.text((182 + d.textlength('emp', font=f_row), y), rest, font=f_row, fill='white', anchor='lm')

# (début, durée, vitesse, retouches)
SEGMENTS = [(0.0, 1.0, 2, 'amis'), (1.6, 0.6, 2, 'avatar'), (4.35, 0.9, 1, 'compteurs')]
n = 0
with tempfile.TemporaryDirectory() as tmp:
    for k, (ss, dur, speed, fix) in enumerate(SEGMENTS):
        subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-ss', str(ss), '-t', str(dur), '-i', src, '-an',
                        '-vf', f'setpts=PTS/{speed},fps=30', f'{tmp}/{k}_%03d.png'], check=True)
        for f in sorted(glob.glob(f'{tmp}/{k}_*.png')):
            im = Image.open(f).convert('RGB'); d = ImageDraw.Draw(im)
            if fix in ('amis', 'avatar'):  # avatars de comptes tiers dans les suggestions
                d.rectangle((925, 560, 1080, 1520), fill=(0, 0, 0))
            if fix == 'amis':
                suggestion(d, 678, 'ira live')
                suggestion(d, 1254, 'ira gaming')
            if fix == 'compteurs':
                d.rectangle((270, 622, 760, 682), fill=im.getpixel((800, 650)))
                d.text((276, 652), 'Agence de créateurs LIVE', font=f_sub, fill=(165, 165, 165), anchor='lm')
            im.resize((1080, 2348)).save(f'{OUT}/{n:03d}.jpg', quality=88); n += 1
print('images recherche :', n)
