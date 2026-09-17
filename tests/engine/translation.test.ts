/**
 * Address translation tests.
 *
 * Every expected value in this file is hand-calculated with a 4096-byte page size
 * and documented in `docs/reference-values.md`. If a test fails, the docs and the
 * engine disagree - one of them is wrong on purpose, and we must find out which.
 */

import { describe, expect, it } from "vitest";

import { EngineError, buildPhysicalAddress, translateAddress } from "../../engine";
import type { PageSize, VirtualAddress } from "../../engine";

const PAGE_SIZE: PageSize = 4096;

interface TranslationCase {
  readonly address: VirtualAddress;
  readonly pageNumber: number;
  readonly offset: number;
  /** Shown in the test name so the hand calculation stays visible. */
  readonly why: string;
}

const CASES: readonly TranslationCase[] = [
  { address: 0, pageNumber: 0, offset: 0, why: "first byte of page 0" },
  { address: 1, pageNumber: 0, offset: 1, why: "second byte of page 0" },
  { address: 4095, pageNumber: 0, offset: 4095, why: "last byte of page 0" },
  { address: 4096, pageNumber: 1, offset: 0, why: "first byte of page 1" },
  { address: 4097, pageNumber: 1, offset: 1, why: "second byte of page 1" },
  { address: 0x12345, pageNumber: 18, offset: 837, why: "0x12345 = 74565 = 18*4096 + 837" },
  { address: 1048576, pageNumber: 256, offset: 0, why: "1 MiB boundary" },
  {
    address: 4294967295,
    pageNumber: 1048575,
    offset: 4095,
    why: "0xFFFFFFFF, last byte of the 4 GiB address space",
  },
];

describe("translateAddress", () => {
  for (const testCase of CASES) {
    it(`splits ${testCase.address} (0x${testCase.address.toString(16)}) - ${testCase.why}`, () => {
      const split = translateAddress(testCase.address, PAGE_SIZE);

      expect(split.pageNumber).toBe(testCase.pageNumber);
      expect(split.offset).toBe(testCase.offset);
      expect(split.pageSize).toBe(PAGE_SIZE);
      expect(split.virtualAddress).toBe(testCase.address);
    });
  }

  it("keeps pageNumber * pageSize + offset equal to the original address (invariant)", () => {
    for (const testCase of CASES) {
      const { pageNumber, offset } = translateAddress(testCase.address, PAGE_SIZE);
      expect(pageNumber * PAGE_SIZE + offset).toBe(testCase.address);
    }
  });

  it("always places the offset inside the page", () => {
    for (let address = 0; address < 3 * PAGE_SIZE; address += 137) {
      const { offset } = translateAddress(address, PAGE_SIZE);
      expect(offset).toBeGreaterThanOrEqual(0);
      expect(offset).toBeLessThan(PAGE_SIZE);
    }
  });

  it("is pure and deterministic: same input, same output", () => {
    const first = translateAddress(0x12345, PAGE_SIZE);
    const second = translateAddress(0x12345, PAGE_SIZE);

    expect(second).toEqual(first);
    expect(second).not.toBe(first);
  });

  it("supports page sizes other than 4096", () => {
    expect(translateAddress(100, 16)).toEqual({
      virtualAddress: 100,
      pageSize: 16,
      pageNumber: 6,
      offset: 4,
    });
  });

  it.each([-1, -4096, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_VALUE])(
    "rejects the invalid virtual address %s",
    (badAddress) => {
      expect(() => translateAddress(badAddress, PAGE_SIZE)).toThrowError(EngineError);
      expect(() => translateAddress(badAddress, PAGE_SIZE)).toThrowError(
        /must be a non-negative integer/,
      );
    },
  );

  it.each([0, -4096, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects the invalid page size %s",
    (badPageSize) => {
      expect(() => translateAddress(4096, badPageSize)).toThrowError(EngineError);
      expect(() => translateAddress(4096, badPageSize)).toThrowError(/page size must be/);
    },
  );

  it("reports a stable error code so callers can branch on the failure", () => {
    try {
      translateAddress(-1, PAGE_SIZE);
      expect.unreachable("translateAddress should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(EngineError);
      expect((error as EngineError).code).toBe("INVALID_VIRTUAL_ADDRESS");
    }
  });
});
describe("buildPhysicalAddress", () => {
  it("computes frameNumber * pageSize + offset", () => {
    // 7 * 4096 + 837 = 28672 + 837 = 29509
    expect(buildPhysicalAddress(7, 837, PAGE_SIZE)).toBe(29509);
  });

  it("lands on exact frame boundaries when the offset is zero", () => {
    expect(buildPhysicalAddress(0, 0, PAGE_SIZE)).toBe(0);
    expect(buildPhysicalAddress(1, 0, PAGE_SIZE)).toBe(4096);
    expect(buildPhysicalAddress(3, 0, PAGE_SIZE)).toBe(12288);
  });

  it("puts the last byte of a frame at the end of that frame", () => {
    expect(buildPhysicalAddress(3, 4095, PAGE_SIZE)).toBe(PAGE_SIZE * 4 - 1);
  });

  it("is pure and deterministic", () => {
    expect(buildPhysicalAddress(7, 837, PAGE_SIZE)).toBe(buildPhysicalAddress(7, 837, PAGE_SIZE));
  });

  it("rejects a negative frame number", () => {
    expect(() => buildPhysicalAddress(-1, 0, PAGE_SIZE)).toThrowError(/frame number must be/);
  });

  it("rejects an offset that falls outside the page", () => {
    expect(() => buildPhysicalAddress(1, PAGE_SIZE, PAGE_SIZE)).toThrowError(/offset must be/);
    expect(() => buildPhysicalAddress(1, -1, PAGE_SIZE)).toThrowError(/offset must be/);
  });

  it("rejects an invalid page size", () => {
    expect(() => buildPhysicalAddress(1, 0, 0)).toThrowError(/page size must be/);
  });

  it("round-trips a translated address for a present page", () => {
    // virtual 0x12345 -> page 18, offset 837; page 18 sits in frame 7 in the example machine.
    const split = translateAddress(0x12345, PAGE_SIZE);
    const physical = buildPhysicalAddress(7, split.offset, PAGE_SIZE);

    expect(physical).toBe(29509);
    expect(Math.floor(physical / PAGE_SIZE)).toBe(7);
    expect(physical % PAGE_SIZE).toBe(split.offset);
  });
});