import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeReminders, computeAllowances, allowanceNotices, addDays } from '../supabase/functions/_shared/reminders.js';

const members = [
  { id: 'pai', name: 'Pai', role: 'pai' }, { id: 'mae', name: 'Mãe', role: 'mae' },
  { id: 'f16', name: 'Marta', role: 'filha' }, { id: 'f12', name: 'Inês', role: 'filha' },
];
const profiles = [
  { user_id: 'U-pai', member_id: 'pai', role: 'parent' }, { user_id: 'U-mae', member_id: 'mae', role: 'parent' },
  { user_id: 'U-f16', member_id: 'f16', role: 'child' }, { user_id: 'U-f12', member_id: 'f12', role: 'child' },
];
const T = '2026-09-24'; // quinta-feira
const run = (state, date, hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return computeReminders({ state: { members, ...state }, profiles, now: { date, minutes: h * 60 + m } });
};
const who = (l) => l.map((r) => r.userId).sort();

test('documento a expirar: 30 dias antes, aos pais e ao dono', () => {
  const state = { docs: [{ id: 'd1', type: 'Cartão de Cidadão', memberId: 'f16', expires: addDays(T, 30) }] };
  const r = run(state, T, '09:05').filter((x) => x.type === 'docs');
  assert.deepEqual(who(r), ['U-f16', 'U-mae', 'U-pai']);
  assert.equal(r[0].title, '🔐 Cartão de Cidadão de Marta expira daqui a 30 dias');
  assert.equal(run({ docs: [{ ...state.docs[0], expires: addDays(T, 29) }] }, T, '09:05').filter((x) => x.type === 'docs').length, 0);
});

test('contas da casa: 3 dias antes, só para os pais', () => {
  const state = { bills: [{ id: 'b1', title: 'Luz', amount: 82.4, due: addDays(T, 3), auto: true }] };
  const r = run(state, T, '09:00').filter((x) => x.type === 'bills');
  assert.deepEqual(who(r), ['U-mae', 'U-pai']);
  assert.equal(r[0].body, '82,40 € · débito directo');
});

test('datas especiais: uma semana e um dia antes, com os anos', () => {
  const state = { dates: [{ id: 's1', title: 'Anos da avó Rosa', date: `1950-${addDays(T, 7).slice(5)}`, gifts: 'livro de receitas' }] };
  const r = run(state, T, '20:00').filter((x) => x.type === 'birthdays');
  assert.equal(r.length, 4);
  assert.equal(r[0].title, '🎉 Daqui a uma semana: Anos da avó Rosa (76 anos)');
  assert.match(r[0].body, /livro de receitas/);
});

test('saúde: próxima vacina na véspera', () => {
  const state = { health: [{ id: 'h1', memberId: 'f12', title: 'Vacina HPV (1.ª dose)', next: addDays(T, 1), nextLabel: 'Vacina HPV (2.ª dose)' }] };
  const r = run(state, T, '19:00').filter((x) => x.type === 'health');
  assert.deepEqual(who(r), ['U-f12', 'U-mae', 'U-pai']);
  assert.equal(r[0].title, '🏥 Amanhã: Vacina HPV (2.ª dose)');
});

test('votação: avisa quem ainda não votou (nem quem criou)', () => {
  const state = { polls: [{ id: 'v1', question: 'Onde vamos no sábado?', createdBy: 'mae', date: T }], votes: [{ pollId: 'v1', memberId: 'f16' }] };
  assert.deepEqual(who(run(state, T, '15:00').filter((x) => x.type === 'polls')), ['U-f12', 'U-pai']);
  assert.equal(run({ polls: [{ ...state.polls[0], closed: true }] }, T, '15:00').filter((x) => x.type === 'polls').length, 0);
});

test('teste: lembrete diz quanto já se estudou', () => {
  const state = { exams: [{ id: 'x1', memberId: 'f16', subject: 'Física', kind: 'Teste', date: addDays(T, 1), topics: [{ done: true }, { done: false }, { done: true }] }] };
  const r = run(state, T, '19:00').find((x) => x.userId === 'U-f16');
  assert.equal(r.body, 'Bom estudo! 💪 · 📚 2/3 tópicos estudados');
});

test('mesadas: semanal ao sábado, mensal no dia certo (ou no último dia do mês), só depois das 9h', () => {
  const state = { allowances: [
    { memberId: 'f12', amount: 5, frequency: 'weekly', day: 6 },
    { memberId: 'f16', amount: 40, frequency: 'monthly', day: 31 },
    { memberId: 'pai', amount: 1, frequency: 'weekly', day: 6, active: false },
  ] };
  const sat = '2026-09-26';
  assert.deepEqual(computeAllowances({ state, now: { date: sat, minutes: 8 * 60 } }), []);
  const r = computeAllowances({ state, now: { date: sat, minutes: 9 * 60 } });
  assert.deepEqual(r.map((x) => x.id), ['allow-f12-2026-09-26']);
  assert.deepEqual(r[0].data, { id: 'allow-f12-2026-09-26', memberId: 'f12', amount: 5, date: sat, kind: 'mesada', note: 'Mesada' });
  assert.deepEqual(computeAllowances({ state, now: { date: '2026-09-30', minutes: 600 } }).map((x) => x.data.memberId), ['f16'], '30 de setembro é o último dia');
  assert.deepEqual(computeAllowances({ state, now: { date: '2026-10-30', minutes: 600 } }), []);
  const n = allowanceNotices(r, profiles);
  assert.deepEqual(who(n), ['U-f12']);
  assert.equal(n[0].title, '💰 Recebeste a mesada: 5,00 €');
});
