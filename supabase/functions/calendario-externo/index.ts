// Calendários de fora (Google Calendar, Outlook, iCloud…) na Agenda do portal. Só leitura: o portal não escreve lá.
// POST com a sessão do utilizador:
//   { action: 'list' }                       → { calendars, events } (actualiza os que têm mais de 30 minutos)
//   { action: 'add', url, name, share }      → junta um calendário (link .ics / "endereço secreto no formato iCal")
//   { action: 'update', id, name?, share? }  · { action: 'remove', id } · { action: 'refresh', id }
// O link é secreto: fica só no servidor (tabela ext_calendars, sem acesso directo) e nunca volta para a app.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { eventsBetween, calendarName, safeUrl } from '../_shared/ics-import.js';

const STALE_MS = 30 * 60 * 1000;
const MAX_PER_USER = 6;
const MAX_BYTES = 5 * 1024 * 1024;
const SHARES = ['me', 'parents', 'family'];

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

/** Descarrega o .ics (segue até 3 redireccionamentos, sempre para servidores públicos). */
async function download(url: string): Promise<string> {
  let next = url;
  for (let hop = 0; hop < 4; hop++) {
    const res = await fetch(next, { redirect: 'manual', signal: AbortSignal.timeout(12_000), headers: { 'User-Agent': 'PortalDaFamilia/1.0 (calendario)' } });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      const to = safeUrl(new URL(res.headers.get('location')!, next).toString());
      if (!to) throw new Friendly('O link redirecciona para um endereço que não é permitido.');
      next = to;
      continue;
    }
    if (res.status === 404 || res.status === 401 || res.status === 403) {
      throw new Friendly('O calendário não respondeu (link errado ou já não é válido). No Google, copiem outra vez o "Endereço secreto no formato iCal".');
    }
    if (!res.ok) throw new Friendly(`O servidor do calendário respondeu com erro (${res.status}). Tentem mais tarde.`);
    const len = Number(res.headers.get('content-length') || 0);
    if (len > MAX_BYTES) throw new Friendly('O calendário é demasiado grande.');
    const text = await res.text();
    if (text.length > MAX_BYTES) throw new Friendly('O calendário é demasiado grande.');
    if (!/BEGIN:VCALENDAR/i.test(text)) throw new Friendly('Este link não é de um calendário (.ics). No Google, usem o "Endereço secreto no formato iCal".');
    return text;
  }
  throw new Friendly('O link redirecciona demasiadas vezes.');
}

const lisbonToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(new Date());
const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const windowOf = () => { const t = lisbonToday(); return { from: addDays(t, -35), to: addDays(t, 400) }; };

// deno-lint-ignore no-explicit-any
async function refresh(row: any) {
  const { from, to } = windowOf();
  try {
    const text = await download(row.url);
    const events = eventsBetween(text, from, to, { max: 3000 });
    const upd = { events, fetched_at: new Date().toISOString(), error: null };
    await admin.from('ext_calendars').update(upd).eq('id', row.id);
    return { ...row, ...upd };
  } catch (e) {
    const error = e instanceof Friendly ? e.message : 'Não consegui ler o calendário agora. Volto a tentar mais tarde.';
    if (!(e instanceof Friendly)) console.error('calendario-externo', row.id, String(e).slice(0, 200));
    const upd = { fetched_at: new Date().toISOString(), error };
    await admin.from('ext_calendars').update(upd).eq('id', row.id);
    return { ...row, ...upd };
  }
}

// deno-lint-ignore no-explicit-any
const publicCal = (r: any, userId: string) => ({
  id: r.id, name: r.name, member: r.member_id, share: r.share, mine: r.user_id === userId,
  fetchedAt: r.fetched_at, error: r.error, host: (() => { try { return new URL(r.url).hostname; } catch { return ''; } })(), count: (r.events || []).length,
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return json({ error: 'Entrem com a vossa conta.' }, 401);
    const { data: profile } = await admin.from('profiles').select('family_id, member_id, role').eq('user_id', user.id).maybeSingle();
    if (!profile) return json({ error: 'Conta sem família.' }, 403);
    const parent = profile.role === 'parent';
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || 'list');

    const own = async (id: string) => {
      const { data } = await admin.from('ext_calendars').select('*').eq('id', id).eq('user_id', user.id).maybeSingle();
      if (!data) throw new Friendly('Calendário não encontrado (só quem o juntou o pode mudar).');
      return data;
    };

    if (action === 'add') {
      const url = safeUrl(body.url);
      if (!url) return json({ error: 'O link tem de começar por https:// (ou webcal://). No Google: "Endereço secreto no formato iCal".' }, 400);
      const { count } = await admin.from('ext_calendars').select('id', { count: 'exact', head: true }).eq('user_id', user.id);
      if ((count || 0) >= MAX_PER_USER) return json({ error: `No máximo ${MAX_PER_USER} calendários por pessoa.` }, 400);
      const { data: dup } = await admin.from('ext_calendars').select('id').eq('user_id', user.id).eq('url', url).maybeSingle();
      if (dup) return json({ error: 'Este calendário já está ligado.' }, 400);
      const text = await download(url);
      const { from, to } = windowOf();
      const events = eventsBetween(text, from, to, { max: 3000 });
      const name = String(body.name || '').trim().slice(0, 60) || calendarName(text).slice(0, 60) || 'Google Calendar';
      const share = SHARES.includes(body.share) ? body.share : 'parents';
      const { error } = await admin.from('ext_calendars').insert({
        family_id: profile.family_id, user_id: user.id, member_id: profile.member_id || '', name, url, share,
        events, fetched_at: new Date().toISOString(),
      });
      if (error) throw error;
    } else if (action === 'update') {
      const row = await own(String(body.id));
      const upd: Record<string, string> = {};
      if (body.name != null && String(body.name).trim()) upd.name = String(body.name).trim().slice(0, 60);
      if (SHARES.includes(body.share)) upd.share = body.share;
      await admin.from('ext_calendars').update(upd).eq('id', row.id);
    } else if (action === 'remove') {
      const row = await own(String(body.id));
      await admin.from('ext_calendars').delete().eq('id', row.id);
    } else if (action === 'refresh') {
      await refresh(await own(String(body.id)));
    } else if (action !== 'list') {
      return json({ error: 'Pedido desconhecido.' }, 400);
    }

    // Os calendários que esta pessoa pode ver (os seus, os da família e, para os pais, os partilhados com os pais).
    const { data: rows, error } = await admin.from('ext_calendars').select('*').eq('family_id', profile.family_id).order('created_at');
    if (error) throw error;
    const visible = (rows || []).filter((r) => r.user_id === user.id || r.share === 'family' || (r.share === 'parents' && parent));
    const now = Date.now();
    const fresh = await Promise.all(visible.map((r) => (action === 'list' && (!r.fetched_at || now - Date.parse(r.fetched_at) > STALE_MS) ? refresh(r) : r)));
    const events = fresh.flatMap((r) => (r.events || []).map((e: Record<string, unknown>) => ({ ...e, cal: r.id })));
    return json({ calendars: fresh.map((r) => publicCal(r, user.id)), events });
  } catch (e) {
    if (e instanceof Friendly) return json({ error: e.message }, 400);
    console.error('calendario-externo', String(e).slice(0, 300));
    return json({ error: 'Não consegui tratar do calendário. Tentem outra vez.' }, 500);
  }
});
