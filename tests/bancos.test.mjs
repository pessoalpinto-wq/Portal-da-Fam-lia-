import test from 'node:test';
import assert from 'node:assert/strict';
import { accountRef, consentState, describe, planSync, suggestAccount, syncFrom, toMovement } from '../supabase/functions/_shared/bancos.js';

const tx = (o = {}) => ({
  entry_reference: 'R1', transaction_amount: { amount: '12.30', currency: 'EUR' }, credit_debit_indicator: 'DBIT', status: 'BOOK',
  booking_date: '2026-11-10', value_date: '2026-11-11', creditor: { name: 'CONTINENTE MATOSINHOS' }, remittance_information: ['COMPRA 1234'], ...o,
});

test('toMovement: sinal pelo indicador, só contabilizados', () => {
  assert.deepEqual(toMovement(tx()), { date: '2026-11-10', dates: ['2026-11-10', '2026-11-11'], desc: 'CONTINENTE MATOSINHOS · COMPRA 1234', amount: -12.3, ref: 'R1' });
  assert.equal(toMovement(tx({ credit_debit_indicator: 'CRDT', debtor: { name: 'EMPRESA SA' } })).amount, 12.3);
  assert.equal(toMovement(tx({ credit_debit_indicator: 'CRDT', debtor: { name: 'EMPRESA SA' } })).desc, 'EMPRESA SA · COMPRA 1234');
  assert.equal(toMovement(tx({ status: 'PDNG' })), null);
  assert.equal(toMovement(tx({ transaction_amount: { amount: '0' } })), null);
  assert.equal(toMovement(tx({ booking_date: null, value_date: null })), null);
});

test('describe: não repete partes iguais e tem sempre texto', () => {
  assert.equal(describe({ creditor: { name: 'Netflix' }, remittance_information: ['NETFLIX'] }), 'Netflix');
  assert.equal(describe({}), '(sem descrição)');
  assert.equal(describe({ remittance_information: 'Transferência para poupança' }), 'Transferência para poupança');
});

test('planSync: classifica, id estável e não repete', () => {
  const a = planSync([], [tx()], 'acc1');
  assert.equal(a.fresh.length, 1);
  assert.equal(a.fresh[0].cat, 'supermercado');
  assert.equal(a.fresh[0].src, 'bank');
  assert.match(a.fresh[0].id, /^tx-eb-/);
  const b = planSync(a.fresh, [tx()], 'acc1');
  assert.equal(b.fresh.length, 0);
  assert.equal(b.dup, 1);
  // Noutra conta é outro movimento.
  assert.equal(planSync(a.fresh, [tx()], 'acc2').fresh.length, 1);
});

test('planSync: regras da família ganham', () => {
  const r = planSync([], [tx({ creditor: { name: 'LOJA DO ZE' }, remittance_information: [] })], 'acc1', [{ match: 'loja do ze', cat: 'casa' }]);
  assert.equal(r.fresh[0].cat, 'casa');
  assert.equal(r.fresh[0].rule, 'family');
});

test('planSync: não repete o que já veio num extrato importado (dia + valor, também pela data valor)', () => {
  const imported = [{ id: 'tx-abc-1', account: 'acc1', date: '2026-11-11', amount: -12.3, desc: 'COMPRA CONTINENTE', src: 'import' }];
  const r = planSync(imported, [tx(), tx({ entry_reference: 'R2' })], 'acc1');
  assert.equal(r.dup, 1);
  assert.equal(r.fresh.length, 1); // o segundo café igual no mesmo dia continua a entrar
});

test('planSync: sem referência, dois iguais no mesmo dia contam como dois', () => {
  const r = planSync([], [tx({ entry_reference: null }), tx({ entry_reference: null })], 'acc1');
  assert.equal(r.fresh.length, 2);
  assert.notEqual(r.fresh[0].id, r.fresh[1].id);
  assert.equal(r.skipped, 0);
});

test('planSync: cartão refeição e cartão de crédito', () => {
  assert.equal(planSync([], [tx({ creditor: { name: 'XPTO' }, remittance_information: [] })], 'a', [], { meal: true }).fresh[0].cat, 'supermercado');
  assert.equal(planSync([], [tx({ credit_debit_indicator: 'CRDT', debtor: { name: 'XPTO' }, remittance_information: [] })], 'a', [], { card: true }).fresh[0].cat, 'outros');
});

test('syncFrom: primeira vez 89 dias, depois 7 dias antes da última', () => {
  assert.equal(syncFrom({ today: '2026-11-16' }), '2026-08-19');
  assert.equal(syncFrom({ lastSync: '2026-11-15', today: '2026-11-16' }), '2026-11-08');
  assert.equal(syncFrom({ lastSync: '2025-01-01', today: '2026-11-16' }), '2026-08-19');
});

test('accountRef e suggestAccount', () => {
  const eb = { account_id: { iban: 'PT50 0018 0000 1234 5678 9012 3' }, name: 'Conta Ordenado' };
  assert.equal(accountRef(eb), '0123');
  const accs = [{ id: 'x', name: 'Santander', bank: 'Santander', kind: 'ordem', refs: '0123' }, { id: 'y', name: 'Revolut', bank: 'Revolut', kind: 'ordem' }];
  assert.equal(suggestAccount(accs, eb, 'Santander'), 'x');
  assert.equal(suggestAccount(accs, { name: 'EUR' }, 'Revolut'), 'y');
  assert.equal(suggestAccount(accs, { name: 'EUR' }, 'Outro'), '');
});

test('consentState', () => {
  const now = Date.parse('2026-11-16T00:00:00Z');
  assert.equal(consentState('2027-02-01T00:00:00Z', now), 'ok');
  assert.equal(consentState('2026-11-20T00:00:00Z', now), 'expiring');
  assert.equal(consentState('2026-11-01T00:00:00Z', now), 'expired');
  assert.equal(consentState(null, now), 'unknown');
});
