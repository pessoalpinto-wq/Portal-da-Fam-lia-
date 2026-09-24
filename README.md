# 🏠 Portal da Família

Um portal para uma família de 4 (pai, mãe e duas filhas de 16 e 12 anos) organizar
o dia-a-dia num só sítio: agenda, horários da escola, tarefas, projectos, viagens,
compras, refeições e recados.

## Como usar (já!)

1. Abre o `index.html` no navegador (funciona com duplo clique, sem instalar nada).
2. Em **Definições** muda os nomes, as cores, os emojis e as datas de nascimento.
3. No topo escolhe **"Sou …"** para o portal saber quem está a usar.
4. Substitui os horários de exemplo em **Escola** pelos horários reais.

Para usar no telemóvel como uma app basta publicar o repositório com **GitHub Pages**
(Settings → Pages → branch) e, no telemóvel, "Adicionar ao ecrã principal".

> ⚠️ **Nesta primeira versão os dados ficam guardados em cada dispositivo.**
> Em Definições há "Exportar/Importar cópia" para passar os dados entre dispositivos.
> A sincronização automática entre os 4 telemóveis é a Fase 2 (ver abaixo).

## O que já está incluído (Fase 1)

| Secção | Para quê |
|---|---|
| 🏠 **Painel** | O dia de hoje num relance: compromissos, quem está na escola e a que horas sai, as minhas tarefas, próximos 7 dias, testes, pontos, recados, compras e contagem decrescente para a próxima viagem. |
| 📅 **Agenda** | Calendário mensal partilhado com cor por pessoa. Compromissos com repetição (semanal/mensal/anual), local, participantes e **quem leva / vai buscar**. Mostra também testes, tarefas, viagens e aniversários. |
| 🎒 **Escola** | Horário semanal de cada filha (dia de hoje destacado), testes/trabalhos/reuniões de pais e histórico com as notas obtidas. |
| ✅ **Tarefas** | Tarefas domésticas atribuídas a cada pessoa, com data, repetição (diária/semanal/mensal) e **pontos ⭐**. Tarefas repetidas avançam sozinhas para a próxima data. |
| 🎁 **Recompensas** | Os pontos trocam-se por recompensas combinadas em família (escolher o filme, mais tempo de ecrã, escolher o jantar…). Ideal para motivar a mais nova — e a mais velha. |
| 🛠️ **Projectos** | Obras, festas, trabalhos de grupo… divididos em passos, com prazo, participantes e barra de progresso. |
| ✈️ **Viagens** | Datas, contagem decrescente, alojamento, lista de mala por pessoa, preparativos (documentos, seguros) e orçamento com despesas. |
| 🛒 **Compras** | Lista partilhada por categorias; qualquer pessoa acrescenta o que falta. |
| 🍽️ **Refeições** | Plano semanal de almoços/jantares e quem cozinha. Ingredientes entre parênteses passam para a lista de compras com um clique. |
| 📌 **Mural** | Recados para a família ("hoje chego tarde"), com possibilidade de afixar. |
| 📞 **Contactos** | Escola, centro de saúde, explicadores, treinadores, emergência — com botão para ligar. |

## Proposta de evolução

### Fase 2 — Partilha em tempo real (a mais importante)
- Backend partilhado (proposta: **Supabase** — gratuito para este volume, com base de
  dados, autenticação e tempo real). A camada de dados já está isolada em `js/store.js`
  para esta troca ser simples.
- **Login para cada um** (email ou link mágico) e perfis com permissões:
  pais gerem tudo; filhas criam os seus compromissos, marcam tarefas como feitas e
  pedem recompensas, que os pais **aprovam**.
- Tarefas marcadas pelas filhas ficam "à espera de validação" antes de darem pontos.

### Fase 3 — Notificações e integrações
- Lembretes no telemóvel (PWA com notificações): "Amanhã há teste de Matemática",
  "Hoje és tu que tiras o lixo", "Buscar a mais nova às 17:45".
- Sincronização com **Google Calendar / iCloud** (exportar agenda em ficheiro iCal).
- Resumo semanal ao domingo à noite por email: o que aí vem na semana.

### Fase 4 — Mais ideias para uma família de 4
- 💰 **Mesadas e finanças**: mesada de cada filha, poupanças para objectivos, despesas da casa e contas a pagar (água, luz, seguros, IUC).
- 🏥 **Saúde**: consultas, vacinas, medicação, alergias, dentista/ortodontista.
- 🚗 **Boleias e logística**: quem leva quem, com o calendário semanal de actividades extra-curriculares.
- 📚 **Estudo**: plano de estudo para os testes, época de exames nacionais (a de 16 anos entra no 11.º/12.º), candidaturas ao ensino superior.
- 🔐 **Documentos**: validade de cartões de cidadão, passaportes, cartas de condução, seguros — com aviso antes de expirar.
- 🎂 **Datas especiais**: aniversários de avós, tios e amigos, com lista de ideias de presentes.
- 🐶 **Animais** (se houver): vacinas, veterinário, turnos de passeio.
- 🗳️ **Decisões em família**: votações rápidas (destino de férias, jantar de sábado, filme).
- 📸 **Álbum/memórias** de viagens e momentos da família.

## Estrutura técnica

HTML + CSS + JavaScript simples, sem dependências nem compilação.

```
index.html            página principal
css/styles.css        estilos (claro/escuro automático, adaptado a telemóvel)
js/utils.js           datas e utilitários
js/store.js           dados (localStorage, exportar/importar, dados de exemplo)
js/ui.js              componentes (formulários, avisos) e regras (tarefas, agenda)
js/views.js           as secções do portal
js/app.js             navegação e acções
```
