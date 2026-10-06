/*
 * Assistente da família (IA): o que o Claude sabe, as ferramentas que pode usar e a conversa.
 * - Ferramentas "ver_*" e "procurar": leem os dados da família (correm aqui, no servidor).
 * - Ferramentas "propor_*": não gravam nada — devolvem uma proposta que a app mostra num cartão
 *   e que só é guardada quando a pessoa toca em ✔ Confirmar.
 * Módulo puro (o cliente da API é passado de fora), testado em tests/assistente.test.mjs.
 * Usado por supabase/functions/assistente/index.ts.
 */
import './aulas.js';
import { addDays, occurrence, occursOn, BUDGET_SKIP, BUDGET_NAMES } from './reminders.js';

export const MODEL = 'claude-sonnet-5-5';
export const MAX_STEPS = 8;
const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const TASK_CATS = ['Casa', 'Quarto', 'Cozinha', 'Roupa', 'Animais', 'Escola', 'Saúde', 'Recados', 'Outro'];
const SHOP_CATS = ['Frescos', 'Talho e peixaria', 'Padaria', 'Mercearia', 'Congelados', 'Bebidas', 'Limpeza', 'Higiene', 'Bebé', 'Animais', 'Outro'];

const weekday = (iso) => new Date(`${iso}T12:00:00Z`).getUTCDay();
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
const isTime = (s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s || ''));
const dm = (iso) => `${DIAS[weekday(iso)]} ${Number(iso.slice(8))}/${Number(iso.slice(5, 7))}`;
const money = (n) => `${(Math.round(Number(n || 0) * 100) / 100).toFixed(2).replace('.', ',')} €`;
const strip = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const clip = (s, n = 160) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };
const hm = (t) => { const [h, m] = String(t).split(':').map(Number); return h * 60 + (m || 0); };

/** Estado com todas as colecções que o assistente usa (as que faltam ficam vazias). */
export function normalize(state = {}) {
  const s = { ...state };
  ['members', 'events', 'tasks', 'classes', 'exams', 'trips', 'shopping', 'pantry', 'notes', 'contacts', 'health', 'docs',
    'dates', 'bills', 'recipes', 'projects', 'ftx', 'fbudgets', 'faccounts', 'fsnaps', 'debts'].forEach((k) => { if (!Array.isArray(s[k])) s[k] = []; });
  return s;
}

const nameOf = (s, id) => s.members.find((m) => m.id === id)?.name || '';
const names = (s, ids = []) => ids.map((id) => nameOf(s, id)).filter(Boolean).join(', ');
/** "Luísa" → id (aceita id, nome sem acentos, "pai"/"mãe"). */
function memberId(s, who) {
  if (!who) return '';
  if (s.members.some((m) => m.id === who)) return who;
  const k = strip(who).trim();
  const m = s.members.find((x) => strip(x.name) === k) || s.members.find((x) => strip(x.role) === k);
  return m ? m.id : null;
}

/* ---------------- Instruções (fixas: ficam em cache) ---------------- */
export const SYSTEM = `És o assistente do "Portal da Família", a aplicação de organização de uma família portuguesa.
Falas com os pais (o pai ou a mãe). Respondes sempre em português de Portugal (PT-PT), de forma calorosa, curta e prática — a maior parte das respostas é lida num telemóvel.

O que podes fazer:
- Responder a perguntas sobre a família usando as ferramentas: agenda (compromissos, aulas, testes, tarefas, viagens, aniversários, consultas, contas a pagar), tarefas e pontos, escola (testes, notas, horários), compras e despensa, finanças (gastos por categoria, orçamento, despesas fixas, património e dívidas) e procurar em recados, contactos, saúde, documentos, receitas e viagens.
- Propor coisas novas com as ferramentas propor_tarefa, propor_evento, propor_compras e propor_recado. Estas ferramentas NÃO gravam: a aplicação mostra um cartão e a pessoa confirma. Por isso, depois de propor, diz algo como "Confirma no cartão abaixo." — nunca digas que já ficou marcado.
- Responder a perguntas gerais (receitas, ideias, explicações, escrever um email ou mensagem) com o teu conhecimento.

Regras:
- Nunca inventes dados da família: se a pergunta é sobre a família, consulta primeiro as ferramentas. Se não encontrares, diz que não está no portal.
- Datas: usa a data de hoje que vem no contexto. "Amanhã", "sexta", "próxima semana" são relativos a hoje; a semana começa à segunda. Escreve datas como "quinta, 8/10".
- Antes de propor um compromisso, vê a agenda desse dia (ver_agenda) para avisar de conflitos com aulas, testes ou outros compromissos; a ferramenta propor_evento também devolve conflitos.
- Se faltar algo essencial (ex.: "marca uma reunião" sem dia), pergunta em vez de adivinhar. Se for claro, propõe logo — a pessoa pode corrigir no cartão.
- Para as filhas, as tarefas têm pontos (normalmente 1 a 5; 2 se não disserem). Para os pais, pontos 0.
- Quando várias coisas são pedidas de uma vez, faz várias propostas.
- Não mexes em bancos, pagamentos ou transferências, não envias emails nem mensagens: podes escrever o texto para a pessoa enviar.
- Não mostres identificadores internos (ids). Usa os nomes.
- Dinheiro em euros com vírgula: 1 234,50 €.
- Respostas curtas: listas com poucos pontos, sem cabeçalhos grandes. Usa emojis com moderação (📅 ✅ 📝 🛒 💶).`;

/* ---------------- Ferramentas ---------------- */
const str = (description) => ({ type: 'string', description });
export const TOOLS = [
  {
    name: 'ver_agenda',
    description: 'Tudo o que acontece entre duas datas (inclusive): compromissos, aulas, testes, tarefas com data, viagens, aniversários, datas especiais, consultas, documentos a expirar e contas a pagar. Máximo 31 dias.',
    input_schema: {
      type: 'object',
      properties: {
        de: str('Data inicial AAAA-MM-DD'),
        ate: str('Data final AAAA-MM-DD'),
        pessoa: str('Opcional: nome de uma pessoa para filtrar'),
        aulas: { type: 'boolean', description: 'Incluir as aulas do horário escolar (por omissão: só se o intervalo tiver até 7 dias)' },
      },
      required: ['de', 'ate'],
    },
  },
  {
    name: 'ver_tarefas',
    description: 'Tarefas por fazer (ou as últimas feitas) e os pontos de cada pessoa.',
    input_schema: {
      type: 'object',
      properties: { pessoa: str('Opcional: nome'), feitas: { type: 'boolean', description: 'true = últimas tarefas feitas' } },
    },
  },
  {
    name: 'ver_escola',
    description: 'Escola: próximos testes e trabalhos (com a matéria), notas já registadas e o horário semanal das aulas.',
    input_schema: { type: 'object', properties: { pessoa: str('Opcional: nome da filha') } },
  },
  {
    name: 'ver_compras',
    description: 'Lista de compras por comprar e o que há na despensa.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'ver_financas',
    description: 'Finanças de um mês: gastos por categoria, entradas, orçamento, despesas fixas, último fecho do património e dívidas. Pode comparar com o mês anterior.',
    input_schema: { type: 'object', properties: { mes: str('AAAA-MM (por omissão o mês actual)') } },
  },
  {
    name: 'procurar',
    description: 'Procura um texto em recados, contactos, saúde, documentos, receitas, viagens, projectos, compromissos e movimentos bancários.',
    input_schema: { type: 'object', properties: { texto: str('O que procurar') }, required: ['texto'] },
  },
  {
    name: 'propor_tarefa',
    description: 'Propõe uma tarefa nova. Não grava: a pessoa confirma num cartão.',
    input_schema: {
      type: 'object',
      properties: {
        titulo: str('Ex.: Arrumar o quarto'),
        responsavel: str('Nome de quem faz (vazio = por atribuir)'),
        data: str('Data limite AAAA-MM-DD (vazio = sem data)'),
        repete: { type: 'string', enum: ['none', 'daily', 'weekly', 'monthly'] },
        pontos: { type: 'integer', minimum: 0, maximum: 50 },
        categoria: { type: 'string', enum: TASK_CATS },
        notas: str('Opcional'),
      },
      required: ['titulo'],
    },
  },
  {
    name: 'propor_evento',
    description: 'Propõe um compromisso na agenda da família (reunião, consulta, treino, jantar…). Não grava: a pessoa confirma num cartão. Devolve os conflitos desse dia.',
    input_schema: {
      type: 'object',
      properties: {
        titulo: str('Ex.: Reunião com a diretora de turma'),
        data: str('AAAA-MM-DD'),
        inicio: str('HH:MM (vazio = dia todo)'),
        fim: str('HH:MM (opcional)'),
        pessoas: { type: 'array', items: { type: 'string' }, description: 'Nomes de quem está envolvido' },
        local: str('Opcional'),
        repete: { type: 'string', enum: ['none', 'weekly', 'monthly', 'yearly'] },
        ate: str('Se se repete: até quando, AAAA-MM-DD (opcional)'),
        quem_leva: str('Opcional: nome de quem leva / vai buscar'),
        notas: str('Opcional'),
      },
      required: ['titulo', 'data'],
    },
  },
  {
    name: 'propor_compras',
    description: 'Propõe juntar produtos à lista de compras. Não grava: a pessoa confirma num cartão.',
    input_schema: {
      type: 'object',
      properties: {
        itens: {
          type: 'array',
          items: {
            type: 'object',
            properties: { nome: str('Ex.: Leite meio-gordo'), quantidade: str('Ex.: 2 L, 6, 1 kg (opcional)'), categoria: { type: 'string', enum: SHOP_CATS } },
            required: ['nome'],
          },
        },
      },
      required: ['itens'],
    },
  },
  {
    name: 'propor_recado',
    description: 'Propõe um recado no quadro da família (visível para todos). Não grava: a pessoa confirma num cartão.',
    input_schema: {
      type: 'object',
      properties: { texto: str('O recado'), fixar: { type: 'boolean', description: 'Fixar no topo' } },
      required: ['texto'],
    },
  },
];

/* ---------------- Leitura ---------------- */
function agendaDay(s, date, { who, classes }) {
  const out = [];
  const has = (ids) => !who || (ids || []).includes(who);
  s.events.filter((e) => occursOn(e, date)).map((e) => occurrence(e, date)).filter((e) => has(e.members)).forEach((e) => {
    out.push([e.start || '', `📅 ${e.start ? `${e.start}${e.end ? `–${e.end}` : ''} ` : ''}${e.title}${e.location ? ` @ ${e.location}` : ''}${e.members?.length ? ` (${names(s, e.members)})` : ''}${e.driver ? ` · leva: ${nameOf(s, e.driver)}` : ''}${e.special ? ' · horário alterado neste dia' : ''}${e.notes ? ` · ${clip(e.notes, 80)}` : ''}`]);
  });
  if (classes) {
    s.classes.filter((c) => (!who || c.memberId === who) && globalThis.Aulas.on(c, date)).forEach((c) => {
      out.push([c.start || '', `🏫 ${c.start}–${c.end} ${c.subject}${c.room ? ` (sala ${c.room})` : ''} · ${nameOf(s, c.memberId)}`]);
    });
  }
  s.exams.filter((x) => x.date === date && (!who || x.memberId === who)).forEach((x) => out.push(['', `📝 ${x.kind || 'Teste'} de ${x.subject} · ${nameOf(s, x.memberId)}${x.notes ? ` · ${clip(x.notes, 80)}` : ''}`]));
  s.tasks.filter((t) => !t.done && t.due === date && (!who || t.assignee === who)).forEach((t) => out.push(['', `✅ ${t.title}${t.assignee ? ` · ${nameOf(s, t.assignee)}` : ''}`]));
  s.trips.filter((t) => t.start && t.start <= date && date <= (t.end || t.start) && has(t.members)).forEach((t) => out.push(['', `✈️ ${t.destination}`]));
  s.members.filter((m) => m.birthday && m.birthday.slice(5) === date.slice(5)).forEach((m) => out.push(['', `🎂 Anos: ${m.name}`]));
  s.dates.filter((d) => d.date && d.date.slice(5) === date.slice(5)).forEach((d) => out.push(['', `🎉 ${d.title}`]));
  s.health.filter((h) => h.next === date && (!who || h.memberId === who)).forEach((h) => out.push(['', `🏥 ${h.nextLabel || h.title} · ${nameOf(s, h.memberId)}`]));
  s.docs.filter((d) => d.expires === date).forEach((d) => out.push(['', `🔐 Expira: ${d.type}${d.memberId ? ` (${nameOf(s, d.memberId)})` : ''}`]));
  if (!who) s.bills.filter((b) => b.due === date && !b.archived).forEach((b) => out.push(['', `💶 Pagar: ${b.title}${b.amount ? ` (${money(b.amount)})` : ''}`]));
  return out.sort((a, b) => (a[0] || '99').localeCompare(b[0] || '99')).map((x) => x[1]);
}

function verAgenda(s, { de, ate, pessoa, aulas }) {
  if (!isDate(de) || !isDate(ate) || ate < de) return 'Erro: datas inválidas (AAAA-MM-DD).';
  const who = memberId(s, pessoa);
  if (who === null) return `Erro: não conheço "${pessoa}". Pessoas: ${s.members.map((m) => m.name).join(', ')}.`;
  const days = [];
  for (let d = de; d <= ate && days.length < 31; d = addDays(d, 1)) days.push(d);
  const classes = aulas ?? days.length <= 7;
  const lines = days.map((d) => {
    const items = agendaDay(s, d, { who, classes });
    return items.length ? `${dm(d)} (${d}):\n${items.map((x) => `  ${x}`).join('\n')}` : `${dm(d)} (${d}): nada`;
  });
  return `${lines.join('\n')}${ate > days.at(-1) ? '\n(só os primeiros 31 dias)' : ''}${classes ? '' : '\n(aulas do horário não incluídas)'}`;
}

const REP = { daily: 'todos os dias', weekly: 'todas as semanas', monthly: 'todos os meses' };
function verTarefas(s, { pessoa, feitas }, today) {
  const who = memberId(s, pessoa);
  if (who === null) return `Erro: não conheço "${pessoa}".`;
  const mine = (t) => !who || t.assignee === who;
  const pts = s.members.map((m) => `${m.name}: ${m.points || 0} ⭐`).join(', ');
  if (feitas) {
    const done = s.tasks.filter((t) => t.done && mine(t)).sort((a, b) => String(b.doneAt || '').localeCompare(String(a.doneAt || ''))).slice(0, 15);
    return `Pontos: ${pts}\nÚltimas feitas:\n${done.map((t) => `- ${t.title} · ${nameOf(s, t.assignee) || 'sem responsável'}${t.doneAt ? ` · ${String(t.doneAt).slice(0, 10)}` : ''}`).join('\n') || '(nenhuma)'}`;
  }
  const pend = s.tasks.filter((t) => !t.done && mine(t)).sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
  return `Hoje: ${today}. Pontos: ${pts}\nPor fazer (${pend.length}):\n${pend.slice(0, 40).map((t) => `- ${t.title} · ${nameOf(s, t.assignee) || 'por atribuir'}${t.due ? ` · ${t.due < today ? 'ATRASADA ' : ''}até ${dm(t.due)}` : ''}${REP[t.repeat] ? ` · ${REP[t.repeat]}` : ''} · ${t.points || 0} ⭐${t.pending ? ' · à espera de aprovação' : ''}`).join('\n') || '(nenhuma)'}`;
}

function verEscola(s, { pessoa }, today) {
  const who = memberId(s, pessoa);
  if (who === null) return `Erro: não conheço "${pessoa}".`;
  const mine = (x) => !who || x.memberId === who;
  const up = s.exams.filter((x) => mine(x) && x.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 25);
  const past = s.exams.filter((x) => mine(x) && x.date < today).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15);
  const cls = s.classes.filter(mine).sort((a, b) => (a.memberId || '').localeCompare(b.memberId || '') || a.day - b.day || String(a.start).localeCompare(String(b.start)));
  const every = (c) => (Number(c.every) > 1 ? ` (de ${c.every} em ${c.every} semanas)` : '');
  return [
    `Próximos testes/trabalhos (${up.length}):`,
    ...up.map((x) => `- ${dm(x.date)} (${x.date}): ${x.kind || 'Teste'} de ${x.subject} · ${nameOf(s, x.memberId)}${x.notes ? ` · ${clip(x.notes, 100)}` : ''}`),
    'Notas recentes:',
    ...(past.length ? past.map((x) => `- ${x.date}: ${x.subject} · ${nameOf(s, x.memberId)} · ${x.grade ? `nota ${x.grade}` : 'sem nota registada'}`) : ['(nenhuma)']),
    'Horário semanal:',
    ...(cls.length ? cls.map((c) => `- ${nameOf(s, c.memberId)} · ${DIAS[c.day]} ${c.start}–${c.end} ${c.subject}${every(c)}${c.until ? ` até ${c.until}` : ''}`) : ['(sem aulas registadas)']),
  ].join('\n');
}

function verCompras(s) {
  const pend = s.shopping.filter((x) => !x.done);
  return `Lista de compras (${pend.length}): ${pend.map((x) => `${x.qty ? `${x.qty} ` : ''}${x.text}`).join(', ') || '(vazia)'}
Despensa (${s.pantry.length}): ${s.pantry.slice(0, 80).map((p) => `${p.name || p.text || p.nome}${p.qty ? ` (${p.qty})` : ''}${p.expires ? ` val. ${p.expires}` : ''}`).join(', ') || '(vazia)'}`;
}

const prevMonth = (m) => { const [y, mo] = m.split('-').map(Number); return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, '0')}`; };
const PERIODS = { monthly: 1, bimonthly: 2, quarterly: 3, semiannual: 6, yearly: 12 };
function monthSpend(s, m) {
  const by = {};
  let income = 0;
  s.ftx.filter((t) => String(t.date).startsWith(m)).forEach((t) => {
    if (t.cat === 'entradas') { income += Number(t.amount) || 0; return; }
    if (BUDGET_SKIP.has(t.cat)) return;
    by[t.cat || 'outros'] = (by[t.cat || 'outros'] || 0) - (Number(t.amount) || 0);
  });
  return { by, income, total: Object.values(by).reduce((n, v) => n + v, 0) };
}
function verFinancas(s, { mes }, today) {
  const m = /^\d{4}-\d{2}$/.test(String(mes || '')) ? mes : today.slice(0, 7);
  const cur = monthSpend(s, m);
  const prev = monthSpend(s, prevMonth(m));
  const cats = Object.entries(cur.by).filter(([, v]) => Math.abs(v) >= 0.01).sort((a, b) => b[1] - a[1]);
  const limit = Object.fromEntries(s.fbudgets.map((b) => [b.id, Number(b.limit) || 0]));
  const fixed = s.bills.filter((b) => !b.archived && PERIODS[b.repeat]);
  const perMonth = fixed.reduce((n, b) => n + (Number(b.amount) || 0) / PERIODS[b.repeat], 0);
  const snaps = [...s.fsnaps].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const last = snaps.at(-1);
  const sum = (o) => Object.values(o || {}).reduce((n, v) => n + (Number(v) || 0), 0);
  const lines = [
    `Mês ${m}${s.ftx.length ? '' : ' — ainda não há movimentos importados'}:`,
    `Entradas: ${money(cur.income)} · Gastos: ${money(cur.total)} (mês anterior: ${money(prev.total)})`,
    ...cats.map(([c, v]) => `- ${BUDGET_NAMES[c] || c}: ${money(v)}${limit[c] ? ` de ${money(limit[c])} orçamentados (${Math.round((v / limit[c]) * 100)}%)` : ''}${prev.by[c] ? ` · mês anterior ${money(prev.by[c])}` : ''}`),
    `Despesas fixas: ${fixed.length} · ${money(perMonth)}/mês · ${money(perMonth * 12)}/ano`,
    ...fixed.slice(0, 30).map((b) => `- ${b.title}: ${money(b.amount)} ${({ monthly: 'mensal', bimonthly: 'de 2 em 2 meses', quarterly: 'trimestral', semiannual: 'semestral', yearly: 'anual' })[b.repeat]}${b.due ? ` · próximo ${b.due}` : ''}`),
  ];
  if (last) {
    const a = sum(last.values);
    const d = sum(last.debts);
    lines.push(`Património (fecho de ${last.id}): contas ${money(a)}, dívidas ${money(d)}, líquido ${money(a - d)}`);
    const before = snaps.at(-2);
    if (before) lines.push(`Fecho anterior (${before.id}): líquido ${money(sum(before.values) - sum(before.debts))}`);
  }
  s.debts.filter((d) => !d.archived).forEach((d) => lines.push(`Dívida: ${d.name || d.title} · prestação ${money(d.payment)}${last?.debts?.[d.id] != null ? ` · em dívida ${money(last.debts[d.id])}` : ''}`));
  return lines.join('\n');
}

function procurar(s, { texto }) {
  const q = strip(texto).trim();
  if (q.length < 2) return 'Erro: texto demasiado curto.';
  const words = q.split(/\s+/);
  const hit = (...fields) => { const t = strip(fields.filter(Boolean).join(' ')); return words.every((w) => t.includes(w)); };
  const out = [];
  s.notes.forEach((n) => hit(n.text) && out.push(`Recado (${n.date || ''}): ${clip(n.text)}`));
  s.contacts.forEach((c) => hit(c.name, c.category, c.notes) && out.push(`Contacto: ${c.name}${c.phone ? ` · ${c.phone}` : ''}${c.email ? ` · ${c.email}` : ''}${c.notes ? ` · ${clip(c.notes, 80)}` : ''}`));
  s.health.forEach((h) => hit(h.title, h.type, h.notes, h.nextLabel) && out.push(`Saúde: ${h.date} ${h.type || ''} ${h.title} · ${nameOf(s, h.memberId)}${h.next ? ` · próxima ${h.next}` : ''}`));
  s.docs.forEach((d) => hit(d.type, d.notes) && out.push(`Documento: ${d.type}${d.memberId ? ` (${nameOf(s, d.memberId)})` : ''} · validade ${d.expires || '?'}`));
  s.recipes.forEach((r) => hit(r.title, r.name, (r.tags || []).join(' ')) && out.push(`Receita: ${r.title || r.name}`));
  s.trips.forEach((t) => hit(t.destination, t.notes, t.lodging) && out.push(`Viagem: ${t.destination} ${t.start || ''}${t.end ? `→${t.end}` : ''}${t.lodging ? ` · ${t.lodging}` : ''}`));
  s.projects.forEach((p) => hit(p.title, p.notes) && out.push(`Projecto: ${p.title}`));
  s.events.forEach((e) => hit(e.title, e.location, e.notes) && out.push(`Compromisso: ${e.title} · ${e.date}${e.repeat && e.repeat !== 'none' ? ` (repete: ${e.repeat})` : ''}`));
  s.ftx.filter((t) => hit(t.desc)).sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 15)
    .forEach((t) => out.push(`Movimento: ${t.date} ${clip(t.desc, 60)} ${money(t.amount)}`));
  return out.length ? out.slice(0, 30).join('\n') : `Nada encontrado para "${texto}".`;
}

/* ---------------- Propostas ---------------- */
/** Conflitos de um compromisso novo: outros compromissos, aulas e testes das pessoas envolvidas. */
export function conflicts(state, { date, start, end, members = [] }) {
  if (!start) return [];
  const s = normalize(state);
  const a = hm(start);
  const b = end ? hm(end) : a + 60;
  // Sobrepõe-se a [a, b)? (sem hora de fim, conta 1 hora)
  const overlap = (x, y) => x != null && isTime(x) && hm(x) < b && (isTime(y) ? hm(y) : hm(x) + 60) > a;
  const shared = (ids) => !members.length || !ids?.length || ids.some((id) => members.includes(id));
  const out = [];
  s.events.filter((e) => occursOn(e, date)).map((e) => occurrence(e, date))
    .filter((e) => overlap(e.start, e.end) && shared(e.members))
    .forEach((e) => out.push(`${e.title} ${e.start}${e.end ? `–${e.end}` : ''}`));
  s.classes.filter((c) => members.includes(c.memberId) && globalThis.Aulas.on(c, date) && overlap(c.start, c.end))
    .forEach((c) => out.push(`${nameOf(s, c.memberId)} tem ${c.subject} ${c.start}–${c.end}`));
  s.exams.filter((x) => x.date === date && members.includes(x.memberId)).forEach((x) => out.push(`${nameOf(s, x.memberId)} tem ${x.kind || 'teste'} de ${x.subject} nesse dia`));
  return out;
}

/** Valida e normaliza uma proposta. → { proposal } ou { error } */
export function propose(state, name, input = {}, today) {
  const s = normalize(state);
  const t = (v, n = 200) => clip(v, n);
  if (name === 'propor_tarefa') {
    if (!t(input.titulo)) return { error: 'Falta o título.' };
    const who = memberId(s, input.responsavel);
    if (who === null) return { error: `Não conheço "${input.responsavel}".` };
    if (input.data && !isDate(input.data)) return { error: 'Data inválida (AAAA-MM-DD).' };
    const kid = who && !['pai', 'mae'].includes(s.members.find((m) => m.id === who)?.role);
    return {
      proposal: {
        type: 'task', title: t(input.titulo, 120), assignee: who || '', due: input.data || '',
        repeat: ['daily', 'weekly', 'monthly'].includes(input.repete) ? input.repete : 'none',
        points: Number.isInteger(input.pontos) ? Math.max(0, Math.min(50, input.pontos)) : kid ? 2 : 0,
        category: TASK_CATS.includes(input.categoria) ? input.categoria : 'Casa', notes: t(input.notas, 500),
      },
    };
  }
  if (name === 'propor_evento') {
    if (!t(input.titulo)) return { error: 'Falta o título.' };
    if (!isDate(input.data)) return { error: 'Data inválida (AAAA-MM-DD).' };
    if (input.data < today && (input.repete || 'none') === 'none') return { error: 'Essa data já passou.' };
    if (input.inicio && !isTime(input.inicio)) return { error: 'Hora de início inválida (HH:MM).' };
    if (input.fim && (!isTime(input.fim) || !input.inicio || input.fim <= input.inicio)) return { error: 'Hora de fim inválida.' };
    const members = [];
    for (const p of input.pessoas || []) {
      const id = memberId(s, p);
      if (id === null) return { error: `Não conheço "${p}".` };
      if (id && !members.includes(id)) members.push(id);
    }
    const driver = memberId(s, input.quem_leva);
    if (driver === null) return { error: `Não conheço "${input.quem_leva}".` };
    const ev = {
      type: 'event', title: t(input.titulo, 120), date: input.data, start: input.inicio || '', end: input.fim || '',
      members, location: t(input.local, 120), repeat: ['weekly', 'monthly', 'yearly'].includes(input.repete) ? input.repete : 'none',
      until: isDate(input.ate) ? input.ate : '', driver: driver || '', notes: t(input.notas, 500),
    };
    ev.conflicts = conflicts(s, ev);
    return { proposal: ev };
  }
  if (name === 'propor_compras') {
    const pend = new Set(s.shopping.filter((x) => !x.done).map((x) => strip(x.text)));
    const items = (Array.isArray(input.itens) ? input.itens : []).map((i) => ({
      text: t(i?.nome, 80), qty: t(i?.quantidade, 20), category: SHOP_CATS.includes(i?.categoria) ? i.categoria : 'Outro',
    })).filter((i) => i.text);
    if (!items.length) return { error: 'Lista vazia.' };
    const fresh = items.filter((i) => !pend.has(strip(i.text)));
    const already = items.filter((i) => pend.has(strip(i.text))).map((i) => i.text);
    if (!fresh.length) return { error: `Já está tudo na lista: ${already.join(', ')}.` };
    return { proposal: { type: 'shopping', items: fresh, already } };
  }
  if (name === 'propor_recado') {
    if (!t(input.texto, 1000)) return { error: 'Falta o texto.' };
    return { proposal: { type: 'note', text: t(input.texto, 1000), pinned: !!input.fixar } };
  }
  return { error: 'Ferramenta desconhecida.' };
}

/** Resumo de uma proposta em texto (para o histórico e para o modelo). */
export function describe(s, p) {
  if (p.type === 'task') return `Tarefa "${p.title}"${p.assignee ? ` para ${nameOf(s, p.assignee)}` : ''}${p.due ? ` até ${p.due}` : ''}${REP[p.repeat] ? `, ${REP[p.repeat]}` : ''}, ${p.points} pontos`;
  if (p.type === 'event') return `Compromisso "${p.title}" em ${p.date}${p.start ? ` às ${p.start}${p.end ? `–${p.end}` : ''}` : ''}${p.members.length ? ` (${names(s, p.members)})` : ''}`;
  if (p.type === 'shopping') return `Compras: ${p.items.map((i) => `${i.qty ? `${i.qty} ` : ''}${i.text}`).join(', ')}`;
  if (p.type === 'note') return `Recado: "${clip(p.text, 80)}"`;
  return '';
}

/** Executa uma ferramenta. → { text, proposal? } */
export function runTool(state, name, input, today) {
  const s = normalize(state);
  try {
    if (name === 'ver_agenda') return { text: verAgenda(s, input || {}) };
    if (name === 'ver_tarefas') return { text: verTarefas(s, input || {}, today) };
    if (name === 'ver_escola') return { text: verEscola(s, input || {}, today) };
    if (name === 'ver_compras') return { text: verCompras(s) };
    if (name === 'ver_financas') return { text: verFinancas(s, input || {}, today) };
    if (name === 'procurar') return { text: procurar(s, input || {}) };
    if (name.startsWith('propor_')) {
      const r = propose(s, name, input || {}, today);
      if (r.error) return { text: `Erro: ${r.error}`, error: true };
      const c = r.proposal.conflicts?.length ? ` Conflitos nesse dia: ${r.proposal.conflicts.join('; ')}.` : '';
      return { text: `Proposta mostrada à pessoa num cartão para confirmar: ${describe(s, r.proposal)}.${c}`, proposal: r.proposal };
    }
    return { text: `Erro: ferramenta desconhecida "${name}".`, error: true };
  } catch (e) {
    return { text: `Erro ao ler os dados: ${String(e?.message || e)}`, error: true };
  }
}

/** Contexto que muda a cada pedido (fica depois da parte em cache). */
export function context(s, { me, now }) {
  const who = s.members.find((m) => m.id === me);
  const age = (b) => { if (!b) return ''; const n = Number(now.date.slice(0, 4)) - Number(b.slice(0, 4)) - (now.date.slice(5) < b.slice(5) ? 1 : 0); return `, ${n} anos`; };
  const ROLE = { pai: 'pai', mae: 'mãe', filha: 'filha', filho: 'filho' };
  const h = `${String(Math.floor(now.minutes / 60)).padStart(2, '0')}:${String(now.minutes % 60).padStart(2, '0')}`;
  return `Hoje é ${DIAS[weekday(now.date)]}, ${now.date}, ${h} (hora de Lisboa).
Quem está a falar contigo: ${who ? `${who.name} (${ROLE[who.role] || who.role})` : 'um dos pais'}. "Eu"/"mim" = esta pessoa.
Família: ${s.members.map((m) => `${m.name} (${ROLE[m.role] || m.role || 'membro'}${age(m.birthday)})`).join('; ')}.`;
}

/** Histórico vindo da app → mensagens da API (só texto; no máximo as últimas 12, a começar num pedido). */
export function toMessages(history = []) {
  const msgs = [];
  history.slice(-12).forEach((h) => {
    const role = h?.role === 'assistant' ? 'assistant' : 'user';
    const text = clip(h?.text, 4000);
    if (!text) return;
    if (msgs.length && msgs.at(-1).role === role) msgs.at(-1).content += `\n\n${text}`;
    else msgs.push({ role, content: text });
  });
  while (msgs.length && msgs[0].role !== 'user') msgs.shift();
  return msgs;
}

/**
 * Uma volta de conversa: chama o Claude e as ferramentas até haver resposta final.
 * @param {{ messages: { create(params): Promise<any> } }} client  cliente da API (Anthropic SDK)
 * @returns {Promise<{ reply: string, proposals: object[], usage: object, steps: number }>}
 */
export async function chat({ client, state, me, now, history, model = MODEL }) {
  const s = normalize(state);
  const messages = toMessages(history);
  if (!messages.length || messages.at(-1).role !== 'user') throw new Error('Falta a pergunta.');
  const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  const proposals = [];
  let text = '';
  let steps = 0;
  for (; steps < MAX_STEPS; steps++) {
    const res = await client.messages.create({
      model,
      max_tokens: 4000,
      output_config: { effort: 'medium' },
      system: [
        { type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: context(s, { me, now }) },
      ],
      tools: TOOLS,
      messages,
    });
    usage.input += res.usage?.input_tokens || 0;
    usage.output += res.usage?.output_tokens || 0;
    usage.cacheRead += res.usage?.cache_read_input_tokens || 0;
    usage.cacheWrite += res.usage?.cache_creation_input_tokens || 0;
    const blocks = res.content || [];
    const said = blocks.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
    if (said) text = said;
    if (res.stop_reason === 'refusal') return { reply: 'Desculpa, não posso ajudar com isso.', proposals, usage, steps: steps + 1 };
    const calls = blocks.filter((b) => b.type === 'tool_use');
    if (res.stop_reason !== 'tool_use' || !calls.length) {
      if (res.stop_reason === 'max_tokens' && !text) text = 'A resposta ficou demasiado longa. Experimenta perguntar de forma mais específica.';
      break;
    }
    messages.push({ role: 'assistant', content: blocks });
    messages.push({
      role: 'user',
      content: calls.map((c) => {
        const r = runTool(s, c.name, c.input, now.date);
        if (r.proposal) proposals.push({ ...r.proposal, summary: describe(s, r.proposal) });
        return { type: 'tool_result', tool_use_id: c.id, content: r.text, ...(r.error ? { is_error: true } : {}) };
      }),
    });
  }
  if (steps >= MAX_STEPS && !text) text = 'Não consegui terminar. Experimenta perguntar de outra forma.';
  return { reply: text, proposals, usage, steps: Math.min(steps + 1, MAX_STEPS) };
}

/** Custo aproximado em dólares (Sonnet 5.5: $2 / $10 por milhão; cache: leitura 0,1×, escrita 1,25×). */
export const cost = (u) => (u.input * 2 + u.cacheRead * 0.2 + u.cacheWrite * 2.5 + u.output * 10) / 1e6;
