/*
 * Saúde & Docs → anexar o próprio documento (PDF ou fotografia) ao registo: Cartão de Cidadão,
 * apólice do seguro, inspecção do carro…
 * Os ficheiros ficam no Supabase Storage, numa pasta privada da família (bucket "documentos":
 * <family_id>/<documento>/<ficheiro>); no registo fica só o nome, tipo e tamanho (d.file).
 * Abrir = link temporário (5 minutos). Apagar o ficheiro: quem o enviou ou os pais (regras no servidor).
 */
window.DocsAnexos = function () {
  const { esc, today } = U;
  const { openForm, toast } = UI;
  const { Forms } = Views;
  const S = () => Store.state;
  const BUCKET = 'documentos';
  const MAX = 20 * 1024 * 1024;
  const TYPES = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif' };
  const ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,application/pdf,image/*';
  const extOf = (name) => (String(name).toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1] || '';
  const typeOf = (f) => (f.type && Object.values(TYPES).includes(f.type) ? f.type : TYPES[extOf(f.name)] || '');
  const size = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
  const doc = (id) => S().docs.find((d) => d.id === id);
  const cloud = () => Cloud.ctx?.();

  /** Porque é que o ficheiro não pode ser anexado ('' = pode). */
  function problem(f) {
    if (!typeOf(f)) return 'Só PDF ou fotografias (JPG, PNG, HEIC).';
    if (f.size > MAX) return 'Ficheiro demasiado grande (máximo 20 MB).';
    return '';
  }

  /** Campos do formulário: os do documento + o anexo (só com a conta da família). */
  function fields(item) {
    const f = item?.file;
    if (!cloud()) {
      return [...Forms.doc(), { name: 'info', type: 'note', html: '<p class="small muted">📎 Para anexar o ficheiro (PDF ou fotografia) é preciso a conta da família (Definições → Entrar).</p>' }];
    }
    return [
      ...Forms.doc(),
      ...(f ? [{ name: 'info', type: 'note', html: `<p class="small">📎 Anexo: <b>${esc(f.name)}</b> <span class="muted">(${esc(extOf(f.name).toUpperCase())} · ${size(f.size || 0)})</span></p>` }] : []),
      { name: 'file', label: f ? 'Substituir o anexo (opcional)' : '📎 Anexar o documento (PDF ou fotografia, opcional)', type: 'file', accept: ACCEPT },
    ];
  }

  /** Criar/editar um documento, com o anexo. */
  function edit(id, defaults = {}) {
    const item = id ? doc(id) : null;
    openForm({
      title: `${item ? 'Editar' : 'Novo'}: documento`,
      fields: fields(item),
      values: item || defaults,
      extra: item?.file && cloud() ? [
        { label: '📎 Abrir anexo', onClick: () => { open(item.id); return false; } },
        { label: 'Tirar anexo', onClick: () => (confirm(`Tirar o anexo "${item.file.name}"?`) ? (detach(item.id), true) : false) },
      ] : [],
      deleteConfirm: item?.file ? 'Apagar este documento e o ficheiro anexado?' : undefined,
      onSubmit: (raw) => {
        const { file, info, ...data } = raw;
        let docId = item?.id;
        Store.update((s) => {
          const cur = item && s.docs.find((x) => x.id === item.id);
          if (cur) Object.assign(cur, data);
          else { docId = Store.uid(); s.docs.push({ id: docId, ...defaults, ...data }); }
        });
        if (file) attach(docId, file);
      },
      onDelete: item ? () => {
        Store.update((s) => { s.docs = s.docs.filter((x) => x.id !== item.id); });
        if (item.file) removeFiles([item.file.path]);
      } : null,
    });
  }

  /** Envia o ficheiro e liga-o ao documento (substitui o anterior, se houver). */
  async function attach(docId, file) {
    const why = problem(file);
    if (why) { toast(`${why} O documento ficou guardado sem anexo.`); return false; }
    const ctx = cloud();
    if (!ctx) { toast('Os anexos precisam da conta da família.'); return false; }
    toast('📤 A enviar o anexo…');
    const path = `${ctx.profile.family_id}/${docId}/${Store.uid()}.${extOf(file.name) || 'pdf'}`;
    const { error } = await ctx.client.storage.from(BUCKET).upload(path, file, { contentType: typeOf(file), upsert: false });
    if (error) { toast(`Não consegui enviar ${file.name}: ${error.message || 'erro'}`); return false; }
    let old = null;
    Store.update((s) => {
      const d = s.docs.find((x) => x.id === docId);
      if (!d) return;
      old = d.file?.path || null;
      d.file = { path, name: file.name, type: typeOf(file), size: file.size, by: s.currentUser, date: today() };
    });
    if (old) removeFiles([old], true);
    toast('📎 Anexo guardado.');
    return true;
  }

  async function open(id) {
    const d = doc(id);
    const ctx = cloud();
    if (!d?.file) return;
    if (!ctx) { toast('Para abrir o anexo é preciso a conta da família.'); return; }
    // Abre já a janela (senão o iPhone bloqueia-a por ser depois de esperar pelo link).
    const win = window.open('', '_blank');
    const { data, error } = await ctx.client.storage.from(BUCKET).createSignedUrl(d.file.path, 300);
    if (error || !data?.signedUrl) { win?.close(); toast('Não consegui abrir o anexo.'); return; }
    if (win) win.location.href = data.signedUrl; else location.href = data.signedUrl;
  }

  async function detach(id) {
    const d = doc(id);
    if (!d?.file) return;
    const { path } = d.file;
    Store.update((s) => { const x = s.docs.find((y) => y.id === id); if (x) delete x.file; });
    removeFiles([path]);
    toast('Anexo retirado.');
  }

  /** Apaga ficheiros do armazenamento (quem os enviou ou os pais). */
  async function removeFiles(paths, quiet = false) {
    const ctx = cloud();
    if (!ctx || !paths.length) return;
    const { data, error } = await ctx.client.storage.from(BUCKET).remove(paths);
    if (!quiet && (error || (data?.length ?? 0) < paths.length)) toast('⚠️ O ficheiro anexado não foi apagado (só quem o enviou ou os pais podem apagar).');
  }

  return {
    actions: {
      'add-doc': (el) => edit(null, { memberId: el.dataset.id || '', type: 'Cartão de Cidadão' }),
      'edit-doc': (el) => edit(el.dataset.id),
      'doc-file-open': (el) => open(el.dataset.id),
    },
    _test: { problem, typeOf, fields, attach, edit },
  };
};
