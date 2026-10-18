/*
 * Finanças → 🧰 Trabalhos extra: orçamentos, trabalhos e formações por conta própria e quanto se ganhou no ano.
 * Só para os pais (o servidor nem envia estes dados às filhas). Cálculos em js/trabalhos.js.
 */
window.FinancasTrabalhos = function ({ render }) {
  const { esc, money, today } = U;
  const { openForm, toast } = UI;
  const { card, empty } = Views.h;
  const T = Trabalhos;
  const S = () => Store.state;
  const VS = Views.VS;
  const CFG_ID = 'trabalhos-cfg';
  const cfg = () => (S().savings || []).find((x) => x.id === CFG_ID) || { vat: 0, withholding: 0 };
  const dmy = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');
  const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const kindLabel = (k) => T.KIND[k] || T.KIND.outro;
  const job = (id) => S().jobs.find((j) => j.id === id);

  /* ---------- Vista ---------- */
  function row(j, actions = '') {
    const a = T.amounts(j);
    const when = j.status === 'pago' ? `pago a ${dmy(j.paidDate)}` : j.status === 'orcamento' ? `orçamento de ${dmy(j.quoteDate)}`
      : j.workDate ? dmy(j.workDate) : j.quoteDate ? `orçamento de ${dmy(j.quoteDate)}` : '';
    return `<li class="job">
      <button class="job-main" data-action="job-edit" data-id="${esc(j.id)}">
        <span class="job-title">${esc(kindLabel(j.kind).split(' ')[0])} <b>${esc(j.title || kindLabel(j.kind).replace(/^\S+ /, ''))}</b></span>
        <small class="muted">${esc([j.client, when, j.kind === 'formacao' && j.hours ? `${j.hours} h` : ''].filter(Boolean).join(' · '))}</small></button>
      <span class="job-val"><b>${money(a.base)}</b>${a.vat || a.withheld ? `<small class="muted">${[a.vat ? `+IVA ${money(a.vat)}` : '', a.withheld ? `ret. ${money(a.withheld)}` : ''].filter(Boolean).join(' · ')}</small>` : ''}</span>
      <span class="job-acts">${actions}<span class="job-tools">
        <button class="btn small ghost" data-action="job-edit" data-id="${esc(j.id)}" aria-label="Editar">✎ Editar</button>
        <button class="btn small ghost danger-text" data-action="job-del" data-id="${esc(j.id)}" aria-label="Apagar">🗑️ Apagar</button></span></span>
    </li>`;
  }
  const btn = (action, id, label, cls = '') => `<button class="btn small ${cls}" data-action="${action}" data-id="${esc(id)}">${label}</button>`;

  function view() {
    const s = S();
    const t = today();
    const years = T.years(s.jobs, t);
    const year = VS.jobYear && years.includes(VS.jobYear) ? VS.jobYear : years[0];
    const sum = T.yearSummary(s.jobs, year);
    const prevSum = T.yearSummary(s.jobs, Number(year) - 1);
    const i = years.indexOf(year);
    const nav = `<div class="job-year">
      <button class="btn small" data-action="job-year" data-id="${years[i + 1] || ''}" ${years[i + 1] ? '' : 'disabled'} aria-label="Ano anterior">‹</button>
      <b>${esc(year)}</b>
      <button class="btn small" data-action="job-year" data-id="${years[i - 1] || ''}" ${years[i - 1] ? '' : 'disabled'} aria-label="Ano seguinte">›</button></div>`;
    const head = `<div class="job-head">${nav}<div class="quick">
      <button class="btn small primary" data-action="job-add" data-id="orcamento">＋ Orçamento</button>
      <button class="btn small" data-action="job-add" data-id="adjudicado">＋ Trabalho / formação</button>
      <button class="btn small ghost" data-action="job-cfg" title="IVA e retenção na fonte">⚙️</button></div></div>`;

    const vsPrev = prevSum.earned ? Math.round(((sum.earned - prevSum.earned) / prevSum.earned) * 100) : null;
    const tiles = `<div class="fin-summary job-tiles">
      <div class="fin-tile ok"><small>💶 Ganho em ${esc(year)}</small><b>${money(sum.earned)}</b>
        <small>${sum.paidCount} trabalho${sum.paidCount === 1 ? '' : 's'} pago${sum.paidCount === 1 ? '' : 's'}${vsPrev != null ? ` · ${vsPrev >= 0 ? '+' : ''}${vsPrev}% vs. ${Number(year) - 1}` : ''}</small></div>
      <div class="fin-tile"><small>⏳ Por receber</small><b>${money(sum.pending)}</b><small>${sum.pendingCount} adjudicado${sum.pendingCount === 1 ? '' : 's'} / faturado${sum.pendingCount === 1 ? '' : 's'}</small></div>
      <div class="fin-tile"><small>📝 Orçamentos em aberto</small><b>${money(sum.openQuotesValue)}</b><small>${sum.openQuotes} à espera de resposta</small></div>
      <div class="fin-tile"><small>🎯 Adjudicados em ${esc(year)}</small><b>${sum.rate == null ? '—' : `${sum.rate}%`}</b><small>${sum.decided ? `${sum.wonCount} de ${sum.decided} orçamentos` : 'sem orçamentos decididos'}</small></div>
    </div>
    ${sum.withheld || sum.vat ? `<p class="small muted job-tax">🧾 Em ${esc(year)}: ${sum.withheld ? `IRS retido na fonte <b>${money(sum.withheld)}</b> (conta a teu favor no IRS)` : ''}${sum.withheld && sum.vat ? ' · ' : ''}${sum.vat ? `IVA cobrado <b>${money(sum.vat)}</b> (é do Estado, não é ganho)` : ''} · entrou na conta <b>${money(sum.received)}</b>.</p>` : ''}`;

    // Gráfico de barras: ganho por mês.
    const max = Math.max(1, ...sum.months);
    const bars = sum.earned ? `<div class="job-bars" role="img" aria-label="Ganho por mês em ${esc(year)}">${sum.months.map((v, m) => `<div class="jb" title="${MES[m]}: ${money(v)}">
        <span class="jb-v">${v ? money(v).replace(/,\d\d /, ' ') : ''}</span><span class="jb-bar" style="height:${Math.round((v / max) * 100)}%"></span><span class="jb-m">${MES[m]}</span></div>`).join('')}</div>` : '';
    const listBars = (items, label) => items.length ? `<ul class="job-split">${items.map((x) => `<li><span>${esc(label(x.key))}</span>
        <span class="js-bar"><span style="width:${Math.round((x.value / (items[0].value || 1)) * 100)}%"></span></span><b>${money(x.value)}</b></li>`).join('')}</ul>` : '';
    const stats = sum.earned ? card(`📊 ${esc(year)} em detalhe`, `${bars}
        <h3 class="sub">Por tipo</h3>${listBars(sum.byKind, kindLabel)}
        ${sum.hours ? `<p class="small muted">🎓 Formações: ${sum.hours} h dadas · ${money(sum.perHour)}/hora em média</p>` : ''}
        <h3 class="sub">Por cliente / entidade</h3>${listBars(sum.byClient.slice(0, 8), (k) => k)}`) : '';

    // Listas.
    const open = s.jobs.filter((j) => j.status === 'orcamento').sort((a, b) => String(a.quoteDate).localeCompare(String(b.quoteDate)));
    const stale = new Set(T.staleQuotes(s.jobs, t, 30).map((j) => j.id));
    const doing = s.jobs.filter((j) => j.status === 'adjudicado').sort((a, b) => String(a.workDate || a.quoteDate).localeCompare(String(b.workDate || b.quoteDate)));
    const billed = s.jobs.filter((j) => j.status === 'faturado');
    const paid = s.jobs.filter((j) => j.status === 'pago' && String(j.paidDate).startsWith(year)).sort((a, b) => String(b.paidDate).localeCompare(String(a.paidDate)));
    const lost = s.jobs.filter((j) => j.status === 'recusado' && String(j.quoteDate || '').startsWith(year));
    const lists = card('📂 Trabalhos', `
      <h3 class="sub">📝 Orçamentos à espera de resposta (${open.length})</h3>
      ${open.length ? `<ul class="jobs">${open.map((j) => row(j, `${stale.has(j.id) ? '<small class="job-stale">⏰ há mais de 30 dias</small>' : ''}${btn('job-won', j.id, '✅ Adjudicado', 'primary')}${btn('job-lost', j.id, '❌ Não')}`)).join('')}</ul>` : '<p class="empty small">Nenhum orçamento pendente.</p>'}
      <h3 class="sub">🔧 Em curso (${doing.length})</h3>
      ${doing.length ? `<ul class="jobs">${doing.map((j) => row(j, `${btn('job-billed', j.id, '🧾 Faturei')}${btn('job-paid', j.id, '💶 Recebi', 'primary')}`)).join('')}</ul>` : '<p class="empty small">Nada em curso.</p>'}
      ${billed.length ? `<h3 class="sub">🧾 Faturados, por receber (${billed.length})</h3><ul class="jobs">${billed.map((j) => row(j, btn('job-paid', j.id, '💶 Recebi', 'primary'))).join('')}</ul>` : ''}
      <details class="job-done" ${paid.length && paid.length <= 6 ? 'open' : ''}><summary class="sub">💶 Pagos em ${esc(year)} (${paid.length})</summary>
        ${paid.length ? `<ul class="jobs">${paid.map((j) => row(j)).join('')}</ul>` : '<p class="empty small">Ainda nada pago este ano.</p>'}</details>
      ${lost.length ? `<details class="job-done"><summary class="sub">❌ Não adjudicados em ${esc(year)} (${lost.length})</summary><ul class="jobs">${lost.map((j) => row(j)).join('')}</ul></details>` : ''}`);

    const intro = !s.jobs.length ? `<section class="card"><p><b>🧰 Trabalhos por fora</b>: ARDA, auditorias técnicas, projectos SPDA, formações…</p>
      <ul class="tips small"><li><b>＋ Orçamento</b> quando envias uma proposta. Depois marcas ✅ adjudicado ou ❌ não.</li>
      <li>Quando recebes, <b>💶 Recebi</b>: conta como ganho no ano em que foi pago.</li>
      <li>Em <b>⚙️</b> pões o IVA e a retenção na fonte que costumas usar (ex.: isento art. 53.º, retenção 25 %).</li></ul></section>` : '';
    return `${head}${intro}${tiles}<div class="grid two wide-left">${lists}${stats ? `<div class="stack">${stats}</div>` : ''}</div>
      <p class="small muted">🔒 Só os pais vêem esta parte. Valores sem IVA; o ganho de cada ano é o que foi pago nesse ano.</p>`;
  }

  /* ---------- Formulários ---------- */
  function jobForm(j, status = 'orcamento') {
    const c = cfg();
    const fields = [
      { name: 'kind', label: 'Tipo', type: 'select', half: true, options: T.KINDS },
      { name: 'status', label: 'Estado', type: 'select', half: true, options: T.STATUS },
      { name: 'title', label: 'Descrição', placeholder: 'Ex.: ARDA moradia, SPDA pavilhão, Formação RTIEBT' },
      { name: 'client', label: 'Cliente / entidade', required: true, suggest: [...new Set(S().jobs.map((x) => x.client).filter(Boolean))] },
      { name: 'value', label: 'Valor sem IVA (€)', required: true, half: true, inputmode: 'decimal', placeholder: '0,00' },
      { name: 'hours', label: 'Horas (formações)', type: 'number', min: 0, step: '0.5', half: true },
      { name: 'quoteDate', label: 'Data do orçamento', type: 'date', half: true },
      { name: 'workDate', label: 'Data do trabalho / formação', type: 'date', half: true },
      { name: 'paidDate', label: 'Data do pagamento', type: 'date', half: true },
      { name: 'paidValue', label: 'Recebido na conta (€, se diferente)', half: true, inputmode: 'decimal' },
      { name: 'vat', label: 'IVA (%)', type: 'number', min: 0, step: '1', half: true },
      { name: 'withholding', label: 'Retenção na fonte (%)', type: 'number', min: 0, step: '0.5', half: true },
      { name: 'notes', label: 'Notas', type: 'textarea', rows: 2 },
    ];
    const comma = (n) => (n == null || n === '' ? '' : String(n).replace('.', ','));
    openForm({
      title: j ? `✎ ${j.title || kindLabel(j.kind)}` : status === 'orcamento' ? '＋ Orçamento' : '＋ Trabalho / formação',
      fields,
      values: j ? { ...j, value: comma(j.value), paidValue: comma(j.paidValue) }
        : { kind: 'arda', status, quoteDate: status === 'orcamento' ? today() : '', workDate: status === 'orcamento' ? '' : today(), vat: c.vat || 0, withholding: c.withholding || 0 },
      submitLabel: 'Guardar',
      onSubmit: (d) => {
        const value = P().parseAmount(d.value);
        if (value == null || value < 0) { toast('Valor inválido.'); return; }
        const paidValue = P().parseAmount(d.paidValue);
        const data = {
          kind: d.kind, status: d.status, title: d.title.trim(), client: d.client.trim(), value,
          hours: Number(d.hours) || 0, quoteDate: d.quoteDate, workDate: d.workDate,
          paidDate: d.status === 'pago' ? d.paidDate || today() : d.paidDate, paidValue: paidValue ?? '',
          vat: Number(d.vat) || 0, withholding: Number(d.withholding) || 0, notes: d.notes.trim(),
        };
        Store.update((s) => {
          const cur = j && s.jobs.find((x) => x.id === j.id);
          if (cur) Object.assign(cur, data); else s.jobs.push({ id: Store.uid(), ...data });
        });
        toast(j ? '✔ Guardado' : data.status === 'orcamento' ? '📝 Orçamento registado' : '🧰 Trabalho registado');
      },
      ...(j ? { onDelete: () => Store.update((s) => { s.jobs = s.jobs.filter((x) => x.id !== j.id); }), deleteConfirm: 'Apagar este trabalho?', deleteToast: 'Apagado.' } : {}),
    });
  }
  const P = () => Patrimonio; // parseAmount ("1.234,56")

  function paidForm(j) {
    const a = T.amounts(j);
    openForm({
      title: `💶 Recebi · ${j.title || kindLabel(j.kind)}`,
      fields: [
        { name: 'info', type: 'note', html: `<p class="small">${esc(j.client || '')} · ${money(a.base)} sem IVA${a.vat ? ` + IVA ${money(a.vat)}` : ''}${a.withheld ? ` − retenção ${money(a.withheld)}` : ''} = <b>${money(a.base + a.vat - a.withheld)}</b> na conta.</p>` },
        { name: 'paidDate', label: 'Data do pagamento', type: 'date', required: true, half: true },
        { name: 'paidValue', label: 'Recebido (€, se diferente)', half: true, inputmode: 'decimal' },
      ],
      values: { paidDate: today() },
      submitLabel: 'Marcar como pago',
      onSubmit: (d) => {
        const pv = P().parseAmount(d.paidValue);
        Store.update((s) => { const cur = s.jobs.find((x) => x.id === j.id); if (cur) Object.assign(cur, { status: 'pago', paidDate: d.paidDate, paidValue: pv ?? '' }); });
        toast(`💶 ${money(a.base)} contam para ${d.paidDate.slice(0, 4)}`);
      },
    });
  }

  const setStatus = (id, status, extra = {}) => Store.update((s) => { const cur = s.jobs.find((x) => x.id === id); if (cur) Object.assign(cur, { status, ...extra }); });

  const actions = {
    'job-year': (el) => { if (el.dataset.id) { VS.jobYear = el.dataset.id; render(); } },
    'job-add': (el) => jobForm(null, el.dataset.id),
    'job-edit': (el) => { const j = job(el.dataset.id); if (j) jobForm(j); },
    'job-del': (el) => {
      const j = job(el.dataset.id);
      if (!j || !confirm(`Apagar "${j.title || kindLabel(j.kind)}" (${j.client || ''}, ${money(T.amounts(j).base)})?`)) return;
      Store.update((s) => { s.jobs = s.jobs.filter((x) => x.id !== j.id); });
      toast('Apagado.');
    },
    'job-won': (el) => { setStatus(el.dataset.id, 'adjudicado'); toast('✅ Adjudicado! Passou para "Em curso".'); },
    'job-lost': (el) => { setStatus(el.dataset.id, 'recusado'); toast('Fica registado como não adjudicado.'); },
    'job-billed': (el) => { setStatus(el.dataset.id, 'faturado'); toast('🧾 Faturado: fica à espera do pagamento.'); },
    'job-paid': (el) => { const j = job(el.dataset.id); if (j) paidForm(j); },
    'job-cfg': () => {
      const c = cfg();
      openForm({
        title: '⚙️ Trabalhos extra',
        fields: [
          { name: 'info', type: 'note', html: '<p class="small">Valores que vêm já preenchidos em cada trabalho novo (podes mudar caso a caso). Ex.: isento de IVA pelo art. 53.º → IVA 0; com retenção de IRS → 25 %.</p>' },
          { name: 'vat', label: 'IVA (%)', type: 'number', min: 0, step: '1', half: true },
          { name: 'withholding', label: 'Retenção na fonte (%)', type: 'number', min: 0, step: '0.5', half: true },
        ],
        values: { vat: c.vat || 0, withholding: c.withholding || 0 },
        onSubmit: (d) => Store.update((s) => {
          const data = { id: CFG_ID, vat: Number(d.vat) || 0, withholding: Number(d.withholding) || 0 };
          const i = (s.savings ||= []).findIndex((x) => x.id === CFG_ID);
          if (i >= 0) s.savings[i] = data; else s.savings.push(data);
        }),
      });
    },
  };

  Views.trabalhosView = view;
  return { actions };
};
