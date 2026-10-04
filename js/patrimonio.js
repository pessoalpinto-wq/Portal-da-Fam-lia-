/*
 * Património da família: fecho do mês (saldo de cada conta no último dia), evolução e dívidas.
 * Colecções (só os pais as vêem — regra no servidor):
 *   faccounts: { id, name, bank, kind, archived }
 *   debts:     { id, name, lender, initial, start (AAAA-MM), payment, rate, end (AAAA-MM), archived }
 *   fsnaps:    { id: 'AAAA-MM', values: { contaId: saldo }, debts: { dividaId: capital em dívida }, by, at }
 * Script "clássico": define globalThis.Patrimonio. Testado em tests/patrimonio.test.mjs.
 */
(function (root) {
  const KINDS = [
    ['ordem', '🏦 À ordem'], ['poupanca', '🐷 Poupança'], ['prazo', '🔒 Depósito a prazo'], ['ppr', '🧓 PPR'],
    ['invest', '📈 Investimentos'], ['certificados', '📜 Certificados de Aforro / Tesouro'], ['dinheiro', '💵 Dinheiro'], ['outro', '📦 Outro'],
  ];
  const KIND_LABEL = Object.fromEntries(KINDS);
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const MES3 = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const round2 = (n) => Math.round(n * 100) / 100;
  const isMonth = (m) => /^\d{4}-\d{2}$/.test(String(m || ''));

  /* ---------- Meses ---------- */
  const monthOf = (iso) => String(iso).slice(0, 7);
  function addMonths(m, n) {
    const [y, mo] = m.split('-').map(Number);
    const t = y * 12 + (mo - 1) + n;
    return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
  }
  /** Meses entre a e b (b − a). */
  const monthsBetween = (a, b) => {
    const [ya, ma] = a.split('-').map(Number);
    const [yb, mb] = b.split('-').map(Number);
    return (yb - ya) * 12 + (mb - ma);
  };
  const lastDay = (m) => {
    const [y, mo] = m.split('-').map(Number);
    return `${m}-${String(new Date(Date.UTC(y, mo, 0)).getUTCDate()).padStart(2, '0')}`;
  };
  const monthName = (m) => `${MESES[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`;
  const monthShort = (m) => `${MES3[Number(m.slice(5)) - 1]} ${m.slice(2, 4)}`;

  /**
   * Que mês está para fechar: no último dia do mês já se pode fechar esse mês; nos primeiros
   * 10 dias do mês seguinte ainda se lembra o anterior. Devolve null se já está fechado.
   */
  function pendingClose(snaps = [], today) {
    const m = monthOf(today);
    const done = (x) => snaps.some((s) => s.id === x);
    if (today === lastDay(m)) return done(m) ? null : m;
    const prev = addMonths(m, -1);
    if (Number(today.slice(8, 10)) <= 10 && !done(prev)) return prev;
    return null;
  }

  /* ---------- Fecho e evolução ---------- */
  const sorted = (snaps) => [...snaps].filter((s) => isMonth(s.id)).sort((a, b) => a.id.localeCompare(b.id));

  /** Totais de um fecho. Contas arquivadas continuam a contar nos meses em que tinham valor. */
  function totals(snap) {
    const assets = round2(Object.values(snap?.values || {}).reduce((n, v) => n + num(v), 0));
    const debt = round2(Object.values(snap?.debts || {}).reduce((n, v) => n + num(v), 0));
    return { assets, debt, net: round2(assets - debt) };
  }

  /** Série mês a mês: [{ month, assets, debt, net, change }] (change = variação do líquido face ao fecho anterior). */
  function series(snaps = []) {
    let prev = null;
    return sorted(snaps).map((s) => {
      const t = totals(s);
      const row = { month: s.id, ...t, change: prev ? round2(t.net - prev.net) : null };
      prev = t;
      return row;
    });
  }

  /** Resumo para o topo: último fecho, variação mensal e anual, média, melhor e pior mês. */
  function summary(snaps = []) {
    const ser = series(snaps);
    if (!ser.length) return null;
    const last = ser[ser.length - 1];
    const prev = ser.length > 1 ? ser[ser.length - 2] : null;
    const yearAgo = ser.find((r) => r.month === addMonths(last.month, -12)) || null;
    const changes = ser.filter((r) => r.change != null);
    // Média por mês entre o primeiro e o último fecho (conta com meses sem fecho pelo meio).
    const span = monthsBetween(ser[0].month, last.month);
    const avg = span > 0 ? round2((last.net - ser[0].net) / span) : null;
    const best = changes.length ? changes.reduce((a, b) => (b.change > a.change ? b : a)) : null;
    const worst = changes.length ? changes.reduce((a, b) => (b.change < a.change ? b : a)) : null;
    return {
      last, prev, yearAgo,
      monthDelta: prev ? round2(last.net - prev.net) : null,
      yearDelta: yearAgo ? round2(last.net - yearAgo.net) : null,
      avg, best, worst, months: ser.length,
    };
  }

  /** Por conta: valor no último fecho e variação face ao anterior. */
  function accountRows(accounts = [], snaps = []) {
    const ser = sorted(snaps);
    const last = ser[ser.length - 1];
    const prev = ser[ser.length - 2];
    return accounts.filter((a) => !a.archived || (last && a.id in (last.values || {}))).map((a) => {
      const v = last && a.id in (last.values || {}) ? num(last.values[a.id]) : null;
      const p = prev && a.id in (prev.values || {}) ? num(prev.values[a.id]) : null;
      return { account: a, value: v, delta: v != null && p != null ? round2(v - p) : null };
    });
  }

  /** Totais por tipo de conta no último fecho: [{ kind, label, value }] (maior primeiro). */
  function byKind(accounts = [], snaps = []) {
    const last = sorted(snaps).at(-1);
    if (!last) return [];
    const out = {};
    accounts.forEach((a) => {
      if (!(a.id in (last.values || {}))) return;
      out[a.kind || 'outro'] = round2((out[a.kind || 'outro'] || 0) + num(last.values[a.id]));
    });
    return Object.entries(out).map(([kind, value]) => ({ kind, label: KIND_LABEL[kind] || kind, value })).sort((a, b) => b.value - a.value);
  }

  /** Valores para o formulário do fecho de `month`: o do próprio mês (se já existe) ou o do fecho anterior. */
  function prefill(accounts = [], debts = [], snaps = [], month) {
    const ser = sorted(snaps);
    const own = ser.find((s) => s.id === month);
    const before = [...ser].reverse().find((s) => s.id < month);
    const src = own || before || { values: {}, debts: {} };
    const values = {};
    accounts.filter((a) => !a.archived).forEach((a) => { if (a.id in (src.values || {})) values[a.id] = num(src.values[a.id]); });
    const dv = {};
    debts.filter((d) => !d.archived).forEach((d) => {
      if (d.id in (src.debts || {})) dv[d.id] = num(src.debts[d.id]);
      else if (!own) dv[d.id] = estimateBalance(d, month);
    });
    return { values, debts: dv, existing: !!own, from: own ? month : before?.id || null };
  }

  /* ---------- Dívidas ---------- */
  /** Prestações já pagas até ao fim de `month` (a 1.ª é no mês de início). */
  function paymentsMade(d, month) {
    if (!isMonth(d.start)) return 0;
    const n = monthsBetween(d.start, month) + 1;
    const total = isMonth(d.end) ? monthsBetween(d.start, d.end) + 1 : Infinity;
    return Math.max(0, Math.min(n, total));
  }

  /** Capital em dívida estimado (tabela francesa) quando ainda não há valor do banco. */
  function estimateBalance(d, month) {
    const P = num(d.initial);
    const pay = num(d.payment);
    const n = paymentsMade(d, month);
    if (!P || !pay || !n) return round2(P);
    const r = num(d.rate) / 100 / 12;
    const b = r ? P * (1 + r) ** n - pay * (((1 + r) ** n - 1) / r) : P - pay * n;
    return round2(Math.max(0, b));
  }

  /** Prestações que faltam, a partir do capital em dívida (ou pela data de fim, se existir). */
  function remainingPayments(d, balance, month) {
    if (balance <= 0) return 0;
    if (isMonth(d.end)) return Math.max(0, monthsBetween(month, d.end));
    const pay = num(d.payment);
    if (!pay) return null;
    const r = num(d.rate) / 100 / 12;
    if (!r) return Math.ceil(balance / pay);
    const x = 1 - (r * balance) / pay;
    return x > 0 ? Math.ceil(-Math.log(x) / Math.log(1 + r)) : null; // prestação não chega para os juros
  }

  /**
   * Estado de uma dívida: o capital em dívida vem do último fecho (o valor do banco) ou é estimado.
   * @returns {{ balance, estimated, amortized, pct, paid, interest, made, left, endMonth, history }}
   */
  function debtStatus(d, snaps = [], today) {
    const month = monthOf(today);
    const ser = sorted(snaps);
    const withVal = ser.filter((s) => d.id in (s.debts || {}));
    const lastSnap = withVal.at(-1);
    const balance = lastSnap ? num(lastSnap.debts[d.id]) : estimateBalance(d, month);
    const at = lastSnap ? lastSnap.id : month;
    const initial = num(d.initial);
    const amortized = round2(Math.max(0, initial - balance));
    const made = paymentsMade(d, at);
    const paid = round2(made * num(d.payment));
    const left = remainingPayments(d, balance, at);
    return {
      balance: round2(balance),
      estimated: !lastSnap,
      asOf: at,
      amortized,
      pct: initial ? Math.min(100, Math.round((amortized / initial) * 100)) : 0,
      made,
      paid,
      interest: paid ? round2(Math.max(0, paid - amortized)) : null,
      left,
      endMonth: left != null ? addMonths(at, left) : null,
      history: withVal.map((s) => ({ month: s.id, balance: num(s.debts[d.id]) })),
    };
  }

  /** Normaliza o que vem do formulário do fecho ("1.234,56" → 1234.56; vazio = não conta). */
  function parseAmount(v) {
    const s = String(v ?? '').trim().replace(/\s|€/g, '');
    if (!s) return null;
    // Com vírgula: vírgula decimal e pontos de milhares ("1.234,56"). Sem vírgula: "2.000" e "1.234.567"
    // são milhares (como se escreve em Portugal); "1234.56" é decimal.
    let norm;
    if (s.includes(',')) norm = s.replace(/\./g, '').replace(',', '.');
    else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) norm = s.replace(/\./g, '');
    else norm = s;
    const n = Number(norm);
    return Number.isFinite(n) ? round2(n) : null;
  }

  root.Patrimonio = {
    KINDS, KIND_LABEL, addMonths, monthsBetween, lastDay, monthName, monthShort, monthOf, pendingClose,
    totals, series, summary, accountRows, byKind, prefill, paymentsMade, estimateBalance, remainingPayments, debtStatus, parseAmount,
  };
})(globalThis);
