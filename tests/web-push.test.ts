import { describe, expect, it } from "bun:test";
import { createECDH, randomBytes } from "node:crypto";
import {
  encryptPayload,
  decryptPayload,
  buildVapidAuthHeader,
} from "../src/lib/web-push.server";

// Prove the aes128gcm (RFC 8188 / RFC 8291) implementation is correct by
// round-tripping: encrypt with the sender path, decrypt with the receiver's
// private key, and recover the exact plaintext. This validates HKDF, the GCM
// record framing, the header layout, and key derivation without depending on a
// memorized RFC test vector.
describe("web push aes128gcm round-trip", () => {
  function makeSubscription() {
    const ua = createECDH("prime256v1");
    ua.generateKeys();
    return {
      uaPrivate: ua.getPrivateKey(),
      p256dh: ua.getPublicKey().toString("base64url"),
      auth: randomBytes(16).toString("base64url"),
    };
  }

  it("recovers the plaintext", () => {
    const sub = makeSubscription();
    const message = "When I grow up, I want to be a watermelon";
    const body = encryptPayload(Buffer.from(message, "utf8"), sub.p256dh, sub.auth);
    const out = decryptPayload(body, sub.uaPrivate, sub.p256dh, sub.auth);
    expect(out.toString("utf8")).toBe(message);
  });

  it("recovers a JSON notification payload", () => {
    const sub = makeSubscription();
    const payload = JSON.stringify({ title: "Today's verse is ready", body: "Open Faith Companion.", url: "/home" });
    const body = encryptPayload(Buffer.from(payload, "utf8"), sub.p256dh, sub.auth);
    expect(decryptPayload(body, sub.uaPrivate, sub.p256dh, sub.auth).toString("utf8")).toBe(payload);
  });

  it("uses a fresh ephemeral key + salt each call (ciphertexts differ)", () => {
    const sub = makeSubscription();
    const a = encryptPayload(Buffer.from("hello"), sub.p256dh, sub.auth);
    const b = encryptPayload(Buffer.from("hello"), sub.p256dh, sub.auth);
    expect(a.equals(b)).toBe(false);
  });

  it("produces a valid aes128gcm header (salt + rs=4096 + 65-byte keyid)", () => {
    const sub = makeSubscription();
    const body = encryptPayload(Buffer.from("hi"), sub.p256dh, sub.auth);
    expect(body.readUInt32BE(16)).toBe(4096); // record size
    expect(body.readUInt8(20)).toBe(65); // keyid length = uncompressed P-256 point
  });

  it("fails to decrypt with the wrong auth secret (AEAD integrity holds)", () => {
    const sub = makeSubscription();
    const body = encryptPayload(Buffer.from("secret"), sub.p256dh, sub.auth);
    const wrongAuth = randomBytes(16).toString("base64url");
    expect(() => decryptPayload(body, sub.uaPrivate, sub.p256dh, wrongAuth)).toThrow();
  });
});

describe("VAPID auth header", () => {
  // A throwaway P-256 keypair in the raw base64url form VAPID uses.
  function vapidKeys() {
    const ec = createECDH("prime256v1");
    ec.generateKeys();
    return {
      publicKey: ec.getPublicKey().toString("base64url"),
      privateKey: ec.getPrivateKey().toString("base64url"),
      subject: "mailto:test@example.com",
    };
  }

  it("emits a vapid scheme header with t= JWT and k= public key", () => {
    const keys = vapidKeys();
    const header = buildVapidAuthHeader("https://fcm.googleapis.com/fcm/send/abc", keys);
    expect(header.startsWith("vapid t=")).toBe(true);
    expect(header).toContain(`k=${keys.publicKey}`);

    const jwt = header.slice("vapid t=".length).split(",")[0].trim();
    const [h, p, s] = jwt.split(".");
    expect(h && p && s).toBeTruthy();
    const payload = JSON.parse(Buffer.from(p, "base64url").toString("utf8"));
    expect(payload.aud).toBe("https://fcm.googleapis.com"); // origin of the endpoint
    expect(payload.sub).toBe("mailto:test@example.com");
    expect(typeof payload.exp).toBe("number");
    // ES256 raw signature is 64 bytes (r||s).
    expect(Buffer.from(s, "base64url").length).toBe(64);
  });
});
