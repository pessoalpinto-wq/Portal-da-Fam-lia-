/* Funções utilitárias: datas, texto e DOM. */
(function () {
  const pad = (n) => String(n).padStart(2, '0');

  const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho',
    'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseISO = (s) => {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  const today = () => toISO(new Date());
  const addDays = (s, n) => {
    const d = parseISO(s);
    d.setDate(d.getDate() + n);
    return toISO(d);
  };
  const addMonths = (s, n) => {
    const d = parseISO(s);
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + n);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, last));
    return toISO(d);
  };
  const weekday = (s) => parseISO(s).getDay();
  const daysBetween = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 86400000);

  const fmtDate = (s) => {
    if (!s) return '';
    const d = parseISO(s);
    return `${DIAS_CURTOS[d.getDay()]}, ${d.getDate()} ${MESES[d.getMonth()].slice(0, 3).toLowerCase()}`;
  };
  const fmtLongDate = (s) => {
    const d = parseISO(s);
    return `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()].toLowerCase()}`;
  };
  const relDay = (s) => {
    const n = daysBetween(today(), s);
    if (n === 0) return 'hoje';
    if (n === 1) return 'amanhã';
    if (n === -1) return 'ontem';
    if (n < 0) return `há ${-n} dias`;
    return `daqui a ${n} dias`;
  };

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
  const $ = (sel, root = document) => root.querySelector(sel);
  const money = (n) => `${(Number(n) || 0).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

  window.U = {
    pad, DIAS, DIAS_CURTOS, MESES, toISO, parseISO, today, addDays, addMonths, weekday,
    daysBetween, fmtDate, fmtLongDate, relDay, esc, $, money,
  };
})();
