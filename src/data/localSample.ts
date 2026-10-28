import DOMPurify from 'dompurify';
import catalog from '../../metadata/sample.json';
import type {Corpus,DocumentRecord,DocumentType,Passage} from '../types/corpus';
import type {LoadedPack} from './loadCorpus';
import {safePath,validateCorpus,verifyBytes} from './validateCorpus';
const encoder=new TextEncoder();
const digest=async(bytes:ArrayBuffer)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
function escape(text:string){return text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));}
function* chunks(text:string){
 let start=0;
 while(start<text.length){let end=Math.min(start+1600,text.length);if(end<text.length){let cut=text.lastIndexOf('\n',end);if(cut<start+800)cut=text.lastIndexOf(' ',end);if(cut>start+800)end=cut;}
 const piece=text.slice(start,end).trim();if(piece)yield piece;start=end;}
}
export async function loadLocalSample(files:File[]):Promise<LoadedPack>{
 if(!crypto.subtle)throw new Error('Open FieldFind on localhost or HTTPS to load documents securely.');
 if(!files.length)throw new Error('Choose the original PDF/HTML files together with their matching Markdown files.');
 if(files.length>60||files.some(f=>f.size>50_000_000)||files.reduce((sum,f)=>sum+f.size,0)>100_000_000)throw new Error('Sample selection is too large (maximum 60 files, 50 MB per file, 100 MB total).');
 const selected=new Map<string,File>();
 for(const f of files){if(selected.has(f.name))throw new Error(`Duplicate filename: ${f.name}. Select one copy of each file.`);selected.set(f.name,f);}
 const documents:DocumentRecord[]=[];const passages:Passage[]=[];
 const sources=new Map<string,{bytes:ArrayBuffer;sha256:string}>();const used=new Set<string>();
 const notices=['Files are read only in this browser tab. Nothing is uploaded or saved; select them again after a reload.','The older 14-file list in data.md describes a different sample. Only selected supplied sample IDs are indexed.'];
 async function store(path:string,bytes:ArrayBuffer){sources.set(path,{bytes,sha256:await digest(bytes)});}
 for(const entry of catalog){
  const originals=['pdf','html'].map(ext=>selected.get(`${entry.id}.${ext}`)).filter((f):f is File=>!!f);
  const md=selected.get(`${entry.id}.md`);
  if(!originals.length){if(md)throw new Error(`${entry.id}: select the original PDF or HTML too; Markdown alone cannot open the source.`);continue;}
  if(originals.length!==1)throw new Error(`${entry.id}: select only one original PDF or HTML.`);
  const original=originals[0];used.add(original.name);if(md)used.add(md.name);
  const format=original.name.endsWith('.pdf')?'pdf':'html';
  if(format==='pdf'&&!md)throw new Error(`${original.name} needs ${entry.id}.md for browser search. Select both files, or use the Python ingestion command for PDF extraction.`);
  const bytes=await original.arrayBuffer();
  const sourcePath=`sources/${entry.id}.${format==='pdf'?'pdf':'html.txt'}`;
  await store(sourcePath,bytes);
  let title=entry.title??entry.id;
  const warnings:string[]=[];let viewerPath:string|null=null;
  let htmlUnits:{text:string;heading:string|null}[]=[];
  if(format==='html'){
   // Inert template parsing in DOMPurify; no source HTML is attached to the live DOM.
   const rawHtml=new TextDecoder().decode(bytes);
   const declaredLanguage=rawHtml.match(/<html\b[^>]*\blang\s*=\s*["']([a-zA-Z0-9-]+)["']/i)?.[1];
   if(declaredLanguage&&declaredLanguage.toLowerCase()!==entry.language.toLowerCase())warnings.push(`Metadata discrepancy: HTML declares ${declaredLanguage}, but CSV supplies ${entry.language}. CSV language is preserved.`);
   const fragment=DOMPurify.sanitize(rawHtml,{RETURN_DOM_FRAGMENT:true,ALLOWED_TAGS:['main','article','section','div','p','h1','h2','h3','h4','h5','h6','ul','ol','li','table','thead','tbody','tr','td','th','strong','em','b','i','span','blockquote','br','sup','sub','figure','figcaption'],ALLOWED_ATTR:['class','colspan','rowspan'],ALLOW_DATA_ATTR:false,ALLOW_ARIA_ATTR:false});
   const h=fragment.querySelector('h1');if(h)title=h.textContent?.trim()||title;
   const selector=entry.id.startsWith('P')?'main article .anchor-links-js':'main .main-content';
   const body=fragment.querySelector(selector);
   if(!body)throw new Error(`${original.name}: expected article body was not found. Use the supplied HTML or the Python ingestion command.`);
   body.querySelectorAll('aside,nav,form,footer,.related-block,.carousel,.share,.breadcrumb,.toolkit--share').forEach(el=>el.remove());
   const blocks=entry.id.startsWith('P')?body.querySelectorAll('p,li,h1,h2,h3,h4,h5,h6,table'):body.querySelectorAll('.text-block__content p,.text-block__content li,.text-block__content h2,.text-block__content h3,.text-block__content table');
   let heading:string|null=null;
   for(const block of blocks){if(block.parentElement?.closest('li,table'))continue;const text=(block.textContent??'').trim();if(/^H[1-6]$/.test(block.tagName)){heading=text;continue;}if(text)htmlUnits.push({text,heading});}
   viewerPath=`sources/${entry.id}.view.html`;
   const view=`<!doctype html><html lang="${escape(entry.language)}" dir="auto"><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${escape(title)}</title><style>body{font:20px/1.7 system-ui;max-width:80ch;margin:24px auto;padding:16px}table{border-collapse:collapse;max-width:100%}td,th{border:1px solid;padding:8px}</style><h1>${escape(title)}</h1>${body.innerHTML}</html>`;
   await store(viewerPath,encoder.encode(view).buffer);
   warnings.push('Safe HTML view removes pictures, scripts, links and remote assets. Download original retains the supplied bytes and table context.');
  }
  if(md){
   htmlUnits=[];let heading:string|null=null;let buffer='';
   for(const line of (await md.text()).split(/(?<=\n)/)){
    if(/^#{1,6} /.test(line)){if(buffer)htmlUnits.push({text:buffer,heading});buffer='';heading=line.trim().replace(/^#+ /,'');}else buffer+=line;
   }
   if(buffer)htmlUnits.push({text:buffer,heading});
   warnings.push('Search uses supplied Markdown. No verified physical-page or section mapping; page references remain unknown. Check original for tables and reading order.');
  }
  let ordinal=0;
  for(const unit of htmlUnits)for(const text of chunks(unit.text))passages.push({id:`${entry.id}:${ordinal}`,documentId:entry.id,text,heading:unit.heading,page:null,sectionId:null,ordinal:ordinal++});
  if(!ordinal)throw new Error(`${original.name}: no searchable text found.`);
  if(format==='pdf')warnings.push('Browser loading does not extract PDF text or count pages. Supplied Markdown is required.');
  documents.push({id:entry.id,title,filename:original.name,format,type:('type' in entry?entry.type:entry.id.startsWith('P2')?'humanitarian_law':'news') as DocumentType,language:entry.language,genre:entry.genre,suppliedMetadata:{id:entry.id,genre:entry.genre,language:entry.language},publicationYear:entry.publicationYear??null,sourceUrl:null,sourcePath,sourceSha256:sources.get(sourcePath)!.sha256,sourceBytes:bytes.byteLength,pageCount:null,extractionStatus:'partial',warnings,textSource:md?md.name:'Selected HTML article',viewerPath});
 }
 if(!documents.length)throw new Error('No supplied sample originals found. Select files named P25.html, P26.html, …, P34.pdf or the supplied Df… originals, with their matching Markdown.');
 const ignored=files.filter(f=>!used.has(f.name));if(ignored.length)notices.push(`Not indexed (not sample source pairs): ${ignored.map(f=>f.name).join(', ')}`);
 const corpus=validateCorpus({schemaVersion:1,packId:'fieldfind-local-sample',version:crypto.randomUUID(),createdAt:new Date().toISOString(),documents,passages} satisfies Corpus);
 const report=encoder.encode(JSON.stringify({documentCount:documents.length,passageCount:passages.length,discrepancies:notices,documents},null,2)).buffer;await store('ingestion-report.json',report);
 return {corpus,mode:'local',notices,async read(path){if(!safePath(path))throw new Error('Unsafe source path');const source=sources.get(path);if(!source)throw new Error('Original is not in this selection');await verifyBytes(source.bytes,{bytes:source.bytes.byteLength,sha256:source.sha256});return source.bytes;}};
}
