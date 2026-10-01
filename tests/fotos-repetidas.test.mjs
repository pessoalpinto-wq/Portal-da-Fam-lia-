import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../js/fotos-repetidas.js';

const F = globalThis.FotosRepetidas;

/** "Foto" sintética: uma paisagem suave que depende de `scene`; `noise` imita uma recompressão. */
function image(w, h, { scene = 1, noise = 0, seed = 1 } = {}) {
  const px = new Uint8ClampedArray(w * h * 4);
  let r = seed;
  const rnd = () => { r = (r * 16807) % 2147483647; return r / 2147483647 - 0.5; };
  const ph = [1.3, 2.1, 0.7, 2.9].map((k) => k * scene);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / w;
      const v = y / h;
      const val = 128 + 50 * Math.sin(u * 6 + ph[0]) * Math.cos(v * 5 + ph[1]) + 40 * Math.sin((u + v) * 9 + ph[2]) + 25 * Math.cos(u * 13 - ph[3]) + noise * rnd();
      const i = (y * w + x) * 4;
      px[i] = px[i + 1] = px[i + 2] = Math.max(0, Math.min(255, val));
      px[i + 3] = 255;
    }
  }
  return px;
}
const hashOf = (w, h, o) => F.dhash(F.grid(image(w, h, o), w, h));

test('dHash: 16 caracteres; distância entre hashes', () => {
  const a = hashOf(90, 80);
  assert.match(a, /^[0-9a-f]{16}$/);
  assert.equal(F.distance(a, a), 0);
  assert.equal(F.distance('0000000000000000', 'ffffffffffffffff'), 64);
  assert.equal(F.distance('', a), 64);
});

test('a mesma foto noutro tamanho e com ruído dá quase o mesmo hash; outra foto não', () => {
  const a = hashOf(900, 800);
  const smaller = hashOf(180, 160, { noise: 12, seed: 7 });
  const other = hashOf(900, 800, { scene: 2 });
  assert.ok(F.distance(a, smaller) <= F.THRESHOLD, `distância ${F.distance(a, smaller)}`);
  assert.ok(F.distance(a, other) > F.THRESHOLD, `distância ${F.distance(a, other)}`);
});

test('find: igual a uma que já lá está, parecida, repetida no mesmo envio e nova', () => {
  const a = hashOf(90, 80);
  const b = hashOf(90, 80, { scene: 2 });
  const c = hashOf(90, 80, { scene: 3 });
  const existing = [{ id: 'p1', sha: 'S1', phash: a }];
  const fresh = [
    { key: 0, sha: 'S1', phash: a }, // igual (mesmo ficheiro)
    { key: 1, sha: 'S9', phash: hashOf(45, 40, { noise: 10 }) }, // a mesma, recomprimida
    { key: 2, sha: 'S2', phash: b }, // nova
    { key: 3, sha: 'S2', phash: b }, // escolhida duas vezes
    { key: 4, sha: 'S3', phash: c }, // nova
  ];
  const r = F.find(fresh, existing);
  assert.deepEqual(r.get(0), { photoId: 'p1', exact: true });
  assert.deepEqual(r.get(1), { photoId: 'p1', exact: false });
  assert.deepEqual(r.get(3), { sameAs: 2, exact: true });
  assert.equal(r.has(2), false);
  assert.equal(r.has(4), false);
  assert.equal(r.size, 3);
});

test('imagens lisas (céu, ecrã preto) só contam quando o ficheiro é igual', () => {
  const flat = '0000000000000000';
  assert.ok(F.flat(flat));
  const r = F.find([{ key: 0, sha: 'X', phash: flat }, { key: 1, sha: 'Y', phash: flat }], [{ id: 'p', sha: 'Z', phash: flat }]);
  assert.equal(r.size, 0);
  const same = F.find([{ key: 0, sha: 'Z', phash: flat }], [{ id: 'p', sha: 'Z', phash: flat }]);
  assert.deepEqual(same.get(0), { photoId: 'p', exact: true });
});

test('fotos antigas sem impressão digital não dão falsos alarmes', () => {
  const r = F.find([{ key: 0, sha: 'A', phash: hashOf(90, 80) }], [{ id: 'old' }]);
  assert.equal(r.size, 0);
});
