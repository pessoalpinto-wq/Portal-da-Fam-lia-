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

test('produtos da família: novos, alterados e escondidos', () => {
  const { merged, sections, hiddenCount, NOSSOS } = globalThis.CatalogoCompras;
  const custom = [
    { id: 'n1', nome: 'Queijo de Azeitão', seccao: NOSSOS, categoria: 'Frescos' },
    { id: 'n2', nome: 'Kombucha', seccao: 'Bebidas', categoria: 'Bebidas' },
    { id: 'o1', base: 'Leite meio-gordo', nome: 'Leite meio-gordo (pacote de 6)', seccao: 'Laticínios e ovos', categoria: 'Frescos', renamed: true },
    { id: 'o2', base: 'Lixívia', hidden: true },
  ];
  const all = merged(custom);
  assert.equal(all.length, ITENS.length - 1 + 2);
  assert.equal(find('lixivia', all), null);
  assert.ok(find('leite meio-gordo (pacote de 6)', all));
  assert.equal(find('Leite meio-gordo', all), null);
  assert.equal(find('kombucha', all).seccao, 'Bebidas');
  assert.equal(find('queijo de azeitao', all).emoji, '⭐');
  assert.equal(sections(all)[0][0], NOSSOS);
  assert.equal(sections(merged([]))[0][0], 'Fruta'); // sem produtos da família não aparece a secção ⭐
  assert.equal(hiddenCount(custom), 1);
});

test('encontra produtos sem ligar a maiúsculas nem acentos', () => {
  assert.equal(find('iogurtes gregos').categoria, 'Frescos');
  assert.equal(find('LIXIVIA').categoria, 'Limpeza');
  assert.equal(find('  Pão  ').categoria, 'Padaria');
  assert.equal(find('coisa inventada'), null);
});
