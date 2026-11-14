// Display mode preference, kept per device (localStorage). Default: light.
export type Mode = 'light' | 'dark' | 'system';
export const MODE_EVENT = 'dha-mode-change';

export function readMode(): Mode {
  try {
    const v = localStorage.getItem('dha-mode');
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    /* ignore */
  }
  return 'light';
}

export function writeMode(m: Mode) {
  try {
    localStorage.setItem('dha-mode', m);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(MODE_EVENT));
}

// Text size preference (per device). Every Astryx size is in rem, so scaling the root scales the app.
export type TextScale = 'sm' | 'md' | 'lg' | 'xl';
export const SCALE_PCT: Record<TextScale, string> = {sm: '93.75%', md: '100%', lg: '112.5%', xl: '125%'};
export function readScale(): TextScale {
  try {
    const v = localStorage.getItem('dha-text-scale');
    if (v === 'sm' || v === 'md' || v === 'lg' || v === 'xl') return v;
  } catch {
    /* ignore */
  }
  return 'md';
}
export function writeScale(s: TextScale) {
  try {
    localStorage.setItem('dha-text-scale', s);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(MODE_EVENT));
}
