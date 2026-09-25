/*
 * Estado da aplicação.
 * Nesta primeira versão os dados ficam guardados no navegador (localStorage)
 * e podem ser exportados/importados em JSON. A camada está isolada aqui para
 * poder ser trocada por um backend partilhado (ex.: Supabase) sem mexer nas vistas.
 */
(function () {
  const KEY = 'portal-familia-v1';
  const { today, addDays } = U;

  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

  const EMPTY = () => ({
    version: 1,
    currentUser: null,
    members: [],
    events: [],
    tasks: [],
    rewards: [],
    redemptions: [],
    classes: [],
    exams: [],
    projects: [],
    trips: [],
    shopping: [],
    meals: {},
    notes: [],
    contacts: [],
    // Fase 4
    money: [],
    allowances: [],
    goals: [],
    bills: [],
    dates: [],
    health: [],
    healthcards: [],
    docs: [],
    polls: [],
    votes: [],
    photos: [],
    // Refeições: receitas da família e despensa
    recipes: [],
    pantry: [],
    // Tarefas: desafios da família (só os pais criam)
    challenges: [],
  });

  function seed() {
    const s = EMPTY();
    const pai = { id: uid(), name: 'Luís', role: 'pai', emoji: '👨', color: '#3b82f6', birthday: '', points: 0 };
    const mae = { id: uid(), name: 'Cátia', role: 'mae', emoji: '👩', color: '#ec4899', birthday: '', points: 0 };
    const f16 = { id: uid(), name: 'Mariana', role: 'filha', emoji: '👱‍♀️', color: '#8b5cf6', birthday: '', points: 0 };
    const f12 = { id: uid(), name: 'Luísa', role: 'filha', emoji: '👧', color: '#f59e0b', birthday: '', points: 0 };
    s.members = [pai, mae, f16, f12];
    s.currentUser = mae.id;

    const t = today();
    s.tasks = [
      { title: 'Pôr e levantar a mesa ao jantar', assignee: f12.id, due: t, repeat: 'daily', points: 2, category: 'Casa' },
      { title: 'Tirar o lixo e a reciclagem', assignee: f16.id, due: t, repeat: 'weekly', points: 3, category: 'Casa' },
      { title: 'Arrumar o quarto', assignee: f12.id, due: addDays(t, 2), repeat: 'weekly', points: 5, category: 'Quarto' },
      { title: 'Arrumar o quarto', assignee: f16.id, due: addDays(t, 2), repeat: 'weekly', points: 5, category: 'Quarto' },
      { title: 'Aspirar a sala', assignee: pai.id, due: addDays(t, 1), repeat: 'weekly', points: 5, category: 'Casa' },
      { title: 'Marcar consulta no dentista', assignee: mae.id, due: addDays(t, 3), repeat: 'none', points: 3, category: 'Saúde' },
    ].map((x) => ({ id: uid(), done: false, notes: '', history: [], ...x }));

    s.rewards = [
      { title: 'Escolher o filme de sexta-feira', cost: 15 },
      { title: '+30 min de ecrã ao fim de semana', cost: 20 },
      { title: 'Escolher o jantar de sábado', cost: 25 },
      { title: 'Dispensa de uma tarefa à escolha', cost: 30 },
    ].map((x) => ({ id: uid(), ...x }));

    s.events = [
      { title: 'Jantar de família', date: addDays(t, 4), start: '20:00', end: '22:00', members: [pai.id, mae.id, f16.id, f12.id], location: 'Casa dos avós', repeat: 'none', notes: '' },
      { title: 'Treino (exemplo)', date: t, start: '18:00', end: '19:30', members: [f12.id], location: 'Pavilhão', repeat: 'weekly', notes: 'Levar garrafa de água' },
    ].map((x) => ({ id: uid(), ...x }));

    // Horário de exemplo — é para ser substituído pelo horário real.
    const slots = [['08:30', '10:00'], ['10:15', '11:45'], ['12:00', '13:30'], ['14:30', '16:00'], ['16:15', '17:45']];
    const sec = ['Português', 'Matemática A', 'Inglês', 'Filosofia', 'Físico-Química', 'Biologia e Geologia', 'Educação Física'];
    const bas = ['Português', 'Matemática', 'Inglês', 'Francês', 'História', 'Geografia', 'Ciências Naturais', 'Físico-Química', 'Educação Física', 'Educação Visual'];
    [[f16, sec, 4], [f12, bas, 3]].forEach(([m, subjects, perDay]) => {
      for (let day = 1; day <= 5; day++) {
        const n = day === 3 ? 2 : perDay; // quarta à tarde livre
        for (let i = 0; i < n; i++) {
          s.classes.push({
            id: uid(), memberId: m.id, day, start: slots[i][0], end: slots[i][1],
            subject: subjects[(day * 3 + i) % subjects.length], room: '', teacher: '',
          });
        }
      }
    });

    s.exams = [
      { memberId: f16.id, subject: 'Matemática A', kind: 'Teste', date: addDays(t, 6), notes: 'Funções e derivadas' },
      { memberId: f12.id, subject: 'Inglês', kind: 'Trabalho', date: addDays(t, 9), notes: 'Apresentação em grupo' },
    ].map((x) => ({ id: uid(), ...x }));

    s.projects = [{
      id: uid(), title: 'Pintar o quarto da Luísa', description: 'Escolher cor, comprar material e pintar num fim de semana.',
      members: [pai.id, f12.id], deadline: addDays(t, 30),
      steps: [
        { id: uid(), text: 'Escolher a cor', done: true },
        { id: uid(), text: 'Comprar tinta, rolos e fita', done: false },
        { id: uid(), text: 'Afastar móveis e proteger o chão', done: false },
        { id: uid(), text: 'Pintar!', done: false },
      ],
    }];

    s.trips = [{
      id: uid(), destination: 'Escapadinha em família (exemplo)', start: addDays(t, 60), end: addDays(t, 66),
      members: [pai.id, mae.id, f16.id, f12.id], budget: 1500, lodging: '', notes: 'Decidir destino em família 😊',
      packing: [
        { id: uid(), memberId: '', text: 'Cartões de cidadão / passaportes', done: false },
        { id: uid(), memberId: '', text: 'Cartão Europeu de Seguro de Doença', done: false },
        { id: uid(), memberId: f16.id, text: 'Carregador do telemóvel', done: false },
        { id: uid(), memberId: f12.id, text: 'Livro para a viagem', done: false },
      ],
      expenses: [],
    }];

    s.shopping = [
      { text: 'Leite', category: 'Mercearia' },
      { text: 'Fruta para os lanches', category: 'Frescos' },
      { text: 'Detergente da loiça', category: 'Limpeza' },
    ].map((x) => ({ id: uid(), qty: '', done: false, addedBy: mae.id, ...x }));

    s.notes = [{
      id: uid(), author: mae.id, date: t, pinned: true,
      text: 'Bem-vindos ao Portal da Família! 🎉 Em Definições podem mudar os nomes, as cores e os aniversários de cada um.',
    }];

    s.contacts = [
      { name: 'Escola (secretaria)', category: 'Escola', phone: '', email: '', notes: '' },
      { name: 'Centro de saúde', category: 'Saúde', phone: '', email: '', notes: '' },
      { name: 'SNS 24', category: 'Saúde', phone: '808 24 24 24', email: '', notes: 'Linha de saúde' },
      { name: 'Emergência', category: 'Emergência', phone: '112', email: '', notes: '' },
    ].map((x) => ({ id: uid(), ...x }));

    // Finanças (exemplo): mesadas, um mealheiro e contas da casa.
    s.allowances = [
      { id: f12.id, memberId: f12.id, amount: 5, frequency: 'weekly', day: 6, active: true },
      { id: f16.id, memberId: f16.id, amount: 30, frequency: 'monthly', day: 1, active: true },
    ];
    const bike = { id: uid(), memberId: f12.id, title: 'Bicicleta nova', target: 150, emoji: '🚲' };
    s.goals = [bike];
    s.money = [
      { memberId: f12.id, amount: 20, date: addDays(t, -14), kind: 'oferta', note: 'Prenda da avó (exemplo)' },
      { memberId: f12.id, amount: -12, date: addDays(t, -7), kind: 'poupanca', goalId: bike.id, note: 'Para a bicicleta' },
      { memberId: f16.id, amount: 30, date: addDays(t, -20), kind: 'mesada', note: 'Mesada' },
      { memberId: f16.id, amount: -6.5, date: addDays(t, -3), kind: 'gasto', note: 'Cinema' },
    ].map((x) => ({ id: uid(), ...x }));
    s.bills = [
      { title: 'Electricidade', amount: 75, due: addDays(t, 5), repeat: 'monthly', category: 'Casa', auto: true },
      { title: 'Internet e telemóveis', amount: 65, due: addDays(t, 12), repeat: 'monthly', category: 'Casa', auto: true },
      { title: 'Seguro do carro', amount: 320, due: addDays(t, 80), repeat: 'yearly', category: 'Carro', auto: false },
    ].map((x) => ({ id: uid(), history: [], ...x }));

    // Saúde e documentos (exemplo).
    s.health = [{ id: uid(), memberId: f12.id, date: addDays(t, -170), type: 'Dentista', title: 'Revisão no dentista', notes: '', next: addDays(t, 10), nextLabel: 'Dentista — revisão (exemplo)' }];
    s.docs = [
      { id: uid(), memberId: f16.id, type: 'Cartão de Cidadão', ref: '', expires: addDays(t, 50), notes: 'Exemplo — marcar renovação' },
      { id: uid(), memberId: '', type: 'Inspecção do carro', ref: '', expires: addDays(t, 120), notes: '' },
    ];
    s.dates = [{ id: uid(), title: 'Anos da avó (exemplo)', date: `1952-${addDays(t, 20).slice(5)}`, knowYear: true, kind: 'Aniversário', gifts: 'Uma fotografia da família emoldurada' }];
    s.polls = [{
      id: uid(), question: 'Que filme vemos na sexta? 🍿', createdBy: mae.id, date: t, closed: false,
      options: [{ id: 'a', text: 'Comédia' }, { id: 'b', text: 'Aventura' }, { id: 'c', text: 'Animação' }],
    }];
    // Refeições (exemplo): despensa com o básico e dois jantares planeados.
    s.pantry = ['Sal', 'Azeite', 'Alho', 'Cebola', 'Arroz', 'Massa', 'Leite', 'Ovos', 'Louro']
      .map((name) => ({ id: uid(), name, key: name.toLowerCase().replace('ovos', 'ovo') }));
    s.meals = {
      1: { dinner: 'Bacalhau à Brás', dinnerRecipe: 'pt-bacalhau-bras' },
      3: { dinner: 'Frango assado no forno com batatas', dinnerRecipe: 'pt-frango-assado' },
    };
    return s;
  }

  const ROLE_RANK = { pai: 0, mae: 1 };

  function normalize(obj) {
    const base = EMPTY();
    const s = { ...base, ...(obj || {}) };
    Object.keys(base).forEach((k) => {
      if (Array.isArray(base[k]) && !Array.isArray(s[k])) s[k] = [];
    });
    if (!s.meals || typeof s.meals !== 'object') s.meals = {};
    s.members.forEach((m) => { m.points = Number(m.points) || 0; });
    // Ordem natural: pai, mãe e depois os filhos do mais velho para o mais novo.
    s.members.sort((a, b) => (ROLE_RANK[a.role] ?? 2) - (ROLE_RANK[b.role] ?? 2)
      || (a.birthday || '9999').localeCompare(b.birthday || '9999'));
    if (!s.members.some((m) => m.id === s.currentUser)) s.currentUser = s.members[0]?.id || null;
    return s;
  }

  /* ---------- Conversão estado <-> itens (uma linha por item no Supabase) ---------- */
  const COLLS = ['members', 'events', 'tasks', 'rewards', 'redemptions', 'classes', 'exams',
    'projects', 'trips', 'shopping', 'notes', 'contacts',
    'money', 'allowances', 'goals', 'bills', 'dates', 'health', 'healthcards', 'docs', 'polls', 'votes', 'photos',
    'recipes', 'pantry', 'challenges'];
  const keyOf = (r) => `${r.coll}/${r.id}`;

  function toItems(s) {
    const out = [];
    COLLS.forEach((c) => (s[c] || []).forEach((x) => out.push({ coll: c, id: String(x.id), data: x })));
    Object.entries(s.meals || {}).forEach(([id, data]) => out.push({ coll: 'meals', id: String(id), data }));
    return out;
  }

  function applyRow(s, r) {
    if (r.coll === 'meals') {
      if (r.deleted) delete s.meals[r.id];
      else s.meals[r.id] = r.data;
      return;
    }
    const list = s[r.coll];
    if (!Array.isArray(list)) return;
    const i = list.findIndex((x) => String(x.id) === r.id);
    if (r.deleted) {
      if (i >= 0) list.splice(i, 1);
    } else if (i >= 0) {
      list[i] = r.data;
    } else {
      list.push(r.data);
    }
  }

  const snapshot = (s) => new Map(toItems(s).map((it) => [keyOf(it), { it, json: JSON.stringify(it.data) }]));

  /* ---------- Estado e persistência local ---------- */
  function readJSON(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }
  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('Não foi possível guardar os dados', e);
    }
  }

  let state = normalize(readJSON(KEY) || seed());
  let remote = null; // { client, familyId, memberId, role, clientId, channel }
  const listeners = [];
  const syncListeners = [];
  let syncStatus = 'local';

  const cacheKey = () => (remote ? `portal-familia-cache-${remote.familyId}` : KEY);
  const persist = () => writeJSON(cacheKey(), state);

  function emit() {
    persist();
    listeners.forEach((fn) => fn(state));
  }

  function setSync(status, detail) {
    syncStatus = status;
    syncListeners.forEach((fn) => fn(status, detail));
  }

  /* ---------- Sincronização com o Supabase ---------- */
  const OUTBOX_KEY = 'portal-familia-outbox';
  let outbox = new Map();
  let flushing = false;
  let flushTimer = null;

  const saveOutbox = () => remote && writeJSON(`${OUTBOX_KEY}-${remote.familyId}`, [...outbox.values()]);

  function queue(rows) {
    if (!rows.length) return;
    rows.forEach((r) => outbox.set(keyOf(r), r));
    saveOutbox();
    setSync('saving');
    clearTimeout(flushTimer);
    flushTimer = setTimeout(flush, 250);
  }

  async function flush() {
    if (!remote || flushing || !outbox.size) return;
    flushing = true;
    const batch = [...outbox.values()];
    let error = null;
    try {
      ({ error } = await remote.client.from('items').upsert(batch.map((r) => ({
        family_id: remote.familyId, coll: r.coll, id: r.id, data: r.data, deleted: r.deleted, client_id: remote.clientId,
      }))));
    } catch (e) {
      error = e;
    }
    flushing = false;
    if (!error) {
      batch.forEach((r) => { if (outbox.get(keyOf(r)) === r) outbox.delete(keyOf(r)); });
      saveOutbox();
      if (outbox.size) flush();
      else setSync('ok');
    } else if (error.code === '42501') {
      // Sem permissão (ex.: filha a tentar mudar pontos): descarta e repõe o que está no servidor.
      outbox.clear();
      saveOutbox();
      setSync('ok', 'Não tens permissão para essa alteração.');
      await reload();
    } else {
      console.warn('Sincronização falhou', error);
      setSync('offline');
    }
  }

  async function fetchAll() {
    const rows = [];
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await remote.client.from('items')
        .select('coll,id,data,deleted').eq('family_id', remote.familyId).eq('deleted', false)
        .order('coll').order('id').range(from, from + PAGE - 1);
      if (error) throw error;
      rows.push(...data);
      if (data.length < PAGE) return rows;
    }
  }

  async function reload() {
    if (!remote) return;
    try {
      const rows = await fetchAll();
      const s = EMPTY();
      rows.forEach((r) => applyRow(s, r));
      outbox.forEach((r) => applyRow(s, r)); // alterações locais ainda por enviar
      s.currentUser = remote.memberId;
      state = normalize(s);
      state.currentUser = remote.memberId;
      emit();
      setSync(outbox.size ? 'saving' : 'ok');
      flush();
    } catch (e) {
      console.warn('Não foi possível carregar os dados', e);
      setSync('offline');
    }
  }

  function onRemoteChange(row) {
    if (!remote || !row || row.client_id === remote.clientId) return;
    if (outbox.has(keyOf(row))) return; // a nossa versão local é mais recente
    applyRow(state, row);
    const cur = state.currentUser;
    state = normalize(state);
    state.currentUser = cur;
    emit();
  }

  async function connect({ client, familyId, memberId, role }) {
    remote = { client, familyId, memberId, role, clientId: uid() };
    outbox = new Map((readJSON(`${OUTBOX_KEY}-${familyId}`) || []).map((r) => [keyOf(r), r]));
    const cached = readJSON(cacheKey());
    if (cached) {
      state = normalize(cached);
      state.currentUser = memberId;
      emit();
    }
    await reload();
    let subscribedOnce = false;
    remote.channel = client.channel(`items-${familyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items', filter: `family_id=eq.${familyId}` },
        (p) => onRemoteChange(p.new))
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          if (subscribedOnce) reload(); // voltou a ligar: apanhar o que mudou entretanto
          subscribedOnce = true;
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setSync('offline');
        }
      });
    window.addEventListener('online', () => reload());
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reload(); });
    setInterval(() => { if (outbox.size) flush(); }, 15000);
  }

  window.Store = {
    uid,
    toItems,
    get state() { return state; },
    get isRemote() { return !!remote; },
    get syncStatus() { return syncStatus; },
    get familyId() { return remote?.familyId || null; },
    /** Pais gerem tudo; filhos precisam de aprovação para pontos e recompensas. */
    isParent() {
      if (remote) return remote.role === 'parent';
      const me = state.members.find((m) => m.id === state.currentUser);
      return !me || ['pai', 'mae'].includes(me.role);
    },
    update(fn) {
      const before = remote ? snapshot(state) : null;
      fn(state);
      if (remote) {
        state.currentUser = remote.memberId;
        const after = snapshot(state);
        const rows = [];
        after.forEach((v, k) => {
          const b = before.get(k);
          if (!b || b.json !== v.json) rows.push({ coll: v.it.coll, id: v.it.id, data: JSON.parse(v.json), deleted: false });
        });
        before.forEach((v, k) => {
          if (!after.has(k)) rows.push({ coll: v.it.coll, id: v.it.id, data: JSON.parse(v.json), deleted: true });
        });
        queue(rows);
      }
      emit();
    },
    subscribe(fn) { listeners.push(fn); },
    onSync(fn) { syncListeners.push(fn); },
    connect,
    reload,
    /** Dados locais deste dispositivo (para levar para a família na nuvem). */
    localSnapshot() { return normalize(readJSON(KEY) || seed()); },
    exportJSON() { return JSON.stringify(state, null, 2); },
    importJSON(text) { state = normalize(JSON.parse(text)); emit(); },
    resetToExample() { state = seed(); emit(); },
    wipe() {
      // Mantém o que é "estrutural" da família; apaga o dia-a-dia.
      const keep = new Set(['members', 'rewards', 'contacts', 'allowances', 'goals', 'money', 'bills',
        'dates', 'health', 'healthcards', 'docs', 'photos', 'recipes', 'pantry']);
      Store.update((s) => {
        Object.keys(EMPTY()).forEach((k) => {
          if (Array.isArray(s[k]) && !keep.has(k)) s[k] = [];
        });
        s.meals = {};
        s.members.forEach((m) => { m.points = 0; });
      });
    },
  };
  persist();
})();
