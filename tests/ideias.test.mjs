import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../js/ideias.js';

const I = globalThis.Ideias;

test('limpa a "ordem" do início e põe maiúscula', () => {
  assert.equal(I.clean('nova ideia: fazer uma horta na varanda'), 'Fazer uma horta na varanda');
  assert.equal(I.clean('Tenho uma ideia, ir a Sevilha na Páscoa'), 'Ir a Sevilha na Páscoa');
  assert.equal(I.clean('toma nota que o carro precisa de pneus'), 'O carro precisa de pneus');
  assert.equal(I.clean('Lembrar-me de ligar ao canalizador'), 'Ligar ao canalizador');
  assert.equal(I.clean('ok ideia comprar um desumidificador'), 'Comprar um desumidificador');
  assert.equal(I.clean('  pintar   o quarto\n\n  da Luísa  '), 'Pintar o quarto\nda Luísa');
  assert.equal(I.clean('Ideias para o Natal'), 'Ideias para o Natal');
  assert.equal(I.clean('Nota'), 'Nota');
  assert.equal(I.clean(''), '');
});

test('cria a ideia com dia, hora e autor', () => {
  const now = new Date(2026, 10, 7, 21, 5);
  assert.deepEqual(I.create('ideia: fazer pão em casa', { id: 'x1', by: 'pai', now, source: 'voz' }), {
    id: 'x1', by: 'pai', text: 'Fazer pão em casa', date: '2026-11-07', time: '21:05', source: 'voz', done: false, shared: false,
  });
});

test('cada um só vê as suas ideias e as partilhadas', () => {
  const list = [{ id: 1, by: 'pai' }, { id: 2, by: 'mae' }, { id: 3, by: 'mae', shared: true }];
  assert.deepEqual(I.visible(list, 'pai').map((i) => i.id), [1, 3]);
  assert.deepEqual(I.visible(list, 'mae').map((i) => i.id), [2, 3]);
});

test('agrupa por dia, da mais recente para a mais antiga', () => {
  const list = [
    { id: 'a', date: '2026-11-07', time: '08:00' }, { id: 'b', date: '2026-11-07', time: '22:10' },
    { id: 'c', date: '2026-11-06', time: '12:00' }, { id: 'd', date: '2026-11-02' }, { id: 'e', date: '2026-10-01' },
  ];
  assert.deepEqual(I.groups(list, '2026-11-07').map(([k, l]) => [k, l.map((i) => i.id)]), [
    ['Hoje', ['b', 'a']], ['Ontem', ['c']], ['Últimos 7 dias', ['d']], ['Mais antigas', ['e']],
  ]);
});

test('ideia → tarefa: primeira frase no título, o resto nas notas', () => {
  assert.deepEqual(I.toTask({ text: 'Marcar revisão do carro. Perguntar também pelos travões' }),
    { title: 'Marcar revisão do carro', notes: 'Perguntar também pelos travões' });
  assert.deepEqual(I.toTask({ text: 'Comprar prenda para a avó\nalgo para o jardim' }),
    { title: 'Comprar prenda para a avó', notes: 'algo para o jardim' });
  const long = I.toTask({ text: 'Organizar um fim-de-semana em família na serra da Estrela com caminhadas e um jantar num restaurante típico' });
  assert.ok(long.title.length <= 81 && long.title.endsWith('…'));
  assert.ok(long.notes.length > 0);
});

test('texto partilhado de outra app vira ideia (links não: são receitas)', () => {
  const p = (o) => I.fromShare(new URLSearchParams(o));
  assert.equal(p({ text: 'Ver o documentário sobre o Alentejo' }), 'Ver o documentário sobre o Alentejo');
  assert.equal(p({ title: 'Lista', text: 'Pilhas e lâmpadas' }), 'Lista\nPilhas e lâmpadas');
  assert.equal(p({ url: 'https://receitas.pt/bolo' }), null);
  assert.equal(p({ text: 'olha isto https://exemplo.pt' }), null);
  assert.equal(p({}), null);
});
