/*
 * Extratos em PDF (ex.: cartão Wizink, conta Santander): tira o texto com o pdf.js (carregado só quando é
 * preciso, de js/vendor/pdfjs), junta-o em linhas e encontra a tabela de movimentos:
 *  - linhas que começam por uma data (DD/MM, DD-MM ou com ano);
 *  - o valor é o número na coluna "Montante"/"Valor" (não o "Saldo");
 *  - datas sem ano: o ano vem do período do extrato ("de 16/05/2026 a 15/06/2026", "PERÍODO DE 2026-05-01 A …");
 *  - extrato de cartão de crédito: as compras vêm positivas → passam a despesa (negativo); pagamentos,
 *    reembolsos e devoluções ficam positivos.
 * Devolve uma tabela [Data, Descrição, Montante] para o resto da importação (js/orcamento.js).
 * Script "clássico": define globalThis.ExtratoPDF. A parte pura (toRows) é testada em tests/extrato-pdf.test.mjs.
 */
(function (root) {
  const MONEY = /^[-+]?\s?(?:\d{1,3}(?:[.\s]\d{3})+|\d+),\d{2}\s?(?:€|EUR)?\s?-?$/i;
  const DATE = /^(\d{2})[/.-](\d{2})(?:[/.-](\d{2,4}))?$/;
  const BANKS = ['Wizink', 'Santander', 'Caixa Geral de Depósitos', 'CGD', 'Millennium', 'BPI', 'Novo Banco', 'Revolut', 'Unibanco',
    'Cofidis', 'Cetelem', 'Montepio', 'Crédito Agrícola', 'ActivoBank', 'Moey', 'Bankinter', 'Universo', 'Banco CTT', 'Oney'];
  const strip = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const money = (s) => {
    const t = String(s).replace(/\s|€|EUR/gi, '');
    const neg = /^-|-$/.test(t);
    const n = Number(t.replace(/^[-+]|-$/g, '').replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(n) ? (neg ? -n : n) : null;
  };

  /** Itens de texto do pdf.js ({str, transform:[…, x, y]}) → linhas [{ y, cells: [{ x, str }] }] de cima para baixo. */
  function linesFromItems(items) {
    const lines = [];
    items.filter((it) => String(it.str).trim()).forEach((it) => {
      const x = it.transform[4];
      const y = it.transform[5];
      let line = lines.find((l) => Math.abs(l.y - y) <= 2.5);
      if (!line) { line = { y, cells: [] }; lines.push(line); }
      line.cells.push({ x, w: it.width || 0, str: String(it.str) });
    });
    lines.forEach((l) => {
      l.cells.sort((a, b) => a.x - b.x);
      // Junta pedaços colados (o pdf.js às vezes parte uma palavra ou um número em vários itens).
      const merged = [];
      l.cells.forEach((c) => {
        const prev = merged.at(-1);
        if (prev && prev.w && c.x - (prev.x + prev.w) < 1.5) { prev.str += c.str; prev.w = c.x + c.w - prev.x; } else merged.push({ ...c });
      });
      l.cells = merged.map((c) => ({ x: c.x, str: c.str.trim() })).filter((c) => c.str);
    });
    return lines.sort((a, b) => b.y - a.y);
  }

  /** Período do extrato (para pôr o ano nas datas DD/MM). */
  function period(text) {
    let m = text.match(/(\d{2})[/.-](\d{2})[/.-](\d{4})\s*(?:a|até|-|–)\s*(\d{2})[/.-](\d{2})[/.-](\d{4})/i);
    if (m) return { from: `${m[3]}-${m[2]}-${m[1]}`, to: `${m[6]}-${m[5]}-${m[4]}` };
    m = text.match(/(\d{4})-(\d{2})-(\d{2})\s*(?:a|até|-|–)\s*(\d{4})-(\d{2})-(\d{2})/i);
    if (m) return { from: `${m[1]}-${m[2]}-${m[3]}`, to: `${m[4]}-${m[5]}-${m[6]}` };
    // Sem período: a data completa mais recente do documento.
    const all = [...text.matchAll(/\b(\d{2})[/.-](\d{2})[/.-](\d{4})\b/g)].map((x) => `${x[3]}-${x[2]}-${x[1]}`).sort();
    return all.length ? { from: all[0], to: all.at(-1) } : null;
  }

  function isoDate(s, per) {
    const m = String(s).match(DATE);
    if (!m) return null;
    const [, d, mo, y] = m;
    if (+mo < 1 || +mo > 12 || +d < 1 || +d > 31) return null;
    let year = y ? (y.length === 2 ? `20${y}` : y) : null;
    if (!year) {
      if (!per) return null;
      const end = per.to;
      year = end.slice(0, 4);
      if (+mo > +end.slice(5, 7)) year = String(+year - 1); // ex.: extrato de janeiro com compras de dezembro
    }
    return `${year}-${mo}-${d}`;
  }

  /**
   * Páginas (linhas) → tabela para a importação.
   * @param {Array<Array<{y, cells}>>} pages
   * @returns {string[][]} [['Cartão de crédito · Wizink'?], ['Data', 'Descrição', 'Montante'], [AAAA-MM-DD, descrição, '-12.34'], …]
   */
  function toRows(pages) {
    const text = pages.flat().map((l) => l.cells.map((c) => c.str).join(' ')).join('\n');
    const plain = strip(text);
    const per = period(text);
    const card = /limite de credito|cartao de credito|pagamento minimo|saldo em divida/.test(plain);
    const bank = BANKS.find((b) => plain.includes(strip(b)));
    const out = [];
    let amountX = null; // coluna do valor (pelo cabeçalho)
    let saldoX = null;
    let credits = false; // secção "Pagamentos efetuados", "Créditos"…
    const intro = []; // o texto antes do 1.º movimento (titular, conta, "Nº cartão ****1234"…)
    pages.forEach((lines) => {
      lines.forEach((l) => {
        const cells = l.cells;
        if (!out.length) intro.push(cells.map((c) => c.str).join(' '));
        const lineTxt = strip(cells.map((c) => c.str).join(' '));
        // Cabeçalho da tabela: guarda a posição das colunas.
        // (com várias colunas de valor, ex.: "Montante na moeda de origem" e "Montante em euros", vale a da direita)
        const head = cells.some((c) => /^data/.test(strip(c.str))) && cells.filter((c) => /^(montante|valor|importe|debito|credito)\b/.test(strip(c.str))).at(-1);
        if (head && !DATE.test(cells[0].str)) {
          amountX = head.x;
          saldoX = cells.find((c) => /^saldo/.test(strip(c.str)))?.x ?? null;
          credits = false;
          return;
        }
        if (/pagamentos efetuados|pagamentos realizados|creditos no periodo/.test(lineTxt) && !DATE.test(cells[0]?.str || '')) { credits = true; return; }
        if (!cells.length || !DATE.test(cells[0].str)) return;
        const date = isoDate(cells[0].str, per);
        if (!date) return;
        let i = 1;
        if (cells[1] && DATE.test(cells[1].str)) i = 2; // data valor
        const rest = cells.slice(i);
        const moneyCells = rest.filter((c) => MONEY.test(c.str));
        if (!moneyCells.length) return;
        // O valor: na coluna do "Montante"/"Valor" (o mais perto), nunca na do "Saldo".
        let pick = moneyCells[0];
        if (amountX != null) {
          const cand = moneyCells.filter((c) => saldoX == null || Math.abs(c.x - amountX) <= Math.abs(c.x - saldoX));
          if (!cand.length) return; // só tem saldo (ex.: "Saldo Inicial")
          pick = cand.reduce((a, b) => (Math.abs(b.x - amountX) < Math.abs(a.x - amountX) ? b : a));
        }
        const desc = rest.filter((c) => !MONEY.test(c.str) && !/^(eur|€|usd|gbp|chf)$/i.test(c.str)).map((c) => c.str).join(' ').replace(/\s+/g, ' ').trim();
        let v = money(pick.str);
        if (v == null || !desc || /^saldo (inicial|final|anterior|actual|atual)/.test(strip(desc))) return;
        if (card && !/^-|-$/.test(pick.str.replace(/\s/g, ''))) {
          // Cartão: positivo = compra (despesa), salvo pagamentos / devoluções / reembolsos.
          const credit = credits || /pagamento|reembolso|devolu|estorno|anula|credito/.test(strip(desc));
          v = credit ? Math.abs(v) : -Math.abs(v);
        }
        out.push([date, desc, String(Math.round(v * 100) / 100)]);
      });
    });
    // Os números da conta / cartão (os 4 últimos), para o portal saber de que conta é o extrato.
    const refs = root.Orcamento?.accountRefs ? root.Orcamento.accountRefs(intro.join('\n')) : [];
    const top = [`Extrato PDF${card ? ' · Cartão de crédito' : ''}${bank ? ` · ${bank}` : ''}${refs.length ? ` · Nº ${refs.map((r) => `…${r}`).join(' ')}` : ''}`];
    return out.length ? [top, ['Data', 'Descrição', 'Montante'], ...out] : [top];
  }

  /* ---------- No browser: ler o PDF com o pdf.js ---------- */
  let lib = null;
  async function pdfjs() {
    if (lib) return lib;
    const base = typeof document !== 'undefined' ? document.baseURI : 'http://localhost/';
    lib = await import(new URL('js/vendor/pdfjs/pdf.min.js', base).href);
    lib.GlobalWorkerOptions.workerSrc = new URL('js/vendor/pdfjs/pdf.worker.min.js', base).href;
    return lib;
  }

  /**
   * Abre o PDF. Com palavra-passe (ex.: faturas da Repsol), sem ela ou com a errada dá um erro com
   * e.password = 'need' | 'wrong', para a página a pedir.
   */
  async function open(bytes, impl, password) {
    const L = impl || await pdfjs();
    // Cópia: o pdf.js fica com os bytes (e com uma palavra-passe errada é preciso tentar outra vez).
    const data = new Uint8Array(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
    try {
      return await L.getDocument({ data, isEvalSupported: false, ...(password ? { password } : {}) }).promise;
    } catch (e) {
      if (e?.name !== 'PasswordException') throw e;
      const err = new Error(password ? 'A palavra-passe do PDF não está certa.' : 'Este PDF está protegido com palavra-passe.');
      err.password = password ? 'wrong' : 'need';
      throw err;
    }
  }

  /** PDF (bytes) → tabela para a importação. */
  async function read(bytes, impl) {
    const doc = await open(bytes, impl);
    const pages = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      pages.push(linesFromItems((await page.getTextContent()).items));
    }
    const rows = toRows(pages);
    if (rows.length < 3) {
      const scanned = pages.every((p) => !p.length);
      throw new Error(scanned ? 'Este PDF é uma imagem (digitalizado): não tem texto para ler. Descarreguem o extrato do homebanking em PDF, Excel ou CSV.'
        : 'Não encontrei movimentos neste PDF. Experimentem exportar os movimentos em Excel ou CSV.');
    }
    return rows;
  }

  /** PDF (bytes) → o texto, linha a linha (para outras leituras, ex.: faturas da luz em js/electricidade.js). */
  async function readText(bytes, impl, password) {
    const doc = await open(bytes, impl, password);
    const out = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      linesFromItems((await page.getTextContent()).items).forEach((l) => out.push(l.cells.map((c) => c.str).join(' ')));
    }
    if (!out.length) throw new Error('Este PDF é uma imagem (digitalizado): não tem texto para ler. Descarreguem a fatura em PDF na área de cliente do fornecedor.');
    return out.join('\n');
  }

  root.ExtratoPDF = { linesFromItems, toRows, period, isoDate, read, readText };
})(globalThis);
