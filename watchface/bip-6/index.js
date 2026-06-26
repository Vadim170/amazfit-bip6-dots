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
// Persisted to a real FILE in the app's /data dir (hmFS.open/write/read), per
// the official 1.0 LocalStorage pattern. NB1: hmFS.SysProSetChars is NOT
// durable. NB2: re-installing/updating the watch face during development WIPES
// /data, so history only survives if you flash ONCE and leave it for days.
// Uses Uint16Array (2 bytes/char) exactly like the docs example so stat().size
// (bytes) maps cleanly to the read length.
const HIST_FILE = 'dots_hr7.json'
function str2ab(s) {
  const buf = new ArrayBuffer(s.length * 2)
  const view = new Uint16Array(buf)
  for (let i = 0; i < s.length; i++) view[i] = s.charCodeAt(i)
  return buf
}
function loadSeries() {
  return safe(() => {
    const [st, err] = hmFS.stat(HIST_FILE)
    if (err !== 0 || !st || !st.size) return []
    const u16 = new Uint16Array(new ArrayBuffer(st.size))
    const fd = hmFS.open(HIST_FILE, hmFS.O_RDONLY | hmFS.O_CREAT)
    hmFS.seek(fd, 0, hmFS.SEEK_SET)
    hmFS.read(fd, u16.buffer, 0, st.size)
    hmFS.close(fd)
    const s = String.fromCharCode.apply(null, u16)
    const arr = s ? JSON.parse(s) : []
    return Array.isArray(arr) ? arr : []
  }, [])
}
function saveSeries(arr) {
  safe(() => {
    const buf = str2ab(JSON.stringify(arr))
    // O_CREAT so the very first write also creates the file; O_TRUNC overwrites.
    const fd = hmFS.open(HIST_FILE, hmFS.O_RDWR | hmFS.O_CREAT | hmFS.O_TRUNC)
    hmFS.seek(fd, 0, hmFS.SEEK_SET)
    hmFS.write(fd, buf, 0, buf.byteLength)
    hmFS.close(fd)
  })
}
// Merge one HR sample into today's entry and persist. Only writes flash when the
// stored min/max for today actually changes, so frequent CHANGE events are cheap.
function recordHR(dayIndex, hr) {
  let arr = loadSeries()
  if (hr && hr > 0) {
    let e = arr.find((d) => d.day === dayIndex)
    if (!e) { e = { day: dayIndex, min: hr, max: hr }; arr.push(e); arr.sort((a, b) => a.day - b.day) }
    else {
      const nmin = Math.min(e.min, hr), nmax = Math.max(e.max, hr)
      if (nmin === e.min && nmax === e.max) return arr   // nothing new -> no flash write
      e.min = nmin; e.max = nmax
    }
    if (arr.length > 7) arr = arr.slice(arr.length - 7)
    saveSeries(arr)
  }
  return arr
}

// One-time write+read-back of HIST_FILE so the device console confirms the
// /data file actually round-trips on this firmware (visible via Bridge/log).
function selfTest() {
  safe(() => {
    const probe = loadSeries()
    console.log('[dots] hr7 load: ' + JSON.stringify(probe))
    saveSeries(probe)
    const [st, err] = hmFS.stat(HIST_FILE)
    console.log('[dots] hr7 stat err=' + err + ' size=' + (st ? st.size : -1))
  })
}

WatchFace({
  build() {
    safe(() => selfTest())
    this.ts = safe(() => hmSensor.createSensor(hmSensor.id.TIME)) // shared time source
    // black background (both scenes)
    hmUI.createWidget(hmUI.widget.FILL_RECT, { x: 0, y: 0, w: L.DEVICE.w, h: L.DEVICE.h, color: C_BLACK, show_level: BOTH })
    safe(() => this.buildTime())
    safe(() => this.buildDate())
    safe(() => this.buildWeather())
    safe(() => this.buildMetrics())
    safe(() => this.buildGraphs())

    this.tick() // initial fill of time + date
    // One refresh path for time AND date so normal and AOD never diverge:
    // every minute, on day rollover, and when the persistent normal scene
    // regains focus (exit AOD / wrist raise).
    safe(() => this.ts.addEventListener(this.ts.event.MINUTEEND, () => this.tick()))
    safe(() => this.ts.addEventListener(this.ts.event.DAYCHANGE, () => this.tick()))
    safe(() => hmUI.createWidget(hmUI.widget.WIDGET_DELEGATE, { resume_call: () => this.tick() }))
  },

  // ---- big HH:MM via IMG_TIME (OS-driven) + red colon ------------------
  // IMG_TIME follows the watch's own 12/24h setting and updates itself (incl. in
  // AOD) without JS — set 24h in the watch settings to get 24h.
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
    this.wdImg = img(A.WEEKDAY[0], d.weekdayX, d.weekdayY, BOTH)
    this.dd = pool(2, d.ddY, BOTH, A.NUMWD_WHITE[0])
  },

  // refresh the DATE from the shared sensor — one path for both scenes, so the
  // persistent normal screen can't go stale while AOD looks correct. (Time is
  // IMG_TIME / OS-driven, so it isn't touched here.)
  tick() {
    const ts = this.ts
    if (!ts) return
    const wd = (safe(() => ts.week, 1) + 6) % 7 // legacy week 1=Mon..7=Sun -> 0=Mon..6=Sun
    if (this.wdImg) setp(this.wdImg, { src: A.WEEKDAY[wd] })
    if (this.dd) showNum(this.dd, A.NUMWD_WHITE, A.NUMWD.w, safe(() => ts.day, 1), L.DATE.ddY, L.DATE.ddCx)
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
    const showHr = () => {
      const hr = safe(() => this.hs.last, 0) || safe(() => this.hs.current, 0) || 0
      showNum(hrP, A.NUMXS_RED, A.NUMXS.w, hr, m.numY, undefined, m.hr.numX)
      // Sample into the daily store on every live HR update (cheap: recordHR only
      // touches flash when today's min/max actually moves). This is the reliable
      // sampling path — at wake HR is often 0, so build()'s single read isn't enough.
      this.sampleHR(hr)
    }
    showHr()
    safe(() => this.hs.addEventListener(hmSensor.event.LAST, showHr))
    safe(() => this.hs.addEventListener(hmSensor.event.CURRENT, showHr))
  },

  // current UTC day index (TIME.utc is in ms — confirmed correct)
  dayIndex() { return Math.floor(safe(() => this.ts.utc, 0) / 86400000) }, // TIME.utc is ms

  // record one HR sample and refresh the graphs if the store changed
  sampleHR(hr) {
    if (!hr || hr <= 0) return
    const before = this.series
    const arr = recordHR(this.dayIndex(), hr)
    this.series = arr
    if (!before || arr !== before) safe(() => this.renderGraphs())
  },

  // ---- two weekly mini bar graphs (self-persisted daily HR) ------------
  // resting-HR proxy = daily min HR; variability proxy = daily HR range.
  // Bars use a fixed pool of FILL_RECT widgets (created hidden once) and are
  // repositioned via setProperty so the graphs can be re-rendered on every live
  // HR event without piling up new widgets.
  buildGraphs() {
    const g = L.GRAPHS
    img(A.ICON_SRC.heartSm, g.rhr.iconX, g.rhr.iconY, NORMAL)
    img(A.ICON_SRC.spiral, g.hrv.iconX, g.hrv.iconY, NORMAL)
    this.rhrBars = this.makeBars(g, g.rhr)
    this.hrvBars = this.makeBars(g, g.hrv)
    // seed from disk so prior days render immediately at boot
    this.series = loadSeries()
    // try to fold in any HR already available this wake (often 0 → no-op)
    this.sampleHR(safe(() => this.hs.last, 0) || safe(() => this.hs.current, 0) || 0)
    this.renderGraphs()
  },

  makeBars(g, spec) {
    hmUI.createWidget(hmUI.widget.FILL_RECT, { x: spec.barsX, y: g.baseY, w: g.w, h: 2, color: C_MUTED, show_level: NORMAL })
    const bars = []
    for (let i = 0; i < g.days; i++) {
      const w = hmUI.createWidget(hmUI.widget.FILL_RECT, { x: spec.barsX + i * (g.barW + g.gap), y: g.baseY - 3, w: g.barW, h: 3, radius: 1, color: C_WHITE, show_level: NORMAL })
      vis(w, false); bars.push({ w, x: spec.barsX + i * (g.barW + g.gap) })
    }
    return bars
  },

  renderGraphs() {
    const g = L.GRAPHS
    const arr = this.series || []
    this.drawGraph(g, this.rhrBars, arr.map((e) => e.min))
    this.drawGraph(g, this.hrvBars, arr.map((e) => Math.max(1, e.max - e.min)))
  },

  drawGraph(g, bars, vals) {
    if (!bars) return
    if (!vals || !vals.length) { bars.forEach((b) => vis(b.w, false)); return }
    const lo = Math.min.apply(null, vals) - 4
    const span = Math.max(1, Math.max.apply(null, vals) + 4 - lo)
    const newest = g.days - 1
    for (let s = 0; s < bars.length; s++) vis(bars[s].w, false)
    vals.forEach((v, i) => {
      const slot = newest - (vals.length - 1 - i)
      const b = bars[slot]
      if (!b) return
      const h = Math.max(3, Math.round((g.maxH * (v - lo)) / span))
      setp(b.w, { x: b.x, y: g.baseY - h, w: g.barW, h, color: i === vals.length - 1 ? C_RED : C_WHITE })
      vis(b.w, true)
    })
  },

  onInit() {},
  onDestroy() {},
})
