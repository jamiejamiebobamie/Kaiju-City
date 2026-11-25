// Writes src/assetManifest.json: the images in public/, split into what the landing, the zoom into the room and the
// pre-game screens need ('landing', loaded before the landing) and the rest ('game', loaded as the monitor boots).
// It runs itself before every dev server and build (npm's predev, prebuild: Jamie, 2026-11-18, every new asset in a
// loader), or by hand: npm run assets. Sounds are in it too, for when the game has them.
import fs from 'node:fs';
import path from 'node:path';
const root = 'public';
const isImage = file => /\.(png|jpe?g|gif|webp|svg|mp3|wav|ogg|m4a)$/i.test(file);
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
  const full = path.join(dir, entry.name);
  return entry.isDirectory() ? walk(full) : isImage(entry.name) && !entry.name.endsWith('~') ? [full] : [];
});
// (not the apartment mock-up tool's pictures: dev only, /apartment. Jamie, 2026-11-24)
const all = walk(root).map(file => '/' + path.relative(root, file).split(path.sep).join('/')).filter(url => !url.startsWith('/apartment-scene/'));
const isLanding = url => !url.includes('/', 1) // the root's own images
  || url.startsWith('/zoom-scene/') || url.startsWith('/GameUI_Pieces/') || url.startsWith('/levels/portraits/')
  || /^\/levels\/lab-(select|tank-empty)/.test(url) || /^\/spritesheet\/(player|teammate|disc_bubbles)/.test(url);
const landing = all.filter(isLanding);
const game = all.filter(url => !isLanding(url) && !url.includes('-check.'));
fs.writeFileSync('src/assetManifest.json', JSON.stringify({ landing, game }, null, 1));
console.log(`landing ${landing.length}, game ${game.length}`);
