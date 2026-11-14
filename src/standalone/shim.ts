// Standalone runtime: provides the same `window.claude.use(...)` surface the claude.ai
// Artifact gives the page, backed by Supabase (data, login, Claude function) and the
// Google Calendar REST API (calendar). `useDha` runs unchanged on top of it.
import type {Session, SupabaseClient} from '@supabase/supabase-js';
// Same default as supabase/functions/calendar: the public Korean holidays calendar.
export const DEFAULT_CALENDARS = [{name: '대한민국의 휴일', url: 'https://calendar.google.com/calendar/ical/ko.south_korea%23holiday%40group.v.calendar.google.com/public/basic.ics'}];

/* eslint-disable @typescript-eslint/no-explicit-any */
type Listener = () => void;

export type Reminder = {on: boolean; time: string};
export type PushDoc = {subs: Array<{endpoint?: string}>; reminders: Record<string, Reminder>};
export const DEFAULT_REMINDERS: Record<string, Reminder> = {
  sleep: {on: true, time: '08:30'},
  morning: {on: true, time: '09:00'},
  evening: {on: true, time: '21:00'},
  wrap: {on: true, time: '22:00'},
};
const b64url = (s: string) => {
  const raw = atob((s + '='.repeat((4 - (s.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

export function installShim(supabase: SupabaseClient, session: Session) {
  const uid = session.user.id;
  const cache = new Map<string, any>();
  const listeners = new Set<Listener>();
  let loaded = false;
  const notify = () => listeners.forEach((l) => l());

  const ready = (async () => {
    const {data, error} = await supabase.from('docs').select('key,data').eq('user_id', uid);
    if (error) throw error;
    (data || []).forEach((r: any) => cache.set(r.key, r.data));
    loaded = true;
    notify();
    supabase
      .channel('docs-' + uid)
      .on('postgres_changes', {event: '*', schema: 'public', table: 'docs', filter: `user_id=eq.${uid}`}, (p: any) => {
        if (p.eventType === 'DELETE') cache.delete(p.old.key);
        else cache.set(p.new.key, p.new.data);
        notify();
      })
      .subscribe();
  })();

  const snap = (key: string) => {
    const v = cache.get(key);
    return {id: key, exists: v !== undefined, data: () => v, metadata: {fromCache: !loaded, hasPendingWrites: false}};
  };
  const subscribe = (fn: () => void, err?: (e: any) => void) => {
    const l = () => loaded && fn();
    listeners.add(l);
    ready.then(l).catch((e) => err?.({code: 'unavailable', message: String(e?.message || e)}));
    return () => listeners.delete(l);
  };

  const docRef = (key: string) => ({
    id: key,
    path: key,
    get: async () => (await ready, snap(key)),
    onSnapshot: (next: (s: any) => void, err?: (e: any) => void) => subscribe(() => next(snap(key)), err),
    set: async (data: Record<string, unknown>) => {
      cache.set(key, data);
      notify();
      const {error} = await supabase.from('docs').upsert({user_id: uid, key, data, updated_at: new Date().toISOString()});
      if (error) throw {code: 'unavailable', message: error.message};
    },
    delete: async () => {
      cache.delete(key);
      notify();
      await supabase.from('docs').delete().eq('user_id', uid).eq('key', key);
    },
  });

  // The page only queries journal entries: where kind == journal, orderBy date desc, limit n.
  const query = (filters: Array<[string, string, unknown]>, order: [string, string] | null, lim: number | null): any => ({
    where: (f: string, op: string, v: unknown) => query([...filters, [f, op, v]], order, lim),
    orderBy: (f: string, dir = 'asc') => query(filters, [f, dir], lim),
    limit: (n: number) => query(filters, order, n),
    onSnapshot: (next: (s: any) => void, err?: (e: any) => void) =>
      subscribe(() => {
        let rows = [...cache.entries()]
          .filter(([, v]) => v && typeof v === 'object' && filters.every(([f, op, val]) => (op === '==' ? v[f] === val : true)))
          .map(([k]) => snap(k));
        if (order) {
          const [f, dir] = order;
          rows.sort((a, b) => (a.data()[f] < b.data()[f] ? -1 : a.data()[f] > b.data()[f] ? 1 : 0) * (dir === 'desc' ? -1 : 1));
        }
        if (lim) rows = rows.slice(0, lim);
        next({docs: rows, size: rows.length, empty: !rows.length, metadata: {fromCache: false, hasPendingWrites: false}});
      }, err),
  });
  const collection = () => Object.assign({doc: (id: string) => docRef(id)}, query([], null, null));

  // ---- Calendar from the user's iCal addresses (server function), shaped like the
  // claude.ai connector's results so the page code is unchanged ----
  const calendarsList = (): Array<{name: string}> => {
    const items = cache.get('calendars')?.items;
    return Array.isArray(items) ? items : DEFAULT_CALENDARS;
  };
  const runTool = async (tool: string, input: any) => {
    if (tool === 'list_calendars') {
      await ready;
      return {calendars: calendarsList().map((c, i) => ({id: String(i), summary: c.name || `캘린더 ${i + 1}`}))};
    }
    if (tool === 'list_events') {
      const index = Number(input?.calendarId || 0);
      const date = String(input?.startTime || '').slice(0, 10);
      const {data, error} = await supabase.functions.invoke('calendar', {body: {date, index}});
      if (error) throw {code: 'server_unavailable', retryable: true, message: error.message};
      return {events: data?.events || []};
    }
    throw {code: 'not_in_manifest', message: 'unknown tool ' + tool};
  };
  const mcp = {
    callTool: async (_server: string, tool: string, input: any) => ({content: [], payload: await runTool(tool, input)}),
    watchTool: (_server: string, tool: string, input: any, handler: (ev: any) => void, opts?: {refetchInterval?: number}) => {
      let stop = false;
      const run = () =>
        runTool(tool, input)
          .then((payload) => !stop && handler({type: 'data', result: {content: [], payload, cache: {storedAt: Date.now(), revalidating: false}}}))
          .catch((error) => !stop && handler({type: 'error', error}));
      run();
      const t = opts?.refetchInterval ? setInterval(run, Math.max(30000, opts.refetchInterval)) : null;
      return () => {
        stop = true;
        if (t) clearInterval(t);
      };
    },
  };

  // ---- Claude weekly review through the Supabase Edge Function ----
  const sample = async (prompt: string, opts?: {onText?: (p: {text: string}) => void}) => {
    const {data, error} = await supabase.functions.invoke('weekly-review', {body: {prompt}});
    if (error) throw {code: (error as any)?.context?.status === 429 ? 'rate_limited' : 'upstream_error', message: error.message};
    const text = String(data?.text || '');
    opts?.onText?.({text});
    return {text, truncated: false};
  };

  const caps: Record<string, unknown> = {
    db: {collection, doc: (p: string) => docRef(p.split('/').pop() as string)},
    user: {id: async () => uid, isOwner: () => true, canEdit: () => true, can: () => true},
    mcp,
    sample,
  };
  (window as any).claude = {use: async (name: string) => caps[name] ?? null};
  (window as any).__DHA_STANDALONE__ = {
    importDocs: async (docs: Record<string, unknown>) => {
      const rows = Object.entries(docs).map(([key, data]) => ({user_id: uid, key, data, updated_at: new Date().toISOString()}));
      for (let i = 0; i < rows.length; i += 200) {
        const {error} = await supabase.from('docs').upsert(rows.slice(i, i + 200));
        if (error) throw error;
      }
      rows.forEach((r) => cache.set(r.key, r.data));
      notify();
      return rows.length;
    },
    getCalendars: () => (Array.isArray(cache.get('calendars')?.items) ? cache.get('calendars').items : DEFAULT_CALENDARS),
    saveCalendars: (items: Array<{name: string; url: string}>) => docRef('calendars').set({items}),
    setPassword: async (password: string) => {
      const {error} = await supabase.auth.updateUser({password});
      if (error) throw error;
    },
    signOut: () => supabase.auth.signOut().then(() => location.reload()),
    email: session.user.email,

    // ---- reminders (Web Push) ----
    push: {
      supported: () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window,
      permission: () => ('Notification' in window ? Notification.permission : 'denied'),
      get: (): PushDoc => ({subs: [], reminders: {}, ...(cache.get('push') || {})}),
      endpoint: async () => {
        const reg = await navigator.serviceWorker.ready;
        return (await reg.pushManager.getSubscription())?.endpoint || null;
      },
      enable: async () => {
        if ((await Notification.requestPermission()) !== 'granted') throw {code: 'denied'};
        const {data, error} = await supabase.functions.invoke('push-reminders', {body: {action: 'key'}});
        if (error || !data?.key) throw {code: 'server'};
        const reg = await navigator.serviceWorker.ready;
        const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({userVisibleOnly: true, applicationServerKey: b64url(data.key)}));
        const json = sub.toJSON();
        await ready;
        const cur: PushDoc = {subs: [], reminders: {}, ...(cache.get('push') || {})};
        const reminders = Object.keys(cur.reminders).length ? cur.reminders : DEFAULT_REMINDERS;
        await docRef('push').set({...cur, reminders, subs: [...cur.subs.filter((s) => s.endpoint !== json.endpoint), json]});
      },
      disable: async () => {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        const cur: PushDoc = {subs: [], reminders: {}, ...(cache.get('push') || {})};
        if (sub) {
          await docRef('push').set({...cur, subs: cur.subs.filter((s) => s.endpoint !== sub.endpoint)});
          await sub.unsubscribe().catch(() => {});
        }
      },
      saveReminders: (reminders: PushDoc['reminders']) => {
        const cur: PushDoc = {subs: [], reminders: {}, ...(cache.get('push') || {})};
        return docRef('push').set({...cur, reminders});
      },
      test: async () => {
        const {data, error} = await supabase.functions.invoke('push-reminders', {body: {action: 'test'}});
        if (error) throw {code: 'server'};
        return Number(data?.sent || 0);
      },
    },

    // ---- weekly server backup (doc_backups table, filled by pg_cron) ----
    latestBackup: async (): Promise<{created_at: string; data: Record<string, unknown>} | null> => {
      const {data, error} = await supabase.from('doc_backups').select('created_at,data').order('created_at', {ascending: false}).limit(1).maybeSingle();
      if (error) throw {code: 'not_ready', message: error.message};
      return data;
    },
  };
}
