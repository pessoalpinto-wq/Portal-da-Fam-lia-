/*
 * Compras — extras:
 *  - modo "No supermercado" (ecrã só para usar na loja: letras grandes, por secção,
 *    um toque risca, o ecrã não se apaga);
 *  - "os do costume": lista base da família, repor o que falta num toque, sugestões
 *    a partir do que mais se compra;
 *  - "Vou às compras" (aviso à família) e partilhar a lista;
 *  - preços (memorizados por produto), total estimado, talão e orçamento do supermercado.
 */
window.ComprasExtra = function ({ render }) {
  const { esc, money, today } = U;
  const { VS, SHOP_CATS } = Views;
  const S = () => Store.state;

  const { CAT_EMOJI } = CatalogoCompras;

  /* ---------- Ecrã sempre ligado (Wake Lock) ---------- */
  let lock = null;
  const canKeepAwake = 'wakeLock' in navigator;
  async function keepAwake(on) {
    try {
      if (on && !lock && canKeepAwake && document.visibilityState === 'visible') {
        lock = await navigator.wakeLock.request('screen');
        lock.addEventListener('release', () => { lock = null; });
      } else if (!on && lock) {
        await lock.release();
        lock = null;
      }
    } catch { /* o browser pode recusar (bateria fraca, etc.) — não faz mal */ }
  }
  const inMarket = () => !!VS.shopMode && location.hash.startsWith('#/compras');
  // O ecrã volta a poder apagar-se quando se sai da app; ao voltar, pede outra vez.
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && inMarket()) keepAwake(true); });

  /* ---------- Vista "No supermercado" ---------- */
  function market() {
    const s = S();
    const allPending = s.shopping.filter((x) => !x.done);
    // Só o que se compra na loja escolhida (e em qualquer loja).
    const pending = filterPending(allPending);
    const elsewhere = allPending.length - pending.length;
    const done = s.shopping.filter((x) => x.done);
    const total = pending.length + done.length;
    const pct = total ? Math.round((done.length / total) * 100) : 0;
    const cats = [...new Set([...SHOP_CATS, ...pending.map((x) => x.category || 'Outro')])];
    const est = C.estimate([...pending, ...done], s.shopstats);
    const row = (x) => {
      const t = C.lineTotal(x, s.shopstats);
      return `<li class="market-row"><button class="market-item ${x.done ? 'done' : ''}" data-action="toggle-shop" data-id="${x.id}"
        aria-pressed="${!!x.done}" aria-label="${esc(x.text)}${x.qty ? `, ${esc(x.qty)}` : ''}${x.done ? ', já no carrinho' : ''}">
        <span class="market-check" aria-hidden="true">${x.done ? '✔' : ''}</span>
        <span class="market-text">${x.qty ? `<b class="market-qty">${esc(x.qty)}</b> ` : ''}${esc(x.text)}</span>
      </button>
      <button class="market-price ${t ? 'has' : ''}" data-action="shop-price" data-id="${x.id}" aria-label="Preço de ${esc(x.text)}">${t ? money(t) : '€'}</button></li>`;
    };
    const finished = total && !pending.length;
    return `<div class="market">
      <header class="market-head">
        <div class="market-title"><b>🛒 No supermercado</b>
          <small>${done.length} de ${total} no carrinho${canKeepAwake ? ' · 💡 ecrã sempre ligado' : ''}</small>
          ${est.total ? `<small class="market-money">💶 No carrinho <b>${money(est.cart)}</b> de ~${money(est.total)}${est.missing ? ` · ${est.missing} sem preço` : ''}</small>` : ''}</div>
        <button class="btn small" data-action="shop-mode-exit">Sair</button>
      </header>
      <div class="progress market-progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct}%"></span></div>
      ${storeBar(allPending)}
      ${finished ? `<section class="market-done-card">
          <p class="market-big">🎉</p><h2>Compras feitas!</h2><p class="muted">Está tudo no carrinho${est.cart ? ` · cerca de ${money(est.cart)}` : ''}.</p>
          ${elsewhere ? `<p class="small">Ficam na lista ${elsewhere} produto${elsewhere === 1 ? '' : 's'} para comprar noutras lojas.</p>` : ''}
          <div class="btn-row"><button class="btn primary" data-action="receipt-new">💶 Registar o talão e sair</button>
          <button class="btn" data-action="shop-mode-finish">✔ Limpar a lista e sair</button>
          <button class="btn ghost" data-action="shop-mode-exit">Sair sem limpar</button></div></section>` : ''}
      ${!total ? '<p class="empty">A lista está vazia. Junta o que falta e volta aqui. 🧺</p>' : ''}
      ${cats.map((c) => {
        const items = pending.filter((x) => (x.category || 'Outro') === c);
        return items.length ? `<h3 class="market-cat">${CAT_EMOJI[c] || '🛍️'} ${esc(c)} <small>(${items.length})</small></h3>
          <ul class="market-list">${items.map(row).join('')}</ul>` : '';
      }).join('')}
      <form class="inline-add market-add" data-form="add-shop">
        <input name="text" placeholder="Esqueci-me de…" required aria-label="Juntar produto" list="shop-suggest" autocomplete="off">
        <input type="hidden" name="category" value="Outro"><input type="hidden" name="qty" value="">
        <button class="btn">＋</button>
      </form>
      <datalist id="shop-suggest">${CatalogoCompras.merged(s.products).map((i) => `<option value="${esc(i.nome)}"></option>`).join('')}</datalist>
      ${done.length ? `<h3 class="market-cat done">✔ No carrinho <small>(${done.length})</small></h3>
        <ul class="market-list">${done.map(row).join('')}</ul>` : ''}
    </div>`;
  }

  /* ---------- Os do costume ---------- */
  const C = CatalogoCompras;
  const catalog = () => C.merged(S().products);

  function staplesPanel(pending) {
    const s = S();
    const staples = s.staples || [];
    const missing = C.missingStaples(staples, s.shopping);
    const open = VS.staplesOpen;
    const bar = `<div class="catalog-bar staples-bar">
      <button class="btn small ${open ? '' : 'ghost'}" data-action="staples-toggle" aria-expanded="${!!open}">
        ⭐ Os do costume${staples.length ? ` (${staples.length})` : ''}</button>
      ${!open && missing.length ? `<button class="btn small primary" data-action="staples-fill">🔄 Repor os do costume (${missing.length})</button>` : ''}</div>`;
    if (!open) return bar;
    const inList = new Set(pending.map((x) => C.strip(x.text)));
    const sugg = C.suggestions(s.shopstats, staples);
    return `${bar}<div class="staples">
      <p class="small muted">O que compram quase sempre. Com <b>🔄 Repor</b> entra na lista tudo o que falta, sem repetir. Toca num produto para mudar a quantidade ou tirá-lo.</p>
      ${staples.length ? `<div class="btn-row"><button class="btn primary" data-action="staples-fill" ${missing.length ? '' : 'disabled'}>
          🔄 ${missing.length ? `Repor os do costume (${missing.length})` : 'Já está tudo na lista'}</button></div>
        <div class="catalog-items staples-items">${staples.map((st) => `<button class="cat-chip ${inList.has(C.strip(st.text)) ? 'in' : ''}" data-action="staple-edit" data-id="${st.id}">
          ${inList.has(C.strip(st.text)) ? '✔ ' : ''}${st.qty ? `<b>${esc(st.qty)}</b> ` : ''}${esc(st.text)}</button>`).join('')}</div>`
        : `<p class="empty small">Ainda não há produtos do costume.</p>
          ${pending.length ? `<button class="btn small" data-action="staples-from-list">⭐ Guardar a lista atual (${pending.length}) como os do costume</button>` : ''}`}
      <form class="inline-add staples-add" data-form="add-staple">
        <input name="text" placeholder="Juntar aos do costume (ex.: leite)…" required aria-label="Produto do costume" list="shop-suggest" autocomplete="off">
        <input name="qty" placeholder="Qtd." class="num" aria-label="Quantidade">
        <button class="btn small">＋</button>
      </form>
      ${sugg.length ? `<p class="small staples-sugg-title">💡 Compram muitas vezes — juntar aos do costume?</p>
        <div class="catalog-items">${sugg.map((x) => `<button class="cat-chip sugg" data-action="staple-suggest" data-name="${esc(x.name)}">＋ ${esc(x.name)} <small>${x.count}×</small></button>`).join('')}</div>` : ''}
    </div>`;
  }

  /** Junta um produto aos do costume (com o nome e a categoria do catálogo, se o conhecer). */
  function addStaple(s, text, qty = '', category = '') {
    const known = C.find(text, catalog());
    const name = known?.nome || text.charAt(0).toUpperCase() + text.slice(1);
    if (s.staples.some((x) => C.strip(x.text) === C.strip(name))) return false;
    s.staples.push({ id: Store.uid(), text: name, qty: qty || '', category: known?.categoria || category || 'Outro' });
    return true;
  }

  function fillStaples() {
    const s = S();
    const missing = C.missingStaples(s.staples, s.shopping);
    if (!missing.length) { UI.toast('Os do costume já estão todos na lista. 👍'); return; }
    Store.update((st) => missing.forEach((x) => st.shopping.push({
      id: Store.uid(), text: x.text, qty: x.qty || '', category: x.category || 'Outro', done: false, addedBy: st.currentUser,
    })));
    UI.toast(`🔄 ${missing.length} produto${missing.length === 1 ? '' : 's'} do costume na lista`);
  }

  function stapleForm(el) {
    const st = S().staples.find((x) => x.id === el.dataset.id);
    if (!st) return;
    UI.openForm({
      title: `⭐ ${st.text}`,
      fields: [
        { name: 'qty', label: 'Quantidade habitual', half: true, placeholder: 'Ex.: 2, 1 kg, 6 latas' },
        { name: 'category', label: 'Categoria', type: 'select', half: true, options: SHOP_CATS.map((c) => [c, c]) },
        { name: 'text', label: 'Produto', required: true },
      ],
      values: { qty: st.qty || '', category: st.category || 'Outro', text: st.text },
      onSubmit: (d) => Store.update((s) => { Object.assign(s.staples.find((x) => x.id === st.id) || {}, d); }),
      onDelete: () => Store.update((s) => { s.staples = s.staples.filter((x) => x.id !== st.id); }),
      deleteLabel: 'Tirar dos do costume', deleteConfirm: `Tirar "${st.text}" dos do costume?`, deleteToast: 'Saiu dos do costume.',
    });
  }

  /* ---------- "Vou às compras" ---------- */
  const trip = () => (S().shoptrip || []).find((x) => x.id === 'current');
  const leaveAt = (t) => new Date(Date.parse(t.at) + (Number(t.minutes) || 0) * 60000);
  // O aviso fica à vista até 3 horas depois da hora de saída.
  const tripActive = (t) => t && Date.now() < leaveAt(t).getTime() + 3 * 3600000;
  const hhmm = (d) => d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });

  function banner() {
    const t = trip();
    if (!tripActive(t)) return '';
    const m = UI.member(t.by);
    const mine = t.by === S().currentUser;
    const when = Number(t.minutes) && leaveAt(t) > new Date() ? `às ${hhmm(leaveAt(t))}` : 'agora';
    return `<section class="card shoptrip">
      <span class="shoptrip-ico" aria-hidden="true">📣</span>
      <p><b>${esc(m?.name || 'Alguém')} vai às compras ${when}</b>${t.store ? ` · ${esc(t.store)}` : ''}<br>
        <small class="muted">${mine ? `${Store.isRemote ? 'A família foi avisada. ' : ''}Quando voltares, carrega em "Já fui".` : 'Falta alguma coisa? Acrescenta já à lista! 👇'}</small></p>
      ${mine ? '<button class="btn small" data-action="shoptrip-done">✔ Já fui</button>' : ''}
    </section>`;
  }

  function announceForm() {
    UI.openForm({
      title: '📣 Vou às compras',
      fields: [
        { name: 'minutes', label: 'Quando sais?', type: 'select', half: true,
          options: [['0', 'Agora'], ['15', 'Daqui a 15 min'], ['30', 'Daqui a 30 min'], ['60', 'Daqui a 1 hora'], ['120', 'Daqui a 2 horas']] },
        { name: 'store', label: 'Onde? (opcional)', half: true, placeholder: 'Ex.: Continente, Lidl, praça' },
      ],
      values: { minutes: '30', store: trip()?.store || '' },
      submitLabel: '📣 Avisar a família',
      onSubmit: (d) => {
        const minutes = Number(d.minutes) || 0;
        Store.update((s) => {
          s.shoptrip = [{ id: 'current', by: s.currentUser, at: new Date().toISOString(), minutes, store: d.store }];
        });
        notifyFamily(minutes, d.store);
      },
    });
  }

  /** Notificação no telemóvel da família (precisa da conta na nuvem). */
  async function notifyFamily(minutes, store) {
    const ctx = window.Cloud?.ctx?.();
    if (!ctx) { UI.toast('📣 Aviso posto na lista. (As notificações no telemóvel precisam da conta na nuvem.)'); return; }
    try {
      const { data, error } = await ctx.client.functions.invoke('send-reminders', { body: { announce: 'shopping', minutes, store } });
      if (error || data?.error) throw error || new Error(data.error);
      if (data.repeated) UI.toast('📣 Já tinhas avisado há pouco — o aviso está na lista.');
      else if (data.people) UI.toast(`📣 Avisei ${data.people} pessoa${data.people === 1 ? '' : 's'} no telemóvel.`);
      else UI.toast('📣 Aviso posto na lista. (Mais ninguém tem as notificações ligadas neste momento.)');
    } catch (e) {
      console.warn('aviso compras', e);
      UI.toast('📣 Aviso posto na lista, mas não consegui enviar as notificações agora.');
    }
  }

  /* ---------- Partilhar a lista (WhatsApp, SMS, copiar) ---------- */
  /** Texto da lista a partilhar: respeita o filtro de loja escolhido. */
  function listText() {
    const cur = curStore();
    return C.shareText(filterPending(S().shopping.filter((i) => !i.done)), SHOP_CATS, cur === 'all' ? '' : cur);
  }

  function shareDialog() {
    const text = listText();
    const dlg = document.getElementById('dialog');
    dlg.innerHTML = `<div class="form share-dlg">
      <header class="form-head"><h2>📤 Partilhar a lista</h2>
        <button type="button" class="icon-btn" data-action="dlg-close" aria-label="Fechar">✕</button></header>
      <pre class="share-preview">${esc(text)}</pre>
      <div class="share-btns">
        ${navigator.share ? '<button class="btn primary" data-action="share-native">📤 Partilhar…</button>' : ''}
        <a class="btn share-wa" href="https://wa.me/?text=${encodeURIComponent(text)}" target="_blank" rel="noopener">💬 WhatsApp</a>
        <a class="btn" href="sms:?&body=${encodeURIComponent(text)}">✉️ SMS</a>
        <button class="btn" data-action="share-copy">📋 Copiar</button>
      </div>
    </div>`;
    dlg.showModal();
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Alternativa para navegadores sem acesso à área de transferência.
      const ta = Object.assign(document.createElement('textarea'), { value: text });
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    UI.toast('📋 Lista copiada — é só colar na mensagem.');
  }

  /* ---------- Preços ---------- */
  /** Põe o preço (por unidade/kg) no item e memoriza-o para a próxima vez, com a data e a loja. */
  function setItemPrice(id, price, store = '') {
    Store.update((s) => {
      const x = s.shopping.find((i) => i.id === id);
      if (!x) return;
      x.price = Math.round(Number(price) * 100) / 100;
      C.rememberPrice(s.shopstats, x, x.price, today(), store);
    });
  }

  const shortDate = (d) => (d ? U.fmtDate(d).replace(/^[^,]+,\s*/, '') : '');
  /** Histórico de preços de um produto, para mostrar nos formulários. */
  function historyHtml(name) {
    const h = C.priceHistory(S().shopstats, name).slice(0, 5);
    if (!h.length) return '';
    return `<b>🕘 Preços anteriores</b><ul class="price-hist">${h.map((x) => `<li><b>${money(x.price)}</b>
      <span class="muted">· ${esc(shortDate(x.date))}${x.store ? ` · ${esc(x.store)}` : ''}</span></li>`).join('')}</ul>`;
  }

  function priceForm(el) {
    const x = S().shopping.find((i) => i.id === el.dataset.id);
    if (!x) return;
    const known = C.priceOf(x, S().shopstats);
    const per = /kg\b/i.test(x.qty || '') ? 'kg' : 'unidade';
    UI.openForm({
      title: `💶 ${x.text}`,
      fields: [
        { name: 'price', label: `Preço por ${per} (€)${x.qty ? ` · quantidade: ${x.qty}` : ''}`, type: 'number', min: 0, step: '0.01', required: true, half: true, placeholder: 'Ex.: 1,29' },
        { name: 'store', label: 'Loja (opcional)', half: true, placeholder: 'Ex.: Lidl' },
        { name: 'hist', type: 'note', html: historyHtml(x.text) },
      ],
      values: { price: known || '', store: trip()?.store || '' },
      submitLabel: 'Guardar preço',
      onSubmit: (d) => { if (d.price > 0) setItemPrice(x.id, d.price, d.store); },
    });
    setTimeout(() => document.querySelector('#f-price')?.focus(), 50);
  }

  /* ---------- Talão e orçamento ---------- */
  const lastStore = () => trip()?.store || [...C.receipts(S().groceries)].sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0]?.store || '';

  /** Limpa o que já foi comprado, tira o aviso "Vou às compras" e sai do modo supermercado. */
  function finishShopping(msg) {
    Store.update((s) => {
      s.shopping = s.shopping.filter((i) => !i.done);
      if (trip()?.by === s.currentUser) s.shoptrip = [];
    });
    UI.toast(msg);
    exit();
  }

  /** Guarda o talão. As filhas (com conta) registam pela função do servidor: não vêem os gastos. */
  async function saveReceipt({ amount, store, items, estimate }) {
    const ctx = window.Cloud?.ctx?.();
    if (Store.isRemote && !Store.isParent() && ctx) {
      const { error } = await ctx.client.rpc('add_receipt', { p_amount: amount, p_store: store, p_items: items, p_estimate: estimate });
      if (error) throw error;
      return null;
    }
    Store.update((s) => {
      s.groceries.push({
        id: Store.uid(), kind: 'receipt', date: today(), amount: Math.round(amount * 100) / 100, store, items, estimate, by: s.currentUser,
      });
    });
    return C.budgetStatus(S().groceries, today());
  }

  function receiptForm() {
    const s = S();
    const done = s.shopping.filter((i) => i.done);
    const est = C.estimate(done, s.shopstats);
    UI.openForm({
      title: '💶 Quanto pagaste?',
      fields: [
        { name: 'amount', label: 'Total do talão (€)', type: 'number', min: 0.01, step: '0.01', required: true, half: true },
        { name: 'store', label: 'Loja', half: true, placeholder: 'Ex.: Continente, Lidl' },
      ],
      values: { amount: est.cart || '', store: lastStore() },
      submitLabel: '✔ Registar e limpar a lista',
      onSubmit: async (d) => {
        if (!(d.amount > 0)) return;
        try {
          const b = await saveReceipt({ amount: d.amount, store: d.store, items: done.length, estimate: est.cart });
          finishShopping(b && b.budget
            ? `💶 Talão de ${money(d.amount)} registado · este mês ${money(b.spent)} de ${money(b.budget)}`
            : `💶 Talão de ${money(d.amount)} registado. Obrigado!`);
        } catch (e) {
          console.warn('talão', e);
          UI.toast('Não consegui registar o talão agora. Tenta outra vez daqui a pouco.');
        }
      },
    });
    setTimeout(() => document.querySelector('#f-amount')?.select(), 50);
  }

  /** Linha do orçamento na lista de compras (só pais). */
  function budgetLine() {
    if (!Store.isParent()) return '';
    const b = C.budgetStatus(S().groceries, today());
    if (!b.budget) return '';
    return `<a class="shop-budget ${b.level}" href="#/financas" data-action="goto-groceries">🛒 Supermercado este mês: <b>${money(b.spent)}</b> de ${money(b.budget)}
      <span class="muted">· ${b.left >= 0 ? `faltam ${money(b.left)}` : `passou ${money(-b.left)}`}</span></a>`;
  }

  /* ---------- Lojas ---------- */
  const stores = () => C.storesOf(S().shopstores);
  const curStore = () => (stores().includes(VS.shopStore) ? VS.shopStore : 'all');
  const filterPending = (items) => C.forStore(items, S().shopstats, stores(), curStore());

  /** Botões "Todas · Lidl (3) · Farmácia (1) …" e ✎ para editar as lojas. */
  function storeBar(pending) {
    const list = stores();
    const { byStore, any } = C.storeCounts(pending, S().shopstats, list);
    const cur = curStore();
    const used = list.filter((st) => byStore[st] || st === cur);
    if (!pending.length && cur === 'all') return '';
    return `<div class="filters store-bar" role="group" aria-label="Filtrar por loja">
      <button class="filter ${cur === 'all' ? 'active' : ''}" data-action="shop-store" data-id="all">🏪 Todas</button>
      ${used.map((st) => `<button class="filter ${cur === st ? 'active' : ''}" data-action="shop-store" data-id="${esc(st)}">${esc(st)} <b>${byStore[st] || 0}</b></button>`).join('')}
      ${!used.length ? '<span class="small muted">Escolham a loja de cada produto no ✎ para poderem filtrar.</span>' : ''}
      <button class="linkish small" data-action="edit-stores">✎ lojas</button>
    </div>
    ${cur !== 'all' ? `<p class="small muted store-note">🏪 <b>${esc(cur)}</b>${any ? ` · mais ${any} produto${any === 1 ? '' : 's'} que se compra${any === 1 ? '' : 'm'} em qualquer loja` : ''}</p>` : ''}`;
  }

  /** Etiqueta com a loja, na lista (só quando se vê "Todas"). */
  function storeBadge(x) {
    if (curStore() !== 'all') return '';
    const st = C.storeOf(x, S().shopstats, stores());
    return st ? ` <small class="store-badge">${esc(st)}</small>` : '';
  }

  /** Põe a loja no item e memoriza-a para o produto ('' = qualquer loja). */
  function setItemStore(id, store) {
    Store.update((s) => {
      const x = s.shopping.find((i) => i.id === id);
      if (!x) return;
      x.store = store || '';
      C.rememberStore(s.shopstats, x, x.store);
    });
  }

  function storesForm() {
    UI.openForm({
      title: '🏪 As nossas lojas',
      fields: [{ name: 'names', label: 'Uma loja por linha', type: 'textarea', rows: 8, required: true }],
      values: { names: stores().join('\n') },
      onSubmit: (d) => {
        const names = [...new Set(d.names.split('\n').map((x) => x.trim().slice(0, 30)).filter(Boolean))].slice(0, 20);
        Store.update((s) => {
          const doc = s.shopstores.find((x) => x.id === 'list');
          if (doc) doc.names = names;
          else s.shopstores.push({ id: 'list', names });
        });
        UI.toast(`🏪 ${names.length} loja${names.length === 1 ? '' : 's'}`);
      },
    });
  }

  /* ---------- Ligações ---------- */
  const route = Views.routes.find((r) => r[0] === 'compras');
  const listView = route[3];
  route[3] = () => (VS.shopMode ? market() : listView());
  Views.shopHooks = {
    headButtons: () => {
      const has = S().shopping.some((x) => !x.done);
      return `${has ? '<button class="btn small primary" data-action="shop-mode">🛒 Modo supermercado</button>' : ''}
        <button class="btn small" data-action="shoptrip-new">📣 Vou às compras</button>
        ${has ? '<button class="btn small" data-action="share-list">📤 Partilhar</button>' : ''}`;
    },
    banner: () => `${budgetLine()}${banner()}`,
    panels: staplesPanel,
    setItemPrice,
    historyHtml,
    storeBar,
    storeBadge,
    filterPending,
    setItemStore,
    stores,
  };

  function exit() {
    VS.shopMode = false;
    keepAwake(false);
    render();
    window.scrollTo(0, 0);
  }

  const actions = {
    'shop-mode': () => {
      // Se avisaram "Vou às compras (Lidl)", abre já filtrado nessa loja.
      const where = trip()?.store;
      const match = where && stores().find((st) => C.strip(st) === C.strip(where));
      if (match) VS.shopStore = match;
      VS.shopMode = true;
      render();
      window.scrollTo(0, 0);
      keepAwake(true);
    },
    'shop-mode-exit': exit,
    'shop-mode-finish': () => finishShopping('✔ Compras arrumadas. Até à próxima! 🛒'),
    'shop-price': priceForm,
    'receipt-new': receiptForm,
    'goto-groceries': () => { VS.finTab = 'contas'; location.hash = '#/financas'; },
    'shop-store': (el) => { VS.shopStore = el.dataset.id; render(); },
    'edit-stores': storesForm,
    'shoptrip-new': announceForm,
    'shoptrip-done': () => { Store.update((s) => { s.shoptrip = []; }); UI.toast('✔ Compras feitas — aviso retirado.'); },
    'share-list': shareDialog,
    'share-native': () => {
      navigator.share({ title: 'Lista de compras', text: listText() }).catch(() => {});
    },
    'share-copy': () => copyText(listText()),
    'staples-toggle': () => { VS.staplesOpen = !VS.staplesOpen; render(); },
    'staples-fill': fillStaples,
    'staple-edit': stapleForm,
    'staple-suggest': (el) => {
      const st = S().shopstats.find((x) => x.name === el.dataset.name);
      Store.update((s) => addStaple(s, el.dataset.name, '', st?.category));
      UI.toast(`⭐ ${el.dataset.name} nos do costume`);
    },
    'staples-from-list': () => {
      let n = 0;
      Store.update((s) => s.shopping.filter((i) => !i.done).forEach((i) => { if (addStaple(s, i.text, i.qty, i.category)) n++; }));
      UI.toast(`⭐ ${n} produto${n === 1 ? '' : 's'} guardados como os do costume`);
    },
  };

  const inlineForms = {
    'add-staple': (f, d) => {
      let added = false;
      Store.update((s) => { added = addStaple(s, d.text, d.qty); });
      UI.toast(added ? `⭐ ${d.text} nos do costume` : `${d.text} já é dos do costume 👍`);
    },
  };

  // Um toque curto de vibração ao riscar (Android).
  document.addEventListener('click', (e) => { if (e.target.closest('.market-item')) navigator.vibrate?.(12); });

  function afterRender() {
    if (VS.shopMode && !location.hash.startsWith('#/compras')) VS.shopMode = false;
    const on = inMarket();
    document.body.classList.toggle('shop-mode', on);
    if (!on && lock) keepAwake(false);
  }

  return { actions, inlineForms, afterRender };
};
