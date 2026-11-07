/*
 * Caixa de ideias: apontar uma ideia em qualquer altura (no carro, à noite…) e revê-la depois.
 * Parte pura (sem DOM): limpar o texto ditado, criar a ideia, quem a vê, agrupar por dia e
 * transformá-la numa tarefa. Script "clássico": define globalThis.Ideias. Testado em tests/ideias.test.mjs.
 */
(function (root) {
  const strip = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const pad = (n) => String(n).padStart(2, '0');
  const isoDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const addDays = (s, n) => {
    const [y, m, d] = s.split('-').map(Number);
    const x = new Date(Date.UTC(y, m - 1, d + n));
    return `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}`;
  };

  // Palavras do início que são só a "ordem" ("nova ideia:", "toma nota que…", "lembrar-me de…").
  const LEAD = /^(?:(?:ok|olha|entao|pronto)[\s,]+)?(?:(?:tenho\s+uma\s+|nova\s+|uma\s+)?ideia(?:\s+nova)?|toma\s+nota(?:\s+que|\s+de)?|apontar|aponta|anota(?:r)?|nota|lembrar(?:-me)?\s+de|lembra(?:-me)?\s+de)\s*[:,.\-–—]?\s+/;

  /** Texto escrito ou ditado → texto da ideia (sem a "ordem" do início, com maiúscula). */
  function clean(text) {
    let t = String(text || '').replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
    const m = strip(t).match(LEAD);
    // Só corta se sobrar alguma coisa (uma ideia chamada "Nota" fica como está).
    if (m && t.length > m[0].length) t = t.slice(m[0].length).trim();
    return t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
  }

  /**
   * Cria uma ideia nova.
   * @param {string} text
   * @param {{ id: string, by: string, now?: Date, source?: 'texto'|'voz'|'partilha' }} o
   */
  function create(text, { id, by, now = new Date(), source = 'texto' }) {
    return {
      id, by, text: clean(text), date: isoDay(now), time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
      source, done: false, shared: false,
    };
  }

  /** As ideias de cada um são privadas; as partilhadas vê-as a família toda. */
  const visible = (ideas, me) => (ideas || []).filter((i) => i.by === me || i.shared);

  const newest = (a, b) => `${b.date} ${b.time || ''}`.localeCompare(`${a.date} ${a.time || ''}`);

  /** Agrupa por "Hoje", "Ontem", "Esta semana" (7 dias) e "Mais antigas", da mais recente para a mais antiga. */
  function groups(ideas, today) {
    const out = [['Hoje', []], ['Ontem', []], ['Últimos 7 dias', []], ['Mais antigas', []]];
    const yest = addDays(today, -1);
    const week = addDays(today, -7);
    [...ideas].sort(newest).forEach((i) => {
      const k = i.date >= today ? 0 : i.date === yest ? 1 : i.date > week ? 2 : 3;
      out[k][1].push(i);
    });
    return out.filter(([, l]) => l.length);
  }

  /** Ideia → título e notas de uma tarefa (a primeira frase é o título; o resto vai para as notas). */
  function toTask(idea) {
    const text = clean(idea?.text);
    const nl = text.indexOf('\n');
    let title = nl >= 0 ? text.slice(0, nl) : text;
    let rest = nl >= 0 ? text.slice(nl + 1) : '';
    const dot = title.search(/[.!?](\s|$)/);
    if (dot > 0 && dot < title.length - 1) {
      rest = `${title.slice(dot + 1).trim()}${rest ? `\n${rest}` : ''}`;
      title = title.slice(0, dot);
    }
    if (title.length > 80) {
      const cut = title.lastIndexOf(' ', 80);
      rest = `${title.slice(cut > 40 ? cut : 80).trim()}${rest ? `\n${rest}` : ''}`;
      title = `${title.slice(0, cut > 40 ? cut : 80).trim()}…`;
    }
    return { title: title.replace(/[.,;:]+$/, '').trim(), notes: rest.trim() };
  }

  /**
   * Texto partilhado a partir de outra app (Partilhar → Família) que não é um link (os links são receitas).
   * @param {URLSearchParams} params
   * @returns {string|null}
   */
  function fromShare(params) {
    const url = params.get('url') || '';
    const text = params.get('text') || '';
    const title = params.get('title') || '';
    if (url || /https?:\/\//.test(text)) return null;
    const parts = [title, text].map((s) => s.trim()).filter(Boolean);
    if (parts.length === 2 && parts[1].startsWith(parts[0])) parts.shift();
    return parts.length ? parts.join('\n') : null;
  }

  root.Ideias = { clean, create, visible, groups, toTask, fromShare };
})(globalThis);
