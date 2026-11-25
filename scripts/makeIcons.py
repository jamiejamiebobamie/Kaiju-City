# The site's icons from the tab icon tool's export (Jamie, 2026-11-25; as SpellCraft's ../QuickCast/scripts/make-icons.py).
# The export is already framed (the tool's circle, faded at its edge, in a 1024 px square), so it's only resized:
#   favicon.ico (16, 32, 48) and favicon-32.png: the tab;
#   apple-touch-icon.png (180, on black: iOS fills the clear parts with black anyway);
#   icon-192.png and icon-512.png, and site.webmanifest: the home screen / installed app.
# Then index.html needs the <link> tags (printed at the end). Needs Pillow. Run from the repo root:
#   python scripts/makeIcons.py [public/icon-source/kaiju-icon.png] [public]
import json, os, sys
from PIL import Image

source = sys.argv[1] if len(sys.argv) > 1 else 'public/icon-source/kaiju-icon.png'
public = sys.argv[2] if len(sys.argv) > 2 else 'public'
icon = Image.open(source).convert('RGBA')
if icon.size[0] != icon.size[1]:
    raise SystemExit(f'expected a square export, got {icon.size}')

icon.save(os.path.join(public, 'favicon.ico'), sizes=[(16, 16), (32, 32), (48, 48)])
icon.resize((32, 32), Image.LANCZOS).save(os.path.join(public, 'favicon-32.png'))
apple = Image.new('RGBA', (180, 180), (0, 0, 0, 255))
apple.alpha_composite(icon.resize((180, 180), Image.LANCZOS))
apple.convert('RGB').save(os.path.join(public, 'apple-touch-icon.png'))
for size in (192, 512):
    icon.resize((size, size), Image.LANCZOS).save(os.path.join(public, f'icon-{size}.png'))
manifest = {
    'name': 'Kaiju City',
    'short_name': 'Kaiju City',
    'icons': [
        {'src': '/icon-192.png', 'sizes': '192x192', 'type': 'image/png'},
        {'src': '/icon-512.png', 'sizes': '512x512', 'type': 'image/png'}
    ],
    'background_color': '#000000',
    'theme_color': '#000000',
    'display': 'browser'
}
with open(os.path.join(public, 'site.webmanifest'), 'w') as file:
    json.dump(manifest, file, indent=2)
print('made favicon.ico, favicon-32.png, apple-touch-icon.png, icon-192.png, icon-512.png, site.webmanifest')
print('''index.html's <head> needs:
    <link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48" />
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <link rel="manifest" href="/site.webmanifest" />''')
