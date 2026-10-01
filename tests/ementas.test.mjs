import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../js/ementas.js';

const E = globalThis.Ementas;
// 2026-10-01 é quinta-feira (4); a semana começa a 2026-09-28.
const T = '2026-10-01';

test('semana e dias', () => {
  assert.equal(E.weekStart(T), '2026-09-28');
  assert.equal(E.weekStart('2026-10-04'), '2026-09-28'); // domingo
  assert.equal(E.dateOf('2026-09-28', 0), '2026-10-04');
  assert.equal(E.dateOf('2026-09-28', 1), '2026-09-28');
});

test('regista hoje e os dias passados sem registo; nunca o futuro', () => {
  const meals = { 1: { lunch: 'Sopa' }, 4: { dinner: 'Bacalhau', dinnerRecipe: 'r1' }, 6: { lunch: 'Pizza' } };
  const [w] = E.record([], meals, T);
  assert.equal(w.id, '2026-09-28');
  assert.deepEqual(w.days, { 1: { lunch: 'Sopa' }, 4: { dinner: 'Bacalhau', dinnerRecipe: 'r1' } });
  // Sem mudanças: nada a gravar.
  assert.deepEqual(E.record([w], meals, T), []);
});

test('planear a semana seguinte não estraga os dias que já passaram', () => {
  const hist = [{ id: '2026-09-28', days: { 1: { lunch: 'Sopa' }, 4: { dinner: 'Bacalhau' } } }];
  // Hoje (quinta) mudam o jantar de hoje e, já a pensar na próxima semana, a segunda-feira.
  const [w] = E.record(hist, { 1: { lunch: 'Lasanha' }, 4: { dinner: 'Omelete' } }, T);
  assert.deepEqual(w.days, { 1: { lunch: 'Sopa' }, 4: { dinner: 'Omelete' } });
  // Limpar a semana não apaga nada.
  assert.deepEqual(E.record(hist, {}, T), []);
});

test('receitas recentes, semanas anteriores e pratos mais repetidos', () => {
  const hist = [
    { id: '2026-09-21', days: { 1: { lunch: 'Bacalhau com natas', lunchRecipe: 'r1' }, 3: { dinner: 'Sopa' } } },
    { id: '2026-09-14', days: { 2: { dinner: 'bacalhau com natas', dinnerRecipe: 'r1' }, 5: { lunch: 'Arroz de pato', lunchRecipe: 'r2' } } },
    { id: '2026-08-31', days: { 2: { dinner: 'Lasanha', dinnerRecipe: 'r9' } } },
    { id: '2026-09-28', days: { 1: { lunch: 'Hoje', lunchRecipe: 'r5' } } },
  ];
  assert.deepEqual([...E.recentRecipes(hist, T)].sort(), ['r1', 'r2']);
  assert.deepEqual(E.pastWeeks(hist, T).map((w) => w.id), ['2026-09-21', '2026-09-14', '2026-08-31']);
  assert.deepEqual(E.topDishes(hist), [{ name: 'Bacalhau com natas', n: 2 }]);
});
