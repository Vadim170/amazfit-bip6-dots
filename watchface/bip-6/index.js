import * as A from './assets.gen.js'
import * as L from './layout.js'
import { lookup } from './weather-codes.js'

// Legacy hmUI/hmSensor/hmFS API (apiVersion 1.0.x) — the combination that
// actually renders on this firmware. No @zos modules (they need apiVersion 2.0+
// and break module load when targeting 1.0.x).

const C_BLACK = 0x000000
const C_RED = 0xd71921
const C_WHITE = 0xf0f0f0
const C_MUTED = 0x6a6a6a

const NORMAL = hmUI.show_level.ONLY_NORMAL
const AOD = hmUI.show_level.ONAL_AOD
const BOTH = NORMAL | AOD
const HS = 2

const safe = (fn, fb) => { try { return fn() } catch (e) { return fb } }
const img = (src, x, y, sl) => hmUI.createWidget(hmUI.widget.IMG, { x, y, src, show_level: sl })
const setp = (w, o) => { try { w.setProperty(hmUI.prop.MORE, o) } catch (e) {} }
const vis = (w, b) => { try { w.setProperty(hmUI.prop.VISIBLE, b) } catch (e) {} }

// pool of n digit-image IMG slots (created hidden); updated by src/x/visibility
function pool(n, y, sl, initSrc) {
  const s = []
  for (let i = 0; i < n; i++) { const w = img(initSrc, 0, y, sl); vis(w, false); s.push(w) }
  return s
}
function showNum(slots, font, dw, value, y, cx, x, minusSrc) {
  const str = String(value)
  const total = str.length * dw + (str.length - 1) * HS
  let px = x !== undefined ? x : Math.round(cx - total / 2)
  for (let i = 0; i < slots.length; i++) {
    const c = str[i]
    const src = c >= '0' && c <= '9' ? font[+c] : (c === '-' ? minusSrc : null)
    if (i < str.length && src) { setp(slots[i], { x: px, y, src }); vis(slots[i], true); px += dw + HS }
    else vis(slots[i], false)
  }
}

// --- self-persisted 7-day daily HR store --------------------------------
// Persisted to a real FILE (hmFS.open/write/read). NB: hmFS.SysProSetChars is
// NOT durable — the docs say it's cleared on reboot, so history vanished daily.
const HIST_FILE = 'dots_hr7.json'
function str2ab(s) { const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 0xff; return b }
function ab2str(u8) { let s = ''; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return s }
function loadSeries() {
  return safe(() => {
    const [st, err] = hmFS.stat(HIST_FILE)
    if (err !== 0 || !st || !st.size) return []
    const u8 = new Uint8Array(st.size)
    const fd = hmFS.open(HIST_FILE, hmFS.O_RDONLY)
    hmFS.seek(fd, 0, hmFS.SEEK_SET); hmFS.read(fd, u8.buffer, 0, st.size); hmFS.close(fd)
    const arr = JSON.parse(ab2str(u8))
    return Array.isArray(arr) ? arr : []
  }, [])
}
function saveSeries(arr) {
  safe(() => {
    const u8 = str2ab(JSON.stringify(arr))
    const fd = hmFS.open(HIST_FILE, hmFS.O_RDWR | hmFS.O_CREAT | hmFS.O_TRUNC)
    hmFS.seek(fd, 0, hmFS.SEEK_SET); hmFS.write(fd, u8.buffer, 0, u8.length); hmFS.close(fd)
  })
}
function recordHR(dayIndex, hr) {
  let arr = loadSeries()
  if (hr && hr > 0) {
    let e = arr.find((d) => d.day === dayIndex)
    if (!e) { e = { day: dayIndex, min: hr, max: hr }; arr.push(e) }
    else { e.min = Math.min(e.min, hr); e.max = Math.max(e.max, hr) }
    arr.sort((a, b) => a.day - b.day)
    if (arr.length > 7) arr = arr.slice(arr.length - 7)
    saveSeries(arr)
  }
  return arr
}

WatchFace({
  build() {
    // black background (both scenes)
    hmUI.createWidget(hmUI.widget.FILL_RECT, { x: 0, y: 0, w: L.DEVICE.w, h: L.DEVICE.h, color: C_BLACK, show_level: BOTH })
    safe(() => this.buildTime())
    safe(() => this.buildDate())
    safe(() => this.buildWeather())
    safe(() => this.buildMetrics())
    safe(() => this.buildGraphs())
  },

  // ---- big HH:MM via IMG_TIME (OS-driven, white) + red colon ------------
  buildTime() {
    const t = L.TIME
    hmUI.createWidget(hmUI.widget.IMG_TIME, {
      hour_zero: 1, hour_startX: t.h1, hour_startY: t.y, hour_array: A.TIME_DIGITS, hour_space: t.h2 - t.h1 - t.digitW,
      minute_zero: 1, minute_startX: t.m1, minute_startY: t.y, minute_array: A.TIME_DIGITS, minute_space: t.m2 - t.m1 - t.digitW,
      show_level: BOTH,
    })
    img(A.COLON.src, t.colon, t.y, BOTH)
  },

  // ---- date row: WEEKDAY  DD (white, normal + AOD) ---------------------
  buildDate() {
    const d = L.DATE
    const ts = safe(() => hmSensor.createSensor(hmSensor.id.TIME))
    const week = safe(() => ts.week, 1)      // legacy: 1=Mon..7=Sun (confirmed on device)
    const wd = (week + 6) % 7                 // -> 0=Mon..6=Sun
    const day = safe(() => ts.day, 1)
    img(A.WEEKDAY[wd], d.weekdayX, d.weekdayY, BOTH)
    const dd = pool(2, d.ddY, BOTH, A.NUMWD_WHITE[0])
    showNum(dd, A.NUMWD_WHITE, A.NUMWD.w, day, d.ddY, d.ddCx)
  },

  // ---- weather strip (built-in WEATHER sensor, phone-synced) -----------
  buildWeather() {
    const w = L.WEATHER
    const icon = img(A.WX.cloudy, w.iconX, w.iconY, NORMAL)
    const temp = pool(3, w.tempY, NORMAL, A.NUMSM_WHITE[0])
    const deg = img(A.DEGREE.src, w.degX, w.degY, NORMAL)
    vis(deg, false)
    const data = safe(() => hmSensor.createSensor(hmSensor.id.WEATHER).getForecastWeather(), null)
    const today = data && data.forecastData && data.forecastData.data && data.forecastData.data[0]
    if (today) {
      setp(icon, { src: A.WX[lookup(today.index).icon] || A.WX.cloudy })
      showNum(temp, A.NUMSM_WHITE, A.NUMSM.w, Math.round(today.high), w.tempY, w.tempCx, undefined, A.NUMSM_MINUS)
      vis(deg, true)
    }
  },

  // ---- metrics: steps (white) | [heart] hr (red) -----------------------
  buildMetrics() {
    const m = L.METRICS
    const stepsP = pool(6, m.numY, NORMAL, A.NUMXS_WHITE[0])
    const ss = safe(() => hmSensor.createSensor(hmSensor.id.STEP))
    const showSteps = () => showNum(stepsP, A.NUMXS_WHITE, A.NUMXS.w, safe(() => ss.current, 0) || 0, m.numY, m.steps.centerX)
    showSteps()
    safe(() => ss.addEventListener(hmSensor.event.CHANGE, showSteps))

    img(A.ICON_SRC.heartSm, m.hr.iconX, m.hr.iconY, NORMAL)
    const hrP = pool(3, m.numY, NORMAL, A.NUMXS_RED[0])
    this.hs = safe(() => hmSensor.createSensor(hmSensor.id.HEART))
    const showHr = () => showNum(hrP, A.NUMXS_RED, A.NUMXS.w, safe(() => this.hs.last, 0) || safe(() => this.hs.current, 0) || 0, m.numY, undefined, m.hr.numX)
    showHr()
    safe(() => this.hs.addEventListener(hmSensor.event.LAST, showHr))
    safe(() => this.hs.addEventListener(hmSensor.event.CURRENT, showHr))
  },

  // ---- two weekly mini bar graphs (self-persisted daily HR) ------------
  // resting-HR proxy = daily min HR; variability proxy = daily HR range.
  buildGraphs() {
    const g = L.GRAPHS
    const ts = safe(() => hmSensor.createSensor(hmSensor.id.TIME))
    const dayIndex = Math.floor(safe(() => ts.utc, 0) / 86400000)
    const hr = safe(() => this.hs.last, 0) || safe(() => this.hs.current, 0) || 0
    const arr = recordHR(dayIndex, hr)

    img(A.ICON_SRC.heartSm, g.rhr.iconX, g.rhr.iconY, NORMAL)
    this.drawGraph(g, g.rhr, arr.map((e) => e.min))

    img(A.ICON_SRC.spiral, g.hrv.iconX, g.hrv.iconY, NORMAL)
    this.drawGraph(g, g.hrv, arr.map((e) => Math.max(1, e.max - e.min)))
  },

  drawGraph(g, spec, vals) {
    hmUI.createWidget(hmUI.widget.FILL_RECT, { x: spec.barsX, y: g.baseY, w: g.w, h: 2, color: C_MUTED, show_level: NORMAL })
    if (!vals || !vals.length) return
    const lo = Math.min.apply(null, vals) - 4
    const span = Math.max(1, Math.max.apply(null, vals) + 4 - lo)
    const newest = g.days - 1
    vals.forEach((v, i) => {
      const slot = newest - (vals.length - 1 - i)
      const h = Math.max(3, Math.round((g.maxH * (v - lo)) / span))
      hmUI.createWidget(hmUI.widget.FILL_RECT, {
        x: spec.barsX + slot * (g.barW + g.gap), y: g.baseY - h, w: g.barW, h, radius: 1,
        color: i === vals.length - 1 ? C_RED : C_WHITE, show_level: NORMAL,
      })
    })
  },

  onInit() {},
  onDestroy() {},
})
