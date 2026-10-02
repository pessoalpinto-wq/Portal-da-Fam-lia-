// Calendário da família em formato iCal, para subscrever no Google Calendar / iPhone.
// GET /functions/v1/calendar?t=<token>[&m=<membro>][&aulas=1]
// O token é secreto (está em Definições); pode-se gerar um novo a qualquer momento.
// O link dos pais é o da família; cada filha tem um link pessoal que só mostra o que é dela.
import { createClient } from 'npm:@supabase/supabase-js@2';
import '../_shared/aulas.js';
import '../_shared/ics.js';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});
// deno-lint-ignore no-explicit-any
const ICS = (globalThis as any).ICS;

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const token = url.searchParams.get('t') || '';
  if (!/^[0-9a-f]{36}$/.test(token)) return new Response('Link inválido', { status: 404 });

  const { data: rows } = await admin.rpc('calendar_lookup', { p_token: token });
  const found = rows?.[0];
  if (!found) return new Response('Link inválido', { status: 404 });
  const fam = { id: found.family_id, name: found.family_name };

  const state: Record<string, unknown[]> = {};
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from('items').select('coll,data')
      .eq('family_id', fam.id).eq('deleted', false)
      .in('coll', ['members', 'events', 'exams', 'trips', 'classes', 'dates', 'docs', 'health'])
      .order('coll').order('id').range(from, from + 999);
    if (error) return new Response('Erro', { status: 500 });
    data.forEach((r) => { (state[r.coll] ||= []).push(r.data); });
    if (data.length < 1000) break;
  }

  // Link pessoal de uma filha: só a própria pessoa, seja qual for o "m" pedido.
  const memberId = found.member_id || url.searchParams.get('m') || undefined;
  const body = ICS.build(state, {
    memberId,
    includeClasses: url.searchParams.get('aulas') === '1',
    name: memberId ? undefined : fam.name,
  });
  return new Response(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="familia.ics"',
      'Cache-Control': 'public, max-age=900',
    },
  });
});
