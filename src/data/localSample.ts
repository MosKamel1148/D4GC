import DOMPurify from 'dompurify';
import catalogRows from '../../metadata/catalog.json';
import overrides from '../../metadata/overrides.json';
interface CatalogEntry {id:string; genre:string; language:string; title?:string; type?:DocumentType; publicationYear?:number|null}
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
export async function loadLocalSample(files:File[],onProgress:(message:string)=>void=()=>{}):Promise<LoadedPack>{
 if(!crypto.subtle)throw new Error('Open FieldFind on localhost or HTTPS to load documents securely.');
 if(!files.length)throw new Error('Choose the original PDF/HTML files together with their matching Markdown files.');
 if(files.length>2000||files.some(f=>f.size>50_000_000)||files.reduce((sum,f)=>sum+f.size,0)>500_000_000)throw new Error('Selection is too large: use batches of at most 2000 files, 50 MB per file and 500 MB total. Choose the document folder, not the entire project.');
 const selected=new Map<string,File>();
 const canonical=(name:string)=>name.normalize('NFC').replace(/\s*\(\d+\)(?=\.[^.]+$)/,'').replace(/\.htm$/i,'.html').toLowerCase();
 for(const f of files){const name=canonical(f.name);if(selected.has(name))throw new Error(`Duplicate filename: ${f.name}. Select one copy of each file.`);selected.set(name,f);}
 const documents:DocumentRecord[]=[];const passages:Passage[]=[];
 const sources=new Map<string,{bytes:ArrayBuffer;sha256:string}>();const used=new Set<string>();
 const notices=['Files are read only in this browser tab. Nothing is uploaded or saved; select them again after a reload.','Only the files selected on this computer are indexed. CSV metadata is preserved where IDs match; other documents are marked unknown.'];
 const catalog:CatalogEntry[]=catalogRows.map(row=>({...row,...(overrides as Record<string,Partial<CatalogEntry>>)[row.id]}));
 const byId=new Set(catalog.map(entry=>entry.id.toLowerCase()));
 for(const [name,file] of selected){if(!/\.(pdf|html)$/.test(name))continue;const stem=name.replace(/\.[^.]+$/,'');if(byId.has(stem))continue;const id='local-'+(await digest(encoder.encode(stem).buffer)).slice(0,16);catalog.push({id,genre:'Unknown',language:'und',title:file.name});byId.add(stem);}
 const fileKeys=new Map(catalog.map(entry=>[entry.id,entry.id.toLowerCase()]));
 for(const [name,file] of selected){if(!/\.(pdf|html)$/.test(name))continue;const stem=name.replace(/\.[^.]+$/,'');if(!catalogRows.some(row=>row.id.toLowerCase()===stem)){const id='local-'+(await digest(encoder.encode(stem).buffer)).slice(0,16);fileKeys.set(id,stem);}}
 async function store(path:string,bytes:ArrayBuffer){sources.set(path,{bytes,sha256:await digest(bytes)});}
 for(const entry of catalog){
  const originals=['pdf','html'].map(ext=>selected.get(`${fileKeys.get(entry.id)}.${ext}`)).filter((f):f is File=>!!f);
  const md=selected.get(`${fileKeys.get(entry.id)}.md`);
  if(!originals.length){if(md)notices.push(`Not indexed ${md.name}: select the original PDF or HTML too; Markdown alone cannot open the source.`);continue;}
  if(originals.length!==1)throw new Error(`${entry.id}: select only one original PDF or HTML.`);
  const original=originals[0];used.add(original.name);if(md)used.add(md.name);
  onProgress(`Reading ${original.name}…`);const passageStart=passages.length;
  try{
  const format=original.name.toLowerCase().endsWith('.pdf')?'pdf':'html';

  const bytes=await original.arrayBuffer();
  const sourcePath=`sources/${entry.id}.${format==='pdf'?'pdf':'html.txt'}`;
  await store(sourcePath,bytes);
  let title=entry.title??entry.id;
  const warnings:string[]=[];
  if(entry.language==='und')warnings.push('No matching CSV metadata. Genre and language are unknown; verify this document before relying on its classification.');
  let pageCount:number|null=null;
  if(original.name!==`${entry.id}.${format}`)warnings.push(`Filename variation: ${original.name} matched to CSV ID ${entry.id}; original filename is retained.`);
  let viewerPath:string|null=null;
  let htmlUnits:{text:string;heading:string|null;page?:number}[]=[];
  if(format==='html'){
   // Inert template parsing in DOMPurify; no source HTML is attached to the live DOM.
   const rawHtml=new TextDecoder().decode(bytes);
   const declaredLanguage=rawHtml.match(/<html\b[^>]*\blang\s*=\s*["']([a-zA-Z0-9-]+)["']/i)?.[1];
   if(declaredLanguage&&declaredLanguage.toLowerCase()!==entry.language.toLowerCase())warnings.push(`Metadata discrepancy: HTML declares ${declaredLanguage}, but CSV supplies ${entry.language}. CSV language is preserved.`);
   const fragment=DOMPurify.sanitize(rawHtml,{RETURN_DOM_FRAGMENT:true,ALLOWED_TAGS:['main','article','section','div','p','h1','h2','h3','h4','h5','h6','ul','ol','li','table','thead','tbody','tr','td','th','strong','em','b','i','span','blockquote','br','sup','sub','figure','figcaption'],ALLOWED_ATTR:['class','colspan','rowspan'],FORBID_CONTENTS:['script','style','nav','header','footer','aside','form'],ALLOW_DATA_ATTR:false,ALLOW_ARIA_ATTR:false});
   const h=fragment.querySelector('h1');if(h)title=h.textContent?.trim()||title;
   const selector=entry.id.startsWith('P')?'main article .anchor-links-js':'main .main-content';
   const reviewedBody=fragment.querySelector(selector);
   const body=reviewedBody??fragment.querySelector('main,article')??fragment;
   if(!reviewedBody)warnings.push('Generic HTML extraction: article structure is unverified. Review navigation, reading order and tables in the original.');
   body.querySelectorAll('aside,nav,header,form,footer,.related-block,.carousel,.share,.breadcrumb,.toolkit--share').forEach(el=>el.remove());
   const blocks=!reviewedBody||entry.id.startsWith('P')?body.querySelectorAll('p,li,h1,h2,h3,h4,h5,h6,table'):body.querySelectorAll('.text-block__content p,.text-block__content li,.text-block__content h2,.text-block__content h3,.text-block__content table');
   let heading:string|null=null;
   for(const block of blocks){if(block.parentElement?.closest('li,table'))continue;const text=(block.textContent??'').trim();if(/^H[1-6]$/.test(block.tagName)){heading=text;continue;}if(text)htmlUnits.push({text,heading});}
   viewerPath=`sources/${entry.id}.view.html`;
   const view=`<!doctype html><html lang="${escape(entry.language)}" dir="auto"><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${escape(title)}</title><style>body{font:20px/1.7 system-ui;max-width:80ch;margin:24px auto;padding:16px}table{border-collapse:collapse;max-width:100%}td,th{border:1px solid;padding:8px}</style><h1>${escape(title)}</h1>${'innerHTML' in body?body.innerHTML:Array.from(body.childNodes).map(n=>n instanceof Element?n.outerHTML:escape(n.textContent??'')).join('')}</html>`;
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
  if(format==='pdf'&&!md){const {extractPdf}=await import('./extractPdf');const extracted=await extractPdf(bytes,message=>onProgress(`${original.name}: ${message}`));htmlUnits=extracted.units;pageCount=extracted.pageCount;warnings.push(...extracted.warnings,'PDF text was extracted locally. Check original for tables, columns and reading order.');}
  let ordinal=0;
  for(const unit of htmlUnits)for(const text of chunks(unit.text))passages.push({id:`${entry.id}:${ordinal}`,documentId:entry.id,text,heading:unit.heading,page:unit.page??null,sectionId:null,ordinal:ordinal++});
  if(!ordinal)throw new Error(`${original.name}: no searchable text found.`);
  if(format==='pdf'&&md)warnings.push('Supplied Markdown is preferred over PDF extraction; physical-page mapping is unverified.');
  documents.push({id:entry.id,title,filename:original.name,format,type:entry.type??'unknown',language:entry.language,genre:entry.genre,suppliedMetadata:{id:entry.id,genre:entry.genre,language:entry.language},publicationYear:entry.publicationYear??null,sourceUrl:null,sourcePath,sourceSha256:sources.get(sourcePath)!.sha256,sourceBytes:bytes.byteLength,pageCount,extractionStatus:'partial',warnings,textSource:md?md.name:format==='pdf'?'Local PDF text extraction':'Selected HTML article',viewerPath});
  }catch(e){passages.splice(passageStart);for(const key of sources.keys())if(key.startsWith(`sources/${entry.id}.`))sources.delete(key);notices.push(`Not indexed ${original.name}: ${e instanceof Error?e.message:'Could not read this document.'}`);}
 }
 if(!documents.length)throw new Error(notices.slice(2).join(' ')||'No readable PDF or HTML originals found. Select a document folder or PDF/HTML files.');
 const ignored=files.filter(f=>!used.has(f.name));if(ignored.length)notices.push(`Not indexed (unsupported files or unpaired Markdown): ${ignored.map(f=>f.name).join(', ')}`);
 const corpus=validateCorpus({schemaVersion:1,packId:'fieldfind-local-sample',version:crypto.randomUUID(),createdAt:new Date().toISOString(),documents,passages} satisfies Corpus);
 const report=encoder.encode(JSON.stringify({documentCount:documents.length,passageCount:passages.length,discrepancies:notices,documents},null,2)).buffer;await store('ingestion-report.json',report);
 return {corpus,mode:'local',notices,async read(path){if(!safePath(path))throw new Error('Unsafe source path');const source=sources.get(path);if(!source)throw new Error('Original is not in this selection');await verifyBytes(source.bytes,{bytes:source.bytes.byteLength,sha256:source.sha256});return source.bytes;}};
}
