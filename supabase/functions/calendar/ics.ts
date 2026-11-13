// Pure iCalendar helper shared by the Edge Function and the local test.
// Returns the events of one KST day, expanding recurring events and applying their exceptions.
/* eslint-disable @typescript-eslint/no-explicit-any */

export type DayEvent = {
  summary: string;
  location?: string;
  status?: string;
  start: {date?: string; dateTime?: string};
  end: {date?: string; dateTime?: string};
};

const KST = '+09:00';
const addDay = (d: string, n: number) => new Date(Date.parse(d + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);

export function eventsOn(ICAL: any, icsText: string, day: string): DayEvent[] {
  const root = new ICAL.Component(ICAL.parse(icsText));
  for (const tz of root.getAllSubcomponents('vtimezone')) {
    try {
      ICAL.TimezoneService.register(tz);
    } catch {
      /* already registered */
    }
  }
  const dayStart = Date.parse(day + 'T00:00:00' + KST);
  const dayEnd = dayStart + 864e5;

  const vevents = root.getAllSubcomponents('vevent');
  const masters = new Map<string, any>();
  const exceptions: any[] = [];
  for (const ve of vevents) {
    const ev = new ICAL.Event(ve);
    if (ev.isRecurrenceException()) exceptions.push(ev);
    else masters.set(ev.uid, ev);
  }
  for (const ex of exceptions) masters.get(ex.uid)?.relateException(ex);

  const out: DayEvent[] = [];
  const push = (item: any, start: any, end: any) => {
    if (String(item.component.getFirstPropertyValue('status') || '').toUpperCase() === 'CANCELLED') return;
    const allDay = !!start.isDate;
    if (allDay) {
      const s = start.toString().slice(0, 10);
      const e = end ? end.toString().slice(0, 10) : addDay(s, 1);
      if (!(s <= day && day < e)) return;
      out.push({summary: item.summary || '(제목 없음)', location: item.location || undefined, start: {date: s}, end: {date: e}});
    } else {
      const s = start.toJSDate().getTime();
      const e = end ? end.toJSDate().getTime() : s;
      if (!(s < dayEnd && (e > dayStart || s >= dayStart))) return;
      out.push({
        summary: item.summary || '(제목 없음)',
        location: item.location || undefined,
        start: {dateTime: new Date(s).toISOString()},
        end: {dateTime: new Date(e).toISOString()},
      });
    }
  };

  for (const ev of masters.values()) {
    if (!ev.isRecurring()) {
      push(ev, ev.startDate, ev.endDate);
      continue;
    }
    const it = ev.iterator();
    for (let i = 0, next = it.next(); next && i < 5000; i++, next = it.next()) {
      const t = next.isDate ? Date.parse(next.toString().slice(0, 10) + 'T00:00:00' + KST) : next.toJSDate().getTime();
      if (t >= dayEnd) break;
      const det = ev.getOccurrenceDetails(next);
      push(det.item, det.startDate, det.endDate);
    }
  }
  return out.sort((a, b) => (a.start.dateTime || '') < (b.start.dateTime || '') ? -1 : 1);
}
