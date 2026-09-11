import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password, storedHash) {
  const [salt, expectedHash] = String(storedHash).split(":");
  if (!salt || !expectedHash) return false;
  const actualHash = scryptSync(password, salt, 64);
  const expectedBuffer = Buffer.from(expectedHash, "hex");
  return expectedBuffer.length === actualHash.length && timingSafeEqual(actualHash, expectedBuffer);
}
