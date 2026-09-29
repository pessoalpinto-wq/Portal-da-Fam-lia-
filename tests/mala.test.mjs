import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../js/mala.js';

const M = globalThis.Mala;
let n = 0;
const uid = () => `i${++n}`;

test('quantidade escrita no texto', () => {
  assert.deepEqual(M.parseLine('3 t-shirts', 1), { qty: 3, text: 't-shirts' });
  assert.deepEqual(M.parseLine('2x Pijama', '1'), { qty: 2, text: 'Pijama' });
  assert.deepEqual(M.parseLine('Protetor solar', '2'), { qty: 2, text: 'Protetor solar' });
  assert.deepEqual(M.parseLine('4 meias', '6'), { qty: 6, text: '4 meias' }); // a caixa da quantidade manda
});

test('quantidades dos modelos conforme as noites', () => {
  assert.equal(M.qtyFor('N', { start: '2026-08-01', end: '2026-08-04' }), 4);
  assert.equal(M.qtyFor('N', { start: '2026-08-01', end: '2026-08-15' }), 7);
  assert.equal(M.qtyFor('N/2', { start: '2026-08-01', end: '2026-08-04' }), 2);
  assert.equal(M.qtyFor('N', { start: '2026-08-01' }), 4); // sem regresso: 3 noites
  assert.equal(M.qtyFor(2, {}), 2);
});

test('copiar de outra viagem: só quem vai, sem repetir, tudo por marcar', () => {
  const old = { id: 'a', packing: [
    { memberId: '', text: 'Protetor solar', qty: 2, done: true },
    { memberId: 'f1', text: 'Fato de banho', qty: 2, done: true },
    { memberId: 'f2', text: 'Chinelos', done: true },
  ] };
  const trip = { id: 'b', packing: [{ memberId: '', text: 'protetor  SOLAR', done: false }] };
  const out = M.itemsToCopy({ trip, trips: [old, trip], source: 'viagem:a', who: ['f1'], uid });
  assert.deepEqual(out.map((x) => [x.memberId, x.text, x.qty, x.done]), [['f1', 'Fato de banho', 2, false]]);
});

test('copiar de um modelo: itens pessoais para cada pessoa escolhida', () => {
  const trip = { id: 'b', start: '2026-08-01', end: '2026-08-03', packing: [] };
  const out = M.itemsToCopy({ trip, trips: [], source: 'modelo:essenciais', who: ['p', 'f1'], uid });
  const essenciais = M.MODELOS.find(([id]) => id === 'essenciais')[2];
  assert.equal(out.length, essenciais.f.length + 2 * essenciais.p.length);
  assert.equal(out.find((x) => x.memberId === 'f1' && x.text === 'T-shirts').qty, 3);
  // Copiar outra vez não duplica.
  trip.packing.push(...out);
  assert.equal(M.itemsToCopy({ trip, trips: [], source: 'modelo:essenciais', who: ['p', 'f1'], uid }).length, 0);
});
