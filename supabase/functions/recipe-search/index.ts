// Procurar receitas na internet (Teleculinária, pela pesquisa pública do site).
// POST { q, page } com a sessão do utilizador → { results: [{ title, url, source, airfryer }], more }
import { createClient } from 'npm:@supabase/supabase-js@2';
import { decodeEntities } from '../_shared/recipe-parse.js';

const PER_PAGE = 30;
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

type Hit = { title?: string; url?: string };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return json({ error: 'Entra com a tua conta para procurar receitas.' }, 401);

    const body = await req.json().catch(() => ({}));
    const q = String(body.q || '').trim().slice(0, 80);
    const page = Math.min(Math.max(1, Number(body.page) || 1), 10);
    if (q.length < 2) return json({ error: 'Escreve pelo menos 2 letras.' }, 400);

    const url = new URL('https://teleculinaria.pt/wp-json/wp/v2/search');
    url.searchParams.set('search', q);
    url.searchParams.set('per_page', String(PER_PAGE));
    url.searchParams.set('page', String(page));
    const res = await fetch(url, {
      signal: AbortSignal.timeout(12000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PortalDaFamilia/1.0; receitas para uso familiar)', Accept: 'application/json' },
    });
    // O WordPress responde 400 quando se pede uma página a mais: não há mais resultados.
    if (res.status === 400) return json({ results: [], more: false });
    if (!res.ok) return json({ error: `A pesquisa falhou (${res.status}). Tenta daqui a pouco.` }, 502);

    const hits = (await res.json()) as Hit[];
    const seen = new Set<string>();
    const results = hits
      .filter((h) => h.url && /^https:\/\/teleculinaria\.pt\/receitas\/[^/]+\/?$/.test(h.url))
      .filter((h) => !seen.has(h.url!) && seen.add(h.url!))
      .map((h) => {
        const title = decodeEntities(String(h.title || '').replace(/<[^>]*>/g, '')).trim();
        return { title, url: h.url!, source: 'Teleculinária', airfryer: /air\s?-?fr[yi]er|airfryer/i.test(title) };
      });
    const totalPages = Number(res.headers.get('x-wp-totalpages') || 0);
    return json({ results, more: totalPages ? page < totalPages : hits.length === PER_PAGE });
  } catch (e) {
    console.error('recipe-search', String(e));
    return json({ error: 'Não foi possível procurar agora. Verifica a ligação e tenta outra vez.' }, 502);
  }
});
