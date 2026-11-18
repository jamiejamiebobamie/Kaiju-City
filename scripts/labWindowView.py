# Makes the Lab's window views (Jamie, 2026-11-18):
#   (TRAFFIC_OUT=<json> writes the roads for the cars too)
#   the Lab fight and trap: TRAFFIC_OUT=src/Game/DataClasses/Levels/data/labWindowTraffic.json python -I scripts/labWindowView.py public/Map.gif public/levels/lab-window.png
#   the walking Lab: TRAFFIC_OUT=src/Game/DataClasses/Levels/data/labIntroWindowTraffic.json python -I scripts/labWindowView.py public/Map.gif public/levels/labIntro-window.png HZ=205 NEAR=34 F=260
# The Lab window's view: Map.gif laid flat and seen in perspective, from the Lab's spot looking north
import sys, numpy as np
from PIL import Image
src_path, out_path = sys.argv[1], sys.argv[2]
mp = np.asarray(Image.open(src_path).convert('RGB')).astype(np.float32)
MH, MW = mp.shape[:2]
W, H, S = 1408, 768, 2            # output (the Lab's own size: it is drawn over the whole scene), and supersampling
HZ = 210                          # the horizon's row (the window shows through from about row 182 to 340: lab.png; low enough the tip's city stands clear of its top beam)
CAM = {'x': 250, 'y': 860}        # where the view is from, in map pixels: just south of the Peninsula's base, its whole span ahead (Jamie, 2026-11-18)
NEAR = 13                         # map pixels from the camera at the bottom row
F = 200                           # how wide: screen px per map px at distance 1
# settings by hand: python -I scripts/labWindowView.py Map.gif out.png HZ=200 NEAR=34 F=300 (the walking Lab's window)
for arg in sys.argv[3:]:
    key, value = arg.split('=')
    if key in ('X', 'Y'):
        CAM[key.lower()] = int(value)
    else:
        globals()[key] = int(value)
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
img = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).resize((W, H), Image.LANCZOS).convert('RGBA')

# where a map point lands in the picture (None if behind the camera)
def project(mx, my):
    d = CAM['y'] - my
    if d <= NEAR * 0.95:
        return None
    return (W / 2 + (mx - CAM['x']) * F / d, HZ + K / d, d)

# the city at the Peninsula's tip (Jamie, 2026-11-18): the landing page's skyline (scripts/assets/landing-skyline.png,
# from SVG_logo.svg), standing on the tip, as wide as it, dimmed a little for the distance and the night
import os
SKYLINE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'assets', 'landing-skyline.png')
TIP = {'x': 205, 'y': 120, 'width': 230, 'tall': 2.4}  # map pixels: the tip's city, how wide it stands, and how much taller than the logo's
base = project(TIP['x'], TIP['y'])
if base and os.path.exists(SKYLINE):
    sky = Image.open(SKYLINE).convert('RGBA')
    width = max(4, int(TIP['width'] * F / base[2]))
    height = max(2, int(sky.height * width / sky.width * TIP['tall']))
    sky = sky.resize((width, height), Image.LANCZOS)
    arr = np.asarray(sky).astype(np.float32)
    arr[..., :3] *= 0.8
    sky = Image.fromarray(arr.astype(np.uint8), 'RGBA')
    img.alpha_composite(sky, (int(base[0] - width / 2), int(base[1] - height)))
img.convert('RGB').save(out_path)
print('ok', img.size)

# the roads, for the cars' lights (TrafficLights): the map's light highway lines, thinned to one pixel, split where they
# meet into runs, each run projected into the picture. Written beside the picture as JSON when a path is given.
traffic_path = os.environ.get('TRAFFIC_OUT')
if traffic_path:
    import cv2, json
    raw = np.asarray(Image.open(src_path).convert('RGB')).astype(int)
    r, g, b = raw[..., 0], raw[..., 1], raw[..., 2]
    road = ((r > 190) & (g > 150) & (b > 110) & (r > b + 25)).astype(np.uint8)
    road = cv2.morphologyEx(road, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    # the roads are lines: drop the city grid's specks and the crescent (small or round blobs)
    count, labels, stats, _ = cv2.connectedComponentsWithStats(road, 8)
    keep = np.zeros_like(road)
    for k in range(1, count):
        x, y, w_, h_, area = stats[k]
        if max(w_, h_) >= 40 and area < 0.25 * w_ * h_:
            keep[labels == k] = 1
    # each road's outline: up one side and back down the other, two lanes of traffic going opposite ways
    contours, _ = cv2.findContours(keep, cv2.RETR_LIST, cv2.CHAIN_APPROX_NONE)
    runs = [[(int(pt[0][0]), int(pt[0][1])) for pt in contour] for contour in contours if len(contour) >= 60]
    paths = []
    for run in runs:
        pts = []
        for x, y in run[::4]:
            q = project(x, y)
            if q and -20 <= q[0] <= W + 20 and HZ <= q[1] <= H:
                pts.append([round(float(q[0]), 1), round(float(q[1]), 1), round(float(q[2]), 1)])
            else:
                if len(pts) >= 4:
                    paths.append(pts)
                pts = []
        if len(pts) >= 4:
            paths.append(pts)
    json.dump({'paths': paths, 'near': NEAR, 'horizon': HZ}, open(traffic_path, 'w'))
    print('traffic runs', len(paths))
