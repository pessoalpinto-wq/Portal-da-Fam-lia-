import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../js/poupanca.js';

const P = globalThis.Poupanca;
const goal = { id: 'g1', memberId: 'f', title: 'Bicicleta', target: 100 };
const base = () => ({
  goals: [goal],
  money: [
    { id: 'a', memberId: 'f', kind: 'mesada', amount: 40, date: '2026-07-05' },
    { id: 'b', memberId: 'f', kind: 'poupanca', goalId: 'g1', amount: -20, date: '2026-07-10' },
    { id: 'c', memberId: 'f', kind: 'poupanca', goalId: 'g1', amount: -10, date: '2026-08-10' },
  ],
  savings: [{ id: 'banco', rate: 5, cap: 1, active: 'sim', since: '2026-07' }],
});

test('carteira e mealheiro: os juros entram só no mealheiro', () => {
  const s = base();
  s.money.push({ id: 'j', memberId: 'f', goalId: 'g1', kind: 'juros', toGoal: true, amount: 1, date: '2026-08-01' });
  assert.equal(P.wallet(s.money, 'f'), 10);
  assert.equal(P.goalSaved(s.money, 'g1'), 31);
  assert.equal(P.goalSaved(s.money, 'g1', '2026-07-31'), 20);
});

test('juros: um pagamento por mês completo, com máximo e ids fixos', () => {
  const s = base();
  const due = P.interestDue(s, '2026-09-25');
  // Julho: 5% de 20 = 1,00 (máx. 1) · Agosto: 5% de 31 = 1,55 → máximo 1,00
  assert.deepEqual(due.map((x) => [x.id, x.amount, x.date]), [
    ['juros-g1-2026-07', 1, '2026-08-01'], ['juros-g1-2026-08', 1, '2026-09-01'],
  ]);
  s.money.push(...due);
  assert.deepEqual(P.interestDue(s, '2026-09-25'), []); // nunca paga duas vezes
  assert.equal(P.interestDue(s, '2026-10-01').length, 1); // Setembro fechou
  s.savings[0].active = 'nao';
  assert.deepEqual(P.interestDue(s, '2026-12-01'), []);
});

test('juros não passam do objectivo', () => {
  const s = base();
  s.goals = [{ ...goal, target: 20.5 }];
  s.savings[0].cap = 0;
  const due = P.interestDue(s, '2026-08-15');
  assert.equal(due[0].amount, 0.5);
});

test('previsão de quando se chega ao objectivo', () => {
  const s = base();
  const p = P.projection(s, goal, '2026-09-25');
  assert.equal(p.perMonth, 10); // 30 € postos nos últimos 90 dias
  assert.ok(p.months > 0 && p.when > '2026-09');
  assert.equal(P.projection({ money: [], goals: [goal] }, goal, '2026-09-25').perMonth, 0);
});

test('semanas seguidas, arredondamentos e medalhas', () => {
  const s = { goals: [goal], money: [
    { memberId: 'f', kind: 'poupanca', goalId: 'g1', amount: -2, date: '2026-09-01' },
    { memberId: 'f', kind: 'poupanca', goalId: 'g1', amount: -0.6, date: '2026-09-09', roundup: true },
    { memberId: 'f', kind: 'poupanca', goalId: 'g1', amount: -8, date: '2026-09-16' },
  ] };
  const st = P.stats(s, 'f', '2026-09-25'); // esta semana ainda sem depósito
  assert.equal(st.weeks, 3);
  assert.equal(st.roundups, 1);
  assert.equal(st.put, 10.6);
  assert.deepEqual(P.medals(st), ['primeiro', 'dez']);
  assert.equal(P.milestone(55, 100), 50);
  assert.equal(P.milestone(10, 100), 0);
  assert.equal(P.milestone(100, 100), 100);
});
