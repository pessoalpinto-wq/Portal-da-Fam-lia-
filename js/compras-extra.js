/*
 * Compras — extras: modo "No supermercado" (ecrã só para usar na loja: letras grandes,
 * por secção, um toque risca, o ecrã não se apaga).
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

  /* ---------- Ligações ---------- */
  const route = Views.routes.find((r) => r[0] === 'compras');
  const listView = route[3];
  route[3] = () => (VS.shopMode ? market() : listView());
  Views.shopHooks = {
    headButtons: () => (S().shopping.some((x) => !x.done)
      ? '<button class="btn small primary" data-action="shop-mode">🛒 Modo supermercado</button>' : ''),
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
  };

  // Um toque curto de vibração ao riscar (Android).
  document.addEventListener('click', (e) => { if (e.target.closest('.market-item')) navigator.vibrate?.(12); });

  function afterRender() {
    if (VS.shopMode && !location.hash.startsWith('#/compras')) VS.shopMode = false;
    const on = inMarket();
    document.body.classList.toggle('shop-mode', on);
    if (!on && lock) keepAwake(false);
  }

  return { actions, afterRender };
};
