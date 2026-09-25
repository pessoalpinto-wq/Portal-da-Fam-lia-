/*
 * Refeições: plano da semana com receitas, livro de receitas (do portal, da família e importadas
 * de sites), despensa ("o que há em casa") e ingredientes em falta → lista de compras.
 */
window.Refeicoes = function ({ render }) {
  const { $, esc, DIAS, DIAS_CURTOS, today, parseISO } = U;
  const { openForm, toast } = UI;
  const { VS } = Views;
  const { card, empty } = Views.h;
  const I = Ingredients;
  const S = () => Store.state;

  const ORDER = [1, 2, 3, 4, 5, 6, 0];
  const MEALS = [['lunch', 'Almoço'], ['dinner', 'Jantar']];
  const BASICS = ['Sal', 'Pimenta', 'Azeite', 'Óleo', 'Vinagre', 'Alho', 'Cebola', 'Louro', 'Açúcar', 'Farinha',
    'Arroz', 'Massa', 'Leite', 'Ovos', 'Manteiga', 'Água'];
  const CATEGORIES = [...RECEITAS_CATEGORIAS, 'Outra'];

  /* ---------- Receitas e despensa ---------- */
  const familyRecipes = () => S().recipes || [];
  const builtins = () => RECEITAS_PT.filter((b) => !familyRecipes().some((r) => r.fromBuiltin === b.id));
  const allRecipes = () => [...familyRecipes(), ...builtins()];
  const recipeById = (id) => id && (familyRecipes().find((r) => r.id === id) || RECEITAS_PT.find((r) => r.id === id));
  const have = (key) => (S().pantry || []).some((p) => I.matches(key, p.key));
  const ingList = (r) => (r.ingredients || []).map((line) => ({ line, ...I.parse(line) })).filter((i) => i.key);
  const missingOf = (r) => ingList(r).filter((i) => !have(i.key));
  const searchText = (r) => I.strip(`${r.title} ${r.category || ''} ${(r.ingredients || []).join(' ')}`);
  // Ingredientes: só tira marcas de lista ("- ", "• "); passos: tira também a numeração ("1. ", "2) ").
  const ingredientLines = (text) => String(text || '').split('\n').map((x) => x.replace(/^\s*[-•*]\s+/, '').trim()).filter(Boolean);
  const stepLines = (text) => String(text || '').split('\n').map((x) => x.replace(/^\s*(?:\d+\s*[.)º-]|[-•*])\s*/, '').trim()).filter(Boolean);

  function addPantry(s, name) {
    const k = I.parse(name).key || I.key(name);
    if (!k || s.pantry.some((p) => p.key === k)) return false;
    s.pantry.push({ id: Store.uid(), name: I.capitalize(String(name).trim()), key: k });
    return true;
  }

  /** Junta ingredientes à lista de compras (sem repetir o que já lá está). */
  function toShopping(list) {
    let n = 0;
    Store.update((s) => {
      const pending = s.shopping.filter((i) => !i.done).map((i) => I.parse(i.text).key);
      list.forEach((e) => {
        if (pending.some((k) => k === e.key || I.matches(k, e.key) || I.matches(e.key, k))) return;
        s.shopping.push({
          id: Store.uid(), text: I.capitalize(e.name), qty: e.qty === 'q.b.' ? '' : e.qty,
          category: I.guessCategory(e.key), done: false, addedBy: s.currentUser,
        });
        pending.push(e.key);
        n++;
      });
    });
    toast(n ? `🛒 ${n} ingrediente${n === 1 ? '' : 's'} na lista de compras` : 'Já estava tudo na lista de compras.');
    return n;
  }

  /** Ingredientes de todas as receitas planeadas na semana, agrupados. */
  function weekNeeds() {
    const map = new Map();
    ORDER.forEach((d) => MEALS.forEach(([k]) => {
      const r = recipeById(S().meals[d]?.[`${k}Recipe`]);
      if (!r) return;
      ingList(r).forEach((i) => {
        const e = map.get(i.key) || { key: i.key, name: i.name, qtys: [], days: [] };
        if (i.qty && i.qty !== 'q.b.') e.qtys.push(i.qty);
        if (!e.days.includes(DIAS_CURTOS[d])) e.days.push(DIAS_CURTOS[d]);
        map.set(i.key, e);
      });
    }));
    return [...map.values()]
      .map((e) => ({ ...e, qty: I.sumQty(e.qtys), have: have(e.key) }))
      .sort((a, b) => (a.have - b.have) || a.name.localeCompare(b.name, 'pt'));
  }

  function guessCategory(text) {
    const t = I.strip(text);
    if (/sobremesa|doce|bolo|tarte|pudim|mousse|bolacha|biscoit/.test(t)) return 'Sobremesas';
    if (/sopa|caldo|canja|creme de/.test(t)) return 'Sopa';
    if (/bacalhau|peixe|pescada|salmao|atum|polvo|marisco|camarao|lula|dourada|sardinha|lingueirao/.test(t)) return 'Peixe';
    if (/vegetarian|vegan|legumes|grao|lentilha|tofu/.test(t)) return 'Vegetariano';
    if (/massa|esparguete|lasanha|arroz|risotto|pizza/.test(t)) return 'Massas & arroz';
    if (/carne|frango|porco|vaca|peru|pato|bife|hamburguer|borrego|entrecosto/.test(t)) return 'Carne';
    return 'Outra';
  }

  /* ---------- Vistas ---------- */
  function mealCell(d, k) {
    const m = S().meals[d] || {};
    const r = recipeById(m[`${k}Recipe`]);
    return `<div class="meal-cell ${r ? 'has-recipe' : ''}">
      <input data-meal="${d}:${k}" value="${esc(m[k] || '')}" aria-label="${DIAS[d]} ${k === 'lunch' ? 'almoço' : 'jantar'}" placeholder="${k === 'lunch' ? 'Almoço' : 'Jantar'}">
      ${r ? `<button class="icon-btn small" data-action="open-recipe" data-id="${esc(r.id)}" title="Ver receita" aria-label="Ver receita">🍳</button>` : ''}
      <button class="icon-btn small" data-action="pick-recipe" data-slot="${d}:${k}" title="Escolher receita" aria-label="Escolher receita">📖</button>
    </div>`;
  }

  function semana() {
    const wd = parseISO(today()).getDay();
    const needs = weekNeeds();
    const missing = needs.filter((e) => !e.have);
    const needsBody = needs.length ? `
      <p>${missing.length ? `Faltam <b>${missing.length}</b> de ${needs.length} ingredientes.` : '✔ Têm tudo em casa para esta semana!'}
        <small class="muted">Marquem o que já têm.</small></p>
      ${missing.length ? `<div class="btn-row"><button class="btn primary" data-action="week-to-shop">🛒 Juntar os ${missing.length} em falta às compras</button></div>` : ''}
      <ul class="ing-list">${needs.map((e) => `<li class="${e.have ? 'have' : 'miss'}"><label>
        <input type="checkbox" data-action="pantry-toggle" data-key="${esc(e.key)}" data-name="${esc(e.name)}" ${e.have ? 'checked' : ''}>
        <span>${esc(I.capitalize(e.name))}${e.qty ? ` <small class="muted">${esc(e.qty)}</small>` : ''}</span>
        <small class="muted days">${esc(e.days.join(', '))}</small></label></li>`).join('')}</ul>`
      : empty('Escolham receitas com 📖 para verem aqui os ingredientes da semana.');
    return `<section class="card"><div class="meals meals-plan">
        <span class="col-head"></span><b class="col-head">Almoço</b><b class="col-head">Jantar</b><b class="col-head">Quem cozinha?</b>
        ${ORDER.map((d) => `<b class="day ${d === wd ? 'is-today' : ''}">${DIAS[d]}</b>
          ${mealCell(d, 'lunch')}${mealCell(d, 'dinner')}
          <input data-meal="${d}:cook" value="${esc(S().meals[d]?.cook || '')}" aria-label="${DIAS[d]} quem cozinha" placeholder="Quem cozinha?">`).join('')}
      </div></section>
      ${card('🧺 Ingredientes da semana', needsBody, { cls: 'week-needs' })}`;
  }

  function recipeCard(r) {
    const miss = missingOf(r).length;
    return `<button class="recipe-card" data-action="open-recipe" data-id="${esc(r.id)}" data-search="${esc(searchText(r))}">
      <span class="r-emoji" aria-hidden="true">${esc(r.emoji || '🍽️')}</span>
      <span class="r-title">${esc(r.title)}</span>
      <span class="r-meta">${esc(r.category || '')}${r.minutes ? ` · ⏱ ${r.minutes} min` : ''}</span>
      <span class="r-need ${miss ? '' : 'ok'}">${miss ? `faltam ${miss}` : '✔ tens tudo'}</span>
    </button>`;
  }

  function receitas() {
    const cat = VS.recipeCat || '';
    const byCat = (r) => !cat || r.category === cat;
    const fam = familyRecipes().filter(byCat);
    const sug = builtins().filter(byCat);
    return `<div class="recipes-tools">
        <input type="search" id="recipe-search" placeholder="🔎 Procurar receita ou ingrediente…" aria-label="Procurar receitas">
        <div class="filters">${['', ...CATEGORIES].map((c) => `<button class="filter ${cat === c ? 'active' : ''}" data-action="recipe-cat" data-id="${esc(c)}">${esc(c || 'Todas')}</button>`).join('')}</div>
      </div>
      ${card('⭐ Receitas da família', fam.length ? `<div class="recipe-grid">${fam.map(recipeCard).join('')}</div>`
        : empty('Guardem aqui as vossas: criem uma, importem de um site ou guardem uma das sugestões.'))}
      ${card('📖 Sugestões do portal', sug.length ? `<div class="recipe-grid">${sug.map(recipeCard).join('')}</div>` : empty('Sem sugestões nesta categoria.'))}`;
  }

  function despensa() {
    const items = [...(S().pantry || [])].sort((a, b) => a.name.localeCompare(b.name, 'pt'));
    return card('🧺 O que há em casa', `
      <form class="inline-add big-add" data-form="add-pantry">
        <input name="text" placeholder="Ex.: arroz, massa, atum (separados por vírgulas)" required aria-label="Adicionar à despensa">
        <button class="btn primary">Adicionar</button>
      </form>
      <div class="btn-row"><button class="btn small ghost" data-action="pantry-basics">＋ Básicos (sal, azeite, alho…)</button></div>
      ${items.length ? `<div class="pantry">${items.map((p) => `<span class="pantry-chip">${esc(p.name)}
        <button class="icon-btn small" data-action="pantry-to-shop" data-id="${p.id}" title="Acabou — pôr na lista de compras" aria-label="Acabou: ${esc(p.name)}">🛒</button>
        <button class="icon-btn small" data-action="pantry-remove" data-id="${p.id}" title="Tirar" aria-label="Tirar ${esc(p.name)}">✕</button></span>`).join('')}</div>`
        : empty('A despensa está vazia.')}
      <p class="small muted">Quando marcam algo como comprado na lista de compras, entra aqui sozinho.
        Carreguem em 🛒 quando acabar para ir para a lista.</p>`);
  }

  function view() {
    const tab = VS.mealsTab || 'semana';
    const tabs = [['semana', '📅 Semana'], ['receitas', '📖 Receitas'], ['despensa', '🧺 Despensa']];
    const quick = tab === 'semana'
      ? `<button class="btn small" data-action="suggest-week">✨ Sugerir ementa</button><button class="btn small ghost" data-action="clear-meals">Limpar semana</button>`
      : tab === 'receitas'
        ? `<button class="btn small" data-action="recipe-new">＋ Nova receita</button><button class="btn small primary" data-action="recipe-import">🔗 Importar de um site</button>`
        : '';
    const body = tab === 'receitas' ? receitas() : tab === 'despensa' ? despensa() : semana();
    return `<div class="page-head"><h1>Refeições</h1><div class="quick">${quick}</div></div>
      <div class="tabs" role="tablist">${tabs.map(([id, label]) => `<button role="tab" aria-selected="${tab === id}"
        class="tab ${tab === id ? 'active' : ''}" data-action="meals-tab" data-id="${id}" style="--c:#16a34a">${label}</button>`).join('')}</div>
      ${body}`;
  }

  /* ---------- Diálogos ---------- */
  function renderRecipe(dlg, id) {
    const r = recipeById(id);
    if (!r) return;
    const items = (r.ingredients || []).map((line) => ({ line, ...I.parse(line) })).map((i) => ({ ...i, have: i.key && have(i.key) }));
    const missing = items.filter((i) => i.key && !i.have);
    const wd = parseISO(today()).getDay();
    let host = '';
    try { host = r.source ? new URL(r.source).hostname.replace(/^www\./, '') : ''; } catch (e) { host = ''; }
    dlg.innerHTML = `<div class="recipe-dlg" data-recipe="${esc(id)}">
      <header class="form-head"><h2>${esc(r.emoji || '🍽️')} ${esc(r.title)}</h2>
        <button type="button" class="icon-btn" data-action="dlg-close" aria-label="Fechar">✕</button></header>
      <div class="recipe-body">
        ${r.image ? `<img class="recipe-img" src="${esc(r.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}
        <p class="small muted">${esc(r.category || '')}${r.minutes ? ` · ⏱ ${r.minutes} min` : ''}${r.servings ? ` · 👥 ${r.servings} pessoas` : ''}
          ${host ? ` · <a href="${esc(r.source)}" target="_blank" rel="noopener">${esc(host)}</a>` : ''}</p>
        <h3 class="sub">Ingredientes <small class="muted">— marca o que tens em casa</small></h3>
        <ul class="ing-list">${items.map((i) => `<li class="${i.have || !i.key ? 'have' : 'miss'}"><label>
          ${i.key ? `<input type="checkbox" data-action="pantry-toggle" data-key="${esc(i.key)}" data-name="${esc(i.name)}" ${i.have ? 'checked' : ''}>` : ''}
          <span>${esc(i.line)}</span></label></li>`).join('')}</ul>
        <div class="btn-row">${missing.length
          ? `<button class="btn primary" data-action="recipe-to-shop" data-id="${esc(id)}">🛒 Juntar os ${missing.length} em falta às compras</button>`
          : '<span class="ok-note">✔ Tens tudo em casa!</span>'}</div>
        <div class="plan-row">
          <select id="plan-day" aria-label="Dia">${ORDER.map((d) => `<option value="${d}" ${d === wd ? 'selected' : ''}>${DIAS[d]}</option>`).join('')}</select>
          <select id="plan-meal" aria-label="Refeição"><option value="dinner">Jantar</option><option value="lunch">Almoço</option></select>
          <button class="btn small" data-action="plan-recipe" data-id="${esc(id)}">📅 Planear</button>
        </div>
        ${(r.steps || []).length ? `<h3 class="sub">Preparação</h3><ol class="recipe-steps">${r.steps.map((st) => `<li>${esc(st)}</li>`).join('')}</ol>` : ''}
      </div>
      <footer class="form-actions">${r.builtin
        ? `<button class="btn small ghost" data-action="recipe-copy" data-id="${esc(id)}">⭐ Guardar nas receitas da família</button>`
        : `<button class="btn small ghost" data-action="recipe-edit" data-id="${esc(id)}">✎ Editar</button>
           <button class="btn small danger" data-action="recipe-del" data-id="${esc(id)}">Apagar</button>`}</footer>
    </div>`;
  }

  function openRecipe(id) {
    const dlg = $('#dialog');
    renderRecipe(dlg, id);
    if (!dlg.open) dlg.showModal();
  }

  function refreshRecipeDialog() {
    const box = $('#dialog .recipe-dlg');
    if (box && $('#dialog').open) renderRecipe($('#dialog'), box.dataset.recipe);
  }

  function openPicker(slot) {
    const [d, k] = slot.split(':');
    const cur = S().meals[d]?.[`${k}Recipe`];
    const dlg = $('#dialog');
    dlg.innerHTML = `<div class="picker">
      <header class="form-head"><h2>${DIAS[d]} · ${k === 'lunch' ? 'Almoço' : 'Jantar'}</h2>
        <button type="button" class="icon-btn" data-action="dlg-close" aria-label="Fechar">✕</button></header>
      <div class="picker-body">
        <input type="search" id="picker-search" placeholder="🔎 Procurar receita ou ingrediente…" autocomplete="off" aria-label="Procurar">
        <ul class="picker-list">${allRecipes().map((r) => `<li><button class="${r.id === cur ? 'current' : ''}" data-action="pick-recipe-choose"
          data-id="${esc(r.id)}" data-slot="${slot}" data-search="${esc(searchText(r))}">
          <span>${esc(r.emoji || '🍽️')} ${esc(r.title)}</span><small class="muted">${esc(r.category || '')}${r.minutes ? ` · ${r.minutes} min` : ''}
          · ${missingOf(r).length ? `faltam ${missingOf(r).length}` : '✔ tens tudo'}</small></button></li>`).join('')}</ul>
        ${cur ? `<button class="btn small ghost" data-action="pick-recipe-clear" data-slot="${slot}">Tirar a receita deste dia</button>` : ''}
      </div></div>`;
    dlg.showModal();
    $('#picker-search')?.focus();
  }

  const RECIPE_FIELDS = () => [
    { name: 'title', label: 'Nome da receita', required: true },
    { name: 'category', label: 'Categoria', type: 'select', half: true, options: CATEGORIES.map((c) => [c, c]) },
    { name: 'emoji', label: 'Emoji', half: true, default: '🍽️' },
    { name: 'minutes', label: 'Tempo (minutos)', type: 'number', min: 0, half: true },
    { name: 'servings', label: 'Pessoas', type: 'number', min: 1, half: true, default: 4 },
    { name: 'ingredientsText', label: 'Ingredientes (um por linha, ex.: 400 g de bacalhau)', type: 'textarea', rows: 8, required: true },
    { name: 'stepsText', label: 'Preparação (um passo por linha)', type: 'textarea', rows: 6 },
    { name: 'source', label: 'Link (opcional)', type: 'url' },
  ];

  function recipeForm(existing, preset = {}) {
    const base = existing || preset;
    openForm({
      title: existing ? `Editar: ${existing.title}` : preset.source ? 'Receita importada — confirma' : 'Nova receita',
      fields: RECIPE_FIELDS(),
      values: { ...base, ingredientsText: (base.ingredients || []).join('\n'), stepsText: (base.steps || []).join('\n') },
      onSubmit: (d) => {
        const data = {
          title: d.title, category: d.category, emoji: d.emoji || '🍽️', minutes: Number(d.minutes) || 0,
          servings: Number(d.servings) || 4, ingredients: ingredientLines(d.ingredientsText), steps: stepLines(d.stepsText),
          source: d.source, image: base.image || '',
        };
        let id = existing?.id;
        Store.update((s) => {
          const cur = existing && s.recipes.find((r) => r.id === existing.id);
          if (cur) Object.assign(cur, data);
          else { id = Store.uid(); s.recipes.push({ id, ...data, ...(preset.fromBuiltin ? { fromBuiltin: preset.fromBuiltin } : {}) }); }
        });
        toast(existing ? 'Receita guardada ✔' : '⭐ Receita guardada nas receitas da família');
        setTimeout(() => openRecipe(id), 0);
      },
    });
  }

  async function importFromUrl(url) {
    const ctx = Cloud.ctx();
    toast('A ler a receita… ⏳');
    const { data, error } = await ctx.client.functions.invoke('recipe-import', { body: { url } });
    if (error) {
      let msg = error.message;
      try { msg = (await error.context.json()).error || msg; } catch (e) { /* sem JSON */ }
      toast(msg);
      return;
    }
    const r = data.recipe;
    recipeForm(null, {
      title: r.title, category: guessCategory(`${r.category} ${r.title}`), emoji: '🍽️', minutes: r.minutes || '',
      servings: r.servings || 4, ingredients: r.ingredients, steps: r.steps, source: r.source, image: r.image,
    });
  }

  function suggestWeek() {
    const pool = [...familyRecipes(), ...builtins()].filter((r) => !['Sobremesas', 'Sopa'].includes(r.category));
    // Baralha e evita duas refeições seguidas da mesma categoria.
    const bag = pool.map((r) => [Math.random(), r]).sort((a, b) => a[0] - b[0]).map(([, r]) => r);
    let last = '';
    let n = 0;
    Store.update((s) => {
      ORDER.forEach((d) => MEALS.forEach(([k]) => {
        if (s.meals[d]?.[k]) return;
        const i = Math.max(0, bag.findIndex((r) => r.category !== last));
        const [r] = bag.splice(i, 1);
        if (!r) return;
        s.meals[d] = { ...(s.meals[d] || {}), [k]: r.title, [`${k}Recipe`]: r.id };
        last = r.category;
        n++;
      }));
    });
    toast(n ? `✨ ${n} refeições sugeridas — troquem com 📖 o que não gostarem` : 'A semana já está toda planeada.');
  }

  /* ---------- Acções ---------- */
  const actions = {
    'meals-tab': (el) => { VS.mealsTab = el.dataset.id; render(); },
    'recipe-cat': (el) => { VS.recipeCat = el.dataset.id; render(); },
    'open-recipe': (el) => openRecipe(el.dataset.id),
    'pick-recipe': (el) => openPicker(el.dataset.slot),
    'pick-recipe-choose': (el) => {
      const [d, k] = el.dataset.slot.split(':');
      const r = recipeById(el.dataset.id);
      if (!r) return;
      Store.update((s) => { s.meals[d] = { ...(s.meals[d] || {}), [k]: r.title, [`${k}Recipe`]: r.id }; });
      $('#dialog').close();
      const miss = missingOf(r).length;
      toast(`${r.emoji || '🍽️'} ${r.title} — ${DIAS[d]}${miss ? ` · faltam ${miss} ingredientes` : ' · tens tudo em casa'}`);
    },
    'pick-recipe-clear': (el) => {
      const [d, k] = el.dataset.slot.split(':');
      Store.update((s) => {
        const m = { ...(s.meals[d] || {}) };
        delete m[`${k}Recipe`];
        m[k] = '';
        s.meals[d] = m;
      });
      $('#dialog').close();
    },
    'plan-recipe': (el) => {
      const r = recipeById(el.dataset.id);
      const d = $('#plan-day').value;
      const k = $('#plan-meal').value;
      Store.update((s) => { s.meals[d] = { ...(s.meals[d] || {}), [k]: r.title, [`${k}Recipe`]: r.id }; });
      $('#dialog').close();
      toast(`📅 ${r.title} — ${DIAS[d]} ao ${k === 'lunch' ? 'almoço' : 'jantar'}`);
    },
    'suggest-week': suggestWeek,
    'week-to-shop': () => toShopping(weekNeeds().filter((e) => !e.have)),
    'recipe-to-shop': (el) => {
      const r = recipeById(el.dataset.id);
      if (r) toShopping(missingOf(r));
      refreshRecipeDialog();
    },
    'pantry-toggle': (el) => {
      const { key, name } = el.dataset;
      Store.update((s) => {
        if (el.checked) addPantry(s, name);
        else s.pantry = s.pantry.filter((p) => !I.matches(key, p.key));
      });
      refreshRecipeDialog();
    },
    'pantry-basics': () => {
      let n = 0;
      Store.update((s) => BASICS.forEach((b) => { if (addPantry(s, b)) n++; }));
      toast(n ? `${n} básicos adicionados à despensa` : 'Os básicos já lá estavam.');
    },
    'pantry-remove': (el) => Store.update((s) => { s.pantry = s.pantry.filter((p) => p.id !== el.dataset.id); }),
    'pantry-to-shop': (el) => {
      const p = S().pantry.find((x) => x.id === el.dataset.id);
      if (!p) return;
      Store.update((s) => { s.pantry = s.pantry.filter((x) => x.id !== p.id); });
      toShopping([{ name: p.name, key: p.key, qty: '' }]);
    },
    // Comprado → entra na despensa.
    'toggle-shop': (el) => Store.update((s) => {
      const x = s.shopping.find((i) => i.id === el.dataset.id);
      if (!x) return;
      x.done = !x.done;
      if (x.done) addPantry(s, x.text);
    }),
    'recipe-new': () => recipeForm(null, { category: 'Carne', emoji: '🍽️', servings: 4 }),
    'recipe-edit': (el) => recipeForm(familyRecipes().find((r) => r.id === el.dataset.id)),
    'recipe-copy': (el) => {
      const r = recipeById(el.dataset.id);
      if (!r) return;
      const id = Store.uid();
      Store.update((s) => s.recipes.push({ ...r, id, builtin: false, fromBuiltin: r.id }));
      toast('⭐ Guardada nas receitas da família — já a podem editar.');
      openRecipe(id);
    },
    'recipe-del': (el) => {
      if (!confirm('Apagar esta receita da família?')) return;
      Store.update((s) => { s.recipes = s.recipes.filter((r) => r.id !== el.dataset.id); });
      $('#dialog').close();
    },
    'recipe-import': () => {
      if (!Cloud.ctx()) { toast('Importar receitas de sites precisa de conta (Definições → Entrar).'); return; }
      openForm({
        title: 'Importar receita de um site',
        fields: [{ name: 'url', label: 'Link da página da receita (Pingo Doce, Continente, Teleculinária, blogs…)', type: 'url', required: true, placeholder: 'https://…' }],
        submitLabel: 'Importar',
        onSubmit: (d) => { importFromUrl(d.url); },
      });
    },
  };

  const inlineForms = {
    'add-pantry': (f, d) => {
      let n = 0;
      Store.update((s) => d.text.split(/[,;]/).forEach((x) => { if (x.trim() && addPantry(s, x.trim())) n++; }));
      if (!n) toast('Já estava na despensa.');
    },
  };

  function onChange(el) {
    if (!el.matches('[data-meal]')) return false;
    const [d, k] = el.dataset.meal.split(':');
    const value = el.value.trim();
    Store.update((s) => {
      const m = { ...(s.meals[d] || {}), [k]: value };
      // Se escreveram outra coisa por cima, deixa de estar ligado à receita.
      if (m[`${k}Recipe`] && recipeById(m[`${k}Recipe`])?.title !== value) delete m[`${k}Recipe`];
      s.meals[d] = m;
    });
    return true;
  }

  function filter(items, q) {
    const words = I.strip(q).split(/\s+/).filter(Boolean);
    items.forEach((el) => {
      const text = el.dataset.search || '';
      (el.closest('li') || el).hidden = !words.every((w) => text.includes(w));
    });
  }

  function onInput(el) {
    if (el.id === 'recipe-search') filter([...document.querySelectorAll('.recipe-card')], el.value);
    if (el.id === 'picker-search') filter([...document.querySelectorAll('.picker-list button')], el.value);
  }

  // Substitui a vista simples de refeições.
  const route = Views.routes.find((r) => r[0] === 'refeicoes');
  if (route) route[3] = view;

  return { actions, inlineForms, onChange, onInput };
};
