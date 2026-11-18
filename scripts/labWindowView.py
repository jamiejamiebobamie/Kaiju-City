# Makes public/levels/lab-window.png (Jamie, 2026-11-18): python -I scripts/labWindowView.py public/Map.gif public/levels/lab-window.png
# The Lab window's view: Map.gif laid flat and seen in perspective, from the Lab's spot looking north
import sys, numpy as np
from PIL import Image
src_path, out_path = sys.argv[1], sys.argv[2]
mp = np.asarray(Image.open(src_path).convert('RGB')).astype(np.float32)
MH, MW = mp.shape[:2]
W, H, S = 1408, 352, 2            # output, and supersampling
HZ = 112                          # the horizon's row
CAM = {'x': 210, 'y': 700}        # where the view is from, in map pixels (the Lab, a little east, to face up the peninsula)
NEAR = 46                         # map pixels from the camera at the bottom row
F = 520                           # how wide: screen px per map px at distance 1
K = NEAR * (H - HZ)
w, h, hz = W * S, H * S, HZ * S
ys, xs = np.mgrid[0:h, 0:w].astype(np.float32)
out = np.zeros((h, w, 3), np.float32)
# the sky: deep night, a little lighter at the horizon, with stars
t = np.clip(ys / hz, 0, 1)[..., None]
sky = (np.array([4, 6, 16]) * (1 - t) + np.array([26, 40, 72]) * t)
rng = np.random.default_rng(3)
stars = (rng.random((h, w)) < 0.0009) & (ys < hz * 0.9)
sky[stars] = [200, 210, 255]
ground = ys > hz
d = np.where(ground, K * S / np.maximum(ys - hz, 1), 0)       # distance, map px
mx = CAM['x'] + (xs - w / 2) / S * d / F
my = CAM['y'] - d
inside = ground & (mx >= 0) & (mx < MW) & (my >= 0) & (my < MH)
col = np.zeros((h, w, 3), np.float32)
col[inside] = mp[my[inside].astype(int), mx[inside].astype(int)]
# past the map: the night sea, dark with faint speckles (as the map's own)
sea = ground & ~inside
col[sea] = [3, 8, 16]
speck = sea & (rng.random((h, w)) < 0.05)
col[speck] = [8, 23, 42]
# haze toward the horizon, and the night over all of it
haze = (1 - np.exp(-d / 900))[..., None]
col = col * 0.66 * (1 - haze) + np.array([24, 36, 64]) * haze
out = np.where(ground[..., None], col, sky)
# a faint glow along the horizon
glow = np.exp(-((ys - hz) / (6 * S)) ** 2)[..., None]
out = out + glow * np.array([18, 26, 48])
img = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).resize((W, H), Image.LANCZOS)
img.save(out_path)
print('ok', img.size)
