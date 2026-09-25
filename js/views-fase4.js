/* Fase 4: finanças, saúde & documentos, votações, memórias, boleias e datas especiais. */
(function () {
  const {
    esc, today, addDays, fmtDate, relDay, daysBetween, parseISO, DIAS, MESES, money,
  } = U;
  const { member, memberOptions, avatar, chip, colorOf, eventsOn } = UI;
  const { card, empty, addBtn, progress } = Views.h;
  const { VS, Forms } = Views;
  const S = () => Store.state;

  const PARENT_ROLES = ['pai', 'mae'];
  const kids = () => S().members.filter((m) => !PARENT_ROLES.includes(m.role));
  const sum = (arr) => arr.reduce((n, x) => n + (Number(x.amount) || 0), 0);
  // Os juros do Banco dos Pais entram directamente no mealheiro (ver js/poupanca.js).
  const wallet = (memberId) => Poupanca.wallet(S().money, memberId);
  const goalSaved = (goalId) => Poupanca.goalSaved(S().money, goalId);
  const signed = (n) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${money(Math.abs(n))}`;
  const WEEKDAYS = DIAS.map((d, i) => [i, d]);

  /* ---------- Formulários ---------- */
  Object.assign(Forms, {
    allowance: () => [
      { name: 'amount', label: 'Valor (€)', type: 'number', min: 0, step: '0.5', required: true, half: true },
      { name: 'frequency', label: 'Frequência', type: 'select', half: true, options: [['weekly', 'Todas as semanas'], ['monthly', 'Todos os meses']] },
      { name: 'weekday', label: 'Dia da semana (se semanal)', type: 'select', half: true, options: WEEKDAYS },
      { name: 'monthDay', label: 'Dia do mês (se mensal)', type: 'number', min: 1, half: true },
      { name: 'active', label: 'Activa?', type: 'select', half: true, options: [['sim', 'Sim'], ['nao', 'Não (pausada)']] },
    ],
    goal: () => [
      { name: 'title', label: 'Objectivo', required: true, placeholder: 'Ex.: Bicicleta, telemóvel, viagem de finalistas' },
      { name: 'emoji', label: 'Emoji', half: true, default: '🐷' },
      { name: 'target', label: 'Quanto custa? (€)', type: 'number', min: 1, step: '0.01', required: true, half: true },
      ...(Store.isParent() ? [{ name: 'memberId', label: 'De quem', type: 'select', options: memberOptions(false) }] : []),
    ],
    bill: () => [
      { name: 'title', label: 'Conta', required: true, placeholder: 'Ex.: Electricidade, seguro, IUC' },
      { name: 'amount', label: 'Valor (€)', type: 'number', min: 0, step: '0.01', half: true },
      { name: 'due', label: 'Próximo pagamento', type: 'date', required: true, half: true },
      { name: 'repeat', label: 'Repete-se', type: 'select', half: true, options: [['monthly', 'Todos os meses'], ['bimonthly', 'De 2 em 2 meses'], ['quarterly', 'De 3 em 3 meses'], ['yearly', 'Todos os anos'], ['none', 'Não']] },
      { name: 'category', label: 'Categoria', type: 'select', half: true, options: ['Casa', 'Carro', 'Seguros', 'Escola', 'Saúde', 'Impostos', 'Subscrições', 'Outro'].map((c) => [c, c]) },
      { name: 'auto', label: 'Débito directo?', type: 'select', half: true, options: [['', 'Não'], ['sim', 'Sim']] },
      { name: 'notes', label: 'Notas', type: 'textarea' },
    ],
    sdate: () => [
      { name: 'title', label: 'O quê', required: true, placeholder: 'Ex.: Anos da avó Rosa, aniversário de casamento' },
      { name: 'date', label: 'Data', type: 'date', required: true, half: true },
      { name: 'knowYear', label: 'O ano está certo?', type: 'select', half: true, options: [['sim', 'Sim (mostra os anos)'], ['nao', 'Não sei o ano']] },
      { name: 'kind', label: 'Tipo', type: 'select', half: true, options: ['Aniversário', 'Aniversário de casamento', 'Dia especial', 'Outro'].map((c) => [c, c]) },
      { name: 'gifts', label: 'Ideias de presentes', type: 'textarea' },
    ],
    health: () => [
      { name: 'memberId', label: 'Quem', type: 'select', half: true, options: memberOptions(false) },
      { name: 'date', label: 'Data', type: 'date', required: true, half: true },
      { name: 'type', label: 'Tipo', type: 'select', half: true, options: ['Consulta', 'Vacina', 'Dentista', 'Ortodontista', 'Oftalmologista', 'Análises', 'Medicação', 'Urgência', 'Outro'].map((c) => [c, c]) },
      { name: 'title', label: 'Descrição', required: true, half: true, placeholder: 'Ex.: Pediatra, vacina do tétano' },
      { name: 'notes', label: 'Notas (receitas, indicações…)', type: 'textarea' },
      { name: 'next', label: 'Próxima vez (opcional)', type: 'date', half: true },
      { name: 'nextLabel', label: 'O que é a próxima', half: true, placeholder: 'Ex.: 2.ª dose, revisão' },
    ],
    healthcard: () => [
      { name: 'bloodType', label: 'Grupo sanguíneo', type: 'select', half: true, options: ['', 'A+', 'A−', 'B+', 'B−', 'AB+', 'AB−', 'O+', 'O−'].map((c) => [c, c || '—']) },
      { name: 'sns', label: 'N.º de utente SNS', half: true },
      { name: 'allergies', label: 'Alergias', type: 'textarea' },
      { name: 'conditions', label: 'Doenças / condições', type: 'textarea' },
      { name: 'meds', label: 'Medicação habitual', type: 'textarea' },
      { name: 'doctor', label: 'Médico de família / pediatra', half: true },
      { name: 'insurance', label: 'Seguro de saúde', half: true },
    ],
    doc: () => [
      { name: 'type', label: 'Documento', type: 'select', half: true, options: ['Cartão de Cidadão', 'Passaporte', 'Carta de condução', 'Cartão Europeu de Seguro de Doença', 'Seguro de saúde', 'Seguro do carro', 'Seguro da casa', 'Inspecção do carro', 'IUC', 'Autorização de residência', 'Outro'].map((c) => [c, c]) },
      { name: 'memberId', label: 'De quem', type: 'select', half: true, options: memberOptions(true, '🏠 Casa / carro') },
      { name: 'expires', label: 'Validade', type: 'date', required: true, half: true },
      { name: 'ref', label: 'Referência (só os últimos dígitos)', half: true, placeholder: 'Ex.: …4Z7' },
      { name: 'notes', label: 'Notas', type: 'textarea' },
    ],
    poll: () => [
      { name: 'question', label: 'Pergunta', required: true, placeholder: 'Ex.: Onde vamos nas férias da Páscoa?' },
      { name: 'optionsText', label: 'Opções (uma por linha)', type: 'textarea', required: true, placeholder: 'Praia\nMontanha\nCidade' },
      { name: 'closes', label: 'Fecha em (opcional)', type: 'date', half: true },
    ],
  });

  /* ---------- Finanças ---------- */
  const KIND = {
    mesada: ['💰', 'Mesada'], oferta: ['🎁', 'Recebeu'], gasto: ['🛍️', 'Gastou'],
    poupanca: ['🐷', 'Para o mealheiro'], levantamento: ['↩️', 'Do mealheiro'], juros: ['🏦', 'Juros'],
  };
  const activeAllowance = (a) => a && a.active !== 'nao' && a.active !== false && Number(a.amount) > 0;

  /** Próxima data de pagamento da mesada (paga às 9h do dia certo). */
  function nextAllowance(a) {
    if (!activeAllowance(a)) return null;
    const t = today();
    const paidToday = S().money.some((x) => x.memberId === a.memberId && x.kind === 'mesada' && x.date === t);
    for (let i = paidToday ? 1 : 0; i < 62; i++) {
      const d = addDays(t, i);
      if (a.frequency === 'monthly') {
        const last = Number(addDays(`${U.addMonths(`${d.slice(0, 7)}-01`, 1)}`, -1).slice(8));
        if (Number(d.slice(8)) === Math.min(Number(a.day) || 1, last)) return d;
      } else if (U.weekday(d) === Number(a.day ?? 6)) return d;
    }
    return null;
  }

  function allowanceText(a) {
    if (!activeAllowance(a)) return a ? 'Mesada em pausa' : 'Ainda sem mesada';
    const wd = Number(a.day ?? 6);
    const when = a.frequency === 'monthly' ? `no dia ${a.day || 1} de cada mês`
      : `${wd === 0 || wd === 6 ? 'todos os' : 'todas as'} ${DIAS[wd].toLowerCase()}s`;
    const next = nextAllowance(a);
    return `Mesada de <b>${money(a.amount)}</b> ${when}${next ? ` · próxima ${next === today() ? '<b>hoje</b>' : esc(relDay(next))}` : ''}`;
  }

  const bank = () => (S().savings || []).find((x) => x.id === 'banco');
  const pct = (a, b) => (Number(b) ? Math.max(0, Math.min(100, Math.round((a / Number(b)) * 100))) : 0);

  /** Porquinho mealheiro que enche conforme a percentagem. */
  function pig(p, color) {
    const y = 88 - (p / 100) * 62; // nível do "líquido" dentro do corpo (26 = cheio, 88 = vazio)
    const id = `pg${Math.random().toString(36).slice(2, 8)}`;
    return `<svg class="pig" viewBox="0 0 120 100" role="img" aria-label="Mealheiro a ${p}%">
      <defs><clipPath id="${id}"><ellipse cx="58" cy="57" rx="42" ry="31"/><ellipse cx="99" cy="58" rx="12" ry="10"/></clipPath></defs>
      <rect x="22" y="78" width="11" height="16" rx="4" class="pig-leg"/><rect x="72" y="78" width="11" height="16" rx="4" class="pig-leg"/>
      <path d="M17 50 q-12 -4 -7 -14" class="pig-tail"/>
      <path d="M78 30 l8 -16 l6 20 z" class="pig-ear"/>
      <ellipse cx="58" cy="57" rx="42" ry="31" class="pig-body"/>
      <ellipse cx="99" cy="58" rx="12" ry="10" class="pig-body"/>
      <g clip-path="url(#${id})"><rect x="0" y="${y}" width="120" height="100" class="pig-fill" style="fill:${esc(color)}"/>
        <path d="M0 ${y} q15 -5 30 0 t30 0 t30 0 t30 0 v6 h-120 z" class="pig-wave" style="fill:${esc(color)}"/></g>
      <ellipse cx="58" cy="57" rx="42" ry="31" class="pig-line"/>
      <ellipse cx="99" cy="58" rx="12" ry="10" class="pig-line"/>
      <circle cx="96" cy="56" r="1.8" class="pig-dot"/><circle cx="103" cy="56" r="1.8" class="pig-dot"/>
      <circle cx="84" cy="44" r="2.6" class="pig-dot"/>
      <rect x="44" y="23" width="22" height="4" rx="2" class="pig-slot"/>
      <text x="56" y="64" text-anchor="middle" class="pig-pct">${p}%</text>
    </svg>`;
  }

  function goalCard(g, k, bal) {
    const parent = Store.isParent();
    const sv = goalSaved(g.id);
    const target = Number(g.target) || 0;
    const p = pct(sv, target);
    const pr = Poupanca.projection(S(), g, today());
    const juros = S().money.filter((x) => x.goalId === g.id && x.kind === 'juros').reduce((n, x) => n + x.amount, 0);
    const b = bank();
    const nextJuros = Poupanca.bankOn(b) && sv > 0 && p < 100 ? Poupanca.interestOf(b, sv) : 0;
    const when = pr.when ? `${MESES[Number(pr.when.slice(5)) - 1].toLowerCase()} de ${pr.when.slice(0, 4)}` : '';
    return `<div class="goal pig-goal">
      ${pig(p, k.color)}
      <div class="pig-info">
        <button class="goal-main" data-action="edit-goal" data-id="${g.id}"><span>${esc(g.emoji || '🐷')} <b>${esc(g.title)}</b></span></button>
        <small>${money(sv)} de ${money(target)}${p >= 100 ? ' · <b>🎉 Conseguiste!</b>' : ` · faltam <b>${money(target - sv)}</b>`}</small>
        ${p < 100 ? `<small class="muted">${pr.months ? `🔮 A este ritmo (${money(pr.perMonth)}/mês) chegas lá em <b>${esc(when)}</b>` : '🔮 Põe dinheiro regularmente e eu digo-te quando lá chegas.'}</small>` : ''}
        ${nextJuros ? `<small class="pig-juros">🏦 Próximos juros: <b>+${money(nextJuros)}</b> a dia 1</small>` : ''}
        ${juros ? `<small class="muted">🏦 Já ganhaste ${money(juros)} em juros</small>` : ''}
        <span class="pig-btns">${bal > 0 && p < 100 ? `<button class="btn small" data-action="add-money" data-id="${k.id}" data-kind="poupanca" data-goal="${g.id}">🪙 Pôr</button>` : ''}
          ${parent && sv > 0 ? `<button class="linkish" data-action="goal-withdraw" data-id="${g.id}">↩️ tirar</button>` : ''}</span>
      </div>
    </div>`;
  }

  /** Semanas seguidas a poupar e medalhas de poupança. */
  function saverStrip(k) {
    const st = Poupanca.stats(S(), k.id, today());
    const got = new Set(Poupanca.medals(st));
    return `<details class="saver"><summary>🔥 <b>${st.weeks}</b> semana${st.weeks === 1 ? '' : 's'} seguida${st.weeks === 1 ? '' : 's'} a poupar
        · 🏅 ${got.size}/${Poupanca.MEDALS.length} medalhas</summary>
      <ul class="medals" style="--c:${esc(k.color)}">${Poupanca.MEDALS.map((m) => `<li class="medal ${got.has(m.id) ? '' : 'locked'}" title="${esc(m.desc)}">
        <span class="b-emoji">${got.has(m.id) ? m.emoji : '🔒'}</span><span class="b-name">${esc(m.name)}</span><small>${esc(m.desc)}</small></li>`).join('')}</ul>
    </details>`;
  }

  function bankCard() {
    const b = bank();
    const on = Poupanca.bankOn(b);
    const parent = Store.isParent();
    if (!parent && !on) return '';
    return `<section class="card bank ${on ? 'on' : ''}">
      <div class="bank-row"><span class="bank-ico">🏦</span><div>
        <b>Banco dos Pais</b>
        <p class="small">${on ? `Cada mealheiro ganha <b>${Number(b.rate)}% de juros por mês</b>${Number(b.cap) ? ` (até ${money(b.cap)} por mealheiro)` : ''}, pagos a dia 1. Quanto mais cedo poupares, mais ganhas! 🌱`
          : 'Paguem juros às filhas pelo que têm nos mealheiros: é a forma mais divertida de perceberem que poupar compensa.'}</p></div>
        ${parent ? `<button class="btn small ${on ? '' : 'primary'}" data-action="edit-bank">${on ? 'Alterar' : 'Abrir o banco'}</button>` : ''}</div>
    </section>`;
  }

  function kidWallet(k) {
    const s = S();
    const parent = Store.isParent();
    const mine = k.id === s.currentUser;
    const bal = wallet(k.id);
    const a = s.allowances.find((x) => x.memberId === k.id);
    const goals = s.goals.filter((g) => g.memberId === k.id);
    const saved = goals.reduce((n, g) => n + goalSaved(g.id), 0);
    const all = s.money.filter((x) => x.memberId === k.id).sort((x, y) => (y.date || '').localeCompare(x.date || ''));
    const month = today().slice(0, 7);
    const inMonth = all.filter((x) => (x.date || '').slice(0, 7) === month);
    const got = inMonth.filter((x) => ['mesada', 'oferta'].includes(x.kind)).reduce((n, x) => n + x.amount, 0);
    const spent = -inMonth.filter((x) => x.kind === 'gasto').reduce((n, x) => n + x.amount, 0);
    const kept = -inMonth.filter((x) => ['poupanca', 'levantamento'].includes(x.kind)).reduce((n, x) => n + x.amount, 0);
    const move = (x) => {
      const [ic, label] = KIND[x.kind] || ['•', ''];
      return `<li><span>${ic} ${esc(x.note || label)} <small class="muted">· ${esc(fmtDate(x.date))}</small></span>
        <b class="${x.amount < 0 ? 'neg' : 'pos'}">${signed(x.amount)}</b></li>`;
    };
    const canGoal = parent || mine;

    return `<section class="card wallet" style="--c:${esc(k.color)}">
      <header class="card-head"><h2>${avatar(k.id)} ${esc(k.name)}</h2>
        <small class="muted">Total: <b>${money(bal + saved)}</b></small></header>
      <div class="fin-totals">
        <div class="fin-tile"><small>👛 Na carteira</small><b class="${bal < 0 ? 'neg' : ''}">${money(bal)}</b><small>pode gastar</small></div>
        <div class="fin-tile save"><small>🐷 Nos mealheiros</small><b>${money(saved)}</b><small>guardado</small></div>
      </div>
      <p class="small fin-allow">${allowanceText(a)}
        ${parent ? `<button class="linkish" data-action="edit-allowance" data-id="${k.id}">${a ? 'alterar' : 'definir mesada'}</button>` : ''}</p>
      <div class="fin-actions">
        ${parent ? `<button class="btn small primary" data-action="add-money" data-id="${k.id}" data-kind="oferta">＋ Dar dinheiro</button>` : ''}
        <button class="btn small" data-action="add-money" data-id="${k.id}" data-kind="gasto">🛍️ Gastei</button>
        ${goals.length ? `<button class="btn small" data-action="add-money" data-id="${k.id}" data-kind="poupanca">🐷 Poupar</button>`
          : canGoal ? `<button class="btn small" data-action="add-goal" data-id="${k.id}">🐷 Criar mealheiro</button>` : ''}
      </div>
      ${goals.length ? saverStrip(k) : ''}

      <h3 class="sub">🐷 Mealheiros ${goals.length && canGoal ? `<button class="linkish" data-action="add-goal" data-id="${k.id}">＋ novo</button>` : ''}</h3>
      ${goals.map((g) => goalCard(g, k, bal)).join('') || '<p class="empty small">Poupar para quê? Uma bicicleta, uns auscultadores, a viagem de finalistas… 🚲🎧✈️</p>'}

      <h3 class="sub">📒 Movimentos</h3>
      ${inMonth.length ? `<p class="small fin-month">Este mês: <span class="pos">entrou ${money(got)}</span> · <span class="neg">gastou ${money(spent)}</span>${kept ? ` · poupou ${money(kept)}` : ''}</p>` : ''}
      ${all.length ? `<ul class="moves">${all.slice(0, 5).map(move).join('')}</ul>
        ${all.length > 5 ? `<details class="done-list"><summary>Ver mais (${all.length - 5})</summary><ul class="moves">${all.slice(5, 60).map(move).join('')}</ul></details>` : ''}`
        : '<p class="empty small">Ainda sem movimentos.</p>'}
    </section>`;
  }

  const REPEAT_BILL = { monthly: 'mensal', bimonthly: 'de 2 em 2 meses', quarterly: 'trimestral', yearly: 'anual', none: 'só uma vez' };
  const BILL_MONTHS = { monthly: 1, bimonthly: 2, quarterly: 3, yearly: 12 };

  function billsView() {
    const s = S();
    const t = today();
    const bills = s.bills.filter((b) => !b.archived).sort((a, b) => (a.due || '').localeCompare(b.due || ''));
    const month = t.slice(0, 7);
    const monthEnd = addDays(`${U.addMonths(`${month}-01`, 1)}`, -1);
    const toPay = sum(bills.filter((b) => b.due <= monthEnd));
    const paidMonth = sum(s.bills.flatMap((b) => (b.history || []).filter((h) => h.date.slice(0, 7) === month)));
    const perMonth = bills.reduce((n, b) => n + (BILL_MONTHS[b.repeat] ? (Number(b.amount) || 0) / BILL_MONTHS[b.repeat] : 0), 0);
    const paid = s.bills.flatMap((b) => (b.history || []).map((h) => ({ ...h, title: b.title }))).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);

    const row = (b) => {
      const left = daysBetween(t, b.due);
      const cls = left < 0 ? 'late' : left <= 7 ? 'soon' : '';
      return `<li class="bill ${cls}">
        <button class="bill-main" data-action="edit-bill" data-id="${b.id}">
          <span class="title">${esc(b.title)}</span>
          <small class="muted">${left < 0 ? `<b class="neg">atrasada ${-left} dia${left === -1 ? '' : 's'}</b>` : esc(relDay(b.due))} · ${esc(fmtDate(b.due))}
            · ${esc(REPEAT_BILL[b.repeat] || '')}${b.category ? ` · ${esc(b.category)}` : ''}${b.auto ? ' · 🏦 débito directo' : ''}</small>
        </button>
        <b class="bill-amount">${money(b.amount)}</b>
        <button class="btn small" data-action="pay-bill" data-id="${b.id}" title="Marcar como paga">✔ Paga</button></li>`;
    };
    const groups = [
      ['⚠️ Atrasadas', bills.filter((b) => b.due < t)],
      ['📅 Próximos 30 dias', bills.filter((b) => b.due >= t && b.due <= addDays(t, 30))],
      ['🗓️ Mais tarde', bills.filter((b) => b.due > addDays(t, 30))],
    ].filter(([, l]) => l.length);

    return `<div class="fin-summary">
        <div class="fin-tile"><small>Por pagar até ao fim do mês</small><b>${money(toPay)}</b></div>
        <div class="fin-tile ok"><small>Já pago este mês</small><b>${money(paidMonth)}</b></div>
        <div class="fin-tile"><small>Custos fixos (média por mês)</small><b>${money(perMonth)}</b></div>
      </div>
      <div class="grid two wide-left">
        ${card('💶 Contas a pagar', `${groups.map(([title, l]) => `<h3 class="sub">${title} <small class="muted">(${l.length})</small></h3><ul class="list bills">${l.map(row).join('')}</ul>`).join('')
          || empty('Ainda sem contas. Junta a luz, a água, a internet, os seguros, o IUC… e o portal avisa-vos 3 dias antes.')}`,
        { action: addBtn('add-bill', 'Conta') })}
        <div class="stack">
          ${card('✔ Pagas recentemente', paid.length ? `<ul class="moves">${paid.map((h) =>
            `<li><span>${esc(h.title)} <small class="muted">· ${esc(fmtDate(h.date))}</small></span><b>${money(h.amount)}</b></li>`).join('')}</ul>`
            : empty('Quando carregarem em "✔ Paga", aparecem aqui e a conta passa para a próxima data.'))}
          <p class="small muted">🔒 Só os pais vêem as contas da casa.</p>
        </div>
      </div>`;
  }

  function financas() {
    const s = S();
    const parent = Store.isParent();
    const list = parent ? kids() : kids().filter((k) => k.id === s.currentUser);
    const tab = parent ? VS.finTab || 'carteiras' : 'carteiras';
    const tabs = parent ? `<div class="tabs" role="tablist">${[['carteiras', '👛 Dinheiro das filhas'], ['contas', '🏠 Contas da casa']].map(([id, label]) =>
      `<button role="tab" aria-selected="${tab === id}" class="tab ${tab === id ? 'active' : ''}" data-action="fin-tab" data-id="${id}" style="--c:#16a34a">${label}</button>`).join('')}</div>` : '';
    const how = `<details class="fin-how"><summary>❓ Como funciona</summary><ul class="tips">
      <li><b>👛 Carteira</b> é o dinheiro que ${parent ? 'cada filha' : 'tens e'} pode gastar. A mesada entra aqui sozinha${Store.isRemote ? ', às 9h do dia certo' : ' (com a conta na nuvem)'}.</li>
      <li><b>🛍️ Gastei</b>: ${parent ? 'elas registam' : 'registas'} o que se gastou, para a carteira bater certo com o dinheiro real.</li>
      <li><b>🐷 Mealheiros</b> são objectivos (ex.: bicicleta). Poupar passa dinheiro da carteira para o mealheiro; só os pais o podem tirar de lá.</li>
      <li><b>🧮 Arredondar</b>: ao registar um gasto, o troco até ao euro seguinte pode ir para o mealheiro (3,40 € → 0,60 € poupados).</li>
      <li><b>🏦 Banco dos Pais</b>: se os pais o abrirem, os mealheiros ganham juros todos os meses.</li>
      ${parent ? '<li><b>＋ Dar dinheiro</b>: prendas, mesada extra, recompensa por uma nota boa…</li>' : ''}
    </ul></details>`;
    return `<div class="page-head"><h1>Finanças</h1></div>${tabs}
      ${tab === 'contas' ? billsView() : `${how}
        ${bankCard()}
        <div class="grid two">${list.map(kidWallet).join('') || empty('Sem carteiras para mostrar.')}</div>`}`;
  }

  /* ---------- Saúde & documentos ---------- */
  function docStatus(d) {
    const left = daysBetween(today(), d.expires);
    if (left < 0) return ['late', `expirou há ${-left} dias`];
    if (left <= 60) return ['soon', `expira ${relDay(d.expires)}`];
    return ['ok', `válido até ${fmtDate(d.expires)}`];
  }
  const docRow = (d) => {
    const [cls, label] = docStatus(d);
    return `<li class="doc ${cls}"><button class="item-main" data-action="edit-doc" data-id="${d.id}">
      <span class="title">🔐 ${esc(d.type)}${d.ref ? ` <small class="muted">${esc(d.ref)}</small>` : ''}</span>
      <small class="status">${esc(label)}</small></button>${d.memberId ? avatar(d.memberId, 'sm') : ''}</li>`;
  };

  function saude() {
    const s = S();
    const tab = VS.healthTab && (VS.healthTab === 'casa' || member(VS.healthTab)) ? VS.healthTab : s.members[0]?.id;
    VS.healthTab = tab;
    const t = today();
    const soon = s.docs.filter((d) => d.expires && daysBetween(t, d.expires) <= 90).sort((a, b) => a.expires.localeCompare(b.expires));
    const tabs = [...s.members.map((m) => [m.id, `${m.emoji} ${m.name}`, m.color]), ['casa', '🏠 Casa & carro', '#64748b']];
    let body;
    if (tab === 'casa') {
      const docs = s.docs.filter((d) => !d.memberId).sort((a, b) => a.expires.localeCompare(b.expires));
      body = `<div class="grid two">${card('🔐 Documentos da casa e do carro', docs.length ? `<ul class="list">${docs.map(docRow).join('')}</ul>`
        : empty('Seguros, inspecção, IUC…'), { action: addBtn('add-doc', 'Documento', 'data-id=""') })}</div>`;
    } else {
      const hc = s.healthcards.find((x) => x.id === tab) || {};
      const rows = [['🩸 Grupo sanguíneo', hc.bloodType], ['🆔 N.º de utente', hc.sns], ['⚠️ Alergias', hc.allergies],
        ['🩺 Condições', hc.conditions], ['💊 Medicação', hc.meds], ['👩‍⚕️ Médico', hc.doctor], ['🛡️ Seguro', hc.insurance]].filter(([, v]) => v);
      const log = s.health.filter((h) => h.memberId === tab).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      const docs = s.docs.filter((d) => d.memberId === tab).sort((a, b) => a.expires.localeCompare(b.expires));
      body = `<div class="grid two">
        ${card('🩺 Ficha de saúde', rows.length ? `<dl class="facts">${rows.map(([k, v]) => `<dt>${k}</dt><dd class="pre">${esc(v)}</dd>`).join('')}</dl>`
          : empty('Alergias, medicação, grupo sanguíneo, médico… tudo à mão numa urgência.'),
        { action: `<button class="btn small" data-action="edit-healthcard" data-id="${tab}">✎ Editar</button>` })}
        ${card('📋 Consultas, vacinas e tratamentos', log.length ? `<ul class="list">${log.map((h) => `<li class="item" style="--c:${esc(colorOf([tab]))}">
          <button class="item-main" data-action="edit-health" data-id="${h.id}"><span class="when">${esc(fmtDate(h.date))}</span>
          <span class="title">${esc(h.type)}: ${esc(h.title)}${h.next ? ` <small class="badge">próxima ${esc(relDay(h.next))}</small>` : ''}</span></button></li>`).join('')}</ul>`
          : empty('Sem registos.'), { action: addBtn('add-health', 'Registo', `data-id="${tab}"`) })}
        ${card('🔐 Documentos', docs.length ? `<ul class="list">${docs.map(docRow).join('')}</ul>` : empty('Cartão de Cidadão, passaporte, carta…'),
          { action: addBtn('add-doc', 'Documento', `data-id="${tab}"`) })}
      </div>`;
    }
    return `<div class="page-head"><h1>Saúde & Documentos</h1></div>
      ${soon.length ? `<section class="card attention"><header class="card-head"><h2>⚠️ A tratar em breve</h2></header>
        <ul class="list">${soon.map(docRow).join('')}</ul></section>` : ''}
      <div class="tabs" role="tablist">${tabs.map(([id, label, color]) => `<button role="tab" aria-selected="${id === tab}"
        class="tab ${id === tab ? 'active' : ''}" data-action="health-tab" data-id="${esc(id)}" style="--c:${esc(color)}">${esc(label)}</button>`).join('')}</div>
      ${body}
      <p class="small muted">🔒 Estes dados só são visíveis para a família. Guardem só o necessário (por ex. os últimos dígitos dos documentos).</p>`;
  }

  /* ---------- Votações ---------- */
  function pollCard(p) {
    const s = S();
    const votes = s.votes.filter((v) => v.pollId === p.id);
    const mine = votes.find((v) => v.memberId === s.currentUser);
    const closed = p.closed || (p.closes && p.closes < today());
    const total = votes.length;
    const max = Math.max(0, ...p.options.map((o) => votes.filter((v) => v.optionId === o.id).length));
    const canManage = Store.isParent() || p.createdBy === s.currentUser;
    return `<section class="card poll ${closed ? 'closed' : ''}">
      <header class="card-head"><h2>${esc(p.question)}</h2>${canManage ? `<button class="icon-btn" data-action="edit-poll" data-id="${p.id}" aria-label="Editar votação">✎</button>` : ''}</header>
      <p class="small muted">${avatar(p.createdBy, 'sm')} ${esc(member(p.createdBy)?.name || '')} · ${esc(fmtDate(p.date))}
        ${closed ? ' · <b>fechada</b>' : p.closes ? ` · fecha ${esc(relDay(p.closes))}` : ''}</p>
      <div class="options">${p.options.map((o) => {
        const vs = votes.filter((v) => v.optionId === o.id);
        const pct = total ? Math.round((vs.length / total) * 100) : 0;
        const win = closed && vs.length && vs.length === max;
        return `<button class="option ${mine?.optionId === o.id ? 'mine' : ''} ${win ? 'win' : ''}" data-action="vote" data-id="${p.id}" data-sub="${esc(o.id)}"
          ${closed ? 'disabled' : ''} aria-pressed="${mine?.optionId === o.id}">
          <span class="bar" style="width:${pct}%"></span>
          <span class="label">${win ? '🏆 ' : ''}${esc(o.text)}</span>
          <span class="voters">${vs.map((v) => avatar(v.memberId, 'sm')).join('')}</span><b>${vs.length}</b></button>`;
      }).join('')}</div>
      <footer class="poll-foot"><small class="muted">${total} de ${s.members.length} votaram${mine && !closed ? ' · podes mudar o teu voto' : ''}</small>
        ${canManage ? `<button class="btn small ghost" data-action="close-poll" data-id="${p.id}">${closed ? 'Reabrir' : 'Fechar votação'}</button>` : ''}</footer>
    </section>`;
  }

  function votacoes() {
    const polls = [...S().polls].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const isClosed = (p) => p.closed || (p.closes && p.closes < today());
    const open = polls.filter((p) => !isClosed(p));
    const closed = polls.filter(isClosed);
    return `<div class="page-head"><h1>Votações</h1><div class="quick">${addBtn('add-poll', 'Votação')}</div></div>
      <p class="muted">Decidam juntos: o jantar de sábado, o destino das férias, o filme… Cada pessoa tem um voto.</p>
      <div class="grid two">${open.map(pollCard).join('') || empty('Nenhuma votação aberta.')}</div>
      ${closed.length ? `<details class="card"><summary><b>Votações fechadas (${closed.length})</b></summary><div class="grid two">${closed.map(pollCard).join('')}</div></details>` : ''}`;
  }

  /* ---------- Memórias ---------- */
  function memorias() {
    if (!Store.isRemote) {
      return `<div class="page-head"><h1>Memórias</h1></div>${card('📸 Álbum da família',
        '<p>As fotos ficam guardadas na nuvem, num álbum privado só da família. Para usar, entrem com a vossa conta em <a href="#/definicoes">Definições</a>.</p>')}`;
    }
    const s = S();
    const trips = s.trips.filter((t) => s.photos.some((p) => p.tripId === t.id));
    const f = VS.photoTrip || '';
    const list = [...s.photos].filter((p) => !f || (f === '_none' ? !p.tripId : p.tripId === f))
      .sort((a, b) => (b.taken || b.date || '').localeCompare(a.taken || a.date || ''));
    const filters = [['', 'Todas'], ...trips.map((t) => [t.id, `✈️ ${t.destination}`]), ['_none', 'Sem viagem']];
    const uploadTrip = f && f !== '_none' ? f : '';
    return `<div class="page-head"><h1>Memórias</h1>
      <div class="quick"><label class="btn primary small upload-btn">📷 Adicionar fotos
        <input type="file" id="photo-input" accept="image/*" multiple hidden data-trip="${esc(uploadTrip)}"></label>
        ${s.trips.length ? `<select id="photo-trip" aria-label="Associar a uma viagem" class="small-select">
          <option value="">Sem viagem</option>${s.trips.map((t) => `<option value="${esc(t.id)}" ${t.id === uploadTrip ? 'selected' : ''}>✈️ ${esc(t.destination)}</option>`).join('')}</select>` : ''}</div></div>
      <div class="filters">${filters.map(([v, l]) => `<button class="filter ${f === v ? 'active' : ''}" data-action="photo-filter" data-id="${esc(v)}">${esc(l)}</button>`).join('')}</div>
      <p id="upload-status" class="small muted" role="status"></p>
      ${list.length ? `<div class="photo-grid">${list.map((p) => `<button class="ph" data-action="photo-open" data-id="${p.id}" aria-label="${esc(p.caption || 'Foto')}">
        <img data-path="${esc(p.thumb)}" alt="${esc(p.caption || '')}" loading="lazy">${p.caption ? `<span class="cap">${esc(p.caption)}</span>` : ''}</button>`).join('')}</div>`
        : `<section class="card">${empty('Ainda não há fotos aqui. Partilhem os melhores momentos! 📸')}</section>`}`;
  }

  /* ---------- Painel: alertas e carteira ---------- */
  /** Compromissos das filhas sem nenhum dos pais: alguém tem de levar / ir buscar. */
  function ridesAhead(days) {
    const t = today();
    const kidIds = new Set(kids().map((k) => k.id));
    const isRide = (e) => e.start && (e.members || []).length && e.members.every((m) => kidIds.has(m));
    const out = [];
    for (let i = 0; i < days; i++) {
      const d = addDays(t, i);
      eventsOn(d).filter(isRide).forEach((e) => out.push({ e, d }));
    }
    return out;
  }

  function nextOccurrence(iso) {
    const t = today();
    let d = `${t.slice(0, 4)}-${iso.slice(5)}`;
    if (d < t) d = `${Number(t.slice(0, 4)) + 1}-${iso.slice(5)}`;
    return d;
  }

  function painelExtra() {
    const s = S();
    const t = today();
    const parent = Store.isParent();
    const alerts = [];
    s.docs.filter((d) => d.expires && daysBetween(t, d.expires) <= 60).forEach((d) => {
      const left = daysBetween(t, d.expires);
      alerts.push([left, `<a href="#/saude">🔐 ${esc(d.type)}${d.memberId ? ` (${esc(member(d.memberId)?.name || '')})` : ''} ${left < 0 ? '<b>expirou</b>' : `expira ${relDay(d.expires)}`}</a>`]);
    });
    if (parent) {
      s.bills.filter((b) => b.due && !b.archived && daysBetween(t, b.due) <= 7).forEach((b) => {
        alerts.push([daysBetween(t, b.due), `<a href="#/financas">💶 ${esc(b.title)} · ${money(b.amount)} · ${daysBetween(t, b.due) < 0 ? '<b>atrasada</b>' : relDay(b.due)}</a>`]);
      });
      ridesAhead(2).filter(({ e }) => !e.driver).forEach(({ e, d }) => {
        alerts.push([daysBetween(t, d), `🚗 Ninguém leva: <b>${esc(e.title)}</b> (${relDay(d)} ${esc(e.start)})
          <button class="btn small" data-action="i-drive" data-id="${e.id}">Eu levo</button>`]);
      });
    }
    s.health.filter((h) => h.next && h.next >= t && daysBetween(t, h.next) <= 7).forEach((h) => {
      alerts.push([daysBetween(t, h.next), `<a href="#/saude">🏥 ${esc(h.nextLabel || h.title)} (${esc(member(h.memberId)?.name || '')}) ${relDay(h.next)}</a>`]);
    });
    s.dates.filter((d) => d.date).forEach((d) => {
      const n = daysBetween(t, nextOccurrence(d.date));
      if (n <= 7) alerts.push([n, `<a href="#/agenda">🎉 ${esc(d.title)} ${n === 0 ? '<b>hoje!</b>' : relDay(nextOccurrence(d.date))}</a>`]);
    });
    s.polls.filter((p) => !p.closed && !(p.closes && p.closes < t) && !s.votes.some((v) => v.pollId === p.id && v.memberId === s.currentUser))
      .forEach((p) => alerts.push([-1, `<a href="#/votacoes">🗳️ Falta o teu voto: <b>${esc(p.question)}</b></a>`]));

    let out = alerts.length ? card('🔔 Atenção', `<ul class="alerts">${alerts.sort((a, b) => a[0] - b[0]).map(([, h]) => `<li>${h}</li>`).join('')}</ul>`, { cls: 'attention' }) : '';
    const me = member(s.currentUser);
    if (me && !PARENT_ROLES.includes(me.role)) {
      const g = s.goals.find((x) => x.memberId === me.id);
      out += card('💰 A minha carteira', `<p class="big">${money(wallet(me.id))}</p>
        ${g ? `<p class="small">${esc(g.emoji || '🐷')} ${esc(g.title)}: ${money(goalSaved(g.id))} de ${money(g.target)}</p>
          <div class="progress"><span style="width:${Math.min(100, Math.round((goalSaved(g.id) / (Number(g.target) || 1)) * 100))}%"></span></div>` : ''}`,
      { action: '<a href="#/financas" class="link">Ver</a>' });
    }
    return out;
  }

  /* ---------- Agenda: boleias e datas especiais ---------- */
  function agendaExtra() {
    const s = S();
    const parent = Store.isParent();
    const rides = ridesAhead(7);
    const ridesBody = rides.length ? `<ul class="list">${rides.map(({ e, d }) => `<li class="ride ${e.driver ? '' : 'nodriver'}">
      <span class="when">${esc(fmtDate(d))} ${esc(e.start)}</span>
      <span class="title">${esc(e.title)} <span class="avatars">${(e.members || []).map((m) => avatar(m, 'sm')).join('')}</span></span>
      ${e.driver ? `<span class="driver">🚗 ${avatar(e.driver, 'sm')}</span>` : '<span class="driver warn">⚠️ ninguém</span>'}
      ${parent && e.driver !== s.currentUser ? `<button class="btn small" data-action="i-drive" data-id="${e.id}"
        title="${e.repeat && e.repeat !== 'none' ? 'Fica para todas as repetições' : ''}">Eu levo</button>` : ''}</li>`).join('')}</ul>`
      : empty('Sem boleias das filhas nos próximos 7 dias.');

    const t = today();
    const special = [
      ...s.dates.filter((d) => d.date).map((d) => ({ d, kind: 'sdate', title: d.title, date: d.date, years: d.knowYear !== 'nao' && d.knowYear !== false, gifts: d.gifts })),
      ...s.members.filter((m) => m.birthday).map((m) => ({ d: m, kind: 'member', title: `Anos: ${m.name}`, date: m.birthday, years: true })),
    ].map((x) => ({ ...x, next: nextOccurrence(x.date) })).sort((a, b) => a.next.localeCompare(b.next));
    const specialBody = special.length ? `<ul class="list">${special.map((x) => {
      const n = daysBetween(t, x.next);
      const age = x.years ? Number(x.next.slice(0, 4)) - Number(x.date.slice(0, 4)) : 0;
      return `<li class="item" style="--c:#f59e0b"><button class="item-main" data-action="${x.kind === 'member' ? 'edit-member' : 'edit-date'}" data-id="${x.d.id}">
        <span class="when">${esc(fmtDate(x.next))}</span><span class="title">🎉 ${esc(x.title)}${age > 0 ? ` <small class="muted">(${age} anos)</small>` : ''}
        ${x.gifts ? `<br><small class="muted">💡 ${esc(x.gifts)}</small>` : ''}</span>
        <small class="badge">${n === 0 ? 'hoje!' : `${n} dias`}</small></button></li>`;
    }).join('')}</ul>` : empty('Aniversários dos avós, tios, amigos, casamento…');

    return `<div class="grid two agenda-extra">
      ${card('🚗 Boleias (próximos 7 dias)', ridesBody)}
      ${card('🎉 Datas especiais', specialBody, { action: addBtn('add-date', 'Data') })}
    </div>`;
  }

  /* ---------- Registo das novas secções ---------- */
  const insertAfter = (name, route) => {
    const i = Views.routes.findIndex((r) => r[0] === name);
    Views.routes.splice(i + 1, 0, route);
  };
  insertAfter('tarefas', ['financas', '💰', 'Finanças', financas]);
  insertAfter('mural', ['votacoes', '🗳️', 'Votações', votacoes]);
  insertAfter('votacoes', ['memorias', '📸', 'Memórias', memorias]);
  insertAfter('memorias', ['saude', '🏥', 'Saúde & Docs', saude]);

  Object.assign(Views, { painelExtra, agendaExtra, wallet, goalSaved, kids, bank });
})();
