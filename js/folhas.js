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
    const tag = (el, name) => [...el.getElementsByTagName(name)];
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

  /** Detecta o tipo pelo conteúdo (não pela extensão) e devolve a tabela. */
  async function readTable(buf, { DOMParserImpl } = {}) {
    const b = new Uint8Array(buf);
    if (b[0] === 0x50 && b[1] === 0x4b) return parseXLSX(b, DOMParserImpl);
    if (b[0] === 0xd0 && b[1] === 0xcf) {
      throw new Error('Este é um Excel antigo (.xls). No homebanking, escolham exportar em CSV ou em Excel (.xlsx); ou abram-no no Excel e "Guardar como" .xlsx ou CSV.');
    }
    // Texto: UTF-8, ou Windows-1252 (muitos bancos portugueses) se houver caracteres inválidos.
    let text = new TextDecoder('utf-8').decode(b);
    if (text.includes('�')) text = new TextDecoder('windows-1252').decode(b);
    if (/^\s*</.test(text) && /<table/i.test(text)) return parseHTML(text, DOMParserImpl);
    return parseCSV(text);
  }

  root.Folhas = { parseCSV, sniff, parseHTML, parseXLSX, unzip, readTable, colIndex, excelDate };
})(globalThis);
