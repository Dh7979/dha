// Supabase Edge Function: receives the daily "오늘의 뉴스 TOP5" from the PC's scheduled task
// and stores it as the owner's `news` document. Called with the project's anon key plus a
// private x-news-token header (NEWS_TOKEN secret); writes with the service role on the server.
import {createClient} from 'npm:@supabase/supabase-js@2';

const CATS = ['economy', 'world', 'society', 'ai', 'marketing'];

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({error: 'method'}, {status: 405});
  const token = Deno.env.get('NEWS_TOKEN');
  if (!token || req.headers.get('x-news-token') !== token) return Response.json({error: 'forbidden'}, {status: 403});
  try {
    const news = await req.json();
    // Light validation: the page only reads these fields, and every link must be https.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(news?.date)) || typeof news?.categories !== 'object') {
      return Response.json({error: 'bad_news'}, {status: 400});
    }
    const categories: Record<string, unknown[]> = {};
    for (const k of CATS) {
      const items = Array.isArray(news.categories[k]) ? news.categories[k].slice(0, 5) : [];
      categories[k] = items
        .filter((n: any) => n && typeof n.title === 'string')
        .map((n: any) => ({
          title: String(n.title).slice(0, 120),
          summary: n.summary ? String(n.summary).slice(0, 200) : undefined,
          source: n.source ? String(n.source).slice(0, 60) : undefined,
          url: typeof n.url === 'string' && /^https:\/\//.test(n.url) ? n.url : undefined,
        }));
    }
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const email = (Deno.env.get('OWNER_EMAIL') || '').toLowerCase();
    const {data: list, error: le} = await admin.auth.admin.listUsers({page: 1, perPage: 200});
    if (le) throw le;
    const owner = list.users.find((u) => (u.email || '').toLowerCase() === email);
    if (!owner) return Response.json({error: 'owner_not_found'}, {status: 404});
    const data = {date: news.date, generatedAt: Number(news.generatedAt) || Date.now(), categories};
    const {error} = await admin.from('docs').upsert({user_id: owner.id, key: 'news', data, updated_at: new Date().toISOString()});
    if (error) throw error;
    return Response.json({ok: true, counts: Object.fromEntries(CATS.map((k) => [k, categories[k].length]))});
  } catch {
    return Response.json({error: 'internal'}, {status: 500});
  }
});
