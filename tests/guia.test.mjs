import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../js/guia.js';

const G = globalThis.Guia;
const members = [
  { id: 'pai', name: 'Luís', role: 'pai' }, { id: 'mae', name: 'Cátia', role: 'mae' },
  { id: 'm', name: 'Mariana', role: 'filha', birthday: '2010-04-20' }, { id: 'l', name: 'Luísa', role: 'filha', birthday: '2014-11-15' },
];
const by = (list) => Object.fromEntries(list.map((x) => [x.id, x]));

test('pais: o que falta para a família ficar a funcionar', () => {
  const st = by(G.steps({ members }, { parent: true, me: 'pai', devices: { pai: 1, mae: 0, m: 0 } }));
  assert.equal(st.contas.done, false);
  assert.match(st.contas.hint, /^Falta Luísa:/);
  assert.match(st.notificacoes.hint, /^Falta Cátia e Mariana:/);
  assert.match(st.nascimento.hint, /^Falta Luís e Cátia/);
  assert.match(st.mesadas.hint, /^Falta Mariana e Luísa/);
  assert.equal(st.costume.done, false);
  assert.equal(st['contas-casa'].done, false);
});

test('os passos riscam-se sozinhos', () => {
  const s = {
    members: members.map((m) => ({ ...m, birthday: m.birthday || '1980-01-01' })),
    allowances: [{ memberId: 'm' }, { memberId: 'l' }],
    classes: [{ memberId: 'm' }, { memberId: 'l' }],
    healthcards: members.map((m) => ({ id: m.id, bloodType: 'A+' })),
    staples: [{}, {}, {}],
    bills: [{ id: 'b' }],
  };
  const st = G.steps(s, { parent: true, me: 'pai', devices: { pai: 1, mae: 2, m: 1, l: 1 } });
  assert.ok(st.every((x) => x.done), st.filter((x) => !x.done).map((x) => x.id).join());
  // Fichas de saúde vazias não contam.
  const empty = by(G.steps({ ...s, healthcards: [{ id: 'pai', allergies: '  ' }] }, { parent: true, me: 'pai', devices: null }));
  assert.equal(empty.saude.done, false);
  // Sem nuvem não há passos de contas / notificações.
  assert.equal(empty.contas, undefined);
});

test('filhas: só os seus passos', () => {
  const st = G.steps({ members, classes: [] }, { parent: false, me: 'l', devices: { l: 0, pai: 1 } });
  assert.deepEqual(st.map((x) => x.id), ['notificacoes', 'escola']);
  const ok = G.steps({ members, classes: [{ memberId: 'l' }] }, { parent: false, me: 'l', devices: { l: 1 } });
  assert.ok(ok.every((x) => x.done));
});
