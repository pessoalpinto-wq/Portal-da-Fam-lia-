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

// Endesa (texto como o pdf.js o tira de uma fatura real; dados pessoais trocados): leituras do contador acumuladas
// ("Cheia: 7.233 kWh") que não são consumo, energia em duas linhas sem horário, total antes do texto.
const ENDESA = `Nº Documento: 26080310156268999 Luz Data de Emissão: 27 ago 2026
TOTAL A DEBITAR 29,20 €
Débito a partir de 11 Setembro 2026
CONSUMOS
CPE (Código Ponto Entrega) Nº contador
000001234567890 PT 0002 0000 1111 2222 XX
A sua leitura: 25 ago 2026
Cheia Ponta Vazio
007233 kWh 003590 kWh 005902 kWh
Última leitura real comunicada: 25 ago 2026 - distribuidora
Cheia: 7.233 kWh | Ponta: 3.590 kWh | Vazio: 5.902 kWh
Emitido por ENDESA Energia S.A. – Sucursal Portugal
LUZ Data: 27 ago 2026 Período de Faturação: 22 ago 2026 a 25 ago 2026
Termo de Energia (Real) 92 kWh 0,177154 €/kWh [0,148809 €/kWh] 16,30 € -2,61 € 13,69 € 23% (c)
22 ago 2026 a 24 ago 2026
Termo de Potência (13.80 kVA) 3 dias 0,827600 €/dia [0,695184 €/dia] 2,48 € -0,38 € 2,10 € 23% (c)
Termo de Energia (Real) 31 kWh 0,177154 €/kWh [0,145266 €/kWh] 5,49 € -0,97 € 4,52 € 23% (c)
TOTAL Luz (Consumo) 23,29 €
Imposto Especial Consumo (Real) 123 kWh 0,001000 €/kWh 0,12 € 0,12 € 23% (c)
TOTAL Taxas e Impostos 5,91 €
HHm9 - Processado por programa certificado n.º2516 TOTAL DA FATURA DE LUZ 29,20 €
Variável de 0.0607 €/kWh), onde se inclui o valor dos Custos de Interesse Económico Geral (CIEG) no valor de 3.44 €.
PT 0002 0000 1111 2222 XX 13,80 kVA Sem ciclo`;

// Repsol (como nas capturas de uma fatura real): período com "~", tarifa simples mas quadro de leituras por horário,
// "Saldo My Repsol utilizado" a abater no total, várias linhas com "total".
const REPSOL = `Documento: Dt.Emissão:
26100760109043799 2026-10-22
Resumo de faturação
Eletricidade Gás Taxas e Impostos Débitos / Créditos Outros Poupança Valor a Pagar
133,75€ 0,00€ 29,39€ 0,00€ 5,68€ -39,84€ 128,98€
Média mensal de eletricidade: 328,50 kWh~ 69,96€
Comunique as suas leituras entre dia 2026-11-18 e 2026-11-20
Valor a enviar ao banco:
128,98€
Fatura Tipo de Cliente Tipo de Leitura 2/3
FAC 0210762026/0049567916 Domésticos Empresa
Data Fim Período Tarifa
2026-10-20 Leve Luz Simples 2601
Resumo Período Faturação: 2026-08-26 ~ 2026-10-20
Contador Nº Potência Tipo de Consumo Data Leitura Fator Multipl. Consumo
000001234567890 13,80kVA Cheia 2026-10-20 7.496 1,00000 Real 263,00 kWh
Ponta 2026-10-20 3.725 1,00000 Real 135,00 kWh
Vazio 2026-10-20 6.109 1,00000 Real 207,00 kWh
Descrição Explicação de valores Valor(€) IVA
Energia Simples Real 26/08 a 20/10 605 kWh x 0,185000 €/kWh 111,93 (c)
Desc. FE Energia Simples Real 26/08 a 20/10 56d/56d x (111,93 € x 2,00%) -2,24 (c)
Potência Contratada (13.80 kVA) 26/08 a 20/10 56 dias x 0,240000 €/dia 13,44 (c)
Financ. T. Social (Dir. ERSE 3-4/2024) Real 26/08 a 20/10 605 kWh x 0,002067 €/kWh 1,25 (c)
Financ. T. Social (Dir. ERSE 3-4/2024) 26/08 a 20/10 0 kWh x 0,002067 €/kWh 0,00 (b)
Saldo My Repsol utilizado Operação: 1787829815 -39,84 (c)
Saldo My Repsol utilizado Operação: 1787829815 0,00 (b)
Imposto Especial Consumo Real 26/08 a 20/10 605 kWh x 0,001000 €/kWh 0,61 (c)
Total sem IVA 105,58€
TOTAL 128,98€
O total da fatura inclui os encargos relativos ao acesso às redes no valor de 75.20 € (sem IVA)`;

test('Endesa: consumo das linhas de energia (não as leituras do contador), total antes do texto, potência 13.80 kVA', () => {
  const f = E.parseInvoice(ENDESA);
  assert.equal(f.supplier, 'Endesa');
  assert.deepEqual([f.from, f.to], ['2026-08-22', '2026-08-25']);
  assert.equal(f.kwh, 123);
  assert.deepEqual(f.periods, {}); // 7.233 + 3.590 + 5.902 são leituras, não somam 123
  assert.equal(f.total, 29.2);
  assert.equal(f.power, 13.8);
  assert.equal(f.cpe, 'PT0002000011112222XX');
  assert.equal(f.credit, 0);
});

test('Repsol: período com "~", horários do quadro de leituras (somam o total), saldo My Repsol usado', () => {
  const f = E.parseInvoice(REPSOL);
  assert.equal(f.supplier, 'Repsol');
  assert.deepEqual([f.from, f.to], ['2026-08-26', '2026-10-20']);
  assert.equal(f.kwh, 605);
  assert.deepEqual(f.periods, { cheias: 263, ponta: 135, vazio: 207 });
  assert.equal(f.total, 128.98); // não 133,75 (luz sem impostos) nem 75,20 (acesso às redes)
  assert.equal(f.power, 13.8);
  assert.equal(f.credit, 39.84);
  assert.equal(f.estimated, false);
});
