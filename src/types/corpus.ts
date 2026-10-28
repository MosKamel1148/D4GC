export const documentTypes = ['clinical_guidance','research','pricing_report','humanitarian_law','historical_case_study','financial_report','news','reference','other','unknown'] as const;
export type DocumentType = typeof documentTypes[number];
export interface DocumentRecord {
  id: string; title: string; filename: string; format: 'pdf'|'html'; type: DocumentType;
  language: string; genre: string; suppliedMetadata: {id:string; genre:string; language:string; [key:string]:string};
  publicationYear: number|null; sourceUrl: string|null; sourcePath: string;
  sourceSha256: string; sourceBytes: number; pageCount: number|null;
  extractionStatus: 'ok'|'partial'|'failed'; warnings: string[];
  textSource: string; viewerPath: string|null;
}
export interface Passage { id:string; documentId:string; heading:string|null; text:string; page:number|null; sectionId:string|null; ordinal:number }
export interface Corpus { schemaVersion:1; packId:string; version:string; createdAt:string; documents:DocumentRecord[]; passages:Passage[] }
export interface PackManifest { schemaVersion:1; packId:string; version:string; corpusPath:'corpus.json'; files:{path:string; bytes:number; sha256:string}[]; totalBytes:number }
export interface SearchFilters { types?:DocumentType[]; languages?:string[]; publicationYear?:number }
export interface SearchResult { matchType?:'all_terms'|'related'; document:DocumentRecord; bestPassage:Passage; score:number; matchingPassageIds:string[] }
