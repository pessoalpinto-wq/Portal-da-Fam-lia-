/*
 * Web Push sem dependências (só WebCrypto): funciona em Deno (Edge Functions) e em Node 20+.
 * - Cifra do conteúdo: RFC 8291 (aes128gcm)
 * - Autenticação do servidor: VAPID, RFC 8292 (JWT ES256)
 */
const subtle = globalThis.crypto.subtle;
const te = new TextEncoder();

export function b64uEncode(bytes) {
  let s = '';
  new Uint8Array(bytes).forEach((b) => { s += String.fromCharCode(b); });
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function b64uDecode(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

export function concat(...parts) {
  const arrays = parts.map((p) => (p instanceof Uint8Array ? p : new Uint8Array(p)));
  const out = new Uint8Array(arrays.reduce((n, a) => n + a.length, 0));
  let i = 0;
  arrays.forEach((a) => { out.set(a, i); i += a.length; });
  return out;
}

export async function hkdf(salt, ikm, info, length) {
  const key = await subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8));
}

/** Chaves VAPID em base64url: publicKey = ponto P-256 não comprimido (65 bytes), privateKey = d (32 bytes). */
export async function importVapidKeys({ publicKey, privateKey }) {
  const pub = b64uDecode(publicKey);
  const jwk = {
    kty: 'EC', crv: 'P-256', ext: true,
    x: b64uEncode(pub.slice(1, 33)), y: b64uEncode(pub.slice(33, 65)), d: privateKey,
  };
  const key = await subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  return { publicKey, key };
}

export async function vapidAuthorization(endpoint, vapid, subject, now = Date.now()) {
  const header = b64uEncode(te.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64uEncode(te.encode(JSON.stringify({
    aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: subject,
  })));
  const unsigned = `${header}.${claims}`;
  const sig = await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, vapid.key, te.encode(unsigned));
  return `vapid t=${unsigned}.${b64uEncode(sig)}, k=${vapid.publicKey}`;
}

/** Cifra o conteúdo para uma subscrição (keys.p256dh e keys.auth em base64url). */
export async function encryptPayload(payload, p256dh, auth, { salt, asKeyPair } = {}) {
  const uaPublic = b64uDecode(p256dh);
  const authSecret = b64uDecode(auth);
  const as = asKeyPair || await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublic = new Uint8Array(await subtle.exportKey('raw', as.publicKey));
  const uaKey = await subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await subtle.deriveBits({ name: 'ECDH', public: uaKey }, as.privateKey, 256));

  const ikm = await hkdf(authSecret, ecdh, concat(te.encode('WebPush: info\0'), uaPublic, asPublic), 32);
  const s = salt || globalThis.crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(s, ikm, te.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(s, ikm, te.encode('Content-Encoding: nonce\0'), 12);

  const data = typeof payload === 'string' ? te.encode(payload) : payload;
  const key = await subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, concat(data, [2])));
  const rs = new Uint8Array([0, 0, 16, 0]); // 4096
  return concat(s, rs, [asPublic.length], asPublic, ct);
}

/**
 * Envia uma notificação. Devolve o código HTTP do serviço de push
 * (201 = entregue; 404/410 = subscrição já não existe).
 */
export async function sendPush(subscription, payload, vapid, { subject, ttl = 86400, urgency = 'normal', fetchFn = fetch } = {}) {
  const body = await encryptPayload(JSON.stringify(payload), subscription.p256dh, subscription.auth);
  const res = await fetchFn(subscription.endpoint, {
    method: 'POST',
    headers: {
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(ttl),
      Urgency: urgency,
      Authorization: await vapidAuthorization(subscription.endpoint, vapid, subject),
    },
    body,
  });
  return res.status;
}
