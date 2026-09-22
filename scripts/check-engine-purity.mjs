#!/usr/bin/env node
/**
 * Engine purity gate.
 *
 *   npm run check:purity
 *
 * The non-negotiable rule of this project is that `engine/` is pure TypeScript:
 * no React, no Zustand, no DOM, no browser API, no animation, no clock, no random
 * number generator, and no package it did not write itself. The architecture is
 *
 *     ENGINE -> state/events -> UI
 *
 * and the whole point is that the arrow only ever points one way.
 *
 * Two gates already protect this and neither is replaced by this script:
 *
 *   - `tsc -p tsconfig.json` compiles `engine/` with `"lib": ["ES2022"]` and
 *     `"types": []`. That is the real proof: `window`, `document`, `process` and
 *     `console` are not even *declared* in that configuration, so a single use is a
 *     compile error. TypeScript cannot be talked out of it.
 *   - `vitest` runs the engine in a plain Node environment with no jsdom.
 *
 * This script exists because a compile error is a good explanation and a bad
 * *inventory*. It reads the engine sources and reports, by file and line, exactly
 * which rule was broken, so a CI failure explains itself without anyone having to
 * decode `error TS2304: Cannot find name 'window'`.
 *
 * Comments are stripped before matching on purpose. The engine's doc comments
 * legitimately *name* the things it must not use - `engine/index.ts` says "may
 * import React, Zustand, DOM APIs" precisely to forbid them - and a checker that
 * cannot tell a prohibition from a violation would be worse than no checker.
 *
 * Exit code 0 when the engine is pure, 1 otherwise.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const engineDir = join(repoRoot, "engine");

/** Rules are checked against comment-stripped source. */
const RULES = [
  {
    id: "no-package-imports",
    why: "the engine imports nothing it does not own",
    // Any import/export specifier that is not relative is a package or a Node builtin.
    test: /(?:import|export)\b[^;\n]*?\bfrom\s*["']([^"']+)["']/g,
    check: (specifier) => /^\.{1,2}\//.test(specifier),
    cite: (specifier) => `imports "${specifier}" - only relative engine-relative paths are allowed`,
  },
  {
    id: "no-browser-globals",
    why: "there is no browser in the engine",
    test: /\b(window|document|localStorage|sessionStorage|navigator|requestAnimationFrame)\b/g,
    check: () => false,
    cite: (name) => `uses the browser global "${name}"`,
  },
  {
    id: "no-nondeterminism",
    why: "a replay must produce the same events every time",
    test: /\b(Math\s*\.\s*random|Date\s*\.\s*now|performance\s*\.\s*now|new\s+Date)\b/g,
    check: () => false,
    cite: (name) =>
      `reads a clock or an entropy source via "${name.replace(/\s+/g, "")}" - the engine must be deterministic`,
  },
  {
    id: "no-timers",
    why: "event order comes from `step()`, never from elapsed time",
    test: /\b(setTimeout|setInterval|setImmediate|queueMicrotask|requestIdleCallback)\b/g,
    check: () => false,
    cite: (name) => `schedules asynchronously with "${name}"`,
  },
  {
    id: "no-console",
    why: "the engine returns events; printing them is the caller's job",
    test: /\bconsole\s*\./g,
    check: () => false,
    cite: () => "writes to the console (the CLI and the UI do that, not the engine)",
  },
  {
    id: "no-ui-file-types",
    why: "the engine owns no markup and no styling",
    test: /\bfrom\s*["']([^"']*\.(?:tsx|jsx|css|scss|svg|png))["']/g,
    check: () => false,
    cite: (specifier) => `imports the UI asset "${specifier}"`,
  },
];

/** Every `.ts` file under `engine/`, recursively, as absolute paths. */
function engineSources(dir = engineDir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const absolute = join(dir, entry);
    if (statSync(absolute).isDirectory()) {
      found.push(...engineSources(absolute));
    } else if (entry.endsWith(".ts")) {
      found.push(absolute);
    }
  }
  return found;
}

/**
 * Remove `//` line comments and block comments, leaving string literals alone so a
 * URL or a regex inside a string is not mistaken for the start of a comment.
 *
 * Newlines inside a removed block comment are kept, so reported line numbers still
 * point at the right place in the original file.
 */
function stripComments(source) {
  let out = "";
  let index = 0;
  let quote = null;

  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];

    if (quote !== null) {
      out += char;
      if (char === "\\") {
        out += next ?? "";
        index += 2;
        continue;
      }
      if (char === quote) {
        quote = null;
      }
      index += 1;
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      out += char;
      index += 1;
      continue;
    }

    if (char === "/" && next === "/") {
      while (index < source.length && source[index] !== "\n") {
        index += 1;
      }
      continue;
    }

    if (char === "/" && next === "*") {
      index += 2;
      while (index < source.length && !(source[index] === "*" && source[index + 1] === "/")) {
        if (source[index] === "\n") {
          out += "\n";
        }
        index += 1;
      }
      index += 2;
      continue;
    }

    out += char;
    index += 1;
  }

  return out;
}

/** The 1-based line a character offset falls on. */
function lineOf(source, offset) {
  let line = 1;
  for (let index = 0; index < offset && index < source.length; index += 1) {
    if (source[index] === "\n") {
      line += 1;
    }
  }
  return line;
}

function main() {
  const files = engineSources().sort();
  const violations = [];

  for (const file of files) {
    const raw = readFileSync(file, "utf8");
    const clean = stripComments(raw);
    const shown = relative(repoRoot, file).split(sep).join("/");

    for (const rule of RULES) {
      // A fresh lastIndex per file: these regexes are shared and global.
      rule.test.lastIndex = 0;
      let match = rule.test.exec(clean);
      while (match !== null) {
        const captured = match[1] ?? match[0];
        if (!rule.check(captured)) {
          violations.push({
            file: shown,
            line: lineOf(clean, match.index),
            rule: rule.id,
            detail: rule.cite(captured),
          });
        }
        match = rule.test.exec(clean);
      }
    }
  }

  const line = "-".repeat(64);
  console.log("PAGEFAULT.DEV - engine purity gate");
  console.log(line);
  console.log(`scanned ${files.length} engine source files under engine/`);
  for (const rule of RULES) {
    console.log(`  rule ${rule.id.padEnd(22)} ${rule.why}`);
  }
  console.log(line);

  if (violations.length === 0) {
    console.log("PASS - engine/ is pure: relative imports only, no DOM, no clock,");
    console.log("       no entropy, no timers, no console, no UI assets.");
    return 0;
  }

  console.error(`FAIL - ${violations.length} purity violation(s):`);
  for (const violation of violations) {
    console.error(`  ${violation.file}:${violation.line}  [${violation.rule}] ${violation.detail}`);
  }
  return 1;
}

process.exit(main());
