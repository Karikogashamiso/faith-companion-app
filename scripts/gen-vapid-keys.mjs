#!/usr/bin/env node
/**
 * Generate a VAPID keypair for Web Push, printed in the raw base64url form the
 * app expects. Run once and store the output as environment variables.
 *
 *   node scripts/gen-vapid-keys.mjs
 *
 *   VAPID_PUBLIC_KEY        -> server (signing) AND client (VITE_VAPID_PUBLIC_KEY)
 *   VAPID_PRIVATE_KEY       -> server only (secret)
 *
 * Keep the private key secret. The public key is safe to expose to the browser.
 */
import { createECDH } from "node:crypto";

const ec = createECDH("prime256v1");
ec.generateKeys();

const publicKey = ec.getPublicKey().toString("base64url"); // 65-byte uncompressed point
const privateKey = ec.getPrivateKey().toString("base64url"); // 32-byte scalar

console.log("# Web Push VAPID keys — add to your environment:\n");
console.log(`VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
console.log(`VITE_VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_SUBJECT=mailto:you@yourdomain.com`);
