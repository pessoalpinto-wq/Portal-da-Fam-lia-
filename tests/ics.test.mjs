import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../supabase/functions/_shared/ics.js';

const { ICS } = globalThis;
const state = {
  members: [{ id: 'pai', name: 'Pai' }, { id: 'f12', name: 'Inês', birthday: '2014-02-10' }],
  events: [
    { id: 'e1', title: 'Treino; sub-13', date: '2026-09-24', start: '18:00', repeat: 'weekly', until: '2026-12-31', members: ['f12'], driver: 'pai', notes: 'Água\nLanche' },
    { id: 'e2', title: 'Só do pai', date: '2026-10-03', start: '09:00', members: ['pai'] },
    { id: 'e3', title: 'Família', date: '2026-10-04', members: [] },
  ],
  exams: [{ id: 'x1', memberId: 'f12', subject: 'Inglês', kind: 'Teste', date: '2026-10-05' }],
  trips: [{ id: 't1', destination: 'Algarve', start: '2026-11-20', end: '2026-11-23', members: ['pai'] }],
  classes: [{ id: 'c1', memberId: 'f12', day: 1, start: '08:30', end: '10:00', subject: 'Matemática' }],
};
const now = new Date('2026-09-24T10:00:00Z');

test('calendar da família inclui tudo, com fuso de Lisboa', () => {
  const out = ICS.build(state, { now });
  assert.ok(out.startsWith('BEGIN:VCALENDAR\r\n') && out.endsWith('END:VCALENDAR\r\n'));
  assert.match(out, /TZID:Europe\/Lisbon/);
  assert.match(out, /DTSTART;TZID=Europe\/Lisbon:20260924T180000/);
  assert.match(out, /DTEND;TZID=Europe\/Lisbon:20260924T190000/, 'sem hora de fim: 1 hora');
  assert.match(out, /RRULE:FREQ=WEEKLY;UNTIL=20261231T235959Z/);
  assert.match(out, /SUMMARY:Treino\\; sub-13/);
  assert.match(out, /DESCRIPTION:Quem vai: Inês\\nQuem leva: Pai\\nÁgua\\nLanche/);
  assert.match(out, /DTSTART;VALUE=DATE:20261120\r\nDTEND;VALUE=DATE:20261124/, 'fim de dia inteiro é exclusivo');
  assert.ok(!out.includes('class-c1'), 'aulas só se pedidas');
  assert.equal((out.match(/BEGIN:VEVENT/g) || []).length, 6, '3 compromissos, 1 teste, 1 viagem, 1 aniversário');
});

test('calendário de uma pessoa só tem o que é dela (e da família toda)', () => {
  const out = ICS.build(state, { memberId: 'f12', includeClasses: true, now });
  assert.ok(out.includes('event-e1') && out.includes('event-e3') && out.includes('class-c1'));
  assert.ok(!out.includes('event-e2') && !out.includes('trip-t1'));
  assert.match(out, /DTSTART;TZID=Europe\/Lisbon:20260921T083000/, 'aula de segunda na semana actual');
});

test('linhas nunca passam de 75 octetos', () => {
  const long = { ...state, exams: [{ id: 'x2', memberId: 'f12', subject: 'Português', kind: 'Teste', date: '2026-10-05', notes: 'ção '.repeat(60) + '📚'.repeat(30) }] };
  const out = ICS.build(long, { now });
  out.split('\r\n').forEach((l) => assert.ok(new TextEncoder().encode(l).length <= 75, l));
  assert.ok(out.includes('\r\n '), 'dobrou linhas');
});

test('datas especiais, documentos e saúde entram no calendário', () => {
  const out = ICS.build({
    ...state,
    dates: [{ id: 'd1', title: 'Anos da avó', date: '1950-03-02', gifts: 'flores' }],
    docs: [{ id: 'k1', type: 'Passaporte', memberId: 'pai', expires: '2027-01-10' }],
    health: [{ id: 'h1', memberId: 'f12', title: 'Vacina', next: '2026-11-02', nextLabel: 'Vacina (2.ª dose)' }],
  }, { memberId: 'f12', now });
  assert.match(out, /UID:date-d1@portal-familia[\s\S]*RRULE:FREQ=YEARLY[\s\S]*SUMMARY:🎉 Anos da avó/);
  assert.ok(!out.includes('doc-k1'), 'o passaporte do pai não entra no calendário da filha');
  assert.match(out, /SUMMARY:🏥 Vacina \(2\.ª dose\)/);
});
