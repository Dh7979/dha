export const TZ = 'Asia/Seoul';
const keyFmt = new Intl.DateTimeFormat('en-CA', {timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit'});
export const dayKey = (d: Date = new Date()) => keyFmt.format(d);
export const toUTC = (k: string) => {
  const [y, m, d] = k.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
export const addDays = (k: string, n: number) => new Date(toUTC(k) + n * 864e5).toISOString().slice(0, 10);
export const diffDays = (a: string, b: string) => Math.round((toUTC(b) - toUTC(a)) / 864e5);
export const dow = (k: string) => new Date(toUTC(k)).getUTCDay();
export const DOW = ['일', '월', '화', '수', '목', '금', '토'];

const longFmt = new Intl.DateTimeFormat('ko-KR', {timeZone: 'UTC', month: 'long', day: 'numeric', weekday: 'long'});
const shortFmt = new Intl.DateTimeFormat('ko-KR', {timeZone: 'UTC', month: 'numeric', day: 'numeric', weekday: 'short'});
const timeFmt = new Intl.DateTimeFormat('ko-KR', {timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false});
export const longDate = (k: string) => longFmt.format(new Date(toUTC(k)));
export const shortDate = (k: string) => shortFmt.format(new Date(toUTC(k)));
export const clock = (d: Date | number | string) => timeFmt.format(new Date(d));
export const kstHour = () =>
  Number(new Intl.DateTimeFormat('en-US', {timeZone: TZ, hour: 'numeric', hour12: false}).format(new Date()));

export const uid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2))
    .replace(/-/g, '')
    .slice(0, 16);
