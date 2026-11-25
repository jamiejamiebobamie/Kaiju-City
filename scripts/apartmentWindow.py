# The window picture's inside (Jamie, 2026-11-25; layout phase 3): the landing zoom's lit window (public/zoom-scene/
# 2-window.png) shows the new apartment through its four panes, in place of the old room's drawing. The new room is put
# where the old drawing had the old room: the room picture at PLACE's scale, its top left at PLACE's spot (measured from
# the old drawing's lamp and figurine shelf). Past the room picture's own edges (the panes reach a little past its
# right and top, and well below its desk), its edges are carried on: the wall mirrored, and under the desk its front
# continued down, darkening.
# The zoom (ZoomThrough's window target) goes to just this spot, so the room picture takes over seamlessly.
# Run: python scripts/apartmentWindow.py  (reads the window from git's HEAD, so it can be run again)
import io, os, subprocess
import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..')
ROOM = os.path.join(ROOT, 'public', 'zoom-scene', '3-room.png')
OUT = os.path.join(ROOT, 'public', 'zoom-scene', '2-window.png')
PLACE = {'scale': 0.348, 'x': 449, 'y': 157}
# the glass: x0, y0, x1, y1 (the window picture's px)
PANES = [(462, 154, 666, 366), (725, 154, 936, 366), (462, 400, 666, 591), (725, 400, 936, 591)]
PAD = {'top': 40, 'right': 120, 'bottom': 700}  # room px carried on past the picture
INTERIOR = {'brightness': 1.12, 'edgeShade': 5, 'edgeDark': 0.45}


def extended_room(room):
    h, w = room.shape[:2]
    out = np.zeros((h + PAD['top'] + PAD['bottom'], w + PAD['right'], 3), np.float32)
    out[PAD['top']:PAD['top'] + h, :w] = room
    # above: the wall mirrored
    out[:PAD['top'], :w] = room[:PAD['top']][::-1]
    # right: the wall mirrored
    out[:, w:] = out[:, w - PAD['right']:w][:, ::-1]
    # under the desk: its front's last rows carried down, darkening to near black
    front = out[PAD['top'] + h - 24:PAD['top'] + h].mean(axis=0)
    # (smoothed across, so it reads as the dark under the desk, not streaks)
    import cv2
    front = cv2.GaussianBlur(front[None], (0, 0), 30)[0]
    for k in range(PAD['bottom']):
        fade = max(0.06, 0.8 - k / (PAD['bottom'] * 0.4))
        out[PAD['top'] + h + k] = front * fade
    return out


def main():
    window = np.asarray(Image.open(io.BytesIO(subprocess.check_output(['git', 'show', 'HEAD:public/zoom-scene/2-window.png'], cwd=ROOT))).convert('RGB')).astype(np.float32)
    room = np.asarray(Image.open(ROOM).convert('RGB')).astype(np.float32) * INTERIOR['brightness']
    big = extended_room(room)
    scale = PLACE['scale']
    size = (round(big.shape[1] * scale), round(big.shape[0] * scale))
    small = np.asarray(Image.fromarray(np.clip(big, 0, 255).astype(np.uint8)).resize(size, Image.LANCZOS)).astype(np.float32)
    left, top = round(PLACE['x']), round(PLACE['y'] - PAD['top'] * scale)
    result = window.copy()
    for x0, y0, x1, y1 in PANES:
        for y in range(y0, y1):
            for_y = y - top
            if not 0 <= for_y < small.shape[0]:
                continue
            row = small[for_y, x0 - left:x1 - left]
            # a soft shade just inside the frame, for depth
            dist_y = min(y - y0, y1 - 1 - y)
            xs = np.arange(x0, x1)
            dist = np.minimum(np.minimum(xs - x0, x1 - 1 - xs), dist_y)
            shade = 1 - INTERIOR['edgeDark'] * np.clip(1 - dist / INTERIOR['edgeShade'], 0, 1)
            result[y, x0:x1] = row * shade[:, None]
    Image.fromarray(np.clip(result, 0, 255).astype(np.uint8)).save(OUT)
    print('written', OUT, 'room at', left, top, 'size', size)


if __name__ == '__main__':
    main()
