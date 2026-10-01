/*
 * Fotos repetidas nas Memórias: cada foto tem uma "impressão digital" —
 *  - sha:   do ficheiro original (a mesma foto escolhida duas vezes);
 *  - phash: da imagem em si (dHash 9×8), que se mantém quando a foto foi reduzida ou recomprimida
 *           (ex.: a mesma foto recebida pelo WhatsApp).
 * Script "clássico": define globalThis.FotosRepetidas. A parte pura é testada em tests/fotos-repetidas.test.mjs.
 */
(function (root) {
  const W = 9;
  const H = 8;
  const THRESHOLD = 6; // bits diferentes (de 64) até onde duas fotos contam como "a mesma"

  /** dHash a partir de uma grelha 9×8 de cinzentos (array de 72 números): 16 caracteres hex. */
  function dhash(gray) {
    let hex = '';
    for (let y = 0; y < H; y++) {
      let byte = 0;
      for (let x = 0; x < W - 1; x++) byte = (byte << 1) | (gray[y * W + x] > gray[y * W + x + 1] ? 1 : 0);
      hex += byte.toString(16).padStart(2, '0');
    }
    return hex;
  }

  /** Reduz uma imagem RGBA (w×h) a 9×8 cinzentos, pela média de cada bloco. */
  function grid(rgba, w, h) {
    const sum = new Array(W * H).fill(0);
    const cnt = new Array(W * H).fill(0);
    for (let y = 0; y < h; y++) {
      const gy = Math.min(H - 1, Math.floor((y * H) / h));
      for (let x = 0; x < w; x++) {
        const gx = Math.min(W - 1, Math.floor((x * W) / w));
        const i = (y * w + x) * 4;
        sum[gy * W + gx] += 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];
        cnt[gy * W + gx]++;
      }
    }
    return sum.map((v, i) => v / (cnt[i] || 1));
  }

  /** N.º de bits diferentes entre dois dHash. */
  function distance(a, b) {
    if (!a || !b || a.length !== b.length) return 64;
    let d = 0;
    for (let i = 0; i < a.length; i += 2) {
      let x = parseInt(a.slice(i, i + 2), 16) ^ parseInt(b.slice(i, i + 2), 16);
      while (x) { d += x & 1; x >>= 1; }
    }
    return d;
  }

  // Imagens quase lisas (céu, ecrã preto) têm um dHash pouco fiável: só contam se forem iguais ao ficheiro.
  const flat = (h) => { const ones = 64 - distance(h, '0'.repeat(16)); return !h || h.length !== 16 || ones < 4 || ones > 60; };

  /**
   * Quais das fotos novas já existem (no mesmo álbum) ou se repetem entre si.
   * @param {Array<{key, sha, phash}>} fresh     fotos a enviar
   * @param {Array<{id, sha, phash}>}  existing  fotos que já estão no álbum
   * @returns {Map<key, { photoId?, sameAs?, exact }>}  photoId = foto já guardada; sameAs = outra foto deste envio
   */
  function find(fresh, existing, threshold = THRESHOLD) {
    const out = new Map();
    const match = (f, g) => (f.sha && g.sha && f.sha === g.sha ? 'exact'
      : !flat(f.phash) && distance(f.phash, g.phash) <= threshold ? 'similar' : null);
    const kept = [];
    fresh.forEach((f) => {
      const old = existing.map((g) => [g, match(f, g)]).filter(([, m]) => m).sort((a, b) => (a[1] === 'exact' ? -1 : 1) - (b[1] === 'exact' ? -1 : 1))[0];
      if (old) { out.set(f.key, { photoId: old[0].id, exact: old[1] === 'exact' }); return; }
      const twin = kept.map((g) => [g, match(f, g)]).find(([, m]) => m);
      if (twin) { out.set(f.key, { sameAs: twin[0].key, exact: twin[1] === 'exact' }); return; }
      kept.push(f);
    });
    return out;
  }

  /* ---------- No browser ---------- */
  /** Impressão digital da imagem (de um File ou Blob). */
  async function phashOf(blob) {
    const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' });
    const w = 90;
    const h = 80;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close?.();
    return dhash(grid(ctx.getImageData(0, 0, w, h).data, w, h));
  }

  async function shaOf(blob) {
    const buf = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  async function fingerprint(file) {
    const [sha, phash] = await Promise.all([shaOf(file), phashOf(file).catch(() => '')]);
    return { sha, phash };
  }

  root.FotosRepetidas = { dhash, grid, distance, find, flat, phashOf, fingerprint, THRESHOLD };
})(globalThis);
