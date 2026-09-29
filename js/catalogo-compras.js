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

  /** Produto do catálogo com este nome (sem ligar a maiúsculas e acentos). */
  const find = (text) => byName.get(strip(text)) || null;

  root.CatalogoCompras = { SECCOES, ITENS, find, strip };
})(globalThis);
