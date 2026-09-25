// Testes do módulo Web Push: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  b64uEncode, b64uDecode, hkdf, concat, encryptPayload, importVapidKeys, vapidAuthorization, sendPush,
} from '../supabase/functions/_shared/webpush.js';

const subtle = globalThis.crypto.subtle;
const te = new TextEncoder();

async function browserSubscription() {
  const ua = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const auth = crypto.getRandomValues(new Uint8Array(16));
  const p256dh = new Uint8Array(await subtle.exportKey('raw', ua.publicKey));
  return { ua, sub: { endpoint: 'https://push.example.com/abc', p256dh: b64uEncode(p256dh), auth: b64uEncode(auth) } };
}

/** Decifra como faria o navegador (RFC 8291 / RFC 8188). */
async function decrypt(body, ua, sub) {
  const salt = body.slice(0, 16);
  const rs = new DataView(body.buffer, body.byteOffset + 16, 4).getUint32(0);
  const idlen = body[20];
  const asPublic = body.slice(21, 21 + idlen);
  const ct = body.slice(21 + idlen);
  const asKey = await subtle.importKey('raw', asPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await subtle.deriveBits({ name: 'ECDH', public: asKey }, ua.privateKey, 256));
  const uaPublic = b64uDecode(sub.p256dh);
  const ikm = await hkdf(b64uDecode(sub.auth), ecdh, concat(te.encode('WebPush: info\0'), uaPublic, asPublic), 32);
  const cek = await hkdf(salt, ikm, te.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, te.encode('Content-Encoding: nonce\0'), 12);
  const key = await subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
  const plain = new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, ct));
  assert.equal(plain[plain.length - 1], 2, 'delimitador do último registo');
  return { rs, idlen, text: new TextDecoder().decode(plain.slice(0, -1)) };
}

async function vapidPair() {
  const k = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const jwk = await subtle.exportKey('jwk', k.privateKey);
  const pub = new Uint8Array(await subtle.exportKey('raw', k.publicKey));
  return { keys: { publicKey: b64uEncode(pub), privateKey: jwk.d }, verifyKey: k.publicKey };
}

test('base64url ida e volta', () => {
  const bytes = crypto.getRandomValues(new Uint8Array(65));
  assert.deepEqual(b64uDecode(b64uEncode(bytes)), bytes);
});

test('cifra aes128gcm que o navegador consegue decifrar (texto com acentos e emojis)', async () => {
  const { ua, sub } = await browserSubscription();
  const msg = JSON.stringify({ title: '📝 Amanhã: Teste de Matemática', body: 'Não te esqueças! ção' });
  const body = await encryptPayload(msg, sub.p256dh, sub.auth);
  const out = await decrypt(body, ua, sub);
  assert.equal(out.text, msg);
  assert.equal(out.rs, 4096);
  assert.equal(out.idlen, 65);
});

test('JWT VAPID tem audiência certa e assinatura válida', async () => {
  const { keys, verifyKey } = await vapidPair();
  const vapid = await importVapidKeys(keys);
  const h = await vapidAuthorization('https://fcm.googleapis.com/fcm/send/xyz', vapid, 'https://exemplo.pt/');
  const m = h.match(/^vapid t=([^,]+), k=(.+)$/);
  assert.ok(m, h);
  assert.equal(m[2], keys.publicKey);
  const [hd, cl, sig] = m[1].split('.');
  const claims = JSON.parse(new TextDecoder().decode(b64uDecode(cl)));
  assert.equal(claims.aud, 'https://fcm.googleapis.com');
  assert.equal(claims.sub, 'https://exemplo.pt/');
  assert.ok(claims.exp > Date.now() / 1000);
  const ok = await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, verifyKey, b64uDecode(sig), te.encode(`${hd}.${cl}`));
  assert.ok(ok, 'assinatura ES256');
});

test('sendPush envia os cabeçalhos certos e um corpo decifrável', async () => {
  const { ua, sub } = await browserSubscription();
  const { keys } = await vapidPair();
  const vapid = await importVapidKeys(keys);
  let req;
  const status = await sendPush(sub, { title: 'Olá' }, vapid, {
    subject: 'https://exemplo.pt/',
    fetchFn: async (url, init) => { req = { url, init }; return { status: 201 }; },
  });
  assert.equal(status, 201);
  assert.equal(req.url, sub.endpoint);
  assert.equal(req.init.headers['Content-Encoding'], 'aes128gcm');
  assert.equal(req.init.headers.TTL, '86400');
  assert.match(req.init.headers.Authorization, /^vapid t=.+, k=.+$/);
  assert.equal((await decrypt(req.init.body, ua, sub)).text, JSON.stringify({ title: 'Olá' }));
});
