/*
 * Extrai uma receita de uma página web a partir dos dados estruturados schema.org/Recipe
 * (JSON-LD), que a maioria dos sites de receitas publica para os motores de busca.
 */

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ordm: 'º', ordf: 'ª', deg: '°', frac12: '½', frac14: '¼', frac34: '¾' };

const MARKS = { acute: '\u0301', grave: '\u0300', circ: '\u0302', tilde: '\u0303', cedil: '\u0327', uml: '\u0308' };

export function decodeEntities(s) {
  return String(s ?? '')
    .replace(/&([a-z])(acute|grave|circ|tilde|cedil|uml);/gi, (_, l, m) => `${l}${MARKS[m.toLowerCase()]}`.normalize('NFC'))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

const clean = (s) => decodeEntities(String(s ?? '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();

function typesOf(node) {
  const t = node && node['@type'];
  return (Array.isArray(t) ? t : [t]).filter(Boolean).map(String);
}

function findRecipe(node, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 6) return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const r = findRecipe(n, depth + 1);
      if (r) return r;
    }
    return null;
  }
  if (typesOf(node).some((t) => /(^|\/)Recipe$/i.test(t))) return node;
  for (const k of ['@graph', 'mainEntity', 'mainEntityOfPage', 'itemListElement', 'item']) {
    const r = findRecipe(node[k], depth + 1);
    if (r) return r;
  }
  return null;
}

function instructions(value) {
  const out = [];
  const walk = (v) => {
    if (!v) return;
    if (typeof v === 'string') {
      // Texto corrido: separar por linhas ou por passos numerados.
      clean(v.replace(/<\/(p|li|br)\s*>|<br\s*\/?>/gi, '\n')).split(/\n|(?=\b\d+\.\s)/).forEach((x) => {
        const t = clean(x).replace(/^\d+\.\s*/, '');
        if (t) out.push(t);
      });
      return;
    }
    if (Array.isArray(v)) { v.forEach(walk); return; }
    if (typeof v === 'object') {
      if (v.itemListElement) { walk(v.itemListElement); return; }
      if (v.text) { walk(v.text); return; }
      if (v.name) walk(v.name);
    }
  };
  walk(value);
  return out;
}

function image(value, base) {
  let v = value;
  if (Array.isArray(v)) [v] = v;
  if (v && typeof v === 'object') v = v.url || v.contentUrl || v['@id'];
  if (!v || typeof v !== 'string') return '';
  try { return new URL(v, base).href; } catch (e) { return ''; }
}

/** "PT1H30M" → 90 */
export function isoMinutes(v) {
  const m = String(v || '').match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/i);
  if (!m) return 0;
  return (Number(m[1] || 0) * 1440) + (Number(m[2] || 0) * 60) + Number(m[3] || 0);
}

function parseJson(text) {
  const t = text.trim().replace(/^<!\[CDATA\[|\]\]>$/g, '').replace(/^\/\*[\s\S]*?\*\//, '').trim();
  try { return JSON.parse(t); } catch (e) { /* tenta limpar */ }
  try { return JSON.parse(t.replace(/,\s*([}\]])/g, '$1').replace(/[\u0000-\u001f]+/g, ' ')); } catch (e) { return null; }
}

/** Devolve { title, ingredients[], steps[], image, servings, minutes, category } ou null. */
export function extractRecipe(html, pageUrl) {
  const blocks = [...String(html).matchAll(/<script[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const [, text] of blocks) {
    const data = parseJson(text);
    const r = findRecipe(data);
    if (!r) continue;
    const ingredients = [].concat(r.recipeIngredient || r.ingredients || []).map(clean).filter(Boolean);
    if (!ingredients.length) continue;
    const yieldText = [].concat(r.recipeYield || [])[0];
    const minutes = isoMinutes(r.totalTime) || (isoMinutes(r.prepTime) + isoMinutes(r.cookTime));
    return {
      title: clean(r.name) || 'Receita',
      ingredients,
      steps: instructions(r.recipeInstructions),
      image: image(r.image, pageUrl),
      servings: parseInt(String(yieldText ?? '').match(/\d+/)?.[0] || '0', 10) || 0,
      minutes,
      category: clean([].concat(r.recipeCategory || [])[0] || ''),
    };
  }
  return null;
}
