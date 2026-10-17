"""Fabrique le « filtre » LIVE TikTok à partir d'une vraie capture d'écran :
garde l'interface telle quelle, rend la zone vidéo transparente et remplace
les spectateurs (avatars, pseudos) par des éléments inventés au même style.
Usage : python3 -I motion/empira-v3/make-overlay.py <capture.png> <sortie.png>"""
import os, sys
from PIL import Image, ImageDraw, ImageFont

src, out = sys.argv[1], sys.argv[2]
HERE = os.path.dirname(os.path.abspath(__file__))
im = Image.open(src).convert('RGBA')
W, H = im.size  # 1206 × 2622
d = ImageDraw.Draw(im)
FONT = '/usr/share/fonts/opentype/inter/'
med = lambda s: ImageFont.truetype(FONT + 'Inter-Medium.otf', s)
bold = lambda s: ImageFont.truetype(FONT + 'Inter-ExtraBoldItalic.otf', s)
GRIS = (168, 168, 168)

def avatar(n, cx, cy, size, ring):
    th = Image.open(f'{HERE}/thumbs/{n}.jpg').convert('RGBA')
    w, h = th.size; th = th.crop((0, 0, w, w)).resize((size, size))
    mask = Image.new('L', (size, size), 0); ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=255)
    r = size // 2 + 4
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=ring)
    im.paste(th, (cx - size // 2, cy - size // 2), mask)

def rank(txt, x, y, col):
    d.text((x, y), txt, font=bold(40), fill=col, stroke_width=3, stroke_fill=(0, 0, 0))

def pill(x0, y0, x1, y1, col, txt):
    d.rounded_rectangle((x0, y0, x1, y1), radius=12, fill=col)
    d.text(((x0 + x1) / 2, (y0 + y1) / 2), txt, font=ImageFont.truetype(FONT + 'Inter-Bold.otf', 32), fill='white', anchor='mm')

# créateur du LIVE : pseudo et avatar remplacés par un créateur fictif
avatar(0, 89, 240, 104, (240, 193, 99))
d.rectangle((152, 192, 418, 256), fill=(32, 32, 32))
d.text((157, 224), 'Nova.live', font=ImageFont.truetype(FONT + 'Inter-Bold.otf', 46), fill='white', anchor='lm')
# avatars en haut à droite
d.rectangle((835, 196, 968, 284), fill=(0, 0, 0))
avatar(2, 878, 240, 76, (255, 255, 255)); rank('9', 880, 248, 'white')
avatar(5, 930, 240, 76, (255, 255, 255)); rank('5', 934, 248, 'white')
# rangées de classement sous le match
d.rectangle((122, 1664, 322, 1762), fill=(0, 0, 0))
avatar(1, 178, 1712, 80, (254, 44, 85)); rank('2', 200, 1716, (254, 44, 85))
avatar(7, 272, 1712, 80, (254, 44, 85)); rank('1', 294, 1716, (254, 44, 85))
d.rectangle((882, 1664, 1186, 1762), fill=(0, 0, 0))
for i, n in enumerate([5, 8, 6]):
    avatar(n, 936 + i * 96, 1712, 80, (37, 244, 238)); rank(str(i + 1), 958 + i * 96, 1716, (37, 244, 238))
# 1er commentaire : avatar + pseudo
d.rectangle((44, 1838, 134, 1930), fill=(33, 33, 33))
avatar(3, 90, 1884, 80, (33, 33, 33))
d.rectangle((148, 1832, 424, 1890), fill=(31, 31, 31))
d.text((152, 1836), 'lea_d', font=med(46), fill=GRIS)
# « … a rejoint » avec badges
d.rectangle((148, 1992, 748, 2058), fill=(31, 31, 31))
pill(152, 2000, 262, 2050, (56, 62, 205), '◆ 26')
pill(274, 2000, 432, 2050, (240, 122, 38), '♥ Empira')
d.text((446, 1998), 'nico.gaming', font=med(46), fill=GRIS)
# 2e « … a rejoint »
d.rectangle((148, 2305, 428, 2368), fill=(30, 30, 30))
d.text((152, 2308), 'sarah.live', font=med(46), fill=GRIS)

# Zone vidéo du match (sous la barre rose/bleue) : transparente
alpha = im.getchannel('A')
ImageDraw.Draw(alpha).rectangle((0, 600, W, 1644), fill=0)
im.putalpha(alpha)
im.save(out)
print('filtre :', out, im.size)
