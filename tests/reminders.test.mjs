import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeReminders, lisbonNow, occursOn, addDays } from '../supabase/functions/_shared/reminders.js';

const members = [
  { id: 'pai', name: 'Pai', role: 'pai' },
  { id: 'mae', name: 'Mãe', role: 'mae' },
  { id: 'f16', name: 'Marta', role: 'filha', birthday: '2010-03-14' },
  { id: 'f12', name: 'Inês', role: 'filha' },
];
const profiles = [
  { user_id: 'U-pai', member_id: 'pai', role: 'parent' },
  { user_id: 'U-mae', member_id: 'mae', role: 'parent' },
  { user_id: 'U-f16', member_id: 'f16', role: 'child' },
  { user_id: 'U-f12', member_id: 'f12', role: 'child', notify: { tasks: false } },
];
const T = '2026-09-24'; // quinta-feira
const run = (state, date, hhmm, profs = profiles) => {
  const [h, m] = hhmm.split(':').map(Number);
  return computeReminders({ state: { members, ...state }, profiles: profs, now: { date, minutes: h * 60 + m } });
};
const who = (list) => list.map((r) => r.userId).sort();

test('hora de Lisboa, incluindo horário de verão e de inverno', () => {
  assert.deepEqual(lisbonNow(new Date('2026-07-01T12:05:00Z')), { date: '2026-07-01', minutes: 13 * 60 + 5 });
  assert.deepEqual(lisbonNow(new Date('2026-12-01T12:05:00Z')), { date: '2026-12-01', minutes: 12 * 60 + 5 });
  assert.deepEqual(lisbonNow(new Date('2026-07-01T23:30:00Z')), { date: '2026-07-02', minutes: 30 });
});

test('repetições de compromissos', () => {
  const e = { date: '2026-09-03', repeat: 'weekly', until: '2026-10-01' };
  assert.ok(occursOn(e, T));
  assert.ok(!occursOn(e, '2026-09-25'));
  assert.ok(!occursOn(e, '2026-10-08'));
  assert.ok(occursOn({ date: '2026-01-24', repeat: 'monthly' }, T));
  assert.ok(occursOn({ date: '2020-09-24', repeat: 'yearly' }, T));
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
});

test('compromisso: 1 hora antes, só para quem vai e para quem leva, uma vez', () => {
  const state = { events: [{ id: 'e1', title: 'Dentista', date: T, start: '15:00', members: ['f12'], driver: 'mae', location: 'Clínica' }] };
  assert.equal(run(state, T, '13:50').length, 0);
  const r = run(state, T, '14:00');
  assert.deepEqual(who(r), ['U-f12', 'U-mae']);
  assert.match(r.find((x) => x.userId === 'U-mae').body, /És tu quem leva/);
  assert.match(r.find((x) => x.userId === 'U-f12').body, /Hoje às 15:00 · Clínica · 🚗 Mãe leva/);
  assert.equal(run(state, T, '14:20').length, 2, 'ainda na janela: a chave única evita repetição');
  assert.equal(run(state, T, '14:30').length, 0);
  assert.deepEqual(new Set(r.map((x) => x.key)).size, 2);
});

test('compromisso logo a seguir à meia-noite é lembrado na véspera', () => {
  const state = { events: [{ id: 'e2', title: 'Voo', date: addDays(T, 1), start: '00:30', members: ['pai'] }] };
  const r = run(state, T, '23:35');
  assert.equal(r.length, 1);
  assert.match(r[0].body, /Amanhã às 00:30/);
});

test('compromisso sem pessoas avisa toda a família; sem hora avisa às 8h', () => {
  const state = { events: [{ id: 'e3', title: 'Reunião de condomínio', date: T, members: [] }] };
  assert.equal(run(state, T, '08:05').length, 4);
});

test('teste: na véspera às 19h para a aluna e para os pais', () => {
  const state = { exams: [{ id: 'x1', memberId: 'f16', subject: 'Matemática A', kind: 'Teste', date: addDays(T, 1) }] };
  const r = run(state, T, '19:10');
  assert.deepEqual(who(r), ['U-f16', 'U-mae', 'U-pai']);
  assert.match(r.find((x) => x.userId === 'U-f16').body, /Bom estudo/);
});

test('tarefas às 18h, respeitando as preferências', () => {
  const state = {
    tasks: [
      { id: 't1', title: 'Lixo', assignee: 'f16', due: T },
      { id: 't2', title: 'Quarto', assignee: 'f16', due: addDays(T, -1) },
      { id: 't3', title: 'Mesa', assignee: 'f12', due: T },
      { id: 't4', title: 'Feita', assignee: 'pai', due: T, done: true },
      { id: 't5', title: 'Pendente', assignee: 'pai', due: T, pending: { by: 'pai', date: T } },
    ],
  };
  const r = run(state, T, '18:00').filter((x) => x.type === 'tasks');
  assert.deepEqual(who(r), ['U-f16'], 'f12 desligou tarefas; feitas e pendentes não contam');
  assert.equal(r[0].title, '✅ Tens 2 tarefas por fazer');
});

test('resumo do dia com aulas, testes e compromissos', () => {
  const state = {
    classes: [{ memberId: 'f12', day: 4, start: '08:30', end: '13:30' }],
    exams: [{ id: 'x2', memberId: 'f12', subject: 'Inglês', kind: 'Ficha', date: T }],
    events: [{ id: 'e4', title: 'Treino', date: '2026-09-17', repeat: 'weekly', start: '18:00', members: ['f12'] }],
  };
  const r = run(state, T, '07:30').filter((x) => x.type === 'digest');
  assert.deepEqual(who(r), ['U-f12']);
  assert.equal(r[0].body, '🎒 Aulas 08:30–13:30 · 📝 Ficha de Inglês · 18:00 Treino');
});

test('aprovações: pais recebem pedidos; filha recebe a resposta', () => {
  const state = {
    tasks: [{ id: 't6', title: 'Loiça', assignee: 'f12', pending: { by: 'f12', date: T } }],
    redemptions: [
      { id: 'r1', memberId: 'f16', title: 'Filme', cost: 15, status: 'pending', date: T },
      { id: 'r2', memberId: 'f12', title: 'Ecrã', cost: 20, status: 'approved', date: T },
      { id: 'r3', memberId: 'f12', title: 'Antigo', cost: 20, status: 'approved', date: addDays(T, -10) },
    ],
  };
  const r = run(state, T, '11:11').filter((x) => x.type === 'approvals');
  assert.deepEqual(r.filter((x) => x.tag.startsWith('ap:')).map((x) => x.userId).sort(), ['U-mae', 'U-mae', 'U-pai', 'U-pai']);
  const reply = r.filter((x) => x.tag.startsWith('rd:'));
  assert.deepEqual(who(reply), ['U-f12']);
  assert.match(reply[0].title, /Aprovado: Ecrã/);
});

test('viagem 7 dias antes e aniversário na véspera', () => {
  const state = {
    trips: [{ id: 'v1', destination: 'Algarve', start: addDays(T, 7), members: ['pai', 'f16'], packing: [{ done: false }] }],
    members: [...members.slice(0, 2), { ...members[2], birthday: '2010-09-25' }, members[3]],
  };
  const r19 = run(state, T, '19:00');
  assert.deepEqual(who(r19.filter((x) => x.type === 'trips')), ['U-f16', 'U-pai']);
  const r20 = run(state, T, '20:00').filter((x) => x.type === 'birthdays');
  assert.deepEqual(who(r20), ['U-f12', 'U-mae', 'U-pai'], 'a aniversariante não recebe');
});

test('resumo da semana só ao domingo', () => {
  const sunday = '2026-09-27';
  const state = { exams: [{ id: 'x3', memberId: 'f16', subject: 'Física', kind: 'Teste', date: '2026-09-29' }] };
  assert.equal(run(state, T, '20:00').filter((x) => x.type === 'weekly').length, 0);
  const r = run(state, sunday, '20:00').filter((x) => x.type === 'weekly');
  assert.deepEqual(who(r), ['U-f16', 'U-mae', 'U-pai']);
  assert.match(r[0].body, /Física \(terça\)/);
});
