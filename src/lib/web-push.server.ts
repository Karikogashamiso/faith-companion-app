// Server-only Web Push sender — VAPID (RFC 8292) + aes128gcm payload
// encryption (RFC 8188 / RFC 8291) implemented with node:crypto. No `web-push`
// npm dependency, consistent with the dependency-free Stripe/RevenueCat code.
// Correctness is proven by a round-trip test (tests/web-push.test.ts).
import {
  createCipheriv,
  createDecipheriv,
  createECDH,
  createHmac,
  createPrivateKey,
  createSign,
  randomBytes,
} from "node:crypto";

export type PushSubscription = { endpoint: string; p256dh: string; auth: string };
export type VapidConfig = { publicKey: string; privateKey: string; subject: string };

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}
function fromB64url(s: string): Buffer {
  return Buffer.from(s, "base64url");
}

// HKDF (RFC 5869, SHA-256), single-block expand — all our outputs are ≤32 bytes.
function hkdf(salt: Buffer, ikm: Buffer, info: Buffer, length: number): Buffer {
  const prk = createHmac("sha256", salt).update(ikm).digest();
  const okm = createHmac("sha256", prk)
    .update(Buffer.concat([info, Buffer.from([1])]))
    .digest();
  return okm.subarray(0, length);
}

// Derive the content-encryption key + nonce shared by encrypt and decrypt.
function deriveKeys(opts: {
  uaPublic: Buffer; // receiver public (p256dh), 65 bytes
  authSecret: Buffer; // 16 bytes
  asPublic: Buffer; // sender (ephemeral) public, 65 bytes
  sharedSecret: Buffer; // ECDH output, 32 bytes
  salt: Buffer; // 16 bytes
}): { cek: Buffer; nonce: Buffer } {
  // RFC 8291 §3.4: combine the ECDH secret with the auth secret.
  const keyInfo = Buffer.concat([
    Buffer.from("WebPush: info\0", "utf8"),
    opts.uaPublic,
    opts.asPublic,
  ]);
  const ikm = hkdf(opts.authSecret, opts.sharedSecret, keyInfo, 32);
  // RFC 8188: CEK + nonce from the record salt.
  const cek = hkdf(opts.salt, ikm, Buffer.from("Content-Encoding: aes128gcm\0", "utf8"), 16);
  const nonce = hkdf(opts.salt, ikm, Buffer.from("Content-Encoding: nonce\0", "utf8"), 12);
  return { cek, nonce };
}

/**
 * Encrypt a payload into an aes128gcm body for Web Push. `inject` lets tests
 * pin the ephemeral keypair + salt; production uses fresh random values.
 */
export function encryptPayload(
  payload: Buffer,
  uaPublicB64: string,
  authSecretB64: string,
  inject?: { salt?: Buffer; asPrivate?: Buffer },
): Buffer {
  const uaPublic = fromB64url(uaPublicB64);
  const authSecret = fromB64url(authSecretB64);

  const ecdh = createECDH("prime256v1");
  if (inject?.asPrivate) ecdh.setPrivateKey(inject.asPrivate);
  else ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey(); // 65-byte uncompressed point
  const sharedSecret = ecdh.computeSecret(uaPublic);
  const salt = inject?.salt ?? randomBytes(16);

  const { cek, nonce } = deriveKeys({ uaPublic, authSecret, asPublic, sharedSecret, salt });

  // Single record: plaintext || 0x02 (last-record delimiter), then GCM.
  const record = Buffer.concat([payload, Buffer.from([0x02])]);
  const cipher = createCipheriv("aes-128-gcm", cek, nonce);
  const ciphertext = Buffer.concat([cipher.update(record), cipher.final(), cipher.getAuthTag()]);

  // RFC 8188 header: salt(16) | rs(uint32 BE) | idlen(1) | keyid(as_public).
  const header = Buffer.alloc(21 + asPublic.length);
  salt.copy(header, 0);
  header.writeUInt32BE(4096, 16);
  header.writeUInt8(asPublic.length, 20);
  asPublic.copy(header, 21);

  return Buffer.concat([header, ciphertext]);
}

/**
 * Reverse of {@link encryptPayload}, used only by the test to prove round-trip
 * correctness. Takes the receiver's ECDH private key.
 */
export function decryptPayload(body: Buffer, uaPrivate: Buffer, uaPublicB64: string, authSecretB64: string): Buffer {
  const salt = body.subarray(0, 16);
  const idlen = body.readUInt8(20);
  const asPublic = body.subarray(21, 21 + idlen);
  const ciphertext = body.subarray(21 + idlen);

  const ecdh = createECDH("prime256v1");
  ecdh.setPrivateKey(uaPrivate);
  const sharedSecret = ecdh.computeSecret(asPublic);

  const { cek, nonce } = deriveKeys({
    uaPublic: fromB64url(uaPublicB64),
    authSecret: fromB64url(authSecretB64),
    asPublic,
    sharedSecret,
    salt,
  });

  const tag = ciphertext.subarray(ciphertext.length - 16);
  const data = ciphertext.subarray(0, ciphertext.length - 16);
  const decipher = createDecipheriv("aes-128-gcm", cek, nonce);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(data), decipher.final()]);
  // Strip the trailing 0x02 (single-record padding delimiter).
  return plain.subarray(0, plain.length - 1);
}

// Import a VAPID keypair (raw base64url public 65B + private 32B) as a KeyObject.
function importVapidPrivateKey(publicB64: string, privateB64: string) {
  const pub = fromB64url(publicB64);
  return createPrivateKey({
    format: "jwk",
    key: {
      kty: "EC",
      crv: "P-256",
      x: b64url(pub.subarray(1, 33)),
      y: b64url(pub.subarray(33, 65)),
      d: privateB64,
    },
  });
}

/** Build the `Authorization: vapid t=…, k=…` header for an endpoint (RFC 8292). */
export function buildVapidAuthHeader(endpoint: string, vapid: VapidConfig, nowSec = Math.floor(Date.now() / 1000)): string {
  const audience = new URL(endpoint).origin;
  const header = b64url(Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = b64url(
    Buffer.from(JSON.stringify({ aud: audience, exp: nowSec + 12 * 3600, sub: vapid.subject })),
  );
  const signingInput = `${header}.${payload}`;
  const key = importVapidPrivateKey(vapid.publicKey, vapid.privateKey);
  // ES256 needs a raw R||S signature, not DER.
  const signature = createSign("SHA256").update(signingInput).sign({ key, dsaEncoding: "ieee-p1363" });
  return `vapid t=${signingInput}.${b64url(signature)}, k=${vapid.publicKey}`;
}

export function vapidConfig(): VapidConfig | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject: process.env.VAPID_SUBJECT || "mailto:support@faithcompanion.app" };
}

/**
 * Send one push. Returns `gone: true` for 404/410 so the caller can prune a
 * dead subscription. Never throws on a normal HTTP error — only on network/crypto.
 */
export async function sendPush(
  sub: PushSubscription,
  payload: string,
  vapid: VapidConfig,
  ttlSeconds = 2_419_200,
): Promise<{ ok: boolean; status: number; gone: boolean }> {
  const body = encryptPayload(Buffer.from(payload, "utf8"), sub.p256dh, sub.auth);
  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      Authorization: buildVapidAuthHeader(sub.endpoint, vapid),
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: String(ttlSeconds),
    },
    body: new Uint8Array(body),
  });
  return { ok: res.ok, status: res.status, gone: res.status === 404 || res.status === 410 };
}
