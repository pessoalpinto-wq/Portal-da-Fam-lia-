/*
 * Compras — extras:
 *  - modo "No supermercado" (ecrã só para usar na loja: letras grandes, por secção,
 *    um toque risca, o ecrã não se apaga);
 *  - "os do costume": lista base da família, repor o que falta num toque, sugestões
 *    a partir do que mais se compra.
 */
window.ComprasExtra = function ({ render }) {
  const { esc } = U;
  const { VS, SHOP_CATS } = Views;
  const S = () => Store.state;

  const CAT_EMOJI = {
    Frescos: '🥦', 'Talho/Peixaria': '🥩', Padaria: '🥖', Mercearia: '🍝', Congelados: '🧊', Bebidas: '🧃',
    Limpeza: '🧽', Higiene: '🧴', Farmácia: '💊', Casa: '🏠', Escola: '✏️', Animais: '🐾', Outro: '🛍️',
  };

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
    const pending = s.shopping.filter((x) => !x.done);
    const done = s.shopping.filter((x) => x.done);
    const total = pending.length + done.length;
    const pct = total ? Math.round((done.length / total) * 100) : 0;
    const cats = [...new Set([...SHOP_CATS, ...pending.map((x) => x.category || 'Outro')])];
    const row = (x) => `<li><button class="market-item ${x.done ? 'done' : ''}" data-action="toggle-shop" data-id="${x.id}"
        aria-pressed="${!!x.done}" aria-label="${esc(x.text)}${x.qty ? `, ${esc(x.qty)}` : ''}${x.done ? ', já no carrinho' : ''}">
        <span class="market-check" aria-hidden="true">${x.done ? '✔' : ''}</span>
        <span class="market-text">${x.qty ? `<b class="market-qty">${esc(x.qty)}</b> ` : ''}${esc(x.text)}</span>
      </button></li>`;
    const finished = total && !pending.length;
    return `<div class="market">
      <header class="market-head">
        <div class="market-title"><b>🛒 No supermercado</b>
          <small>${done.length} de ${total} no carrinho${canKeepAwake ? ' · 💡 ecrã sempre ligado' : ''}</small></div>
        <button class="btn small" data-action="shop-mode-exit">Sair</button>
      </header>
      <div class="progress market-progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct}%"></span></div>
      ${finished ? `<section class="market-done-card">
          <p class="market-big">🎉</p><h2>Compras feitas!</h2><p class="muted">Está tudo no carrinho.</p>
          <div class="btn-row"><button class="btn primary" data-action="shop-mode-finish">✔ Limpar a lista e sair</button>
          <button class="btn" data-action="shop-mode-exit">Sair sem limpar</button></div></section>` : ''}
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

  /* ---------- Ligações ---------- */
  const route = Views.routes.find((r) => r[0] === 'compras');
  const listView = route[3];
  route[3] = () => (VS.shopMode ? market() : listView());
  Views.shopHooks = {
    headButtons: () => (S().shopping.some((x) => !x.done)
      ? '<button class="btn small primary" data-action="shop-mode">🛒 Modo supermercado</button>' : ''),
    panels: staplesPanel,
  };

  function exit() {
    VS.shopMode = false;
    keepAwake(false);
    render();
    window.scrollTo(0, 0);
  }

  const actions = {
    'shop-mode': () => { VS.shopMode = true; render(); window.scrollTo(0, 0); keepAwake(true); },
    'shop-mode-exit': exit,
    'shop-mode-finish': () => {
      Store.update((s) => { s.shopping = s.shopping.filter((i) => !i.done); });
      UI.toast('✔ Compras arrumadas. Até à próxima! 🛒');
      exit();
    },
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
