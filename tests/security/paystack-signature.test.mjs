import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { verifyPaystackSignature } from "../../src/lib/paystack-signature.mjs";

const secret = "test-secret-for-signature-tests";
const body = '{"event":"charge.success","data":{"reference":"tamark_test"}}';
const signature = createHmac("sha512", secret).update(body).digest("hex");

test("accepts a SHA-512 signature for the exact raw request body", () => {
  assert.equal(verifyPaystackSignature(body, signature, secret), true);
});

test("rejects a signature when the raw body changes", () => {
  assert.equal(verifyPaystackSignature(`${body} `, signature, secret), false);
});

test("rejects malformed or wrong-length signatures", () => {
  assert.equal(verifyPaystackSignature(body, "not-a-signature", secret), false);
  assert.equal(verifyPaystackSignature(body, signature.slice(2), secret), false);
});

test("accepts uppercase hexadecimal without weakening constant-time comparison", () => {
  assert.equal(verifyPaystackSignature(body, signature.toUpperCase(), secret), true);
});
