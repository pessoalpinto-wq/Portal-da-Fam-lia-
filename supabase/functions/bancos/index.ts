// Ligação aos bancos por open banking (PSD2), através do Enable Banking (https://enablebanking.com).
// Os movimentos das contas ligadas entram sozinhos no 🎯 Orçamento (colecção ftx), classificados e sem repetir.
//
// Chamada pelo pg_cron uma vez por dia (cabeçalho x-cron-secret): sincroniza todas as ligações activas.
// Chamada pela app (só pais), POST { action, ... }:
//   { action: 'list' }                          → { configured, links }
//   { action: 'banks', country? }               → { banks: [{ name, country, logo, days }] }
//   { action: 'start', bank, country?, redirect } → { url } (abrir no navegador: autorização no próprio banco)
//   { action: 'finish', code, state }           → { link } (o banco voltou ao portal com ?code=&state=)
//   { action: 'map', id, accounts: [{ uid, account }] } → { link } (que conta do portal é cada conta do banco)
//   { action: 'sync', id? }                     → { added, dup } (ir buscar agora)
//   { action: 'remove', id }                    → { ok } (acaba com o consentimento no banco)
//
// Segredos das Edge Functions: ENABLE_BANKING_APP_ID (id da aplicação) e ENABLE_BANKING_PRIVATE_KEY (o .pem).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { accountLabel, accountRef, consentState, planSync, suggestAccount, syncFrom } from '../_shared/bancos.js';

const API = 'https://api.enablebanking.com';
const MAX_DAYS = 180;
const MAX_PAGES = 30;

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

class Friendly extends Error {}
class Expired extends Error {}

const lisbonToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(new Date());

/* ---------- Autenticação no Enable Banking (JWT RS256 assinado com a chave da aplicação) ---------- */
const b64url = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf as ArrayBuffer)))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const utf8 = (s: string) => new TextEncoder().encode(s);

/** DER: comprimento. */
const derLen = (n: number) => (n < 128 ? [n] : n < 256 ? [0x81, n] : n < 65536 ? [0x82, n >> 8, n & 255] : [0x83, n >> 16, (n >> 8) & 255, n & 255]);
/** Chave "BEGIN RSA PRIVATE KEY" (PKCS#1) → PKCS#8, que é o que o WebCrypto aceita. */
function pkcs1to8(pkcs1: Uint8Array): Uint8Array<ArrayBuffer> {
  const algo = [0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00];
  const octet = [0x04, ...derLen(pkcs1.length)];
  const body = [0x02, 0x01, 0x00, ...algo, ...octet];
  const total = body.length + pkcs1.length;
  const out = new Uint8Array([0x30, ...derLen(total), ...body, ...pkcs1]);
  return out;
}

let keyCache: CryptoKey | null = null;
async function signingKey(): Promise<CryptoKey> {
  if (keyCache) return keyCache;
  const pem = (Deno.env.get('ENABLE_BANKING_PRIVATE_KEY') || '').replace(/\\n/g, '\n');
  const isPkcs1 = /BEGIN RSA PRIVATE KEY/.test(pem);
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  if (!b64) throw new Friendly('Falta configurar a ligação aos bancos (chave do Enable Banking).');
  const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const der = isPkcs1 ? pkcs1to8(raw) : raw;
  keyCache = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  return keyCache;
}

async function token(): Promise<string> {
  const appId = Deno.env.get('ENABLE_BANKING_APP_ID') || '';
  if (!appId) throw new Friendly('Falta configurar a ligação aos bancos (id da aplicação do Enable Banking).');
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(utf8(JSON.stringify({ typ: 'JWT', alg: 'RS256', kid: appId })));
  const body = b64url(utf8(JSON.stringify({ iss: 'enablebanking.com', aud: 'api.enablebanking.com', iat: now, exp: now + 3600 })));
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', await signingKey(), utf8(`${head}.${body}`));
  return `${head}.${body}.${b64url(sig)}`;
}

// deno-lint-ignore no-explicit-any
async function eb(method: string, path: string, body?: unknown): Promise<any> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  const text = await res.text();
  // deno-lint-ignore no-explicit-any
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { message: text }; }
  if (res.ok) return data;
  const msg = String(data?.message || data?.detail || data?.error || res.statusText).slice(0, 300);
  console.error('enablebanking', method, path, res.status, msg);
  if (res.status === 401 && /session|consent|expired|revoked|invalid/i.test(msg) && !path.startsWith('/aspsps')) throw new Expired(msg);
  if (res.status === 403 && /session|consent|expired|revoked/i.test(msg)) throw new Expired(msg);
  if (res.status === 429) throw new Friendly('O banco só deixa ir buscar movimentos algumas vezes por dia. Tentem amanhã.');
  throw new Friendly(`O Enable Banking respondeu com erro (${res.status}): ${msg}`);
}

/* ---------- Dados da família ---------- */
// deno-lint-ignore no-explicit-any
type Item = { coll: string; id: string; data: any; deleted: boolean };

async function familyItems(familyId: string): Promise<Item[]> {
  const out: Item[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from('items').select('coll, id, data, deleted')
      .eq('family_id', familyId).in('coll', ['ftx', 'frules', 'faccounts']).range(from, from + 999);
    if (error) throw error;
    out.push(...(data || []) as Item[]);
    if (!data || data.length < 1000) break;
  }
  return out;
}

// deno-lint-ignore no-explicit-any
const publicLink = (r: any) => ({
  id: r.id, bank: r.bank, country: r.country, status: r.status, validUntil: r.valid_until, consent: consentState(r.valid_until),
  accounts: r.accounts || [], lastSync: r.last_sync, syncedAt: r.synced_at, error: r.last_error,
});

/* ---------- Ir buscar movimentos ---------- */
// deno-lint-ignore no-explicit-any
async function fetchTransactions(uid: string, from: string): Promise<any[]> {
  // deno-lint-ignore no-explicit-any
  const all: any[] = [];
  let key = '';
  for (let page = 0; page < MAX_PAGES; page++) {
    const q = new URLSearchParams({ date_from: from });
    if (key) q.set('continuation_key', key);
    const data = await eb('GET', `/accounts/${encodeURIComponent(uid)}/transactions?${q}`);
    all.push(...(data?.transactions || []));
    key = data?.continuation_key || '';
    if (!key) break;
  }
  return all;
}

// deno-lint-ignore no-explicit-any
async function syncLink(link: any): Promise<{ added: number; dup: number }> {
  if (link.status !== 'active' || !link.session_id) return { added: 0, dup: 0 };
  if (consentState(link.valid_until) === 'expired') {
    await admin.from('bank_links').update({ status: 'expired', last_error: 'A autorização do banco acabou. Liguem outra vez.' }).eq('id', link.id);
    return { added: 0, dup: 0 };
  }
  const today = lisbonToday();
  const items = await familyItems(link.family_id);
  // Os apagados também contam (para não voltarem a entrar), mas ficam marcados para não entrarem nas contas.
  const ftx = items.filter((i) => i.coll === 'ftx').map((i) => (i.deleted ? { ...i.data, _deleted: true } : i.data));
  const rules = items.filter((i) => i.coll === 'frules' && !i.deleted).map((i) => i.data);
  const accs = items.filter((i) => i.coll === 'faccounts' && !i.deleted);
  let added = 0;
  let dup = 0;
  const touched = new Set<string>();
  try {
    // deno-lint-ignore no-explicit-any
    for (const a of (link.accounts || []) as any[]) {
      const acc = accs.find((x) => x.id === a.account);
      if (!acc || acc.data.archived) continue;
      const txs = await fetchTransactions(a.uid, syncFrom({ lastSync: link.last_sync, today }));
      const kind = acc.data.kind;
      const { fresh, dup: d } = planSync(ftx, txs, acc.id, rules, { card: kind === 'cartao', meal: kind === 'refeicao' });
      dup += d;
      if (fresh.length) {
        // deno-lint-ignore no-explicit-any
        const rows = fresh.map((t: any) => ({ family_id: link.family_id, coll: 'ftx', id: t.id, data: t, deleted: false, client_id: 'bancos' }));
        const { error } = await admin.from('items').upsert(rows, { onConflict: 'family_id,coll,id', ignoreDuplicates: true });
        if (error) throw error;
        ftx.push(...fresh);
        added += fresh.length;
        touched.add(acc.id);
      }
    }
  } catch (e) {
    const expired = e instanceof Expired;
    await admin.from('bank_links').update({
      status: expired ? 'expired' : link.status,
      last_error: expired ? 'A autorização do banco acabou ou foi cancelada. Liguem outra vez.' : String((e as Error).message || e).slice(0, 300),
    }).eq('id', link.id);
    if (added) await afterImport(link.family_id, ftx, accs, touched, today);
    throw e;
  }
  await afterImport(link.family_id, ftx, accs, touched, today);
  await admin.from('bank_links').update({ last_sync: today, synced_at: new Date().toISOString(), last_error: null }).eq('id', link.id);
  return { added, dup };
}

/** Como na importação de extratos: marca transferências entre as vossas contas e guarda o dia da última importação. */
// deno-lint-ignore no-explicit-any
async function afterImport(familyId: string, ftx: any[], accs: Item[], touched: Set<string>, today: string) {
  if (!touched.size) return;
  const O = (globalThis as any).Orcamento;
  const live = ftx.filter((t) => t && !t._deleted && t.rule !== 'family');
  const ids = new Set<string>(O.findTransfers(live));
  const changed = ftx.filter((t) => !t._deleted && ids.has(t.id) && !t.manualCat && t.cat !== 'transferencias')
    .map((t) => ({ ...t, cat: 'transferencias', rule: 'transfer' }));
  const accRows = accs.filter((a) => touched.has(a.id)).map((a) => ({ ...a.data, lastImport: today }));
  const rows = [
    ...changed.map((t) => ({ family_id: familyId, coll: 'ftx', id: t.id, data: t, deleted: false, client_id: 'bancos' })),
    ...accRows.map((d) => ({ family_id: familyId, coll: 'faccounts', id: d.id, data: d, deleted: false, client_id: 'bancos' })),
  ];
  if (rows.length) await admin.from('items').upsert(rows, { onConflict: 'family_id,coll,id' });
}

async function runAll() {
  const { data: links } = await admin.from('bank_links').select('*').eq('status', 'active');
  let added = 0;
  let failed = 0;
  for (const l of links || []) {
    try { added += (await syncLink(l)).added; } catch (e) { failed++; console.error('sync', l.id, String(e)); }
  }
  return { links: links?.length || 0, added, failed };
}

/* ---------- Pedidos da app ---------- */
const configured = () => !!(Deno.env.get('ENABLE_BANKING_APP_ID') && Deno.env.get('ENABLE_BANKING_PRIVATE_KEY'));

function safeRedirect(u: unknown): string {
  try {
    const url = new URL(String(u || ''));
    if (url.protocol !== 'https:' && !/^(localhost|127\.0\.0\.1)$/.test(url.hostname)) return '';
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch { return ''; }
}

// deno-lint-ignore no-explicit-any
async function handle(me: { family_id: string; user_id: string }, body: any) {
  const fam = me.family_id;
  const one = async (id: string) => {
    const { data } = await admin.from('bank_links').select('*').eq('id', id).eq('family_id', fam).maybeSingle();
    if (!data) throw new Friendly('Ligação não encontrada.');
    return data;
  };

  switch (body.action) {
    case 'list': {
      const { data } = await admin.from('bank_links').select('*').eq('family_id', fam).neq('status', 'pending').order('created_at');
      return { configured: configured(), links: (data || []).map(publicLink) };
    }
    case 'banks': {
      const country = /^[A-Z]{2}$/.test(body.country || '') ? body.country : 'PT';
      const data = await eb('GET', `/aspsps?country=${country}&psu_type=personal&service=AIS`);
      // deno-lint-ignore no-explicit-any
      const banks = (data?.aspsps || []).map((b: any) => ({
        name: b.name, country: b.country, logo: b.logo || '', days: Math.round((b.maximum_consent_validity || 0) / 86400) || null,
      })).sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'pt'));
      return { banks };
    }
    case 'start': {
      const redirect = safeRedirect(body.redirect);
      if (!redirect) throw new Friendly('Endereço de regresso inválido.');
      const bank = String(body.bank || '').slice(0, 120);
      const country = /^[A-Z]{2}$/.test(body.country || '') ? body.country : 'PT';
      if (!bank) throw new Friendly('Escolham o banco.');
      const { count } = await admin.from('bank_links').select('id', { count: 'exact', head: true }).eq('family_id', fam);
      if ((count || 0) >= 12) throw new Friendly('Já há muitas ligações. Removam alguma antes.');
      const days = Math.min(MAX_DAYS, Math.max(1, Number(body.days) || MAX_DAYS));
      const state = crypto.randomUUID();
      const validUntil = new Date(Date.now() + days * 86400000).toISOString();
      await admin.from('bank_links').insert({ family_id: fam, created_by: me.user_id, bank, country, state, status: 'pending' });
      const data = await eb('POST', '/auth', {
        access: { valid_until: validUntil }, aspsp: { name: bank, country }, state, redirect_url: redirect, psu_type: 'personal',
      });
      if (!data?.url) throw new Friendly('O Enable Banking não devolveu o endereço do banco.');
      return { url: data.url };
    }
    case 'finish': {
      const { data: link } = await admin.from('bank_links').select('*').eq('state', String(body.state || '')).eq('family_id', fam).maybeSingle();
      if (!link) throw new Friendly('Este pedido de ligação já não é válido. Tentem outra vez.');
      if (link.status !== 'pending') return { link: publicLink(link) };
      const data = await eb('POST', '/sessions', { code: String(body.code || '') });
      const items = await familyItems(fam);
      const accs = items.filter((i) => i.coll === 'faccounts' && !i.deleted).map((i) => i.data);
      // deno-lint-ignore no-explicit-any
      const accounts = (data?.accounts || []).map((a: any) => ({
        uid: a.uid, label: accountLabel(a, link.bank), ref: accountRef(a), account: suggestAccount(accs, a, link.bank) || '',
      }));
      const { data: saved } = await admin.from('bank_links').update({
        session_id: data.session_id, valid_until: data.access?.valid_until || null, accounts, status: 'active', state: null, last_error: null,
      }).eq('id', link.id).select('*').single();
      return { link: publicLink(saved) };
    }
    case 'map': {
      const link = await one(body.id);
      const items = await familyItems(fam);
      const ids = new Set(items.filter((i) => i.coll === 'faccounts' && !i.deleted).map((i) => i.id));
      const want = new Map<string, string>(((body.accounts || []) as { uid: string; account: string }[]).map((a) => [a.uid, a.account]));
      // deno-lint-ignore no-explicit-any
      const accounts = (link.accounts || []).map((a: any) => {
        const next = want.has(a.uid) ? String(want.get(a.uid) || '') : a.account;
        return { ...a, account: next && ids.has(next) ? next : '' };
      });
      const { data: saved } = await admin.from('bank_links').update({ accounts }).eq('id', link.id).select('*').single();
      return { link: publicLink(saved) };
    }
    case 'sync': {
      const { data: links } = body.id
        ? await admin.from('bank_links').select('*').eq('id', body.id).eq('family_id', fam)
        : await admin.from('bank_links').select('*').eq('family_id', fam).eq('status', 'active');
      let added = 0;
      let dup = 0;
      for (const l of links || []) {
        const r = await syncLink(l);
        added += r.added;
        dup += r.dup;
      }
      return { added, dup };
    }
    case 'remove': {
      const link = await one(body.id);
      if (link.session_id) await eb('DELETE', `/sessions/${encodeURIComponent(link.session_id)}`).catch((e) => console.error('remove', String(e)));
      await admin.from('bank_links').delete().eq('id', link.id);
      return { ok: true };
    }
    default:
      throw new Friendly('Pedido inválido.');
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const cronHeader = req.headers.get('x-cron-secret');
    if (cronHeader) {
      const { data } = await admin.rpc('get_push_config');
      if (!data?.portal_cron_secret || cronHeader !== data.portal_cron_secret) return json({ error: 'Não autorizado' }, 401);
      const summary = await runAll();
      console.log('bancos', JSON.stringify(summary));
      return json(summary);
    }
    const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: { user } } = await admin.auth.getUser(jwt);
    if (!user) return json({ error: 'Não autorizado' }, 401);
    const { data: me } = await admin.from('profiles').select('family_id, role').eq('user_id', user.id).maybeSingle();
    if (!me || me.role !== 'parent') return json({ error: 'Só os pais podem ligar os bancos.' }, 403);
    const body = await req.json().catch(() => ({}));
    return json(await handle({ family_id: me.family_id, user_id: user.id }, body));
  } catch (e) {
    if (e instanceof Friendly || e instanceof Expired) return json({ error: e instanceof Expired ? 'A autorização do banco acabou. Liguem outra vez.' : e.message }, 400);
    console.error(e);
    return json({ error: 'Erro no servidor. Tentem mais tarde.' }, 500);
  }
});
