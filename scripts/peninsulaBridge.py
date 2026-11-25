# The Peninsula's east bridge, carried on past the map picture's right edge (Jamie, playtest 40: the zoomed-out shots,
# walking, battle, speech bubble and pre-battle, showed it stopping in the sea). A run of the bridge just inside the
# edge (one period: 54 px across, 30 up, its slope) is repeated on out along it, onto a clear picture the game puts
# beside Map.gif (levels.ts, the Peninsula's layers): public/levels/peninsula-bridge-east.png.
# Run: python scripts/peninsulaBridge.py
import os
import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..')
MAP = os.path.join(ROOT, 'public', 'Map.gif')
OUT = os.path.join(ROOT, 'public', 'levels', 'peninsula-bridge-east.png')
PERIOD = (54, -30)  # one repeat: px across, px up (the bridge's slope, -5/9, measured)
CENTER = (400, 179.5)  # a point on the bridge's middle line (Map.gif px)
HALF_WIDTH = 8  # px either side of its middle line: the deck and its edges
COPIES = 32
EDGE_X = 500  # the map picture's right edge
DIM = 0.5  # as the picture is there under landDimmer.png (black at alpha 127 over the sea), so it carries on unchanged


def main():
    image = Image.open(MAP)
    image.seek(0)
    index = np.asarray(image)
    rgba = np.asarray(image.convert('RGBA')).copy()
    rgba[..., 3] = np.where(index == image.info.get('transparency', 0), 0, 255)
    slope = PERIOD[1] / PERIOD[0]
    center = lambda x: CENTER[1] + slope * (x - CENTER[0])
    top_y = int(np.floor(center(EDGE_X + PERIOD[0] * COPIES) - HALF_WIDTH - 2))
    bottom_y = int(np.ceil(center(EDGE_X) + HALF_WIDTH + 2))
    width = PERIOD[0] * COPIES
    out = np.zeros((bottom_y - top_y, width, 4), np.uint8)
    # the source: the last period inside the edge, the band round its middle line
    for x in range(EDGE_X - PERIOD[0], EDGE_X):
        for y in range(int(center(x) - HALF_WIDTH), int(center(x) + HALF_WIDTH) + 1):
            pixel = rgba[y, x]
            if pixel[3] == 0:
                continue
            for k in range(1, COPIES + 1):
                tx, ty = x + PERIOD[0] * k - EDGE_X, y + PERIOD[1] * k - top_y
                if 0 <= tx < width and 0 <= ty < out.shape[0]:
                    out[ty, tx] = (int(pixel[0] * DIM), int(pixel[1] * DIM), int(pixel[2] * DIM), 255)
    Image.fromarray(out).save(OUT)
    print('written', OUT, 'at', EDGE_X, top_y, 'size', width, out.shape[0])


if __name__ == '__main__':
    main()
