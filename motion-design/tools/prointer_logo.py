"""Vectorise le logo officiel PRO-INTER → assets/prointer/logo-paths.json (+ .js) et logo.svg

Source : assets/prointer/logo-officiel.png (1915×821, fourni par l'agence).
1. recadrage sur le logo, repère ramené à 888 px de large,
2. la cible du « O » est mesurée puis redessinée en géométrie pure (cercle + 4 repères) pour pouvoir l'animer,
   et retirée de l'image avant le tracé,
3. un masque par couleur (gris #4A4A4A, cyan #00B8F8, gris du slogan #888888), tracé en courbes de Bézier (potrace),
   chaque lettre gardant ses trous (fill-rule evenodd) et rangée dans un groupe : P, R, bar, Inter, tagline.
"""
import json, os, numpy as np, potrace
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.join(os.path.dirname(__file__), "..")
a = np.asarray(Image.open(os.path.join(ROOT, "assets/prointer/logo-officiel.png")).convert("RGB")).astype(float)
X0, Y0, X1, Y1 = 115, 201, 1799, 648                      # boîte du logo dans l'image source
S = 888 / (X1 - X0)                                      # source → repère 888 px
GREY, CYAN, TAG = (74, 74, 74), (0, 184, 248), (136, 136, 136)
# cible mesurée sur l'image source (centre du trou, rayons intérieur/extérieur, repères)
OC, R_IN, R_OUT, T0, T1, TW = (739.75, 430.5), 105.0, 153.75, 71.0, 187.0, 13.0

def soft(col, tol):
    d = np.sqrt(((a - col) ** 2).sum(2)); return np.clip((tol - d) / (tol * 0.5), 0, 1)
grey, cyan, tag = soft(GREY, 60), soft(CYAN, 110), soft(TAG, 34)
tag[:Y0 + int(0.8 * (Y1 - Y0))] = 0                      # le gris clair n'existe que dans le slogan
# on efface la cible (redessinée à part) du masque gris
er = Image.new("L", (a.shape[1], a.shape[0]), 0); dr = ImageDraw.Draw(er)
dr.ellipse([OC[0] - R_OUT - 4, OC[1] - R_OUT - 4, OC[0] + R_OUT + 4, OC[1] + R_OUT + 4], fill=255)
for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
    xa, xb = sorted((OC[0] + dx * (T1 + 4), OC[0] + dx * (T0 - 4))) if dx else (OC[0] - TW / 2 - 4, OC[0] + TW / 2 + 4)
    ya, yb = sorted((OC[1] + dy * (T1 + 4), OC[1] + dy * (T0 - 4))) if dy else (OC[1] - TW / 2 - 4, OC[1] + TW / 2 + 4)
    dr.rectangle([xa, ya, xb, yb], fill=255)
grey = grey * (np.asarray(er) == 0)

def trace(m):
    im = Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7))
    out = []
    for curve in potrace.Bitmap(np.asarray(im) > 127).trace(turdsize=40, alphamax=1.0, opticurve=True, opttolerance=0.2):
        P = lambda p: ((p.x - X0) * S, (p.y - Y0) * S)
        x, y = P(curve.start_point); d = f"M{x:.2f},{y:.2f}"; xs, ys = [x], [y]
        for seg in curve.segments:
            if seg.is_corner: (cx_, cy_), (ex, ey) = P(seg.c), P(seg.end_point); d += f"L{cx_:.2f},{cy_:.2f}L{ex:.2f},{ey:.2f}"
            else: (c1x, c1y), (c2x, c2y), (ex, ey) = P(seg.c1), P(seg.c2), P(seg.end_point); d += f"C{c1x:.2f},{c1y:.2f} {c2x:.2f},{c2y:.2f} {ex:.2f},{ey:.2f}"
            xs.append(ex); ys.append(ey)
        if max(xs) - min(xs) > 850: continue                # contour du cadre de l'image, pas une forme
        out.append({"d": d + "Z", "box": [min(xs), min(ys), max(xs), max(ys)]})
    return out

paths = []
for p in trace(grey):
    cx = (p["box"][0] + p["box"][2]) / 2
    g = "P" if cx < 116 else "R" if cx < 256 else "bar" if 430 < cx < 470 else None
    if g: paths.append(dict(p, g=g))
paths += [dict(p, g="Inter") for p in trace(cyan)] + [dict(p, g="tagline") for p in trace(tag)]
# trous des lettres : chaque contour intérieur rejoint la lettre qui le contient (fill-rule evenodd)
def inside(i, o): return i[0] >= o[0] - 0.5 and i[1] >= o[1] - 0.5 and i[2] <= o[2] + 0.5 and i[3] <= o[3] + 0.5
merged = []
for p in sorted(paths, key=lambda q: -(q["box"][2] - q["box"][0]) * (q["box"][3] - q["box"][1])):
    host = next((m for m in merged if m["g"] == p["g"] and inside(p["box"], m["box"])), None)
    if host: host["d"] += p["d"]
    else: merged.append(dict(p))
paths = [{"g": p["g"], "d": p["d"], "box": [round(v, 1) for v in p["box"]]} for p in sorted(merged, key=lambda q: q["box"][0])]

O = {"cx": round((OC[0] - X0) * S, 2), "cy": round((OC[1] - Y0) * S, 2), "r": round((R_IN + R_OUT) / 2 * S, 2), "stroke": round((R_OUT - R_IN) * S, 2),
     "tick_r0": round(T0 * S, 2), "tick_r1": round(T1 * S, 2), "tick_w": round(TW * S, 2), "r_in": round(R_IN * S, 2), "r_out": round(R_OUT * S, 2)}
H = round((Y1 - Y0) * S, 1)
data = {"w": 888, "h": H, "grey": "#4A4A4A", "cyan": "#00B8F8", "tag": "#888888", "O": O, "paths": paths}
json.dump(data, open(os.path.join(ROOT, "assets/prointer/logo-paths.json"), "w"))
open(os.path.join(ROOT, "assets/prointer/logo-paths.js"), "w").write("window.LOGO_DATA = " + json.dumps(data) + ";\n")
col = {"Inter": data["cyan"], "tagline": data["tag"]}
ring = f'<circle cx="{O["cx"]}" cy="{O["cy"]}" r="{O["r"]}" fill="none" stroke="{data["grey"]}" stroke-width="{O["stroke"]}"/>'
ticks = "".join(f'<line x1="{O["cx"] + dx * O["tick_r0"]}" y1="{O["cy"] + dy * O["tick_r0"]}" x2="{O["cx"] + dx * O["tick_r1"]}" y2="{O["cy"] + dy * O["tick_r1"]}" stroke="{data["grey"]}" stroke-width="{O["tick_w"]}"/>' for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
svg = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 888 {H}">'] + [f'<path fill="{col.get(p["g"], data["grey"])}" fill-rule="evenodd" d="{p["d"]}"/>' for p in paths] + [ring, ticks, "</svg>"]
open(os.path.join(ROOT, "assets/prointer/logo.svg"), "w").write("\n".join(svg))
from collections import Counter; print(Counter(p["g"] for p in paths), "hauteur", H, O)
