/*
 * Viagens → 📇 Contactos e moradas: pessoas (guia, anfitrião do alojamento, amigos no destino…)
 * e moradas (hotel, restaurante, ponto de encontro…) da viagem, sem precisar de documento.
 * Ficam na própria viagem (trip.contacts), por isso funcionam também sem conta na nuvem.
 * Script "clássico": define globalThis.ViagemContactos (o módulo) e .util (funções puras, testadas).
 */
(function (root) {
  const KINDS = [['pessoa', '👤 Pessoa'], ['morada', '📍 Morada']];
  const clean = (v) => String(v ?? '').trim();
  const digits = (phone) => clean(phone).replace(/[^\d+]/g, '');

  /** Link para o mapa: o que a pessoa colou (se for um link) ou uma pesquisa da morada no Google Maps. */
  function mapUrl(c) {
    const link = clean(c.map);
    if (/^https?:\/\//i.test(link)) return link;
    if (/^(www\.|maps\.|goo\.gl\/)[^\s]+$/i.test(link)) return `https://${link}`; // colado sem o https://
    const q = clean(c.address) || link;
    return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : '';
  }

  /** Número para o WhatsApp (só dígitos; sem indicativo assume Portugal). */
  function whatsapp(phone) {
    let d = digits(phone);
    if (!d) return '';
    if (d.startsWith('+')) d = d.slice(1);
    else if (d.startsWith('00')) d = d.slice(2);
    else if (d.length === 9) d = `351${d}`;
    return d.length >= 8 ? `https://wa.me/${d}` : '';
  }

  /** Normaliza o que vem do formulário; devolve null se não houver nada que valha guardar. */
  function fromForm(d, kind) {
    const k = kind === 'morada' ? 'morada' : 'pessoa';
    const c = {
      kind: k, name: clean(d.name), phone: clean(d.phone), email: clean(d.email),
      address: clean(d.address), map: clean(d.map), notes: clean(d.notes),
    };
    if (!c.name && !c.phone && !c.email && !c.address && !c.map) return null;
    if (!c.name) c.name = k === 'morada' ? c.address.split(/[,\n]/)[0] || 'Morada' : c.phone || c.email;
    return c;
  }

  /** Pessoas primeiro, depois moradas; dentro de cada, por nome. */
  const sorted = (list) => [...list].sort((a, b) => (a.kind === 'morada') - (b.kind === 'morada')
    || String(a.name).localeCompare(String(b.name), 'pt'));

  /** Texto para copiar / partilhar (ex.: enviar a morada por mensagem). */
  function asText(c) {
    return [c.name, c.phone && `📞 ${c.phone}`, c.email && `✉️ ${c.email}`, c.address, mapUrl(c) && c.kind === 'morada' ? mapUrl(c) : '', c.notes]
      .filter(Boolean).join('\n');
  }

  const util = { KINDS, mapUrl, whatsapp, fromForm, sorted, asText };

  function make() {
    const { esc, today } = U;
    const { openForm, toast } = UI;
    const S = () => Store.state;
    const trip = (id) => S().trips.find((t) => t.id === id);
    const find = (el) => (trip(el.dataset.id)?.contacts || []).find((c) => c.id === el.dataset.sub);

    function item(tr, c) {
      const ico = c.kind === 'morada' ? '📍' : '👤';
      const sub = [c.kind === 'morada' ? c.address : [c.phone, c.email].filter(Boolean).join(' · '), c.notes].filter(Boolean).join(' · ');
      const map = c.kind === 'morada' || c.address ? mapUrl(c) : '';
      const wa = whatsapp(c.phone);
      return `<li>
        <button class="tripdoc-main" data-action="tripcontact-edit" data-id="${esc(tr.id)}" data-sub="${esc(c.id)}" title="Ver / editar">
          <span class="tripdoc-ico" aria-hidden="true">${ico}</span>
          <span class="tripdoc-txt"><b>${esc(c.name)}</b>${sub ? `<small class="muted">${esc(sub)}</small>` : ''}</span></button>
        <span class="tripcontact-acts">
          ${c.phone ? `<a class="icon-btn small" href="tel:${esc(digits(c.phone))}" aria-label="Ligar" title="Ligar">📞</a>` : ''}
          ${wa ? `<a class="icon-btn small" href="${esc(wa)}" target="_blank" rel="noopener" aria-label="WhatsApp" title="WhatsApp">💬</a>` : ''}
          ${c.email ? `<a class="icon-btn small" href="mailto:${esc(c.email)}" aria-label="Email" title="Email">✉️</a>` : ''}
          ${map ? `<a class="icon-btn small" href="${esc(map)}" target="_blank" rel="noopener" aria-label="Abrir no mapa" title="Abrir no mapa">🗺️</a>` : ''}
          <button class="icon-btn small" data-action="tripcontact-del" data-id="${esc(tr.id)}" data-sub="${esc(c.id)}" aria-label="Apagar">✕</button>
        </span></li>`;
    }

    function section(tr) {
      const list = sorted(tr.contacts || []);
      return `<h3 class="sub">📇 Contactos e moradas ${list.length ? `<small class="muted">(${list.length})</small>` : ''}
          <button class="linkish" data-action="tripcontact-add" data-id="${esc(tr.id)}" data-kind="pessoa">＋ pessoa</button>
          <button class="linkish" data-action="tripcontact-add" data-id="${esc(tr.id)}" data-kind="morada">＋ morada</button></h3>
        ${list.length ? `<ul class="tripdocs tripcontacts">${list.map((c) => item(tr, c)).join('')}</ul>`
          : '<p class="small muted">O contacto do anfitrião, do guia ou de amigos no destino, a morada do alojamento ou do restaurante… sem precisar de documento.</p>'}`;
    }

    function fields(kind) {
      const pessoa = kind !== 'morada';
      return [
        { name: 'name', label: pessoa ? 'Nome' : 'Nome do local', required: pessoa, placeholder: pessoa ? 'Ex.: Maria (anfitriã do Airbnb)' : 'Ex.: Hotel Miramar, restaurante, ponto de encontro…' },
        ...(pessoa ? [
          { name: 'phone', label: 'Telefone', type: 'tel', inputmode: 'tel', placeholder: '+351 912 345 678', half: true },
          { name: 'email', label: 'Email', type: 'email', placeholder: 'nome@exemplo.com', half: true },
          { name: 'address', label: 'Morada (opcional)', type: 'textarea', rows: 2 },
        ] : [
          { name: 'address', label: 'Morada', type: 'textarea', rows: 2, required: true, placeholder: 'Rua, número, código postal, cidade' },
          { name: 'map', label: 'Link do mapa (opcional)', inputmode: 'url', placeholder: 'Cola aqui o link do Google Maps (senão procuro pela morada)' },
          { name: 'phone', label: 'Telefone (opcional)', type: 'tel', inputmode: 'tel', half: true },
        ]),
        { name: 'notes', label: 'Notas', type: 'textarea', rows: 2, placeholder: pessoa ? 'Ex.: entrega as chaves às 15h; fala inglês' : 'Ex.: código da porta 1234; check-in a partir das 15h' },
      ];
    }

    function form(tripId, kind, c) {
      const tr = trip(tripId);
      if (!tr) return;
      const k = c?.kind || kind;
      openForm({
        title: `${k === 'morada' ? '📍' : '👤'} ${c ? 'Editar' : 'Nova'} ${k === 'morada' ? 'morada' : 'pessoa'} · ${tr.destination || ''}`,
        fields: fields(k),
        values: c || {},
        extra: c ? [{ label: '📋 Copiar', onClick: () => { copy(c); return false; } }] : [],
        onSubmit: (d) => {
          const v = fromForm(d, k);
          if (!v) { toast('Não havia nada para guardar.'); return; }
          Store.update((s) => {
            const t = s.trips.find((x) => x.id === tripId);
            if (!t) return;
            t.contacts = t.contacts || [];
            const old = c && t.contacts.find((x) => x.id === c.id);
            if (old) Object.assign(old, v);
            else t.contacts.push({ id: Store.uid(), ...v, by: s.currentUser, date: today() });
          });
          toast(c ? 'Guardado.' : `${k === 'morada' ? '📍 Morada' : '👤 Contacto'} juntado à viagem.`);
        },
        onDelete: c ? () => del(tripId, c.id) : undefined,
        deleteConfirm: c ? `Apagar "${c.name}" da viagem?` : undefined,
        deleteToast: 'Apagado da viagem.',
      });
    }

    function del(tripId, id) {
      Store.update((s) => { const t = s.trips.find((x) => x.id === tripId); if (t) t.contacts = (t.contacts || []).filter((x) => x.id !== id); });
    }

    async function copy(c) {
      try { await navigator.clipboard.writeText(asText(c)); toast('📋 Copiado.'); } catch { toast('Não consegui copiar.'); }
    }

    Views.tripContacts = section;
    return {
      actions: {
        'tripcontact-add': (el) => form(el.dataset.id, el.dataset.kind),
        'tripcontact-edit': (el) => { const c = find(el); if (c) form(el.dataset.id, c.kind, c); },
        'tripcontact-del': (el) => {
          const c = find(el);
          if (c && confirm(`Apagar "${c.name}" da viagem?`)) { del(el.dataset.id, c.id); toast('Apagado da viagem.'); }
        },
      },
    };
  }

  make.util = util;
  root.ViagemContactos = make;
})(globalThis);
