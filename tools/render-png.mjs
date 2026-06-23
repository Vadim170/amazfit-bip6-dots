// Composites the generated PNGs through layout.js into flat preview images
// (normal + AOD) — for visual checks and README screenshots.
// Run: node tools/render-png.mjs  ->  preview/render-normal.png, preview/render-aod.png

import { PNG } from 'pngjs'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as A from '../watchface/bip-6/assets.gen.js'
import * as L from '../watchface/bip-6/layout.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const IMG = join(ROOT, 'assets', 'bip-6')

const SAMPLE = {
  steps: 8421, hr: 72, tempHigh: 24, weatherIcon: 'rain', rain: true,
  rhr: [58, 56, 59, 55, 54, 57, 53], hrv: [40, 52, 38, 60, 45, 50, 42],
}

const cache = {}
const get = (rel) => (cache[rel] ||= (() => { const p = PNG.sync.read(readFileSync(join(IMG, rel))); return { w: p.width, h: p.height, data: p.data } })())

function makeCanvas() {
  const { w, h } = L.DEVICE
  const data = Buffer.alloc(w * h * 4) // black, transparent
  for (let i = 0; i < w * h; i++) data[i * 4 + 3] = 255
  const R = 86
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const cx = x < R ? R : x > w - R ? w - R : x
    const cy = y < R ? R : y > h - R ? h - R : y
    if ((x < R || x > w - R) && (y < R || y > h - R) && Math.hypot(x + 0.5 - cx, y + 0.5 - cy) > R) data[(y * w + x) * 4 + 3] = 0
  }
  return { w, h, data }
}

function blit(cv, rel, dx, dy) {
  const src = get(rel)
  dx = Math.round(dx); dy = Math.round(dy)
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
    const X = dx + x, Y = dy + y
    if (X < 0 || Y < 0 || X >= cv.w || Y >= cv.h) continue
    const si = (y * src.w + x) * 4, a = src.data[si + 3] / 255
    if (a <= 0) continue
    const di = (Y * cv.w + X) * 4
    for (let k = 0; k < 3; k++) cv.data[di + k] = Math.round(src.data[si + k] * a + cv.data[di + k] * (1 - a))
    cv.data[di + 3] = 255
  }
}
function rect(cv, x, y, w, h, color) {
  x = Math.round(x); y = Math.round(y)
  for (let Y = y; Y < y + h; Y++) for (let X = x; X < x + w; X++) {
    if (X < 0 || Y < 0 || X >= cv.w || Y >= cv.h) continue
    const di = (Y * cv.w + X) * 4
    cv.data[di] = color.r; cv.data[di + 1] = color.g; cv.data[di + 2] = color.b; cv.data[di + 3] = 255
  }
}
const RED = { r: 215, g: 25, b: 33 }, WHITE = { r: 240, g: 240, b: 240 }, MUTED = { r: 106, g: 106, b: 106 }

function placeNum(cv, str, fontArr, cx, y, digitW, hspace = 2) {
  const w = str.length * digitW + (str.length - 1) * hspace
  placeNumLeft(cv, str, fontArr, Math.round(cx - w / 2), y, digitW, hspace)
}
function placeNumLeft(cv, str, fontArr, x, y, digitW, hspace = 2) {
  for (const ch of str) { blit(cv, fontArr[+ch], x, y); x += digitW + hspace }
}

function drawGraph(cv, g, spec, vals) {
  rect(cv, spec.barsX, g.baseY, g.w, 2, MUTED)
  const lo = Math.min(...vals) - 4, span = Math.max(1, Math.max(...vals) + 4 - lo)
  vals.forEach((v, i) => {
    const h = Math.max(3, Math.round((g.maxH * (v - lo)) / span))
    rect(cv, spec.barsX + i * (g.barW + g.gap), g.baseY - h, g.barW, h, i === vals.length - 1 ? RED : WHITE)
  })
}

function render(aod) {
  const cv = makeCanvas()
  const hh = '10', mm = '08'
  const t = L.TIME
  blit(cv, A.TIME_DIGITS[+hh[0]], t.h1, t.y)
  blit(cv, A.TIME_DIGITS[+hh[1]], t.h2, t.y)
  blit(cv, A.COLON.src, t.colon, t.y)
  blit(cv, A.TIME_DIGITS[+mm[0]], t.m1, t.y)
  blit(cv, A.TIME_DIGITS[+mm[1]], t.m2, t.y)

  const d = L.DATE
  blit(cv, A.WEEKDAY[6], d.weekdayX, d.weekdayY) // SUN (sample)
  placeNum(cv, '22', A.NUMSM_WHITE, d.ddCx, d.ddY, A.NUMSM.w)
  if (aod) return cv

  const w = L.WEATHER
  blit(cv, A.WX[SAMPLE.weatherIcon], w.iconX, w.iconY)
  placeNum(cv, String(SAMPLE.tempHigh), A.NUMSM_WHITE, w.tempCx, w.tempY, A.NUMSM.w)
  blit(cv, A.DEGREE.src, w.degX, w.degY)

  const m = L.METRICS
  placeNum(cv, String(SAMPLE.steps), A.NUMXS_WHITE, m.steps.centerX, m.numY, A.NUMXS.w)
  blit(cv, A.ICON_SRC.heartSm, m.hr.iconX, m.hr.iconY)
  placeNumLeft(cv, String(SAMPLE.hr), A.NUMXS_RED, m.hr.numX, m.numY, A.NUMXS.w)

  const g = L.GRAPHS
  blit(cv, A.ICON_SRC.heartSm, g.rhr.iconX, g.rhr.iconY)
  drawGraph(cv, g, g.rhr, SAMPLE.rhr)
  blit(cv, A.ICON_SRC.pulse, g.hrv.iconX, g.hrv.iconY)
  drawGraph(cv, g, g.hrv, SAMPLE.hrv)
  return cv
}

function write(cv, name) {
  const png = new PNG({ width: cv.w, height: cv.h })
  png.data = Buffer.from(cv.data)
  const out = join(ROOT, 'preview', name)
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, PNG.sync.write(png))
  console.log('rendered', join('preview', name))
}
write(render(false), 'render-normal.png')
write(render(true), 'render-aod.png')
