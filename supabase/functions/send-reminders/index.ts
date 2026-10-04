// Envia os lembretes da família por notificação (Web Push).
// - Chamada pelo pg_cron de 10 em 10 minutos, com o cabeçalho x-cron-secret.
//   Também paga as mesadas do dia (movimentos com id fixo: nunca paga duas vezes).
// - Chamada pela app com { test: true } (utilizador autenticado) para enviar uma notificação de teste.
// - Chamada pela app com { announce: 'shopping', minutes, store } para avisar a família "Vou às compras".
// - Chamada pela app com { announce: 'added', ids } quando alguém junta produtos à lista de compras.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { importVapidKeys, sendPush } from '../_shared/webpush.js';
import { additionsNotice, allowanceNotices, computeAllowances, computeReminders, lisbonNow, shoppingNotice } from '../_shared/reminders.js';

const SUBJECT = 'https://pessoalpinto-wq.github.io/Portal-da-Fam-lia-/';
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

type Sub = { id: string; user_id: string; family_id: string; endpoint: string; p256dh: string; auth: string };

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

async function loadConfig() {
  const { data, error } = await admin.rpc('get_push_config');
  if (error || !data) throw new Error(`Configuração em falta: ${error?.message}`);
  const vapid = await importVapidKeys({ publicKey: data.portal_vapid_public, privateKey: data.portal_vapid_private });
  return { vapid, cronSecret: data.portal_cron_secret as string };
}

/** Envia para todos os aparelhos; remove os que já não existem. */
async function deliver(subs: Sub[], payload: Record<string, unknown>, vapid: unknown) {
  let sent = 0;
  await Promise.all(subs.map(async (s) => {
    try {
      const status = await sendPush(s, payload, vapid, { subject: SUBJECT });
      if (status === 404 || status === 410) {
        await admin.from('push_subscriptions').delete().eq('id', s.id);
      } else if (status >= 200 && status < 300) {
        sent++;
      } else {
        console.warn('push falhou', status, new URL(s.endpoint).host);
      }
    } catch (e) {
      console.warn('push erro', String(e));
    }
  }));
  return sent;
}

async function familyState(familyId: string) {
  const state: Record<string, unknown[]> = {};
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from('items').select('coll,data')
      .eq('family_id', familyId).eq('deleted', false)
      .in('coll', ['members', 'events', 'tasks', 'exams', 'trips', 'redemptions', 'classes',
        'docs', 'bills', 'dates', 'health', 'polls', 'votes', 'allowances', 'shopping', 'pantry', 'shopreqs', 'shoptrip',
        'faccounts', 'fsnaps', 'ftx', 'fbudgets'])
      .order('coll').order('id').range(from, from + 999);
    if (error) throw error;
    data.forEach((r) => { (state[r.coll] ||= []).push(r.data); });
    if (data.length < 1000) return state;
  }
}

/** Paga as mesadas de hoje; devolve só as que foram criadas agora. */
async function payAllowances(familyId: string, state: Record<string, unknown[]>, now: { date: string; minutes: number }) {
  const due = computeAllowances({ state, now });
  if (!due.length) return [];
  const { data, error } = await admin.from('items')
    .upsert(due.map((a) => ({ family_id: familyId, coll: 'money', id: a.id, data: a.data })),
      { onConflict: 'family_id,coll,id', ignoreDuplicates: true })
    .select('id');
  if (error) throw error;
  const created = new Set((data || []).map((x) => x.id));
  return due.filter((a) => created.has(a.id));
}

async function runReminders(vapid: unknown) {
  const [{ data: subs, error }, { data: families, error: famErr }] = await Promise.all([
    admin.from('push_subscriptions').select('*'),
    admin.from('families').select('id'),
  ]);
  if (error) throw error;
  if (famErr) throw famErr;
  const byFamily = new Map<string, Sub[]>();
  (subs as Sub[]).forEach((s) => byFamily.set(s.family_id, [...(byFamily.get(s.family_id) || []), s]));
  const now = lisbonNow();
  const summary = { families: families.length, allowances: 0, candidates: 0, new: 0, delivered: 0, now };

  for (const { id: familyId } of families) {
    const famSubs = byFamily.get(familyId) || [];
    const [{ data: profiles }, state] = await Promise.all([
      admin.from('profiles').select('user_id, member_id, role, notify').eq('family_id', familyId),
      familyState(familyId),
    ]);
    const paid = await payAllowances(familyId, state, now);
    summary.allowances += paid.length;
    if (!famSubs.length) continue;

    const withDevice = new Set(famSubs.map((s) => s.user_id));
    const reminders = [...computeReminders({ state, profiles: profiles || [], now }), ...allowanceNotices(paid, profiles || [])]
      .filter((r) => withDevice.has(r.userId));
    summary.candidates += reminders.length;
    if (!reminders.length) continue;

    // Regista primeiro: só envia o que ainda não tinha sido registado.
    const { data: fresh, error: logErr } = await admin.from('notification_log')
      .upsert(reminders.map((r) => ({ key: r.key, family_id: familyId })), { onConflict: 'key', ignoreDuplicates: true })
      .select('key');
    if (logErr) throw logErr;
    const freshKeys = new Set((fresh || []).map((x) => x.key));
    const todo = reminders.filter((r) => freshKeys.has(r.key));
    summary.new += todo.length;

    for (const r of todo) {
      summary.delivered += await deliver(famSubs.filter((s) => s.user_id === r.userId),
        { title: r.title, body: r.body, url: r.url, tag: r.tag }, vapid);
    }
  }
  return summary;
}

/** "Vou às compras": avisa já o resto da família (no máximo um aviso por pessoa a cada 10 minutos). */
async function announceShopping(userId: string, body: { minutes?: number; store?: string }, vapid: unknown) {
  const { data: me } = await admin.from('profiles').select('family_id').eq('user_id', userId).maybeSingle();
  if (!me) return { error: 'Sem família' };
  const now = lisbonNow();
  const key = `shop:${userId}:${now.date}:${Math.floor(now.minutes / 10)}`;
  const { data: fresh, error: logErr } = await admin.from('notification_log')
    .upsert([{ key, family_id: me.family_id }], { onConflict: 'key', ignoreDuplicates: true }).select('key');
  if (logErr) throw logErr;
  if (!fresh?.length) return { repeated: true, people: 0, sent: 0 };

  const [{ data: profiles }, state] = await Promise.all([
    admin.from('profiles').select('user_id, member_id, role, notify').eq('family_id', me.family_id),
    familyState(me.family_id),
  ]);
  const n = shoppingNotice({ state, profiles: profiles || [], senderId: userId, minutes: body.minutes, store: body.store, now });
  if (!n.userIds.length) return { people: 0, sent: 0 };
  const { data: subs } = await admin.from('push_subscriptions').select('*').in('user_id', n.userIds);
  const sent = await deliver((subs || []) as Sub[], { title: n.title, body: n.body, url: n.url, tag: n.tag }, vapid);
  return { people: new Set((subs || []).map((s) => s.user_id)).size, sent };
}

/**
 * Produtos acabados de juntar à lista: avisa quem está às compras e quem ligou "Novos produtos na lista".
 * Só conta produtos desta pessoa, por comprar e gravados há menos de 30 minutos; cada produto
 * é avisado no máximo uma vez a cada pessoa (notification_log).
 */
async function announceAdded(userId: string, body: { ids?: unknown }, vapid: unknown) {
  const ids = (Array.isArray(body.ids) ? body.ids : []).map(String).filter((x) => /^[\w-]{1,64}$/.test(x)).slice(0, 50);
  if (!ids.length) return { people: 0, sent: 0 };
  const { data: me } = await admin.from('profiles').select('family_id, member_id').eq('user_id', userId).maybeSingle();
  if (!me) return { error: 'Sem família' };
  const since = new Date(Date.now() - 30 * 60000).toISOString();
  const { data: rows, error } = await admin.from('items').select('id, data, updated_at')
    .eq('family_id', me.family_id).eq('coll', 'shopping').eq('deleted', false).in('id', ids).gt('updated_at', since);
  if (error) throw error;
  const items = (rows || []).map((r) => r.data as { id: string; text: string; qty?: string; done?: boolean; addedBy?: string })
    .filter((d) => d && !d.done && d.addedBy === me.member_id && d.text);
  if (!items.length) return { people: 0, sent: 0 };

  const [{ data: profiles }, state] = await Promise.all([
    admin.from('profiles').select('user_id, member_id, role, notify').eq('family_id', me.family_id),
    familyState(me.family_id),
  ]);
  const notices = additionsNotice({ state, profiles: profiles || [], senderId: userId, items, nowMs: Date.now() });
  let sent = 0;
  let people = 0;
  for (const n of notices) {
    // Regista primeiro: só avisa dos produtos de que esta pessoa ainda não sabia.
    const { data: fresh, error: logErr } = await admin.from('notification_log')
      .upsert(n.itemIds.map((id: string) => ({ key: `add:${id}:${n.userId}`, family_id: me.family_id })), { onConflict: 'key', ignoreDuplicates: true })
      .select('key');
    if (logErr) throw logErr;
    const freshIds = new Set((fresh || []).map((x) => x.key.split(':')[1]));
    const mine = items.filter((i) => freshIds.has(i.id));
    if (!mine.length) continue;
    const [msg] = mine.length === items.length ? [n]
      : additionsNotice({ state, profiles: (profiles || []).filter((p) => p.user_id === n.userId || p.user_id === userId), senderId: userId, items: mine, nowMs: Date.now() });
    if (!msg) continue;
    const { data: subs } = await admin.from('push_subscriptions').select('*').eq('user_id', n.userId);
    if (subs?.length) people++;
    sent += await deliver((subs || []) as Sub[], { title: msg.title, body: msg.body, url: '#/compras', tag: 'compras-novos' }, vapid);
  }
  return { people, sent };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const { vapid, cronSecret } = await loadConfig();

    if (req.headers.get('x-cron-secret') === cronSecret) {
      const summary = await runReminders(vapid);
      console.log('lembretes', JSON.stringify(summary));
      return json(summary);
    }

    // Notificação de teste pedida pela app.
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return json({ error: 'Não autorizado' }, 401);
    const body = await req.json().catch(() => ({}));
    if (body.announce === 'shopping') return json(await announceShopping(user.id, body, vapid));
    if (body.announce === 'added') return json(await announceAdded(user.id, body, vapid));
    if (!body.test) return json({ error: 'Pedido inválido' }, 400);
    const { data: subs } = await admin.from('push_subscriptions').select('*').eq('user_id', user.id);
    const sent = await deliver((subs || []) as Sub[], {
      title: '🔔 Notificações ligadas!', body: 'É assim que vão aparecer os lembretes do Portal da Família.', url: '#/definicoes', tag: 'teste',
    }, vapid);
    return json({ devices: subs?.length || 0, sent });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});
