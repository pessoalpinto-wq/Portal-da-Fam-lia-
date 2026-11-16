/*
 * 🏦 Bancos ligados (open banking PSD2, através do Enable Banking): os movimentos entram sozinhos no 🎯 Orçamento,
 * todos os dias de manhã, classificados e sem repetir. Só para os pais.
 * A ligação é feita no próprio banco (com o código no telemóvel) e dura até 180 dias; depois liga-se outra vez.
 * O servidor (função "bancos") guarda a sessão do banco; a app só vê o nome das contas e quando foram actualizadas.
 */
window.Bancos = function ({ render }) {
  const { esc } = U;
  const { toast, openForm } = UI;
  const S = () => Store.state;
  const VS = Views.VS;
  const PENDING = 'portal-bancos-state';

  let data = { configured: true, links: [] };
  let loadedAt = 0;
  let loading = false;
  let returned = false;

  /* ---------- Servidor ---------- */
  async function call(body) {
    const ctx = Cloud.ctx?.();
    if (!ctx) return { error: 'A ligação aos bancos precisa da conta da família.' };
    const { data: res, error } = await ctx.client.functions.invoke('bancos', { body });
    if (!error) return res || {};
    let out = { error: 'Sem ligação ao servidor. Tentem outra vez.' };
    try { out = { ...out, ...(await error.context.json()) }; } catch { /* sem JSON */ }
    return out;
  }
  async function load(force = false) {
    if (loading || !Store.isRemote || !Store.isParent?.() || !Cloud.ctx?.()) return;
    if (!force && loadedAt && Date.now() - loadedAt < 5 * 60 * 1000) return;
    loading = true;
    try {
      const res = await call({ action: 'list' });
      loadedAt = Date.now();
      if (Array.isArray(res.links)) { data = res; paint(); }
    } finally { loading = false; }
  }

  /* ---------- Painel no Orçamento ---------- */
  const accName = (id) => S().faccounts.find((a) => a.id === id)?.name;
  const fmt = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');
  const daysLeft = (iso) => Math.max(0, Math.ceil((Date.parse(iso) - Date.now()) / 86400000));

  function panel() {
    if (!Cloud.ctx?.()) return '<p class="small muted">Precisa da conta da família.</p>';
    if (!data.configured) {
      return `<p class="small">Para os movimentos entrarem sozinhos, falta pôr no servidor a chave do Enable Banking
        (segredos <code>ENABLE_BANKING_APP_ID</code> e <code>ENABLE_BANKING_PRIVATE_KEY</code>). Até lá, continuem a importar os extratos.</p>`;
    }
    const list = data.links.map((l) => {
      const accs = l.accounts.map((a) => `${esc(a.label)} → ${a.account ? `<b>${esc(accName(a.account) || '?')}</b>` : '<span class="muted">não importar</span>'}`).join('<br>');
      const consent = l.status === 'expired' || l.consent === 'expired'
        ? '<span class="ext-err">⚠️ A autorização acabou: liguem outra vez.</span>'
        : l.consent === 'expiring' ? `<span class="ext-err">⏳ Autorização acaba daqui a ${daysLeft(l.validUntil)} dias.</span>`
          : l.validUntil ? `autorizado até ${esc(fmt(l.validUntil))}` : '';
      return `<li><div><b>🏦 ${esc(l.bank)}</b>
          <br><small>${accs || '<span class="muted">sem contas</span>'}</small>
          <br><small class="muted">${l.lastSync ? `actualizado a ${esc(fmt(l.lastSync))}` : 'ainda não actualizado'} · ${consent}</small>
          ${l.error && l.status !== 'expired' ? `<br><small class="ext-err">⚠️ ${esc(l.error)}</small>` : ''}</div>
        <span class="ext-acts">
          ${l.status === 'expired' || l.consent !== 'ok' ? `<button class="btn small" data-action="bank-renew" data-id="${esc(l.id)}">🔑 Ligar outra vez</button>` : ''}
          <button class="btn small ghost" data-action="bank-map" data-id="${esc(l.id)}" aria-label="Escolher contas">✎</button>
          <button class="btn small ghost" data-action="bank-del" data-id="${esc(l.id)}" aria-label="Desligar">✕</button></span></li>`;
    }).join('');
    return `<p class="small">Os movimentos das contas ligadas entram sozinhos todas as manhãs, já classificados. Não repetem o que já importaram.</p>
      ${list ? `<ul class="ext-cals">${list}</ul>` : ''}
      <div class="btn-row"><button class="btn small primary" data-action="bank-add">＋ Ligar um banco</button>
        ${data.links.some((l) => l.status === 'active') ? '<button class="btn small" data-action="bank-sync">🔄 Ir buscar agora</button>' : ''}</div>
      <p class="small muted">🔒 A ligação é feita no próprio banco, com o vosso código. O portal só pode <b>ler</b> movimentos (não faz pagamentos) e a autorização dura até 180 dias.</p>`;
  }
  function paint() {
    const el = document.getElementById('bancos-panel');
    if (el) el.innerHTML = panel();
  }
  Views.bancosCard = () => (Store.isRemote && Store.isParent?.() ? Views.h.card('🏦 Bancos ligados', `<div id="bancos-panel">${panel()}</div>`) : '');

  /* ---------- Ligar um banco ---------- */
  async function addForm(bankName = '') {
    toast('🏦 A procurar os bancos…');
    const res = await call({ action: 'banks', country: 'PT' });
    if (!Array.isArray(res.banks)) { toast(res.error || 'Não consegui ver a lista de bancos.'); return; }
    const banks = res.banks;
    openForm({
      title: '🏦 Ligar um banco',
      fields: [
        { name: 'bank', label: 'Banco', type: 'select', options: banks.map((b) => [b.name, b.name]) },
        { name: 'how', type: 'note', html: `<p class="small">Vão para a página do banco, entram como no homebanking e autorizam o portal a <b>ler</b> os movimentos.
          No fim, o banco volta ao portal e escolhem que conta é qual.</p>
          <p class="small muted">Não encontram o banco? Esse banco ainda não está no Enable Banking: continuem a importar os extratos desse.</p>` },
      ],
      values: { bank: banks.find((b) => b.name === bankName)?.name || banks[0]?.name || '' },
      submitLabel: 'Ir para o banco',
      onSubmit: (d) => start(d.bank, banks.find((b) => b.name === d.bank)?.days),
    });
  }

  async function start(bank, days) {
    if (!bank) return;
    const res = await call({ action: 'start', bank, country: 'PT', days, redirect: `${location.origin}${location.pathname}` });
    if (!res.url) { toast(res.error || 'Não consegui começar a ligação.'); return; }
    const state = new URL(res.url).searchParams.get('state');
    try { sessionStorage.setItem(PENDING, state || '1'); } catch { /* modo privado */ }
    location.href = res.url;
  }

  /** O banco voltou ao portal com ?code=&state= (ou ?error=). */
  async function finishReturn() {
    const q = new URLSearchParams(location.search);
    if (returned || (!q.has('code') && !q.has('error')) || !q.has('state')) return;
    if (!Cloud.ctx?.() || (Store.isRemote && Store.syncStatus !== 'ok' && !S().faccounts.length)) return;
    returned = true;
    const code = q.get('code');
    const state = q.get('state');
    const err = q.get('error_description') || q.get('error');
    history.replaceState(null, '', `${location.pathname}#/financas`);
    VS.finTab = 'orcamento';
    try { sessionStorage.removeItem(PENDING); } catch { /* */ }
    if (!code) { toast(`O banco não autorizou a ligação${err ? `: ${err}` : ''}.`); render(); return; }
    toast('🏦 A terminar a ligação…');
    const res = await call({ action: 'finish', code, state });
    if (!res.link) { toast(res.error || 'Não consegui terminar a ligação ao banco.'); render(); return; }
    await load(true);
    render();
    mapForm(res.link.id, true);
  }

  /** Que conta do portal é cada conta do banco. */
  function mapForm(id, first = false) {
    const l = data.links.find((x) => x.id === id);
    if (!l) return;
    const accs = S().faccounts.filter((a) => !a.archived);
    const opts = [['', '— não importar —'], ...accs.map((a) => [a.id, `${a.kind === 'cartao' ? '💳 ' : ''}${a.name}${a.bank ? ` · ${a.bank}` : ''}`])];
    openForm({
      title: `🏦 ${l.bank}: que conta é qual?`,
      fields: [
        ...(accs.length ? [] : [{ name: 'none', type: 'note', html: '<p class="small">Primeiro juntem as vossas contas em <b>📈 Património</b>.</p>' }]),
        ...l.accounts.map((a, i) => ({ name: `a${i}`, label: a.label, type: 'select', options: opts })),
        { name: 'how', type: 'note', html: '<p class="small muted">Os movimentos dos últimos 3 meses entram já; os que já tinham importado por extrato não se repetem.</p>' },
      ],
      values: Object.fromEntries(l.accounts.map((a, i) => [`a${i}`, a.account || ''])),
      submitLabel: first ? 'Guardar e ir buscar os movimentos' : 'Guardar',
      onSubmit: async (d) => {
        const res = await call({ action: 'map', id, accounts: l.accounts.map((a, i) => ({ uid: a.uid, account: d[`a${i}`] || '' })) });
        if (!res.link) { toast(res.error || 'Não consegui guardar.'); return; }
        await load(true);
        if (first || res.link.accounts.some((a) => a.account)) sync(id);
      },
    });
  }

  async function sync(id, el) {
    if (el) el.disabled = true;
    toast('🔄 A ir buscar os movimentos…');
    const res = await call({ action: 'sync', ...(id ? { id } : {}) });
    if (el) el.disabled = false;
    await load(true);
    if (res.error) { toast(res.error); return; }
    toast(res.added ? `✔ ${res.added} movimento${res.added === 1 ? '' : 's'} novo${res.added === 1 ? '' : 's'} no Orçamento.` : '✔ Sem movimentos novos.');
  }

  async function remove(id) {
    const l = data.links.find((x) => x.id === id);
    if (!l || !confirm(`Desligar o ${l.bank}? Os movimentos que já entraram ficam; os novos deixam de entrar sozinhos.`)) return;
    const res = await call({ action: 'remove', id });
    if (!res.ok) { toast(res.error || 'Não consegui desligar.'); return; }
    await load(true);
    toast('Banco desligado.');
  }

  return {
    afterRender() {
      finishReturn();
      if (document.getElementById('bancos-panel')) load();
    },
    actions: {
      'bank-add': () => addForm(),
      'bank-renew': (el) => { const l = data.links.find((x) => x.id === el.dataset.id); addForm(l?.bank); },
      'bank-map': (el) => mapForm(el.dataset.id),
      'bank-sync': (el) => sync('', el),
      'bank-del': (el) => remove(el.dataset.id),
    },
  };
};
