/* Vistas (cada secção do portal devolve HTML) e definições dos formulários. */
(function () {
  const {
    esc, today, addDays, fmtDate, fmtLongDate, relDay, daysBetween, parseISO, toISO,
    DIAS, MESES, money,
  } = U;
  const { member, memberOptions, chips, avatar, colorOf, eventsOn, classesOn, itemsOn } = UI;
  const S = () => Store.state;

  /* Estado da interface (não persistido). */
  const VS = {
    calMonth: today().slice(0, 7),
    calDay: today(),
    schoolMember: null,
    taskFilter: 'mine',
  };

  /* ---------- Opções e formulários ---------- */
  const REPEAT_LABEL = { none: '', daily: 'todos os dias', weekly: 'semanal', monthly: 'mensal', yearly: 'anual' };
  const SHOP_CATS = ['Mercearia', 'Frescos', 'Talho/Peixaria', 'Padaria', 'Limpeza', 'Higiene', 'Farmácia', 'Escola', 'Outro'];
  const TASK_CATS = ['Casa', 'Quarto', 'Cozinha', 'Roupa', 'Animais', 'Escola', 'Saúde', 'Recados', 'Outro'];

  const Forms = {
    event: () => [
      { name: 'title', label: 'Título', required: true, placeholder: 'Ex.: Consulta, treino, aniversário…' },
      { name: 'date', label: 'Data', type: 'date', required: true, half: true },
      { name: 'repeat', label: 'Repete-se?', type: 'select', half: true, options: [['none', 'Não'], ['weekly', 'Todas as semanas'], ['monthly', 'Todos os meses'], ['yearly', 'Todos os anos']] },
      { name: 'start', label: 'Início', type: 'time', half: true },
      { name: 'end', label: 'Fim', type: 'time', half: true },
      { name: 'location', label: 'Local', half: true },
      { name: 'until', label: 'Repetir até (opcional)', type: 'date', half: true },
      { name: 'members', label: 'Quem está envolvido?', type: 'members' },
      { name: 'driver', label: 'Quem leva / vai buscar?', type: 'select', options: memberOptions(true, '—') },
      { name: 'notes', label: 'Notas', type: 'textarea' },
    ],
    task: () => [
      { name: 'title', label: 'Tarefa', required: true, placeholder: 'Ex.: Tirar o lixo' },
      { name: 'assignee', label: 'Responsável', type: 'select', half: true, options: memberOptions(true, 'Por atribuir') },
      { name: 'due', label: 'Data limite', type: 'date', half: true },
      { name: 'repeat', label: 'Repete-se?', type: 'select', half: true, options: [['none', 'Não'], ['daily', 'Todos os dias'], ['weekly', 'Todas as semanas'], ['monthly', 'Todos os meses']] },
      { name: 'points', label: 'Pontos ⭐', type: 'number', min: 0, half: true, default: 2 },
      { name: 'category', label: 'Categoria', type: 'select', options: TASK_CATS.map((c) => [c, c]) },
      { name: 'notes', label: 'Notas', type: 'textarea' },
    ],
    reward: () => [
      { name: 'title', label: 'Recompensa', required: true, placeholder: 'Ex.: Escolher o filme' },
      { name: 'cost', label: 'Custo em pontos ⭐', type: 'number', min: 1, required: true, default: 20 },
    ],
    class: () => [
      { name: 'subject', label: 'Disciplina', required: true },
      { name: 'day', label: 'Dia', type: 'select', half: true, options: [1, 2, 3, 4, 5, 6].map((d) => [d, DIAS[d]]) },
      { name: 'memberId', label: 'Aluna/o', type: 'select', half: true, options: memberOptions(false) },
      { name: 'start', label: 'Início', type: 'time', required: true, half: true },
      { name: 'end', label: 'Fim', type: 'time', required: true, half: true },
      { name: 'room', label: 'Sala', half: true },
      { name: 'teacher', label: 'Professor/a', half: true },
    ],
    exam: () => [
      { name: 'subject', label: 'Disciplina', required: true, half: true },
      { name: 'kind', label: 'Tipo', type: 'select', half: true, options: ['Teste', 'Trabalho', 'Apresentação', 'Exame', 'Ficha', 'Reunião de pais', 'Visita de estudo', 'Outro'].map((k) => [k, k]) },
      { name: 'date', label: 'Data', type: 'date', required: true, half: true },
      { name: 'memberId', label: 'Aluna/o', type: 'select', half: true, options: memberOptions(false) },
      { name: 'notes', label: 'Matéria / notas', type: 'textarea' },
      { name: 'grade', label: 'Nota obtida (opcional)', half: true },
    ],
    project: () => [
      { name: 'title', label: 'Projecto', required: true, placeholder: 'Ex.: Organizar a garagem' },
      { name: 'description', label: 'Descrição', type: 'textarea' },
      { name: 'deadline', label: 'Prazo', type: 'date', half: true },
      { name: 'members', label: 'Quem participa?', type: 'members' },
    ],
    trip: () => [
      { name: 'destination', label: 'Destino / nome da viagem', required: true },
      { name: 'start', label: 'Partida', type: 'date', required: true, half: true },
      { name: 'end', label: 'Regresso', type: 'date', half: true },
      { name: 'budget', label: 'Orçamento (€)', type: 'number', min: 0, step: '0.01', half: true },
      { name: 'lodging', label: 'Alojamento', half: true },
      { name: 'members', label: 'Quem vai?', type: 'members' },
      { name: 'notes', label: 'Notas (voos, reservas, ideias…)', type: 'textarea' },
    ],
    contact: () => [
      { name: 'name', label: 'Nome', required: true },
      { name: 'category', label: 'Categoria', type: 'select', half: true, options: ['Escola', 'Saúde', 'Actividades', 'Família', 'Casa', 'Emergência', 'Outro'].map((c) => [c, c]) },
      { name: 'phone', label: 'Telefone', type: 'tel', half: true },
      { name: 'email', label: 'Email', type: 'email' },
      { name: 'notes', label: 'Notas', type: 'textarea' },
    ],
    member: () => [
      { name: 'name', label: 'Nome', required: true, half: true },
      { name: 'emoji', label: 'Emoji', half: true },
      { name: 'color', label: 'Cor', type: 'color', half: true },
      { name: 'birthday', label: 'Data de nascimento', type: 'date', half: true },
      { name: 'role', label: 'Papel na família', type: 'select', half: true, options: [['pai', 'Pai'], ['mae', 'Mãe'], ['filha', 'Filha'], ['filho', 'Filho'], ['outro', 'Outro']] },
    ],
  };

  /* ---------- Pedaços reutilizáveis ---------- */
  const OPEN_ACTION = {
    event: 'edit-event', exam: 'edit-exam', task: 'edit-task', trip: 'goto-trip', bday: 'edit-member',
    sdate: 'edit-date', health: 'edit-health', doc: 'edit-doc', bill: 'edit-bill',
  };

  function itemRow(it, date) {
    return `<li class="item" style="--c:${esc(colorOf(it.members))}">
      <button class="item-main" data-action="${OPEN_ACTION[it.kind]}" data-id="${esc(it.id)}">
        ${date ? `<span class="when">${esc(fmtDate(date))}</span>` : ''}
        ${it.time ? `<span class="time">${esc(it.time)}</span>` : ''}
        <span class="title">${esc(it.title)}</span>
      </button>
      <span class="avatars">${(it.members || []).map((m) => avatar(m, 'sm')).join('')}</span>
    </li>`;
  }

  function taskRow(t) {
    const overdue = !t.done && t.due && t.due < today();
    const meta = [
      !t.done && t.pending ? `⏳ feita por ${member(t.pending.by)?.name || '?'}, à espera de aprovação` : '',
      t.done ? `feita ${relDay(t.doneAt || today())}` : (t.due ? relDay(t.due) : 'sem data'),
      REPEAT_LABEL[t.repeat] || '',
      t.points ? `⭐ ${t.points}` : '',
      t.category || '',
    ].filter(Boolean).join(' · ');
    const pending = !t.done && t.pending;
    const action = t.done ? 'reopen-task' : pending ? (Store.isParent() ? 'approve-task' : 'pending-info') : 'complete-task';
    const label = t.done ? 'Marcar como por fazer' : pending ? 'À espera de aprovação' : 'Marcar como feita';
    return `<li class="task ${t.done ? 'done' : ''} ${pending ? 'pending' : ''} ${overdue ? 'overdue' : ''}">
      <button class="check" data-action="${action}" data-id="${t.id}" aria-label="${label}" title="${label}">${t.done ? '✔' : pending ? '⏳' : ''}</button>
      <button class="task-main" data-action="edit-task" data-id="${t.id}">
        <span class="title">${esc(t.title)}</span><span class="meta">${esc(meta)}</span>
      </button>
      ${avatar(t.assignee, 'sm')}
    </li>`;
  }

  const empty = (msg) => `<p class="empty">${msg}</p>`;
  const card = (title, body, { action = '', cls = '' } = {}) =>
    `<section class="card ${cls}"><header class="card-head"><h2>${title}</h2>${action}</header>${body}</section>`;
  const addBtn = (action, label = 'Adicionar', extra = '') =>
    `<button class="btn small" data-action="${action}" ${extra}>＋ ${label}</button>`;

  function progress(done, total) {
    const pct = total ? Math.round((done / total) * 100) : 0;
    return `<div class="progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
      <span style="width:${pct}%"></span></div><small class="muted">${done}/${total} · ${pct}%</small>`;
  }

  function leaderboard() {
    const ms = [...S().members].sort((a, b) => b.points - a.points);
    const max = Math.max(1, ...ms.map((m) => m.points));
    return `<ol class="leader">${ms.map((m, i) => `<li>
      <span class="rank">${['🥇', '🥈', '🥉'][i] || i + 1}</span>${avatar(m.id)}
      <span class="lname">${esc(m.name)}</span>
      <span class="bar"><span style="width:${(m.points / max) * 100}%;background:${esc(m.color)}"></span></span>
      <b>${m.points}</b></li>`).join('')}</ol>`;
  }

  /** Tarefas feitas pelas filhas e pedidos de recompensas à espera dos pais. */
  function approvals() {
    const s = S();
    const tasks = s.tasks.filter((t) => !t.done && t.pending);
    const reds = s.redemptions.filter((r) => r.status === 'pending');
    if (!tasks.length && !reds.length) return '';
    const parent = Store.isParent();
    const btns = (a, r, id) => (parent ? `<span class="approve-btns">
      <button class="btn small primary" data-action="${a}" data-id="${id}">Aprovar</button>
      <button class="btn small ghost" data-action="${r}" data-id="${id}">Recusar</button></span>` : '<span class="muted small">⏳ à espera</span>');
    return card(`🙋 ${parent ? 'Para aprovar' : 'À espera dos pais'} (${tasks.length + reds.length})`, `<ul class="list">
      ${tasks.map((t) => `<li class="approval">${avatar(t.pending.by, 'sm')}<span class="title">✅ ${esc(t.title)}
        <small class="muted">· ⭐ ${Number(t.points) || 0}</small></span>${btns('approve-task', 'reject-task', t.id)}</li>`).join('')}
      ${reds.map((r) => `<li class="approval">${avatar(r.memberId, 'sm')}<span class="title">🎁 ${esc(r.title)}
        <small class="muted">· ⭐ ${r.cost}</small></span>${btns('approve-redeem', 'reject-redeem', r.id)}</li>`).join('')}
    </ul>`, { cls: 'approvals' });
  }

  function pendingTasks(filterFn = () => true) {
    return S().tasks.filter((t) => !t.done && filterFn(t))
      .sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
  }

  /* ---------- Painel ---------- */
  function painel() {
    const s = S();
    const t = today();
    const me = member(s.currentUser);
    const hour = new Date().getHours();
    const hello = hour < 13 ? 'Bom dia' : hour < 20 ? 'Boa tarde' : 'Boa noite';

    const todayItems = itemsOn(t);
    const overdue = pendingTasks((x) => x.due && x.due < t);
    const hojeBody = (todayItems.length || overdue.length)
      ? `<ul class="list">${overdue.map((x) => itemRow({ kind: 'task', id: x.id, title: `⚠️ Atrasada: ${x.title}`, members: [x.assignee] })).join('')}
         ${todayItems.map((it) => itemRow(it)).join('')}</ul>`
      : empty('Nada marcado para hoje. Dia tranquilo! ☀️');

    const students = s.members.filter((m) => s.classes.some((c) => c.memberId === m.id));
    const escolaBody = students.map((m) => {
      const cl = classesOn(m.id, t);
      if (!cl.length) return `<div class="school-row">${avatar(m.id)}<div><b>${esc(m.name)}</b><br><small class="muted">Sem aulas hoje</small></div></div>`;
      return `<div class="school-row">${avatar(m.id)}<div><b>${esc(m.name)}</b> · entra <b>${esc(cl[0].start)}</b>, sai <b>${esc(cl[cl.length - 1].end)}</b>
        <br><small class="muted">${cl.map((c) => esc(c.subject)).join(' · ')}</small></div></div>`;
    }).join('') || empty('Ainda não há horários. Vai a <a href="#/escola">Escola</a> para os adicionar.');

    const mine = pendingTasks((x) => x.assignee === s.currentUser && (!x.due || x.due <= addDays(t, 2)));
    const mineBody = mine.length ? `<ul class="list">${mine.map(taskRow).join('')}</ul>` : empty('Tudo em dia! 🎉');

    const next = [];
    for (let i = 1; i <= 7; i++) {
      const d = addDays(t, i);
      itemsOn(d).filter((it) => it.kind !== 'task').forEach((it) => next.push(itemRow(it, d)));
    }
    const exams = s.exams.filter((x) => x.date >= t && x.date <= addDays(t, 21)).sort((a, b) => a.date.localeCompare(b.date));
    const examsBody = exams.length ? `<ul class="list">${exams.map((x) => itemRow({
      kind: 'exam', id: x.id, title: `${x.kind}: ${x.subject} (${relDay(x.date)})`, members: [x.memberId],
    }, x.date)).join('')}</ul>` : empty('Sem testes ou trabalhos nas próximas 3 semanas.');

    const notes = [...s.notes].sort((a, b) => (!!b.pinned - !!a.pinned) || b.date.localeCompare(a.date)).slice(0, 3);
    const shopLeft = s.shopping.filter((x) => !x.done).length;
    const trip = s.trips.filter((x) => (x.end || x.start) >= t).sort((a, b) => a.start.localeCompare(b.start))[0];

    return `<div class="page-head"><div><h1>${hello}${me ? `, ${esc(me.name)}` : ''}! 👋</h1>
      <p class="muted">${esc(fmtLongDate(t))}</p></div>
      <div class="quick">${addBtn('add-event', 'Compromisso')}${addBtn('add-task', 'Tarefa')}${addBtn('add-note', 'Recado')}</div></div>
      <div class="grid">
        ${approvals()}
        ${Views.painelExtra ? Views.painelExtra() : ''}
        ${card('📅 Hoje', hojeBody, { cls: 'span2' })}
        ${card('🎒 Na escola hoje', escolaBody)}
        ${card(`✅ As minhas tarefas`, mineBody, { action: '<a href="#/tarefas" class="link">Ver todas</a>' })}
        ${card('🗓️ Próximos 7 dias', next.length ? `<ul class="list">${next.join('')}</ul>` : empty('Semana livre por agora.'), { action: '<a href="#/agenda" class="link">Agenda</a>' })}
        ${card('📝 Testes e trabalhos', examsBody, { action: addBtn('add-exam') })}
        ${card('⭐ Pontos da família', leaderboard(), { action: '<a href="#/tarefas" class="link">Recompensas</a>' })}
        ${card('📌 Mural', notes.length ? `<ul class="notes-mini">${notes.map((n) => `<li>${avatar(n.author, 'sm')} <span>${n.pinned ? '📌 ' : ''}${esc(n.text)}</span></li>`).join('')}</ul>` : empty('Sem recados.'), { action: '<a href="#/mural" class="link">Abrir</a>' })}
        ${card('🛒 Compras', `<p class="big">${shopLeft}</p><p class="muted">${shopLeft === 1 ? 'item por comprar' : 'itens por comprar'}</p>`, { action: '<a href="#/compras" class="link">Lista</a>' })}
        ${card('✈️ Próxima viagem', trip ? `<p class="big">${trip.start > t ? daysBetween(t, trip.start) : '🧳'}</p>
          <p><b>${esc(trip.destination)}</b><br><span class="muted">${trip.start > t ? 'dias até partir' : 'a decorrer!'} · ${esc(fmtDate(trip.start))}</span></p>`
          : empty('Nenhuma viagem planeada.'), { action: '<a href="#/viagens" class="link">Viagens</a>' })}
      </div>`;
  }

  /* ---------- Agenda ---------- */
  function agenda() {
    const [y, m] = VS.calMonth.split('-').map(Number);
    const first = new Date(y, m - 1, 1);
    const offset = (first.getDay() + 6) % 7; // semana começa à segunda
    const daysInMonth = new Date(y, m, 0).getDate();
    const cells = Math.ceil((offset + daysInMonth) / 7) * 7;
    const t = today();
    let grid = '';
    for (let i = 0; i < cells; i++) {
      const d = toISO(new Date(y, m - 1, 1 - offset + i));
      const inMonth = d.slice(0, 7) === VS.calMonth;
      const items = itemsOn(d);
      grid += `<button class="cal-cell ${inMonth ? '' : 'out'} ${d === t ? 'today' : ''} ${d === VS.calDay ? 'sel' : ''}"
        data-action="cal-day" data-date="${d}" aria-label="${esc(fmtLongDate(d))}, ${items.length} itens">
        <span class="num">${parseISO(d).getDate()}</span>
        ${items.slice(0, 3).map((it) => `<span class="pill" style="--c:${esc(colorOf(it.members))}">${esc(it.time ? `${it.time} ` : '')}${esc(it.title)}</span>`).join('')}
        ${items.length > 3 ? `<span class="more">+${items.length - 3}</span>` : ''}
        ${items.length ? `<span class="dots">${items.slice(0, 4).map((it) => `<i style="background:${esc(colorOf(it.members))}"></i>`).join('')}</span>` : ''}
      </button>`;
    }
    const dayItems = itemsOn(VS.calDay);
    const dayClasses = S().members.map((mm) => ({ mm, cl: classesOn(mm.id, VS.calDay) })).filter((x) => x.cl.length);

    return `<div class="page-head"><h1>Agenda</h1>
      <div class="quick"><button class="btn small ghost" data-action="export-ics" title="Descarregar para importar noutro calendário">⬇️ .ics</button>
        ${addBtn('add-event', 'Compromisso', `data-date="${VS.calDay}"`)}</div></div>
      <div class="agenda">
        <section class="card cal">
          <header class="cal-head">
            <button class="icon-btn" data-action="cal-prev" aria-label="Mês anterior">‹</button>
            <h2>${MESES[m - 1]} ${y}</h2>
            <button class="icon-btn" data-action="cal-next" aria-label="Mês seguinte">›</button>
            <button class="btn small ghost" data-action="cal-today">Hoje</button>
          </header>
          <div class="cal-grid">${['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((d) => `<span class="dow">${d}</span>`).join('')}${grid}</div>
        </section>
        <section class="card">
          <header class="card-head"><h2>${esc(fmtLongDate(VS.calDay))}</h2></header>
          ${dayItems.length ? `<ul class="list">${dayItems.map((it) => itemRow(it)).join('')}</ul>` : empty('Nada marcado neste dia.')}
          ${dayClasses.length ? `<h3 class="sub">Escola</h3>${dayClasses.map(({ mm, cl }) =>
            `<div class="school-row">${avatar(mm.id)}<div><b>${esc(mm.name)}</b> ${esc(cl[0].start)}–${esc(cl[cl.length - 1].end)}</div></div>`).join('')}` : ''}
          <div class="legend">${S().members.map((mm) => UI.chip(mm.id)).join('')}</div>
        </section>
      </div>
      ${Views.agendaExtra ? Views.agendaExtra() : ''}`;
  }

  /* ---------- Escola ---------- */
  function escola() {
    const s = S();
    if (!member(VS.schoolMember)) {
      VS.schoolMember = (s.members.find((m) => m.role === 'filha') || s.members[0])?.id;
    }
    const id = VS.schoolMember;
    const cls = s.classes.filter((c) => c.memberId === id);
    const days = cls.some((c) => Number(c.day) === 6) ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5];
    const todayWd = parseISO(today()).getDay();
    const cols = days.map((d) => {
      const list = cls.filter((c) => Number(c.day) === d).sort((a, b) => a.start.localeCompare(b.start));
      return `<div class="tt-col ${d === todayWd ? 'is-today' : ''}"><h3>${DIAS[d]}</h3>
        ${list.map((c) => `<button class="tt-block" data-action="edit-class" data-id="${c.id}" style="--c:${esc(colorOf([id]))}">
          <span class="time">${esc(c.start)}–${esc(c.end)}</span><b>${esc(c.subject)}</b>
          ${c.room || c.teacher ? `<small>${esc([c.room && `Sala ${c.room}`, c.teacher].filter(Boolean).join(' · '))}</small>` : ''}
        </button>`).join('') || '<p class="empty small">Livre</p>'}
        <button class="tt-add" data-action="add-class" data-day="${d}" aria-label="Adicionar aula na ${DIAS[d]}">＋</button>
      </div>`;
    }).join('');

    const t = today();
    const exams = s.exams.filter((x) => x.memberId === id).sort((a, b) => a.date.localeCompare(b.date));
    const up = exams.filter((x) => x.date >= t);
    const past = exams.filter((x) => x.date < t).reverse();
    const examBtn = (x) => `<button class="item-main" data-action="edit-exam" data-id="${x.id}">
      <span class="when">${esc(fmtDate(x.date))}</span><span class="title">${esc(x.kind)}: ${esc(x.subject)}${x.notes ? ` — <span class="muted">${esc(x.notes)}</span>` : ''}</span>
      ${x.grade ? `<span class="grade">${esc(x.grade)}</span>` : ''}</button>`;
    const examLi = (x) => `<li class="item" style="--c:${esc(colorOf([id]))}">${examBtn(x)}</li>`;
    // Próximos testes: com os tópicos a estudar e o progresso.
    const examStudy = (x) => {
      const topics = x.topics || [];
      const done = topics.filter((tp) => tp.done).length;
      return `<li class="exam-study"><div class="item" style="--c:${esc(colorOf([id]))}">${examBtn(x)}</div>
        <div class="topics">
          ${topics.length ? progress(done, topics.length) : '<small class="muted">📚 Divide a matéria em tópicos e vai marcando o que já estudaste.</small>'}
          <ul class="steps">${topics.map((tp) => `<li class="${tp.done ? 'done' : ''}">
            <label><input type="checkbox" data-action="toggle-topic" data-id="${x.id}" data-sub="${tp.id}" ${tp.done ? 'checked' : ''}> ${esc(tp.text)}</label>
            <button class="icon-btn small" data-action="del-topic" data-id="${x.id}" data-sub="${tp.id}" aria-label="Remover tópico">✕</button></li>`).join('')}</ul>
          <form class="inline-add" data-form="add-topic" data-id="${x.id}">
            <input name="text" placeholder="Tópico a estudar…" required aria-label="Novo tópico"><button class="btn small">＋</button></form>
        </div></li>`;
    };

    return `<div class="page-head"><h1>Escola</h1>
      <div class="quick">${addBtn('add-class', 'Aula')}${addBtn('add-exam', 'Teste / trabalho')}</div></div>
      <div class="tabs" role="tablist">${s.members.map((m) => `<button role="tab" aria-selected="${m.id === id}" class="tab ${m.id === id ? 'active' : ''}"
        data-action="school-tab" data-id="${m.id}" style="--c:${esc(m.color)}">${esc(m.emoji)} ${esc(m.name)}</button>`).join('')}</div>
      <section class="card"><header class="card-head"><h2>Horário semanal</h2>
        ${cls.length ? `<button class="btn small ghost" data-action="clear-classes">Limpar horário</button>` : ''}</header>
        <div class="timetable" style="--cols:${days.length}">${cols}</div></section>
      <div class="grid two">
        ${card('📝 Próximos testes e trabalhos', up.length ? `<ul class="list">${up.map(examStudy).join('')}</ul>` : empty('Nada agendado.'), { action: addBtn('add-exam') })}
        ${card('📚 Histórico e notas', past.length ? `<ul class="list">${past.map(examLi).join('')}</ul>` : empty('Aqui aparecem os testes já feitos (podes registar a nota).'))}
      </div>`;
  }

  /* ---------- Tarefas ---------- */
  function tarefas() {
    const s = S();
    const t = today();
    const f = VS.taskFilter;
    const match = (x) => f === 'all' || (f === 'mine' ? x.assignee === s.currentUser : f === 'none' ? !x.assignee : x.assignee === f);
    const pend = pendingTasks(match);
    const groups = [
      ['⚠️ Atrasadas', pend.filter((x) => x.due && x.due < t)],
      ['📍 Hoje', pend.filter((x) => x.due === t)],
      ['🔜 Próximas', pend.filter((x) => x.due && x.due > t)],
      ['🗂️ Sem data', pend.filter((x) => !x.due)],
    ].filter(([, l]) => l.length);
    const done = s.tasks.filter((x) => x.done && match(x)).sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || '')).slice(0, 10);

    const filters = [['mine', 'As minhas'], ['all', 'Todas'], ...s.members.map((m) => [m.id, `${m.emoji} ${m.name}`]), ['none', 'Por atribuir']];
    const me = member(s.currentUser);
    const parent = Store.isParent();
    const rewards = s.rewards.map((r) => `<li class="reward"><button class="reward-main" data-action="${parent ? 'edit-reward' : 'noop'}" data-id="${r.id}">
        <span>${esc(r.title)}</span><small class="muted">⭐ ${r.cost}</small></button>
        <button class="btn small ${me && me.points >= r.cost ? 'primary' : ''}" data-action="redeem" data-id="${r.id}"
          ${me && me.points >= r.cost ? '' : 'disabled'}>${parent ? 'Trocar' : 'Pedir'}</button></li>`).join('');
    const STATUS = { pending: '⏳', approved: '✔', rejected: '✕' };
    const hist = [...s.redemptions].filter((r) => r.status !== 'pending').reverse().slice(0, 6).map((r) =>
      `<li>${avatar(r.memberId, 'sm')} ${STATUS[r.status] || '✔'} ${esc(r.title)} <small class="muted">· ${esc(fmtDate(r.date))}</small></li>`).join('');

    const hooks = window.Views.taskHooks || {};
    return `<div class="page-head"><h1>Tarefas</h1><div class="quick">${addBtn('add-task', 'Tarefa')}</div></div>
      ${hooks.tabs?.() || ''}
      <div class="filters">${filters.map(([v, l]) => `<button class="filter ${f === v ? 'active' : ''}" data-action="task-filter" data-id="${esc(v)}">${esc(l)}</button>`).join('')}</div>
      <div class="grid two wide-left">
        <section class="card">
          ${groups.map(([title, list]) => `<h3 class="sub">${title} <small class="muted">(${list.length})</small></h3><ul class="list">${list.map(taskRow).join('')}</ul>`).join('')
            || empty('Não há tarefas pendentes aqui. 🎉')}
          ${done.length ? `<details class="done-list"><summary>Concluídas recentemente (${done.length})</summary><ul class="list">${done.map(taskRow).join('')}</ul></details>` : ''}
        </section>
        <div class="stack">
          ${approvals()}
          ${hooks.side?.() || ''}
          ${card('⭐ Pontos', leaderboard())}
          ${card('🎁 Recompensas', `<p class="muted small">Troca os teus pontos${me ? ` (tens <b>${me.points}</b>)` : ''}.</p><ul class="rewards">${rewards}</ul>
            ${hist ? `<h3 class="sub">Últimas trocas</h3><ul class="hist">${hist}</ul>` : ''}`, { action: parent ? addBtn('add-reward') : '' })}
        </div>
      </div>`;
  }

  /* ---------- Projectos ---------- */
  function projectos() {
    const list = [...S().projects].sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999'));
    const body = list.map((p) => {
      const done = p.steps.filter((x) => x.done).length;
      return `<section class="card project">
        <header class="card-head"><h2>${esc(p.title)}</h2><button class="icon-btn" data-action="edit-project" data-id="${p.id}" aria-label="Editar projecto">✎</button></header>
        ${p.description ? `<p>${esc(p.description)}</p>` : ''}
        <p class="meta-line">${chips(p.members)}${p.deadline ? `<span class="muted">⏳ ${esc(fmtDate(p.deadline))} (${relDay(p.deadline)})</span>` : ''}</p>
        ${progress(done, p.steps.length)}
        <ul class="steps">${p.steps.map((st) => `<li class="${st.done ? 'done' : ''}">
          <label><input type="checkbox" data-action="toggle-step" data-id="${p.id}" data-sub="${st.id}" ${st.done ? 'checked' : ''}> ${esc(st.text)}</label>
          <button class="icon-btn small" data-action="del-step" data-id="${p.id}" data-sub="${st.id}" aria-label="Remover passo">✕</button></li>`).join('')}</ul>
        <form class="inline-add" data-form="add-step" data-id="${p.id}">
          <input name="text" placeholder="Novo passo…" required aria-label="Novo passo"><button class="btn small">Adicionar</button></form>
      </section>`;
    }).join('');
    return `<div class="page-head"><h1>Projectos</h1><div class="quick">${addBtn('add-project', 'Projecto')}</div></div>
      <p class="muted">Obras em casa, trabalhos de grupo, festas de anos, mudar de carro… dividam em passos e acompanhem o progresso.</p>
      <div class="grid two">${body || empty('Ainda não há projectos.')}</div>`;
  }

  /* ---------- Viagens ---------- */
  function viagens() {
    const t = today();
    const list = [...S().trips].sort((a, b) => b.start.localeCompare(a.start));
    const upcoming = list.filter((x) => (x.end || x.start) >= t).reverse();
    const past = list.filter((x) => (x.end || x.start) < t);
    const tripCard = (tr) => {
      const spent = (tr.expenses || []).reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
      const packDone = tr.packing.filter((p) => p.done).length;
      const until = daysBetween(t, tr.start);
      const nights = tr.end ? daysBetween(tr.start, tr.end) : 0;
      const groups = [['', '👪 Família'], ...(tr.members || []).map((id) => [id, `${member(id)?.emoji || ''} ${member(id)?.name || ''}`])];
      return `<section class="card trip" id="trip-${tr.id}">
        <header class="card-head"><h2>✈️ ${esc(tr.destination)}</h2><button class="icon-btn" data-action="edit-trip" data-id="${tr.id}" aria-label="Editar viagem">✎</button></header>
        <p class="meta-line"><span>${esc(fmtDate(tr.start))}${tr.end ? ` → ${esc(fmtDate(tr.end))}` : ''}${nights > 0 ? ` · ${nights} noites` : ''}</span>
          ${until > 0 ? `<span class="badge">faltam ${until} dias</span>` : until <= 0 && (tr.end || tr.start) >= t ? '<span class="badge">a decorrer</span>' : ''}</p>
        <p class="meta-line">${chips(tr.members)}${(S().photos || []).some((ph) => ph.tripId === tr.id)
          ? `<a class="link" href="#/memorias" data-action="photos-trip" data-id="${tr.id}">📸 ${S().photos.filter((ph) => ph.tripId === tr.id).length} fotos</a>` : ''}</p>
        ${tr.lodging ? `<p>🏨 ${esc(tr.lodging)}</p>` : ''}
        ${tr.notes ? `<p class="muted pre">${esc(tr.notes)}</p>` : ''}
        <h3 class="sub">🧳 Mala e preparativos</h3>${progress(packDone, tr.packing.length)}
        ${groups.map(([gid, label]) => {
          const items = tr.packing.filter((p) => (p.memberId || '') === gid);
          if (!items.length) return '';
          return `<p class="group-label">${esc(label)}</p><ul class="steps">${items.map((p) => `<li class="${p.done ? 'done' : ''}">
            <label><input type="checkbox" data-action="toggle-pack" data-id="${tr.id}" data-sub="${p.id}" ${p.done ? 'checked' : ''}> ${esc(p.text)}</label>
            <button class="icon-btn small" data-action="del-pack" data-id="${tr.id}" data-sub="${p.id}" aria-label="Remover">✕</button></li>`).join('')}</ul>`;
        }).join('')}
        <form class="inline-add" data-form="add-pack" data-id="${tr.id}">
          <select name="memberId" aria-label="Para quem">${groups.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('')}</select>
          <input name="text" placeholder="Item a levar / tratar…" required aria-label="Item"><button class="btn small">＋</button></form>
        <h3 class="sub">💶 Orçamento</h3>
        ${tr.budget ? `${progress(Math.round(spent), Math.round(tr.budget))}<p class="small">${money(spent)} gastos de ${money(tr.budget)} · restam <b>${money(tr.budget - spent)}</b></p>` : `<p class="small">Total gasto: <b>${money(spent)}</b></p>`}
        <ul class="expenses">${(tr.expenses || []).map((e) => `<li><span>${esc(e.text)}</span><span>${money(e.amount)}</span>
          <button class="icon-btn small" data-action="del-expense" data-id="${tr.id}" data-sub="${e.id}" aria-label="Remover despesa">✕</button></li>`).join('')}</ul>
        <form class="inline-add" data-form="add-expense" data-id="${tr.id}">
          <input name="text" placeholder="Despesa (voos, hotel…)" required aria-label="Despesa">
          <input name="amount" type="number" step="0.01" min="0" placeholder="€" required aria-label="Valor" class="num"><button class="btn small">＋</button></form>
      </section>`;
    };
    return `<div class="page-head"><h1>Viagens</h1><div class="quick">${addBtn('add-trip', 'Viagem')}</div></div>
      <div class="grid two">${upcoming.map(tripCard).join('') || empty('Nenhuma viagem planeada. Que tal começar a sonhar com a próxima? 🌍')}</div>
      ${past.length ? `<details class="card"><summary><b>Viagens anteriores (${past.length})</b></summary><div class="grid two">${past.map(tripCard).join('')}</div></details>` : ''}`;
  }

  /* ---------- Compras ---------- */
  function compras() {
    const s = S();
    const cats = [...new Set([...SHOP_CATS, ...s.shopping.map((x) => x.category || 'Outro')])];
    const pending = s.shopping.filter((x) => !x.done);
    const bought = s.shopping.filter((x) => x.done);
    const row = (x) => `<li class="shop ${x.done ? 'done' : ''}">
      <label><input type="checkbox" data-action="toggle-shop" data-id="${x.id}" ${x.done ? 'checked' : ''}>
        <span>${esc(x.text)}${x.qty ? ` <small class="muted">× ${esc(x.qty)}</small>` : ''}</span></label>
      ${avatar(x.addedBy, 'sm')}
      <button class="icon-btn small" data-action="del-shop" data-id="${x.id}" aria-label="Remover">✕</button></li>`;
    return `<div class="page-head"><h1>Lista de compras</h1>
      ${bought.length ? '<div class="quick"><button class="btn small ghost" data-action="clear-shop">Limpar comprados</button></div>' : ''}</div>
      <section class="card">
        <form class="inline-add big-add" data-form="add-shop">
          <input name="text" placeholder="O que falta em casa?" required aria-label="Item">
          <input name="qty" placeholder="Qtd." class="num" aria-label="Quantidade">
          <select name="category" aria-label="Categoria">${SHOP_CATS.map((c) => `<option>${esc(c)}</option>`).join('')}</select>
          <button class="btn primary">Adicionar</button>
        </form>
        ${cats.map((c) => {
          const items = pending.filter((x) => (x.category || 'Outro') === c);
          return items.length ? `<h3 class="sub">${esc(c)}</h3><ul class="list">${items.map(row).join('')}</ul>` : '';
        }).join('') || empty('A lista está vazia. 🧺')}
        ${bought.length ? `<details class="done-list"><summary>No carrinho (${bought.length})</summary><ul class="list">${bought.map(row).join('')}</ul></details>` : ''}
      </section>`;
  }

  /* ---------- Refeições ---------- */
  function refeicoes() {
    const meals = S().meals;
    const order = [1, 2, 3, 4, 5, 6, 0];
    const wd = parseISO(today()).getDay();
    return `<div class="page-head"><h1>Refeições da semana</h1>
      <div class="quick"><button class="btn small ghost" data-action="clear-meals">Limpar semana</button>
      <button class="btn small" data-action="meals-to-shop">🛒 Ingredientes → compras</button></div></div>
      <p class="muted">Planeiem juntos as refeições. Escrevam os ingredientes a comprar entre parênteses, ex.: <i>Bacalhau à Brás (batata palha, ovos)</i>.</p>
      <section class="card"><div class="meals">
        <span></span><b>Almoço</b><b>Jantar</b><b>Quem cozinha?</b>
        ${order.map((d) => `<b class="${d === wd ? 'is-today' : ''}">${DIAS[d]}</b>
          ${['lunch', 'dinner', 'cook'].map((k) => `<input data-meal="${d}:${k}" value="${esc(meals[d]?.[k] || '')}"
            aria-label="${DIAS[d]} ${k}" placeholder="${k === 'cook' ? '…' : '—'}">`).join('')}`).join('')}
      </div></section>`;
  }

  /* ---------- Mural ---------- */
  function mural() {
    const notes = [...S().notes].sort((a, b) => (!!b.pinned - !!a.pinned) || b.date.localeCompare(a.date));
    return `<div class="page-head"><h1>Mural de recados</h1></div>
      <section class="card"><form class="inline-add big-add" data-form="add-note">
        <textarea name="text" rows="2" placeholder="Deixa um recado à família… (ex.: Hoje chego mais tarde, jantem sem mim ❤️)" required aria-label="Recado"></textarea>
        <button class="btn primary">Publicar</button></form></section>
      <div class="notes">${notes.map((n) => {
        const m = member(n.author);
        return `<article class="note ${n.pinned ? 'pinned' : ''}" style="--c:${esc(m?.color || '#94a3b8')}">
          <header>${avatar(n.author, 'sm')} <b>${esc(m?.name || '—')}</b> <small class="muted">${esc(fmtDate(n.date))}</small>
            <span class="spacer"></span>
            <button class="icon-btn small" data-action="pin-note" data-id="${n.id}" aria-label="${n.pinned ? 'Desafixar' : 'Afixar'}">${n.pinned ? '📌' : '📍'}</button>
            <button class="icon-btn small" data-action="del-note" data-id="${n.id}" aria-label="Apagar recado">✕</button></header>
          <p class="pre">${esc(n.text)}</p></article>`;
      }).join('') || empty('Sem recados.')}</div>`;
  }

  /* ---------- Contactos ---------- */
  function contactos() {
    const list = S().contacts;
    const cats = [...new Set(list.map((c) => c.category || 'Outro'))];
    return `<div class="page-head"><h1>Contactos úteis</h1><div class="quick">${addBtn('add-contact', 'Contacto')}</div></div>
      <div class="grid two">${cats.map((cat) => card(esc(cat), `<ul class="list">${list.filter((c) => (c.category || 'Outro') === cat).map((c) => `<li class="contact">
        <button class="item-main" data-action="edit-contact" data-id="${c.id}"><span class="title">${esc(c.name)}</span>
          ${c.notes ? `<small class="muted">${esc(c.notes)}</small>` : ''}</button>
        ${c.phone ? `<a class="btn small" href="tel:${esc(c.phone.replace(/\s/g, ''))}">📞 ${esc(c.phone)}</a>` : ''}
        ${c.email ? `<a class="btn small ghost" href="mailto:${esc(c.email)}">✉️</a>` : ''}</li>`).join('')}</ul>`)).join('') || empty('Sem contactos.')}</div>`;
  }

  /* ---------- Definições ---------- */
  function definicoes() {
    const s = S();
    const parent = Store.isParent();
    const cloud = window.Cloud?.info() || {};
    const accountCard = Store.isRemote
      ? card('☁️ Conta e partilha', `<p class="small">Ligado como <b>${esc(cloud.email || '')}</b>
          (${esc(member(s.currentUser)?.name || '')}, ${parent ? 'pai/mãe' : 'filha/o'}). Tudo o que fazem sincroniza
          automaticamente entre os telemóveis e computadores da família.</p>
          ${parent ? `<div id="invite-codes" class="invites"><p class="muted small">A carregar códigos de convite…</p></div>` : ''}
          ${cloud.accounts?.length ? `<h3 class="sub">Contas ligadas</h3><p>${cloud.accounts.map((a) => UI.chip(a.member_id)).join('')}</p>` : ''}
          <div class="btn-row"><button class="btn ghost" data-action="sign-out">Terminar sessão</button></div>`)
      : card('☁️ Partilhar com a família', window.Cloud?.configured
        ? `<p class="small">Os dados estão só neste dispositivo. Entra ou cria uma conta para partilhar o portal
            com a família em tempo real, cada um no seu telemóvel.</p>
            <div class="btn-row"><button class="btn primary" data-action="go-cloud">Entrar / criar conta</button></div>`
        : '<p class="small">A partilha na nuvem ainda não está configurada (ver <code>js/config.js</code>).</p>');
    return `<div class="page-head"><h1>Definições</h1></div>
      <div class="grid two">
        ${accountCard}
        ${Store.isRemote ? card('🔔 Lembretes no telemóvel', '<div id="notify-panel"><p class="muted small">A carregar…</p></div>') : ''}
        ${Store.isRemote ? card('📅 Calendário no telemóvel', '<div id="calendar-panel"><p class="muted small">A carregar…</p></div>') : ''}
        ${card('👪 A família', `<ul class="list">${s.members.map((m) => `<li class="member-row">${avatar(m.id)}
          <div><b>${esc(m.name)}</b><br><small class="muted">${m.birthday ? `🎂 ${esc(fmtDate(m.birthday))}` : 'Sem data de nascimento'} · ⭐ ${m.points}</small></div>
          ${parent ? `<button class="btn small ghost" data-action="edit-member" data-id="${m.id}">Editar</button>` : ''}</li>`).join('')}</ul>
          ${parent ? '' : '<p class="small muted">Só os pais podem alterar os membros.</p>'}`)}
        ${card('💾 Cópia de segurança', `<p class="small">Descarrega uma cópia de todos os dados${Store.isRemote ? '' : `.
          Enquanto não usam a nuvem, também serve para passar os dados para outro dispositivo`}.</p>
          <div class="btn-row"><button class="btn" data-action="export">⬇️ Exportar cópia</button>
          ${Store.isRemote ? '' : '<button class="btn" data-action="import">⬆️ Importar cópia</button>'}</div>
          ${parent ? `<h3 class="sub">Zona de perigo</h3>
          <div class="btn-row">${Store.isRemote ? '' : '<button class="btn ghost" data-action="reset">Repor dados de exemplo</button>'}
          <button class="btn danger" data-action="wipe">Começar do zero</button></div>
          <p class="small muted">"Começar do zero" apaga tudo excepto os membros da família e as recompensas.</p>` : ''}`)}
      </div>`;
  }

  window.Views = {
    VS, Forms,
    /** Peças reutilizadas pelas vistas da Fase 4. */
    h: { card, empty, addBtn, progress, itemRow, taskRow, leaderboard },
    routes: [
      ['painel', '🏠', 'Painel', painel],
      ['agenda', '📅', 'Agenda', agenda],
      ['escola', '🎒', 'Escola', escola],
      ['tarefas', '✅', 'Tarefas', tarefas],
      ['projectos', '🛠️', 'Projectos', projectos],
      ['viagens', '✈️', 'Viagens', viagens],
      ['compras', '🛒', 'Compras', compras],
      ['refeicoes', '🍽️', 'Refeições', refeicoes],
      ['mural', '📌', 'Mural', mural],
      ['contactos', '📞', 'Contactos', contactos],
      ['definicoes', '⚙️', 'Definições', definicoes],
    ],
  };
})();
