import {useState,useId} from 'react';
import {SourceArrow} from './Icons';
import {useI18n} from '../i18n';
import type {SearchResult} from '../types/corpus';
export default function ResultsList({results,query,onOpen}:{results:SearchResult[];query:string;onOpen:(result:SearchResult)=>void}){
 return <div className="results">{results.map((r,i)=><ResultCard key={r.document.id} result={r} index={i} query={query} onOpen={onOpen}/>)}</div>;
}
function ResultCard({result:r,index,query,onOpen}:{result:SearchResult;index:number;query:string;onOpen:(r:SearchResult)=>void}){
 const {t}=useI18n();const [expanded,setExpanded]=useState(false);const id=useId();
 return <article className="result"><div className="result-top"><span className="eyebrow">{String(index+1).padStart(2,'0')} / {r.document.genre}</span><span className="language">{r.document.language}</span></div>
 <h3 dir="auto" lang={r.document.language}>{r.document.title}</h3>
 <p className="meta">{r.document.format.toUpperCase()}{r.document.publicationYear!==null?` · ${r.document.publicationYear}`:''}</p>
 {r.matchType==='related'&&<p className="match-note">{t('related')}</p>}
 <blockquote id={id} className={expanded?'excerpt-expanded':'excerpt-clamped'} lang={r.document.language} dir="auto">{expanded?r.bestPassage.text:sourceExcerpt(r.bestPassage.text,query)}</blockquote>
 <button className="text-button read-more" aria-expanded={expanded} aria-controls={id} onClick={()=>setExpanded(!expanded)}>{expanded?t('readLess'):t('readMore')}<span className="sr-only">: {r.document.title}</span></button>
 <p className="caption">{t('excerpt')} · {r.bestPassage.page?`${t('page')} ${r.bestPassage.page}`:t('pageUnknown')} · {t(r.document.textSource.endsWith('.md')?'md':r.document.format==='pdf'?'pdfText':'htmlText')}</p>
 <button className="primary open-document" data-document-id={r.document.id} onClick={()=>onOpen(r)}>{t('open')} <SourceArrow/></button></article>;
}
export function sourceExcerpt(text:string,query:string){
 const terms=query.toLowerCase().match(/[\p{L}\p{N}]+/gu)??[];const positions=terms.map(t=>text.toLowerCase().indexOf(t)).filter(n=>n>=0);const position=positions.length?Math.min(...positions):0;
 let start=Math.max(0,position-120);if(start){const boundary=text.indexOf(' ',start);if(boundary<position)start=boundary+1;}
 let end=Math.min(text.length,start+650);if(end<text.length){const boundary=text.lastIndexOf(' ',end);if(boundary>start)end=boundary;}
 return(start?'…':'')+text.slice(start,end).trim()+(end<text.length?'…':'');
}
