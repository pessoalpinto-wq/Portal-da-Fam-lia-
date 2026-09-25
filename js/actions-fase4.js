/* Acções da Fase 4 (finanças, saúde, votações, memórias, boleias, estudo). Registadas pelo app.js. */
window.Fase4 = function ({ render, withButton }) {
  const { $, esc, today, money, addMonths, fmtDate } = U;
  const { editItem, openForm, toast, member } = UI;
  const { VS, Forms } = Views;
  const S = () => Store.state;
  const round2 = (n) => Math.round(Number(n) * 100) / 100;

  /* ---------- Dinheiro ---------- */
  const MONEY_TITLE = { oferta: 'Dar dinheiro', gasto: 'Registar gasto', poupanca: 'Pôr no mealheiro' };
  const MONEY_NOTE = { oferta: '', gasto: '', poupanca: '' };

  function moneyForm(el) {
    const kind = el.dataset.kind;
    const memberId = el.dataset.id;
    const goals = S().goals.filter((g) => g.memberId === memberId);
    const fields = [
      { name: 'amount', label: 'Valor (€)', type: 'number', min: 0.01, step: '0.01', required: true, half: true },
      { name: 'date', label: 'Data', type: 'date', required: true, half: true },
      ...(kind === 'poupanca' ? [{ name: 'goalId', label: 'Para o mealheiro', type: 'select', options: goals.map((g) => [g.id, `${g.emoji || '🐷'} ${g.title}`]) }] : []),
      { name: 'note', label: kind === 'gasto' ? 'Em quê?' : 'Nota', placeholder: kind === 'gasto' ? 'Ex.: lanche, cinema, livro' : kind === 'oferta' ? 'Ex.: prenda da avó, mesada extra' : '' },
    ];
    openForm({
      title: `${MONEY_TITLE[kind]} · ${member(memberId)?.name || ''}`,
      fields,
      values: { date: today(), note: MONEY_NOTE[kind], goalId: el.dataset.goal || goals[0]?.id },
      submitLabel: 'Registar',
      onSubmit: (d) => {
        const amount = round2(Math.abs(d.amount));
        if (!amount) return;
        if (kind !== 'oferta' && amount > Views.wallet(memberId)
          && !confirm(`A carteira só tem ${money(Views.wallet(memberId))}. Registar mesmo assim?`)) return;
        const goal = goals.find((g) => g.id === d.goalId);
        Store.update((s) => s.money.push({
          id: Store.uid(), memberId, date: d.date, kind, amount: kind === 'oferta' ? amount : -amount,
          note: d.note || (goal ? `Para: ${goal.title}` : { oferta: 'Dinheiro dos pais', gasto: 'Gasto' }[kind]), ...(goal ? { goalId: goal.id } : {}),
        }));
        toast(kind === 'poupanca' ? '🐷 Boa! Mais perto do objectivo.' : 'Registado ✔');
      },
    });
  }

  function goalWithdraw(el) {
    const g = S().goals.find((x) => x.id === el.dataset.id);
    if (!g) return;
    const saved = Views.goalSaved(g.id);
    openForm({
      title: `Tirar do mealheiro: ${g.title}`,
      fields: [{ name: 'amount', label: `Valor (€) — tem ${money(saved)}`, type: 'number', min: 0.01, step: '0.01', required: true }],
      values: { amount: saved },
      submitLabel: 'Devolver à carteira',
      onSubmit: (d) => {
        const amount = round2(Math.min(Math.abs(d.amount), saved));
        if (!amount) return;
        Store.update((s) => s.money.push({
          id: Store.uid(), memberId: g.memberId, date: today(), kind: 'levantamento', amount, goalId: g.id, note: `Do mealheiro: ${g.title}`,
        }));
      },
    });
  }

  function goalForm(el, isNew) {
    const g = isNew ? null : S().goals.find((x) => x.id === el.dataset.id);
    const owner = g?.memberId || el.dataset.id || S().currentUser;
    const canEdit = Store.isParent() || owner === S().currentUser;
    if (!canEdit) return;
    openForm({
      title: g ? `Mealheiro: ${g.title}` : 'Novo mealheiro',
      fields: Forms.goal(),
      values: g || { emoji: '🐷', memberId: owner },
      onSubmit: (d) => Store.update((s) => {
        const cur = g && s.goals.find((x) => x.id === g.id);
        const data = { ...d, target: round2(d.target), memberId: d.memberId || owner };
        if (cur) Object.assign(cur, data);
        else s.goals.push({ id: Store.uid(), ...data });
      }),
      onDelete: g ? () => {
        const saved = Views.goalSaved(g.id);
        if (saved > 0 && !Store.isParent()) {
          toast('Este mealheiro ainda tem dinheiro — pede aos pais para o devolver à carteira primeiro.');
          return;
        }
        Store.update((s) => {
          if (saved > 0) s.money.push({ id: Store.uid(), memberId: g.memberId, date: today(), kind: 'levantamento', amount: saved, goalId: g.id, note: `Do mealheiro: ${g.title}` });
          s.goals = s.goals.filter((x) => x.id !== g.id);
        });
      } : null,
    });
  }

  function allowanceForm(el) {
    const memberId = el.dataset.id;
    const cur = S().allowances.find((a) => a.memberId === memberId);
    const values = cur ? {
      ...cur,
      weekday: cur.frequency === 'monthly' ? 6 : cur.day,
      monthDay: cur.frequency === 'monthly' ? cur.day : 1,
      active: cur.active === false || cur.active === 'nao' ? 'nao' : 'sim',
    } : { amount: 5, frequency: 'weekly', weekday: 6, monthDay: 1, active: 'sim' };
    openForm({
      title: `Mesada · ${member(memberId)?.name || ''}`,
      fields: Forms.allowance(),
      values,
      onSubmit: (d) => Store.update((s) => {
        const data = {
          id: memberId, memberId, amount: round2(d.amount), frequency: d.frequency,
          day: d.frequency === 'monthly' ? Math.min(31, Math.max(1, Number(d.monthDay) || 1)) : Number(d.weekday),
          active: d.active,
        };
        const i = s.allowances.findIndex((a) => a.memberId === memberId);
        if (i >= 0) s.allowances[i] = data;
        else s.allowances.push(data);
      }),
      onDelete: cur ? () => Store.update((s) => { s.allowances = s.allowances.filter((a) => a.memberId !== memberId); }) : null,
    });
  }

  const BILL_MONTHS = { monthly: 1, bimonthly: 2, quarterly: 3, yearly: 12 };
  function payBill(el) {
    const b = S().bills.find((x) => x.id === el.dataset.id);
    if (!b || !confirm(`Marcar "${b.title}" (${money(b.amount)}) como paga?`)) return;
    Store.update((s) => {
      const cur = s.bills.find((x) => x.id === b.id);
      cur.history = [...(cur.history || []), { date: today(), amount: Number(cur.amount) || 0, forDue: cur.due }].slice(-24);
      if (BILL_MONTHS[cur.repeat]) cur.due = addMonths(cur.due, BILL_MONTHS[cur.repeat]);
      else cur.archived = true;
    });
    toast(`✔ Paga. ${BILL_MONTHS[b.repeat] ? 'Próxima data actualizada.' : ''}`);
  }

  /* ---------- Saúde ---------- */
  function healthcardForm(el) {
    const id = el.dataset.id;
    const cur = S().healthcards.find((x) => x.id === id);
    openForm({
      title: `Ficha de saúde · ${member(id)?.name || ''}`,
      fields: Forms.healthcard(),
      values: cur || {},
      onSubmit: (d) => Store.update((s) => {
        const i = s.healthcards.findIndex((x) => x.id === id);
        if (i >= 0) s.healthcards[i] = { id, ...d };
        else s.healthcards.push({ id, ...d });
      }),
    });
  }

  /* ---------- Votações ---------- */
  function pollNew() {
    openForm({
      title: 'Nova votação',
      fields: Forms.poll(),
      submitLabel: 'Criar',
      onSubmit: (d) => {
        const opts = [...new Set(d.optionsText.split('\n').map((x) => x.trim()).filter(Boolean))].slice(0, 8);
        if (opts.length < 2) { toast('Escreve pelo menos duas opções (uma por linha).'); return; }
        Store.update((s) => s.polls.push({
          id: Store.uid(), question: d.question, closes: d.closes, createdBy: s.currentUser, date: today(), closed: false,
          options: opts.map((text, i) => ({ id: `o${i + 1}`, text })),
        }));
        toast('🗳️ Votação criada — a família vai ser avisada.');
      },
    });
  }

  function pollEdit(el) {
    const p = S().polls.find((x) => x.id === el.dataset.id);
    if (!p) return;
    openForm({
      title: 'Editar votação',
      fields: [Forms.poll()[0], Forms.poll()[2]],
      values: p,
      onSubmit: (d) => Store.update((s) => Object.assign(s.polls.find((x) => x.id === p.id), { question: d.question, closes: d.closes })),
      onDelete: () => Store.update((s) => { s.polls = s.polls.filter((x) => x.id !== p.id); }),
    });
  }

  function vote(el) {
    const pollId = el.dataset.id;
    const optionId = el.dataset.sub;
    Store.update((s) => {
      const id = `${pollId}:${s.currentUser}`;
      const cur = s.votes.find((v) => v.id === id);
      if (cur) cur.optionId = optionId;
      else s.votes.push({ id, pollId, memberId: s.currentUser, optionId });
    });
  }

  /* ---------- Memórias ---------- */
  function openPhoto(el) {
    const p = S().photos.find((x) => x.id === el.dataset.id);
    if (!p) return;
    const dlg = $('#dialog');
    const trip = S().trips.find((t) => t.id === p.tripId);
    const canDelete = Store.isParent() || p.by === S().currentUser;
    dlg.innerHTML = `<div class="lightbox">
      <header class="form-head"><h2>${esc(p.caption || 'Memória')}</h2>
        <button type="button" class="icon-btn" data-action="dlg-close" aria-label="Fechar">✕</button></header>
      <img data-path="${esc(p.path)}" alt="${esc(p.caption || '')}">
      <footer class="form-actions">
        <small class="muted">${UI.avatar(p.by, 'sm')} ${esc(member(p.by)?.name || '')} · ${esc(fmtDate(p.taken || p.date))}${trip ? ` · ✈️ ${esc(trip.destination)}` : ''}</small>
        <span class="spacer"></span>
        <button class="btn small ghost" data-action="photo-caption" data-id="${p.id}">✎ Legenda</button>
        <a class="btn small ghost" id="photo-full" target="_blank" rel="noopener">⤢ Original</a>
        ${canDelete ? `<button class="btn small danger" data-action="photo-del" data-id="${p.id}">Apagar</button>` : ''}
      </footer></div>`;
    dlg.showModal();
    Photos.signed([p.path]).then((m) => {
      dlg.querySelector('img').src = m[p.path];
      dlg.querySelector('#photo-full').href = m[p.path];
    }).catch((e) => toast(e.message));
  }

  async function uploadPhotos(input) {
    const files = [...input.files];
    if (!files.length) return;
    const status = $('#upload-status');
    const tripId = $('#photo-trip')?.value || '';
    try {
      const n = await Photos.upload(files, { tripId }, (i, total) => {
        if (status) status.textContent = `A enviar ${i} de ${total}…`;
      });
      toast(`📸 ${n} foto${n === 1 ? '' : 's'} guardada${n === 1 ? '' : 's'}!`);
    } catch (e) {
      toast(e.message || String(e));
    } finally {
      input.value = '';
      if (status) status.textContent = '';
    }
  }

  const findExam = (el) => S().exams.find((x) => x.id === el.dataset.id);

  const actions = {
    'add-money': moneyForm,
    'goal-withdraw': goalWithdraw,
    'add-goal': (el) => goalForm(el, true),
    'edit-goal': (el) => goalForm(el, false),
    'edit-allowance': (el) => { if (Store.isParent()) allowanceForm(el); },
    'add-bill': (el) => editItem('bills', null, { title: 'conta', fields: Forms.bill(), defaults: () => ({ due: today(), repeat: 'monthly', category: 'Casa', auto: '', history: [] }) }),
    'edit-bill': (el) => editItem('bills', el.dataset.id, { title: 'conta', fields: Forms.bill() }),
    'pay-bill': payBill,
    'fin-tab': (el) => { VS.finTab = el.dataset.id; render(); },

    'add-date': () => editItem('dates', null, { title: 'data especial', fields: Forms.sdate(), defaults: () => ({ knowYear: 'sim', kind: 'Aniversário' }) }),
    'edit-date': (el) => editItem('dates', el.dataset.id, { title: 'data especial', fields: Forms.sdate() }),
    'i-drive': (el) => {
      Store.update((s) => { const e = s.events.find((x) => x.id === el.dataset.id); if (e) e.driver = s.currentUser; });
      toast('🚗 Ficaste com esta boleia.');
    },

    'health-tab': (el) => { VS.healthTab = el.dataset.id; render(); },
    'add-health': (el) => editItem('health', null, { title: 'registo de saúde', fields: Forms.health(), defaults: () => ({ memberId: el.dataset.id || VS.healthTab, date: today(), type: 'Consulta' }) }),
    'edit-health': (el) => editItem('health', el.dataset.id, { title: 'registo de saúde', fields: Forms.health() }),
    'edit-healthcard': healthcardForm,
    'add-doc': (el) => editItem('docs', null, { title: 'documento', fields: Forms.doc(), defaults: () => ({ memberId: el.dataset.id || '', type: 'Cartão de Cidadão' }) }),
    'edit-doc': (el) => editItem('docs', el.dataset.id, { title: 'documento', fields: Forms.doc() }),

    'add-poll': pollNew,
    'edit-poll': pollEdit,
    vote,
    'close-poll': (el) => Store.update((s) => {
      const p = s.polls.find((x) => x.id === el.dataset.id);
      if (!p) return;
      const closedByDate = p.closes && p.closes < today();
      if (p.closed || closedByDate) { p.closed = false; if (closedByDate) p.closes = ''; } else p.closed = true;
    }),

    'photo-filter': (el) => { VS.photoTrip = el.dataset.id; render(); },
    'photos-trip': (el) => { VS.photoTrip = el.dataset.id; location.hash = '#/memorias'; },
    'photo-open': openPhoto,
    'dlg-close': () => $('#dialog').close(),
    'photo-caption': (el) => {
      const p = S().photos.find((x) => x.id === el.dataset.id);
      const caption = prompt('Legenda da foto:', p?.caption || '');
      if (p && caption !== null) {
        Store.update((s) => { s.photos.find((x) => x.id === p.id).caption = caption.trim(); });
        $('#dialog').close();
      }
    },
    'photo-del': (el) => {
      const p = S().photos.find((x) => x.id === el.dataset.id);
      if (!p || !confirm('Apagar esta foto para toda a família?')) return;
      withButton(el, async () => { await Photos.remove(p); $('#dialog').close(); }, 'Foto apagada.');
    },

    'toggle-topic': (el) => Store.update(() => {
      const tp = (findExam(el)?.topics || []).find((x) => x.id === el.dataset.sub);
      if (tp) tp.done = !tp.done;
    }),
    'del-topic': (el) => Store.update((s) => {
      const x = s.exams.find((e) => e.id === el.dataset.id);
      if (x) x.topics = (x.topics || []).filter((tp) => tp.id !== el.dataset.sub);
    }),
  };

  const inlineForms = {
    'add-topic': (f, d) => Store.update((s) => {
      const x = s.exams.find((e) => e.id === f.dataset.id);
      if (x) x.topics = [...(x.topics || []), { id: Store.uid(), text: d.text, done: false }];
    }),
  };

  function onChange(el) {
    if (el.id === 'photo-input') { uploadPhotos(el); return true; }
    return false;
  }

  function afterRender(view) {
    if (view.querySelector('img[data-path]')) Photos.hydrate(view).catch((e) => console.warn(e));
  }

  return { actions, inlineForms, onChange, afterRender };
};
