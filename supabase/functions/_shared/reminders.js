/*
 * Decide que lembretes enviar, a quem e quando (hora de Lisboa).
 * É uma função pura: recebe os dados da família e a hora actual e devolve a lista
 * de notificações. A função "send-reminders" corre de 10 em 10 minutos e usa uma
 * chave única por notificação para nunca enviar a mesma duas vezes.
 */

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
  birthdays: 'Aniversários (na véspera)',
};

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

export function occursOn(e, date) {
  if (!e.date) return false;
  if (e.date === date) return true;
  if (e.date > date || (e.until && date > e.until)) return false;
  if (e.repeat === 'weekly') return weekday(e.date) === weekday(date);
  if (e.repeat === 'monthly') return e.date.slice(8) === date.slice(8);
  if (e.repeat === 'yearly') return e.date.slice(5) === date.slice(5);
  return false;
}

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const shortDate = (iso) => `${DIAS[weekday(iso)]}, ${Number(iso.slice(8))}/${Number(iso.slice(5, 7))}`;
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
    members: [], events: [], tasks: [], exams: [], trips: [], redemptions: [], classes: [], ...state,
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
    s.events.filter((e) => occursOn(e, date)).forEach((e) => {
      const target = e.start ? hm(e.start) - 60 : 8 * 60;
      if (!due(date, target)) return;
      const ids = new Set([...(e.members || []), ...(e.driver ? [e.driver] : [])]);
      const recipients = ids.size ? usersOf([...ids]) : profiles;
      recipients.forEach((p) => {
        const bits = [e.start ? `${date === today ? 'Hoje' : 'Amanhã'} às ${e.start}` : 'Hoje', e.location].filter(Boolean);
        if (e.driver && e.driver === p.member_id) bits.push('🚗 És tu quem leva / vai buscar');
        else if (e.driver) bits.push(`🚗 ${name(e.driver)} leva`);
        push(p, 'events', `ev:${e.id}:${date}`, `⏰ ${e.title}`, bits.join(' · '), '#/agenda');
      });
    });
  });

  // Testes e trabalhos: na véspera às 19h, para a aluna e para os pais.
  if (due(today, 19 * 60)) {
    s.exams.filter((x) => x.date === tomorrow).forEach((x) => {
      const recipients = profiles.filter((p) => p.member_id === x.memberId || p.role === 'parent');
      recipients.forEach((p) => {
        const mine = p.member_id === x.memberId;
        push(p, 'exams', `ex:${x.id}:${x.date}`, `📝 Amanhã: ${x.kind} de ${x.subject}`,
          `${mine ? 'Bom estudo! 💪' : name(x.memberId)}${x.notes ? ` · ${x.notes}` : ''}`, '#/escola');
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
      const evs = s.events.filter((e) => occursOn(e, today)
        && (!(e.members || []).length || e.members.includes(p.member_id) || e.driver === p.member_id))
        .sort((a, b) => (a.start || '').localeCompare(b.start || ''));
      const exams = s.exams.filter((x) => x.date === today && x.memberId === p.member_id);
      const cls = s.classes.filter((c) => c.memberId === p.member_id && Number(c.day) === weekday(today))
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

  return out;
}
