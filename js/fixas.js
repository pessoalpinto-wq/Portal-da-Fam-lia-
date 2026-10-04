/*
 * Despesas fixas: as "Contas da casa" que se repetem (mensais, trimestrais, semestrais, anuais…).
 * Quanto custam por mês e por ano, como aparecem no extrato (campo "match"), que movimentos são fixos
 * e marcar como paga sozinha quando o pagamento aparece num extrato importado.
 * Script "clássico": define globalThis.Fixas. Usa globalThis.Orcamento (matchesRule) se existir.
 * Testado em tests/fixas.test.mjs.
 */
(function (root) {
  const PERIODS = { monthly: 1, bimonthly: 2, quarterly: 3, semiannual: 6, yearly: 12 };
  const LABEL = { monthly: 'mensal', bimonthly: 'de 2 em 2 meses', quarterly: 'trimestral', semiannual: 'semestral', yearly: 'anual', none: 'só uma vez' };
  const GROUP = { monthly: 'Mensais', bimonthly: 'De 2 em 2 meses', quarterly: 'Trimestrais', semiannual: 'Semestrais', yearly: 'Anuais' };
  const r2 = (n) => Math.round(n * 100) / 100;
  const isFixed = (b) => !!b && !b.archived && !!PERIODS[b.repeat];
  const perMonth = (b) => (isFixed(b) ? r2((Number(b.amount) || 0) / PERIODS[b.repeat]) : 0);
  const perYear = (b) => (isFixed(b) ? r2(((Number(b.amount) || 0) * 12) / PERIODS[b.repeat]) : 0);

  // Categoria das contas da casa → categoria do orçamento (para o movimento e para agrupar).
  const BILL_TO_BUDGET = { Casa: 'casa', Carro: 'carro', Seguros: 'seguros', Escola: 'educacao', Saúde: 'saude', Impostos: 'impostos', Subscrições: 'subscricoes', Outro: 'outros' };
  const BUDGET_TO_BILL = { casa: 'Casa', contas: 'Casa', carro: 'Carro', seguros: 'Seguros', educacao: 'Escola', saude: 'Saúde', impostos: 'Impostos', subscricoes: 'Subscrições', credito: 'Outro' };

  /**
   * Resumo das despesas fixas: total por mês (equivalente) e por ano, por frequência e por categoria.
   * @returns {{ month, year, count, groups: [{ repeat, label, items, perMonth, total }], byCategory: [{ category, perMonth }] }}
   */
  function summary(bills = []) {
    const fixed = bills.filter(isFixed);
    const groups = Object.keys(PERIODS).map((repeat) => {
      const items = fixed.filter((b) => b.repeat === repeat).sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0));
      return { repeat, label: GROUP[repeat], items, total: r2(items.reduce((n, b) => n + (Number(b.amount) || 0), 0)), perMonth: r2(items.reduce((n, b) => n + perMonth(b), 0)) };
    }).filter((g) => g.items.length);
    const cats = {};
    fixed.forEach((b) => { const c = b.category || 'Outro'; cats[c] = r2((cats[c] || 0) + perMonth(b)); });
    const month = r2(fixed.reduce((n, b) => n + perMonth(b), 0));
    return {
      month, year: r2(fixed.reduce((n, b) => n + perYear(b), 0)), count: fixed.length, groups,
      byCategory: Object.entries(cats).map(([category, v]) => ({ category, perMonth: v })).sort((a, b) => b.perMonth - a.perMonth),
    };
  }

  const matches = (desc, match) => (root.Orcamento ? root.Orcamento.matchesRule(desc, match)
    : String(desc || '').toLowerCase().includes(String(match || '').toLowerCase()));

  /** A despesa fixa (conta da casa) a que pertence um movimento, ou null. Só despesas (valores negativos). */
  function billFor(tx, bills = []) {
    if (!tx || !(Number(tx.amount) < 0)) return null;
    return bills.filter((b) => !b.archived && b.match && matches(tx.desc, b.match))
      .sort((a, b) => String(b.match).length - String(a.match).length)[0] || null;
  }

  /** Num mês: quanto foi gasto em despesas fixas e quanto em variáveis (só despesas, sem transferências/poupança). */
  function monthSplit(txs = [], bills = [], month, kindOf = () => 'expense') {
    let fixed = 0;
    let variable = 0;
    txs.filter((t) => String(t.date).startsWith(month) && kindOf(t.cat) === 'expense').forEach((t) => {
      const v = -Number(t.amount || 0);
      if (t.fixed || billFor(t, bills)) fixed += v; else variable += v;
    });
    return { fixed: r2(fixed), variable: r2(variable) };
  }

  const dayNum = (iso) => Date.parse(`${iso}T00:00:00Z`) / 86400000;
  function addMonths(iso, n) {
    const [y, m, d] = iso.split('-').map(Number);
    const t = new Date(Date.UTC(y, m - 1 + n, 1));
    const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
    return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
  }

  /**
   * Pagamentos que aparecem nos movimentos novos: marca a conta como paga (histórico + próxima data).
   * Só conta um movimento a até 12 dias da data prevista (antes ou depois), e cada vencimento uma só vez.
   * @returns {Array<{ billId, txId, date, amount, forDue, nextDue, changed }>} changed = o valor mudou
   */
  function autoPay(bills = [], newTxs = []) {
    const out = [];
    const state = new Map(bills.map((b) => [b.id, { due: b.due, history: [...(b.history || [])] }]));
    [...newTxs].sort((a, b) => a.date.localeCompare(b.date)).forEach((t) => {
      const b = billFor(t, bills);
      if (!b || !b.due) return;
      const st = state.get(b.id);
      if (Math.abs(dayNum(t.date) - dayNum(st.due)) > 12) return;
      if (st.history.some((h) => h.forDue === st.due || h.tx === t.id)) return;
      const amount = r2(-Number(t.amount));
      const nextDue = PERIODS[b.repeat] ? addMonths(st.due, PERIODS[b.repeat]) : st.due;
      out.push({ billId: b.id, txId: t.id, date: t.date, amount, forDue: st.due, nextDue, changed: Math.abs(amount - (Number(b.amount) || 0)) >= 0.01 });
      st.history.push({ forDue: st.due, tx: t.id });
      st.due = nextDue;
    });
    return out;
  }

  root.Fixas = { PERIODS, LABEL, GROUP, BILL_TO_BUDGET, BUDGET_TO_BILL, isFixed, perMonth, perYear, summary, billFor, monthSplit, autoPay, addMonths };
})(globalThis);
