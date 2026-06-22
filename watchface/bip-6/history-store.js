// Rolling 7-day history for daily metrics that Zepp OS does NOT expose as a
// multi-day series to watch faces (resting HR, stress). We sample one value per
// day and persist it ourselves, so the mini graphs fill in as the watch is worn.
//
// (True HRV has no watch-face API at all — stress is Zepp's HRV-derived daily
// metric and is used here as the closest available proxy.)

import { localStorage } from '@zos/storage'

const MAX_DAYS = 7

function load(key) {
  try {
    const raw = localStorage.getItem(key)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr : []
  } catch (e) {
    return []
  }
}

function persist(key, arr) {
  try { localStorage.setItem(key, JSON.stringify(arr)) } catch (e) {}
}

// Upsert today's value (keyed by absolute UTC day index) and return the rolling
// window, oldest -> newest. Entries: { day, v }.
export function record(key, dayIndex, value) {
  let arr = load(key)
  if (value && value > 0) {
    const found = arr.find((d) => d.day === dayIndex)
    if (found) found.v = value
    else arr.push({ day: dayIndex, v: value })
    arr.sort((a, b) => a.day - b.day)
    if (arr.length > MAX_DAYS) arr = arr.slice(arr.length - MAX_DAYS)
    persist(key, arr)
  }
  return arr
}
