/*
 * Ler extratos bancários sem bibliotecas: CSV (; , ou tab), .xlsx (zip + XML, descomprimido pelo próprio
 * browser) e os ".xls" que muitos bancos exportam e que na verdade são uma página HTML ou um CSV.
 * Devolve sempre uma tabela: array de linhas, cada linha um array de textos.
 * Script "clássico": define globalThis.Folhas. Testado em tests/folhas.test.mjs.
 */
(function (root) {
  /* ---------- CSV ---------- */
  /** Separador mais provável (o que aparece mais vezes, de forma constante, nas primeiras linhas). */
  function sniff(text) {
    const lines = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 30);
    let best = ';';
    let bestScore = -1;
    [';', '\t', ',', '|'].forEach((d) => {
      const counts = lines.map((l) => splitLine(l, d).length);
      const many = counts.filter((n) => n > 1);
      // Muitas linhas com o mesmo n.º de colunas (> 1) = bom separador.
      const mode = many.length ? many.sort((a, b) => many.filter((x) => x === b).length - many.filter((x) => x === a).length)[0] : 0;
      const score = many.filter((n) => n === mode).length * 10 + mode;
      if (score > bestScore) { bestScore = score; best = d; }
    });
    return best;
  }

  function splitLine(line, d) {
    const out = [];
    let cur = '';
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) {
        if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c;
      } else if (c === '"') q = true;
      else if (c === d) { out.push(cur); cur = ''; } else cur += c;
    }
    out.push(cur);
    return out.map((x) => x.trim());
  }

  /** CSV → tabela (aceita campos entre aspas com quebras de linha). */
  function parseCSV(text, delim) {
    const t = String(text || '').replace(/^﻿/, '');
    const d = delim || sniff(t);
    const rows = [];
    let row = [];
    let cur = '';
    let q = false;
    for (let i = 0; i < t.length; i++) {
      const c = t[i];
      if (q) {
        if (c === '"' && t[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c;
      } else if (c === '"') q = true;
      else if (c === d) { row.push(cur.trim()); cur = ''; } else if (c === '\n' || c === '\r') {
        if (c === '\r' && t[i + 1] === '\n') i++;
        row.push(cur.trim());
        rows.push(row);
        row = [];
        cur = '';
      } else cur += c;
    }
    if (cur || row.length) { row.push(cur.trim()); rows.push(row); }
    return rows.filter((r) => r.some((x) => x !== ''));
  }

  /* ---------- HTML (".xls" de alguns bancos) ---------- */
  function parseHTML(text, DOMParserImpl = root.DOMParser) {
    const doc = new DOMParserImpl().parseFromString(text, 'text/html');
    // A maior tabela da página é a dos movimentos.
    const tables = [...doc.querySelectorAll('table')];
    const table = tables.sort((a, b) => b.querySelectorAll('tr').length - a.querySelectorAll('tr').length)[0];
    if (!table) return [];
    return [...table.querySelectorAll('tr')].map((tr) => [...tr.querySelectorAll('th,td')].map((c) => c.textContent.replace(/\s+/g, ' ').trim()))
      .filter((r) => r.some((x) => x !== ''));
  }

  /* ---------- XLSX (zip + XML) ---------- */
  async function inflateRaw(bytes) {
    const ds = new DecompressionStream('deflate-raw');
    const stream = new Blob([bytes]).stream().pipeThrough(ds);
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  /** Lê os ficheiros de um zip: { nome: Uint8Array }. Só os que `want` aceitar. */
  async function unzip(buf, want = () => true) {
    const b = new Uint8Array(buf);
    const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
    let eocd = -1;
    for (let i = b.length - 22; i >= Math.max(0, b.length - 66000); i--) if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('Este ficheiro não é um Excel (.xlsx) válido.');
    const n = v.getUint16(eocd + 10, true);
    let p = v.getUint32(eocd + 16, true);
    const dec = new TextDecoder();
    const out = {};
    for (let k = 0; k < n; k++) {
      if (v.getUint32(p, true) !== 0x02014b50) break;
      const method = v.getUint16(p + 10, true);
      const csize = v.getUint32(p + 20, true);
      const nameLen = v.getUint16(p + 28, true);
      const extraLen = v.getUint16(p + 30, true);
      const commentLen = v.getUint16(p + 32, true);
      const local = v.getUint32(p + 42, true);
      const name = dec.decode(b.subarray(p + 46, p + 46 + nameLen));
      p += 46 + nameLen + extraLen + commentLen;
      if (!want(name)) continue;
      const lNameLen = v.getUint16(local + 26, true);
      const lExtra = v.getUint16(local + 28, true);
      const start = local + 30 + lNameLen + lExtra;
      const data = b.subarray(start, start + csize);
      out[name] = method === 0 ? data : await inflateRaw(data);
    }
    return out;
  }

  /** "B12" → coluna 1 (0 = A). */
  const colIndex = (ref) => [...String(ref).replace(/\d+/g, '')].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;

  /** Data do Excel (n.º de série) → AAAA-MM-DD. */
  const excelDate = (n) => new Date(Math.round((Number(n) - 25569) * 86400000)).toISOString().slice(0, 10);

  async function parseXLSX(buf, DOMParserImpl = root.DOMParser) {
    const files = await unzip(buf, (n) => /^xl\/(sharedStrings\.xml|workbook\.xml|styles\.xml|worksheets\/sheet\d+\.xml|_rels\/workbook\.xml\.rels)$/.test(n));
    const dec = new TextDecoder();
    const xml = (n) => (files[n] ? new DOMParserImpl().parseFromString(dec.decode(files[n]), 'application/xml') : null);
    // Pelo nome local: alguns bancos escrevem as etiquetas com prefixo (<x:row>, <x:c>…).
    const tag = (el, name) => [...(el.getElementsByTagNameNS ? el.getElementsByTagNameNS('*', name) : el.getElementsByTagName(name))];
    const strings = [];
    const ss = xml('xl/sharedStrings.xml');
    if (ss) tag(ss, 'si').forEach((si) => strings.push(tag(si, 't').map((t) => t.textContent).join('')));
    // Que estilos são datas (para converter o n.º de série).
    const dateStyles = new Set();
    const st = xml('xl/styles.xml');
    if (st) {
      const custom = new Map(tag(st, 'numFmt').map((f) => [f.getAttribute('numFmtId'), f.getAttribute('formatCode') || '']));
      const xfs = tag(st, 'cellXfs')[0];
      if (xfs) {
        tag(xfs, 'xf').forEach((xf, i) => {
          const id = Number(xf.getAttribute('numFmtId'));
          const code = custom.get(String(id)) || '';
          if ((id >= 14 && id <= 22) || (id >= 45 && id <= 47) || /[dy]/i.test(code.replace(/"[^"]*"|\[[^\]]*\]/g, ''))) dateStyles.add(i);
        });
      }
    }
    // Primeira folha do livro.
    const sheetName = Object.keys(files).filter((n) => /worksheets\/sheet\d+\.xml$/.test(n)).sort((a, b) => Number(a.match(/(\d+)\.xml$/)[1]) - Number(b.match(/(\d+)\.xml$/)[1]))[0];
    const sheet = sheetName && xml(sheetName);
    if (!sheet) return [];
    return tag(sheet, 'row').map((r) => {
      const row = [];
      tag(r, 'c').forEach((c) => {
        const i = colIndex(c.getAttribute('r') || '');
        const t = c.getAttribute('t');
        const vEl = tag(c, 'v')[0];
        let val = vEl ? vEl.textContent : '';
        if (t === 's') val = strings[Number(val)] ?? '';
        else if (t === 'inlineStr') val = tag(c, 't').map((x) => x.textContent).join('');
        else if (t !== 'str' && t !== 'b' && val !== '' && dateStyles.has(Number(c.getAttribute('s')))) val = excelDate(val);
        row[i >= 0 ? i : row.length] = String(val).trim();
      });
      return Array.from(row, (x) => x ?? '');
    }).filter((r) => r.some((x) => x !== ''));
  }

  /* ---------- Excel antigo (.xls, BIFF8 dentro de um "Compound File") ---------- */
  /** Lê o fluxo "Workbook" de um ficheiro OLE/CFB. */
  function cfbStream(b, wanted = /^(workbook|book)$/i) {
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    const u16 = (o) => dv.getUint16(o, true);
    const u32 = (o) => dv.getUint32(o, true);
    if (u32(0) !== 0xe011cfd0) throw new Error('Este ficheiro .xls não é um Excel válido.');
    const ssz = 1 << u16(30);
    const msz = 1 << u16(32);
    const sec = (n) => 512 + n * ssz;
    // DIFAT: primeiros 109 sectores da FAT no cabeçalho; os restantes numa cadeia de sectores.
    const fatSecs = [];
    for (let i = 0; i < 109; i++) { const v = u32(76 + i * 4); if (v < 0xfffffffa) fatSecs.push(v); }
    for (let d = u32(68), n = u32(72); n > 0 && d < 0xfffffffa; n--) {
      for (let i = 0; i < ssz / 4 - 1; i++) { const v = u32(sec(d) + i * 4); if (v < 0xfffffffa) fatSecs.push(v); }
      d = u32(sec(d) + ssz - 4);
    }
    const fat = [];
    fatSecs.forEach((f) => { for (let i = 0; i < ssz / 4; i++) fat.push(u32(sec(f) + i * 4)); });
    const chain = (start, table, guard = 1e6) => {
      const out = [];
      for (let s = start; s < 0xfffffffa && out.length < guard; s = table[s]) out.push(s);
      return out;
    };
    const readChain = (start, size) => {
      const out = new Uint8Array(size);
      let o = 0;
      for (const s of chain(start, fat)) {
        const n = Math.min(ssz, size - o);
        if (n <= 0) break;
        out.set(b.subarray(sec(s), sec(s) + n), o);
        o += n;
      }
      return out;
    };
    // Directório.
    const dirSecs = chain(u32(48), fat);
    const dir = readChain(u32(48), dirSecs.length * ssz);
    const ddv = new DataView(dir.buffer);
    const entries = [];
    for (let o = 0; o + 128 <= dir.length; o += 128) {
      const nl = ddv.getUint16(o + 64, true);
      let name = '';
      for (let i = 0; i < Math.max(0, nl / 2 - 1); i++) name += String.fromCharCode(ddv.getUint16(o + i * 2, true));
      entries.push({ name, type: dir[o + 66], start: ddv.getUint32(o + 116, true), size: ddv.getUint32(o + 120, true) });
    }
    const e = entries.find((x) => x.type === 2 && wanted.test(x.name));
    if (!e) throw new Error('Este .xls não tem folha de cálculo.');
    if (e.size >= u32(56)) return readChain(e.start, e.size);
    // Fluxo pequeno: está no "mini stream" (dentro do fluxo da raiz), com a sua própria tabela.
    const root0 = entries.find((x) => x.type === 5);
    const mini = readChain(root0.start, root0.size);
    const mfatBytes = readChain(u32(60), Math.max(1, u32(64)) * ssz);
    const mdv = new DataView(mfatBytes.buffer);
    const mfat = Array.from({ length: mfatBytes.length / 4 }, (_, i) => mdv.getUint32(i * 4, true));
    const out = new Uint8Array(e.size);
    let o = 0;
    for (const s of chain(e.start, mfat)) {
      const n = Math.min(msz, e.size - o);
      if (n <= 0) break;
      out.set(mini.subarray(s * msz, s * msz + n), o);
      o += n;
    }
    return out;
  }

  /** Formatos de data (números de série do Excel que são datas). */
  const isDateFormat = (code) => /[dy]/i.test(String(code).replace(/"[^"]*"|\[[^\]]*\]|\\./g, '')) && !/^general$/i.test(code);
  const BUILTIN_DATE = new Set([14, 15, 16, 17, 22, 45, 46, 47]);

  /**
   * Excel 97-2003 (.xls): devolve as linhas da primeira folha com dados (texto; números como "-12.5";
   * datas como AAAA-MM-DD). Lê textos partilhados (SST, mesmo partidos em CONTINUE), números, RK, MULRK,
   * fórmulas e etiquetas.
   */
  function parseXLS(bytes) {
    const wb = cfbStream(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
    const dv = new DataView(wb.buffer, wb.byteOffset, wb.byteLength);
    const recs = [];
    for (let o = 0; o + 4 <= wb.length;) {
      const type = dv.getUint16(o, true);
      const len = dv.getUint16(o + 2, true);
      recs.push({ type, off: o + 4, len });
      o += 4 + len;
    }
    const u16 = (o) => dv.getUint16(o, true);
    const u32 = (o) => dv.getUint32(o, true);
    const latin = (o, n) => { let s = ''; for (let i = 0; i < n; i++) s += String.fromCharCode(wb[o + i]); return s; };
    const utf16 = (o, n) => { let s = ''; for (let i = 0; i < n; i++) s += String.fromCharCode(u16(o + i * 2)); return s; };
    /** XLUnicodeString num registo (cch de 16 bits ou 8 bits). */
    const xlString = (o, wide = true) => {
      const cch = wide ? u16(o) : wb[o];
      const p = o + (wide ? 2 : 1);
      const flags = wb[p];
      let q = p + 1;
      if (flags & 0x08) q += 2;
      if (flags & 0x04) q += 4;
      return flags & 0x01 ? utf16(q, cch) : latin(q, cch);
    };
    const rk = (v) => {
      let n = v & 0x02 ? (v >> 2) : new DataView(new Uint32Array([0, v & 0xfffffffc]).buffer).getFloat64(0, true);
      if (v & 0x01) n /= 100;
      return n;
    };

    // Globais: textos partilhados, formatos e estilos (para saber que números são datas), folhas.
    const sst = [];
    const formats = {};
    const xfFmt = [];
    const sheets = [];
    for (let i = 0; i < recs.length; i++) {
      const r = recs[i];
      if (r.type === 0x00fc) {
        // SST: os textos podem continuar em registos CONTINUE (0x003C); ao mudar de registo a meio de um
        // texto, vem um novo byte de flags (8 ou 16 bits).
        const parts = [r];
        for (let j = i + 1; j < recs.length && recs[j].type === 0x003c; j++) parts.push(recs[j]);
        let k = 0;
        let o = r.off + 8;
        let end = r.off + r.len;
        const next = () => { k++; o = parts[k].off; end = o + parts[k].len; };
        const unique = u32(r.off + 4);
        for (let n = 0; n < unique && k < parts.length; n++) {
          if (o >= end) { if (k + 1 >= parts.length) break; next(); }
          const cch = u16(o);
          let flags = wb[o + 2];
          o += 3;
          let runs = 0;
          let ext = 0;
          if (flags & 0x08) { runs = u16(o); o += 2; }
          if (flags & 0x04) { ext = u32(o); o += 4; }
          let s = '';
          let left = cch;
          while (left > 0) {
            if (o >= end) { next(); flags = (flags & ~0x01) | (wb[o] & 0x01); o += 1; }
            const w = flags & 0x01 ? 2 : 1;
            const take = Math.min(left, Math.floor((end - o) / w));
            s += w === 2 ? utf16(o, take) : latin(o, take);
            o += take * w;
            left -= take;
          }
          // Saltar a formatação (runs) e a parte extra, que também podem atravessar registos.
          let skip = runs * 4 + ext;
          while (skip > 0) {
            if (o >= end) { if (k + 1 >= parts.length) break; next(); }
            const t = Math.min(skip, end - o);
            o += t;
            skip -= t;
          }
          sst.push(s);
        }
      } else if (r.type === 0x041e) {
        formats[u16(r.off)] = xlString(r.off + 2);
      } else if (r.type === 0x00e0) {
        xfFmt.push(u16(r.off + 2));
      } else if (r.type === 0x0085) {
        sheets.push({ pos: u32(r.off), hidden: wb[r.off + 4] & 0x03, kind: wb[r.off + 5] });
      }
    }
    const isDateXf = (xf) => {
      const f = xfFmt[xf];
      return BUILTIN_DATE.has(f) || (f in formats && isDateFormat(formats[f]));
    };
    const numCell = (n, xf) => (isDateXf(xf) && n > 0 && n < 2958466 ? excelDate(n) : String(Math.round(n * 1e6) / 1e6));

    const readSheet = (pos) => {
      const rows = [];
      const put = (r, c, v) => { (rows[r] ||= [])[c] = String(v ?? '').trim(); };
      let start = recs.findIndex((x) => x.off - 4 === pos);
      if (start < 0) return [];
      let pendingFormula = null;
      for (let i = start + 1; i < recs.length; i++) {
        const { type, off, len } = recs[i];
        if (type === 0x000a) break; // EOF da folha
        if (type === 0x00fd) put(u16(off), u16(off + 2), sst[u32(off + 6)]);
        else if (type === 0x0203) put(u16(off), u16(off + 2), numCell(dv.getFloat64(off + 6, true), u16(off + 4)));
        else if (type === 0x027e) put(u16(off), u16(off + 2), numCell(rk(u32(off + 6)), u16(off + 4)));
        else if (type === 0x00bd) {
          const r = u16(off);
          const first = u16(off + 2);
          const n = (len - 6) / 6;
          for (let k = 0; k < n; k++) put(r, first + k, numCell(rk(u32(off + 4 + k * 6 + 2)), u16(off + 4 + k * 6)));
        } else if (type === 0x0204 || type === 0x00d6) put(u16(off), u16(off + 2), xlString(off + 6));
        else if (type === 0x0006) {
          const r = u16(off);
          const c = u16(off + 2);
          if (u16(off + 12) === 0xffff) {
            const kind = wb[off + 6];
            if (kind === 0) pendingFormula = [r, c]; // o texto vem no registo STRING a seguir
            else if (kind === 1) put(r, c, wb[off + 8] ? 'TRUE' : 'FALSE');
          } else put(r, c, numCell(dv.getFloat64(off + 6, true), u16(off + 4)));
        } else if (type === 0x0207 && pendingFormula) {
          put(pendingFormula[0], pendingFormula[1], xlString(off));
          pendingFormula = null;
        } else if (type === 0x0205) {
          if (!wb[off + 7]) put(u16(off), u16(off + 2), String(wb[off + 6]));
        }
      }
      const width = Math.max(0, ...rows.filter(Boolean).map((r) => r.length));
      return rows.filter(Boolean).map((r) => Array.from({ length: width }, (_, c) => r[c] ?? ''))
        .filter((r) => r.some((x) => x !== ''));
    };
    for (const sh of sheets.filter((x) => x.kind === 0)) {
      const rows = readSheet(sh.pos);
      if (rows.length) return rows;
    }
    return [];
  }

  /** Detecta o tipo pelo conteúdo (não pela extensão) e devolve a tabela. */
  async function readTable(buf, { DOMParserImpl } = {}) {
    const b = new Uint8Array(buf);
    if (b[0] === 0x50 && b[1] === 0x4b) return parseXLSX(b, DOMParserImpl);
    // PDF ("%PDF"): extratos em PDF (ex.: cartão Wizink), lidos com o pdf.js (js/extrato-pdf.js).
    if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) {
      if (!root.ExtratoPDF) throw new Error('Este portal ainda não lê PDF.');
      return root.ExtratoPDF.read(b);
    }
    if (b[0] === 0xd0 && b[1] === 0xcf) {
      try {
        return parseXLS(b);
      } catch (e) {
        throw new Error('Não consegui ler este Excel (.xls): pode estar incompleto ou protegido. Experimentem descarregá-lo outra vez, ou exportar em CSV / Excel (.xlsx).');
      }
    }
    // Texto: UTF-8, ou Windows-1252 (muitos bancos portugueses) se houver caracteres inválidos.
    let text = new TextDecoder('utf-8').decode(b);
    if (text.includes('�')) text = new TextDecoder('windows-1252').decode(b);
    if (/^\s*</.test(text) && /<table/i.test(text)) return parseHTML(text, DOMParserImpl);
    return parseCSV(text);
  }

  root.Folhas = { parseCSV, sniff, parseHTML, parseXLSX, parseXLS, unzip, readTable, colIndex, excelDate };
})(globalThis);
