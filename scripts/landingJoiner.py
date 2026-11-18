# The landing's "joiner" (Jamie, 2026-11-18): drawn over the bottom of the logo's skyline, it grounds the city in the
# Peninsula behind it: the skyline's own base blue at the top, fading down to black, ending in small threads that run
# the Peninsula's way (along its perspective lines, out from its vanishing point), with a soft band of the skyline's
# top yellow behind them. The same box as the logo's image (600 x 300, drawn twice the size), so it sits and zooms with it.
#   python -I scripts/landingJoiner.py public/zoom-scene/landing-joiner.png
import sys
import numpy as np
from PIL import Image, ImageDraw

out_path = sys.argv[1]
SCALE = 2                                   # drawn at twice the logo's px
W, H = 600 * SCALE, 300 * SCALE
BLUE = np.array([21, 38, 66])               # SVG_logo.svg's skyline gradient, its base
YELLOW = np.array([206, 143, 80])           # and its top
VANISH = (292, 170)                         # the Peninsula's vanishing point, in the logo's px (labWindowView.py LANDING)
EDGES = (32, 552)                           # the skyline's left and right, at its base (a little in: Jamie, round 6)
TOP, FADE_TO, BOTTOM = 192, 200, 205        # the joiner's top (over the buildings' bottoms), black by, its end
TAPER = 50                                  # (round 6) its ends thin by height, keeping their top over the buildings' bottoms
UNDER = (6, 0.6)                            # (round 6) the yellow under it: how far it fades out, how strong it starts
THREADS = {'every': 3.2, 'length': (5, 12), 'width': 1}
RAGGED = 2.2                                # the bottom edge's unevenness (logo px)
rng = np.random.default_rng(21)

ys, xs = np.mgrid[0:H, 0:W].astype(np.float32) / SCALE
# between the two lines out from the vanishing point through the skyline's ends (wider as it goes down)
def edge_x(edge, y):
    return VANISH[0] + (edge - VANISH[0]) * (y - VANISH[1]) / (197 - VANISH[1])
left, right = edge_x(EDGES[0], ys), edge_x(EDGES[1], ys)
from_end = np.minimum(xs - left, right - xs)
inside = np.clip(from_end / 2, 0, 1)
ends = np.clip(from_end / TAPER, 0, 1)
ends = ends * ends * (3 - 2 * ends)

# the band: blue at the top, black by FADE_TO, eased in over the buildings' bottoms; its bottom ragged, rising toward
# its ends (thinner there, its top kept, so it still covers the gaps under the end buildings)
t = np.clip((ys - TOP) / (FADE_TO - TOP), 0, 1)
color = BLUE[None, None, :] * (1 - t[..., None]) + np.array([4, 4, 8])[None, None, :] * t[..., None]
ragged = BOTTOM + RAGGED * (np.sin(xs / 3.7) * 0.6 + np.sin(xs / 1.9 + 1.1) * 0.4)  # (no straight edge)
bottom = TOP + 3 + (ragged - TOP - 3) * ends
alpha = np.clip((ys - TOP + 1) / 2, 0, 1) * np.clip((bottom + 1 - ys) / 2, 0, 1) * inside
# under it, a thin band of the buildings' top yellow fading out downward: against the black, it shows the streets below
under = UNDER[1] * np.clip(1 - (ys - bottom) / UNDER[0], 0, 1) * (ys > bottom - 0.5) * inside * np.sqrt(ends)
rgba = np.zeros((H, W, 4), np.float32)
rgba[..., :3] = color * alpha[..., None] + YELLOW * under[..., None] * (1 - alpha[..., None])
rgba[..., 3] = np.clip(alpha + under * (1 - alpha), 0, 1)
rgba[..., :3] /= np.maximum(rgba[..., 3:4], 1e-4)
img = Image.fromarray((np.clip(rgba, 0, [255, 255, 255, 1]) * [1, 1, 1, 255]).astype(np.uint8), 'RGBA')

# the threads: from the band's bottom, each down along its line from the vanishing point, a little jagged, thinning out
pen = ImageDraw.Draw(img)
for x0 in np.arange(EDGES[0] + 8, EDGES[1] - 8, THREADS['every']):
    x0 = edge_x(x0, BOTTOM) + rng.uniform(-1.2, 1.2)
    if min(x0 - edge_x(EDGES[0], BOTTOM), edge_x(EDGES[1], BOTTOM) - x0) < TAPER * 0.5:
        continue  # (none at the thinned ends)
    way = np.array([x0 - VANISH[0], BOTTOM - VANISH[1]], float)
    way /= np.linalg.norm(way)
    length = rng.uniform(*THREADS['length'])
    x, y = x0, BOTTOM - 2
    for k in range(int(length * 2)):
        nx, ny = x + way[0] * 0.5 + rng.uniform(-0.25, 0.25), y + way[1] * 0.5
        shade = int(255 * (1 - k / (length * 2)) ** 0.8)
        pen.line([(x * SCALE, y * SCALE), (nx * SCALE, ny * SCALE)], fill=(5, 5, 9, shade), width=THREADS['width'] * SCALE)
        x, y = nx, ny
img.save(out_path)
print('ok', img.size)
