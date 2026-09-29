import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../js/catalogo-compras.js';

const { SECCOES, ITENS, find } = globalThis.CatalogoCompras;
const CATS = ['Frescos', 'Talho/Peixaria', 'Padaria', 'Mercearia', 'Congelados', 'Bebidas', 'Limpeza', 'Higiene',
  'Farmácia', 'Casa', 'Escola', 'Animais', 'Outro'];

test('catálogo grande, sem repetidos e com categorias da lista', () => {
  assert.ok(ITENS.length >= 350, `só ${ITENS.length} produtos`);
  const names = ITENS.map((i) => i.nome.toLowerCase());
  const dup = names.filter((n, i) => names.indexOf(n) !== i);
  assert.deepEqual(dup, []);
  SECCOES.forEach(([nome, , cat]) => assert.ok(CATS.includes(cat), `${nome} → ${cat}`));
});

test('encontra produtos sem ligar a maiúsculas nem acentos', () => {
  assert.equal(find('iogurtes gregos').categoria, 'Frescos');
  assert.equal(find('LIXIVIA').categoria, 'Limpeza');
  assert.equal(find('  Pão  ').categoria, 'Padaria');
  assert.equal(find('coisa inventada'), null);
});
