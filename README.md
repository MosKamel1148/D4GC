# FieldFind

First milestone: a React + TypeScript + Vite application using MiniSearch to find real source excerpts and open the supplied originals. No backend or cloud search API. PWA installation, service workers and offline storage are deliberately deferred.

## Quick local start (Windows, macOS or Linux)

Install Node.js LTS, download the **fieldfind-milestone-1** branch, extract it, and open a terminal in that folder:

```sh
npm install
npm run dev
```

Open the localhost address printed in the terminal (normally port 5173). Click **Choose sample files**. Select the original PDF/HTML attachments and matching Markdown together from your computer. You can select all 16 sample source/text files at once; other attachments are ignored and reported. The challenge PDF is not indexed. No Python, hosting account, token or upload is needed for this route.

For the full sample, select these originals:
`P25.html`, `P26.html`, `P27.html`, `P28.html`, `P32.pdf`, `P33.pdf`, `P34.pdf`, `Df98e297b5f.pdf`, `Dfa9c0c7a37.html`, `Df5738d956a.html`.
Also select these text versions:
`P28.md`, `P32.md`, `P33.md`, `P34.md`, `Df98e297b5f.md`, `Df5738d956a.md`.
Keep their supplied filenames. A smaller subset works too. Every PDF needs its matching Markdown for browser loading; otherwise the app explains which file is missing. Browser loading does not extract PDF text or infer page counts/references. The Python route below remains available for actual PDF extraction.

Files remain **only in memory in this browser tab**. Nothing is uploaded or persisted. Choose them again after refresh. This is milestone 1, not offline storage. Search and filters become available after validation. A failed selection leaves the previous collection usable. Missing packs, HTML fallback responses and malformed JSON show recovery instructions instead of a JSON syntax error.

Search for `protected persons`, `vaccine pricing`, `bedaquiline`, or `الكوليرا`. Search matches source-language words, not translations. Results are grouped by document, initially three cards, with exact excerpts. Open document provides a safe HTML view or original PDF plus exact original download. Back restores query, filters, results, scroll and focus. Filters apply to the last submitted query, even if you edit the input without submitting.

The sample pack is available in this managed workspace, but **is intentionally not in GitHub**. A fresh GitHub download uses the file chooser above. Do not remove `.gitignore` rules or publish source documents to fix a missing-pack message. Only sample metadata (IDs/genres/languages and separate title/type/year overrides) is bundled in Git. Local HTML sanitization uses DOMPurify and a sandboxed restrictive-CSP viewer; active content and images/remote resources are removed, while original bytes remain downloadable.

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
