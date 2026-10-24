import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eventsBetween, calendarName, safeUrl } from '../supabase/functions/_shared/ics-import.js';

// Calendário inventado, ao jeito do "endereço secreto" do Google Calendar.
const cal = (...events) => ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Google Inc//Google Calendar 70.9054//EN', 'X-WR-CALNAME:Trabalho',
  'X-WR-TIMEZONE:Europe/Lisbon', ...events.flatMap((e) => ['BEGIN:VEVENT', ...e, 'END:VEVENT']), 'END:VCALENDAR'].join('\r\n');

test('evento com hora: UTC e TZID passam para a hora de Lisboa (verão e inverno)', () => {
  const t = cal(
    ['UID:a', 'DTSTART:20260715T090000Z', 'DTEND:20260715T100000Z', 'SUMMARY:Reunião\\, obra', 'LOCATION:Escritório'],
    ['UID:b', 'DTSTART;TZID=Europe/Madrid:20261210T100000', 'DTEND;TZID=Europe/Madrid:20261210T113000', 'SUMMARY:Chamada Madrid'],
    ['UID:c', 'DTSTART;TZID=Europe/Lisbon:20261210T183000', 'DURATION:PT45M', 'SUMMARY:Ginásio'],
  );
  const ev = eventsBetween(t, '2026-07-01', '2026-12-31');
  assert.deepEqual(ev.map((e) => [e.date, e.time, e.endTime, e.title]), [
    ['2026-07-15', '10:00', '11:00', 'Reunião, obra'],
    ['2026-12-10', '09:00', '10:30', 'Chamada Madrid'],
    ['2026-12-10', '18:30', '19:15', 'Ginásio'],
  ]);
  assert.equal(ev[0].location, 'Escritório');
  assert.equal(calendarName(t), 'Trabalho');
});

test('dia inteiro e vários dias; fora do intervalo não entra; linhas dobradas', () => {
  const t = cal(
    ['UID:d', 'DTSTART;VALUE=DATE:20261101', 'DTEND;VALUE=DATE:20261102', 'SUMMARY:Feriado'],
    ['UID:e', 'DTSTART;VALUE=DATE:20261228', 'DTEND;VALUE=DATE:20270103', 'SUMMARY:Férias de', '  Natal'],
    ['UID:f', 'DTSTART:20250101T100000Z', 'SUMMARY:Antigo'],
  );
  const ev = eventsBetween(t, '2026-10-01', '2026-12-31');
  assert.deepEqual(ev.map((e) => [e.date, e.endDate, e.allDay, e.title]), [
    ['2026-11-01', '2026-11-01', true, 'Feriado'],
    ['2026-12-28', '2027-01-02', true, 'Férias de Natal'],
  ]);
});

test('repetições: semanal com BYDAY, EXDATE, alteração de uma ocorrência e mudança de hora', () => {
  const t = cal(
    ['UID:w', 'DTSTART;TZID=Europe/Lisbon:20261019T090000', 'DTEND;TZID=Europe/Lisbon:20261019T093000', 'RRULE:FREQ=WEEKLY;BYDAY=MO,WE;COUNT=6',
      'EXDATE;TZID=Europe/Lisbon:20261021T090000', 'SUMMARY:Daily'],
    ['UID:w', 'RECURRENCE-ID;TZID=Europe/Lisbon:20261026T090000', 'DTSTART;TZID=Europe/Lisbon:20261026T140000', 'DTEND;TZID=Europe/Lisbon:20261026T143000', 'SUMMARY:Daily (mudou)'],
  );
  const ev = eventsBetween(t, '2026-10-01', '2026-12-31');
  // 6 ocorrências: 19, 21 (excluída), 26 (mudou para as 14h), 28, 2/11, 4/11. Às 9h de Lisboa mesmo depois de 25/10 (fim da hora de verão).
  assert.deepEqual(ev.map((e) => `${e.date} ${e.time} ${e.title}`), [
    '2026-10-19 09:00 Daily', '2026-10-26 14:00 Daily (mudou)', '2026-10-28 09:00 Daily', '2026-11-02 09:00 Daily', '2026-11-04 09:00 Daily',
  ]);
});

test('repetições: mensal (2.ª terça, último dia), anual, diária com intervalo e UNTIL; cancelados não entram', () => {
  const t = cal(
    ['UID:m', 'DTSTART;TZID=Europe/Lisbon:20260908T200000', 'RRULE:FREQ=MONTHLY;BYDAY=2TU', 'SUMMARY:Reunião de pais'],
    ['UID:l', 'DTSTART;VALUE=DATE:20260930', 'RRULE:FREQ=MONTHLY;BYMONTHDAY=-1', 'SUMMARY:Fecho do mês'],
    ['UID:y', 'DTSTART;VALUE=DATE:20200314', 'RRULE:FREQ=YEARLY', 'SUMMARY:Aniversário'],
    ['UID:i', 'DTSTART:20261001T080000Z', 'RRULE:FREQ=DAILY;INTERVAL=10;UNTIL=20261025T000000Z', 'SUMMARY:Rega'],
    ['UID:x', 'DTSTART:20261015T080000Z', 'STATUS:CANCELLED', 'SUMMARY:Cancelado'],
  );
  const ev = eventsBetween(t, '2026-10-01', '2026-11-30');
  const by = (title) => ev.filter((e) => e.title === title).map((e) => e.date);
  assert.deepEqual(by('Reunião de pais'), ['2026-10-13', '2026-11-10']);
  assert.deepEqual(by('Fecho do mês'), ['2026-10-31', '2026-11-30']);
  assert.deepEqual(by('Rega'), ['2026-10-01', '2026-10-11', '2026-10-21']);
  assert.deepEqual(eventsBetween(t, '2027-03-01', '2027-03-31').filter((e) => e.title === 'Aniversário').map((e) => e.date), ['2027-03-14']);
  assert.equal(by('Cancelado').length, 0);
  // Ids estáveis (para não piscar ao atualizar).
  assert.equal(eventsBetween(t, '2026-10-01', '2026-11-30')[0].id, ev[0].id);
});

test('links: só https públicos (webcal passa a https)', () => {
  assert.equal(safeUrl('webcal://calendar.google.com/calendar/ical/x%40gmail.com/private-abc/basic.ics'),
    'https://calendar.google.com/calendar/ical/x%40gmail.com/private-abc/basic.ics');
  assert.equal(safeUrl('http://calendar.google.com/x.ics'), null);
  assert.equal(safeUrl('https://127.0.0.1/x.ics'), null);
  assert.equal(safeUrl('https://localhost/x.ics'), null);
  assert.equal(safeUrl('https://abc.supabase.co/x'), null);
  assert.equal(safeUrl('não é link'), null);
});
