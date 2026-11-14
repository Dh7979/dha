// Weather for 대전 서구 from Open-Meteo (free, no key). Pure helpers are unit-tested.
export const PLACE = {name: '대전 서구', lat: 36.3555, lon: 127.3838};
export const WEATHER_LINK = 'https://search.naver.com/search.naver?query=' + encodeURIComponent('대전 서구 날씨');

export type Weather = {
  temp: number;
  feels: number;
  code: number;
  max: number;
  min: number;
  rain: number; // max precipitation probability today, %
  pm10: number | null;
  pm25: number | null;
  at: number;
};

/** WMO weather code → Korean label + emoji. */
export function describe(code: number): {l: string; e: string} {
  if (code === 0) return {l: '맑음', e: '☀️'};
  if (code <= 2) return {l: '구름 조금', e: '🌤️'};
  if (code === 3) return {l: '흐림', e: '☁️'};
  if (code === 45 || code === 48) return {l: '안개', e: '🌫️'};
  if (code >= 51 && code <= 57) return {l: '이슬비', e: '🌦️'};
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return {l: '비', e: '🌧️'};
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return {l: '눈', e: '🌨️'};
  if (code >= 95) return {l: '뇌우', e: '⛈️'};
  return {l: '흐림', e: '☁️'};
}

/** Korean air-quality grades (환경부 기준). */
export function pmGrade(kind: 'pm10' | 'pm25', v: number | null): string | null {
  if (v == null || !Number.isFinite(v)) return null;
  const cut = kind === 'pm10' ? [30, 80, 150] : [15, 35, 75];
  return v <= cut[0] ? '좋음' : v <= cut[1] ? '보통' : v <= cut[2] ? '나쁨' : '매우 나쁨';
}

/** One short line of advice for the day, or null. */
export function tip(w: Weather): string | null {
  if (w.rain >= 60) return '비 소식이 있어요. 우산 챙기세요.';
  const bad = [pmGrade('pm10', w.pm10), pmGrade('pm25', w.pm25)].some((g) => g === '나쁨' || g === '매우 나쁨');
  if (bad) return '미세먼지가 나빠요. 마스크를 챙기세요.';
  if (w.max - w.min >= 10) return '일교차가 커요. 겉옷을 챙기세요.';
  if (w.feels <= -5) return '많이 추워요. 따뜻하게 입으세요.';
  return null;
}

const CACHE = 'dha-weather';
const FRESH = 30 * 60000;

export function cachedWeather(): Weather | null {
  try {
    const w = JSON.parse(localStorage.getItem(CACHE) || 'null');
    return w && typeof w.temp === 'number' ? w : null;
  } catch {
    return null;
  }
}

export async function fetchWeather(force = false): Promise<Weather> {
  const c = cachedWeather();
  if (!force && c && Date.now() - c.at < FRESH) return c;
  const q = `latitude=${PLACE.lat}&longitude=${PLACE.lon}&timezone=Asia%2FSeoul`;
  const [f, a] = await Promise.all([
    fetch(
      `https://api.open-meteo.com/v1/forecast?${q}&current=temperature_2m,apparent_temperature,weather_code` +
        '&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=1',
    ).then((r) => (r.ok ? r.json() : Promise.reject(new Error('weather ' + r.status)))),
    fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?${q}&current=pm10,pm2_5`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
  ]);
  const w: Weather = {
    temp: Math.round(f.current.temperature_2m),
    feels: Math.round(f.current.apparent_temperature),
    code: Number(f.current.weather_code),
    max: Math.round(f.daily.temperature_2m_max[0]),
    min: Math.round(f.daily.temperature_2m_min[0]),
    rain: Number(f.daily.precipitation_probability_max?.[0] ?? 0),
    pm10: a?.current?.pm10 ?? null,
    pm25: a?.current?.pm2_5 ?? null,
    at: Date.now(),
  };
  try {
    localStorage.setItem(CACHE, JSON.stringify(w));
  } catch {
    /* cache is a convenience */
  }
  return w;
}
