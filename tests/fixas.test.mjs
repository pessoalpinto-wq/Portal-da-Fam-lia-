import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../js/orcamento.js';
import '../js/fixas.js';

const F = globalThis.Fixas;
const bills = [
  { id: 'luz', title: 'Luz', amount: 62.1, repeat: 'monthly', category: 'Casa', match: 'edp', due: '2026-10-28' },
  { id: 'net', title: 'Internet', amount: 45, repeat: 'monthly', category: 'Casa', match: 'meo', due: '2026-10-08' },
  { id: 'carro', title: 'Seguro do carro', amount: 300, repeat: 'semiannual', category: 'Seguros', match: 'fidelidade', due: '2026-10-15' },
  { id: 'casa', title: 'Seguro da casa', amount: 180, repeat: 'yearly', category: 'Seguros', match: 'allianz', due: '2027-03-01' },
  { id: 'agua', title: 'Água', amount: 30, repeat: 'bimonthly', category: 'Casa', due: '2026-11-10' },
  { id: 'iuc', title: 'IUC', amount: 120, repeat: 'none', category: 'Impostos', due: '2026-05-31' }, // não é fixa (só uma vez)
  { id: 'old', title: 'Ginásio', amount: 35, repeat: 'monthly', archived: true, match: 'ginasio' },
];

test('valor por mês e por ano de cada frequência', () => {
  assert.equal(F.perMonth(bills[0]), 62.1);
  assert.equal(F.perMonth(bills[2]), 50);
  assert.equal(F.perMonth(bills[3]), 15);
  assert.equal(F.perYear(bills[2]), 600);
  assert.equal(F.perYear(bills[4]), 180);
  assert.equal(F.perMonth(bills[5]), 0);
  assert.equal(F.perMonth(bills[6]), 0);
});

test('resumo: total por mês e por ano, grupos por frequência e por categoria', () => {
  const s = F.summary(bills);
  assert.equal(s.count, 5);
  assert.equal(s.month, 187.1); // 62,1 + 45 + 50 + 15 + 15
  assert.equal(s.year, 2245.2);
  assert.deepEqual(s.groups.map((g) => [g.label, g.items.length, g.total, g.perMonth]),
    [['Mensais', 2, 107.1, 107.1], ['De 2 em 2 meses', 1, 30, 15], ['Semestrais', 1, 300, 50], ['Anuais', 1, 180, 15]]);
  assert.deepEqual(s.byCategory, [{ category: 'Casa', perMonth: 122.1 }, { category: 'Seguros', perMonth: 65 }]);
});

test('que movimentos são de uma despesa fixa; fixas vs variáveis no mês', () => {
  assert.equal(F.billFor({ desc: 'DD EDP COMERCIAL', amount: -62.1 }, bills).id, 'luz');
  assert.equal(F.billFor({ desc: 'FIDELIDADE SEGUROS', amount: -300 }, bills).id, 'carro');
  assert.equal(F.billFor({ desc: 'DD EDP COMERCIAL', amount: 20 }, bills), null); // entrada (reembolso) não conta
  assert.equal(F.billFor({ desc: 'GINASIO X', amount: -35 }, bills), null); // arquivada
  const txs = [
    { date: '2026-09-28', desc: 'DD EDP COMERCIAL', amount: -62.1, cat: 'contas' },
    { date: '2026-09-08', desc: 'DD MEO', amount: -45, cat: 'contas' },
    { date: '2026-09-10', desc: 'COMPRA PINGO DOCE', amount: -432.1, cat: 'supermercado' },
    { date: '2026-09-12', desc: 'NETFLIX', amount: -7.99, cat: 'subscricoes', fixed: true }, // marcado à mão
    { date: '2026-09-29', desc: 'VENCIMENTO', amount: 1850, cat: 'entradas' },
    { date: '2026-09-24', desc: 'TRF', amount: -300, cat: 'transferencias' },
  ];
  const kindOf = (c) => globalThis.Orcamento.kindOf(c);
  assert.deepEqual(F.monthSplit(txs, bills, '2026-09', kindOf), { fixed: 115.09, variable: 432.1 });
});

test('marcar como paga sozinha: só perto da data, uma vez por vencimento, avisa se o valor mudou', () => {
  const novos = [
    { id: 't1', date: '2026-10-27', desc: 'DD EDP COMERCIAL', amount: -64.3 }, // 1 dia antes de 28/10, valor diferente
    { id: 't2', date: '2026-10-08', desc: 'DD MEO', amount: -45 },
    { id: 't3', date: '2026-10-09', desc: 'DD MEO', amount: -45 }, // segundo débito no mesmo mês: não paga outra vez
    { id: 't4', date: '2026-12-20', desc: 'ALLIANZ SEGUROS', amount: -180 }, // longe de 01/03/2027
    { id: 't5', date: '2026-10-20', desc: 'COMPRA LIDL', amount: -12 },
  ];
  const r = F.autoPay(bills, novos);
  assert.deepEqual(r.map((x) => [x.billId, x.forDue, x.nextDue, x.changed]),
    [['net', '2026-10-08', '2026-11-08', false], ['luz', '2026-10-28', '2026-11-28', true]]);
  assert.equal(r[1].amount, 64.3);
  // Já paga para este vencimento: não repete.
  const paid = bills.map((b) => (b.id === 'net' ? { ...b, history: [{ forDue: '2026-10-08' }] } : b));
  assert.equal(F.autoPay(paid, novos).filter((x) => x.billId === 'net').length, 0);
});

test('datas: somar meses sem saltar para o mês seguinte (31 de janeiro + 1 mês = 28 de fevereiro)', () => {
  assert.equal(F.addMonths('2027-01-31', 1), '2027-02-28');
  assert.equal(F.addMonths('2026-10-15', 6), '2027-04-15');
  assert.equal(F.addMonths('2026-12-01', 12), '2027-12-01');
});
