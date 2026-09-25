/*
 * Livro de receitas incluído no portal (receitas caseiras portuguesas, para 4 pessoas).
 * As receitas da família (criadas ou importadas de sites) ficam na colecção "recipes".
 */
(function (root) {
  const R = (id, title, emoji, category, minutes, ingredients, steps) => ({
    id: `pt-${id}`, title, emoji, category, minutes, servings: 4, ingredients, steps, builtin: true,
  });

  root.RECEITAS_PT = [
    // ---------- Peixe ----------
    R('bacalhau-bras', 'Bacalhau à Brás', '🐟', 'Peixe', 30, [
      '400 g de bacalhau demolhado', '400 g de batata palha', '6 ovos', '2 cebolas', '2 dentes de alho',
      '1 dl de azeite', 'Salsa q.b.', 'Azeitonas pretas q.b.', 'Sal e pimenta q.b.',
    ], [
      'Desfie o bacalhau, retirando peles e espinhas.',
      'Aloure a cebola às tiras e o alho picado no azeite.',
      'Junte o bacalhau e deixe cozinhar 5 minutos, mexendo.',
      'Envolva a batata palha e, com o lume brando, junte os ovos batidos. Mexa até ficar cremoso.',
      'Sirva com salsa picada e azeitonas.',
    ]),
    R('bacalhau-natas', 'Bacalhau com natas', '🐟', 'Peixe', 60, [
      '400 g de bacalhau demolhado', '800 g de batatas', '2 cebolas', '2 dentes de alho', '1 dl de azeite',
      '50 g de manteiga', '2 colheres de sopa de farinha', '500 ml de leite', '200 ml de natas',
      'Queijo ralado q.b.', 'Noz-moscada q.b.', 'Sal q.b.',
    ], [
      'Coza o bacalhau 5 minutos e desfie-o. Corte as batatas em cubos pequenos e frite-as ou asse-as.',
      'Aloure a cebola e o alho no azeite, junte o bacalhau e as batatas.',
      'Faça um molho branco com a manteiga, a farinha e o leite; tempere com noz-moscada.',
      'Misture tudo com as natas num tabuleiro, polvilhe com queijo e leve ao forno a 200 °C até alourar.',
    ]),
    R('pescada-todos', 'Pescada cozida com todos', '🐟', 'Peixe', 35, [
      '4 postas de pescada', '4 batatas', '4 ovos', '1 brócolo', '4 cenouras', 'Azeite q.b.', 'Vinagre q.b.', 'Sal q.b.',
    ], [
      'Coza as batatas e as cenouras em água com sal.',
      'A meio da cozedura junte os ovos e o brócolo em raminhos.',
      'Nos últimos 8 minutos junte as postas de pescada.',
      'Sirva regado com azeite e um fio de vinagre.',
    ]),
    R('salmao-forno', 'Salmão no forno com legumes', '🐟', 'Peixe', 35, [
      '4 postas de salmão', '2 courgettes', '1 pimento vermelho', '250 g de tomate cherry', '1 limão',
      '4 colheres de sopa de azeite', '2 dentes de alho', 'Ervas aromáticas q.b.', 'Sal e pimenta q.b.',
    ], [
      'Corte os legumes em pedaços e espalhe-os num tabuleiro com azeite, alho e ervas.',
      'Asse 10 minutos a 200 °C.',
      'Junte o salmão temperado com sal, pimenta e limão e asse mais 15 minutos.',
    ]),
    R('filetes-arroz-tomate', 'Filetes com arroz de tomate', '🐟', 'Peixe', 45, [
      '8 filetes de pescada', '2 ovos', 'Farinha q.b.', 'Pão ralado q.b.', '300 g de arroz carolino',
      '1 lata de tomate pelado', '1 cebola', '2 dentes de alho', 'Azeite q.b.', 'Óleo para fritar', 'Limão q.b.', 'Sal q.b.',
    ], [
      'Tempere os filetes com sal e limão; passe por farinha, ovo batido e pão ralado.',
      'Refogue a cebola e o alho no azeite, junte o tomate e deixe apurar.',
      'Junte o arroz e o dobro da água a ferver; coza em lume brando cerca de 15 minutos (deve ficar malandrinho).',
      'Frite os filetes em óleo bem quente e escorra em papel absorvente.',
    ]),
    R('douradas-grelhadas', 'Douradas grelhadas', '🐟', 'Peixe', 30, [
      '4 douradas', '1 kg de batatas pequenas', '1 alface', '2 tomates', '1 limão', 'Azeite q.b.', '2 dentes de alho', 'Sal grosso q.b.',
    ], [
      'Tempere as douradas com sal grosso e deixe repousar 15 minutos.',
      'Coza as batatas com a pele.',
      'Grelhe o peixe cerca de 6 minutos de cada lado.',
      'Sirva com as batatas regadas com azeite e alho, e salada de alface e tomate.',
    ]),
    R('massa-atum', 'Massa com atum', '🍝', 'Massas & arroz', 20, [
      '400 g de massa (lacinhos ou espirais)', '2 latas de atum', '1 cebola', '200 ml de natas', '1 lata de milho',
      'Queijo ralado q.b.', 'Azeite q.b.', 'Orégãos q.b.', 'Sal q.b.',
    ], [
      'Coza a massa em água com sal.',
      'Aloure a cebola no azeite, junte o atum escorrido e o milho.',
      'Junte as natas, envolva a massa e sirva com queijo ralado e orégãos.',
    ]),
    R('polvo-lagareiro', 'Polvo à lagareiro', '🐙', 'Peixe', 90, [
      '1,5 kg de polvo', '1 kg de batatas pequenas', '1 cebola', '1 cabeça de alho', '2 dl de azeite', 'Coentros q.b.', 'Sal grosso q.b.',
    ], [
      'Coza o polvo com a cebola, sem sal, até estar macio (cerca de 45 minutos).',
      'Asse as batatas com pele e sal grosso; dê-lhes um murro quando estiverem assadas.',
      'Leve o polvo ao forno uns minutos, regue tudo com o azeite bem quente com alho laminado.',
      'Polvilhe com coentros.',
    ]),

    // ---------- Carne ----------
    R('frango-assado', 'Frango assado no forno com batatas', '🍗', 'Carne', 75, [
      '1 frango', '1 kg de batatas', '1 cabeça de alho', '1 limão', '1 dl de azeite', '1 colher de sopa de colorau',
      '1 dl de vinho branco', '2 folhas de louro', 'Sal q.b.',
    ], [
      'Faça uma pasta com alho esmagado, colorau, azeite, sumo de limão e sal e barre o frango.',
      'Coloque num tabuleiro com as batatas, o louro e o vinho.',
      'Asse a 200 °C durante cerca de 1 hora, regando de vez em quando com o molho.',
    ]),
    R('arroz-pato', 'Arroz de pato', '🦆', 'Carne', 100, [
      '4 pernas de pato', '400 g de arroz carolino', '1 chouriço', '1 cebola', '2 dentes de alho', '1 folha de louro', '1 laranja', 'Sal q.b.',
    ], [
      'Coza o pato com a cebola, o alho, o louro e sal cerca de 45 minutos. Guarde o caldo.',
      'Desfie a carne, retirando peles e ossos.',
      'Coza o arroz em 2,5 vezes o volume de caldo durante 10 minutos.',
      'Num tabuleiro, faça camadas de arroz e pato; cubra com rodelas de chouriço.',
      'Leve ao forno a 200 °C 20 minutos. Sirva com gomos de laranja.',
    ]),
    R('feijoada', 'Feijoada à transmontana', '🫘', 'Carne', 120, [
      '800 g de feijão encarnado cozido', '400 g de entrecosto', '1 chouriço', '1 farinheira', '150 g de toucinho',
      '2 cenouras', '1 couve lombarda pequena', '1 cebola', '2 dentes de alho', '1 colher de chá de colorau', '1 folha de louro', 'Arroz branco para acompanhar',
    ], [
      'Coza as carnes e os enchidos; guarde o caldo.',
      'Refogue a cebola e o alho, junte o colorau, o louro e as cenouras às rodelas.',
      'Junte o feijão, a couve cortada, as carnes em pedaços e caldo q.b. e deixe apurar 20 minutos.',
      'Sirva com arroz branco.',
    ]),
    R('bitoque', 'Bitoque', '🥩', 'Carne', 30, [
      '4 bifes de vaca', '4 ovos', '1 kg de batatas', '4 dentes de alho', '30 g de manteiga', '1 dl de vinho branco',
      '1 folha de louro', 'Óleo para fritar', 'Sal e pimenta q.b.',
    ], [
      'Tempere os bifes com alho, sal e pimenta.',
      'Frite as batatas cortadas em palitos.',
      'Frite os bifes na manteiga com o louro; junte o vinho para fazer o molho.',
      'Estrele os ovos e coloque um sobre cada bife.',
    ]),
    R('hamburgueres', 'Hambúrgueres caseiros', '🍔', 'Carne', 30, [
      '600 g de carne picada', '4 pães de hambúrguer', '1 cebola', '4 fatias de queijo', '1 alface', '2 tomates', '1 ovo', 'Ketchup q.b.', 'Sal e pimenta q.b.',
    ], [
      'Misture a carne com o ovo, sal e pimenta e forme 4 hambúrgueres.',
      'Grelhe 4 minutos de cada lado; no fim coloque o queijo por cima.',
      'Monte nos pães com alface, tomate, cebola e ketchup.',
    ]),
    R('frango-caril', 'Frango de caril', '🍛', 'Carne', 40, [
      '600 g de peito de frango', '400 ml de leite de coco', '1 cebola', '2 dentes de alho', '2 colheres de sopa de caril',
      '1 maçã', '300 g de arroz basmati', 'Azeite q.b.', 'Sal q.b.',
    ], [
      'Corte o frango em cubos e tempere com sal.',
      'Refogue a cebola e o alho, junte o caril e depois o frango.',
      'Junte a maçã em cubos e o leite de coco e deixe cozinhar 15 minutos.',
      'Sirva com arroz basmati.',
    ]),
    R('empadao', 'Empadão de carne', '🥧', 'Carne', 70, [
      '500 g de carne picada', '1 kg de batatas', '2 dl de leite', '50 g de manteiga', '1 cebola', '2 dentes de alho',
      '1 lata de tomate pelado', '1 gema de ovo', 'Noz-moscada q.b.', 'Azeite q.b.', 'Sal e pimenta q.b.',
    ], [
      'Coza as batatas e faça um puré com o leite, a manteiga e a noz-moscada.',
      'Refogue a cebola e o alho, junte a carne e o tomate e deixe apurar.',
      'Num pirex, faça uma camada de puré, a carne, e cubra com o resto do puré.',
      'Pincele com gema e leve ao forno a 200 °C até alourar.',
    ]),
    R('porco-alentejana', 'Carne de porco à alentejana', '🐖', 'Carne', 60, [
      '600 g de carne de porco em cubos', '1 kg de amêijoas', '800 g de batatas', '4 dentes de alho', '2 dl de vinho branco',
      '1 colher de sopa de massa de pimentão', 'Coentros q.b.', 'Pickles q.b.', 'Azeite q.b.', 'Óleo para fritar', 'Sal q.b.',
    ], [
      'Marine a carne com alho, vinho e massa de pimentão durante pelo menos 1 hora.',
      'Frite as batatas em cubos.',
      'Aloure a carne em azeite, junte a marinada e as amêijoas e tape até abrirem.',
      'Junte as batatas, os coentros e os pickles.',
    ]),
    R('strogonoff', 'Strogonoff de frango', '🍗', 'Carne', 30, [
      '600 g de peito de frango', '250 g de cogumelos', '1 cebola', '200 ml de natas', '1 colher de sopa de mostarda',
      '2 colheres de sopa de ketchup', '300 g de arroz', 'Batata palha q.b.', 'Azeite q.b.', 'Sal q.b.',
    ], [
      'Aloure o frango em tiras no azeite e reserve.',
      'Refogue a cebola e os cogumelos laminados.',
      'Junte o frango, a mostarda, o ketchup e as natas e deixe engrossar.',
      'Sirva com arroz branco e batata palha.',
    ]),
    R('arroz-frango', 'Arroz de frango', '🍗', 'Massas & arroz', 50, [
      '6 coxas de frango', '350 g de arroz carolino', '1 cebola', '2 dentes de alho', '1 chouriço', '1 tomate',
      '1 folha de louro', '1 dl de vinho branco', 'Salsa q.b.', 'Azeite q.b.', 'Sal q.b.',
    ], [
      'Aloure o frango em azeite, junte a cebola, o alho, o tomate e o louro.',
      'Junte o vinho e água e deixe cozer 25 minutos.',
      'Junte o arroz e o chouriço às rodelas e coza mais 15 minutos. Polvilhe com salsa.',
    ]),
    R('esparguete-bolonhesa', 'Esparguete à bolonhesa', '🍝', 'Massas & arroz', 40, [
      '400 g de esparguete', '500 g de carne picada', '1 lata de tomate pelado', '1 cebola', '2 dentes de alho', '1 cenoura',
      '1 dl de vinho tinto', 'Azeite q.b.', 'Orégãos q.b.', 'Queijo parmesão ralado q.b.', 'Sal e pimenta q.b.',
    ], [
      'Refogue a cebola, o alho e a cenoura picados no azeite.',
      'Junte a carne e deixe alourar; junte o vinho, o tomate e os orégãos. Deixe apurar 20 minutos.',
      'Coza o esparguete e sirva com o molho e parmesão.',
    ]),
    R('lasanha', 'Lasanha de carne', '🍝', 'Massas & arroz', 75, [
      '12 folhas de lasanha', '500 g de carne picada', '1 lata de tomate pelado', '1 cebola', '2 dentes de alho',
      '50 g de manteiga', '3 colheres de sopa de farinha', '700 ml de leite', 'Queijo ralado q.b.', 'Noz-moscada q.b.', 'Sal q.b.',
    ], [
      'Faça o molho de carne como na bolonhesa.',
      'Faça um molho bechamel com manteiga, farinha, leite e noz-moscada.',
      'Num tabuleiro alterne folhas de lasanha, carne e bechamel. Termine com bechamel e queijo.',
      'Leve ao forno a 190 °C durante 35 minutos.',
    ]),
    R('pizza', 'Pizza caseira', '🍕', 'Massas & arroz', 35, [
      '1 embalagem de massa de pizza', '200 g de polpa de tomate', '1 mozzarella', '150 g de fiambre', '150 g de cogumelos',
      'Orégãos q.b.', 'Azeite q.b.',
    ], [
      'Estenda a massa num tabuleiro e barre com a polpa de tomate.',
      'Distribua a mozzarella, o fiambre e os cogumelos. Tempere com orégãos e um fio de azeite.',
      'Leve ao forno bem quente (220 °C) cerca de 15 minutos. Cada um pode escolher os seus ingredientes!',
    ]),
    R('wraps-frango', 'Wraps de frango', '🌯', 'Carne', 25, [
      '4 tortilhas de trigo', '400 g de peito de frango', '1 alface', '2 tomates', '1 pimento', '1 iogurte natural', '1 limão', 'Azeite q.b.', 'Sal q.b.',
    ], [
      'Grelhe o frango em tiras temperado com sal e limão.',
      'Faça um molho com iogurte, limão e sal.',
      'Recheie as tortilhas com frango, legumes e molho e enrole.',
    ]),

    // ---------- Sopas ----------
    R('caldo-verde', 'Caldo verde', '🥣', 'Sopa', 40, [
      '600 g de batatas', '300 g de couve galega cortada', '1 cebola', '2 dentes de alho', '1 chouriço', '1 dl de azeite', 'Sal q.b.',
    ], [
      'Coza as batatas, a cebola e o alho em água com sal e triture.',
      'Junte a couve às tirinhas e deixe ferver 5 minutos, destapado.',
      'Sirva com rodelas de chouriço e um fio de azeite.',
    ]),
    R('sopa-legumes', 'Sopa de legumes', '🥣', 'Sopa', 40, [
      '3 batatas', '2 cenouras', '1 courgette', '1 cebola', '1 alho francês', '100 g de feijão verde', 'Azeite q.b.', 'Sal q.b.',
    ], [
      'Coza a batata, a cenoura, a courgette, a cebola e o alho francês em água com sal.',
      'Triture, junte o feijão verde cortado e deixe cozer mais 10 minutos.',
      'Tempere com um fio de azeite.',
    ]),
    R('canja', 'Canja de galinha', '🥣', 'Sopa', 60, [
      '½ galinha', '150 g de massa pevide', '1 cebola', '1 cenoura', '1 raminho de hortelã', '1 limão', 'Sal q.b.',
    ], [
      'Coza a galinha com a cebola e a cenoura em 2 litros de água com sal.',
      'Retire a galinha, desfie a carne e volte a colocá-la no caldo.',
      'Junte a massa e coza 10 minutos. Sirva com hortelã e umas gotas de limão.',
    ]),
    R('sopa-grao-espinafres', 'Sopa de grão com espinafres', '🥣', 'Sopa', 35, [
      '1 lata de grão-de-bico', '2 batatas', '1 cebola', '2 dentes de alho', '150 g de espinafres', 'Azeite q.b.', 'Sal q.b.',
    ], [
      'Coza as batatas, a cebola, o alho e metade do grão e triture.',
      'Junte o resto do grão e os espinafres e deixe ferver 5 minutos.',
      'Tempere com azeite.',
    ]),

    // ---------- Vegetariano ----------
    R('omelete-legumes', 'Omelete de legumes', '🍳', 'Vegetariano', 15, [
      '8 ovos', '200 g de cogumelos', '100 g de espinafres', '1 cebola', '100 g de queijo ralado', 'Azeite q.b.', 'Sal e pimenta q.b.',
    ], [
      'Salteie a cebola, os cogumelos e os espinafres no azeite.',
      'Junte os ovos batidos com sal, pimenta e queijo.',
      'Cozinhe em lume brando, dobre e sirva com salada.',
    ]),
    R('quiche-legumes', 'Quiche de legumes', '🥧', 'Vegetariano', 50, [
      '1 embalagem de massa quebrada', '4 ovos', '200 ml de natas', '1 courgette', '1 pimento', '1 cebola',
      '100 g de queijo ralado', 'Noz-moscada q.b.', 'Sal q.b.',
    ], [
      'Forre uma tarteira com a massa.',
      'Salteie os legumes cortados e espalhe-os sobre a massa.',
      'Bata os ovos com as natas, o queijo, sal e noz-moscada e verta por cima.',
      'Leve ao forno a 190 °C cerca de 35 minutos.',
    ]),
    R('chili-vegetariano', 'Chili vegetariano', '🌶️', 'Vegetariano', 40, [
      '2 latas de feijão encarnado', '1 lata de milho', '1 lata de tomate pelado', '1 pimento', '1 cebola', '2 dentes de alho',
      '1 colher de chá de cominhos', '1 colher de chá de colorau', '300 g de arroz', 'Azeite q.b.', 'Sal q.b.',
    ], [
      'Refogue a cebola, o alho e o pimento.',
      'Junte as especiarias, o tomate, o feijão e o milho e deixe apurar 20 minutos.',
      'Sirva com arroz branco.',
    ]),
    R('caril-grao', 'Caril de grão com espinafres', '🍛', 'Vegetariano', 30, [
      '2 latas de grão-de-bico', '400 ml de leite de coco', '200 g de espinafres', '1 cebola', '2 dentes de alho',
      '2 colheres de sopa de caril', '1 lata de tomate pelado', '300 g de arroz basmati', 'Azeite q.b.', 'Sal q.b.',
    ], [
      'Refogue a cebola e o alho, junte o caril e o tomate.',
      'Junte o grão e o leite de coco e deixe cozinhar 10 minutos.',
      'Envolva os espinafres e sirva com arroz.',
    ]),

    // ---------- Sobremesas ----------
    R('arroz-doce', 'Arroz doce', '🍮', 'Sobremesas', 50, [
      '200 g de arroz carolino', '1 l de leite', '200 g de açúcar', '4 gemas', '1 casca de limão', '1 pau de canela', 'Canela em pó q.b.', 'Sal q.b.',
    ], [
      'Coza o arroz em água com uma pitada de sal e a casca de limão.',
      'Junte o leite quente aos poucos e o pau de canela, mexendo sempre.',
      'Junte o açúcar e, fora do lume, as gemas. Deixe engrossar.',
      'Deite em taças e decore com canela em pó.',
    ]),
    R('bolo-iogurte', 'Bolo de iogurte', '🍰', 'Sobremesas', 55, [
      '1 iogurte natural', '3 ovos', '2 medidas de açúcar', '3 medidas de farinha', '1 medida de óleo', '1 colher de chá de fermento', '1 limão',
    ], [
      'Use o copo do iogurte como medida.',
      'Bata os ovos com o açúcar, junte o iogurte, o óleo e a raspa de limão.',
      'Envolva a farinha com o fermento.',
      'Leve ao forno a 180 °C cerca de 40 minutos numa forma untada.',
    ]),
    R('salame-chocolate', 'Salame de chocolate', '🍫', 'Sobremesas', 20, [
      '200 g de bolacha Maria', '200 g de chocolate de culinária', '125 g de manteiga', '100 g de açúcar', '2 ovos',
    ], [
      'Derreta o chocolate com a manteiga.',
      'Bata os ovos com o açúcar e junte o chocolate.',
      'Envolva a bolacha partida, enrole em papel vegetal e leve ao frigorífico pelo menos 4 horas.',
    ]),
  ];

  root.RECEITAS_CATEGORIAS = ['Carne', 'Peixe', 'Vegetariano', 'Massas & arroz', 'Sopa', 'Sobremesas'];
})(globalThis);
