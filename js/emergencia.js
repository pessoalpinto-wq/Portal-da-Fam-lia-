/*
 * 🆘 Emergência: kit para 72 horas (recomendação da Proteção Civil e da UE), plano da família,
 * powerbanks, rádios e animais. Parte pura (sem DOM): lista recomendada, quantidades por pessoa e animal,
 * validades, cargas e o resumo de avisos. Script "clássico": define globalThis.Emergencia.
 * Testado em tests/emergencia.test.mjs.
 */
(function (root) {
  const DAYS = 3; // 72 horas
  const SOON = 30; // dias: "a expirar em breve"
  const RECHARGE = 90; // dias: carregar powerbanks / ver pilhas dos rádios de 3 em 3 meses
  const PHONE_MAH = 4000; // bateria típica de um telemóvel
  const EFFICIENCY = 0.65; // o que chega mesmo ao telemóvel (perdas na conversão)

  const pad = (n) => String(n).padStart(2, '0');
  const toDay = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  const parse = (s) => {
    const [y, m, d] = String(s).split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  const isDay = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
  /** Dias de a até b (b - a). */
  const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);
  const addDays = (s, n) => toDay(new Date(parse(s) + n * 86400000));

  const CATS = [
    ['agua', '💧 Água e comida'],
    ['luz', '🔦 Luz, energia e comunicação'],
    ['saude', '🩹 Saúde e higiene'],
    ['docs', '📄 Documentos e dinheiro'],
    ['abrigo', '🧥 Abrigo e ferramentas'],
    ['animais', '🐾 Animais'],
    ['outros', '📦 Outros'],
  ];

  /** Lista recomendada. calc = a quantidade calcula-se pelo nº de pessoas / animais da família. */
  const KIT = [
    { ref: 'agua', cat: 'agua', name: 'Água potável engarrafada', calc: 'agua', expires: true },
    { ref: 'comida', cat: 'agua', name: 'Comida que não se estraga (enlatados, atum, feijão, bolachas, frutos secos, barras)', calc: 'comida', expires: true },
    { ref: 'abre-latas', cat: 'agua', name: 'Abre-latas manual' },
    { ref: 'pratos', cat: 'agua', name: 'Pratos, copos e talheres descartáveis' },
    { ref: 'lanterna', cat: 'luz', name: 'Lanterna (uma por pessoa, de preferência frontal)', calc: 'pessoas' },
    { ref: 'pilhas', cat: 'luz', name: 'Pilhas de reserva (para a lanterna e o rádio)', expires: true },
    { ref: 'radio-fm', cat: 'luz', name: 'Rádio FM a pilhas ou de manivela (para ouvir as notícias e a Proteção Civil)' },
    { ref: 'powerbanks', cat: 'luz', name: 'Powerbanks carregados e cabos', tab: 'energia' },
    { ref: 'radios', cat: 'luz', name: 'Rádios portáteis para falar entre nós', tab: 'energia' },
    { ref: 'apito', cat: 'luz', name: 'Apito (para pedir ajuda)' },
    { ref: 'velas', cat: 'luz', name: 'Velas, fósforos e isqueiro' },
    { ref: 'primeiros-socorros', cat: 'saude', name: 'Kit de primeiros socorros (pensos, compressas, desinfectante, tesoura)', expires: true },
    { ref: 'medicacao', cat: 'saude', name: 'Medicação habitual de cada um (pelo menos 7 dias) e cópia das receitas', expires: true },
    { ref: 'analgesicos', cat: 'saude', name: 'Paracetamol, termómetro e soro', expires: true },
    { ref: 'higiene', cat: 'saude', name: 'Toalhetes, gel desinfectante, papel higiénico e pensos higiénicos' },
    { ref: 'mascaras', cat: 'saude', name: 'Máscaras' },
    { ref: 'sacos', cat: 'saude', name: 'Sacos do lixo resistentes' },
    { ref: 'documentos', cat: 'docs', name: 'Cópias dos documentos (Cartão de Cidadão, seguros, casa) num saco estanque' },
    { ref: 'dinheiro', cat: 'docs', name: 'Dinheiro em notas pequenas e moedas (sem rede, os cartões não funcionam)' },
    { ref: 'chaves', cat: 'docs', name: 'Chaves suplentes de casa e do carro' },
    { ref: 'contactos-papel', cat: 'docs', name: 'Plano da família e contactos em papel (botão 🖨️ Imprimir)' },
    { ref: 'mapa', cat: 'docs', name: 'Mapa da zona em papel' },
    { ref: 'mantas', cat: 'abrigo', name: 'Manta térmica ou cobertor (um por pessoa)', calc: 'pessoas' },
    { ref: 'roupa', cat: 'abrigo', name: 'Muda de roupa quente, impermeável e calçado confortável' },
    { ref: 'canivete', cat: 'abrigo', name: 'Canivete multiusos' },
    { ref: 'fita', cat: 'abrigo', name: 'Fita adesiva forte e luvas de trabalho' },
    { ref: 'jogos', cat: 'abrigo', name: 'Um baralho de cartas ou um livro (para passar o tempo)' },
    // Animais: só entram se houver animais registados.
    { ref: 'animais-comida', cat: 'animais', name: 'Comida para os animais', calc: 'comida-animais', pets: true, expires: true },
    { ref: 'animais-agua', cat: 'animais', name: 'Água para os animais', calc: 'agua-animais', pets: true, expires: true },
    { ref: 'animais-trela', cat: 'animais', name: 'Trelas, coleiras e sacos para os dejectos', pets: 'cao' },
    { ref: 'animais-transporte', cat: 'animais', name: 'Transportadora ou caixa para levar cada animal', pets: true },
    { ref: 'animais-saude', cat: 'animais', name: 'Medicação, boletim de vacinas e contacto do veterinário', pets: true },
    { ref: 'tartaruga', cat: 'animais', name: 'Tartaruga: caixa com tampa furada, toalha húmida e a comida dela', pets: 'tartaruga' },
  ];

  const SPECIES = [['cao', '🐕 Cão'], ['gato', '🐈 Gato'], ['tartaruga', '🐢 Tartaruga'], ['passaro', '🐦 Pássaro'], ['outro', '🐾 Outro']];
  const speciesIcon = (sp) => (SPECIES.find(([k]) => k === sp)?.[1] || '🐾').split(' ')[0];

  // Água por animal e por dia (litros), aproximada: um cão médio bebe cerca de 1 L.
  const PET_WATER = { cao: 1, gato: 0.3, tartaruga: 0.3, passaro: 0.1, outro: 0.5 };

  const fmtL = (n) => `${String(Math.round(n * 10) / 10).replace('.', ',')} L`;

  /** Quanto é preciso de uma coisa da lista, para 3 dias. */
  function need(item, { people = 0, pets = [] } = {}) {
    const dogs = pets.filter((p) => p.species === 'cao').length;
    const others = pets.length - dogs;
    switch (item?.calc) {
      case 'agua': return people ? `${people * 3 * DAYS} L (3 L por pessoa por dia, para beber e cozinhar)` : '3 L por pessoa por dia';
      case 'comida': return people ? `${people * DAYS} dias-pessoa (${DAYS} dias para ${people} pessoa${people === 1 ? '' : 's'})` : `${DAYS} dias por pessoa`;
      case 'pessoas': return people ? `${people}` : 'uma por pessoa';
      case 'agua-animais': {
        const l = pets.reduce((t, p) => t + (PET_WATER[p.species] ?? PET_WATER.outro), 0) * DAYS;
        return pets.length ? fmtL(l) : '';
      }
      case 'comida-animais': {
        const parts = [dogs && `${dogs} ${dogs === 1 ? 'cão' : 'cães'}`, others && `${others} outro${others === 1 ? '' : 's'}`].filter(Boolean);
        return pets.length ? `${DAYS} dias de ração para ${parts.join(' e ')}` : '';
      }
      default: return '';
    }
  }

  /** Coisas da lista recomendada que entram para esta família (as dos animais só se houver animais). */
  function recommended(pets = []) {
    const has = (sp) => pets.some((p) => p.species === sp);
    return KIT.filter((k) => !k.pets || (k.pets === true ? pets.length : has(k.pets)));
  }

  /** Cria as coisas da lista recomendada que ainda não estão no kit (não repete as que já lá estão). */
  function seed(items, pets, uid) {
    const have = new Set((items || []).filter((x) => x.kind === 'item').map((x) => x.ref).filter(Boolean));
    return recommended(pets).filter((k) => !have.has(k.ref)).map((k) => ({
      id: uid(), kind: 'item', ref: k.ref, cat: k.cat, name: k.name, calc: k.calc || '', canExpire: !!k.expires,
      have: false, qty: '', expires: '', notes: '',
    }));
  }

  /** Estado da validade: 'expired' | 'soon' | 'ok' | '' (sem validade). */
  function expiry(date, today) {
    if (!isDay(date)) return '';
    const d = daysBetween(today, date);
    return d < 0 ? 'expired' : d <= SOON ? 'soon' : 'ok';
  }

  /** Powerbank / rádio: quando foi a última carga (ou verificação) e se já está na hora de repetir. */
  function charge(last, today, every = RECHARGE) {
    if (!isDay(last)) return { due: true, days: null, next: '' };
    const days = daysBetween(last, today);
    return { due: days >= every, days, next: addDays(last, every) };
  }

  /** Quantas cargas de telemóvel dá um powerbank (ou vários), contando com a carga que ainda têm. */
  function phoneCharges(banks) {
    const mah = (banks || []).reduce((t, b) => {
      const cap = Number(b.mah) || 0;
      const level = b.level === '' || b.level == null ? 100 : Math.min(100, Math.max(0, Number(b.level) || 0));
      return t + cap * (level / 100);
    }, 0);
    return Math.floor((mah * EFFICIENCY / PHONE_MAH) * 10) / 10;
  }

  const byKind = (list, kind) => (list || []).filter((x) => x.kind === kind);

  /** Resumo para o painel e para o topo da secção. */
  function summary(list, today) {
    const items = byKind(list, 'item');
    const expired = items.filter((x) => x.have && expiry(x.expires, today) === 'expired');
    const soon = items.filter((x) => x.have && expiry(x.expires, today) === 'soon');
    const missing = items.filter((x) => !x.have);
    const banks = byKind(list, 'powerbank');
    const radios = byKind(list, 'radio');
    const banksDue = banks.filter((b) => charge(b.lastCharge, today).due);
    const radiosDue = radios.filter((r) => charge(r.lastCheck, today).due);
    const ready = items.length ? Math.round(((items.length - missing.length) / items.length) * 100) : 0;
    return {
      items: items.length, have: items.length - missing.length, ready,
      expired, soon, missing, banks: banks.length, banksDue, radios: radios.length, radiosDue,
      charges: phoneCharges(banks),
      alerts: expired.length + soon.length + banksDue.length + radiosDue.length,
    };
  }

  /** Números que toda a gente deve saber (Portugal). */
  const NUMBERS = [
    ['112', 'Emergência (bombeiros, INEM, polícia)'],
    ['808 24 24 24', 'SNS 24 (saúde, aconselhamento)'],
    ['800 250 250', 'Centro de Informação Antivenenos'],
  ];

  /** Plano da família em texto (para copiar, mandar por mensagem ou imprimir). */
  function planText({ plan = {}, contacts = [], channels = [], pets = [], members = [] } = {}) {
    const val = (v) => String(v || '').trim();
    const pairs = (list) => list.filter(([, v]) => val(v)).map(([l, v]) => `${l}: ${val(v)}`);
    // Cada bloco só aparece se tiver alguma coisa.
    const blocks = [
      ['🆘 PLANO DE EMERGÊNCIA DA FAMÍLIA', members.length ? [`Família: ${members.map((m) => m.name).join(', ')}`] : []],
      ['📍 Pontos de encontro', pairs([['Perto de casa', plan.meetNear], ['Fora do bairro', plan.meetFar],
        ['Contacto fora da zona', plan.outContact], ['Escola / filhas', plan.school]])],
      ['🏠 Em casa', pairs([['Água (torneira de corte)', plan.water], ['Gás', plan.gas], ['Luz (quadro eléctrico)', plan.power],
        ['Onde está o kit', plan.kitPlace], ['Notas', plan.notes]])],
      ['📞 Números', [...NUMBERS.map(([n, l]) => `${n} — ${l}`),
        ...contacts.map((c) => `${c.phone || '—'} — ${c.name}${c.role ? ` (${c.role})` : ''}`)]],
      ['📻 Rádios', channels.map((c) => `${c.name}: ${[c.freq && `${c.freq} MHz`, c.channel && `canal ${c.channel}`, c.tone && `tom ${c.tone}`]
        .filter(Boolean).join(' · ') || '—'}${c.schedule ? ` · ${c.schedule}` : ''}`)],
      ['🐾 Animais', pets.map((p) => `${speciesIcon(p.species)} ${p.name}${p.chip ? ` · chip ${p.chip}` : ''}${p.vet ? ` · vet: ${p.vet}` : ''}${p.meds ? ` · medicação: ${p.meds}` : ''}`)],
    ];
    return blocks.filter(([, l], i) => i === 0 || l.length).map(([h, l]) => [h, ...l].join('\n')).join('\n\n');
  }

  root.Emergencia = {
    DAYS, SOON, RECHARGE, CATS, KIT, SPECIES, NUMBERS,
    need, recommended, seed, expiry, charge, phoneCharges, summary, planText, speciesIcon, daysBetween, addDays,
  };
})(globalThis);
