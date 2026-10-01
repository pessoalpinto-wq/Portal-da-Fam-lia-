/*
 * Histórico das ementas: o que se comeu em cada semana (colecção "mealhist", um registo por semana,
 * id = segunda-feira). Cada dia regista-se no próprio dia e, depois de passar, já não muda — assim
 * planear a semana seguinte com antecedência não estraga o histórico.
 * Script "clássico": define globalThis.Ementas. Testado em tests/ementas.test.mjs.
 */
(function (root) {
  const DAY = 86400000;
  const iso = (d) => d.toISOString().slice(0, 10);
  const addDays = (s, n) => iso(new Date(Date.parse(`${s}T00:00:00Z`) + n * DAY));
  const weekday = (s) => new Date(`${s}T00:00:00Z`).getUTCDay(); // 0 = domingo (como as chaves de "meals")
  /** Segunda-feira da semana de `s`. */
  const weekStart = (s) => addDays(s, -((weekday(s) + 6) % 7));
  /** Data do dia `d` (0–6, 0 = domingo) da semana que começa em `ws`. */
  const dateOf = (ws, d) => addDays(ws, (Number(d) + 6) % 7);
  const KEYS = ['lunch', 'lunchRecipe', 'dinner', 'dinnerRecipe'];
  const pick = (m) => Object.fromEntries(KEYS.filter((k) => m?.[k]).map((k) => [k, m[k]]));
  const hasFood = (m) => !!(m && (m.lunch || m.dinner));

  /**
   * Que registos do histórico mudam com a ementa actual.
   * Regista o dia de hoje (enquanto é hoje) e os dias que já passaram esta semana e ainda não têm registo.
   * Nunca apaga nem muda um dia que já passou.
   * @returns {Array} registos a gravar (só os que mudaram)
   */
  function record(hist = [], meals = {}, today) {
    const ws = weekStart(today);
    const cur = hist.find((h) => h.id === ws);
    const days = { ...(cur?.days || {}) };
    let changed = false;
    for (let d = 0; d < 7; d++) {
      const date = dateOf(ws, d);
      if (date > today) continue;
      const m = meals[d];
      if (!hasFood(m)) continue;
      const isToday = date === today;
      if (!isToday && days[d]) continue; // dia passado já registado: fica como estava
      const next = pick(m);
      if (JSON.stringify(days[d] || {}) !== JSON.stringify(next)) { days[d] = next; changed = true; }
    }
    return changed ? [{ id: ws, days }] : [];
  }

  /** Receitas comidas nas últimas `weeks` semanas (sem contar a actual), para a sugestão não as repetir. */
  function recentRecipes(hist = [], today, weeks = 2) {
    const ws = weekStart(today);
    const from = addDays(ws, -7 * weeks);
    const ids = new Set();
    hist.filter((h) => h.id >= from && h.id < ws).forEach((h) => Object.values(h.days || {}).forEach((m) => {
      if (m.lunchRecipe) ids.add(m.lunchRecipe);
      if (m.dinnerRecipe) ids.add(m.dinnerRecipe);
    }));
    return ids;
  }

  /** Semanas anteriores (mais recentes primeiro), só as que têm alguma refeição. */
  const pastWeeks = (hist = [], today, limit = 8) => hist
    .filter((h) => h.id < weekStart(today) && Object.values(h.days || {}).some(hasFood))
    .sort((a, b) => b.id.localeCompare(a.id)).slice(0, limit);

  /** Os pratos mais repetidos: [{ name, n }]. */
  function topDishes(hist = [], limit = 5) {
    const count = new Map();
    hist.forEach((h) => Object.values(h.days || {}).forEach((m) => ['lunch', 'dinner'].forEach((k) => {
      const name = String(m[k] || '').trim();
      if (!name) return;
      const key = name.toLowerCase();
      const e = count.get(key) || { name, n: 0 };
      e.n++;
      count.set(key, e);
    })));
    return [...count.values()].filter((e) => e.n > 1).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name, 'pt')).slice(0, limit);
  }

  root.Ementas = { weekStart, dateOf, addDays, record, recentRecipes, pastWeeks, topDishes };
})(globalThis);
