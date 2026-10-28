# FieldFind — milestone 2

Local document search with original sources, a reusable folder index, browser persistence, offline app caching, role-aware ranking, and English/French/Arabic interface options. No cloud search API, document upload, authentication system or generated medical advice.

## Simplest local use

Install Node.js LTS (validated on Node 24.19.0). Download the `fieldfind-milestone-1` branch and extract it. The app identifies itself as **Build 0.2.0**.

1. Copy PDF/HTML originals, optional matching Markdown, and **one CSV** into the project's `documents/` folder. Subfolders are supported. CSV header: `id,genre,language`. Keep IDs as filenames, for example `P34.pdf` and `P34.md`. Extra CSV columns are preserved.
2. Open a terminal in the project root. First time only, run `npm install`.
3. Run `npm start`. Open the localhost address printed by the terminal (normally `http://127.0.0.1:4173`). Keep using exactly that address and browser.
4. Wait for **Available without internet** before disconnecting. This requires both verified saved sources and checked cached app assets. You can install the app through the browser's Install/Add to Home Screen menu where supported.

`npm start` prepares the folder, builds the production app, and starts a local preview. No Python is needed. Initial extraction takes real processing time; a full 764-document collection has not been benchmarked. Later starts reuse unchanged data without extracting PDFs again. In this workspace, an unchanged 11-document preparation check took about 0.95 seconds; this is not a general performance guarantee.

After adding/removing/changing files or editing the CSV, stop with Ctrl+C and run `npm start` again. Only affected documents are reprocessed; unchanged documents reuse cached text. The browser checks for a changed prepared-folder version. **Manage documents → Reload prepared folder** can also reload an already prepared version. `npm run prepare:library -- --force` verifies/rebuilds from the current inputs using the document cache. To invalidate extraction caches entirely, remove the generated `.fieldfind/cache/` directory, then prepare again.

An empty `documents/` folder keeps the last prepared library. Invalid CSV or a preparation failure leaves the previous valid pack intact. The CLI explains the failure; it does not silently delete a working collection. Documents with failed extraction are reported separately from CSV rows lacking originals.

## What is saved, and where

- **Your disk:** `documents/` retains the originals and CSV. `.fieldfind/` contains per-document extraction caches and the input stamp. `public/packs/demo/` contains the prepared corpus, safe HTML views, originals, manifest and report. Keep your originals as the durable backup.
- **IndexedDB:** the active corpus, metadata, stats, ingestion notes, exact original PDF/HTML bytes and safe viewer bytes are stored as browser blobs. Every source is verified before a single atomic activation transaction. A failed write or quota error keeps the prior saved collection. Restoration validates the corpus and stored blobs; opening a source checks its hash again.
- **Service worker:** caches the production app shell, scripts, local fonts/codecs, PDF worker, icon and language dictionaries. Original documents are saved separately in IndexedDB, not accidentally precached from the web-served pack.

Browser storage is scoped to the address and browser profile. Switching between localhost and 127.0.0.1, changing ports, private browsing, clearing site data or browser eviction can affect saved availability. Durable-storage permission is requested separately and refusal is reported honestly. **Available without internet** is a current verified state, not a promise that data can never be deleted. A browser storage failure leaves the current tab usable and reports that it is not saved.

`npm run dev` also prepares the folder and supports browser persistence, but does **not** install the production offline shell. Use `npm start` for offline demonstrations. A plain HTTP LAN address is not a secure context; phone installation needs trusted HTTPS. No public hosting or source publication is performed by these commands.

## Search and the interface

Search sits below a compact header. **Manage documents** contains file/folder import, CSV and extraction diagnostics, inventory, storage actions and report download. Result previews show four lines; **Read more** expands the exact source passage. Back preserves query, filters, scroll and focus. Active language/genre/occupation settings remain conspicuous and have a Clear filters action.

The collection summary reports these separately:

- CSV entries: all rows in the selected CSV, or bundled fallback catalog if no CSV was supplied.
- Matched documents: CSV IDs with originals in the selected/prepared folder, whether or not extraction succeeds.
- Indexed documents: actual readable originals in this collection, including uncatalogued files with unknown metadata.
- Missing sources: CSV entries without corresponding selected original files. This is not an extraction failure.
- Failed extraction: selected originals that could not produce searchable text.

The app never invents contents for catalog entries whose files were not supplied. Uncatalogued documents use stable local IDs and flagged unknown metadata. Exact source bytes, filenames and supplied CSV fields are retained. HTML language conflicts are flagged rather than overwriting CSV language. Markdown is preferred when present, with no guessed physical page references. PDF extraction without Markdown preserves physical page numbers; tables, multi-column reading order and sparse pages still require visual review. Image-only PDFs need local OCR or supplied Markdown.

Retrieval indexes passages, titles, headings and genres, then groups results by the best passage score. Common English question words are removed. Reviewed lexical expansions include TB/tuberculosis and annual/yearly. An annual-report query may return a catalogued financial report as a clearly labelled related match; it does not turn arbitrary pricing reports into annual reports. Longer questions may show related results only when sufficient meaningful terms overlap. Exact/all-term matches rank before partial related matches. Scores are ranking signals, never confidence or medical validity.

**Prioritise for** provides All occupations, Medical/clinical, Engineering/logistics and Coordination/reporting. Transparent metadata/title heuristics adjust ranking; they never hide other matching documents. These are preferences, not validated profession-specific classifications. Role relevance requires testing on a wider real corpus. The supplied sample does not include the financial-report originals listed in the older `data.md` sample; an annual-report source cannot appear until its actual file is added.

English, French and Arabic interface dictionaries are local and available offline. Arabic UI uses RTL. Source documents, CSV genres and source-language queries are **not** translated. Interface translations have not been professionally reviewed; diagnostic messages and source metadata may remain in English. There is no live translation API or cross-language semantic search.

## Preparation and validation commands

```sh
npm run prepare:library   # local Node folder preparation, incremental
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Tests requiring supplied originals explicitly skip when those private files are absent. Synthetic fixtures are labelled and used only for tests. Playwright uses system Chromium if present, or its managed browser; `PLAYWRIGHT_CHROMIUM_EXECUTABLE` can select one. The environment's browser-download policy blocked Playwright downloads, so installed Chromium was used.

The older `scripts/ingest.py` remains an alternative sample-only Python preprocessing route. It needs `scripts/requirements.txt`; it is not required by `npm start`. The Node folder workflow is the recommended route for all copied files and CSV updates.

Originals, generated packs and caches are ignored by Git. Only `documents/PUT-FILES-HERE.txt` is tracked there. A fresh GitHub checkout therefore needs your privately supplied documents. Static production builds contain prepared originals; configure appropriate access protection before deploying them. No patient data, analytics or remote logging is added.

See `evaluation/results.md` for actual verification, including offline close/reopen and limits. The full 764-document corpus, actual phone airplane-mode behavior, Safari and professional accessibility/translation review remain untested.
