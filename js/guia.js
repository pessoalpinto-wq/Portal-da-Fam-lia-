/*
 * Guia "Pôr a família a funcionar": passos que se riscam sozinhos (contas, notificações, mesadas,
 * horários, fichas de saúde, produtos do costume, contas da casa…). Aparece no Painel até estar tudo feito.
 * Script "clássico": define globalThis.Guia. A parte pura (steps) é testada em tests/guia.test.mjs.
 */
(function (root) {
  const isKid = (m) => m && !['pai', 'mae'].includes(m.role);
  const names = (list) => {
    const n = list.map((m) => m.name);
    return n.length > 1 ? `${n.slice(0, -1).join(', ')} e ${n.at(-1)}` : n[0] || '';
  };
  const hasHealth = (hc) => !!hc && ['bloodType', 'sns', 'allergies', 'conditions', 'meds', 'doctor', 'insurance']
    .some((k) => String(hc[k] || '').trim());

  /**
   * Passos do guia.
   * @param {object} s       estado da família
   * @param {object} o
   * @param {boolean} o.parent  quem vê é pai/mãe
   * @param {string}  o.me      membro de quem vê
   * @param {object|null} o.devices { memberId: n.º de aparelhos } das pessoas com conta (null = sem nuvem / ainda não se sabe)
   * @returns {Array<{id, emoji, title, hint, done, go}>}
   */
  function steps(s, { parent, me, devices, lastBackup }) {
    const members = s.members || [];
    const kids = members.filter(isKid);
    const out = [];
    const add = (id, emoji, title, missing, hint, go, doneText) => out.push({
      id, emoji, title, go, done: !missing.length,
      hint: missing.length ? hint(missing) : doneText || '',
    });

    if (devices) {
      const noAccount = members.filter((m) => !(m.id in devices));
      const noPush = members.filter((m) => m.id in devices && !devices[m.id]);
      if (parent) {
        add('contas', '👤', 'Toda a família com conta', noAccount,
          (l) => `Falta ${names(l)}: entra no portal no seu telemóvel com o código de convite (está em Definições).`, 'definicoes');
        add('notificacoes', '🔔', 'Notificações ligadas nos telemóveis', noPush,
          (l) => `Falta ${names(l)}: Definições → Notificações → Ligar lembretes.`, 'definicoes');
      } else {
        const mine = members.filter((m) => m.id === me && !devices[m.id]);
        add('notificacoes', '🔔', 'Ligar as notificações neste telemóvel', mine,
          () => 'Definições → Notificações → Ligar lembretes. Assim sabes dos testes, tarefas e mesada.', 'definicoes');
      }
    }
    if (!parent) {
      const k = members.find((m) => m.id === me);
      if (isKid(k)) {
        add('escola', '🎒', 'O meu horário da escola', (s.classes || []).some((c) => c.memberId === me) ? [] : [k],
          () => 'Põe as tuas aulas: assim o Painel mostra a que horas entras e sais.', 'escola');
      }
      return out;
    }
    add('nascimento', '🎂', 'Datas de nascimento', members.filter((m) => !m.birthday),
      (l) => `Falta ${names(l)} (Definições → Família). Servem para os avisos de anos e para as tarefas por idade.`, 'definicoes');
    if (kids.length) {
      add('mesadas', '💰', 'Mesadas definidas', kids.filter((k) => !(s.allowances || []).some((a) => a.memberId === k.id)),
        (l) => `Falta ${names(l)}: Finanças → "definir mesada". Entra sozinha na carteira no dia certo.`, 'financas');
      add('escola', '🎒', 'Horários da escola', kids.filter((k) => !(s.classes || []).some((c) => c.memberId === k.id)),
        (l) => `Falta ${names(l)}: Escola → ＋ Aula.`, 'escola');
    }
    add('saude', '🩺', 'Fichas de saúde (para uma urgência)', members.filter((m) => !hasHealth((s.healthcards || []).find((h) => h.id === m.id))),
      (l) => `Falta ${names(l)}: grupo sanguíneo, alergias, medicação, n.º de utente.`, 'saude');
    add('costume', '⭐', 'Produtos "do costume"', (s.staples || []).length >= 3 ? [] : ['x'],
      () => 'Compras → ⭐ Os do costume: o que compram todas as semanas, para repor num toque.', 'compras');
    add('contas-casa', '💶', 'Contas da casa', (s.bills || []).filter((b) => !b.archived).length ? [] : ['x'],
      () => 'Finanças → Contas da casa: luz, água, internet, seguros… o portal avisa 3 dias antes.', 'contas');
    // Cópia de segurança: volta a aparecer quando a última tem mais de 30 dias (neste aparelho).
    if (lastBackup !== undefined) {
      const days = lastBackup ? Math.floor((Date.now() - Date.parse(lastBackup)) / 86400000) : null;
      add('copia', '💾', 'Cópia de segurança do mês', days != null && days <= 30 ? [] : ['x'],
        () => (days == null ? 'Descarreguem uma cópia de todos os dados e guardem-na no Google Drive.'
          : `A última foi há ${days} dias. Definições → Cópia de segurança.`), 'definicoes');
    }
    return out;
  }

  /* ---------- No browser: cartão no Painel ---------- */
  const KEY = 'pf-guia-escondido';
  const HIDE_DAYS = 7;
  let devices = null;
  let fetchedAt = 0;
  let loading = false;

  /** Pergunta ao servidor quem tem conta e notificações (no máximo de minuto a minuto). */
  async function refresh(onChange) {
    const ctx = root.Cloud?.ctx?.();
    if (!ctx || loading || Date.now() - fetchedAt < 60000) return;
    loading = true;
    try {
      const { data, error } = await ctx.client.rpc('family_devices');
      if (error) throw error;
      const next = Object.fromEntries((data || []).map((r) => [r.member_id, r.devices]));
      const changed = JSON.stringify(next) !== JSON.stringify(devices);
      devices = next;
      fetchedAt = Date.now();
      if (changed) onChange?.();
    } catch (e) {
      console.warn('guia', e);
      fetchedAt = Date.now();
    } finally {
      loading = false;
    }
  }

  const hiddenUntil = (me) => {
    try { return Number(JSON.parse(localStorage.getItem(KEY) || '{}')[me]) || 0; } catch { return 0; }
  };
  function hide(me) {
    try {
      const all = JSON.parse(localStorage.getItem(KEY) || '{}');
      all[me] = Date.now() + HIDE_DAYS * 86400000;
      localStorage.setItem(KEY, JSON.stringify(all));
    } catch { /* sem armazenamento: fica só até recarregar */ }
  }

  /** HTML do cartão (ou '' se está tudo feito ou escondido). */
  function card(s, { parent, me, remote, esc, onChange, lastBackup }) {
    if (remote) refresh(onChange);
    if (hiddenUntil(me) > Date.now()) return '';
    const list = steps(s, { parent, me, devices: remote ? devices : null, lastBackup });
    const done = list.filter((x) => x.done).length;
    if (!list.length || done === list.length) return '';
    const pct = Math.round((done / list.length) * 100);
    return `<section class="card guide span2">
      <header class="card-head"><h2>🚀 ${parent ? 'Pôr a família a funcionar' : 'Para começar'}</h2>
        <button class="linkish small" data-action="guide-hide" title="Volta a aparecer daqui a ${HIDE_DAYS} dias">esconder</button></header>
      <div class="progress"><span style="width:${pct}%"></span></div>
      <p class="small muted">${done} de ${list.length} passos feitos${parent ? ' — cada passo risca-se sozinho quando ficar feito.' : '.'}</p>
      <ul class="guide-steps">${list.sort((a, b) => a.done - b.done).map((x) => `<li class="${x.done ? 'done' : ''}">
        <span class="g-ico" aria-hidden="true">${x.done ? '✅' : x.emoji}</span>
        <span class="g-text"><b>${esc(x.title)}</b>${x.hint ? `<small>${esc(x.hint)}</small>` : ''}</span>
        ${x.done ? '' : `<button class="btn small" data-action="guide-go" data-id="${esc(x.go)}">Ir ›</button>`}</li>`).join('')}</ul>
    </section>`;
  }

  root.Guia = { steps, card, hide, refresh, _setDevices: (d) => { devices = d; fetchedAt = Date.now(); } };
})(globalThis);
