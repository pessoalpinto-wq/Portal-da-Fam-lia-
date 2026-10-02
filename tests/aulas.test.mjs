import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../supabase/functions/_shared/aulas.js';
import '../supabase/functions/_shared/ics.js';

const A = globalThis.Aulas;

test('aula de todas as semanas: só no dia da semana', () => {
  const c = { day: 4 }; // quinta
  assert.equal(A.on(c, '2026-10-01'), true);
  assert.equal(A.on(c, '2026-10-02'), false);
  assert.equal(A.on(c, '2026-10-08'), true);
});

test('semanas alternadas: reforço de Português numa quinta, Matemática na seguinte', () => {
  const port = { day: 4, every: 2, anchor: '2026-10-01' };
  const mat = { day: 4, every: 2, anchor: '2026-10-08' };
  const weeks = ['2026-09-24', '2026-10-01', '2026-10-08', '2026-10-15', '2027-01-07'];
  assert.deepEqual(weeks.map((d) => A.on(port, d)), [false, true, false, true, true]); // 7/1/2027: 14 semanas depois
  assert.deepEqual(weeks.map((d) => A.on(mat, d)), [true, false, true, false, false]);
  // A data de referência pode ser qualquer dia dessa semana.
  assert.equal(A.on({ day: 4, every: 2, anchor: '2026-09-28' }, '2026-10-01'), true);
});

test('de 3 em 3 semanas; sem data de referência não aparece (não se adivinha)', () => {
  const ef = { day: 2, every: 3, anchor: '2026-10-06' };
  assert.deepEqual(['2026-10-06', '2026-10-13', '2026-10-20', '2026-10-27', '2026-09-15'].map((d) => A.on(ef, d)), [true, false, false, true, true]);
  assert.equal(A.on({ day: 2, every: 3 }, '2026-10-06'), false);
  assert.equal(A.label({ day: 2, every: 3 }), 'de 3 em 3 semanas · falta uma data');
});

test('só durante parte do ano (um semestre)', () => {
  const cn = { day: 4, until: '2027-01-29' };
  const fq = { day: 4, from: '2027-02-01' };
  assert.equal(A.on(cn, '2027-01-28'), true);
  assert.equal(A.on(cn, '2027-02-04'), false);
  assert.equal(A.on(fq, '2027-01-28'), false);
  assert.equal(A.on(fq, '2027-02-04'), true);
  assert.equal(A.label(cn), 'até 29/01');
  assert.equal(A.firstOn(fq, '2026-10-01'), '2027-02-04');
  assert.equal(A.firstOn(cn, '2027-02-01'), null);
});

test('calendário do telemóvel: INTERVAL, UNTIL e primeira data certa', () => {
  const s = {
    members: [{ id: 'l', name: 'Luísa' }],
    classes: [
      { id: 'a', memberId: 'l', day: 4, start: '14:25', end: '15:10', subject: 'Reforço de Português', every: 2, anchor: '2026-10-01' },
      { id: 'b', memberId: 'l', day: 4, start: '14:25', end: '15:10', subject: 'Reforço de Matemática', every: 2, anchor: '2026-10-08' },
      { id: 'c', memberId: 'l', day: 2, start: '08:30', end: '09:15', subject: 'EF', every: 3 },
      { id: 'd', memberId: 'l', day: 4, start: '10:20', end: '11:05', subject: 'CN', until: '2027-01-29' },
    ],
  };
  const ics = globalThis.ICS.build(s, { includeClasses: true, now: new Date('2026-10-02T10:00:00Z') }).replace(/\r\n /g, '');
  const ev = (uid) => ics.split('BEGIN:VEVENT').find((b) => b.includes(`UID:class-${uid}@`)) || '';
  assert.match(ev('a'), /DTSTART;TZID=Europe\/Lisbon:20261001T142500/);
  assert.match(ev('a'), /RRULE:FREQ=WEEKLY;INTERVAL=2/);
  assert.match(ev('b'), /DTSTART;TZID=Europe\/Lisbon:20261008T142500/);
  assert.equal(ev('c'), ''); // sem data de referência fica de fora
  assert.match(ev('d'), /RRULE:FREQ=WEEKLY;UNTIL=20270129T235959Z/);
});
