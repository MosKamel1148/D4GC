import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';
import {it,expect} from 'vitest';
it('prepares once, reuses unchanged documents, updates CSV, and preserves library after a bad CSV',()=>{
 const root=mkdtempSync(path.join(tmpdir(),'fieldfind-ingest-'));const docs=path.join(root,'documents'),out=path.join(root,'pack');mkdirSync(docs);
 const env={...process.env,FIELDFIND_DOCUMENTS:docs,FIELDFIND_OUTPUT:out,FIELDFIND_CACHE:path.join(root,'cache')};
 const run=()=>{const result=spawnSync(process.execPath,['--import','tsx','scripts/prepare-library.ts'],{cwd:process.cwd(),env,encoding:'utf8'});if(result.error)throw result.error;return result;};
 const csv=(genre='Source A')=>`id,genre,language,notes\nP01,${genre},en,Keep me\nP02,Source B,fr,Other\n`;
 try{
  writeFileSync(path.join(docs,'metadata.csv'),csv());for(const id of ['P01','P02'])writeFileSync(path.join(docs,id+'.html'),`<main><h1>Synthetic ingestion fixture ${id}</h1><p>Synthetic searchable fixture.</p></main>`);
  let result=run();expect(result.status,result.stderr+result.stdout).toBe(0);expect(result.stdout).toContain('2 processed, 0 reused');
  result=run();expect(result.status).toBe(0);expect(result.stdout).toContain('No PDF extraction');
  writeFileSync(path.join(docs,'P02.html'),'<main><h1>Synthetic updated fixture</h1><p>Synthetic new content.</p></main>');result=run();expect(result.status,result.stderr).toBe(0);expect(result.stdout).toContain('1 processed, 1 reused');
  writeFileSync(path.join(docs,'metadata.csv'),csv('Changed genre'));result=run();expect(result.status,result.stderr).toBe(0);expect(result.stdout).toContain('1 processed, 1 reused');
  const corpus=JSON.parse(readFileSync(path.join(out,'corpus.json'),'utf8'));expect(corpus.documents.find((d:any)=>d.id==='P01').genre).toBe('Changed genre');expect(corpus.documents.find((d:any)=>d.id==='P01').suppliedMetadata.notes).toBe('Keep me');
  const previous=readFileSync(path.join(out,'manifest.json'),'utf8');writeFileSync(path.join(docs,'metadata.csv'),'id,genre,language\nP01,A,en\nP01,B,fr');result=run();expect(result.status).not.toBe(0);expect(readFileSync(path.join(out,'manifest.json'),'utf8')).toBe(previous);
 }finally{rmSync(root,{recursive:true,force:true});}
},30000);
