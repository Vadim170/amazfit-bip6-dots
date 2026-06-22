import * as sensor from '@zos/sensor'
import * as A from './assets.gen.js'
import * as L from './layout.js'
import { lookup } from './weather-codes.js'
import { record } from './history-store.js'

const { Time, Step, HeartRate } = sensor
const { Weather, Stress } = sensor // optional on some firmware

// ---- palette (0xRRGGBB) ----------------------------------------------------
const C_BLACK = 0x000000
const C_RED = 0xd71921
const C_WHITE = 0xf0f0f0
const C_MUTED = 0x6a6a6a

const NORMAL = hmUI.show_level.ONLY_NORMAL
const AOD = hmUI.show_level.ONAL_AOD // NB: SDK constant is intentionally misspelled
const BOTH = NORMAL | AOD
const HS = 2 // digit spacing

// ---- helpers (only IMG + FILL_RECT — both proven on-device) ---------------
const safe = (fn, fb) => { try { return fn() } catch (e) { return fb } }
const img = (src, x, y, sl) => hmUI.createWidget(hmUI.widget.IMG, { x, y, src, show_level: sl })
const setp = (w, o) => { try { w.setProperty(hmUI.prop.MORE, o) } catch (e) {} }
const vis = (w, b) => { try { w.setProperty(hmUI.prop.VISIBLE, b) } catch (e) {} }

// pool of n digit-image slots (created hidden); src/x updated on demand
function pool(n, y, sl) {
  const s = []
  for (let i = 0; i < n; i++) { const w = img(A.NUMSM_WHITE[0], 0, y, sl); vis(w, false); s.push(w) }
  return s
}
// render an integer through a digit pool, centred on cx or left-aligned at x
function showNum(slots, font, value, y, cx, x) {
  const str = String(value)
  const dw = A.NUMSM.w
  const total = str.length * dw + (str.length - 1) * HS
  let px = x !== undefined ? x : Math.round(cx - total / 2)
  for (let i = 0; i < slots.length; i++) {
    const c = str[i]
    if (i < str.length && c >= '0' && c <= '9') {
      setp(slots[i], { x: px, y, src: font[+c] }); vis(slots[i], true); px += dw + HS
    } else vis(slots[i], false)
  }
}

WatchFace({
  build() {
    safe(() => { this.time = new Time() })
    hmUI.createWidget(hmUI.widget.FILL_RECT, { x: 0, y: 0, w: L.DEVICE.w, h: L.DEVICE.h, color: C_BLACK, show_level: BOTH })
    safe(() => this.buildTime())
    safe(() => this.buildDate())
    safe(() => this.buildWeather())
    safe(() => this.buildMetrics())
    safe(() => this.buildGraphs())
    safe(() => this.time && this.time.onPerMinute(() => this.tick()))
  },

  // ---- big HH:MM as plain IMG digits (white) + red colon ----------------
  buildTime() {
    const t = L.TIME
    const h = safe(() => this.time.getHours(), 0), m = safe(() => this.time.getMinutes(), 0)
    this.td = [
      img(A.TIME_DIGITS[(h / 10) | 0], t.h1, t.y, BOTH),
      img(A.TIME_DIGITS[h % 10], t.h2, t.y, BOTH),
      img(A.TIME_DIGITS[(m / 10) | 0], t.m1, t.y, BOTH),
      img(A.TIME_DIGITS[m % 10], t.m2, t.y, BOTH),
    ]
    img(A.COLON.src, t.colon, t.y, BOTH)
  },

  // ---- date row: WEEKDAY  DD  MONTH (white, normal + AOD) ---------------
  buildDate() {
    const d = L.DATE
    this.ddY = d.ddY; this.ddCx = d.ddCx
    const wd = (safe(() => this.time.getDay(), 1) + 6) % 7
    const mo = (safe(() => this.time.getMonth(), 1) - 1) % 12
    this.wd = img(A.WEEKDAY[wd], d.weekdayX, d.weekdayY, BOTH)
    this.mo = img(A.MONTH[mo], d.monthX, d.monthY, BOTH)
    this.dd = pool(2, d.ddY, BOTH)
    showNum(this.dd, A.NUMSM_WHITE, safe(() => this.time.getDate(), 1), d.ddY, d.ddCx)
  },

  // refresh time + date each minute
  tick() {
    const t = this.time
    if (!t) return
    const h = safe(() => t.getHours(), 0), m = safe(() => t.getMinutes(), 0)
    if (this.td) {
      setp(this.td[0], { src: A.TIME_DIGITS[(h / 10) | 0] })
      setp(this.td[1], { src: A.TIME_DIGITS[h % 10] })
      setp(this.td[2], { src: A.TIME_DIGITS[(m / 10) | 0] })
      setp(this.td[3], { src: A.TIME_DIGITS[m % 10] })
    }
    if (this.wd) setp(this.wd, { src: A.WEEKDAY[(safe(() => t.getDay(), 1) + 6) % 7] })
    if (this.mo) setp(this.mo, { src: A.MONTH[(safe(() => t.getMonth(), 1) - 1) % 12] })
    if (this.dd) showNum(this.dd, A.NUMSM_WHITE, safe(() => t.getDate(), 1), this.ddY, this.ddCx)
  },

  // ---- weather strip (built-in system sensor, phone-synced) ------------
  buildWeather() {
    const w = L.WEATHER
    this.wxIcon = img(A.WX.cloudy, w.iconX, w.iconY, NORMAL)
    this.wxTemp = pool(3, w.tempY, NORMAL)
    const data = safe(() => Weather && new Weather().getForecastWeather(), null)
    const today = data && data.forecastData && data.forecastData.data && data.forecastData.data[0]
    if (today) {
      setp(this.wxIcon, { src: A.WX[lookup(today.index).icon] || A.WX.cloudy })
      showNum(this.wxTemp, A.NUMSM_WHITE, Math.round(today.high), w.tempY, w.tempCx)
    }
  },

  // ---- metrics: steps (plain number) | [heart] hr (red) ----------------
  buildMetrics() {
    const m = L.METRICS
    this.stepsP = pool(6, m.numY, NORMAL)
    const step = safe(() => new Step())
    const showSteps = () => showNum(this.stepsP, A.NUMSM_WHITE, safe(() => step.getCurrent(), 0) || 0, m.numY, m.steps.centerX)
    showSteps()
    safe(() => step.onChange(showSteps))

    img(A.ICON_SRC.heart, m.hr.iconX, m.iconY, NORMAL)
    this.hrP = pool(3, m.numY, NORMAL)
    const heart = safe(() => new HeartRate())
    this.heart = heart
    const showHr = () => showNum(this.hrP, A.NUMSM_RED, safe(() => heart.getLast(), 0) || 0, m.numY, undefined, m.hr.numX)
    showHr()
    safe(() => heart.onLastChange(showHr))
  },

  // ---- two weekly mini bar graphs --------------------------------------
  buildGraphs() {
    const g = L.GRAPHS
    const dayIndex = Math.floor(safe(() => this.time.getTime(), 0) / 86400000)

    img(A.ICON_SRC.heartSm, g.rhr.iconX, g.iconY, NORMAL)
    const resting = safe(() => this.heart.getResting(), 0)
    this.drawGraph(g, g.rhr, safe(() => record('rhr7', dayIndex, resting), []))

    img(A.ICON_SRC.pulse, g.hrv.iconX, g.iconY, NORMAL)
    const stress = safe(() => Stress && new Stress().getCurrent(), 0)
    this.drawGraph(g, g.hrv, safe(() => record('hrv7', dayIndex, stress), []))
  },

  drawGraph(g, spec, data) {
    hmUI.createWidget(hmUI.widget.FILL_RECT, { x: spec.startX, y: g.baseY, w: g.w, h: 2, color: C_MUTED, show_level: NORMAL })
    if (!data || !data.length) return
    const vals = data.map((e) => e.v)
    const lo = Math.min.apply(null, vals) - 4
    const span = Math.max(1, Math.max.apply(null, vals) + 4 - lo)
    const newest = g.days - 1
    data.forEach((e, i) => {
      const slot = newest - (data.length - 1 - i)
      const h = Math.max(3, Math.round((g.maxH * (e.v - lo)) / span))
      hmUI.createWidget(hmUI.widget.FILL_RECT, {
        x: spec.startX + slot * (g.barW + g.gap), y: g.baseY - h, w: g.barW, h, radius: 1,
        color: i === data.length - 1 ? C_RED : C_WHITE, show_level: NORMAL,
      })
    })
  },

  onInit() {},
  onDestroy() {
    safe(() => this.heart && this.heart.offLastChange && this.heart.offLastChange())
  },
})
