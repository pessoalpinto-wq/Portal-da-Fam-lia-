/* Contas, criação/entrada na família e ligação ao Supabase. */
(function () {
  const { esc, $ } = U;
  const cfg = window.PORTAL_CONFIG || {};
  const configured = !!(cfg.supabaseUrl && cfg.supabaseKey && window.supabase?.createClient);
  const MODE_KEY = 'portal-familia-mode';
  const PROFILE_KEY = 'portal-familia-profile';

  let client = null;
  let session = null;
  let profile = null;
  let accounts = [];
  let onReady = () => {};

  const getLS = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const setLS = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* ignorar */ } };

  const ERRORS = [
    [/Invalid login credentials/i, 'Email ou palavra-passe errados.'],
    [/Email not confirmed/i, 'Falta confirmar o email: abre a mensagem que recebeste e carrega no link.'],
    [/User already registered/i, 'Já existe uma conta com este email. Usa "Entrar".'],
    [/Password should be at least/i, 'A palavra-passe tem de ter pelo menos 6 caracteres.'],
    [/rate limit/i, 'Demasiadas tentativas. Espera uns minutos e tenta outra vez.'],
    [/not authorized|Error sending/i, 'Não foi possível enviar o email de confirmação. Os pais têm de desligar "Confirm email" no Supabase (ver README).'],
    [/Failed to fetch|NetworkError|Load failed/i, 'Sem ligação à internet.'],
  ];
  const friendly = (e) => {
    const msg = e?.message || String(e);
    return (ERRORS.find(([re]) => re.test(msg)) || [null, msg])[1];
  };

  /* ---------- Ecrãs de entrada ---------- */
  function gate(html) {
    document.body.classList.add('gate');
    $('#view').innerHTML = `<div class="gate-wrap"><section class="card gate-card">
      <div class="gate-logo"><img src="icon.svg" alt="" width="56" height="56"><h1>Portal da Família</h1></div>
      ${html}</section></div>`;
  }
  const showError = (msg) => {
    const el = $('#gate-error');
    if (el) { el.textContent = msg; el.hidden = !msg; }
  };
  const busy = (form, on) => form.querySelectorAll('button, input, select').forEach((b) => { b.disabled = on; });

  function loginScreen(mode = 'login', info = '') {
    const signup = mode === 'signup';
    gate(`<p class="muted">${signup ? 'Cria a tua conta. Cada pessoa da família tem a sua.' : 'Entra com a tua conta para ver o portal da família.'}</p>
      ${info ? `<p class="notice">${esc(info)}</p>` : ''}
      <form id="auth-form" class="gate-form">
        <label class="field"><span>Email</span><input name="email" type="email" autocomplete="email" required></label>
        <label class="field"><span>Palavra-passe</span><input name="password" type="password" minlength="6"
          autocomplete="${signup ? 'new-password' : 'current-password'}" required></label>
        <p id="gate-error" class="error" hidden></p>
        <button class="btn primary block">${signup ? 'Criar conta' : 'Entrar'}</button>
      </form>
      <p class="gate-switch">${signup ? 'Já tens conta?' : 'Ainda não tens conta?'}
        <button class="linkish" id="auth-switch">${signup ? 'Entrar' : 'Criar conta'}</button></p>
      <hr><button class="linkish muted" id="use-local">Continuar sem conta (dados só neste dispositivo)</button>`);
    $('#auth-switch').addEventListener('click', () => loginScreen(signup ? 'login' : 'signup'));
    $('#use-local').addEventListener('click', () => { setLS(MODE_KEY, 'local'); startLocal(); });
    const form = $('#auth-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      showError('');
      const email = form.email.value.trim();
      const password = form.password.value;
      busy(form, true);
      try {
        const res = signup
          ? await client.auth.signUp({ email, password })
          : await client.auth.signInWithPassword({ email, password });
        if (res.error) throw res.error;
        if (!res.data.session) {
          loginScreen('login', 'Conta criada! Confirma o email (vê a caixa de correio) e depois entra aqui.');
          return;
        }
        session = res.data.session;
        setLS(MODE_KEY, null);
        await afterLogin();
      } catch (err) {
        showError(friendly(err));
        busy(form, false);
      }
    });
  }

  function onboardingScreen() {
    const local = Store.localSnapshot();
    const parents = local.members.filter((m) => ['pai', 'mae'].includes(m.role));
    const candidates = parents.length ? parents : local.members;
    gate(`<p>Olá! Falta ligar esta conta à vossa família.</p>
      <div class="gate-options">
        <details class="gate-opt" open><summary><b>👋 Tenho um código de convite</b></summary>
          <form id="join-form" class="gate-form">
            <label class="field"><span>Código (pede-o ao pai ou à mãe)</span>
              <input name="code" required autocomplete="off" placeholder="Ex.: 3F9A2C1B" class="code-input"></label>
            <div id="join-members"></div>
            <button class="btn primary block" id="join-next">Continuar</button>
          </form></details>
        <details class="gate-opt"><summary><b>🏠 Sou pai/mãe e quero criar a família</b></summary>
          <form id="create-form" class="gate-form">
            <label class="field"><span>Nome da família</span><input name="name" value="Família" required></label>
            <label class="field"><span>Quem és tu?</span><select name="member">
              ${candidates.map((m) => `<option value="${esc(m.id)}">${esc(m.emoji)} ${esc(m.name)}</option>`).join('')}</select></label>
            <label class="check-line"><input type="checkbox" name="bring" checked>
              <span>Levar os dados que já estão neste dispositivo (${local.tasks.length} tarefas, ${local.events.length} compromissos, horários…)</span></label>
            <p class="small muted">Se desmarcares, começam só com os membros da família e as recompensas.
              Depois podes mudar nomes e aniversários em Definições.</p>
            <button class="btn primary block">Criar a família</button>
          </form></details>
      </div>
      <p id="gate-error" class="error" hidden></p>
      <hr><button class="linkish muted" id="sign-out">Terminar sessão (${esc(session.user.email)})</button>`);
    $('#sign-out').addEventListener('click', signOut);

    const join = $('#join-form');
    let preview = null;
    join.addEventListener('submit', async (e) => {
      e.preventDefault();
      showError('');
      const code = join.code.value.trim();
      const chosen = join.querySelector('input[name=member]:checked');
      busy(join, true);
      try {
        if (!preview || !chosen) {
          const { data, error } = await client.rpc('preview_family', { p_code: code });
          if (error) throw error;
          if (!data) throw new Error('Código não encontrado. Confirma se está bem escrito.');
          preview = data;
          $('#join-members').innerHTML = `<p>Família <b>${esc(data.family)}</b>. Quem és tu?</p>
            <div class="chip-checks">${data.members.map((m) => `<label class="chip-check">
              <input type="radio" name="member" value="${esc(m.id)}" ${m.taken ? 'disabled' : ''}>
              <span>${esc(m.emoji || '🙂')} ${esc(m.name)}${m.taken ? ' (já tem conta)' : ''}</span></label>`).join('')}</div>`;
          $('#join-next').textContent = 'Entrar na família';
          busy(join, false);
          return;
        }
        const { error } = await client.rpc('join_family', { p_code: code, p_member_id: chosen.value });
        if (error) throw error;
        await afterLogin();
      } catch (err) {
        showError(friendly(err));
        busy(join, false);
      }
    });
    join.code.addEventListener('input', () => { preview = null; $('#join-members').innerHTML = ''; $('#join-next').textContent = 'Continuar'; });

    const create = $('#create-form');
    create.addEventListener('submit', async (e) => {
      e.preventDefault();
      showError('');
      busy(create, true);
      const src = create.bring.checked ? local : { members: local.members.map((m) => ({ ...m, points: 0 })), rewards: local.rewards, contacts: local.contacts };
      try {
        const { error } = await client.rpc('create_family', {
          p_name: create.name.value.trim(), p_member_id: create.member.value, p_items: Store.toItems(src),
        });
        if (error) throw error;
        await afterLogin();
      } catch (err) {
        showError(friendly(err));
        busy(create, false);
      }
    });
  }

  /* ---------- Fluxo ---------- */
  function startLocal() {
    document.body.classList.remove('gate');
    onReady();
  }

  async function afterLogin() {
    let data = null;
    try {
      const res = await client.from('profiles').select('family_id, member_id, role').eq('user_id', session.user.id).maybeSingle();
      if (res.error) throw res.error;
      data = res.data;
      setLS(PROFILE_KEY, data ? JSON.stringify({ ...data, user_id: session.user.id }) : null);
    } catch (err) {
      // Sem internet: usa o perfil guardado para abrir com os dados em cache.
      const cached = JSON.parse(getLS(PROFILE_KEY) || 'null');
      if (cached && cached.user_id === session.user.id) data = cached;
      else { gate(`<p class="error">${esc(friendly(err))}</p><button class="btn primary" onclick="location.reload()">Tentar outra vez</button>`); return; }
    }
    if (!data) { onboardingScreen(); return; }
    profile = data;
    document.body.classList.remove('gate');
    await Store.connect({ client, familyId: data.family_id, memberId: data.member_id, role: data.role });
    onReady();
    loadAccounts();
  }

  async function loadAccounts() {
    const { data } = await client.from('profiles').select('member_id, role').eq('family_id', profile.family_id);
    accounts = data || [];
  }

  async function signOut() {
    // Deixa de enviar lembretes para este aparelho (pode passar a ser usado por outra pessoa).
    try { await window.Notify?.disable(); } catch (e) { /* ignorar */ }
    try { await client?.auth.signOut(); } catch (e) { /* ignorar */ }
    setLS(PROFILE_KEY, null);
    location.reload();
  }

  async function boot(ready) {
    onReady = ready;
    if (!configured) { startLocal(); return; }
    client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
    const { data } = await client.auth.getSession();
    session = data.session;
    if (session) { await afterLogin(); return; }
    if (getLS(MODE_KEY) === 'local') { startLocal(); return; }
    loginScreen();
  }

  async function inviteCodes() {
    if (!client || !profile) return null;
    const { data } = await client.from('family_invites').select('parent_code, child_code').eq('family_id', profile.family_id).maybeSingle();
    return data;
  }

  window.Cloud = {
    configured,
    boot,
    signOut,
    inviteCodes,
    /** Sai do modo "só neste dispositivo" e mostra o ecrã de entrada. */
    goToLogin() { setLS(MODE_KEY, null); loginScreen(); },
    info: () => ({ email: session?.user?.email, accounts, role: profile?.role }),
    /** Cliente Supabase e perfil actual (null em modo local). */
    ctx: () => (client && profile ? { client, profile, user: session?.user } : null),
  };
})();
