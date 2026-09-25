/*
 * Poupança divertida: Banco dos Pais (juros mensais nos mealheiros), previsão de quando se chega
 * ao objectivo, arredondamentos, semanas seguidas a poupar e medalhas de poupança.
 * Tudo calculado a partir dos movimentos (money). Script "clássico": define globalThis.Poupanca.
 *
 * Convenção dos movimentos: `amount` mexe na carteira (+ entra, − sai). Pôr no mealheiro é
 * uma saída da carteira com goalId. Os juros (toGoal: true) entram directamente no mealheiro,
 * sem passar pela carteira.
 */
(function (root) {
  const DAY = 86400000;
  const iso = (d) => d.toISOString().slice(0, 10);
  const addDays = (s, n) => iso(new Date(Date.parse(`${s}T00:00:00Z`) + n * DAY));
  const addMonths = (ym, n) => {
    const [y, m] = ym.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    return iso(d).slice(0, 7);
  };
  const lastDay = (ym) => addDays(`${addMonths(ym, 1)}-01`, -1);
  const round2 = (n) => Math.round(n * 100) / 100;
  const num = (x) => Number(x) || 0;

  /** Dinheiro na carteira (o que pode gastar). */
  const wallet = (money, memberId) => round2((money || [])
    .filter((x) => x.memberId === memberId && !x.toGoal).reduce((n, x) => n + num(x.amount), 0));

  /** Quanto está num mealheiro (até uma data, inclusive, se indicada). */
  const goalSaved = (money, goalId, until) => round2((money || [])
    .filter((x) => x.goalId === goalId && (!until || (x.date || '') <= until))
    .reduce((n, x) => n + (x.toGoal ? num(x.amount) : -num(x.amount)), 0));

  /* ---------- Banco dos Pais ---------- */
  const bankOn = (bank) => !!bank && bank.active !== false && bank.active !== 'nao' && num(bank.rate) > 0;
  const interestOf = (bank, balance) => (balance > 0 ? Math.min(num(bank.cap) || Infinity, round2((balance * num(bank.rate)) / 100)) : 0);

  /**
   * Juros por pagar: para cada mês completo desde que o banco abriu, cada mealheiro recebe
   * `taxa %` do que tinha no fim do mês (com um máximo por mês). Os ids são fixos
   * (juros-<mealheiro>-<mês>) para nunca pagar duas vezes, mesmo com os dois pais ligados.
   */
  function interestDue(state, today) {
    const bank = (state.savings || []).find((x) => x.id === 'banco');
    if (!bankOn(bank) || !bank.since) return [];
    const money = state.money || [];
    const have = new Set(money.map((x) => x.id));
    const out = [];
    const current = today.slice(0, 7);
    (state.goals || []).forEach((g) => {
      for (let m = bank.since, i = 0; m < current && i < 24; m = addMonths(m, 1), i++) {
        const id = `juros-${g.id}-${m}`;
        if (have.has(id)) continue;
        const end = lastDay(m);
        const bal = goalSaved([...money, ...out], g.id, end);
        const target = num(g.target);
        const room = target ? Math.max(0, target - bal) : Infinity;
        const amount = round2(Math.min(interestOf(bank, bal), room));
        if (amount <= 0) continue;
        out.push({
          id, memberId: g.memberId, goalId: g.id, kind: 'juros', toGoal: true, amount,
          date: `${addMonths(m, 1)}-01`, note: `Juros de ${num(bank.rate)}% (${g.title})`,
        });
      }
    });
    return out;
  }

  /** Previsão: ao ritmo dos últimos 90 dias (mais os juros), quando se chega ao objectivo. */
  function projection(state, g, today) {
    const money = state.money || [];
    const saved = goalSaved(money, g.id);
    const target = num(g.target);
    if (!target || saved >= target) return { done: true, saved, target };
    const from = addDays(today, -90);
    const put = money.filter((x) => x.goalId === g.id && !x.toGoal && x.date > from && x.date <= today)
      .reduce((n, x) => n - num(x.amount), 0);
    const perMonth = put / 3;
    const bank = (state.savings || []).find((x) => x.id === 'banco');
    if (perMonth <= 0) return { done: false, saved, target, perMonth: 0 };
    let bal = saved;
    let months = 0;
    while (bal < target && months < 240) {
      bal += perMonth + (bankOn(bank) ? interestOf(bank, bal) : 0);
      months++;
    }
    return { done: false, saved, target, perMonth: round2(perMonth), months, when: `${addMonths(today.slice(0, 7), months)}` };
  }

  /* ---------- Semanas seguidas e medalhas ---------- */
  const mondayOf = (s) => addDays(s, -((new Date(`${s}T00:00:00Z`).getUTCDay() + 6) % 7));

  function stats(state, memberId, today) {
    const mine = (state.money || []).filter((x) => x.memberId === memberId);
    const deposits = mine.filter((x) => x.kind === 'poupanca');
    const weeks = new Set(deposits.map((x) => mondayOf(x.date)));
    let w = mondayOf(today);
    if (!weeks.has(w)) w = addDays(w, -7); // a semana ainda não acabou
    let streak = 0;
    while (weeks.has(w)) { streak++; w = addDays(w, -7); }
    const goals = (state.goals || []).filter((g) => g.memberId === memberId);
    return {
      deposits: deposits.length,
      put: round2(deposits.reduce((n, x) => n - num(x.amount), 0)),
      roundups: deposits.filter((x) => x.roundup).length,
      interest: round2(mine.filter((x) => x.kind === 'juros').reduce((n, x) => n + num(x.amount), 0)),
      weeks: streak,
      goalsDone: goals.filter((g) => num(g.target) && goalSaved(state.money, g.id) >= num(g.target)).length,
    };
  }

  const MEDALS = [
    ['primeiro', '🐣', 'Primeiro depósito', 'Pôr dinheiro no mealheiro pela 1.ª vez', (s) => s.deposits >= 1],
    ['dez', '🪙', '10 € guardados', 'Juntar 10 € nos mealheiros', (s) => s.put >= 10],
    ['cinquenta', '💶', '50 € guardados', 'Juntar 50 € nos mealheiros', (s) => s.put >= 50],
    ['cem', '💰', '100 € guardados', 'Juntar 100 € nos mealheiros', (s) => s.put >= 100],
    ['semanas4', '🔥', 'Mês poupadinho', 'Poupar 4 semanas seguidas', (s) => s.weeks >= 4],
    ['troco', '🧮', 'Rainha do troco', 'Arredondar 5 gastos para o mealheiro', (s) => s.roundups >= 5],
    ['juros', '🏦', 'Primeiros juros', 'Receber juros do Banco dos Pais', (s) => s.interest > 0],
    ['objectivo', '🏆', 'Objectivo cumprido', 'Encher um mealheiro até ao fim', (s) => s.goalsDone >= 1],
  ].map(([id, emoji, name, desc, test]) => ({ id, emoji, name, desc, test }));

  const medals = (st) => MEDALS.filter((m) => m.test(st)).map((m) => m.id);

  /** Marcos de um mealheiro já atingidos (25, 50, 75, 100 %). */
  const milestone = (saved, target) => (num(target) ? [100, 75, 50, 25].find((p) => saved >= (num(target) * p) / 100) || 0 : 0);

  root.Poupanca = {
    wallet, goalSaved, bankOn, interestOf, interestDue, projection, stats, MEDALS, medals, milestone,
    addMonths, lastDay, round2,
  };
})(globalThis);
