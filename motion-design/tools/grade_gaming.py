"""Étalonnage noir & or des photos de la pub Empira Gaming → assets/photos/gaming/*.jpg"""
import numpy as np, os
from PIL import Image

SRC = os.path.join(os.path.dirname(__file__), "..", "assets", "photos-src", "gaming")
DST = os.path.join(os.path.dirname(__file__), "..", "assets", "photos", "gaming")
os.makedirs(DST, exist_ok=True)

STOPS = np.array([[0.00, .010, .008, .006], [0.18, .070, .045, .022], [0.42, .330, .200, .075],
                  [0.65, .760, .520, .220], [0.85, .960, .800, .470], [1.00, 1.00, .960, .880]])
def gold_map(y): return np.stack([np.interp(y, STOPS[:, 0], STOPS[:, c + 1]) for c in range(3)], -1)
def smoothstep(a, b, x): t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)

def inpaint(cx, cy, rx, ry):
    """efface un logo de marque (ellipse en coordonnées relatives)"""
    def f(im):
        import cv2
        a = np.asarray(im)[..., ::-1].copy(); H, W = a.shape[:2]; m = np.zeros((H, W), np.uint8)
        cv2.ellipse(m, (int(W * cx), int(H * cy)), (int(W * rx), int(H * ry)), 0, 0, 360, 255, -1)
        a = cv2.inpaint(a, m, 30, cv2.INPAINT_TELEA)
        return Image.fromarray(a[..., ::-1])
    return f

def clone(cx, cy, rx, ry, dx, dy=0.0, feather=0.35):
    """masque un logo en recopiant une zone voisine de la même surface (bords fondus)"""
    def f(im):
        a = np.asarray(im).astype(np.float32); H, W = a.shape[:2]
        yy, xx = np.mgrid[0:H, 0:W]
        d = np.sqrt(((xx - W * cx) / (W * rx)) ** 2 + ((yy - H * cy) / (H * ry)) ** 2)
        m = np.clip((1 - d) / feather, 0, 1)[..., None]
        sx, sy = int(W * dx), int(H * dy)
        src = np.roll(np.roll(a, -sy, 0), -sx, 1)
        return Image.fromarray((a * (1 - m) + src * m).astype(np.uint8))
    return f

def soften_screen(im):
    """l'écran du téléphone devient une lueur abstraite (aucune interface d'appli lisible)"""
    import cv2
    a = np.asarray(im).astype(np.float32); H, W = a.shape[:2]
    y = a.mean(2) / 255
    m = (y > 0.18).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((61, 61), np.uint8))
    n, lab, stats, _ = cv2.connectedComponentsWithStats(m)
    big = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA]); m = (lab == big).astype(np.float32)
    m = cv2.GaussianBlur(m, (0, 0), 18)[..., None]
    bl = cv2.GaussianBlur(a, (0, 0), 38) * 1.05
    return Image.fromarray(np.clip(a * (1 - m) + bl * m, 0, 255).astype(np.uint8))

def grade(name, amount=0.7, black=0.03, gamma=1.0, sat=0.6, warm=0.08, maxw=3200, exposure=1.0, pre=None):
    im = Image.open(os.path.join(SRC, name + ".jpg")).convert("RGB")
    if pre: im = pre(im)
    if max(im.size) > maxw: im.thumbnail((maxw, maxw), Image.LANCZOS)
    a = np.clip(np.asarray(im).astype(np.float32) / 255.0 * exposure, 0, 1)
    y = 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]
    y = np.clip((y - black) / (1 - black), 0, 1) ** gamma
    lum = y[..., None]; nat = lum + (a - (0.2126 * a[..., :1] + 0.7152 * a[..., 1:2] + 0.0722 * a[..., 2:])) * sat
    nat[..., 0] *= 1 + warm; nat[..., 2] *= 1 - warm * 1.5
    out = np.clip(nat * (1 - amount) + gold_map(y) * amount, 0, 1)
    out = out + 0.2 * (smoothstep(0, 1, out) - out)
    Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8)).save(os.path.join(DST, name + ".jpg"), quality=92)
    print(name, im.size)

grade("g_phone", amount=0.8, black=0.03, sat=0.5, exposure=1.25, pre=soften_screen)
grade("g_headset", amount=0.75, black=0.04, sat=0.5, gamma=1.1)
grade("g_desk", amount=0.72, black=0.04, sat=0.5, exposure=1.1)
grade("g_arena", amount=0.35, black=0.03, sat=0.7)
grade("g_pad", amount=0.7, black=0.02, sat=0.4, exposure=1.05, pre=clone(0.52, 0.262, 0.065, 0.045, -0.12))
