import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../js/catalogo-compras.js';
import '../js/codigo-barras.js';

const B = globalThis.CodigoBarras;
const C = globalThis.CatalogoCompras;

test('dígito de controlo: EAN-13, EAN-8 e UPC-A', () => {
  assert.equal(B.valid('3017620422003'), true); // Nutella
  assert.equal(B.valid('5601312000021'), false);
  assert.equal(B.valid('96385074'), true); // EAN-8
  assert.equal(B.valid('036000291452'), true); // UPC-A
  assert.equal(B.valid('0000000000000'), false);
  assert.equal(B.valid('12345'), false);
  assert.equal(B.valid('301 7620 422003'), true);
});

test('resposta do Open Food Facts', () => {
  const json = { code: '3017620422003', status: 1, product: {
    product_name: 'Nutella', product_name_pt: '', brands: 'Nutella, Ferrero', quantity: '400 g',
    image_front_small_url: 'https://images.openfoodfacts.org/x/front_fr.200.jpg',
    categories_tags: ['en:breakfasts', 'en:spreads', 'en:sweet-spreads'] } };
  assert.deepEqual(B.fromApi(json), { code: '3017620422003', name: 'Nutella', brand: 'Nutella', qty: '400 g',
    img: 'https://images.openfoodfacts.org/x/front_fr.200.jpg', category: 'Mercearia' });
  assert.equal(B.fromApi({ status: 0 }), null);
  assert.equal(B.fromApi({ status: 1, product: { product_name: '', brands: '' } }), null);
});

test('categoria a partir das categorias do Open Food Facts', () => {
  assert.equal(B.categoryOf(['en:dairies', 'en:milks']), 'Frescos');
  assert.equal(B.categoryOf(['en:frozen-foods', 'en:ice-creams']), 'Congelados');
  assert.equal(B.categoryOf(['en:beverages', 'en:waters']), 'Bebidas');
  assert.equal(B.categoryOf(['en:meats', 'en:hams']), 'Talho/Peixaria');
  assert.equal(B.categoryOf([]), 'Mercearia');
  assert.equal(B.categoryOf([], 'Higiene'), 'Higiene');
});

test('código e foto memorizados por produto', () => {
  const stats = [];
  C.rememberProduct(stats, { text: 'Nutella', category: 'Mercearia' }, { code: '3017620422003', img: 'https://img/x.jpg', brand: 'Ferrero' });
  assert.equal(C.byCode(stats, '3017620422003').name, 'Nutella');
  assert.equal(C.imgOf({ text: 'nutella' }, stats), 'https://img/x.jpg');
  assert.equal(C.prefsOf({ text: 'Nutella' }, stats).brand, 'Ferrero');
  // A marca escolhida pela família não é substituída.
  C.rememberPrefs(stats, { text: 'Nutella' }, { brand: 'Nutella' });
  C.rememberProduct(stats, { text: 'Nutella' }, { brand: 'Outra' });
  assert.equal(C.prefsOf({ text: 'Nutella' }, stats).brand, 'Nutella');
  // O mesmo código passa para outro produto.
  C.rememberProduct(stats, { text: 'Creme de avelã' }, { code: '3017620422003' });
  assert.equal(C.byCode(stats, '3017620422003').name, 'Creme de avelã');
  assert.equal(stats.find((x) => x.name === 'Nutella').codes.length, 0);
  // Fotos só por https.
  C.rememberProduct(stats, { text: 'Leite' }, { img: 'javascript:alert(1)' });
  assert.equal(C.imgOf({ text: 'Leite' }, stats), '');
  assert.equal(C.byCode(stats, ''), null);
});
