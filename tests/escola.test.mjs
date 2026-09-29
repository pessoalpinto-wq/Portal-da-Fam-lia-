import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../js/escola.js';

const E = globalThis.Escola;

test('ler notas: 0–20, decimais com vírgula, percentagem e por extenso', () => {
  assert.deepEqual(E.parseGrade('13,5'), { v: 13.5, pct: false });
  assert.deepEqual(E.parseGrade('85%'), { v: 85, pct: true });
  assert.deepEqual(E.parseGrade(' 17 '), { v: 17, pct: false });
  assert.equal(E.parseGrade('Bom'), null);
  assert.equal(E.parseGrade(''), null);
  assert.equal(E.parseGrade('15 (recuperação)'), null);
});

test('média por disciplina, escala e tendência', () => {
  const exams = [
    { subject: 'Matemática A', date: '2026-09-09', grade: '15' },
    { subject: 'Português', date: '2026-09-17', grade: '13,5' },
    { subject: 'matemática A ', date: '2026-09-24', grade: '17' },
    { subject: 'Inglês', date: '2026-09-20', grade: '4' },
    { subject: 'Inglês', date: '2026-09-27', grade: '3' },
    { subject: 'Ciências', date: '2026-09-27', grade: '72%' },
    { subject: 'Música', date: '2026-09-27', grade: 'Bom' },
    { subject: 'História', date: '2026-10-10' },
  ];
  const a = E.averages(exams);
  assert.deepEqual(a.map((x) => x.subject), ['Ciências', 'Inglês', 'Matemática A', 'Português']);
  const mat = a.find((x) => x.subject === 'Matemática A');
  assert.deepEqual({ avg: mat.avg, n: mat.n, scale: mat.scale, last: mat.last, trend: mat.trend }, { avg: 16, n: 2, scale: 20, last: 17, trend: 1 });
  const ing = a.find((x) => x.subject === 'Inglês');
  assert.deepEqual([ing.avg, ing.scale, ing.trend], [3.5, 5, -1]);
  assert.equal(a.find((x) => x.subject === 'Ciências').scale, 100);
  assert.equal(E.level(16, 20), 'good');
  assert.equal(E.level(11, 20), 'ok');
  assert.equal(E.level(2, 5), 'low');
});

test('testes já feitos sem nota', () => {
  const T = '2026-09-29';
  assert.equal(E.missingGrade({ kind: 'Teste', date: '2026-09-20' }, T), true);
  assert.equal(E.missingGrade({ kind: 'Teste', date: '2026-09-20', grade: '14' }, T), false);
  assert.equal(E.missingGrade({ kind: 'Reunião de pais', date: '2026-09-20' }, T), false);
  assert.equal(E.missingGrade({ kind: 'Teste', date: T }, T), false);
});
