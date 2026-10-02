/*
 * Aulas que não são todas as semanas: semanas alternadas (ex.: reforço de Matemática numa semana e
 * de Português na outra), de 3 em 3 semanas, ou só durante parte do ano (ex.: um semestre).
 * Campos opcionais de uma aula: every (1, 2, 3…), anchor (uma data em que há a aula), from, until.
 * Script "clássico" partilhado pela app, pelo calendário (ics.js) e pelos lembretes: define globalThis.Aulas.
 * Testado em tests/aulas.test.mjs.
 */
(function (root) {
  const DAY = 86400000;
  const num = (iso) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / DAY;
  const iso = (n) => new Date(n * DAY).toISOString().slice(0, 10);
  const weekday = (d) => new Date(num(d) * DAY).getUTCDay();
  const monday = (d) => num(d) - ((weekday(d) + 6) % 7);
  const isDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));
  const everyOf = (c) => Math.max(1, Math.min(8, Number(c.every) || 1));

  /** Há esta aula no dia `date` (AAAA-MM-DD)? */
  function on(c, date) {
    if (!c || Number(c.day) !== weekday(date)) return false;
    if (isDate(c.from) && date < c.from) return false;
    if (isDate(c.until) && date > c.until) return false;
    const every = everyOf(c);
    if (every === 1) return true;
    if (!isDate(c.anchor)) return false; // sem saber uma data em que há, não se adivinha
    const weeks = Math.round((monday(date) - monday(c.anchor)) / 7);
    return ((weeks % every) + every) % every === 0;
  }

  /** Primeiro dia com esta aula a partir de `from` (procura até ~1 ano), ou null. */
  function firstOn(c, from) {
    const start = num(isDate(c.from) && c.from > from ? c.from : from);
    for (let i = 0; i < 380; i++) {
      const d = iso(start + i);
      if (isDate(c.until) && d > c.until) return null;
      if (on(c, d)) return d;
    }
    return null;
  }

  const dm = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
  /** Texto curto para o horário: "semanas alternadas", "de 3 em 3 semanas · falta uma data", "até 29/01". */
  function label(c) {
    const every = everyOf(c);
    const bits = [];
    if (every === 2) bits.push('semanas alternadas');
    else if (every > 2) bits.push(`de ${every} em ${every} semanas`);
    if (every > 1 && !isDate(c.anchor)) bits.push('falta uma data');
    if (isDate(c.from)) bits.push(`desde ${dm(c.from)}`);
    if (isDate(c.until)) bits.push(`até ${dm(c.until)}`);
    return bits.join(' · ');
  }

  root.Aulas = { on, firstOn, label, everyOf };
})(globalThis);
