// Generates every PNG asset from the 5x7 dot-matrix font + dotted pictograms,
// plus a `watchface/bip-6/assets.gen.js` constants module that is the single
// source of truth for sizes/paths used by index.js.
//
// Design: black screen, white dots, red accents (Nothing style + AMOLED economy).
// Run: node tools/gen-assets.mjs   (also runs automatically on `npm run build`)

import { PNG } from 'pngjs'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { GLYPHS } from './font5x7.mjs'
import { WX, HEART } from './icons.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const IMG_DIR = join(ROOT, 'assets', 'bip-6', 'images')
const GEN_JS = join(ROOT, 'watchface', 'bip-6', 'assets.gen.js')

// ---- palette ---------------------------------------------------------------
const WHITE = { r: 240, g: 240, b: 240 } // primary dots on the black screen
const RED = { r: 215, g: 25, b: 33 }     // #D71921 Nothing-style accent
const MUTED = { r: 120, g: 120, b: 120 } // secondary

// ---- low-level raster ------------------------------------------------------
const canvas = (w, h) => ({ w, h, data: new Uint8Array(w * h * 4) })

function dot(cv, cx, cy, r, color) {
  const x0 = Math.max(0, Math.floor(cx - r - 1)), x1 = Math.min(cv.w - 1, Math.ceil(cx + r + 1))
  const y0 = Math.max(0, Math.floor(cy - r - 1)), y1 = Math.min(cv.h - 1, Math.ceil(cy + r + 1))
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy)
    const cov = Math.max(0, Math.min(1, r + 0.5 - d))
    if (cov <= 0) continue
    const i = (y * cv.w + x) * 4
    const a = Math.round(cov * 255)
    if (a > cv.data[i + 3]) { cv.data[i] = color.r; cv.data[i + 1] = color.g; cv.data[i + 2] = color.b; cv.data[i + 3] = a }
  }
}

function save(cv, relPath) {
  const png = new PNG({ width: cv.w, height: cv.h })
  png.data = Buffer.from(cv.data)
  const abs = join(IMG_DIR, relPath)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, PNG.sync.write(png))
  return 'images/' + relPath.split('\\').join('/')
}

// ---- glyph / text rendering ------------------------------------------------
function textMatrix(str) {
  const rows = Array.from({ length: 7 }, () => '')
  ;[...str].forEach((ch, idx) => {
    const g = GLYPHS[ch] || GLYPHS[' ']
    for (let r = 0; r < 7; r++) rows[r] += (idx ? '.' : '') + g[r]
  })
  return rows
}

function drawMatrix(matrix, { pitch, color, canvasW, canvasH, rf = 0.4 }) {
  const cols = matrix[0].length, rows = matrix.length
  const radius = pitch * rf
  const natW = cols * pitch, natH = rows * pitch
  const w = canvasW || natW, h = canvasH || natH
  const cv = canvas(w, h)
  const ox = (w - natW) / 2, oy = (h - natH) / 2
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (matrix[r][c] === '#') dot(cv, ox + c * pitch + pitch / 2, oy + r * pitch + pitch / 2, radius, color)
  }
  return cv
}
const renderText = (str, opts) => drawMatrix(textMatrix(str), opts)
const renderGlyph = (ch, opts) => drawMatrix(GLYPHS[ch] || GLYPHS[' '], opts)

// crop a '#'/'.' matrix to its bounding box
function trim(rows) {
  let top = rows.length, bot = -1, left = rows[0].length, right = -1
  rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] === '#') { top = Math.min(top, y); bot = Math.max(bot, y); left = Math.min(left, x); right = Math.max(right, x) } })
  if (bot < 0) return rows
  const out = []
  for (let y = top; y <= bot; y++) out.push(rows[y].slice(left, right + 1))
  return out
}

// rounded spiral as SEPARATE grid dots (sparse — one dot every `gap` cells of
// travel, like the font's dots). Radius grows exponentially with the winding so
// it narrows quickly toward the centre. `turns` windings.
function spiralMatrix(size, turns, gap) {
  const g = Array.from({ length: size }, () => Array(size).fill('.'))
  const cx = (size - 1) / 2, cy = (size - 1) / 2
  const tMax = turns * 2 * Math.PI, maxR = (size - 1) / 2, k = 2.2
  let lx = null, ly = null
  for (let t = 0; t <= tMax; t += 0.005) {
    const r = maxR * (Math.exp(k * (t / tMax)) - 1) / (Math.exp(k) - 1)
    const x = cx + r * Math.cos(t), y = cy + r * Math.sin(t)
    if (lx === null || Math.hypot(x - lx, y - ly) >= gap) {
      const gx = Math.round(x), gy = Math.round(y)
      if (gx >= 0 && gy >= 0 && gx < size && gy < size) g[gy][gx] = '#'
      lx = x; ly = y
    }
  }
  return trim(g.map((row) => row.join('')))
}

// ---- geometry --------------------------------------------------------------
const PITCH_TIME = 16   // big HH:MM digits, edge to edge -> 80 x 112
const PITCH_NUMSM = 5   // date / temperature digits -> 25 x 35
const PITCH_NUMXS = 4   // small metric digits (steps/HR) -> 20 x 28
const PITCH_WORD = 6    // weekday word
const PITCH_ICON = 4    // pictograms (11x11 -> 44, 9x9 -> 36)

const TIME_W = 5 * PITCH_TIME, TIME_H = 7 * PITCH_TIME
const NUMSM_W = 5 * PITCH_NUMSM, NUMSM_H = 7 * PITCH_NUMSM
const NUMXS_W = 5 * PITCH_NUMXS, NUMXS_H = 7 * PITCH_NUMXS
const WORD_H = 7 * PITCH_WORD
const WORD_W = 3 * 5 * PITCH_WORD + 2 * PITCH_WORD // 3 glyphs + 2 inter-letter gaps
const COLON_W = 2 * PITCH_TIME

const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

// ---- generate --------------------------------------------------------------
rmSync(IMG_DIR, { recursive: true, force: true })
mkdirSync(IMG_DIR, { recursive: true })

const timeDigits = []
// smaller dot radius (rf) on big digits so bright white dots don't bloom into
// each other on the AMOLED at full brightness
for (let d = 0; d <= 9; d++) timeDigits.push(save(renderGlyph(String(d), { pitch: PITCH_TIME, color: WHITE, rf: 0.36 }), `time/w${d}.png`))

const numWhite = [], numRed = []
for (let d = 0; d <= 9; d++) {
  numWhite.push(save(renderGlyph(String(d), { pitch: PITCH_NUMSM, color: WHITE }), `num/w${d}.png`))
  numRed.push(save(renderGlyph(String(d), { pitch: PITCH_NUMSM, color: RED }), `num/r${d}.png`))
}

const numXsWhite = [], numXsRed = []
for (let d = 0; d <= 9; d++) {
  numXsWhite.push(save(renderGlyph(String(d), { pitch: PITCH_NUMXS, color: WHITE }), `numxs/w${d}.png`))
  numXsRed.push(save(renderGlyph(String(d), { pitch: PITCH_NUMXS, color: RED }), `numxs/r${d}.png`))
}

const DEG_PITCH = 4
const degree = save(renderGlyph('°', { pitch: DEG_PITCH, color: WHITE }), 'num/deg.png')
const DEG_W = 5 * DEG_PITCH, DEG_H = 7 * DEG_PITCH

// date-day digits at the SAME pitch as the weekday word, so the date row is one
// consistent font (no size jump between WEEKDAY and the day number)
const numWd = []
for (let d = 0; d <= 9; d++) numWd.push(save(renderGlyph(String(d), { pitch: PITCH_WORD, color: WHITE }), `numwd/w${d}.png`))
const NUMWD_W = 5 * PITCH_WORD, NUMWD_H = 7 * PITCH_WORD

const colon = save(renderGlyph(':', { pitch: PITCH_TIME, color: RED, canvasW: COLON_W, rf: 0.42 }), 'colon.png')

const weekday = WEEKDAYS.map((w, i) => save(renderText(w, { pitch: PITCH_WORD, color: WHITE, canvasW: WORD_W, canvasH: WORD_H }), `word/wd${i}.png`))
const month = MONTHS.map((m, i) => save(renderText(m, { pitch: PITCH_WORD, color: WHITE, canvasW: WORD_W, canvasH: WORD_H }), `word/mo${i}.png`))

// pictograms
const wx = {}
for (const [name, grid] of Object.entries(WX)) wx[name] = save(drawMatrix(grid, { pitch: PITCH_ICON, color: WHITE }), `wx/${name}.png`)
const WX_W = WX.clear[0].length * PITCH_ICON, WX_H = WX.clear.length * PITCH_ICON

const icon = {
  heart: save(drawMatrix(HEART, { pitch: PITCH_ICON, color: RED }), 'icon/heart.png'),
  heartSm: save(drawMatrix(HEART, { pitch: 3, color: RED }), 'icon/heart_sm.png'),
  spiral: save(drawMatrix(spiralMatrix(15, 2.2, 1.4), { pitch: 3, color: WHITE }), 'icon/spiral.png'),
}
const ICON9_W = 9 * PITCH_ICON // 9x9 grid icons -> 36

// app icon / preview thumbnail (black tile, white 10:08, red colon)
function preview() {
  const W = 192, H = 192
  const cv = canvas(W, H)
  for (let i = 0; i < W * H; i++) { cv.data[i * 4] = 0; cv.data[i * 4 + 1] = 0; cv.data[i * 4 + 2] = 0; cv.data[i * 4 + 3] = 255 }
  const blit = (src, dx, dy) => {
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
      const si = (y * src.w + x) * 4, a = src.data[si + 3] / 255
      if (a <= 0) continue
      const X = dx + x, Y = dy + y
      if (X < 0 || Y < 0 || X >= W || Y >= H) continue
      const di = (Y * W + X) * 4
      for (let k = 0; k < 3; k++) cv.data[di + k] = Math.round(src.data[si + k] * a + cv.data[di + k] * (1 - a))
      cv.data[di + 3] = 255
    }
  }
  const p = 7
  const seq = [['1', WHITE], ['0', WHITE], [':', RED], ['0', WHITE], ['8', WHITE]]
  const widths = seq.map(([c]) => (c === ':' ? 2 * p : 5 * p))
  const total = widths.reduce((a, b) => a + b, 0) + (seq.length - 1) * 6
  let x = Math.round((W - total) / 2)
  const y = Math.round((H - 7 * p) / 2)
  seq.forEach(([c, color], i) => { blit(renderGlyph(c, { pitch: p, color, canvasW: widths[i] }), x, y); x += widths[i] + 6 })
  return save(cv, 'preview.png') // -> images/preview.png (matches app.json icon)
}
const previewSrc = preview()

// ---- emit constants module -------------------------------------------------
const gen = `// AUTO-GENERATED by tools/gen-assets.mjs — do not edit by hand.
export const TIME_DIGIT = { w: ${TIME_W}, h: ${TIME_H} }
export const TIME_DIGITS = ${JSON.stringify(timeDigits)}
export const COLON = { w: ${COLON_W}, h: ${TIME_H}, src: '${colon}' }

export const NUMSM = { w: ${NUMSM_W}, h: ${NUMSM_H} }
export const NUMSM_WHITE = ${JSON.stringify(numWhite)}
export const NUMSM_RED = ${JSON.stringify(numRed)}
export const DEGREE = { src: '${degree}', w: ${DEG_W}, h: ${DEG_H} }

export const NUMXS = { w: ${NUMXS_W}, h: ${NUMXS_H} }
export const NUMXS_WHITE = ${JSON.stringify(numXsWhite)}
export const NUMXS_RED = ${JSON.stringify(numXsRed)}

export const WORD = { w: ${WORD_W}, h: ${WORD_H} }
export const WEEKDAY = ${JSON.stringify(weekday)}
export const MONTH = ${JSON.stringify(month)}

export const NUMWD = { w: ${NUMWD_W}, h: ${NUMWD_H} }
export const NUMWD_WHITE = ${JSON.stringify(numWd)}

export const WX_ICON = { w: ${WX_W}, h: ${WX_H} }
export const WX = ${JSON.stringify(wx, null, 2)}

export const ICON = { w9: ${ICON9_W} }
export const ICON_SRC = ${JSON.stringify(icon, null, 2)}
export const PREVIEW = '${previewSrc}'
`
mkdirSync(dirname(GEN_JS), { recursive: true })
writeFileSync(GEN_JS, gen)

console.log('Assets generated (black/white/red):')
console.log('  time digit', TIME_W + 'x' + TIME_H, '| num', NUMSM_W + 'x' + NUMSM_H, '| word', WORD_W + 'x' + WORD_H)
console.log('  wx icon', WX_W + 'x' + WX_H, '| 9x9 icon', ICON9_W)
