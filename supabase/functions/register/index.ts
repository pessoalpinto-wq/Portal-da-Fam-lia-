// Criar conta no Portal da Família já confirmada (sem email de confirmação).
// O servidor de email gratuito do Supabase só envia para a equipa do projecto,
// por isso o registo normal ficaria à espera de um email que nunca chega.
// POST { email, password } → { ok: true } | { error }
import { createClient } from 'npm:@supabase/supabase-js@2';

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Método inválido' }, 405);

  const body = await req.json().catch(() => ({}));
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!/^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(email)) return json({ error: 'Email inválido.' }, 400);
  if (password.length < 6 || password.length > 72) return json({ error: 'A palavra-passe tem de ter entre 6 e 72 caracteres.' }, 400);

  const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) {
    if (/already|registered|exists/i.test(error.message)) {
      return json({ error: 'Já existe uma conta com este email. Usa "Entrar".' }, 409);
    }
    console.error('register', error.message);
    return json({ error: 'Não foi possível criar a conta. Tenta outra vez.' }, 400);
  }
  return json({ ok: true });
});
