import {useEffect,useRef,useState} from 'react';
import {loadPack,type LoadedPack} from './data/loadCorpus';
import {createSearchService} from './search/searchDocuments';
import type {SearchResult} from './types/corpus';
import {SourceArrow,BookIcon} from './components/Icons';
import ResultsList from './components/ResultsList';
import DocumentReader from './components/DocumentReader';

export default function App(){
 const [pack,setPack]=useState<LoadedPack|null>(null),[error,setError]=useState('');
 const [query,setQuery]=useState(''),[language,setLanguage]=useState(''),[genre,setGenre]=useState('');
 const [results,setResults]=useState<SearchResult[]>([]),[searched,setSearched]=useState(false),[count,setCount]=useState(3),[busy,setBusy]=useState(false);
 const [selected,setSelected]=useState<SearchResult|null>(null);
 const search=useRef<ReturnType<typeof createSearchService>|null>(null), requestId=useRef(0),scroll=useRef(0), opener=useRef<string|null>(null);
 useEffect(()=>{let active=true;loadPack().then(p=>{if(active){search.current=createSearchService(p.corpus);setPack(p);}}).catch(e=>{if(active)setError(String(e.message));});return()=>{active=false;};},[]);
 useEffect(()=>{
  const onPop=()=>{setSelected(null);requestAnimationFrame(()=>{window.scrollTo(0,scroll.current);document.querySelector<HTMLButtonElement>(`[data-document-id="${CSS.escape(opener.current??'')}"]`)?.focus({preventScroll:true});});};
  window.addEventListener('popstate',onPop);return()=>window.removeEventListener('popstate',onPop);
 },[]);
 async function run(q=query){
  if(!search.current)return;const id=++requestId.current;setBusy(true);
  const found=await search.current.searchDocuments(q,{languages:language?[language]:undefined});
  if(id!==requestId.current)return;
  setResults(genre?found.filter(r=>r.document.genre===genre):found);setCount(3);setSearched(!!q.trim());setBusy(false);
 }
 // Active filters apply immediately, including after a search.
 useEffect(()=>{if(searched)void run();},[language,genre]); // eslint is not required for this milestone
 function open(r:SearchResult){scroll.current=window.scrollY;opener.current=r.document.id;history.pushState({reader:r.document.id},'');setSelected(r);window.scrollTo(0,0);}
 const ready=!!pack;
 return <><header><a className="brand" href={import.meta.env.BASE_URL} aria-label="FieldFind home"><span className="brand-mark" aria-hidden="true">F<SourceArrow/></span>FieldFind</a><span className="header-tag">DOCUMENT FINDER</span></header>
 {selected&&pack?<DocumentReader result={selected} pack={pack} onBack={()=>history.back()}/>:<main>
  <div className="intro"><p className="eyebrow">YOUR SOURCES. WITHIN REACH.</p><h1>Find a document.</h1><p className="lead">Search the sample collection. Read the source.<br className="desktop-break"/> Keep the full context.</p></div>
  <section className="search-panel" aria-label="Document search"><form onSubmit={e=>{e.preventDefault();void run();}}>
   <label htmlFor="query">What are you looking for?</label><div className="search-row"><input id="query" type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Try “protected persons”" disabled={!ready} autoComplete="off"/><button className="primary search-button" disabled={!ready||busy} type="submit">Search <span aria-hidden="true">→</span></button></div>
   <p className="search-help">Search uses words in the documents. Try the source language.</p>
  </form>
  <div className="try-queries"><span>Try a search</span>{['Protected persons','vaccine pricing','الكوليرا'].map(q=><button className="chip" disabled={!ready} key={q} onClick={()=>{setQuery(q);void run(q);}} dir="auto">{q} <SourceArrow/></button>)}</div>
  <details className="filters"><summary>Narrow results{language||genre?' · Filters active':''}</summary><div className="filter-grid"><label>Source language<select value={language} onChange={e=>setLanguage(e.target.value)}><option value="">All languages</option>{[...new Set(pack?.corpus.documents.map(d=>d.language)??[])].map(l=><option key={l} value={l}>{l==='ar'?'Arabic':l==='en'?'English':l}</option>)}</select></label><label>Document genre<select value={genre} onChange={e=>setGenre(e.target.value)}><option value="">All genres</option>{[...new Set(pack?.corpus.documents.map(d=>d.genre)??[])].map(g=><option key={g}>{g}</option>)}</select></label></div></details>
  {(language||genre)&&<div className="active-filters"><span>Filters: {[language,genre].filter(Boolean).join(' · ')}</span><button className="text-button" onClick={()=>{setLanguage('');setGenre('');}}>Clear filters</button></div>}
  </section>
  <div className="status-line" role="status"><span className={error?'dot error':'dot'}/>{error?error:ready?`${pack.corpus.documents.length} documents · Search runs on this device`:'Loading and checking sample collection…'}</div>
  {error&&<button className="secondary" onClick={()=>location.reload()}>Try loading again</button>}
  <section aria-label="Search results"><div className="results-heading"><h2>{searched?'Search results':'A small collection. A clear starting point.'}</h2><p aria-live="polite" aria-atomic="true">{busy?'Searching…':searched?`${results.length} ${results.length===1?'document':'documents'} found`:''}</p></div>
  {searched?<>{results.length?<><p className="caption">Exact source excerpts, grouped by document. Ranked by word relevance.</p><ResultsList results={results.slice(0,count)} query={query} onOpen={open}/>{count<results.length&&<button className="secondary more" onClick={()=>setCount(c=>c+3)}>Show more documents ({results.length-count} remaining)</button>}</>:<div className="empty"><h3>No matching documents</h3><p>Try fewer words or a term in the source language. This sample may not contain what you need.</p></div>}</>:<div className="collection-note"><span className="note-icon"><BookIcon/></span><div><h3>10 documents. Original sources included.</h3><p>Humanitarian law, vaccine and TB pricing, research, and field reporting in English and Arabic. Enter a query to see excerpts and open a source.</p></div></div>}
  </section>
  <details className="collection-details"><summary>About this sample & data notes</summary><p>Only the 10 supplied originals are indexed. Markdown and original files count as one document. CSV IDs, genres and languages are preserved. The 14-file list in data.md describes a different sample; missing listed documents are not invented.</p><p>Some search text has no verified page mapping. HTML safe views omit remote pictures and active content; original downloads retain supplied bytes. Tables and extraction order require visual review.</p><p>This milestone has no installed app or offline storage. Source opening needs access to the locally served pack. No cloud search API, translation, chat or medical advice.</p><a href={`${import.meta.env.BASE_URL}packs/demo/ingestion-report.json`} download>Download ingestion report</a></details>
 </main>}
 <footer><span>FieldFind <span aria-hidden="true">/</span> Sample edition</span><span>Find information. Check the original.</span></footer></>;
}
