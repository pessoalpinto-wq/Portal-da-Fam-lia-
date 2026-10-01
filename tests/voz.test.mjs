import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../js/catalogo-compras.js';
import '../js/ingredients.js';
import '../js/voz.js';

const V = globalThis.Voz;
const cat = globalThis.CatalogoCompras.merged([]);
const said = (s, c = cat) => V.parse(s, c).map((x) => `${x.qty ? `${x.qty} ` : ''}${x.text}`);

test('vírgulas, "e" e "mais" separam produtos; quantidades ditas por extenso', () => {
  assert.deepEqual(said('leite, ovos, dois quilos de batatas e detergente'), ['Leite', 'Ovos', '2 kg Batatas', 'Detergente']);
  assert.deepEqual(said('preciso de duas latas de atum mais meia dúzia de ovos'), ['2 latas Atum', '6 Ovos']);
  assert.deepEqual(said('meio quilo de fiambre e 200 gramas de queijo'), ['500 g Fiambre', '200 g Queijo']);
  assert.deepEqual(said('3 iogurtes 1 kg de arroz e um litro de leite'), ['3 Iogurtes', '1 kg Arroz', '1 L Leite']);
  assert.deepEqual(said('duas dúzias de ovos'), ['24 Ovos']);
});

test('sem pausas: parte só quando reconhece todos os produtos', () => {
  assert.deepEqual(said('leite ovos fiambre e papel higiénico'), ['Leite', 'Ovos', 'Fiambre', 'Papel higiénico']);
  assert.deepEqual(said('cebola tomate alface pepino'), ['Cebolas', 'Tomates', 'Alface', 'Pepino']);
  assert.deepEqual(said('pilhas para o comando'), ['Pilhas para o comando']);
});

test('tira a conversa e não parte nomes com "e"', () => {
  assert.deepEqual(said('Falta o pão de forma integral e bolachas de água e sal'), ['Pão de forma integral', 'Bolachas de água e sal']);
  assert.deepEqual(said('acabou o azeite e também o café, por favor'), ['Azeite', 'Café']);
  assert.deepEqual(said('leite, leite e mais leite'), ['Leite']);
  assert.deepEqual(said(''), []);
});

test('categorias: do catálogo, das primeiras palavras ou um palpite', () => {
  const by = Object.fromEntries(V.parse('batatas, leite, atum, detergente, nutella', cat).map((x) => [x.text, x]));
  assert.equal(by.Batatas.category, 'Frescos');
  assert.equal(by.Batatas.known, true);
  assert.equal(by.Leite.category, 'Frescos');
  assert.equal(by.Leite.known, false);
  assert.equal(by.Atum.category, 'Mercearia'); // empate entre "fresco" e "em lata" → Mercearia
  assert.equal(by.Detergente.category, 'Limpeza');
});

test('os produtos da família contam como conhecidos', () => {
  const mine = [...cat, { nome: 'Pão da avó', categoria: 'Padaria' }];
  assert.deepEqual(V.parse('pão da avó', mine).map((x) => [x.text, x.category, x.known]), [['Pão da avó', 'Padaria', true]]);
});
