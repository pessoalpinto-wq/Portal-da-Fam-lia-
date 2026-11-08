import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../js/emergencia.js';

const E = globalThis.Emergencia;
const pets = [{ name: 'Luna', species: 'cao' }, { name: 'Bela', species: 'cao' }, { name: 'Tita', species: 'tartaruga' }];

test('quantidades para 3 dias por pessoa e por animal', () => {
  assert.equal(E.need({ calc: 'agua' }, { people: 4 }), '36 L (3 L por pessoa por dia, para beber e cozinhar)');
  assert.equal(E.need({ calc: 'comida' }, { people: 4 }), '12 dias-pessoa (3 dias para 4 pessoas)');
  assert.equal(E.need({ calc: 'pessoas' }, { people: 4 }), '4');
  assert.equal(E.need({ calc: 'agua-animais' }, { pets }), '6,9 L');
  assert.equal(E.need({ calc: 'comida-animais' }, { pets }), '3 dias de ração para 2 cães e 1 outro');
  assert.equal(E.need({ calc: 'agua-animais' }, { pets: [] }), '');
  assert.equal(E.need({}, { people: 4 }), '');
});

test('lista recomendada: coisas dos animais só se houver animais, e sem repetir', () => {
  let n = 0;
  const uid = () => `id${++n}`;
  const base = E.seed([], [], uid);
  assert.ok(base.length > 20);
  assert.ok(!base.some((x) => x.cat === 'animais'));
  const more = E.seed(base, pets, uid);
  assert.deepEqual(more.map((x) => x.ref).sort(), ['animais-agua', 'animais-comida', 'animais-saude', 'animais-transporte', 'animais-trela', 'tartaruga']);
  assert.deepEqual(E.seed([...base, ...more], pets, uid), []);
  // Só gatos: não há trelas nem caixa de tartaruga.
  assert.ok(!E.seed(base, [{ species: 'gato' }], uid).some((x) => ['animais-trela', 'tartaruga'].includes(x.ref)));
  assert.equal(base[0].kind, 'item');
  assert.equal(base[0].have, false);
});

test('validades', () => {
  assert.equal(E.expiry('2026-11-07', '2026-11-08'), 'expired');
  assert.equal(E.expiry('2026-11-08', '2026-11-08'), 'soon');
  assert.equal(E.expiry('2026-12-08', '2026-11-08'), 'soon');
  assert.equal(E.expiry('2026-12-09', '2026-11-08'), 'ok');
  assert.equal(E.expiry('', '2026-11-08'), '');
});

test('powerbanks: carregar de 3 em 3 meses e contar as cargas de telemóvel', () => {
  assert.deepEqual(E.charge('2026-11-01', '2026-11-08'), { due: false, days: 7, next: '2027-01-30' });
  assert.equal(E.charge('2026-08-01', '2026-11-08').due, true);
  assert.deepEqual(E.charge('', '2026-11-08'), { due: true, days: null, next: '' });
  assert.equal(E.phoneCharges([{ mah: 20000 }, { mah: 10000, level: 50 }]), 4);
  assert.equal(E.phoneCharges([{ mah: 10000, level: 0 }]), 0);
  assert.equal(E.phoneCharges([]), 0);
});

test('resumo de avisos', () => {
  const list = [
    { kind: 'item', have: true, expires: '2026-11-01' },
    { kind: 'item', have: true, expires: '2026-11-20' },
    { kind: 'item', have: false, expires: '2026-11-01' }, // não conta: ainda não está no kit
    { kind: 'item', have: true },
    { kind: 'powerbank', mah: 10000, lastCharge: '2026-01-01' },
    { kind: 'radio', lastCheck: '2026-11-01' },
    { kind: 'plano', id: 'plano' },
  ];
  const s = E.summary(list, '2026-11-08');
  assert.equal(s.items, 4);
  assert.equal(s.have, 3);
  assert.equal(s.ready, 75);
  assert.equal(s.expired.length, 1);
  assert.equal(s.soon.length, 1);
  assert.equal(s.banksDue.length, 1);
  assert.equal(s.radiosDue.length, 0);
  assert.equal(s.alerts, 3);
});

test('plano em texto para copiar ou imprimir', () => {
  const t = E.planText({
    plan: { meetNear: 'Café da esquina', water: 'Debaixo do lava-loiça', gas: '' },
    contacts: [{ name: 'Tia Ana', phone: '912 345 678', role: 'fora da zona' }],
    channels: [{ name: 'Principal', freq: '446.00625', channel: '1', schedule: '5 min às horas certas' }],
    pets,
    members: [{ name: 'Luís' }, { name: 'Cátia' }],
  });
  assert.match(t, /Família: Luís, Cátia/);
  assert.match(t, /Perto de casa: Café da esquina/);
  assert.match(t, /Água \(torneira de corte\): Debaixo do lava-loiça/);
  assert.doesNotMatch(t, /Gás:/);
  assert.match(t, /112 — Emergência/);
  assert.match(t, /912 345 678 — Tia Ana \(fora da zona\)/);
  assert.match(t, /Principal: 446.00625 MHz · canal 1 · 5 min às horas certas/);
  assert.match(t, /🐢 Tita/);
});

test('o plano não mostra blocos vazios', () => {
  const t = E.planText({ plan: { meetNear: 'Café' } });
  assert.doesNotMatch(t, /Em casa|Rádios|Animais/);
  assert.match(t, /📞 Números/);
});

test('frequências: PMR446, LPD433 e CB 27 MHz', () => {
  assert.equal(E.pmr(1), '446.00625');
  assert.equal(E.pmr(8), '446.09375');
  assert.equal(E.pmr(16), '446.19375');
  assert.equal(E.lpd(1), '433.075');
  assert.equal(E.lpd(69), '434.775');
  assert.equal(E.cb(9), '27.065');
  assert.equal(E.cb(19), '27.185');
  assert.deepEqual([22, 23, 24, 25, 26].map(E.cb), ['27.225', '27.255', '27.235', '27.245', '27.265']);
  assert.equal(E.cb(40), '27.405');
  const g = Object.fromEntries(E.FREQS.map((x) => [x.id, x.rows]));
  assert.equal(g.pmr.length, 16);
  assert.equal(g.cb.length, 40);
  assert.equal(new Set(g.cb.map((r) => r.freq)).size, 40);
  assert.deepEqual(E.keyFreqs().map((r) => r.freq), ['446.09375', '446.00625', '145.500', '433.500', '27.065', '27.185', '156.800']);
  E.FREQS.flatMap((x) => x.rows).forEach((r) => assert.ok(E.TX[r.tx], r.name));
});
