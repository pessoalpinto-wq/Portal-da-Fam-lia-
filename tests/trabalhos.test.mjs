import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../js/trabalhos.js';

const T = globalThis.Trabalhos;
const jobs = [
  { id: '1', kind: 'arda', client: 'Câmara de Santo Tirso', status: 'pago', value: 800, quoteDate: '2026-01-10', paidDate: '2026-02-20' },
  { id: '2', kind: 'spda', client: 'Fábrica X', status: 'pago', value: 1500, vat: 23, withholding: 25, quoteDate: '2026-03-01', paidDate: '2026-04-15' },
  { id: '3', kind: 'formacao', client: 'Centro de Formação Y', status: 'pago', value: 600, hours: 20, paidDate: '2026-05-30' },
  { id: '4', kind: 'formacao', client: 'Centro de Formação Y', status: 'pago', value: 450, hours: 15, paidDate: '2026-10-02' },
  { id: '5', kind: 'auditoria', client: 'Hotel Z', status: 'faturado', value: 700, quoteDate: '2026-09-01' },
  { id: '6', kind: 'spda', client: 'Escola W', status: 'adjudicado', value: 1200, quoteDate: '2026-09-15' },
  { id: '7', kind: 'arda', client: 'Condomínio K', status: 'orcamento', value: 350, quoteDate: '2026-08-01' },
  { id: '8', kind: 'auditoria', client: 'Loja Q', status: 'recusado', value: 900, quoteDate: '2026-06-01' },
  { id: '9', kind: 'arda', client: 'Velho', status: 'pago', value: 500, paidDate: '2025-12-20', quoteDate: '2025-11-01' },
];

test('valores: base sem IVA, IVA, retenção e o que entra na conta', () => {
  assert.deepEqual(T.amounts(jobs[1]), { base: 1500, vat: 345, withheld: 375, total: 1845, received: 1470 });
  assert.deepEqual(T.amounts(jobs[0]), { base: 800, vat: 0, withheld: 0, total: 800, received: 800 });
  assert.equal(T.amounts({ value: 100, paidValue: 95 }).received, 95); // recebido diferente (comissão do banco…)
});

test('resumo do ano: ganho (pago no ano), por receber, orçamentos e taxa de adjudicação', () => {
  const s = T.yearSummary(jobs, 2026);
  assert.equal(s.earned, 3350); // 800 + 1500 + 600 + 450 (o de 2025 não conta)
  assert.equal(s.received, 3320); // 1470 em vez de 1500 no SPDA
  assert.equal(s.withheld, 375);
  assert.equal(s.vat, 345);
  assert.equal(s.paidCount, 4);
  assert.deepEqual([s.pending, s.pendingCount], [1900, 2]);
  assert.deepEqual([s.openQuotes, s.openQuotesValue], [1, 350]);
  // Orçamentos de 2026 decididos: 1, 2, 5, 6 ganhos, 8 recusado → 4/5 = 80%.
  assert.deepEqual([s.decided, s.wonCount, s.rate], [5, 4, 80]);
  assert.deepEqual(s.byKind.map((x) => [x.key, x.value]), [['spda', 1500], ['formacao', 1050], ['arda', 800]]);
  assert.deepEqual(s.byClient[0], { key: 'Fábrica X', value: 1500 });
  assert.equal(s.months[1], 800);
  assert.equal(s.months[9], 450);
  assert.deepEqual([s.hours, s.perHour], [35, 30]);
});

test('anos e orçamentos esquecidos', () => {
  assert.deepEqual(T.years(jobs, '2026-10-18'), ['2026', '2025']);
  assert.deepEqual(T.staleQuotes(jobs, '2026-10-18', 30).map((j) => j.id), ['7']);
});
