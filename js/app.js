/* Arranque: navegação, render e tratamento de acções (delegação de eventos). */
(function () {
  const { $, today, esc, fmtDate } = U;
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
    // Horário da escola: mantém o deslocamento horizontal entre renders (ou abre no dia de hoje).
    const oldTT = main.querySelector('.timetable');
    if (oldTT) VS.ttScroll = { key: oldTT.dataset.key, left: oldTT.scrollLeft };
    main.innerHTML = view();
    document.title = `${label} · Portal da Família`;
    renderNav();
    renderUser();
    renderSync();
    fillInviteCodes();
    fillPanels();
    modules.forEach((m) => m.afterRender?.(main));
    const tt = main.querySelector('.timetable');
    if (tt) {
      const saved = VS.ttScroll;
      const col = tt.querySelector('.is-today');
      if (saved && saved.key === tt.dataset.key) tt.scrollLeft = saved.left;
      else if (col) tt.scrollLeft = col.offsetLeft - tt.offsetLeft - 8;
    }
    window.scrollTo(0, scroll);
  }

  Views.rerender = () => { if (location.hash.startsWith('#/painel') || !location.hash) render(); };
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

  /* ---------- Cópia de segurança (js/copia.js) ---------- */
  const LAST_BACKUP = 'pf-ultima-copia';
  const lastBackup = () => { try { return localStorage.getItem(LAST_BACKUP) || ''; } catch { return ''; } };
  Views.lastBackup = lastBackup;

  /** Descarrega uma cópia de tudo (e lembra a data, neste aparelho). */
  function saveBackup(name) {
    const s = S();
    const now = new Date();
    const by = s.members.find((m) => m.id === s.currentUser)?.name || '';
    download(name || Copia.fileName(now), JSON.stringify(Copia.build(s, { by, now }), null, 1));
    if (!name) {
      try { localStorage.setItem(LAST_BACKUP, now.toISOString()); } catch { /* sem armazenamento */ }
      toast('💾 Cópia descarregada. Guardem-na no Google Drive ou noutro sítio seguro.');
      render();
    }
  }

  /** Mostra o que tem a cópia e o que muda; repõe só depois de confirmar (e guarda antes uma cópia do estado actual). */
  function restoreBackup(text) {
    let b;
    try { b = Copia.parse(text); } catch (err) { alert(err.message); return; }
    const s = S();
    if (Store.isRemote && !Copia.sameFamily(s, b.data)) {
      alert('Esta cópia é de outra família (os membros não coincidem). Por segurança, não foi reposta.');
      return;
    }
    const d = Copia.diff(s, b.data);
    const items = Copia.summary(b.data);
    const when = b.created ? new Date(b.created).toLocaleString('pt-PT', { dateStyle: 'long', timeStyle: 'short' }) : 'data desconhecida';
    UI.openForm({
      title: '⬆️ Repor cópia de segurança',
      fields: [
        { name: 'info', type: 'note', html: `<p>Cópia de <b>${esc(when)}</b>${b.family ? ` · ${esc(b.family)}` : ''}:</p>
          <ul class="backup-sum">${items.map((x) => `<li>${esc(x.label)} <b>${x.n}</b></li>`).join('')}</ul>
          <p class="backup-diff">Ao repor: <b>${d.added}</b> registos voltam ou entram, <b>${d.changed}</b> mudam e <b>${d.removed}</b> são apagados${Store.isRemote ? ' — <b>para toda a família</b>' : ''}.</p>
          <p class="small muted">Antes de repor, o portal descarrega uma cópia do que está agora (para poderem voltar atrás). As fotos não estão na cópia: ficam no álbum.</p>` },
      ],
      submitLabel: 'Repor esta cópia',
      onSubmit: () => {
        saveBackup(`portal-familia-antes-de-repor-${today()}.json`);
        Store.update((st) => {
          Object.keys(b.data).forEach((c) => {
            if (c === 'shoptrip') return; // o aviso "Vou às compras" não se repõe
            if (c === 'meals') st.meals = { ...(b.data.meals || {}) };
            else if (Array.isArray(st[c]) && Array.isArray(b.data[c])) st[c] = b.data[c];
          });
        });
        toast(`✔ Cópia reposta (${d.added + d.changed} registos repostos, ${d.removed} apagados).`);
      },
    });
  }

  function download(name, text) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  const REPEAT_TXT = { weekly: 'todas as semanas', monthly: 'todos os meses', yearly: 'todos os anos' };
  /**
   * Compromisso novo ou editar. Se se repete e foi aberto a partir de um dia (data-on), dá para
   * cancelar só esse dia ("esta semana não há natação") sem mexer nos outros.
   */
  function eventForm(el) {
    const id = el.dataset.id;
    const e = id && S().events.find((x) => x.id === id);
    const on = el.dataset.on;
    const repeats = e && REPEAT_TXT[e.repeat];
    const skipped = [...(e?.skip || [])].sort();
    const fields = Forms.event();
    if (repeats) {
      fields.unshift({ name: 'info', type: 'note', html: `<p>🔁 Repete-se ${REPEAT_TXT[e.repeat]}: o que mudares aqui vale para todas as vezes.`
        + `${on && on !== e.date ? ` A data abaixo é a da primeira vez.` : ''}</p>`
        + `${on && e.overrides?.[on] ? `<p>🕐 <b>${esc(fmtDate(on))} tem horário especial</b> (${esc(e.overrides[on].start || e.start || 'sem hora')}) — usa "🕐 Só em…" para o mudar.</p>` : ''}` });
      if (skipped.length) {
        fields.push({ name: 'restore', label: `Dias cancelados (${skipped.length}) — voltar a haver?`, type: 'select',
          options: [['', `Não: ${skipped.map((d) => fmtDate(d)).join(', ')}`], ...skipped.map((d) => [d, `↩️ Voltar a haver em ${fmtDate(d)}`])] });
      }
    }
    UI.editItem('events', id, {
      title: 'compromisso',
      fields,
      defaults: () => ({
        date: VS.calDay || today(), repeat: 'none', members: [S().currentUser], start: '', end: '', location: '', notes: '', driver: '',
      }),
      preset: presetFrom(el),
      deleteConfirm: repeats ? `Apagar "${e.title}" de TODAS as vezes?${on ? ' (Para cancelar só um dia, usa o botão ❌.)' : ''}` : undefined,
      extra: repeats && on && !skipped.includes(on) ? [{
        label: `🕐 Só em ${fmtDate(on)}`,
        onClick: () => { setTimeout(() => dayForm(id, on), 0); },
      }, {
        label: `❌ Não há em ${fmtDate(on)}`,
        onClick: () => {
          Store.update((s) => {
            const x = s.events.find((y) => y.id === id);
            if (!x) return;
            x.skip = [...new Set([...(x.skip || []), on])].sort();
            if (x.overrides?.[on]) delete x.overrides[on];
          });
          toast(`❌ ${e.title}: cancelado só em ${fmtDate(on)}. As outras vezes continuam.`);
        },
      }] : [],
      transform: (d) => {
        const { restore, ...rest } = d;
        if (restore) rest.skip = skipped.filter((x) => x !== restore);
        return rest;
      },
    });
  }
  /**
   * Mudar só um dia de um compromisso que se repete ("esta terça a natação é às 19h"):
   * hora, local e quem leva desse dia; as outras vezes ficam como estão.
   */
  function dayForm(id, on) {
    const e = S().events.find((x) => x.id === id);
    if (!e) return;
    const o = e.overrides?.[on] || {};
    UI.openForm({
      title: `🕐 ${e.title} — só em ${fmtDate(on)}`,
      fields: [
        { name: 'info', type: 'note', html: `<p>Normalmente: <b>${esc(e.start || 'sem hora')}${e.end ? `–${esc(e.end)}` : ''}</b>${e.location ? ` · ${esc(e.location)}` : ''}. O que mudares aqui vale <b>só para este dia</b>.</p>` },
        { name: 'start', label: 'Início', type: 'time', half: true },
        { name: 'end', label: 'Fim', type: 'time', half: true },
        { name: 'location', label: 'Local', half: true },
        { name: 'driver', label: 'Quem leva / vai buscar?', type: 'select', half: true, options: UI.memberOptions(true, '—') },
        { name: 'note', label: 'Nota (ex.: treino de compensação)' },
      ],
      values: { start: o.start ?? e.start ?? '', end: o.end ?? e.end ?? '', location: o.location ?? e.location ?? '', driver: o.driver ?? e.driver ?? '', note: o.note || '' },
      submitLabel: 'Guardar só este dia',
      onSubmit: (d) => {
        // Só guarda o que é diferente do habitual.
        const diff = {};
        ['start', 'end', 'location', 'driver'].forEach((k) => { if ((d[k] || '') !== (e[k] || '')) diff[k] = d[k] || ''; });
        if (d.note) diff.note = d.note;
        Store.update((s) => {
          const x = s.events.find((y) => y.id === id);
          if (!x) return;
          const all = { ...(x.overrides || {}) };
          if (Object.keys(diff).length) all[on] = diff; else delete all[on];
          x.overrides = all;
        });
        toast(Object.keys(diff).length ? `🕐 ${e.title}: ${fmtDate(on)}${diff.start ? ` às ${diff.start}` : ''} — só este dia.` : 'Sem alterações: fica como habitual.');
      },
      ...(e.overrides?.[on] ? {
        onDelete: () => Store.update((s) => {
          const x = s.events.find((y) => y.id === id);
          if (x?.overrides) { const all = { ...x.overrides }; delete all[on]; x.overrides = all; }
        }),
        deleteLabel: 'Voltar ao habitual', deleteConfirm: `Voltar ao horário habitual em ${fmtDate(on)}?`, deleteToast: 'Voltou ao horário habitual.',
      } : {}),
    });
  }

  /** Tarefa nova ou editar. As filhas não mudam os pontos e só apagam as tarefas que elas próprias criaram. */
  function taskForm(el) {
    const id = el.dataset.id;
    const item = id && S().tasks.find((x) => x.id === id);
    UI.editItem('tasks', id, {
      title: 'tarefa',
      fields: Forms.task(),
      defaults: () => ({
        assignee: S().currentUser, due: today(), repeat: 'none', points: 2, category: 'Casa', done: false, notes: '', history: [],
        createdBy: S().currentUser,
      }),
      preset: presetFrom(el),
      canDelete: Store.isParent() || !item || item.createdBy === S().currentUser,
    });
  }
  /* ---------- Compras: produtos da família e itens da lista ---------- */
  const catalog = () => CatalogoCompras.merged(S().products);
  const secOptions = () => [CatalogoCompras.NOSSOS, ...CatalogoCompras.SECCOES.map(([n]) => n)].map((n) => [n, n]);
  const catOptions = () => Views.SHOP_CATS.map((c) => [c, c]);

  /** Novo produto, ou alterar um (dos da família ou do catálogo de origem). */
  function productForm(item) {
    const own = !item || item.own;
    UI.openForm({
      title: item ? `✎ ${item.nome}` : '＋ Novo produto',
      fields: [
        { name: 'nome', label: 'Nome do produto', required: true, placeholder: 'Ex.: Queijo de Azeitão' },
        { name: 'seccao', label: 'Secção dos produtos habituais', type: 'select', half: true, options: secOptions() },
        { name: 'categoria', label: 'Categoria na lista', type: 'select', half: true, options: catOptions() },
      ],
      values: item ? { nome: item.nome, seccao: item.seccao, categoria: item.categoria }
        : { seccao: CatalogoCompras.NOSSOS, categoria: 'Outro' },
      onSubmit: (d) => {
        const { strip } = CatalogoCompras;
        // Outro produto com o mesmo nome (o próprio produto pode manter o nome).
        const clash = catalog().find((i) => strip(i.nome) === strip(d.nome) && (!item || strip(i.nome) !== strip(item.nome)));
        if (clash) { toast(`Já existe "${clash.nome}" em ${clash.seccao}.`); return; }
        VS.shopSection = d.seccao; // mostra a secção onde o produto ficou
        VS.catalogQuery = '';
        Store.update((s) => {
          if (!item) {
            s.products.push({ id: Store.uid(), nome: d.nome, seccao: d.seccao, categoria: d.categoria });
          } else if (own) {
            Object.assign(s.products.find((p) => p.id === item.id) || {}, { nome: d.nome, seccao: d.seccao, categoria: d.categoria });
          } else {
            const cur = s.products.find((p) => p.base && CatalogoCompras.strip(p.base) === CatalogoCompras.strip(item.base));
            const data = { base: item.base, nome: d.nome, seccao: d.seccao, categoria: d.categoria, renamed: true, hidden: false };
            if (cur) Object.assign(cur, data);
            else s.products.push({ id: Store.uid(), ...data });
          }
        });
        toast(item ? '✔ Produto alterado' : `⭐ ${d.nome} guardado nos vossos produtos`);
      },
      onDelete: item ? () => Store.update((s) => {
        if (own) {
          s.products = s.products.filter((p) => p.id !== item.id);
          return;
        }
        const cur = s.products.find((p) => p.base && CatalogoCompras.strip(p.base) === CatalogoCompras.strip(item.base));
        if (cur) cur.hidden = true;
        else s.products.push({ id: Store.uid(), base: item.base, hidden: true });
      }) : null,
      deleteLabel: own ? 'Apagar' : 'Esconder',
      deleteConfirm: own ? `Apagar "${item?.nome}" dos vossos produtos?` : `Esconder "${item?.nome}"? (Dá para o mostrar outra vez em ✎ Editar produtos.)`,
      deleteToast: own ? 'Apagado.' : 'Escondido.',
    });
  }

  /** Mudar a quantidade, o nome ou a categoria de um item da lista. */
  function editShopItem(el) {
    const x = S().shopping.find((i) => i.id === el.dataset.id);
    if (!x) return;
    const known = CatalogoCompras.priceOf(x, S().shopstats);
    const prefs = CatalogoCompras.prefsOf(x, S().shopstats);
    UI.openForm({
      title: `✎ ${x.text}`,
      fields: [
        { name: 'qty', label: 'Quantidade', half: true, placeholder: 'Ex.: 2, 1 kg, 6 latas' },
        { name: 'price', label: 'Preço por unidade/kg (€)', type: 'number', min: 0, step: '0.01', half: true, placeholder: 'Ex.: 0,89' },
        { name: 'category', label: 'Categoria', type: 'select', half: true, options: catOptions() },
        { name: 'store', label: 'Onde comprar', type: 'select', half: true,
          options: [['', 'Qualquer loja'], ...Views.shopHooks.stores().map((st) => [st, st])] },
        { name: 'text', label: 'Produto', required: true },
        { name: 'brand', label: '🏷️ Marca preferida', half: true, placeholder: 'Ex.: Mimosa, Compal…' },
        { name: 'note', label: '📝 Nota para quem vai às compras', half: true, placeholder: 'Ex.: sem lactose, o de pacote azul' },
        { name: 'hist', type: 'note', html: Views.shopHooks.historyHtml(x.text) },
        { name: 'pic', type: 'note', html: Views.shopHooks.imgHtml(x, 'prod-photo') },
      ],
      values: {
        qty: x.qty || '', price: known || '', category: x.category || 'Outro', text: x.text,
        store: CatalogoCompras.storeOf(x, S().shopstats, Views.shopHooks.stores()), ...prefs,
      },
      onSubmit: (d) => {
        Store.update((s) => {
          const cur = s.shopping.find((i) => i.id === x.id);
          if (cur) Object.assign(cur, { qty: d.qty, category: d.category, text: d.text });
        });
        // Preço novo (ou alterado): fica no item e memorizado para a próxima vez. Se o último preço
        // foi registado hoje numa loja, é uma correcção desse preço (mesma loja).
        const m = CatalogoCompras.memo(S().shopstats, x.text);
        if (d.price > 0 && d.price !== known) Views.shopHooks.setItemPrice(x.id, d.price, m?.date === today() ? m.store : '');
        // Loja: fica no item e memorizada para o produto (só se mudou).
        const cur = S().shopping.find((i) => i.id === x.id);
        if (cur && d.store !== CatalogoCompras.storeOf(cur, S().shopstats, Views.shopHooks.stores())) Views.shopHooks.setItemStore(x.id, d.store);
        // Marca e nota: ficam memorizadas para o produto (aparecem da próxima vez que entrar na lista).
        if (cur && (d.brand.trim() !== prefs.brand || d.note.trim() !== prefs.note)) Views.shopHooks.setItemPrefs(x.id, d);
      },
      onDelete: () => Store.update((s) => { s.shopping = s.shopping.filter((i) => i.id !== x.id); }),
      deleteLabel: 'Tirar da lista', deleteConfirm: `Tirar "${x.text}" da lista?`, deleteToast: 'Saiu da lista.',
    });
    setTimeout(() => document.querySelector('#f-qty')?.focus(), 50);
  }

  /** Copiar a mala de outra viagem ou de uma lista-modelo. */
  function copyPackForm(el) {
    const s = S();
    const trip = s.trips.find((x) => x.id === el.dataset.id);
    if (!trip) return;
    const others = s.trips.filter((x) => x.id !== trip.id && (x.packing || []).length)
      .sort((a, b) => (b.start || '').localeCompare(a.start || ''));
    UI.openForm({
      title: `📋 Copiar lista para ${trip.destination}`,
      fields: [
        { name: 'source', label: 'Copiar de', type: 'select', options: [
          ...others.map((x) => [`viagem:${x.id}`, `✈️ ${x.destination} (${x.packing.length} itens)`]),
          ...Mala.MODELOS.map(([id, label]) => [`modelo:${id}`, `Modelo: ${label}`]),
        ] },
        { name: 'who', label: 'Itens pessoais para quem?', type: 'members' },
      ],
      values: { source: others[0] ? `viagem:${others[0].id}` : 'modelo:essenciais', who: trip.members?.length ? trip.members : s.members.map((m) => m.id) },
      submitLabel: 'Copiar',
      onSubmit: (d) => {
        const items = Mala.itemsToCopy({ trip, trips: s.trips, source: d.source, who: d.who, uid: Store.uid });
        if (items.length) Store.update((st) => { st.trips.find((x) => x.id === trip.id)?.packing.push(...items); });
        toast(items.length ? `🧳 ${items.length} itens copiados (tudo por marcar)` : 'Já tinha tudo isso na lista. 👌');
      },
    });
  }

  const examForm = edit('exams', 'exam', 'teste / trabalho', () => ({
    memberId: !Store.isParent() ? S().currentUser : VS.schoolMember || S().members.find((m) => m.role === 'filha')?.id, kind: 'Teste', date: today(), notes: '', grade: '',
  }));
  const classForm = edit('classes', 'class', 'aula', () => ({
    memberId: !Store.isParent() ? S().currentUser : VS.schoolMember, every: 1, day: 1, start: '08:30', end: '10:00', room: '', teacher: '',
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

    // Guia "Pôr a família a funcionar" (js/guia.js): leva ao sítio certo de cada passo.
    'guide-go': (el) => {
      const go = el.dataset.id;
      if (go === 'contas') VS.finTab = 'contas';
      if (go === 'financas') VS.finTab = 'carteiras';
      if (go === 'compras') VS.staplesOpen = true;
      location.hash = `#/${go === 'contas' ? 'financas' : go}`;
    },
    'guide-hide': () => { Guia.hide(S().currentUser); render(); toast('Guia escondido — volta daqui a uma semana se ainda faltar alguma coisa.'); },
    'pack-group': (el) => {
      VS.packOpen = { ...(VS.packOpen || {}), [el.dataset.id]: el.dataset.open !== '1' };
      render();
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
    'pack-qty': (el) => Store.update(() => {
      const p = findSub('trips', el, 'packing');
      if (p) p.qty = Math.min(99, Math.max(1, (Number(p.qty) || 1) + Number(el.dataset.d)));
    }),
    'reset-pack': (el) => {
      if (!confirm('Desmarcar todos os itens da mala (para voltar a fazê-la)?')) return;
      Store.update((s) => { s.trips.find((x) => x.id === el.dataset.id)?.packing.forEach((p) => { p.done = false; }); });
    },
    'copy-pack': copyPackForm,
    'del-expense': (el) => Store.update((s) => {
      const t = s.trips.find((x) => x.id === el.dataset.id);
      if (t) t.expenses = t.expenses.filter((x) => x.id !== el.dataset.sub);
    }),

    'toggle-shop': (el) => Store.update((s) => { const x = s.shopping.find((i) => i.id === el.dataset.id); if (x) x.done = !x.done; }),
    'del-shop': (el) => Store.update((s) => { s.shopping = s.shopping.filter((i) => i.id !== el.dataset.id); }),
    'clear-shop': () => Store.update((s) => { s.shopping = s.shopping.filter((i) => !i.done); }),
    'catalog-toggle': () => { VS.shopCatalog = !VS.shopCatalog; VS.catalogQuery = ''; render(); },
    'catalog-sec': (el) => { VS.shopSection = el.dataset.id; VS.catalogQuery = ''; render(); },
    'catalog-edit': () => { VS.catalogEdit = !VS.catalogEdit; render(); },
    'product-new': () => productForm(null),
    'product-edit': (el) => productForm(CatalogoCompras.find(el.dataset.name, catalog())),
    'catalog-unhide': () => Store.update((s) => {
      s.products = s.products.filter((p) => !(p.base && p.hidden && !p.renamed));
      s.products.forEach((p) => { if (p.hidden) p.hidden = false; });
    }),
    'edit-shop': editShopItem,
    'catalog-add': (el) => {
      const item = CatalogoCompras.find(el.dataset.name, catalog());
      if (!item) return;
      const k = CatalogoCompras.strip(item.nome);
      let added = true;
      Store.update((s) => {
        const cur = s.shopping.filter((i) => !i.done && CatalogoCompras.strip(i.text) === k);
        if (cur.length) {
          added = false;
          s.shopping = s.shopping.filter((i) => !cur.includes(i));
        } else {
          s.shopping.push({ id: Store.uid(), text: item.nome, qty: '', category: item.categoria, done: false, addedBy: s.currentUser });
        }
      });
      toast(added ? `🛒 ${item.nome} na lista` : `${item.nome} saiu da lista`);
    },

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
    export: () => saveBackup(),
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
    'add-pack': (f, d) => {
      const { qty, text } = Mala.parseLine(d.text, d.qty);
      // Abre a secção dessa pessoa, para se ver o que se juntou.
      VS.packOpen = { ...(VS.packOpen || {}), [`${f.dataset.id}:${d.memberId || ''}`]: true };
      Store.update((s) => {
        s.trips.find((x) => x.id === f.dataset.id)?.packing.push({ id: Store.uid(), memberId: d.memberId, text, qty, done: false });
      });
    },
    'add-expense': (f, d) => Store.update((s) => {
      const t = s.trips.find((x) => x.id === f.dataset.id);
      if (t) (t.expenses = t.expenses || []).push({ id: Store.uid(), text: d.text, amount: Number(d.amount) || 0 });
    }),
    'add-shop': (f, d) => {
      const k = CatalogoCompras.strip(d.text);
      if (S().shopping.some((i) => !i.done && CatalogoCompras.strip(i.text) === k)) {
        toast(`${d.text} já está na lista 👍`);
        return;
      }
      const known = CatalogoCompras.find(d.text, catalog());
      const text = known?.nome || d.text.charAt(0).toUpperCase() + d.text.slice(1);
      // Produto conhecido vai sempre para a sua categoria (no iPhone, escolher uma sugestão
      // nem sempre dispara o evento que acerta a categoria no formulário).
      const category = known?.categoria || d.category;
      Store.update((s) => {
        s.shopping.push({ id: Store.uid(), text, qty: d.qty, category, done: false, addedBy: s.currentUser });
        // Produto novo: fica guardado nos produtos habituais da família para a próxima vez.
        if (!known && text.length >= 2) {
          s.products.push({ id: Store.uid(), nome: text, seccao: CatalogoCompras.NOSSOS, categoria: d.category });
        }
      });
      if (!known) toast(`🛒 ${text} na lista · ⭐ guardado nos vossos produtos`);
    },
    'add-note': (f, d) => Store.update((s) => {
      s.notes.push({ id: Store.uid(), author: s.currentUser, text: d.text, date: today(), pinned: false });
    }),
  };

  modules = [window.Fase4, window.Refeicoes, window.TarefasExtra, window.ComprasExtra, window.FinancasPatrimonio, window.FinancasOrcamento].filter(Boolean).map((make) => make({ render, withButton }));
  modules.forEach((m) => {
    Object.assign(actions, m.actions);
    Object.assign(inlineForms, m.inlineForms || {});
  });
  document.addEventListener('input', (e) => modules.forEach((m) => m.onInput?.(e.target)));

  /* Compras: pesquisa no catálogo e categoria automática ao escrever um produto conhecido. */
  document.addEventListener('input', (e) => {
    const el = e.target;
    if (el.id === 'catalog-search') {
      VS.catalogQuery = el.value;
      const q = CatalogoCompras.strip(el.value);
      const chips = [...document.querySelectorAll('.cat-chip')];
      chips.forEach((c) => { c.hidden = q ? !c.dataset.search.includes(q) : c.dataset.sec !== (VS.shopSection || CatalogoCompras.SECCOES[0][0]); });
      document.querySelector('.catalog-secs').hidden = !!q;
      document.querySelector('.catalog-none').hidden = !q || chips.some((c) => !c.hidden);
    }
    if (el.name === 'text' && el.form?.dataset.form === 'add-shop') {
      const item = CatalogoCompras.find(el.value, catalog());
      if (item) el.form.elements.category.value = item.categoria;
    }
  });

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
      restoreBackup(await file.text());
    } catch (err) {
      alert('Não foi possível ler o ficheiro.');
    } finally {
      e.target.value = '';
    }
  });

  Cloud.boot(render);
})();
