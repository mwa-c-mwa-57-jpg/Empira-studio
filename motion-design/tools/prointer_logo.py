"""Vectorise le logo PRO-INTER (seule source : PNG 222×65 du site) → assets/prointer/logo-paths.json + logo.svg

1. agrandissement ×4 par IA (tools/upscale.py) → assets/prointer/logo-x4.png
2. un masque par couleur (gris #505050, cyan #00B0E0), lissé et agrandi ×2,
3. tracé en courbes de Bézier (potrace), chaque forme rangée dans un groupe animable :
   P, R, O (cercle-cible), ticks (repères de la cible), bar, Inter (I n t e r), tagline.
"""
import json, os, numpy as np, potrace
from PIL import Image, ImageFilter

ROOT = os.path.join(os.path.dirname(__file__), "..")
SRC = os.path.join(ROOT, "assets/prointer/logo-x4.png")
a = np.asarray(Image.open(SRC).convert("RGB")).astype(float)
grey = np.array([80, 80, 80]); cyan = np.array([0, 176, 224])
def mask(col, tol):
    d = np.sqrt(((a - col) ** 2).sum(2)); m = np.clip((tol - d) / (tol * 0.5), 0, 1)
    im = Image.fromarray((m * 255).astype(np.uint8)).resize((a.shape[1] * 2, a.shape[0] * 2), Image.BICUBIC).filter(ImageFilter.GaussianBlur(1.2))
    return np.asarray(im) > 127
S = 0.5                                   # retour à l'échelle 888×260
def trace(m):
    out = []
    for curve in potrace.Bitmap(m).trace(turdsize=30, alphamax=1.0, opticurve=True, opttolerance=0.2):
        d = f"M{curve.start_point.x * S:.2f},{curve.start_point.y * S:.2f}"
        xs, ys = [curve.start_point.x], [curve.start_point.y]
        for seg in curve.segments:
            if seg.is_corner: d += f"L{seg.c.x * S:.2f},{seg.c.y * S:.2f}L{seg.end_point.x * S:.2f},{seg.end_point.y * S:.2f}"; xs += [seg.c.x, seg.end_point.x]; ys += [seg.c.y, seg.end_point.y]
            else: d += f"C{seg.c1.x * S:.2f},{seg.c1.y * S:.2f} {seg.c2.x * S:.2f},{seg.c2.y * S:.2f} {seg.end_point.x * S:.2f},{seg.end_point.y * S:.2f}"; xs += [seg.end_point.x]; ys += [seg.end_point.y]
        out.append({"d": d + "Z", "box": [min(xs) * S, min(ys) * S, max(xs) * S, max(ys) * S]})
    return out

# « AGENCE D'EMPLOI » : gris plus clair et très fin → masque par luminance, seulement sous « Inter »
lum = a.mean(2); tag = np.zeros(lum.shape, bool); tag[214:, 480:] = lum[214:, 480:] < 185
tagm = np.asarray(Image.fromarray((tag * 255).astype(np.uint8)).resize((a.shape[1] * 2, a.shape[0] * 2), Image.BICUBIC).filter(ImageFilter.GaussianBlur(0.8))) > 110
paths = []
for p in trace(mask(grey, 70)) + [dict(q, cyan=True) for q in trace(mask(cyan, 90))] + [dict(q, tag=True) for q in trace(tagm)]:
    x0, y0, x1, y1 = p["box"]; cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    if x1 - x0 > 800: continue                                   # contour du cadre, pas une forme
    if p.get("tag"): g = "tagline"
    elif p.get("cyan"): g = "Inter"
    elif y0 > 215: continue
    elif 450 < cx < 462: g = "bar" if y1 - y0 > 150 else None
    elif x1 - x0 < 14 and y1 - y0 > 150: g = "bar"
    elif cx < 105: g = "P"
    elif cx < 215: g = "R"
    elif (x1 - x0) < 30 and (y1 - y0) < 30: g = "ticks"
    else: g = "O"
    if g: paths.append({"g": g, "d": p["d"], "box": [round(v, 1) for v in p["box"]]})
# trous des lettres (P, R, e, A, D, O…) : chaque contour intérieur rejoint la lettre qui le contient (fill-rule evenodd)
def inside(i, o): return i[0] >= o[0] - 0.5 and i[1] >= o[1] - 0.5 and i[2] <= o[2] + 0.5 and i[3] <= o[3] + 0.5
merged = []
for p in sorted(paths, key=lambda q: -(q["box"][2] - q["box"][0]) * (q["box"][3] - q["box"][1])):
    host = next((m for m in merged if m["g"] == p["g"] and inside(p["box"], m["box"])), None)
    if host: host["d"] += p["d"]
    else: merged.append(dict(p))
paths = sorted(merged, key=lambda q: q["box"][0])
# la cible du « O » est redessinée en géométrie pure (cercle + 4 repères) pour pouvoir l'animer
O = {"cx": 328.5, "cy": 135.0, "r": 68.8, "stroke": 27.5, "tick_r0": 38.0, "tick_r1": 99.0, "tick_w": 8.0}
json.dump({"w": 888, "h": 260, "grey": "#505050", "cyan": "#00B0E0", "tag": "#8C8C8C", "O": O, "paths": [p for p in paths if p["g"] not in ("O", "ticks")]}, open(os.path.join(ROOT, "assets/prointer/logo-paths.json"), "w"))
col = {"Inter": "#00B0E0"}
col["tagline"] = "#8C8C8C"
ring = f'<circle cx="{O["cx"]}" cy="{O["cy"]}" r="{O["r"]}" fill="none" stroke="#505050" stroke-width="{O["stroke"]}"/>'
ticks = "".join(f'<line x1="{O["cx"] + dx * O["tick_r0"]}" y1="{O["cy"] + dy * O["tick_r0"]}" x2="{O["cx"] + dx * O["tick_r1"]}" y2="{O["cy"] + dy * O["tick_r1"]}" stroke="#505050" stroke-width="{O["tick_w"]}"/>' for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
svg = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 888 260">'] + [f'<path fill="{col.get(p["g"], "#505050")}" fill-rule="evenodd" d="{p["d"]}"/>' for p in paths if p["g"] not in ("O", "ticks")] + [ring, ticks, "</svg>"]
open(os.path.join(ROOT, "assets/prointer/logo.svg"), "w").write("\n".join(svg))
from collections import Counter; print(Counter(p["g"] for p in paths))
# version script pour la page d'animation
open(os.path.join(ROOT, "assets/prointer/logo-paths.js"), "w").write("window.LOGO_DATA = " + open(os.path.join(ROOT, "assets/prointer/logo-paths.json")).read() + ";\n")
