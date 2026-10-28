# FieldFind

First milestone: a React + TypeScript + Vite application using MiniSearch to find real source excerpts and open the supplied originals. No backend or cloud search API. PWA installation, service workers and offline storage are deliberately deferred.

## Run in this workspace

The sample is already prepared in `public/packs/demo/` (10 documents, 1,152 passages). All original attachments are retained in ignored `documents/`. The challenge PDF is project context and is not indexed.

```sh
cd /workspace/D4GC
npm run dev
```

Search for `protected persons`, `vaccine pricing`, `bedaquiline`, or `الكوليرا`. Submit with Enter or Search. Results are grouped by document, initially three cards, with exact excerpts. Open document shows the matching passage, source warnings, a PDF or sandboxed HTML view, and an exact original download. Back restores query, filters, results, scroll and the originating button's focus.

Local search uses same-language word matching, Unicode normalization and conservative prefix matching. Multiple query words must match the same passage (including its title/heading). No translation, semantic inference, stemming or confidence scores. Search does not fetch anything per query after initial pack loading. Opening a source fetches its local pack file and verifies its bytes.

## Reproduce preparation

Use Node 24 (validated with 24.19.0), npm and Python 3. The npm lockfile pins the tested dependency graph.

```sh
npm ci
python -m venv .venv
.venv/bin/python -m pip install -r scripts/requirements.txt
.venv/bin/python scripts/ingest.py
npm run typecheck
npm test
npm run build
npm run test:e2e
```

On this machine the Python tooling is installed at `/workspace/fieldfind-tools`; `/workspace/fieldfind-tools/bin/python scripts/ingest.py` was executed successfully. For `npm run ingest`, activate the venv first. Playwright uses `/usr/bin/chromium` when installed, or its usual managed browser; `PLAYWRIGHT_CHROMIUM_EXECUTABLE` can select an installed Chromium. On a machine without Chromium, run `npx playwright install chromium` first. Browser downloads are currently denied by this environment's network policy; the installed Chromium worked.

Use localhost or trusted HTTPS: checksum verification requires Web Crypto. A plain HTTP LAN IP is not a secure context. There is no public deployment and no phone offline-readiness claim.

Original sources and generated packs are **excluded from Git** to respect the supplied guidance. A fresh checkout therefore needs the supplied files before ingestion/tests. Do not commit or publicly distribute them without authorization. Keep them in the environment snapshot or distribute privately. Static builds include the generated sample files.

## Data preparation and traceability

- `metadata/documentation.csv` is preserved unchanged, including all catalog rows. Only the 10 explicit sample IDs in `scripts/ingest.py` are ingested. ID, genre and language come from the CSV; normalized type is a separate field. Override titles/years in `metadata/overrides.json` without altering supplied CSV metadata.
- PDF/HTML and its Markdown count as one document. Six supplied Markdown files provide searchable text; the remaining four HTML files use reviewed article selectors. Every supplied original remains byte-for-byte intact. No additional documents or clinical text are invented.
- Markdown text has no verified physical-page mapping in this release. All its passage page references are null, even if prose contains page numbers. PDF page counts are read from the original. The PDF fallback extractor preserves physical pages if used on a future original without Markdown; validate reading order and sparse-page warnings before relying on it.
- HTML extraction selects the legal dictionary's article body or MSF's article text blocks, excluding navigation. Safe views use an allowlist, sandbox and restrictive CSP. Tables and embedded raster data images remain; external images/scripts/links are removed. Exact original HTML is distributed as `.html.txt`, then offered as a `.html` download to avoid executing it in the application origin. Original HTML may depend on external assets that were not supplied.
- The old observed sample in `data.md` is different from these attachments. The pack's `ingestion-report.json` records that discrepancy, each document's preserved metadata, source hashes, page count, text source and warnings. Unknown dates remain unknown. Medical pricing/research/news are not labeled clinical guidance.
- Ingestion runs locally and emits versioned `corpus.json`, a checksummed `manifest.json`, source files, and an ingestion report. Runtime validation checks schema, identities, enums, references, page bounds, safe paths, sizes and checksums. Checksums detect corruption; they do not establish publisher authenticity.

## Project map

`src/types/corpus.ts` is the shared contract; `src/data/` loads and validates the pack; `src/search/` builds one reusable passage index and groups results by best passage score; `src/components/` contains results and reader UI. `scripts/ingest.py` prepares only the sample. `docs/implementation-brief.md`, `AGENTS.md` and `data.md` retain the supplied guidance, subject to the user's milestone amendments.

No IndexedDB, service worker, voice input, translation, chat, authentication or remote analytics is implemented. The app requires its static host for initial loading and opening uncached sources. Search does not make cloud API calls.

See `evaluation/results.md` for verification scope and limitations.
