/*
 * Gera um calendário iCalendar (.ics) a partir dos dados da família.
 * Usado pela app (exportar ficheiro) e pela função "calendar" (link de subscrição
 * para Google Calendar / iPhone). Script "clássico": define globalThis.ICS.
 */
(function (root) {
  const TZID = 'Europe/Lisbon';
  const VTIMEZONE = [
    'BEGIN:VTIMEZONE', `TZID:${TZID}`,
    'BEGIN:DAYLIGHT', 'TZOFFSETFROM:+0000', 'TZOFFSETTO:+0100', 'TZNAME:WEST',
    'DTSTART:19700329T010000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'END:DAYLIGHT',
    'BEGIN:STANDARD', 'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0000', 'TZNAME:WET',
    'DTSTART:19701025T020000', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'END:STANDARD',
    'END:VTIMEZONE',
  ];
  const FREQ = { weekly: 'WEEKLY', monthly: 'MONTHLY', yearly: 'YEARLY' };

  const text = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/([,;])/g, '\\$1');
  const d8 = (iso) => iso.replace(/-/g, '');
  const localDT = (iso, hhmm) => `${d8(iso)}T${hhmm.replace(':', '')}00`;
  const dayNum = (iso) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d) / 86400000; };
  const addDays = (iso, n) => new Date((dayNum(iso) + n) * 86400000).toISOString().slice(0, 10);
  const weekday = (iso) => new Date(dayNum(iso) * 86400000).getUTCDay();
  const plusHour = (hhmm) => {
    const [h, m] = hhmm.split(':').map(Number);
    const t = Math.min(h * 60 + m + 60, 23 * 60 + 59);
    return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
  };

  /** Dobra linhas com mais de 75 octetos (RFC 5545 §3.1), sem partir caracteres UTF-8. */
  function fold(line) {
    const enc = new TextEncoder();
    if (enc.encode(line).length <= 75) return line;
    const out = [];
    let cur = '';
    let bytes = 0;
    for (const ch of line) {
      const n = enc.encode(ch).length;
      const limit = out.length ? 74 : 75;
      if (bytes + n > limit) { out.push(cur); cur = ''; bytes = 0; }
      cur += ch;
      bytes += n;
    }
    out.push(cur);
    return out.join('\r\n ');
  }

  /**
   * @param {object} state  estado da família (members, events, exams, trips, classes)
   * @param {object} opts   { memberId?, includeClasses?, name?, now?: Date }
   */
  function build(state, opts = {}) {
    const s = { members: [], events: [], exams: [], trips: [], classes: [], ...state };
    const { memberId, includeClasses } = opts;
    const now = opts.now || new Date();
    const stamp = `${now.toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`;
    const today = now.toISOString().slice(0, 10);
    const member = (id) => s.members.find((m) => m.id === id);
    const names = (ids) => (ids || []).map((id) => member(id)?.name).filter(Boolean).join(', ');
    const forMe = (ids) => !memberId || !(ids || []).length || ids.includes(memberId);
    const calName = opts.name || (memberId ? `Família · ${member(memberId)?.name || ''}` : 'Portal da Família');

    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Portal da Familia//PT', 'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH', `X-WR-CALNAME:${text(calName)}`, `X-WR-TIMEZONE:${TZID}`,
      'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H', ...VTIMEZONE];

    const vevent = (uid, props) => {
      lines.push('BEGIN:VEVENT', `UID:${uid}@portal-familia`, `DTSTAMP:${stamp}`);
      props.filter(Boolean).forEach((p) => lines.push(p));
      lines.push('END:VEVENT');
    };
    const allDay = (start, endInclusive) => [
      `DTSTART;VALUE=DATE:${d8(start)}`, `DTEND;VALUE=DATE:${d8(addDays(endInclusive || start, 1))}`,
    ];

    s.events.forEach((e) => {
      const involved = [...(e.members || []), ...(e.driver ? [e.driver] : [])];
      if (!e.date || !forMe(involved)) return;
      const desc = [
        e.members?.length ? `Quem vai: ${names(e.members)}` : '',
        e.driver ? `Quem leva: ${names([e.driver])}` : '',
        e.notes || '',
      ].filter(Boolean).join('\n');
      const rrule = FREQ[e.repeat]
        ? `RRULE:FREQ=${FREQ[e.repeat]}${e.until ? `;UNTIL=${d8(e.until)}T235959Z` : ''}` : '';
      const when = e.start
        ? [`DTSTART;TZID=${TZID}:${localDT(e.date, e.start)}`,
          `DTEND;TZID=${TZID}:${localDT(e.date, e.end && e.end > e.start ? e.end : plusHour(e.start))}`]
        : allDay(e.date);
      vevent(`event-${e.id}`, [...when, rrule, `SUMMARY:${text(e.title)}`,
        e.location && `LOCATION:${text(e.location)}`, desc && `DESCRIPTION:${text(desc)}`]);
    });

    s.exams.forEach((x) => {
      if (!x.date || (memberId && x.memberId !== memberId)) return;
      const who = memberId ? '' : ` (${names([x.memberId])})`;
      vevent(`exam-${x.id}`, [...allDay(x.date), `SUMMARY:${text(`📝 ${x.kind}: ${x.subject}${who}`)}`,
        x.notes && `DESCRIPTION:${text(x.notes)}`]);
    });

    s.trips.forEach((t) => {
      if (!t.start || !forMe(t.members)) return;
      vevent(`trip-${t.id}`, [...allDay(t.start, t.end && t.end >= t.start ? t.end : t.start),
        `SUMMARY:${text(`✈️ ${t.destination}`)}`, t.lodging && `LOCATION:${text(t.lodging)}`,
        t.notes && `DESCRIPTION:${text(t.notes)}`]);
    });

    (s.dates || []).forEach((d) => {
      if (!d.date) return;
      vevent(`date-${d.id}`, [...allDay(d.date), 'RRULE:FREQ=YEARLY', `SUMMARY:${text(`🎉 ${d.title}`)}`,
        d.gifts && `DESCRIPTION:${text(`Ideias de presentes: ${d.gifts}`)}`]);
    });

    (s.docs || []).forEach((d) => {
      if (!d.expires || (memberId && d.memberId && d.memberId !== memberId)) return;
      const who = d.memberId ? ` (${names([d.memberId])})` : '';
      vevent(`doc-${d.id}`, [...allDay(d.expires), `SUMMARY:${text(`🔐 Expira: ${d.type}${who}`)}`]);
    });

    (s.health || []).forEach((h) => {
      if (!h.next || (memberId && h.memberId !== memberId)) return;
      const who = memberId ? '' : ` (${names([h.memberId])})`;
      vevent(`health-${h.id}`, [...allDay(h.next), `SUMMARY:${text(`🏥 ${h.nextLabel || h.title}${who}`)}`]);
    });

    s.members.forEach((m) => {
      if (!m.birthday) return;
      vevent(`bday-${m.id}`, [...allDay(m.birthday), 'RRULE:FREQ=YEARLY', `SUMMARY:${text(`🎂 Anos: ${m.name}`)}`]);
    });

    if (includeClasses) {
      // Aulas: repetição semanal a partir da semana actual.
      const monday = addDays(today, -((weekday(today) + 6) % 7));
      s.classes.forEach((c) => {
        if (memberId && c.memberId !== memberId) return;
        const date = addDays(monday, (Number(c.day) + 6) % 7);
        const who = memberId ? '' : ` (${names([c.memberId])})`;
        vevent(`class-${c.id}`, [`DTSTART;TZID=${TZID}:${localDT(date, c.start)}`, `DTEND;TZID=${TZID}:${localDT(date, c.end)}`,
          'RRULE:FREQ=WEEKLY', `SUMMARY:${text(`🎒 ${c.subject}${who}`)}`, c.room && `LOCATION:${text(`Sala ${c.room}`)}`]);
      });
    }

    lines.push('END:VCALENDAR');
    return `${lines.map(fold).join('\r\n')}\r\n`;
  }

  root.ICS = { build };
})(globalThis);
