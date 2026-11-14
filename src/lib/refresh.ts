// Pull-to-refresh broadcast: sections that fetch from outside (calendar, weather) listen for it.
export const REFRESH_EVENT = 'dha-refresh';
export const requestRefresh = () => window.dispatchEvent(new Event(REFRESH_EVENT));
