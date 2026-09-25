/* Componentes de interface reutilizáveis e regras do domínio. */
(function () {
  const { esc, $, today, addDays, addMonths, weekday, parseISO } = U;
  const S = () => Store.state;

  /* ---------- Membros ---------- */
  const member = (id) => S().members.find((m) => m.id === id);
  const memberOptions = (allowEmpty, emptyLabel = 'Todos / ninguém em particular') => [
    ...(allowEmpty ? [['', emptyLabel]] : []),
    ...S().members.map((m) => [m.id, `${m.emoji} ${m.name}`]),
  ];
  function chip(id) {
    const m = member(id);
    if (!m) return '';
    return `<span class="chip" style="--c:${esc(m.color)}">${esc(m.emoji)} ${esc(m.name)}</span>`;
  }
  const chips = (ids) => (ids || []).map(chip).join('');
  function avatar(id, size = '') {
    const m = member(id);
    if (!m) return '<span class="avatar avatar-all" title="Família">👪</span>';
    return `<span class="avatar ${size}" style="--c:${esc(m.color)}" title="${esc(m.name)}">${esc(m.emoji)}</span>`;
  }
  const colorOf = (ids) => member((ids || [])[0])?.color || '#94a3b8';

  /* ---------- Toast ---------- */
  let toastTimer;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  /* ---------- Formulário genérico em diálogo ---------- */
  function fieldHTML(f, value) {
    const v = value ?? f.default ?? '';
    const req = f.required ? 'required' : '';
    const id = `f-${f.name}`;
    if (f.type === 'members') {
      const sel = Array.isArray(v) ? v : [];
      return `<fieldset class="field"><legend>${esc(f.label)}</legend><div class="chip-checks">
        ${S().members.map((m) => `<label class="chip-check" style="--c:${esc(m.color)}">
          <input type="checkbox" name="${f.name}" value="${m.id}" ${sel.includes(m.id) ? 'checked' : ''}>
          <span>${esc(m.emoji)} ${esc(m.name)}</span></label>`).join('')}
      </div></fieldset>`;
    }
    let input;
    if (f.type === 'textarea') {
      input = `<textarea id="${id}" name="${f.name}" rows="${f.rows || 3}" ${req} placeholder="${esc(f.placeholder || '')}">${esc(v)}</textarea>`;
    } else if (f.type === 'select') {
      input = `<select id="${id}" name="${f.name}" ${req}>${f.options.map(([ov, ol]) =>
        `<option value="${esc(ov)}" ${String(ov) === String(v) ? 'selected' : ''}>${esc(ol)}</option>`).join('')}</select>`;
    } else {
      const extra = f.type === 'number' ? `step="${f.step || 1}" min="${f.min ?? ''}"` : '';
      input = `<input id="${id}" type="${f.type || 'text'}" name="${f.name}" value="${esc(v)}" ${req} ${extra}
        placeholder="${esc(f.placeholder || '')}">`;
    }
    return `<label class="field ${f.half ? 'half' : ''}" for="${id}"><span>${esc(f.label)}</span>${input}</label>`;
  }

  function readForm(form, fields) {
    const out = {};
    fields.forEach((f) => {
      if (f.type === 'members') {
        out[f.name] = [...form.querySelectorAll(`input[name="${f.name}"]:checked`)].map((i) => i.value);
      } else {
        const el = form.elements[f.name];
        const raw = el ? el.value.trim() : '';
        out[f.name] = f.type === 'number' ? (raw === '' ? 0 : Number(raw)) : raw;
      }
    });
    return out;
  }

  function openForm({ title, fields, values = {}, onSubmit, onDelete, submitLabel = 'Guardar' }) {
    const dlg = $('#dialog');
    dlg.innerHTML = `<form class="form" novalidate>
      <header class="form-head"><h2>${esc(title)}</h2>
        <button type="button" class="icon-btn" data-dlg="cancel" aria-label="Fechar">✕</button></header>
      <div class="form-grid">${fields.map((f) => fieldHTML(f, values[f.name])).join('')}</div>
      <footer class="form-actions">
        ${onDelete ? '<button type="button" class="btn danger" data-dlg="delete">Apagar</button>' : ''}
        <span class="spacer"></span>
        <button type="button" class="btn ghost" data-dlg="cancel">Cancelar</button>
        <button type="submit" class="btn primary">${esc(submitLabel)}</button>
      </footer></form>`;
    const form = dlg.querySelector('form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      onSubmit(readForm(form, fields));
      dlg.close();
    });
    dlg.querySelectorAll('[data-dlg=cancel]').forEach((b) => b.addEventListener('click', () => dlg.close()));
    if (onDelete) {
      dlg.querySelector('[data-dlg=delete]').addEventListener('click', () => {
        if (confirm('Tens a certeza que queres apagar?')) {
          onDelete();
          dlg.close();
          toast('Apagado.');
        }
      });
    }
    dlg.showModal();
    form.querySelector('input:not([type=checkbox]),textarea,select')?.focus();
  }

  /** Criar/editar um item de uma colecção do estado com um formulário. */
  function editItem(coll, id, { title, fields, defaults = () => ({}), preset = {} }) {
    const item = id ? S()[coll].find((x) => x.id === id) : null;
    openForm({
      title: `${item ? 'Editar' : 'Novo'}: ${title}`,
      fields,
      values: item || { ...defaults(), ...preset },
      onSubmit: (data) => Store.update((s) => {
        const cur = item && s[coll].find((x) => x.id === id);
        if (cur) Object.assign(cur, data);
        else s[coll].push({ id: Store.uid(), ...defaults(), ...preset, ...data });
      }),
      onDelete: item ? () => Store.update((s) => { s[coll] = s[coll].filter((x) => x.id !== id); }) : null,
    });
  }

  /* ---------- Regras do domínio ---------- */
  function eventsOn(date) {
    const wd = weekday(date);
    return S().events.filter((e) => {
      if (!e.date) return false;
      if (e.date === date) return true;
      if (e.date > date || (e.until && date > e.until)) return false;
      if (e.repeat === 'weekly') return weekday(e.date) === wd;
      if (e.repeat === 'monthly') return parseISO(e.date).getDate() === parseISO(date).getDate();
      if (e.repeat === 'yearly') return e.date.slice(5) === date.slice(5);
      return false;
    }).sort((a, b) => (a.start || '').localeCompare(b.start || ''));
  }

  const classesOn = (memberId, date) => S().classes
    .filter((c) => c.memberId === memberId && Number(c.day) === weekday(date))
    .sort((a, b) => a.start.localeCompare(b.start));

  /** Tudo o que acontece num dia (para o calendário e o painel). */
  function itemsOn(date) {
    const s = S();
    const out = [];
    eventsOn(date).forEach((e) => out.push({ kind: 'event', id: e.id, time: e.start, title: e.title, members: e.members }));
    s.exams.filter((x) => x.date === date).forEach((x) => out.push({
      kind: 'exam', id: x.id, title: `📝 ${x.kind}: ${x.subject}`, members: [x.memberId],
    }));
    s.tasks.filter((t) => !t.done && t.due === date).forEach((t) => out.push({
      kind: 'task', id: t.id, title: `✅ ${t.title}`, members: t.assignee ? [t.assignee] : [],
    }));
    s.trips.filter((t) => t.start && t.start <= date && date <= (t.end || t.start)).forEach((t) => out.push({
      kind: 'trip', id: t.id, title: `✈️ ${t.destination}`, members: t.members,
    }));
    s.members.filter((m) => m.birthday && m.birthday.slice(5) === date.slice(5)).forEach((m) => out.push({
      kind: 'bday', id: m.id, title: `🎂 Anos: ${m.name}`, members: [m.id],
    }));
    (s.dates || []).filter((d) => d.date && d.date.slice(5) === date.slice(5)).forEach((d) => out.push({
      kind: 'sdate', id: d.id, title: `🎉 ${d.title}`, members: [],
    }));
    (s.health || []).filter((h) => h.next === date).forEach((h) => out.push({
      kind: 'health', id: h.id, title: `🏥 ${h.nextLabel || h.title}`, members: [h.memberId],
    }));
    (s.docs || []).filter((d) => d.expires === date).forEach((d) => out.push({
      kind: 'doc', id: d.id, title: `🔐 Expira: ${d.type}`, members: d.memberId ? [d.memberId] : [],
    }));
    if (Store.isParent()) {
      (s.bills || []).filter((b) => b.due === date && !b.archived).forEach((b) => out.push({
        kind: 'bill', id: b.id, title: `💶 ${b.title}`, members: [],
      }));
    }
    return out.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  }

  function nextDue(from, repeat) {
    if (repeat === 'daily') return addDays(from, 1);
    if (repeat === 'weekly') return addDays(from, 7);
    if (repeat === 'monthly') return addMonths(from, 1);
    return from;
  }

  /** Dá os pontos e fecha (ou reagenda) a tarefa. Só pais alteram pontos. */
  function applyCompletion(id) {
    let msg = '';
    Store.update((s) => {
      const t = s.tasks.find((x) => x.id === id);
      if (!t) return;
      const byId = t.pending?.by || t.assignee;
      const who = s.members.find((m) => m.id === byId);
      const pts = Number(t.points) || 0;
      if (who) who.points += pts;
      t.history = [...(t.history || []), { date: t.pending?.date || today(), by: byId, points: pts }].slice(-50);
      delete t.pending;
      if (!t.repeat || t.repeat === 'none') {
        t.done = true;
        t.doneAt = today();
      } else {
        let d = t.due || today();
        do { d = nextDue(d, t.repeat); } while (d <= today());
        t.due = d;
      }
      msg = who && pts ? `Boa, ${who.name}! +${pts} pontos ⭐` : 'Tarefa concluída ✔';
    });
    toast(msg);
  }

  function completeTask(id) {
    if (Store.isParent()) {
      applyCompletion(id);
      return;
    }
    Store.update((s) => {
      const t = s.tasks.find((x) => x.id === id);
      if (t) t.pending = { by: s.currentUser, date: today() };
    });
    toast('Feito! À espera de aprovação dos pais ⏳');
  }

  const approveTask = (id) => applyCompletion(id);

  function rejectTask(id) {
    Store.update((s) => {
      const t = s.tasks.find((x) => x.id === id);
      if (t) delete t.pending;
    });
    toast('Tarefa devolvida.');
  }

  function reopenTask(id) {
    if (!Store.isParent()) {
      toast('Só os pais podem reabrir tarefas.');
      return;
    }
    Store.update((s) => {
      const t = s.tasks.find((x) => x.id === id);
      if (!t || !t.done) return;
      const last = (t.history || []).pop();
      const who = s.members.find((m) => m.id === (last?.by || t.assignee));
      if (who && last) who.points = Math.max(0, who.points - (Number(last.points) || 0));
      t.done = false;
      t.doneAt = '';
    });
  }

  /** Troca de pontos: pais trocam logo, filhos fazem um pedido. */
  function redeem(rewardId) {
    const s = S();
    const r = s.rewards.find((x) => x.id === rewardId);
    const me = member(s.currentUser);
    if (!r || !me || me.points < r.cost) return;
    const parent = Store.isParent();
    if (!confirm(parent ? `Trocar ${r.cost} pontos por "${r.title}"?` : `Pedir aos pais "${r.title}" (${r.cost} pontos)?`)) return;
    Store.update((st) => {
      if (parent) st.members.find((m) => m.id === me.id).points -= r.cost;
      st.redemptions.push({
        id: Store.uid(), memberId: me.id, title: r.title, cost: r.cost, date: today(), status: parent ? 'approved' : 'pending',
      });
    });
    toast(parent ? `🎁 ${me.name} trocou pontos por: ${r.title}` : 'Pedido enviado aos pais ⏳');
  }

  function decideRedemption(id, approve) {
    let msg = '';
    Store.update((s) => {
      const x = s.redemptions.find((r) => r.id === id);
      if (!x || x.status !== 'pending') return;
      const who = s.members.find((m) => m.id === x.memberId);
      if (approve && who && who.points < x.cost) {
        msg = `${who.name} já não tem pontos suficientes.`;
        return;
      }
      if (approve && who) who.points -= x.cost;
      x.status = approve ? 'approved' : 'rejected';
      msg = approve ? `🎁 Aprovado: ${x.title}` : 'Pedido recusado.';
    });
    toast(msg);
  }

  window.UI = {
    member, memberOptions, chip, chips, avatar, colorOf, toast, openForm, editItem,
    eventsOn, classesOn, itemsOn, completeTask, reopenTask, approveTask, rejectTask, redeem, decideRedemption,
  };
})();
