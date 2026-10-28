# First milestone verification

Executed 28 October 2026 in the managed Linux environment, Node 24.19.0, installed Chromium 154.0.8037.57. Desktop viewport: 1280×900. Phone emulation: 390×844 with touch/mobile flags. These are browser emulations, not physical-device results.

## Passed

- Local ingestion: 10 originals, 1,152 passages. Six Markdown text sources, four extracted HTML text sources. PDFs retain measured page counts; Markdown passages deliberately have no inferred page numbers. No files require PDF preprocessing to make this supplied sample searchable.
- `npm run typecheck`: passed.
- `npm run build`: passed. Production app JS approximately 255 kB before compression; generated sample pack approximately 9.63 MB, including corpus, sources, safe views and report. These are artifact sizes, not device performance measurements.
- `npm test`: 20 tests passed. Nine source-reviewed search checks return the expected document in the top three; filters, no-match and empty query behavior, unique grouping, original metadata, null Markdown page references, unsafe paths, dangling references, schema rejection, page bounds, and corruption checks pass. All manifest files pass checksum verification.
- `npm run test:e2e`: 10 tests passed against the production preview, five scenarios each on desktop and phone emulation. Real HTML excerpt → safe original view → Back, source content in iframe, PDF original hash, Arabic language/direction, filters, no-match, root text size doubled without page overflow, keyboard Enter, first-three results and Show more, corrupt-pack error and disabled search all passed.
- Browser request observation confirms zero requests when submitting a query after initial pack load. Source opening verifies local pack files and opens local blob URLs.
- Visual inspection of desktop home and phone-sized results completed. Icons are inline SVG; no external fonts/assets required by the application shell.

## Scope and limitations

The search checks are regression cases selected after source inspection, not an independent 12-query benchmark. No hit-rate, precision, phone latency or accessibility certification is claimed. MiniSearch scores are ranking scores, not confidence. Retrieval is lexical and same-language; longer questions/paraphrases may need fewer words. Queries require all words in the same indexed passage/title/heading.

The older 14-file sample table in data.md differs from the uploads. Only the supplied 10 document IDs are indexed. CSV IDs, genres and language values are preserved; normalized types and manually verified titles/years are separate. Unknown dates remain null. The challenge PDF is excluded from search.

PDF/Markdown reading order, multi-column layout and table extraction need visual QA. Tables and images should be consulted in originals. Safe HTML views retain table markup and remove active content and remote resources; external pictures are not available unless embedded in the supplied bytes. The exact original HTML remains downloadable.

PWA installation, service worker caching, IndexedDB and offline pack activation are intentionally absent. No airplane-mode/reopen claims. Static-host access is needed for initial loading and source opening. Web Crypto integrity validation requires localhost or HTTPS. Original documents and generated packs are ignored by Git and must be privately supplied on a fresh checkout.

Not tested: physical phone, Safari/Firefox, screen readers/switch devices, native mobile PDF page navigation, offline reopening, network-interrupted offline pack updates. PDF byte downloads and links were verified, not universal native viewer behavior. No deployment or source publication performed.

Playwright's browser download was denied by network policy. Existing system Chromium was used successfully. Initial browser tests had accessible-name selector errors in the tests (decorative arrows are hidden); those were corrected, and the final complete run passed.

## Milestone 1 local-download repair

The original local-start instructions were incomplete: GitHub excludes `public/packs/`, and Vite's HTML fallback for missing manifest JSON caused `Unexpected token '<'`. Search was disabled because no corpus loaded; the language/genre controls had no metadata to populate. This was a real distribution bug, despite passing tests in the prepared workspace.

The repaired app handles missing/HTML/malformed JSON responses with recovery instructions and offers **Choose sample files**. Local PDFs use supplied Markdown; browser loading does not extract PDF pages. HTML is sanitized with DOMPurify before source-body extraction and sandboxed display. CSV sample metadata is bundled separately from document content. Declared HTML language discrepancies are flagged without overwriting CSV language. Originals remain exact byte downloads. No source content was added to Git.

Verification: type check and production build passed; 23 unit tests passed with the prepared sample; 18 desktop/phone-emulated browser tests passed, including missing-pack recovery, local 10-document import, both filters, original opening, invalid replacement preserving the loaded sample, required PDF/Markdown pairing, orphan/duplicate rejection, and passive HTML/metadata discrepancy checks. The tests observed no requests during local file loading, searching, filtering and original viewing after startup.

A separate clean copy containing only Git-tracked files (no documents or generated pack) built successfully. Its unit tests passed 11 checks and explicitly skipped 12 real-corpus checks. Its production preview was exercised in phone-sized Chromium: initial missing-pack state, selection of the actual sample, search, language filtering and original HTML opening all passed. The clean copy reused installed dependencies; a fresh package download on Windows was not tested.

File selection is memory-only. Refresh clears it; no PWA or offline storage has been added. PDF text extraction still requires Python for originals without supplied Markdown. User-visible instructions now distinguish prepared-workspace execution from a fresh GitHub download.

## Folder loading and original-PDF repair (build 0.1.2)

Browser selection previously rejected the entire collection when one PDF lacked Markdown and required exact filenames. These were real loader limitations. PDF.js now extracts original PDF text locally per physical page; Markdown still wins when supplied. Original byte hashes are retained across worker transfers. All PDF.js workers, character maps, standard fonts, codecs and licenses are copied locally by predev/prebuild/prepreview. Image-only or invalid PDFs are reported, never replaced with invented text. Download suffixes and case variants are recognized, preserving original filenames. Per-document failures leave other readable documents usable.

Choose document folder uses native directory selection. The ten-document browser restriction is removed: the full CSV catalog supplies metadata for matching IDs, and other PDF/HTML originals use flagged unknown metadata and stable IDs. Generic HTML extraction is explicitly flagged for review. Limits are displayed in documentation; full 764-document performance is untested.

The file picker is available even while the default pack request is pending. A stale startup request cannot overwrite a local selection; requests time out, the query box can accept typing before loading completes, and development startup fails clearly on an occupied port. The UI shows build 0.1.2.

Type checks, production build and 23 unit tests passed. 26 browser checks passed on desktop/phone-sized Chromium: new cases cover original PDF extraction without Markdown, genuine page count, exact original hash after worker extraction, filename variants, partial failure, startup-request races, documents beyond the sample, and uncatalogued metadata. Native phone and the full 764-file collection remain untested. Persistence and offline app installation remain pending.

## Milestone 2 — folder cache, persistence, offline shell, simpler UI

The previous version held selected originals only in memory and had no production service worker. This implementation stores corpus/metadata/report/statistics and original/safe-view bytes as IndexedDB blobs, validates before atomic activation, and checks stored sources again on restore/open. The production worker precaches the shell, local PDF worker/fonts/codecs, icon and UI dictionaries. Cache presence is checked before displaying offline availability; originals must also be verified and saved. Refused durable storage and quota errors are reported without claiming success.

The Node-only preparation command reads copied files plus one CSV from documents/. Source bytes, Markdown and each relevant CSV row determine per-document reuse; an unchanged input stamp skips extraction entirely. Changed documents/rows rebuild affected records. CSV errors preserve the previous prepared pack. Supplied CSV extras are preserved. CLI regression checks cover reuse, partial changes, CSV updates and failed CSV recovery. An unchanged preparation check for the current 11-document folder took approximately 0.95 seconds in this Linux environment; first full-corpus ingestion is unmeasured. The folder contains the 10 initial sample originals plus the challenge PDF, deliberately included by folder selection and labelled uncatalogued.

The UI puts search directly below a compact header; Manage documents holds importing, indexing/storage diagnostics, CSV/matched/indexed/missing/failed counts and the inventory. Four-line source previews have accessible expansion controls. Active filters and Clear filters remain visible. Technical source metadata is expandable. English/French/Arabic interface choices are local, with RTL tested; sources are never translated. These translations have not been professionally reviewed.

Search now includes genre metadata, ignores common question words, uses conservative reviewed acronym/yearly expansions and labels partial/financial-report matches as related. Medical, engineering/logistics and coordination preferences change ranking without excluding other matches. Synthetic tests verify annual-report retrieval with explicit financial metadata and occupation priorities. These are regression tests, not validated professional recommendations or an independent precision benchmark. The real sample contains no supplied financial-report original; the app cannot retrieve missing source contents.

Verification before final handoff: production build and typecheck passed; 32 unit/integration tests passed. Browser tests passed on desktop Chromium and 390×844 phone emulation, including custom CSV persistence, quota recovery, excerpt expansion, occupation preferences, French/Arabic UI and RTL/narrow layout. The required offline test is: select originals and CSV, run an initial query and open its HTML source, wait for checked shell and saved sources, close page, set the browser context fully offline, open a new page in the same context, run a different query, then open the previously unviewed original PDF from IndexedDB. Browser offline emulation blocks network access; it is not an actual-phone hardware airplane-mode test. The strict final run and exact counts are reported in the handoff.

Remaining limits: no physical-phone/Safari/screen-reader certification, no full 764-document performance result, no OCR, no cross-language document retrieval or source translation. Browser data can be cleared/evicted; sources should be retained on disk. Development mode deliberately does not install the production offline shell. App installation depends on browser support; no public deployment was performed.

Final milestone-2 result: **32 unit/integration tests and 34 browser tests passed**. The offline suite also closed the entire Chromium process and relaunched a persistent browser profile with networking disabled; a different query retrieved and opened the previously unviewed original PDF. This passed in desktop and phone-sized configurations. The production build, TypeScript checks (including the ingestion script), and the exact `npm start` workflow passed. Physical phone airplane mode remains untested.
