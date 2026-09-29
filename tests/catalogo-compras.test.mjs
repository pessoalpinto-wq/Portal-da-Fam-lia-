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

test('texto para partilhar: por secções, com quantidades, sem o que já foi comprado', () => {
  const { shareText } = globalThis.CatalogoCompras;
  const txt = shareText([
    { text: 'Lixívia', category: 'Limpeza' },
    { text: 'Bananas', qty: '1 kg', category: 'Frescos' },
    { text: 'Pão', category: 'Padaria' },
    { text: 'Iogurtes gregos', qty: '8', category: 'Frescos' },
    { text: 'Ovos', category: 'Frescos', done: true },
    { text: 'Pilhas AA' },
  ]);
  assert.equal(txt, '🛒 Lista de compras — 5 produtos\n\n🥦 Frescos\n• 1 kg Bananas\n• 8 Iogurtes gregos\n\n🥖 Padaria\n• Pão'
    + '\n\n🧽 Limpeza\n• Lixívia\n\n🛍️ Outro\n• Pilhas AA');
  assert.equal(shareText([{ text: 'Ovos', done: true }]), '🛒 A lista de compras está vazia.');
});

test('preços: quantidade, preço memorizado, total estimado e subidas', () => {
  const { qtyFactor, rememberPrice, priceOf, lineTotal, estimate, priceChange } = globalThis.CatalogoCompras;
  assert.equal(qtyFactor('6'), 6);
  assert.equal(qtyFactor('1,5 kg'), 1.5);
  assert.equal(qtyFactor('6 latas'), 6);
  assert.equal(qtyFactor(''), 1);
  assert.equal(qtyFactor('um pack'), 1);

  const stats = [];
  rememberPrice(stats, { text: 'Leite meio-gordo' }, '0,85', '2026-08-01');
  rememberPrice(stats, { text: 'Leite meio-gordo' }, '0,89', '2026-09-20'); // subiu 4 cêntimos
  rememberPrice(stats, { text: 'Bananas' }, 1.49, '2026-09-20');
  rememberPrice(stats, { text: 'Pão' }, '', '2026-09-20'); // vazio: não memoriza
  assert.equal(priceChange(stats, 'Leite meio-gordo', '2026-09-29'), 0.04);
  assert.equal(priceChange(stats, 'Leite meio-gordo', '2026-12-29'), 0); // mudança antiga já não se mostra
  assert.equal(priceChange(stats, 'Bananas', '2026-09-29'), 0);

  const list = [
    { text: 'leite meio-gordo', qty: '6' }, // preço memorizado 0,89 × 6
    { text: 'Bananas', qty: '1,5 kg', done: true }, // 1,49 × 1,5
    { text: 'Pão', price: 0.35, qty: '4', done: true }, // preço posto no item
    { text: 'Gomas' }, // sem preço
  ];
  assert.equal(priceOf(list[0], stats), 0.89);
  assert.equal(lineTotal(list[1], stats), 2.24);
  // 5,34 (leite) + 2,24 (bananas) + 1,40 (pão) = 8,98; no carrinho: bananas + pão = 3,64
  assert.deepEqual(estimate(list, stats), { total: 8.98, cart: 3.64, missing: 1, count: 4 });
});

test('preços com data e loja: histórico dos últimos 10', () => {
  const { rememberPrice, priceHistory, memo } = globalThis.CatalogoCompras;
  const stats = [];
  rememberPrice(stats, { text: 'Leite' }, 0.85, '2026-08-01', 'Continente');
  rememberPrice(stats, { text: 'Leite' }, 0.89, '2026-09-29', 'Lidl');
  rememberPrice(stats, { text: 'Leite' }, 0.87, '2026-09-29', 'Lidl'); // correcção no mesmo dia e loja
  assert.deepEqual(priceHistory(stats, 'leite'), [
    { price: 0.87, date: '2026-09-29', store: 'Lidl' }, { price: 0.85, date: '2026-08-01', store: 'Continente' },
  ]);
  // A correcção não conta como mudança: o anterior continua a ser o de Agosto.
  assert.deepEqual(memo(stats, 'Leite'), { price: 0.87, date: '2026-09-29', store: 'Lidl', prev: 0.85, prevDate: '2026-08-01' });
  for (let i = 1; i <= 12; i++) rememberPrice(stats, { text: 'Pão' }, 0.3 + i / 100, `2026-09-${String(i).padStart(2, '0')}`);
  assert.equal(priceHistory(stats, 'Pão').length, 10);
  assert.equal(priceHistory(stats, 'Pão')[0].date, '2026-09-12');
  // Registos antigos (sem histórico) continuam a aparecer
  assert.deepEqual(priceHistory([{ id: 'st-ovos', name: 'Ovos', price: 2.1, priceDate: '2026-09-01' }], 'Ovos'), [{ price: 2.1, date: '2026-09-01', store: '' }]);
});

test('lojas: loja memorizada por produto, filtro e contagens', () => {
  const { storesOf, storeOf, rememberStore, forStore, storeCounts, DEFAULT_STORES } = globalThis.CatalogoCompras;
  assert.deepEqual(storesOf([]), DEFAULT_STORES);
  const stores = storesOf([{ id: 'list', names: ['Lidl', 'Farmácia', 'Talho'] }]);
  assert.deepEqual(stores, ['Lidl', 'Farmácia', 'Talho']);
  const stats = [];
  rememberStore(stats, { text: 'Paracetamol' }, 'Farmácia');
  rememberStore(stats, { text: 'Bifes de vaca' }, 'Talho');
  rememberStore(stats, { text: 'Pão' }, 'Padaria'); // loja que a família apagou
  const items = [
    { text: 'Paracetamol' }, // memorizado: Farmácia
    { text: 'Leite', store: 'Lidl' }, // posto no item
    { text: 'Bifes de vaca', store: '' }, // posto "qualquer loja" no item: vence o memorizado
    { text: 'Pão' }, // Padaria já não existe → qualquer loja
    { text: 'Ovos' },
  ];
  assert.deepEqual(items.map((i) => storeOf(i, stats, stores)), ['Farmácia', 'Lidl', '', '', '']);
  assert.deepEqual(forStore(items, stats, stores, 'Lidl').map((i) => i.text), ['Leite', 'Bifes de vaca', 'Pão', 'Ovos']);
  assert.deepEqual(forStore(items, stats, stores, 'all').length, 5);
  assert.deepEqual(storeCounts(items, stats, stores), { byStore: { Lidl: 1, 'Farmácia': 1, Talho: 0 }, any: 3 });
});

test('talões e orçamento do mês', () => {
  const { monthly, budgetStatus, receipts } = globalThis.CatalogoCompras;
  const g = [
    { id: 'budget', amount: 400 },
    { id: 'r1', kind: 'receipt', date: '2026-09-05', amount: 120.5, store: 'Lidl' },
    { id: 'r2', kind: 'receipt', date: '2026-09-19', amount: 230, store: 'Continente' },
    { id: 'r3', kind: 'receipt', date: '2026-08-10', amount: 310 },
    { id: 'r4', kind: 'receipt', date: '2026-09-20', amount: 0 }, // inválido
  ];
  assert.equal(receipts(g).length, 3);
  assert.deepEqual(monthly(g, '2026-09-29', 3).map((m) => [m.ym, m.total, m.count]), [['2026-07', 0, 0], ['2026-08', 310, 1], ['2026-09', 350.5, 2]]);
  assert.deepEqual(budgetStatus(g, '2026-09-29'), { budget: 400, spent: 350.5, left: 49.5, pct: 88, daysLeft: 1, level: 'near' });
  assert.equal(budgetStatus([...g, { id: 'r5', kind: 'receipt', date: '2026-09-29', amount: 60 }], '2026-09-29').level, 'over');
  assert.equal(budgetStatus([], '2026-09-29').level, '');
});

test('encontra produtos sem ligar a maiúsculas nem acentos', () => {
  assert.equal(find('iogurtes gregos').categoria, 'Frescos');
  assert.equal(find('LIXIVIA').categoria, 'Limpeza');
  assert.equal(find('  Pão  ').categoria, 'Padaria');
  assert.equal(find('coisa inventada'), null);
});

test('marca preferida e nota: memorizadas por produto, o item pode mudar', () => {
  const C = globalThis.CatalogoCompras;
  const stats = [];
  C.rememberPrefs(stats, { text: 'Leite', category: 'Frescos' }, { brand: '  Mimosa ', note: 'meio-gordo, sem lactose' });
  assert.deepEqual(C.prefsOf({ text: 'leite' }, stats), { brand: 'Mimosa', note: 'meio-gordo, sem lactose' });
  assert.deepEqual(C.prefsOf({ text: 'Leite', brand: 'Agros', note: '' }, stats), { brand: 'Agros', note: '' });
  assert.deepEqual(C.prefsOf({ text: 'Pão' }, stats), { brand: '', note: '' });
  assert.equal(C.prefsText({ brand: 'Mimosa', note: 'sem lactose' }), 'Mimosa — sem lactose');
  assert.equal(C.prefsText({ brand: '', note: 'o maior' }), 'o maior');
  C.rememberPrefs(stats, { text: 'Leite' }, { brand: '', note: '' });
  assert.deepEqual(C.prefsOf({ text: 'Leite' }, stats), { brand: '', note: '' });
  assert.equal(stats.length, 1);
});

test('partilhar mostra a marca e a nota', () => {
  const C = globalThis.CatalogoCompras;
  const stats = C.rememberPrefs([], { text: 'Leite' }, { brand: 'Mimosa', note: 'sem lactose' });
  const t = C.shareText([{ text: 'Leite', qty: '6', category: 'Frescos' }, { text: 'Pão', category: 'Padaria' }], undefined, '', stats);
  assert.match(t, /• 6 Leite \(Mimosa — sem lactose\)/);
  assert.match(t, /• Pão$/m);
  assert.match(C.shareText([{ text: 'Leite', category: 'Frescos' }], undefined, 'Lidl', stats), /Leite \(Mimosa — sem lactose\)/);
});
