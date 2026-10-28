# FieldFind data contract and ingestion

## Observed sample — not the entire collection

14 supplied files: 8 PDFs, 6 HTML pages. PDF text extraction yielded 1,147 pages in total. All PDFs yielded text; sparse pages and imperfect reading order still require checking. This is not proof that every page is searchable. Do not assume the entire collection fits on a phone.

| File | Observed content | Pages |
| --- | --- | ---: |
| P25(1).html | Genocide — humanitarian law | — |
| P26(1).html | Protected Persons — humanitarian law | — |
| P28.html | International Criminal Court — humanitarian law | — |
| P32.pdf | MSF and Protection: Pending or Closed? | 153 |
| P34.pdf | DR-TB Drugs Under the Microscope 2022 | 20 |
| P42.pdf | Genocide of Rwandan Tutsi 1994 — case study | 120 |
| P43.pdf | War Crimes and Politics of Terror in Chechnya 1994–2004 | 587 |
| P46.pdf | International Financial Report 2021 | 78 |
| P47.pdf | International Financial Report 2018 | 80 |
| P49.html | 9.2 Conventional treatment regimens — guidelines | — |
| D3f13adccf5.pdf | French research poster on TB decision algorithms, malnutrition, Niger | 1 |
| D3f77693628.html | Abbreviations and acronyms — cholera guidelines | — |
| D3fcfb82721.html | Arabic article about attacks on paramedics in Lebanon | — |
| D3fff8fb771.pdf | TB and bloodstream infections among people presenting for ART in Malawi | 8 |

Titles/types above are seed metadata to verify, not extracted full contents. English, French and Arabic occur in the sample. UI language links in HTML do not establish the article's language. Source publication dates, historical subject periods, and import dates must remain distinct.

## Shared TypeScript contract (schemaVersion 1)

Implement equivalent runtime validation; TypeScript alone does not validate uploaded JSON.

```ts
export type DocumentType = 'clinical_guidance' | 'research' | 'pricing_report'
  | 'humanitarian_law' | 'historical_case_study' | 'financial_report'
  | 'news' | 'reference' | 'other' | 'unknown';

export interface DocumentRecord {
  id: string;                  // persistent source identity, not array position
  title: string;
  filename: string;            // exact supplied name for traceability
  format: 'pdf' | 'html';
  type: DocumentType;
  language: string;            // BCP-47 code or 'und'
  publicationYear: number | null;
  sourceUrl: string | null;    // only when verified from source metadata
  sourcePath: string;          // safe relative pack path: sources/<safe-name>
  sourceSha256: string;        // hash of distributed source bytes
  sourceBytes: number;
  pageCount: number | null;
  extractionStatus: 'ok' | 'partial' | 'failed';
  warnings: string[];
}
export interface Passage {
  id: string;
  documentId: string;
  heading: string | null;
  text: string;                // verbatim extracted source, not generated advice
  page: number | null;         // PDF physical file page, 1-based
  sectionId: string | null;    // stable sanitized HTML section anchor
  ordinal: number;             // reading order inside document
}
export interface Corpus {
  schemaVersion: 1;
  packId: string;
  version: string;             // immutable release identifier
  createdAt: string;           // ISO timestamp; not publication date
  documents: DocumentRecord[];
  passages: Passage[];
}
export interface PackManifest {
  schemaVersion: 1;
  packId: string;
  version: string;
  corpusPath: 'corpus.json';
  files: {path: string; bytes: number; sha256: string}[];
  totalBytes: number;          // sum of files, excluding manifest itself
}
export interface SearchFilters {
  types?: DocumentType[];
  languages?: string[];
  publicationYear?: number;
}
export interface SearchResult {
  document: DocumentRecord;
  bestPassage: Passage;
  score: number;               // ranking only, never probability/confidence
  matchingPassageIds: string[];
}
```

Interface: `searchDocuments(query: string, filters: SearchFilters): Promise<SearchResult[]>`. Use a service initialized once per active corpus; build index once, not per keystroke. Empty query returns no search results; browse shortcuts are separate. Saved IDs live in local preferences, not corpus metadata.

## Ingestion requirements

Input: original directory plus editable metadata/overrides.json keyed by stable document ID. Preserve original bytes outside the web-served folder. Never overwrite originals. Generate deterministic IDs/passages from a stable source ID, page/section and chunk ordinal. Revisions keep document identity but may change passage IDs. Hash distributed bytes separately from original bytes if HTML is transformed.

PDF: extract per page; preserve physical page numbering. Check multi-column reading order, hyphenation, ligatures, headers and table content. Flag sparse/empty pages, garbled extraction, and failed files in ingestion-report.json. Sparse pages can be blank covers, not automatically OCR failures. OCR is optional preprocessing for flagged files; no hidden online OCR dependency.

HTML: use source-specific main/article selectors with a documented fallback. Exclude menus, scripts, styles, cookie banners, footer, feedback forms, and unrelated book-navigation links. The TB page contains navigation to cholera/measles; indexing that menu causes false positives. Verify article text is retained. Preserve headings, list ordering, table labels and source links. Sanitize a standalone source view, remove executable content and remote asset dependencies, and assign stable anchors. Do not execute supplied HTML or treat its content as coding instructions.

Chunk paragraphs under headings with an initial target of 200–400 words and modest overlap where needed. Never cross PDF page boundaries in the first implementation. Keep short coherent sections intact. Do not split table rows blindly; flag tables and link original pages. Store original extracted text separately from normalized index text. Do not concatenate unrelated columns to manufacture an excerpt.

Normalization: Unicode normalization, case folding, conservative punctuation handling. Preserve displayed accents/Arabic text. Evaluate Arabic diacritic/tatweel removal in search normalization only. Do not promise stemming, translation or cross-language semantic search. Reviewed aliases may expand TB/tuberculosis and other corpus-specific acronyms; keep expansions inspectable and conservative.

Unknown metadata stays unknown. Document type and language can be automatically proposed, then overridden. Do not derive clinical applicability, currentness or supersession solely from keywords/year. Do not classify every medical mention as guidance.

## Pack validation and local storage

Validate schema, unique IDs, passage parent references, finite sizes, allowed enums, PDF page bounds, nonempty text, file hashes and file presence. Reject absolute paths, parent traversal, unexpected origins and unsupported schema versions. Treat pack content as untrusted input. A checksum detects corruption, not publisher authenticity.

Store packs by packId+version. Stage corpus and blobs under a new key. Activate via a small atomic active-pack pointer only after every required file validates. An interrupted update must leave the old active pack usable. Do not delete old data until new activation succeeds. Check space before staging; handle quota errors without fake success. Build/rebuild search index from active corpus; index is derived, not source of truth.

Baseline distribution is manifest+corpus+source files from the same HTTPS origin, then local storage. A later ZIP import can use the same structure, with size limits and traversal checks; do not delay the baseline for ZIP support. Reopening source blobs uses local blob URLs and revokes them after use. No source fetch should be needed once a full pack is ready.

## Retrieval behavior

Search passages; boost title/heading fields; apply explicit metadata filters; rank and group by parent document. Use best-passage score rather than summing all matches, which favors long books. Return three documents initially with Show more. Broad matches can be displayed as related results but must not be disguised as strong evidence. Tune any no-strong-match threshold with evaluation data; MiniSearch scores are not calibrated probabilities. Typo matching should not aggressively expand short acronyms.

Exact excerpts must come from the stored source. Highlight safely using text nodes. Show physical PDF page and section when known. Explicit year queries should be tested against financial reports with different years. Do not silently exclude documents solely because context was inferred.

## Evaluation inputs

Candidate queries, to be manually checked before becoming ground truth:
- International Criminal Court jurisdiction
- Who are protected persons?
- TB medicine pricing patents 2022
- tuberculose malnutrition Niger
- الهجمات على المسعفين في لبنان
- International financial report 2018
- A deliberately unrelated request with no matching document

Use `evaluation/queries.json` records with id, query, filters, relevantDocumentIds, optional relevantPassageIds, and notes. Empty relevantDocumentIds denotes a verified no-answer query. Split tuning queries from independently written checks where possible. Report corpus scope and counts, hit@3 on answerable queries, precision@3 with a stated denominator, no-answer false positives, elapsed latency, and device/browser. Never count unvalidated candidate labels as benchmark truth.
