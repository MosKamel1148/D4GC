import {useEffect,useRef,useState} from 'react';
import {loadPack,type LoadedPack} from './data/loadCorpus';
import {loadLocalSample} from './data/localSample';
import {createSearchService} from './search/searchDocuments';
import type {SearchResult} from './types/corpus';
import {SourceArrow,BookIcon} from './components/Icons';
import ResultsList from './components/ResultsList';
import DocumentReader from './components/DocumentReader';

export default function App(){
 const [pack,setPack]=useState<LoadedPack|null>(null),[error,setError]=useState('');
 const [query,setQuery]=useState(''),[language,setLanguage]=useState(''),[genre,setGenre]=useState('');
 const [results,setResults]=useState<SearchResult[]>([]),[searched,setSearched]=useState(false),[count,setCount]=useState(3),[busy,setBusy]=useState(false);
 const [importing,setImporting]=useState(false),[submittedQuery,setSubmittedQuery]=useState(''),[loadProgress,setLoadProgress]=useState('');
 const [selected,setSelected]=useState<SearchResult|null>(null);
 const loadGeneration=useRef(0);
 const search=useRef<ReturnType<typeof createSearchService>|null>(null), requestId=useRef(0),scroll=useRef(0), opener=useRef<string|null>(null);
 useEffect(()=>{let active=true;const generation=++loadGeneration.current;loadPack().then(p=>{if(active&&generation===loadGeneration.current){search.current=createSearchService(p.corpus);setPack(p);}}).catch(e=>{if(active&&generation===loadGeneration.current)setError(String(e.message));});return()=>{active=false;};},[]);
 useEffect(()=>{
  const onPop=()=>{setSelected(null);requestAnimationFrame(()=>{window.scrollTo(0,scroll.current);document.querySelector<HTMLButtonElement>(`[data-document-id="${CSS.escape(opener.current??'')}"]`)?.focus({preventScroll:true});});};
  window.addEventListener('popstate',onPop);return()=>window.removeEventListener('popstate',onPop);
 },[]);
 async function run(q=query){
  if(!search.current)return;const id=++requestId.current;setBusy(true);
  const found=await search.current.searchDocuments(q,{languages:language?[language]:undefined});
  if(id!==requestId.current)return;
  setSubmittedQuery(q);setResults(genre?found.filter(r=>r.document.genre===genre):found);setCount(3);setSearched(!!q.trim());setBusy(false);
 }
 // Active filters apply immediately, including after a search.
 useEffect(()=>{if(searched)void run(submittedQuery);},[language,genre]); // eslint is not required for this milestone
 function open(r:SearchResult){scroll.current=window.scrollY;opener.current=r.document.id;history.pushState({reader:r.document.id},'');setSelected(r);window.scrollTo(0,0);}
 async function chooseFiles(files:File[]){
  ++loadGeneration.current;setImporting(true);setError('');setLoadProgress('Reading selected files…');
  try{const next=await loadLocalSample(files,setLoadProgress);const service=createSearchService(next.corpus);++requestId.current;search.current=service;setPack(next);setQuery('');setSubmittedQuery('');setLanguage('');setGenre('');setResults([]);setSearched(false);setCount(3);setBusy(false);}
  catch(e){setError((e instanceof Error?e.message:'Could not read these files.')+(pack?' Your previous collection is still loaded.':''));}
  finally{setImporting(false);setLoadProgress('');}
 }
 async function downloadReport(){
  if(!pack)return;
  try{const url=URL.createObjectURL(new Blob([await pack.read('ingestion-report.json')],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='ingestion-report.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){setError(e instanceof Error?e.message:'Report is not available.');}
 }
 const ready=!!pack;
 return <><header><a className="brand" href={import.meta.env.BASE_URL} aria-label="FieldFind home"><span className="brand-mark" aria-hidden="true">F<SourceArrow/></span>FieldFind</a><span className="header-tag">DOCUMENT FINDER</span></header>
 {selected&&pack?<DocumentReader result={selected} pack={pack} onBack={()=>history.back()}/>:<main>
  <div className="intro"><p className="eyebrow">YOUR SOURCES. WITHIN REACH.</p><h1>Find a document.</h1><p className="lead">Search the sample collection. Read the source.<br className="desktop-break"/> Keep the full context.</p></div>
  <section className="sample-loader" aria-label="Load sample documents">
   <details open={!ready}><summary>{ready?'Choose different documents':'Load your documents'}</summary>
   <p>This GitHub download contains the app, but not the private sample documents. Choose your document folder or select PDF/HTML files. They stay on your computer.</p>
   <label htmlFor="sample-files">Choose documents</label><input id="sample-files" type="file" multiple accept=".pdf,.html,.htm,.md" disabled={importing} onChange={e=>{const files=Array.from(e.target.files??[]);e.target.value='';if(files.length)void chooseFiles(files);}}/>
   <label htmlFor="document-folder">Choose document folder</label><input id="document-folder" ref={el=>{if(el)el.setAttribute('webkitdirectory','');}} type="file" multiple disabled={importing} onChange={e=>{const files=Array.from(e.target.files??[]);e.target.value='';if(files.length)void chooseFiles(files);}}/>
   <p className="caption">Select your PDF/HTML originals (Ctrl-click or Ctrl+A). Include matching Markdown if you have it; otherwise PDF text is extracted on this computer. Download suffixes such as “P25 (1).html” are accepted. No backend or Python needed.</p>
   <p className="caption">Files are held in this tab only. Choose them again after refreshing. {importing?loadProgress:''}</p>
   </details>
   {pack?.notices.some(n=>n.startsWith('Not indexed'))&&<details open className="import-warnings"><summary>Some files could not be indexed</summary><ul>{pack.notices.filter(n=>n.startsWith('Not indexed')).map(n=><li key={n}>{n}</li>)}</ul><p>The other documents are searchable. Correct these files and select the full collection again to include them.</p></details>}
   {pack?.mode==='local'&&<p role="status">{pack.corpus.documents.length} local documents loaded. Files stay in this tab; nothing was uploaded.</p>}
  </section>
  <section className="search-panel" aria-label="Document search"><form onSubmit={e=>{e.preventDefault();void run();}}>
   <label htmlFor="query">What are you looking for?</label><div className="search-row"><input id="query" type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Try “protected persons”" disabled={importing} autoComplete="off"/><button className="primary search-button" disabled={!ready||busy||importing} type="submit">Search <span aria-hidden="true">→</span></button></div>
   <p className="search-help">Search uses words in the documents. Try the source language.</p>
  </form>
  <div className="try-queries"><span>Try a search</span>{['Protected persons','vaccine pricing','الكوليرا'].map(q=><button className="chip" disabled={!ready||importing} key={q} onClick={()=>{setQuery(q);void run(q);}} dir="auto">{q} <SourceArrow/></button>)}</div>
  <details className="filters"><summary>Narrow results{language||genre?' · Filters active':''}</summary><div className="filter-grid"><label>Source language<select disabled={!ready||importing} value={language} onChange={e=>setLanguage(e.target.value)}><option value="">All languages</option>{[...new Set(pack?.corpus.documents.map(d=>d.language)??[])].map(l=><option key={l} value={l}>{l==='ar'?'Arabic':l==='en'?'English':l==='und'?'Unknown language':l}</option>)}</select></label><label>Document genre<select disabled={!ready||importing} value={genre} onChange={e=>setGenre(e.target.value)}><option value="">All genres</option>{[...new Set(pack?.corpus.documents.map(d=>d.genre)??[])].map(g=><option key={g}>{g}</option>)}</select></label></div></details>
  {(language||genre)&&<div className="active-filters"><span>Filters: {[language,genre].filter(Boolean).join(' · ')}</span><button className="text-button" onClick={()=>{setLanguage('');setGenre('');}}>Clear filters</button></div>}
  </section>
  <div className="status-line" role="status"><span className={error?'dot error':'dot'}/>{importing?loadProgress:error?error:ready?`${pack.corpus.documents.length} documents · Search runs on this device`:'Loading and checking sample collection…'}</div>
  {error&&<button className="secondary" onClick={()=>location.reload()}>Try loading again</button>}
  <section aria-label="Search results"><div className="results-heading"><h2>{searched?'Search results':'A small collection. A clear starting point.'}</h2><p aria-live="polite" aria-atomic="true">{busy?'Searching…':searched?`${results.length} ${results.length===1?'document':'documents'} found`:''}</p></div>
  {searched?<>{results.length?<><p className="caption">Exact source excerpts, grouped by document. Ranked by word relevance.</p><ResultsList results={results.slice(0,count)} query={submittedQuery} onOpen={open}/>{count<results.length&&<button className="secondary more" onClick={()=>setCount(c=>c+3)}>Show more documents ({results.length-count} remaining)</button>}</>:<div className="empty"><h3>No matching documents</h3><p>Try fewer words or a term in the source language. This sample may not contain what you need.</p></div>}</>:<div className="collection-note"><span className="note-icon"><BookIcon/></span><div><h3>{pack?`${pack.corpus.documents.length} documents. Original sources included.`:'Load documents to start searching.'}</h3><p>Humanitarian law, vaccine and TB pricing, research, and field reporting in English and Arabic. Enter a query to see excerpts and open a source.</p></div></div>}
  </section>
  <details className="collection-details"><summary>About this sample & data notes</summary><p>All selected PDF/HTML documents can be indexed. Matching IDs use the full supplied CSV catalog; missing metadata is marked unknown. Markdown and original files count as one document. CSV IDs, genres and languages are preserved. The 14-file list in data.md describes a different sample; missing listed documents are not invented.</p><p>Some search text has no verified page mapping. HTML safe views omit remote pictures and active content; original downloads retain supplied bytes. Tables and extraction order require visual review.</p><p>This milestone has no installed app or offline storage. Sources come from the locally served pack or the files selected in this tab. No cloud search API, translation, chat or medical advice.</p><ul>{pack?.notices.map(n=><li key={n}>{n}</li>)}</ul>{pack&&<button className="secondary" onClick={()=>void downloadReport()}>Download ingestion report</button>}</details>
 </main>}
 <footer><span>FieldFind <span aria-hidden="true">/</span> Build 0.1.2 · Local PDF loading</span><span>Find information. Check the original.</span></footer></>;
}
