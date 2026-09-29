/*
 * Catálogo de produtos habituais para a lista de compras, por secção do supermercado.
 * [secção, emoji, categoria da lista, produtos]. Script "clássico": define globalThis.CatalogoCompras.
 */
(function (root) {
  const SECCOES = [
    ['Fruta', '🍎', 'Frescos', ['Maçãs', 'Peras', 'Bananas', 'Laranjas', 'Tangerinas', 'Clementinas', 'Limões', 'Uvas', 'Morangos',
      'Kiwis', 'Ananás', 'Melão', 'Melancia', 'Pêssegos', 'Nectarinas', 'Ameixas', 'Cerejas', 'Mirtilos', 'Framboesas', 'Manga',
      'Abacate', 'Papaia', 'Figos', 'Dióspiros', 'Romã', 'Maracujá', 'Lima']],
    ['Legumes e ervas', '🥦', 'Frescos', ['Batatas', 'Batata-doce', 'Cebolas', 'Cebola roxa', 'Alhos', 'Cenouras', 'Tomates',
      'Tomate cherry', 'Alface', 'Rúcula', 'Mistura de saladas', 'Espinafres', 'Couve-coração', 'Couve portuguesa', 'Couve lombarda',
      'Couve roxa', 'Couve-flor', 'Brócolos', 'Courgette', 'Beringela', 'Pimento vermelho', 'Pimento verde', 'Pimento amarelo', 'Pepino',
      'Abóbora', 'Alho-francês', 'Cogumelos', 'Feijão-verde', 'Nabiças', 'Grelos', 'Espargos', 'Maçaroca de milho', 'Nabo', 'Beterraba',
      'Rabanetes', 'Aipo', 'Salsa', 'Coentros', 'Hortelã', 'Manjericão', 'Cebolinho', 'Gengibre', 'Malaguetas']],
    ['Laticínios e ovos', '🥛', 'Frescos', ['Leite meio-gordo', 'Leite magro', 'Leite gordo', 'Leite sem lactose', 'Bebida de aveia',
      'Bebida de soja', 'Bebida de amêndoa', 'Ovos', 'Iogurtes naturais', 'Iogurtes de aromas', 'Iogurtes gregos', 'Iogurtes líquidos',
      'Iogurtes de fruta', 'Kefir', 'Manteiga', 'Margarina', 'Natas', 'Natas para bater', 'Queijo flamengo fatiado', 'Queijo fresco',
      'Requeijão', 'Queijo ralado', 'Mozzarella', 'Queijo creme', 'Queijo da Serra', 'Queijo curado', 'Queijo de cabra', 'Parmesão',
      'Pudins e sobremesas lácteas', 'Leite achocolatado']],
    ['Charcutaria', '🥓', 'Frescos', ['Fiambre', 'Fiambre de peru', 'Presunto', 'Chouriço', 'Chouriço de carne', 'Salpicão', 'Paio',
      'Mortadela', 'Bacon', 'Farinheira', 'Alheira', 'Morcela', 'Patê', 'Salsichas frescas']],
    ['Talho', '🥩', 'Talho/Peixaria', ['Peito de frango', 'Frango inteiro', 'Coxas de frango', 'Asas de frango', 'Perna de peru',
      'Bifes de peru', 'Bifes de vaca', 'Carne picada', 'Carne para estufar', 'Bifanas', 'Febras de porco', 'Costeletas de porco',
      'Entrecosto', 'Lombo de porco', 'Entremeada', 'Rojões', 'Hambúrgueres', 'Salsichas', 'Costeletas de borrego', 'Coelho',
      'Almôndegas', 'Picanha', 'Vitela para assar']],
    ['Peixaria', '🐟', 'Talho/Peixaria', ['Bacalhau', 'Bacalhau demolhado', 'Pescada', 'Filetes de pescada', 'Salmão', 'Dourada',
      'Robalo', 'Sardinhas', 'Carapaus', 'Atum fresco', 'Espadarte', 'Peixe-espada', 'Polvo', 'Lulas', 'Chocos', 'Camarão',
      'Amêijoas', 'Mexilhão', 'Linguado', 'Tamboril']],
    ['Padaria', '🥖', 'Padaria', ['Pão', 'Carcaças', 'Pão de forma', 'Pão de forma integral', 'Pão integral', 'Broa de milho',
      'Pão de leite', 'Baguete', 'Pão sem glúten', 'Croissants', 'Tostas', 'Tortilhas / wraps', 'Pão para hambúrguer',
      'Pão para cachorros', 'Pão ralado', 'Bolos / pastelaria', 'Bolo de arroz']],
    ['Mercearia', '🍝', 'Mercearia', ['Arroz agulha', 'Arroz carolino', 'Arroz basmati', 'Esparguete', 'Macarrão', 'Penne',
      'Massa espiral', 'Massinhas para sopa', 'Folhas de lasanha', 'Cuscuz', 'Quinoa', 'Farinha', 'Farinha com fermento',
      'Fermento em pó', 'Açúcar', 'Açúcar amarelo', 'Sal', 'Sal grosso', 'Azeite', 'Óleo', 'Vinagre', 'Polpa de tomate',
      'Tomate pelado', 'Concentrado de tomate', 'Feijão', 'Feijão-frade', 'Grão-de-bico', 'Lentilhas', 'Ervilhas em lata',
      'Milho em lata', 'Atum em lata', 'Sardinhas em lata', 'Cavala em lata', 'Salsichas em lata', 'Azeitonas', 'Pickles',
      'Maionese', 'Ketchup', 'Mostarda', 'Molho de soja', 'Leite de coco', 'Puré de batata em flocos', 'Caldos (cubos)',
      'Natas de soja', 'Leite condensado', 'Gelatina', 'Chocolate de culinária', 'Frutos secos', 'Passas', 'Nozes', 'Amêndoas']],
    ['Temperos', '🧂', 'Mercearia', ['Pimenta', 'Louro', 'Orégãos', 'Colorau', 'Caril', 'Canela', 'Cominhos', 'Noz-moscada',
      'Piri-piri', 'Alho em pó', 'Ervas de Provença', 'Açafrão', 'Tomilho', 'Alecrim']],
    ['Pequeno-almoço e snacks', '🥣', 'Mercearia', ['Cereais', 'Flocos de aveia', 'Granola', 'Muesli', 'Bolachas Maria',
      'Bolachas de água e sal', 'Bolachas de chocolate', 'Bolachas integrais', 'Mel', 'Compota', 'Manteiga de amendoim',
      'Creme de avelã e cacau', 'Chocolate em pó', 'Café moído', 'Cápsulas de café', 'Café descafeinado', 'Cevada', 'Chá',
      'Chá de camomila', 'Barras de cereais', 'Chocolate (tablete)', 'Gomas', 'Pipocas', 'Batatas fritas de pacote', 'Tostas integrais']],
    ['Congelados', '🧊', 'Congelados', ['Ervilhas congeladas', 'Legumes para sopa', 'Legumes salteados', 'Brócolos congelados',
      'Espinafres congelados', 'Batatas fritas congeladas', 'Douradinhos', 'Filetes de pescada congelados', 'Camarão congelado',
      'Pizza', 'Lasanha congelada', 'Gelado', 'Hambúrgueres congelados', 'Nuggets', 'Croquetes', 'Rissóis', 'Chamuças',
      'Massa folhada', 'Massa quebrada', 'Frutos vermelhos congelados', 'Gelo', 'Polvo congelado']],
    ['Bebidas', '🧃', 'Bebidas', ['Água', 'Garrafão de água', 'Água com gás', 'Sumo de laranja', 'Sumos', 'Néctar', 'Refrigerantes',
      'Ice tea', 'Bebida isotónica', 'Cerveja', 'Cerveja sem álcool', 'Vinho tinto', 'Vinho branco', 'Vinho verde', 'Espumante',
      'Xarope de fruta']],
    ['Limpeza', '🧽', 'Limpeza', ['Detergente da loiça', 'Pastilhas da máquina da loiça', 'Sal da máquina da loiça', 'Abrilhantador',
      'Detergente da roupa', 'Amaciador', 'Tira-nódoas', 'Lixívia', 'Limpa-vidros', 'Desengordurante', 'Limpa casas de banho',
      'Limpa-chão', 'Multiusos', 'Anticalcário', 'Esfregões', 'Esponjas', 'Panos de microfibra', 'Luvas de limpeza',
      'Sacos do lixo', 'Sacos do lixo pequenos', 'Papel de cozinha', 'Guardanapos', 'Película aderente', 'Papel de alumínio',
      'Papel vegetal', 'Sacos de congelação', 'Pastilhas para sanita', 'Ambientador', 'Inseticida']],
    ['Higiene', '🧴', 'Higiene', ['Papel higiénico', 'Pasta de dentes', 'Escovas de dentes', 'Fio dental', 'Elixir bucal',
      'Gel de banho', 'Champô', 'Amaciador de cabelo', 'Sabonete líquido', 'Sabonete', 'Desodorizante', 'Lâminas de barbear',
      'Espuma de barbear', 'Creme hidratante', 'Creme de mãos', 'Protetor solar', 'Pensos higiénicos', 'Tampões', 'Toalhitas',
      'Discos de algodão', 'Cotonetes', 'Lenços de papel', 'Desmaquilhante', 'Acetona', 'Elásticos de cabelo', 'Gel de cabelo',
      'Recargas de lâminas', 'Protetor labial']],
    ['Farmácia', '💊', 'Farmácia', ['Paracetamol', 'Ibuprofeno', 'Pensos rápidos', 'Desinfetante (antisséptico)', 'Soro fisiológico',
      'Xarope para a tosse', 'Pastilhas para a garganta', 'Anti-histamínico', 'Vitaminas', 'Repelente de insetos', 'Compressas',
      'Adesivo', 'Pomada para queimaduras', 'Líquido para lentes', 'Termómetro']],
    ['Casa', '🏠', 'Casa', ['Pilhas', 'Lâmpadas', 'Fita-cola', 'Fósforos / isqueiro', 'Velas', 'Sacos reutilizáveis', 'Filtros de água',
      'Carvão para grelhar', 'Molas da roupa', 'Cabides']],
    ['Escola e escritório', '✏️', 'Escola', ['Cadernos', 'Canetas azuis', 'Canetas pretas', 'Lápis', 'Borrachas', 'Afias',
      'Marcadores', 'Lápis de cor', 'Canetas de feltro', 'Cola batom', 'Tesoura', 'Régua', 'Capas / dossiês', 'Folhas A4',
      'Folhas de exame', 'Post-its', 'Corretor', 'Calculadora', 'Agrafes', 'Estojo', 'Papel de impressora', 'Tinteiros']],
    ['Animais', '🐾', 'Animais', ['Ração de cão', 'Ração de gato', 'Comida húmida para gato', 'Areia para gato', 'Biscoitos para cão',
      'Sacos para dejetos']],
  ];

  const strip = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const ITENS = SECCOES.flatMap(([seccao, emoji, categoria, produtos]) => produtos.map((nome) => ({ nome, seccao, emoji, categoria })));
  const byName = new Map(ITENS.map((i) => [strip(i.nome), i]));

  /* ---------- Produtos da família ---------- */
  // Guardados na colecção "products":
  //  - produtos novos: { id, nome, seccao, categoria }
  //  - alterações a um produto do catálogo: { id, base: <nome original>, nome, seccao, categoria, hidden }
  const NOSSOS = 'Os nossos produtos';
  const EMOJI = new Map([[NOSSOS, '⭐'], ...SECCOES.map(([nome, emoji]) => [nome, emoji])]);

  /** Catálogo com as alterações da família aplicadas (sem os escondidos) + os produtos novos. */
  function merged(custom = []) {
    const over = new Map(custom.filter((c) => c.base).map((c) => [strip(c.base), c]));
    const base = ITENS.map((i) => {
      const o = over.get(strip(i.nome));
      if (!o) return { ...i, base: i.nome };
      if (o.hidden) return null;
      const seccao = EMOJI.has(o.seccao) ? o.seccao : i.seccao;
      return { ...i, id: o.id, base: i.nome, nome: o.nome || i.nome, seccao, emoji: EMOJI.get(seccao), categoria: o.categoria || i.categoria };
    }).filter(Boolean);
    const extra = custom.filter((c) => !c.base && !c.hidden && c.nome).map((c) => {
      const seccao = EMOJI.has(c.seccao) ? c.seccao : NOSSOS;
      return { id: c.id, nome: c.nome, seccao, emoji: EMOJI.get(seccao), categoria: c.categoria || 'Outro', own: true };
    });
    return [...base, ...extra];
  }

  /** Secções com produtos (a dos nossos produtos primeiro, se existir): [nome, emoji]. */
  function sections(items) {
    const used = new Set(items.map((i) => i.seccao));
    return [[NOSSOS, '⭐'], ...SECCOES.map(([nome, emoji]) => [nome, emoji])].filter(([nome]) => used.has(nome));
  }

  /** Produto com este nome (sem ligar a maiúsculas e acentos), no catálogo dado ou no de origem. */
  const find = (text, items) => (items ? items.find((i) => strip(i.nome) === strip(text)) || null : byName.get(strip(text)) || null);

  const hiddenCount = (custom = []) => custom.filter((c) => c.base && c.hidden).length;

  /* ---------- Os do costume e o que mais se compra ---------- */
  /** Produtos "do costume" que ainda não estão na lista por comprar. */
  function missingStaples(staples = [], shopping = []) {
    const inList = new Set(shopping.filter((i) => !i.done).map((i) => strip(i.text)));
    return staples.filter((st) => st.text && !inList.has(strip(st.text)));
  }

  /** Id fixo das contagens de compras de um produto (um registo por produto). */
  const statId = (name) => `st-${strip(name).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;

  /** Registo de uma compra (ou desfazer, com delta = -1) nas contagens. */
  function countPurchase(stats, item, date, delta = 1) {
    const id = statId(item.text);
    let st = stats.find((x) => x.id === id);
    if (!st) {
      if (delta < 0) return stats;
      st = { id, name: item.text, category: item.category || 'Outro', count: 0, last: '' };
      stats.push(st);
    }
    st.count = Math.max(0, (Number(st.count) || 0) + delta);
    if (delta > 0) { st.last = date; st.name = item.text; st.category = item.category || st.category; }
    return stats;
  }

  /** Sugestões: comprados pelo menos `min` vezes e que ainda não são "do costume". */
  function suggestions(stats = [], staples = [], { min = 2, limit = 8 } = {}) {
    const have = new Set(staples.map((s) => strip(s.text)));
    return stats.filter((s) => s.count >= min && !have.has(strip(s.name)))
      .sort((a, b) => b.count - a.count || (b.last || '').localeCompare(a.last || '')).slice(0, limit);
  }

  /* ---------- Partilhar a lista ---------- */
  const CAT_EMOJI = {
    Frescos: '🥦', 'Talho/Peixaria': '🥩', Padaria: '🥖', Mercearia: '🍝', Congelados: '🧊', Bebidas: '🧃',
    Limpeza: '🧽', Higiene: '🧴', Farmácia: '💊', Casa: '🏠', Escola: '✏️', Animais: '🐾', Outro: '🛍️',
  };

  /** Texto da lista por comprar, por secções (para WhatsApp, SMS, etc.). */
  function shareText(shopping = [], order = Object.keys(CAT_EMOJI), where = '') {
    const pending = shopping.filter((i) => !i.done);
    if (!pending.length) return '🛒 A lista de compras está vazia.';
    if (where) {
      const blocksW = shareText(shopping, order).split('\n').slice(1).join('\n');
      return `🛒 Lista de compras (${where}) — ${pending.length} produto${pending.length === 1 ? '' : 's'}\n${blocksW}`;
    }
    const cats = [...new Set([...order, ...pending.map((i) => i.category || 'Outro')])];
    const blocks = cats.map((c) => {
      const items = pending.filter((i) => (i.category || 'Outro') === c);
      return items.length ? `${CAT_EMOJI[c] || '🛍️'} ${c}\n${items.map((i) => `• ${i.qty ? `${i.qty} ` : ''}${i.text}`).join('\n')}` : '';
    }).filter(Boolean);
    return `🛒 Lista de compras — ${pending.length} produto${pending.length === 1 ? '' : 's'}\n\n${blocks.join('\n\n')}`;
  }

  /* ---------- Preços ---------- */
  const round2 = (n) => Math.round(n * 100) / 100;
  const num = (v) => {
    const n = Number(String(v ?? '').replace(',', '.'));
    return Number.isFinite(n) ? n : NaN;
  };

  /** Quantas unidades (ou kg) diz a quantidade: "6" → 6, "1,5 kg" → 1,5, "" ou "um pack" → 1. */
  function qtyFactor(qty) {
    const m = String(qty || '').trim().match(/^(\d+(?:[.,]\d+)?)/);
    const n = m ? num(m[1]) : 1;
    return n > 0 ? n : 1;
  }

  /** Último preço memorizado de um produto (por unidade/kg): { price, date, store, prev, prevDate } ou null. */
  function memo(stats = [], name) {
    const st = stats.find((x) => x.id === statId(name));
    return st && Number(st.price) > 0 ? {
      price: Number(st.price), date: st.priceDate || '', store: st.priceStore || '',
      prev: Number(st.prevPrice) || 0, prevDate: st.prevDate || '',
    } : null;
  }

  /** Preço a usar para um item: o que lhe puseram, ou o memorizado. */
  function priceOf(item, stats) {
    if (Number(item.price) > 0) return Number(item.price);
    return memo(stats, item.text)?.price || 0;
  }

  const lineTotal = (item, stats) => round2(priceOf(item, stats) * qtyFactor(item.qty));

  /** Total estimado: { total, cart, missing, count } (cart = só o que já está riscado). */
  function estimate(shopping = [], stats = []) {
    let total = 0;
    let cart = 0;
    let missing = 0;
    shopping.forEach((i) => {
      const t = lineTotal(i, stats);
      if (!t) missing++;
      total += t;
      if (i.done) cart += t;
    });
    return { total: round2(total), cart: round2(cart), missing, count: shopping.length };
  }

  /**
   * Memoriza o preço (por unidade/kg) de um produto, com a data e a loja (se se souber).
   * Guarda o anterior (para mostrar se subiu) e um histórico dos últimos 10 preços.
   */
  function rememberPrice(stats, item, price, date, store = '') {
    const p = round2(num(price));
    if (!(p > 0)) return stats;
    const id = statId(item.text);
    let st = stats.find((x) => x.id === id);
    if (!st) {
      st = { id, name: item.text, category: item.category || 'Outro', count: 0, last: '' };
      stats.push(st);
    }
    const where = String(store || '').trim().slice(0, 40);
    // Corrigir o preço no mesmo dia e na mesma loja não conta como mudança de preço.
    const correction = st.priceDate === date && (st.priceStore || '') === where;
    if (Number(st.price) > 0 && Number(st.price) !== p && !correction) {
      st.prevPrice = Number(st.price);
      st.prevDate = st.priceDate || '';
    }
    st.price = p;
    st.priceDate = date;
    st.priceStore = where;
    // Histórico: substitui o registo do mesmo dia e da mesma loja (correcção), senão acrescenta.
    const hist = (st.prices || []).filter((h) => !(h.d === date && (h.s || '') === st.priceStore));
    st.prices = [...hist, { p, d: date, ...(st.priceStore ? { s: st.priceStore } : {}) }].slice(-10);
    return stats;
  }

  /** Histórico de preços de um produto (mais recente primeiro): [{ price, date, store }]. */
  function priceHistory(stats = [], name) {
    const st = stats.find((x) => x.id === statId(name));
    const list = (st?.prices || []).map((h) => ({ price: h.p, date: h.d, store: h.s || '' }));
    if (!list.length && Number(st?.price) > 0) list.push({ price: Number(st.price), date: st.priceDate || '', store: st.priceStore || '' });
    return list.reverse();
  }

  /** Diferença para o preço anterior (positivo = subiu), só se mudou nos últimos 60 dias. */
  function priceChange(stats, name, today) {
    const m = memo(stats, name);
    if (!m || !m.prev || !m.date) return 0;
    const days = (Date.parse(today) - Date.parse(m.date)) / 86400000;
    return days <= 60 ? round2(m.price - m.prev) : 0;
  }

  /* ---------- Talões e orçamento do supermercado ---------- */
  const receipts = (groceries = []) => groceries.filter((g) => g.kind === 'receipt' && Number(g.amount) > 0);
  const budgetOf = (groceries = []) => Number(groceries.find((g) => g.id === 'budget')?.amount) || 0;
  const addMonthsYm = (ym, n) => {
    const [y, m] = ym.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  };

  /** Gasto por mês nos últimos `n` meses (do mais antigo ao actual). */
  function monthly(groceries, today, n = 6) {
    const cur = today.slice(0, 7);
    const list = receipts(groceries);
    return Array.from({ length: n }, (_, i) => {
      const ym = addMonthsYm(cur, i - n + 1);
      const rs = list.filter((r) => (r.date || '').slice(0, 7) === ym);
      return { ym, total: round2(rs.reduce((s, r) => s + Number(r.amount), 0)), count: rs.length };
    });
  }

  /** Situação do orçamento este mês. */
  function budgetStatus(groceries, today) {
    const budget = budgetOf(groceries);
    const spent = monthly(groceries, today, 1)[0].total;
    const [y, m] = today.split('-').map(Number);
    const daysLeft = new Date(Date.UTC(y, m, 0)).getUTCDate() - Number(today.slice(8));
    const pct = budget ? Math.round((spent / budget) * 100) : 0;
    return { budget, spent, left: round2(budget - spent), pct, daysLeft, level: !budget ? '' : pct >= 100 ? 'over' : pct >= 85 ? 'near' : 'ok' };
  }

  /* ---------- Lojas ---------- */
  const DEFAULT_STORES = ['Continente', 'Pingo Doce', 'Lidl', 'Mercadona', 'Farmácia', 'Talho', 'Padaria'];
  /** Lojas da família (as escolhidas por eles, ou as habituais se ainda não mexeram). */
  const storesOf = (shopstores = []) => {
    const doc = shopstores.find((x) => x.id === 'list');
    return doc ? (doc.names || []).filter(Boolean) : DEFAULT_STORES;
  };

  /**
   * Loja de um item: a que lhe puseram ('' = qualquer loja), ou a memorizada para o produto.
   * Uma loja que já não existe na lista conta como "qualquer loja".
   */
  function storeOf(item, stats = [], stores = DEFAULT_STORES) {
    const s = 'store' in item ? item.store : stats.find((x) => x.id === statId(item.text))?.shopAt || '';
    return s && stores.includes(s) ? s : '';
  }

  /** Memoriza onde se compra um produto ('' = qualquer loja). */
  function rememberStore(stats, item, store) {
    const id = statId(item.text);
    let st = stats.find((x) => x.id === id);
    if (!st) {
      st = { id, name: item.text, category: item.category || 'Outro', count: 0, last: '' };
      stats.push(st);
    }
    st.shopAt = store || '';
    return stats;
  }

  /** Só o que se compra nesta loja, mais o que se compra em qualquer loja. '' ou 'all' = tudo. */
  function forStore(items, stats, stores, store) {
    if (!store || store === 'all') return items;
    return items.filter((i) => [store, ''].includes(storeOf(i, stats, stores)));
  }

  /** Quantos itens por loja (sem contar os de "qualquer loja"). */
  function storeCounts(items, stats, stores) {
    const out = Object.fromEntries(stores.map((s) => [s, 0]));
    let any = 0;
    items.forEach((i) => { const s = storeOf(i, stats, stores); if (s) out[s]++; else any++; });
    return { byStore: out, any };
  }

  root.CatalogoCompras = {
    DEFAULT_STORES, storesOf, storeOf, rememberStore, forStore, storeCounts,
    SECCOES, ITENS, NOSSOS, CAT_EMOJI, find, strip, merged, sections, hiddenCount, missingStaples, statId, countPurchase,
    suggestions, shareText, qtyFactor, memo, priceOf, lineTotal, estimate, rememberPrice, priceHistory, priceChange,
    receipts, budgetOf, monthly, budgetStatus,
  };
})(globalThis);
