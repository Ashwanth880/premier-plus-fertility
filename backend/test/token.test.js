import test from "node:test";
import assert from "node:assert/strict";
import { createToken, verifyToken } from "../src/token.js";

const secret = "test-secret-that-is-at-least-32-characters";

test("creates and verifies an unexpired token", () => {
  const token = createToken({ sub: "user-1", role: "admin" }, secret, 60);
  assert.equal(verifyToken(token, secret).sub, "user-1");
});

test("rejects a token signed with another secret", () => {
  const token = createToken({ sub: "user-1" }, secret, 60);
  assert.equal(verifyToken(token, "another-secret-that-is-at-least-32-characters"), null);
});

test("rejects an expired token", () => {
  const token = createToken({ sub: "user-1" }, secret, -1);
  assert.equal(verifyToken(token, secret), null);
});
