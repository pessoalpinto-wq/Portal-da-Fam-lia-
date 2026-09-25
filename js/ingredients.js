/*
 * Percebe linhas de ingredientes em português ("400 g de bacalhau demolhado", "2 dentes de alho",
 * "sal q.b.") e compara-as com a despensa. Script "clássico": define globalThis.Ingredients.
 */
(function (root) {
  const strip = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const NUM = '(?:\\d+(?:[.,]\\d+)?(?:\\s*\\/\\s*\\d+)?|[½¼¾⅓⅔]|\\d+\\s*[½¼¾]|uma?|dois|duas|tr[eê]s|quatro|cinco|seis|sete|oito|dez|doze|meia|meio)';
  const QTY_RE = new RegExp(`^(${NUM}(?:\\s*(?:a|-|–|ou)\\s*${NUM})?)(?=\\s|[a-zA-Z]|$)\\s*`, 'i');

  const UNITS = [
    'colheres de sopa', 'colher de sopa', 'colher(es) de sopa', 'c. de sopa', 'c. sopa', 'c.s.',
    'colheres de chá', 'colher de chá', 'colher(es) de chá', 'colheres de sobremesa', 'colher de sobremesa',
    'c. de chá', 'c. chá', 'c.c.', 'colheres', 'colher',
    'chávenas', 'chávena', 'copos', 'copo', 'dentes', 'dente', 'latas', 'lata', 'pacotes', 'pacote',
    'embalagens', 'embalagem', 'emb.', 'unidades', 'unidade', 'un.', 'un', 'raminhos', 'raminho', 'ramos', 'ramo',
    'fatias', 'fatia', 'pitadas', 'pitada', 'mãos cheias', 'mão cheia', 'punhado', 'cubos', 'cubo',
    'folhas', 'folha', 'postas', 'posta', 'talos', 'talo', 'cabeças', 'cabeça', 'tiras', 'medidas', 'medida',
    'kg', 'gr', 'grs', 'g', 'ml', 'dl', 'cl', 'l', 'lt',
  ].sort((a, b) => b.length - a.length);
  const UNIT_RE = new RegExp(`^(${UNITS.map(escapeRe).join('|')})(?![a-zà-ú])\\.?\\s*(?:de\\s+|d['’]\\s*)?`, 'i');

  // Palavras que descrevem o ingrediente mas não o identificam.
  const DESCRIPTORS = [
    'picad[oa]s?', 'finamente', 'grosseiramente', 'cortad[oa]s?(?: em [a-z ]+)?', 'ralad[oa]s?', 'fresc[oa]s?', 'grandes?', 'pequen[oa]s?',
    'medi[oa]s?', 'maduros?', 'maduras?', 'desfiad[oa]s?', 'demolhad[oa]s?', 'cozid[oa]s?', 'descascad[oa]s?', 'inteir[oa]s?',
    'em cubos', 'as rodelas', 'em rodelas', 'laminad[oa]s?', 'esmagad[oa]s?', 'escorrid[oa]s?', 'batid[oa]s?', 'derretid[oa]s?',
    'q\\.?\\s?b\\.?', 'a gosto', 'para (?:polvilhar|decorar|servir|untar|fritar|acompanhar|temperar|o molho)', 'extra virgem', 'virgem extra', 'sem pele', 'sem espinhas',
    'aproximadamente', 'cerca de', 'bem', 'de boa qualidade',
  ];
  const DESC_RE = new RegExp(`\\b(?:${DESCRIPTORS.join('|')})\\b`, 'g');

  // Palavras que já estão no singular apesar de acabarem em "s" (acentos já retirados).
  const INVARIABLE = new Set(['frances', 'ingles', 'portugues', 'pires', 'lapis', 'ananas', 'gras', 'mais', 'tres', 'seis', 'pires']);

  function singular(w) {
    if (w.length <= 3 || INVARIABLE.has(w)) return w;
    if (/oes$|aes$/.test(w)) return `${w.slice(0, -3)}ao`;
    if (/ns$/.test(w)) return `${w.slice(0, -2)}m`;
    if (/[^aeiou]res$/.test(w)) return w.slice(0, -1); // espinafres → espinafre
    if (/(r|z)es$/.test(w)) return w.slice(0, -2); // colheres → colher, arrozes → arroz
    if (/is$/.test(w) && w.length > 4) return `${w.slice(0, -2)}l`;
    if (/s$/.test(w) && !/(ss|us)$/.test(w)) return w.slice(0, -1);
    return w;
  }

  /** Chave de comparação: sem acentos, sem descrições, no singular ("Cebolas picadas" → "cebola"). */
  function key(name) {
    const k = strip(name).replace(/\(.*?\)/g, ' ').replace(/[,;].*$/, ' ').replace(DESC_RE, ' ')
      .replace(/[^a-z0-9 ]/g, ' ').replace(/\b(de|do|da|dos|das|e|ou|a|o|os|as|em|com|para)\s*$/g, ' ')
      .replace(/^\s*(de|do|da|dos|das)\b/, ' ')
      .split(/\s+/).filter(Boolean).map(singular).join(' ');
    return k.replace(/\s+(de|do|da|e|ou)$/, '').trim();
  }

  /** "400 g de bacalhau demolhado" → { qty: "400 g", name: "bacalhau demolhado", key: "bacalhau" } */
  function parse(line) {
    const original = String(line || '').replace(/\s+/g, ' ').trim();
    let s = original;
    let qty = '';
    const q = s.match(QTY_RE);
    if (q) { qty = q[1].trim(); s = s.slice(q[0].length); }
    const u = s.match(UNIT_RE);
    if (u) {
      qty = `${qty} ${u[1]}`.trim();
      s = s.slice(u[0].length);
    } else {
      s = s.replace(/^(de|d['’])\s+/i, '');
    }
    if (!qty && /\bq\.?\s?b\.?|\ba gosto\b/i.test(original)) qty = 'q.b.';
    const name = s.replace(/\bq\.?\s?b\.?/gi, '').replace(/\ba gosto\b/gi, '').replace(/\s{2,}/g, ' ').replace(/^[\s,.-]+|[\s,.-]+$/g, '').trim();
    return { qty, name: name || original, key: key(name || original) };
  }

  /** O ingrediente (chave) está coberto por algo da despensa (chave)? */
  function matches(ingKey, pantryKey) {
    if (!ingKey || !pantryKey) return false;
    if (ingKey === pantryKey) return true;
    return ` ${ingKey} `.includes(` ${pantryKey} `);
  }

  const CATS = [
    ['Talho/Peixaria', /\b(frango|peru|pato|galinha|porco|vaca|novilho|carne|bife|entrecosto|costeleta|chourico|farinheira|toucinho|bacon|fiambre|presunto|salsicha|bacalhau|pescada|salmao|atum fresco|dourada|robalo|carapau|sardinha|polvo|lula|camarao|ameijoa|marisco|peixe|filete|posta)\b/],
    ['Frescos', /\b(batata|cebola|alho|cenoura|tomate|alface|couve|brocolo|espinafre|courgette|pimento|pepino|cogumelo|abobora|alho frances|feijao verde|limao|laranja|maca|banana|fruta|salsa|coentro|hortela|manjericao|nabo|grelo|ervilha fresca|beringela|legume|ovo|natas|leite|manteiga|queijo|iogurte|mozzarella)\b/],
    ['Padaria', /\b(pao|broa|tosta|baguete|tortilha|wrap)\b/],
  ];
  function guessCategory(k) {
    const found = CATS.find(([, re]) => re.test(k));
    return found ? found[0] : 'Mercearia';
  }

  const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  const WORD_NUM = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, dez: 10, doze: 12, meia: 0.5, meio: 0.5 };
  const FRACTIONS = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3 };

  function number(txt) {
    const t = strip(txt).trim();
    if (t in WORD_NUM) return WORD_NUM[t];
    if (txt.trim() in FRACTIONS) return FRACTIONS[txt.trim()];
    let m = t.match(/^(\d+)\s*\/\s*(\d+)$/);
    if (m) return Number(m[1]) / Number(m[2]);
    m = t.match(/^(\d+)\s*([½¼¾])$/);
    if (m) return Number(m[1]) + FRACTIONS[m[2]];
    m = t.match(/^\d+(?:[.,]\d+)?$/);
    return m ? Number(t.replace(',', '.')) : NaN;
  }

  /** Soma quantidades com a mesma unidade: ["2 dentes","2 dentes","1 cabeça"] → "4 dentes + 1 cabeça". */
  function sumQty(list) {
    const groups = new Map();
    const other = [];
    list.forEach((q) => {
      const m = String(q).trim().match(new RegExp(`^(${NUM})\\s*(.*)$`, 'i'));
      const n = m ? number(m[1]) : NaN;
      if (!m || Number.isNaN(n)) { if (q && !other.includes(q)) other.push(q); return; }
      const unit = m[2].trim();
      const k = key(unit);
      const g = groups.get(k) || { total: 0, unit };
      g.total += n;
      if (unit.length > g.unit.length) g.unit = unit; // prefere a forma mais longa ("dentes" em vez de "dente")
      groups.set(k, g);
    });
    const fmt = (n) => String(Math.round(n * 100) / 100).replace('.', ',');
    return [...[...groups.values()].map((g) => `${fmt(g.total)}${g.unit ? ` ${g.unit}` : ''}`), ...other].join(' + ');
  }

  /**
   * Receita para air fryer? Devolve { airfryer, af } com a temperatura e o tempo indicados
   * no passo da air fryer (ex.: "Programe a 180ºc, durante 18 minutos" → "180 °C · 18 min").
   */
  function airFryer(r) {
    const text = `${r.title || ''} ${(r.steps || []).join(' ')} ${(r.ingredients || []).join(' ')}`;
    if (!/air\s?-?fr[yi]er|airfryer|fritadeira sem [oó]leo|fritadeira de ar/i.test(text)) return { airfryer: false, af: '' };
    const steps = (r.steps || []).join(' ');
    const m = steps.match(/(\d{3})\s*(?:º|°|graus)\s*c?\b[^.]{0,60}?(\d{1,3})\s*min/i);
    const temp = m ? m[1] : steps.match(/(\d{3})\s*(?:º|°|graus)/i)?.[1];
    return { airfryer: true, af: [temp && `${temp} °C`, m && `${m[2]} min`].filter(Boolean).join(' · ') };
  }

  root.Ingredients = { parse, key, matches, guessCategory, capitalize, strip, sumQty, airFryer };
})(globalThis);
