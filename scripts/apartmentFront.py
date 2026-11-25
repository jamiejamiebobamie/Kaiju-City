# The room's front layer (Jamie, 2026-11-25; layout phase 3): the things in the mock-up's layout that are in front of
# the monitor (above it in the tool's list) and overlap it, cut out of the final room picture (their relit look) onto a
# clear picture: public/zoom-scene/3-room-front.png. The game draws it over its own monitor (RoomScene's RoomBackdrop),
# so the Kaiju Kola can stands in front of the casing as in the mock-up. Only those over the monitor: one elsewhere
# would be drawn over the side elements.
# Run: python scripts/apartmentFront.py
import json, os
import numpy as np, cv2
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..')
LAYOUT = os.path.join(ROOT, 'src', 'Game', 'ReactComponents', 'ApartmentMockup', 'mockup.json')
PARTS = os.path.join(ROOT, 'public', 'apartment-scene', 'parts.json')
ROOM = os.path.join(ROOT, 'public', 'zoom-scene', '3-room.png')
OUT = os.path.join(ROOT, 'public', 'zoom-scene', '3-room-front.png')
CASING_ASPECT = 1017.59 / 1034.72  # the captured casing's (width over height), stretched by the layout's screen shape


def main():
    layout = json.load(open(LAYOUT))
    parts = {p['id']: p for p in json.load(open(PARTS))}
    monitor = layout['monitor']
    width = monitor['height'] * (monitor.get('aspect') or CASING_ASPECT)
    box = (monitor['centerX'] - width / 2, monitor['bottom'] - monitor['height'], monitor['centerX'] + width / 2, monitor['bottom'])
    layers = layout['layers']
    above = layers[next(k for k, l in enumerate(layers) if l.get('type') == 'monitor') + 1:]
    room = np.asarray(Image.open(ROOM).convert('RGB'))
    mask = np.zeros(room.shape[:2], np.float32)
    kept = []
    for layer in above:
        part = parts.get(layer.get('part'))
        if not part or layer.get('hidden'):
            continue
        scale = layer.get('scale', 1)
        x0, y0 = layer['x'], layer['y']
        x1, y1 = x0 + part['width'] * scale, y0 + part['height'] * scale
        overlap = max(0, min(x1, box[2]) - max(x0, box[0])) * max(0, min(y1, box[3]) - max(y0, box[1]))
        if overlap < 0.15 * (x1 - x0) * (y1 - y0):
            continue  # (clear of the monitor, or only touching its edge)
        alpha = np.asarray(Image.open(os.path.join(ROOT, 'public', part['src'].lstrip('/'))).convert('RGBA'))[..., 3]
        if layer.get('flip'):
            alpha = alpha[:, ::-1]
        alpha = cv2.resize(alpha, (round(part['width'] * scale), round(part['height'] * scale)), interpolation=cv2.INTER_LINEAR)
        xa, ya = round(x0), round(y0)
        h, w = alpha.shape
        sub = mask[max(ya, 0):ya + h, max(xa, 0):xa + w]
        sub[:] = np.maximum(sub, alpha[max(-ya, 0):max(-ya, 0) + sub.shape[0], max(-xa, 0):max(-xa, 0) + sub.shape[1]] / 255)
        kept.append(layer['part'])
    Image.fromarray(np.dstack([room, (mask * 255).astype(np.uint8)])).save(OUT)
    print('front layer:', kept)


if __name__ == '__main__':
    main()
