# Build, preview & install

## Prerequisites

- **Node.js** and npm.
- The official **Zeus CLI**: `npm i -g @zeppos/zeus-cli` (check with `zeus -v`).
- A **Zepp account** for installing on a watch (`zeus login`).

## 1. Local preview (no watch, no login)

```bash
npm install
npm run preview:local
```

Open `preview/watchface-preview.html` in a browser. It's a pixel-exact mock with
a live clock, sample data, and a **Toggle AOD** button — the fastest way to see
changes.

## 2. Build a package

```bash
npm run build      # -> dist/<id>-Dots-<version>.zab
```

The `.zab` is the installable bundle. Assets are regenerated automatically
before each build, so a fresh clone builds in one step.

## 3. Install on the watch

1. In the **Zepp phone app**, enable Developer Mode:
   **Profile → Settings → About → tap the Zepp logo 7 times**.
2. Run `zeus preview` — a **QR code** prints in the terminal.
3. In Zepp's Developer Mode tap **Scan** and scan it; the face is pushed to the
   paired watch over Bluetooth.

`zeus bridge` (Developer Bridge) is an alternative for a quick install loop;
both require the phone and CLI to be on the same Zepp account.

## Notes

- The project targets the **Amazfit Bip 6** (390×450 screen). The device target
  is set in `app.json` — adjust it there to build for other models.
- Regenerate the artwork at any time with `npm run assets`.
