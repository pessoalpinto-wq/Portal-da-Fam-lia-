/*
 * Mala das viagens: quantidades, listas-modelo e copiar a lista de uma viagem para outra.
 * Script "clássico": define globalThis.Mala.
 */
(function (root) {
  const norm = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

  // Quantidades "por noite" (N) ficam entre 1 e 7: lava-se roupa em viagens longas.
  // [texto, quantidade ('N' = noites + 1, 'N/2' = metade)] · p = para cada pessoa, f = para a família
  const MODELOS = [
    ['essenciais', '🧳 Essenciais (qualquer viagem)', {
      p: [['Roupa interior', 'N'], ['Meias', 'N'], ['T-shirts', 'N'], ['Calças / calções', 'N/2'], ['Pijama', 1],
        ['Casaco ou camisola', 1], ['Calçado extra', 1], ['Escova de dentes', 1], ['Carregador do telemóvel', 1]],
      f: [['Cartões de Cidadão / passaportes', 1], ['Cartão Europeu de Seguro de Doença', 1], ['Medicamentos habituais', 1],
        ['Kit de primeiros socorros', 1], ['Pasta de dentes', 1], ['Champô e gel de banho', 1], ['Extensão / carregadores', 1]],
    }],
    ['praia', '🏖️ Praia e verão', {
      p: [['Fato de banho / biquíni', 2], ['Toalha de praia', 1], ['Chinelos', 1], ['Óculos de sol', 1], ['Chapéu ou boné', 1]],
      f: [['Protetor solar', 1], ['After-sun', 1], ['Guarda-sol', 1], ['Geleira', 1], ['Jogos de praia', 1], ['Saco para roupa molhada', 1]],
    }],
    ['neve', '⛄ Neve e inverno', {
      p: [['Casaco de neve', 1], ['Calças de neve', 1], ['Luvas', 1], ['Gorro', 1], ['Cachecol / gola', 1], ['Botas de neve', 1],
        ['Meias térmicas', 'N'], ['Camisolas térmicas', 2]],
      f: [['Protetor labial', 1], ['Protetor solar', 1], ['Correntes para o carro', 1]],
    }],
    ['aviao', '✈️ Avião', {
      p: [['Documento de identificação', 1], ['Auscultadores', 1], ['Almofada de viagem', 1], ['Mochila de mão', 1]],
      f: [['Cartões de embarque', 1], ['Saco transparente para líquidos (1 L)', 1], ['Adaptador de tomada', 1], ['Snacks para a viagem', 1]],
    }],
    ['cidade', '🏙️ Cidade e passeios', {
      p: [['Sapatilhas confortáveis', 1], ['Mochila pequena', 1], ['Garrafa de água', 1]],
      f: [['Powerbank', 1], ['Guarda-chuva', 1], ['Bilhetes / reservas', 1]],
    }],
    ['campismo', '⛺ Campismo', {
      p: [['Saco-cama', 1], ['Colchão / esteira', 1], ['Lanterna frontal', 1]],
      f: [['Tenda', 1], ['Fogareiro e gás', 1], ['Loiça e talheres de campismo', 1], ['Repelente de insetos', 1], ['Sacos do lixo', 1], ['Isqueiro', 1]],
    }],
  ];

  /** Noites da viagem (3 se ainda não tiver data de regresso). */
  function nights(trip) {
    if (!trip?.start || !trip?.end) return 3;
    return Math.max(0, Math.round((Date.parse(trip.end) - Date.parse(trip.start)) / 86400000));
  }

  function qtyFor(q, trip) {
    const n = Math.min(7, Math.max(1, nights(trip) + 1));
    if (q === 'N') return n;
    if (q === 'N/2') return Math.max(1, Math.ceil(n / 2));
    return Number(q) || 1;
  }

  /** "3 t-shirts" / "3x t-shirts" → { qty: 3, text: "t-shirts" } */
  function parseLine(text, qty) {
    const t = String(text || '').trim();
    const m = t.match(/^(\d{1,3})\s*[x×]?\s+(.+)$/i);
    if (m && (!qty || Number(qty) === 1)) return { qty: Number(m[1]), text: m[2].trim() };
    return { qty: Math.max(1, Number(qty) || 1), text: t };
  }

  /**
   * Itens a juntar à mala de `trip` vindos de outra viagem ou de um modelo.
   * `who` = pessoas para quem se copiam os itens pessoais. Não repete o que já lá está.
   */
  function itemsToCopy({ trip, trips, source, who, uid }) {
    const have = new Set((trip.packing || []).map((p) => `${p.memberId || ''}|${norm(p.text)}`));
    const out = [];
    const add = (memberId, text, qty) => {
      const k = `${memberId || ''}|${norm(text)}`;
      if (have.has(k)) return;
      have.add(k);
      out.push({ id: uid(), memberId: memberId || '', text, qty: Math.max(1, Number(qty) || 1), done: false });
    };
    if (source.startsWith('modelo:')) {
      const m = MODELOS.find(([id]) => id === source.slice(7));
      if (!m) return out;
      m[2].f.forEach(([text, q]) => add('', text, qtyFor(q, trip)));
      who.forEach((id) => m[2].p.forEach(([text, q]) => add(id, text, qtyFor(q, trip))));
    } else {
      const src = source.startsWith('viagem:') ? source.slice(7) : source;
      const from = (trips || []).find((t) => t.id === src);
      (from?.packing || []).forEach((p) => {
        if (p.memberId && !who.includes(p.memberId)) return; // essa pessoa não vai nesta viagem
        add(p.memberId, p.text, p.qty);
      });
    }
    return out;
  }

  root.Mala = { MODELOS, nights, qtyFor, parseLine, itemsToCopy, norm };
})(globalThis);
