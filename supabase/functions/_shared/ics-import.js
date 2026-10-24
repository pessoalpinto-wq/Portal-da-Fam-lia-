/*
 * Ler um calendário iCalendar (.ics) de fora — por exemplo o "endereço secreto" do Google Calendar —
 * e devolver os eventos de um intervalo de datas, na hora de Portugal (Europe/Lisbon).
 * Trata: eventos de dia inteiro e de vários dias, fusos horários (TZID / UTC), eventos que se repetem
 * (RRULE diária, semanal, mensal, anual, com INTERVAL, COUNT, UNTIL, BYDAY, BYMONTHDAY, BYMONTH),
 * exceções (EXDATE), alterações de uma só ocorrência (RECURRENCE-ID) e eventos cancelados.
 * Usado pela função "calendario-externo". Testado em tests/ics-import.test.mjs.
 */
const TZ = 'Europe/Lisbon';
// Nomes de fusos do Outlook/Windows mais comuns por cá.
const WINDOWS_TZ = {
  'GMT Standard Time': 'Europe/Lisbon', 'W. Europe Standard Time': 'Europe/Berlin', 'Romance Standard Time': 'Europe/Paris',
  'Central Europe Standard Time': 'Europe/Budapest', 'UTC': 'UTC', 'Greenwich Standard Time': 'Atlantic/Reykjavik',
  'Azores Standard Time': 'Atlantic/Azores', 'E. South America Standard Time': 'America/Sao_Paulo',
};
const DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

const pad = (n) => String(n).padStart(2, '0');
const dayNum = (iso) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86400000;
const isoOf = (n) => new Date(n * 86400000).toISOString().slice(0, 10);
const addDays = (iso, n) => isoOf(dayNum(iso) + n);
const weekday = (iso) => new Date(dayNum(iso) * 86400000).getUTCDay();
const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/* ---------- Fusos horários ---------- */
const fmtCache = new Map();
function zoneOk(tz) {
  if (!tz) return null;
  const name = WINDOWS_TZ[tz] || tz.replace(/^\/+/, '');
  try { new Intl.DateTimeFormat('en-US', { timeZone: name }); return name; } catch { return null; }
}
/** Partes da hora local num fuso: { date: 'AAAA-MM-DD', time: 'HH:MM' }. */
function partsIn(ms, tz) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    fmtCache.set(tz, f);
  }
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour === '24' ? '00' : p.hour}:${p.minute}`, sec: +p.second };
}
const offsetOf = (ms, tz) => {
  const p = partsIn(ms, tz);
  return Date.UTC(+p.date.slice(0, 4), +p.date.slice(5, 7) - 1, +p.date.slice(8, 10), +p.time.slice(0, 2), +p.time.slice(3, 5), p.sec) - Math.floor(ms / 1000) * 1000;
};
/** Hora "de parede" num fuso → instante (ms UTC). */
function zonedToUTC(date, time, tz) {
  const guess = Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10), +time.slice(0, 2), +time.slice(3, 5), +(time.slice(6, 8) || 0));
  if (!tz || tz === 'UTC') return guess;
  let ms = guess - offsetOf(guess, tz);
  const again = guess - offsetOf(ms, tz);
  if (again !== ms) ms = again;
  return ms;
}

/* ---------- Ler o ficheiro ---------- */
const unescapeText = (s) => String(s || '').replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1').trim();

/** Texto .ics → lista de VEVENT { NAME: [{ params, value }] }. */
function parseEvents(text) {
  const lines = String(text).replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  const out = [];
  let cur = null;
  let depth = 0; // VALARM dentro do evento
  for (const line of lines) {
    if (/^BEGIN:VEVENT$/i.test(line)) { cur = {}; depth = 0; continue; }
    if (!cur) continue;
    if (/^END:VEVENT$/i.test(line)) { out.push(cur); cur = null; continue; }
    if (/^BEGIN:/i.test(line)) { depth++; continue; }
    if (/^END:/i.test(line)) { depth--; continue; }
    if (depth) continue;
    const m = line.match(/^([A-Za-z0-9-]+)((?:;[^:]*)?):(.*)$/);
    if (!m) continue;
    const params = {};
    (m[2].match(/;[^;=]+=(?:"[^"]*"|[^;]*)/g) || []).forEach((p) => {
      const [, k, v] = p.match(/^;([^=]+)=(.*)$/);
      params[k.toUpperCase()] = v.replace(/^"|"$/g, '');
    });
    (cur[m[1].toUpperCase()] ||= []).push({ params, value: m[3] });
  }
  return out;
}

/** Valor de data/hora → { allDay, date, time, tz } (hora "de parede" no fuso tz; tz=UTC para "Z"; null = Lisboa). */
function readDT(prop, defaultTz) {
  if (!prop) return null;
  const v = prop.value.trim();
  let m = v.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m || prop.params.VALUE === 'DATE') {
    m ||= v.match(/^(\d{4})(\d{2})(\d{2})/);
    return m ? { allDay: true, date: `${m[1]}-${m[2]}-${m[3]}`, time: '00:00' } : null;
  }
  m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/);
  if (!m) return null;
  const tz = m[7] ? 'UTC' : zoneOk(prop.params.TZID) || defaultTz || TZ;
  return { allDay: false, date: `${m[1]}-${m[2]}-${m[3]}`, time: `${m[4]}:${m[5]}:${m[6] || '00'}`, tz };
}
const instant = (dt) => (dt.allDay ? dayNum(dt.date) * 86400000 : zonedToUTC(dt.date, dt.time, dt.tz));

/** Duração ISO 8601 (DURATION:PT1H30M, P1D) em ms. */
function duration(v) {
  const m = String(v || '').match(/^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!m) return null;
  const ms = ((+m[2] || 0) * 7 * 86400 + (+m[3] || 0) * 86400 + (+m[4] || 0) * 3600 + (+m[5] || 0) * 60 + (+m[6] || 0)) * 1000;
  return m[1] === '-' ? -ms : ms;
}

/* ---------- Repetições ---------- */
function parseRule(v) {
  const r = Object.fromEntries(String(v).split(';').map((p) => p.split('=')).filter((p) => p.length === 2).map(([k, x]) => [k.toUpperCase(), x]));
  return {
    freq: r.FREQ, interval: Math.max(1, +r.INTERVAL || 1), count: r.COUNT ? +r.COUNT : null, until: r.UNTIL || null,
    byday: r.BYDAY ? r.BYDAY.split(',').map((d) => { const x = d.match(/^([+-]?\d+)?([A-Z]{2})$/); return x ? { n: x[1] ? +x[1] : 0, wd: DAYS.indexOf(x[2]) } : null; }).filter(Boolean) : null,
    bymonthday: r.BYMONTHDAY ? r.BYMONTHDAY.split(',').map(Number) : null,
    bymonth: r.BYMONTH ? r.BYMONTH.split(',').map(Number) : null,
    wkst: DAYS.indexOf(r.WKST || 'MO'),
  };
}
/** O dia (AAAA-MM-DD) é o n-ésimo (ou -n-ésimo) dia da semana wd do seu mês? */
function nthWeekday(iso, n, wd) {
  if (weekday(iso) !== wd) return false;
  if (!n) return true;
  const d = +iso.slice(8, 10);
  if (n > 0) return Math.ceil(d / 7) === n;
  const dim = daysInMonth(+iso.slice(0, 4), +iso.slice(5, 7));
  return Math.ceil((dim - d + 1) / 7) === -n;
}
const monthDayOk = (iso, list) => {
  const d = +iso.slice(8, 10);
  const dim = daysInMonth(+iso.slice(0, 4), +iso.slice(5, 7));
  return list.some((x) => (x > 0 ? x === d : dim + x + 1 === d));
};
/** O dia `iso` é uma ocorrência da regra que começa em `start`? (sem contar COUNT/UNTIL) */
function matches(rule, start, iso) {
  const sy = +start.slice(0, 4), sm = +start.slice(5, 7);
  const y = +iso.slice(0, 4), m = +iso.slice(5, 7);
  const months = (y - sy) * 12 + (m - sm);
  if (rule.bymonth && !rule.bymonth.includes(m)) return false;
  switch (rule.freq) {
    case 'DAILY':
      if ((dayNum(iso) - dayNum(start)) % rule.interval) return false;
      return !rule.byday || rule.byday.some((b) => b.wd === weekday(iso));
    case 'WEEKLY': {
      const wkStart = (d) => dayNum(d) - ((weekday(d) - rule.wkst + 7) % 7);
      if (((wkStart(iso) - wkStart(start)) / 7) % rule.interval) return false;
      return rule.byday ? rule.byday.some((b) => b.wd === weekday(iso)) : weekday(iso) === weekday(start);
    }
    case 'MONTHLY':
      if (months % rule.interval) return false;
      if (rule.byday) return rule.byday.some((b) => nthWeekday(iso, b.n, b.wd)) && (!rule.bymonthday || monthDayOk(iso, rule.bymonthday));
      return rule.bymonthday ? monthDayOk(iso, rule.bymonthday) : iso.slice(8) === start.slice(8);
    case 'YEARLY':
      if ((y - sy) % rule.interval) return false;
      if (!rule.bymonth && m !== sm && !rule.byday) return false;
      if (rule.byday) return rule.byday.some((b) => nthWeekday(iso, b.n, b.wd)) && (rule.bymonth || m === sm);
      return rule.bymonthday ? monthDayOk(iso, rule.bymonthday) : iso.slice(5) === start.slice(5);
    default:
      return false;
  }
}

/* ---------- Tudo junto ---------- */
const hash = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0; return h.toString(36); };

/**
 * Eventos de um .ics entre `from` e `to` (AAAA-MM-DD, inclusive), em hora de Lisboa.
 * @returns {Array<{ id, title, date, endDate, time, endTime, allDay, location }>} ordenados; no máximo `max`
 */
export function eventsBetween(text, from, to, { max = 3000 } = {}) {
  const evs = parseEvents(text);
  const calTz = zoneOk((String(text).match(/^X-WR-TIMEZONE:(.+)$/m) || [])[1]?.trim());
  const fromMs = dayNum(from) * 86400000;
  const toMs = (dayNum(to) + 1) * 86400000;
  // Alterações de uma só ocorrência: UID → instantes originais substituídos.
  const moved = new Map();
  evs.forEach((e) => {
    const rid = e['RECURRENCE-ID']?.[0];
    const uid = e.UID?.[0]?.value;
    const dt = readDT(rid, calTz);
    if (uid && dt) (moved.get(uid) || moved.set(uid, new Set()).get(uid)).add(instant(dt));
  });
  const out = [];
  const push = (e, startMs, len, allDay) => {
    const endMs = startMs + Math.max(len, 0);
    if ((len > 0 ? endMs <= fromMs : endMs < fromMs) || startMs >= toMs) return;
    if (allDay) {
      const date = isoOf(Math.floor(startMs / 86400000));
      const endDate = len > 86400000 ? isoOf(Math.floor((endMs - 1) / 86400000)) : date;
      out.push({ date, endDate, time: '', endTime: '', allDay: true });
    } else {
      const a = partsIn(startMs, TZ);
      const b = partsIn(endMs, TZ);
      // Termina à meia-noite: conta só até ao dia anterior.
      const endDate = b.time === '00:00' && b.date > a.date ? addDays(b.date, -1) : b.date;
      out.push({ date: a.date, endDate, time: a.time, endTime: len ? b.time : '', allDay: false });
    }
    const o = out.at(-1);
    Object.assign(o, {
      id: `g-${hash(`${e.UID?.[0]?.value || ''}|${o.date}|${o.time}|${e.SUMMARY?.[0]?.value || ''}`)}`,
      title: unescapeText(e.SUMMARY?.[0]?.value) || '(sem título)',
      location: unescapeText(e.LOCATION?.[0]?.value).slice(0, 200),
    });
  };
  for (const e of evs) {
    if (/^CANCELLED$/i.test(e.STATUS?.[0]?.value || '')) continue;
    const start = readDT(e.DTSTART?.[0], calTz);
    if (!start) continue;
    const startMs = instant(start);
    const end = readDT(e.DTEND?.[0], calTz);
    let len = end ? instant(end) - startMs : duration(e.DURATION?.[0]?.value);
    if (len == null) len = start.allDay ? 86400000 : 0;
    const rrule = e.RRULE?.[0];
    if (!rrule || e['RECURRENCE-ID']) { push(e, startMs, len, start.allDay); continue; }
    const rule = parseRule(rrule.value);
    if (!['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(rule.freq)) { push(e, startMs, len, start.allDay); continue; }
    const untilDt = rule.until ? readDT({ value: rule.until, params: {} }, 'UTC') : null;
    const untilMs = untilDt ? (untilDt.allDay ? (dayNum(untilDt.date) + 1) * 86400000 - 1 : instant(untilDt)) : Infinity;
    const skip = new Set([...(e.EXDATE || []).flatMap((x) => x.value.split(',').map((v) => readDT({ value: v, params: x.params }, start.tz || calTz)))
      .filter(Boolean).map(instant), ...(moved.get(e.UID?.[0]?.value) || [])]);
    let n = 0;
    for (let d = start.date; dayNum(d) * 86400000 < toMs; d = addDays(d, 1)) {
      if (d !== start.date && !matches(rule, start.date, d)) continue;
      const ms = start.allDay ? dayNum(d) * 86400000 : zonedToUTC(d, start.time, start.tz);
      if (ms > untilMs) break;
      n++;
      if (rule.count && n > rule.count) break;
      if (!skip.has(ms)) push(e, ms, len, start.allDay);
      if (out.length > max * 2) break;
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)).slice(0, max);
}

/** Nome do calendário (X-WR-CALNAME), se vier no ficheiro. */
export const calendarName = (text) => unescapeText((String(text).match(/^X-WR-CALNAME:(.+)$/m) || [])[1]);

/** Link aceitável: https (ou webcal) para um servidor público; devolve o https normalizado, ou null. */
export function safeUrl(raw) {
  let u;
  try { u = new URL(String(raw || '').trim().replace(/^webcals?:\/\//i, 'https://')); } catch { return null; }
  if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443')) return null;
  const h = u.hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') || h.endsWith('.supabase.co') || /^[\d.]+$/.test(h) || h.includes(':')) return null;
  return u.toString();
}
