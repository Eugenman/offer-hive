import { describe, expect, test } from "bun:test";
import { newId } from "./id";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("newId", () => {
  test("is a valid v4 uuid", () => {
    expect(newId()).toMatch(UUID_V4);
  });

  test("is unique", () => {
    const ids = new Set(Array.from({ length: 500 }, () => newId()));
    expect(ids.size).toBe(500);
  });

  test("still works where randomUUID is missing (plain http on a phone)", () => {
    const original = globalThis.crypto.randomUUID;
    // @ts-expect-error: simulating an insecure context, where the function is not defined.
    globalThis.crypto.randomUUID = undefined;
    try {
      expect(newId()).toMatch(UUID_V4);
    } finally {
      globalThis.crypto.randomUUID = original;
    }
  });
});
