import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../js/patrimonio.js';

const P = globalThis.Patrimonio;
const acc = [
  { id: 'a', name: 'CGD ordem', kind: 'ordem' },
  { id: 'b', name: 'Poupança', kind: 'poupanca' },
  { id: 'c', name: 'PPR', kind: 'ppr' },
];
const car = { id: 'car', name: 'Crédito carro', initial: 20000, start: '2025-01', payment: 400, rate: 6, end: '2029-12' };
const snaps = [
  { id: '2026-08', values: { a: 2000, b: 10000, c: 5000 }, debts: { car: 14000 } },
  { id: '2025-09', values: { a: 1500, b: 8000 }, debts: { car: 18000 } },
  { id: '2026-09', values: { a: 2500, b: 10200, c: 5100 }, debts: { car: 13700 } },
];

test('meses: somar, diferença, último dia, nomes', () => {
  assert.equal(P.addMonths('2026-11', 3), '2027-02');
  assert.equal(P.addMonths('2026-01', -1), '2025-12');
  assert.equal(P.monthsBetween('2025-01', '2026-09'), 20);
  assert.equal(P.lastDay('2026-02'), '2026-02-28');
  assert.equal(P.lastDay('2028-02'), '2028-02-29');
  assert.equal(P.monthName('2026-10'), 'outubro 2026');
});

test('que mês fechar: último dia do mês, ou até dia 10 do seguinte', () => {
  assert.equal(P.pendingClose(snaps, '2026-10-31'), '2026-10');
  assert.equal(P.pendingClose(snaps, '2026-10-30'), null); // setembro já fechado; ainda não é o último dia
  assert.equal(P.pendingClose([], '2026-10-04'), '2026-09');
  assert.equal(P.pendingClose(snaps, '2026-10-04'), null);
  assert.equal(P.pendingClose([], '2026-10-15'), null);
  assert.equal(P.pendingClose([{ id: '2026-10' }], '2026-10-31'), null);
});

test('totais e evolução (património líquido = contas − dívidas)', () => {
  assert.deepEqual(P.totals(snaps[2]), { assets: 17800, debt: 13700, net: 4100 });
  const s = P.series(snaps);
  assert.deepEqual(s.map((r) => r.month), ['2025-09', '2026-08', '2026-09']);
  assert.deepEqual(s.map((r) => r.net), [-8500, 3000, 4100]);
  assert.deepEqual(s.map((r) => r.change), [null, 11500, 1100]);
  const sum = P.summary(snaps);
  assert.equal(sum.monthDelta, 1100);
  assert.equal(sum.yearDelta, 12600);
  assert.equal(sum.avg, 1050); // (4100 − (−8500)) / 12 meses
  assert.equal(sum.best.month, '2026-08');
  assert.equal(P.summary([]), null);
});

test('por conta e por tipo; preencher o fecho com o mês anterior', () => {
  const rows = P.accountRows(acc, snaps);
  assert.deepEqual(rows.map((r) => [r.account.id, r.value, r.delta]), [['a', 2500, 500], ['b', 10200, 200], ['c', 5100, 100]]);
  assert.deepEqual(P.byKind(acc, snaps).map((k) => [k.kind, k.value]), [['poupanca', 10200], ['ppr', 5100], ['ordem', 2500]]);
  const f = P.prefill(acc, [car], snaps, '2026-10');
  assert.deepEqual(f.values, { a: 2500, b: 10200, c: 5100 });
  assert.deepEqual(f.debts, { car: 13700 });
  assert.equal(f.existing, false);
  assert.equal(f.from, '2026-09');
  assert.equal(P.prefill(acc, [car], snaps, '2026-09').existing, true);
});

test('dívida: pago até agora, juros, quanto falta e quando acaba', () => {
  const st = P.debtStatus(car, snaps, '2026-10-04');
  assert.equal(st.balance, 13700);
  assert.equal(st.estimated, false);
  assert.equal(st.asOf, '2026-09');
  assert.equal(st.amortized, 6300);
  assert.equal(st.pct, 32);
  assert.equal(st.made, 21); // jan 2025 → set 2026
  assert.equal(st.paid, 8400);
  assert.equal(st.interest, 2100);
  assert.equal(st.left, 39); // até dez 2029
  assert.equal(st.endMonth, '2029-12');
  assert.deepEqual(st.history.map((h) => h.month), ['2025-09', '2026-08', '2026-09']);
});

test('dívida sem valor do banco: estimativa pela tabela francesa; sem data de fim calcula as prestações', () => {
  const d = { id: 'x', initial: 12000, start: '2026-01', payment: 300, rate: 0 };
  assert.equal(P.estimateBalance(d, '2026-04'), 10800);
  const st = P.debtStatus(d, [], '2026-04-10');
  assert.equal(st.estimated, true);
  assert.equal(st.left, 36);
  assert.equal(st.endMonth, '2029-04');
  const withRate = { id: 'y', initial: 10000, start: '2026-01', payment: 200, rate: 5 };
  const b = P.estimateBalance(withRate, '2026-01');
  assert.ok(b > 9840 && b < 9842, String(b)); // 10000·(1+0,05/12) − 200
  assert.equal(P.remainingPayments({ payment: 10, rate: 12 }, 10000, '2026-01'), null); // prestação não paga os juros
});

test('valores escritos à portuguesa', () => {
  assert.equal(P.parseAmount('1.234,56'), 1234.56);
  assert.equal(P.parseAmount('1234,5 €'), 1234.5);
  assert.equal(P.parseAmount('1234.56'), 1234.56);
  assert.equal(P.parseAmount('-50'), -50);
  assert.equal(P.parseAmount('2.000'), 2000); // ponto de milhares, à portuguesa
  assert.equal(P.parseAmount('1.234.567'), 1234567);
  assert.equal(P.parseAmount('10.200,00'), 10200);
  assert.equal(P.parseAmount('12.5'), 12.5);
  assert.equal(P.parseAmount(''), null);
  assert.equal(P.parseAmount('abc'), null);
});
