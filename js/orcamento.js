/*
 * Orçamento por categoria: ler os movimentos de um extrato, classificá-los (regras da família + regras
 * para lojas portuguesas), não repetir movimentos já importados, detectar transferências entre as
 * vossas contas e calcular o mês (entrou, saiu, por categoria, orçamento).
 * Colecções (só pais): ftx (movimentos), fbudgets (id = categoria, limit), frules (match → cat).
 * Script "clássico": define globalThis.Orcamento. Testado em tests/orcamento.test.mjs.
 */
(function (root) {
  /* ---------- Categorias ---------- */
  // [id, emoji, nome, tipo] — tipo: expense (despesa), income (entrada), move (não conta: transferências / poupança)
  const CATS = [
    ['supermercado', '🛒', 'Supermercado', 'expense'],
    ['casa', '🏠', 'Casa (renda, condomínio, obras)', 'expense'],
    ['contas', '💡', 'Luz, água, gás e telecomunicações', 'expense'],
    ['carro', '🚗', 'Carro e combustível', 'expense'],
    ['transportes', '🚌', 'Transportes', 'expense'],
    ['saude', '🏥', 'Saúde', 'expense'],
    ['educacao', '🎒', 'Escola e educação', 'expense'],
    ['restaurantes', '🍽️', 'Restaurantes e cafés', 'expense'],
    ['lazer', '🎉', 'Lazer e férias', 'expense'],
    ['roupa', '👕', 'Roupa e calçado', 'expense'],
    ['compras', '🛍️', 'Compras', 'expense'],
    ['subscricoes', '📺', 'Subscrições', 'expense'],
    ['seguros', '🛡️', 'Seguros', 'expense'],
    ['impostos', '🏛️', 'Impostos e taxas', 'expense'],
    ['credito', '🏦', 'Créditos (prestações)', 'expense'],
    ['filhas', '👧', 'Filhas (mesadas, actividades)', 'expense'],
    ['animais', '🐾', 'Animais', 'expense'],
    ['levantamentos', '💶', 'Levantamentos (dinheiro)', 'expense'],
    ['outros', '📦', 'Outras despesas', 'expense'],
    ['entradas', '💼', 'Entradas (ordenados, reembolsos…)', 'income'],
    ['poupanca', '🐷', 'Para poupança / investimentos', 'move'],
    ['transferencias', '🔁', 'Transferências entre as vossas contas', 'move'],
  ];
  const CAT = Object.fromEntries(CATS.map(([id, emoji, name, kind]) => [id, { id, emoji, name, kind }]));
  const kindOf = (cat) => CAT[cat]?.kind || 'expense';

  /* ---------- Texto ---------- */
  const strip = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const norm = (s) => strip(s).replace(/[^a-z0-9]+/g, ' ').trim();

  // Regras para lojas e serviços portugueses (palavra no descritivo → categoria). As da família vêm primeiro.
  const DEFAULT_RULES = [
    ['continente', 'supermercado'], ['pingo doce', 'supermercado'], ['lidl', 'supermercado'], ['aldi', 'supermercado'],
    ['intermarche', 'supermercado'], ['minipreco', 'supermercado'], ['auchan', 'supermercado'], ['jumbo', 'supermercado'],
    ['mercadona', 'supermercado'], ['el corte ingles', 'supermercado'], ['meu super', 'supermercado'], ['coviran', 'supermercado'],
    ['spar', 'supermercado'], ['amanhecer', 'supermercado'], ['froiz', 'supermercado'], ['talho', 'supermercado'], ['padaria', 'supermercado'],
    ['galp', 'carro'], ['repsol', 'carro'], ['cepsa', 'carro'], ['prio', 'carro'], ['bp ', 'carro'], ['moeve', 'carro'],
    ['via verde', 'carro'], ['brisa', 'carro'], ['parque', 'carro'], ['emel', 'carro'], ['oficina', 'carro'], ['norauto', 'carro'], ['midas', 'carro'],
    ['inspecao', 'carro'], ['iuc', 'impostos'],
    ['edp', 'contas'], ['endesa', 'contas'], ['goldenergy', 'contas'], ['iberdrola', 'contas'], ['luzboa', 'contas'], ['coopernico', 'contas'],
    ['aguas', 'contas'], ['smas', 'contas'], ['indaqua', 'contas'], ['epal', 'contas'], ['gas natural', 'contas'], ['lusitaniagas', 'contas'],
    ['meo', 'contas'], ['altice', 'contas'], ['nos comunic', 'contas'], ['vodafone', 'contas'], ['nowo', 'contas'], ['digi ', 'contas'], ['uzo', 'contas'],
    ['netflix', 'subscricoes'], ['spotify', 'subscricoes'], ['disney', 'subscricoes'], ['hbo', 'subscricoes'], ['max com', 'subscricoes'],
    ['prime video', 'subscricoes'], ['amazon prime', 'subscricoes'], ['apple com', 'subscricoes'], ['icloud', 'subscricoes'],
    ['google one', 'subscricoes'], ['youtube', 'subscricoes'], ['playstation', 'subscricoes'], ['xbox', 'subscricoes'], ['ginasio', 'subscricoes'],
    ['fitness', 'subscricoes'], ['solinca', 'subscricoes'], ['holmes place', 'subscricoes'],
    ['farmacia', 'saude'], ['wells', 'saude'], ['cuf', 'saude'], ['lusiadas', 'saude'], ['hospital', 'saude'], ['clinica', 'saude'],
    ['dentist', 'saude'], ['otica', 'saude'], ['optica', 'saude'], ['multiopticas', 'saude'], ['luz saude', 'saude'], ['trofa saude', 'saude'],
    ['escola', 'educacao'], ['colegio', 'educacao'], ['agrupamento', 'educacao'], ['explica', 'educacao'], ['papelaria', 'educacao'],
    ['bertrand', 'educacao'], ['livraria', 'educacao'], ['wook', 'educacao'],
    ['uber eats', 'restaurantes'], ['glovo', 'restaurantes'], ['bolt food', 'restaurantes'], ['mcdonald', 'restaurantes'], ['burger king', 'restaurantes'],
    ['kfc', 'restaurantes'], ['telepizza', 'restaurantes'], ['pizza', 'restaurantes'], ['restaurante', 'restaurantes'], ['churrasqueira', 'restaurantes'],
    ['pastelaria', 'restaurantes'], ['cafe ', 'restaurantes'], ['snack', 'restaurantes'], ['tasca', 'restaurantes'], ['sushi', 'restaurantes'],
    ['starbucks', 'restaurantes'], ['h3 ', 'restaurantes'], ['vitaminas', 'restaurantes'], ['padaria portuguesa', 'restaurantes'],
    ['uber', 'transportes'], ['bolt', 'transportes'], ['cp comboios', 'transportes'], ['comboios de portugal', 'transportes'], ['metro', 'transportes'],
    ['carris', 'transportes'], ['stcp', 'transportes'], ['andante', 'transportes'], ['navegante', 'transportes'], ['flixbus', 'transportes'], ['rede expressos', 'transportes'],
    ['booking', 'lazer'], ['airbnb', 'lazer'], ['ryanair', 'lazer'], ['easyjet', 'lazer'], ['tap air', 'lazer'], ['hotel', 'lazer'], ['cinema', 'lazer'],
    ['nos cinemas', 'lazer'], ['cinemas nos', 'lazer'], ['ticketline', 'lazer'], ['bol pt', 'lazer'], ['fnac', 'compras'], ['worten', 'compras'],
    ['zara', 'roupa'], ['primark', 'roupa'], ['h m ', 'roupa'], ['bershka', 'roupa'], ['pull bear', 'roupa'], ['stradivarius', 'roupa'], ['mango', 'roupa'],
    ['decathlon', 'roupa'], ['sport zone', 'roupa'], ['jd sports', 'roupa'], ['parfois', 'roupa'], ['shein', 'roupa'], ['lefties', 'roupa'], ['springfield', 'roupa'],
    ['ikea', 'casa'], ['leroy merlin', 'casa'], ['aki ', 'casa'], ['bricomarche', 'casa'], ['maxmat', 'casa'], ['condominio', 'casa'], ['renda', 'casa'],
    ['amazon', 'compras'], ['aliexpress', 'compras'], ['temu', 'compras'], ['ctt', 'compras'], ['radio popular', 'compras'], ['mediamarkt', 'compras'],
    ['seguro', 'seguros'], ['fidelidade', 'seguros'], ['allianz', 'seguros'], ['ageas', 'seguros'], ['tranquilidade', 'seguros'], ['generali', 'seguros'],
    ['ok teleseguros', 'seguros'], ['logo seguros', 'seguros'], ['zurich', 'seguros'], ['multicare', 'seguros'], ['medis', 'seguros'],
    ['autoridade tributaria', 'impostos'], ['at autoridade', 'impostos'], ['financas', 'impostos'], ['imi ', 'impostos'], ['seg social', 'impostos'],
    ['seguranca social', 'impostos'], ['imposto', 'impostos'], ['comissao', 'impostos'], ['manutencao de conta', 'impostos'], ['imposto do selo', 'impostos'],
    ['prestacao', 'credito'], ['cetelem', 'credito'], ['cofidis', 'credito'], ['credibom', 'credito'], ['santander consumer', 'credito'], ['oney', 'credito'],
    ['leasing', 'credito'], ['credito habitacao', 'credito'], ['emprestimo', 'credito'],
    ['veterinari', 'animais'], ['zooplus', 'animais'], ['tiendanimal', 'animais'], ['kiwoko', 'animais'],
    ['levantamento', 'levantamentos'], ['lev atm', 'levantamentos'], ['multibanco lev', 'levantamentos'], ['cash withdrawal', 'levantamentos'],
    ['vencimento', 'entradas'], ['ordenado', 'entradas'], ['salario', 'entradas'], ['remuneracao', 'entradas'], ['reembolso irs', 'entradas'],
    ['subsidio', 'entradas'], ['abono', 'entradas'], ['pensao', 'entradas'], ['juros credores', 'entradas'],
    ['ppr', 'poupanca'], ['certificados de aforro', 'poupanca'], ['aforro', 'poupanca'], ['igcp', 'poupanca'], ['corretora', 'poupanca'],
    ['trading 212', 'poupanca'], ['degiro', 'poupanca'], ['xtb', 'poupanca'], ['plano poupanca', 'poupanca'], ['deposito a prazo', 'poupanca'],
  ].map(([match, cat]) => ({ match: norm(match), whole: /\s$/.test(match), cat })); // "bp " = palavra inteira (não apanha "BPI")

  /**
   * Categoria de um movimento. As regras da família (frules) ganham às pré-definidas; entre regras, ganha a mais comprida.
   * @returns {{ cat, rule: 'family'|'default'|'none' }}
   */
  function categorize(desc, amount, familyRules = []) {
    const d = ` ${norm(desc)} `;
    // A regra tem de começar no início de uma palavra ("seguro" apanha "SEGUROS", "renda" não apanha "PRENDAS").
    const hit = (r) => r.match && (r.whole ? d.includes(` ${r.match} `) : d.includes(` ${r.match}`));
    const pick = (rules) => rules.filter(hit).sort((a, b) => b.match.length - a.match.length)[0];
    const fam = familyRules.map((r) => ({ match: norm(r.match), cat: r.cat })).filter((r) => matchesRule(desc, r.match))
      .sort((a, b) => b.match.length - a.match.length)[0];
    if (fam && CAT[fam.cat]) return { cat: fam.cat, rule: 'family' };
    const def = pick(DEFAULT_RULES);
    if (def) {
      // Uma "entrada" com descritivo de loja (ex.: devolução) continua nessa categoria; o sinal decide só sem regra.
      return { cat: def.cat, rule: 'default' };
    }
    return { cat: Number(amount) >= 0 ? 'entradas' : 'outros', rule: 'none' };
  }

  // Palavras que não identificam a loja (ignoradas no nome da loja e ao comparar com as regras da família).
  const SKIP = new Set(['compra', 'compras', 'pagamento', 'pag', 'pagto', 'trf', 'transf', 'transferencia', 'mb', 'mbway', 'way', 'cartao', 'cart',
      'dd', 'debito', 'direto', 'directo', 'c', 'cc', 'pos', 'tpa', 'visa', 'mastercard', 'contactless', 'apple', 'pay', 'google', 'de', 'do', 'da', 'em',
      'para', 'a', 'o', 'e', 'lda', 'sa', 'unipessoal', 'pt', 'lisboa', 'porto', 'serv', 'servico', 'servicos', 'com', 'www']);
  const keyWords = (desc) => norm(desc).split(' ').filter((w) => w.length >= 2 && !/\d/.test(w) && !SKIP.has(w));

  /** "COMPRA 4521 CONTINENTE MATOSINHOS 12/09" → "continente matosinhos" (para criar uma regra). */
  const merchantKey = (desc) => keyWords(desc).slice(0, 2).join(' ');

  /** Uma regra da família apanha este descritivo? (no texto todo ou sem as palavras soltas: "loja ze" apanha "LOJA DO ZÉ") */
  function matchesRule(desc, match) {
    const m = norm(match);
    if (!m) return false;
    return ` ${norm(desc)} `.includes(` ${m}`) || ` ${keyWords(desc).join(' ')} `.includes(` ${m}`);
  }

  /* ---------- Números e datas ---------- */
  /** Valor em qualquer formato de banco: "1.234,56", "-45,20", "45,20-", "(12,00)", "-12.50", "1,234.56", "€ 3,00". */
  function parseMoney(v) {
    if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v * 100) / 100 : null;
    let s = String(v ?? '').replace(/[\s €]|EUR/gi, '');
    if (!s) return null;
    let neg = false;
    if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
    if (/-$/.test(s)) { neg = true; s = s.slice(0, -1); }
    if (/^-/.test(s)) { neg = !neg; s = s.slice(1); }
    if (/^\+/.test(s)) s = s.slice(1);
    if (!/^[\d.,]+$/.test(s)) return null;
    const lastC = s.lastIndexOf(',');
    const lastD = s.lastIndexOf('.');
    if (lastC >= 0 && lastD >= 0) s = lastC > lastD ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    else if (lastC >= 0) s = /^\d{1,3}(,\d{3})+$/.test(s) && !/,\d{1,2}$/.test(s) ? s.replace(/,/g, '') : s.replace(/,/g, '.');
    else if (lastD >= 0 && /^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    const n = Number(s);
    if (!Number.isFinite(n)) return null;
    return Math.round((neg ? -n : n) * 100) / 100;
  }

  /** Data → AAAA-MM-DD ("30-09-2026", "30/09/26", "2026-09-30 14:22", "30.09.2026"); dia antes do mês. */
  function parseDate(v) {
    const s = String(v ?? '').trim();
    let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    let y; let mo; let d;
    if (m) [, y, mo, d] = m;
    else if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/))) {
      [, d, mo, y] = m;
      if (y.length === 2) y = `20${y}`;
    } else return null;
    const iso = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const t = Date.parse(`${iso}T00:00:00Z`);
    return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === iso ? iso : null;
  }

  /* ---------- Colunas do extrato ---------- */
  const has = (h, ...keys) => keys.some((k) => h.includes(k));
  /** Que coluna é o quê, pelo cabeçalho. */
  function mapHeader(header) {
    const h = header.map((x) => norm(x));
    const find = (test) => h.findIndex(test);
    const map = {};
    // Data: a do movimento/lançamento, não a "data valor".
    map.date = find((x) => has(x, 'data mov', 'data lanc', 'data de lanc', 'data operacao', 'data da operacao', 'completed date', 'data transacao'));
    if (map.date < 0) map.date = find((x) => (x === 'data' || x === 'date' || x.startsWith('data ') || x === 'started date') && !x.includes('valor'));
    if (map.date < 0) map.date = find((x) => x.includes('data') || x.includes('date'));
    // Descrição: nunca uma coluna de data ("Data Operação" não é a descrição).
    map.desc = find((x) => !has(x, 'data', 'date') && has(x, 'descricao', 'descritivo', 'description', 'designacao', 'detalhe', 'concept'));
    if (map.desc < 0) map.desc = find((x) => !has(x, 'data', 'date') && has(x, 'movimento', 'operacao', 'referencia'));
    map.debit = find((x) => has(x, 'debito', 'debit', 'saida', 'levantamento') && !has(x, 'data'));
    map.credit = find((x) => has(x, 'credito', 'credit', 'entrada', 'deposito') && !has(x, 'data'));
    map.amount = find((x) => has(x, 'montante', 'importancia', 'amount', 'quantia', 'valor') && !has(x, 'data', 'saldo'));
    map.balance = find((x) => has(x, 'saldo', 'balance'));
    map.type = find((x) => x === 'tipo' || x === 'd c' || x === 'dc' || x === 'sinal' || x === 'natureza');
    map.state = find((x) => x === 'state' || x === 'estado');
    if (map.debit >= 0 && map.credit >= 0) map.amount = -1;
    return map;
  }

  const looksLikeHeader = (row) => {
    const m = mapHeader(row);
    return m.date >= 0 && m.desc >= 0 && (m.amount >= 0 || (m.debit >= 0 && m.credit >= 0));
  };

  /** Encontra a linha de cabeçalho (muitos bancos põem antes o titular, a conta, o período…). */
  function findHeader(rows) {
    for (let i = 0; i < Math.min(rows.length, 60); i++) if (looksLikeHeader(rows[i])) return { index: i, map: mapHeader(rows[i]) };
    return null;
  }

  /**
   * Linhas de um extrato → movimentos [{ date, desc, amount, balance }].
   * Ignora linhas sem data ou sem valor (totais, "saldo inicial", rodapés).
   */
  function toMovements(rows, { index, map }) {
    const out = [];
    rows.slice(index + 1).forEach((r) => {
      const date = parseDate(r[map.date]);
      if (!date) return;
      if (map.state >= 0 && /^(declined|reverted|failed|recusad)/i.test(r[map.state] || '')) return;
      let amount = null;
      if (map.amount >= 0) {
        amount = parseMoney(r[map.amount]);
        if (amount != null && map.type >= 0) {
          const t = norm(r[map.type]);
          if (/^(d|deb|debito|debit|saida)\b/.test(t)) amount = -Math.abs(amount);
          else if (/^(c|cred|credito|credit|entrada)\b/.test(t)) amount = Math.abs(amount);
        }
      } else {
        const d = parseMoney(r[map.debit]);
        const c = parseMoney(r[map.credit]);
        if (d) amount = -Math.abs(d);
        else if (c) amount = Math.abs(c);
      }
      if (amount == null || amount === 0) return;
      const desc = String(r[map.desc] ?? '').replace(/\s+/g, ' ').trim() || '(sem descrição)';
      const balance = map.balance >= 0 ? parseMoney(r[map.balance]) : null;
      out.push({ date, desc, amount, balance });
    });
    return out;
  }

  /* ---------- Importar sem repetir ---------- */
  /** FNV-1a 32 bits (id estável para o mesmo movimento). */
  function hash(s) {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return (h >>> 0).toString(36);
  }
  const txKey = (account, m) => `${account}|${m.date}|${m.amount.toFixed(2)}|${norm(m.desc)}`;

  /**
   * Prepara a importação: dá um id estável a cada movimento (o mesmo movimento importado duas vezes
   * tem o mesmo id), separa os novos dos que já existiam e classifica os novos.
   * Dois movimentos iguais no mesmo dia (dois cafés de 0,80 €) contam como dois.
   */
  function prepareImport(existing = [], movements = [], account, familyRules = []) {
    const seen = new Map();
    const have = new Set(existing.map((t) => t.id));
    const fresh = [];
    let dup = 0;
    movements.forEach((m) => {
      const k = txKey(account, m);
      const n = (seen.get(k) || 0) + 1;
      seen.set(k, n);
      const id = `tx-${hash(k)}-${n}`;
      if (have.has(id)) { dup++; return; }
      const c = categorize(m.desc, m.amount, familyRules);
      fresh.push({ id, account, date: m.date, desc: m.desc, amount: m.amount, cat: c.cat, rule: c.rule, src: 'import' });
    });
    return { fresh, dup };
  }

  /**
   * Transferências entre as vossas contas: o mesmo valor a sair de uma e a entrar noutra, até 3 dias de diferença.
   * Devolve os ids a marcar como "transferencias".
   */
  function findTransfers(txs = []) {
    const out = new Set();
    const pos = txs.filter((t) => t.amount > 0 && t.cat !== 'transferencias' && !t.manualCat);
    txs.filter((t) => t.amount < 0 && !t.manualCat).forEach((t) => {
      const day = Date.parse(t.date);
      const match = pos.find((p) => !out.has(p.id) && p.account !== t.account && Math.abs(p.amount + t.amount) < 0.005
        && Math.abs(Date.parse(p.date) - day) <= 3 * 86400000);
      if (match) { out.add(t.id); out.add(match.id); }
    });
    return [...out];
  }

  /* ---------- O mês ---------- */
  const r2 = (n) => Math.round(n * 100) / 100;
  /** Resumo de um mês: entrou, saiu, poupado, por categoria (despesas: positivo = gasto), por classificar. */
  function monthSummary(txs = [], month) {
    const byCat = {};
    let income = 0;
    let expense = 0;
    let moved = 0;
    let unsorted = 0;
    txs.filter((t) => String(t.date).startsWith(month)).forEach((t) => {
      const k = kindOf(t.cat);
      if (k === 'move') { moved += -t.amount; return; }
      if (k === 'income') { income += t.amount; byCat[t.cat] = r2((byCat[t.cat] || 0) + t.amount); return; }
      expense += -t.amount;
      byCat[t.cat] = r2((byCat[t.cat] || 0) - t.amount);
      if (t.rule === 'none' && !t.manualCat) unsorted++;
    });
    income = r2(income);
    expense = r2(expense);
    return { month, income, expense, saved: r2(income - expense), rate: income > 0 ? Math.round(((income - expense) / income) * 100) : null, byCat, moved: r2(moved), unsorted };
  }

  const addMonths = (m, n) => {
    const [y, mo] = m.split('-').map(Number);
    const t = y * 12 + (mo - 1) + n;
    return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
  };

  /**
   * Linhas do orçamento do mês: cada categoria de despesa com gasto ou orçamento.
   * avg = média dos 3 meses anteriores com movimentos (para "acima do habitual").
   * @returns {Array<{ cat, spent, limit, pct, level: 'ok'|'warn'|'over'|null, avg }>}
   */
  function budgetRows(txs = [], budgets = [], month) {
    const cur = monthSummary(txs, month).byCat;
    const prev = [1, 2, 3].map((i) => monthSummary(txs, addMonths(month, -i))).filter((s) => s.expense > 0 || s.income > 0);
    const lim = Object.fromEntries(budgets.filter((b) => Number(b.limit) > 0).map((b) => [b.id, Number(b.limit)]));
    const cats = CATS.filter(([id, , , kind]) => kind === 'expense' && (cur[id] || lim[id])).map(([id]) => id);
    return cats.map((cat) => {
      const spent = r2(Math.max(0, cur[cat] || 0));
      const limit = lim[cat] || null;
      const pct = limit ? Math.round((spent / limit) * 100) : null;
      const avg = prev.length ? r2(prev.reduce((n, s) => n + Math.max(0, s.byCat[cat] || 0), 0) / prev.length) : null;
      return { cat, spent, limit, pct, level: pct == null ? null : pct >= 100 ? 'over' : pct >= 80 ? 'warn' : 'ok', avg };
    }).sort((a, b) => (b.limit ? 1 : 0) - (a.limit ? 1 : 0) || b.spent - a.spent);
  }

  /** Avisos de orçamento a enviar: categorias que passaram 80 % ou 100 % neste mês. */
  function budgetAlerts(txs = [], budgets = [], month) {
    return budgetRows(txs, budgets, month).filter((r) => r.level === 'warn' || r.level === 'over')
      .map((r) => ({ cat: r.cat, level: r.level === 'over' ? 100 : 80, spent: r.spent, limit: r.limit, pct: r.pct }));
  }

  root.Orcamento = {
    CATS, CAT, kindOf, DEFAULT_RULES, norm, categorize, merchantKey, matchesRule, parseMoney, parseDate, mapHeader, findHeader, toMovements,
    hash, prepareImport, findTransfers, monthSummary, budgetRows, budgetAlerts, addMonths,
  };
})(globalThis);
