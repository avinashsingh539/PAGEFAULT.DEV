/**
 * Shareable demo configuration through URL parameters.
 *
 * Learn Mode:      `?mode=learn&step=4`
 * Experiment Mode: `?mode=experiment&address=0x1345&access=read&pageSize=4096&tlb=4&frames=16&algo=FIFO`
 * Compare Mode:    `?mode=compare&ref=7%200%201%202&frames=3`
 *
 * `/lab/learn?...`, `/lab/experiment?...` and `/lab/compare?...` are accepted too: when the
 * last path segment names a mode it is used, so the URLs written down in the docs work
 * whether or not the static server is configured to rewrite them.
 *
 * This is presentation-level state only: it names the machine a fresh session starts
 * with, which screen to open and what sits in the input boxes. It never touches engine
 * files, and every value is validated before it is used - a hostile URL gets the
 * defaults, not an engine error, and never a `NaN`.
 */

import { CLASSIC_REFERENCE_STRING } from "../../../engine";
import type { ReplacementAlgorithm } from "../../../engine";
import { DEFAULT_EXPERIMENT_CONFIG } from "./experiment";
import { parseReferenceString } from "./fields";
import { FIRST_STEP_INDEX } from "./lesson";

/** The screens the app has. One URL parameter selects between them. */
export type LabMode = "learn" | "experiment" | "compare";

/** The modes this build understands, in menu order: the lesson comes first. */
export const LAB_MODES: readonly LabMode[] = ["learn", "experiment", "compare"];

export interface LabUrlConfig {
  readonly mode: LabMode;
  /** The address sitting in the Experiment screen's input box. */
  readonly addressText: string;
  readonly accessKind: "read" | "write";
  readonly pageSize: number;
  readonly tlbCapacity: number | null;
  /** Frames used by the replacement experiment and by Compare Mode. */
  readonly frameCount: number;
  /** Algorithm selected in the Experiment screen's replacement panel. */
  readonly algorithm: ReplacementAlgorithm;
  /** The reference string Compare Mode starts with, as text. */
  readonly referenceText: string;
  /**
   * The Learn Mode lesson step to open on, zero-based.
   *
   * It is kept here rather than in the Learn screen so a lesson step is a shareable
   * link: `?mode=learn&step=4` opens the TLB explanation. It is CLAMPED onto the lesson
   * by `clampStepIndex`, so a hostile number cannot index past the end.
   */
  readonly step: number;
}

/** The frame count each screen opens with, when the URL does not say. */
export const DEFAULT_EXPERIMENT_FRAME_COUNT = DEFAULT_EXPERIMENT_CONFIG.frameCount;
export const DEFAULT_COMPARE_FRAME_COUNT = 3;

export const DEFAULT_URL_CONFIG: LabUrlConfig = {
  mode: "experiment",
  addressText: "0x1345",
  accessKind: "read",
  pageSize: 4096,
  tlbCapacity: 4,
  frameCount: DEFAULT_EXPERIMENT_FRAME_COUNT,
  algorithm: "FIFO",
  referenceText: CLASSIC_REFERENCE_STRING.join(" "),
  step: FIRST_STEP_INDEX,
};

/** The page sizes the settings bar offers. Validation stays with the engine. */
export const PAGE_SIZE_OPTIONS: readonly number[] = [1024, 2048, 4096, 8192, 16384];

/** The largest frame count a URL may ask for, so a link cannot demand a huge run. */
export const MAX_URL_FRAME_COUNT = 1024;

/** The largest TLB capacity a URL may ask for. */
export const MAX_URL_TLB_CAPACITY = 64;

export function readLabUrlConfig(): LabUrlConfig {
  const params = new URLSearchParams(window.location.search);
  const mode = readMode(params, window.location.pathname);

  return {
    mode,
    addressText: readAddress(params.get("address")),
    accessKind: params.get("access") === "write" ? "write" : "read",
    pageSize: readPageSize(params.get("pageSize")),
    tlbCapacity: readTlb(params.get("tlb")),
    frameCount: readFrameCount(params.get("frames"), mode),
    algorithm: readAlgorithm(params.get("algo")),
    referenceText: readReference(params.get("ref")),
    step: readStep(params.get("step")),
  };
}

/**
 * Write the config back to the URL without navigating or reloading.
 *
 * Only the parameters the current screen actually uses are written, so a shared link
 * says what it means: an Experiment link carries a machine, a Compare link carries a
 * reference string and a frame count, and a Learn link carries the lesson step.
 */
export function writeLabUrlConfig(config: LabUrlConfig): void {
  const params = new URLSearchParams();
  params.set("mode", config.mode);

  if (config.mode === "compare") {
    params.set("ref", config.referenceText);
    params.set("frames", String(config.frameCount));
  } else if (config.mode === "learn") {
    // A lesson link is a lesson step: the machine the lesson runs on is part of the
    // lesson, not something the learner configured.
    params.set("step", String(config.step));
  } else {
    params.set("address", config.addressText);
    params.set("access", config.accessKind);
    params.set("pageSize", String(config.pageSize));
    params.set("tlb", config.tlbCapacity === null ? "none" : String(config.tlbCapacity));
    params.set("frames", String(config.frameCount));
    params.set("algo", config.algorithm);
  }

  const url = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState(null, "", url);
}

function readAddress(raw: string | null): string {
  if (raw === null || raw.trim() === "") {
    return DEFAULT_URL_CONFIG.addressText;
  }
  return parseAddressText(raw) === null ? DEFAULT_URL_CONFIG.addressText : raw.trim();
}

function readPageSize(raw: string | null): number {
  const value = raw === null ? Number.NaN : Number(raw);
  return PAGE_SIZE_OPTIONS.some((option) => option === value) ? value : DEFAULT_URL_CONFIG.pageSize;
}

function readTlb(raw: string | null): number | null {
  if (raw === null || raw === "") {
    return DEFAULT_URL_CONFIG.tlbCapacity;
  }
  if (raw === "none") {
    return null;
  }
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= 1 && value <= MAX_URL_TLB_CAPACITY
    ? value
    : DEFAULT_URL_CONFIG.tlbCapacity;
}

/**
 * Read the frame count, falling back to the default of the screen being opened.
 *
 * The two screens default differently on purpose: the Experiment screen opens on a
 * roomy machine (16 frames, so most of the frame grid is visibly free), while Compare
 * Mode opens on the textbook 3-frame exercise whose fault counts are published.
 */
function readFrameCount(raw: string | null, mode: LabMode): number {
  const fallback = mode === "compare" ? DEFAULT_COMPARE_FRAME_COUNT : DEFAULT_EXPERIMENT_FRAME_COUNT;
  const value = raw === null ? Number.NaN : Number(raw);

  return Number.isSafeInteger(value) && value >= 1 && value <= MAX_URL_FRAME_COUNT ? value : fallback;
}

function readAlgorithm(raw: string | null): ReplacementAlgorithm {
  return raw === "FIFO" || raw === "LRU" || raw === "OPTIMAL" ? raw : DEFAULT_URL_CONFIG.algorithm;
}

/** A reference string that does not parse falls back to the documented default. */
function readReference(raw: string | null): string {
  if (raw === null || raw.trim() === "") {
    return DEFAULT_URL_CONFIG.referenceText;
  }
  const parsed = parseReferenceString(raw);
  return parsed.ok ? raw.trim() : DEFAULT_URL_CONFIG.referenceText;
}

/**
 * The lesson step to open on.
 *
 * Only a non-negative integer is accepted, and it is clamped onto the lesson by
 * `clampStepIndex` in the Learn screen - so `?step=9999` opens the last step and
 * `?step=banana` opens the first, and neither can index past the end of the lesson.
 */
function readStep(raw: string | null): number {
  if (raw === null || raw.trim() === "") {
    return DEFAULT_URL_CONFIG.step;
  }
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= 0 ? value : DEFAULT_URL_CONFIG.step;
}

/**
 * The mode to open: the `mode` parameter wins, then a `/lab/<mode>` path segment.
 *
 * Anything else - including a missing path, a deeper path, or a value that names no
 * mode - opens the Experiment screen. A malformed URL is not an error page; it is a
 * link that lost its parameters.
 */
function readMode(params: URLSearchParams, pathname: string): LabMode {
  const fromQuery = params.get("mode");
  if (fromQuery !== null && isLabMode(fromQuery)) {
    return fromQuery;
  }

  const segments = pathname.split("/").filter((segment) => segment !== "");
  const last = segments[segments.length - 1];
  if (last !== undefined && isLabMode(last)) {
    return last;
  }

  return DEFAULT_URL_CONFIG.mode;
}

/** True when the text names a screen this build has. */
export function isLabMode(value: string): value is LabMode {
  return (LAB_MODES as readonly string[]).includes(value);
}

/**
 * Accept decimal ("74565") or hex ("0x12345", case-insensitive, optional `0x`
 * prefix is REQUIRED for hex). Returns the address, or `null` when the text is not
 * a non-negative integer. Parsing text is UI work; validating it belongs to the
 * engine, which `step()` still does on every access.
 */
export function parseAddressText(text: string): number | null {
  const trimmed = text.trim().toLowerCase();
  if (trimmed === "") {
    return null;
  }
  if (trimmed.startsWith("0x")) {
    const digits = trimmed.slice(2);
    if (digits === "" || !/^[0-9a-f]+$/.test(digits)) {
      return null;
    }
    const value = Number.parseInt(digits, 16);
    return Number.isSafeInteger(value) ? value : null;
  }
  if (!/^[0-9]+$/.test(trimmed)) {
    return null;
  }
  const value = Number(trimmed);
  return Number.isSafeInteger(value) ? value : null;
}
