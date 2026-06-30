// Maps Zepp/Huami weather condition `index` codes to a pictogram + a rain flag.
//
// The codes below are the ones the watch-face WEATHER sensor actually returns
// from `getForecastWeather().forecastData.data[i].index`, per the Zepp OS docs:
// https://docs.zepp.com/docs/reference/device-app-api/newAPI/sensor/Weather/
//
// IMPORTANT: index 0 is NOT "sunny" — sunny is 3. This non-obvious ordering is a
// common source of wrong-icon bugs. The condition name for each code is kept in
// a trailing comment so the mapping is easy to recalibrate on a real device.

// icon keys must match exports in assets.gen.js -> WX
const TABLE = {
  0: { icon: 'cloudy', rain: false },     // Cloudy
  1: { icon: 'rain', rain: true },        // Showers
  2: { icon: 'snow', rain: true },        // Snow Showers
  3: { icon: 'clear', rain: false },      // Sunny
  4: { icon: 'overcast', rain: false },   // Overcast
  5: { icon: 'rain', rain: true },        // Light Rain
  6: { icon: 'snow', rain: true },        // Light Snow
  7: { icon: 'rain', rain: true },        // Moderate Rain
  8: { icon: 'snow', rain: true },        // Moderate Snow
  9: { icon: 'snow', rain: true },        // Heavy Snow
  10: { icon: 'rain', rain: true },       // Heavy Rain
  11: { icon: 'wind', rain: false },      // Sandstorm
  12: { icon: 'snow', rain: true },       // Rain and Snow (sleet)
  13: { icon: 'fog', rain: false },       // Fog
  14: { icon: 'fog', rain: false },       // Hazy
  15: { icon: 'thunder', rain: true },    // T-Storms
  16: { icon: 'snow', rain: true },       // Snowstorm
  17: { icon: 'wind', rain: false },      // Floating dust
  18: { icon: 'rain', rain: true },       // Very Heavy Rainstorm
  19: { icon: 'thunder', rain: true },    // Rain and Hail
  20: { icon: 'thunder', rain: true },    // T-Storms and Hail
  21: { icon: 'rain', rain: true },       // Heavy Rainstorm
  22: { icon: 'wind', rain: false },      // Dust
  23: { icon: 'wind', rain: false },      // Heavy sand storm
  24: { icon: 'rain', rain: true },       // Rainstorm
  25: { icon: 'cloudy', rain: false },    // Unknown
  26: { icon: 'cloudy', rain: false },    // Cloudy (nighttime)
  27: { icon: 'rain', rain: true },       // Showers (nighttime)
  28: { icon: 'clear', rain: false },     // Sunny (nighttime)
}

const FALLBACK = { icon: 'cloudy', rain: false }

export function lookup(index) {
  if (index === undefined || index === null) return FALLBACK
  return TABLE[index] || FALLBACK
}
