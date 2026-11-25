// drives Edge headless to each game state; for each, shoots every UI layer over black and over white (for alpha),
// and records the room box's place. node capture.mjs <outDir> <url> <steps.json>
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const [dir, url, stepsFile] = process.argv.slice(2);
const steps = JSON.parse(fs.readFileSync(stepsFile, 'utf8'));
const W = 1528, H = 732;
const edge = spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', ['--headless=new', '--remote-debugging-port=9335', `--window-size=${W},${H}`, `--user-data-dir=${dir}/edge-profile-cap2`, 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0; const pending = {};
const send = (method, params = {}) => new Promise(res => { const n = ++id; pending[n] = res; ws.send(JSON.stringify({ id: n, method, params })); });
const evaluate = async expression => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); return r.result && r.result.value; };
const LAYERS = ['monitor', 'side-monitor', 'console', 'dialogue', 'huds'];
const sel = name => name == 'monitor' ? '[data-play-screen]' : `[data-mock="${name}"]`;
const out = {};
fs.mkdirSync(`${dir}/base`, { recursive: true });
try {
  let target;
  for (let k = 0; k < 40 && !target; k++) { await sleep(250); try { const list = await (await fetch('http://127.0.0.1:9335/json')).json(); target = list.find(t => t.type == 'page'); } catch {} }
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending[m.id]) { pending[m.id](m.result || m); delete pending[m.id]; } };
  await send('Page.enable'); await send('Runtime.enable'); await send('Animation.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url });
  for (const step of steps) {
    if (step.wait) await sleep(step.wait);
    if (step.key) for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key: step.key, code: step.code || step.key, text: type == 'keyDown' && step.key.length == 1 ? step.key : undefined, windowsVirtualKeyCode: step.vk || (step.key.length == 1 ? step.key.toUpperCase().charCodeAt(0) : 0) });
    if (step.clickText) {
      const at = await evaluate(`(() => { const el = [...document.querySelectorAll('button, [role=button], div, span')].reverse().find(e => e.textContent.trim() == ${JSON.stringify(step.clickText)} && e.offsetParent); if (!el) return null; const b = el.getBoundingClientRect(); return [b.x + b.width/2, b.y + b.height/2]; })()`);
      console.log('click', step.clickText, at);
      if (at) for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x: at[0], y: at[1], button: 'left', clickCount: 1 });
    }
    if (step.eval) console.log('eval', JSON.stringify(await evaluate(step.eval)));
    if (step.shot) { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${dir}/base/${step.shot}.png`, Buffer.from(r.data, 'base64')); console.log('shot', step.shot); }
    if (step.state) {
      const name = step.state;
      await send('Animation.setPlaybackRate', { playbackRate: 0 }); // (CSS animations held still between the two shots)
      const info = await evaluate(`(() => { const r = e => { if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height }; };
        const room = document.querySelector('[data-room-box]');
        const present = ${JSON.stringify(LAYERS)}.filter(n => { const el = document.querySelector(n == 'monitor' ? '[data-play-screen]' : '[data-mock="' + n + '"]'); if (!el) return false; return [...el.querySelectorAll('*')].concat(n == 'monitor' ? [el] : []).some(c => { const b = c.getBoundingClientRect(); return b.width > 4 && b.height > 4 && getComputedStyle(c).visibility != 'hidden' && getComputedStyle(c).opacity != '0'; }); });
        return { room: r(room), casing: r(document.querySelector('[data-tv-casing]')), present }; })()`);
      out[name] = { viewport: { width: W, height: H }, ...info, layers: {} };
      for (const layer of info.present) {
        const hide = LAYERS.filter(n => n != layer).map(n => `${sel(n)}, ${sel(n)} *`).join(', ');
        for (const bg of ['black', 'white']) {
          await evaluate(`(() => { let s = document.getElementById('__mock_cap'); if (!s) { s = document.createElement('style'); s.id = '__mock_cap'; document.head.appendChild(s); }
            s.textContent = \`${hide} { visibility: hidden !important; } [data-room-box], [data-room-box] * { visibility: hidden !important; } html, body, #root, .App, .app-page { background: ${bg} !important; }\`;
            [...document.querySelectorAll('input[type=checkbox], select, input[type=range]')].forEach(e => { let p = e; while (p.parentElement && p.parentElement.getBoundingClientRect().width < 700 && p.parentElement.getBoundingClientRect().height < 300) p = p.parentElement; p.style.setProperty('visibility', 'hidden', 'important'); });
            const keep = el => el.closest('[data-play-screen], [data-mock]');
            [...document.querySelectorAll('body *')].forEach(el => { if (keep(el)) return; const b = el.getBoundingClientRect(); if (b.width >= innerWidth * 0.9 && b.height >= innerHeight * 0.9) { el.style.setProperty('background', '${bg}', 'important'); el.style.setProperty('box-shadow', 'none', 'important'); (window.__painted = window.__painted || []).push(el); } });
            return 1; })()`);
          await sleep(60);
          const r = await send('Page.captureScreenshot', { format: 'png' });
          fs.writeFileSync(`${dir}/base/${name}-${layer}-${bg}.png`, Buffer.from(r.data, 'base64'));
        }
        out[name].layers[layer] = true;
      }
      await evaluate(`(() => { const s = document.getElementById('__mock_cap'); if (s) s.remove(); (window.__painted || []).forEach(el => { el.style.removeProperty('background'); el.style.removeProperty('box-shadow'); }); window.__painted = []; [...document.querySelectorAll('input, select')].forEach(e => { let p = e; while (p.parentElement && p.parentElement.getBoundingClientRect().width < 700 && p.parentElement.getBoundingClientRect().height < 300) p = p.parentElement; p.style.removeProperty('visibility'); }); return 1; })()`);
      // and the whole thing as seen, room and all
      const r = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(`${dir}/base/${name}-full.png`, Buffer.from(r.data, 'base64'));
      await send('Animation.setPlaybackRate', { playbackRate: 1 });
      console.log('state', name, JSON.stringify(out[name]));
    }
  }
  fs.writeFileSync(`${dir}/base/states.json`, JSON.stringify(out, null, 1));
} finally { try { ws && ws.close(); } catch {} edge.kill(); }
process.exit(0);
