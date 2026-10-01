import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import zlib from 'node:zlib';
import '../js/pasta-fotos.js';

const P = globalThis.PastaFotos;

test('nomes por ordem de data, sem caracteres proibidos', () => {
  const r = P.fileNames([
    { id: 'b', taken: '2026-08-04' },
    { id: 'a', taken: '2026-08-03' },
    { id: 'c', date: '2026-08-05' },
  ], 'Algarve: praia/sol');
  assert.deepEqual(r.map((x) => x.name), ['Algarve praia sol 2026-08-03 01.jpg', 'Algarve praia sol 2026-08-04 02.jpg', 'Algarve praia sol 2026-08-05 03.jpg']);
  assert.equal(r[0].photo.id, 'a');
  assert.equal(P.fileNames(Array.from({ length: 120 }, (_, i) => ({ id: String(i) })), '')[0].name, 'Fotos 001.jpg');
});

test('grupos de 10 (ou menos, se forem grandes)', () => {
  assert.deepEqual(P.batches(Array.from({ length: 23 }, () => ({ size: 1 }))).map((b) => b.length), [10, 10, 3]);
  assert.deepEqual(P.batches(Array.from({ length: 5 }, () => ({ size: 15 })), 10, 40).map((b) => b.length), [2, 2, 1]);
  assert.deepEqual(P.batches([]), []);
});

test('crc32 igual ao do zlib', () => {
  const data = new TextEncoder().encode('Portal da Família ✈️');
  assert.equal(P.crc32(data), zlib.crc32(Buffer.from(data)));
});

test('zip: abre com o unzip e tem os ficheiros certos', () => {
  const a = new Uint8Array(5000).map((_, i) => (i * 7) % 256);
  const b = new TextEncoder().encode('olá');
  const bytes = P.zip([{ name: 'Algarve 2026-08-03 01.jpg', data: a }, { name: 'Férias 02.jpg', data: b }]);
  const dir = mkdtempSync(join(tmpdir(), 'zip-'));
  const file = join(dir, 'fotos.zip');
  writeFileSync(file, bytes);
  const list = execFileSync('unzip', ['-Z1', file], { encoding: 'utf8' }).trim().split('\n');
  assert.deepEqual(list, ['Algarve 2026-08-03 01.jpg', 'Férias 02.jpg']);
  execFileSync('unzip', ['-tq', file]); // verifica os CRC
  execFileSync('unzip', ['-q', file, '-d', join(dir, 'out')]);
  assert.deepEqual(new Uint8Array(readFileSync(join(dir, 'out', 'Algarve 2026-08-03 01.jpg'))), a);
  assert.equal(readFileSync(join(dir, 'out', 'Férias 02.jpg'), 'utf8'), 'olá');
});
