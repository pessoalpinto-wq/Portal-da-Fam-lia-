/* Memórias: fotos da família no Supabase Storage (pasta privada por família). */
(function () {
  const BUCKET = 'memorias';
  const urls = new Map(); // caminho -> { url, exp }

  /** Reduz a imagem (e corrige a orientação) antes de enviar. */
  async function resize(file, max, quality) {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d').drawImage(bmp, 0, 0, w, h);
    bmp.close?.();
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality));
    return { blob, w, h };
  }

  function ctxOrThrow() {
    const ctx = Cloud.ctx();
    if (!ctx) throw new Error('As memórias precisam de conta (Definições → Entrar / criar conta).');
    return ctx;
  }

  /** Envia fotos; devolve quantas foram guardadas. */
  async function upload(files, { tripId = '', caption = '' } = {}, onProgress = () => {}) {
    const ctx = ctxOrThrow();
    const store = ctx.client.storage.from(BUCKET);
    let ok = 0;
    for (const [i, file] of [...files].entries()) {
      onProgress(i + 1, files.length);
      if (!file.type.startsWith('image/')) continue;
      const id = Store.uid();
      const base = `${ctx.profile.family_id}/${id}`;
      const [big, small] = await Promise.all([resize(file, 1600, 0.82), resize(file, 480, 0.75)]);
      const up1 = await store.upload(`${base}.jpg`, big.blob, { contentType: 'image/jpeg' });
      if (up1.error) throw up1.error;
      const up2 = await store.upload(`${base}_t.jpg`, small.blob, { contentType: 'image/jpeg' });
      if (up2.error) throw up2.error;
      Store.update((s) => s.photos.push({
        id, path: `${base}.jpg`, thumb: `${base}_t.jpg`, w: big.w, h: big.h, caption, tripId,
        by: s.currentUser, date: U.today(), taken: file.lastModified ? U.toISO(new Date(file.lastModified)) : U.today(),
      }));
      ok++;
    }
    return ok;
  }

  async function remove(photo) {
    const ctx = ctxOrThrow();
    const { error } = await ctx.client.storage.from(BUCKET).remove([photo.path, photo.thumb]);
    if (error) throw error;
    Store.update((s) => { s.photos = s.photos.filter((p) => p.id !== photo.id); });
  }

  /** Links temporários (1 hora) para mostrar as fotos privadas. */
  async function signed(paths) {
    const now = Date.now();
    const missing = paths.filter((p) => !(urls.get(p)?.exp > now + 60000));
    if (missing.length) {
      const ctx = ctxOrThrow();
      const { data, error } = await ctx.client.storage.from(BUCKET).createSignedUrls(missing, 3600);
      if (error) throw error;
      data.forEach((d) => { if (d.signedUrl) urls.set(d.path, { url: d.signedUrl, exp: now + 3600 * 1000 }); });
    }
    return Object.fromEntries(paths.map((p) => [p, urls.get(p)?.url]));
  }

  /** Preenche as <img data-path> dentro de um elemento. */
  async function hydrate(root) {
    const imgs = [...root.querySelectorAll('img[data-path]')].filter((i) => !i.src);
    if (!imgs.length || !Cloud.ctx()) return;
    const map = await signed([...new Set(imgs.map((i) => i.dataset.path))]);
    imgs.forEach((i) => { if (map[i.dataset.path]) i.src = map[i.dataset.path]; });
  }

  window.Photos = { upload, remove, signed, hydrate };
})();
