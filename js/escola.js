/*
 * Escola: ler as notas dos testes (0–20, 1–5 ou percentagem) e calcular a média por disciplina.
 * Script "clássico": define globalThis.Escola. Testado em tests/escola.test.mjs.
 */
(function (root) {
  /** "13,5" → 13.5, "85%" → 85 (percentagem), "Bom" → null (notas por extenso não entram na média). */
  function parseGrade(g) {
    const m = String(g ?? '').trim().replace(',', '.').match(/^(\d+(?:\.\d+)?)\s*(%)?$/);
    if (!m) return null;
    const v = Number(m[1]);
    return Number.isFinite(v) ? { v, pct: !!m[2] } : null;
  }

  /** Escala de um conjunto de notas: percentagem, 1–5 (ensino básico) ou 0–20. */
  function scaleOf(list) {
    if (list.some((g) => g.pct || g.v > 20)) return 100;
    return list.every((g) => g.v <= 5) ? 5 : 20;
  }

  const GRADED = ['Teste', 'Exame', 'Ficha', 'Trabalho', 'Apresentação'];
  /** Testes e trabalhos já feitos a que ainda falta a nota. */
  const missingGrade = (x, today) => x.date < today && GRADED.includes(x.kind) && !String(x.grade || '').trim();

  /**
   * Média por disciplina a partir dos testes com nota numérica.
   * @returns {Array<{subject, avg, n, scale, last, trend}>} trend: +1 subiu, -1 desceu, 0 igual/sem dados
   */
  function averages(exams = []) {
    const by = new Map();
    exams.forEach((x) => {
      const g = parseGrade(x.grade);
      const subject = String(x.subject || '').trim();
      if (!g || !subject) return;
      const key = subject.toLowerCase();
      if (!by.has(key)) by.set(key, { subject, list: [] });
      by.get(key).list.push({ ...g, date: x.date || '' });
    });
    return [...by.values()].map(({ subject, list }) => {
      list.sort((a, b) => a.date.localeCompare(b.date));
      const avg = Math.round((list.reduce((n, g) => n + g.v, 0) / list.length) * 10) / 10;
      const last = list[list.length - 1].v;
      const prev = list.length > 1 ? list[list.length - 2].v : null;
      return { subject, avg, n: list.length, scale: scaleOf(list), last, trend: prev == null || last === prev ? 0 : last > prev ? 1 : -1 };
    }).sort((a, b) => a.subject.localeCompare(b.subject, 'pt'));
  }

  /** Nível para a cor: 'good' (≥ 70 %), 'ok' (≥ 50 %) ou 'low'. */
  function level(avg, scale) {
    const r = avg / scale;
    return r >= 0.7 ? 'good' : r >= 0.5 ? 'ok' : 'low';
  }

  root.Escola = { parseGrade, scaleOf, averages, level, missingGrade, GRADED };
})(globalThis);
