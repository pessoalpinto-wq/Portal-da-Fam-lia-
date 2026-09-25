// Envia os lembretes da família por notificação (Web Push).
// - Chamada pelo pg_cron de 10 em 10 minutos, com o cabeçalho x-cron-secret.
// - Chamada pela app com { test: true } (utilizador autenticado) para enviar uma notificação de teste.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { importVapidKeys, sendPush } from '../_shared/webpush.js';
import { computeReminders, lisbonNow } from '../_shared/reminders.js';

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
      .in('coll', ['members', 'events', 'tasks', 'exams', 'trips', 'redemptions', 'classes'])
      .order('coll').order('id').range(from, from + 999);
    if (error) throw error;
    data.forEach((r) => { (state[r.coll] ||= []).push(r.data); });
    if (data.length < 1000) return state;
  }
}

async function runReminders(vapid: unknown) {
  const { data: subs, error } = await admin.from('push_subscriptions').select('*');
  if (error) throw error;
  const byFamily = new Map<string, Sub[]>();
  (subs as Sub[]).forEach((s) => byFamily.set(s.family_id, [...(byFamily.get(s.family_id) || []), s]));
  const now = lisbonNow();
  const summary = { families: byFamily.size, candidates: 0, new: 0, delivered: 0, now };

  for (const [familyId, famSubs] of byFamily) {
    const [{ data: profiles }, state] = await Promise.all([
      admin.from('profiles').select('user_id, member_id, role, notify').eq('family_id', familyId),
      familyState(familyId),
    ]);
    const withDevice = new Set(famSubs.map((s) => s.user_id));
    const reminders = computeReminders({ state, profiles: profiles || [], now }).filter((r) => withDevice.has(r.userId));
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
