import { test } from 'node:test';
import assert from 'node:assert/strict';

// Ambiente mínimo do portal (sem browser).
const toasts = [];
let lastForm = null;
const state = { docs: [], currentUser: 'pai' };
const uploads = [];
const removed = [];
let failUpload = false;
const storage = {
  from: () => ({
    upload: async (path) => (failUpload ? { error: { message: 'falhou' } } : (uploads.push(path), { error: null })),
    remove: async (paths) => { removed.push(...paths); return { data: paths, error: null }; },
    createSignedUrl: async () => ({ data: { signedUrl: 'https://x/y' }, error: null }),
  }),
};
let online = true;
let n = 0;
globalThis.window = globalThis;
globalThis.U = { esc: (s) => String(s ?? ''), today: () => '2026-11-09' };
globalThis.UI = { openForm: (cfg) => { lastForm = cfg; }, toast: (m) => toasts.push(m) };
globalThis.Views = { Forms: { doc: () => [{ name: 'type' }, { name: 'expires' }] } };
globalThis.Store = { state, uid: () => `id${++n}`, update: (fn) => fn(state) };
globalThis.Cloud = { ctx: () => (online ? { client: { storage }, profile: { family_id: 'fam' } } : null) };
await import('../js/docs-anexos.js');
const M = globalThis.DocsAnexos();
const T = M._test;
const file = (name, size = 1000, type = '') => ({ name, size, type });
const tick = () => new Promise((r) => setTimeout(r, 0));

test('tipos e tamanhos aceites', () => {
  assert.equal(T.problem(file('cc.pdf')), '');
  assert.equal(T.problem(file('FOTO.HEIC')), '');
  assert.equal(T.problem(file('x.jpg', 100, 'image/jpeg')), '');
  assert.match(T.problem(file('folha.xlsx')), /Só PDF/);
  assert.match(T.problem(file('grande.pdf', 21 * 1024 * 1024)), /20 MB/);
});

test('o formulário só oferece anexo com a conta da família', () => {
  assert.equal(T.fields(null).at(-1).type, 'file');
  online = false;
  assert.equal(T.fields(null).some((f) => f.type === 'file'), false);
  online = true;
});

test('novo documento com ficheiro: guarda o registo e o anexo', async () => {
  M.actions['add-doc']({ dataset: { id: 'ana' } });
  lastForm.onSubmit({ type: 'Passaporte', expires: '2030-01-01', file: file('passaporte.pdf', 2048) });
  await tick();
  const d = state.docs.at(-1);
  assert.equal(d.memberId, 'ana');
  assert.equal(d.type, 'Passaporte');
  assert.equal('file' in d && d.file.name, 'passaporte.pdf');
  assert.ok(d.file.path.startsWith(`fam/${d.id}/`));
  assert.equal(uploads.at(-1), d.file.path);
  assert.equal(d.info, undefined);
});

test('substituir o anexo apaga o ficheiro antigo; apagar o documento apaga o ficheiro', async () => {
  const d = state.docs.at(-1);
  const old = d.file.path;
  M.actions['edit-doc']({ dataset: { id: d.id } });
  assert.equal(lastForm.extra.length, 2);
  lastForm.onSubmit({ type: 'Passaporte', expires: '2031-01-01', file: file('novo.jpg') });
  await tick(); await tick();
  assert.equal(d.file.name, 'novo.jpg');
  assert.ok(removed.includes(old));
  M.actions['edit-doc']({ dataset: { id: d.id } });
  lastForm.onDelete();
  await tick();
  assert.ok(removed.includes(d.file.path));
  assert.equal(state.docs.find((x) => x.id === d.id), undefined);
});

test('ficheiro não suportado ou envio falhado: o documento fica sem anexo', async () => {
  M.actions['add-doc']({ dataset: { id: '' } });
  lastForm.onSubmit({ type: 'IUC', expires: '2027-05-01', file: file('x.docx') });
  await tick();
  assert.equal(state.docs.at(-1).file, undefined);
  assert.match(toasts.at(-1), /sem anexo/);
  failUpload = true;
  M.actions['add-doc']({ dataset: { id: '' } });
  lastForm.onSubmit({ type: 'IUC', expires: '2027-05-01', file: file('ok.pdf') });
  await tick();
  assert.equal(state.docs.at(-1).file, undefined);
  failUpload = false;
});
