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
  });

  function seed() {
    const s = EMPTY();
    const pai = { id: uid(), name: 'Pai', role: 'pai', emoji: '👨', color: '#3b82f6', birthday: '', points: 0 };
    const mae = { id: uid(), name: 'Mãe', role: 'mae', emoji: '👩', color: '#ec4899', birthday: '', points: 0 };
    const f16 = { id: uid(), name: 'Filha (16)', role: 'filha', emoji: '👱‍♀️', color: '#8b5cf6', birthday: '', points: 0 };
    const f12 = { id: uid(), name: 'Filha (12)', role: 'filha', emoji: '👧', color: '#f59e0b', birthday: '', points: 0 };
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
      id: uid(), title: 'Pintar o quarto da mais nova', description: 'Escolher cor, comprar material e pintar num fim de semana.',
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
    return s;
  }

  function normalize(obj) {
    const base = EMPTY();
    const s = { ...base, ...(obj || {}) };
    Object.keys(base).forEach((k) => {
      if (Array.isArray(base[k]) && !Array.isArray(s[k])) s[k] = [];
    });
    if (!s.meals || typeof s.meals !== 'object') s.meals = {};
    s.members.forEach((m) => { m.points = Number(m.points) || 0; });
    if (!s.members.some((m) => m.id === s.currentUser)) s.currentUser = s.members[0]?.id || null;
    return s;
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return normalize(JSON.parse(raw));
    } catch (e) {
      console.warn('Não foi possível ler os dados guardados', e);
    }
    return seed();
  }

  let state = load();
  const listeners = [];

  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('Não foi possível guardar os dados', e);
    }
  }

  function emit() {
    persist();
    listeners.forEach((fn) => fn(state));
  }

  window.Store = {
    uid,
    get state() { return state; },
    update(fn) { fn(state); emit(); },
    subscribe(fn) { listeners.push(fn); },
    exportJSON() { return JSON.stringify(state, null, 2); },
    importJSON(text) { state = normalize(JSON.parse(text)); emit(); },
    resetToExample() { state = seed(); emit(); },
    wipe() {
      const members = state.members.map((m) => ({ ...m, points: 0 }));
      state = normalize({ members, currentUser: state.currentUser });
      emit();
    },
  };
  persist();
})();
