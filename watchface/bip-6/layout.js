// Single source of truth for screen geometry. Imported by both index.js (device)
// and the preview/render tools, so the preview is pixel-exact.
// Black screen, white dots, red accents. All coordinates are integers.

import * as A from './assets.gen.js'

export const DEVICE = { w: 390, h: 450 }
const R = (n) => Math.round(n)

// --- big HH:MM block, horizontally centred -------------------------------
const GAP = 6
const order = [A.TIME_DIGIT.w, A.TIME_DIGIT.w, A.COLON.w, A.TIME_DIGIT.w, A.TIME_DIGIT.w]
const timeTotal = order.reduce((a, b) => a + b, 0) + (order.length - 1) * GAP
const timeStartX = R((DEVICE.w - timeTotal) / 2)
const timeY = 148
const xs = []
{ let x = timeStartX; for (const w of order) { xs.push(x); x += w + GAP } }

export const TIME = {
  y: timeY, h: A.TIME_DIGIT.h,
  h1: xs[0], h2: xs[1], colon: xs[2], m1: xs[3], m2: xs[4],
  digitW: A.TIME_DIGIT.w, colonW: A.COLON.w,
}

// --- weather strip (top): icon + temp (centred pair) --------------------
export const WEATHER = {
  iconX: 143, iconY: 46,
  tempCx: 225, tempY: 53,
}

// --- date row: WEEKDAY  DD  MONTH (centred group) -----------------------
const dateCenterY = 283
const DATE_GAP = 14
const ddBoxW = 2 * A.NUMSM.w + 2
const dateTotal = A.WORD.w + DATE_GAP + ddBoxW + DATE_GAP + A.WORD.w
const dateStartX = R((DEVICE.w - dateTotal) / 2)
export const DATE = {
  weekdayX: dateStartX,
  weekdayY: R(dateCenterY - A.WORD.h / 2),
  ddCx: R(dateStartX + A.WORD.w + DATE_GAP + ddBoxW / 2),
  ddY: R(dateCenterY - A.NUMSM.h / 2),
  monthX: dateStartX + A.WORD.w + DATE_GAP + ddBoxW + DATE_GAP,
  monthY: R(dateCenterY - A.WORD.h / 2),
}

// --- metrics row: steps (plain number) | [heart] hr ---------------------
export const METRICS = {
  numY: 322,
  iconY: 323,
  numW: 110,
  steps: { centerX: 108 },           // white number, no icon
  hr: { iconX: 232, numX: 276 },     // heart icon + red number
}

// --- two weekly mini bar graphs: RHR (left) + HRV/stress (right) ---------
const BASE_Y = 436, MAXH = 32, BARW = 8, GAPB = 6, DAYS = 7
const GW = DAYS * BARW + (DAYS - 1) * GAPB // 92
export const GRAPHS = {
  baseY: BASE_Y, maxH: MAXH, barW: BARW, gap: GAPB, days: DAYS, w: GW, iconY: 378,
  rhr: { startX: 96, iconX: 96 },
  hrv: { startX: 96 + GW + 18, iconX: 96 + GW + 18 },
}
