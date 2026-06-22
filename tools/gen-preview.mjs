// Builds a self-contained local HTML preview from the SAME generated PNGs and
// the SAME layout.js the device uses — pixel-exact. Live clock, real date,
// sample sensor/weather data, AOD toggle. No simulator / Zepp login needed.
// Run: node tools/gen-preview.mjs  ->  preview/watchface-preview.html

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as A from '../watchface/bip-6/assets.gen.js'
import * as L from '../watchface/bip-6/layout.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const IMG_ROOT = join(ROOT, 'assets', 'bip-6')
const OUT = join(ROOT, 'preview', 'watchface-preview.html')

const uris = {}
;(function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) walk(p)
    else if (e.name.endsWith('.png')) uris[relative(IMG_ROOT, p).split('\\').join('/')] = 'data:image/png;base64,' + readFileSync(p).toString('base64')
  }
})(IMG_ROOT)

const SAMPLE = { steps: 8421, hr: 72, tempHigh: 24, weatherIcon: 'rain', rain: true, rhr: [58, 56, 59, 55, 54, 57, 53], hrv: [40, 52, 38, 60, 45, 50, 42] }
const Lp = {
  DEVICE: L.DEVICE, TIME: L.TIME, WEATHER: L.WEATHER, DATE: L.DATE, METRICS: L.METRICS, GRAPHS: L.GRAPHS,
}

const html = `<!doctype html>
<meta charset="utf-8">
<title>Bip 6 · Dots — local preview</title>
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; gap: 22px;
         background: #0c0c0c; font: 13px/1.5 ui-monospace, Menlo, monospace; color: #888; padding: 28px; }
  .stage { position: relative; width: ${L.DEVICE.w}px; height: ${L.DEVICE.h}px; border-radius: 86px;
           overflow: hidden; background: #000; box-shadow: 0 0 0 10px #1b1b1b, 0 24px 60px rgba(0,0,0,.6); }
  .stage img { position: absolute; }
  .stage .bar { position: absolute; border-radius: 1px; }
  .controls { display: flex; gap: 10px; align-items: center; }
  button { font: inherit; color: #eee; background: #262626; border: 1px solid #3a3a3a; padding: 8px 14px; border-radius: 8px; cursor: pointer; }
  button:hover { background: #303030; }
  .tag { padding: 2px 8px; border: 1px solid #333; border-radius: 999px; }
</style>
<div class="controls">
  <button id="toggle">Toggle AOD</button>
  <span class="tag" id="mode">NORMAL</span>
  <span>live clock · sample metrics / weather</span>
</div>
<div class="stage" id="stage"></div>
<div>Amazfit Bip 6 · 390×450 · Nothing-style dot-matrix</div>
<script>
const A = ${JSON.stringify(A)}, L = ${JSON.stringify(Lp)}, uris = ${JSON.stringify(uris)}, SAMPLE = ${JSON.stringify(SAMPLE)};
const stage = document.getElementById('stage');
function place(src, x, y) { const i = document.createElement('img'); i.src = uris[src]; i.style.left = x + 'px'; i.style.top = y + 'px'; stage.appendChild(i); }
function bar(x, y, w, h, c) { const e = document.createElement('div'); e.className = 'bar'; Object.assign(e.style, { left: x+'px', top: y+'px', width: w+'px', height: h+'px', background: c }); stage.appendChild(e); }
function numLeft(str, font, x, y, dw, hs=2) { for (const ch of str) { place(font[+ch], x, y); x += dw+hs; } }
function num(str, font, cx, y, dw, hs=2) { const w = str.length*dw + (str.length-1)*hs; numLeft(str, font, Math.round(cx-w/2), y, dw, hs); }
function graph(g, spec, vals) {
  bar(spec.startX, g.baseY, g.w, 2, '#6a6a6a');
  const lo = Math.min(...vals)-4, span = Math.max(1, Math.max(...vals)+4-lo);
  vals.forEach((v,i)=>{ const h = Math.max(3, Math.round(g.maxH*(v-lo)/span)); bar(spec.startX+i*(g.barW+g.gap), g.baseY-h, g.barW, h, i===vals.length-1 ? '#d71921' : '#f0f0f0'); });
}
let aod = false;
function render() {
  stage.innerHTML = ''; document.getElementById('mode').textContent = aod ? 'AOD' : 'NORMAL';
  const now = new Date();
  const hh = String(now.getHours()).padStart(2,'0'), mm = String(now.getMinutes()).padStart(2,'0');
  const t = L.TIME;
  place(A.TIME_DIGITS[+hh[0]], t.h1, t.y); place(A.TIME_DIGITS[+hh[1]], t.h2, t.y);
  place(A.COLON.src, t.colon, t.y);
  place(A.TIME_DIGITS[+mm[0]], t.m1, t.y); place(A.TIME_DIGITS[+mm[1]], t.m2, t.y);
  const d = L.DATE;
  place(A.WEEKDAY[(now.getDay()+6)%7], d.weekdayX, d.weekdayY);
  place(A.MONTH[now.getMonth()], d.monthX, d.monthY);
  num(String(now.getDate()), A.NUMSM_WHITE, d.ddCx, d.ddY, A.NUMSM.w);
  if (aod) return;
  const w = L.WEATHER;
  place(A.WX[SAMPLE.weatherIcon], w.iconX, w.iconY);
  num(String(SAMPLE.tempHigh), A.NUMSM_WHITE, w.tempCx, w.tempY, A.NUMSM.w);
  const m = L.METRICS;
  num(String(SAMPLE.steps), A.NUMSM_WHITE, m.steps.centerX, m.numY, A.NUMSM.w);
  place(A.ICON_SRC.heart, m.hr.iconX, m.iconY);
  numLeft(String(SAMPLE.hr), A.NUMSM_RED, m.hr.numX, m.numY, A.NUMSM.w);
  const g = L.GRAPHS;
  place(A.ICON_SRC.heartSm, g.rhr.iconX, g.iconY); graph(g, g.rhr, SAMPLE.rhr);
  place(A.ICON_SRC.pulse, g.hrv.iconX, g.iconY); graph(g, g.hrv, SAMPLE.hrv);
}
document.getElementById('toggle').onclick = () => { aod = !aod; render(); };
render(); setInterval(render, 5000);
</script>
`
mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, html)
writeFileSync(join(ROOT, 'preview', 'artifact.html'), html.replace('<!doctype html>\n', '').replace('<meta charset="utf-8">\n', ''))
console.log('Local preview ->', relative(ROOT, OUT), '(' + Math.round(html.length / 1024) + ' KB)')
