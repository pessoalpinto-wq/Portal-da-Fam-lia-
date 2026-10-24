/*
 * Finanças → 🎯 Orçamento: importar extratos, classificar movimentos, orçamento por categoria.
 * Só para os pais (o servidor nem envia estes dados às filhas). Cálculos em js/orcamento.js; ler ficheiros em js/folhas.js.
 */
window.FinancasOrcamento = function ({ render }) {
  const { esc, money, today } = U;
  const { openForm, toast } = UI;
  const { card, empty } = Views.h;
  const O = Orcamento;
  const P = Patrimonio;
  const S = () => Store.state;
  const VS = Views.VS;
  const PAGE = 60;
  const catLabel = (c) => `${O.CAT[c]?.emoji || '📦'} ${O.CAT[c]?.name || c}`;
  const signedMoney = (n) => `${n < 0 ? '−' : '+'}${money(Math.abs(n))}`;
  const accountName = (id) => S().faccounts.find((a) => a.id === id)?.name || (id === 'cash' ? 'Dinheiro' : '—');
  const month = () => VS.budMonth || P.monthOf(today());
  const catOptions = (kinds = ['expense', 'income', 'move']) => O.CATS.filter((c) => kinds.includes(c[3])).map(([id, e, n]) => [id, `${e} ${n}`]);

  /** Movimentos importados antes de haver a categoria Ordenado (vencimentos em "Entradas"): passam para Ordenado, uma vez. */
  let migrated = false;
  function migrateSalaries(s) {
    if (migrated) return;
    const ids = s.ftx.filter((t) => t.cat === 'entradas' && !t.manualCat && t.rule === 'default' && O.categorize(t.desc, t.amount, s.frules).cat === 'ordenado').map((t) => t.id);
    if (!ids.length) { if (s.ftx.length) migrated = true; return; }
    migrated = true;
    setTimeout(() => Store.update((st) => { st.ftx.forEach((t) => { if (ids.includes(t.id) && t.cat === 'entradas') t.cat = 'ordenado'; }); }), 0);
  }

  /* ---------- Vista ---------- */
  function view() {
    const s = S();
    const m = month();
    // Filtro por conta (ex.: só o cartão de crédito Santander): totais, categorias e movimentos dessa conta.
    const accIds = new Set(s.ftx.map((t) => t.account));
    const acc = VS.budAcc && accIds.has(VS.budAcc) ? VS.budAcc : '';
    const txs = acc ? s.ftx.filter((t) => t.account === acc) : s.ftx;
    migrateSalaries(s);
    const sum = O.monthSummary(txs, m);
    const split = Fixas.monthSplit(txs, s.bills, m, O.kindOf);
    // Os orçamentos são da família toda: com uma conta escolhida, mostra só quanto se gastou nela.
    const rows = O.budgetRows(txs, acc ? [] : s.fbudgets, m);
    const monthTx = txs.filter((t) => String(t.date).startsWith(m)); // (já filtrado pela conta escolhida)
    const filter = VS.budFilter || '';
    const q = O.norm(VS.budSearch || '');
    const shown = monthTx.filter((t) => (!filter || (filter === '_unsorted' ? t.rule === 'none' && !t.manualCat && O.kindOf(t.cat) === 'expense' : t.cat === filter))
      && (!q || O.norm(t.desc).includes(q)))
      .sort((a, b) => b.date.localeCompare(a.date) || Math.abs(b.amount) - Math.abs(a.amount));
    const limit = VS.budShow || PAGE;

    const nav = `<div class="bud-nav">
        <button class="icon-btn" data-action="bud-month" data-id="-1" aria-label="Mês anterior">‹</button>
        <b>${esc(P.monthName(m))}</b>
        <button class="icon-btn" data-action="bud-month" data-id="1" aria-label="Mês seguinte" ${m >= P.monthOf(today()) ? 'disabled' : ''}>›</button>
        <span class="spacer"></span>
        <button class="btn small primary" data-action="bud-import">📥 Importar extrato</button>
        <button class="btn small" data-action="bud-add">＋ Movimento</button></div>`;

    if (!txs.length) {
      return `${nav}${card('🎯 Orçamento por categoria', `<p>Para ver em quê gastam, importem os extratos das vossas contas.</p>
        <ol class="small bud-how"><li>No homebanking (site ou app do banco), abram os <b>movimentos</b> da conta e escolham <b>Exportar</b> / <b>Descarregar</b> em <b>Excel</b> ou <b>CSV</b>.</li>
        <li>Aqui, toquem em <b>📥 Importar extrato</b>, escolham a conta e o ficheiro.</li>
        <li>O portal classifica sozinho (Continente → Supermercado, Galp → Carro…). Quando corrigirem um, aprende para a próxima.</li></ol>
        <p class="small muted">Podem importar o mesmo período duas vezes: os movimentos repetidos não entram. ${s.faccounts.length ? '' : 'Antes, juntem as contas em <b>📈 Património</b>.'}</p>`)}`;
    }

    // Por conta, no mês: despesas e entradas (sem transferências entre contas nem poupança).
    const perAcc = [...accIds].map((id) => {
      const list = s.ftx.filter((t) => t.account === id && String(t.date).startsWith(m));
      const ms = O.monthSummary(list, m);
      return { id, name: accountName(id), kind: s.faccounts.find((a) => a.id === id)?.kind, out: ms.expense, in: ms.income, n: list.length };
    }).filter((a) => a.n).sort((a, b) => b.out - a.out);
    const accIcon = (k) => ({ cartao: '💳', refeicao: '🍽️', poupanca: '🐷', invest: '📈', dinheiro: '💵' }[k] || '🏦');
    const accBar = perAcc.length > 1 || acc ? `<div class="bud-accs" role="tablist" aria-label="Conta">
        <button class="filter ${acc ? '' : 'active'}" data-action="bud-acc" data-id="" role="tab" aria-selected="${!acc}">Todas as contas</button>
        ${perAcc.map((a) => `<button class="filter ${acc === a.id ? 'active' : ''}" data-action="bud-acc" data-id="${esc(a.id)}" role="tab" aria-selected="${acc === a.id}">
          ${accIcon(a.kind)} ${esc(a.name)} <small>${money(a.out)}</small></button>`).join('')}</div>` : '';
    const maxOut = Math.max(1, ...perAcc.map((a) => a.out));
    const accCard = perAcc.length > 1 && !acc ? card('💳 Por conta', `<ul class="bud-acclist">${perAcc.map((a) => `<li>
        <button class="linkish" data-action="bud-acc" data-id="${esc(a.id)}">${accIcon(a.kind)} ${esc(a.name)}</button>
        <span class="js-bar"><span style="width:${Math.round((a.out / maxOut) * 100)}%"></span></span>
        <span class="bud-accv"><b>${money(a.out)}</b>${a.in ? `<small class="muted">entrou ${money(a.in)}</small>` : ''}</span></li>`).join('')}</ul>
      <p class="small muted">Despesas de ${esc(P.monthName(m))} em cada conta. Os pagamentos do cartão e as transferências entre contas não contam (senão contavam duas vezes).</p>`) : '';
    const tiles = `${acc ? `<p class="small bud-accnote">A mostrar só <b>${esc(accountName(acc))}</b>. <button class="linkish" data-action="bud-acc" data-id="">Ver todas as contas</button></p>` : ''}<div class="fin-summary pat-stats">
      <div class="fin-tile"><small>Entrou</small><b>${money(sum.income)}</b>${sum.byCat.entradas && sum.income !== sum.byCat.entradas ? `<small>outras entradas ${money(sum.byCat.entradas)}</small>` : ''}</div>
      ${sum.income ? `<button class="fin-tile bud-extras" data-action="bud-filter" data-id="ordenado"><small>💶 Ordenados</small><b>${money(sum.byCat.ordenado || 0)}</b>
        <small>${sum.byCat.ordenado ? `${Math.round((sum.byCat.ordenado / sum.income) * 100)}% do que entrou` : 'toquem no ordenado → 💶 Ordenado'}</small></button>` : ''}
      ${sum.byCat.extras ? `<button class="fin-tile bud-extras" data-action="bud-filter" data-id="extras"><small>🧰 Trabalhos extra</small><b>${money(sum.byCat.extras)}</b><small>${Math.round((sum.byCat.extras / sum.income) * 100)}% do que entrou</small></button>` : ''}
      <div class="fin-tile"><small>Saiu (despesas)</small><b>${money(sum.expense)}</b></div>
      <div class="fin-tile ${sum.saved >= 0 ? 'ok' : ''}"><small>Sobrou${sum.rate != null ? ` · ${sum.rate}%` : ''}</small><b>${esc(signedMoney(sum.saved))}</b></div>
      ${sum.moved ? `<div class="fin-tile"><small>Para poupança / entre contas</small><b>${money(sum.moved)}</b></div>` : ''}
      ${split.fixed ? `<div class="fin-tile"><small>📌 Despesas fixas · variáveis</small><b>${money(split.fixed)}</b><small>variáveis ${money(split.variable)}</small></div>` : ''}
    </div>`;

    const unsorted = sum.unsorted ? `<section class="card bud-unsorted"><b>🏷️ ${sum.unsorted} movimento${sum.unsorted === 1 ? '' : 's'} por classificar</b>
        <span class="small muted">O portal não reconheceu a loja. Ao classificarem, aprende para a próxima.</span>
        <button class="btn small" data-action="bud-filter" data-id="_unsorted">Classificar</button></section>` : '';

    const budgetRow = (r) => `<li class="bud-row ${r.level || ''}">
        <button class="bud-main" data-action="bud-filter" data-id="${esc(r.cat)}" aria-pressed="${filter === r.cat}">
          <span class="bud-name">${esc(catLabel(r.cat))}</span>
          <span class="bud-vals"><b>${money(r.spent)}</b>${r.limit ? ` <small class="muted">de ${money(r.limit)}</small>` : ''}</span>
        </button>
        ${r.limit ? `<div class="bud-meter" role="progressbar" aria-valuenow="${r.pct}" aria-valuemin="0" aria-valuemax="100" aria-label="${esc(O.CAT[r.cat].name)}: ${r.pct}%"><span style="width:${Math.min(100, r.pct)}%"></span></div>` : ''}
        <small class="bud-note">${r.limit ? `${r.level === 'over' ? '⛔ Passou' : r.level === 'warn' ? '⚠️ Perto do limite' : '✅'} ${r.pct}%${r.level === 'over' ? ` · +${money(r.spent - r.limit)}` : ` · faltam ${money(r.limit - r.spent)}`}` : 'sem orçamento'}
          ${r.avg ? ` · habitual ~${money(r.avg)}${r.avg > 0 && r.spent > r.avg * 1.2 ? ' <b>↑</b>' : ''}` : ''}</small>
      </li>`;
    const budgetCard = card('🎯 Orçamento do mês', rows.length ? `<ul class="bud-list">${rows.map(budgetRow).join('')}</ul>` : empty('Sem despesas neste mês.'),
      { action: '<button class="btn small" data-action="bud-limits">✎ Definir orçamentos</button>' });

    const txRow = (t) => `<li class="tx">
        <button class="tx-main" data-action="bud-tx" data-id="${esc(t.id)}">
          <span class="tx-desc">${Fixas.billFor(t, s.bills) || t.fixed ? '<span title="Despesa fixa">📌 </span>' : ''}${esc(t.desc)}</span>
          <small class="muted">${esc(t.date.slice(8, 10))}/${esc(t.date.slice(5, 7))} · ${esc(accountName(t.account))}${t.debtId ? ` · 🚗 abate: ${esc(S().debts.find((x) => x.id === t.debtId)?.name || 'dívida')}` : ''}${t.jobId ? ` · 🧰 ${esc(jobName(S().jobs.find((x) => x.id === t.jobId)))}` : ''}${t.note ? ` · ${esc(t.note)}` : ''}</small>
        </button>
        <button class="tx-cat ${t.rule === 'none' && !t.manualCat && O.kindOf(t.cat) === 'expense' ? 'unsorted' : ''}" data-action="bud-cat" data-id="${esc(t.id)}" title="Mudar a categoria">${esc(O.CAT[t.cat]?.emoji || '📦')}<span>${esc(O.CAT[t.cat]?.name.split(' (')[0] || t.cat)}</span></button>
        <b class="tx-amt ${t.amount > 0 ? 'in' : ''}">${esc(signedMoney(t.amount))}</b>
      </li>`;
    const filterBar = `<div class="bud-filters">
        <input type="search" id="bud-search" placeholder="Procurar (ex.: Continente)" value="${esc(VS.budSearch || '')}" aria-label="Procurar movimentos">
        ${filter ? `<button class="filter active" data-action="bud-filter" data-id="">${esc(filter === '_unsorted' ? '🏷️ Por classificar' : catLabel(filter))} ✕</button>` : ''}
      </div>`;
    const txCard = card(`📋 Movimentos <small class="muted">(${shown.length})</small>`, `${filterBar}
      ${shown.length ? `<ul class="tx-list">${shown.slice(0, limit).map(txRow).join('')}</ul>
        ${shown.length > limit ? `<button class="btn small ghost" data-action="bud-more">Mostrar mais (${shown.length - limit})</button>` : ''}` : empty('Sem movimentos.')}`);

    const fx = Fixas.summary(s.bills);
    const fixedCard = card('📌 Despesas fixas', fx.count ? `<div class="fix-totals">
        <div><small class="muted">Por mês</small><b>${money(fx.month)}</b></div>
        <div><small class="muted">Por ano</small><b>${money(fx.year)}</b></div>
        ${sum.income ? `<div><small class="muted">Do que entrou este mês</small><b>${Math.round((fx.month / sum.income) * 100)}%</b></div>` : ''}</div>
      ${fx.groups.map((g) => `<h3 class="sub">${esc(g.label)} <small class="muted">· ${money(g.total)}${g.repeat === 'monthly' ? '' : ` (≈ ${money(g.perMonth)}/mês)`}</small></h3>
        <ul class="fix-list">${g.items.map((b) => `<li><button class="linkish" data-action="edit-bill" data-id="${esc(b.id)}">${esc(b.title)}</button>
          <span>${money(b.amount)}${g.repeat === 'monthly' ? '' : ` <small class="muted">≈ ${money(Fixas.perMonth(b))}/mês</small>`}</span></li>`).join('')}</ul>`).join('')}
      <p class="small muted">São as <button class="linkish" data-action="fin-tab" data-id="contas">🏠 Contas da casa</button> que se repetem. Para juntar uma, toquem num movimento e em <b>📌 Despesa fixa</b>.</p>`
      : `<p class="small">Marquem como fixas as despesas que se repetem (seguros, luz, internet, ginásio…): toquem num movimento e em <b>📌 Despesa fixa</b>. Aqui aparece quanto custam por mês e por ano.</p>`);

    return `${nav}${accBar}${tiles}${unsorted}<div class="grid two">${budgetCard}${txCard}</div>${accCard}${fixedCard}
      <p class="small muted">🔒 Só os pais vêem os movimentos. O portal não liga ao banco: os dados vêm dos extratos que importam.</p>`;
  }

  /* ---------- Importar extrato ---------- */
  function importForm() {
    const accs = S().faccounts.filter((a) => !a.archived);
    if (!accs.length) { toast('Primeiro juntem as vossas contas em 📈 Património.'); VS.finTab = 'patrimonio'; render(); return; }
    openForm({
      title: '📥 Importar extrato',
      fields: [
        { name: 'account', label: 'De que conta é o extrato?', type: 'select', options: accs.map((a) => [a.id, `${a.name}${a.bank ? ` · ${a.bank}` : ''}`]) },
        { name: 'filebox', type: 'note', html: `<label class="field"><span>Ficheiro do banco (Excel .xls/.xlsx, CSV ou PDF)</span>
          <input type="file" name="file" accept=".csv,.txt,.xlsx,.xls,.htm,.html,.pdf,application/pdf,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" required></label>
          <p class="small muted">No homebanking: movimentos da conta → Exportar / Descarregar (Excel, CSV ou o extrato em PDF). Os movimentos que já tiverem importado não se repetem.</p>` },
      ],
      values: { account: VS.budAccount || accs[0].id },
      submitLabel: 'Ler o ficheiro',
      onSubmit: (d) => {
        const file = document.querySelector('#dialog [name=file]')?.files?.[0];
        if (!file) { toast('Escolham o ficheiro do extrato.'); return; }
        VS.budAccount = d.account;
        setTimeout(() => readFile(file, d.account), 0);
      },
    });
  }

  async function readFile(file, account, chosen = false) {
    let rows;
    try {
      rows = await Folhas.readTable(await file.arrayBuffer());
    } catch (e) {
      toast(e.message || 'Não consegui ler este ficheiro.');
      return;
    }
    const header = O.findHeader(rows);
    if (!header) {
      toast('Não encontrei as colunas de data, descrição e valor neste ficheiro. Experimentem exportar em CSV.');
      return;
    }
    const mv = O.toMovements(rows, header);
    if (!mv.length) { toast('O ficheiro não tem movimentos.'); return; }
    const rules = S().frules;
    // Extrato do cartão de crédito escolhido na conta errada (ou ao contrário): sugere a conta certa.
    const accs = S().faccounts.filter((a) => !a.archived);
    const isCard = O.looksLikeCard(rows, mv);
    const kindOfAcc = (id) => accs.find((a) => a.id === id)?.kind;
    let note = '';
    if (chosen) note = '';
    else if (isCard && kindOfAcc(account) !== 'cartao') {
      // Com vários cartões (ex.: Santander e Wizink), escolhe o do mesmo banco da conta escolhida; senão, só se houver um.
      const cards = accs.filter((a) => a.kind === 'cartao');
      const bankOf = (a) => Orcamento.norm(a?.bank || a?.name || '').split(' ')[0];
      const sel = accs.find((a) => a.id === account);
      // 1.º o banco que vem no próprio extrato (ex.: "Wizink"); 2.º o banco da conta escolhida; 3.º o único cartão.
      const topTxt = ` ${Orcamento.norm(rows.slice(0, 15).map((r) => r.join(' ')).join(' '))} `;
      const card = cards.find((a) => a.bank && topTxt.includes(` ${Orcamento.norm(a.bank)}`))
        || (cards.length === 1 ? cards[0] : cards.find((a) => bankOf(a) && bankOf(a) === bankOf(sel)));
      if (card) { account = card.id; note = `💳 Este é o extrato do <b>cartão de crédito</b>: vai para «${esc(card.name)}${card.bank ? ` · ${esc(card.bank)}` : ''}». Se não for este cartão, mudem a conta abaixo.`; }
      else if (cards.length > 1) note = '💳 Este é o extrato de um <b>cartão de crédito</b>: escolham abaixo qual dos cartões.';
      else note = '💳 Parece o extrato de um <b>cartão de crédito</b>. Juntem o cartão em 📈 Património (tipo «Cartão de crédito») para ficar separado da conta à ordem.';
    } else if (!isCard && kindOfAcc(account) === 'cartao') {
      note = '⚠️ Escolheram um cartão de crédito, mas este extrato parece ser de uma conta à ordem. Confirmem a conta abaixo.';
    }
    const { fresh, dup } = O.prepareImport(S().ftx, mv, account, rules, { card: kindOfAcc(account) === 'cartao', meal: kindOfAcc(account) === 'refeicao' });
    const cardPays = fresh.filter((t) => t.cat === 'transferencias').length;
    const dates = mv.map((x) => x.date).sort();
    const counts = {};
    fresh.forEach((t) => { counts[t.cat] = (counts[t.cat] || 0) + 1; });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const unsorted = fresh.filter((t) => t.rule === 'none' && O.kindOf(t.cat) === 'expense').length;
    const fmt = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
    openForm({
      title: `📥 ${accountName(account)}`,
      fields: [{ name: 'info', type: 'note', html: `${note ? `<p class="small bud-note">${note}</p>` : ''}<p><b>${mv.length} movimentos</b> de ${esc(fmt(dates[0]))} a ${esc(fmt(dates.at(-1)))}.</p>
        ${dup ? `<p class="small">🔁 ${dup} já estavam importados — não se repetem.</p>` : ''}
        ${cardPays ? `<p class="small">🔁 ${cardPays} pagamento${cardPays === 1 ? '' : 's'} do cartão de crédito: contam como transferência entre as vossas contas (não são despesa nem entrada).</p>` : ''}
        ${fresh.length ? `<p>Entram <b>${fresh.length}</b>:</p><ul class="small bud-preview">${top.map(([c, n]) => `<li>${esc(catLabel(c))} · ${n}</li>`).join('')}</ul>
          ${unsorted ? `<p class="small muted">🏷️ ${unsorted} ficam por classificar (lojas que o portal ainda não conhece).</p>` : ''}
          <div class="table-wrap"><table class="bud-sample"><tbody>${fresh.slice(0, 6).map((t) => `<tr><td>${esc(fmt(t.date).slice(0, 5))}</td><td>${esc(t.desc)}</td><td class="num">${esc(signedMoney(t.amount))}</td></tr>`).join('')}</tbody></table></div>`
          : '<p>Não há movimentos novos.</p>'}` },
      { name: 'account', label: 'Conta', type: 'select', options: accs.map((a) => [a.id, `${a.kind === 'cartao' ? '💳 ' : ''}${a.name}${a.bank ? ` · ${a.bank}` : ''}`]) }],
      values: { account },
      submitLabel: fresh.length ? `Importar ${fresh.length}` : 'Fechar',
      onSubmit: (d) => {
        if (d.account && d.account !== account) { VS.budAccount = d.account; setTimeout(() => readFile(file, d.account, true), 0); return; }
        if (!fresh.length) return;
        let paidFixed = [];
        let debtLinked = 0;
        Store.update((s) => {
          s.ftx.push(...fresh);
          // Transferências entre as vossas contas (o mesmo valor a sair de uma e a entrar noutra).
          const ids = new Set(O.findTransfers(s.ftx.filter((t) => t.rule !== 'family')));
          s.ftx.forEach((t) => { if (ids.has(t.id) && !t.manualCat) { t.cat = 'transferencias'; t.rule = 'transfer'; } });
          // Pagamentos que abatem numa dívida de família (regras criadas em "🚗 Abater numa dívida").
          debtLinked = autoLinkDebts(s, fresh);
          // Despesas fixas pagas neste extrato: risca-as nas Contas da casa (e actualiza o valor, se mudou).
          paidFixed = Fixas.autoPay(s.bills, fresh);
          paidFixed.forEach((p) => {
            const b = s.bills.find((x) => x.id === p.billId);
            if (!b) return;
            p.old = b.amount;
            b.history = [...(b.history || []), { date: p.date, amount: p.amount, forDue: p.forDue, tx: p.txId }].slice(-24);
            b.due = p.nextDue;
            if (p.changed) b.amount = p.amount;
          });
        });
        // Abre o mês mais recente do extrato.
        VS.budMonth = dates.at(-1).slice(0, 7) > P.monthOf(today()) ? P.monthOf(today()) : dates.at(-1).slice(0, 7);
        VS.budFilter = '';
        render();
        const names = paidFixed.map((p) => {
          const b = S().bills.find((x) => x.id === p.billId);
          return `${b?.title || ''}${p.changed ? ` (agora ${money(p.amount)}, antes ${money(p.old)})` : ''}`;
        });
        toast(`📥 ${fresh.length} movimentos importados.${unsorted ? ` ${unsorted} por classificar.` : ''}${names.length ? ` 📌 Pagas: ${names.join(', ')}.` : ''}${debtLinked ? ` 🚗 ${debtLinked} abatido${debtLinked === 1 ? '' : 's'} na dívida.` : ''}`);
      },
    });
  }

  /* ---------- Classificar ---------- */
  function catForm(id) {
    const t = S().ftx.find((x) => x.id === id);
    if (!t) return;
    const key = O.merchantKey(t.desc);
    const same = key ? S().ftx.filter((x) => x.id !== t.id && !x.manualCat && O.matchesRule(x.desc, key)).length : 0;
    // Regra de entrada (ex.: Trabalhos extra): não muda os pagamentos à mesma pessoa.
    const fits = (x, cat) => !(O.kindOf(cat) === 'income' && x.amount < 0);
    openForm({
      title: '🏷️ Categoria',
      fields: [
        { name: 'info', type: 'note', html: `<p><b>${esc(t.desc)}</b><br><span class="muted small">${esc(t.date)} · ${esc(signedMoney(t.amount))}</span></p>` },
        { name: 'cat', label: 'Categoria', type: 'select', options: catOptions() },
        ...(key ? [{ name: 'always', label: `Fazer sempre assim para «${key}»?`, type: 'select', options: [['1', `Sim${same ? ` (e mudar os outros ${same})` : ''}`], ['', 'Não, só este']] }] : []),
      ],
      values: { cat: t.cat, always: '1' },
      submitLabel: 'Guardar',
      onSubmit: (d) => {
        Store.update((s) => {
          const x = s.ftx.find((y) => y.id === id);
          if (x) { x.cat = d.cat; x.manualCat = true; }
          if (key && d.always) {
            const rid = `r-${O.hash(key)}`;
            const r = s.frules.find((y) => y.id === rid);
            if (r) r.cat = d.cat; else s.frules.push({ id: rid, match: key, cat: d.cat });
            s.ftx.forEach((y) => { if (!y.manualCat && O.matchesRule(y.desc, key) && fits(y, d.cat)) { y.cat = d.cat; y.rule = 'family'; } });
          }
        });
        toast(`🏷️ ${catLabel(d.cat)}${key && d.always ? ` · regra para «${key}» guardada` : ''}`);
      },
    });
  }

  function txForm(id) {
    const t = id ? S().ftx.find((x) => x.id === id) : null;
    const accs = S().faccounts.filter((a) => !a.archived || a.id === t?.account);
    openForm({
      title: t ? '✎ Movimento' : '＋ Movimento',
      fields: [
        { name: 'date', label: 'Data', type: 'date', required: true, half: true },
        { name: 'kind', label: 'Tipo', type: 'select', half: true, options: [['out', 'Despesa'], ['in', 'Entrada']] },
        { name: 'desc', label: 'Descrição', required: true, placeholder: 'Ex.: Feira, explicações, mercado' },
        { name: 'amount', label: 'Valor (€)', inputmode: 'decimal', required: true, half: true, placeholder: '0,00' },
        { name: 'account', label: 'Conta', type: 'select', half: true, options: [['cash', '💵 Dinheiro'], ...accs.map((a) => [a.id, a.name])] },
        { name: 'cat', label: 'Categoria', type: 'select', options: catOptions() },
        { name: 'note', label: 'Nota', placeholder: 'Opcional' },
      ],
      values: t ? { ...t, kind: t.amount > 0 ? 'in' : 'out', amount: String(Math.abs(t.amount)).replace('.', ',') }
        : { date: today(), kind: 'out', account: 'cash', cat: 'outros' },
      submitLabel: 'Guardar',
      extra: t && t.amount < 0 ? [Fixas.billFor(t, S().bills)
        ? { label: `📌 Fixa: ${Fixas.billFor(t, S().bills).title}`, onClick: () => { const id = Fixas.billFor(t, S().bills).id; setTimeout(() => editBill(id), 0); } }
        : { label: '📌 Despesa fixa', onClick: () => { setTimeout(() => fixedForm(t), 0); } },
      ...(t.debtId ? [{ label: `🚗 Abate: ${S().debts.find((x) => x.id === t.debtId)?.name || 'dívida'}`, onClick: () => { setTimeout(() => debtLinkForm(t), 0); } }]
        : familyDebts().length ? [{ label: '🚗 Abater numa dívida', onClick: () => { setTimeout(() => debtLinkForm(t), 0); } }] : [])]
        : t && t.amount > 0 ? [{ label: t.jobId ? `🧰 ${jobName(S().jobs.find((x) => x.id === t.jobId))}` : '🧰 Trabalho extra', onClick: () => { setTimeout(() => jobLinkForm(t), 0); } }] : [],
      onDelete: t ? () => Store.update((s) => {
        s.ftx = s.ftx.filter((x) => x.id !== t.id);
        // O trabalho pago por esta entrada fica pago, só perde a ligação ao extrato.
        s.jobs.forEach((j) => { if (j.tx === t.id) { delete j.tx; delete j.fromTx; } });
      }) : null,
      deleteConfirm: 'Apagar este movimento? (Se voltarem a importar o extrato, ele volta.)',
      deleteToast: 'Movimento apagado.',
      onSubmit: (d) => {
        const v = P.parseAmount(d.amount);
        if (v == null || v === 0) { toast('Valor inválido.'); return; }
        const amount = d.kind === 'in' ? Math.abs(v) : -Math.abs(v);
        Store.update((s) => {
          const x = t && s.ftx.find((y) => y.id === t.id);
          const data = { date: d.date, desc: d.desc.trim(), amount, account: d.account, cat: d.cat, note: d.note.trim(), manualCat: true };
          if (x) Object.assign(x, data); else s.ftx.push({ id: `tx-m-${Store.uid()}`, src: 'manual', rule: 'family', ...data });
        });
      },
    });
  }

  /* ---------- Movimento que abate numa dívida de família (ex.: pagar o lar da mãe abate o empréstimo do carro) ---------- */
  const familyDebts = () => S().debts.filter((d) => !d.archived && d.kind === 'familiar');

  function debtLinkForm(t) {
    const debt = t.debtId && S().debts.find((x) => x.id === t.debtId);
    const key = O.merchantKey(t.desc) || O.norm(t.desc).split(' ').slice(0, 3).join(' ');
    const rule = S().frules.find((r) => r.debtId && O.matchesRule(t.desc, r.match));
    if (debt) {
      openForm({
        title: `🚗 ${debt.name}`,
        fields: [{ name: 'info', type: 'note', html: `<p><b>${esc(t.desc)}</b> (${esc(signedMoney(t.amount))}, ${esc(t.date)}) conta como pagamento de <b>${esc(debt.name)}</b>.</p>
          ${rule ? `<p class="small muted">Regra: os movimentos «${esc(rule.match)}» abatem sozinhos nesta dívida.</p>` : ''}` }],
        submitLabel: 'Fechar',
        onSubmit: () => {},
        extra: [{ label: 'Deixar de abater', onClick: () => { Store.update((s) => unlinkTx(s, t.id)); toast('Já não abate na dívida.'); } },
          ...(rule ? [{ label: 'Apagar a regra automática', onClick: () => { Store.update((s) => { s.frules = s.frules.filter((r) => r.id !== rule.id); }); toast('Regra apagada (os pagamentos já registados ficam).'); } }] : [])],
      });
      return;
    }
    const debts = familyDebts();
    const same = key ? S().ftx.filter((x) => x.id !== t.id && x.amount < 0 && !x.debtId && O.matchesRule(x.desc, key)).length : 0;
    openForm({
      title: '🚗 Abater numa dívida',
      fields: [
        { name: 'info', type: 'note', html: `<p><b>${esc(t.desc)}</b><br><span class="small muted">${esc(t.date)} · ${esc(signedMoney(t.amount))}</span></p>
          <p class="small">Fica registado como pagamento na dívida (com esta data, valor e descrição) e passa para a categoria 🏦 Créditos.</p>` },
        { name: 'debt', label: 'Dívida', type: 'select', options: debts.map((d) => [d.id, `${d.name}${d.lender ? ` · ${d.lender}` : ''}`]) },
        { name: 'note', label: 'Nota do pagamento', placeholder: t.desc },
        ...(key ? [{ name: 'always', label: `Os próximos «${key}» também abatem sozinhos?`, type: 'select',
          options: [['', 'Não, só este'], ['1', `Sim, sempre${same === 1 ? ' (e o outro já importado)' : same ? ` (e os outros ${same} já importados)` : ''}`]] }] : []),
      ],
      values: { debt: debts[0]?.id, note: '', always: '' },
      submitLabel: '🚗 Abater',
      onSubmit: (d) => {
        const debtName = S().debts.find((x) => x.id === d.debt)?.name || '';
        let n = 0;
        Store.update((s) => {
          n += linkTx(s, t.id, d.debt, d.note.trim()) ? 1 : 0;
          if (key && d.always) {
            const rid = `r-debt-${O.hash(key)}`;
            const r = s.frules.find((y) => y.id === rid);
            if (r) Object.assign(r, { match: key, cat: 'credito', debtId: d.debt }); else s.frules.push({ id: rid, match: key, cat: 'credito', debtId: d.debt });
            s.ftx.filter((x) => x.amount < 0 && !x.debtId && O.matchesRule(x.desc, key)).forEach((x) => { if (linkTx(s, x.id, d.debt)) n++; });
          }
        });
        const st = P.debtStatus(S().debts.find((x) => x.id === d.debt), [], today());
        toast(`🚗 ${n === 1 ? `${money(Math.abs(t.amount))} abatido` : `${n} pagamentos abatidos`} em ${debtName} · falta ${money(st.balance)}`);
      },
    });
  }

  /** Liga um movimento a uma dívida (cria o pagamento uma só vez). Devolve true se ligou. */
  function linkTx(s, txId, debtId, note = '') {
    const x = s.ftx.find((y) => y.id === txId);
    const debt = s.debts.find((y) => y.id === debtId);
    if (!x || !debt || x.amount >= 0 || x.debtId) return false;
    const pays = debt.payments || [];
    const amt = Math.abs(x.amount);
    // Já registado à mão (ex.: copiado de outro programa)? Mesmo valor até 12 dias de diferença: junta, não repete.
    const twin = pays.find((p) => !p.tx && Math.abs(Number(p.amount) - amt) < 0.005 && Math.abs(Date.parse(p.date) - Date.parse(x.date)) <= 12 * 86400000);
    if (twin) twin.tx = x.id;
    else if (!pays.some((p) => p.tx === x.id)) debt.payments = [...pays, { id: `pay-${x.id}`, date: x.date, amount: amt, note: note || x.desc, tx: x.id }];
    Object.assign(x, { debtId, cat: 'credito', manualCat: true });
    return true;
  }
  function unlinkTx(s, txId) {
    const x = s.ftx.find((y) => y.id === txId);
    if (!x?.debtId) return;
    const debt = s.debts.find((y) => y.id === x.debtId);
    if (debt) {
      debt.payments = (debt.payments || []).flatMap((p) => {
        if (p.tx !== x.id) return [p];
        if (String(p.id).startsWith('pay-')) return []; // criado a partir do movimento: sai
        const { tx, ...manual } = p; // registado à mão: fica, sem a ligação
        return [manual];
      });
    }
    delete x.debtId;
    Object.assign(x, { cat: O.categorize(x.desc, x.amount, s.frules.filter((r) => !r.debtId)).cat, manualCat: false });
  }
  /** Depois de importar: os movimentos com uma regra de dívida abatem sozinhos. Devolve quantos. */
  function autoLinkDebts(s, fresh) {
    const rules = s.frules.filter((r) => r.debtId && s.debts.some((d) => d.id === r.debtId && !d.archived));
    let n = 0;
    fresh.forEach((t) => {
      const r = t.amount < 0 && rules.find((y) => O.matchesRule(t.desc, y.match));
      if (r && linkTx(s, t.id, r.debtId)) n++;
    });
    return n;
  }
  Views.unlinkDebtTx = unlinkTx;

  /* ---------- Entrada de um trabalho extra (formação, projeto…): separada do ordenado e ligada ao trabalho ---------- */
  const jobName = (j) => (j ? j.title || Trabalhos.KIND[j.kind]?.replace(/^\S+ /, '') || 'trabalho' : 'trabalho');
  const jobsCfg = () => (S().savings || []).find((x) => x.id === 'trabalhos-cfg') || {};
  /** "Trf. MB WAY de Andreia Filipa Nunes" → "Andreia Filipa Nunes" (para sugerir o cliente). */
  const payerOf = (desc) => {
    const m = String(desc).match(/\b(?:de|from)\s+(.+)$/i);
    return (m ? m[1] : '').replace(/\s+/g, ' ').trim().replace(/\b(\p{L})(\p{L}*)/gu, (_, a, b) => a.toUpperCase() + b.toLowerCase()).slice(0, 60);
  };

  function jobLinkForm(t) {
    const linked = t.jobId && S().jobs.find((x) => x.id === t.jobId);
    if (linked) {
      const a = Trabalhos.amounts(linked);
      openForm({
        title: `🧰 ${jobName(linked)}`,
        fields: [{ name: 'info', type: 'note', html: `<p><b>${esc(t.desc)}</b> (${esc(signedMoney(t.amount))}, ${esc(t.date)}) é o pagamento de
          <b>${esc(jobName(linked))}</b>${linked.client ? ` · ${esc(linked.client)}` : ''} (${money(a.base)} sem IVA).</p>
          <p class="small muted">Conta como ganho de ${esc(String(linked.paidDate || t.date).slice(0, 4))} em 💶 Finanças → 🧰 Trabalhos extra.</p>` }],
        submitLabel: 'Fechar',
        onSubmit: () => {},
        extra: [{ label: 'Desligar do trabalho', onClick: () => { Store.update((s) => unlinkJob(s, t.id)); toast('Já não está ligado ao trabalho (continua em Trabalhos extra).'); } }],
      });
      return;
    }
    const amt = t.amount;
    // Trabalhos à espera de pagamento; os de valor igual ao que entrou primeiro.
    const open = S().jobs.filter((j) => ['faturado', 'adjudicado', 'orcamento'].includes(j.status))
      .map((j) => ({ j, diff: Math.abs(Trabalhos.amounts(j).received - amt) }))
      .sort((x, y) => (x.diff < 0.01 ? 0 : 1) - (y.diff < 0.01 ? 0 : 1) || ({ faturado: 0, adjudicado: 1, orcamento: 2 }[x.j.status] - { faturado: 0, adjudicado: 1, orcamento: 2 }[y.j.status]));
    const key = O.merchantKey(t.desc);
    const same = key ? S().ftx.filter((x) => x.id !== t.id && x.amount > 0 && !x.manualCat && O.matchesRule(x.desc, key)).length : 0;
    const c = jobsCfg();
    openForm({
      title: '🧰 Trabalho extra',
      fields: [
        { name: 'info', type: 'note', html: `<p><b>${esc(t.desc)}</b><br><span class="small muted">${esc(t.date)} · ${esc(signedMoney(amt))}</span></p>
          <p class="small">Passa para a categoria 🧰 <b>Trabalhos extra</b> (fica separado do ordenado) e o trabalho fica <b>pago</b> com esta data e valor.</p>` },
        { name: 'job', label: 'Que trabalho é?', type: 'select', options: [
          ...open.map(({ j, diff }) => [j.id, `${diff < 0.01 ? '✔ ' : ''}${Trabalhos.KIND[j.kind]?.split(' ')[0] || '🧰'} ${jobName(j)}${j.client ? ` · ${j.client}` : ''} · ${money(Trabalhos.amounts(j).received)} (${Trabalhos.STATUS_LABEL[j.status].replace(/^\S+ /, '').toLowerCase()})`]),
          ['_new', '＋ Registar um trabalho novo'], ['_none', 'Só mudar a categoria (sem trabalho)']] },
        { name: 'newinfo', type: 'note', html: '<p class="small muted" data-newjob>Trabalho novo:</p>' },
        { name: 'kind', label: 'Tipo', type: 'select', half: true, options: Trabalhos.KINDS },
        { name: 'client', label: 'Cliente / entidade', half: true, suggest: [...new Set(S().jobs.map((x) => x.client).filter(Boolean))] },
        { name: 'title', label: 'Descrição', placeholder: 'Ex.: Formação RTIEBT, ARDA moradia' },
        ...(key ? [{ name: 'always', label: `As próximas entradas de «${key}» também são trabalhos extra?`, type: 'select',
          options: [['', 'Não, só esta'], ['1', `Sim, sempre${same === 1 ? ' (e a outra já importada)' : same ? ` (e as outras ${same} já importadas)` : ''}`]] }] : []),
      ],
      values: { job: open.length && open[0].diff < 0.01 ? open[0].j.id : '_new', kind: 'formacao', client: payerOf(t.desc), title: '', always: '' },
      submitLabel: '🧰 Guardar',
      onSubmit: (d) => {
        let name = '';
        Store.update((s) => {
          const x = s.ftx.find((y) => y.id === t.id);
          if (!x) return;
          Object.assign(x, { cat: 'extras', manualCat: true });
          let j = null;
          if (d.job === '_new') {
            // O que entrou já vem com IVA e sem a retenção: o valor do trabalho (sem IVA) sai das percentagens do ⚙️.
            const vat = Number(c.vat) || 0;
            const withholding = Number(c.withholding) || 0;
            const base = Math.round((amt / (1 + (vat - withholding) / 100)) * 100) / 100;
            j = { id: Store.uid(), kind: d.kind, status: 'pago', title: d.title.trim(), client: d.client.trim(), value: base, hours: 0,
              quoteDate: '', workDate: t.date, paidDate: t.date, paidValue: amt, vat, withholding, notes: '', tx: t.id, fromTx: true };
            s.jobs.push(j);
          } else if (d.job !== '_none') {
            j = s.jobs.find((y) => y.id === d.job);
            if (j) Object.assign(j, { status: 'pago', paidDate: t.date, paidValue: Math.abs(Trabalhos.amounts(j).received - amt) < 0.01 ? '' : amt, tx: t.id });
          }
          if (j) { x.jobId = j.id; name = jobName(j); }
          if (key && d.always) {
            const rid = `r-${O.hash(key)}`;
            const r = s.frules.find((y) => y.id === rid);
            if (r) r.cat = 'extras'; else s.frules.push({ id: rid, match: key, cat: 'extras' });
            s.ftx.forEach((y) => { if (y.amount > 0 && !y.manualCat && O.matchesRule(y.desc, key)) { y.cat = 'extras'; y.rule = 'family'; } });
          }
        });
        toast(`🧰 ${money(amt)} em Trabalhos extra${name ? ` · ${name} pago` : ''}${key && d.always ? ` · regra para «${key}» guardada` : ''}`);
      },
    });
    // Os campos do trabalho novo só aparecem quando se escolhe "＋ Registar um trabalho novo".
    const dlg = document.getElementById('dialog');
    const pickJob = dlg?.querySelector('[name=job]');
    const toggle = () => {
      const isNew = pickJob.value === '_new';
      [dlg.querySelector('[data-newjob]')?.closest('.field'), ...['kind', 'client', 'title'].map((n) => dlg.querySelector(`[name=${n}]`)?.closest('.field'))]
        .forEach((el) => { if (el) el.hidden = !isNew; });
    };
    if (pickJob) { pickJob.addEventListener('change', toggle); toggle(); }
  }
  /** Desliga a entrada do trabalho: o trabalho criado a partir dela sai; um que já existia volta a "faturado". */
  function unlinkJob(s, txId) {
    const x = s.ftx.find((y) => y.id === txId);
    if (!x?.jobId) return;
    const j = s.jobs.find((y) => y.id === x.jobId);
    if (j && j.tx === x.id) {
      if (j.fromTx) s.jobs = s.jobs.filter((y) => y.id !== j.id);
      else { Object.assign(j, { status: 'faturado', paidDate: '', paidValue: '' }); delete j.tx; }
    }
    delete x.jobId;
  }
  Views.unlinkJobTx = unlinkJob;

  /** Criar uma despesa fixa (conta da casa) a partir de um movimento. */
  function fixedForm(t) {
    const key = O.merchantKey(t.desc) || O.norm(t.desc).split(' ').slice(0, 2).join(' ');
    const name = key ? key.replace(/\b\w/g, (c) => c.toUpperCase()) : t.desc;
    openForm({
      title: '📌 Despesa fixa',
      fields: [
        { name: 'info', type: 'note', html: `<p class="small">A partir de <b>${esc(t.desc)}</b> (${esc(signedMoney(t.amount))}, ${esc(t.date)}). Fica nas <b>🏠 Contas da casa</b>, com aviso 3 dias antes; quando o pagamento aparecer num extrato, fica paga sozinha.</p>` },
        { name: 'title', label: 'Nome', required: true },
        { name: 'amount', label: 'Valor (€)', inputmode: 'decimal', required: true, half: true },
        { name: 'repeat', label: 'Repete-se', type: 'select', half: true, options: [['monthly', 'Todos os meses'], ['bimonthly', 'De 2 em 2 meses'], ['quarterly', 'Trimestral'], ['semiannual', 'Semestral'], ['yearly', 'Anual']] },
        { name: 'category', label: 'Categoria', type: 'select', half: true, options: ['Casa', 'Carro', 'Seguros', 'Escola', 'Saúde', 'Impostos', 'Subscrições', 'Outro'].map((c) => [c, c]) },
        { name: 'match', label: 'Como aparece no extrato', half: true },
      ],
      values: { title: name, amount: String(Math.abs(t.amount)).replace('.', ','), repeat: t.cat === 'seguros' ? 'yearly' : 'monthly', category: Fixas.BUDGET_TO_BILL[t.cat] || 'Outro', match: key },
      submitLabel: '📌 Guardar',
      onSubmit: (d) => {
        const amount = P.parseAmount(d.amount);
        if (!amount) { toast('Valor inválido.'); return; }
        const due = Fixas.addMonths(t.date, Fixas.PERIODS[d.repeat]);
        Store.update((s) => {
          s.bills.push({ id: Store.uid(), title: d.title.trim(), amount: Math.abs(amount), due, repeat: d.repeat, category: d.category, auto: 'sim',
            match: O.norm(d.match), notes: '', history: [{ date: t.date, amount: Math.abs(amount), forDue: t.date, tx: t.id }] });
        });
        toast(`📌 ${d.title.trim()} é agora uma despesa fixa (${Fixas.LABEL[d.repeat]}). Próxima: ${due.slice(8, 10)}/${due.slice(5, 7)}.`);
      },
    });
  }
  const editBill = (id) => { const b = document.createElement('button'); b.dataset.action = 'edit-bill'; b.dataset.id = id; b.hidden = true; document.body.append(b); b.click(); b.remove(); };

  function limitsForm() {
    const s = S();
    const m = month();
    const rows = O.budgetRows(s.ftx, s.fbudgets, m);
    const avg = Object.fromEntries(rows.map((r) => [r.cat, r.avg]));
    const cur = Object.fromEntries(s.fbudgets.map((b) => [b.id, b.limit]));
    const cats = O.CATS.filter((c) => c[3] === 'expense');
    openForm({
      title: '🎯 Orçamento por mês',
      fields: [
        { name: 'info', type: 'note', html: '<p class="small">Quanto querem gastar, no máximo, por mês em cada categoria. Deixem vazio para não ter limite. Avisamos aos 80 % e aos 100 %.</p>' },
        ...cats.map(([id, e, n]) => ({ name: `b_${id}`, label: `${e} ${n}`, inputmode: 'decimal', half: true,
          placeholder: avg[id] ? `habitual ~${Math.round(avg[id])}` : '—' })),
      ],
      values: Object.fromEntries(cats.map(([id]) => [`b_${id}`, cur[id] ? String(cur[id]).replace('.', ',') : ''])),
      submitLabel: 'Guardar',
      onSubmit: (d) => {
        Store.update((st) => {
          cats.forEach(([id]) => {
            const v = P.parseAmount(d[`b_${id}`]);
            const i = st.fbudgets.findIndex((b) => b.id === id);
            if (v && v > 0) { if (i >= 0) st.fbudgets[i].limit = v; else st.fbudgets.push({ id, limit: v }); } else if (i >= 0) st.fbudgets.splice(i, 1);
          });
        });
        toast('🎯 Orçamento guardado.');
      },
    });
  }

  /* ---------- Ligações ---------- */
  document.addEventListener('input', (e) => {
    if (e.target.id !== 'bud-search') return;
    VS.budSearch = e.target.value;
    const pos = e.target.selectionStart;
    clearTimeout(e.target._t);
    e.target._t = setTimeout(() => {
      render();
      const el = document.getElementById('bud-search');
      if (el) { el.focus(); el.setSelectionRange(pos, pos); }
    }, 250);
  });

  const actions = {
    'bud-month': (el) => {
      const next = P.addMonths(month(), Number(el.dataset.id));
      if (next > P.monthOf(today())) return;
      VS.budMonth = next;
      VS.budShow = PAGE;
      render();
    },
    'bud-acc': (el) => { VS.budAcc = el.dataset.id || ''; VS.budShow = PAGE; render(); },
    'bud-filter': (el) => { VS.budFilter = VS.budFilter === el.dataset.id ? '' : el.dataset.id; VS.budShow = PAGE; render(); },
    'bud-more': () => { VS.budShow = (VS.budShow || PAGE) + PAGE; render(); },
    'bud-import': importForm,
    'bud-add': () => txForm(null),
    'bud-tx': (el) => txForm(el.dataset.id),
    'bud-cat': (el) => catForm(el.dataset.id),
    'bud-limits': limitsForm,
  };

  Views.orcamentoView = view;
  return { actions };
};
