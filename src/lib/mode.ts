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
