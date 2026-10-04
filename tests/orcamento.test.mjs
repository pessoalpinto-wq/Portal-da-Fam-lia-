import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../js/folhas.js';
import '../js/orcamento.js';

const O = globalThis.Orcamento;
const F = globalThis.Folhas;

// Extratos inventados, ao jeito de cada banco (valores e descritivos fictícios).
const CGD = `Consultar saldos e movimentos à ordem
Conta;0000 000000 000
Período;01-09-2026 a 30-09-2026

Data mov.;Data valor;Descrição;Débito;Crédito;Saldo contabilístico;Saldo disponível
30-09-2026;30-09-2026;COMPRA 1234 CONTINENTE MATOSINHOS;45,20;;1.234,56;1.234,56
29-09-2026;29-09-2026;TRF VENCIMENTO EMPRESA XPTO;;1.850,00;1.279,76;1.279,76
28-09-2026;28-09-2026;DD EDP COMERCIAL;62,10;;;
28-09-2026;28-09-2026;COMPRA 1234 GALP ENERGIA;50,00;;;
27-09-2026;27-09-2026;PRENDAS LOJA DO BAIRRO;15,00;;;
27-09-2026;27-09-2026;COMPRA 1234 CAFE CENTRAL;0,80;;;
27-09-2026;27-09-2026;COMPRA 1234 CAFE CENTRAL;0,80;;;
;;Saldo final;;;1.234,56;
`;
const MILLENNIUM = `Data lançamento;Data valor;Descrição;Montante;Tipo;Saldo
15/09/2026;15/09/2026;PAG SERV NETFLIX;7,99;D;500,00
16/09/2026;16/09/2026;TRANSFERENCIA DE CONTA CGD;300,00;C;800,00
`;
const REVOLUT = `Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance
CARD_PAYMENT,Current,2026-09-10 12:01:00,2026-09-11 09:00:00,Uber Eats,-23.40,0.00,EUR,COMPLETED,100.00
CARD_PAYMENT,Current,2026-09-12 18:00:00,2026-09-12 18:01:00,Uber,-8.10,0.00,EUR,COMPLETED,91.90
TOPUP,Current,2026-09-13 10:00:00,,Top-up,50.00,0.00,EUR,DECLINED,91.90
`;

test('CSV: separador, aspas e linhas antes do cabeçalho', () => {
  assert.equal(F.sniff(CGD), ';');
  assert.equal(F.sniff(REVOLUT), ',');
  assert.deepEqual(F.parseCSV('a;"b;c";"d ""e"""\n1;2;3'), [['a', 'b;c', 'd "e"'], ['1', '2', '3']]);
  const rows = F.parseCSV(CGD);
  const h = O.findHeader(rows);
  assert.equal(rows[h.index][0], 'Data mov.');
  assert.equal(h.map.date, 0); // "Data mov.", não "Data valor"
  assert.equal(h.map.debit, 3);
  assert.equal(h.map.credit, 4);
  assert.equal(h.map.amount, -1);
});

test('valores e datas em todos os formatos dos bancos', () => {
  const m = O.parseMoney;
  assert.equal(m('1.234,56'), 1234.56);
  assert.equal(m('-45,20'), -45.2);
  assert.equal(m('45,20-'), -45.2);
  assert.equal(m('(12,00)'), -12);
  assert.equal(m('-12.50'), -12.5);
  assert.equal(m('1,234.56'), 1234.56);
  assert.equal(m('€ 3,00'), 3);
  assert.equal(m('2.000'), 2000);
  assert.equal(m('1 850,00 EUR'), 1850);
  assert.equal(m(''), null);
  assert.equal(m('abc'), null);
  const d = O.parseDate;
  assert.equal(d('30-09-2026'), '2026-09-30');
  assert.equal(d('30/09/26'), '2026-09-30');
  assert.equal(d('2026-09-30 14:22:01'), '2026-09-30');
  assert.equal(d('5.9.2026'), '2026-09-05');
  assert.equal(d('31-02-2026'), null);
  assert.equal(d('Saldo final'), null);
});

test('extrato CGD: débito/crédito, ignora rodapé, mantém os dois cafés iguais', () => {
  const rows = F.parseCSV(CGD);
  const mv = O.toMovements(rows, O.findHeader(rows));
  assert.equal(mv.length, 7);
  assert.deepEqual(mv[0], { date: '2026-09-30', desc: 'COMPRA 1234 CONTINENTE MATOSINHOS', amount: -45.2, balance: 1234.56 });
  assert.equal(mv[1].amount, 1850);
});

test('Santander: "Data Operação" é a data, não a descrição', () => {
  const m = O.mapHeader(['Data Operação', 'Data valor', 'Descrição', 'Montante( EUR )', 'Saldo Contabilístico( EUR )']);
  assert.deepEqual([m.date, m.desc, m.amount, m.balance], [0, 2, 3, 4]);
});

test('extrato Millennium: coluna D/C dá o sinal; Revolut: ignora recusados', () => {
  let rows = F.parseCSV(MILLENNIUM);
  let mv = O.toMovements(rows, O.findHeader(rows));
  assert.deepEqual(mv.map((x) => x.amount), [-7.99, 300]);
  rows = F.parseCSV(REVOLUT);
  const h = O.findHeader(rows);
  assert.equal(rows[0][h.map.date], 'Completed Date');
  mv = O.toMovements(rows, h);
  assert.deepEqual(mv.map((x) => [x.date, x.desc, x.amount]), [['2026-09-11', 'Uber Eats', -23.4], ['2026-09-12', 'Uber', -8.1]]);
});

test('categorias: lojas portuguesas, palavra inteira/início de palavra, regras da família primeiro', () => {
  const c = (d, a = -10, r) => O.categorize(d, a, r).cat;
  assert.equal(c('COMPRA 1234 CONTINENTE MATOSINHOS'), 'supermercado');
  assert.equal(c('COMPRA PINGO DOCE PORTO'), 'supermercado');
  assert.equal(c('COMPRA 1234 GALP ENERGIA'), 'carro');
  assert.equal(c('DD EDP COMERCIAL'), 'contas');
  assert.equal(c('Uber Eats'), 'restaurantes'); // a regra mais comprida ganha a "uber"
  assert.equal(c('Uber'), 'transportes');
  assert.equal(c('PAG SERV NETFLIX'), 'subscricoes');
  assert.equal(c('FIDELIDADE SEGUROS'), 'seguros');
  assert.equal(c('PRENDAS LOJA DO BAIRRO'), 'outros'); // "renda" não apanha "PRENDAS"
  assert.equal(c('TRF BPI JOAO'), 'outros'); // "bp " não apanha "BPI"
  assert.equal(c('TRF VENCIMENTO EMPRESA XPTO', 1850), 'entradas');
  assert.equal(c('MB WAY RECEBIDO', 20), 'entradas');
  assert.equal(O.categorize('XYZ', -5).rule, 'none');
  assert.equal(c('COMPRA 1234 CONTINENTE', -10, [{ match: 'continente', cat: 'casa' }]), 'casa');
  assert.equal(c('COMPRA CAFE CENTRAL', -1, [{ match: 'cafe central', cat: 'lazer' }]), 'lazer');
  assert.equal(c('COMPRA 999 LOJA DO ZÉ', -1, [{ match: 'loja ze', cat: 'casa' }]), 'casa'); // ignora o "do"
  assert.equal(c('COMPRA LOJAS NOVAS', -1, [{ match: 'loja ze', cat: 'casa' }]), 'outros');
});

test('nome da loja para criar uma regra', () => {
  assert.equal(O.merchantKey('COMPRA 4521 CONTINENTE MATOSINHOS 12/09'), 'continente matosinhos');
  assert.equal(O.merchantKey('DD EDP COMERCIAL'), 'edp comercial');
  assert.equal(O.merchantKey('PAG SERV NETFLIX.COM'), 'netflix');
});

test('importar: ids estáveis, não repete, dois cafés iguais contam como dois', () => {
  const rows = F.parseCSV(CGD);
  const mv = O.toMovements(rows, O.findHeader(rows));
  const a = O.prepareImport([], mv, 'acc1');
  assert.equal(a.fresh.length, 7);
  assert.equal(a.dup, 0);
  assert.equal(new Set(a.fresh.map((t) => t.id)).size, 7);
  const cafes = a.fresh.filter((t) => t.desc.includes('CAFE'));
  assert.equal(cafes.length, 2);
  // Importar outra vez o mesmo extrato (e mais um movimento novo): só entra o novo.
  const again = O.prepareImport(a.fresh, [...mv, { date: '2026-10-01', desc: 'COMPRA LIDL', amount: -12 }], 'acc1');
  assert.equal(again.dup, 7);
  assert.deepEqual(again.fresh.map((t) => [t.desc, t.cat]), [['COMPRA LIDL', 'supermercado']]);
  // Noutra conta, o mesmo movimento é outro movimento.
  assert.equal(O.prepareImport(a.fresh, mv.slice(0, 1), 'acc2').fresh.length, 1);
});

test('transferências entre as vossas contas: mesmo valor, contas diferentes, até 3 dias', () => {
  const txs = [
    { id: '1', account: 'cgd', date: '2026-09-15', amount: -300, cat: 'outros' },
    { id: '2', account: 'mil', date: '2026-09-16', amount: 300, cat: 'entradas' },
    { id: '3', account: 'cgd', date: '2026-09-15', amount: -50, cat: 'outros' },
    { id: '4', account: 'cgd', date: '2026-09-15', amount: 50, cat: 'entradas' }, // mesma conta: não é transferência
    { id: '5', account: 'cgd', date: '2026-09-01', amount: -99, cat: 'outros' },
    { id: '6', account: 'mil', date: '2026-09-10', amount: 99, cat: 'entradas' }, // 9 dias depois: não
  ];
  assert.deepEqual(O.findTransfers(txs).sort(), ['1', '2']);
});

test('o mês: entrou, saiu, poupado, por categoria, transferências e poupança não contam', () => {
  const txs = [
    { date: '2026-09-29', amount: 1850, cat: 'entradas' },
    { date: '2026-09-30', amount: -45.2, cat: 'supermercado', rule: 'default' },
    { date: '2026-09-20', amount: -100, cat: 'supermercado', rule: 'default' },
    { date: '2026-09-21', amount: 10, cat: 'supermercado', rule: 'default' }, // devolução
    { date: '2026-09-22', amount: -300, cat: 'transferencias' },
    { date: '2026-09-23', amount: -200, cat: 'poupanca' },
    { date: '2026-09-24', amount: -15, cat: 'outros', rule: 'none' },
    { date: '2026-08-30', amount: -999, cat: 'supermercado' },
  ];
  const s = O.monthSummary(txs, '2026-09');
  assert.equal(s.income, 1850);
  assert.equal(s.expense, 150.2);
  assert.equal(s.saved, 1699.8);
  assert.equal(s.rate, 92);
  assert.equal(s.byCat.supermercado, 135.2);
  assert.equal(s.moved, 500);
  assert.equal(s.unsorted, 1);
});

test('orçamento: % gasto, nível (80 % aviso, 100 % passou) e média dos 3 meses anteriores', () => {
  const txs = [
    { date: '2026-09-05', amount: -420, cat: 'supermercado' },
    { date: '2026-09-06', amount: -90, cat: 'restaurantes' },
    { date: '2026-09-07', amount: -30, cat: 'lazer' },
    { date: '2026-08-05', amount: -380, cat: 'supermercado' },
    { date: '2026-07-05', amount: -400, cat: 'supermercado' },
    { date: '2026-06-05', amount: -360, cat: 'supermercado' },
  ];
  const budgets = [{ id: 'supermercado', limit: 500 }, { id: 'restaurantes', limit: 80 }, { id: 'roupa', limit: 100 }];
  const rows = O.budgetRows(txs, budgets, '2026-09');
  const by = Object.fromEntries(rows.map((r) => [r.cat, r]));
  assert.equal(by.supermercado.pct, 84);
  assert.equal(by.supermercado.level, 'warn');
  assert.equal(by.supermercado.avg, 380);
  assert.equal(by.restaurantes.level, 'over');
  assert.equal(by.roupa.spent, 0);
  assert.equal(by.roupa.level, 'ok');
  assert.equal(by.lazer.limit, null);
  assert.deepEqual(rows.slice(0, 3).map((r) => r.cat).sort(), ['restaurantes', 'roupa', 'supermercado']); // com orçamento primeiro
  assert.deepEqual(O.budgetAlerts(txs, budgets, '2026-09').map((a) => [a.cat, a.level]), [['supermercado', 80], ['restaurantes', 100]]);
});
