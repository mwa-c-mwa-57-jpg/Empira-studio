"""Étalonnage « noir & or » des photos sources (Pexels) → assets/photos/*.jpg
Unifie des photos d'origines différentes dans la charte Empira : noirs profonds, hautes lumières dorées.
"""
import numpy as np
from PIL import Image, ImageFilter
import os

SRC = os.path.join(os.path.dirname(__file__), "..", "assets", "photos-src")
DST = os.path.join(os.path.dirname(__file__), "..", "assets", "photos")
os.makedirs(DST, exist_ok=True)

# dégradé or (luminance → couleur), calé sur le logo
STOPS = np.array([
    [0.00, 0.010, 0.008, 0.006],
    [0.18, 0.070, 0.045, 0.022],
    [0.42, 0.330, 0.200, 0.075],
    [0.65, 0.760, 0.520, 0.220],
    [0.85, 0.960, 0.800, 0.470],
    [1.00, 1.000, 0.960, 0.880],
])
def gold_map(y):
    out = np.zeros(y.shape + (3,))
    for c in range(3):
        out[..., c] = np.interp(y, STOPS[:, 0], STOPS[:, c + 1])
    return out

def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)

def grade(name, amount=0.7, black=0.03, gamma=1.0, sat=0.6, warm=0.08, maxw=3200, key=None, exposure=1.0, crop=None, pre=None):
    im = Image.open(os.path.join(SRC, name + ".jpg")).convert("RGB")
    if pre: im = pre(im)
    if crop: im = im.crop(crop)
    if max(im.size) > maxw:
        im.thumbnail((maxw, maxw), Image.LANCZOS)
    a = np.asarray(im).astype(np.float32) / 255.0
    a = np.clip(a * exposure, 0, 1)
    y = 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]
    if key is not None:  # clé de luminance personnalisée (ex : nuit américaine)
        y = key(a, y)
    y = np.clip((y - black) / (1 - black), 0, 1) ** gamma
    # version « naturelle » réchauffée et désaturée
    nat = a.copy()
    lum = (0.2126 * nat[..., 0] + 0.7152 * nat[..., 1] + 0.0722 * nat[..., 2])[..., None]
    nat = lum + (nat - lum) * sat
    nat[..., 0] *= 1 + warm; nat[..., 2] *= 1 - warm * 1.5
    nat = np.clip((nat - black) / (1 - black), 0, 1) ** gamma
    out = nat * (1 - amount) + gold_map(y) * amount
    # courbe en S douce
    out = np.clip(out, 0, 1)
    out = out + 0.18 * (smoothstep(0, 1, out) - out)
    Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8)).save(os.path.join(DST, name + ".jpg"), quality=92)
    print(name, im.size)

# --- réglages par photo ---
grade("lens", amount=0.55, black=0.02, sat=0.8, maxw=4058)
grade("camera", amount=0.55, black=0.04, sat=0.5, gamma=1.1)

def remove_logo(im):
    """efface le logo de marque au dos du téléphone (inpainting)"""
    import cv2
    a = np.asarray(im)[..., ::-1].copy(); H, W = a.shape[:2]
    m = np.zeros((H, W), np.uint8)
    cv2.ellipse(m, (int(W * 0.442), int(H * 0.492)), (int(W * 0.046), int(H * 0.031)), -18, 0, 360, 255, -1)
    a = cv2.inpaint(a, m, 25, cv2.INPAINT_TELEA)
    a = cv2.GaussianBlur(a, (0, 0), 1.2) * (m[..., None] > 0) + a * (m[..., None] == 0)
    return Image.fromarray(a.astype(np.uint8)[..., ::-1])
grade("phlens", amount=0.6, black=0.04, sat=0.6, gamma=1.15)
grade("phone", amount=0.65, black=0.06, sat=0.5, gamma=1.2, pre=remove_logo)
grade("mixer", amount=0.72, black=0.06, sat=0.5, gamma=1.6, exposure=0.8)
grade("gaming", amount=0.78, black=0.02, sat=0.6, exposure=1.2)
grade("pad", amount=0.75, black=0.02, sat=0.5, exposure=1.5, gamma=0.9)
grade("mic", amount=0.8, black=0.03, gamma=1.05, maxw=3000)
grade("ring", amount=0.45, black=0.02, sat=0.4, maxw=3200)
grade("walk", amount=0.5, black=0.03, sat=0.7)
grade("climb", amount=0.6, black=0.03, sat=0.5, exposure=1.35, gamma=0.9)
grade("summit", amount=0.85, black=0.02, gamma=0.9, exposure=1.15)
grade("crowd", amount=0.4, black=0.04, sat=0.7)
grade("bokeh", amount=0.5, black=0.03, sat=0.6, maxw=2400)
# Cervin : nuit américaine — le ciel bleu plonge dans le noir, la neige et le sommet éclairé deviennent or
def peak_key(a, y):
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    k = 0.75 * r + 0.25 * y
    sky = np.clip((b - r) * 2.5, 0, 1)            # ciel bleu
    k = k * (1 - 0.65 * sky)
    return smoothstep(0.42, 0.98, k) ** 1.15
grade("peak", amount=0.95, black=0.0, sat=0.3, key=peak_key)

# --- Cervin, version finale : détourage du ciel (GrabCut) puis nuit profonde ---
def peak_night():
    import cv2
    im = Image.open(os.path.join(SRC, "peak.jpg")).convert("RGB"); im.thumbnail((3200, 3200), Image.LANCZOS)
    a = np.asarray(im).astype(np.float32) / 255.0
    H, W = a.shape[:2]
    small = cv2.resize((a * 255).astype(np.uint8)[..., ::-1], (W // 4, H // 4), interpolation=cv2.INTER_AREA)
    h, w = small.shape[:2]
    m = np.full((h, w), cv2.GC_PR_BGD, np.uint8)
    m[: int(h * 0.22)] = cv2.GC_BGD
    m[int(h * 0.62):] = cv2.GC_FGD
    m[int(h * 0.45):int(h * 0.62)] = cv2.GC_PR_FGD
    bgd = np.zeros((1, 65), np.float64); fgd = np.zeros((1, 65), np.float64)
    cv2.grabCut(small, m, None, bgd, fgd, 8, cv2.GC_INIT_WITH_MASK)
    fg = ((m == cv2.GC_FGD) | (m == cv2.GC_PR_FGD)).astype(np.uint8)
    # garde la composante reliée au bas de l'image, comble les trous
    n, lab = cv2.connectedComponents(fg)
    keep = np.isin(lab, np.unique(lab[-1][fg[-1] > 0])); fg = keep.astype(np.uint8)
    first = np.argmax(fg, axis=0).astype(np.float32); first[fg.max(0) == 0] = h
    # les bandes de brume lisses sous l'horizon restent du ciel : on descend tant que c'est lisse
    gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY).astype(np.float32)
    mu = cv2.blur(gray, (7, 7)); sd = np.sqrt(np.maximum(cv2.blur(gray * gray, (7, 7)) - mu * mu, 0))
    for x in range(w):
        yy = int(first[x])
        while yy < h - 1 and sd[yy, x] < 3.2: yy += 1
        first[x] = yy
    first = cv2.medianBlur(first.astype(np.float32)[None, :].copy(), 5)[0] if False else first
    k = 3; pad = np.pad(first, k, mode="edge"); first = np.array([np.median(pad[i:i + 2 * k + 1]) for i in range(w)], np.float32)
    first = first + 2.0   # rogne la frange de brume au ras de la crête
    rows = np.arange(h)[:, None]; fg = (rows >= first[None, :]).astype(np.float32)
    fg = cv2.resize(fg, (W, H), interpolation=cv2.INTER_LINEAR)
    fg = cv2.GaussianBlur(fg, (0, 0), 2.0)
    sky = 1 - np.clip(fg, 0, 1)
    ridge = cv2.resize(first[None, :] * 4, (W, 1), interpolation=cv2.INTER_LINEAR)[0]
    y = 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]
    k2 = smoothstep(0.30, 0.97, 0.6 * a[..., 0] + 0.4 * y) ** 1.1
    mtn = gold_map(k2)
    rr = np.arange(H)[:, None].astype(np.float32)
    halo = cv2.GaussianBlur(np.clip(fg, 0, 1), (0, 0), H * 0.06)
    glow = halo * 0.30 * sky
    skycol = np.stack([0.010 + glow * 0.95, 0.008 + glow * 0.60, 0.010 + glow * 0.26], -1)
    out = mtn * (1 - sky[..., None]) + skycol * sky[..., None]
    out = np.clip(out, 0, 1); out = out + 0.18 * (smoothstep(0, 1, out) - out)
    Image.fromarray((out * 255).astype(np.uint8)).save(os.path.join(DST, "peak.jpg"), quality=92)
    np.save(os.path.join(os.path.dirname(__file__), "peak_ridge.npy"), ridge)   # ligne de crête (tracé de la ligne dorée)
    print("peak night", W, H)
peak_night()
