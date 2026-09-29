/*
 * Despensa: validades (passou / hoje / a acabar o prazo), produtos "a acabar" e receitas para
 * aproveitar o que está perto do fim do prazo. Script "clássico": define globalThis.Despensa.
 */
(function (root) {
  const days = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
  const SOON = 3; // dias: "a acabar o prazo"

  /** Estado da validade: { days, level: expired | today | soon | ok } ou null (sem validade). */
  function expiry(p, today) {
    if (!p?.expires) return null;
    const d = days(today, p.expires);
    return { days: d, level: d < 0 ? 'expired' : d === 0 ? 'today' : d <= SOON ? 'soon' : 'ok' };
  }

  const needsAttention = (p, today) => ['expired', 'today', 'soon'].includes(expiry(p, today)?.level);

  /** Divide a despensa: atenção ao prazo (mais urgente primeiro), a acabar, e o resto (por nome). */
  function groups(pantry = [], today) {
    const byName = (a, b) => a.name.localeCompare(b.name, 'pt');
    const attention = pantry.filter((p) => needsAttention(p, today))
      .sort((a, b) => expiry(a, today).days - expiry(b, today).days || byName(a, b));
    const low = pantry.filter((p) => p.low && !needsAttention(p, today)).sort(byName);
    const rest = pantry.filter((p) => !p.low && !needsAttention(p, today)).sort(byName);
    return { attention, low, rest };
  }

  /** Receitas que usam produtos de `items` (os que estão a acabar o prazo, o mais urgente primeiro): as que usam mais,
   * depois as do mais urgente, depois as da família antes das sugestões do portal. */
  function recipesUsing(items = [], recipes = [], { parse, matches }, limit = 4) {
    if (!items.length) return [];
    const ranked = recipes.map((r) => {
      const keys = (r.ingredients || []).map((l) => parse(l).key).filter(Boolean);
      const uses = items.filter((p) => keys.some((k) => matches(k, p.key)));
      // `items` vem do mais urgente para o menos: quanto mais cedo aparece o primeiro que usa, melhor.
      return { recipe: r, uses, first: items.indexOf(uses[0]) };
    }).filter((x) => x.uses.length)
      .sort((a, b) => b.uses.length - a.uses.length || a.first - b.first
        || !!a.recipe.builtin - !!b.recipe.builtin || a.recipe.title.localeCompare(b.recipe.title, 'pt'))
      .map(({ recipe, uses }) => ({ recipe, uses }));
    // Pelo menos uma receita para cada produto (do mais urgente para o menos); depois as restantes pela ordem.
    const pick = [];
    items.forEach((p) => { const x = ranked.find((r) => !pick.includes(r) && r.uses.includes(p)); if (x) pick.push(x); });
    ranked.forEach((r) => { if (!pick.includes(r)) pick.push(r); });
    return pick.slice(0, limit).sort((a, b) => ranked.indexOf(a) - ranked.indexOf(b));
  }

  /** Texto curto da validade: "passou há 2 dias", "acaba hoje", "acaba amanhã", "até 12/10". */
  function label(e, expires) {
    if (!e) return '';
    if (e.days < -1) return `passou há ${-e.days} dias`;
    if (e.days === -1) return 'passou ontem';
    if (e.days === 0) return 'acaba hoje';
    if (e.days === 1) return 'acaba amanhã';
    if (e.days <= SOON) return `acaba em ${e.days} dias`;
    return `até ${expires.slice(8, 10)}/${expires.slice(5, 7)}`;
  }

  /** Produtos "a acabar" que ainda não estão por comprar na lista de compras. */
  function toBuy(pantry = [], shopping = [], { parse, matches }) {
    const pending = shopping.filter((i) => !i.done).map((i) => parse(i.text).key).filter(Boolean);
    return pantry.filter((p) => p.low && !pending.some((k) => k === p.key || matches(k, p.key) || matches(p.key, k)));
  }

  root.Despensa = { SOON, days, expiry, needsAttention, groups, recipesUsing, label, toBuy };
})(globalThis);
