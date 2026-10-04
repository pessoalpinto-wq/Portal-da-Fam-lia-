/*
 * Cópia de segurança da família: criar o ficheiro, lê-lo (também o formato antigo) e preparar a reposição.
 * Script "clássico": define globalThis.Copia. Testado em tests/copia.test.mjs.
 */
(function (root) {
  const FORMAT = 'portal-familia-copia';
  const VERSION = 2;

  // Nomes para o resumo (o que não estiver aqui conta como "outros").
  const LABELS = {
    members: '👪 Família', events: '📅 Compromissos', tasks: '✅ Tarefas', rewards: '🎁 Recompensas', redemptions: '🎁 Trocas de pontos',
    classes: '🎒 Aulas', exams: '📝 Testes e trabalhos', projects: '🧩 Projectos', trips: '✈️ Viagens', shopping: '🛒 Lista de compras',
    notes: '📌 Recados', contacts: '📇 Contactos', money: '💰 Movimentos de dinheiro', allowances: '💰 Mesadas', goals: '🐷 Mealheiros',
    bills: '💶 Contas da casa', dates: '🎉 Datas especiais', health: '🏥 Consultas e vacinas', healthcards: '🩺 Fichas de saúde',
    docs: '🔐 Documentos', polls: '🗳️ Votações', votes: '🗳️ Votos', photos: '📸 Fotos (só a lista)', recipes: '📖 Receitas da família',
    pantry: '🧺 Despensa', challenges: '🤝 Desafios', savings: '🏦 Banco dos Pais', products: '⭐ Os nossos produtos',
    staples: '⭐ Os do costume', shopstats: '🛒 Histórico de compras e preços', groceries: '🧾 Talões e orçamento', shopstores: '🏪 Lojas',
    shopreqs: '🙋 Pedidos para as compras', shoptrip: '📣 Vou às compras', mealhist: '🕘 Semanas de refeições',
    faccounts: '🏦 Contas e investimentos', debts: '🚗 Dívidas', fsnaps: '📅 Fechos do mês',
    ftx: '📋 Movimentos bancários', fbudgets: '🎯 Orçamentos', frules: '🏷️ Regras de categorias',
  };

  const colls = (state) => Object.keys(state || {}).filter((k) => Array.isArray(state[k]));

  /** Cria a cópia (objecto pronto a guardar em JSON). */
  function build(state, { family = '', by = '', now = new Date() } = {}) {
    const data = {};
    colls(state).forEach((c) => { data[c] = state[c]; });
    data.meals = state.meals || {};
    return { format: FORMAT, version: VERSION, created: now.toISOString(), family, by, data };
  }

  /** Nome do ficheiro: portal-familia-2026-10-01.json */
  const fileName = (now = new Date()) => `portal-familia-${now.toISOString().slice(0, 10)}.json`;

  /**
   * Lê um ficheiro de cópia. Aceita o formato novo e o antigo (o estado inteiro).
   * @returns {{ created, family, data }} — lança um erro com uma mensagem clara se não for uma cópia.
   */
  function parse(text) {
    let obj;
    try { obj = JSON.parse(text); } catch { throw new Error('Este ficheiro não é uma cópia do portal (não é JSON).'); }
    if (obj?.format === FORMAT) {
      if (Number(obj.version) > VERSION) throw new Error('Esta cópia foi feita por uma versão mais recente do portal. Atualizem a app e tentem outra vez.');
      if (!obj.data || !Array.isArray(obj.data.members)) throw new Error('A cópia está incompleta (faltam os membros da família).');
      return { created: obj.created || '', family: obj.family || '', data: obj.data };
    }
    // Formato antigo: o próprio estado.
    if (obj && Array.isArray(obj.members) && obj.version) {
      const data = {};
      colls(obj).forEach((c) => { data[c] = obj[c]; });
      data.meals = obj.meals || {};
      return { created: '', family: '', data };
    }
    throw new Error('Este ficheiro não é uma cópia do Portal da Família.');
  }

  /** Resumo para mostrar antes de repor: [{ label, n }] (só o que tem alguma coisa). */
  function summary(data) {
    const out = [];
    colls(data).forEach((c) => { if (data[c].length) out.push({ coll: c, label: LABELS[c] || c, n: data[c].length }); });
    const meals = Object.values(data.meals || {}).filter((m) => m && Object.values(m).some(Boolean)).length;
    if (meals) out.push({ coll: 'meals', label: '🍽️ Dias com refeições planeadas', n: meals });
    return out;
  }

  /**
   * O que muda ao repor: por cada colecção, quantos registos entram/mudam e quantos saem.
   * @returns {{ added, changed, removed }}
   */
  function diff(current, data) {
    const r = { added: 0, changed: 0, removed: 0 };
    new Set([...colls(current), ...colls(data)]).forEach((c) => {
      const now = new Map((current[c] || []).map((x) => [String(x.id), JSON.stringify(x)]));
      const next = new Map((data[c] || []).map((x) => [String(x.id), JSON.stringify(x)]));
      next.forEach((v, id) => { if (!now.has(id)) r.added++; else if (now.get(id) !== v) r.changed++; });
      now.forEach((v, id) => { if (!next.has(id)) r.removed++; });
    });
    return r;
  }

  /** A cópia é desta família? (algum membro com o mesmo id) */
  const sameFamily = (current, data) => (data.members || []).some((m) => (current.members || []).some((x) => x.id === m.id));

  /** Dias desde a última cópia (null se nunca). */
  const daysSince = (iso, now = new Date()) => (iso ? Math.floor((now - Date.parse(iso)) / 86400000) : null);

  root.Copia = { FORMAT, VERSION, LABELS, build, fileName, parse, summary, diff, sameFamily, daysSince };
})(globalThis);
