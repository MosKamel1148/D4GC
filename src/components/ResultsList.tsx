import {SourceArrow} from './Icons';
import type {SearchResult} from '../types/corpus';
export default function ResultsList({results,query,onOpen}:{results:SearchResult[];query:string;onOpen:(result:SearchResult)=>void}){
 return <div className="results">{results.map((r,i)=><article className="result" key={r.document.id}>
  <div className="result-top"><span className="eyebrow">{String(i+1).padStart(2,'0')} / {r.document.genre}</span><span className="language" lang="en">{r.document.language==='ar'?'Arabic · العربية':r.document.language==='en'?'English':r.document.language}</span></div>
  <h3 dir="auto" lang={r.document.language}>{r.document.title}</h3>
  <p className="meta">{r.document.id} · {r.document.format.toUpperCase()}{r.document.publicationYear!==null?` · ${r.document.publicationYear}`:' · Year unverified'}</p>
  {r.bestPassage.heading&&<p className="passage-heading" dir="auto">{r.bestPassage.heading}</p>}
  <blockquote lang={r.document.language} dir="auto">{sourceExcerpt(r.bestPassage.text,query)}</blockquote>
  <p className="caption">Source excerpt · {r.bestPassage.page?`PDF file page ${r.bestPassage.page}`:'Page reference unavailable'} · {r.document.textSource.endsWith('.md')?'Supplied Markdown':'Extracted HTML'}</p>
  <button className="primary open-document" data-document-id={r.document.id} onClick={()=>onOpen(r)}>Open document <SourceArrow/></button>
 </article>)}</div>;
}

export function sourceExcerpt(text:string,query:string){
 const terms=query.toLowerCase().match(/[\p{L}\p{N}]+/gu)??[];
 const positions=terms.map(t=>text.toLowerCase().indexOf(t)).filter(n=>n>=0);
 const position=positions.length?Math.min(...positions):0;
 let start=Math.max(0,position-120);
 if(start){const boundary=text.indexOf(' ',start);if(boundary<position)start=boundary+1;}
 let end=Math.min(text.length,start+650);
 if(end<text.length){const boundary=text.lastIndexOf(' ',end);if(boundary>start)end=boundary;}
 return (start?'…':'')+text.slice(start,end).trim()+(end<text.length?'…':'');
}
