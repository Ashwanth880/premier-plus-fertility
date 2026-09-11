import { createHmac, timingSafeEqual } from "node:crypto";

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function signature(value, secret) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function createToken(payload, secret, ttlSeconds) {
  const encodedPayload = encode({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds });
  return `${encodedPayload}.${signature(encodedPayload, secret)}`;
}

export function verifyToken(token, secret) {
  const [encodedPayload, providedSignature] = String(token || "").split(".");
  if (!encodedPayload || !providedSignature) return null;
  const expectedSignature = signature(encodedPayload, secret);
  const matching = Buffer.from(providedSignature).length === Buffer.from(expectedSignature).length && timingSafeEqual(Buffer.from(providedSignature), Buffer.from(expectedSignature));
  if (!matching) return null;
  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
    return payload.exp > Math.floor(Date.now() / 1000) ? payload : null;
  } catch {
    return null;
  }
}
