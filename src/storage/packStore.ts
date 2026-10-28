import {openDB} from 'idb';
import type {LoadedPack,CollectionStats} from '../data/loadCorpus';
import type {Corpus} from '../types/corpus';
import {safePath,validateCorpus,verifyBytes} from '../data/validateCorpus';
interface Stored {origin:'served'|'local';stats?:CollectionStats;schemaVersion:1;corpus:Corpus;notices:string[];files:{path:string;blob:Blob;bytes:number;sha256:string}[];savedAt:string}
const db=()=>openDB('fieldfind-library',1,{upgrade(db){db.createObjectStore('packs');}});
const hash=async(b:ArrayBuffer)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),n=>n.toString(16).padStart(2,'0')).join('');
export async function savePack(pack:LoadedPack,onProgress:(s:string)=>void=()=>{},isCurrent:()=>boolean=()=>true){
 const corpus=validateCorpus(pack.corpus);const needed=[...new Set(corpus.documents.flatMap(d=>[d.sourcePath,...(d.viewerPath?[d.viewerPath]:[])]))];
 const total=corpus.documents.reduce((n,d)=>n+d.sourceBytes,0)+new TextEncoder().encode(JSON.stringify(corpus)).length;
 const estimate=await navigator.storage?.estimate?.();if(estimate?.quota!==undefined&&estimate.usage!==undefined&&estimate.quota-estimate.usage<total*1.2)throw new Error('Not enough browser storage. The previous saved collection was kept. Free space or select a smaller batch.');
 const files:Stored['files']=[];
 // Stage and verify before the single atomic replacement transaction.
 for(const [i,path] of needed.entries()){
  if(!safePath(path))throw new Error('Unsafe source path');onProgress(`Saving local sources ${i+1} of ${needed.length}…`);
  const bytes=await pack.read(path);const document=corpus.documents.find(d=>d.sourcePath===path);if(document)await verifyBytes(bytes,{bytes:document.sourceBytes,sha256:document.sourceSha256});
  files.push({path,blob:new Blob([bytes]),bytes:bytes.byteLength,sha256:await hash(bytes)});
 }
 const report=new TextEncoder().encode(JSON.stringify({stats:pack.stats,documentCount:corpus.documents.length,passageCount:corpus.passages.length,discrepancies:pack.notices,documents:corpus.documents},null,2));files.push({path:'ingestion-report.json',blob:new Blob([report]),bytes:report.byteLength,sha256:await hash(report.buffer)});
 if(!isCurrent())throw new Error('Save superseded by a newer collection.');
 const stored:Stored={stats:pack.stats,origin:pack.origin??(pack.mode==='served'?'served':'local'),schemaVersion:1,corpus,notices:pack.notices,files,savedAt:new Date().toISOString()};
 const connection=await db();try{const tx=connection.transaction('packs','readwrite');await tx.store.put(stored,'active');await tx.done;}finally{connection.close();}
 return {documents:corpus.documents.length,sources:needed.length,savedAt:stored.savedAt};
}
export async function restorePack():Promise<LoadedPack|null>{
 const connection=await db();let stored:Stored|undefined;try{stored=await connection.get('packs','active');}finally{connection.close();}if(!stored)return null;
 if(stored.schemaVersion!==1)throw new Error('Saved collection schema is unsupported. Select the source folder again.');const corpus=validateCorpus(stored.corpus);
 if(!Array.isArray(stored.files))throw new Error('Saved source list is corrupt.');const files=new Map(stored.files.map(f=>[f.path,f]));
 for(const file of stored.files){if(file.blob instanceof Blob)await verifyBytes(await file.blob.arrayBuffer(),file);}
 if(files.size!==stored.files.length)throw new Error('Saved source identities are corrupt.');
 for(const file of stored.files)if(!safePath(file.path)||!(file.blob instanceof Blob)||file.blob.size!==file.bytes||!/^[a-f0-9]{64}$/.test(file.sha256))throw new Error('Saved source is missing or incomplete. Reload the original folder.');
 for(const d of corpus.documents){const f=files.get(d.sourcePath);if(!f||f.sha256!==d.sourceSha256||f.bytes!==d.sourceBytes||(d.viewerPath&&!files.has(d.viewerPath)))throw new Error('A saved original is missing or incomplete. Reload the source folder.');}
 return {corpus,mode:'saved',origin:stored.origin,stats:stored.stats,notices:stored.notices,async read(path){const f=files.get(path);if(!f||!safePath(path))throw new Error('Original is not saved on this browser.');const bytes=await f.blob.arrayBuffer();await verifyBytes(bytes,f);return bytes;}};
}
export async function forgetPack(){const connection=await db();try{await connection.delete('packs','active');}finally{connection.close();}}
