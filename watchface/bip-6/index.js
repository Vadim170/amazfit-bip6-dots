import * as sensor from '@zos/sensor'
import * as A from './assets.gen.js'
import * as L from './layout.js'
import { lookup } from './weather-codes.js'
import { record } from './history-store.js'

const { Time, Step, HeartRate } = sensor
// optional sensors — may be absent on some firmware; used defensively below
const { Weather, Stress } = sensor

// ---- palette (0xRRGGBB) ----------------------------------------------------
const C_BLACK = 0x000000
const C_RED = 0xd71921
const C_WHITE = 0xf0f0f0
const C_MUTED = 0x6a6a6a

const NORMAL = hmUI.show_level.ONLY_NORMAL
const AOD = hmUI.show_level.ONAL_AOD // NB: SDK constant is intentionally misspelled
const BOTH = NORMAL | AOD

// ---- helpers ---------------------------------------------------------------
const safe = (fn, fb) => { try { return fn() } catch (e) { return fb } }
const img = (src, x, y, show_level) => hmUI.createWidget(hmUI.widget.IMG, { x, y, src, show_level })
const setMore = (w, opts) => { try { w.setProperty(hmUI.prop.MORE, opts) } catch (e) {} }

function numBox(fontArray, { cx, y, w, show_level }) {
  return hmUI.createWidget(hmUI.widget.TEXT_IMG, {
    x: Math.round(cx - w / 2), y, w, h: A.NUMSM.h,
    font_array: fontArray, h_space: 2,
    align_h: hmUI.align.CENTER_H, align_v: hmUI.align.TOP, show_level,
  })
}

WatchFace({
  build() {
    hmUI.createWidget(hmUI.widget.FILL_RECT, { x: 0, y: 0, w: L.DEVICE.w, h: L.DEVICE.h, color: C_BLACK, show_level: BOTH })
    this.buildTime()
    this.buildDate()
    this.buildWeather()
    this.buildMetrics()
    this.buildGraphs()
  },

  // ---- big HH:MM (OS-driven, white, shown in normal + AOD) --------------
  buildTime() {
    const t = L.TIME
    hmUI.createWidget(hmUI.widget.IMG_TIME, {
      hour_zero: 1,
      hour_startX: t.h1, hour_startY: t.y, hour_array: A.TIME_DIGITS, hour_space: t.h2 - t.h1 - t.digitW,
      minute_zero: 1,
      minute_startX: t.m1, minute_startY: t.y, minute_array: A.TIME_DIGITS, minute_space: t.m2 - t.m1 - t.digitW,
      show_level: BOTH,
    })
    img(A.COLON.src, t.colon, t.y, BOTH)
    // red accent tick — normal only
    hmUI.createWidget(hmUI.widget.FILL_RECT, { x: Math.round(L.DEVICE.w / 2 - 20), y: t.tickY, w: 40, h: 4, radius: 2, color: C_RED, show_level: NORMAL })
  },

  // ---- date row: WEEKDAY  DD  MONTH (white, normal + AOD) ---------------
  buildDate() {
    const d = L.DATE
    this.wd = img(A.WEEKDAY[0], d.weekdayX, d.weekdayY, BOTH)
    this.mo = img(A.MONTH[0], d.monthX, d.monthY, BOTH)
    this.dd = numBox(A.NUMSM_WHITE, { cx: d.ddCx, y: d.ddY, w: 70, show_level: BOTH })

    const time = new Time()
    this.time = time
    this.drawDate(time)
    safe(() => time.onPerDay(() => this.drawDate(time)))
  },

  drawDate(time) {
    const wd = (time.getDay() + 6) % 7 // 1=Mon..7=Sun -> 0=Mon..6=Sun
    setMore(this.wd, { src: A.WEEKDAY[wd] })
    setMore(this.mo, { src: A.MONTH[time.getMonth() - 1] })
    setMore(this.dd, { text: String(time.getDate()) })
  },

  // ---- weather strip (built-in system sensor, phone-synced) ------------
  buildWeather() {
    const w = L.WEATHER
    this.wxIcon = img(A.WX.cloudy, w.iconX, w.iconY, NORMAL)
    this.wxTemp = numBox(A.NUMSM_WHITE, { cx: w.tempCx, y: w.tempY, w: 80, show_level: NORMAL })
    this.wxDrop = img(A.ICON_SRC.drop, w.dropX, w.dropY, NORMAL) // rain indicator
    setMore(this.wxDrop, { alpha: 0 })

    const data = safe(() => Weather && new Weather().getForecastWeather(), null)
    const today = data && data.forecastData && data.forecastData.data && data.forecastData.data[0]
    if (today) {
      const cond = lookup(today.index)
      setMore(this.wxIcon, { src: A.WX[cond.icon] || A.WX.cloudy })
      setMore(this.wxTemp, { text: String(today.high) })
      setMore(this.wxDrop, { alpha: cond.rain ? 255 : 0 })
    }
  },

  // ---- metrics: [foot] steps (white) | [heart] hr (red) ----------------
  buildMetrics() {
    const m = L.METRICS
    img(A.ICON_SRC.foot, m.steps.iconX, m.iconY, NORMAL)
    this.steps = numBox(A.NUMSM_WHITE, { cx: m.steps.centerX + 18, y: m.numY, w: 130, show_level: NORMAL })
    const step = new Step()
    const showSteps = () => setMore(this.steps, { text: String(safe(() => step.getCurrent(), 0)) })
    showSteps()
    safe(() => step.onChange(showSteps))

    img(A.ICON_SRC.heart, m.hr.iconX, m.iconY, NORMAL)
    this.hr = numBox(A.NUMSM_RED, { cx: m.hr.centerX + 18, y: m.numY, w: 90, show_level: NORMAL })
    const heart = new HeartRate()
    this.heart = heart
    const showHr = () => setMore(this.hr, { text: String(safe(() => heart.getLast(), 0) || 0) })
    showHr()
    safe(() => heart.onLastChange(showHr))
  },

  // ---- two weekly mini bar graphs --------------------------------------
  buildGraphs() {
    const g = L.GRAPHS
    const dayIndex = Math.floor(safe(() => this.time.getTime(), 0) / 86400000)

    // RHR — heart icon + bars
    img(A.ICON_SRC.heartSm, g.rhr.iconX, g.iconY, NORMAL)
    const resting = safe(() => this.heart.getResting(), 0)
    this.drawGraph(g, g.rhr, record('rhr7', dayIndex, resting))

    // HRV proxy = Stress — delta icon + bars
    img(A.ICON_SRC.delta, g.hrv.iconX, g.iconY, NORMAL)
    const stress = safe(() => Stress && new Stress().getCurrent(), 0)
    this.drawGraph(g, g.hrv, record('hrv7', dayIndex, stress))
  },

  drawGraph(g, spec, data) {
    hmUI.createWidget(hmUI.widget.FILL_RECT, { x: spec.startX, y: g.baseY, w: g.w, h: 2, color: C_MUTED, show_level: NORMAL })
    if (!data.length) return
    const vals = data.map((e) => e.v)
    const lo = Math.min(...vals) - 4
    const span = Math.max(1, Math.max(...vals) + 4 - lo)
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

  onDestroy() {
    safe(() => this.heart && this.heart.offLastChange && this.heart.offLastChange())
  },
})
