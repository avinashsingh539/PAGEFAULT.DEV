/**
 * Shareable demo configuration through URL parameters.
 *
 * `?address=0x1345&access=read&pageSize=4096&tlb=4`
 *
 * This is presentation-level state only: it names the machine a fresh session starts
 * with and the address sitting in the input box. It never touches engine files, and
 * every value is validated before it is used - a hostile URL gets the defaults, not
 * an engine error.
 */

export interface LabUrlConfig {
  readonly addressText: string;
  readonly accessKind: "read" | "write";
  readonly pageSize: number;
  readonly tlbCapacity: number | null;
}

export const DEFAULT_URL_CONFIG: LabUrlConfig = {
  addressText: "0x1345",
  accessKind: "read",
  pageSize: 4096,
  tlbCapacity: 4,
};

/** The page sizes the settings bar offers. Validation stays with the engine. */
export const PAGE_SIZE_OPTIONS: readonly number[] = [1024, 2048, 4096, 8192, 16384];

export function readLabUrlConfig(): LabUrlConfig {
  const params = new URLSearchParams(window.location.search);

  return {
    addressText: readAddress(params.get("address")),
    accessKind: params.get("access") === "write" ? "write" : "read",
    pageSize: readPageSize(params.get("pageSize")),
    tlbCapacity: readTlb(params.get("tlb")),
  };
}

/** Write the config back to the URL without navigating or reloading. */
export function writeLabUrlConfig(config: LabUrlConfig): void {
  const params = new URLSearchParams();
  params.set("address", config.addressText);
  params.set("access", config.accessKind);
  params.set("pageSize", String(config.pageSize));
  params.set("tlb", config.tlbCapacity === null ? "none" : String(config.tlbCapacity));

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
  return Number.isSafeInteger(value) && value >= 1 && value <= 64 ? value : DEFAULT_URL_CONFIG.tlbCapacity;
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
