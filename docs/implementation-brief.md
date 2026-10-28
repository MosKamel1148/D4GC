# FieldFind — scaffold-first implementation brief

## Start here

This is a build specification, not an implemented or tested application. Read `agents.md`, then `data.md`. Build the technical scaffold and one real retrieval flow before visual polish. In a Codex repository, rename `agents.md` to `AGENTS.md` so it is discovered as repository instructions. Do not maintain two divergent copies.

Paste into Bolt or Codex:

> Read readme.md, agents.md, and data.md. Implement Phase 0 first, then continue through the checkpoints. Build a working application, not a mock dashboard. Use supplied documents; report missing inputs. Preserve the shared data contract. Prove local search and source opening before adding offline storage. Report commands run, actual test results, and remaining limitations. Do not claim untested offline or accessibility support.

Upload the source documents separately: these three files do not contain the corpus. If Bolt cannot execute Python, run the preparation script on a teammate's computer and upload its generated pack into the project. Do not turn preprocessing into a cloud dependency.

## Purpose and boundaries

Four people have four hours to demonstrate accessible, low-cost, vendor-independent retrieval across a mixed humanitarian document collection. Users may have limited digital familiarity, low vision, one hand, or limited dexterity. Internet may disappear. Retrieve documents and traceable passages; do not generate medical advice.

Core outcome: enter a query, inspect a relevant excerpt, open its source, and repeat after closing/reopening the installed app in airplane mode.

## Phase 0: technical scaffold first (0–25 minutes)

Use React + TypeScript + Vite, MiniSearch, IndexedDB through `idb`, and a service worker through `vite-plugin-pwa`. Use Vitest for important pure logic and Playwright for the integrated browser flow if supported. Use Python with pypdf and BeautifulSoup for preprocessing; use Poppler locally if extraction needs a second check. Resolve compatible stable dependencies in the build environment and commit the lockfile. No backend, credentials, database service, LLM, vector database, or AWS account is required.

Create these modules before styling:

```text
fieldfind/
  AGENTS.md                   # renamed from agents.md
  readme.md
  data.md
  package.json
  package-lock.json
  index.html
  vite.config.ts
  tsconfig.json
  documents/                  # supplied originals, excluded from git by default
  scripts/ingest.py
  scripts/requirements.txt
  metadata/overrides.json
  public/packs/demo/
    manifest.json
    corpus.json
    sources/                  # PDFs and sanitized HTML originals
  src/
    main.tsx
    App.tsx
    types/corpus.ts
    data/validateCorpus.ts
    search/searchDocuments.ts
    search/search.worker.ts
    storage/packStore.ts
    offline/packManager.ts
    components/SearchScreen.tsx
    components/ResultsList.tsx
    components/DocumentReader.tsx
    components/OfflineStatus.tsx
    styles.css
  tests/
  evaluation/queries.json
  evaluation/results.md
```

Required scripts: `dev`, `build`, `preview`, `typecheck`, `test`, `test:e2e`. Implement them; do not document nonexistent commands as working. A typical initial setup is `npm create vite@latest . -- --template react-ts` in an empty project, followed by dependency installation. Adapt to an existing repository without overwriting it.

Define the data contract from data.md and storage/search interfaces first. Create a tiny clearly marked test fixture for unit tests only. The application must show an honest missing-pack state until real data is available, not invented clinical documents.

Gate: app starts, production build succeeds, TypeScript passes, corpus validation rejects malformed data, and module interfaces are in place.

## Phase 1: vertical slice (25–60 minutes)

Prepare the supplied sample. Load corpus, search locally, show grouped results and an exact excerpt, open the source. No network request per query. Main-thread indexing is acceptable for the first slice; move indexing/search into a Web Worker before scaling if measured responsiveness requires it. Preserve request IDs to discard stale worker results.

Gate: a real query finds a verified passage; source reference opens correctly. At 45 minutes integrate whatever is ready rather than building four isolated components.

## Phase 2: simple mobile experience (60–110 minutes)

Main screen: title “Find a document,” one large labeled search field, Medical guidance / Other documents / Saved shortcuts, language control, truthful offline status. Category shortcuts filter verified document types; they must not imply all medical research is guidance. Show three results initially, plus Show more. Put optional type/language/year controls behind Narrow results. Make active filters visible and easy to clear.

Results show title, document type, document language, known year, exact relevant excerpt, and a large Open document button. Reader offers readable extracted text, page/section reference, and View original. Preserve search and scroll on Back. Do not render untrusted HTML or use unsanitized innerHTML for highlights.

Use at least 56px primary touch targets as a project design target, generous spacing, 18px default body text, visible focus, strong contrast, semantic HTML, accessible labels, and polite result-count announcements. Support 200% text enlargement and a narrow phone layout without clipped controls. No required drag, swipe, pinch, hover, or long press. Place key actions within easy reach without hiding content behind fixed controls. Support keyboard/switch navigation and screen readers. Use `dir=auto` for mixed-language passages. External fonts/icons must not be needed at runtime.

Keep interface strings in dictionaries. English first; French and Bangla UI translations may be added with review status recorded. Arabic document rendering is required for the sample. Never confuse translated UI with translated source content. Voice input and speech output are stretch features, not prerequisites for accessibility.

## Phase 3: genuine offline operation (110–160 minutes)

Service worker caches the application shell; IndexedDB stores validated corpus and source blobs. Download the sample pack explicitly with progress and required bytes. Validate before activation. Request persistent storage where supported, handle refusal/quota errors, and retain the existing working pack on failure.

“Ready without internet” requires installed/cached shell, validated active corpus, and all required source files present. Connectivity status alone is insufficient. If only some documents are downloaded, state the exact count and each source's availability. Do not label missing originals available because extracted text exists.

Initial installation needs a reachable trusted HTTPS origin; ordinary HTTP on a laptop LAN IP does not enable a phone service worker. Use an authorized HTTPS host for setup. Then disconnect. Test the production build outside embedded preview frames, on the actual phone. Local Wi-Fi access and complete network disconnection are different scenarios.

PDF viewers vary on phones. Prefer a bundled PDF.js viewer with local worker/assets if time permits. Otherwise provide readable text plus download/open-original fallback, explicitly showing the PDF file page number; do not promise reliable native `#page=` navigation without testing. Tables must retain access to the original visual page.

## Phase 4: verify and present (160–240 minutes)

Freeze features by minute 210. Run 12 independently labeled queries: 4 direct, 4 paraphrases/acronyms, 2 ambiguous, 2 with no relevant source. Measure answerable-query hit@3 and precision@3 separately; report no-match behavior separately. Record real phone latency, corpus/index/source sizes, ingestion failures, and offline checks. Do not invent targets as achieved results.

Airplane test: download pack; close app; disable Wi-Fi/mobile data; reopen; run a new query; open a previously unviewed document. Test recovery from an interrupted pack download. Test a full application reload, not just an already-open screen.

Usability: give an unfamiliar tester tasks without coaching; test one-handed use, large text, Back behavior, and screen-reader navigation. Simulation is not proof of universal accessibility.

Four-person ownership:

1. Data: scripts/, metadata/, corpus and source pack.
2. Search: src/search/, query evaluation with person 4.
3. App/integration: src/components/, App, styling, shared types and package changes.
4. Offline/evaluation: src/storage/, src/offline/, service-worker configuration, phone tests and pitch. Coordinate dependency/config edits with person 3.

Five-minute pitch: 30s problem, 60s retrieval, 45s offline reopening, 30s update demo if implemented, 45s architecture, 45s measured results/cost, 25s limitations, 20s buffer. Keep a backup recording. Updates and contextual suggestions are stretch work after core gates pass.

## Cost, deployment, and maintenance

No cloud inference/API charge per local query; do not call the system free. Track preprocessing time, hosting/distribution, storage, and maintenance. Static output is portable. AWS can optionally host/distribute packs; no AWS-specific code in retrieval. Do not publicly publish supplied documents without authorization. No patient records, analytics, accounts, or remote logging in this demo. Source files remain outside git unless explicitly approved.

The demo is not production certified. Production questions include content governance, signed packs, device protection, validated multilingual retrieval, corpus scale, extraction QA, deployment to never-connected devices, and accessibility testing with intended users.
