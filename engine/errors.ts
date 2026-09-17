/**
 * Error type used by the engine for malformed input.
 *
 * The engine never silently produces `NaN` or garbage: invalid input is rejected
 * with a typed error carrying a stable machine-readable code, so tests and (later)
 * UI code can react to specific failure modes.
 */

export type EngineErrorCode =
  | "INVALID_VIRTUAL_ADDRESS"
  | "INVALID_PAGE_SIZE"
  | "INVALID_OFFSET"
  | "INVALID_FRAME_NUMBER"
  | "INVALID_PAGE_TABLE"
  | "INVALID_MACHINE_CONFIG"
  | "UNKNOWN_ACTION";

export class EngineError extends Error {
  readonly code: EngineErrorCode;

  constructor(code: EngineErrorCode, message: string) {
    super(message);
    this.name = "EngineError";
    this.code = code;
  }
}

/**
 * Errors thrown by `step()` are wrapped so the caller can tell an engine problem
 * from a programming error while still seeing the original code.
 */
export function isEngineError(error: unknown): error is EngineError {
  return error instanceof EngineError;
}

/** Exhaustiveness helper: proves at compile time that every union member was handled. */
export function assertUnreachable(value: never, context: string): never {
  throw new EngineError("UNKNOWN_ACTION", `${context}: unhandled case ${JSON.stringify(value)}`);
}