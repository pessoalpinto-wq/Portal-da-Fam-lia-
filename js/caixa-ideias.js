/*
 * 💭 Caixa de ideias: apontar uma ideia em segundos (a escrever ou a falar) e revê-la depois com calma —
 * arrumar, partilhar com a família, passar a tarefa ou a recado no Mural.
 * As ideias são de quem as aponta: só aparecem aos outros se as partilhar (regra também no servidor).
 * Atalho no ícone da app (manifest → shortcuts) abre directamente aqui: index.html?nova=ideia#/ideias.
 */
window.CaixaIdeias = function ({ render }) {
  const { esc, today, fmtDate } = U;
  const { member, avatar, toast, editItem } = UI;
  const { VS, Forms } = Views;
  const { empty } = Views.h;
  const S = () => Store.state;
  const me = () => S().currentUser;
  const mine = () => Ideias.visible(S().ideas, me());

  const VOICE_ERR = {
    'not-allowed': '🎙️ O microfone está bloqueado. Permitam o microfone para este site ou usem o 🎤 do teclado.',
    'service-not-allowed': '🎙️ Este telemóvel não deixa ditar aqui. Toquem na caixa e usem o 🎤 do teclado.',
    'audio-capture': '🎙️ Não encontrei o microfone.',
    network: '📡 O ditado do portal precisa de internet. O 🎤 do teclado costuma funcionar sem rede.',
    unsupported: 'Para ditar, toquem na caixa e usem o 🎤 do teclado.',
    start: 'Não consegui ligar o microfone. Toquem na caixa e usem o 🎤 do teclado.',
  };

  function save(text, source = 'texto') {
    const idea = Ideias.create(text, { id: Store.uid(), by: me(), source });
    if (!idea.text) return false;
    Store.update((s) => { s.ideas.push(idea); });
    toast(Store.isRemote && !navigator.onLine ? '💭 Ideia guardada (vai ser enviada quando houver rede)' : '💭 Ideia guardada');
    return true;
  }

  const find = (id) => S().ideas.find((x) => x.id === id);
  const change = (id, fn) => Store.update((s) => { const i = s.ideas.find((x) => x.id === id); if (i) fn(i); });

  /* ---------- Vista ---------- */
  function row(i) {
    const own = i.by === me();
    const who = !own ? `${avatar(i.by, 'sm')} <b>${esc(member(i.by)?.name || '—')}</b> · ` : '';
    const when = `${i.date === today() ? 'hoje' : esc(fmtDate(i.date))}${i.time ? ` às ${esc(i.time)}` : ''}`;
    const tags = [i.source === 'voz' ? '🎤' : i.source === 'partilha' ? '📤' : '', i.shared ? '👪 partilhada' : ''].filter(Boolean).join(' ');
    return `<li class="idea-card ${i.done ? 'done' : ''}">
      <button class="idea-text" data-action="${own ? 'idea-edit' : 'noop'}" data-id="${i.id}" ${own ? 'aria-label="Editar ideia"' : 'disabled'}><span class="pre">${esc(i.text)}</span></button>
      <div class="idea-meta small muted">${who}${when}${tags ? ` · ${tags}` : ''}</div>
      <div class="idea-acts">
        <button class="btn small" data-action="idea-done" data-id="${i.id}">${i.done ? '↩️ Voltar a rever' : '✔️ Arrumar'}</button>
        ${i.done ? '' : `<button class="btn small ghost" data-action="idea-task" data-id="${i.id}">✅ Tarefa</button>
        <button class="btn small ghost" data-action="idea-note" data-id="${i.id}">📌 Mural</button>`}
        ${own ? `<button class="btn small ghost" data-action="idea-share" data-id="${i.id}" title="${i.shared ? 'Só para mim' : 'Partilhar com a família'}">${i.shared ? '🔒 Só minha' : '👪 Partilhar'}</button>
        <button class="icon-btn small" data-action="idea-del" data-id="${i.id}" aria-label="Apagar ideia">✕</button>` : ''}
      </div></li>`;
  }

  function view() {
    const all = mine();
    const tab = VS.ideaTab || 'rever';
    const open = all.filter((i) => !i.done);
    const list = tab === 'rever' ? open : all.filter((i) => i.done);
    const TABS = [['rever', `💭 Por rever${open.length ? ` (${open.length})` : ''}`], ['arrumadas', '✔️ Arrumadas']];
    return `<div class="page-head"><h1>Caixa de ideias</h1></div>
      <section class="card idea-capture">
        <form data-form="add-idea" class="idea-form">
          <textarea name="text" id="idea-text" rows="3" placeholder="Que ideia tiveste? (ex.: Fazer uma horta na varanda na Primavera)" aria-label="A ideia"></textarea>
          <div class="idea-btns">
            ${Voz.supported ? '<button type="button" class="btn primary voice-btn idea-mic" data-action="idea-mic">🎤 Falar</button>' : ''}
            <button class="btn ${Voz.supported ? '' : 'primary'} idea-save">💾 Guardar</button>
          </div>
          <p class="idea-state small muted" aria-live="polite">${Voz.supported
            ? 'Carrega em 🎤, diz a ideia e pára de falar: fica guardada sozinha.'
            : VOICE_ERR.unsupported}</p>
        </form>
        <p class="small muted idea-tip">📱 Dica: no ecrã principal, carrega sem soltar no ícone do portal e escolhe <b>Nova ideia</b>. As ideias são só tuas, a não ser que as partilhes.</p>
      </section>
      <div class="tabs" role="tablist">${TABS.map(([id, label]) => `<button role="tab" aria-selected="${tab === id}" class="tab ${tab === id ? 'active' : ''}"
        data-action="idea-tab" data-id="${id}" style="--c:#f59e0b">${label}</button>`).join('')}</div>
      ${list.length ? Ideias.groups(list, today()).map(([label, l]) => `<h2 class="sub idea-day">${label}</h2>
        <ul class="idea-list">${l.map(row).join('')}</ul>`).join('')
        : empty(tab === 'rever' ? 'Nenhuma ideia por rever. Quando tiveres uma, aponta-a aqui 💡' : 'Ainda não arrumaste nenhuma ideia.')}`;
  }

  /* ---------- Microfone: fala → texto → guarda sozinho quando se pára de falar ---------- */
  let mic = null;
  let skipVoiceSave = false; // carregou-se em Guardar a meio do ditado: quem guarda é o formulário
  // Procura sempre os elementos de novo: a página pode ser redesenhada a meio (chegou algo de outro telemóvel).
  const box = () => document.querySelector('#idea-text');
  function toggleMic() {
    if (mic) { mic.stop(); return; }
    if (!box()) return;
    skipVoiceSave = false;
    let said = '';
    const setState = (t) => { const el = document.querySelector('.idea-state'); if (el) el.textContent = t; };
    mic = Voz.listen({
      onText: (fin, interim) => {
        if (fin) {
          said = said ? `${said} ${fin}` : fin;
          const b = box();
          if (b) b.value = b.value.trim() ? `${b.value.trim()} ${fin}` : fin;
        }
        if (interim) setState(`🎙️ ${interim}…`);
      },
      onState: (on, err) => {
        const btn = document.querySelector('[data-action=idea-mic]');
        if (btn) {
          btn.textContent = on ? '⏹️ Parar' : '🎤 Falar';
          btn.classList.toggle('listening', on);
        }
        setState(err ? VOICE_ERR[err] || VOICE_ERR.start : on ? '🎙️ A ouvir… diz a tua ideia.' : '');
        if (on) return;
        mic = null;
        if (skipVoiceSave) { skipVoiceSave = false; return; }
        const b = box();
        const text = (b?.value || said).trim();
        if (!said || !text) return;
        if (b) b.value = ''; // antes de guardar: o redesenho não volta a pôr o texto na caixa
        save(text, 'voz');
      },
    });
  }

  /* ---------- Passar a tarefa / recado ---------- */
  function toTask(el) {
    const idea = find(el.dataset.id);
    if (!idea) return;
    const t = Ideias.toTask(idea);
    editItem('tasks', null, {
      title: 'tarefa',
      fields: Forms.task(),
      defaults: () => ({
        assignee: me(), due: today(), repeat: 'none', points: 2, category: 'Casa', done: false, notes: '', history: [],
        createdBy: me(),
      }),
      preset: { title: t.title, notes: t.notes, fromIdea: idea.id },
    });
    // Se a tarefa for mesmo criada, a ideia fica arrumada.
    document.querySelector('#dialog')?.addEventListener('close', () => {
      if (S().tasks.some((x) => x.fromIdea === idea.id)) {
        change(idea.id, (i) => { i.done = true; });
        toast('✅ Ideia passada a tarefa');
      }
    }, { once: true });
  }

  const actions = {
    'idea-tab': (el) => { VS.ideaTab = el.dataset.id; render(); },
    'idea-mic': toggleMic,
    'idea-done': (el) => change(el.dataset.id, (i) => { i.done = !i.done; }),
    'idea-share': (el) => {
      const i = find(el.dataset.id);
      change(el.dataset.id, (x) => { x.shared = !x.shared; });
      toast(i?.shared ? '🔒 Agora só tu vês esta ideia' : '👪 A família já vê esta ideia');
    },
    'idea-edit': (el) => editItem('ideas', el.dataset.id, {
      title: 'ideia',
      fields: [{ name: 'text', label: 'A ideia', type: 'textarea', rows: 4 }],
      transform: (d) => ({ text: Ideias.clean(d.text) || find(el.dataset.id)?.text }),
    }),
    'idea-del': (el) => { if (confirm('Apagar esta ideia?')) Store.update((s) => { s.ideas = s.ideas.filter((x) => x.id !== el.dataset.id); }); },
    'idea-task': toTask,
    'idea-note': (el) => {
      const idea = find(el.dataset.id);
      if (!idea) return;
      Store.update((s) => {
        s.notes.push({ id: Store.uid(), author: s.currentUser, text: `💡 ${idea.text}`, date: today(), pinned: false });
        const i = s.ideas.find((x) => x.id === idea.id);
        if (i) { i.done = true; i.shared = true; }
      });
      toast('📌 Ideia afixada no Mural');
    },
  };

  const inlineForms = {
    'add-idea': (f, d) => {
      if (mic) { skipVoiceSave = true; mic.stop(); }
      if (f.elements.text) f.elements.text.value = ''; // antes de guardar: o redesenho não volta a pôr o texto
      if (!save(d.text) && f.elements.text) f.elements.text.value = d.text;
    },
  };

  /* ---------- Atalho "Nova ideia" e texto partilhado de outra app ---------- */
  let entryHandled = false;
  function afterRender() {
    if (entryHandled) return;
    entryHandled = true;
    const params = new URLSearchParams(location.search);
    const shared = Ideias.fromShare(params);
    if (params.get('nova') === 'ideia' || shared) {
      history.replaceState(null, '', `${location.pathname}#/ideias`);
      VS.ideaTab = 'rever';
      if (shared) save(shared, 'partilha');
      if (location.hash !== '#/ideias') location.hash = '#/ideias';
      else render();
      setTimeout(() => document.querySelector('#idea-text')?.focus(), 80);
    }
  }

  // Secção nova, logo a seguir ao Mural.
  const i = Views.routes.findIndex((r) => r[0] === 'mural');
  Views.routes.splice(i + 1, 0, ['ideias', '💭', 'Ideias', view]);

  return { actions, inlineForms, afterRender };
};
