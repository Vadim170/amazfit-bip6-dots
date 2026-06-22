# Data sources, limitations & energy

The Bip 6 runs **Zepp OS 5.0 (API_LEVEL 4.2)**, so the modern `@zos/*` modules
are available. This face reads everything through `@zos/sensor`.

## What it reads

| Data | API | Notes |
|---|---|---|
| Time / date | `@zos/sensor` `Time` | `getHours/Minutes`, `getDate`, `getMonth` (1–12), `getDay` (1=Mon…7=Sun) |
| Steps | `@zos/sensor` `Step` | `getCurrent()`, `onChange()` |
| Heart rate | `@zos/sensor` `HeartRate` | `getLast()` for the shown value, `getResting()` (API ≥ 3.0) for the graph |
| Weather | `@zos/sensor` `Weather` | `getForecastWeather()` → today's `high` + condition `index` |
| Stress | `@zos/sensor` `Stress` | `getCurrent()` — used as the HRV proxy |

## The three honest limitations

### 1. HRV has no watch-face API

There is **no HRV sensor** in `@zos/sensor` and no `hmSensor` id for it. HRV is a
user-facing Zepp feature but is **not exposed to watch faces or mini-apps**. The
nearest available metric the watch computes *from* HRV is **Stress**, so the
second weekly graph (△ icon) plots stress. This is labelled as a proxy, not real
HRV. If a future firmware exposes HRV, only `history-store.js` + one sensor read
in `buildGraphs()` would change.

### 2. No multi-day history is exposed

A watch face can read **today's** intraday heart rate and the **current** resting
HR / stress — but **no 7-day series**. To draw weekly graphs we sample one value
per day and persist it ourselves in `@zos/storage` (`history-store.js`, keyed by
UTC day index, rolling 7 entries). So the graphs **fill in as the watch is worn**
across days; a fresh install shows just today's bar.

### 3. Weather is phone-synced; no custom provider

A Zepp OS **watch face has no network** — no `fetch`, and (unlike mini-apps) it
cannot host a phone-side service. Confirmed by Zepp maintainers
([discussion #343](https://github.com/orgs/zepp-health/discussions/343),
[#330](https://github.com/orgs/zepp-health/discussions/330)). The only outbound
channel for *mini-apps* is a Side Service `fetch`, which watch faces don't have.

Therefore a custom source such as **Yandex Weather is not possible from a watch
face**. We use the built-in `Weather` sensor, which the **Zepp phone app fetches
from its own provider and syncs over Bluetooth** — zero network code on the watch
and zero extra battery cost. The face cannot choose the provider or the refresh
rate; the phone decides.

> If custom Yandex data were a hard requirement it would need a *separate*
> companion mini-app doing the fetch in a Side Service and writing a file the
> face reads — but app storage is sandboxed per app, so this is fragile and
> dependent on that mini-app running. Not implemented here by design.

#### Weather condition codes

Zepp does not publish the official `index` → condition table for the watch-face
Weather sensor. `weather-codes.js` maps the commonly-observed Huami codes to an
icon + a rain flag, and is intentionally isolated so it is trivial to recalibrate
on a real device (just edit one entry's `icon`/`rain`).

## Energy efficiency

The face is built to sip battery:

- **Black everywhere.** On the Bip 6's AMOLED, black pixels are off. Only the
  white dots and the red accent draw power. AOD lights well under 10% of pixels.
- **No seconds, OS-driven time.** `IMG_TIME` is redrawn by the OS; the JS runtime
  does not wake every second (or even every minute) to paint the clock.
- **Event-driven, not polled.** Steps and HR update from `onChange`/`onLastChange`
  callbacks; the date updates on `onPerDay`. Nothing runs on a timer.
- **Static raster.** Every glyph/icon is a pre-rendered PNG composited by the OS —
  no per-frame vector drawing.
- **Heart-rate listeners released** in `onDestroy()`.
