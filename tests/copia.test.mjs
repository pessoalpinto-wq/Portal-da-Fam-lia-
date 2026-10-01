import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../js/copia.js';

const C = globalThis.Copia;
const state = {
  version: 1, currentUser: 'pai',
  members: [{ id: 'pai', name: 'Luís' }, { id: 'l', name: 'Luísa' }],
  tasks: [{ id: 't1', title: 'Lixo' }], shopping: [], bills: [{ id: 'b1', title: 'Luz' }],
  meals: { 1: { lunch: 'Sopa' }, 2: {} },
};

test('criar e ler a cópia (ida e volta)', () => {
  const b = C.build(state, { family: 'Família Pinto', by: 'Luís', now: new Date('2026-10-01T10:00:00Z') });
  assert.equal(b.format, 'portal-familia-copia');
  assert.equal(C.fileName(new Date('2026-10-01T10:00:00Z')), 'portal-familia-2026-10-01.json');
  const r = C.parse(JSON.stringify(b));
  assert.equal(r.family, 'Família Pinto');
  assert.deepEqual(r.data.tasks, state.tasks);
  assert.deepEqual(r.data.meals, state.meals);
  assert.equal('currentUser' in r.data, false);
});

test('lê o formato antigo e recusa ficheiros que não são cópias', () => {
  assert.deepEqual(C.parse(JSON.stringify(state)).data.members, state.members);
  assert.throws(() => C.parse('olá'), /não é JSON/);
  assert.throws(() => C.parse('{"a":1}'), /não é uma cópia/);
  assert.throws(() => C.parse(JSON.stringify({ format: 'portal-familia-copia', version: 99, data: { members: [] } })), /mais recente/);
});

test('resumo e diferenças antes de repor', () => {
  const s = C.summary(C.build(state).data);
  assert.deepEqual(s.map((x) => [x.coll, x.n]), [['members', 2], ['tasks', 1], ['bills', 1], ['meals', 1]]);
  const now = { ...state, tasks: [{ id: 't1', title: 'Lixo e reciclagem' }, { id: 't2', title: 'Nova' }], bills: [] };
  assert.deepEqual(C.diff(now, C.build(state).data), { added: 1, changed: 1, removed: 1 });
  assert.equal(C.sameFamily(now, state), true);
  assert.equal(C.sameFamily(now, { members: [{ id: 'outro' }] }), false);
  assert.equal(C.daysSince('2026-09-01T10:00:00Z', new Date('2026-10-01T10:00:00Z')), 30);
  assert.equal(C.daysSince(''), null);
});
