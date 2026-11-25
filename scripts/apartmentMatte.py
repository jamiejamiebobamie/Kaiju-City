# The apartment mock-up tool's UI pictures (Jamie, 2026-11-24): after scripts/apartmentCapture.mjs has shot each game
# state's UI layers over black and over white (into <dir>/cap), this works out each layer's see-through (the two shots'
# difference), crops it, and writes public/apartment-scene/ui/<state>-<layer>.png and states.json.
# Capture first (the dev server running on 5180):
#   node scripts/apartmentCapture.mjs <dir> "http://localhost:5180/game?level=rapidTransit" scripts/apartmentCaptureSteps.json
# then: python scripts/apartmentMatte.py <dir>
import json, os, sys
import numpy as np
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'apartment-scene', 'ui')


def matte(black_path, white_path, out_path):
    b = np.asarray(Image.open(black_path).convert('RGB')).astype(np.float32)
    w = np.asarray(Image.open(white_path).convert('RGB')).astype(np.float32)
    # (the dev button, bottom left: masked out)
    b[1035:, :80] = 0
    w[1035:, :80] = 255
    alpha = np.clip(1 - (w - b).mean(axis=2) / 255, 0, 1)
    rgb = np.where(alpha[..., None] > 0.004, b / np.maximum(alpha[..., None], 0.004), 0)
    rgba = np.dstack([np.clip(rgb, 0, 255), alpha * 255]).astype(np.uint8)
    rgba[alpha < 0.02] = 0
    ys, xs = np.nonzero(alpha >= 0.02)
    if not len(xs):
        return None
    box = [int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1]
    Image.fromarray(rgba).crop(box).save(out_path, optimize=True)
    return box


def main(capture_dir):
    cap = os.path.join(capture_dir, 'cap')
    states = json.load(open(os.path.join(cap, 'states.json')))
    os.makedirs(OUT, exist_ok=True)
    out = {}
    for name, state in states.items():
        layers = {}
        for layer in state['layers']:
            box = matte(os.path.join(cap, f'{name}-{layer}-black.png'), os.path.join(cap, f'{name}-{layer}-white.png'), os.path.join(OUT, f'{name}-{layer}.png'))
            if box:
                layers[layer] = {'src': f'/apartment-scene/ui/{name}-{layer}.png', 'x': box[0], 'y': box[1], 'width': box[2] - box[0], 'height': box[3] - box[1]}
            print(name, layer, box)
        out[name] = {'viewport': state['viewport'], 'room': state['room'], 'casing': state['casing'], 'layers': layers}
    json.dump(out, open(os.path.join(OUT, 'states.json'), 'w'), indent=1)


if __name__ == '__main__':
    main(sys.argv[1])
