import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../js/extrato-pdf.js';
import '../js/orcamento.js';

const X = globalThis.ExtratoPDF;
const line = (y, ...cells) => ({ y, cells: cells.map(([x, str]) => ({ x, str })) });

test('cartão de crédito em PDF (tipo Wizink): datas sem ano, coluna em euros, compras como despesa', () => {
  const p1 = [
    line(700, [28, 'Banco Exemplo · Wizink Bank']),
    line(530, [90, '16/12/2025'], [269, '15/01/2026'], [415, 'de 16/12/2025 a 15/01/2026']),
    line(487, [79, 'Limite de crédito'], [438, 'Saldo disponível']),
  ];
  const p2 = [
    line(392, [31, 'Data'], [79, 'Data'], [365, 'Montante'], [422, 'Mo. origem /'], [514, 'Montante']),
    line(383, [31, 'operação'], [79, 'valor'], [368, 'original'], [434, 'Moeda'], [515, 'em euros']),
    line(367, [31, 'Nº cartão – ************0000']),
    line(349, [31, '20/12'], [79, '21/12'], [142, 'LOJA TESTE PORTO'], [526, '45,90 €']),
    line(332, [31, '03/01'], [79, '04/01'], [142, 'AMAZON EU'], [365, '30,00'], [434, 'USD'], [523, '27,80 €']),
    line(315, [31, '08/01'], [79, '08/01'], [142, 'DEVOLUÇÃO LOJA TESTE'], [523, '10,00 €']),
    line(298, [31, '10/01'], [79, '10/01'], [142, 'CONTINENTE MATOSINHOS'], [519, '1.234,56 €']),
    line(228, [45, 'Pagamentos efetuados no período a que se refere o extrato']),
    line(212, [31, 'Total de pagamentos efetuados'], [102, '100,00€']),
  ];
  const rows = X.toRows([p1, p2]);
  assert.deepEqual(rows, [
    ['Extrato PDF · Cartão de crédito · Wizink'],
    ['Data', 'Descrição', 'Montante'],
    ['2025-12-20', 'LOJA TESTE PORTO', '-45.9'], // dezembro → ano anterior ao fim do período
    ['2026-01-03', 'AMAZON EU', '-27.8'], // em euros, não os 30 USD
    ['2026-01-08', 'DEVOLUÇÃO LOJA TESTE', '10'], // devolução: entra
    ['2026-01-10', 'CONTINENTE MATOSINHOS', '-1234.56'],
  ]);
  const O = globalThis.Orcamento;
  const mv = O.toMovements(rows, O.findHeader(rows));
  assert.equal(mv.length, 4);
  assert.equal(O.looksLikeCard(rows, mv), true);
});

test('conta à ordem em PDF (tipo Santander): valor com sinal, sem confundir com o saldo', () => {
  const p = [
    line(800, [40, 'Extrato Santander'], [300, 'PERÍODO DE 2026-05-01 A 2026-05-31']),
    line(700, [30, 'Data Mov'], [90, 'Data Valor'], [160, 'Descritivo do Movimento'], [380, 'Moeda'], [430, 'Valor'], [510, 'Saldo']),
    line(690, [30, '01-05'], [90, '01-05'], [160, 'Saldo Inicial'], [510, '1.000,00']),
    line(680, [30, '02-05'], [90, '02-05'], [160, 'COMPRA MERCADONA'], [380, 'EUR'], [430, '-45,20'], [510, '954,80']),
    line(670, [30, '28-05'], [90, '28-05'], [160, 'TRF ORDENADO'], [380, 'EUR'], [430, '1.500,00'], [510, '2.454,80']),
  ];
  const rows = X.toRows([p]);
  assert.deepEqual(rows.slice(1), [['Data', 'Descrição', 'Montante'], ['2026-05-02', 'COMPRA MERCADONA', '-45.2'], ['2026-05-28', 'TRF ORDENADO', '1500']]);
  assert.match(rows[0][0], /Santander/);
  assert.doesNotMatch(rows[0][0], /Cartão/);
});

test('juntar itens do pdf.js em linhas e células', () => {
  const it = (x, y, str, width = 10) => ({ str, transform: [1, 0, 0, 1, x, y], width });
  const lines = X.linesFromItems([it(100, 500.4, 'B'), it(30, 500, '12/01'), it(200, 499, '12,'), it(210.5, 499, '30 €'), it(30, 480, 'outra')]);
  assert.deepEqual(lines.map((l) => l.cells.map((c) => c.str)), [['12/01', 'B', '12,30 €'], ['outra']]);
});

test('período e datas', () => {
  assert.deepEqual(X.period('de 16/12/2025 a 15/01/2026'), { from: '2025-12-16', to: '2026-01-15' });
  assert.equal(X.isoDate('31/12', { to: '2026-01-15' }), '2025-12-31');
  assert.equal(X.isoDate('15/01/2026', null), '2026-01-15');
  assert.equal(X.isoDate('40/01', { to: '2026-01-15' }), null);
});
