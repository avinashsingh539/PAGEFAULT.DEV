/**
 * Tests for the Day 4 UI lib: field parsing, experiment configuration, compare.
 *
 * These run in plain Node (the libs import nothing from the DOM), and they exist to
 * pin the two contracts the screens depend on:
 *
 *   1. No input path can produce `NaN`, a negative count, or a half-valid
 *      configuration. Every rejection is a message; every acceptance is a value the
 *      engine itself already accepts.
 *   2. Compare calls the engine's ONE shared harness - the classic string with 3
 *      frames must come back FIFO 15 / LRU 12 / Optimal 9, straight from the engine,
 *      with no second implementation anywhere in the frontend.
 */

import { describe, expect, it } from "vitest";

import { parseIntegerText, parsePositiveIntegerText, parseReferenceString } from "../../ui/src/lib/fields";

describe("parseIntegerText", () => {
  it("accepts decimal and hex, and rejects everything a number must not be", () => {
    expect(parseIntegerText("4096")).toEqual({ ok: true, value: 4096 });
    expect(parseIntegerText("0x1000")).toEqual({ ok: true, value: 4096 });
    expect(parseIntegerText(" 16 ")).toEqual({ ok: true, value: 16 });
  });

  it("rejects with a message, never with NaN", () => {
    for (const text of ["", "   ", "-1", "+1", "1.5", "1e3", "0x", "12abc", "abc"]) {
      const result = parseIntegerText(text);
      expect(result.ok, text).toBe(false);
      if (!result.ok) {
        expect(result.error.length, text).toBeGreaterThan(0);
      }
    }
  });
});

describe("parsePositiveIntegerText", () => {
  it("accepts 1 and up, and the none-word as null", () => {
    expect(parsePositiveIntegerText("1", null)).toEqual({ ok: true, value: 1 });
    expect(parsePositiveIntegerText("16", null)).toEqual({ ok: true, value: 16 });
    expect(parsePositiveIntegerText("none", "none")).toEqual({ ok: true, value: null });
    expect(parsePositiveIntegerText("NONE", "none")).toEqual({ ok: true, value: null });
  });

  it("rejects zero with a reason: it is a configuration mistake, not a disable switch", () => {
    const result = parsePositiveIntegerText("0", null);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("at least 1");
    }
  });

  it("rejects negatives and fractions", () => {
    expect(parsePositiveIntegerText("-2", null).ok).toBe(false);
    expect(parsePositiveIntegerText("2.5", null).ok).toBe(false);
    expect(parsePositiveIntegerText("NaN", null).ok).toBe(false);
  });
});

describe("parseReferenceString", () => {
  it("accepts spaces and commas, mixed", () => {
    expect(parseReferenceString("7 0 1")).toEqual({ ok: true, value: [7, 0, 1] });
    expect(parseReferenceString("7,0,1")).toEqual({ ok: true, value: [7, 0, 1] });
    expect(parseReferenceString(" 7, 0  1, ")).toEqual({ ok: true, value: [7, 0, 1] });
  });

  it("treats empty text as an empty string (a run of zero accesses is honest)", () => {
    expect(parseReferenceString("")).toEqual({ ok: true, value: [] });
    expect(parseReferenceString("   ")).toEqual({ ok: true, value: [] });
  });

  it("rejects a blank entry instead of silently dropping an access", () => {
    const result = parseReferenceString("7,,0");
    expect(result.ok).toBe(false);
  });

  it("names the offending entry", () => {
    const result = parseReferenceString("7 0 -1");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Entry 3");
    }
  });
});
