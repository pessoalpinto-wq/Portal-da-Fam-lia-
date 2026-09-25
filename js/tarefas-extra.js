/*
 * Tarefas: ideias de tarefas domésticas (catálogo por zona da casa e idade) e motivação para
 * além dos pontos — níveis, dias seguidos, medalhas, estrela da semana e desafio da família.
 */
window.TarefasExtra = function ({ render }) {
  const { esc, today, addDays, fmtDate } = U;
  const { member, avatar, toast, editItem } = UI;
  const { VS, Forms } = Views;
  const { card, empty, addBtn } = Views.h;
  const M = Motivacao;
  const { AREAS, IDEIAS } = IDEIAS_TAREFAS;
  const S = () => Store.state;

  const REPEAT = { daily: 'todos os dias', weekly: 'todas as semanas', monthly: 'todos os meses', none: 'uma vez' };
  const isKid = (m) => m && !['pai', 'mae'].includes(m.role);
  const kids = () => S().members.filter(isKid);
  const norm = (t) => Ingredients.strip(t).replace(/[^a-z0-9]+/g, ' ').trim();

  function ageOf(m) {
    if (!m?.birthday) return null;
    const b = m.birthday;
    const t = today();
    return Number(t.slice(0, 4)) - Number(b.slice(0, 4)) - (t.slice(5) < b.slice(5) ? 1 : 0);
  }

  /** A ideia já é uma tarefa por fazer (de quem)? */
  function existing(idea) {
    const k = norm(idea.title);
    return S().tasks.filter((t) => !t.done && norm(t.title) === k);
  }

  /* ---------- Separadores ---------- */
  const TABS = [['lista', '📋 Lista'], ['ideias', '💡 Ideias'], ['conquistas', '🏆 Conquistas']];
  const tabs = () => `<div class="tabs" role="tablist">${TABS.map(([id, label]) => {
    const on = (VS.taskTab || 'lista') === id;
    return `<button role="tab" aria-selected="${on}" class="tab ${on ? 'active' : ''}" data-action="task-tab" data-id="${id}" style="--c:#4f46e5">${label}</button>`;
  }).join('')}</div>`;

  /* ---------- Ideias ---------- */
  function ideias() {
    const s = S();
    const area = VS.ideaArea || 'all';
    const forM = member(VS.ideaFor);
    const age = forM ? ageOf(forM) : null;
    const q = norm(VS.ideaQuery || '');
    const list = IDEIAS.filter((i) => (area === 'all' || i.area === area) && (age == null || i.age <= age)
      && (!q || norm(`${i.title} ${i.tip}`).includes(q)));
    const parent = Store.isParent();

    const who = [['', 'Todos'], ...s.members.map((m) => {
      const a = ageOf(m);
      return [m.id, `${m.emoji} ${m.name}${a != null && a < 18 ? ` (${a})` : ''}`];
    })];
    const noAge = forM && age == null && isKid(forM);

    const groups = AREAS.map(([id, emoji, label]) => [emoji, label, list.filter((i) => i.area === id)]).filter(([, , l]) => l.length);
    const row = (i) => {
      const ex = existing(i);
      const whoHas = ex.map((t) => member(t.assignee)?.name).filter(Boolean);
      return `<li class="idea">
        <div class="idea-main"><b>${esc(i.title)}</b>
          <small class="muted">${REPEAT[i.repeat]} · ⭐ ${i.points} · a partir dos ${i.age} anos</small>
          ${i.tip ? `<small class="idea-tip">💡 ${esc(i.tip)}</small>` : ''}
          ${ex.length ? `<small class="idea-has">✔ Já está nas tarefas${whoHas.length ? ` (${esc(whoHas.join(', '))})` : ''}</small>` : ''}
        </div>
        <button class="btn small ${ex.length ? '' : 'primary'}" data-action="idea-add" data-id="${i.id}" aria-label="Adicionar ${esc(i.title)}">＋</button>
      </li>`;
    };

    return `<div class="grid two wide-left">
      <section class="card">
        <p class="muted small">Toca em <b>＋</b> para transformar uma ideia numa tarefa (dá para mudar a pessoa, os pontos e a frequência antes de guardar).</p>
        <div class="filters">${who.map(([v, l]) => `<button class="filter ${(VS.ideaFor || '') === v ? 'active' : ''}" data-action="idea-for" data-id="${esc(v)}">${esc(l)}</button>`).join('')}</div>
        ${noAge ? `<p class="small muted">Para ver só as tarefas próprias para a idade da ${esc(forM.name)}, põe a data de nascimento em <a href="#/definicoes">Definições</a>.</p>` : ''}
        <div class="filters">
          <button class="filter ${area === 'all' ? 'active' : ''}" data-action="idea-area" data-id="all">Todas</button>
          ${AREAS.map(([id, emoji, label]) => `<button class="filter ${area === id ? 'active' : ''}" data-action="idea-area" data-id="${id}">${emoji} ${label}</button>`).join('')}
        </div>
        <input type="search" id="idea-search" class="idea-search" placeholder="Procurar ideia (ex.: loiça, roupa, carro)…" value="${esc(VS.ideaQuery || '')}" aria-label="Procurar ideia">
        ${groups.map(([emoji, label, l]) => `<h3 class="sub">${emoji} ${label} <small class="muted">(${l.length})</small></h3><ul class="list ideas">${l.map(row).join('')}</ul>`).join('')
          || empty('Nenhuma ideia com estes filtros.')}
      </section>
      <div class="stack">
        ${parent && kids().length ? card('🗓️ Montar a semana', `<p class="small">Escolho um conjunto equilibrado de tarefas para cada filha, à medida da idade, sem repetir o que já têm. Vês a proposta antes de confirmar.</p>
          <button class="btn primary block" data-action="idea-plan">✨ Propor tarefas para a semana</button>`) : ''}
        ${card('🧭 Dicas para correr bem', `<ul class="tips">
          <li><b>Poucas e fixas</b>: 1–2 tarefas diárias e 2–3 semanais por pessoa chegam.</li>
          <li><b>Ensinar uma vez, juntos</b>: na 1.ª vez fazem lado a lado; a partir daí é delas.</li>
          <li><b>Rodar de mês a mês</b> as tarefas menos giras (lixo, casa de banho) para ser justo.</li>
          <li><b>Aprovar depressa</b> e com um elogio concreto: "a bancada ficou a brilhar!".</li>
          <li><b>Desafio da família</b> em 🏆 Conquistas: todos contribuem para um prémio comum.</li>
        </ul>`)}
      </div>
    </div>`;
  }

  function addIdea(id) {
    const i = IDEIAS.find((x) => x.id === id);
    if (!i) return;
    const s = S();
    const assignee = VS.ideaFor || (Store.isParent() ? '' : s.currentUser);
    editItem('tasks', null, {
      title: 'tarefa',
      fields: Forms.task(),
      defaults: () => ({ done: false, history: [] }),
      preset: {
        title: i.title, assignee, due: today(), repeat: i.repeat, points: i.points, category: i.category, notes: i.tip,
      },
    });
  }

  /** Proposta de semana: 2 diárias + 3 semanais + 1 extra por filha, de zonas diferentes. */
  function proposePlan() {
    const shuffle = (a) => a.map((x) => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map((p) => p[1]);
    const taken = new Set();
    return kids().map((k) => {
      const age = ageOf(k) ?? 12;
      const mine = new Set(S().tasks.filter((t) => !t.done && t.assignee === k.id).map((t) => norm(t.title)));
      const ok = (i) => i.age <= age && !mine.has(norm(i.title)) && !taken.has(i.id) && i.area !== 'animais';
      const pick = (filter, n) => {
        const areas = new Set();
        const out = [];
        shuffle(IDEIAS.filter((i) => ok(i) && filter(i))).forEach((i) => {
          if (out.length >= n || areas.has(i.area)) return;
          areas.add(i.area);
          out.push(i);
          taken.add(i.id);
        });
        return out;
      };
      const daily = pick((i) => i.repeat === 'daily' && i.area !== 'extra', 2);
      const weekly = pick((i) => i.repeat === 'weekly' && i.area !== 'extra', 3);
      const extra = pick((i) => i.area === 'extra' && i.repeat === 'weekly', 1);
      return { k, list: [...daily, ...weekly, ...extra] };
    }).filter((p) => p.list.length);
  }

  function planWeek() {
    const plan = proposePlan();
    if (!plan.length) { toast('Já têm tarefas para tudo o que eu sugeria. 👌'); return; }
    const text = plan.map((p) => `${p.k.name}:\n${p.list.map((i) => `  • ${i.title} (${REPEAT[i.repeat]}, ⭐ ${i.points})`).join('\n')}`).join('\n\n');
    if (!confirm(`Proposta para esta semana:\n\n${text}\n\nCriar estas tarefas? (Dá para editar ou apagar depois.)`)) return;
    let n = 0;
    Store.update((s) => plan.forEach((p) => p.list.forEach((i, idx) => {
      s.tasks.push({
        id: Store.uid(), title: i.title, assignee: p.k.id, due: i.repeat === 'daily' ? today() : addDays(today(), 1 + (idx % 6)),
        repeat: i.repeat, points: i.points, category: i.category, notes: i.tip, done: false, history: [],
      });
      n++;
    })));
    VS.taskTab = 'lista';
    VS.taskFilter = 'all';
    toast(`✨ ${n} tarefas criadas`);
  }

  /* ---------- Motivação ---------- */
  function xpBar(lv, color) {
    return `<div class="xp" title="${lv.xp} XP"><span style="width:${lv.pct}%;background:${esc(color || 'var(--primary)')}"></span></div>
      <small class="muted">${lv.xp} XP · faltam ${lv.left} para o nível ${lv.n + 1}</small>`;
  }

  function nextReward(m) {
    const rs = [...S().rewards].sort((a, b) => a.cost - b.cost);
    const can = rs.filter((r) => r.cost <= m.points).pop();
    const next = rs.find((r) => r.cost > m.points);
    return [
      can ? `🎁 Já dá para pedir <b>${esc(can.title)}</b>!` : '',
      next ? `🎯 Faltam <b>${next.cost - m.points} ⭐</b> para <b>${esc(next.title)}</b>` : '',
    ].filter(Boolean).join('<br>');
  }

  function streakText(st) {
    if (!st.streak) return st.best ? `🔥 Sem sequência agora (melhor: ${st.best} dias)` : '🔥 Faz uma tarefa hoje para começar uma sequência';
    const next = Object.keys(M.STREAK_BONUS).map(Number).find((d) => d > st.streak);
    return `🔥 <b>${st.streak} dia${st.streak === 1 ? '' : 's'} seguido${st.streak === 1 ? '' : 's'}</b>${next ? ` · aos ${next} ganhas +${M.STREAK_BONUS[next]} ⭐ de bónus` : ''}`;
  }

  function activeChallenges() {
    const t = today();
    return (S().challenges || []).filter((c) => c.start <= t && c.end >= t);
  }

  function challengeBlock(c) {
    const p = M.challengeProgress(S(), c);
    const left = U.daysBetween(today(), c.end);
    const parent = Store.isParent();
    return `<div class="challenge ${p.done ? 'done' : ''}">
      <div class="challenge-head"><b>${esc(c.title)}</b>
        ${parent ? `<button class="icon-btn small" data-action="edit-challenge" data-id="${c.id}" aria-label="Editar desafio">✎</button>` : ''}</div>
      <div class="xp xp-lg"><span style="width:${p.pct}%"></span></div>
      <small class="muted">${p.total} / ${p.goal} ⭐ juntos · ${p.done ? 'objectivo cumprido!' : left > 0 ? `faltam ${left} dia${left === 1 ? '' : 's'}` : 'último dia!'}</small>
      <p class="challenge-prize">${p.done ? '🎉 Conseguiram! Prémio:' : '🏁 Prémio:'} <b>${esc(c.reward || '—')}</b></p>
      ${p.done && parent && !c.delivered ? `<button class="btn small primary" data-action="challenge-delivered" data-id="${c.id}">Prémio entregue ✔</button>` : ''}
      ${c.delivered ? '<small class="muted">✔ Prémio entregue</small>' : ''}
    </div>`;
  }

  /** Cartão lateral no separador Lista. */
  function side() {
    const s = S();
    const t = today();
    const me = member(s.currentUser);
    const meBlock = me ? (() => {
      const st = M.stats(s, me, t);
      return `<div class="me-lvl"><span class="lvl-emoji">${st.level.emoji}</span>
        <div><b>Nível ${st.level.n} · ${esc(st.level.name)}</b>${xpBar(st.level, me.color)}</div></div>
        <p class="small">${streakText(st)}</p>
        ${nextReward(me) ? `<p class="small">${nextReward(me)}</p>` : ''}`;
    })() : '';
    const rows = s.members.filter((m) => m.id !== s.currentUser).map((m) => {
      const st = M.stats(s, m, t);
      return `<li>${avatar(m.id, 'sm')} <span>${esc(m.name)}</span>
        <small class="muted">${st.level.emoji} Nv ${st.level.n}${st.streak ? ` · 🔥 ${st.streak}` : ''} · semana ⭐ ${st.week}</small></li>`;
    }).join('');
    const ch = activeChallenges()[0];
    return card('🚀 Progresso', `${meBlock}
      ${ch ? `<h3 class="sub">🤝 Desafio da família</h3>${challengeBlock(ch)}` : ''}
      ${rows ? `<ul class="mini-rank">${rows}</ul>` : ''}`, { action: '<button class="link" data-action="task-tab" data-id="conquistas">Ver conquistas</button>' });
  }

  function conquistas() {
    const s = S();
    const t = today();
    const parent = Store.isParent();
    const rank = M.weekRanking(s, t);
    const star = rank[0] && rank[0].week > 0 ? rank[0] : null;
    const act = activeChallenges();
    const past = (s.challenges || []).filter((c) => c.end < t).sort((a, b) => b.end.localeCompare(a.end)).slice(0, 4);

    const memberCard = (m) => {
      const st = M.stats(s, m, t);
      const got = new Set(M.badges(s, m, t, st));
      return `<section class="card member-prog" style="--c:${esc(m.color)}">
        <header class="card-head"><h2>${avatar(m.id)} ${esc(m.name)}</h2><span class="lvl-pill">${st.level.emoji} Nível ${st.level.n}</span></header>
        <p class="lvl-name">${esc(st.level.name)}</p>
        ${xpBar(st.level, m.color)}
        <p class="small">${streakText(st)}</p>
        <p class="small muted">✅ ${st.count} tarefas feitas · esta semana: ${st.weekCount} (⭐ ${st.week}) · 🏅 ${got.size}/${M.BADGES.length} medalhas</p>
        <ul class="badges">${M.BADGES.map((b) => `<li class="badge ${got.has(b.id) ? '' : 'locked'}" title="${esc(b.desc)}">
          <span class="b-emoji">${got.has(b.id) ? b.emoji : '🔒'}</span><span class="b-name">${esc(b.name)}</span>
          <small>${esc(b.desc)}</small></li>`).join('')}</ul>
      </section>`;
    };

    return `<div class="grid two">
        ${card('🤝 Desafio da família', `${act.length ? act.map(challengeBlock).join('') : `<p class="muted small">Um objectivo comum: todos os pontos que a família ganhar contam para o mesmo prémio (ex.: noite de pizza, ida ao cinema, praia no sábado).</p>
          ${parent ? '' : empty('Ainda não há desafio esta semana — pede aos pais! 😉')}`}
          ${past.length ? `<h3 class="sub">Anteriores</h3><ul class="hist">${past.map((c) => {
            const p = M.challengeProgress(s, c);
            return `<li>${p.done ? '🏆' : '➖'} ${esc(c.title)} <small class="muted">· ${p.total}/${p.goal} ⭐ · ${esc(fmtDate(c.end))}</small></li>`;
          }).join('')}</ul>` : ''}`, { action: parent ? addBtn('add-challenge', 'Desafio') : '' })}
        ${card('⭐ Estrela da semana', `${star ? `<div class="star-week">${avatar(star.m.id)}<div><b>${esc(star.m.name)}</b><br>
            <small class="muted">⭐ ${star.week} pontos e ${star.weekCount} tarefas desde segunda</small></div><span class="star-big">🌟</span></div>`
          : empty('Ainda ninguém pontuou esta semana. Quem será a primeira estrela?')}
          <ol class="leader week">${rank.map((r, i) => `<li><span class="rank">${['🥇', '🥈', '🥉'][i] || i + 1}</span>${avatar(r.m.id, 'sm')}
            <span class="lname">${esc(r.m.name)}</span><b>${r.week}</b></li>`).join('')}</ol>`)}
      </div>
      <div class="grid two">${[...kids(), ...s.members.filter((m) => !isKid(m))].map(memberCard).join('')}</div>
      ${card('❓ Como funciona', `<ul class="tips">
        <li><b>⭐ Pontos</b> trocam-se por recompensas. <b>XP</b> é tudo o que já ganhaste — nunca desce quando trocas pontos, e faz subir de <b>nível</b>.</li>
        <li><b>🔥 Dias seguidos</b>: cada dia com pelo menos uma tarefa aprovada conta. Bónus: ${Object.entries(M.STREAK_BONUS).map(([d, b]) => `${d} dias +${b}`).join(' · ')}.</li>
        <li><b>🏅 Medalhas</b> ganham-se uma vez e ficam para sempre.</li>
        <li><b>🌟 Estrela da semana</b>: quem juntar mais pontos de segunda a domingo.</li>
        <li><b>🤝 Desafio da família</b>: os pais marcam um objectivo de pontos para todos e um prémio comum.</li>
      </ul>`, { cls: 'how' })}`;
  }

  /* ---------- Desafios ---------- */
  function challengeForm(el) {
    const t = today();
    const ws = M.weekStart(t);
    // Sugestão: um pouco acima do que a família fez na semana passada (mínimo 30).
    const last = M.challengeProgress(S(), { start: addDays(ws, -7), end: addDays(ws, -1), goal: 1 }).total;
    editItem('challenges', el.dataset.id, {
      title: 'desafio da família',
      fields: [
        { name: 'title', label: 'Desafio', required: true, placeholder: 'Ex.: Semana da casa brilhante' },
        { name: 'goal', label: 'Objectivo (pontos de todos juntos) ⭐', type: 'number', min: 1, required: true, half: true },
        { name: 'reward', label: 'Prémio para a família', required: true, half: true, placeholder: 'Ex.: Noite de pizza e filme' },
        { name: 'start', label: 'Começa', type: 'date', required: true, half: true },
        { name: 'end', label: 'Acaba', type: 'date', required: true, half: true },
        { name: 'members', label: 'Quem participa? (nenhum = todos)', type: 'members' },
      ],
      defaults: () => ({
        title: 'Desafio da semana', goal: Math.max(30, Math.ceil((last * 1.2) / 5) * 5), reward: 'Noite de pizza e filme 🍕🎬',
        start: ws, end: addDays(ws, 6), members: [], delivered: false,
      }),
    });
  }

  /* ---------- Festejos (uma vez por novidade, neste aparelho) ---------- */
  function celebrate() {
    const s = S();
    const me = member(s.currentUser);
    if (!me) return;
    const st = M.stats(s, me, today());
    const now = { lv: st.level.n, badges: M.badges(s, me, today(), st) };
    const key = `pf-festejos-${me.id}`;
    let seen = null;
    try { seen = JSON.parse(localStorage.getItem(key) || 'null'); } catch { /* sem armazenamento */ }
    try { localStorage.setItem(key, JSON.stringify(now)); } catch { /* sem armazenamento */ }
    if (!seen) return; // primeira vez neste aparelho: não festeja o que já tinha
    const news = M.BADGES.filter((b) => now.badges.includes(b.id) && !seen.badges.includes(b.id));
    const up = now.lv > seen.lv;
    if (!news.length && !up) return;
    const box = document.createElement('div');
    box.className = 'celebrate';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'Parabéns');
    const confetti = Array.from({ length: 36 }, (_, i) => `<i style="--x:${(i * 37) % 100}vw;--d:${(i % 7) * 0.12}s;--r:${(i * 53) % 360}deg">${['🎉', '⭐', '✨', '🎊'][i % 4]}</i>`).join('');
    box.innerHTML = `${confetti}<div class="celebrate-card">
      <h2>Parabéns, ${esc(me.name)}! 🎉</h2>
      ${up ? `<p class="celebrate-big">${st.level.emoji}</p><p>Subiste para o <b>nível ${st.level.n}</b> — ${esc(st.level.name)}!</p>` : ''}
      ${news.map((b) => `<p><span class="celebrate-badge">${b.emoji}</span> Nova medalha: <b>${esc(b.name)}</b><br><small class="muted">${esc(b.desc)}</small></p>`).join('')}
      <button class="btn primary" data-action="celebrate-close">Boa! 💪</button></div>`;
    document.body.appendChild(box);
  }

  /* ---------- Ligações ---------- */
  const route = Views.routes.find((r) => r[0] === 'tarefas');
  const listView = route[3];
  route[3] = () => {
    const tab = VS.taskTab || 'lista';
    if (tab === 'lista') return listView();
    return `<div class="page-head"><h1>Tarefas</h1><div class="quick">${addBtn('add-task', 'Tarefa')}</div></div>
      ${tabs()}${tab === 'ideias' ? ideias() : conquistas()}`;
  };
  Views.taskHooks = { tabs, side };

  const actions = {
    'task-tab': (el) => { VS.taskTab = el.dataset.id; render(); window.scrollTo(0, 0); },
    'idea-area': (el) => { VS.ideaArea = el.dataset.id; render(); },
    'idea-for': (el) => { VS.ideaFor = el.dataset.id; render(); },
    'idea-add': (el) => addIdea(el.dataset.id),
    'idea-plan': planWeek,
    'add-challenge': challengeForm,
    'edit-challenge': challengeForm,
    'challenge-delivered': (el) => Store.update((s) => {
      const c = s.challenges.find((x) => x.id === el.dataset.id);
      if (c) c.delivered = true;
    }),
    'celebrate-close': (el) => el.closest('.celebrate')?.remove(),
  };

  function onInput(el) {
    if (el.id !== 'idea-search') return;
    VS.ideaQuery = el.value;
    const q = norm(el.value);
    document.querySelectorAll('.ideas .idea').forEach((li) => {
      li.hidden = q && !norm(li.querySelector('.idea-main').textContent).includes(q);
    });
    document.querySelectorAll('.ideas').forEach((ul) => {
      const h = ul.previousElementSibling;
      const any = [...ul.children].some((li) => !li.hidden);
      ul.hidden = !any;
      if (h) h.hidden = !any;
    });
  }

  function afterRender() {
    if (!document.querySelector('.celebrate')) celebrate();
  }

  return { actions, onInput, afterRender };
};
