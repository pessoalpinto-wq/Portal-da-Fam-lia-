/*
 * Finanças → 📈 Património: fecho do mês (saldos no último dia), evolução, contas e dívidas.
 * Só para os pais (o servidor nem envia estes dados às filhas). A parte de cálculo está em js/patrimonio.js.
 */
window.FinancasPatrimonio = function ({ render }) {
  const { esc, money, today } = U;
  const { editItem, openForm, toast } = UI;
  const { card, empty, addBtn } = Views.h;
  const P = Patrimonio;
  const S = () => Store.state;
  const signed = (n) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${money(Math.abs(n))}`;
  const deltaHtml = (n, vs) => (n == null ? '' : `<span class="pat-delta ${n > 0 ? 'up' : n < 0 ? 'down' : ''}">${n > 0 ? '▲' : n < 0 ? '▼' : '='} ${esc(signed(n))}</span>${vs ? ` <small class="muted">${esc(vs)}</small>` : ''}`);
  const commaNum = (n) => (n == null ? '' : String(n).replace('.', ','));
  const kindLabel = (k) => P.KIND_LABEL[k] || P.KIND_LABEL.outro;
  const accounts = () => S().faccounts.filter((a) => !a.archived);
  const debts = () => S().debts.filter((d) => !d.archived);

  /* ---------- Gráfico de evolução (SVG, sem bibliotecas) ---------- */
  // Largura do desenho = largura real no ecrã (o texto fica sempre com ~11px, no telemóvel e no computador).
  let W = 640;
  let H = 230;
  const M = { l: 52, r: 14, t: 14, b: 28 };
  const fitSize = () => {
    const vw = window.innerWidth || 640;
    W = Math.round(vw < 900 ? Math.max(280, vw - 74) : Math.min(720, (vw - 300) * 0.55));
    H = Math.round(Math.max(190, Math.min(260, W * 0.5)));
  };
  /** Marcas "redondas" para o eixo (0 / 5 mil / 10 mil…). */
  function ticks(min, max) {
    const span = max - min || Math.abs(max) || 1;
    const raw = span / 4;
    const mag = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((s) => s >= raw) || raw;
    const lo = Math.floor(min / step) * step;
    const hi = Math.ceil(max / step) * step;
    const out = [];
    for (let v = lo; v <= hi + step / 2; v += step) out.push(Math.round(v * 100) / 100);
    return out;
  }
  const axisMoney = (v) => (Math.abs(v) >= 1000 ? `${(v / 1000).toLocaleString('pt-PT', { maximumFractionDigits: 1 })} mil` : `${v.toLocaleString('pt-PT')}`);

  function chart(ser) {
    if (!ser.length) return '';
    fitSize();
    const first = ser[0].month;
    const spanM = Math.max(1, P.monthsBetween(first, ser.at(-1).month));
    const hasDebt = ser.some((r) => r.debt > 0);
    const vals = ser.flatMap((r) => [r.net, ...(hasDebt ? [r.debt] : [])]);
    const tk = ticks(Math.min(0, ...vals), Math.max(0, ...vals));
    const yMin = tk[0];
    const yMax = tk.at(-1);
    const x = (m) => (ser.length === 1 ? M.l + (W - M.l - M.r) / 2 : M.l + (P.monthsBetween(first, m) / spanM) * (W - M.l - M.r));
    const y = (v) => M.t + (1 - (v - yMin) / (yMax - yMin || 1)) * (H - M.t - M.b);
    const path = (key) => ser.map((r, i) => `${i ? 'L' : 'M'}${x(r.month).toFixed(1)},${y(r[key]).toFixed(1)}`).join('');
    const grid = tk.map((v) => `<line class="pc-grid${v === 0 ? ' zero' : ''}" x1="${M.l}" x2="${W - M.r}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/>
      <text class="pc-tick" x="${M.l - 8}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${esc(axisMoney(v))}</text>`).join('');
    // Etiquetas do eixo X: no máximo ~6, sempre a primeira e a última.
    const every = Math.max(1, Math.ceil(ser.length / 6));
    const xl = ser.map((r, i) => ((i % every === 0 || i === ser.length - 1) && !(i !== ser.length - 1 && ser.length - 1 - i < every / 2)
      ? `<text class="pc-tick" x="${x(r.month).toFixed(1)}" y="${H - 8}" text-anchor="middle">${esc(P.monthShort(r.month))}</text>` : '')).join('');
    const dots = (key, cls) => ser.map((r) => `<circle class="pc-dot ${cls}" cx="${x(r.month).toFixed(1)}" cy="${y(r[key]).toFixed(1)}" r="4"/>`).join('');
    const line = (key, cls) => (ser.length > 1 ? `<path class="pc-line ${cls}" d="${path(key)}"/>` : '');
    const legend = `<div class="pc-legend" aria-hidden="true"><span><i class="k net"></i>Património líquido</span>${hasDebt ? '<span><i class="k debt"></i>Dívidas</span>' : ''}</div>`;
    const data = esc(JSON.stringify(ser.map((r) => ({ m: r.month, x: x(r.month), net: r.net, debt: r.debt, yn: y(r.net), yd: y(r.debt) }))));
    return `${legend}<div class="pat-chart" data-points="${data}" data-h="${H}" data-w="${W}" data-debt="${hasDebt ? 1 : ''}">
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolução do património líquido${hasDebt ? ' e das dívidas' : ''}, mês a mês">
        ${grid}${xl}
        ${hasDebt ? line('debt', 'debt') : ''}${line('net', 'net')}
        ${hasDebt ? dots('debt', 'debt') : ''}${dots('net', 'net')}
        <line class="pc-cross" x1="0" x2="0" y1="${M.t}" y2="${H - M.b}" visibility="hidden"/>
      </svg><div class="pc-tip" hidden></div></div>`;
  }

  // Cruz + caixa com os valores do mês mais próximo do dedo/rato.
  function onChartMove(e) {
    const box = e.target.closest?.('.pat-chart');
    if (!box) return;
    const pts = JSON.parse(box.dataset.points || '[]');
    if (!pts.length) return;
    const r = box.getBoundingClientRect();
    const sx = (e.clientX - r.left) * (Number(box.dataset.w) / r.width);
    const p = pts.reduce((a, b) => (Math.abs(b.x - sx) < Math.abs(a.x - sx) ? b : a));
    const cross = box.querySelector('.pc-cross');
    cross.setAttribute('x1', p.x);
    cross.setAttribute('x2', p.x);
    cross.setAttribute('visibility', 'visible');
    const tip = box.querySelector('.pc-tip');
    tip.replaceChildren();
    const head = document.createElement('div');
    head.className = 'pc-tip-h';
    head.textContent = P.monthName(p.m);
    tip.append(head);
    const row = (cls, label, v) => {
      const d = document.createElement('div');
      d.className = 'pc-tip-r';
      const k = document.createElement('i');
      k.className = `k ${cls}`;
      const b = document.createElement('b');
      b.textContent = money(v);
      const s = document.createElement('span');
      s.textContent = label;
      d.append(k, b, s);
      tip.append(d);
    };
    row('net', 'líquido', p.net);
    if (box.dataset.debt) row('debt', 'dívidas', p.debt);
    tip.hidden = false;
    const left = (p.x / Number(box.dataset.w)) * r.width;
    tip.style.left = `${Math.min(Math.max(left, 70), r.width - 70)}px`;
  }
  const hideTip = (e) => {
    const box = e.target.closest?.('.pat-chart');
    if (!box) return;
    box.querySelector('.pc-tip').hidden = true;
    box.querySelector('.pc-cross')?.setAttribute('visibility', 'hidden');
  };
  document.addEventListener('pointermove', onChartMove);
  document.addEventListener('pointerdown', onChartMove);
  document.addEventListener('pointerleave', hideTip, true);
  // Rodar o telemóvel / mudar o tamanho da janela: redesenha o gráfico à nova largura.
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (document.querySelector('.pat-chart') && !document.querySelector('#dialog[open]')) render(); }, 250);
  });

  /* ---------- Vista ---------- */
  function debtCard(d) {
    const st = P.debtStatus(d, S().fsnaps, today());
    const facts = [];
    if (st.made && st.paid) {
      facts.push(`<li><b>Pago até agora: ${money(st.paid)}</b> <small class="muted">(${st.made} prestaç${st.made === 1 ? 'ão' : 'ões'} de ${money(d.payment)})</small>
        <br><small>${money(st.amortized)} de capital${st.interest != null ? ` · ${money(st.interest)} de juros e encargos` : ''}</small></li>`);
    } else {
      facts.push(`<li><b>Capital já pago: ${money(st.amortized)}</b></li>`);
    }
    facts.push(`<li><b>Falta: ${money(st.balance)}</b>${st.left != null ? ` <small class="muted">· ${st.left} prestaç${st.left === 1 ? 'ão' : 'ões'}${st.endMonth ? ` · acaba em ${esc(P.monthName(st.endMonth))}` : ''}</small>` : ''}</li>`);
    return `<li class="debt">
      <button class="debt-head" data-action="pat-debt-edit" data-id="${esc(d.id)}">
        <b>${esc(d.name)}</b><small class="muted">${esc([d.lender, d.rate ? `${commaNum(d.rate)} %` : ''].filter(Boolean).join(' · '))}</small></button>
      <div class="pat-meter" role="progressbar" aria-valuenow="${st.pct}" aria-valuemin="0" aria-valuemax="100" aria-label="${st.pct}% pago"><span style="width:${st.pct}%"></span></div>
      <p class="small"><b>${st.pct}% pago</b> de ${money(d.initial)}</p>
      <ul class="pat-facts">${facts.join('')}</ul>
      ${st.estimated ? '<p class="small muted">≈ Estimativa pela prestação. Ponham o capital em dívida no fecho do mês (vem no extrato do crédito) para ficar exacto.</p>'
        : `<p class="small muted">Capital em dívida do fecho de ${esc(P.monthName(st.asOf))}.</p>`}
    </li>`;
  }

  function view() {
    const s = S();
    const t = today();
    const snaps = s.fsnaps;
    const ser = P.series(snaps);
    const sum = P.summary(snaps);
    const pending = P.pendingClose(snaps, t);
    const accs = accounts();
    const rows = P.accountRows(s.faccounts, snaps);
    const kinds = P.byKind(s.faccounts, snaps);

    const banner = pending && (accs.length || debts().length) ? `<section class="card pat-banner">
        <div><b>📅 Fecho de ${esc(P.monthName(pending))}</b>
        <p class="small">Ponham o saldo de cada conta ${pending === P.monthOf(t) ? 'de hoje' : `do último dia de ${esc(P.monthName(pending).split(' ')[0])}`}. Vem preenchido com o mês anterior: só têm de corrigir o que mudou.</p></div>
        <button class="btn primary" data-action="pat-close" data-id="${esc(pending)}">Fazer o fecho</button></section>` : '';

    const hero = sum ? `<section class="card pat-hero">
        <small class="muted">Património líquido · fecho de ${esc(P.monthName(sum.last.month))}</small>
        <div class="pat-big">${money(sum.last.net)}</div>
        <div class="pat-deltas">
          ${sum.prev ? `<span>${deltaHtml(sum.monthDelta, `vs. ${P.monthName(sum.prev.month)}`)}</span>` : ''}
          ${sum.yearAgo ? `<span>${deltaHtml(sum.yearDelta, 'num ano')}</span>` : ''}
        </div>
        <p class="small muted">🏦 Contas e investimentos <b>${money(sum.last.assets)}</b> · 🚗 Dívidas <b>${money(sum.last.debt)}</b></p>
      </section>` : '';

    const stats = sum && sum.months > 1 ? `<div class="fin-summary pat-stats">
        ${sum.avg != null ? `<div class="fin-tile"><small>Média por mês</small><b>${esc(signed(sum.avg))}</b></div>` : ''}
        ${sum.best ? `<div class="fin-tile ok"><small>Melhor mês · ${esc(P.monthName(sum.best.month))}</small><b>${esc(signed(sum.best.change))}</b></div>` : ''}
        ${sum.worst && sum.worst !== sum.best ? `<div class="fin-tile"><small>Pior mês · ${esc(P.monthName(sum.worst.month))}</small><b>${esc(signed(sum.worst.change))}</b></div>` : ''}
      </div>` : '';

    const table = ser.length ? `<details class="pat-table"><summary>Ver em tabela</summary><div class="table-wrap"><table>
        <thead><tr><th>Mês</th><th>Contas</th><th>Dívidas</th><th>Líquido</th><th>Variação</th></tr></thead>
        <tbody>${[...ser].reverse().map((r) => `<tr><td><button class="linkish" data-action="pat-close" data-id="${esc(r.month)}" title="Ver / corrigir este fecho">${esc(P.monthName(r.month))}</button></td>
          <td>${money(r.assets)}</td><td>${money(r.debt)}</td><td><b>${money(r.net)}</b></td><td>${r.change == null ? '—' : esc(signed(r.change))}</td></tr>`).join('')}</tbody>
      </table></div></details>` : '';

    const evolution = card('📈 Evolução', ser.length
      ? `${chart(ser)}${ser.length === 1 ? '<p class="small muted">O gráfico ganha forma a partir do próximo fecho. Também podem juntar meses antigos.</p>' : ''}${table}`
      : empty(accs.length ? 'Façam o primeiro fecho para começar a ver a evolução. 📅' : 'Comecem por juntar as vossas contas (à ordem, poupança, PPR, investimentos…). Depois, no último dia de cada mês, põem o saldo de cada uma.'),
    { action: ser.length || accs.length ? '<button class="btn small" data-action="pat-close-old" title="Fechar um mês que já passou">＋ Mês antigo</button>' : '' });

    const accCard = card('🏦 Contas e investimentos', rows.length ? `<ul class="list pat-accounts">${rows.map(({ account: a, value, delta }) => `<li class="item">
        <button class="item-main" data-action="pat-acc-edit" data-id="${esc(a.id)}">
          <span class="title">${esc(a.name)}${a.archived ? ' <small class="muted">(arquivada)</small>' : ''}</span>
          <small class="muted">${esc([kindLabel(a.kind), a.bank].filter(Boolean).join(' · '))}</small></button>
        <span class="pat-val"><b>${value == null ? '—' : money(value)}</b>${delta ? `<small class="${delta > 0 ? 'up' : 'down'}">${esc(signed(delta))}</small>` : ''}</span></li>`).join('')}</ul>
        ${kinds.length > 1 ? `<h3 class="sub">Por tipo</h3><ul class="pat-kinds">${kinds.map((k) => `<li><span>${esc(k.label)}</span><b>${money(k.value)}</b></li>`).join('')}</ul>` : ''}`
      : empty('Ainda sem contas.'), { action: addBtn('pat-acc-add', 'Conta') });

    const debtList = debts();
    const debtCardHtml = card('🚗 Dívidas', debtList.length ? `<ul class="pat-debts">${debtList.map(debtCard).join('')}</ul>`
      : empty('Sem dívidas registadas. Juntem o crédito do carro (valor inicial, prestação e datas) para verem quanto já pagaram e quanto falta.'),
    { action: addBtn('pat-debt-add', 'Dívida') });

    return `${banner}${hero}${stats}
      <div class="grid two wide-left">${evolution}<div class="stack">${accCard}${debtCardHtml}</div></div>
      <p class="small muted">🔒 Só os pais vêem o património. Valores no último dia de cada mês, escritos por vocês — o portal não liga ao banco.</p>`;
  }

  /* ---------- Formulários ---------- */
  function closeForm(month) {
    const s = S();
    const accs = accounts();
    const dts = debts();
    if (!accs.length && !dts.length) { toast('Juntem primeiro as vossas contas.'); return; }
    const f = P.prefill(s.faccounts, s.debts, s.fsnaps, month);
    const fields = [
      { name: 'info', type: 'note', html: `<p class="small">Saldo de cada conta no <b>último dia de ${esc(P.monthName(month))}</b>.
        ${f.existing ? 'Este mês já está fechado: podem corrigir os valores.' : f.from ? `Vem preenchido com ${esc(P.monthName(f.from))} — corrijam o que mudou.` : ''}
        Deixem vazio o que não quiserem contar.</p>` },
      ...accs.map((a) => ({ name: `a_${a.id}`, label: `${a.name}${a.bank ? ` · ${a.bank}` : ''}`, inputmode: 'decimal', half: true, placeholder: '0,00' })),
      ...(dts.length ? [{ name: 'dinfo', type: 'note', html: '<h3 class="sub">🚗 Capital em dívida</h3><p class="small muted">Vem no extrato do crédito ("capital em dívida").</p>' }] : []),
      ...dts.map((d) => ({ name: `d_${d.id}`, label: d.name, inputmode: 'decimal', half: true, placeholder: '0,00' })),
    ];
    const values = {};
    accs.forEach((a) => { if (a.id in f.values) values[`a_${a.id}`] = commaNum(f.values[a.id]); });
    dts.forEach((d) => { if (d.id in f.debts) values[`d_${d.id}`] = commaNum(f.debts[d.id]); });
    openForm({
      title: `📅 Fecho de ${P.monthName(month)}`,
      fields,
      values,
      submitLabel: 'Guardar o fecho',
      onSubmit: (data) => {
        const own = s.fsnaps.find((x) => x.id === month);
        const vals = {};
        const dv = {};
        accs.forEach((a) => { const v = P.parseAmount(data[`a_${a.id}`]); if (v != null) vals[a.id] = v; });
        dts.forEach((d) => { const v = P.parseAmount(data[`d_${d.id}`]); if (v != null) dv[d.id] = v; });
        // Contas arquivadas que já tinham valor neste fecho: mantém-se.
        Object.entries(own?.values || {}).forEach(([k, v]) => { if (!accs.some((a) => a.id === k)) vals[k] = v; });
        Object.entries(own?.debts || {}).forEach(([k, v]) => { if (!dts.some((d) => d.id === k)) dv[k] = v; });
        Store.update((st) => {
          const doc = { id: month, values: vals, debts: dv, by: st.currentUser, at: today() };
          const i = st.fsnaps.findIndex((x) => x.id === month);
          if (i >= 0) st.fsnaps[i] = doc; else st.fsnaps.push(doc);
        });
        const after = P.summary(S().fsnaps);
        const d = after?.last.month === month ? after.monthDelta : null;
        toast(`📅 Fecho de ${P.monthName(month)} guardado${d != null ? ` · ${signed(d)} face ao mês anterior` : ''}.`);
      },
    });
  }

  function oldMonthForm() {
    const t = today();
    openForm({
      title: '📅 Fechar um mês antigo',
      fields: [
        { name: 'info', type: 'note', html: '<p class="small">Para o gráfico começar com histórico: escolham o mês e ponham os saldos do último dia (estão nos extratos).</p>' },
        { name: 'month', label: 'Mês', type: 'month', required: true },
      ],
      values: { month: P.addMonths(P.monthOf(t), -1) },
      submitLabel: 'Continuar',
      onSubmit: (d) => {
        if (!/^\d{4}-\d{2}$/.test(d.month) || d.month > P.monthOf(t)) { toast('Escolham um mês que já passou (AAAA-MM).'); return; }
        setTimeout(() => closeForm(d.month), 0);
      },
    });
  }

  const ACC_FIELDS = () => [
    { name: 'name', label: 'Nome', required: true, placeholder: 'Ex.: Conta conjunta, Poupança férias, PPR Luís' },
    { name: 'bank', label: 'Banco / entidade', half: true, placeholder: 'Ex.: CGD, Millennium, Revolut' },
    { name: 'kind', label: 'Tipo', type: 'select', half: true, options: P.KINDS },
    { name: 'archived', label: 'Estado', type: 'select', half: true, options: [['', 'Em uso'], ['1', 'Arquivada (fechada)']] },
  ];
  const DEBT_FIELDS = () => [
    { name: 'name', label: 'Nome', required: true, placeholder: 'Ex.: Crédito do carro' },
    { name: 'lender', label: 'Banco / financeira', half: true },
    { name: 'initial', label: 'Valor emprestado (€)', type: 'number', step: '0.01', min: 0, required: true, half: true },
    { name: 'start', label: '1.ª prestação (mês)', type: 'month', required: true, half: true },
    { name: 'end', label: 'Última prestação (mês)', type: 'month', half: true },
    { name: 'payment', label: 'Prestação mensal (€)', type: 'number', step: '0.01', min: 0, half: true },
    { name: 'rate', label: 'Taxa anual (TAN %, opcional)', type: 'number', step: '0.001', min: 0, half: true },
    { name: 'archived', label: 'Estado', type: 'select', half: true, options: [['', 'A pagar'], ['1', 'Paga / arquivada']] },
    { name: 'notes', label: 'Notas', type: 'textarea', rows: 2 },
  ];

  const actions = {
    'pat-close': (el) => closeForm(el.dataset.id),
    'pat-close-old': oldMonthForm,
    'pat-acc-add': () => editItem('faccounts', null, { title: 'conta', fields: ACC_FIELDS(), defaults: () => ({ kind: 'ordem', bank: '', archived: '' }) }),
    'pat-acc-edit': (el) => editItem('faccounts', el.dataset.id, {
      title: 'conta', fields: ACC_FIELDS(),
      deleteConfirm: 'Apagar esta conta? Os fechos antigos mantêm o valor dela. Se a conta foi fechada, é melhor "Arquivar".',
    }),
    'pat-debt-add': () => editItem('debts', null, { title: 'dívida', fields: DEBT_FIELDS(), defaults: () => ({ archived: '', start: P.monthOf(today()) }) }),
    'pat-debt-edit': (el) => editItem('debts', el.dataset.id, { title: 'dívida', fields: DEBT_FIELDS(), deleteConfirm: 'Apagar esta dívida e o seu histórico nos fechos?' }),
  };

  Views.patrimonioView = view;
  Views.patrimonioPending = () => (Store.isParent() ? P.pendingClose(S().fsnaps, today()) : null);
  return { actions };
};
