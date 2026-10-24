/*
 * 📥 Calendários de fora na Agenda: Google Calendar (e Outlook, iCloud…) pelo "endereço secreto no formato iCal".
 * Só leitura: os eventos aparecem na Agenda e no Painel, mas mudam-se no Google. O link fica no servidor
 * (função "calendario-externo"); a app só recebe os eventos. Cada pessoa escolhe quem vê: só ela, os pais ou a família.
 */
window.AgendaExterna = function ({ render }) {
  const { esc, fmtDate } = U;
  const { toast, openForm, member } = UI;
  const REFRESH_MS = 10 * 60 * 1000;
  const SHARE = [['family', '👪 A família toda'], ['parents', '👨‍👩 Só os pais'], ['me', '🔒 Só eu']];
  const SHARE_LABEL = Object.fromEntries(SHARE);

  let data = { calendars: [], events: [] };
  let loadedAt = 0;
  let loading = false;
  let byDate = new Map();

  /* ---------- Servidor ---------- */
  async function call(body) {
    const ctx = Cloud.ctx?.();
    if (!ctx) return { error: 'Os calendários do Google precisam da conta da família.' };
    const { data: res, error } = await ctx.client.functions.invoke('calendario-externo', { body });
    if (!error) return res || {};
    let out = { error: 'Sem ligação ao servidor. Tentem outra vez.' };
    try { out = { ...out, ...(await error.context.json()) }; } catch { /* sem JSON */ }
    return out;
  }
  function use(res) {
    if (!res || res.error || !Array.isArray(res.calendars)) return false;
    data = res;
    loadedAt = Date.now();
    // Índice por dia (eventos de vários dias aparecem em cada um).
    byDate = new Map();
    const cals = Object.fromEntries(data.calendars.map((c) => [c.id, c]));
    data.events.forEach((e) => {
      const cal = cals[e.cal];
      if (!cal) return;
      for (let d = e.date, i = 0; d <= (e.endDate || e.date) && i < 60; d = U.addDays(d, 1), i++) {
        (byDate.get(d) || byDate.set(d, []).get(d)).push({
          kind: 'ext', id: e.id, time: e.time || '', title: `📅 ${e.title}${e.allDay || d === e.date ? '' : ' (cont.)'}`,
          members: cal.member ? [cal.member] : [],
        });
      }
    });
    return true;
  }
  async function load(force = false) {
    if (loading || !Store.isRemote || !Cloud.ctx?.()) return;
    if (!force && Date.now() - loadedAt < REFRESH_MS) return;
    loading = true;
    try {
      const res = await call({ action: 'list' });
      if (use(res)) render();
      else loadedAt = Date.now(); // sem tabela/função ainda: não insistir a cada render
    } finally { loading = false; }
  }
  const find = (id) => data.events.find((e) => e.id === id);
  const calOf = (id) => data.calendars.find((c) => c.id === id);

  /* ---------- Na Agenda e no Painel ---------- */
  UI.extItems = (date) => byDate.get(date) || [];

  function showEvent(id) {
    const e = find(id);
    if (!e) return;
    const cal = calOf(e.cal);
    const when = e.allDay
      ? (e.endDate && e.endDate !== e.date ? `de ${fmtDate(e.date)} a ${fmtDate(e.endDate)}` : `${fmtDate(e.date)} · dia inteiro`)
      : `${fmtDate(e.date)} · ${e.time}${e.endTime ? `–${e.endTime}` : ''}${e.endDate && e.endDate !== e.date ? ` (até ${fmtDate(e.endDate)})` : ''}`;
    openForm({
      title: `📅 ${e.title}`,
      fields: [{ name: 'info', type: 'note', html: `<p><b>${esc(when)}</b></p>
        ${e.location ? `<p>📍 ${esc(e.location)}</p>` : ''}
        <p class="small muted">Do calendário «${esc(cal?.name || 'Google')}»${cal?.member ? ` de ${esc(member(cal.member)?.name || '')}` : ''}.
          Só se vê aqui: para mudar ou apagar, façam-no no Google Calendar (aparece cá passados uns minutos).</p>` }],
      submitLabel: 'Fechar',
      onSubmit: () => {},
    });
  }

  const ago = (iso) => {
    if (!iso) return 'ainda não';
    const min = Math.round((Date.now() - Date.parse(iso)) / 60000);
    return min < 1 ? 'agora mesmo' : min < 60 ? `há ${min} min` : min < 1440 ? `há ${Math.round(min / 60)} h` : `há ${Math.round(min / 1440)} dias`;
  };

  /** Linha na Agenda: de onde vêm os eventos 📅 e quando foram actualizados. */
  Views.extAgendaNote = () => (data.calendars.length ? `<p class="small muted ext-note">📅 ${data.calendars.map((c) => esc(c.name)).join(', ')}
      · actualizado ${esc(ago(data.calendars.map((c) => c.fetchedAt).filter(Boolean).sort()[0]))}
      <button class="linkish" data-action="ext-refresh">🔄 Actualizar</button></p>` : '');

  /* ---------- Definições ---------- */
  function panel() {
    const list = data.calendars.length ? `<ul class="ext-cals">${data.calendars.map((c) => `<li>
        <div><b>📅 ${esc(c.name)}</b> ${c.member ? UI.chip(c.member) : ''}
          <br><small class="muted">${esc(c.host)} · ${c.count} evento${c.count === 1 ? '' : 's'} · ${esc(SHARE_LABEL[c.share] || '')} · actualizado ${esc(ago(c.fetchedAt))}</small>
          ${c.error ? `<br><small class="ext-err">⚠️ ${esc(c.error)}</small>` : ''}</div>
        ${c.mine ? `<span class="ext-acts"><button class="btn small ghost" data-action="ext-edit" data-id="${esc(c.id)}">✎</button>
          <button class="btn small ghost" data-action="ext-del" data-id="${esc(c.id)}" aria-label="Desligar">✕</button></span>` : ''}
      </li>`).join('')}</ul>` : '';
    return `<p class="small">Os eventos do vosso Google Calendar (reuniões, consultas…) aparecem na Agenda do portal, marcados com 📅.
        Só leitura: o que mudarem no Google aparece cá (até ~30 minutos depois).</p>
      ${list}
      <div class="btn-row"><button class="btn small primary" data-action="ext-add">＋ Juntar o meu Google Calendar</button></div>
      `;
  }

  function addForm() {
    openForm({
      title: '📅 Juntar Google Calendar',
      fields: [
        { name: 'how', type: 'note', html: `<ol class="small ext-how">
          <li>Num <b>computador</b>, abram <b>calendar.google.com</b> (no telemóvel a app não mostra este link).</li>
          <li>⚙️ <b>Definições</b> → à esquerda, em «Definições dos meus calendários», toquem no vosso calendário.</li>
          <li>Desçam até <b>«Integrar o calendário»</b> e copiem o <b>«Endereço secreto no formato iCal»</b> (acaba em <code>basic.ics</code>).</li>
          <li>Colem-no aqui em baixo.</li></ol>
          <p class="small muted">🔒 O link é secreto: fica guardado só no servidor do portal e ninguém da família o vê. Se o desligarem, apaga-se.</p>` },
        { name: 'url', label: 'Endereço secreto no formato iCal', required: true, placeholder: 'https://calendar.google.com/calendar/ical/…/basic.ics' },
        { name: 'name', label: 'Nome (opcional)', placeholder: 'Ex.: Trabalho do Luís' },
        { name: 'share', label: 'Quem vê estes eventos no portal?', type: 'select', options: SHARE },
      ],
      values: { share: Store.isParent() ? 'parents' : 'me' },
      submitLabel: 'Juntar',
      onSubmit: (d) => {
        toast('📅 A ler o calendário…');
        call({ action: 'add', url: d.url.trim(), name: d.name.trim(), share: d.share }).then((res) => {
          if (!use(res)) { toast(res.error || 'Não consegui juntar o calendário.'); return; }
          const c = data.calendars.at(-1);
          toast(`📅 «${c?.name || 'Calendário'}» ligado: ${c?.count || 0} eventos na Agenda.`);
          render();
        });
      },
    });
  }

  function editForm(id) {
    const c = calOf(id);
    if (!c) return;
    openForm({
      title: `✎ ${c.name}`,
      fields: [
        { name: 'name', label: 'Nome', required: true },
        { name: 'share', label: 'Quem vê estes eventos no portal?', type: 'select', options: SHARE },
      ],
      values: { name: c.name, share: c.share },
      submitLabel: 'Guardar',
      onSubmit: (d) => {
        call({ action: 'update', id, name: d.name.trim(), share: d.share }).then((res) => {
          if (!use(res)) { toast(res.error || 'Não consegui guardar.'); return; }
          toast('✔ Guardado');
          render();
        });
      },
    });
  }

  async function remove(id) {
    const c = calOf(id);
    if (!c || !confirm(`Desligar «${c.name}»? Os eventos dele deixam de aparecer na Agenda (no Google fica tudo igual).`)) return;
    const res = await call({ action: 'remove', id });
    if (!use(res)) { toast(res.error || 'Não consegui desligar.'); return; }
    toast('Calendário desligado.');
    render();
  }

  async function refreshAll(el) {
    if (el) el.disabled = true;
    const mine = data.calendars.filter((c) => c.mine);
    // Os meus: lê já do Google; os dos outros: o que o servidor tiver (actualiza-os se tiverem mais de 30 min).
    for (const c of mine) await call({ action: 'refresh', id: c.id });
    loadedAt = 0;
    await load(true);
    toast('📅 Calendários actualizados.');
  }

  return {
    afterRender(main) {
      const route = location.hash || '#/painel';
      if (/^#\/(painel|agenda|definicoes)?/.test(route)) load();
      const el = main?.querySelector?.('#ext-cal-panel') || document.getElementById('ext-cal-panel');
      if (el) el.innerHTML = Cloud.ctx?.() ? panel() : '<p class="small muted">Precisa da conta da família.</p>';
    },
    actions: {
      'ext-event': (el) => showEvent(el.dataset.id),
      'ext-add': addForm,
      'ext-edit': (el) => editForm(el.dataset.id),
      'ext-del': (el) => remove(el.dataset.id),
      'ext-refresh': refreshAll,
    },
    _test: { use, panel },
  };
};
