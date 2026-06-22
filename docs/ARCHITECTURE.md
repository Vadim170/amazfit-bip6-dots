# Architecture

## Layout of the repo

```
app.json                     # Zepp OS manifest (target = Amazfit Bip 6)
app.js                       # empty App() shell
watchface/bip-6/
  index.js                   # the watch face (WatchFace lifecycle, widgets)
  layout.js                  # ALL screen geometry (single source of truth)
  assets.gen.js              # GENERATED: image paths + sizes
  weather-codes.js           # Zepp condition index -> icon + rain flag
  history-store.js           # rolling 7-day store for RHR / stress
assets/bip-6/images/         # GENERATED dot-matrix PNGs
tools/
  font5x7.mjs                # the 5x7 dot-matrix font (A–Z, 0–9, symbols)
  icons.mjs                  # dotted pictograms (weather, heart, foot, drop, delta)
  gen-assets.mjs             # renders PNGs + writes assets.gen.js
  render-png.mjs             # composites flat preview PNGs (README screenshots)
  gen-preview.mjs            # builds the interactive local HTML preview
preview/                     # generated previews (PNG committed, HTML ignored)
```

## The single-source-of-truth chain

Everything visual is derived, never duplicated by hand:

```
font5x7.mjs + icons.mjs
        │  (gen-assets.mjs renders dots as anti-aliased circles)
        ▼
assets/bip-6/images/*.png  +  watchface/bip-6/assets.gen.js   (paths + sizes)
        │
        ▼
watchface/bip-6/layout.js   (computes every x/y from those sizes; integers only)
        │
        ├──────────────► watchface/bip-6/index.js   (device: hmUI widgets)
        └──────────────► tools/render-png.mjs & gen-preview.mjs   (preview)
```

Because `index.js` and the preview tools both import the same `layout.js` +
`assets.gen.js`, **the local preview is pixel-exact** with the device.

> Coordinates must be integers. A fractional `y` corrupts the preview
> compositor's buffer indexing, so `layout.js` rounds every value.

## Rendering on the device

- **Time** — one OS-driven `IMG_TIME` widget fed the white dot-matrix digit
  array, plus a red colon `IMG`. The OS redraws it; the JS runtime never wakes
  per second. Shown in both normal and AOD (`show_level = NORMAL | AOD`).
- **Date / words** — `IMG` widgets whose `src` is swapped on day change
  (`Time.onPerDay`). Weekday/month are pre-rendered words; the day number is a
  `TEXT_IMG` digit-image widget.
- **Metrics & graphs** — `TEXT_IMG` numbers and `FILL_RECT` bars, normal-mode
  only. Updated from sensor `onChange` callbacks, not polling.

## Dot-matrix font

`font5x7.mjs` holds each glyph as 7 rows × 5 columns of `#`/`.`. `gen-assets.mjs`
draws every `#` as an anti-aliased filled circle on a transparent canvas, so the
same font scales to any "pitch" (dot spacing): big for the clock, small for
metrics. Words and digits are emitted as individual PNGs for `IMG`/`TEXT_IMG`.

## Asset generation is reproducible

`npm run assets` deletes `assets/bip-6/images/` and regenerates everything plus
`assets.gen.js`. The generated PNGs and `assets.gen.js` are committed so
`zeus build` works on a fresh clone without running the generator first
(`prebuild` regenerates them anyway).
