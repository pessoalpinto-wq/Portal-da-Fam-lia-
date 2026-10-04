/*
 * Decide que lembretes enviar, a quem e quando (hora de Lisboa).
 * É uma função pura: recebe os dados da família e a hora actual e devolve a lista
 * de notificações. A função "send-reminders" corre de 10 em 10 minutos e usa uma
 * chave única por notificação para nunca enviar a mesma duas vezes.
 */

import './aulas.js'; // aulas de semanas alternadas / parte do ano (define globalThis.Aulas)

export const TZ = 'Europe/Lisbon';
/** Um lembrete é enviado se a hora-alvo foi há menos de WINDOW minutos. */
export const WINDOW = 30;

export const NOTIFY_TYPES = {
  events: 'Compromissos (1 hora antes)',
  exams: 'Testes e trabalhos (na véspera às 19h)',
  tasks: 'Tarefas por fazer (às 18h)',
  digest: 'Resumo do dia (às 7h30)',
  weekly: 'Resumo da semana (domingo às 20h)',
  approvals: 'Pedidos e aprovações',
  trips: 'Viagens (7 dias e 1 dia antes)',
  birthdays: 'Aniversários e datas especiais',
  polls: 'Novas votações',
  health: 'Consultas e vacinas (na véspera)',
  docs: 'Documentos a expirar',
  bills: 'Contas da casa (pais)',
  fecho: 'Fecho do mês (último dia às 19h, pais)',
  orcamento: 'Orçamento: 80 % e 100 % de uma categoria (às 20h, pais)',
  money: 'Mesada recebida',
  shopping: '"Vou às compras" (na hora)',
  pantry: 'Despensa: validades (na véspera às 19h)',
  shopadd: 'Novos produtos na lista (só se ligares)',
};

/** Tipos que vêm desligados: só se recebem se a pessoa os ligar. */
export const OPT_IN = ['shopadd'];

const hhmm = (min) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/**
 * Aviso "Vou às compras": para toda a família menos quem vai (e quem desligou este aviso).
 * @param {object} p
 * @param {object} p.state    { members, shopping }
 * @param {Array}  p.profiles [{ user_id, member_id, notify }]
 * @param {string} p.senderId user_id de quem vai às compras
 * @param {number} p.minutes  daqui a quantos minutos sai (0 = agora)
 * @param {string} p.store    onde vai (opcional)
 * @param {{minutes:number}} p.now hora actual em Lisboa
 */
export function shoppingNotice({ state, profiles, senderId, minutes = 0, store = '', now }) {
  const sender = profiles.find((p) => p.user_id === senderId);
  const who = (state.members || []).find((m) => m.id === sender?.member_id)?.name || 'Alguém';
  const mins = Math.max(0, Math.min(240, Math.round(Number(minutes) || 0)));
  const when = mins ? `às ${hhmm(now.minutes + mins)}` : 'agora';
  const where = String(store || '').trim().slice(0, 40);
  const left = (state.shopping || []).filter((i) => !i.done).length;
  return {
    userIds: profiles.filter((p) => p.user_id !== senderId && (p.notify || {}).shopping !== false).map((p) => p.user_id),
    title: `🛒 ${who} vai às compras ${when}${where ? ` (${where})` : ''}`,
    body: `Falta alguma coisa? Acrescentem à lista${mins ? ' antes de sair' : ' já'}! ${left ? `Estão ${left} produto${left === 1 ? '' : 's'} na lista.` : 'A lista está vazia.'}`,
    url: '#/compras',
    tag: 'compras',
  };
}

const listNames = (names, max = 4) => names.slice(0, max).join(', ') + (names.length > max ? ` e mais ${names.length - max}` : '');

/** O "Vou às compras" está activo? (até 3 horas depois da hora de saída) */
export function tripActive(trip, nowMs) {
  if (!trip?.at) return false;
  const leave = Date.parse(trip.at) + (Number(trip.minutes) || 0) * 60000;
  return Number.isFinite(leave) && nowMs < leave + 3 * 3600000;
}

/**
 * Produtos acabados de juntar à lista: quem recebe o aviso.
 *  - quem está às compras ("Vou às compras" activo), a não ser que tenha desligado os avisos das compras;
 *  - quem ligou "Novos produtos na lista" (vem desligado).
 * Nunca quem juntou. Devolve [{ userId, itemIds, title, body }]; as chaves de "já avisado" fazem-se por produto.
 * @param {object} p
 * @param {object} p.state    { members, shoptrip }
 * @param {Array}  p.profiles [{ user_id, member_id, notify }]
 * @param {string} p.senderId user_id de quem juntou
 * @param {Array}  p.items    [{ id, text, qty }] os produtos novos
 * @param {number} p.nowMs    agora (ms)
 */
export function additionsNotice({ state, profiles, senderId, items, nowMs }) {
  if (!items?.length) return [];
  const sender = profiles.find((p) => p.user_id === senderId);
  const who = (state.members || []).find((m) => m.id === sender?.member_id)?.name || 'Alguém';
  const trip = (state.shoptrip || []).find((t) => t.id === 'current');
  const shopper = tripActive(trip, nowMs) ? trip.by : null;
  const names = items.map((i) => `${i.qty ? `${i.qty} ` : ''}${i.text}`);
  const out = [];
  profiles.forEach((p) => {
    if (p.user_id === senderId) return;
    const prefs = p.notify || {};
    const isShopper = shopper && p.member_id === shopper && p.member_id !== sender?.member_id;
    if (isShopper ? prefs.shopping === false : prefs.shopadd !== true) return;
    out.push({
      userId: p.user_id,
      itemIds: items.map((i) => i.id),
      title: isShopper ? `🛒 Já que estás às compras: ${who} juntou ${listNames(names, 3)}` : `🛒 ${who} juntou à lista: ${listNames(names)}`,
      body: isShopper ? (items.length > 1 ? `${items.length} produtos novos na lista.` : 'Está na lista.') : 'Toca para ver a lista de compras.',
    });
  });
  return out;
}

/** Data (AAAA-MM-DD) e minutos do dia em Lisboa. */
export function lisbonNow(date = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
}

const dayNum = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
};
const fromDayNum = (n) => new Date(n * 86400000).toISOString().slice(0, 10);
export const addDays = (iso, n) => fromDayNum(dayNum(iso) + n);
const weekday = (iso) => new Date(dayNum(iso) * 86400000).getUTCDay();
const hm = (s) => {
  const [h, m] = String(s).split(':').map(Number);
  return h * 60 + (m || 0);
};
/** Minutos "absolutos" em hora local (evita conversões de fuso). */
const at = (iso, time) => dayNum(iso) * 1440 + (typeof time === 'number' ? time : hm(time));

/** O compromisso como é neste dia: com as alterações só deste dia (hora, local, quem leva), se houver. */
export function occurrence(e, date) {
  const o = e.overrides?.[date];
  return o ? { ...e, ...o, special: true } : e;
}

export function occursOn(e, date) {
  if (!e.date || (e.skip || []).includes(date)) return false;
  if (e.date === date) return true;
  if (e.date > date || (e.until && date > e.until)) return false;
  if (e.repeat === 'weekly') return weekday(e.date) === weekday(date);
  if (e.repeat === 'monthly') return e.date.slice(8) === date.slice(8);
  if (e.repeat === 'yearly') return e.date.slice(5) === date.slice(5);
  return false;
}

// Orçamento (mesmos ids que js/orcamento.js): o que não conta como despesa e os nomes curtos.
const BUDGET_SKIP = new Set(['entradas', 'poupanca', 'transferencias']);
const BUDGET_NAMES = {
  supermercado: 'Supermercado', casa: 'Casa', contas: 'Luz, água, gás e telecom', carro: 'Carro e combustível', transportes: 'Transportes',
  saude: 'Saúde', educacao: 'Escola e educação', restaurantes: 'Restaurantes e cafés', lazer: 'Lazer e férias', roupa: 'Roupa e calçado',
  compras: 'Compras', subscricoes: 'Subscrições', seguros: 'Seguros', impostos: 'Impostos e taxas', credito: 'Créditos', filhas: 'Filhas',
  animais: 'Animais', levantamentos: 'Levantamentos', outros: 'Outras despesas',
};

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const shortDate = (iso) => `${DIAS[weekday(iso)]}, ${Number(iso.slice(8))}/${Number(iso.slice(5, 7))}`;
const money = (n) => `${(Math.round(Number(n) * 100) / 100).toFixed(2).replace('.', ',')} €`;
const list = (arr, max = 3) => arr.slice(0, max).join(', ') + (arr.length > max ? ` e mais ${arr.length - max}` : '');

/**
 * @param {object} p
 * @param {object} p.state    estado da família (members, events, tasks, …) como na app
 * @param {Array}  p.profiles [{ user_id, member_id, role, notify }]
 * @param {{date:string, minutes:number}} p.now hora de Lisboa
 * @returns {Array<{key, userId, type, title, body, url, tag}>}
 */
export function computeReminders({ state, profiles, now }) {
  const s = {
    members: [], events: [], tasks: [], exams: [], trips: [], redemptions: [], classes: [],
    docs: [], bills: [], dates: [], health: [], polls: [], votes: [], pantry: [], shopreqs: [], faccounts: [], fsnaps: [], ftx: [], fbudgets: [], ...state,
  };
  const nowAbs = at(now.date, now.minutes);
  const due = (iso, time) => {
    const diff = nowAbs - at(iso, time);
    return diff >= 0 && diff < WINDOW;
  };
  const today = now.date;
  const tomorrow = addDays(today, 1);
  const member = (id) => s.members.find((m) => m.id === id);
  const name = (id) => member(id)?.name || 'Alguém';
  const usersOf = (memberIds) => profiles.filter((p) => memberIds.includes(p.member_id));
  const parents = profiles.filter((p) => p.role === 'parent');
  const wants = (p, type) => (p.notify || {})[type] !== false;
  const out = [];
  const push = (p, type, key, title, body, url) => {
    if (!wants(p, type)) return;
    out.push({ key: `${key}:${p.user_id}`, userId: p.user_id, type, title, body, url, tag: key });
  };

  // Compromissos: 1 hora antes (ou às 8h se não tiver hora).
  [today, tomorrow].forEach((date) => {
    s.events.filter((e) => occursOn(e, date)).map((e) => occurrence(e, date)).forEach((e) => {
      const target = e.start ? hm(e.start) - 60 : 8 * 60;
      if (!due(date, target)) return;
      const ids = new Set([...(e.members || []), ...(e.driver ? [e.driver] : [])]);
      const recipients = ids.size ? usersOf([...ids]) : profiles;
      recipients.forEach((p) => {
        const bits = [e.start ? `${date === today ? 'Hoje' : 'Amanhã'} às ${e.start}` : 'Hoje', e.location].filter(Boolean);
        if (e.driver && e.driver === p.member_id) bits.push('🚗 És tu quem leva / vai buscar');
        else if (e.driver) bits.push(`🚗 ${name(e.driver)} leva`);
        if (e.special) bits.push('🕐 horário só deste dia');
        // A chave inclui a hora: se mudarem a hora depois do aviso, avisa outra vez com a hora nova.
        push(p, 'events', `ev:${e.id}:${date}${e.special ? `:${e.start || ''}` : ''}`, `⏰ ${e.title}`, bits.join(' · '), '#/agenda');
      });
    });
  });

  // Testes e trabalhos: na véspera às 19h, para a aluna e para os pais.
  if (due(today, 19 * 60)) {
    s.exams.filter((x) => x.date === tomorrow).forEach((x) => {
      const recipients = profiles.filter((p) => p.member_id === x.memberId || p.role === 'parent');
      recipients.forEach((p) => {
        const mine = p.member_id === x.memberId;
        const topics = x.topics || [];
        const studied = topics.length ? ` · 📚 ${topics.filter((t) => t.done).length}/${topics.length} tópicos estudados` : '';
        push(p, 'exams', `ex:${x.id}:${x.date}`, `📝 Amanhã: ${x.kind} de ${x.subject}`,
          `${mine ? 'Bom estudo! 💪' : name(x.memberId)}${studied}${!topics.length && x.notes ? ` · ${x.notes}` : ''}`, '#/escola');
      });
    });
  }

  // Tarefas por fazer: às 18h, para o responsável.
  if (due(today, 18 * 60)) {
    profiles.forEach((p) => {
      const mine = s.tasks.filter((t) => !t.done && !t.pending && t.assignee === p.member_id && t.due && t.due <= today);
      if (!mine.length) return;
      push(p, 'tasks', `tk:${today}`, mine.length === 1 ? '✅ Tens uma tarefa para hoje' : `✅ Tens ${mine.length} tarefas por fazer`,
        list(mine.map((t) => t.title)), '#/tarefas');
    });
  }

  // Resumo do dia: às 7h30.
  if (due(today, 7 * 60 + 30)) {
    profiles.forEach((p) => {
      const evs = s.events.filter((e) => occursOn(e, today)).map((e) => occurrence(e, today))
        .filter((e) => !(e.members || []).length || e.members.includes(p.member_id) || e.driver === p.member_id)
        .sort((a, b) => (a.start || '').localeCompare(b.start || ''));
      const exams = s.exams.filter((x) => x.date === today && x.memberId === p.member_id);
      const cls = s.classes.filter((c) => c.memberId === p.member_id && globalThis.Aulas.on(c, today))
        .sort((a, b) => a.start.localeCompare(b.start));
      const bits = [];
      if (cls.length) bits.push(`🎒 Aulas ${cls[0].start}–${cls[cls.length - 1].end}`);
      exams.forEach((x) => bits.push(`📝 ${x.kind} de ${x.subject}`));
      evs.forEach((e) => bits.push(`${e.start ? `${e.start} ` : ''}${e.title}`));
      if (!bits.length) return;
      push(p, 'digest', `dg:${today}`, `☀️ Bom dia, ${name(p.member_id)}!`, bits.join(' · '), '#/painel');
    });
  }

  // Resumo da semana: domingo às 20h.
  if (weekday(today) === 0 && due(today, 20 * 60)) {
    const days = Array.from({ length: 7 }, (_, i) => addDays(today, i + 1));
    profiles.forEach((p) => {
      const evCount = days.reduce((n, d) => n + s.events.filter((e) => occursOn(e, d)
        && (!(e.members || []).length || e.members.includes(p.member_id) || e.driver === p.member_id)).length, 0);
      const exams = s.exams.filter((x) => days.includes(x.date)
        && (x.memberId === p.member_id || p.role === 'parent'));
      const bits = [];
      if (evCount) bits.push(`${evCount} compromisso${evCount > 1 ? 's' : ''}`);
      if (exams.length) bits.push(`📝 ${list(exams.map((x) => `${x.subject} (${DIAS[weekday(x.date)]})`))}`);
      if (!bits.length) return;
      push(p, 'weekly', `wk:${today}`, '🗓️ A semana que vem', bits.join(' · '), '#/agenda');
    });
  }

  // Aprovações: logo que haja pedidos (para os pais) e respostas (para quem pediu).
  s.tasks.filter((t) => !t.done && t.pending).forEach((t) => {
    parents.forEach((p) => push(p, 'approvals', `ap:t:${t.id}:${t.pending.date}`, '🙋 Tarefa para aprovar',
      `${name(t.pending.by)} fez: ${t.title}`, '#/painel'));
  });
  s.redemptions.forEach((r) => {
    if (r.status === 'pending') {
      parents.forEach((p) => push(p, 'approvals', `ap:r:${r.id}`, '🎁 Pedido de recompensa',
        `${name(r.memberId)} pede: ${r.title} (⭐ ${r.cost})`, '#/tarefas'));
    } else if (r.date >= addDays(today, -2)) {
      usersOf([r.memberId]).filter((p) => p.role !== 'parent').forEach((p) => push(p, 'approvals', `rd:${r.id}:${r.status}`,
        r.status === 'approved' ? `🎁 Aprovado: ${r.title}` : `Pedido recusado: ${r.title}`,
        r.status === 'approved' ? 'Aproveita! 🎉' : 'Fala com os pais 🙂', '#/tarefas'));
    }
  });

  // Pedidos das filhas para as compras: os pais recebem o pedido; a filha recebe a resposta.
  s.shopreqs.forEach((r) => {
    const what = `${r.qty ? `${r.qty} ` : ''}${r.text}`;
    if (r.status === 'pending') {
      parents.forEach((p) => push(p, 'approvals', `ap:sr:${r.id}`, '🙋 Pedido para as compras',
        `${name(r.by)} pede: ${what}${r.note ? ` — ${r.note}` : ''}`, '#/compras'));
    } else if (r.answeredAt && r.answeredAt.slice(0, 10) >= addDays(today, -2)) {
      usersOf([r.by]).filter((p) => p.role !== 'parent').forEach((p) => push(p, 'approvals', `srd:${r.id}:${r.status}`,
        r.status === 'approved' ? `🛒 Sim! ${what} vai para a lista` : `Pedido recusado: ${what}`,
        r.status === 'approved' ? `${name(r.answeredBy)} disse que sim 🎉` : r.reason || 'Fala com os pais 🙂', '#/compras'));
    }
  });

  // Viagens: 7 dias e 1 dia antes, às 19h.
  if (due(today, 19 * 60)) {
    s.trips.forEach((t) => {
      [7, 1].forEach((n) => {
        if (t.start !== addDays(today, n)) return;
        const left = (t.packing || []).filter((x) => !x.done).length;
        usersOf(t.members || []).forEach((p) => push(p, 'trips', `tr:${t.id}:${n}`,
          n === 1 ? `✈️ Amanhã: ${t.destination}!` : `✈️ Falta uma semana: ${t.destination}`,
          left ? `Ainda há ${left} coisa${left > 1 ? 's' : ''} por preparar na lista.` : 'A lista está toda feita 👌', '#/viagens'));
      });
    });
  }

  // Aniversários: na véspera às 20h, para todos menos o aniversariante.
  if (due(today, 20 * 60)) {
    s.members.filter((m) => m.birthday && m.birthday.slice(5) === tomorrow.slice(5)).forEach((m) => {
      profiles.filter((p) => p.member_id !== m.id).forEach((p) => push(p, 'birthdays', `bd:${m.id}:${tomorrow.slice(0, 4)}`,
        `🎂 Amanhã faz anos: ${m.name}!`, `Já pensaram na surpresa? (${shortDate(tomorrow)})`, '#/painel'));
    });
  }

  // Documentos: 60, 30 e 7 dias antes e no próprio dia, às 9h (pais e o dono do documento).
  if (due(today, 9 * 60)) {
    s.docs.filter((d) => d.expires).forEach((d) => {
      const left = dayNum(d.expires) - dayNum(today);
      if (![60, 30, 7, 0].includes(left)) return;
      const who = d.memberId ? ` de ${name(d.memberId)}` : '';
      profiles.filter((p) => p.role === 'parent' || p.member_id === d.memberId).forEach((p) => push(p, 'docs', `doc:${d.id}:${d.expires}:${left}`,
        left ? `🔐 ${d.type}${who} expira daqui a ${left} dias` : `🔐 ${d.type}${who} expira hoje!`,
        `Validade: ${shortDate(d.expires)}. Convém tratar da renovação.`, '#/saude'));
    });

    // Contas da casa: 3 dias antes e no próprio dia (só pais).
    s.bills.filter((b) => b.due && !b.archived).forEach((b) => {
      const left = dayNum(b.due) - dayNum(today);
      if (left !== 3 && left !== 0) return;
      parents.forEach((p) => push(p, 'bills', `bill:${b.id}:${b.due}:${left}`,
        left ? `💶 ${b.title} vence daqui a 3 dias` : `💶 ${b.title} vence hoje`,
        `${money(b.amount)}${b.auto ? ' · débito directo' : ''}`, '#/financas'));
    });
  }

  // Fecho do mês: no último dia do mês às 19h, para os pais (se há contas e o mês ainda não foi fechado).
  if (addDays(today, 1).slice(8, 10) === '01' && due(today, 19 * 60)) {
    const month = today.slice(0, 7);
    if (s.faccounts.some((a) => !a.archived) && !s.fsnaps.some((x) => x.id === month)) {
      const nome = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'][Number(month.slice(5)) - 1];
      parents.forEach((p) => push(p, 'fecho', `fecho:${month}`, `📅 Fecho de ${nome}`,
        'Hoje é o último dia do mês: ponham o saldo de cada conta para ver a evolução do vosso dinheiro.', '#/financas'));
    }
  }

  // Orçamento: às 20h, as categorias que passaram 80 % ou 100 % do orçamento do mês (uma vez por nível, por mês).
  if (due(today, 20 * 60) && s.fbudgets.length) {
    const month = today.slice(0, 7);
    const spent = {};
    s.ftx.filter((t) => String(t.date).startsWith(month) && !BUDGET_SKIP.has(t.cat))
      .forEach((t) => { spent[t.cat] = (spent[t.cat] || 0) - Number(t.amount || 0); });
    s.fbudgets.filter((b) => Number(b.limit) > 0).forEach((b) => {
      const v = Math.round((spent[b.id] || 0) * 100) / 100;
      const pct = Math.round((v / Number(b.limit)) * 100);
      if (pct < 80) return;
      const level = pct >= 100 ? 100 : 80;
      const label = BUDGET_NAMES[b.id] || b.id;
      parents.forEach((p) => push(p, 'orcamento', `bud:${month}:${b.id}:${level}`,
        level === 100 ? `⛔ ${label}: passou o orçamento` : `⚠️ ${label}: ${pct}% do orçamento`,
        `${money(v)} de ${money(b.limit)} este mês${level === 100 ? ` (+${money(v - Number(b.limit))})` : ` · faltam ${money(Number(b.limit) - v)}`}.`, '#/financas'));
    });
  }

  // Datas especiais: 7 dias e 1 dia antes, às 20h, para todos.
  if (due(today, 20 * 60)) {
    s.dates.filter((d) => d.date).forEach((d) => {
      [7, 1].forEach((n) => {
        const day = addDays(today, n);
        if (d.date.slice(5) !== day.slice(5)) return;
        const years = d.knowYear !== false && d.knowYear !== 'nao' && d.date.slice(0, 4) < day.slice(0, 4) ? Number(day.slice(0, 4)) - Number(d.date.slice(0, 4)) : 0;
        profiles.forEach((p) => push(p, 'birthdays', `sd:${d.id}:${day.slice(0, 4)}:${n}`,
          `🎉 ${n === 1 ? 'Amanhã' : 'Daqui a uma semana'}: ${d.title}${years ? ` (${years} anos)` : ''}`,
          d.gifts ? `💡 Ideias: ${d.gifts}` : 'Já pensaram no presente?', '#/agenda'));
      });
    });
  }

  // Saúde: próxima consulta / vacina / dose na véspera às 19h (a pessoa e os pais).
  if (due(today, 19 * 60)) {
    s.health.filter((h) => h.next === tomorrow).forEach((h) => {
      profiles.filter((p) => p.role === 'parent' || p.member_id === h.memberId).forEach((p) => push(p, 'health', `hn:${h.id}:${h.next}`,
        `🏥 Amanhã: ${h.nextLabel || h.title}`, `${name(h.memberId)}${h.notes ? ` · ${h.notes}` : ''}`, '#/saude'));
    });
  }

  // Despensa: o que acaba o prazo amanhã, às 19h, numa só notificação (para toda a família).
  if (due(today, 19 * 60)) {
    const ending = s.pantry.filter((p) => p.expires === tomorrow).map((p) => p.name).sort((a, b) => a.localeCompare(b, 'pt'));
    if (ending.length) {
      profiles.forEach((p) => push(p, 'pantry', `pantry:${tomorrow}`, `🧺 Acaba o prazo amanhã: ${ending.join(', ')}`,
        'Aproveitem ao jantar ou amanhã — há receitas sugeridas na Despensa.', '#/refeicoes'));
    }
  }

  // Votações abertas: avisa quem ainda não votou (uma vez por votação).
  s.polls.filter((v) => !v.closed && v.date >= addDays(today, -2)).forEach((v) => {
    const voted = new Set(s.votes.filter((x) => x.pollId === v.id).map((x) => x.memberId));
    profiles.filter((p) => p.member_id !== v.createdBy && !voted.has(p.member_id)).forEach((p) => push(p, 'polls', `poll:${v.id}`,
      '🗳️ Nova votação na família', `${v.question} — ${name(v.createdBy)} quer saber a tua opinião`, '#/votacoes'));
  });

  return out;
}

const lastDayOfMonth = (iso) => {
  const [y, m] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};

/**
 * Mesadas a pagar hoje (a partir das 9h). O id é determinístico, por isso pagar duas vezes é impossível.
 * @returns {Array<{id, data}>} movimentos a criar na colecção "money"
 */
export function computeAllowances({ state, now }) {
  if (now.minutes < 9 * 60) return [];
  const today = now.date;
  const day = Number(today.slice(8));
  return (state.allowances || []).filter((a) => {
    if (a.active === false || a.active === 'nao' || !(Number(a.amount) > 0) || (a.start && a.start > today)) return false;
    if (a.frequency === 'monthly') return day === Math.min(Number(a.day) || 1, lastDayOfMonth(today));
    return weekday(today) === Number(a.day ?? 6);
  }).map((a) => {
    const id = `allow-${a.memberId}-${today}`;
    return { id, data: { id, memberId: a.memberId, amount: Number(a.amount), date: today, kind: 'mesada', note: 'Mesada' } };
  });
}

/** Notificação "recebeste a mesada" para quem a recebeu. */
export function allowanceNotices(entries, profiles) {
  const out = [];
  entries.forEach((e) => profiles.filter((p) => p.member_id === e.data.memberId && (p.notify || {}).money !== false).forEach((p) => {
    out.push({ key: `money:${e.id}:${p.user_id}`, userId: p.user_id, type: 'money', title: `💰 Recebeste a mesada: ${money(e.data.amount)}`,
      body: 'Já está na tua carteira. Que tal pôr uma parte no mealheiro? 🐷', url: '#/financas', tag: `money:${e.id}` });
  }));
  return out;
}
