import {useEffect,useState,useRef} from 'react';
import {useI18n} from '../i18n';
import {SourceArrow} from './Icons';
import type {SearchResult} from '../types/corpus';
import type {LoadedPack} from '../data/loadCorpus';
export default function DocumentReader({result,pack,onBack}:{result:SearchResult;pack:LoadedPack;onBack:()=>void}){
 const {t}=useI18n();const d=result.document;
 const main=useRef<HTMLElement>(null);
 useEffect(()=>{main.current?.focus();},[]);
 const [source,setSource]=useState<{original:string;view:string}|null>(null);
 const [error,setError]=useState('');
 useEffect(()=>{
  let active=true; const urls:string[]=[];
  async function open(){
   try{
    const original=await pack.read(d.sourcePath);
    const originalUrl=URL.createObjectURL(new Blob([original],{type:d.format==='pdf'?'application/pdf':'application/octet-stream'}));urls.push(originalUrl);
    let view=originalUrl;
    if(d.viewerPath){view=URL.createObjectURL(new Blob([await pack.read(d.viewerPath)],{type:'text/html'}));urls.push(view);}
    if(active)setSource({original:originalUrl,view});
    else urls.forEach(url=>URL.revokeObjectURL(url));
   }catch(e){if(active)setError(e instanceof Error?e.message:'Could not open source');}
  }
  void open(); return ()=>{active=false;urls.forEach(url=>URL.revokeObjectURL(url));};
 },[d,pack]);
 return <main className="reader" id="reader" tabIndex={-1} ref={main}><button className="secondary back" onClick={onBack}>{t('back')}</button>
  <p className="eyebrow">SOURCE DOCUMENT / {d.id}</p><h1 dir="auto" lang={d.language}>{d.title}</h1>
  <p className="meta">{d.genre} · {d.language} · {d.filename}</p>
  <div className="notice">{t('context')}</div>
  <details><summary>{t('technical')}</summary><p>Searchable text: {d.textSource}. {d.pageCount!==null&&`${d.pageCount} physical PDF pages.`}</p><ul>{d.warnings.map(w=><li key={w}>{w}</li>)}</ul><p>{d.id.startsWith('local-')?'Uncatalogued document: ID ':'CSV: ID '}{d.suppliedMetadata.id}; genre {d.suppliedMetadata.genre}; language {d.suppliedMetadata.language}. Normalized type: {d.type.replaceAll('_',' ')}.</p><dl>{Object.entries(d.suppliedMetadata).filter(([key])=>!['id','genre','language'].includes(key)).map(([key,value])=><div key={key}><dt>{key}</dt><dd dir="auto">{value}</dd></div>)}</dl></details>
  <h2>{t('matched')}</h2><blockquote lang={d.language} dir="auto">{result.bestPassage.text}</blockquote><p className="caption">{result.bestPassage.page?`Physical PDF page ${result.bestPassage.page}`:'Page reference unavailable. No page number inferred from Markdown.'}</p>
  <h2>{d.format==='pdf'?t('originalPdf'):t('safeHtml')}</h2>
  {d.format==='html'&&<p>{t('htmlNote')}</p>}
  {error?<p role="alert" className="notice">{error} <button onClick={()=>location.reload()}>Reload</button></p>:source?<>
    <div className="source-actions"><a className="primary button" href={source.original} download={d.filename}>{t('download')} ({(d.sourceBytes/1024/1024).toFixed(1)} MB)</a>
    {d.format==='pdf'&&<a className="secondary button" href={source.view+(result.bestPassage.page?`#page=${result.bestPassage.page}`:'')} target="_blank" rel="noreferrer">{t('newTab')} <SourceArrow/></a>}</div>
    {d.format==='pdf'&&<p className="caption">{t('pdfNote')}</p>}
    <iframe title={`Original document: ${d.title}`} src={source.view+(result.bestPassage.page?`#page=${result.bestPassage.page}`:'')} sandbox={d.format==='html'?'':'allow-same-origin'} referrerPolicy="no-referrer" />
  </>:<p role="status">{t('opening')}</p>}
 </main>;
}
