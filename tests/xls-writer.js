/* Escritor mínimo de .xls (BIFF8 num Compound File) para os testes: gera ficheiros sintéticos, sem dados reais. */
/* ---------- Escritor mínimo de .xls (BIFF8 dentro de um Compound File), só para os testes ---------- */
export const le16 = (n) => [n & 255, (n >> 8) & 255];
export const le32 = (n) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
export const f64 = (x) => [...new Uint8Array(new Float64Array([x]).buffer)];
export const rec = (type, data) => [...le16(type), ...le16(data.length), ...data];
export const latin = (s) => [...s].map((c) => c.charCodeAt(0));
const utf16 = (s) => [...s].flatMap((c) => le16(c.charCodeAt(0)));
const isWide = (s) => [...s].some((c) => c.charCodeAt(0) > 255);
/** SST com o último texto partido a meio num CONTINUE (com o byte de flags no início do CONTINUE). */
export function sstRecords(strings, splitLast = true) {
  const head = [...le32(strings.length), ...le32(strings.length)];
  const body = [];
  strings.slice(0, -1).forEach((s) => body.push(...le16(s.length), isWide(s) ? 1 : 0, ...(isWide(s) ? utf16(s) : latin(s))));
  const last = strings.at(-1);
  if (!splitLast) { body.push(...le16(last.length), isWide(last) ? 1 : 0, ...(isWide(last) ? utf16(last) : latin(last))); return rec(0x00fc, [...head, ...body]); }
  const cut = Math.floor(last.length / 2);
  // 1.ª metade em 8 bits; 2.ª metade (com "ç") em 16 bits, no CONTINUE.
  body.push(...le16(last.length), 0, ...latin(last.slice(0, cut)));
  return [...rec(0x00fc, [...head, ...body]), ...rec(0x003c, [1, ...utf16(last.slice(cut))])];
}
export const rkInt = (n) => le32(((n << 2) | 2) >>> 0);
export const rkCents = (n) => le32((((Math.round(n * 100)) << 2) | 3) >>> 0);
export function workbook({ strings, cells, pad = 0 }) {
  const bof = (t) => rec(0x0809, [...le16(0x0600), ...le16(t), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const xfs = [...Array(16)].map(() => rec(0x00e0, [0, 0, ...le16(0), ...Array(16).fill(0)])); // xf 0..15: General
  const xfDate = rec(0x00e0, [0, 0, ...le16(14), ...Array(16).fill(0)]); // xf 16: data (formato 14)
  const fmt = rec(0x041e, [...le16(164), ...le16(10), 0, ...latin('dd/mm/yyyy')]);
  const globalsNoSheet = [...bof(5), ...fmt, ...xfs.flat(), ...xfDate, ...sstRecords(strings)];
  const sheetName = 'Movimentos';
  const bsLen = 4 + 8 + sheetName.length; // cabeçalho + posição, estado, tipo, cch, flags + nome
  const sheetPos = globalsNoSheet.length + bsLen + 4; // + BOUNDSHEET + EOF
  const globals = [...globalsNoSheet, ...rec(0x0085, [...le32(sheetPos), 0, 0, sheetName.length, 0, ...latin(sheetName)]), ...rec(0x000a, [])];
  const sheet = [...bof(0x10), ...cells.flat(), ...rec(0x000a, [])];
  return new Uint8Array([...globals, ...sheet, ...Array(pad).fill(0)]);
}
/** Envolve o fluxo "Workbook" num Compound File (sectores de 512; mini stream se for pequeno). */
export function cfb(stream) {
  const SS = 512;
  const small = stream.length < 4096;
  const sectors = [];
  const fat = [];
  const addChain = (bytes) => {
    const first = sectors.length;
    const n = Math.max(1, Math.ceil(bytes.length / SS));
    for (let i = 0; i < n; i++) { const s = new Uint8Array(SS); s.set(bytes.subarray(i * SS, (i + 1) * SS)); sectors.push(s); fat.push(i === n - 1 ? 0xfffffffe : first + i + 1); }
    return first;
  };
  let wbStart; let rootStart = 0xfffffffe; let rootSize = 0; let miniFatStart = 0xfffffffe; let miniFatN = 0;
  if (small) {
    const n = Math.ceil(stream.length / 64);
    const mini = new Uint8Array(n * 64); mini.set(stream);
    rootStart = addChain(mini); rootSize = mini.length;
    const mfat = new Uint8Array(SS); const mdv = new DataView(mfat.buffer);
    for (let i = 0; i < 128; i++) mdv.setUint32(i * 4, i < n - 1 ? i + 1 : i === n - 1 ? 0xfffffffe : 0xffffffff, true);
    miniFatStart = addChain(mfat); miniFatN = 1; wbStart = 0;
  } else wbStart = addChain(stream);
  const dir = new Uint8Array(SS); const ddv = new DataView(dir.buffer);
  const entry = (i, name, type, start, size) => {
    [...name].forEach((c, k) => ddv.setUint16(i * 128 + k * 2, c.charCodeAt(0), true));
    ddv.setUint16(i * 128 + 64, (name.length + 1) * 2, true);
    dir[i * 128 + 66] = type;
    [68, 72, 76].forEach((o) => ddv.setUint32(i * 128 + o, 0xffffffff, true));
    ddv.setUint32(i * 128 + 116, start, true); ddv.setUint32(i * 128 + 120, size, true);
  };
  entry(0, 'Root Entry', 5, rootStart, rootSize);
  entry(1, 'Workbook', 2, wbStart, stream.length);
  ddv.setUint32(76, 1, true); // filho da raiz
  const dirStart = addChain(dir);
  const fatSector = sectors.length; fat.push(0xfffffffd); sectors.push(new Uint8Array(SS));
  const fdv = new DataView(sectors[fatSector].buffer);
  for (let i = 0; i < 128; i++) fdv.setUint32(i * 4, i < fat.length ? fat[i] : 0xffffffff, true);
  const h = new Uint8Array(512); const hdv = new DataView(h.buffer);
  hdv.setUint32(0, 0xe011cfd0, true); hdv.setUint32(4, 0xe11ab1a1, true);
  hdv.setUint16(24, 0x3e, true); hdv.setUint16(26, 3, true); hdv.setUint16(28, 0xfffe, true);
  hdv.setUint16(30, 9, true); hdv.setUint16(32, 6, true);
  hdv.setUint32(44, 1, true); hdv.setUint32(48, dirStart, true); hdv.setUint32(56, 4096, true);
  hdv.setUint32(60, miniFatStart, true); hdv.setUint32(64, miniFatN, true); hdv.setUint32(68, 0xfffffffe, true);
  for (let i = 0; i < 109; i++) hdv.setUint32(76 + i * 4, i === 0 ? fatSector : 0xffffffff, true);
  return new Uint8Array([...h, ...sectors.flatMap((s) => [...s])]);
}

