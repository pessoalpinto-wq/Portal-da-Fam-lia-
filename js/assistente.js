/*
 * ✨ Assistente (IA): conversa com o Claude sobre a família, só para os pais.
 * Botão flutuante em todas as páginas → painel de conversa (escrever ou falar 🎤).
 * O servidor (supabase/functions/assistente) responde e pode devolver propostas — tarefas, compromissos,
 * compras e recados — que aparecem em cartões e só são gravadas quando a pessoa toca em ✔ Confirmar.
 */
window.Assistente = function ({ render }) {
  const { esc, today, fmtDate } = U;
  const { toast, member } = UI;
  const { Forms } = Views;
  const S = () => Store.state;
  const KEY = 'portal-assistente';
  const SUGGEST = ['O que temos amanhã?', 'Quais são os próximos testes?', 'Que tarefas estão atrasadas?', 'Quanto gastámos este mês?'];
  const REP = { daily: 'todos os dias', weekly: 'todas as semanas', monthly: 'todos os meses', yearly: 'todos os anos' };

  let chat = [];
  try { chat = JSON.parse(sessionStorage.getItem(KEY) || '[]'); } catch { chat = []; }
  let busy = false;
  let usage = null;
  let mic = null;
  const save = () => { try { sessionStorage.setItem(KEY, JSON.stringify(chat.slice(-30))); } catch { /* sem espaço */ } };

  /* ---------- Servidor ---------- */
  async function call(body) {
    const ctx = Cloud.ctx?.();
    if (!ctx) return { error: 'O assistente precisa da conta da família (iniciem sessão no portal).', code: 'offline' };
    const { data, error } = await ctx.client.functions.invoke('assistente', { body });
    if (!error) return data || {};
    let out = { error: 'Sem ligação ao assistente. Tenta outra vez.' };
    try { out = { ...out, ...(await error.context.json()) }; } catch { /* resposta sem JSON */ }
    return out;
  }

  /** O que foi dito, para o histórico enviado ao servidor (inclui o que aconteceu às propostas). */
  const STATUS = { done: 'confirmada', cancelled: 'cancelada pela pessoa', pending: 'ainda por confirmar' };
  const historyText = (m) => (m.proposals?.length
    ? `${m.text}\n\n[Propostas: ${m.proposals.map((p) => `${p.summary} — ${STATUS[p.status] || STATUS.pending}`).join('; ')}]` : m.text);

  async function send(text) {
    const said = String(text || '').trim();
    if (!said || busy) return;
    chat.push({ role: 'user', text: said });
    busy = true;
    paint();
    const res = await call({ history: chat.filter((m) => !m.error).map((m) => ({ role: m.role, text: historyText(m) })) });
    busy = false;
    if (res.error) {
      chat.push({ role: 'assistant', text: res.error, error: true, code: res.code });
    } else {
      chat.push({ role: 'assistant', text: res.reply || '…', proposals: (res.proposals || []).map((p, i) => ({ ...p, n: i, status: 'pending' })) });
      if (res.usage) usage = res.usage;
    }
    save();
    paint();
  }

  /* ---------- Gravar uma proposta ---------- */
  const strip = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  function apply(p) {
    const me = S().currentUser;
    Store.update((s) => {
      if (p.type === 'task') {
        s.tasks.push({
          id: Store.uid(), title: p.title, assignee: p.assignee || '', due: p.due || '', repeat: p.repeat || 'none',
          points: Number(p.points) || 0, category: p.category || 'Casa', notes: p.notes || '', done: false, history: [], createdBy: me,
        });
      } else if (p.type === 'event') {
        s.events.push({
          id: Store.uid(), title: p.title, date: p.date, start: p.start || '', end: p.end || '', members: p.members || [],
          location: p.location || '', repeat: p.repeat || 'none', until: p.until || '', driver: p.driver || '', notes: p.notes || '',
        });
      } else if (p.type === 'shopping') {
        const pend = new Set(s.shopping.filter((x) => !x.done).map((x) => strip(x.text)));
        p.items.filter((i) => !pend.has(strip(i.text))).forEach((i) => s.shopping.push({
          id: Store.uid(), text: i.text, qty: i.qty || '', category: i.category || 'Outro', done: false, addedBy: me,
        }));
      } else if (p.type === 'note') {
        s.notes.push({ id: Store.uid(), author: me, date: today(), pinned: !!p.pinned, text: p.text });
      }
    });
    const T = { task: '✅ Tarefa criada', event: '📅 Compromisso marcado', shopping: '🛒 Na lista de compras', note: '📌 Recado afixado' };
    toast(T[p.type] || 'Guardado');
  }

  const findProposal = (el) => {
    const m = chat[Number(el.dataset.msg)];
    return m?.proposals?.[Number(el.dataset.n)];
  };
  function confirm(el) {
    const p = findProposal(el);
    if (!p || p.status !== 'pending') return;
    apply(p);
    p.status = 'done';
    save();
    paint();
    render();
  }
  function cancel(el) {
    const p = findProposal(el);
    if (!p || p.status !== 'pending') return;
    p.status = 'cancelled';
    save();
    paint();
  }
  /** ✎ Alterar: o formulário normal, já preenchido; guardar = confirmar. */
  function change(el) {
    const p = findProposal(el);
    if (!p || p.status !== 'pending') return;
    const done = (d) => { Object.assign(p, d); apply(p); p.status = 'done'; save(); paint(); render(); };
    if (p.type === 'task') {
      UI.openForm({ title: '✎ Tarefa', fields: Forms.task(), values: p, submitLabel: '✔ Criar tarefa', onSubmit: (d) => done({ ...d, points: Number(d.points ?? p.points) || 0 }) });
    } else if (p.type === 'event') {
      UI.openForm({ title: '✎ Compromisso', fields: Forms.event(), values: p, submitLabel: '✔ Marcar', onSubmit: done });
    } else if (p.type === 'note') {
      UI.openForm({ title: '✎ Recado', fields: [{ name: 'text', label: 'Recado', type: 'textarea', required: true }], values: p, submitLabel: '✔ Afixar', onSubmit: done });
    } else if (p.type === 'shopping') {
      UI.openForm({
        title: '✎ Compras', submitLabel: '✔ Juntar à lista',
        fields: [{ name: 'list', label: 'Um produto por linha', type: 'textarea', rows: 6, required: true }],
        values: { list: p.items.map((i) => `${i.qty ? `${i.qty} ` : ''}${i.text}`).join('\n') },
        onSubmit: (d) => {
          const old = new Map(p.items.map((i) => [strip(`${i.qty ? `${i.qty} ` : ''}${i.text}`), i]));
          done({ items: d.list.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => old.get(strip(l)) || { text: l, qty: '', category: 'Outro' }) });
        },
      });
    }
  }

  /* ---------- Desenho ---------- */
  /** Markdown simples: **negrito**, listas com "-" e parágrafos. */
  function md(text) {
    const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|\W)\*(\S.*?)\*(?=\W|$)/g, '$1<i>$2</i>');
    const out = [];
    let list = null;
    String(text || '').split('\n').forEach((line) => {
      const li = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/);
      if (li) { if (!list) { list = []; out.push(list); } list.push(inline(li[1])); return; }
      list = null;
      const h = line.match(/^#{1,4}\s+(.*)$/);
      if (h) out.push(`<p><b>${inline(h[1])}</b></p>`);
      else if (line.trim()) out.push(`<p>${inline(line)}</p>`);
    });
    return out.map((x) => (Array.isArray(x) ? `<ul>${x.map((l) => `<li>${l}</li>`).join('')}</ul>` : x)).join('');
  }

  const who = (id) => { const m = member(id); return m ? `${m.emoji || ''} ${esc(m.name)}` : ''; };
  function card(p, i) {
    const attrs = `data-msg="${i}" data-n="${p.n}"`;
    let head = '';
    let body = '';
    if (p.type === 'task') {
      head = `✅ ${esc(p.title)}`;
      body = [p.assignee ? who(p.assignee) : 'Por atribuir', p.due ? `até ${esc(fmtDate(p.due))}` : '', REP[p.repeat] || '', `⭐ ${p.points}`, esc(p.category)].filter(Boolean).join(' · ');
    } else if (p.type === 'event') {
      head = `📅 ${esc(p.title)}`;
      body = [`${esc(fmtDate(p.date))}${p.start ? ` · ${p.start}${p.end ? `–${p.end}` : ''}` : ' · dia todo'}`, p.location ? `📍 ${esc(p.location)}` : '',
        (p.members || []).map(who).join(', '), p.driver ? `🚗 ${who(p.driver)}` : '', REP[p.repeat] ? `🔁 ${REP[p.repeat]}${p.until ? ` até ${esc(fmtDate(p.until))}` : ''}` : ''].filter(Boolean).join(' · ');
      if (p.conflicts?.length) body += `<br><span class="assist-warn">⚠️ ${p.conflicts.map(esc).join(' · ')}</span>`;
    } else if (p.type === 'shopping') {
      head = `🛒 Juntar ${p.items.length === 1 ? '1 produto' : `${p.items.length} produtos`}`;
      body = p.items.map((x) => `${x.qty ? `<b>${esc(x.qty)}</b> ` : ''}${esc(x.text)}`).join(', ')
        + (p.already?.length ? `<br><small class="muted">Já na lista: ${p.already.map(esc).join(', ')}</small>` : '');
    } else if (p.type === 'note') {
      head = `📌 Recado${p.pinned ? ' (fixo)' : ''}`;
      body = esc(p.text);
    }
    const foot = p.status === 'done' ? '<p class="assist-status ok">✔ Guardado</p>'
      : p.status === 'cancelled' ? '<p class="assist-status muted">✕ Cancelado</p>'
      : `<div class="assist-btns"><button class="btn small primary" data-action="assist-ok" ${attrs}>✔ Confirmar</button>
          <button class="btn small" data-action="assist-edit" ${attrs}>✎ Alterar</button>
          <button class="btn small ghost" data-action="assist-no" ${attrs}>✕</button></div>`;
    return `<div class="assist-card ${p.status}"><p class="assist-card-head">${head}</p><p class="small">${body}</p>${foot}</div>`;
  }

  const SETUP = `<div class="assist-setup small"><p><b>Para ligar o assistente (uma vez):</b></p><ol>
    <li>Criar conta em <b>console.anthropic.com</b>, carregar crédito (5–10 €) e pôr um limite mensal.</li>
    <li>Em <i>API Keys</i>, criar uma chave.</li>
    <li>No Supabase: <i>Edge Functions → Secrets</i> → nome <code>ANTHROPIC_API_KEY</code>, colar a chave.</li></ol>
    <p class="muted">Nunca partilhem a chave por mensagem ou email.</p></div>`;

  function messages() {
    if (!chat.length) {
      const me = member(S().currentUser);
      return `<div class="assist-hello"><p class="assist-emoji">✨</p><p><b>Olá${me ? `, ${esc(me.name)}` : ''}!</b> Sou o assistente da família.</p>
        <p class="small muted">Pergunta-me sobre a agenda, a escola, as tarefas, as compras ou as finanças — ou pede-me para marcar alguma coisa. Antes de gravar, mostro-te sempre o que vou fazer.</p>
        <div class="assist-chips">${SUGGEST.map((q) => `<button class="assist-chip" data-action="assist-ask" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div></div>`;
    }
    return chat.map((m, i) => `<div class="assist-msg ${m.role}${m.error ? ' assist-err' : ''}">
        <div class="assist-bubble">${m.role === 'user' ? esc(m.text) : md(m.text)}${m.code === 'no_key' ? SETUP : ''}</div>
        ${(m.proposals || []).map((p) => card(p, i)).join('')}</div>`).join('')
      + (busy ? '<div class="assist-msg assistant"><div class="assist-bubble assist-typing" aria-label="A pensar"><span></span><span></span><span></span></div></div>' : '');
  }

  const money = (n) => `${Number(n || 0).toFixed(2).replace('.', ',')} $`;
  function paint() {
    const dlg = document.querySelector('#assist');
    if (!dlg?.open) return;
    const box = dlg.querySelector('.assist-log');
    box.innerHTML = messages();
    box.scrollTop = box.scrollHeight;
    dlg.querySelector('.assist-send').disabled = busy;
    dlg.querySelector('.assist-usage').textContent = usage ? `${usage.month.requests} pedido${usage.month.requests === 1 ? '' : 's'} este mês · ≈ ${money(usage.month.cost)}` : '';
  }

  const VOICE_ERR = {
    'not-allowed': '🎙️ Microfone bloqueado: permitam-no para este site ou usem o 🎤 do teclado.',
    'service-not-allowed': '🎙️ Este telemóvel não deixa ditar aqui: usem o 🎤 do teclado.',
    'audio-capture': '🎙️ Não encontrei o microfone.',
    network: '📡 Para ditar é preciso internet.',
  };
  function toggleMic() {
    const dlg = document.querySelector('#assist');
    const input = dlg.querySelector('.assist-input');
    const btn = dlg.querySelector('.assist-mic');
    if (mic) { mic.stop(); return; }
    let heard = '';
    mic = Voz.listen({
      onText: (fin, interim) => {
        if (fin) heard = `${heard} ${fin}`.trim();
        input.value = `${heard}${interim ? ` ${interim}` : ''}`.trim();
        if (fin) mic?.stop(); // uma pergunta de cada vez: envia logo que acaba a frase
      },
      onState: (on, err) => {
        btn.classList.toggle('listening', on);
        btn.textContent = on ? '⏹️' : '🎤';
        if (err) toast(VOICE_ERR[err] || 'Não consegui ligar o microfone.');
        if (!on) {
          mic = null;
          if (heard && !err) { input.value = ''; send(heard); }
        }
      },
    });
  }

  function open() {
    let dlg = document.querySelector('#assist');
    if (!dlg) {
      dlg = document.createElement('dialog');
      dlg.id = 'assist';
      dlg.className = 'assist';
      dlg.setAttribute('aria-label', 'Assistente');
      dlg.innerHTML = `<header class="assist-head"><h2>✨ Assistente</h2><span class="assist-usage small muted"></span>
          <button class="btn small ghost" data-action="assist-clear" title="Começar uma conversa nova">Nova</button>
          <button class="icon-btn" data-action="assist-close" aria-label="Fechar">✕</button></header>
        <div class="assist-log" aria-live="polite"></div>
        <form class="assist-form">
          ${Voz.supported ? '<button type="button" class="btn assist-mic" data-action="assist-mic" aria-label="Falar">🎤</button>' : ''}
          <textarea class="assist-input" rows="1" maxlength="2000" placeholder="Escreve ou fala…" aria-label="Mensagem"></textarea>
          <button type="submit" class="btn primary assist-send" aria-label="Enviar">➤</button></form>`;
      document.body.appendChild(dlg);
      const input = dlg.querySelector('.assist-input');
      dlg.querySelector('form').addEventListener('submit', (e) => {
        e.preventDefault();
        const t = input.value;
        input.value = '';
        input.style.height = '';
        send(t);
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); dlg.querySelector('form').requestSubmit(); }
      });
      input.addEventListener('input', () => { input.style.height = ''; input.style.height = `${Math.min(input.scrollHeight, 140)}px`; });
      dlg.addEventListener('close', () => mic?.stop());
    }
    dlg.showModal();
    paint();
    if (!usage) call({ usage: true }).then((r) => { if (r.usage) { usage = r.usage; paint(); } });
    if (!matchMedia('(pointer: coarse)').matches) dlg.querySelector('.assist-input').focus();
  }

  /* ---------- Botão flutuante (só pais) ---------- */
  function afterRender() {
    let fab = document.querySelector('#assist-fab');
    const show = Store.isParent();
    if (!show) { fab?.remove(); return; }
    if (!fab) {
      fab = document.createElement('button');
      fab.id = 'assist-fab';
      fab.className = 'assist-fab';
      fab.dataset.action = 'assist-open';
      fab.setAttribute('aria-label', 'Assistente');
      fab.title = 'Assistente';
      fab.textContent = '✨';
      document.body.appendChild(fab);
    }
  }

  const actions = {
    'assist-open': open,
    'assist-close': () => document.querySelector('#assist')?.close(),
    'assist-clear': () => { chat = []; save(); paint(); },
    'assist-ask': (el) => send(el.dataset.q),
    'assist-mic': toggleMic,
    'assist-ok': confirm,
    'assist-no': cancel,
    'assist-edit': change,
  };
  return { actions, afterRender, _test: { md, send, apply } };
};
