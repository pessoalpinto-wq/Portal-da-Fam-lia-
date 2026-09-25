// Importar uma receita de um site (Pingo Doce, Continente, 24Kitchen, blogs…) a partir do link.
// POST { url } com a sessão do utilizador → { recipe } | { error }
import { createClient } from 'npm:@supabase/supabase-js@2';
import { extractRecipe } from '../_shared/recipe-parse.js';

const MAX_BYTES = 3 * 1024 * 1024;
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

/** Só endereços públicos: nada de localhost, IPs ou nomes internos. */
function publicUrl(raw: string): URL | null {
  let u: URL;
  try { u = new URL(raw.trim()); } catch { return null; }
  if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password) return null;
  const h = u.hostname.toLowerCase();
  if (!h.includes('.') || h === 'localhost' || /^[\d.]+$/.test(h) || h.includes(':') || h.startsWith('[')
    || /\.(local|internal|localhost|lan|home|corp)$/.test(h) || h.endsWith('.supabase.co') || h.endsWith('.supabase.internal')) return null;
  if (u.port && !['80', '443'].includes(u.port)) return null;
  return u;
}

async function readLimited(res: Response) {
  const reader = res.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.length;
  }
  reader.cancel().catch(() => {});
  const all = new Uint8Array(size);
  let i = 0;
  chunks.forEach((c) => { all.set(c.subarray(0, Math.min(c.length, size - i)), i); i += c.length; });
  return new TextDecoder('utf-8').decode(all);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return json({ error: 'Entra com a tua conta para importar receitas.' }, 401);

    const { url } = await req.json().catch(() => ({}));
    const target = publicUrl(String(url || ''));
    if (!target) return json({ error: 'Link inválido. Copia o endereço completo da página da receita (https://…).' }, 400);

    const res = await fetch(target, {
      redirect: 'follow',
      signal: AbortSignal.timeout(12000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PortalDaFamilia/1.0; receitas para uso familiar)',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'pt-PT,pt;q=0.9',
      },
    });
    if (!publicUrl(res.url || target.href)) return json({ error: 'O site redireccionou para um endereço não permitido.' }, 400);
    if (!res.ok) return json({ error: `O site respondeu com erro (${res.status}). Tenta outro link.` }, 422);

    const recipe = extractRecipe(await readLimited(res), res.url || target.href);
    if (!recipe) {
      return json({ error: 'Não encontrei uma receita nesta página. Experimenta outro site, ou cria a receita à mão.' }, 422);
    }
    return json({ recipe: { ...recipe, source: target.href } });
  } catch (e) {
    const timeout = String(e).includes('Timeout') || String(e).includes('aborted');
    console.error('recipe-import', String(e));
    return json({ error: timeout ? 'O site demorou demasiado a responder.' : 'Não foi possível ler a página.' }, 502);
  }
});
