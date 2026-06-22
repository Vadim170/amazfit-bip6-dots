# Build, preview & install

## Prerequisites

- **Node.js 18–24** and npm.
- **Zeus CLI** (the official Zepp OS tool): `npm i -g @zeppos/zeus-cli`
  (verify with `zeus -v`).
- A **Zepp account** (for on-watch preview / the simulator):
  https://console.zepp.com — then `zeus login`.

## 1. Local HTML preview (no watch, no simulator, no login)

```bash
npm install
npm run preview:local
```

Open `preview/watchface-preview.html` in any browser. Live clock, sample
metrics/weather, **Toggle AOD** button. This is pixel-exact with the device
because it uses the same `layout.js` and the same generated PNGs.

## 2. Simulator (macOS)

The official **Zepp OS Simulator v2** runs on macOS 14+ (Apple Silicon & Intel):
download the `.dmg` from https://docs.zepp.com/docs/guides/tools/simulator/download/.
Then:

```bash
zeus dev        # live-reload into the simulator
```

(Simulator login is email + password only.)

## 3. Build a distributable package

```bash
npm run build   # = zeus build  ->  dist/<id>-Dots-<version>-<ts>.zab
```

The `.zab` (Zepp App Bundle) is the artifact you install or submit to the store.
`prebuild` regenerates assets first, so a clean checkout builds in one step.

## 4. Install on a real Amazfit Bip 6

1. In the **Zepp phone app**, enable Developer Mode:
   **Profile → Settings → About → tap the Zepp logo 7 times**.
2. Run:
   ```bash
   zeus preview
   ```
   A **QR code** prints in the terminal.
3. In Zepp Developer Mode tap **Scan** and scan it. The bundle is pushed to the
   paired watch over Bluetooth and appears as a watch face.

Alternative: `zeus bridge` (Developer Bridge) for an install/uninstall loop —
requires the phone app and CLI to be on the same Zepp account.

## Device target

`app.json` targets the Amazfit Bip 6:

- `deviceSource`: `9765120`, `9765121`, `10158337`
- screen `390 × 450`, square (`st: "s"`), corner radius 86
- `runtime.apiVersion.target = "4.2"`

## Regenerating art

```bash
npm run assets   # re-render all PNGs + assets.gen.js from the font/icons
npm run render   # re-render the README preview PNGs
```

Edit the look in `tools/font5x7.mjs`, `tools/icons.mjs`, and the palette/geometry
in `tools/gen-assets.mjs` + `watchface/bip-6/layout.js`.
