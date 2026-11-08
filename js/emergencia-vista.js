/*
 * 🆘 Emergência (vista): kit de 72 horas com validades, plano da família, powerbanks, rádios e animais.
 * Tudo fica na colecção `emergencia` (um registo por coisa, com `kind`). A família toda vê e altera:
 * numa emergência, qualquer um tem de saber onde está o quê. Funciona sem rede como o resto do portal
 * (os dados ficam no telemóvel) e o plano imprime-se numa folha para guardar dentro do kit.
 */
window.EmergenciaVista = function ({ render }) {
  const E = Emergencia;
  const { esc, today, fmtDate } = U;
  const { openForm, editItem, toast } = UI;
  const { VS } = Views;
  const { card, empty, progress } = Views.h;
  const S = () => Store.state;
  const all = () => S().emergencia || [];
  const of = (kind) => all().filter((x) => x.kind === kind);
  const plan = () => all().find((x) => x.id === 'plano') || {};
  const pets = () => of('animal');
  const people = () => S().members.length;
  const find = (id) => all().find((x) => x.id === id);
  const change = (id, fn) => Store.update((s) => { const x = s.emergencia.find((i) => i.id === id); if (x) fn(x); });

  const ago = (days) => (days == null ? 'nunca' : days === 0 ? 'hoje' : days === 1 ? 'ontem' : `há ${days} dias`);
  const EXP_LABEL = { expired: '⛔ expirado', soon: '⚠️ expira em breve', ok: '✅ dentro da validade' };

  /* ---------- Kit ---------- */
  function itemRow(x) {
    const st = x.have ? E.expiry(x.expires, today()) : '';
    const need = E.need(x, { people: people(), pets: pets() });
    const meta = [
      need && `Precisam de: ${esc(need)}`,
      x.qty && `Têm: ${esc(x.qty)}`,
      x.expires && `${EXP_LABEL[st] || ''} ${esc(fmtDate(x.expires))}`,
      x.notes && esc(x.notes),
    ].filter(Boolean).join(' · ');
    return `<li class="emg-item ${x.have ? 'have' : ''} ${st}">
      <label class="emg-check"><input type="checkbox" data-action="emg-have" data-id="${x.id}" ${x.have ? 'checked' : ''} aria-label="Já temos">
        <span class="emg-name">${esc(x.name)}</span></label>
      ${meta ? `<small class="emg-meta">${meta}</small>` : ''}
      <button class="icon-btn small emg-edit" data-action="emg-item" data-id="${x.id}" aria-label="Editar">✎</button></li>`;
  }

  function kitTab(sum) {
    const items = of('item');
    if (!items.length) {
      return `<section class="card"><p>Ainda não há nada no kit. Comecem pela lista recomendada pela Proteção Civil para 72 horas,
        já com as quantidades para ${people()} pessoa${people() === 1 ? '' : 's'}${pets().length ? ` e ${pets().length} animal${pets().length === 1 ? '' : 'is'}` : ''}.</p>
        <button class="btn primary" data-action="emg-seed">📋 Carregar a lista recomendada</button>
        <button class="btn" data-action="emg-item">＋ Juntar uma coisa</button></section>`;
    }
    const filter = VS.emgFilter || 'tudo';
    const show = (x) => filter === 'tudo' || (filter === 'falta' ? !x.have : x.have && ['expired', 'soon'].includes(E.expiry(x.expires, today())));
    const FILTERS = [['tudo', 'Tudo'], ['falta', `Falta (${sum.missing.length})`], ['validade', `Validades (${sum.expired.length + sum.soon.length})`]];
    const groups = E.CATS.map(([cat, label]) => [label, items.filter((x) => (x.cat || 'outros') === cat && show(x))]).filter(([, l]) => l.length);
    const missingPets = pets().length && E.seed(items, pets(), () => '').length;
    return `<div class="tabs emg-filters">${FILTERS.map(([id, label]) => `<button class="tab ${filter === id ? 'active' : ''}" data-action="emg-filter" data-id="${id}" style="--c:#ef4444">${label}</button>`).join('')}
        <button class="btn small" data-action="emg-item">＋ Juntar</button></div>
      ${missingPets ? `<p class="small"><button class="btn small" data-action="emg-seed">🐾 Juntar ao kit as coisas para os animais</button></p>` : ''}
      ${groups.length ? groups.map(([label, l]) => card(label, `<ul class="list emg-list">${l.map(itemRow).join('')}</ul>`)).join('')
        : empty(filter === 'falta' ? 'Já têm tudo! 🎉' : 'Nada a expirar nos próximos 30 dias.')}`;
  }

  const itemFields = () => [
    { name: 'name', label: 'O quê', required: true },
    { name: 'cat', label: 'Grupo', type: 'select', options: E.CATS },
    { name: 'have', label: 'Já temos?', type: 'select', half: true, options: [['', 'Ainda não'], ['1', 'Sim, está no kit']] },
    { name: 'qty', label: 'Quanto temos', half: true, placeholder: 'ex.: 6 garrafas de 1,5 L' },
    { name: 'expires', label: 'Validade (a mais próxima)', type: 'date', half: true },
    { name: 'notes', label: 'Notas', type: 'textarea', rows: 2 },
  ];
  function editKitItem(el) {
    const id = el?.dataset?.id || null;
    const x = id && find(id);
    editItem('emergencia', id, {
      title: 'coisa do kit',
      fields: itemFields(),
      defaults: () => ({ kind: 'item', cat: 'outros', have: false, qty: '', expires: '', notes: '', ref: '', calc: '' }),
      transform: (d) => ({ ...d, have: d.have === '1' || d.have === true }),
    });
    // O select "Já temos?" guarda '1' / ''; ao abrir um item que já existe, mostra o valor certo.
    const sel = document.querySelector('#f-have');
    if (sel && x) sel.value = x.have ? '1' : '';
  }

  /* ---------- Plano ---------- */
  const PLAN_FIELDS = [
    { name: 'meetNear', label: '📍 Ponto de encontro perto de casa', placeholder: 'ex.: à porta do café da esquina' },
    { name: 'meetFar', label: '📍 Ponto de encontro fora do bairro (se não der para voltar a casa)', placeholder: 'ex.: casa dos avós' },
    { name: 'outContact', label: '📞 Contacto fora da zona (todos ligam para ele a dizer que estão bem)', placeholder: 'ex.: tia Ana, 912 345 678' },
    { name: 'school', label: '🎒 Se as filhas estiverem na escola', type: 'textarea', rows: 2, placeholder: 'ex.: ficam na escola; vai buscá-las quem estiver mais perto' },
    { name: 'water', label: '💧 Onde se fecha a água', half: true },
    { name: 'gas', label: '🔥 Onde se fecha o gás', half: true },
    { name: 'power', label: '⚡ Quadro eléctrico', half: true },
    { name: 'kitPlace', label: '🎒 Onde está o kit', half: true },
    { name: 'notes', label: 'Outras notas', type: 'textarea', rows: 3 },
  ];
  function editPlan() {
    openForm({
      title: 'Plano da família',
      fields: PLAN_FIELDS,
      values: plan(),
      onSubmit: (d) => Store.update((s) => {
        const cur = s.emergencia.find((x) => x.id === 'plano');
        if (cur) Object.assign(cur, d);
        else s.emergencia.push({ id: 'plano', kind: 'plano', ...d });
      }),
    });
  }

  const tel = (n) => `<a href="tel:${esc(String(n).replace(/[^\d+]/g, ''))}">${esc(n)}</a>`;
  function planTab() {
    const p = plan();
    const line = (f) => (p[f.name] ? `<dt>${esc(f.label)}</dt><dd class="pre">${esc(p[f.name])}</dd>` : '');
    const filled = PLAN_FIELDS.some((f) => p[f.name]);
    const contacts = of('contacto');
    return `${card('🗺️ Plano da família', filled ? `<dl class="emg-plan">${PLAN_FIELDS.map(line).join('')}</dl>`
      : `<p>Combinem onde se encontram se a rede falhar e ninguém se conseguir ligar. Bastam 5 minutos à mesa do jantar.</p>`,
    { action: `<button class="btn small ${filled ? '' : 'primary'}" data-action="emg-plan">${filled ? '✎ Editar' : '✎ Preencher'}</button>` })}
      ${card('📞 Números de emergência', `<ul class="list emg-numbers">
        ${E.NUMBERS.map(([n, l]) => `<li>${tel(n)} <small class="muted">${esc(l)}</small></li>`).join('')}
        ${contacts.map((c) => `<li>${c.phone ? tel(c.phone) : '—'} <b>${esc(c.name)}</b>${c.role ? ` <small class="muted">${esc(c.role)}</small>` : ''}
          <button class="icon-btn small" data-action="emg-contact" data-id="${c.id}" aria-label="Editar">✎</button></li>`).join('')}
        </ul>`, { action: '<button class="btn small" data-action="emg-contact">＋ Contacto</button>' })}
      ${card('ℹ️ Se acontecer', `<ol class="emg-steps">
        <li>Mantenham a calma e confirmem que estão todos bem.</li>
        <li>Liguem o rádio FM para ouvir as instruções da Proteção Civil (as rádios nacionais dão os avisos).</li>
        <li>Se houver cheiro a gás, fechem o gás e não acendam luzes nem fósforos.</li>
        <li>Mandem uma SMS ao contacto fora da zona: as mensagens passam quando as chamadas não passam.</li>
        <li>Poupem a bateria: modo de poupança, brilho no mínimo, e só liguem os dados quando for preciso.</li>
        <li>Se tiverem de sair de casa, levem o kit e os animais e vão para o ponto de encontro.</li></ol>`)}`;
  }

  /* ---------- Energia e rádios ---------- */
  function bankRow(b) {
    const c = E.charge(b.lastCharge, today());
    const n = E.phoneCharges([b]);
    return `<li class="emg-dev ${c.due ? 'due' : ''}">
      <div><b>🔋 ${esc(b.name)}</b> <small class="muted">${b.mah ? `${esc(b.mah)} mAh · ` : ''}${b.level !== '' && b.level != null ? `${esc(b.level)}% · ` : ''}≈ ${String(n).replace('.', ',')} carga${n === 1 ? '' : 's'}</small>
        <br><small class="${c.due ? 'neg' : 'muted'}">Última carga: ${ago(c.days)}${c.due ? ' · ⚠️ está na hora de carregar' : ` · próxima até ${esc(fmtDate(c.next))}`}</small></div>
      <div class="emg-dev-acts"><button class="btn small" data-action="emg-charged" data-id="${b.id}">⚡ Carreguei hoje</button>
        <button class="icon-btn small" data-action="emg-bank" data-id="${b.id}" aria-label="Editar">✎</button></div></li>`;
  }
  const BATT = { cheia: '🟢 cheia', meia: '🟡 a meio', vazia: '🔴 vazia', '': '—' };
  function radioRow(r) {
    const c = E.charge(r.lastCheck, today());
    return `<li class="emg-dev ${c.due ? 'due' : ''}">
      <div><b>📻 ${esc(r.name)}</b> <small class="muted">${[r.model, r.holder && `fica com ${r.holder}`].filter(Boolean).map(esc).join(' · ')}</small>
        <br><small class="${c.due ? 'neg' : 'muted'}">Bateria: ${BATT[r.battery || '']} · testado ${ago(c.days)}${c.due ? ' · ⚠️ testar e carregar' : ''}</small></div>
      <div class="emg-dev-acts"><button class="btn small" data-action="emg-tested" data-id="${r.id}">✔️ Testei hoje</button>
        <button class="icon-btn small" data-action="emg-radio" data-id="${r.id}" aria-label="Editar">✎</button></div></li>`;
  }
  function channelRow(c) {
    return `<tr><td><b>${esc(c.name)}</b></td><td>${esc(c.freq || '—')}</td><td>${esc(c.channel || '—')}</td><td>${esc(c.tone || '—')}</td>
      <td>${esc(c.schedule || '')}${c.notes ? `<br><small class="muted">${esc(c.notes)}</small>` : ''}</td>
      <td><button class="icon-btn small" data-action="emg-channel" data-id="${c.id}" aria-label="Editar">✎</button></td></tr>`;
  }
  function energiaTab(sum) {
    const banks = of('powerbank');
    const radios = of('radio');
    const chans = of('canal');
    return `${card('🔋 Powerbanks', `${banks.length ? `<p class="emg-big">≈ <b>${String(sum.charges).replace('.', ',')}</b> cargas de telemóvel no total</p>
        <ul class="list">${banks.map(bankRow).join('')}</ul>` : empty('Registem os powerbanks para saberem quantas cargas têm e quando os carregar.')}
        <p class="small muted">💡 Os powerbanks perdem carga parados: carreguem-nos de 3 em 3 meses e guardem-nos longe do calor.</p>`,
    { action: '<button class="btn small" data-action="emg-bank">＋ Powerbank</button>' })}
      ${card('📻 Rádios', radios.length ? `<ul class="list">${radios.map(radioRow).join('')}</ul>` : empty('Registem os rádios: quem fica com cada um e o estado da bateria.'),
    { action: '<button class="btn small" data-action="emg-radio">＋ Rádio</button>' })}
      ${card('📡 Canais combinados', `${chans.length ? `<div class="emg-wrap"><table class="emg-chans"><thead><tr><th>Nome</th><th>Frequência (MHz)</th><th>Canal</th><th>Tom</th><th>Quando</th><th></th></tr></thead>
        <tbody>${chans.map(channelRow).join('')}</tbody></table></div>`
        : empty('Combinem um canal principal e um alternativo, e uma hora de escuta (ex.: 5 minutos a cada hora certa).')}`,
    { action: '<button class="btn small" data-action="emg-channel">＋ Canal</button>' })}
      ${card('🗣️ Como usar o rádio (para quem não está habituado)', `<ol class="emg-steps">
        <li>Ligar o rádio e confirmar que está no canal combinado (ver a tabela acima).</li>
        <li>Carregar no botão de falar (PTT), esperar 1 segundo e só depois falar, com o rádio a um palmo da boca.</li>
        <li>Começar com quem chama e quem fala: <i>"Pai, aqui Mariana. Escuto."</i> e soltar o botão.</li>
        <li>Falar curto. Só um fala de cada vez: enquanto se carrega no botão não se ouve nada.</li>
        <li>Se ninguém responder, tentar no canal alternativo e à hora de escuta combinada.</li>
        <li>Poupar a bateria: desligar o rádio entre as horas de escuta.</li></ol>
        <p class="small muted">⚖️ Para emitir nas frequências de radioamador é precisa licença (ANACOM). Para quem não a tem, os canais PMR446 (446 MHz) são de uso livre na Europa.</p>`)}`;
  }

  /* ---------- Animais ---------- */
  function animaisTab() {
    const list = pets();
    return card('🐾 Os nossos animais', `${list.length ? `<ul class="list">${list.map((p) => `<li class="emg-dev">
        <div><b>${E.speciesIcon(p.species)} ${esc(p.name)}</b>
        <br><small class="muted">${[p.food && `come: ${p.food}`, p.meds && `medicação: ${p.meds}`, p.chip && `chip ${p.chip}`, p.vet && `vet: ${p.vet}`, p.notes].filter(Boolean).map(esc).join(' · ') || '—'}</small></div>
        <button class="icon-btn small" data-action="emg-pet" data-id="${p.id}" aria-label="Editar">✎</button></li>`).join('')}</ul>`
      : empty('Registem os animais para o kit contar com a comida e a água deles.')}
      <p class="small muted">💡 Tenham uma fotografia recente de cada animal no telemóvel e em papel, para o caso de se perderem.</p>`,
    { action: '<button class="btn small" data-action="emg-pet">＋ Animal</button>' });
  }

  /* ---------- Página ---------- */
  function view() {
    const sum = E.summary(all(), today());
    const tab = VS.emgTab || 'kit';
    const TABS = [
      ['kit', `🎒 Kit${sum.missing.length ? ` (${sum.missing.length} em falta)` : ''}`],
      ['plano', '🗺️ Plano'],
      ['energia', `🔋 Energia e rádios${sum.banksDue.length + sum.radiosDue.length ? ' ⚠️' : ''}`],
      ['animais', `🐾 Animais${pets().length ? ` (${pets().length})` : ''}`],
    ];
    const alerts = [
      sum.expired.length && `⛔ ${sum.expired.length} expirado${sum.expired.length === 1 ? '' : 's'}`,
      sum.soon.length && `⚠️ ${sum.soon.length} a expirar em 30 dias`,
      sum.banksDue.length && `🔋 ${sum.banksDue.length} powerbank${sum.banksDue.length === 1 ? '' : 's'} por carregar`,
      sum.radiosDue.length && `📻 ${sum.radiosDue.length} rádio${sum.radiosDue.length === 1 ? '' : 's'} por testar`,
    ].filter(Boolean);
    const body = { kit: kitTab, plano: planTab, energia: energiaTab, animais: animaisTab }[tab] || kitTab;
    return `<div class="page-head"><div><h1>Emergência</h1>
        <p class="muted">Kit para 72 horas e plano da família, como recomendam a Proteção Civil e a União Europeia.</p></div>
        <div class="quick"><button class="btn small" data-action="emg-copy">📋 Copiar plano</button><button class="btn small" data-action="emg-print">🖨️ Imprimir</button></div></div>
      <section class="card emg-sum ${alerts.length ? 'attention' : ''}">
        ${sum.items ? `<div><b>Kit pronto a ${sum.ready}%</b> ${progress(sum.have, sum.items)}</div>` : '<b>Kit por montar</b>'}
        ${alerts.length ? `<p class="emg-alerts">${alerts.join(' · ')}</p>` : sum.items ? '<p class="small muted">Sem avisos. Revejam o kit de 6 em 6 meses (por exemplo, quando muda a hora).</p>' : ''}
        <p class="small muted">📴 Esta página funciona sem internet: abram o portal pelo menos uma vez com rede e fica guardado no telemóvel.</p>
      </section>
      <div class="tabs" role="tablist">${TABS.map(([id, label]) => `<button role="tab" aria-selected="${tab === id}" class="tab ${tab === id ? 'active' : ''}"
        data-action="emg-tab" data-id="${id}" style="--c:#ef4444">${label}</button>`).join('')}</div>
      ${body(sum)}
      <section class="emg-print" aria-hidden="true">${printHTML()}</section>`;
  }

  /* ---------- Imprimir / copiar ---------- */
  const planData = () => ({ plan: plan(), contacts: of('contacto'), channels: of('canal'), pets: pets(), members: S().members });
  function printHTML() {
    const items = of('item');
    const kit = E.CATS.map(([cat, label]) => [label, items.filter((x) => (x.cat || 'outros') === cat)]).filter(([, l]) => l.length);
    return `<pre>${esc(E.planText(planData()))}</pre>
      ${kit.length ? `<h2>🎒 Kit de 72 horas</h2>${kit.map(([label, l]) => `<h3>${esc(label)}</h3><ul>${l.map((x) => {
        const need = E.need(x, { people: people(), pets: pets() });
        return `<li>${x.have ? '☑' : '☐'} ${esc(x.name)}${need ? ` (${esc(need)})` : ''}${x.expires ? ` · validade ${esc(fmtDate(x.expires))}` : ''}</li>`;
      }).join('')}</ul>`).join('')}` : ''}
      <p><small>Impresso a ${esc(fmtDate(today()))} · Portal da Família</small></p>`;
  }

  /* ---------- Formulários ---------- */
  const forms = {
    contacto: { title: 'contacto de emergência', fields: [
      { name: 'name', label: 'Nome', required: true }, { name: 'phone', label: 'Telefone', type: 'tel', half: true },
      { name: 'role', label: 'Quem é', half: true, placeholder: 'ex.: vizinha, médico de família' }, { name: 'notes', label: 'Notas', type: 'textarea', rows: 2 }] },
    powerbank: { title: 'powerbank', fields: [
      { name: 'name', label: 'Nome', required: true, placeholder: 'ex.: Powerbank preto 20000' },
      { name: 'mah', label: 'Capacidade (mAh)', type: 'number', min: 0, half: true, inputmode: 'numeric' },
      { name: 'level', label: 'Carga agora (%)', type: 'number', min: 0, half: true, default: 100 },
      { name: 'lastCharge', label: 'Última carga', type: 'date', half: true },
      { name: 'notes', label: 'Notas (cabos, onde está)', half: true }] },
    radio: { title: 'rádio', fields: [
      { name: 'name', label: 'Nome', required: true, placeholder: 'ex.: Rádio 1' },
      { name: 'model', label: 'Modelo', half: true }, { name: 'holder', label: 'Fica com', half: true, placeholder: 'ex.: Luís, no carro' },
      { name: 'battery', label: 'Bateria', type: 'select', half: true, options: [['cheia', '🟢 Cheia'], ['meia', '🟡 A meio'], ['vazia', '🔴 Vazia'], ['', '—']] },
      { name: 'lastCheck', label: 'Último teste', type: 'date', half: true },
      { name: 'notes', label: 'Notas (pilhas, carregador, antena)', type: 'textarea', rows: 2 }] },
    canal: { title: 'canal combinado', fields: [
      { name: 'name', label: 'Nome', required: true, placeholder: 'ex.: Principal, Alternativo' },
      { name: 'freq', label: 'Frequência (MHz)', half: true, placeholder: 'ex.: 446.00625', inputmode: 'decimal' },
      { name: 'channel', label: 'Canal no rádio', half: true },
      { name: 'tone', label: 'Tom CTCSS / DCS', half: true, placeholder: 'ex.: 88.5' },
      { name: 'schedule', label: 'Quando se ouve', half: true, placeholder: 'ex.: 5 min a cada hora certa' },
      { name: 'notes', label: 'Notas', type: 'textarea', rows: 2 }] },
    animal: { title: 'animal', fields: [
      { name: 'name', label: 'Nome', required: true }, { name: 'species', label: 'O que é', type: 'select', half: true, options: E.SPECIES },
      { name: 'food', label: 'O que come (e quanto por dia)', half: true }, { name: 'meds', label: 'Medicação', half: true },
      { name: 'chip', label: 'Nº do chip', half: true }, { name: 'vet', label: 'Veterinário (nome e telefone)' },
      { name: 'notes', label: 'Notas', type: 'textarea', rows: 2 }] },
  };
  const edit = (kind) => (el) => editItem('emergencia', el?.dataset?.id || null, {
    ...forms[kind], defaults: () => ({ kind }),
    ...(kind === 'powerbank' ? { preset: { lastCharge: today() } } : kind === 'radio' ? { preset: { lastCheck: today(), battery: 'cheia' } } : {}),
  });

  const actions = {
    'emg-tab': (el) => { VS.emgTab = el.dataset.id; render(); },
    'emg-filter': (el) => { VS.emgFilter = el.dataset.id; render(); },
    'emg-seed': () => {
      const add = E.seed(of('item'), pets(), Store.uid);
      Store.update((s) => { s.emergencia.push(...add); });
      toast(add.length ? `📋 ${add.length} coisa${add.length === 1 ? '' : 's'} no kit. Marquem o que já têm.` : 'O kit já tem a lista toda.');
    },
    'emg-have': (el) => change(el.dataset.id, (x) => { x.have = !x.have; }),
    'emg-item': editKitItem,
    'emg-plan': editPlan,
    'emg-contact': edit('contacto'),
    'emg-bank': edit('powerbank'),
    'emg-radio': edit('radio'),
    'emg-channel': edit('canal'),
    'emg-pet': edit('animal'),
    'emg-charged': (el) => { change(el.dataset.id, (b) => { b.lastCharge = today(); b.level = 100; }); toast('🔋 Carregado. Próximo lembrete daqui a 3 meses.'); },
    'emg-tested': (el) => { change(el.dataset.id, (r) => { r.lastCheck = today(); r.battery = 'cheia'; }); toast('📻 Testado e carregado.'); },
    'emg-copy': async () => {
      try { await navigator.clipboard.writeText(E.planText(planData())); toast('📋 Plano copiado: colem-no numa mensagem.'); } catch { toast('Não consegui copiar.'); }
    },
    'emg-print': () => {
      document.body.classList.add('print-emg');
      window.addEventListener('afterprint', () => document.body.classList.remove('print-emg'), { once: true });
      window.print();
    },
  };

  // Aviso no painel quando há validades a passar, powerbanks por carregar ou rádios por testar.
  const prevExtra = Views.painelExtra;
  Views.painelExtra = () => {
    const sum = E.summary(all(), today());
    const bits = [
      sum.expired.length && `⛔ ${sum.expired.length} expirado${sum.expired.length === 1 ? '' : 's'}`,
      sum.soon.length && `⚠️ ${sum.soon.length} a expirar`,
      sum.banksDue.length && `🔋 ${sum.banksDue.length} por carregar`,
      sum.radiosDue.length && `📻 ${sum.radiosDue.length} por testar`,
    ].filter(Boolean);
    const mine = bits.length ? card('🆘 Kit de emergência', `<p>${bits.join(' · ')}</p>`,
      { cls: 'attention', action: '<a href="#/emergencia" class="link">Ver</a>' }) : '';
    return mine + (prevExtra ? prevExtra() : '');
  };

  // Secção nova, antes das Definições.
  const i = Views.routes.findIndex((r) => r[0] === 'definicoes');
  Views.routes.splice(i < 0 ? Views.routes.length : i, 0, ['emergencia', '🆘', 'Emergência', view]);

  return { actions };
};
