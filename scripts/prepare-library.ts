/** Local-only ingestion. Reads documents/, writes ignored caches and a static pack. */
import {JSDOM} from 'jsdom';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir,readdir,stat,rename,rm,access} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url)));
const source=path.resolve(root,process.env.FIELDFIND_DOCUMENTS||'documents');
const output=path.resolve(root,process.env.FIELDFIND_OUTPUT||'public/packs/demo');const stateRoot=path.resolve(root,process.env.FIELDFIND_CACHE||'.fieldfind');
const backup=output+'.previous';const digest=(b:Uint8Array|string)=>createHash('sha256').update(b).digest('hex');
const exists=async(p:string)=>access(p).then(()=>true,()=>false);
const canonical=(s:string)=>s.replace(/\s*\(\d+\)(?=\.[^.]+$)/,'').replace(/\.htm$/i,'.html').toLowerCase();
async function scan(dir:string):Promise<string[]>{const result:string[]=[];for(const e of await readdir(dir,{withFileTypes:true})){if(e.isSymbolicLink())continue;const p=path.join(dir,e.name);if(e.isDirectory())result.push(...await scan(p));else if(/\.(pdf|html?|md|csv)$/i.test(e.name))result.push(p);}return result.sort();}
async function main(){
 await mkdir(source,{recursive:true});await mkdir(stateRoot,{recursive:true});await mkdir(path.dirname(output),{recursive:true});
 if(!await exists(output)&&await exists(backup))await rename(backup,output);
 const files=await scan(source);if(!files.some(p=>/\.(pdf|html?)$/i.test(p))){console.log('No originals in documents/. Copy PDF/HTML files and one CSV there, then restart; the browser chooser also remains available.');return;}
 const csvs=files.filter(p=>/\.csv$/i.test(p));if(csvs.length>1)throw new Error('Keep only one CSV in documents/ (id,genre,language).');
 const pipeline=digest(Buffer.concat(await Promise.all(['scripts/prepare-library.ts','src/data/localSample.ts','src/data/catalog.ts','metadata/overrides.json','metadata/catalog.json'].map(f=>readFile(path.join(root,f))))));
 const stamp=JSON.stringify({parser:pipeline,files:await Promise.all(files.map(async p=>{const s=await stat(p);return [path.relative(source,p),s.size,s.mtimeMs];})),csv:csvs[0]?digest(await readFile(csvs[0])):null});
 const stampPath=path.join(stateRoot,'library-stamp.json');
 if(!process.argv.includes('--force')&&await exists(stampPath)&&await readFile(stampPath,'utf8')===stamp&&await exists(path.join(output,'manifest.json'))){
  const m=JSON.parse(await readFile(path.join(output,'manifest.json'),'utf8'));let intact=true;for(const f of m.files){try{if((await stat(path.join(output,f.path))).size!==f.bytes)intact=false;}catch{intact=false;}}
  if(intact){console.log('Library unchanged: using saved search data. No PDF extraction.');return;}
 }
 const dom=new JSDOM('');Object.assign(globalThis,{window:dom.window,document:dom.window.document,Element:dom.window.Element});
 const {loadLocalSample}=await import('../src/data/localSample');const {parseCatalog}=await import('../src/data/catalog');
 const fallback=JSON.parse(await readFile(path.join(root,'metadata/catalog.json'),'utf8'));
 const rows=csvs[0]?parseCatalog(await readFile(csvs[0],'utf8')):fallback;
 const overrides=await readFile(path.join(root,'metadata/overrides.json'),'utf8');
 const byName=new Map<string,string>();for(const p of files){const name=canonical(path.basename(p));if(byName.has(name))throw new Error(`Duplicate name ${path.basename(p)} in document subfolders. Keep one source per ID.`);byName.set(name,p);}
 const originals=files.filter(p=>/\.(pdf|html?)$/i.test(p));if(originals.length>1000)throw new Error('Use at most 1000 originals per collection.');
 const stage=output+'.staging-'+Date.now();await mkdir(path.join(stage,'sources'),{recursive:true});await mkdir(path.join(stateRoot,'cache'),{recursive:true});
 const documents:any[]=[];const passages:any[]=[];const notices:string[]=[`Metadata: ${csvs[0]?path.basename(csvs[0]):'bundled fallback CSV'}. Files are prepared locally.`];let reused=0,processed=0;
 const extractPdf=async(bytes:ArrayBuffer,onProgress:(s:string)=>void)=>{
  const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');const task=getDocument({data:new Uint8Array(bytes.slice(0))});
  try{const pdf=await task.promise;const units:{text:string;heading:null;page:number}[]=[];const warnings:string[]=[];
   for(let n=1;n<=pdf.numPages;n++){if(n===1||n%25===0)onProgress(`page ${n}/${pdf.numPages}`);const page=await pdf.getPage(n);const content=await page.getTextContent();const text=content.items.map(i=>'str' in i?i.str+(i.hasEOL?'\n':' '):'').join('').trim();if(text.length<80)warnings.push(`Sparse text on physical page ${n}; review original or OCR locally.`);if(text)units.push({text,heading:null,page:n});page.cleanup();}
   if(!units.length)throw new Error('No PDF text found; local OCR or Markdown is needed.');return {units,pageCount:pdf.numPages,warnings};
  }finally{await task.destroy();}
 };
 try{
  for(const [i,p] of originals.entries()){
   const name=path.basename(p);const key=canonical(name).replace(/\.[^.]+$/,'');const md=byName.get(key+'.md');const raw=await readFile(p);const markdown=md?await readFile(md):null;
   if(raw.length>50_000_000)throw new Error(`${name} exceeds the 50 MB document limit.`);
   const row=rows.find((r:{id:string})=>r.id.toLowerCase()===key);
   const hash=digest(Buffer.concat([Buffer.from(pipeline+JSON.stringify({name,md:md?path.basename(md):null,row:row??null})+overrides),raw,markdown??Buffer.alloc(0)]));const cache=path.join(stateRoot,'cache',hash+'.json');let record:any;
   if(await exists(cache)){record=JSON.parse(await readFile(cache,'utf8'));reused++;}
   else{
    console.log(`[${i+1}/${originals.length}] Preparing ${name}`);
    try{const pack=await loadLocalSample([new File([raw],name),...(md?[new File([markdown!],path.basename(md))]:[])],s=>console.log('  '+s),{catalog:rows,pdfExtractor:extractPdf});
     const stored:any[]=[];for(const d of pack.corpus.documents)for(const f of [d.sourcePath,d.viewerPath].filter((v):v is string=>!!v)){const bytes=Buffer.from(await pack.read(f));stored.push({path:f,data:bytes.toString('base64'),sha256:digest(bytes),bytes:bytes.length});}
     record={documents:pack.corpus.documents,passages:pack.corpus.passages,files:stored,notices:pack.notices.filter(s=>s.startsWith('Not indexed'))};await writeFile(cache,JSON.stringify(record));processed++;
    }catch(e){notices.push(`Not indexed ${name}: ${e instanceof Error?e.message:String(e)}`);continue;}
   }
   documents.push(...record.documents);passages.push(...record.passages);notices.push(...record.notices);
   for(const f of record.files){if(!/^sources\/[A-Za-z0-9_-]+\.(?:pdf|html\.txt|view\.html)$/.test(f.path))throw new Error('Unsafe cached source path');const bytes=Buffer.from(f.data,'base64');if(bytes.length!==f.bytes||digest(bytes)!==f.sha256)throw new Error(`Cached file is corrupt: ${name}. Delete .fieldfind/cache and retry.`);await writeFile(path.join(stage,f.path),bytes);}
  }
  if(!documents.length)throw new Error('No documents could be prepared. Previous library was kept. '+notices.join(' '));
  const {validateCorpus,validateManifest}=await import('../src/data/validateCorpus');const corpus=validateCorpus({schemaVersion:1,packId:'fieldfind-folder',version:'folder-'+digest(stamp+Date.now()).slice(0,16),createdAt:new Date().toISOString(),documents,passages});
  const matchedDocuments=rows.filter((r:{id:string})=>['pdf','html'].some(ext=>byName.has(r.id.toLowerCase()+'.'+ext))).length;const stats={csvEntries:rows.length,matchedDocuments,indexedDocuments:documents.length,missingSources:rows.length-matchedDocuments,failedExtraction:notices.filter(n=>n.startsWith('Not indexed')).length};
  await writeFile(path.join(stage,'corpus.json'),JSON.stringify(corpus));await writeFile(path.join(stage,'ingestion-report.json'),JSON.stringify({stats,documentCount:documents.length,passageCount:passages.length,discrepancies:notices,documents,processed,reused},null,2));
  const all=await scanPack(stage);const entries=await Promise.all(all.map(async p=>{const b=await readFile(p);return {path:path.relative(stage,p).split(path.sep).join('/'),bytes:b.length,sha256:digest(b)};}));
  const manifest=validateManifest({schemaVersion:1,packId:corpus.packId,version:corpus.version,corpusPath:'corpus.json',files:entries,totalBytes:entries.reduce((s,f)=>s+f.bytes,0)});
  for(const d of corpus.documents){const file=entries.find(f=>f.path===d.sourcePath);if(!file||file.sha256!==d.sourceSha256||file.bytes!==d.sourceBytes||(d.viewerPath&&!entries.some(f=>f.path===d.viewerPath)))throw new Error('Cached document integrity mismatch. Remove .fieldfind/cache and prepare again; previous library was kept.');}
  await writeFile(path.join(stage,'manifest.json'),JSON.stringify(manifest));
  await rm(backup,{recursive:true,force:true});if(await exists(output))await rename(output,backup);
  try{await rename(stage,output);}catch(e){if(await exists(backup))await rename(backup,output);throw e;}
  await writeFile(stampPath,stamp);console.log(`Library ready: ${documents.length} documents, ${passages.length} passages; ${processed} processed, ${reused} reused. ${notices.filter(n=>n.startsWith('Not indexed')).length} files need attention.`);
 }finally{await rm(stage,{recursive:true,force:true});dom.window.close();}
}
async function scanPack(dir:string):Promise<string[]>{const paths:string[]=[];for(const e of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())paths.push(...await scanPack(p));else paths.push(p);}return paths;}
main().catch(e=>{console.error('Library preparation failed:',e.message);process.exitCode=1;});
