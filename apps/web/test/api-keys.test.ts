import { describe, expect, it } from "vitest";
import { decryptApiKey, displayPrefix, encryptApiKey, generateApiKey, hashApiKey, KEY_PREFIX } from "@/server/api-key-crypto";

describe("API key helpers", () => {
  it("makes long random keys with the Spag prefix", () => {
    const a = generateApiKey(), b = generateApiKey();
    expect(a.startsWith(KEY_PREFIX)).toBe(true);
    expect(a.length).toBeGreaterThan(40);
    expect(a).not.toBe(b);
    expect(displayPrefix(a)).toBe(a.slice(0, KEY_PREFIX.length + 4));
  });

  it("encrypts so the key can be revealed again, and only with the right secret", () => {
    const key = generateApiKey(), stored = encryptApiKey(key, "secret-one-0123456789");
    expect(stored).not.toContain(key);
    expect(decryptApiKey(stored, "secret-one-0123456789")).toBe(key);
    expect(() => decryptApiKey(stored, "another-secret-0123456789")).toThrow();
  });

  it("hashes the same key the same way", () => {
    const key = generateApiKey();
    expect(hashApiKey(key)).toBe(hashApiKey(key));
    expect(hashApiKey(key)).toMatch(/^[0-9a-f]{64}$/);
  });
});
