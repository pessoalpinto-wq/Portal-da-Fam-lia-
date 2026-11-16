/*
 * Movimentos que chegam pelo open banking (Enable Banking, PSD2) → movimentos do 🎯 Orçamento (colecção ftx).
 * Funções puras, usadas pela função "bancos" (todos os dias, pelo pg_cron) e testadas em tests/bancos.test.mjs.
 *
 * - Só entram movimentos contabilizados (status BOOK); os pendentes entram quando o banco os fechar.
 * - Id estável por movimento (pela referência do banco): o mesmo movimento nunca entra duas vezes.
 * - Também não repete o que já tinha entrado por um extrato importado à mão (mesma conta, mesmo dia, mesmo valor).
 * - Classifica com as mesmas regras da importação de extratos (regras da família primeiro).
 */
import './orcamento.js'; // define globalThis.Orcamento

const O = globalThis.Orcamento;
const DAY = 86400000;
const addDays = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const isDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));

/** Quantos dias para trás na primeira vez (os bancos costumam dar até 90 dias sem pedir outra vez o código). */
export const FIRST_DAYS = 89;
/** Em cada sincronização volta a pedir alguns dias para trás (movimentos que o banco fecha com atraso). */
export const OVERLAP_DAYS = 7;

/** Descrição legível de um movimento do Enable Banking (contraparte + informação da transferência). */
export function describe(t = {}) {
  const party = t.credit_debit_indicator === 'CRDT' ? t.debtor?.name : t.creditor?.name;
  const parts = [party, ...(Array.isArray(t.remittance_information) ? t.remittance_information : [t.remittance_information]),
    t.note, t.bank_transaction_code?.description];
  const out = [];
  parts.map((p) => String(p ?? '').replace(/\s+/g, ' ').trim()).filter(Boolean).forEach((p) => {
    if (!out.some((o) => O.norm(o).includes(O.norm(p)))) out.push(p);
  });
  return out.join(' · ').slice(0, 200) || '(sem descrição)';
}

/** Movimento do Enable Banking → { date, dates, desc, amount, ref } (ou null se não for para entrar). */
export function toMovement(t = {}) {
  if (t.status && t.status !== 'BOOK') return null;
  const raw = O.parseMoney(t.transaction_amount?.amount);
  if (raw == null || raw === 0) return null;
  const amount = t.credit_debit_indicator === 'DBIT' ? -Math.abs(raw) : t.credit_debit_indicator === 'CRDT' ? Math.abs(raw) : raw;
  const dates = [t.booking_date, t.transaction_date, t.value_date].filter(isDate);
  if (!dates.length) return null;
  const ref = String(t.entry_reference || t.transaction_id || '').trim();
  return { date: dates[0], dates: [...new Set(dates)], desc: describe(t), amount, ref };
}

/** Data a partir da qual pedir movimentos de uma conta: a última sincronização (menos uns dias) ou 89 dias. */
export function syncFrom({ lastSync = '', today }) {
  const first = addDays(today, -FIRST_DAYS);
  if (!isDate(lastSync)) return first;
  const from = addDays(lastSync, -OVERLAP_DAYS);
  return from < first ? first : from;
}

/**
 * Movimentos novos de uma conta, prontos a guardar em ftx.
 * @param existing movimentos que a família já tem (ftx)
 * @param txs movimentos do Enable Banking
 * @param account id da conta no portal (faccounts)
 * @returns {{ fresh: object[], dup: number, skipped: number }}
 */
export function planSync(existing = [], txs = [], account, familyRules = [], { card = false, meal = false } = {}) {
  const have = new Set(existing.map((t) => t.id));
  // Movimentos desta conta que entraram por outro caminho (extrato importado, à mão): dia + valor.
  const other = new Map();
  existing.filter((t) => t.account === account && t.src !== 'bank').forEach((t) => {
    const k = `${t.date}|${Number(t.amount).toFixed(2)}`;
    other.set(k, (other.get(k) || 0) + 1);
  });
  const seen = new Map();
  const fresh = [];
  let dup = 0;
  let skipped = 0;
  txs.forEach((raw) => {
    const m = toMovement(raw);
    if (!m) { skipped++; return; }
    const base = m.ref ? `${account}|ref|${m.ref}` : `${account}|${m.date}|${m.amount.toFixed(2)}|${O.norm(m.desc)}`;
    const n = (seen.get(base) || 0) + 1;
    seen.set(base, n);
    const id = `tx-eb-${O.hash(base)}-${n}`;
    if (have.has(id)) { dup++; return; }
    const k = m.dates.map((d) => `${d}|${m.amount.toFixed(2)}`).find((x) => other.get(x) > 0);
    if (k) { other.set(k, other.get(k) - 1); dup++; return; }
    const c = O.categorize(m.desc, m.amount, familyRules);
    if (card && c.rule === 'none' && m.amount > 0) c.cat = 'outros';
    if (meal && c.rule !== 'family') {
      if (m.amount > 0) c.cat = 'entradas';
      else if (c.cat !== 'restaurantes') c.cat = 'supermercado';
      c.rule = 'default';
    }
    have.add(id);
    fresh.push({ id, account, date: m.date, desc: m.desc, amount: m.amount, cat: c.cat, rule: c.rule, src: 'bank' });
  });
  return { fresh, dup, skipped };
}

/** Os 4 últimos algarismos do IBAN / número de uma conta do Enable Banking. */
export function accountRef(a = {}) {
  const raw = a.account_id?.iban || a.account_id?.other?.identification || a.all_account_ids?.[0]?.identification || '';
  const d = String(raw).replace(/\D/g, '');
  return d.length >= 4 ? d.slice(-4) : '';
}

/** Nome para mostrar de uma conta do Enable Banking. */
export const accountLabel = (a = {}, bank = '') => [a.name || a.product || a.details || bank || 'Conta', accountRef(a) && `…${accountRef(a)}`]
  .filter(Boolean).join(' ');

/**
 * Sugere a conta do portal para uma conta do banco: pelos 4 algarismos (refs aprendidas nos extratos)
 * e depois pelo nome do banco, entre as contas do mesmo tipo.
 */
export function suggestAccount(faccounts = [], ebAccount = {}, bank = '') {
  const ref = accountRef(ebAccount);
  const card = /card|cart[aã]o|credit/i.test(`${ebAccount.cash_account_type || ''} ${ebAccount.product || ''} ${ebAccount.name || ''}`)
    || ebAccount.cash_account_type === 'CARD';
  const g = O.guessAccount(faccounts, { refs: ref ? [ref] : [], text: bank, card });
  return g.id;
}

/** O consentimento está a acabar? (avisar nos últimos 10 dias) */
export function consentState(validUntil, nowMs = Date.now()) {
  const t = Date.parse(validUntil || '');
  if (!Number.isFinite(t)) return 'unknown';
  if (t <= nowMs) return 'expired';
  return t - nowMs <= 10 * DAY ? 'expiring' : 'ok';
}
