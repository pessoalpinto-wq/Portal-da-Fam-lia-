/*
 * Viagens → 📎 Documentos: bilhetes de avião, reservas de hotel, aluguer de carro, seguros…
 * Os ficheiros ficam no Supabase Storage, numa pasta privada da família (bucket "viagens":
 * <family_id>/<viagem>/<ficheiro>); na viagem fica só a lista (nome, tipo, quem enviou).
 * Abrir = link temporário (5 minutos). Apagar: quem enviou ou os pais (regras no servidor).
 */
window.ViagemDocs = function ({ render }) {
  const { esc, today, fmtDate } = U;
  const { openForm, toast, member } = UI;
  const S = () => Store.state;
  const BUCKET = 'viagens';
  const MAX = 20 * 1024 * 1024;
  const KINDS = [
    ['voo', '✈️ Bilhete de avião / cartão de embarque'], ['hotel', '🏨 Reserva de alojamento'], ['carro', '🚗 Aluguer de carro'],
    ['transporte', '🚆 Comboio, autocarro, barco'], ['bilhetes', '🎟️ Bilhetes e actividades'], ['seguro', '🛡️ Seguro de viagem'],
    ['identificacao', '🪪 Identificação / vistos'], ['outro', '📄 Outro'],
  ];
  const ICON = Object.fromEntries(KINDS.map(([k, l]) => [k, l.split(' ')[0]]));
  const ORDER = Object.fromEntries(KINDS.map(([k], i) => [k, i]));
  const TYPES = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif', pkpass: 'application/vnd.apple.pkpass' };
  const extOf = (name) => (String(name).toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1] || '';
  const typeOf = (f) => (f.type && Object.values(TYPES).includes(f.type) ? f.type : TYPES[extOf(f.name)] || '');
  const size = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
  const trip = (id) => S().trips.find((t) => t.id === id);
  const canDelete = (d) => Store.isParent() || d.by === S().currentUser;

  /** Cartão de embarque do avião primeiro, depois hotel, carro… e por data de envio. */
  const sorted = (docs) => [...docs].sort((a, b) => (ORDER[a.kind] ?? 99) - (ORDER[b.kind] ?? 99) || String(a.date).localeCompare(String(b.date)));

  function section(tr) {
    const docs = sorted(tr.docs || []);
    const cloud = !!Cloud.ctx?.();
    return `<h3 class="sub">📎 Documentos ${docs.length ? `<small class="muted">(${docs.length})</small>` : ''}
        ${cloud ? `<button class="linkish" data-action="tripdoc-add" data-id="${esc(tr.id)}">＋ juntar</button>` : ''}</h3>
      ${docs.length ? `<ul class="tripdocs">${docs.map((d) => `<li>
          <button class="tripdoc-main" data-action="tripdoc-open" data-id="${esc(tr.id)}" data-sub="${esc(d.id)}" title="Abrir">
            <span class="tripdoc-ico" aria-hidden="true">${ICON[d.kind] || '📄'}</span>
            <span class="tripdoc-txt"><b>${esc(d.note || d.name)}</b>
              <small class="muted">${esc([d.note ? d.name : '', extOf(d.name).toUpperCase(), size(d.size || 0), member(d.by)?.name, fmtDate(d.date)].filter(Boolean).join(' · '))}</small></span></button>
          ${canDelete(d) ? `<button class="icon-btn small" data-action="tripdoc-del" data-id="${esc(tr.id)}" data-sub="${esc(d.id)}" aria-label="Apagar documento">✕</button>` : ''}
        </li>`).join('')}</ul>`
        : `<p class="small muted">${cloud ? 'Bilhetes de avião, reservas de hotel, aluguer de carro, seguro… Ficam aqui à mão de toda a família, mesmo sem procurar no email.'
          : 'Os documentos precisam da conta da família (Definições → Entrar).'}</p>`}`;
  }

  /* ---------- Juntar ---------- */
  function pick(tripId) {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.pkpass,application/pdf,image/*';
    input.addEventListener('change', () => { if (input.files.length) askKind(tripId, [...input.files]); });
    input.click();
  }

  /** Adivinha o tipo pelo nome do ficheiro (ex.: "boarding-pass.pdf" → avião). */
  function guessKind(name) {
    const n = String(name).toLowerCase();
    if (/boarding|embarque|flight|voo|ryanair|tap|easyjet|iberia|vueling|e-?ticket|itiner/.test(n)) return 'voo';
    if (/hotel|booking|airbnb|reserva|alojamento|apartamento|confirm/.test(n)) return 'hotel';
    if (/rent|car|carro|aluguer|hertz|europcar|sixt|avis/.test(n)) return 'carro';
    if (/seguro|insurance/.test(n)) return 'seguro';
    if (/comboio|cp\b|train|bus|autocarro|ferry|barco/.test(n)) return 'transporte';
    if (/bilhete|ticket|entrada|museu|parque|tour/.test(n)) return 'bilhetes';
    if (/passaporte|passport|visto|visa|cartao|cidadao/.test(n)) return 'identificacao';
    return 'outro';
  }

  function askKind(tripId, files) {
    const bad = files.filter((f) => !typeOf(f));
    const big = files.filter((f) => f.size > MAX);
    const ok = files.filter((f) => typeOf(f) && f.size <= MAX);
    if (!ok.length) {
      toast(big.length ? 'Ficheiro demasiado grande (máximo 20 MB).' : 'Só PDF, fotografias (JPG, PNG, HEIC) ou passes da Wallet (.pkpass).');
      return;
    }
    const one = ok.length === 1;
    openForm({
      title: `📎 ${one ? 'Juntar documento' : `Juntar ${ok.length} documentos`} · ${trip(tripId)?.destination || ''}`,
      fields: [
        { name: 'info', type: 'note', html: `<p class="small">${ok.map((f) => `📄 ${esc(f.name)} <span class="muted">(${size(f.size)})</span>`).join('<br>')}
          ${bad.length || big.length ? `<br><span class="muted">Ficam de fora: ${esc([...bad, ...big].map((f) => f.name).join(', '))} (tipo ou tamanho não suportado).</span>` : ''}</p>` },
        { name: 'kind', label: 'O que é?', type: 'select', options: KINDS },
        { name: 'note', label: one ? 'Descrição (opcional)' : 'Descrição para todos (opcional)', placeholder: 'Ex.: Voo de ida TP1234 · 12/07 às 08:40' },
      ],
      values: { kind: guessKind(ok[0].name) },
      submitLabel: 'Enviar',
      onSubmit: (d) => { upload(tripId, ok, d.kind, d.note.trim()); },
    });
  }

  async function upload(tripId, files, kind, note) {
    const ctx = Cloud.ctx?.();
    if (!ctx) { toast('Os documentos precisam da conta da família.'); return; }
    const store = ctx.client.storage.from(BUCKET);
    let done = 0;
    for (const [i, f] of files.entries()) {
      toast(`📤 A enviar ${i + 1} de ${files.length}…`);
      const id = Store.uid();
      const ext = extOf(f.name) || 'pdf';
      const path = `${ctx.profile.family_id}/${tripId}/${id}.${ext}`;
      const { error } = await store.upload(path, f, { contentType: typeOf(f), upsert: false });
      if (error) { toast(`Não consegui enviar ${f.name}: ${error.message || 'erro'}`); continue; }
      Store.update((s) => {
        const t = s.trips.find((x) => x.id === tripId);
        if (!t) return;
        t.docs = [...(t.docs || []), { id, path, name: f.name, type: typeOf(f), size: f.size, kind, note, by: s.currentUser, date: today() }];
      });
      done++;
    }
    if (done) toast(`📎 ${done === 1 ? 'Documento guardado' : `${done} documentos guardados`} na viagem.`);
  }

  /* ---------- Abrir e apagar ---------- */
  async function open(el) {
    const d = (trip(el.dataset.id)?.docs || []).find((x) => x.id === el.dataset.sub);
    const ctx = Cloud.ctx?.();
    if (!d || !ctx) return;
    // Abre já a janela (senão o iPhone bloqueia-a por ser depois de esperar pelo link).
    const win = window.open('', '_blank');
    const { data, error } = await ctx.client.storage.from(BUCKET).createSignedUrl(d.path, 300, { download: d.type === 'application/vnd.apple.pkpass' ? d.name : false });
    if (error || !data?.signedUrl) { win?.close(); toast('Não consegui abrir o documento.'); return; }
    if (win) win.location.href = data.signedUrl; else location.href = data.signedUrl;
  }

  async function remove(el) {
    const t = trip(el.dataset.id);
    const d = (t?.docs || []).find((x) => x.id === el.dataset.sub);
    if (!d || !canDelete(d) || !confirm(`Apagar "${d.note || d.name}"?`)) return;
    const ctx = Cloud.ctx?.();
    if (ctx) {
      const { error } = await ctx.client.storage.from(BUCKET).remove([d.path]);
      if (error) { toast('Não consegui apagar o ficheiro.'); return; }
    }
    Store.update((s) => { const x = s.trips.find((y) => y.id === t.id); if (x) x.docs = (x.docs || []).filter((y) => y.id !== d.id); });
    toast('Documento apagado.');
  }

  Views.tripDocs = section;
  return {
    actions: {
      'tripdoc-add': (el) => pick(el.dataset.id),
      'tripdoc-open': open,
      'tripdoc-del': remove,
    },
    _test: { guessKind, typeOf, askKind, upload },
  };
};
