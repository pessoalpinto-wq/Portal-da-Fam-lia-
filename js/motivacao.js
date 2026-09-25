/*
 * Motivação para além dos pontos: níveis (XP que nunca se gasta), dias seguidos com bónus,
 * medalhas, estrela da semana e desafio da família. Tudo é calculado a partir do histórico
 * das tarefas ({ date, by, points, bonus }). Script "clássico": define globalThis.Motivacao.
 */
(function (root) {
  const DAY = 86400000;
  const iso = (d) => d.toISOString().slice(0, 10);
  const addDays = (s, n) => iso(new Date(Date.parse(`${s}T00:00:00Z`) + n * DAY));
  const weekday = (s) => new Date(`${s}T00:00:00Z`).getUTCDay();
  /** Segunda-feira da semana de `s`. */
  const weekStart = (s) => addDays(s, -((weekday(s) + 6) % 7));

  /* ---------- Níveis ---------- */
  const LEVELS = [
    ['🌱', 'Aprendiz'], ['🧹', 'Ajudante'], ['🧽', 'Ajudante Pro'], ['🤝', 'Braço-direito'], ['🛠️', 'Craque'],
    ['🎯', 'Especialista'], ['✨', 'Mãos de ouro'], ['🏅', 'Estrela da casa'], ['👑', 'Mestre da casa'], ['🌟', 'Lenda'],
  ];
  // XP necessário para cada nível (nível 1 = 0 XP). Depois do último, +600 XP por nível.
  const STEPS = [0, 15, 40, 80, 140, 220, 320, 450, 600, 800, 1050, 1350, 1700, 2100, 2600];
  const need = (n) => (n <= STEPS.length ? STEPS[n - 1] : STEPS[STEPS.length - 1] + (n - STEPS.length) * 600);

  function level(xp) {
    const x = Math.max(0, Number(xp) || 0);
    let n = 1;
    while (x >= need(n + 1)) n++;
    const [emoji, name] = LEVELS[Math.min(n, LEVELS.length) - 1];
    const from = need(n);
    const to = need(n + 1);
    return { n, emoji, name, xp: x, from, to, pct: Math.round(((x - from) / (to - from)) * 100), left: to - x };
  }

  /* ---------- Histórico ---------- */
  /** Todas as tarefas concluídas (e aprovadas) por um membro, com a tarefa de origem. */
  function entries(state, memberId) {
    const out = [];
    (state.tasks || []).forEach((t) => (t.history || []).forEach((h) => {
      if (h.by === memberId) out.push({ ...h, task: t });
    }));
    return out.sort((a, b) => a.date.localeCompare(b.date));
  }
  const worth = (h) => (Number(h.points) || 0) + (Number(h.bonus) || 0);

  /** XP: tudo o que já ganhou (trocar pontos por recompensas não baixa o XP). */
  function xpOf(state, m) {
    const derived = entries(state, m.id).reduce((a, h) => a + worth(h), 0);
    return Math.max(Number(m.xp) || 0, derived);
  }

  /** Dias seguidos a acabar em `end` (ou na véspera: o dia de hoje ainda não acabou). */
  function streak(dates, end) {
    const set = new Set(dates);
    let d = set.has(end) ? end : addDays(end, -1);
    let n = 0;
    while (set.has(d)) { n++; d = addDays(d, -1); }
    return n;
  }

  function bestStreak(dates) {
    const sorted = [...new Set(dates)].sort();
    let best = 0;
    let run = 0;
    sorted.forEach((d, i) => {
      run = i && addDays(sorted[i - 1], 1) === d ? run + 1 : 1;
      best = Math.max(best, run);
    });
    return best;
  }

  /** Bónus por dias seguidos (dado quando a sequência chega a estes números). */
  const STREAK_BONUS = { 3: 2, 7: 5, 14: 10, 30: 20, 60: 30, 100: 50 };

  function stats(state, m, today) {
    const list = entries(state, m.id);
    const dates = list.map((h) => h.date);
    const byCat = {};
    const byDay = {};
    let helped = 0;
    let weekend = 0;
    list.forEach((h) => {
      const c = h.task.category || 'Outro';
      byCat[c] = (byCat[c] || 0) + 1;
      byDay[h.date] = (byDay[h.date] || 0) + 1;
      if (h.task.assignee !== m.id) helped++;
      if ([0, 6].includes(weekday(h.date))) weekend++;
    });
    const ws = weekStart(today);
    const xp = xpOf(state, m);
    return {
      count: list.length,
      xp,
      level: level(xp),
      streak: streak(dates, today),
      best: bestStreak(dates),
      byCat,
      cats: Object.keys(byCat).length,
      helped,
      weekend,
      maxDay: Math.max(0, ...Object.values(byDay)),
      week: list.filter((h) => h.date >= ws && h.date <= today).reduce((a, h) => a + worth(h), 0),
      weekCount: list.filter((h) => h.date >= ws && h.date <= today).length,
    };
  }

  /* ---------- Medalhas ---------- */
  const BADGES = [
    ['primeira', '🌟', 'Primeira tarefa', 'Concluir a primeira tarefa', (s) => s.count >= 1],
    ['dez', '🔟', 'Dez feitas', 'Concluir 10 tarefas', (s) => s.count >= 10],
    ['cinquenta', '💪', 'Força total', 'Concluir 50 tarefas', (s) => s.count >= 50],
    ['cem', '💯', 'Cem!', 'Concluir 100 tarefas', (s) => s.count >= 100],
    ['seq3', '🔥', 'Aquecimento', '3 dias seguidos com tarefas feitas', (s) => s.best >= 3],
    ['seq7', '☄️', 'Semana em cheio', '7 dias seguidos', (s) => s.best >= 7],
    ['seq30', '🏆', 'Mês imparável', '30 dias seguidos', (s) => s.best >= 30],
    ['chef', '🍳', 'Chef da casa', '10 tarefas de cozinha', (s) => (s.byCat.Cozinha || 0) >= 10],
    ['quarto', '🛏️', 'Quarto de revista', '8 vezes a arrumar o quarto', (s) => (s.byCat.Quarto || 0) >= 8],
    ['roupa', '👕', 'Mestre da roupa', '8 tarefas de roupa', (s) => (s.byCat.Roupa || 0) >= 8],
    ['ajuda', '🤝', 'Mão amiga', 'Fazer 5 tarefas que não eram tuas', (s) => s.helped >= 5],
    ['fazTudo', '🎨', 'Faz-tudo', 'Tarefas de 5 categorias diferentes', (s) => s.cats >= 5],
    ['fds', '🌞', 'Fim de semana útil', '5 tarefas ao sábado ou domingo', (s) => s.weekend >= 5],
    ['maratona', '⚡', 'Maratona', '4 tarefas no mesmo dia', (s) => s.maxDay >= 4],
    ['nivel5', '🚀', 'Nível 5', 'Chegar ao nível 5', (s) => s.level.n >= 5],
    ['nivel10', '👑', 'Nível 10', 'Chegar ao nível 10', (s) => s.level.n >= 10],
  ].map(([id, emoji, name, desc, test]) => ({ id, emoji, name, desc, test }));

  /** Medalhas ganhas: as calculadas agora + as já guardadas (não se perdem se apagarem tarefas). */
  function badges(state, m, today, st = stats(state, m, today)) {
    const kept = new Set(m.badges || []);
    return BADGES.filter((b) => kept.has(b.id) || b.test(st)).map((b) => b.id);
  }

  /**
   * Chamado quando uma tarefa fica concluída (pelos pais ou com a aprovação deles), depois de
   * `entry` ter entrado no histórico. Dá o bónus de dias seguidos, guarda XP e medalhas no membro.
   */
  function onCompletion(state, who, entry) {
    const list = entries(state, who.id);
    // `entry` já está no histórico: o XP de antes é o total sem ele.
    const oldXp = Math.max(Number(who.xp) || 0, list.reduce((a, h) => a + worth(h), 0) - worth(entry));
    const before = level(oldXp).n;
    const firstOfDay = list.filter((h) => h.date === entry.date).length === 1;
    const run = streak(list.map((h) => h.date), entry.date);
    const bonus = firstOfDay ? STREAK_BONUS[run] || 0 : 0;
    if (bonus) {
      entry.bonus = bonus;
      who.points = (Number(who.points) || 0) + bonus;
    }
    who.xp = oldXp + (Number(entry.points) || 0) + bonus;
    const had = new Set(who.badges || []);
    const now = badges(state, who, entry.date);
    who.badges = now;
    const lv = level(who.xp);
    return {
      bonus, streak: run, level: lv, levelUp: lv.n > before,
      newBadges: BADGES.filter((b) => now.includes(b.id) && !had.has(b.id)),
    };
  }

  /** Desfaz o XP de uma conclusão (tarefa reaberta pelos pais). */
  function onReopen(who, entry) {
    if (!who || !entry) return;
    who.xp = Math.max(0, (Number(who.xp) || 0) - worth(entry));
  }

  /* ---------- Semana e desafio ---------- */
  function weekRanking(state, today) {
    return (state.members || []).map((m) => ({ m, ...stats(state, m, today) }))
      .sort((a, b) => b.week - a.week || b.weekCount - a.weekCount);
  }

  /** Pontos que a família juntou no período do desafio. */
  function challengeProgress(state, c) {
    const who = c.members && c.members.length ? c.members : (state.members || []).map((m) => m.id);
    let total = 0;
    (state.tasks || []).forEach((t) => (t.history || []).forEach((h) => {
      if (who.includes(h.by) && h.date >= c.start && h.date <= c.end) total += worth(h);
    }));
    const goal = Math.max(1, Number(c.goal) || 1);
    return { total, goal, pct: Math.min(100, Math.round((total / goal) * 100)), done: total >= goal };
  }

  const CHEERS = [
    'Feito! 💪 Os pais vão aprovar já já ⏳', 'Boa! Mais uma para a conta ⏳', 'Arrasaste! 🔥 À espera de aprovação',
    'Top! A casa agradece 🏠 ⏳', 'Mais um passo para a próxima recompensa 🎁 ⏳', 'Uau, que rapidez! ⚡ À espera de aprovação',
  ];
  const cheer = () => CHEERS[Math.floor(Math.random() * CHEERS.length)];

  root.Motivacao = {
    LEVELS, STREAK_BONUS, BADGES, level, need, entries, xpOf, streak, bestStreak, stats, badges,
    onCompletion, onReopen, weekRanking, challengeProgress, weekStart, addDays, cheer,
  };
})(globalThis);
