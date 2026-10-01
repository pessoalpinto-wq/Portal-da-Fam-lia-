/*
 * Levar as fotos de uma viagem para o Google Drive (ou outro sítio):
 *  - nomes de ficheiro arrumados ("Algarve 2026-08-03 01.jpg");
 *  - grupos pequenos para o "Partilhar" do telemóvel (Drive no Android, Ficheiros → Drive no iPhone);
 *  - um .zip (sem compressão: as fotos já são JPEG) para o computador.
 * Script "clássico": define globalThis.PastaFotos. Testado em tests/pasta-fotos.test.mjs.
 */
(function (root) {
  /** Nome seguro para ficheiros (sem / \ : * ? " < > |). */
  const safe = (s) => String(s || '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);

  /** Nomes por ordem de data: "Algarve 2026-08-03 01.jpg" (sem repetidos). */
  function fileNames(photos, label) {
    const base = safe(label) || 'Fotos';
    const sorted = [...photos].sort((a, b) => (a.taken || a.date || '').localeCompare(b.taken || b.date || '') || String(a.id).localeCompare(String(b.id)));
    const width = String(sorted.length).length < 2 ? 2 : String(sorted.length).length;
    return sorted.map((p, i) => ({
      photo: p,
      name: `${base}${p.taken || p.date ? ` ${(p.taken || p.date).slice(0, 10)}` : ''} ${String(i + 1).padStart(width, '0')}.jpg`,
    }));
  }

  /** Divide em grupos (o "Partilhar" do telemóvel aguenta mal muitas fotos de uma vez). */
  function batches(list, size = 10, maxBytes = 40 * 1024 * 1024) {
    const out = [];
    let cur = [];
    let bytes = 0;
    list.forEach((x) => {
      const n = x.size || 0;
      if (cur.length && (cur.length >= size || bytes + n > maxBytes)) { out.push(cur); cur = []; bytes = 0; }
      cur.push(x);
      bytes += n;
    });
    if (cur.length) out.push(cur);
    return out;
  }

  /* ---------- ZIP (método "store") ---------- */
  const CRC = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  function dosTime(d) {
    const time = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
    const date = ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    return { time, date };
  }

  /**
   * Cria um .zip.
   * @param {Array<{name: string, data: Uint8Array, date?: Date}>} files
   * @returns {Uint8Array}
   */
  function zip(files) {
    const enc = new TextEncoder();
    const parts = [];
    const central = [];
    let offset = 0;
    files.forEach((f) => {
      const name = enc.encode(f.name);
      const crc = crc32(f.data);
      const { time, date } = dosTime(f.date || new Date());
      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true);
      local.setUint16(4, 20, true);
      local.setUint16(6, 0x0800, true); // nomes em UTF-8
      local.setUint16(8, 0, true); // sem compressão
      local.setUint16(10, time, true);
      local.setUint16(12, date, true);
      local.setUint32(14, crc, true);
      local.setUint32(18, f.data.length, true);
      local.setUint32(22, f.data.length, true);
      local.setUint16(26, name.length, true);
      local.setUint16(28, 0, true);
      parts.push(new Uint8Array(local.buffer), name, f.data);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true);
      c.setUint16(4, 20, true);
      c.setUint16(6, 20, true);
      c.setUint16(8, 0x0800, true);
      c.setUint16(10, 0, true);
      c.setUint16(12, time, true);
      c.setUint16(14, date, true);
      c.setUint32(16, crc, true);
      c.setUint32(20, f.data.length, true);
      c.setUint32(24, f.data.length, true);
      c.setUint16(28, name.length, true);
      c.setUint32(42, offset, true);
      central.push(new Uint8Array(c.buffer), name);
      offset += 30 + name.length + f.data.length;
    });
    const cdSize = central.reduce((n, p) => n + p.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, files.length, true);
    end.setUint16(10, files.length, true);
    end.setUint32(12, cdSize, true);
    end.setUint32(16, offset, true);
    const all = [...parts, ...central, new Uint8Array(end.buffer)];
    const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0));
    let at = 0;
    all.forEach((p) => { out.set(p, at); at += p.length; });
    return out;
  }

  root.PastaFotos = { fileNames, batches, zip, crc32, safe };
})(globalThis);
