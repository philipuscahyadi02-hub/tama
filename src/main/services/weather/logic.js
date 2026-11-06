// @ts-check
// Weather (EVT-1, D-035). Pure: Open-Meteo JSON in, a small Weather object out. No network here.

/**
 * @typedef {{ city: string, lat: number, lon: number }} WeatherLocation
 * @typedef {'clear'|'cloudy'|'rain'|'snow'|'storm'} WeatherKind
 * @typedef {{ code: number, tempC: number, isDay: boolean, kind: WeatherKind, hot: boolean, cold: boolean }} Weather
 */

/** At or above this it's a "very hot" day. */
const HOT_C = 30;
/** At or below this it's a "cold" day. */
const COLD_C = 3;

/**
 * WMO weather interpretation code (Open-Meteo `weather_code`) → coarse kind.
 * 0-1 clear · 2-3 clouds · 45/48 fog · 51-67 drizzle/rain · 71-77 snow · 80-82 showers · 85-86 snow showers · 95-99 thunder.
 * @param {number} code @returns {WeatherKind}
 */
function kindOf(code) {
  if (code >= 95) return 'storm';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if (code <= 1) return 'clear';
  return 'cloudy';
}

/** @param {number} code @param {number} tempC @param {boolean} [isDay] @returns {Weather} */
function classify(code, tempC, isDay = true) {
  return { code, tempC, isDay, kind: kindOf(code), hot: tempC >= HOT_C, cold: tempC <= COLD_C };
}

/**
 * Open-Meteo geocoding response → the first place, or null.
 * @param {any} json @returns {WeatherLocation | null}
 */
function parseGeocode(json) {
  const r = json && Array.isArray(json.results) ? json.results[0] : null;
  if (!r || typeof r.latitude !== 'number' || typeof r.longitude !== 'number') return null;
  const city = [r.name, r.country_code || r.country].filter(Boolean).join(', ');
  return { city: String(city || 'there').slice(0, 80), lat: r.latitude, lon: r.longitude };
}

/**
 * Open-Meteo forecast response (`current=temperature_2m,weather_code,is_day`) → Weather, or null.
 * @param {any} json @returns {Weather | null}
 */
function parseCurrent(json) {
  const c = json && json.current;
  if (!c || typeof c.weather_code !== 'number' || typeof c.temperature_2m !== 'number') return null;
  return classify(c.weather_code, c.temperature_2m, c.is_day !== 0);
}

/** A few words for the chat brain's status line. @param {Weather | null | undefined} w @returns {string} */
function describe(w) {
  if (!w) return '';
  const words = { clear: 'clear sky', cloudy: 'cloudy', rain: 'rainy', snow: 'snowing', storm: 'thunderstorm' };
  return `${words[w.kind]}, ${Math.round(w.tempC)}°C${w.hot ? ' (very hot)' : w.cold ? ' (cold)' : ''}`;
}

/** @param {WeatherLocation} loc */
const forecastUrl = (loc) =>
  `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&current=temperature_2m,weather_code,is_day`;

/** @param {string} city */
const geocodeUrl = (city) => `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`;

module.exports = { kindOf, classify, parseGeocode, parseCurrent, describe, forecastUrl, geocodeUrl, HOT_C, COLD_C };
