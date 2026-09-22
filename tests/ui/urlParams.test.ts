/**
 * Malformed URL hardening.
 *
 * A shared link is the one piece of unvalidated text this app accepts from outside
 * the program. Everything else - the address box, the frame count, the reference
 * string - is text a person typed into a field that can explain itself. A URL just
 * arrives, is parsed before React mounts, and is used to build a machine.
 *
 * So the contract these tests hold `parseLabUrlConfig` to is narrow and absolute:
 *
 *   - it never throws
 *   - it never returns `NaN`, and never a non-integer where a count belongs
 *   - every rejected value falls back to a documented default, and every accepted
 *     value is one the engine would also accept
 *
 * There is deliberately no "error page" outcome to test for. A link that lost its
 * parameters is not an error; it is a link that opens the default lab.
 */

import { describe, expect, it } from "vitest";

import { CLASSIC_REFERENCE_STRING } from "../../engine";
import { parseReferenceString } from "../../ui/src/lib/fields";
import { FIRST_STEP_INDEX, clampStepIndex, lastStepIndex } from "../../ui/src/lib/lesson";
import {
  DEFAULT_URL_CONFIG,
  LAB_MODES,
  MAX_URL_FRAME_COUNT,
  MAX_URL_TLB_CAPACITY,
  PAGE_SIZE_OPTIONS,
  parseAddressText,
  parseLabUrlConfig,
} from "../../ui/src/lib/url";
import type { LabUrlConfig } from "../../ui/src/lib/url";

/** Every invariant that must hold for EVERY config, however hostile the URL was. */
function expectSane(config: LabUrlConfig): void {
  // No numeric field may ever be NaN: NaN survives arithmetic and would make a
  // frame count or a page size meaningless without looking wrong.
  for (const value of Object.values(config)) {
    if (typeof value === "number") {
      expect(Number.isNaN(value)).toBe(false);
    }
  }

  expect(LAB_MODES).toContain(config.mode);
  expect(["read", "write"]).toContain(config.accessKind);

  expect(Number.isSafeInteger(config.pageSize)).toBe(true);
  expect(PAGE_SIZE_OPTIONS).toContain(config.pageSize);

  expect(Number.isSafeInteger(config.frameCount)).toBe(true);
  expect(config.frameCount).toBeGreaterThanOrEqual(1);
  expect(config.frameCount).toBeLessThanOrEqual(MAX_URL_FRAME_COUNT);

  if (config.tlbCapacity !== null) {
    expect(Number.isSafeInteger(config.tlbCapacity)).toBe(true);
    expect(config.tlbCapacity).toBeGreaterThanOrEqual(1);
    expect(config.tlbCapacity).toBeLessThanOrEqual(MAX_URL_TLB_CAPACITY);
  }

  expect(["FIFO", "LRU", "OPTIMAL"]).toContain(config.algorithm);

  // Both text fields must still be something the engine will accept.
  expect(parseReferenceString(config.referenceText).ok).toBe(true);
  expect(parseAddressText(config.addressText)).not.toBeNull();

  // `step` is clamped onto the real lesson by the screen, so the clamp is what has
  // to be in range - and it has to be, for any integer a URL can carry.
  const clamped = clampStepIndex(config.step);
  expect(clamped).toBeGreaterThanOrEqual(FIRST_STEP_INDEX);
  expect(clamped).toBeLessThanOrEqual(lastStepIndex());
}

/** Every hostile search string that has ever caused a NaN in some codebase. */
const HOSTILE_SEARCH: readonly string[] = [
  "",
  "?",
  "?=",
  "?step=-1",
  "?step=abc",
  "?step=1.5",
  "?step=1e3",
  "?step=0x4",
  "?step=NaN",
  "?step=Infinity",
  "?step=9007199254740993",
  "?step=9999",
  "?pageSize=banana",
  "?pageSize=-10",
  "?pageSize=0",
  "?pageSize=3",
  "?pageSize=4097",
  "?pageSize=1e9",
  "?pageSize=Infinity",
  "?frames=abc",
  "?frames=-10",
  "?frames=0",
  "?frames=1.5",
  "?frames=1025",
  "?frames=999999999999",
  "?tlb=abc",
  "?tlb=-1",
  "?tlb=0",
  "?tlb=65",
  "?tlb=1e3",
  "?tlb=none",
  "?tlb=NONE",
  "?tlb=Infinity",
  "?algo=INVALID",
  "?algo=fifo",
  "?algo=Optimal",
  "?algo=",
  "?algo=CLOCK",
  "?ref=",
  "?ref=abc",
  "?ref=7,,0",
  "?ref=-1",
  "?ref=1.5",
  "?ref=%20%20",
  "?ref=%E2%98%A0",
  "?mode=INVALID",
  "?mode=",
  "?mode=LEARN",
  "?mode=lab",
  "?address=banana",
  "?address=0x",
  "?address=0xZZZZ",
  "?address=-1",
  "?address=1.5",
  "?address=99999999999999999999",
  "?access=WRITE",
  "?access=delete",
  "?pageCount=4",
  "?frameCount=-10",
  "?tlbCapacity=abc",
  "?algorithm=INVALID",
  "?%00=%00",
  "?step[]=1",
  "?step=-1&pageSize=banana&frames=-10&tlb=abc&algo=INVALID&ref=abc&address=banana&mode=nope",
  "?step=abc&pageSize=1e309&frames=NaN&tlb=Infinity&algo=&ref=&address=&access=",
];

describe("parseLabUrlConfig - malformed parameters", () => {
  it("never throws, never returns NaN and never returns an out-of-range value", () => {
    for (const search of HOSTILE_SEARCH) {
      expectSane(parseLabUrlConfig(search, "/"));
    }
  });

  it("never throws for hostile pathnames either", () => {
    const paths = ["/", "/lab", "/lab/", "/lab/learn", "/lab/experiment", "/lab/compare", "/lab/nope", "/lab/learn/extra", "/deep/path/learn", "/learn"];
    for (const pathname of paths) {
      for (const search of HOSTILE_SEARCH) {
        expectSane(parseLabUrlConfig(search, pathname));
      }
    }
  });
});

describe("parseLabUrlConfig - the specific cases, pinned", () => {
  it("falls back to the documented defaults for an empty or parameterless URL", () => {
    for (const search of ["", "?", "?unknown=1"]) {
      expect(parseLabUrlConfig(search, "/")).toEqual(DEFAULT_URL_CONFIG);
    }
  });

  it("rejects a step that is negative, fractional or not a number", () => {
    for (const search of ["?step=-1", "?step=abc", "?step=1.5", "?step=NaN", "?step=Infinity", "?step=9007199254740993"]) {
      expect(parseLabUrlConfig(search, "/").step).toBe(DEFAULT_URL_CONFIG.step);
    }
    expect(parseLabUrlConfig("?step=2", "/").step).toBe(2);
    expect(parseLabUrlConfig("?step=0", "/").step).toBe(0);
    // `1e3` is a number JavaScript accepts, so it is read as 1000 and then clamped by
    // the lesson. Not a default, and not an index past the end either.
    expect(clampStepIndex(parseLabUrlConfig("?step=1e3", "/").step)).toBe(lastStepIndex());
  });

  it("accepts an over-large step but clamps it onto the lesson, so it cannot index past the end", () => {
    const far = parseLabUrlConfig("?step=9999", "/").step;
    expect(far).toBe(9999);
    expect(clampStepIndex(far)).toBe(lastStepIndex());
  });

  it("rejects a page size that is not one of the offered sizes", () => {
    for (const search of ["?pageSize=banana", "?pageSize=-10", "?pageSize=0", "?pageSize=3", "?pageSize=4097", "?pageSize=1e9"]) {
      expect(parseLabUrlConfig(search, "/").pageSize).toBe(DEFAULT_URL_CONFIG.pageSize);
    }
    expect(parseLabUrlConfig("?pageSize=8192", "/").pageSize).toBe(8192);
  });

  it("rejects a frame count below 1, above the cap, or fractional", () => {
    for (const search of ["?frames=abc", "?frames=-10", "?frames=0", "?frames=1.5", "?frames=1025", "?frames=999999999999"]) {
      expect(parseLabUrlConfig(search, "/").frameCount).toBe(DEFAULT_URL_CONFIG.frameCount);
    }
    expect(parseLabUrlConfig("?frames=3", "/").frameCount).toBe(3);
    expect(parseLabUrlConfig("?frames=1024", "/").frameCount).toBe(MAX_URL_FRAME_COUNT);
  });

  it("gives Compare Mode its own frame-count default, because its link names a frame count", () => {
    expect(parseLabUrlConfig("?frames=abc", "/lab/compare").frameCount).toBe(3);
    expect(parseLabUrlConfig("?frames=4", "/lab/compare").frameCount).toBe(4);
  });

  it("accepts 'none' for the TLB and rejects every other bad capacity", () => {
    expect(parseLabUrlConfig("?tlb=none", "/").tlbCapacity).toBeNull();
    expect(parseLabUrlConfig("?tlb=8", "/").tlbCapacity).toBe(8);
    expect(parseLabUrlConfig("?tlb=64", "/").tlbCapacity).toBe(MAX_URL_TLB_CAPACITY);
    for (const search of ["?tlb=abc", "?tlb=-1", "?tlb=0", "?tlb=65", "?tlb=1e3", "?tlb=NONE"]) {
      expect(parseLabUrlConfig(search, "/").tlbCapacity).toBe(DEFAULT_URL_CONFIG.tlbCapacity);
    }
  });

  it("accepts only the three exact algorithm names", () => {
    expect(parseLabUrlConfig("?algo=LRU", "/").algorithm).toBe("LRU");
    expect(parseLabUrlConfig("?algo=OPTIMAL", "/").algorithm).toBe("OPTIMAL");
    // Not case-insensitive, and not a prefix match: a typo must not silently become FIFO.
    for (const search of ["?algo=INVALID", "?algo=fifo", "?algo=Optimal", "?algo=CLOCK", "?algo="]) {
      expect(parseLabUrlConfig(search, "/").algorithm).toBe(DEFAULT_URL_CONFIG.algorithm);
    }
  });

  it("falls back to the textbook reference string when the given one does not parse", () => {
    for (const search of ["?ref=abc", "?ref=7,,0", "?ref=-1", "?ref=1.5", "?ref=%20%20", "?ref="]) {
      expect(parseLabUrlConfig(search, "/lab/compare").referenceText).toBe(DEFAULT_URL_CONFIG.referenceText);
    }
    expect(parseLabUrlConfig("?ref=1%202%203", "/lab/compare").referenceText).toBe("1 2 3");
  });

  it("lets a valid reference string through unchanged, including a long one", () => {
    const long = CLASSIC_REFERENCE_STRING.join(" ");
    expect(parseLabUrlConfig(`?ref=${encodeURIComponent(long)}`, "/lab/compare").referenceText).toBe(long);
  });

  it("resolves the mode from the parameter first, then from the path", () => {
    expect(parseLabUrlConfig("?mode=learn", "/").mode).toBe("learn");
    expect(parseLabUrlConfig("?mode=learn", "/lab/compare").mode).toBe("learn");
    expect(parseLabUrlConfig("", "/lab/learn").mode).toBe("learn");
    expect(parseLabUrlConfig("", "/lab/compare").mode).toBe("compare");
    // Anything unrecognised opens the Experiment screen rather than an error page.
    for (const search of ["?mode=INVALID", "?mode=", "?mode=LEARN"]) {
      expect(parseLabUrlConfig(search, "/").mode).toBe(DEFAULT_URL_CONFIG.mode);
    }
    expect(parseLabUrlConfig("", "/lab/nope").mode).toBe(DEFAULT_URL_CONFIG.mode);
    expect(parseLabUrlConfig("", "/lab/learn/extra").mode).toBe(DEFAULT_URL_CONFIG.mode);
  });

  it("rejects a malformed address and keeps a well-formed one", () => {
    for (const search of ["?address=banana", "?address=0x", "?address=0xZZZZ", "?address=-1", "?address=1.5", "?address=99999999999999999999"]) {
      expect(parseLabUrlConfig(search, "/").addressText).toBe(DEFAULT_URL_CONFIG.addressText);
    }
    expect(parseLabUrlConfig("?address=0x2000", "/").addressText).toBe("0x2000");
    expect(parseLabUrlConfig("?address=4096", "/").addressText).toBe("4096");
  });

  it("only recognises the exact access kinds", () => {
    expect(parseLabUrlConfig("?access=write", "/").accessKind).toBe("write");
    expect(parseLabUrlConfig("?access=read", "/").accessKind).toBe("read");
    // Case matters, and a wrong word is a read rather than a crash.
    expect(parseLabUrlConfig("?access=WRITE", "/").accessKind).toBe("read");
    expect(parseLabUrlConfig("?access=delete", "/").accessKind).toBe("read");
  });

  it("ignores parameter names that are not the ones this build reads", () => {
    // The real names are `pageSize`, `frames`, `tlb`, `algo`. The near-misses below
    // are the names a person would guess, and guessing must not half-configure a machine.
    const config = parseLabUrlConfig("?frameCount=-10&tlbCapacity=abc&algorithm=INVALID&pageCount=4", "/");
    expect(config).toEqual(DEFAULT_URL_CONFIG);
  });
});
