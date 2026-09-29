import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../js/ingredients.js';
import '../js/despensa.js';

const D = globalThis.Despensa;
const T = '2026-09-29';

test('validade: passou, hoje, a acabar e ok', () => {
  assert.deepEqual(D.expiry({ expires: '2026-09-27' }, T), { days: -2, level: 'expired' });
  assert.deepEqual(D.expiry({ expires: T }, T), { days: 0, level: 'today' });
  assert.deepEqual(D.expiry({ expires: '2026-10-02' }, T), { days: 3, level: 'soon' });
  assert.deepEqual(D.expiry({ expires: '2026-10-03' }, T), { days: 4, level: 'ok' });
  assert.equal(D.expiry({ name: 'Arroz' }, T), null);
});

test('despensa dividida: atenção ao prazo, a acabar e o resto', () => {
  const pantry = [
    { name: 'Arroz' },
    { name: 'Iogurtes', expires: '2026-09-30' },
    { name: 'Azeite', low: true },
    { name: 'Fiambre', expires: '2026-09-28', low: true }, // passou: fica em "atenção", não em "a acabar"
    { name: 'Queijo', expires: '2026-10-20' },
  ];
  const g = D.groups(pantry, T);
  assert.deepEqual(g.attention.map((p) => p.name), ['Fiambre', 'Iogurtes']);
  assert.deepEqual(g.low.map((p) => p.name), ['Azeite']);
  assert.deepEqual(g.rest.map((p) => p.name), ['Arroz', 'Queijo']);
});

test('receitas para aproveitar o que está a acabar o prazo', () => {
  const I = globalThis.Ingredients;
  const recipes = [
    { title: 'Salada de frango', ingredients: ['1 alface', '200 g de frango', '1 iogurte natural'] },
    { title: 'Tosta mista', ingredients: ['2 fatias de pão', '2 fatias de fiambre', 'queijo'] },
    { title: 'Arroz de pato', ingredients: ['pato', 'arroz'] },
  ];
  const items = [{ name: 'Fiambre', key: I.key('Fiambre') }, { name: 'Queijo', key: I.key('Queijo') }];
  const r = D.recipesUsing(items, recipes, I);
  assert.deepEqual(r.map((x) => [x.recipe.title, x.uses.map((u) => u.name)]), [['Tosta mista', ['Fiambre', 'Queijo']]]);
  assert.deepEqual(D.recipesUsing([], recipes, I), []);
});

test('texto da validade', () => {
  const L = (x) => D.label(D.expiry({ expires: x }, T), x);
  assert.equal(L('2026-09-26'), 'passou há 3 dias');
  assert.equal(L('2026-09-28'), 'passou ontem');
  assert.equal(L(T), 'acaba hoje');
  assert.equal(L('2026-09-30'), 'acaba amanhã');
  assert.equal(L('2026-10-02'), 'acaba em 3 dias');
  assert.equal(L('2026-10-12'), 'até 12/10');
  assert.equal(D.label(null), '');
});

test('a acabar: só os que ainda não estão na lista de compras', () => {
  const I = globalThis.Ingredients;
  const pantry = ['Azeite', 'Arroz', 'Leite', 'Sal'].map((n, i) => ({ name: n, key: I.key(n), low: i < 3 }));
  const shopping = [{ text: 'Azeite virgem extra', done: false }, { text: 'Leite', done: true }];
  assert.deepEqual(D.toBuy(pantry, shopping, I).map((p) => p.name), ['Arroz', 'Leite']);
});

test('receitas: primeiro as do produto mais urgente e as da família', () => {
  const I = globalThis.Ingredients;
  const recipes = [
    { title: 'A queijada', builtin: true, ingredients: ['queijo'] },
    { title: 'Bolo de iogurte', builtin: true, ingredients: ['1 iogurte'] },
    { title: 'Z tosta da família', ingredients: ['queijo'] },
  ];
  const items = ['Iogurte', 'Queijo'].map((n) => ({ name: n, key: I.key(n) }));
  assert.deepEqual(D.recipesUsing(items, recipes, I).map((x) => x.recipe.title), ['Bolo de iogurte', 'Z tosta da família', 'A queijada']);
});

test('receitas: pelo menos uma para cada produto', () => {
  const I = globalThis.Ingredients;
  const recipes = ['A', 'B', 'C'].map((t) => ({ title: `${t} com iogurte`, builtin: true, ingredients: ['iogurte'] }))
    .concat({ title: 'Z com queijo', builtin: true, ingredients: ['queijo'] });
  const items = ['Iogurte', 'Queijo'].map((n) => ({ name: n, key: I.key(n) }));
  assert.deepEqual(D.recipesUsing(items, recipes, I, 2).map((x) => x.recipe.title), ['A com iogurte', 'Z com queijo']);
});
