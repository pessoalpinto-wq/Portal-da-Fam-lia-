/*
 * Juntar compras por voz: perceber uma frase ditada ("leite, ovos, dois quilos de batatas e detergente")
 * e transformá-la em produtos da lista, com quantidade e categoria. Também ouve o microfone (Web Speech API).
 * Script "clássico": define globalThis.Voz. A parte pura (parse) é testada em tests/voz.test.mjs.
 */
(function (root) {
  const strip = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const NUMS = {
    um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10,
    onze: 11, doze: 12, treze: 13, catorze: 14, quinze: 15, dezasseis: 16, vinte: 20, trinta: 30, cem: 100, duzentos: 200,
    duzentas: 200, trezentos: 300, trezentas: 300, quinhentos: 500, quinhentas: 500,
  };
  // Unidades ditas → como aparecem na lista. [singular, plural] (null = abreviatura sem plural).
  const UNITS = [
    [/^(kg|quilos?|kilos?|quilogramas?)$/, 'kg', null],
    [/^(g|gr|gramas?)$/, 'g', null],
    [/^(l|lt|litros?)$/, 'L', null],
    [/^(ml|mililitros?)$/, 'ml', null],
    [/^latas?$/, 'lata', 'latas'], [/^pacotes?$/, 'pacote', 'pacotes'], [/^garrafas?$/, 'garrafa', 'garrafas'],
    [/^garrafoes?$/, 'garrafão', 'garrafões'], [/^frascos?$/, 'frasco', 'frascos'], [/^caixas?$/, 'caixa', 'caixas'],
    [/^sacos?$/, 'saco', 'sacos'], [/^rolos?$/, 'rolo', 'rolos'], [/^(embalagem|embalagens)$/, 'embalagem', 'embalagens'],
    [/^unidades?$/, '', ''], [/^molhos?$/, 'molho', 'molhos'], [/^cabecas?$/, 'cabeça', 'cabeças'],
    [/^tabletes?$/, 'tablete', 'tabletes'], [/^packs?$/, 'pack', 'packs'], [/^cuvetes?$/, 'cuvete', 'cuvetes'],
  ];
  // Separadores entre produtos (o reconhecimento de voz raramente põe vírgulas).
  const SEP = /\s*(?:[,;.\n]|\s(?:e tambem|e mais|e|mais|tambem|depois)\s)\s*/i;
  // Palavras de "conversa" no início de cada pedaço.
  const FILLER = /^(?:(?:entao|olha|ok|pronto|bom|tambem|ainda|e|mais)\s+)*(?:(?:eu\s+)?(?:preciso|precisamos|temos|tenho)\s+(?:de\s+)?(?:comprar\s+)?|(?:falta|faltam|acabou|acabaram)\s+(?:o\s+|a\s+|os\s+|as\s+)?|(?:nao\s+ha|ja\s+nao\s+ha)\s+|(?:comprar|compra|poe|poem|junta|juntar|adiciona|adicionar|acrescenta|mete)\s+(?:na\s+lista\s+)?)?(?:(?:o|a|os|as)\s+)?/;
  // Pedaços que são só conversa ("por favor", "é tudo").
  const NOISE = /^(?:por favor|se faz favor|obrigad[oa]|so isso|e tudo|e so|mais nada|na lista|para a lista|pronto|ok|ja esta|acabou)$/;
  const TAIL = /\s+(?:na lista|para a lista|por favor|se faz favor|tambem)$/;

  const isNum = (w) => /^\d+([.,]\d+)?$/.test(w) || strip(w) in NUMS || /^(meia|meio)$/.test(strip(w));
  const unitOf = (w) => UNITS.find(([re]) => re.test(strip(w)));

  /** Chave para comparar com o catálogo (sem acentos, singular simples). */
  const keyOf = (s) => strip(s).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean)
    .map((w) => (w.length > 3 && /s$/.test(w) && !/ss$/.test(w) ? w.replace(/(oe|ae)s$/, 'ao').replace(/(r|z)es$/, '$1').replace(/s$/, '') : w))
    .join(' ');

  /**
   * Índice do catálogo: chave → produto. As primeiras palavras de um produto ("leite" de "Leite meio-gordo")
   * também contam como conhecidas, com a categoria mais comum entre esses produtos (empate → Mercearia).
   */
  function index(catalog = []) {
    const byKey = new Map();
    catalog.forEach((i) => { const k = keyOf(i.nome); if (k && !byKey.has(k)) byKey.set(k, i); });
    const prefixes = new Map();
    catalog.forEach((i) => {
      const w = keyOf(i.nome).split(' ');
      for (let n = 1; n < w.length; n++) {
        const k = w.slice(0, n).join(' ');
        if (!prefixes.has(k)) prefixes.set(k, []);
        prefixes.get(k).push(i.categoria);
      }
    });
    prefixes.forEach((cats, k) => {
      if (byKey.has(k)) return;
      const count = {};
      cats.forEach((c) => { count[c] = (count[c] || 0) + 1; });
      const best = Object.keys(count).sort((a, b) => count[b] - count[a] || (b === 'Mercearia') - (a === 'Mercearia'))[0];
      byKey.set(k, { nome: '', categoria: best, generic: true });
    });
    return byKey;
  }

  /** Quantidade no início das palavras: { qty, used } (used = n.º de palavras consumidas). */
  function readQty(words) {
    let i = 0;
    let n = null;
    const w0 = strip(words[0] || '');
    if (w0 === 'meia' && /^duzias?$/.test(strip(words[1] || ''))) { n = 6; i = 2; }
    else if (/^duzias?$/.test(w0)) { n = 12; i = 1; }
    else if (isNum(words[0] || '')) {
      n = /^(meia|meio)$/.test(w0) ? 0.5 : Number(String(words[0]).replace(',', '.')) || NUMS[w0];
      i = 1;
      if (/^duzias?$/.test(strip(words[1] || ''))) { n *= 12; i = 2; }
      else if (strip(words[1] || '') === 'e' && /^(meio|meia)$/.test(strip(words[2] || ''))) { n += 0.5; i = 3; }
    }
    let unit = null;
    if (words[i] && unitOf(words[i])) { unit = unitOf(words[i]); i++; }
    if (n == null && !unit) return { qty: '', used: 0 };
    if (/^(de|do|da|dos|das|d)$/.test(strip(words[i] || ''))) i++;
    if (n == null) n = 1;
    let qty;
    if (!unit) qty = n === 1 ? '' : String(n).replace('.', ',');
    else if (unit[2] === null) qty = n === 0.5 && unit[1] === 'kg' ? '500 g' : n === 0.5 && unit[1] === 'L' ? '½ L' : `${String(n).replace('.', ',')} ${unit[1]}`;
    else if (!unit[1]) qty = n === 1 ? '' : String(n);
    else qty = `${String(n).replace('.', ',')} ${n === 1 ? unit[1] : unit[2]}`;
    return { qty, used: i };
  }

  /** Maior produto conhecido que começa nas palavras `words` (até 5 palavras). */
  function longestKnown(words, byKey) {
    for (let n = Math.min(5, words.length); n >= 1; n--) {
      const item = byKey.get(keyOf(words.slice(0, n).join(' ')));
      if (item) return { item, n };
    }
    return null;
  }

  /**
   * Um pedaço sem separadores ("leite ovos duas latas de atum") → produtos.
   * Só parte em vários quando todos os bocados são produtos conhecidos (ou começam por uma quantidade);
   * senão fica um produto só ("pão de forma integral").
   */
  function splitChunk(words, byKey) {
    const out = [];
    let i = 0;
    let unknown = false;
    while (i < words.length) {
      const q = readQty(words.slice(i));
      let j = i + q.used;
      if (j >= words.length) { if (q.used) out.push({ qty: q.qty, words: [] }); break; }
      const k = longestKnown(words.slice(j), byKey);
      if (k) { out.push({ qty: q.qty, words: words.slice(j, j + k.n), item: k.item }); i = j + k.n; continue; }
      // Desconhecido: vai até à próxima quantidade.
      const start = j;
      j++;
      while (j < words.length && !isNum(words[j]) && !/^(meia|duzia)$/.test(strip(words[j]))) j++;
      out.push({ qty: q.qty, words: words.slice(start, j) });
      if (!q.used) unknown = true;
      i = j;
    }
    if (unknown && out.length > 1 && out.some((x) => !x.item && !x.qty)) {
      // Há bocados desconhecidos sem quantidade: mais seguro não partir as palavras.
      const segments = [];
      let cur = null;
      out.forEach((x) => {
        if (x.qty || !cur) { cur = { qty: x.qty, words: [...x.words] }; segments.push(cur); } else cur.words.push(...x.words);
      });
      return segments.map((x) => ({ ...x, item: byKey.get(keyOf(x.words.join(' '))) }));
    }
    return out.filter((x) => x.words.length);
  }

  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  /** Categoria para um produto desconhecido: a do primeiro produto do catálogo com a mesma 1.ª palavra. */
  function guessCategory(text, catalog) {
    const k = keyOf(text);
    const first = k.split(' ')[0];
    const hit = catalog.find((i) => keyOf(i.nome).split(' ')[0] === first);
    if (hit) return hit.categoria;
    return root.Ingredients?.guessCategory ? root.Ingredients.guessCategory(k) : 'Outro';
  }

  /**
   * Frase ditada → [{ text, qty, category, known }]. Sem repetidos.
   * @param {string} said
   * @param {Array} catalog  produtos do catálogo da família ({ nome, categoria })
   */
  function parse(said, catalog = []) {
    const byKey = index(catalog);
    let text = ` ${String(said || '').replace(/\s+/g, ' ').trim()} `;
    // Produtos com "e" no nome (ex.: "Bolachas de água e sal") não se partem.
    const keep = [];
    catalog.filter((i) => / e /i.test(i.nome)).forEach((i) => {
      const re = new RegExp(`(^|\\s)${strip(i.nome).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=\\s|[,.;]|$)`, 'gi');
      const plain = strip(text);
      let m;
      while ((m = re.exec(plain))) {
        const at = m.index + m[1].length;
        const ph = `§${keep.length}§`;
        keep.push(text.slice(at, at + i.nome.length));
        text = text.slice(0, at) + ph + text.slice(at + i.nome.length);
        break;
      }
    });
    const restore = (s) => s.replace(/§(\d+)§/g, (_, n) => keep[n]);
    const out = [];
    const seen = new Set();
    text.split(SEP).forEach((rawChunk) => {
      const chunk = strip(rawChunk).trim() ? rawChunk.trim() : '';
      if (!chunk) return;
      // Tira a "conversa" mantendo maiúsculas/acentos do que foi dito.
      if (NOISE.test(strip(chunk).replace(/[^a-z0-9 ]/g, '').trim())) return;
      const plain = strip(chunk);
      const f = plain.match(FILLER)?.[0].length || 0;
      let body = chunk.slice(f);
      const t = strip(body).match(TAIL);
      if (t) body = body.slice(0, body.length - t[0].length);
      const words = restore(body).split(/\s+/).filter(Boolean);
      if (!words.length) return;
      splitChunk(words, byKey).forEach(({ qty, words: w, item }) => {
        const said1 = w.join(' ').replace(/^[^\p{L}\d]+|[^\p{L}\d]+$/gu, '');
        if (!said1 || /^(e|o|a|os|as|de|mais)$/i.test(said1)) return;
        const hit = item || byKey.get(keyOf(said1));
        const known = hit && !hit.generic ? hit : null;
        const name = known ? known.nome : cap(said1);
        const k = keyOf(name);
        if (seen.has(k)) return;
        seen.add(k);
        out.push({ text: name, qty, category: hit ? hit.categoria : guessCategory(said1, catalog), known: !!known });
      });
    });
    return out;
  }

  /* ---------- Microfone (no browser) ---------- */
  const SR = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;

  /**
   * Ouve até `stop()` ou ~8 s de silêncio. Cada pausa vira um separador (", ").
   * @param {{ onText(final, interim), onState(listening, error?) }} cb
   * @returns {{ stop() }}
   */
  function listen({ onText, onState }) {
    if (!SR) { onState?.(false, 'unsupported'); return { stop() {} }; }
    let active = true;
    let lastHeard = Date.now();
    let rec = null;
    const start = () => {
      rec = new SR();
      rec.lang = 'pt-PT';
      rec.interimResults = true;
      rec.continuous = false; // no Android, o modo contínuo repete frases; recomeça-se a cada pausa
      rec.maxAlternatives = 1;
      rec.onresult = (e) => {
        lastHeard = Date.now();
        let fin = '';
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) fin += e.results[i][0].transcript;
          else interim += e.results[i][0].transcript;
        }
        onText?.(fin.trim(), interim.trim());
      };
      rec.onerror = (e) => {
        if (['not-allowed', 'service-not-allowed', 'audio-capture', 'network'].includes(e.error)) {
          active = false;
          onState?.(false, e.error);
        }
      };
      rec.onend = () => {
        if (active && Date.now() - lastHeard < 8000) {
          try { start(); return; } catch { /* segue para parar */ }
        }
        active = false;
        onState?.(false);
      };
      rec.start();
    };
    try {
      start();
      onState?.(true);
    } catch (e) {
      active = false;
      onState?.(false, 'start');
    }
    return { stop() { active = false; try { rec?.stop(); } catch { /* já parou */ } } };
  }

  root.Voz = { parse, keyOf, readQty, supported: !!SR, listen };
})(globalThis);
