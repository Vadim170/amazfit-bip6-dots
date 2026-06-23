# Architecture

A high-level map of how the project fits together. (For exact APIs, read the
source — this doc stays descriptive so it doesn't go stale.)

## Layout of the repo

```
app.js, app.json             # watch-face manifest + shell
watchface/bip-6/
  index.js                   # the watch face itself (draws & updates everything)
  layout.js                  # all screen geometry — the single source of truth
  assets.gen.js              # GENERATED: image paths + sizes
  weather-codes.js           # maps a weather condition code -> icon + rain flag
assets/bip-6/images/         # GENERATED dot-matrix PNGs
tools/
  font5x7.mjs                # the 5x7 dot-matrix font
  icons.mjs                  # dotted pictograms (weather, heart)
  gen-assets.mjs             # renders all PNGs + writes assets.gen.js
  render-png.mjs             # flat preview images (README screenshots)
  gen-preview.mjs            # interactive local HTML preview
preview/                     # generated previews
```

## The idea: one source of truth, everything derived

Nothing visual is hand-duplicated. The look flows in one direction:

```
font + icons  →  gen-assets  →  PNG images + assets.gen.js (paths & sizes)
                                          │
                                          ▼
                                   layout.js (every x/y, computed from sizes)
                                    │                     │
                              index.js (device)     preview tools
```

Because the watch face and the preview tools both read the **same** `layout.js`
and the **same** generated images, the local preview is pixel-exact with the
device. All coordinates are integers (a fractional value once corrupted the
preview compositor).

## How the dots are made

Every glyph and icon is a grid of dots, each dot drawn as a small anti-aliased
circle. The same font scales to any size by changing one number (the dot pitch):
large for the clock, smaller for the date, smallest for the metrics. Words,
digits and icons are emitted as individual PNGs that the watch composites.

## On the watch

- The clock is **OS-driven**, so it updates (including in Always-On Display)
  without waking the app.
- The date, weather, steps and heart rate are read from the watch's sensors and
  drawn as dot images.
- The two weekly graphs are drawn from a small rolling history the face keeps
  itself (see [`DATA-AND-LIMITATIONS.md`](DATA-AND-LIMITATIONS.md)).

## Regenerating

`npm run assets` re-renders every image and `assets.gen.js` from the font and
icons; it runs automatically before a build. The generated files are committed
so a fresh clone builds without extra steps. Change the look by editing the font
(`tools/font5x7.mjs`), the icons (`tools/icons.mjs`), or the palette/geometry in
`tools/gen-assets.mjs` and `watchface/bip-6/layout.js`.
