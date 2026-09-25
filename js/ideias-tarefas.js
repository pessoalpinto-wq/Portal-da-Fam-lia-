/*
 * Ideias de tarefas domésticas por zona da casa, com idade mínima sugerida, pontos e frequência.
 * cat = categoria da tarefa no portal; r = daily | weekly | monthly | none.
 */
(function (root) {
  const AREAS = [
    ['cozinha', '🍳', 'Cozinha'], ['sala', '🛋️', 'Sala e casa'], ['quarto', '🛏️', 'Quarto'],
    ['wc', '🚿', 'Casa de banho'], ['roupa', '👕', 'Roupa'], ['fora', '🌿', 'Varanda, jardim e carro'],
    ['animais', '🐾', 'Animais'], ['recados', '🛒', 'Compras e recados'], ['escola', '🎒', 'Escola e organização'],
    ['extra', '⭐', 'Extra e desafios'],
  ];

  // [zona, título, idade mínima, pontos, repetição, categoria, dica]
  const L = [
    ['cozinha', 'Pôr e levantar a mesa', 8, 2, 'daily', 'Cozinha', 'Inclui limpar a mesa com um pano no fim.'],
    ['cozinha', 'Carregar a máquina da loiça', 10, 2, 'daily', 'Cozinha', 'Passar a loiça por água antes; facas com o bico para baixo.'],
    ['cozinha', 'Esvaziar a máquina da loiça', 8, 2, 'daily', 'Cozinha', 'Primeiro os talheres, depois pratos e copos.'],
    ['cozinha', 'Lavar a loiça que não vai à máquina', 12, 3, 'daily', 'Cozinha', 'Tachos, frigideira da air fryer e tábuas.'],
    ['cozinha', 'Limpar a bancada e o fogão', 12, 2, 'daily', 'Cozinha', 'Com o fogão já frio.'],
    ['cozinha', 'Limpar o micro-ondas', 10, 2, 'weekly', 'Cozinha', 'Truque: aquecer 2 min uma taça de água com limão e depois limpar.'],
    ['cozinha', 'Limpar o cesto da air fryer', 12, 2, 'weekly', 'Cozinha', 'Água quente com detergente e esponja macia (não riscar).'],
    ['cozinha', 'Ver o que está fora de prazo no frigorífico', 12, 3, 'weekly', 'Cozinha', 'Pôr à frente o que acaba primeiro.'],
    ['cozinha', 'Limpar o frigorífico por dentro', 14, 5, 'monthly', 'Cozinha', 'Prateleira a prateleira, com água e vinagre.'],
    ['cozinha', 'Preparar os lanches para a escola', 10, 2, 'daily', 'Cozinha', 'Fruta, sandes e água para o dia seguinte.'],
    ['cozinha', 'Ajudar a fazer o jantar', 10, 3, 'weekly', 'Cozinha', 'Descascar, lavar legumes, mexer, pôr temperos.'],
    ['cozinha', 'Fazer o jantar (com a receita do portal)', 15, 8, 'weekly', 'Cozinha', 'Escolher a receita em Refeições e ver se falta algum ingrediente.'],
    ['cozinha', 'Fazer uma sobremesa para a família', 12, 5, 'none', 'Cozinha', 'Há receitas em Refeições → Sobremesas.'],
    ['cozinha', 'Arrumar as compras', 8, 2, 'weekly', 'Cozinha', 'Frescos primeiro no frigorífico.'],

    ['sala', 'Tirar o lixo e a reciclagem', 10, 3, 'weekly', 'Casa', 'Amarelo: plástico e metal · Azul: papel · Verde: vidro.'],
    ['sala', 'Aspirar a sala', 10, 3, 'weekly', 'Casa', 'Não esquecer debaixo do sofá e das almofadas.'],
    ['sala', 'Aspirar a casa toda', 14, 6, 'weekly', 'Casa', 'Começar pelos quartos e acabar na entrada.'],
    ['sala', 'Aspirar as escadas', 12, 3, 'weekly', 'Casa'],
    ['sala', 'Passar a esfregona na cozinha', 12, 3, 'weekly', 'Casa', 'Aspirar antes; pouca água.'],
    ['sala', 'Limpar o pó da sala', 8, 2, 'weekly', 'Casa', 'De cima para baixo; pano de microfibra ligeiramente húmido.'],
    ['sala', 'Arrumar a sala antes de dormir (5 min)', 8, 1, 'daily', 'Casa', 'Mantas dobradas, comandos no lugar, copos na cozinha.'],
    ['sala', 'Limpar espelhos e vidros baixos', 10, 2, 'weekly', 'Casa'],
    ['sala', 'Limpar interruptores e puxadores', 10, 2, 'monthly', 'Casa', 'Os sítios onde mais se põe as mãos.'],
    ['sala', 'Regar as plantas de casa', 8, 1, 'weekly', 'Casa'],
    ['sala', 'Mudar a água e limpar a garrafa de água do frigorífico', 10, 1, 'weekly', 'Casa'],
    ['sala', 'Organizar o hall e os sapatos da entrada', 8, 2, 'weekly', 'Casa'],

    ['quarto', 'Fazer a cama', 8, 1, 'daily', 'Quarto', 'Logo ao levantar: 2 minutos.'],
    ['quarto', 'Arrumar o quarto', 8, 4, 'weekly', 'Quarto', 'Chão livre, secretária arrumada, roupa no lugar.'],
    ['quarto', 'Mudar os lençóis da cama', 12, 3, 'weekly', 'Quarto', 'Os usados vão directos para o cesto da roupa.'],
    ['quarto', 'Aspirar e limpar o pó do quarto', 10, 3, 'weekly', 'Quarto'],
    ['quarto', 'Arejar o quarto de manhã', 8, 1, 'daily', 'Quarto', 'Abrir a janela 10 minutos.'],
    ['quarto', 'Destralhar o roupeiro (dar o que já não serve)', 12, 6, 'monthly', 'Quarto', 'Três pilhas: fica · dar · lixo.'],

    ['wc', 'Limpar o lavatório e o espelho', 10, 2, 'weekly', 'Casa'],
    ['wc', 'Limpar a casa de banho toda', 14, 6, 'weekly', 'Casa', 'Sanita, lavatório, duche, espelho e chão. Luvas!'],
    ['wc', 'Pôr toalhas lavadas', 8, 1, 'weekly', 'Casa'],
    ['wc', 'Repor papel higiénico e sabonete', 8, 1, 'weekly', 'Casa'],
    ['wc', 'Secar o duche depois do banho', 10, 1, 'daily', 'Casa', 'Com o rodo: evita calcário e bolor.'],

    ['roupa', 'Levar a roupa suja para o cesto', 8, 1, 'daily', 'Roupa'],
    ['roupa', 'Separar a roupa por cores', 10, 2, 'weekly', 'Roupa', 'Brancos · escuros · cores · delicados.'],
    ['roupa', 'Pôr uma máquina de roupa a lavar', 12, 3, 'weekly', 'Roupa', 'Ver a etiqueta e esvaziar os bolsos!'],
    ['roupa', 'Estender a roupa', 10, 3, 'weekly', 'Roupa', 'Sacudir bem: fica com menos vincos.'],
    ['roupa', 'Apanhar e dobrar a roupa', 10, 3, 'weekly', 'Roupa'],
    ['roupa', 'Arrumar a sua roupa lavada', 8, 2, 'weekly', 'Roupa'],
    ['roupa', 'Emparelhar as meias', 8, 1, 'weekly', 'Roupa'],
    ['roupa', 'Passar a ferro (peças simples)', 15, 5, 'weekly', 'Roupa', 'Começar por t-shirts e fronhas, com a mãe ou o pai por perto.'],

    ['fora', 'Varrer a varanda ou o terraço', 10, 2, 'weekly', 'Casa'],
    ['fora', 'Regar as plantas da varanda', 8, 1, 'weekly', 'Casa'],
    ['fora', 'Aspirar o carro por dentro', 12, 5, 'monthly', 'Casa', 'Tirar tapetes, lixo e garrafas primeiro.'],
    ['fora', 'Ajudar a lavar o carro', 10, 4, 'monthly', 'Casa'],
    ['fora', 'Limpar a mesa e as cadeiras da esplanada', 10, 2, 'monthly', 'Casa'],

    ['animais', 'Dar comida e água ao animal', 8, 1, 'daily', 'Animais'],
    ['animais', 'Passear o cão', 10, 2, 'daily', 'Animais'],
    ['animais', 'Limpar a areia do gato', 10, 2, 'daily', 'Animais'],
    ['animais', 'Escovar o animal', 8, 2, 'weekly', 'Animais'],
    ['animais', 'Limpar a gaiola ou o aquário', 12, 4, 'weekly', 'Animais'],

    ['recados', 'Fazer a lista de compras da semana', 12, 2, 'weekly', 'Recados', 'Ver a despensa e o plano de Refeições no portal.'],
    ['recados', 'Ir ao pão / à mercearia aqui perto', 12, 2, 'weekly', 'Recados'],
    ['recados', 'Ir ao supermercado com a lista (e o talão)', 16, 5, 'none', 'Recados', 'Comparar preços por kg e trazer o talão.'],
    ['recados', 'Levar o vidro e as pilhas ao ecoponto', 12, 2, 'monthly', 'Recados'],
    ['recados', 'Ajudar a arrumar a despensa', 10, 3, 'monthly', 'Recados'],

    ['escola', 'Preparar a mochila na noite anterior', 8, 1, 'daily', 'Escola', 'Ver o horário de amanhã em Escola.'],
    ['escola', 'Deixar a roupa de amanhã preparada', 8, 1, 'daily', 'Escola'],
    ['escola', 'Arrumar a secretária', 8, 2, 'weekly', 'Escola'],
    ['escola', 'Planear a semana de estudo', 12, 3, 'weekly', 'Escola', 'Ver os testes marcados e dividir a matéria por dias.'],
    ['escola', 'Carregar o telemóvel e o computador fora do quarto à noite', 12, 1, 'daily', 'Escola'],

    ['extra', 'Ajudar um irmão numa tarefa', 8, 3, 'weekly', 'Outro', 'Conta como "Mão amiga" nas medalhas.'],
    ['extra', 'Tarefa-surpresa: fazer algo sem ninguém pedir', 8, 5, 'weekly', 'Outro', 'Os pais escolhem se vale os pontos.'],
    ['extra', 'Limpeza relâmpago de 15 minutos (todos juntos)', 8, 3, 'weekly', 'Casa', 'Música alta, cronómetro e cada um numa divisão.'],
    ['extra', 'Organizar uma gaveta ou armário da casa', 10, 4, 'monthly', 'Casa'],
    ['extra', 'Preparar o pequeno-almoço de domingo para todos', 12, 6, 'weekly', 'Cozinha'],
    ['extra', 'Escolher e preparar o jantar de sexta', 15, 8, 'weekly', 'Cozinha', 'Da receita às compras: fica responsável pelo jantar todo.'],
    ['extra', 'Tratar da roupa da semana do princípio ao fim', 16, 10, 'weekly', 'Roupa', 'Lavar, estender, dobrar e arrumar.'],
    ['extra', 'Gerir o dinheiro das compras do mês com os pais', 16, 5, 'monthly', 'Recados', 'Registar despesas em Finanças.'],
  ];

  const IDEIAS = L.map(([area, title, age, points, repeat, category, tip], i) => ({
    id: `i${i + 1}`, area, title, age, points, repeat, category, tip: tip || '',
  }));

  root.IDEIAS_TAREFAS = { AREAS, IDEIAS };
})(globalThis);
