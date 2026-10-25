/*
 * Finanças → ⚡ Electricidade: juntar as faturas da luz (PDF lido no telemóvel, ou à mão), consumo em kWh e em euros
 * mês a mês, comparação com o ano anterior, preço médio por kWh e % em vazio.
 * Só para os pais (o servidor nem envia estes dados às filhas). Cálculos e leitura da fatura em js/electricidade.js.
 */
window.FinancasElectricidade = function ({ render }) {
  const { esc, money } = U;
  const { openForm, toast } = UI;
  const { card, empty } = Views.h;
  const E = Electricidade;
  const S = () => Store.state;
  const VS = Views.VS;
  const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const PERIODS = [['vazio', 'Vazio'], ['fora', 'Fora de vazio'], ['cheias', 'Cheias'], ['ponta', 'Ponta'], ['simples', 'Simples']];
  const bills = () => (S().energia || []).filter((b) => (b.kind || 'luz') === 'luz').sort((a, b) => String(b.to).localeCompare(String(a.to)));
  const dm = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '');
  const dmy = (iso) => (iso ? `${dm(iso)}/${iso.slice(0, 4)}` : '');
  const monthShort = (m) => `${MES[Number(m.slice(5)) - 1]} ${m.slice(2, 4)}`;
  const monthName = (m) => `${MESES[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`;
  const kwhTxt = (n) => `${Number(n || 0).toLocaleString('pt-PT', { maximumFractionDigits: 1 })} kWh`;
  const comma = (n) => (n == null || n === '' ? '' : String(n).replace('.', ','));
  const pct = (a, b) => (b ? Math.round(((a - b) / b) * 100) : null);
  const deltaHtml = (p, what = 'que nos 12 meses anteriores') => (p == null ? '' : `<small class="luz-delta ${p > 0 ? 'up' : p < 0 ? 'down' : ''}">${p > 0 ? '▲' : p < 0 ? '▼' : '='} ${Math.abs(p)}% ${p > 0 ? 'mais' : p < 0 ? 'menos' : ''} ${what}</small>`);

  /* ---------- Gráfico de barras (SVG, sem bibliotecas): um mês = uma barra; o mesmo mês do ano anterior = traço ---------- */
  let W = 640;
  let H = 230;
  const M = { l: 48, r: 10, t: 14, b: 28 };
  const fitSize = () => {
    const vw = window.innerWidth || 640;
    W = Math.round(vw < 900 ? Math.max(280, vw - 74) : Math.min(720, (vw - 300) * 0.55));
    H = Math.round(Math.max(190, Math.min(260, W * 0.5)));
  };
  function ticks(max) {
    const raw = (max || 1) / 4;
    const mag = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((x) => x >= raw) || raw;
    const out = [];
    for (let v = 0; v <= Math.ceil(max / step) * step + step / 2; v += step) out.push(Math.round(v * 100) / 100);
    return out;
  }

  function chart(ser, metric) {
    fitSize();
    const val = (r) => (metric === 'eur' ? r.total : r.kwh);
    const prev = (r) => (metric === 'eur' ? r.prevTotal : r.prevKwh);
    const hasPrev = ser.some((r) => prev(r) != null);
    const tk = ticks(Math.max(1, ...ser.flatMap((r) => [val(r) || 0, prev(r) || 0])));
    const yMax = tk.at(-1);
    const y = (v) => M.t + (1 - v / yMax) * (H - M.t - M.b);
    const slot = (W - M.l - M.r) / ser.length;
    const bw = Math.max(6, Math.min(36, slot - 6)); // 2px de folga entre barras, no mínimo
    const cx = (i) => M.l + slot * i + slot / 2;
    const fmt = (v) => (metric === 'eur' ? `${v.toLocaleString('pt-PT')} €` : v.toLocaleString('pt-PT'));
    const grid = tk.map((v) => `<line class="pc-grid${v === 0 ? ' zero' : ''}" x1="${M.l}" x2="${W - M.r}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/>
      <text class="pc-tick" x="${M.l - 8}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${esc(fmt(v))}</text>`).join('');
    // Pedaço de barra entre dois valores (em píxeis); o de cima tem os cantos arredondados (4px).
    const seg = (i, base, top, cls, round) => {
      const x0 = cx(i) - bw / 2;
      const rr = round ? Math.min(4, bw / 2, base - top) : 0;
      return `<path class="luz-bar ${cls}" d="M${x0.toFixed(1)},${base.toFixed(1)}V${(top + rr).toFixed(1)}Q${x0.toFixed(1)},${top.toFixed(1)} ${(x0 + rr).toFixed(1)},${top.toFixed(1)}H${(x0 + bw - rr).toFixed(1)}Q${(x0 + bw).toFixed(1)},${top.toFixed(1)} ${(x0 + bw).toFixed(1)},${(top + rr).toFixed(1)}V${base.toFixed(1)}Z"/>`;
    };
    // Em euros, com desconto de saldo: em baixo o que se pagou, em cima o desconto (2px de folga entre os dois).
    const credited = metric === 'eur' && ser.some((r) => r.credit > 0);
    const bars = ser.map((r, i) => {
      if (!val(r)) return '';
      const part = r.partial ? ' partial' : '';
      const c = credited ? r.credit || 0 : 0;
      if (!c || y(val(r) - c) - y(val(r)) < 4) return seg(i, y(0), y(val(r)), part, true);
      return seg(i, y(0), y(val(r) - c), part, false) + seg(i, y(val(r) - c) - 2, y(val(r)), `credit${part}`, true);
    }).join('');
    const marks = ser.map((r, i) => (prev(r) != null ? `<line class="luz-prev" x1="${(cx(i) - bw / 2 - 2).toFixed(1)}" x2="${(cx(i) + bw / 2 + 2).toFixed(1)}" y1="${y(prev(r)).toFixed(1)}" y2="${y(prev(r)).toFixed(1)}"/>` : '')).join('');
    const every = Math.max(1, Math.ceil(ser.length / 6));
    const xl = ser.map((r, i) => ((i % every === 0 || i === ser.length - 1) && !(i !== ser.length - 1 && ser.length - 1 - i < every)
      ? `<text class="pc-tick" x="${cx(i).toFixed(1)}" y="${H - 8}" text-anchor="middle">${esc(monthShort(r.month))}</text>` : '')).join('');
    const keys = [credited ? ['luz', 'Pago'] : ['luz', `${metric === 'eur' ? 'Custo' : 'Consumo'} do mês`], ...(credited ? [['credit', 'Desconto de saldo']] : []), ...(hasPrev ? [['debt', 'Mesmo mês do ano anterior']] : [])];
    const legend = keys.length > 1 ? `<div class="pc-legend" aria-hidden="true">${keys.map(([k, t]) => `<span><i class="k ${k}"></i>${t}</span>`).join('')}</div>` : '';
    const data = esc(JSON.stringify(ser.map((r, i) => ({ m: r.month, x: cx(i), v: val(r), p: prev(r), c: metric === 'eur' ? r.credit || 0 : 0, part: r.partial }))));
    return `${legend}<div class="luz-chart" data-points="${data}" data-w="${W}" data-metric="${metric}">
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${metric === 'eur' ? 'Custo' : 'Consumo em kWh'} da electricidade, mês a mês${credited ? ', com o que se pagou e o desconto de saldo' : ''}${hasPrev ? ', com o mesmo mês do ano anterior' : ''}">
        ${grid}${bars}${marks}${xl}
      </svg><div class="pc-tip" hidden></div></div>`;
  }

  // Caixa com os valores do mês por baixo do dedo/rato.
  function onChartMove(e) {
    const box = e.target.closest?.('.luz-chart');
    if (!box) return;
    const pts = JSON.parse(box.dataset.points || '[]');
    if (!pts.length) return;
    const r = box.getBoundingClientRect();
    const sx = (e.clientX - r.left) * (Number(box.dataset.w) / r.width);
    const p = pts.reduce((a, b) => (Math.abs(b.x - sx) < Math.abs(a.x - sx) ? b : a));
    const eur = box.dataset.metric === 'eur';
    const f = (v) => (eur ? money(v) : kwhTxt(v));
    const tip = box.querySelector('.pc-tip');
    tip.replaceChildren();
    const line = (cls, text, strong) => {
      const d = document.createElement('div');
      d.className = cls;
      if (strong != null) { const b = document.createElement('b'); b.textContent = strong; d.append(b, ` ${text}`); } else d.textContent = text;
      tip.append(d);
    };
    line('pc-tip-h', `${monthName(p.m)}${p.part ? ' (só parte do mês)' : ''}`);
    line('pc-tip-r', p.c ? 'custo da luz' : '', p.v != null ? f(p.v) : 'sem fatura');
    if (p.c) { line('pc-tip-r', 'pago', money(Math.round((p.v - p.c) * 100) / 100)); line('pc-tip-r', 'desconto de saldo', money(p.c)); }
    if (p.p != null) line('pc-tip-r', `no ano anterior${p.v != null && p.p ? ` (${pct(p.v, p.p) > 0 ? '+' : ''}${pct(p.v, p.p)}%)` : ''}`, f(p.p));
    tip.hidden = false;
    const left = (p.x / Number(box.dataset.w)) * r.width;
    tip.style.left = `${Math.min(Math.max(left, 80), r.width - 80)}px`;
  }
  document.addEventListener('pointermove', onChartMove);
  document.addEventListener('pointerdown', onChartMove);
  document.addEventListener('pointerleave', (e) => { const box = e.target.closest?.('.luz-chart'); if (box) box.querySelector('.pc-tip').hidden = true; }, true);

  /* ---------- Vista ---------- */
  function view() {
    const list = bills();
    const head = `<div class="bud-nav"><b>⚡ Electricidade</b><span class="spacer"></span>
      <button class="btn small primary" data-action="luz-import">📄 Juntar fatura (PDF)</button>
      <button class="btn small" data-action="luz-add">＋ À mão</button></div>`;
    if (!list.length) {
      return `${head}${card('⚡ Consumo de electricidade', `<p>Juntem as faturas da luz e o portal mostra quanto gastam por mês, em kWh e em euros, e se estão a gastar mais ou menos do que no ano anterior.</p>
        <ol class="small bud-how"><li>Na área de cliente do fornecedor (site ou app da EDP, Endesa, Goldenergy…), descarreguem as <b>faturas em PDF</b>.</li>
        <li>Aqui, toquem em <b>📄 Juntar fatura</b> e escolham os PDF (podem ser vários de uma vez).</li>
        <li>O portal lê o período, os kWh (também por horário: vazio, fora de vazio…), o valor e a potência. Confirmem e guardem.</li></ol>
        <p class="small muted">Quanto mais faturas antigas juntarem (idealmente 2 anos), melhor a comparação com o ano anterior. O PDF não é guardado: só os números.</p>`)}`;
    }
    const s = E.summary(list);
    const metric = VS.luzMetric === 'eur' ? 'eur' : 'kwh';
    const ser = E.series(list, 12);
    const L = s.last;
    const tiles = `<div class="fin-summary pat-stats">
      <div class="fin-tile"><small>Última fatura · ${esc(dm(L.from))} a ${esc(dm(L.to))}</small><b>${esc(kwhTxt(L.kwh))}</b><small>${money(L.total)}${L.credit ? ` (pago ${money(Math.round((L.total - L.credit) * 100) / 100)})` : ''} · ${L.days} dias${L.estimated ? ' · estimada' : ''}</small></div>
      <div class="fin-tile"><small>Por dia</small><b>${esc(kwhTxt(L.perDay))}</b><small>${s.perDay != null && s.coveredDays >= 60 ? `média ${s.coveredDays >= 330 ? 'de 12 meses' : `de ${s.coveredDays} dias`}: ${esc(kwhTxt(s.perDay))}` : 'na última fatura'}</small></div>
      <div class="fin-tile"><small>Preço médio (com taxas)</small><b>${s.perKwh != null ? `${esc(comma(s.perKwh.toFixed(3)))} €/kWh` : '—'}</b><small>${L.perKwh != null ? `última fatura: ${esc(comma(L.perKwh.toFixed(3)))} €/kWh` : ''}</small></div>
      <div class="fin-tile"><small>${s.coveredDays >= 330 ? 'Últimos 12 meses' : `Últimos ${s.coveredDays} dias com faturas`}</small><b>${money(s.year.total)}</b><small>${esc(kwhTxt(s.year.kwh))}</small>
        ${s.prevYear ? deltaHtml(pct(s.year.kwh, s.prevYear.kwh), 'kWh que no ano anterior') : ''}</div>
      ${s.perYear != null ? `<div class="fin-tile"><small>Por ano (ao ritmo actual)</small><b>${money(s.perYear)}</b><small>≈ ${money(Math.round(s.perYear / 12))} por mês</small></div>` : ''}
      ${s.year.credit > 0 ? `<div class="fin-tile"><small>💳 Descontos de saldo${s.coveredDays >= 330 ? ' (12 meses)' : ''}</small><b>${money(s.year.credit)}</b><small>a luz custou ${money(s.year.total)}, pagaram ${money(Math.round((s.year.total - s.year.credit) * 100) / 100)}</small></div>` : ''}
      ${s.vazioPct != null ? `<div class="fin-tile"><small>Em vazio${s.coveredDays >= 330 ? ' (12 meses)' : ''}</small><b>${s.vazioPct}%</b><small>do consumo, quando a luz é mais barata</small></div>` : ''}
    </div>`;
    const toggle = `<div class="tabs luz-metric" role="tablist" aria-label="Ver em">
      <button role="tab" class="filter ${metric === 'kwh' ? 'active' : ''}" aria-selected="${metric === 'kwh'}" data-action="luz-metric" data-id="kwh">kWh</button>
      <button role="tab" class="filter ${metric === 'eur' ? 'active' : ''}" aria-selected="${metric === 'eur'}" data-action="luz-metric" data-id="eur">Euros</button></div>`;
    const anyCredit = ser.some((r) => r.credit > 0);
    const table = `<details class="pat-table"><summary class="small">Ver em tabela</summary><div class="table-wrap"><table>
      <thead><tr><th>Mês</th><th>kWh</th><th>Custo</th>${anyCredit ? '<th>Desconto</th><th>Pago</th>' : ''}<th>Ano anterior</th></tr></thead>
      <tbody>${[...ser].reverse().map((r) => `<tr><td>${esc(monthName(r.month))}${r.partial ? ' <small class="muted">(parte)</small>' : ''}</td>
        <td>${r.kwh != null ? esc(r.kwh.toLocaleString('pt-PT')) : '—'}</td><td>${r.total != null ? money(r.total) : '—'}</td>
        ${anyCredit ? `<td>${r.credit ? money(r.credit) : '—'}</td><td>${r.total != null ? money(Math.round((r.total - (r.credit || 0)) * 100) / 100) : '—'}</td>` : ''}
        <td>${r.prevKwh != null ? `${esc(r.prevKwh.toLocaleString('pt-PT'))} kWh · ${money(r.prevTotal)}` : '—'}</td></tr>`).join('')}</tbody></table></div></details>`;
    const chartCard = card(`📊 ${metric === 'eur' ? 'Custo' : 'Consumo'} por mês`, `${toggle}${chart(ser, metric)}
      ${ser.some((r) => r.partial) ? '<p class="small muted">Barras mais claras: meses só em parte cobertos pelas faturas (falta a fatura seguinte).</p>' : ''}
      ${metric === 'eur' && anyCredit ? '<p class="small muted">Em euros, cada barra é o custo da luz: em baixo o que pagaram, em cima o desconto de saldo (ex.: My Repsol).</p>' : ''}
      <p class="small muted">Cada fatura é repartida pelos meses, pelos dias (ex.: de 15/08 a 14/09 conta 17 dias em agosto e 14 em setembro).</p>${table}`);
    // Preços da fatura, sem IVA (para comparar tarifários): "vazio 0,1012 · fora de vazio 0,1865 €/kWh · potência 0,2400 €/dia".
    const priceTxt = (b) => {
      const p = PERIODS.filter(([k]) => b.prices?.[k] != null).map(([k, n]) => `${k === 'simples' ? 'energia' : n.toLowerCase()} ${comma(Number(b.prices[k]).toFixed(4))}`);
      const parts = [p.length ? `${p.join(' · ')} €/kWh` : '', b.powerDay != null ? `potência ${comma(Number(b.powerDay).toFixed(4))} €/dia` : ''].filter(Boolean);
      return parts.length ? `Preços sem IVA: ${parts.join(' · ')}` : '';
    };
    const row = (b) => {
      const per = PERIODS.filter(([k]) => b.periods?.[k] != null && k !== 'simples').map(([k, n]) => `${n.toLowerCase()} ${b.periods[k].toLocaleString('pt-PT')}`).join(' · ');
      return `<li class="tx"><button class="tx-main" data-action="luz-edit" data-id="${esc(b.id)}">
          <span class="tx-desc">${esc(dmy(b.from))} a ${esc(dmy(b.to))}${b.estimated ? ' <small class="muted">· estimada</small>' : ''}</span>
          <small class="muted">${esc([b.supplier, `${E.daysOf(b.from, b.to)} dias`, per ? `${per} kWh` : '', b.power ? `${comma(b.power)} kVA` : '', E.perKwhOf(b) != null ? `${comma(E.perKwhOf(b).toFixed(3))} €/kWh` : ''].filter(Boolean).join(' · '))}</small>
          ${priceTxt(b) ? `<small class="muted">${esc(priceTxt(b))}</small>` : ''}
          ${b.credit ? `<small class="luz-credit">💳 desconto de saldo ${money(b.credit)} · pago ${money(Math.round((b.total - b.credit) * 100) / 100)}</small>` : ''}</button>
        <span class="luz-val"><b>${esc(kwhTxt(b.kwh))}</b><small class="muted">${money(b.total)}</small></span></li>`;
    };
    const listCard = card(`🧾 Faturas <small class="muted">(${list.length})</small>`, `<ul class="tx-list">${list.slice(0, VS.luzShow || 12).map(row).join('')}</ul>
      ${list.length > (VS.luzShow || 12) ? `<button class="btn small ghost" data-action="luz-more">Mostrar mais (${list.length - (VS.luzShow || 12)})</button>` : ''}`);
    const years = E.byYear(list);
    const perTxt = (y) => {
      if (!y.periodsKwh) return '—';
      const parts = PERIODS.filter(([k]) => y.periods[k] != null && k !== 'simples').map(([k, n]) => `${n.toLowerCase()} ${Math.round((y.periods[k] / y.periodsKwh) * 100)}%`);
      const cover = y.periodsKwh < y.kwh * 0.95 ? ` <small class="muted">(de ${esc(kwhTxt(y.periodsKwh))})</small>` : '';
      return parts.length ? `${parts.map(esc).join('<br>')}${cover ? `<br>${cover}` : ''}` : 'simples';
    };
    const yearCard = card('📅 Por ano', `<div class="table-wrap"><table class="luz-years">
      <thead><tr><th>Ano</th><th>kWh</th><th>Por dia</th><th>Custo</th><th>€/kWh</th><th>Horários</th><th>Ano anterior</th></tr></thead>
      <tbody>${years.map((y) => `<tr><td>${esc(y.year)}${y.partial ? ` <small class="muted">(${y.days} dias)</small>` : ''}</td>
        <td>${esc(y.kwh.toLocaleString('pt-PT'))}</td><td>${esc(kwhTxt(y.kwh / y.days))}</td><td>${money(y.total)}${y.credit ? `<br><small class="muted">pago ${money(Math.round((y.total - y.credit) * 100) / 100)}</small>` : ''}</td>
        <td>${y.perKwh != null ? esc(comma(y.perKwh.toFixed(3))) : '—'}</td><td>${perTxt(y)}</td>
        <td>${y.prevKwh != null ? deltaHtml(pct(y.kwh, y.prevKwh), 'kWh') : '—'}</td></tr>`).join('')}</tbody></table></div>
      <p class="small muted">Valores com IVA e taxas (o total da fatura, mais o desconto de saldo quando o houve). O €/kWh é o custo total a dividir pelos kWh, por isso inclui a potência. Anos com só parte dos dias não se comparam com o anterior: aí vejam o consumo por dia.</p>`);
    const gaps = missing(list);
    const gapNote = gaps.length ? `<section class="card bud-unsorted"><b>🧩 Faltam faturas</b><span class="small muted">Entre ${gaps.map((g) => `${esc(dmy(g.from))} e ${esc(dmy(g.to))}`).join('; ')}. Juntem-nas para os meses ficarem certos.</span></section>` : '';
    return `${head}${tiles}${gapNote}<div class="grid two">${chartCard}${listCard}</div>${yearCard}
      <p class="small muted">🔒 Só os pais vêem. O PDF é lido neste aparelho e não é guardado: ficam só os números.</p>`;
  }

  /** Buracos entre faturas seguidas (mais de 3 dias sem fatura), nos últimos 2 anos. */
  function missing(list) {
    const asc = [...list].sort((a, b) => a.from.localeCompare(b.from));
    const out = [];
    for (let i = 1; i < asc.length; i++) {
      const gap = E.daysOf(asc[i - 1].to, asc[i].from) - 2;
      if (gap > 3) out.push({ from: asc[i - 1].to, to: asc[i].from });
    }
    return out.slice(-3);
  }

  /* ---------- Juntar faturas ---------- */
  function importForm() {
    openForm({
      title: '📄 Juntar faturas da luz',
      fields: [
        { name: 'filebox', type: 'note', html: `<label class="field"><span>Faturas em PDF (podem escolher várias)</span>
          <input type="file" name="file" multiple accept=".pdf,application/pdf" required></label>
          <p class="small muted">Na área de cliente do fornecedor: Faturas → Descarregar PDF.</p>` },
        { name: 'mode', label: 'Com várias faturas', type: 'select', options: [['auto', 'Guardar logo as que forem bem lidas e mostrar um resumo'], ['one', 'Confirmar os números de cada uma']] },
      ],
      values: { mode: 'auto' },
      submitLabel: 'Ler as faturas',
      extra: savedPass() ? [{ label: '🔒 Esquecer a palavra-passe', onClick: () => { keepPass(''); toast('🔒 A palavra-passe das faturas foi apagada deste aparelho.'); } }] : [],
      onSubmit: (d) => {
        const files = [...(document.querySelector('#dialog [name=file]')?.files || [])];
        if (!files.length) { toast('Escolham a fatura em PDF.'); return; }
        if (files.length > 1 && d.mode !== 'one') setTimeout(() => readAll(files, 0, []), 0);
        else setTimeout(() => readNext(files, 0, 0), 0);
      },
    });
  }

  // Palavra-passe das faturas em PDF (ex.: Repsol): fica só neste aparelho, e só se pedirem para a lembrar.
  const PASS_KEY = 'portal-luz-pdf-pass';
  const savedPass = () => { try { return localStorage.getItem(PASS_KEY) || ''; } catch (e) { return ''; } };
  const keepPass = (v) => { try { if (v) localStorage.setItem(PASS_KEY, v); else localStorage.removeItem(PASS_KEY); } catch (e) { /* sem localStorage */ } };

  /** Abre o PDF e lê a fatura. Se precisar de palavra-passe, lança o erro do ExtratoPDF (com e.password). */
  async function readFile(file, password, keep) {
    const text = await ExtratoPDF.readText(new Uint8Array(await file.arrayBuffer()), null, password || undefined);
    if (keep && password) keepPass(password); // só fica guardada depois de abrir a fatura
    return E.parseInvoice(text);
  }

  /** Lê uma fatura de cada vez e abre o formulário para confirmar (o seguinte abre depois de guardar). */
  async function readNext(files, i, saved, password = savedPass(), keep = false) {
    if (i >= files.length) {
      if (files.length > 1) toast(`⚡ ${saved} de ${files.length} faturas guardadas.`);
      return;
    }
    const step = files.length > 1 ? `${i + 1} de ${files.length}` : '';
    const next = (ok, pass = password) => setTimeout(() => readNext(files, i + 1, saved + (ok ? 1 : 0), pass), 0);
    let found = null;
    let error = '';
    try {
      found = await readFile(files[i], password, keep);
    } catch (e) {
      if (e.password) {
        passwordForm(files[i].name, { wrong: e.password === 'wrong', fromSaved: !!password && password === savedPass(), step }, {
          retry: (pass, remember) => readNext(files, i, saved, pass, remember),
          manual: () => billForm(null, {}, { file: files[i].name, step, after: (ok) => next(ok) }),
        });
        return;
      }
      error = e.message || 'Não consegui ler este PDF.';
    }
    billForm(null, found || {}, { file: files[i].name, error, step, after: (ok) => next(ok) });
  }

  /** Várias faturas de uma vez: lê-as todas, guarda as completas e no fim mostra o resumo. */
  async function readAll(files, i, results, password = savedPass(), keep = false) {
    for (; i < files.length; i++) {
      toast(`📄 A ler a fatura ${i + 1} de ${files.length}…`);
      try {
        results.push({ file: files[i].name, found: await readFile(files[i], password, keep) });
        keep = false;
      } catch (e) {
        if (e.password) {
          const at = i;
          passwordForm(files[at].name, { wrong: e.password === 'wrong', fromSaved: !!password && password === savedPass(), step: `${at + 1} de ${files.length}` }, {
            retry: (pass, remember) => readAll(files, at, results, pass, remember),
            manual: () => readAll(files, at + 1, [...results, { file: files[at].name, error: 'Está protegida com palavra-passe e foi saltada.' }], password),
            skipLabel: 'Saltar esta',
          });
          return;
        }
        results.push({ file: files[i].name, error: e.message || 'Não consegui ler este PDF.' });
      }
    }
    saveAll(results);
  }

  function saveAll(results) {
    const plan = E.planImport(S().energia || [], results);
    if (plan.save.length) {
      Store.update((s) => {
        s.energia = s.energia || [];
        plan.save.forEach(({ data, replaceId }) => {
          const x = replaceId && s.energia.find((y) => y.id === replaceId);
          if (x) Object.assign(x, data); else s.energia.push({ id: Store.uid(), notes: '', ...data });
        });
      });
      VS.finTab = 'luz';
      render();
    }
    importSummary(plan);
  }

  function importSummary(plan) {
    const toFix = [...plan.review, ...plan.errors];
    const line = ({ file, data }) => `<li>${esc(dmy(data.from))} a ${esc(dmy(data.to))} · ${esc(kwhTxt(data.kwh))} · ${money(data.total)} <small class="muted">${esc(file)}</small></li>`;
    const bad = ({ file, why }) => `<li><b>${esc(file)}</b> <small class="muted">${esc(why)}</small></li>`;
    const block = (title, list, fn) => (list.length ? `<p class="small"><b>${title} (${list.length})</b></p><ul class="small luz-import-list">${list.map(fn).join('')}</ul>` : '');
    const html = [
      `<p class="small bud-note">${plan.save.length ? `✔ Ficaram guardadas ${plan.save.length} fatura${plan.save.length > 1 ? 's' : ''}.` : 'Nenhuma fatura ficou guardada.'}${toFix.length ? ` ${toFix.length === 1 ? 'Uma precisa' : `${toFix.length} precisam`} de ser vista${toFix.length > 1 ? 's' : ''} à mão.` : ''}</p>`,
      block('✔ Importadas', plan.imported, line),
      block('↻ Substituídas (já havia uma com as mesmas datas)', plan.replaced, line),
      block('⧉ Repetidas nesta escolha (ficou só uma)', plan.repeated, line),
      block('🔎 Para rever (não li tudo)', plan.review, bad),
      block('❌ Erros (não consegui ler)', plan.errors, bad),
    ].join('');
    openForm({
      title: '⚡ Resumo da importação',
      fields: [{ name: 'info', type: 'note', html }],
      submitLabel: toFix.length ? `Rever à mão (${toFix.length})` : 'Fechar',
      onSubmit: () => { if (toFix.length) setTimeout(() => reviewNext(toFix, 0, 0), 0); },
    });
  }

  /** As que não se guardaram sozinhas: abre o formulário de cada uma, com o que se leu. */
  function reviewNext(list, i, saved) {
    if (i >= list.length) { if (list.length > 1) toast(`⚡ ${saved} de ${list.length} faturas revistas guardadas.`); return; }
    const { file, found, why } = list[i];
    const error = found && Object.keys(found).length ? '' : why;
    billForm(null, found || {}, { file, error, step: `${i + 1} de ${list.length}`, after: (ok) => setTimeout(() => reviewNext(list, i + 1, saved + (ok ? 1 : 0)), 0) });
  }

  /** PDF protegido: pede a palavra-passe (e volta a tentar), ou deixa seguir sem ela. */
  function passwordForm(name, { wrong = false, fromSaved = false, step = '' } = {}, { retry, manual, skipLabel = 'Escrever à mão' }) {
    openForm({
      title: `🔒 Fatura protegida${step ? ` (${step})` : ''}`,
      fields: [
        { name: 'info', type: 'note', html: `<p class="small">📄 <b>${esc(name)}</b></p>
          <p class="small bud-note">${wrong ? (fromSaved ? '⚠️ A palavra-passe guardada neste aparelho não abre esta fatura. Escrevam a desta.' : '⚠️ Essa palavra-passe não abre o PDF. Experimentem outra vez.')
            : 'Esta fatura está protegida com palavra-passe. Sem ela o portal não consegue ler os números.'}</p>
          <p class="small muted">Costuma vir indicada no email que traz a fatura (muitas vezes é o NIF do titular).</p>` },
        { name: 'pass', label: 'Palavra-passe do PDF', type: 'password', required: true },
        { name: 'remember', label: 'Lembrar neste aparelho?', type: 'select', options: [['1', 'Sim (só neste telemóvel / computador)'], ['', 'Não']] },
      ],
      values: { remember: '1' },
      submitLabel: 'Abrir a fatura',
      extra: [{ label: skipLabel, onClick: () => { setTimeout(manual, 0); } }],
      onSubmit: (d) => { setTimeout(() => retry(d.pass, !!d.remember), 0); },
    });
  }

  function billForm(id, found = {}, { file = '', error = '', step = '', after = null } = {}) {
    const cur = id ? bills().find((b) => b.id === id) : null;
    const b = cur || found;
    const per = b.periods || {};
    // Horários: os que vêm na fatura; à mão, vazio e fora de vazio (bi-horário, o mais comum).
    const keys = PERIODS.map(([k]) => k).filter((k) => k !== 'simples' && per[k] != null);
    const show = keys.length ? keys : (!file ? ['vazio', 'fora'] : []);
    // Preços unitários (sem IVA): os horários com preço na fatura; sem preços, os horários mostrados (ou simples).
    const pr = b.prices || {};
    const priceKeys = PERIODS.map(([k]) => k).filter((k) => (Object.keys(pr).length ? pr[k] != null : show.includes(k)));
    if (!priceKeys.length) priceKeys.push('simples');
    const miss = file && !error ? [!b.from || !b.to ? 'o período' : '', b.kwh == null ? 'os kWh' : '', b.total == null ? 'o valor' : ''].filter(Boolean) : [];
    const notes = [
      error ? `❌ ${esc(error)} Podem escrever os números à mão.` : '',
      miss.length ? `🔎 Não encontrei ${miss.join(', ').replace(/, ([^,]*)$/, ' nem $1')}: escrevam-no${miss.length > 1 ? 's' : ''} abaixo (vem na 1.ª página da fatura).` : '',
      file && !error && !miss.length ? '✔ Li a fatura: confirmem os números antes de guardar.' : '',
      b.gas ? '🔥 Esta fatura também tem gás: o valor é só o da electricidade (confirmem).' : '',
      // Saldo / pontos usados a pagar (ex.: My Repsol): o custo da luz é o que se pagou + o desconto (com IVA).
      !cur && b.credit > 0 && b.paid != null ? `💳 Esta fatura usou saldo: desconto de ${money(b.credit)} (com IVA). Pagaram ${money(b.paid)}; a luz custou ${money(b.total)} — é o custo que conta nos gráficos, e o desconto fica registado à parte.` : '',
      b.estimated ? '📏 Leitura estimada: o consumo real acerta-se numa próxima fatura.' : '',
    ].filter(Boolean);
    openForm({
      title: cur ? '✎ Fatura da luz' : `⚡ ${file ? `Fatura${step ? ` ${step}` : ''}` : 'Nova fatura'}`,
      fields: [
        ...(file || notes.length ? [{ name: 'info', type: 'note', html: `${file ? `<p class="small">📄 <b>${esc(file)}</b></p>` : ''}${notes.map((n) => `<p class="small bud-note">${n}</p>`).join('')}` }] : []),
        { name: 'from', label: 'De', type: 'date', required: true, half: true },
        { name: 'to', label: 'A', type: 'date', required: true, half: true },
        { name: 'kwh', label: 'Consumo (kWh)', inputmode: 'decimal', required: true, half: true, placeholder: 'Ex.: 280' },
        { name: 'total', label: 'Custo da luz (€)', inputmode: 'decimal', required: true, half: true, placeholder: '0,00' },
        { name: 'credit', label: 'Desconto de saldo (€, com IVA)', inputmode: 'decimal', half: true, placeholder: 'Ex.: saldo My Repsol' },
        ...show.map((k) => ({ name: `p_${k}`, label: `kWh em ${PERIODS.find((x) => x[0] === k)[1].toLowerCase()}`, inputmode: 'decimal', half: true, placeholder: 'Opcional' })),
        { name: 'power', label: 'Potência (kVA)', inputmode: 'decimal', half: true, placeholder: 'Ex.: 6,9' },
        ...priceKeys.map((k) => ({ name: `pr_${k}`, label: `Preço ${PERIODS.find((x) => x[0] === k)[1].toLowerCase()} (€/kWh, sem IVA)`, inputmode: 'decimal', half: true, placeholder: 'Opcional' })),
        { name: 'powerDay', label: 'Termo de potência (€/dia, sem IVA)', inputmode: 'decimal', half: true, placeholder: 'Opcional' },
        { name: 'supplier', label: 'Fornecedor', half: true, suggest: [...new Set(bills().map((x) => x.supplier).filter(Boolean))] },
        { name: 'estimated', label: 'Leitura', type: 'select', half: true, options: [['', 'Real'], ['1', 'Estimada']] },
        { name: 'notes', label: 'Notas', placeholder: 'Opcional' },
      ],
      values: {
        from: b.from || '', to: b.to || '', kwh: comma(b.kwh), total: b.total == null || b.total === '' ? '' : comma(Number(b.total).toFixed(2)), credit: Number(b.credit) > 0 ? comma(Number(b.credit).toFixed(2)) : '', power: comma(b.power), supplier: b.supplier || '',
        estimated: b.estimated ? '1' : '', notes: b.notes || '', ...Object.fromEntries(show.map((k) => [`p_${k}`, comma(per[k])])),
        ...Object.fromEntries(priceKeys.map((k) => [`pr_${k}`, comma(pr[k])])), powerDay: comma(b.powerDay),
      },
      submitLabel: '⚡ Guardar',
      extra: after && step ? [{ label: 'Saltar esta', onClick: () => { after(false); } }] : [],
      onDelete: cur ? () => Store.update((s) => { s.energia = s.energia.filter((x) => x.id !== cur.id); }) : null,
      deleteConfirm: 'Apagar esta fatura?',
      deleteToast: 'Fatura apagada.',
      onSubmit: (d) => {
        const kwh = E.num(d.kwh);
        const total = E.num(d.total);
        const periods = {};
        PERIODS.forEach(([k]) => { const v = E.num(d[`p_${k}`]); if (v != null) periods[k] = v; });
        if (!show.length && per.simples != null) periods.simples = per.simples;
        const prices = {};
        priceKeys.forEach((k) => { const v = E.num(d[`pr_${k}`]); if (v != null && v > 0) prices[k] = v; });
        // Algo errado: volta a abrir o formulário com o que escreveram.
        const again = (msg) => { toast(msg); setTimeout(() => billForm(id, { ...b, ...d, kwh, total, periods, prices, powerDay: E.num(d.powerDay), credit: E.num(d.credit), power: E.num(d.power), estimated: !!d.estimated }, { file, error, step, after }), 0); };
        if (!d.from || !d.to || d.to < d.from) { again('As datas da fatura não batem certo (a data final é antes da inicial).'); return; }
        if (kwh == null || kwh < 0 || total == null) { again('Falta o consumo (kWh) ou o valor.'); return; }
        if ((E.num(d.credit) || 0) > total) { again('O desconto não pode ser maior do que o custo da luz.'); return; }
        const data = {
          kind: 'luz', from: d.from, to: d.to, kwh, total, credit: Math.max(0, E.num(d.credit) || 0), periods, prices, powerDay: E.num(d.powerDay), power: E.num(d.power), supplier: d.supplier.trim(),
          estimated: !!d.estimated, notes: d.notes.trim(), ...(b.cpe ? { cpe: b.cpe } : {}),
        };
        let replaced = false;
        Store.update((s) => {
          s.energia = s.energia || [];
          const x = cur && s.energia.find((y) => y.id === cur.id);
          const twin = !x && E.sameBill(s.energia, { id: '', ...data });
          if (x || twin) { Object.assign(x || twin, data); replaced = !!twin; } else s.energia.push({ id: Store.uid(), ...data });
        });
        VS.finTab = 'luz';
        render();
        const cr = Math.max(0, E.num(d.credit) || 0);
        toast(`⚡ ${dm(d.from)} a ${dm(d.to)}: ${kwhTxt(kwh)} · ${money(total)}${cr ? ` (desconto ${money(cr)}, pago ${money(Math.round((total - cr) * 100) / 100)})` : ''}${replaced ? ' (substituiu a que já existia com as mesmas datas)' : ''}`);
        after?.(true);
      },
    });
  }

  const actions = {
    'luz-import': importForm,
    'luz-add': () => billForm(null),
    'luz-edit': (el) => billForm(el.dataset.id),
    'luz-metric': (el) => { VS.luzMetric = el.dataset.id; render(); },
    'luz-more': () => { VS.luzShow = (VS.luzShow || 12) + 12; render(); },
  };

  Views.electricidadeView = view;
  return { actions };
};
