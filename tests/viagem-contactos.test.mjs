import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../js/viagem-contactos.js';

const V = globalThis.ViagemContactos.util;

test('link do mapa: o link colado ou uma pesquisa pela morada', () => {
  assert.equal(V.mapUrl({ map: 'https://maps.app.goo.gl/abc' }), 'https://maps.app.goo.gl/abc');
  assert.equal(V.mapUrl({ address: 'Rua Augusta 1, Lisboa' }), 'https://www.google.com/maps/search/?api=1&query=Rua%20Augusta%201%2C%20Lisboa');
  assert.equal(V.mapUrl({ map: 'Torre de Belém' }), 'https://www.google.com/maps/search/?api=1&query=Torre%20de%20Bel%C3%A9m');
  assert.equal(V.mapUrl({ map: 'maps.app.goo.gl/abc', address: 'x' }), 'https://maps.app.goo.gl/abc');
  assert.equal(V.mapUrl({}), '');
});

test('WhatsApp: indicativo de Portugal por defeito', () => {
  assert.equal(V.whatsapp('912 345 678'), 'https://wa.me/351912345678');
  assert.equal(V.whatsapp('+34 600 11 22 33'), 'https://wa.me/34600112233');
  assert.equal(V.whatsapp('0044 20 7946 0958'), 'https://wa.me/442079460958');
  assert.equal(V.whatsapp(''), '');
  assert.equal(V.whatsapp('123'), '');
});

test('formulário: só morada ou só telefone também serve', () => {
  assert.equal(V.fromForm({ name: ' ', notes: 'x' }, 'pessoa'), null);
  assert.equal(V.fromForm({ address: 'Rua das Flores 5, Porto' }, 'morada').name, 'Rua das Flores 5');
  assert.equal(V.fromForm({ phone: '912345678' }, 'pessoa').name, '912345678');
  const c = V.fromForm({ name: ' Maria ', phone: '91', email: 'm@x.pt' }, 'outra');
  assert.equal(c.kind, 'pessoa');
  assert.equal(c.name, 'Maria');
});

test('pessoas primeiro, depois moradas, por nome', () => {
  const out = V.sorted([{ kind: 'morada', name: 'Hotel' }, { kind: 'pessoa', name: 'Zé' }, { kind: 'pessoa', name: 'Ana' }]);
  assert.deepEqual(out.map((c) => c.name), ['Ana', 'Zé', 'Hotel']);
});
