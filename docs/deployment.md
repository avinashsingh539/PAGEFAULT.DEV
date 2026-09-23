# Deployment

**Status: not deployed.** No hosting account or credential is configured for this
repository, and none is required to build or run it. This document is the recipe for
whoever deploys it, written so the deployment is reproducible rather than remembered.

The application is **frontend-only**. There is no backend, no database, no
authentication, no server-side rendering and no runtime configuration: the whole
product is static assets plus a pure TypeScript engine that runs in the browser.

## What gets deployed

| | |
| --- | --- |
| Build command | `npm ci && npm run build` |
| Output directory | `dist/` - at the **repository root**, not `ui/dist` |
| Runtime requirements | a static file server that can serve an SPA fallback |
| Environment variables | none |
| Secrets | none |

### Why the output directory is `dist/` and not `ui/dist`

`vite.config.mts` sets `root: "ui"` and `build.outDir: "../dist"`. Vite resolves
`outDir` relative to `root`, so `"../dist"` lands at the repository root. Anyone
wiring a host to this repository needs to know that, because the sensible guess
(`ui/dist`) is wrong.

## The one hosting requirement that is not optional

The app reads its state from the URL, and **path-based deep links are part of the
product**:

```
/lab/learn?step=4
/lab/experiment?pageSize=4096&tlb=4&frames=16&algo=FIFO
/lab/compare?ref=7%200%201%202&frames=3
```

`ui/src/lib/url.ts` resolves the screen from the last path segment when the `mode`
query parameter is absent. On a host with no rewrite rule, requesting
`/lab/experiment?...` directly asks the server for a file called `lab/experiment`,
which does not exist, and the visitor gets a **404 instead of the lab**.

The query-string form (`/?mode=learn&step=4`) has no such problem, because it always
requests `/`. Both forms are supported by the app; only the path form needs host
configuration.

So the host must either:

1. **Rewrite every unmatched path to `/index.html`** (a "SPA fallback"), or
2. serve a copy of `index.html` as the 404 document, which achieves the same thing.

### How each platform does it

| Platform | Configuration |
| --- | --- |
| Netlify | a file at `ui/public/_redirects` containing `/*  /index.html  200` |
| Cloudflare Pages | the same `_redirects` file, or a `404.html` copy of `index.html` |
| Vercel | `vercel.json` with `{"rewrites":[{"source":"/(.*)","destination":"/index.html"}]}` |
| GitHub Pages | no rewrite support: ship `dist/index.html` again as `dist/404.html` |
| Any static host + CDN | a fallback/origin rule mapping 404 to `/index.html` |

Vite copies everything in the Vite `root`'s `public/` directory - which is
`ui/public/` here, because `root: "ui"` - into `dist/` unchanged. That is where a
`_redirects` file belongs if one is added.

**Note:** none of these files are in the repository today, because deployment is out
of scope for this phase. Adding one is safe: it only affects the host that reads it.

## Reproducing a deployment

```bash
npm ci                  # lockfile-exact dependencies
npm run check:purity    # the engine is still engine-shaped
npm run typecheck       # three passes, one of which proves the engine is DOM-free
npm test                # unit and integration suites
npm run build           # type-check the UI, emit dist/
npm run preview         # serve dist/ locally on 127.0.0.1:4173
```

Then point the host at the repository, or upload the contents of `dist/`.

`npm run preview` is the closest local approximation of production: it serves the
same `dist/` output that would be uploaded, which is also what the Playwright suite
runs against. It does **not** implement the SPA fallback, so a direct
`/lab/experiment` request against `preview` will 404 even when everything else works.
Use `/?mode=experiment` when checking `preview` by hand, or configure the fallback in
whichever host you are testing.

## Verifying a deployment

Run these against the real URL. Every one is a claim about visible behaviour.

```bash
# 1. The default screen loads and is not a blank page.
curl -sSf https://<host>/ | grep -q '<div id="root">'

# 2. A deep path does not 404. This is the check that catches a missing fallback.
curl -sS -o /dev/null -w '%{http_code}\n' 'https://<host>/lab/experiment?frames=16'

# 3. A lesson step link resolves.
curl -sS -o /dev/null -w '%{http_code}\n' 'https://<host>/lab/learn?step=4'
```

`200` on checks 2 and 3 means the fallback is configured. `404` means the host is
answering only literal file paths.

Then, in a browser against the deployed URL:

| Check | Expected |
| --- | --- |
| Learn opens, Next advances | one engine step explained at a time, URL gains `step=` |
| Learn reaches the TLB miss | `TLB_MISS` visible, page table follows |
| Learn second access | `TLB_HIT`, page-table walk visibly skipped |
| Learn absent page | `PAGE_FAULT`, and **no** frame, physical address or RAM access after it |
| A copied `/lab/learn?step=4` link | opens on that step, not step 1 |
| Experiment: access `0x1345` | TLB miss, page table hit, physical address `0x7345` |
| Experiment: the same address again | TLB hit, no page-table lookup |
| Experiment: clear TLB, unmap a page, reset | each changes the display and none crashes |
| Experiment: type `banana` as an address | an inline message, not a blank screen or `NaN` |
| Compare: textbook string, 3 frames | FIFO **15**, LRU **12**, Optimal **9** faults |
| Compare: paste garbage into the reference string | an inline message, not a crash |
| `/?pageSize=banana&frames=-10&algo=INVALID` | the default lab opens; no `NaN` anywhere |

The last rows are also covered automatically by `e2e/hardening.spec.ts` against the
built bundle, and the URL rules behind them by `tests/ui/urlParams.test.ts`.

## What must not be deployed

`.gitignore` excludes `node_modules/`, `dist/`, `.engine-build/`, `coverage/`,
`test-results/`, `playwright-report/`, `*.log` and `.env*`. Only `dist/` is a build
artefact worth uploading; the rest are local. There are no secrets in this repository
and no `.env` file is read at runtime.

## Dependencies and advisories

`npm audit` reports **5 advisories**: 1 critical, 1 high, 3 moderate.

| Package | Severity | Direct? | Advisory | Fixed in |
| --- | --- | --- | --- | --- |
| `vitest` | critical | yes (dev) | arbitrary file read and execution when the Vitest UI server is listening; path traversal via `@vitest/mocker` | `vitest@5` (major) |
| `vite` | high | yes (dev) | path traversal in optimized-deps `.map` handling; `server.fs.deny` bypass on Windows; `launch-editor` NTLMv2 hash disclosure via UNC path on Windows | `vite@8` (major) |
| `@vitest/mocker` | moderate | no | path traversal / arbitrary file read via a redirect mock | `vitest@5` (major) |
| `vite-node` | moderate | no | depends on a vulnerable `vite` | `vitest@5` (major) |
| `esbuild` | moderate | no | the dev server lets any website send requests and read the response | `vite@8` (major) |

### Why these are documented instead of force-fixed

Every fix npm offers is a **semver-major upgrade** - `vite` 5 to 8, `vitest` 2 to 5 - and
a cleaner audit report is not a good enough reason to take a breaking toolchain upgrade.
The advisories are also all about servers this project does not deploy: the Vite dev
server, the Vitest UI server, and esbuild's dev-server proxy. In production there is no
server at all, only static files.

### Why that claim is checked rather than asserted

The production bundle is three files, and none of the vulnerable package names appear in
them:

```
$ ls dist/assets
index-3ail5hVU.js  index-CFPU_p_z.css

esbuild: absent
vitest: absent
vite-node: absent
@vitest/mocker: absent
vite: absent
```

`vite`, `vitest` and `esbuild` are in `devDependencies`. They run on a developer machine
or a CI runner and are not present in `dist/`.

### What would change this answer

If a backend, a server-rendered build, or any runtime Node process is added, these
advisories stop being dev-only, and the upgrade becomes mandatory rather than optional.
That is the condition to watch.
