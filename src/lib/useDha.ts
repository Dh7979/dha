// Data layer for DHA: claude.ai Artifact runtime (db, user, mcp, sample).
// Document shapes are unchanged from the pre-Astryx page so existing data keeps working.
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {addDays, dayKey, dow, TZ} from './dates';

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    claude?: {use: (name: string) => Promise<any>};
  }
}

export type Todo = {
  id: string;
  title: string;
  done: boolean;
  created: string;
  doneDate: string | null;
  due?: string;
  repeat?: 'daily' | 'weekdays' | 'weekly';
  repeatDow?: number;
  lastDone?: string | null;
};
export type Dday = {id: string; name: string; date: string};
/** log value: true = done, number = done with that many minutes. */
export type Habit = {
  id: string;
  name: string;
  log: Record<string, boolean | number>;
  slot?: 'morning' | 'evening' | 'any';
  timed?: boolean;
  weeklyGoal?: number;
};
export type Sleep = {bed: string; wake: string; q: number | null};
/** Minutes slept from bed (HH:MM, previous evening allowed) to wake (HH:MM). */
export function sleepMinutes(s: Sleep) {
  const [bh, bm] = s.bed.split(':').map(Number);
  const [wh, wm] = s.wake.split(':').map(Number);
  let m = wh * 60 + wm - (bh * 60 + bm);
  if (m <= 0) m += 1440;
  return m;
}
export const hm = (min: number) => `${Math.floor(min / 60)}시간${min % 60 ? ` ${min % 60}분` : ''}`;
export const habitMinutes = (h: Habit, k: string) => (typeof h.log?.[k] === 'number' ? (h.log[k] as number) : 0);
export const currentSlot = (hour: number): 'morning' | 'evening' => (hour < 14 ? 'morning' : 'evening');
export type Journal = {date: string; mood: number | null; text: string; updatedAt?: number};
export type NewsItem = {title: string; summary?: string; source?: string; url?: string};
export type News = {date: string; generatedAt?: number; categories: Record<string, NewsItem[]>};
export type Summary = {text: string; createdAt: number; from?: string; to?: string};
export type Expense = {id: string; date: string; amount: number; cat: string; memo?: string; createdAt: number};
export const monthOf = (k: string) => k.slice(0, 7);
export const prevMonth = (m: string) => {
  const [y, mo] = m.split('-').map(Number);
  return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, '0')}`;
};
export type CalEvent = {title: string; loc: string; cal: string; time: string; sort: string};
export type CalState =
  | {status: 'loading'}
  | {status: 'error'; code: string}
  | {status: 'ok'; events: CalEvent[]; note: string; calendars: number; stamp: number | null};

type StoreStatus = 'loading' | 'ready' | 'unavailable' | 'slow' | 'error';
const CAL = 'Google Calendar';
const AUTHZ = ['needs_reauth', 'server_not_connected', 'blocked_by_policy', 'approval_required', 'not_in_manifest'];

export function useToday() {
  const [today, setToday] = useState(dayKey());
  useEffect(() => {
    const check = () => setToday(dayKey());
    const t = setInterval(check, 60000);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);
  return today;
}

function asObj(p: any) {
  if (typeof p === 'string') {
    try {
      return JSON.parse(p);
    } catch {
      return null;
    }
  }
  return p;
}

const timeFmt = new Intl.DateTimeFormat('ko-KR', {timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false});
function parseEvents(p: any, cal: string): CalEvent[] {
  p = asObj(p);
  if (!p || typeof p !== 'object') return [];
  const arr = Array.isArray(p) ? p : p.events || p.items || [];
  return arr
    .filter((e: any) => e && e.status !== 'cancelled')
    .map((e: any) => {
      const s = e.start || {};
      const allDay = !!s.date && !s.dateTime;
      const start = s.dateTime || s.date || '';
      return {
        title: e.summary || e.title || '(제목 없음)',
        loc: e.location || '',
        cal,
        sort: allDay ? '' : start,
        time: allDay ? '종일' : start ? timeFmt.format(new Date(start)) : '',
      };
    });
}
function parseCalendars(p: any) {
  p = asObj(p);
  if (!p || typeof p !== 'object') return [];
  const arr = Array.isArray(p) ? p : p.calendars || p.items || p.calendarList || [];
  return arr
    .filter((c: any) => c && (c.id || c.calendarId) && c.hidden !== true && !c.deleted)
    .map((c: any) => {
      const id = c.id || c.calendarId;
      const mine = !!c.primary || (c.summary === id && /@/.test(id) && !/calendar\.google\.com$/.test(id));
      return {id, name: mine ? '내 캘린더' : c.summaryOverride || c.summary || c.name || '', primary: mine};
    })
    .sort((a: any, b: any) => Number(b.primary) - Number(a.primary));
}

export function useDha(today: string) {
  const [store, setStore] = useState<StoreStatus>('loading');
  const [todos, setTodos] = useState<Todo[]>([]);
  const [ddays, setDdays] = useState<Dday[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [journal, setJournal] = useState<Journal[]>([]);
  const [news, setNews] = useState<News | null | undefined>(undefined);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loaded, setLoaded] = useState({todos: false, ddays: false, habits: false, journal: false});
  const [error, setError] = useState<string | null>(null);
  const [cal, setCal] = useState<CalState>({status: 'loading'});
  const [sampleFn, setSampleFn] = useState<any>(null);
  const [expenses, setExpenses] = useState<Record<string, Expense[]>>({});
  const [budget, setBudget] = useState<number | null>(null);
  const [expLoaded, setExpLoaded] = useState(false);
  const [sleep, setSleep] = useState<Record<string, Sleep>>({});
  const [sleepLoaded, setSleepLoaded] = useState(false);
  const [colReady, setColReady] = useState(false);

  const col = useRef<any>(null);
  const mcp = useRef<any>(null);
  const queues = useRef<Record<string, Promise<unknown>>>({});

  const enqueue = useCallback((key: string, fn: () => Promise<unknown>) => {
    const p = (queues.current[key] || Promise.resolve()).then(fn);
    queues.current[key] = p.catch(() => {});
    return p.catch((e: any) => {
      setError(
        e && e.code === 'quota_exceeded'
          ? '저장 공간이 가득 찼어요. 오래된 항목을 지워 주세요.'
          : '저장하지 못했어요. 연결을 확인하고 다시 시도해 주세요.',
      );
      throw e;
    });
  }, []);

  // ---- store boot + subscriptions ----
  useEffect(() => {
    const C = window.claude;
    if (!C || !C.use) {
      setStore('unavailable');
      return;
    }
    let unsubs: Array<() => void> = [];
    let cancelled = false;
    const slow = setTimeout(() => setStore((s) => (s === 'loading' ? 'slow' : s)), 10000);
    Promise.all([C.use('db'), C.use('user')])
      .then(async ([db, user]) => {
        if (!db || !user) throw new Error('no-store');
        const id = await user.id();
        if (!id) throw new Error('no-store');
        if (cancelled) return;
        const c = db.collection('data/users/' + id);
        col.current = c;
        setColReady(true);
        const fail = () => setStore('error');
        const ready = () => {
          clearTimeout(slow);
          setStore('ready');
        };
        const items = (s: any) => {
          const d = s.exists ? s.data() : null;
          return d && Array.isArray(d.items) ? JSON.parse(JSON.stringify(d.items)) : [];
        };
        unsubs = [
          c.doc('todos').onSnapshot((s: any) => {
            ready();
            setTodos(items(s));
            setLoaded((l) => ({...l, todos: true}));
          }, fail),
          c.doc('ddays').onSnapshot((s: any) => {
            setDdays(items(s));
            setLoaded((l) => ({...l, ddays: true}));
          }, fail),
          c.doc('habits').onSnapshot((s: any) => {
            setHabits(items(s));
            setLoaded((l) => ({...l, habits: true}));
          }, fail),
          c
            .where('kind', '==', 'journal')
            .orderBy('date', 'desc')
            .limit(10)
            .onSnapshot((s: any) => {
              setJournal(s.docs.map((d: any) => d.data()));
              setLoaded((l) => ({...l, journal: true}));
            }, fail),
          c.doc('news').onSnapshot(
            (s: any) => setNews(s.exists ? s.data() : null),
            () => setNews(null),
          ),
          c.doc('summary').onSnapshot(
            (s: any) => setSummary(s.exists ? s.data() : null),
            () => {},
          ),
          c.doc('sleep').onSnapshot(
            (s: any) => {
              const d = s.exists ? s.data() : null;
              setSleep(d && d.days && typeof d.days === 'object' ? JSON.parse(JSON.stringify(d.days)) : {});
              setSleepLoaded(true);
            },
            () => setSleepLoaded(true),
          ),
          c.doc('budget').onSnapshot(
            (s: any) => {
              const v = s.exists ? Number(s.data()?.monthly) : NaN;
              setBudget(Number.isFinite(v) && v > 0 ? v : null);
            },
            () => {},
          ),
        ];
      })
      .catch(() => {
        clearTimeout(slow);
        setStore('unavailable');
      });
    C.use('sample').then((s: any) => !cancelled && setSampleFn(() => s));
    return () => {
      cancelled = true;
      clearTimeout(slow);
      unsubs.forEach((u) => u());
    };
  }, []);

  // ---- expenses: one document per month (this month + last month for the weekly review) ----
  const month = monthOf(today);
  useEffect(() => {
    if (!colReady || !col.current) return;
    const months = [month, prevMonth(month)];
    const unsubs = months.map((m) =>
      col.current.doc('expenses-' + m).onSnapshot(
        (s: any) => {
          const d = s.exists ? s.data() : null;
          setExpenses((e) => ({...e, [m]: d && Array.isArray(d.items) ? JSON.parse(JSON.stringify(d.items)) : []}));
          if (m === month) setExpLoaded(true);
        },
        () => setExpLoaded(true),
      ),
    );
    return () => unsubs.forEach((u: () => void) => u());
  }, [colReady, month]);

  // ---- calendar: every calendar the viewer has, today only ----
  const calGen = useRef(0);
  const startCalendar = useCallback(() => {
    const m = mcp.current;
    if (!m) return () => {};
    const gen = ++calGen.current;
    const unwatch: Array<() => void> = [];
    setCal({status: 'loading'});
    const input = (id: string) => {
      const i: any = {
        startTime: today + 'T00:00:00',
        endTime: addDays(today, 1) + 'T00:00:00',
        timeZone: TZ,
        orderBy: 'startTime',
        pageSize: 50,
      };
      if (id) i.calendarId = id;
      return i;
    };
    let note = '';
    m.callTool(CAL, 'list_calendars', {pageSize: 100}, {cache: {staleTime: 30 * 60000, gcTime: 24 * 3600000}})
      .then((r: any) => parseCalendars(r.payload))
      .catch((e: any) => {
        const code = e && e.code;
        if (['approval_required', 'server_not_connected', 'blocked_by_policy', 'not_granted', 'capability_disabled'].includes(code))
          throw e;
        note = '캘린더 목록을 읽지 못해 기본 캘린더만 보여주고 있어요.';
        return [];
      })
      .then((list: any[]) => {
        if (gen !== calGen.current) return;
        if (!list.length) list = [{id: '', name: '', primary: true}];
        list = list.slice(0, 15);
        const multi = list.length > 1;
        const state = list.map(() => ({events: null as CalEvent[] | null, err: null as any, stamp: 0}));
        const render = () => {
          if (gen !== calGen.current) return;
          const ok = state.filter((s) => s.events);
          const failed = list.filter((_, i) => state[i].err && !state[i].events);
          if (!ok.length) {
            if (state.some((s) => !s.events && !s.err)) return;
            setCal({status: 'error', code: state[0].err?.code || 'upstream_error'});
            return;
          }
          const events = ok
            .flatMap((s) => s.events as CalEvent[])
            .sort((a, b) => (a.sort < b.sort ? -1 : a.sort > b.sort ? 1 : 0));
          const notes = [note, failed.length ? '불러오지 못한 캘린더: ' + failed.map((c) => c.name || '기본').join(', ') : '']
            .filter(Boolean)
            .join(' · ');
          setCal({
            status: 'ok',
            events,
            note: notes,
            calendars: ok.length,
            stamp: Math.min(...ok.map((s) => s.stamp)),
          });
        };
        list.forEach((c, i) => {
          unwatch.push(
            m.watchTool(
              CAL,
              'list_events',
              input(c.id),
              (ev: any) => {
                if (ev.type === 'data') {
                  state[i].err = null;
                  state[i].events = parseEvents(ev.result.payload, multi ? c.name : '');
                  state[i].stamp = ev.result.cache?.storedAt || Date.now();
                } else {
                  state[i].err = ev.error;
                  if (AUTHZ.includes(ev.error?.code)) state[i].events = null;
                }
                render();
              },
              {cache: {staleTime: 60000, gcTime: 600000}, refetchInterval: 5 * 60 * 1000},
            ),
          );
        });
      })
      .catch((e: any) => {
        if (gen === calGen.current) setCal({status: 'error', code: e?.code || 'upstream_error'});
      });
    return () => {
      calGen.current++;
      unwatch.forEach((u) => u());
    };
  }, [today]);

  const [mcpReady, setMcpReady] = useState(false);
  useEffect(() => {
    const C = window.claude;
    if (!C || !C.use) {
      setCal({status: 'error', code: 'not_granted'});
      return;
    }
    C.use('mcp').then((m: any) => {
      if (!m) setCal({status: 'error', code: 'not_granted'});
      else {
        mcp.current = m;
        setMcpReady(true);
      }
    });
  }, []);
  useEffect(() => (mcpReady ? startCalendar() : undefined), [mcpReady, startCalendar]);

  const allowCalendar = useCallback(async () => {
    if (!mcp.current) return;
    try {
      await mcp.current.callTool(
        CAL,
        'list_events',
        {startTime: today + 'T00:00:00', endTime: addDays(today, 1) + 'T00:00:00', timeZone: TZ},
        {cache: false},
      );
      startCalendar();
    } catch (e: any) {
      setCal({status: 'error', code: e?.code || 'upstream_error'});
    }
  }, [today, startCalendar]);

  // ---- writes ----
  const writable = store === 'ready' || store === 'slow';
  const saveTodos = useCallback(
    (next: Todo[]) => {
      const cutoff = addDays(today, -14);
      const kept = next.filter((t) => t.repeat || !t.done || (t.doneDate || '') >= cutoff);
      setTodos(kept);
      const snap = JSON.parse(JSON.stringify(kept));
      return enqueue('todos', () => col.current.doc('todos').set({items: snap}));
    },
    [today, enqueue],
  );
  const saveDdays = useCallback(
    (next: Dday[]) => {
      setDdays(next);
      const snap = JSON.parse(JSON.stringify(next));
      return enqueue('ddays', () => col.current.doc('ddays').set({items: snap}));
    },
    [enqueue],
  );
  const saveHabits = useCallback(
    (next: Habit[]) => {
      const cutoff = addDays(today, -60);
      const pruned = next.map((h) => ({
        ...h,
        log: Object.fromEntries(Object.entries(h.log || {}).filter(([k, v]) => v && k >= cutoff)),
      }));
      setHabits(pruned);
      const snap = JSON.parse(JSON.stringify(pruned));
      return enqueue('habits', () => col.current.doc('habits').set({items: snap}));
    },
    [today, enqueue],
  );
  const saveJournal = useCallback(
    (mood: number | null, text: string) => {
      const data = {kind: 'journal', date: today, mood, text: text.trim(), updatedAt: Date.now()};
      setJournal((j) => [data, ...j.filter((x) => x.date !== today)]);
      return enqueue('j-' + today, () => col.current.doc('j-' + today).set(data));
    },
    [today, enqueue],
  );
  const saveSleep = useCallback(
    (day: string, entry: Sleep | null) => {
      const cutoff = addDays(today, -90);
      const next: Record<string, Sleep> = {};
      Object.entries(sleep).forEach(([k, v]) => {
        if (k >= cutoff && k !== day) next[k] = v;
      });
      if (entry) next[day] = entry;
      setSleep(next);
      return enqueue('sleep', () => col.current.doc('sleep').set({days: next}));
    },
    [today, sleep, enqueue],
  );
  const saveExpenses = useCallback(
    (m: string, items: Expense[]) => {
      setExpenses((e) => ({...e, [m]: items}));
      const snap = JSON.parse(JSON.stringify(items));
      return enqueue('expenses-' + m, () => col.current.doc('expenses-' + m).set({month: m, items: snap}));
    },
    [enqueue],
  );
  const saveBudget = useCallback(
    (monthly: number | null) => {
      setBudget(monthly);
      return enqueue('budget', () => col.current.doc('budget').set({monthly: monthly || 0}));
    },
    [enqueue],
  );
  const saveSummary = useCallback(
    (s: Summary) => {
      setSummary(s);
      return enqueue('summary', () => col.current.doc('summary').set(s));
    },
    [enqueue],
  );

  return useMemo(
    () => ({
      store,
      writable,
      loaded,
      todos,
      ddays,
      habits,
      journal,
      news,
      summary,
      cal,
      sampleFn,
      error,
      clearError: () => setError(null),
      saveTodos,
      saveDdays,
      saveHabits,
      saveJournal,
      saveSummary,
      allowCalendar,
      expenses,
      budget,
      expLoaded,
      saveExpenses,
      saveBudget,
      sleep,
      sleepLoaded,
      saveSleep,
    }),
    [store, writable, loaded, todos, ddays, habits, journal, news, summary, cal, sampleFn, error, saveTodos, saveDdays, saveHabits, saveJournal, saveSummary, allowCalendar, expenses, budget, expLoaded, saveExpenses, saveBudget, sleep, sleepLoaded, saveSleep],
  );
}

// ---- pure helpers shared by the sections ----
export const repeatDow = (t: Todo) => (t.repeatDow != null ? t.repeatDow : dow(t.created));
export function repeatsOn(t: Todo, k: string) {
  const d = dow(k);
  if (t.repeat === 'daily') return true;
  if (t.repeat === 'weekdays') return d >= 1 && d <= 5;
  if (t.repeat === 'weekly') return d === repeatDow(t);
  return false;
}
export const isDone = (t: Todo, today: string) => (t.repeat ? t.lastDone === today : !!t.done);
export function streak(h: Habit, today: string) {
  const log = h.log || {};
  let n = 0;
  let k = log[today] ? today : addDays(today, -1);
  while (log[k]) {
    n++;
    k = addDays(k, -1);
  }
  return n;
}
