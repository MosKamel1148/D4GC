import { documentTypes, type Corpus, type PackManifest } from '../types/corpus';
const record = (v:unknown): v is Record<string,unknown> => typeof v==='object' && v!==null && !Array.isArray(v);
const str = (v:unknown): v is string => typeof v==='string' && v.trim().length>0;
const uint = (v:unknown): v is number => Number.isSafeInteger(v) && Number(v)>=0;
const hash = (v:unknown) => typeof v==='string' && /^[a-f0-9]{64}$/.test(v);
export function safePath(v:unknown): v is string { return typeof v==='string' && /^(sources\/[A-Za-z0-9_-]+(?:\.view\.html|\.html\.txt|\.pdf)|corpus\.json|ingestion-report\.json)$/.test(v); }
function check(ok:unknown, why:string):asserts ok { if(!ok) throw new Error(`Invalid pack: ${why}`); }
export function validateCorpus(value:unknown):Corpus {
  check(record(value) && value.schemaVersion===1,'unsupported schema');
  check(str(value.packId)&&str(value.version)&&str(value.createdAt)&&Number.isFinite(Date.parse(value.createdAt)),'identity');
  check(Array.isArray(value.documents)&&value.documents.length>0&&value.documents.length<=1000,'documents');
  check(Array.isArray(value.passages)&&value.passages.length<=100000,'passages');
  const ids = new Map<string,Record<string,unknown>>();
  for(const d of value.documents){
    check(record(d),'document object');
    check(str(d.id)&&!ids.has(d.id),'unique document id');
    check(str(d.title)&&str(d.filename)&&['pdf','html'].includes(String(d.format)),'document fields');
    check(documentTypes.includes(d.type as never)&&str(d.language)&&str(d.genre),'metadata');
    check(record(d.suppliedMetadata)&&d.suppliedMetadata.id===d.id&&typeof d.suppliedMetadata.genre==='string'&&typeof d.suppliedMetadata.language==='string','supplied metadata');
    check(d.publicationYear===null||(uint(d.publicationYear)&&d.publicationYear>0&&d.publicationYear<10000),'year');
    check(d.sourceUrl===null||(typeof d.sourceUrl==='string'&&/^https:\/\//.test(d.sourceUrl)),'source URL');
    check(safePath(d.sourcePath)&&String(d.sourcePath).startsWith('sources/'),'source path');
    check(d.viewerPath===null||(safePath(d.viewerPath)&&String(d.viewerPath).endsWith('.view.html')),'viewer path');
    check(uint(d.sourceBytes)&&d.sourceBytes<=50_000_000&&hash(d.sourceSha256),'source integrity fields');
    check(d.pageCount===null||(uint(d.pageCount)&&d.pageCount>0),'page count');
    check(['ok','partial','failed'].includes(String(d.extractionStatus))&&Array.isArray(d.warnings)&&d.warnings.every(x=>typeof x==='string')&&str(d.textSource),'extraction');
    ids.set(d.id,d);
  }
  const passages=new Set<string>();
  for(const p of value.passages){
    check(record(p)&&str(p.id)&&!passages.has(p.id),'unique passage id');
    check(str(p.documentId)&&ids.has(p.documentId),'dangling passage');
    const d=ids.get(p.documentId)!;
    check(str(p.text)&&p.text.length<=20000&&uint(p.ordinal),'passage text');
    check(p.heading===null||typeof p.heading==='string','heading');
    check(p.sectionId===null||(typeof p.sectionId==='string'&&/^section-\d+$/.test(p.sectionId)),'section');
    check(p.page===null||(d.format==='pdf'&&uint(p.page)&&p.page>=1&&uint(d.pageCount)&&p.page<=d.pageCount),'page bounds');
    passages.add(p.id);
  }
  return value as unknown as Corpus;
}
export function validateManifest(value:unknown):PackManifest {
  check(record(value)&&value.schemaVersion===1&&str(value.packId)&&str(value.version)&&value.corpusPath==='corpus.json'&&Array.isArray(value.files),'manifest');
  const seen=new Set<string>(); let total=0;
  for(const f of value.files){ check(record(f)&&safePath(f.path)&&!seen.has(f.path)&&uint(f.bytes)&&f.bytes<=50_000_000&&hash(f.sha256),'manifest file');seen.add(f.path);total+=f.bytes; }
  check(seen.has('corpus.json')&&total===value.totalBytes&&total<=1_000_000_000,'manifest size');
  return value as unknown as PackManifest;
}
export async function verifyBytes(bytes:ArrayBuffer, expected:{bytes:number;sha256:string}) {
  if(bytes.byteLength!==expected.bytes) throw new Error('File size mismatch');
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  if(Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('')!==expected.sha256) throw new Error('File checksum mismatch');
}
