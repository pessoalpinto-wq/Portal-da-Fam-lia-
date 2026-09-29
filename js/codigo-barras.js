/*
 * Código de barras e fotos dos produtos (Open Food Facts / Open Beauty Facts).
 *  - Ler o código com a câmara: no Android usa o leitor do próprio telemóvel (BarcodeDetector);
 *    no iPhone carrega a biblioteca ZXing (js/vendor/zxing.min.js) só quando é precisa.
 *  - Procurar o produto nas bases abertas: nome, marca, quantidade, foto e categoria.
 * Script "clássico": define globalThis.CodigoBarras. A parte pura (validar, ler a resposta,
 * categoria) é testada em tests/codigo-barras.test.mjs.
 */
(function (root) {
  /* ---------- Parte pura ---------- */
  const digits = (s) => String(s || '').replace(/\D/g, '');

  /** Confirma o dígito de controlo de EAN-13, EAN-8, UPC-A (12) e GTIN-14. */
  function valid(code) {
    const c = digits(code);
    if (![8, 12, 13, 14].includes(c.length) || /^0+$/.test(c)) return false;
    const body = c.slice(0, -1).split('').reverse().map(Number);
    const sum = body.reduce((n, d, i) => n + d * (i % 2 === 0 ? 3 : 1), 0);
    return (10 - (sum % 10)) % 10 === Number(c.at(-1));
  }

  // Categorias do Open Food Facts → categorias da lista de compras (a primeira que bater).
  const CAT_RULES = [
    ['Congelados', /frozen|surgel|congelad/],
    ['Talho/Peixaria', /meats?\b|poultr|chicken|beef|pork|sausage|hams?\b|fishes|seafood|peixe|carne/],
    ['Frescos', /dairies|dairy|milks?\b|yogh?urt|cheeses|butter|eggs|fresh|fruits?\b|vegetables|leite|queijo|iogurte|ovos/],
    ['Padaria', /breads|bakery|viennoiser|pao|pastr/],
    ['Bebidas', /beverages|drinks|waters|juices|sodas|wines|beers|coffees|teas\b|bebidas|sumos/],
    ['Higiene', /beauty|shampoo|hygien|soap|toothpaste|deodorant|cosmetic/],
    ['Limpeza', /cleaning|detergent|dishwash|laundry/],
    ['Animais', /pet-food|cat-food|dog-food|animais/],
  ];

  /** Categoria da lista a partir das categorias do Open Food Facts (por omissão: Mercearia). */
  function categoryOf(tags = [], fallback = 'Mercearia') {
    const t = tags.join(' ').toLowerCase();
    return (CAT_RULES.find(([, re]) => re.test(t)) || [fallback])[0];
  }

  /** Lê a resposta da API (v2) e devolve { code, name, brand, qty, img, category } ou null. */
  function fromApi(json, fallbackCategory) {
    const p = json?.product;
    if (!json || json.status !== 1 || !p) return null;
    const name = String(p.product_name_pt || p.product_name || p.generic_name || '').trim();
    const brand = String(p.brands || '').split(',')[0].trim();
    if (!name && !brand) return null;
    return {
      code: digits(json.code || p.code),
      name: name || brand,
      brand,
      qty: String(p.quantity || '').trim(),
      img: String(p.image_front_small_url || p.image_front_thumb_url || p.image_small_url || ''),
      category: categoryOf(p.categories_tags || [], fallbackCategory),
    };
  }

  /* ---------- Procurar o produto (browser) ---------- */
  const FIELDS = 'code,product_name,product_name_pt,generic_name,brands,quantity,image_front_small_url,image_front_thumb_url,image_small_url,categories_tags';
  const SOURCES = [
    ['https://world.openfoodfacts.org', 'Mercearia'],
    ['https://world.openbeautyfacts.org', 'Higiene'],
  ];
  const cache = new Map();

  async function getJson(url, ms = 8000) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), ms);
    try {
      const r = await fetch(url, { signal: ctl.signal });
      if (r.status === 404) return { status: 0 };
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } finally { clearTimeout(t); }
  }

  /** Procura nas bases abertas. Devolve o produto, null (não existe) ou lança erro (sem rede). */
  async function lookup(code) {
    const c = digits(code);
    if (cache.has(c)) return cache.get(c);
    let failed = 0;
    for (const [base, cat] of SOURCES) {
      try {
        const p = fromApi(await getJson(`${base}/api/v2/product/${c}.json?fields=${FIELDS}&lc=pt`), cat);
        if (p) { cache.set(c, p); return p; }
      } catch { failed++; }
    }
    if (failed === SOURCES.length) throw new Error('Sem ligação às bases de produtos');
    cache.set(c, null);
    return null;
  }

  /* ---------- Câmara ---------- */
  const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];
  let zxingLoading = null;

  function loadZxing() {
    if (root.ZXing) return Promise.resolve(root.ZXing);
    zxingLoading ||= new Promise((ok, fail) => {
      const s = document.createElement('script');
      s.src = 'js/vendor/zxing.min.js';
      s.onload = () => ok(root.ZXing);
      s.onerror = () => { zxingLoading = null; fail(new Error('Não foi possível carregar o leitor')); };
      document.head.appendChild(s);
    });
    return zxingLoading;
  }

  /** Um "detetor" com detect(video) → código ou null: o do telemóvel, ou o ZXing. */
  async function makeDetector() {
    if ('BarcodeDetector' in root) {
      try {
        const ok = await root.BarcodeDetector.getSupportedFormats();
        if (FORMATS.some((f) => ok.includes(f))) {
          const d = new root.BarcodeDetector({ formats: FORMATS.filter((f) => ok.includes(f)) });
          return async (video) => (await d.detect(video))[0]?.rawValue || null;
        }
      } catch { /* cai para o ZXing */ }
    }
    const Z = await loadZxing();
    const hints = new Map([[Z.DecodeHintType.POSSIBLE_FORMATS,
      [Z.BarcodeFormat.EAN_13, Z.BarcodeFormat.EAN_8, Z.BarcodeFormat.UPC_A, Z.BarcodeFormat.UPC_E]],
    [Z.DecodeHintType.TRY_HARDER, true]]);
    const reader = new Z.MultiFormatReader();
    reader.setHints(hints);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    return async (video) => {
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (!w || !h) return null;
      // Só a faixa do meio (onde está a moldura): mais rápido e mais fiável.
      const bh = Math.round(h * 0.5);
      canvas.width = w;
      canvas.height = bh;
      ctx.drawImage(video, 0, Math.round((h - bh) / 2), w, bh, 0, 0, w, bh);
      try {
        const bmp = new Z.BinaryBitmap(new Z.HybridBinarizer(new Z.HTMLCanvasElementLuminanceSource(canvas)));
        return reader.decodeWithState(bmp).getText();
      } catch { return null; }
    };
  }

  /**
   * Abre a câmara e devolve o código lido (ou o escrito à mão), ou null se cancelarem.
   * @param {object} o
   * @param {string} o.title título do ecrã
   */
  function scan({ title = '📷 Ler código de barras' } = {}) {
    return new Promise((resolve) => {
      const dlg = document.createElement('dialog');
      dlg.className = 'dialog scan-dlg';
      dlg.innerHTML = `<header class="form-head"><h2>${title}</h2>
          <button class="icon-btn" data-scan="close" aria-label="Fechar">✕</button></header>
        <div class="scan-view"><video playsinline muted autoplay></video><div class="scan-frame" aria-hidden="true"></div></div>
        <p class="scan-msg small muted">A abrir a câmara…</p>
        <form class="inline-add scan-manual" data-scan="manual">
          <input name="code" inputmode="numeric" autocomplete="off" placeholder="Ou escrevam os números do código" aria-label="Código de barras">
          <button class="btn small">OK</button>
        </form>`;
      document.body.appendChild(dlg);
      const video = dlg.querySelector('video');
      const msg = dlg.querySelector('.scan-msg');
      let stream = null;
      let timer = null;
      let done = false;
      const finish = (code) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        stream?.getTracks().forEach((t) => t.stop());
        if (dlg.open) dlg.close();
        dlg.remove();
        resolve(code || null);
      };
      dlg.addEventListener('cancel', (e) => { e.preventDefault(); finish(null); });
      dlg.querySelector('[data-scan=close]').addEventListener('click', () => finish(null));
      dlg.querySelector('[data-scan=manual]').addEventListener('submit', (e) => {
        e.preventDefault();
        const c = digits(e.target.code.value);
        if (valid(c)) finish(c);
        else msg.textContent = '⚠️ Esse número não parece um código de barras (8 ou 13 algarismos).';
      });
      dlg.showModal();

      (async () => {
        if (!navigator.mediaDevices?.getUserMedia) { msg.textContent = 'Este browser não deixa usar a câmara — escrevam o número.'; return; }
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false,
          });
        } catch {
          msg.textContent = 'Sem acesso à câmara. Autorizem a câmara para este site (ou escrevam o número).';
          return;
        }
        if (done) { stream.getTracks().forEach((t) => t.stop()); return; }
        video.srcObject = stream;
        try { await video.play(); } catch { /* o autoplay trata disso */ }
        let detect;
        try { detect = await makeDetector(); } catch (e) { msg.textContent = `${e.message} — escrevam o número.`; return; }
        msg.textContent = 'Apontem para o código de barras, dentro da moldura.';
        const tick = async () => {
          if (done) return;
          const c = digits(await detect(video).catch(() => null));
          if (c && valid(c)) {
            navigator.vibrate?.(60);
            finish(c);
            return;
          }
          timer = setTimeout(tick, 180);
        };
        tick();
      })();
    });
  }

  root.CodigoBarras = { valid, categoryOf, fromApi, lookup, scan, digits };
})(globalThis);
