import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../js/motivacao.js';
import '../js/ideias-tarefas.js';

const M = globalThis.Motivacao;
const { IDEIAS, AREAS } = globalThis.IDEIAS_TAREFAS;
const T = '2026-09-25'; // sexta-feira

test('níveis: limites e progresso', () => {
  assert.equal(M.level(0).n, 1);
  assert.equal(M.level(14).n, 1);
  assert.equal(M.level(15).n, 2);
  assert.deepEqual([M.level(20).from, M.level(20).to, M.level(20).left], [15, 40, 20]);
  assert.equal(M.level(2600).n, 15);
  assert.equal(M.level(3200).n, 16);
  assert.equal(M.level(99999).emoji, '🌟');
});

test('dias seguidos: conta até hoje ou até ontem', () => {
  assert.equal(M.streak(['2026-09-23', '2026-09-24', '2026-09-25'], T), 3);
  assert.equal(M.streak(['2026-09-23', '2026-09-24'], T), 2); // hoje ainda não acabou
  assert.equal(M.streak(['2026-09-22', '2026-09-23'], T), 0);
  assert.equal(M.bestStreak(['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-10', '2026-09-03']), 3);
  assert.equal(M.weekStart(T), '2026-09-21');
  assert.equal(M.weekStart('2026-09-27'), '2026-09-21'); // domingo
});

function family() {
  return {
    members: [{ id: 'f', name: 'Luísa', role: 'filha', points: 0 }, { id: 'p', name: 'Luís', role: 'pai', points: 0 }],
    tasks: [
      { id: 't1', title: 'Pôr a mesa', assignee: 'f', category: 'Cozinha', history: [] },
      { id: 't2', title: 'Lixo', assignee: 'p', category: 'Casa', history: [] },
    ],
  };
}
const complete = (s, taskId, date, points = 2, by = 'f') => {
  const t = s.tasks.find((x) => x.id === taskId);
  const who = s.members.find((m) => m.id === by);
  const entry = { date, by, points };
  t.history = [...t.history, entry];
  who.points += points;
  return M.onCompletion(s, who, entry);
};

test('conclusões: XP, bónus de 3 dias seguidos só uma vez por dia, medalhas', () => {
  const s = family();
  const f = s.members[0];
  let r = complete(s, 't1', '2026-09-23');
  assert.equal(r.bonus, 0);
  assert.deepEqual(r.newBadges.map((b) => b.id), ['primeira']);
  assert.equal(f.xp, 2);
  complete(s, 't1', '2026-09-24');
  r = complete(s, 't1', '2026-09-25');
  assert.equal(r.streak, 3);
  assert.equal(r.bonus, 2);
  assert.equal(f.points, 8);
  assert.equal(f.xp, 8);
  assert.ok(r.newBadges.some((b) => b.id === 'seq3'));
  // Segunda tarefa no mesmo dia: não repete o bónus. Ajudar noutra tarefa conta como "mão amiga".
  r = complete(s, 't2', '2026-09-25', 3);
  assert.equal(r.bonus, 0);
  assert.equal(f.xp, 11);
  assert.equal(M.stats(s, f, T).helped, 1);
  assert.equal(M.stats(s, f, T).week, 11);
  assert.equal(M.stats(s, f, T).streak, 3);
});

test('XP não desce ao trocar pontos nem ao apagar tarefas; medalhas ficam guardadas', () => {
  const s = family();
  const f = s.members[0];
  for (let d = 1; d <= 8; d++) complete(s, 't1', `2026-09-0${d}`, 2);
  const xp = f.xp;
  assert.ok(f.badges.includes('seq7'));
  f.points = 0; // trocou tudo por recompensas
  s.tasks = [];
  assert.equal(M.xpOf(s, f), xp);
  assert.ok(M.badges(s, f, T).includes('seq7'));
});

test('subir de nível e reabrir tarefa', () => {
  const s = family();
  const f = s.members[0];
  const r = complete(s, 't1', T, 15);
  assert.equal(r.levelUp, true);
  assert.equal(r.level.n, 2);
  const last = s.tasks[0].history.pop();
  M.onReopen(f, last);
  assert.equal(f.xp, 0);
});

test('desafio da família e estrela da semana', () => {
  const s = family();
  complete(s, 't1', '2026-09-20', 5); // semana anterior
  complete(s, 't1', '2026-09-22', 4);
  complete(s, 't2', '2026-09-23', 6, 'p');
  const c = { start: '2026-09-21', end: '2026-09-27', goal: 20 };
  assert.deepEqual(M.challengeProgress(s, c), { total: 10, goal: 20, pct: 50, done: false });
  assert.equal(M.challengeProgress(s, { ...c, members: ['f'] }).total, 4);
  const rank = M.weekRanking(s, T);
  assert.equal(rank[0].m.id, 'p');
  assert.equal(rank[0].week, 6);
});

test('catálogo de ideias bem formado', () => {
  const areas = new Set(AREAS.map((a) => a[0]));
  const cats = ['Casa', 'Quarto', 'Cozinha', 'Roupa', 'Animais', 'Escola', 'Saúde', 'Recados', 'Outro'];
  assert.ok(IDEIAS.length >= 60);
  IDEIAS.forEach((i) => {
    assert.ok(areas.has(i.area), i.title);
    assert.ok(cats.includes(i.category), i.title);
    assert.ok(['daily', 'weekly', 'monthly', 'none'].includes(i.repeat), i.title);
    assert.ok(i.points > 0 && i.age >= 8 && i.age <= 16, i.title);
  });
  assert.equal(new Set(IDEIAS.map((i) => i.title)).size, IDEIAS.length);
  assert.ok(IDEIAS.filter((i) => i.age <= 12).length >= 40); // bastante para a de 12 anos
});
