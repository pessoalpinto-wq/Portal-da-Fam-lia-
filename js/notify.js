/* Lembretes no telemóvel (Web Push) e link do calendário para Google Calendar / iPhone. */
(function () {
  const { esc, today } = U;
  const cfg = window.PORTAL_CONFIG || {};
  const FN_URL = `${cfg.supabaseUrl}/functions/v1`;

  const TYPES = [
    ['events', '⏰ Compromissos', '1 hora antes'],
    ['exams', '📝 Testes e trabalhos', 'na véspera às 19h'],
    ['tasks', '✅ Tarefas por fazer', 'às 18h'],
    ['digest', '☀️ Resumo do dia', 'às 7h30'],
    ['weekly', '🗓️ Resumo da semana', 'domingo às 20h'],
    ['approvals', '🙋 Pedidos e aprovações', 'na hora'],
    ['trips', '✈️ Viagens', '7 dias e 1 dia antes'],
    ['birthdays', '🎂 Aniversários', 'na véspera'],
  ];

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const supported = () => window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

  const b64uToBytes = (s) => {
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
    return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  };

  async function currentSubscription() {
    if (!supported()) return null;
    const reg = await navigator.serviceWorker.getRegistration();
    return reg ? reg.pushManager.getSubscription() : null;
  }

  async function enable() {
    const ctx = Cloud.ctx();
    if (!ctx) throw new Error('Entra com a tua conta primeiro.');
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      throw new Error(permission === 'denied'
        ? 'As notificações estão bloqueadas para este site. Desbloqueia-as nas definições do navegador/telemóvel.'
        : 'Não foi dada autorização.');
    }
    const reg = await navigator.serviceWorker.register('sw.js');
    await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription()
      || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uToBytes(cfg.vapidPublicKey) });
    const { endpoint, keys } = sub.toJSON();
    const { error } = await ctx.client.from('push_subscriptions').upsert({
      endpoint, p256dh: keys.p256dh, auth: keys.auth, family_id: ctx.profile.family_id,
      user_agent: navigator.userAgent.slice(0, 200),
    }, { onConflict: 'endpoint' });
    if (error) throw error;
  }

  async function disable() {
    const sub = await currentSubscription();
    if (!sub) return;
    const ctx = Cloud.ctx();
    if (ctx) await ctx.client.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
    await sub.unsubscribe();
  }

  async function sendTest() {
    const ctx = Cloud.ctx();
    const { data, error } = await ctx.client.functions.invoke('send-reminders', { body: { test: true } });
    if (error) throw error;
    return data;
  }

  /* ---------- Painel "Lembretes no telemóvel" ---------- */
  async function fillNotifyPanel(el) {
    const ctx = Cloud.ctx();
    if (!ctx) return;
    let html;
    if (!supported()) {
      html = isIOS && !standalone()
        ? `<p class="small">No iPhone as notificações só funcionam com o portal instalado:</p>
           <ol class="small steps-list"><li>Abre o portal no <b>Safari</b>.</li>
           <li>Carrega em <b>Partilhar</b> <span aria-hidden="true">⬆️</span> → <b>Adicionar ao ecrã principal</b>.</li>
           <li>Abre o portal a partir do novo ícone e volta aqui.</li></ol>`
        : `<p class="small">Este navegador não suporta notificações${window.isSecureContext ? '' : ' nesta página. Abre o portal pelo endereço <b>https://</b> (GitHub Pages)'}.</p>`;
    } else {
      const sub = await currentSubscription();
      // O navegador apaga a subscrição se a autorização for retirada: basta ver se existe.
      const on = !!sub;
      const { data } = await ctx.client.from('profiles').select('notify').eq('user_id', ctx.user.id).maybeSingle();
      const prefs = data?.notify || {};
      html = `<p class="notify-status ${on ? 'on' : ''}">${on ? '✅ Ligados neste aparelho' : '🔕 Desligados neste aparelho'}</p>
        <div class="btn-row">${on
          ? '<button class="btn" data-action="push-test">Enviar um teste</button><button class="btn ghost" data-action="push-off">Desligar</button>'
          : '<button class="btn primary" data-action="push-on">🔔 Ligar lembretes</button>'}</div>
        <h3 class="sub">O que queres receber</h3>
        <div class="notify-types">${TYPES.map(([k, label, when]) => `<label class="check-line">
          <input type="checkbox" data-notify-pref="${k}" ${prefs[k] === false ? '' : 'checked'}>
          <span>${label} <small class="muted">· ${when}</small></span></label>`).join('')}</div>
        <p class="small muted">As preferências valem para todos os teus aparelhos. Liga os lembretes em cada telemóvel/computador.</p>`;
    }
    if (document.body.contains(el)) el.innerHTML = html;
  }

  async function savePref(key, value) {
    const ctx = Cloud.ctx();
    const { data } = await ctx.client.from('profiles').select('notify').eq('user_id', ctx.user.id).maybeSingle();
    const notify = { ...(data?.notify || {}), [key]: value };
    const { error } = await ctx.client.from('profiles').update({ notify }).eq('user_id', ctx.user.id);
    if (error) throw error;
  }

  /* ---------- Painel "Calendário no telemóvel" ---------- */
  let calToken = null;
  const calUrl = (memberId, classes) => {
    const q = new URLSearchParams({ t: calToken });
    if (memberId) q.set('m', memberId);
    if (classes) q.set('aulas', '1');
    return `${FN_URL}/calendar?${q}`;
  };

  function renderCalendarLinks(el) {
    const who = el.querySelector('[name=cal-member]')?.value ?? Store.state.currentUser;
    const classes = el.querySelector('[name=cal-classes]')?.checked ?? true;
    const url = calUrl(who, classes);
    const webcal = url.replace(/^https:/, 'webcal:');
    el.querySelector('.cal-links').innerHTML = `
      <input class="cal-url" readonly value="${esc(url)}" aria-label="Link do calendário">
      <div class="btn-row">
        <button class="btn small" data-action="copy" data-text="${esc(url)}">📋 Copiar link</button>
        <a class="btn small" href="https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}" target="_blank" rel="noopener">Google Calendar</a>
        <a class="btn small" href="${esc(webcal)}">iPhone / Mac</a>
      </div>`;
  }

  async function fillCalendarPanel(el) {
    const ctx = Cloud.ctx();
    if (!ctx) return;
    const { data } = await ctx.client.from('families').select('ics_token').eq('id', ctx.profile.family_id).maybeSingle();
    if (!data || !document.body.contains(el)) return;
    calToken = data.ics_token;
    const s = Store.state;
    el.innerHTML = `<p class="small">Vê a agenda da família no calendário do telemóvel. O calendário actualiza-se sozinho
        (o Google demora algumas horas; o iPhone, cerca de 1 hora).</p>
      <div class="cal-options">
        <label class="field"><span>Calendário de</span><select name="cal-member">
          <option value="">👪 Família toda</option>
          ${s.members.map((m) => `<option value="${esc(m.id)}" ${m.id === s.currentUser ? 'selected' : ''}>${esc(m.emoji)} ${esc(m.name)}</option>`).join('')}
        </select></label>
        <label class="check-line"><input type="checkbox" name="cal-classes" checked><span>Incluir horário escolar</span></label>
      </div>
      <div class="cal-links"></div>
      <details class="help"><summary>Como adicionar</summary>
        <p class="small"><b>Google Calendar (Android):</b> carrega em "Google Calendar" num computador, ou em
        calendar.google.com → Outros calendários ＋ → A partir do URL → cola o link.</p>
        <p class="small"><b>iPhone:</b> carrega em "iPhone / Mac" e confirma "Subscrever". Ou: Definições → Calendário → Contas →
        Adicionar conta → Outra → Adicionar calendário subscrito → cola o link.</p>
      </details>
      <p class="small muted">⚠️ Quem tiver o link consegue ver a agenda. ${Store.isParent()
        ? 'Se o partilharem por engano, <button class="linkish" data-action="cal-reset">gerem um link novo</button>.' : ''}</p>`;
    renderCalendarLinks(el);
    el.addEventListener('change', (e) => { if (e.target.name?.startsWith('cal-')) renderCalendarLinks(el); });
  }

  async function resetCalendar() {
    const ctx = Cloud.ctx();
    const { error } = await ctx.client.rpc('reset_calendar_token');
    if (error) throw error;
  }

  /** Descarrega a agenda num ficheiro .ics (funciona também sem conta). */
  function downloadICS() {
    const text = ICS.build(Store.state, { includeClasses: true });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/calendar' }));
    a.download = `agenda-familia-${today()}.ics`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // Clique numa notificação com o portal já aberto: ir para a secção certa.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (e) => {
      if (e.data?.type === 'navigate') location.hash = e.data.url;
    });
  }

  window.Notify = {
    supported, enable, disable, sendTest, savePref, fillNotifyPanel, fillCalendarPanel, resetCalendar, downloadICS,
  };
})();
