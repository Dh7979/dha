// DHA reminders over Web Push.
//  - POST {}                 (every 5 min from pg_cron): send each user's due reminders, once a day each.
//  - POST {action: 'key'}    : the public VAPID key the app subscribes with.
//  - POST {action: 'test'}   (signed-in user): send a test notification to that user's devices.
// Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY. SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are built in.
import {createClient} from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const PUB = Deno.env.get('VAPID_PUBLIC_KEY') || '';
const PRIV = Deno.env.get('VAPID_PRIVATE_KEY') || '';
const URL_ = Deno.env.get('SUPABASE_URL')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Rem = {on: boolean; time: string};
type Sub = {endpoint: string; keys: {p256dh: string; auth: string}};
type Msg = {title: string; body: string; url: string; tag: string};
// deno-lint-ignore no-explicit-any
type Docs = Record<string, any>;

const kst = () => {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false})
      .formatToParts(new Date())
      .map((x) => [x.type, x.value]),
  );
  const hour = p.hour === '24' ? '00' : p.hour;
  return {day: `${p.year}-${p.month}-${p.day}`, min: Number(hour) * 60 + Number(p.minute)};
};
const toMin = (t: string) => {
  const [h, m] = String(t || '').split(':').map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : -1;
};

/** What to say for one reminder, or null when there is nothing left to do. */
function message(kind: string, docs: Docs, day: string): Msg | null {
  const habits: Array<{name: string; slot?: string; log?: Record<string, unknown>}> = docs.habits?.items || [];
  const left = (slot: string) => habits.filter((h) => ((h.slot || 'any') === slot || (h.slot || 'any') === 'any') && !h.log?.[day]);
  if (kind === 'sleep') {
    if (docs.sleep?.days?.[day]) return null;
    return {title: '어젯밤 몇 시간 잤나요?', body: '잠든 시간과 일어난 시간만 남기면 돼요.', url: '/#record', tag: 'sleep'};
  }
  if (kind === 'morning' || kind === 'evening') {
    const l = left(kind);
    if (!l.length) return null;
    return {
      title: `${kind === 'morning' ? '아침' : '저녁'} 루틴 ${l.length}개가 남았어요`,
      body: l.slice(0, 3).map((h) => h.name).join(', ') + (l.length > 3 ? ' 외' : ''),
      url: '/#todo',
      tag: kind,
    };
  }
  if (kind === 'wrap') {
    if (docs['j-' + day]?.mood) return null;
    return {title: '오늘 하루는 어땠나요?', body: '기분 한 번, 쓴 돈 한 줄이면 하루 정리가 끝나요.', url: '/#record', tag: 'wrap'};
  }
  return null;
}

async function sendAll(subs: Sub[], msg: Msg) {
  const dead: string[] = [];
  await Promise.all(
    subs.map((s) =>
      webpush.sendNotification(s, JSON.stringify(msg), {TTL: 3600}).catch((e: {statusCode?: number}) => {
        if (e?.statusCode === 404 || e?.statusCode === 410) dead.push(s.endpoint);
        else console.error('push failed', e?.statusCode);
      }),
    ),
  );
  return dead;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', {headers: cors});
  const body = await req.json().catch(() => ({}));
  if (body?.action === 'key') return Response.json({key: PUB}, {headers: cors});
  if (!PUB || !PRIV) return Response.json({error: 'vapid_not_set'}, {status: 500, headers: cors});
  webpush.setVapidDetails('https://dha-alpha.vercel.app', PUB, PRIV);
  const admin = createClient(URL_, SERVICE, {auth: {persistSession: false}});

  if (body?.action === 'test') {
    const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const {data: u} = await admin.auth.getUser(jwt);
    if (!u?.user) return Response.json({error: 'signin'}, {status: 401, headers: cors});
    const {data} = await admin.from('docs').select('data').eq('user_id', u.user.id).eq('key', 'push').maybeSingle();
    const subs: Sub[] = data?.data?.subs || [];
    if (!subs.length) return Response.json({sent: 0}, {headers: cors});
    await sendAll(subs, {title: 'DHA 알림이 켜졌어요', body: '정한 시간에 이렇게 알려드릴게요.', url: '/', tag: 'test'});
    return Response.json({sent: subs.length}, {headers: cors});
  }

  // Scheduled run.
  const now = kst();
  const {data: rows, error} = await admin.from('docs').select('user_id,data').eq('key', 'push');
  if (error) return Response.json({error: error.message}, {status: 500, headers: cors});
  let sent = 0;
  for (const row of rows || []) {
    const cfg = row.data || {};
    const subs: Sub[] = Array.isArray(cfg.subs) ? cfg.subs : [];
    const reminders: Record<string, Rem> = cfg.reminders || {};
    if (!subs.length) continue;
    const due = Object.entries(reminders).filter(([, r]) => {
      const t = toMin(r?.time);
      return r?.on && t >= 0 && now.min >= t && now.min - t < 30;
    });
    if (!due.length) continue;
    const {data: sentDoc} = await admin.from('docs').select('data').eq('user_id', row.user_id).eq('key', 'push-sent').maybeSingle();
    const marks: Record<string, string> = sentDoc?.data || {};
    const todo = due.filter(([k]) => marks[k] !== now.day);
    if (!todo.length) continue;
    const month = now.day.slice(0, 7);
    const {data: docRows} = await admin
      .from('docs')
      .select('key,data')
      .eq('user_id', row.user_id)
      .in('key', ['habits', 'sleep', 'j-' + now.day, 'expenses-' + month]);
    const docs: Docs = Object.fromEntries((docRows || []).map((r) => [r.key, r.data]));
    let dead: string[] = [];
    for (const [k] of todo) {
      marks[k] = now.day;
      const msg = message(k, docs, now.day);
      if (!msg) continue;
      dead = dead.concat(await sendAll(subs, msg));
      sent++;
    }
    await admin.from('docs').upsert({user_id: row.user_id, key: 'push-sent', data: marks, updated_at: new Date().toISOString()});
    if (dead.length) {
      const alive = subs.filter((s) => !dead.includes(s.endpoint));
      await admin.from('docs').upsert({user_id: row.user_id, key: 'push', data: {...cfg, subs: alive}, updated_at: new Date().toISOString()});
    }
  }
  return Response.json({ok: true, sent}, {headers: cors});
});
