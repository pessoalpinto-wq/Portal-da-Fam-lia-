import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../js/electricidade.js';

const E = globalThis.Electricidade;

// Faturas inventadas (texto como o pdf.js o tira, linha a linha), ao jeito de cada fornecedor.
const BI = `EDP Comercial
Fatura FT 2026/123456
Data de emissão: 20/09/2026
Período de faturação: 15/08/2026 a 14/09/2026
Total a pagar
78,45 €
Data limite de pagamento 10/10/2026
CPE PT 0002 0000 1234 5678 AB
Potência contratada 6,9 kVA · Tarifa bi-horária
Leitura real
Energia Vazio 120 kWh x 0,1012 €/kWh 12,14 €
Energia Fora de Vazio 150 kWh x 0,1858 €/kWh 27,87 €
Energia Fora de Vazio 30 kWh x 0,1901 €/kWh 5,70 €
Histórico de consumos
ago 2025 280 kWh
jul 2025 2026 kWh`;

const SIMPLES = `Endesa Energia
Consumos de 1 set 2026 a 30 set 2026
Leitura estimada
Consumo total 212 kWh
Energia simples 212 kWh 33,92 €
Potência 3,45 kVA 11,20 €
Valor a pagar: 52,31 €`;

const DUAL = `Goldenergy
Período 01-09-2026 - 30-09-2026
Electricidade
Simples 200 kWh x 0,15 €/kWh 30,00 €
Total Electricidade 45,10 €
Gás Natural 30 m3 3,10 kWh/m3
Total Gás 28,00 €
Total a pagar 73,10 €`;

test('fatura bi-horária: período, kWh por horário (somando mudanças de preço), total, potência, CPE', () => {
  const f = E.parseInvoice(BI);
  assert.equal(f.supplier, 'EDP');
  assert.equal(f.from, '2026-08-15');
  assert.equal(f.to, '2026-09-14');
  assert.deepEqual(f.periods, { vazio: 120, fora: 180 });
  assert.equal(f.kwh, 300); // não conta o histórico (sem horário)
  assert.equal(f.total, 78.45); // o valor vem na linha de baixo
  assert.equal(f.power, 6.9);
  assert.equal(f.cpe, 'PT0002000012345678AB');
  assert.equal(f.estimated, false);
  assert.equal(f.gas, false);
});

test('fatura simples: datas por extenso, consumo total, leitura estimada', () => {
  const f = E.parseInvoice(SIMPLES);
  assert.equal(f.supplier, 'Endesa');
  assert.deepEqual([f.from, f.to], ['2026-09-01', '2026-09-30']);
  assert.equal(f.kwh, 212);
  assert.equal(f.total, 52.31);
  assert.equal(f.power, 3.45);
  assert.equal(f.estimated, true);
});

test('fatura de luz e gás: fica só o valor da electricidade', () => {
  const f = E.parseInvoice(DUAL);
  assert.equal(f.gas, true);
  assert.equal(f.total, 45.1);
  assert.equal(f.kwh, 200);
  assert.deepEqual([f.from, f.to], ['2026-09-01', '2026-09-30']);
});

test('sem nada reconhecível: tudo vazio (o formulário pede os valores)', () => {
  const f = E.parseInvoice('Olá\nObrigado por ser cliente');
  assert.equal(f.kwh, null);
  assert.equal(f.total, null);
  assert.equal(f.from, null);
});

test('repartir pelos meses, pelos dias de cada fatura', () => {
  const bm = E.byMonth([{ from: '2026-08-15', to: '2026-09-14', kwh: 310, total: 62 }]);
  assert.deepEqual(bm['2026-08'], { kwh: 170, total: 34, days: 17 });
  assert.deepEqual(bm['2026-09'], { kwh: 140, total: 28, days: 14 });
  assert.equal(E.daysOf('2026-08-15', '2026-09-14'), 31);
});

test('série do gráfico e resumo (ano contra ano anterior)', () => {
  const bills = [];
  for (let i = 0; i < 24; i++) {
    const y = 2024 + Math.floor((i + 9) / 12);
    const m = ((i + 9) % 12) + 1;
    const mm = String(m).padStart(2, '0');
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    // 2.º ano gasta 10 % menos.
    bills.push({ id: `b${i}`, from: `${y}-${mm}-01`, to: `${y}-${mm}-${last}`, kwh: i < 12 ? 300 : 270, total: i < 12 ? 60 : 54, periods: { vazio: i < 12 ? 100 : 108, fora: 0 } });
  }
  const ser = E.series(bills, 12);
  assert.equal(ser.length, 12);
  assert.equal(ser.at(-1).month, '2026-09');
  assert.equal(ser.at(-1).kwh, 270);
  assert.equal(ser.at(-1).prevKwh, 300);
  assert.equal(ser.at(-1).partial, false);
  const s = E.summary(bills);
  assert.equal(s.year.kwh, 3240);
  assert.equal(s.prevYear.kwh, 3600);
  assert.equal(s.perKwh, 0.2);
  assert.equal(s.vazioPct, 40);
  assert.equal(s.last.perDay, 9);
  assert.equal(s.perYear, 648);
  // Mês ainda só em parte coberto pelas faturas.
  const part = E.series([{ from: '2026-09-15', to: '2026-10-14', kwh: 300, total: 60 }], 12);
  assert.equal(part.at(-1).month, '2026-10');
  assert.equal(part.at(-1).partial, true);
  assert.equal(E.summary([]), null);
});

test('não guardar duas vezes a mesma fatura', () => {
  const bills = [{ id: 'a', from: '2026-09-01', to: '2026-09-30' }];
  assert.equal(E.sameBill(bills, { id: 'b', from: '2026-09-01', to: '2026-09-30' })?.id, 'a');
  assert.equal(E.sameBill(bills, { id: 'a', from: '2026-09-01', to: '2026-09-30' }), undefined);
});
