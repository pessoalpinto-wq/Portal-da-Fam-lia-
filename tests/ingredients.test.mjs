import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../js/ingredients.js';

const { parse, matches, guessCategory } = globalThis.Ingredients;
const P = (l) => { const r = parse(l); return [r.qty, r.name, r.key]; };

test('quantidades, unidades e nomes', () => {
  assert.deepEqual(P('400 g de bacalhau demolhado'), ['400 g', 'bacalhau demolhado', 'bacalhau']);
  assert.deepEqual(P('2 dentes de alho picados'), ['2 dentes', 'alho picados', 'alho']);
  assert.deepEqual(P('1 dl de azeite'), ['1 dl', 'azeite', 'azeite']);
  assert.deepEqual(P('2 colheres de sopa de farinha'), ['2 colheres de sopa', 'farinha', 'farinha']);
  assert.deepEqual(P('6 ovos'), ['6', 'ovos', 'ovo']);
  assert.deepEqual(P('2 cebolas grandes'), ['2', 'cebolas grandes', 'cebola']);
  assert.deepEqual(P('Sal e pimenta q.b.'), ['q.b.', 'Sal e pimenta', 'sal e pimenta']);
  assert.deepEqual(P('1 folha de louro'), ['1 folha', 'louro', 'louro']);
  assert.deepEqual(P('½ limão'), ['½', 'limão', 'limao']);
  assert.deepEqual(P('1,5 kg de batatas'), ['1,5 kg', 'batatas', 'batata']);
  assert.deepEqual(P('2 a 3 tomates maduros'), ['2 a 3', 'tomates maduros', 'tomate']);
  assert.deepEqual(P('1 lata de tomate pelado'), ['1 lata', 'tomate pelado', 'tomate pelado']);
  assert.deepEqual(P('200 ml de natas'), ['200 ml', 'natas', 'nata']);
  assert.deepEqual(P('leite'), ['', 'leite', 'leite']);
  assert.deepEqual(P('Uma pitada de noz-moscada'), ['Uma pitada', 'noz-moscada', 'noz moscada']);
  assert.deepEqual(P('4 limões'), ['4', 'limões', 'limao']);
  assert.deepEqual(P('Molho de tomate'), ['', 'Molho de tomate', 'molho de tomate']);
});

test('despensa: "cebola" cobre "cebolas picadas", "sal" cobre "sal e pimenta"', () => {
  assert.ok(matches(parse('2 cebolas picadas').key, parse('Cebola').key));
  assert.ok(matches(parse('Sal e pimenta q.b.').key, parse('sal').key));
  assert.ok(matches(parse('3 ovos').key, parse('Ovos').key));
  assert.ok(!matches(parse('1 dl de azeite').key, parse('azeitonas').key));
  assert.ok(!matches(parse('arroz').key, parse('arroz doce').key));
});

test('categoria para a lista de compras', () => {
  assert.equal(guessCategory(parse('400 g de bacalhau').key), 'Talho/Peixaria');
  assert.equal(guessCategory(parse('2 cebolas').key), 'Frescos');
  assert.equal(guessCategory(parse('500 g de esparguete').key), 'Mercearia');
  assert.equal(guessCategory(parse('4 pães de hambúrguer').key), 'Padaria');
});

test('plurais difíceis e descrições', () => {
  assert.equal(parse('150 g de espinafres').key, 'espinafre');
  assert.equal(parse('1 alho francês').key, 'alho frances');
  assert.equal(parse('Óleo para fritar').key, 'oleo');
  assert.equal(parse('Arroz branco para acompanhar').key, 'arroz branco');
  assert.deepEqual(P('2 medidas de açúcar'), ['2 medidas', 'açúcar', 'acucar']);
  assert.equal(globalThis.Ingredients.key('colheres'), 'colher');
});

test('formatos reais de sites portugueses (Continente, Teleculinária)', () => {
  assert.deepEqual(P('100g de açúcar'), ['100 g', 'açúcar', 'acucar']);
  assert.deepEqual(P('1 kg Lingueirão'), ['1 kg', 'Lingueirão', 'lingueirao']);
  assert.deepEqual(P('q.b. Coentros picados'), ['q.b.', 'Coentros picados', 'coentro']);
  assert.deepEqual(P('1 c. de sopa de sal'), ['1 c. de sopa', 'sal', 'sal']);
  assert.deepEqual(P('1 cubo caldo de galinha'), ['1 cubo', 'caldo de galinha', 'caldo de galinha']);
  assert.deepEqual(P('1 ramo hortelã'), ['1 ramo', 'hortelã', 'hortela']);
  assert.deepEqual(P('600 g Feijão-branco cozido'), ['600 g', 'Feijão-branco cozido', 'feijao branco']);
  assert.deepEqual(P('120ml de vinagre'), ['120 ml', 'vinagre', 'vinagre']);
  assert.deepEqual(P('1/2 galinha com ovos'), ['1/2', 'galinha com ovos', 'galinha com ovo']);
});

test('soma de quantidades', () => {
  const { sumQty } = globalThis.Ingredients;
  assert.equal(sumQty(['2 dentes', '2 dentes', '1 cabeça', '2 dentes']), '6 dentes + 1 cabeça');
  assert.equal(sumQty(['1', '2', '1']), '4');
  assert.equal(sumQty(['300 g', '400 g', '1 kg']), '700 g + 1 kg');
  assert.equal(sumQty(['1 dl', '4 colheres de sopa', '1 dl']), '2 dl + 4 colheres de sopa');
  assert.equal(sumQty(['½', '1/2']), '1');
  assert.equal(sumQty(['1 lata', '2 latas']), '3 latas');
  assert.equal(sumQty(['2 a 3']), '2 a 3');
});
