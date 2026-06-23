// Single source of truth for screen geometry. Imported by index.js (device)
// and the preview tools. Black screen, white dots, red accents. Integer coords.

import * as A from './assets.gen.js'

export const DEVICE = { w: 390, h: 450 }
const R = (n) => Math.round(n)

// --- big HH:MM, edge to edge -------------------------------------------
const GAP = 2
const order = [A.TIME_DIGIT.w, A.TIME_DIGIT.w, A.COLON.w, A.TIME_DIGIT.w, A.TIME_DIGIT.w]
const timeTotal = order.reduce((a, b) => a + b, 0) + (order.length - 1) * GAP
const timeStartX = R((DEVICE.w - timeTotal) / 2)
const timeY = 128
const xs = []
{ let x = timeStartX; for (const w of order) { xs.push(x); x += w + GAP } }

export const TIME = {
  y: timeY, h: A.TIME_DIGIT.h,
  h1: xs[0], h2: xs[1], colon: xs[2], m1: xs[3], m2: xs[4],
  digitW: A.TIME_DIGIT.w, colonW: A.COLON.w,
}

// --- weather strip (top): icon  temp°  ---------------------------------
export const WEATHER = {
  iconX: 132, iconY: 22,
  tempCx: 210, tempY: 30,
  degX: 238, degY: 30,
}

// --- date row: WEEKDAY  DD  (no month, centred) ------------------------
const dateCenterY = 272
const DATE_GAP = 12
const ddBoxW = 2 * A.NUMSM.w
const dateTotal = A.WORD.w + DATE_GAP + ddBoxW
const dateStartX = R((DEVICE.w - dateTotal) / 2)
export const DATE = {
  weekdayX: dateStartX,
  weekdayY: R(dateCenterY - A.WORD.h / 2),
  ddCx: dateStartX + A.WORD.w + DATE_GAP + R(ddBoxW / 2),
  ddY: R(dateCenterY - A.NUMSM.h / 2),
}

// --- metrics row: steps (white) | [heart] hr (red) — small & low -------
export const METRICS = {
  numY: 330,
  numW: 90,
  steps: { centerX: 112 },
  hr: { iconX: 244, iconY: 327, numX: 276 },
}

// --- two weekly mini bar graphs: icon inline (left) + bars -------------
const BASE_Y = 430, MAXH = 30, BARW = 6, GAPB = 3, DAYS = 7
const GW = DAYS * BARW + (DAYS - 1) * GAPB // 60
export const GRAPHS = {
  baseY: BASE_Y, maxH: MAXH, barW: BARW, gap: GAPB, days: DAYS, w: GW,
  rhr: { iconX: 93, iconY: 402, barsX: 124 },
  hrv: { iconX: 200, iconY: 399, barsX: 237 },
}
