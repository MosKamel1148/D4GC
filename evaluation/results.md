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
