"""Agrandit ×4 les bandes utiles des pages du guide de jeux → assets/jeux-src/up/p<n>-y<y0>.png"""
import os, sys, torch
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from upscale import load, upscale
ROOT = os.path.join(os.path.dirname(__file__), "..")
BANDS = {1: (245, 922), 2: (216, 878), 3: (240, 811), 4: (240, 922), 5: (274, 1209), 6: (571, 1281)}   # page → (y0, y1) en pixels source
torch.set_num_threads(4)
net = load("/tmp/claude-0/torch/RealESRGAN_x4plus.pth")
for p, (y0, y1) in BANDS.items():
    out = os.path.join(ROOT, f"assets/jeux-src/up/p{p}-y{y0}.png")
    if os.path.exists(out): continue
    im = Image.open(os.path.join(ROOT, f"assets/jeux-src/pages/p-00{p}.png")).crop((0, y0, 1024, y1))
    upscale(net, im).save(out); print(out, flush=True)
