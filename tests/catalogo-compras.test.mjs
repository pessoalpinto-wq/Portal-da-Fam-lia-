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

test('os do costume: o que falta repor e sugestões pelo que mais se compra', () => {
  const { missingStaples, countPurchase, suggestions, statId } = globalThis.CatalogoCompras;
  const staples = [{ text: 'Leite meio-gordo', qty: '6' }, { text: 'Pão' }, { text: 'Bananas', qty: '1 kg' }];
  const shopping = [{ text: 'pão', done: false }, { text: 'Bananas', done: true }];
  // O pão já está por comprar; as bananas já foram compradas, por isso voltam a faltar.
  assert.deepEqual(missingStaples(staples, shopping).map((x) => x.text), ['Leite meio-gordo', 'Bananas']);

  const stats = [];
  countPurchase(stats, { text: 'Iogurtes gregos', category: 'Frescos' }, '2026-09-01');
  countPurchase(stats, { text: 'iogurtes gregos', category: 'Frescos' }, '2026-09-08');
  countPurchase(stats, { text: 'Café moído', category: 'Mercearia' }, '2026-09-08');
  countPurchase(stats, { text: 'Leite meio-gordo' }, '2026-09-08');
  countPurchase(stats, { text: 'Leite meio-gordo' }, '2026-09-09');
  countPurchase(stats, { text: 'Café moído' }, '2026-09-10', -1); // desmarcado
  countPurchase(stats, { text: 'Gomas' }, '2026-09-10', -1); // desfazer algo nunca contado não cria registo
  assert.equal(stats.find((s) => s.id === statId('Iogurtes gregos')).count, 2);
  assert.equal(stats.find((s) => s.id === statId('Café moído')).count, 0);
  assert.equal(stats.some((s) => s.id === statId('Gomas')), false);
  // Leite já é do costume; café só foi comprado 0 vezes → só sugere os iogurtes.
  assert.deepEqual(suggestions(stats, staples).map((s) => [s.name, s.count]), [['iogurtes gregos', 2]]);
});

test('encontra produtos sem ligar a maiúsculas nem acentos', () => {
  assert.equal(find('iogurtes gregos').categoria, 'Frescos');
  assert.equal(find('LIXIVIA').categoria, 'Limpeza');
  assert.equal(find('  Pão  ').categoria, 'Padaria');
  assert.equal(find('coisa inventada'), null);
});
