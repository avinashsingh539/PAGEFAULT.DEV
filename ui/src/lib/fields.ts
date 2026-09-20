/**
 * Turning typed text into numbers, safely.
 *
 * This module is deliberately tiny and pure: no DOM, no React, no engine import. It
 * exists so every input box in the lab answers the same question the same way -
 * "what number did the user mean?" - and so that the answer is `null` instead of
 * `NaN`. `NaN` is the single most dangerous value in this codebase: it is a number
 * to JavaScript, it survives arithmetic, and it would silently make a frame count or
 * a page size meaningless. Nothing here may ever return it.
 *
 * These parsers are NOT the authority on what the engine accepts. The engine
 * validates every value it is handed and throws a typed `EngineError`; the UI calls
 * these parsers to give immediate feedback and to avoid handing the engine obvious
 * nonsense. Where the two could disagree, the engine wins.
 */

/** The outcome of reading one input field: a value, or a reason it was rejected. */
export type FieldResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string };

export function accepted<T>(value: T): FieldResult<T> {
  return { ok: true, value };
}

export function rejected<T>(error: string): FieldResult<T> {
  return { ok: false, error };
}

/**
 * Read a non-negative integer, in decimal (`4096`) or hex (`0x1000`).
 *
 * Rejected: empty text, whitespace only, signs (`-1`, `+1`), fractions (`1.5`),
 * exponent notation (`1e3`), a bare `0x`, trailing garbage (`12abc`), `NaN`,
 * `Infinity`, and anything outside the safe-integer range. Every rejection carries a
 * message naming what was expected, so the screen can show it verbatim.
 */
export function parseIntegerText(text: string): FieldResult<number> {
  const trimmed = text.trim().toLowerCase();

  if (trimmed === "") {
    return rejected("Enter a number.");
  }

  if (trimmed.startsWith("-")) {
    return rejected("Negative numbers are not valid here.");
  }

  const isHex = trimmed.startsWith("0x");
  const digits = isHex ? trimmed.slice(2) : trimmed;

  if (digits === "") {
    return rejected("Enter the digits after 0x.");
  }

  const pattern = isHex ? /^[0-9a-f]+$/ : /^[0-9]+$/;
  if (!pattern.test(digits)) {
    return rejected(
      isHex
        ? "Hexadecimal digits only (0-9, a-f) after 0x."
        : "Whole numbers only - no fractions, signs or exponents.",
    );
  }

  const value = Number.parseInt(digits, isHex ? 16 : 10);

  if (!Number.isSafeInteger(value)) {
    return rejected("That number is too large to use safely.");
  }

  return accepted(value);
}

/**
 * Read a strictly positive integer, or `null` when the text asks for "none".
 *
 * `noneText` is the literal the caller's control uses for "this component is
 * absent" (the TLB uses `"none"`). Everything else must parse as an integer and be
 * at least 1: zero is rejected with a message that says why, because a frame count
 * or a TLB capacity of zero is a configuration mistake, not a disable switch.
 */
export function parsePositiveIntegerText(
  text: string,
  noneText: string | null,
): FieldResult<number | null> {
  const trimmed = text.trim().toLowerCase();

  if (noneText !== null && trimmed === noneText) {
    return accepted(null);
  }

  const parsed = parseIntegerText(text);
  if (!parsed.ok) {
    return parsed;
  }

  if (parsed.value === 0) {
    return rejected("Must be at least 1 - zero would leave nothing to work with.");
  }

  return accepted(parsed.value);
}

/**
 * Split a reference string ("7 0 1 2" or "7,0,1,2") into page numbers.
 *
 * Separators are whitespace and commas, mixed freely, because both are how people
 * write these strings down. An empty text is a valid EMPTY reference string (a run of
 * zero accesses), which the engine answers honestly; a blank item between two commas
 * ("7,,0") is rejected instead of being silently dropped, because silently dropping an
 * access would publish a fault count for a different string.
 */
export function parseReferenceString(text: string): FieldResult<readonly number[]> {
  const trimmed = text.trim();

  if (trimmed === "") {
    return accepted([]);
  }

  const items = trimmed.split(/[\s,]+/).filter((item) => item !== "");

  // A trailing separator is fine ("7,0,"), an interior blank is not ("7,,0").
  if (/[\s,]{2,}/.test(trimmed) && !/[\s,]+$/.test(trimmed)) {
    return rejected("There is an empty entry in the list - remove the doubled separator.");
  }

  const pages: number[] = [];

  for (const [index, item] of items.entries()) {
    const parsed = parseIntegerText(item);
    if (!parsed.ok) {
      return rejected(`Entry ${index + 1} ("${item}"): ${parsed.error}`);
    }
    pages.push(parsed.value);
  }

  return accepted(pages);
}
