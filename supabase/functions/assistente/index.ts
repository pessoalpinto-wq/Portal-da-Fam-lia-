// Assistente da família (IA, Claude). Só para os pais.
// POST { history: [{ role: 'user'|'assistant', text }] } com a sessão do utilizador
//   → { reply, proposals, usage: { today, month } } | { error, code? }
// A chave da API fica no segredo ANTHROPIC_API_KEY do Supabase (nunca no código nem na app).
// As propostas (tarefas, compromissos, compras, recados) não são gravadas aqui: a app mostra-as e grava
// só depois de a pessoa confirmar.
import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { chat, cost } from '../_shared/assistente.js';
import { lisbonNow } from '../_shared/reminders.js';

const DAILY_LIMIT = 150; // pedidos por família e por dia (protege contra gastos inesperados)
const COLLS = ['members', 'events', 'tasks', 'classes', 'exams', 'trips', 'shopping', 'pantry', 'notes', 'contacts', 'health',
  'docs', 'dates', 'bills', 'recipes', 'projects', 'ftx', 'fbudgets', 'faccounts', 'fsnaps', 'debts'];

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

async function familyState(familyId: string) {
  const state: Record<string, unknown[]> = {};
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from('items').select('coll,data')
      .eq('family_id', familyId).eq('deleted', false).in('coll', COLLS)
      .order('coll').order('id').range(from, from + 999);
    if (error) throw error;
    data.forEach((r) => { (state[r.coll] ||= []).push(r.data); });
    if (data.length < 1000) return state;
  }
}

async function usageOf(familyId: string, day: string) {
  const { data } = await admin.from('ai_usage').select('day,requests,cost_usd')
    .eq('family_id', familyId).gte('day', `${day.slice(0, 7)}-01`);
  const rows = data || [];
  const today = rows.find((r) => r.day === day);
  return {
    today: today?.requests || 0,
    month: { requests: rows.reduce((n, r) => n + r.requests, 0), cost: rows.reduce((n, r) => n + Number(r.cost_usd), 0) },
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return json({ error: 'Entra com a tua conta para usar o assistente.' }, 401);
    const { data: profile } = await admin.from('profiles').select('family_id, member_id, role').eq('user_id', user.id).maybeSingle();
    if (!profile) return json({ error: 'Conta sem família.' }, 403);
    if (profile.role !== 'parent') return json({ error: 'Por agora o assistente é só para os pais.', code: 'parents_only' }, 403);

    const body = await req.json().catch(() => ({}));
    const now = lisbonNow();
    if (body.usage) return json({ usage: await usageOf(profile.family_id, now.date) });

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) return json({ error: 'O assistente ainda não está ligado: falta a chave da API nos segredos do Supabase.', code: 'no_key' }, 503);

    const history = Array.isArray(body.history) ? body.history.slice(-12) : [];
    if (!history.length || history.at(-1)?.role !== 'user' || !String(history.at(-1)?.text || '').trim()) {
      return json({ error: 'Escreve uma pergunta.' }, 400);
    }
    if (String(history.at(-1).text).length > 2000) return json({ error: 'A mensagem é demasiado longa.' }, 400);

    const before = await usageOf(profile.family_id, now.date);
    if (before.today >= DAILY_LIMIT) {
      return json({ error: `Chegaram ao limite de ${DAILY_LIMIT} pedidos por hoje. Amanhã há mais.`, code: 'limit' }, 429);
    }

    const state = await familyState(profile.family_id);
    const client = new Anthropic({ apiKey, maxRetries: 2, timeout: 60_000 });
    const result = await chat({ client, state, me: profile.member_id, now, history });

    const spent = cost(result.usage);
    const { data: row } = await admin.from('ai_usage').select('*').eq('family_id', profile.family_id).eq('day', now.date).maybeSingle();
    await admin.from('ai_usage').upsert({
      family_id: profile.family_id, day: now.date,
      requests: (row?.requests || 0) + 1,
      input_tokens: (row?.input_tokens || 0) + result.usage.input,
      output_tokens: (row?.output_tokens || 0) + result.usage.output,
      cache_read: (row?.cache_read || 0) + result.usage.cacheRead,
      cache_write: (row?.cache_write || 0) + result.usage.cacheWrite,
      cost_usd: Number(row?.cost_usd || 0) + spent,
    }, { onConflict: 'family_id,day' });

    return json({
      reply: result.reply,
      proposals: result.proposals,
      usage: { today: before.today + 1, month: { requests: before.month.requests + 1, cost: before.month.cost + spent } },
    });
  } catch (e) {
    if (e instanceof Anthropic.APIError) {
      const msg = String(e.message || '');
      console.error('assistente api', e.status, msg.slice(0, 300));
      if (e.status === 401) return json({ error: 'A chave da API não é válida. Confirmem o segredo ANTHROPIC_API_KEY.', code: 'bad_key' }, 502);
      if (/credit balance/i.test(msg)) return json({ error: 'A conta da Anthropic está sem crédito. Carreguem em console.anthropic.com.', code: 'no_credit' }, 502);
      if (e.status === 429 || e.status === 529 || (e.status || 0) >= 500) return json({ error: 'O serviço de IA está ocupado. Tenta daqui a um minuto.' }, 503);
      return json({ error: 'O assistente não conseguiu responder.' }, 502);
    }
    console.error('assistente', String(e));
    return json({ error: 'O assistente não conseguiu responder.' }, 500);
  }
});
