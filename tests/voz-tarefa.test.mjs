import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../js/voz-tarefa.js';

const V = globalThis.VozTarefa;
const members = [
  { id: 'pai', name: 'Luís', role: 'pai' }, { id: 'mae', name: 'Cátia', role: 'mae' },
  { id: 'mari', name: 'Mariana', role: 'filha' }, { id: 'lu', name: 'Luísa', role: 'filha' },
];
const ctx = { members, today: '2026-10-06', me: 'mae' }; // terça-feira
const p = (s) => { const r = V.parse(s, ctx); delete r.heard; return r; };

test('responsável, data, pontos e categoria', () => {
  assert.deepEqual(p('Mariana arrumar o quarto amanhã, 5 pontos'),
    { title: 'Arrumar o quarto', assignee: 'mari', due: '2026-10-07', points: 5, category: 'Quarto' });
  assert.deepEqual(p('Tarefa para a Luísa: pôr a mesa todos os dias, dois pontos'),
    { title: 'Pôr a mesa', assignee: 'lu', repeat: 'daily', points: 2, category: 'Cozinha' });
  assert.deepEqual(p('o pai tem de marcar o dentista até sexta'),
    { title: 'Marcar o dentista', assignee: 'pai', due: '2026-10-09', category: 'Saúde' });
});

test('Luísa não é confundida com Luís; "eu" é quem está a usar o portal', () => {
  assert.equal(p('Luísa estudar matemática').assignee, 'lu');
  assert.equal(p('Luís levar o carro à revisão').assignee, 'pai');
  assert.deepEqual(p('eu tenho de ligar à avó hoje'), { title: 'Ligar à avó', assignee: 'mae', due: '2026-10-06', category: 'Recados' });
});

test('repetições e datas ditas de várias formas', () => {
  assert.deepEqual(p('às segundas a Mariana tira o lixo'), { title: 'Tira o lixo', assignee: 'mari', repeat: 'weekly', due: '2026-10-12', category: 'Casa' });
  assert.equal(p('regar as plantas todas as semanas').repeat, 'weekly');
  assert.equal(p('pagar a renda dia 1').due, '2026-11-01');
  assert.equal(p('renovar o cartão de cidadão a 20 de março').due, '2027-03-20');
  assert.equal(p('limpar a garagem no fim de semana').due, '2026-10-10');
  assert.equal(p('aspirar a sala daqui a 3 dias').due, '2026-10-09');
  assert.equal(p('limpar a garagem no fim de semana').title, 'Limpar a garagem');
});

test('sem nada reconhecido: só o título', () => {
  assert.deepEqual(p('comprar prenda para o aniversário'), { title: 'Comprar prenda para o aniversário', category: 'Recados' });
  assert.deepEqual(p(''), { title: '' });
});
