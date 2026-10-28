import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {validateCorpus,validateManifest,verifyBytes} from '../src/data/validateCorpus';
import {createSearchService} from '../src/search/searchDocuments';
const raw=JSON.parse(readFileSync('public/packs/demo/corpus.json','utf8'));
const corpus=validateCorpus(raw);
const search=createSearchService(corpus);
describe('supplied sample retrieval',()=>{
 it.each([
  ['International Criminal Court jurisdiction','P28'],
  ['protected persons','P26'],
  ['genocide','P25'],
  ['humanitarian principles','P27'],
  ['vaccine pricing','P33'],
  ['bedaquiline','P34'],
  ['pre-ART mortality','Df98e297b5f'],
  ['Haiti medical supplies','Dfa9c0c7a37'],
  ['الكوليرا','Df5738d956a'],
 ])('%s retrieves %s among first three',async(q,id)=>{
  const results=await search.searchDocuments(q);
  expect(results.slice(0,3).map(r=>r.document.id)).toContain(id);
  expect(new Set(results.map(r=>r.document.id)).size).toBe(results.length);
  for(const r of results) expect(corpus.passages.find(p=>p.id===r.bestPassage.id)?.text).toBe(r.bestPassage.text);
 });
 it('returns no fabricated result for empty and unrelated queries',async()=>{
  expect(await search.searchDocuments('  ')).toEqual([]);
  expect(await search.searchDocuments('quantum superconducting qubit')).toEqual([]);
 });
 it('applies explicit language and type filters',async()=>{
  expect(await search.searchDocuments('الكوليرا',{languages:['en']})).toEqual([]);
  expect((await search.searchDocuments('bedaquiline',{types:['pricing_report'],publicationYear:2022})).map(r=>r.document.id)).toContain('P34');
 });
 it('keeps identities and supplied CSV metadata; no inferred Markdown pages',()=>{
  expect(corpus.documents).toHaveLength(10);
  for(const d of corpus.documents){expect(d.suppliedMetadata.id).toBe(d.id);expect(d.genre).toBe(d.suppliedMetadata.genre);expect(d.language).toBe(d.suppliedMetadata.language);if(d.textSource.endsWith('.md'))expect(corpus.passages.filter(p=>p.documentId===d.id).every(p=>p.page===null)).toBe(true);}
 });
});
describe('untrusted pack validation',()=>{
 it.each([
  (c:any)=>c.passages[0].documentId='absent',
  (c:any)=>c.passages[0].page=999999,
  (c:any)=>c.documents[0].sourcePath='sources/../../evil.html',
  (c:any)=>c.documents[0].sourcePath='https://evil.test/source',
  (c:any)=>c.documents[0].viewerPath='sources/x.html?script',
  (c:any)=>c.documents.push(c.documents[0]),
  (c:any)=>c.schemaVersion=99,
 ])('rejects invalid pack variant %#',mutate=>{const c=structuredClone(raw);mutate(c);expect(()=>validateCorpus(c)).toThrow();});
 it('detects source corruption',async()=>{
  const manifest=validateManifest(JSON.parse(readFileSync('public/packs/demo/manifest.json','utf8')));
  for(const file of manifest.files){const b=readFileSync('public/packs/demo/'+file.path);await verifyBytes(new Uint8Array(b).buffer,file);}
  const b=new TextEncoder().encode('corrupt');await expect(verifyBytes(b.buffer,{bytes:7,sha256:'0'.repeat(64)})).rejects.toThrow('checksum');
 });
});
