# Data shown, and what the watch won't share

This face only ever reads data the watch already has; it does no networking of
its own. Here's what it shows and, just as importantly, what it can't.

## What it shows

- **Time and date** — current time and the weekday + day.
- **Weather** — today's condition (as a dotted icon) and temperature, including
  sub-zero with a minus sign. The forecast is whatever the phone has synced.
- **Steps** and **heart rate** — the current values.
- **Two weekly graphs** — a resting-heart-rate trend and a heart-rate
  variability trend (see the proxies below).

## The honest limitations

**HRV isn't exposed to a watch face.** There's no way to read a real HRV value.
The second graph therefore shows a **variability proxy** computed from the
day's heart-rate spread, not true HRV.

**No multi-day history is provided either.** The watch hands a face only "right
now" values, not a week of them. So the face records one sample per day itself
and keeps a rolling 7-day window. The graphs **fill in as the watch is worn** —
a fresh install shows just today, and the trends build up over the following
days. The resting-HR trend uses each day's lowest heart rate as a stand-in for
resting HR.

**Weather can't come from a custom provider.** A watch face has no internet
access, so it relies on the forecast the Zepp phone app syncs over Bluetooth.
The provider and refresh rate are the phone's to decide, not ours — a source
like a specific weather API can't be wired in from a watch face.

**Weather condition codes aren't officially documented.** The mapping from the
synced condition code to an icon (and the "will it rain" flag) lives in one
small file (`weather-codes.js`) and is easy to adjust if a code looks off on a
real device.

## Energy efficiency

The face is built to sip battery:

- **Black everywhere** — on this AMOLED screen black pixels are off, so only the
  white dots and the red accent draw power; Always-On Display lights very few.
- **No seconds, OS-driven clock** — the app isn't woken every second (or minute)
  just to repaint the time.
- **Event-driven** — metrics update when they change, nothing polls on a timer.
- **Static dot images** — composited by the watch rather than redrawn each frame.
