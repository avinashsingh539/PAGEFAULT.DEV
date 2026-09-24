/**
 * One tiny class-name joiner, used everywhere instead of a dependency.
 *
 * It is deliberately not a "clsx"-alike: the only thing the UI ever needs is to
 * drop `false`/`null`/`undefined` and join the rest with a space, so a 4-line
 * function is cheaper than a package and keeps the dependency list honest.
 */
export function cx(...parts: ReadonlyArray<string | false | null | undefined>): string {
  return parts.filter((part): part is string => typeof part === "string" && part.length > 0).join(" ");
}
