/* Arranque: navegação, render e tratamento de acções (delegação de eventos). */
(function () {
  const { $, today, esc } = U;
  const { editItem, toast, completeTask, reopenTask } = UI;
  const { VS, Forms, routes } = Views;
  const S = () => Store.state;
  let modules = []; // módulos extra: Fase 4 (js/actions-fase4.js), Refeições (js/refeicoes.js), Tarefas (js/tarefas-extra.js)

  /* ---------- Navegação ---------- */
  const currentRoute = () => {
    const name = location.hash.replace(/^#\/?/, '').split('/')[0];
    return routes.find((r) => r[0] === name) || routes[0];
  };

  function renderNav() {
    const [active] = currentRoute();
    $('#nav').innerHTML = routes.map(([name, icon, label]) =>
      `<a href="#/${name}" class="${name === active ? 'active' : ''}" ${name === active ? 'aria-current="page"' : ''}>
        <span class="nav-icon" aria-hidden="true">${icon}</span><span>${label}</span></a>`).join('');
  }

  function renderUser() {
    const s = S();
    $('#current-user').disabled = Store.isRemote;
    $('#current-user').innerHTML = s.members.map((m) =>
      `<option value="${m.id}" ${m.id === s.currentUser ? 'selected' : ''}>${esc(m.emoji)} ${esc(m.name)}</option>`).join('');
  }

  const SYNC_LABEL = {
    local: ['', 'Só neste dispositivo'],
    ok: ['ok', 'Sincronizado'],
    saving: ['saving', 'A guardar…'],
    offline: ['offline', 'Sem ligação — as alterações serão enviadas depois'],
  };
  function renderSync(status = Store.syncStatus) {
    const [cls, label] = SYNC_LABEL[status] || SYNC_LABEL.local;
    const el = $('#sync');
    el.className = `sync ${cls}`;
    el.title = label;
    el.hidden = !Store.isRemote;
    el.setAttribute('aria-label', label);
  }
  Store.onSync((status, detail) => {
    renderSync(status);
    if (detail) toast(detail);
  });

  async function fillInviteCodes() {
    const el = $('#invite-codes');
    if (!el) return;
    const codes = await Cloud.inviteCodes();
    if (!codes || !document.body.contains(el)) return;
    el.innerHTML = `<h3 class="sub">Convidar a família</h3>
      <p class="small">Cada pessoa cria a sua conta no portal e usa o código certo:</p>
      <div class="invite"><span>👨👩 Pais</span><code>${esc(codes.parent_code)}</code>
        <button class="btn small ghost" data-action="copy" data-text="${esc(codes.parent_code)}">Copiar</button></div>
      <div class="invite"><span>👧 Filhas/os</span><code>${esc(codes.child_code)}</code>
        <button class="btn small ghost" data-action="copy" data-text="${esc(codes.child_code)}">Copiar</button></div>
      <p class="small muted">O código dos pais dá acesso total — partilha-o só com o pai/mãe.</p>`;
  }

  function fillPanels() {
    const n = $('#notify-panel');
    if (n) Notify.fillNotifyPanel(n).catch((e) => console.warn(e));
    const c = $('#calendar-panel');
    if (c) Notify.fillCalendarPanel(c).catch((e) => console.warn(e));
  }

  /** Corre uma acção assíncrona com o botão desactivado e mostra erros de forma amigável. */
  async function withButton(el, fn, okMsg) {
    el.disabled = true;
    try {
      await fn();
      if (okMsg) toast(okMsg);
    } catch (e) {
      toast(e.message || String(e));
    } finally {
      el.disabled = false;
      fillPanels();
    }
  }

  function render() {
    if (document.body.classList.contains('gate')) return;
    const [, , label, view] = currentRoute();
    const main = $('#view');
    const scroll = window.scrollY;
    main.innerHTML = view();
    document.title = `${label} · Portal da Família`;
    renderNav();
    renderUser();
    renderSync();
    fillInviteCodes();
    fillPanels();
    modules.forEach((m) => m.afterRender?.(main));
    window.scrollTo(0, scroll);
  }

  window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });
  Store.subscribe(render);

  $('#current-user').addEventListener('change', (e) => {
    Store.update((s) => { s.currentUser = e.target.value; });
  });

  /* ---------- Acções ---------- */
  const edit = (coll, form, title, defaults) => (el) =>
    editItem(coll, el.dataset.id, { title, fields: Forms[form](), defaults, preset: presetFrom(el) });

  function presetFrom(el) {
    const p = {};
    if (el.dataset.date) p.date = el.dataset.date;
    if (el.dataset.day) p.day = Number(el.dataset.day);
    return p;
  }

  const findSub = (coll, el, key) => {
    const parent = S()[coll].find((x) => x.id === el.dataset.id);
    return parent && parent[key].find((x) => x.id === el.dataset.sub);
  };

  function download(name, text) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  const eventForm = edit('events', 'event', 'compromisso', () => ({
    date: VS.calDay || today(), repeat: 'none', members: [S().currentUser], start: '', end: '', location: '', notes: '', driver: '',
  }));
  const taskForm = edit('tasks', 'task', 'tarefa', () => ({
    assignee: S().currentUser, due: today(), repeat: 'none', points: 2, category: 'Casa', done: false, notes: '', history: [],
  }));
  const examForm = edit('exams', 'exam', 'teste / trabalho', () => ({
    memberId: VS.schoolMember || S().members.find((m) => m.role === 'filha')?.id, kind: 'Teste', date: today(), notes: '', grade: '',
  }));
  const classForm = edit('classes', 'class', 'aula', () => ({
    memberId: VS.schoolMember, day: 1, start: '08:30', end: '10:00', room: '', teacher: '',
  }));

  const actions = {
    'add-event': eventForm,
    'edit-event': eventForm,
    'add-task': taskForm,
    'edit-task': taskForm,
    'complete-task': (el) => completeTask(el.dataset.id),
    'reopen-task': (el) => reopenTask(el.dataset.id),
    'approve-task': (el) => UI.approveTask(el.dataset.id),
    'reject-task': (el) => UI.rejectTask(el.dataset.id),
    'approve-redeem': (el) => UI.decideRedemption(el.dataset.id, true),
    'reject-redeem': (el) => UI.decideRedemption(el.dataset.id, false),
    'pending-info': () => toast('Já está feita — à espera que o pai ou a mãe aprove ⏳'),
    noop: () => {},
    'task-filter': (el) => { VS.taskFilter = el.dataset.id; render(); },
    'add-reward': edit('rewards', 'reward', 'recompensa', () => ({ cost: 20 })),
    'edit-reward': edit('rewards', 'reward', 'recompensa', () => ({ cost: 20 })),
    redeem: (el) => UI.redeem(el.dataset.id),

    'add-class': classForm,
    'edit-class': classForm,
    'add-exam': examForm,
    'edit-exam': examForm,
    'school-tab': (el) => { VS.schoolMember = el.dataset.id; render(); },
    'clear-classes': () => {
      const m = S().members.find((x) => x.id === VS.schoolMember);
      if (!confirm(`Apagar todo o horário de ${m?.name}?`)) return;
      Store.update((s) => { s.classes = s.classes.filter((c) => c.memberId !== VS.schoolMember); });
    },

    'cal-prev': () => { VS.calMonth = U.addMonths(`${VS.calMonth}-01`, -1).slice(0, 7); render(); },
    'cal-next': () => { VS.calMonth = U.addMonths(`${VS.calMonth}-01`, 1).slice(0, 7); render(); },
    'cal-today': () => { VS.calDay = today(); VS.calMonth = today().slice(0, 7); render(); },
    'cal-day': (el) => {
      VS.calDay = el.dataset.date;
      VS.calMonth = el.dataset.date.slice(0, 7);
      render();
    },

    'add-project': edit('projects', 'project', 'projecto', () => ({ members: [S().currentUser], steps: [], description: '', deadline: '' })),
    'edit-project': edit('projects', 'project', 'projecto', () => ({ steps: [] })),
    'toggle-step': (el) => Store.update(() => { const st = findSub('projects', el, 'steps'); if (st) st.done = !st.done; }),
    'del-step': (el) => Store.update((s) => {
      const p = s.projects.find((x) => x.id === el.dataset.id);
      if (p) p.steps = p.steps.filter((x) => x.id !== el.dataset.sub);
    }),

    'add-trip': edit('trips', 'trip', 'viagem', () => ({
      members: S().members.map((m) => m.id), budget: 0, lodging: '', notes: '', packing: [], expenses: [], start: today(), end: '',
    })),
    'edit-trip': edit('trips', 'trip', 'viagem', () => ({ packing: [], expenses: [] })),
    'goto-trip': (el) => {
      location.hash = '#/viagens';
      setTimeout(() => document.getElementById(`trip-${el.dataset.id}`)?.scrollIntoView({ behavior: 'smooth' }), 50);
    },
    'toggle-pack': (el) => Store.update(() => { const p = findSub('trips', el, 'packing'); if (p) p.done = !p.done; }),
    'del-pack': (el) => Store.update((s) => {
      const t = s.trips.find((x) => x.id === el.dataset.id);
      if (t) t.packing = t.packing.filter((x) => x.id !== el.dataset.sub);
    }),
    'del-expense': (el) => Store.update((s) => {
      const t = s.trips.find((x) => x.id === el.dataset.id);
      if (t) t.expenses = t.expenses.filter((x) => x.id !== el.dataset.sub);
    }),

    'toggle-shop': (el) => Store.update((s) => { const x = s.shopping.find((i) => i.id === el.dataset.id); if (x) x.done = !x.done; }),
    'del-shop': (el) => Store.update((s) => { s.shopping = s.shopping.filter((i) => i.id !== el.dataset.id); }),
    'clear-shop': () => Store.update((s) => { s.shopping = s.shopping.filter((i) => !i.done); }),

    'clear-meals': () => { if (confirm('Limpar o plano de refeições da semana?')) Store.update((s) => { s.meals = {}; }); },
    'meals-to-shop': () => {
      const found = [];
      Object.values(S().meals).forEach((d) => ['lunch', 'dinner'].forEach((k) => {
        const m = (d?.[k] || '').match(/\(([^)]+)\)/);
        if (m) m[1].split(/[,;]/).map((x) => x.trim()).filter(Boolean).forEach((x) => found.push(x));
      }));
      const existing = new Set(S().shopping.filter((i) => !i.done).map((i) => i.text.toLowerCase()));
      const add = [...new Set(found)].filter((x) => !existing.has(x.toLowerCase()));
      if (!add.length) { toast('Não há ingredientes novos (escreve-os entre parênteses).'); return; }
      Store.update((s) => add.forEach((text) => s.shopping.push({
        id: Store.uid(), text, qty: '', category: 'Mercearia', done: false, addedBy: s.currentUser,
      })));
      toast(`${add.length} ingrediente(s) adicionados às compras 🛒`);
    },

    'pin-note': (el) => Store.update((s) => { const n = s.notes.find((x) => x.id === el.dataset.id); if (n) n.pinned = !n.pinned; }),
    'del-note': (el) => { if (confirm('Apagar este recado?')) Store.update((s) => { s.notes = s.notes.filter((x) => x.id !== el.dataset.id); }); },
    'add-note': () => { location.hash = '#/mural'; setTimeout(() => $('[data-form=add-note] textarea')?.focus(), 50); },

    'add-contact': edit('contacts', 'contact', 'contacto', () => ({ category: 'Escola', phone: '', email: '', notes: '' })),
    'edit-contact': edit('contacts', 'contact', 'contacto', () => ({})),

    'edit-member': (el) => {
      if (!Store.isParent()) return;
      const m = S().members.find((x) => x.id === el.dataset.id);
      if (!m) return;
      UI.openForm({
        title: `Editar: ${m.name}`,
        fields: Forms.member(),
        values: m,
        onSubmit: (data) => Store.update((s) => Object.assign(s.members.find((x) => x.id === m.id), data)),
      });
    },
    'push-on': (el) => withButton(el, Notify.enable, '🔔 Lembretes ligados neste aparelho!'),
    'push-off': (el) => withButton(el, Notify.disable, 'Lembretes desligados neste aparelho.'),
    'push-test': (el) => withButton(el, async () => {
      const r = await Notify.sendTest();
      if (!r?.sent) throw new Error('Não foi possível enviar. Desliga e volta a ligar os lembretes.');
    }, 'Teste enviado — deve aparecer dentro de segundos.'),
    'cal-reset': (el) => {
      if (!confirm('Gerar um link novo? O link antigo deixa de funcionar e terão de voltar a adicionar o calendário.')) return;
      withButton(el, Notify.resetCalendar, 'Link novo gerado.');
    },
    'export-ics': () => Notify.downloadICS(),
    'sign-out': () => { if (confirm('Terminar sessão neste dispositivo?')) Cloud.signOut(); },
    'go-cloud': () => Cloud.goToLogin(),
    copy: async (el) => {
      try {
        await navigator.clipboard.writeText(el.dataset.text);
        toast('Copiado 📋');
      } catch (e) {
        prompt('Copia o código:', el.dataset.text);
      }
    },
    export: () => download(`portal-familia-${today()}.json`, Store.exportJSON()),
    import: () => $('#import-file').click(),
    reset: () => { if (confirm('Substituir todos os dados pelos dados de exemplo?')) { Store.resetToExample(); toast('Dados de exemplo repostos.'); } },
    wipe: () => {
      const msg = `Apagar TUDO (excepto os membros e as recompensas)${Store.isRemote ? ' para toda a família' : ''}? Esta acção não pode ser desfeita.`;
      if (confirm(msg)) { Store.wipe(); toast('Portal limpo.'); }
    },
  };

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || el.tagName === 'INPUT') return;
    const fn = actions[el.dataset.action];
    if (fn) { e.preventDefault(); fn(el); }
  });

  // Checkboxes usam "change" para não interferir com o comportamento nativo.
  document.addEventListener('change', (e) => {
    const el = e.target;
    if (modules.some((m) => m.onChange?.(el))) return;
    if (el.matches('input[type=checkbox][data-action]')) {
      actions[el.dataset.action]?.(el);
    } else if (el.matches('[data-notify-pref]')) {
      Notify.savePref(el.dataset.notifyPref, el.checked)
        .then(() => toast('Preferência guardada.'))
        .catch((err) => { el.checked = !el.checked; toast(err.message || String(err)); });
    } else if (el.matches('[data-meal]')) {
      const [d, k] = el.dataset.meal.split(':');
      Store.update((s) => { s.meals[d] = { ...(s.meals[d] || {}), [k]: el.value.trim() }; });
    }
  });

  /* ---------- Formulários inline ---------- */
  const inlineForms = {
    'add-step': (f, d) => Store.update((s) => {
      s.projects.find((x) => x.id === f.dataset.id)?.steps.push({ id: Store.uid(), text: d.text, done: false });
    }),
    'add-pack': (f, d) => Store.update((s) => {
      s.trips.find((x) => x.id === f.dataset.id)?.packing.push({ id: Store.uid(), memberId: d.memberId, text: d.text, done: false });
    }),
    'add-expense': (f, d) => Store.update((s) => {
      const t = s.trips.find((x) => x.id === f.dataset.id);
      if (t) (t.expenses = t.expenses || []).push({ id: Store.uid(), text: d.text, amount: Number(d.amount) || 0 });
    }),
    'add-shop': (f, d) => Store.update((s) => {
      s.shopping.push({ id: Store.uid(), text: d.text, qty: d.qty, category: d.category, done: false, addedBy: s.currentUser });
    }),
    'add-note': (f, d) => Store.update((s) => {
      s.notes.push({ id: Store.uid(), author: s.currentUser, text: d.text, date: today(), pinned: false });
    }),
  };

  modules = [window.Fase4, window.Refeicoes, window.TarefasExtra].filter(Boolean).map((make) => make({ render, withButton }));
  modules.forEach((m) => {
    Object.assign(actions, m.actions);
    Object.assign(inlineForms, m.inlineForms || {});
  });
  document.addEventListener('input', (e) => modules.forEach((m) => m.onInput?.(e.target)));

  document.addEventListener('submit', (e) => {
    const f = e.target.closest('form[data-form]');
    if (!f) return;
    e.preventDefault();
    const data = Object.fromEntries([...new FormData(f)].map(([k, v]) => [k, String(v).trim()]));
    if (!data.text) return;
    const focusSel = `form[data-form="${f.dataset.form}"]${f.dataset.id ? `[data-id="${f.dataset.id}"]` : ''} [name=text]`;
    inlineForms[f.dataset.form]?.(f, data);
    $(focusSel)?.focus();
  });

  $('#import-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      if (!confirm('Importar este ficheiro? Os dados actuais deste dispositivo serão substituídos.')) return;
      Store.importJSON(text);
      toast('Dados importados ✔');
    } catch (err) {
      alert('Ficheiro inválido.');
    } finally {
      e.target.value = '';
    }
  });

  Cloud.boot(render);
})();
