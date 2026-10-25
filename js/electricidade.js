/*
 * Electricidade: ler uma fatura em PDF (texto tirado pelo pdf.js, em js/extrato-pdf.js), repartir o consumo e o
 * valor de cada fatura pelos meses do calendário e calcular o resumo (kWh por dia, €/kWh, ano contra ano anterior).
 * Colecção (só pais): energia — { id, kind: 'luz', from, to, kwh, total, periods: { vazio, fora, cheias, ponta, simples },
 *   power, supplier, cpe, estimated, notes }.
 * Script "clássico": define globalThis.Electricidade. Testado em tests/electricidade.test.mjs.
 */
(function (root) {
  const strip = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const r2 = (n) => Math.round(n * 100) / 100;
  const r1 = (n) => Math.round(n * 10) / 10;

  /** "1.234,56" / "1 234,5" / "245" → número. */
  function num(s) {
    const t = String(s || '').replace(/\s/g, '');
    if (!t) return null;
    const n = Number(/,/.test(t) ? t.replace(/\./g, '').replace(',', '.') : /^\d{1,3}(\.\d{3})+$/.test(t) ? t.replace(/\./g, '') : t);
    return Number.isFinite(n) ? n : null;
  }

  /* ---------- Datas ---------- */
  const DATE = String.raw`(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})|(\d{4})-(\d{2})-(\d{2})`;
  const isoOf = (m, o = 0) => {
    const [d, mo, y, Y, M, D] = m.slice(1 + o, 7 + o);
    const iso = Y ? `${Y}-${M}-${D}` : `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const t = Date.parse(`${iso}T00:00:00Z`);
    return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === iso ? iso : null;
  };
  const dayNum = (iso) => Date.parse(`${iso}T00:00:00Z`) / 86400000;
  const fromDay = (n) => new Date(n * 86400000).toISOString().slice(0, 10);
  /** Dias da fatura (o primeiro e o último dia contam). */
  const daysOf = (from, to) => (from && to && to >= from ? dayNum(to) - dayNum(from) + 1 : 0);

  const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  /** "15 ago 2026" / "15 de agosto de 2026" → "15/08/2026". */
  const numericDates = (l) => String(l).replace(/(\d{1,2})\s+(?:de\s+)?(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-zç]*\.?\s+(?:de\s+)?(\d{4})/gi,
    (_, d, m, y) => `${d}/${MESES.indexOf(m.toLowerCase()) + 1}/${y}`);

  /** Período "de 15/08/2026 a 14/09/2026": de preferência numa linha que fala de período / consumo / faturação. */
  function findPeriod(lines) {
    const re = new RegExp(`(?:${DATE})\\s*(?:a|ate|até|ao|-|–|—)\\s*(?:${DATE})`, 'i');
    const pairs = [];
    lines.forEach((raw, i) => {
      const l = numericDates(raw);
      const m = l.match(re);
      if (!m) return;
      const from = isoOf(m);
      const to = isoOf(m, 6);
      if (!from || !to || to < from || daysOf(from, to) > 400) return;
      const ctx = strip(`${lines[i - 1] || ''} ${l}`);
      pairs.push({ from, to, score: /periodo|consumo|faturac|facturac|leitura/.test(ctx) ? 1 : 0 });
    });
    return pairs.sort((a, b) => b.score - a.score)[0] || null;
  }

  /* ---------- Valores ---------- */
  const MONEY = /(?:€\s*)?(-?\d{1,3}(?:[.\s]\d{3})*,\d{2}|-?\d+,\d{2}|-?\d+\.\d{2})(?!\d)\s*(?:€|eur\b)?/gi;
  const moneyIn = (l) => [...String(l).matchAll(MONEY)].map((m) => num(m[1].replace(/\.(\d{2})$/, ',$1'))).filter((n) => n != null);

  /** O valor da linha "Total a pagar 78,45 €" (ou o da linha seguinte, quando o número vem por baixo). */
  function amountAfter(lines, test) {
    for (let i = 0; i < lines.length; i++) {
      if (!test(strip(lines[i]))) continue;
      const here = moneyIn(lines[i].replace(/^.*?(?:pagar|fatura|factura|total)/i, ''));
      if (here.length) return here.at(-1);
      const next = moneyIn(lines[i + 1] || '');
      if (next.length) return next[0];
    }
    return null;
  }

  /* ---------- kWh por horário ---------- */
  // Ordem importa: "fora de vazio" antes de "vazio"; "super vazio" conta como vazio.
  const LABELS = [
    ['fora', /fora (?:de )?vazio|f\.? ?vazio|fora vaz/],
    ['vazio', /vazio/],
    ['ponta', /\bponta\b/],
    ['cheias', /\bcheias?\b/],
    ['simples', /\bsimples\b|\bnormal\b/],
  ];
  const KWH = /(?<![\d.,/])(\d{1,3}(?:[.\s]\d{3})+|\d+)(?:,(\d+))?\s*kwh\b/i;

  /**
   * Fatura (texto, linha a linha) → campos. Tudo o que não encontrar fica null (o formulário pede para confirmar).
   * @returns {{ supplier, cpe, from, to, kwh, total, periods, power, estimated, gas }}
   */
  function parseInvoice(text) {
    const lines = String(text || '').split(/\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
    const plain = strip(lines.join('\n'));
    const per = findPeriod(lines);

    // kWh por horário: nas linhas de detalhe ("Vazio 120 kWh x 0,1012 €/kWh") somam-se (pode haver mudança de preço
    // a meio da fatura); sem detalhe, vale o primeiro valor de cada horário (o resumo).
    const detail = {};
    const first = {};
    let total = null;
    let loose = null; // "Consumo 300 kWh" sem horário (só conta se não houver mais nada)
    lines.forEach((l) => {
      const s = strip(l);
      const m = s.match(KWH);
      if (!m || /€\s*\/\s*kwh$/.test(s.slice(0, m.index + m[0].length))) return;
      const v = num(`${m[1].replace(/[.\s]/g, '')}${m[2] ? `,${m[2]}` : ''}`);
      if (v == null || v > 100000) return;
      if (/consumo total|total (?:de |do )?consumo|consumo (?:no|do) periodo|energia (?:ativa|activa) total|total energia|consumo faturado|consumo facturado|total kwh/.test(s)) {
        if (total == null) total = v;
        return;
      }
      const lab = LABELS.find(([, re]) => re.test(s));
      if (!lab) { if (loose == null && /consumo|energia/.test(s)) loose = v; return; }
      const k = lab[0];
      if (/kwh\s*(?:x|×|\*)|€\s*\/\s*kwh|\/kwh/.test(s)) detail[k] = r2((detail[k] || 0) + v);
      else if (first[k] == null) first[k] = v;
    });
    const periods = Object.keys(detail).length ? detail : first;
    const sum = Object.values(periods).reduce((n, v) => n + v, 0);
    const kwh = total ?? (sum ? r2(sum) : loose);

    const gas = /gas natural/.test(plain) && /\bm3\b|m³/.test(plain);
    const elec = amountAfter(lines, (s) => /total (?:da |de )?ele(?:c)?tricidade|subtotal ele(?:c)?tricidade/.test(s));
    const pay = amountAfter(lines, (s) => /total a pagar|valor a pagar|montante a pagar|valor total a pagar|total (?:da )?fa(?:c)?tura\b|^a pagar\b/.test(s));
    const power = (() => { const m = plain.match(/(\d+(?:,\d+)?)\s*kva\b/); return m ? num(m[1]) : null; })();
    const cpe = (lines.join(' ').match(/PT\s?0002\s?(?:\d\s?){12}[A-Z]{2}/) || [''])[0].replace(/\s/g, '') || null;
    const SUPPLIERS = ['EDP', 'Endesa', 'Iberdrola', 'Goldenergy', 'Galp', 'Repsol', 'Luzboa', 'Coopérnico', 'SU Eletricidade', 'MEO Energia',
      'Ylce', 'Plenitude', 'Muon', 'G9', 'EZU', 'Audax', 'Lusiadaenergia', 'YesEnergy', 'Enat', 'Energia Simples', 'Alfa Energia'];
    const supplier = SUPPLIERS.find((x) => new RegExp(`\\b${strip(x)}\\b`).test(plain)) || null;
    return {
      supplier, cpe,
      from: per?.from || null, to: per?.to || null,
      kwh, total: gas && elec != null ? elec : pay ?? elec,
      periods, power, estimated: /estimad|estimativa/.test(plain), gas,
    };
  }

  /* ---------- Por mês ---------- */
  const monthOf = (iso) => String(iso).slice(0, 7);
  const addMonths = (m, n) => {
    const [y, mo] = m.split('-').map(Number);
    const t = y * 12 + (mo - 1) + n;
    return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
  };

  /**
   * Reparte cada fatura pelos meses do calendário, pelos dias (fatura de 15/08 a 14/09: 17 dias em agosto, 14 em setembro).
   * @returns {Object<string, { kwh, total, days }>} por mês (AAAA-MM); days = dias desse mês cobertos por faturas
   */
  function byMonth(bills = []) {
    const out = {};
    bills.filter((b) => b.from && b.to && daysOf(b.from, b.to)).forEach((b) => {
      const days = daysOf(b.from, b.to);
      for (let d = dayNum(b.from); d <= dayNum(b.to); d++) {
        const m = monthOf(fromDay(d));
        const o = (out[m] ||= { kwh: 0, total: 0, days: 0 });
        o.kwh += (Number(b.kwh) || 0) / days;
        o.total += (Number(b.total) || 0) / days;
        o.days += 1;
      }
    });
    Object.values(out).forEach((o) => { o.kwh = r1(o.kwh); o.total = r2(o.total); });
    return out;
  }

  const daysInMonth = (m) => { const [y, mo] = m.split('-').map(Number); return new Date(Date.UTC(y, mo, 0)).getUTCDate(); };

  /**
   * Série para o gráfico: os últimos `n` meses até ao último mês com faturas, cada um com o mesmo mês do ano anterior.
   * Um mês só coberto em parte (fatura ainda por chegar) fica marcado como parcial.
   */
  function series(bills = [], n = 12) {
    const bm = byMonth(bills);
    const months = Object.keys(bm).sort();
    if (!months.length) return [];
    const last = months.at(-1);
    return Array.from({ length: n }, (_, i) => addMonths(last, i - n + 1)).filter((m) => m >= months[0]).map((m) => {
      const cur = bm[m];
      const prev = bm[addMonths(m, -12)];
      return {
        month: m,
        kwh: cur ? cur.kwh : null, total: cur ? cur.total : null,
        partial: !!cur && cur.days < daysInMonth(m),
        prevKwh: prev && prev.days >= daysInMonth(addMonths(m, -12)) ? prev.kwh : null,
        prevTotal: prev && prev.days >= daysInMonth(addMonths(m, -12)) ? prev.total : null,
      };
    });
  }

  /** Resumo: última fatura, 12 meses (e os 12 anteriores), €/kWh, kWh por dia, % em vazio, custo por ano. */
  function summary(bills = []) {
    const list = bills.filter((b) => b.from && b.to && daysOf(b.from, b.to)).sort((a, b) => a.to.localeCompare(b.to));
    if (!list.length) return null;
    const last = list.at(-1);
    const end = dayNum(last.to);
    // Soma de kWh e € entre dois dias (pela proporção de cada fatura).
    const window = (fromN, toN) => {
      let kwh = 0; let total = 0; let days = 0;
      list.forEach((b) => {
        const a = Math.max(dayNum(b.from), fromN);
        const z = Math.min(dayNum(b.to), toN);
        if (z < a) return;
        const f = (z - a + 1) / daysOf(b.from, b.to);
        kwh += (Number(b.kwh) || 0) * f; total += (Number(b.total) || 0) * f; days += z - a + 1;
      });
      return { kwh: r1(kwh), total: r2(total), days };
    };
    const y1 = window(end - 364, end);
    const y0 = window(end - 729, end - 365);
    const vaz = list.filter((b) => dayNum(b.to) > end - 365 && b.periods && (b.periods.vazio != null) && Number(b.kwh));
    const vazKwh = vaz.reduce((n, b) => n + Number(b.periods.vazio || 0), 0);
    const vazAll = vaz.reduce((n, b) => n + Number(b.kwh), 0);
    const lastDays = daysOf(last.from, last.to);
    return {
      last: { ...last, days: lastDays, perDay: r1((Number(last.kwh) || 0) / lastDays), perKwh: Number(last.kwh) ? Math.round((Number(last.total) / Number(last.kwh)) * 1000) / 1000 : null },
      year: y1, prevYear: y0.days >= 300 && y1.days >= 300 ? y0 : null,
      perDay: y1.days ? r1(y1.kwh / y1.days) : null,
      perKwh: y1.kwh ? Math.round((y1.total / y1.kwh) * 1000) / 1000 : null,
      perYear: y1.days >= 60 ? Math.round((y1.total / y1.days) * 365) : null,
      vazioPct: vazAll ? Math.round((vazKwh / vazAll) * 100) : null,
      coveredDays: y1.days,
    };
  }

  /** Há já uma fatura com o mesmo período? (para não a guardar duas vezes) */
  const sameBill = (bills = [], b) => bills.find((x) => x.id !== b.id && x.from === b.from && x.to === b.to);

  root.Electricidade = { num, parseInvoice, findPeriod, daysOf, byMonth, series, summary, sameBill, addMonths };
})(globalThis);
