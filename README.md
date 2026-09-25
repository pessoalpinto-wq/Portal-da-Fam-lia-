# 🏠 Portal da Família

Um portal para uma família de 4 (pai, mãe e duas filhas de 16 e 12 anos) organizar
o dia-a-dia num só sítio: agenda, horários da escola, tarefas, projectos, viagens,
compras, refeições e recados.

## Como usar

1. Abre o `index.html` no navegador (ou o endereço do GitHub Pages, ver abaixo).
2. **Pai ou mãe:** carrega em "Criar conta", depois em **"Sou pai/mãe e quero criar a família"**.
   Podes levar os dados que já tinhas neste dispositivo.
3. Em **Definições** aparecem dois **códigos de convite**:
   - código dos **pais** → para o outro pai/mãe (acesso total);
   - código das **filhas** → para as filhas (acesso com aprovação).
4. Cada pessoa cria a sua conta no seu telemóvel, escreve o código e escolhe quem é.
5. Pronto: tudo o que alguém muda aparece nos outros aparelhos **em tempo real**. 🎉

Também dá para usar sem conta ("Continuar sem conta"), com os dados só nesse dispositivo.

### ✉️ Contas sem email de confirmação

As contas são criadas já confirmadas pela função `register` do servidor, por isso não é preciso
mexer nas definições de email do Supabase (o servidor de email gratuito só envia para a equipa do projecto).

### 📱 Usar no telemóvel como uma app

**Android:** com o portal instalado, num site de receitas façam **Partilhar → Família** e a receita é importada logo.

No GitHub: **Settings → Pages → Branch: `main` (ou este ramo) → `/ (root)` → Save**.
Uns minutos depois o portal fica em `https://pessoalpinto-wq.github.io/Portal-da-Fam-lia-/`.
No telemóvel, abrir esse endereço e escolher **"Adicionar ao ecrã principal"**.

## 🔔 Lembretes no telemóvel

Em **Definições → Lembretes no telemóvel → Ligar lembretes** (em cada aparelho). Chegam mesmo com o portal fechado:

| Lembrete | Quando | Para quem |
|---|---|---|
| ⏰ Compromisso | 1 hora antes (às 8h se não tiver hora) | quem vai e quem leva ("🚗 És tu quem leva") |
| 📝 Teste / trabalho | na véspera às 19h | a aluna ("Bom estudo! 💪") e os pais |
| ✅ Tarefas por fazer | às 18h | o responsável |
| ☀️ Resumo do dia | às 7h30 | cada um: aulas, testes e compromissos do dia |
| 🗓️ Resumo da semana | domingo às 20h | cada um |
| 🙋 Aprovações | na hora | pais (pedidos) e filhas (resposta) |
| ✈️ Viagem | 7 dias e 1 dia antes | quem vai |
| 🎂 Aniversário / 🎉 data especial | na véspera às 20h (datas: também 1 semana antes) | todos menos o aniversariante 😉 |
| 💰 Mesada recebida | no dia, a partir das 9h | a filha |
| 🔐 Documento a expirar | 60, 30, 7 dias antes e no dia | pais e o dono |
| 💶 Conta da casa | 3 dias antes e no dia | pais |
| 🏥 Consulta / vacina | na véspera às 19h | a pessoa e os pais |
| 🗳️ Nova votação | na hora | quem ainda não votou |

Cada pessoa escolhe o que quer receber. **No iPhone** (iOS 16.4 ou mais recente) é preciso primeiro
instalar o portal: Safari → Partilhar → **Adicionar ao ecrã principal**, e abrir pelo ícone.
As notificações precisam do endereço https (GitHub Pages); não funcionam abrindo o `index.html` directamente.

## 📅 Agenda no Google Calendar / iPhone

Em **Definições → Calendário no telemóvel** há um link de subscrição (da família toda ou só de uma pessoa,
com ou sem horário escolar). Actualiza-se sozinho: o iPhone em cerca de 1 hora, o Google em algumas horas.
Na **Agenda** há também "⬇️ .ics" para descarregar a agenda num ficheiro (funciona mesmo sem conta).

## Pais e filhas: quem pode fazer o quê

| | Pais | Filhas |
|---|---|---|
| Agenda, escola, projectos, viagens, compras, refeições, mural | ✅ | ✅ |
| Marcar tarefa como feita | ✅ dá logo os pontos | ⏳ fica **à espera de aprovação** |
| Trocar pontos por recompensas | ✅ | ⏳ faz um **pedido** que os pais aprovam |
| Alterar pontos, membros da família e recompensas | ✅ | ❌ (bloqueado no servidor) |
| Ver códigos de convite | ✅ | ❌ |
| Mesadas e contas da casa | ✅ | ❌ (as contas nem são visíveis) |
| Dinheiro na carteira | ✅ dar e registar | só registar gastos / pôr no mealheiro da própria carteira |
| Votar | só o próprio voto | só o próprio voto |
| Apagar fotos | todas | só as que enviou |

As regras estão na própria base de dados (Row Level Security), por isso não dá para as contornar
mexendo na página. Cada família só vê os seus dados.

## O que está incluído

| Secção | Para quê |
|---|---|
| 🏠 **Painel** | O dia de hoje num relance: compromissos, quem está na escola e a que horas sai, as minhas tarefas, próximos 7 dias, testes, pontos, recados, compras e contagem decrescente para a próxima viagem. |
| 📅 **Agenda** | Calendário mensal partilhado com cor por pessoa. Compromissos com repetição (semanal/mensal/anual), local, participantes e **quem leva / vai buscar**. Mostra também testes, tarefas, viagens e aniversários. |
| 🎒 **Escola** | Horário semanal de cada filha (dia de hoje destacado), testes/trabalhos/reuniões de pais e histórico com as notas obtidas. |
| ✅ **Tarefas** | Tarefas domésticas atribuídas a cada pessoa, com data, repetição (diária/semanal/mensal) e **pontos ⭐**. Tarefas repetidas avançam sozinhas para a próxima data. **💡 Ideias**: mais de 70 tarefas domésticas por zona da casa e idade, com dicas, que se juntam com um toque, e "Montar a semana" para os pais. **🏆 Conquistas**: níveis com XP (que não desce ao trocar pontos), dias seguidos com bónus, 16 medalhas, estrela da semana, desafio da família com prémio comum e festejos quando se sobe de nível. |
| 🎁 **Recompensas** | Os pontos trocam-se por recompensas combinadas em família (escolher o filme, mais tempo de ecrã, escolher o jantar…). Ideal para motivar a mais nova — e a mais velha. |
| 🛠️ **Projectos** | Obras, festas, trabalhos de grupo… divididos em passos, com prazo, participantes e barra de progresso. |
| ✈️ **Viagens** | Datas, contagem decrescente, alojamento, lista de mala por pessoa, preparativos (documentos, seguros) e orçamento com despesas. |
| 🛒 **Compras** | Lista partilhada por categorias; qualquer pessoa acrescenta o que falta. |
| 🍽️ **Refeições** | **Semana:** escolham uma receita para cada almoço/jantar (📖) ou peçam "✨ Sugerir ementa"; o portal junta os ingredientes da semana, marca o que já há em casa e manda o que falta para as compras com um toque. **Receitas:** 78 receitas caseiras portuguesas incluídas (45 para **air fryer 🌀**, com temperatura e tempo; filtro próprio), **🌐 pesquisa na internet** (milhares de receitas testadas da Teleculinária, importadas com um toque), receitas da família, e **importação a partir do link** de sites de receitas (Pingo Doce, Continente, Teleculinária, blogs…) — as receitas de air fryer ficam marcadas sozinhas. **Despensa:** o que há em casa — o que se compra entra sozinho. |
| 📌 **Mural** | Recados para a família ("hoje chego tarde"), com possibilidade de afixar. |
| 📞 **Contactos** | Escola, centro de saúde, explicadores, treinadores, emergência — com botão para ligar. |
| 💰 **Finanças** | Carteira de cada filha, **mesada paga automaticamente** (semanal ou mensal), **mealheiros** com objectivos (bicicleta, telemóvel…), registo de gastos. **Contas da casa** com próximo pagamento e histórico — só os pais vêem. |
| 🏥 **Saúde & Docs** | Ficha de saúde de cada um (alergias, medicação, grupo sanguíneo, médico), consultas e vacinas com a próxima data, e **validade dos documentos** (CC, passaporte, carta, seguros, inspecção, IUC) com aviso antes de expirar. |
| 🗳️ **Votações** | Decisões em família — um voto por pessoa (garantido pelo servidor), resultados em tempo real. |
| 📸 **Memórias** | Álbum privado da família, com fotos por viagem. As fotos são reduzidas no telemóvel antes de enviar. |
| 🚗 **Boleias** | Na Agenda: compromissos das filhas dos próximos 7 dias, quem leva e botão "Eu levo"; aviso no Painel quando ninguém leva. |
| 🎉 **Datas especiais** | Aniversários de avós, tios, amigos, casamento… com idade e ideias de presentes. |
| 📚 **Estudo** | Em cada teste, a lista de tópicos a estudar com progresso — o lembrete da véspera diz quanto falta. |

## Proposta de evolução

### ✅ Fase 2 — Partilha em tempo real (feito)
- Supabase (base de dados + contas + tempo real), com login para cada um, convites e aprovações dos pais.
- Funciona sem internet: as alterações ficam guardadas e são enviadas quando a ligação voltar
  (bolinha no topo: 🟢 sincronizado, 🟠 a guardar, 🔴 sem ligação).

### ✅ Fase 3 — Lembretes e calendário (feito)
- Notificações no telemóvel (Web Push), enviadas pelo servidor de 10 em 10 minutos, sem nunca repetir.
- Link de calendário para Google Calendar / iPhone e exportação .ics.
- Resumo da semana ao domingo (por notificação; por email exigiria contratar um serviço de envio de emails).
- Sincronização nos dois sentidos com o Google Calendar ficou de fora: exige registar uma app na Google e passar
  pela verificação deles. O link de subscrição cobre o essencial.

### ✅ Fase 4 — Finanças, saúde, votações, memórias (feito)
Mesadas e mealheiros, contas da casa, saúde e documentos, votações, álbum de fotos, boleias,
datas especiais e tópicos de estudo.

### Ideias para depois
- 🐶 Animais: vacinas, veterinário, turnos de passeio.
- 🎓 Candidaturas ao ensino superior (para a mais velha): prazos, médias, exames nacionais.
- 💬 Converter pontos das tarefas em euros para a carteira (com taxa definida pelos pais).
- 📊 Relatório mensal das despesas da casa por categoria.

## Estrutura técnica

HTML + CSS + JavaScript simples, sem compilação. Backend: Supabase (projecto `portal-da-familia`).

```
index.html                 página principal
css/styles.css             estilos (claro/escuro automático, adaptado a telemóvel)
js/config.js               endereço e chave pública do Supabase
js/utils.js                datas e utilitários
js/store.js                dados: cache local + sincronização em tempo real com o Supabase
js/motivacao.js            níveis, dias seguidos, medalhas e desafios (calculados do histórico)
js/ideias-tarefas.js       catálogo de ideias de tarefas domésticas
js/tarefas-extra.js        separadores Ideias e Conquistas das Tarefas
js/ui.js                   componentes (formulários, avisos) e regras (tarefas, aprovações, agenda)
js/views.js                as secções do portal
js/cloud.js                contas, criar família, entrar com código
js/app.js                  navegação e acções
js/notify.js               lembretes (Web Push) e link do calendário
js/views-fase4.js          finanças, saúde & documentos, votações, memórias, boleias, datas
js/actions-fase4.js        acções dessas secções
js/photos.js               fotos: redução no telemóvel, envio e links temporários
js/refeicoes.js            refeições: plano da semana, receitas, despensa, em falta → compras
js/receitas.js             livro de receitas portuguesas incluído
js/ingredients.js          percebe linhas de ingredientes ("400 g de bacalhau") e soma quantidades
js/vendor/supabase.js      biblioteca supabase-js (MIT)
sw.js                      service worker: mostra as notificações
icons/                     ícones da app (Android / iPhone)
supabase/migrations/       esquema da base de dados e regras de segurança
supabase/functions/
  send-reminders/          envia os lembretes e paga as mesadas (pg_cron, de 10 em 10 min)
  calendar/                calendário iCal para subscrever
  register/                criar conta já confirmada (sem email de confirmação)
  recipe-import/           importar receita de um site (dados schema.org/Recipe da página)
  recipe-search/           procurar receitas na internet (pesquisa pública da Teleculinária)
  _shared/                 Web Push (RFC 8291/8292), regras dos lembretes, gerador .ics
tests/                     testes (npm test)
```

Segredos (chave privada VAPID e segredo do cron) estão no **Vault** do Supabase, nunca no repositório.

Cada item (tarefa, compromisso, aula…) é uma linha na tabela `items` (`coll` = tipo, `data` = conteúdo).
Os itens apagados ficam marcados com `deleted = true`, o que permite sincronizar bem entre aparelhos.
