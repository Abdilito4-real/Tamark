import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyPaystackSignature(rawBody, signature, secret) {
  const expected = createHmac("sha512", secret).update(rawBody).digest();
  if (!/^[a-f0-9]{128}$/i.test(signature)) return false;
  const provided = Buffer.from(signature, "hex");
  return provided.length === expected.length && timingSafeEqual(expected, provided);
}
