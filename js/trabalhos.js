/*
 * Trabalhos extra (por conta própria): ARDA, auditorias técnicas, projectos SPDA, formações…
 * Cada trabalho começa como orçamento (pode ou não ser adjudicado), passa a "em curso", "faturado" e "pago".
 * O que conta como ganho de um ano é o que foi PAGO nesse ano (data do pagamento), sem IVA.
 * Script "clássico": define globalThis.Trabalhos. Testado em tests/trabalhos.test.mjs.
 */
(function (root) {
  const KINDS = [
    ['arda', '📋 ARDA'], ['auditoria', '🔍 Auditoria técnica'], ['spda', '⚡ Projeto SPDA'],
    ['formacao', '🎓 Formação'], ['outro', '🧰 Outro'],
  ];
  const KIND = Object.fromEntries(KINDS);
  const STATUS = [
    ['orcamento', '📝 Orçamento enviado'], ['adjudicado', '🔧 Adjudicado (em curso)'], ['faturado', '🧾 Faturado (por receber)'],
    ['pago', '💶 Pago'], ['recusado', '❌ Não adjudicado'],
  ];
  const STATUS_LABEL = Object.fromEntries(STATUS);
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const round2 = (n) => Math.round(n * 100) / 100;
  const yearOf = (d) => String(d || '').slice(0, 4);

  /** Valores de um trabalho: base (sem IVA), IVA, retenção na fonte (IRS) e o que entra na conta. */
  function amounts(j) {
    const base = round2(num(j.value));
    const vat = round2((base * num(j.vat)) / 100);
    const withheld = round2((base * num(j.withholding)) / 100);
    const received = j.paidValue != null && j.paidValue !== '' ? round2(num(j.paidValue)) : round2(base + vat - withheld);
    return { base, vat, withheld, total: round2(base + vat), received };
  }

  /** Foi adjudicado (mesmo que já pago)? */
  const won = (j) => ['adjudicado', 'faturado', 'pago'].includes(j.status);
  /** Data a que o orçamento pertence (para a taxa de adjudicação). */
  const quoteYear = (j) => yearOf(j.quoteDate || j.workDate || j.paidDate);

  /**
   * Resumo de um ano.
   * @returns {{ earned, received, withheld, vat, paidCount, pending, pendingCount, openQuotes, openQuotesValue,
   *   decided, wonCount, rate, byKind, byClient, months, hours, perHour }}
   */
  function yearSummary(jobs = [], year) {
    const y = String(year);
    const paid = jobs.filter((j) => j.status === 'pago' && yearOf(j.paidDate) === y);
    const sum = (list, k) => round2(list.reduce((n, j) => n + amounts(j)[k], 0));
    const pend = jobs.filter((j) => j.status === 'faturado' || j.status === 'adjudicado');
    const open = jobs.filter((j) => j.status === 'orcamento');
    const quoted = jobs.filter((j) => quoteYear(j) === y && (j.quoteDate || j.status === 'recusado'));
    const decided = quoted.filter((j) => j.status !== 'orcamento');
    const wonCount = decided.filter(won).length;
    const group = (key) => {
      const m = new Map();
      paid.forEach((j) => { const k = key(j) || '—'; m.set(k, round2((m.get(k) || 0) + amounts(j).base)); });
      return [...m.entries()].map(([k, v]) => ({ key: k, value: v })).sort((a, b) => b.value - a.value);
    };
    const months = Array.from({ length: 12 }, (_, i) => sum(paid.filter((j) => Number(String(j.paidDate).slice(5, 7)) === i + 1), 'base'));
    const train = paid.filter((j) => j.kind === 'formacao' && num(j.hours) > 0);
    const hours = round2(train.reduce((n, j) => n + num(j.hours), 0));
    return {
      earned: sum(paid, 'base'), received: sum(paid, 'received'), withheld: sum(paid, 'withheld'), vat: sum(paid, 'vat'),
      paidCount: paid.length,
      pending: sum(pend, 'base'), pendingCount: pend.length,
      openQuotes: open.length, openQuotesValue: sum(open, 'base'),
      decided: decided.length, wonCount, rate: decided.length ? Math.round((wonCount / decided.length) * 100) : null,
      byKind: group((j) => j.kind || 'outro'), byClient: group((j) => String(j.client || '').trim()),
      months, hours, perHour: hours ? round2(sum(train, 'base') / hours) : null,
    };
  }

  /** Anos com trabalhos (para escolher), do mais recente para o mais antigo; inclui sempre o actual. */
  function years(jobs = [], today) {
    const set = new Set([yearOf(today)]);
    jobs.forEach((j) => [j.paidDate, j.quoteDate, j.workDate].forEach((d) => { if (/^\d{4}/.test(String(d || ''))) set.add(yearOf(d)); }));
    return [...set].sort().reverse();
  }

  /** Orçamentos à espera de resposta há mais de `days` dias (para lembrar de perguntar). */
  function staleQuotes(jobs = [], today, days = 30) {
    const lim = new Date(Date.parse(`${today}T00:00:00Z`) - days * 86400000).toISOString().slice(0, 10);
    return jobs.filter((j) => j.status === 'orcamento' && j.quoteDate && j.quoteDate <= lim);
  }

  root.Trabalhos = { KINDS, KIND, STATUS, STATUS_LABEL, amounts, won, yearSummary, years, staleQuotes };
})(globalThis);
