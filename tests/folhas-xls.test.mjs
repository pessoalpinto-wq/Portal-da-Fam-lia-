import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../js/folhas.js';
import '../js/orcamento.js';

const F = globalThis.Folhas;

import { cfb, workbook, rec, le16, le32, f64, latin, rkInt, rkCents } from './xls-writer.js';

const strings = ['Data Operação', 'Descrição', 'Montante (EUR)', '02-10-2026', 'COMPRA TPA*0000 MERCADO TESTE', 'PAGAMENTO CTA_CARTÃO APP/NETBANCO', 'Comissão de manutenção'];
const sst = (r, c, i) => rec(0x00fd, [...le16(r), ...le16(c), ...le16(15), ...le32(i)]);
const num = (r, c, x, xf = 15) => rec(0x0203, [...le16(r), ...le16(c), ...le16(xf), ...f64(x)]);
const cells = [
  sst(0, 0, 0), sst(0, 1, 1), sst(0, 2, 2),
  sst(1, 0, 3), sst(1, 1, 4), num(1, 2, -12.34),
  num(2, 0, 46297, 16), sst(2, 1, 5), rec(0x027e, [...le16(2), ...le16(2), ...le16(15), ...rkInt(350)]),
  sst(3, 1, 6), rec(0x00bd, [...le16(3), ...le16(2), ...le16(15), ...rkCents(-3.5), ...le16(15), ...rkInt(7), ...le16(3)]),
  rec(0x0204, [...le16(4), ...le16(1), ...le16(15), ...le16(5), 0, ...latin('Texto')]),
];

test('.xls (BIFF8): textos partilhados partidos em CONTINUE, números, RK, MULRK, datas e etiquetas', () => {
  for (const pad of [0, 5000]) { // pequeno (mini stream) e grande (sectores normais)
    const rows = F.parseXLS(cfb(workbook({ strings, cells, pad })));
    assert.deepEqual(rows, [
      ['Data Operação', 'Descrição', 'Montante (EUR)', ''],
      ['02-10-2026', 'COMPRA TPA*0000 MERCADO TESTE', '-12.34', ''],
      ['2026-10-02', 'PAGAMENTO CTA_CARTÃO APP/NETBANCO', '350', ''],
      ['', 'Comissão de manutenção', '-3.5', '7'],
      ['', 'Texto', '', ''],
    ], `pad ${pad}`);
  }
});

test('readTable reconhece o .xls binário e a importação lê-o', async () => {
  const rows = await F.readTable(cfb(workbook({ strings, cells })).buffer);
  const O = globalThis.Orcamento;
  const mv = O.toMovements(rows, O.findHeader(rows));
  assert.deepEqual(mv.map((m) => [m.date, m.amount]), [['2026-10-02', -12.34], ['2026-10-02', 350]]);
  assert.deepEqual(O.prepareImport([], mv, 'cc', []).fresh.map((t) => t.cat), ['outros', 'transferencias']);
});

test('não é .xls válido: erro claro', () => {
  assert.throws(() => F.parseXLS(new Uint8Array(600)), /não é um Excel válido/);
});
