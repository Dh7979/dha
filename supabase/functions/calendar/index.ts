// Supabase Edge Function: today's events from the signed-in user's Google Calendar iCal
// addresses. The addresses live in the user's own `docs` row (key "calendars"), so they are
// read with the caller's JWT under Row Level Security and never reach the browser again.
import {createClient} from 'npm:@supabase/supabase-js@2';
import ICAL from 'npm:ical.js@2';
import {eventsOn} from './ics.ts';

export const DEFAULT_CALENDARS = [
  {
    name: '대한민국의 휴일',
    url: 'https://calendar.google.com/calendar/ical/ko.south_korea%23holiday%40group.v.calendar.google.com/public/basic.ics',
  },
];
// Only Google Calendar feeds are fetched, so a stored address can't point the server anywhere else.
const ALLOWED = /^https:\/\/calendar\.google\.com\/calendar\/ical\//;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', {headers: cors});
  try {
    const {date, index} = await req.json();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date)) || !Number.isInteger(index)) {
      return Response.json({error: 'bad_request'}, {status: 400, headers: cors});
    }
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: {headers: {Authorization: req.headers.get('Authorization') ?? ''}},
    });
    const {data: auth} = await supabase.auth.getUser();
    if (!auth?.user) return Response.json({error: 'unauthorized'}, {status: 401, headers: cors});
    const {data: row} = await supabase.from('docs').select('data').eq('user_id', auth.user.id).eq('key', 'calendars').maybeSingle();
    const list: Array<{name: string; url: string}> = Array.isArray(row?.data?.items) ? row!.data.items : DEFAULT_CALENDARS;
    const cal = list[index];
    if (!cal || !ALLOWED.test(cal.url)) return Response.json({error: 'not_found'}, {status: 404, headers: cors});
    const r = await fetch(cal.url);
    if (!r.ok) return Response.json({error: 'feed', status: r.status}, {status: 502, headers: cors});
    const events = eventsOn(ICAL, await r.text(), date);
    return Response.json({events}, {headers: cors});
  } catch {
    return Response.json({error: 'internal'}, {status: 500, headers: cors});
  }
});
