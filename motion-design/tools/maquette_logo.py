"""Logo fictif des maquettes (« CIBLO ») au même format que le logo PRO-INTER vectorisé (window.LOGO_DATA).

Les lettres viennent de Montserrat (ExtraBold pour le nom, SemiBold pour le slogan) ; le « O » final est la cible,
avec exactement la géométrie de la cible PRO-INTER, pour que la mascotte et le viseur s'animent à l'identique.
Sortie : assets/maquette/logo-paths.js
"""
import json, os
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.transformPen import TransformPen

ROOT = os.path.join(os.path.dirname(__file__), "..")
FONT = os.path.join(ROOT, "assets", "fonts", "montserrat-latin.woff2")
NAME, TAG = "CIBL", "AGENCE D’EMPLOI"
O = {"cx": 0, "cy": 121.02, "r": 68.22, "stroke": 25.71, "tick_r0": 37.44, "tick_r1": 98.61, "tick_w": 6.86, "r_in": 55.37, "r_out": 81.07}

def font(w):
    f = TTFont(FONT); return instantiateVariableFont(f, {"wght": w})
def glyphs(f, text, size, x0, base, track=0.0):
    """chemins SVG des lettres (une par lettre), y vers le bas ; renvoie (liste, x de fin)"""
    gs, cmap, upm = f.getGlyphSet(), f.getBestCmap(), f["head"].unitsPerEm
    k, x, out = size / upm, x0, []
    for ch in text:
        name = cmap[ord(ch)]; adv = f["hmtx"][name][0] * k
        if ch != " ":
            pen = SVGPathPen(gs); gs[name].draw(TransformPen(pen, (k, 0, 0, -k, x, base)))
            bp = BoundsPen(gs); gs[name].draw(TransformPen(bp, (k, 0, 0, -k, x, base)))
            if bp.bounds: out.append({"d": pen.getCommands(), "box": [round(v, 2) for v in bp.bounds]})
        x += adv + track * size
    return out, x

bold, semi = font(800), font(600)
cap = 2 * O["r_out"]                                   # hauteur des capitales = diamètre extérieur de la cible
size = cap / (bold["OS/2"].sCapHeight / bold["head"].unitsPerEm)
base = O["cy"] + O["r_out"]
letters, xe = glyphs(bold, NAME, size, 0.5, base)
O["cx"] = round(xe + 28 + O["r_out"], 2)               # la cible prend la place du « O » final
right = O["cx"] + O["tick_r1"]
# slogan sous le nom, sur toute la largeur du mot
tsize = 44; probe, xt = glyphs(semi, TAG, tsize, 0, 0)
track = (right - 0.5 - xt) / (tsize * (len(TAG) - 1))
tag, _ = glyphs(semi, TAG, tsize, 0.5, base + 62, track)
paths = [{"g": "P", **p} for p in letters[:3]] + [{"g": "R", **letters[3]}] + [{"g": "tagline", **p} for p in tag]
W = round(right + 0.5, 1); Hh = round(max(p["box"][3] for p in paths) + 0.5, 1)
data = {"w": W, "h": Hh, "grey": "#4A4A4A", "cyan": "#00B8F8", "tag": "#00B8F8", "O": O, "paths": paths}
os.makedirs(os.path.join(ROOT, "assets", "maquette"), exist_ok=True)
with open(os.path.join(ROOT, "assets", "maquette", "logo-paths.js"), "w") as fh:
    fh.write("// Logo fictif des maquettes (« CIBLO »), généré par tools/maquette_logo.py — même format que assets/prointer/logo-paths.js\n")
    fh.write("window.LOGO_DATA = " + json.dumps(data, separators=(",", ":")) + ";\n")
print("logo", W, "×", Hh, "— cible en", O["cx"], O["cy"])
