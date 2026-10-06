import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chat, runTool, propose, conflicts, toMessages, context, TOOLS, SYSTEM, cost } from '../supabase/functions/_shared/assistente.js';

const today = '2026-10-06'; // terça
const now = { date: today, minutes: 14 * 60 + 30 };
const state = {
  members: [
    { id: 'pai', name: 'Luís', role: 'pai', points: 0 }, { id: 'mae', name: 'Cátia', role: 'mae', points: 0 },
    { id: 'mari', name: 'Mariana', role: 'filha', birthday: '2010-04-20', points: 12 }, { id: 'lu', name: 'Luísa', role: 'filha', birthday: '2014-11-15', points: 7 },
  ],
  events: [
    { id: 'e1', title: 'Treino', date: '2026-09-03', start: '18:00', end: '19:30', repeat: 'weekly', members: ['lu'], location: 'Pavilhão' },
    { id: 'e2', title: 'Jantar avós', date: '2026-10-10', start: '20:00', members: ['pai', 'mae', 'mari', 'lu'] },
  ],
  classes: [{ id: 'c1', memberId: 'lu', day: 4, start: '16:55', end: '17:45', subject: 'Educação Física' }],
  exams: [
    { id: 'x1', memberId: 'lu', subject: 'Francês', kind: 'Teste', date: '2026-10-08', notes: 'Unidade 1' },
    { id: 'x2', memberId: 'mari', subject: 'Matemática A', kind: 'Teste', date: '2026-09-30', grade: '17' },
  ],
  tasks: [
    { id: 't1', title: 'Arrumar o quarto', assignee: 'mari', due: '2026-10-05', repeat: 'weekly', points: 5, done: false },
    { id: 't2', title: 'Pôr a mesa', assignee: 'lu', due: today, repeat: 'daily', points: 2, done: false },
  ],
  shopping: [{ id: 's1', text: 'Leite', qty: '', done: false }],
  bills: [{ id: 'b1', title: 'Seguro do carro', amount: 300, repeat: 'semiannual', due: '2026-10-15' }],
  ftx: [
    { id: 'f1', date: '2026-10-02', desc: 'PINGO DOCE', amount: -82.4, cat: 'supermercado' },
    { id: 'f2', date: '2026-10-03', desc: 'RESTAURANTE O ZE', amount: -45, cat: 'restaurantes' },
    { id: 'f3', date: '2026-09-12', desc: 'RESTAURANTE', amount: -30, cat: 'restaurantes' },
    { id: 'f4', date: '2026-10-01', desc: 'VENCIMENTO', amount: 1850, cat: 'entradas' },
  ],
  fbudgets: [{ id: 'restaurantes', limit: 100 }],
  contacts: [{ id: 'k1', name: 'Diretora de turma 7.º B', phone: '252000000', category: 'Escola' }],
};

test('ferramentas definidas e instruções em PT-PT sem dados que mudam (para a cache)', () => {
  assert.deepEqual(TOOLS.map((t) => t.name), ['ver_agenda', 'ver_tarefas', 'ver_escola', 'ver_compras', 'ver_financas', 'procurar', 'propor_tarefa', 'propor_evento', 'propor_compras', 'propor_recado']);
  assert.ok(!/\d{4}-\d{2}-\d{2}/.test(SYSTEM));
  assert.match(context(state, { me: 'pai', now }), /terça, 2026-10-06, 14:30.*\n.*Luís \(pai\)[\s\S]*Mariana \(filha, 16 anos\)/);
});

test('agenda: compromissos que se repetem, aulas, testes e tarefas; filtro por pessoa', () => {
  const r = runTool(state, 'ver_agenda', { de: '2026-10-08', ate: '2026-10-08' }, today).text;
  assert.match(r, /quinta 8\/10/);
  assert.match(r, /🏫 16:55–17:45 Educação Física · Luísa/);
  assert.match(r, /📅 18:00–19:30 Treino @ Pavilhão \(Luísa\)/);
  assert.match(r, /📝 Teste de Francês · Luísa · Unidade 1/);
  const mari = runTool(state, 'ver_agenda', { de: '2026-10-08', ate: '2026-10-10', pessoa: 'mariana' }, today).text;
  assert.ok(!/Treino/.test(mari) && /Jantar avós/.test(mari));
  assert.match(runTool(state, 'ver_agenda', { de: 'ontem', ate: '2026-10-08' }, today).text, /^Erro/);
  assert.match(runTool(state, 'ver_agenda', { de: today, ate: today, pessoa: 'Joana' }, today).text, /não conheço "Joana"/);
});

test('tarefas, escola, finanças e procurar', () => {
  assert.match(runTool(state, 'ver_tarefas', {}, today).text, /Arrumar o quarto · Mariana · ATRASADA até segunda 5\/10 · todas as semanas · 5 ⭐/);
  const esc = runTool(state, 'ver_escola', { pessoa: 'Luísa' }, today).text;
  assert.match(esc, /Teste de Francês/);
  assert.match(esc, /Luísa · quinta 16:55–17:45 Educação Física/);
  const fin = runTool(state, 'ver_financas', {}, today).text;
  assert.match(fin, /Entradas: 1850,00 € · Gastos: 127,40 € \(mês anterior: 30,00 €\)/);
  assert.match(fin, /Restaurantes e cafés: 45,00 € de 100,00 € orçamentados \(45%\) · mês anterior 30,00 €/);
  assert.match(fin, /Despesas fixas: 1 · 50,00 €\/mês · 600,00 €\/ano/);
  assert.match(runTool(state, 'procurar', { texto: 'diretora turma' }, today).text, /Contacto: Diretora de turma 7.º B · 252000000/);
});

test('propostas: validadas, com nomes trocados por ids e conflitos', () => {
  const t = propose(state, 'propor_tarefa', { titulo: 'Tirar o lixo', responsavel: 'Luisa', data: '2026-10-12', repete: 'weekly' }, today);
  assert.deepEqual(t.proposal, { type: 'task', title: 'Tirar o lixo', assignee: 'lu', due: '2026-10-12', repeat: 'weekly', points: 2, category: 'Casa', notes: '' });
  assert.equal(propose(state, 'propor_tarefa', { titulo: 'Ir ao banco', responsavel: 'Luís' }, today).proposal.points, 0);
  assert.match(propose(state, 'propor_tarefa', { titulo: 'X', responsavel: 'Rui' }, today).error, /Rui/);
  const ev = propose(state, 'propor_evento', { titulo: 'Reunião DT', data: '2026-10-08', inicio: '17:30', fim: '18:30', pessoas: ['Luís', 'Luísa'] }, today).proposal;
  assert.deepEqual(ev.members, ['pai', 'lu']);
  assert.deepEqual(ev.conflicts, ['Treino 18:00–19:30', 'Luísa tem Educação Física 16:55–17:45', 'Luísa tem Teste de Francês nesse dia']);
  assert.deepEqual(conflicts(state, { date: '2026-10-08', start: '10:00', members: ['pai'] }), []);
  assert.match(propose(state, 'propor_evento', { titulo: 'X', data: '2026-10-01' }, today).error, /já passou/);
  assert.match(propose(state, 'propor_evento', { titulo: 'X', data: '2026-10-09', inicio: '25:00' }, today).error, /Hora/);
  const sh = propose(state, 'propor_compras', { itens: [{ nome: 'leite' }, { nome: 'Ovos', quantidade: '12', categoria: 'Frescos' }] }, today).proposal;
  assert.deepEqual(sh, { type: 'shopping', items: [{ text: 'Ovos', qty: '12', category: 'Frescos' }], already: ['leite'] });
  assert.deepEqual(propose(state, 'propor_recado', { texto: 'Jantar às 20h' }, today).proposal, { type: 'note', text: 'Jantar às 20h', pinned: false });
});

test('histórico: só texto, alterna papéis e começa num pedido', () => {
  assert.deepEqual(toMessages([{ role: 'assistant', text: 'Olá!' }, { role: 'user', text: 'a' }, { role: 'user', text: 'b' }, { role: 'assistant', text: '' }]),
    [{ role: 'user', content: 'a\n\nb' }]);
});

test('conversa: chama ferramentas, junta propostas e devolve a resposta final', async () => {
  const calls = [];
  const script = [
    { stop_reason: 'tool_use', usage: { input_tokens: 900, output_tokens: 60, cache_creation_input_tokens: 2500 },
      content: [{ type: 'thinking', thinking: '…', signature: 'x' }, { type: 'tool_use', id: 'u1', name: 'ver_agenda', input: { de: '2026-10-08', ate: '2026-10-08' } }] },
    { stop_reason: 'tool_use', usage: { input_tokens: 400, output_tokens: 80, cache_read_input_tokens: 2500 },
      content: [{ type: 'tool_use', id: 'u2', name: 'propor_evento', input: { titulo: 'Reunião com a diretora de turma', data: '2026-10-08', inicio: '18:00', fim: '19:00', pessoas: ['Luís'] } },
        { type: 'tool_use', id: 'u3', name: 'propor_tarefa', input: { titulo: 'Arrumar o quarto', responsavel: 'Mariana', data: '2026-10-10', pontos: 5 } }] },
    { stop_reason: 'end_turn', usage: { input_tokens: 300, output_tokens: 50, cache_read_input_tokens: 2500 },
      content: [{ type: 'text', text: 'Proponho a reunião às 18h e a tarefa da Mariana. Confirma nos cartões abaixo.' }] },
  ];
  const client = { messages: { create: async (p) => { calls.push(structuredClone(p)); return script.shift(); } } };
  const r = await chat({ client, state, me: 'pai', now, history: [{ role: 'user', text: 'Marca reunião com a DT quinta às 18h e põe a Mariana a arrumar o quarto até sábado, 5 pontos' }] });
  assert.equal(r.reply, 'Proponho a reunião às 18h e a tarefa da Mariana. Confirma nos cartões abaixo.');
  assert.deepEqual(r.proposals.map((p) => [p.type, p.title]), [['event', 'Reunião com a diretora de turma'], ['task', 'Arrumar o quarto']]);
  assert.deepEqual(r.proposals[0].conflicts, []); // o treino é da Luísa: só contam pessoas em comum
  assert.equal(r.proposals[1].summary, 'Tarefa "Arrumar o quarto" para Mariana até 2026-10-10, 5 pontos');
  assert.deepEqual(r.usage, { input: 1600, output: 190, cacheRead: 5000, cacheWrite: 2500 });
  assert.equal(calls.length, 3);
  assert.equal(calls[0].model, 'claude-sonnet-5-5');
  assert.equal(calls[0].system[0].cache_control.type, 'ephemeral');
  assert.equal(calls[2].messages.length, 5); // pedido, ferramenta, resultado, ferramentas, resultados
  assert.match(calls[1].messages[2].content[0].content, /Treino/);
  assert.ok(cost(r.usage) > 0 && cost(r.usage) < 0.02);
});

test('conversa: recusa e limite de passos', async () => {
  const refuse = { messages: { create: async () => ({ stop_reason: 'refusal', content: [], usage: {} }) } };
  assert.equal((await chat({ client: refuse, state, me: 'pai', now, history: [{ role: 'user', text: 'x' }] })).reply, 'Desculpa, não posso ajudar com isso.');
  const loop = { messages: { create: async () => ({ stop_reason: 'tool_use', usage: {}, content: [{ type: 'tool_use', id: 'u', name: 'ver_compras', input: {} }] }) } };
  const r = await chat({ client: loop, state, me: 'pai', now, history: [{ role: 'user', text: 'x' }] });
  assert.match(r.reply, /Não consegui terminar/);
  await assert.rejects(chat({ client: loop, state, me: 'pai', now, history: [] }), /Falta a pergunta/);
});
