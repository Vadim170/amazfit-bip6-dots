// Maps Zepp/Huami weather condition `index` codes to a pictogram + a rain flag.
//
// NOTE: Zepp does not publish the official code table for the watch-face Weather
// sensor. The mapping below follows the commonly-observed Huami codes and is
// intentionally isolated here so it is trivial to recalibrate on a real device:
// just adjust an entry's `icon` / `rain` field.

// icon keys must match exports in assets.gen.js -> WX
const TABLE = {
  0: { icon: 'clear', rain: false },     // sunny / clear
  1: { icon: 'partly', rain: false },    // cloudy (partly)
  2: { icon: 'overcast', rain: false },  // overcast
  3: { icon: 'rain', rain: true },       // shower
  4: { icon: 'thunder', rain: true },    // thundershower
  5: { icon: 'thunder', rain: true },    // thundershower with hail
  6: { icon: 'snow', rain: true },       // sleet (rain + snow)
  7: { icon: 'rain', rain: true },       // light rain
  8: { icon: 'rain', rain: true },       // moderate rain
  9: { icon: 'rain', rain: true },       // heavy rain
  10: { icon: 'rain', rain: true },      // storm
  11: { icon: 'rain', rain: true },      // heavy storm
  12: { icon: 'rain', rain: true },      // severe storm
  13: { icon: 'snow', rain: false },     // snow flurry
  14: { icon: 'snow', rain: false },     // light snow
  15: { icon: 'snow', rain: false },     // moderate snow
  16: { icon: 'snow', rain: false },     // heavy snow
  17: { icon: 'snow', rain: false },     // snowstorm
  18: { icon: 'fog', rain: false },      // fog
  19: { icon: 'rain', rain: true },      // freezing rain
  20: { icon: 'wind', rain: false },     // dust
  21: { icon: 'rain', rain: true },      // light-to-moderate rain
  22: { icon: 'rain', rain: true },      // moderate-to-heavy rain
  23: { icon: 'rain', rain: true },      // heavy rain to storm
  26: { icon: 'fog', rain: false },      // haze
  27: { icon: 'fog', rain: false },      // heavy haze
  28: { icon: 'wind', rain: false },     // windy
  29: { icon: 'wind', rain: false },     // sandstorm
}

const FALLBACK = { icon: 'cloudy', rain: false }

export function lookup(index) {
  if (index === undefined || index === null) return FALLBACK
  return TABLE[index] || FALLBACK
}
