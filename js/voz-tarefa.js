/*
 * Registar uma tarefa por voz: perceber uma frase ditada ("Mariana, arrumar o quarto amanhã, 5 pontos")
 * e transformá-la numa tarefa — responsável, data, repetição, pontos e categoria.
 * Script "clássico": define globalThis.VozTarefa. Testado em tests/voz-tarefa.test.mjs.
 */
(function (root) {
  const strip = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const NUMS = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, quinze: 15, vinte: 20, trinta: 30 };
  const DIAS = { domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6 };
  const MESES = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const ROLE_WORDS = { pai: ['pai'], mae: ['mae'] };
  const CATS = [
    ['Quarto', /\b(quarto|cama)\b/],
    ['Cozinha', /\b(loica|cozinha|maquina de lavar loica|bancada|jantar|almoco|mesa|cozinhar|fogao|frigorifico)\b/],
    ['Roupa', /\b(roupa|estender|passar a ferro|meias|lavandaria)\b/],
    ['Animais', /\b(cao|gato|passear o|areia|racao|peixes?)\b/],
    ['Escola', /\b(estudar|trabalho de casa|tpc|teste|escola|livros?|mochila|caderno)\b/],
    ['Saúde', /\b(medico|dentista|consulta|farmacia|vacina|analises|oculista)\b/],
    ['Recados', /\b(ligar|telefonar|pagar|levantar|entregar|comprar|marcar|enviar|correios|banco|renovar|levar)\b/],
    ['Casa', /\b(lixo|reciclagem|aspirar|limpar|varrer|casa de banho|sala|pó|po|janelas|plantas|regar|jardim|garagem)\b/],
  ];

  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  const parseISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
  const addDays = (s, n) => { const d = parseISO(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
  const num = (w) => (/^\d+$/.test(w) ? Number(w) : NUMS[w]);

  /**
   * Frase → tarefa (só os campos percebidos; o título é sempre devolvido).
   * @param {string} said
   * @param {{ members?: Array<{id,name,role}>, today: string, me?: string }} ctx
   * @returns {{ title, assignee?, due?, repeat?, points?, category?, heard: string[] }}
   */
  function parse(said, { members = [], today, me } = {}) {
    // Trabalha numa versão sem acentos, mas com as mesmas posições, para depois recortar o título original.
    const orig = String(said || '').replace(/\s+/g, ' ').trim();
    let plain = strip(orig);
    const out = { heard: [] };
    const cut = (re, fn) => {
      const m = plain.match(re);
      if (!m) return false;
      if (fn(m) === false) return false;
      plain = plain.slice(0, m.index) + ' '.repeat(m[0].length) + plain.slice(m.index + m[0].length);
      return true;
    };

    // Repetição.
    if (cut(/\b(todos os dias|todas os dias|diariamente|cada dia)\b/, () => { out.repeat = 'daily'; })) out.heard.push('todos os dias');
    else if (cut(/\b(todas as semanas|semanalmente|cada semana|uma vez por semana)\b/, () => { out.repeat = 'weekly'; })) out.heard.push('todas as semanas');
    else if (cut(/\b(todos os meses|mensalmente|cada mes|uma vez por mes)\b/, () => { out.repeat = 'monthly'; })) out.heard.push('todos os meses');
    // "às sextas", "todas as segundas" → semanal, a partir do próximo dia.
    cut(/\b(?:(?:todas )?as|aos|todos os) (segunda|terca|quarta|quinta|sexta|sabado|domingo)s?(?:-feiras?)?\b/, (m) => {
      out.repeat = 'weekly';
      out.due = nextWeekday(today, DIAS[m[1]], true);
      out.heard.push(`às ${m[1]}s`);
    });

    // Pontos.
    cut(/\b(?:(?:vale|valer|com|por|da|de)\s+)?(\d+|um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez|quinze|vinte|trinta) (?:pontos?|estrelas?)\b/, (m) => {
      out.points = num(m[1]);
      out.heard.push(`${out.points} ponto${out.points === 1 ? '' : 's'}`);
    });

    // Data (se a repetição semanal não a definiu já).
    if (!out.due) {
      const d = readDate(plain, today);
      if (d) {
        out.due = d.date;
        out.heard.push(d.label);
        plain = plain.slice(0, d.index) + ' '.repeat(d.length) + plain.slice(d.index + d.length);
      }
    }

    // Responsável: nome de um membro, "pai"/"mãe", ou "eu"/"para mim".
    const people = [...members].sort((a, b) => strip(b.name).length - strip(a.name).length);
    const found = people.find((m) => m.name && new RegExp(`(^|[^a-z])${strip(m.name)}([^a-z]|$)`).test(plain));
    let who = found;
    if (!who) {
      const role = Object.keys(ROLE_WORDS).find((r) => new RegExp(`\\b(?:o |a |ao |à |a )?(${ROLE_WORDS[r].join('|')})\\b`).test(plain));
      if (role) who = members.find((m) => m.role === role);
    }
    if (who) {
      out.assignee = who.id;
      out.heard.push(who.name);
      const nameRe = found ? strip(who.name) : ROLE_WORDS[who.role].join('|');
      cut(new RegExp(`(?:\\b(?:para|pra|e|é)\\s+)?(?:\\b(?:a|o|à|ao)\\s+)?(?:${nameRe})(?:\\s+(?:tem|tens|tem de|tem que|vai|deve|precisa)(?:\\s+(?:de|que))?)?(?=[^a-z]|$)`), () => {});
    } else if (me && /\b(?:para mim|eu tenho de|eu tenho que|tenho de|tenho que|eu)\b/.test(plain)) {
      out.assignee = me;
      cut(/\b(?:para mim|eu tenho de|eu tenho que|tenho de|tenho que|eu)\b/, () => {});
    }

    // Título: o que sobra do original, sem conversa no início nem no fim.
    let title = '';
    for (let i = 0; i < orig.length; i++) title += plain[i] === ' ' && orig[i] !== ' ' ? ' ' : orig[i];
    title = title.replace(/\s+/g, ' ').replace(/\s+([,.;!?])/g, '$1').replace(/^[\s,.;:–-]+|[\s,.;:–-]+$/g, '');
    const LEAD = /^(?:(?:ok|olha|entao|bom|pronto|nova|uma)\s+)*(?:(?:tarefa|lembrete)\s*(?:para|pra|:)?\s*|(?:lembrar|lembra|lembrem)\s+(?:de\s+|que\s+)?|(?:tem de|tem que|tens de|tens que|precisa de|deve|vai)\s+|(?:para|pra|de)\s+)*/;
    for (let k = 0; k < 3; k++) {
      const m = strip(title).match(LEAD);
      if (!m || !m[0]) break;
      title = title.slice(m[0].length).replace(/^[\s,.;:–-]+/, '');
    }
    title = title.replace(/[\s,]+(?:por favor|se faz favor|ate|até|no|na|para|de|e|a|o)$/i, '').replace(/^[\s,]+|[\s,]+$/g, '');
    out.title = title ? title.charAt(0).toUpperCase() + title.slice(1) : '';
    const cat = CATS.find(([, re]) => re.test(strip(out.title)));
    if (cat) out.category = cat[0];
    return out;
  }

  /** Próxima `wd` (0=domingo) a partir de hoje; `strict` = nunca hoje. */
  function nextWeekday(today, wd, strict = false) {
    const cur = parseISO(today).getUTCDay();
    let n = (wd - cur + 7) % 7;
    if (n === 0 && strict) n = 7;
    return addDays(today, n);
  }

  /** Primeira data dita na frase: { date, label, index, length } ou null. */
  function readDate(plain, today) {
    const tries = [
      [/\b(?:ate |para |no |na )?depois de amanha\b/, () => addDays(today, 2), 'depois de amanhã'],
      [/\b(?:ate |para )?amanha(?: de manha| a tarde| a noite)?\b/, () => addDays(today, 1), 'amanhã'],
      [/\b(?:ate |para )?hoje(?: a noite| a tarde| de manha)?\b/, () => today, 'hoje'],
      [/\b(?:ate |para )?(?:o )?(?:fim de semana|fim-de-semana)\b/, () => nextWeekday(today, 6), 'fim de semana'],
      [/\b(?:ate |para )?(?:a )?(?:proxima semana|semana que vem)\b/, () => nextWeekday(today, 1, true), 'próxima semana'],
      [/\b(?:ate |para |no |na )?(?:(?:proxim[ao]|esta|este) )?(segunda|terca|quarta|quinta|sexta|sabado|domingo)(?:-feira| feira)?(?: que vem)?\b/,
        (m) => nextWeekday(today, DIAS[m[1]], true), (m) => ({ terca: 'terça', sabado: 'sábado' }[m[1]] || m[1])],
      [/\b(?:ate |para |no |na )?(?:dia )?(\d{1,2}) de (janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b/, (m) => {
        const [y] = today.split('-').map(Number);
        let d = `${y}-${pad(MESES.indexOf(m[2]) + 1)}-${pad(Number(m[1]))}`;
        if (d < today) d = `${y + 1}${d.slice(4)}`;
        return d;
      }, (m) => `${m[1]} de ${m[2] === 'marco' ? 'março' : m[2]}`],
      [/\b(?:ate |para |no |na )?dia (\d{1,2})\b/, (m) => {
        const [y, mo] = today.split('-').map(Number);
        let d = `${y}-${pad(mo)}-${pad(Number(m[1]))}`;
        if (d < today) d = iso(new Date(Date.UTC(y, mo, Number(m[1]))));
        return d;
      }, (m) => `dia ${m[1]}`],
      [/\b(?:daqui a|dentro de) (\d+|um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez) (dias?|semanas?)\b/,
        (m) => addDays(today, num(m[1]) * (m[2].startsWith('semana') ? 7 : 1)), (m) => `daqui a ${m[1]} ${m[2]}`],
    ];
    let best = null;
    tries.forEach(([re, fn, label]) => {
      const m = plain.match(re);
      if (!m || (best && best.index <= m.index)) return;
      const date = fn(m);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parseISO(date).getTime())) return;
      best = { date, label: typeof label === 'function' ? label(m) : label, index: m.index, length: m[0].length };
    });
    return best;
  }

  root.VozTarefa = { parse, nextWeekday };
})(globalThis);
