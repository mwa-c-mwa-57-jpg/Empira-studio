"""Agrandissement ×4 (Real-ESRGAN x4plus, CPU) des illustrations du guide de jeux.

Usage : python3 tools/upscale.py entrée.png sortie.png [--model chemin.pth] [--tile 192]
Le réseau RRDBNet est recopié ici (architecture publiée par xinntao/Real-ESRGAN, licence BSD-3).
"""
import sys, time, numpy as np, torch, torch.nn as nn, torch.nn.functional as Fn
from PIL import Image

class RDB(nn.Module):
    def __init__(s, nf=64, gc=32):
        super().__init__()
        s.conv1 = nn.Conv2d(nf, gc, 3, 1, 1); s.conv2 = nn.Conv2d(nf + gc, gc, 3, 1, 1); s.conv3 = nn.Conv2d(nf + 2 * gc, gc, 3, 1, 1)
        s.conv4 = nn.Conv2d(nf + 3 * gc, gc, 3, 1, 1); s.conv5 = nn.Conv2d(nf + 4 * gc, nf, 3, 1, 1); s.lrelu = nn.LeakyReLU(0.2, True)
    def forward(s, x):
        x1 = s.lrelu(s.conv1(x)); x2 = s.lrelu(s.conv2(torch.cat((x, x1), 1))); x3 = s.lrelu(s.conv3(torch.cat((x, x1, x2), 1)))
        x4 = s.lrelu(s.conv4(torch.cat((x, x1, x2, x3), 1))); x5 = s.conv5(torch.cat((x, x1, x2, x3, x4), 1))
        return x5 * 0.2 + x

class RRDB(nn.Module):
    def __init__(s, nf, gc=32):
        super().__init__(); s.rdb1 = RDB(nf, gc); s.rdb2 = RDB(nf, gc); s.rdb3 = RDB(nf, gc)
    def forward(s, x): return s.rdb3(s.rdb2(s.rdb1(x))) * 0.2 + x

class RRDBNet(nn.Module):
    def __init__(s, nf=64, nb=23, gc=32):
        super().__init__()
        s.conv_first = nn.Conv2d(3, nf, 3, 1, 1); s.body = nn.Sequential(*[RRDB(nf, gc) for _ in range(nb)]); s.conv_body = nn.Conv2d(nf, nf, 3, 1, 1)
        s.conv_up1 = nn.Conv2d(nf, nf, 3, 1, 1); s.conv_up2 = nn.Conv2d(nf, nf, 3, 1, 1); s.conv_hr = nn.Conv2d(nf, nf, 3, 1, 1); s.conv_last = nn.Conv2d(nf, 3, 3, 1, 1)
        s.lrelu = nn.LeakyReLU(0.2, True)
    def forward(s, x):
        f = s.conv_first(x); f = f + s.conv_body(s.body(f))
        f = s.lrelu(s.conv_up1(Fn.interpolate(f, scale_factor=2, mode="nearest")))
        f = s.lrelu(s.conv_up2(Fn.interpolate(f, scale_factor=2, mode="nearest")))
        return s.conv_last(s.lrelu(s.conv_hr(f)))

def load(model_path):
    net = RRDBNet(); sd = torch.load(model_path, map_location="cpu", weights_only=True)
    net.load_state_dict(sd.get("params_ema", sd.get("params", sd)), strict=True); net.eval()
    return net

@torch.no_grad()
def upscale(net, img, tile=192, pad=12):
    a = torch.from_numpy(np.asarray(img.convert("RGB"), np.float32) / 255).permute(2, 0, 1)[None]
    _, _, h, w = a.shape; out = torch.zeros(1, 3, h * 4, w * 4)
    for y in range(0, h, tile):
        for x in range(0, w, tile):
            y0, x0, y1, x1 = max(0, y - pad), max(0, x - pad), min(h, y + tile + pad), min(w, x + tile + pad)
            o = net(a[:, :, y0:y1, x0:x1])
            ty, tx = (y - y0) * 4, (x - x0) * 4; th, tw = (min(h, y + tile) - y) * 4, (min(w, x + tile) - x) * 4
            out[:, :, y * 4:y * 4 + th, x * 4:x * 4 + tw] = o[:, :, ty:ty + th, tx:tx + tw]
    return Image.fromarray((out[0].clamp(0, 1).permute(1, 2, 0).numpy() * 255 + 0.5).astype(np.uint8))

if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    opt = dict(a[2:].split("=", 1) for a in sys.argv[1:] if a.startswith("--") and "=" in a)
    torch.set_num_threads(int(opt.get("threads", 4)))
    net = load(opt.get("model", "/tmp/claude-0/torch/RealESRGAN_x4plus.pth"))
    t = time.time(); im = Image.open(args[0]); upscale(net, im, int(opt.get("tile", 192))).save(args[1]); print(args[1], im.size, f"{time.time() - t:.1f}s")
