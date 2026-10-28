import {useEffect,useRef,useState} from 'react';
import {loadPack,type LoadedPack} from './data/loadCorpus';
import {loadLocalSample} from './data/localSample';
import {createSearchService,type Occupation} from './search/searchDocuments';
import type {SearchResult} from './types/corpus';
import {SourceArrow,BookIcon} from './components/Icons';
import ResultsList from './components/ResultsList';
import {savePack,restorePack,forgetPack} from './storage/packStore';
import {shellReady} from './offline/status';
import CollectionSummary from './components/CollectionSummary';
import {I18nContext,translate,type Locale} from './i18n';
import DocumentReader from './components/DocumentReader';

export default function App(){
 const [locale,setLocale]=useState<Locale>(()=>{try{const value=localStorage.getItem('fieldfind-language');return value==='fr'||value==='ar'?value:'en';}catch{return 'en';}});
 const t=(key:Parameters<typeof translate>[1])=>translate(locale,key);
 const [manage,setManage]=useState(false),[occupation,setOccupation]=useState<Occupation>('all');
 useEffect(()=>{document.documentElement.lang=locale;document.documentElement.dir=locale==='ar'?'rtl':'ltr';try{localStorage.setItem('fieldfind-language',locale);}catch{/* Language switching still works for this session. */}},[locale]);
 const [pack,setPack]=useState<LoadedPack|null>(null),[error,setError]=useState('');
 const [query,setQuery]=useState(''),[language,setLanguage]=useState(''),[genre,setGenre]=useState('');
 const [results,setResults]=useState<SearchResult[]>([]),[searched,setSearched]=useState(false),[count,setCount]=useState(3),[busy,setBusy]=useState(false);
 const [importing,setImporting]=useState(false),[submittedQuery,setSubmittedQuery]=useState(''),[loadProgress,setLoadProgress]=useState('');
 const [selected,setSelected]=useState<SearchResult|null>(null);
 const loadGeneration=useRef(0),saveGeneration=useRef(0);
 const [saved,setSaved]=useState(false),[storageMessage,setStorageMessage]=useState(''),[offlineShell,setOfflineShell]=useState(false);
 const search=useRef<ReturnType<typeof createSearchService>|null>(null), requestId=useRef(0),scroll=useRef(0), opener=useRef<string|null>(null);
 async function persist(p:LoadedPack){
  const generation=++saveGeneration.current;setSaved(false);setStorageMessage('Saving originals and searchable text on this browser…');
  try{await savePack(p,message=>{if(generation===saveGeneration.current)setStorageMessage(message);},()=>generation===saveGeneration.current);if(generation!==saveGeneration.current)return;setSaved(true);setStorageMessage('Saved on this browser. Originals and text will reopen without selecting files again.');}
  catch(e){if(generation===saveGeneration.current)setStorageMessage(`Not saved: ${e instanceof Error?e.message:'Browser storage failed.'} Search still works in this tab; the previous saved collection was kept.`);}
 }
 function activate(p:LoadedPack){++requestId.current;setResults([]);setSearched(false);setCount(3);setBusy(false);search.current=createSearchService(p.corpus);setPack(p);setError('');if(p.mode==='saved'){setSaved(true);setStorageMessage('Restored saved collection. PDF extraction was not repeated.');}else void persist(p);}
 useEffect(()=>{
  let active=true;const generation=++loadGeneration.current;
  void(async()=>{
   let restored:LoadedPack|null=null;
   try{restored=await restorePack();if(restored&&active&&generation===loadGeneration.current)activate(restored);}catch(e){if(active)setStorageMessage(`Saved collection could not be restored: ${e instanceof Error?e.message:String(e)}`);}
   try{const fresh=await loadPack();if(active&&generation===loadGeneration.current&&(!restored||(restored.origin==='served'&&restored.corpus.version!==fresh.corpus.version)))activate(fresh);}
   catch(e){if(!restored&&active&&generation===loadGeneration.current)setError(String((e as Error).message));}
  })();return()=>{active=false;};
 },[]);
 useEffect(()=>{let active=true;const check=()=>void shellReady().then(ready=>{if(active)setOfflineShell(ready);});check();const timer=setInterval(check,4000);return()=>{active=false;clearInterval(timer);};},[]);

 useEffect(()=>{
  const onPop=()=>{setSelected(null);requestAnimationFrame(()=>{window.scrollTo(0,scroll.current);document.querySelector<HTMLButtonElement>(`[data-document-id="${CSS.escape(opener.current??'')}"]`)?.focus({preventScroll:true});});};
  window.addEventListener('popstate',onPop);return()=>window.removeEventListener('popstate',onPop);
 },[]);
 async function run(q=query){
  if(!search.current)return;const id=++requestId.current;setBusy(true);
  const found=await search.current.searchDocuments(q,{languages:language?[language]:undefined},occupation);
  if(id!==requestId.current)return;
  setSubmittedQuery(q);setResults(genre?found.filter(r=>r.document.genre===genre):found);setCount(3);setSearched(!!q.trim());setBusy(false);
 }
 // Active filters apply immediately, including after a search.
 useEffect(()=>{if(searched)void run(submittedQuery);},[language,genre,occupation]); // eslint is not required for this milestone
 function open(r:SearchResult){scroll.current=window.scrollY;opener.current=r.document.id;history.pushState({reader:r.document.id},'');setSelected(r);window.scrollTo(0,0);}
 async function chooseFiles(files:File[]){
  ++loadGeneration.current;setImporting(true);setError('');setLoadProgress('Reading selected files…');
  try{const next=await loadLocalSample(files,setLoadProgress);++requestId.current;activate(next);setQuery('');setSubmittedQuery('');setLanguage('');setGenre('');setResults([]);setSearched(false);setCount(3);setBusy(false);}
  catch(e){setError((e instanceof Error?e.message:'Could not read these files.')+(pack?' Your previous collection is still loaded.':''));}
  finally{setImporting(false);setLoadProgress('');}
 }
 async function downloadReport(){
  if(!pack)return;
  try{const url=URL.createObjectURL(new Blob([await pack.read('ingestion-report.json')],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='ingestion-report.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){setError(e instanceof Error?e.message:'Report is not available.');}
 }
 const ready=!!pack;
 return <I18nContext.Provider value={{locale,t}}><header className="compact-header"><a className="brand" href={import.meta.env.BASE_URL} aria-label="FieldFind home"><span className="brand-mark" aria-hidden="true">F<SourceArrow/></span>FieldFind</a><div className="header-actions"><label className="app-language">{t('appLanguage')}<select value={locale} onChange={e=>setLocale(e.target.value as Locale)}><option value="en">English</option><option value="fr">Français</option><option value="ar">العربية</option></select></label><button className="secondary" aria-expanded={manage} aria-controls="manage-documents" onClick={()=>{if(selected){history.back();setSelected(null);}setManage(!manage);}}>{t('manage')}</button></div></header>
 {selected&&pack?<DocumentReader result={selected} pack={pack} onBack={()=>history.back()}/>:<main className="search-home">
 <h1 className="sr-only">Find a document</h1>
 <section className="search-panel" aria-label="Document search"><form onSubmit={e=>{e.preventDefault();void run();}}><label htmlFor="query">{t('query')}</label><div className="search-row"><input id="query" type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder={t('placeholder')} disabled={importing} autoComplete="off"/><button className="primary search-button" disabled={!ready||busy||importing} type="submit">{t('search')} <span aria-hidden="true">→</span></button></div><p className="search-help">{t('help')}</p></form>
 <div className="try-queries"><span>Try a search</span>{['Protected persons','vaccine pricing','الكوليرا'].map(q=><button className="chip" disabled={!ready||importing} key={q} onClick={()=>{setQuery(q);void run(q);}} dir="auto">{q} <SourceArrow/></button>)}</div>
 <div className="occupation"><label>{t('role')}<select value={occupation} onChange={e=>setOccupation(e.target.value as Occupation)}><option value="all">{t('allRoles')}</option><option value="medical">{t('medical')}</option><option value="engineering">{t('engineering')}</option><option value="coordination">{t('coordination')}</option></select></label><p className="caption">{t('roleHelp')}</p></div>
 <details className="filters"><summary>{t('filters')}{language||genre||occupation!=='all'?` · ${t('active')}`:''}</summary><div className="filter-grid"><label>{t('sourceLanguage')}<select disabled={!ready||importing} value={language} onChange={e=>setLanguage(e.target.value)}><option value="">{t('allLanguages')}</option>{[...new Set(pack?.corpus.documents.map(d=>d.language)??[])].map(l=><option key={l} value={l}>{l==='ar'?'Arabic':l==='en'?'English':l==='und'?t('unknown'):l}</option>)}</select></label><label>{t('genre')}<select disabled={!ready||importing} value={genre} onChange={e=>setGenre(e.target.value)}><option value="">{t('allGenres')}</option>{[...new Set(pack?.corpus.documents.map(d=>d.genre)??[])].map(g=><option key={g}>{g}</option>)}</select></label></div></details>
 {(language||genre||occupation!=='all')&&<div className="active-filters"><strong>{t('active')}:</strong> {[language,genre,occupation==='all'?'':t(occupation)].filter(Boolean).map(v=><span className="filter-pill" key={v}>{v}</span>)}<button className="text-button" onClick={()=>{setLanguage('');setGenre('');setOccupation('all');}}>{t('clear')}</button></div>}
 </section>
 <div className="status-line" role="status"><span className={error?'dot error':'dot'}/>{importing?loadProgress:error?error:ready?`${pack.corpus.documents.length} ${pack.mode==='local'&&locale==='en'?'local documents loaded':t('count')}`:t('loading')}</div>
 {pack&&<div className="compact-readiness"><h2 className={saved&&offlineShell?"readiness-title":"sr-only"}>{saved&&offlineShell?t('offline'):saved?t('saved'):storageMessage.startsWith('Not saved:')?t('session'):t('saving')}</h2><p role="status">{storageMessage.startsWith('Not saved:')?storageMessage:saved?(pack.mode==='saved'&&locale==='en'?'Restored saved collection.':t('saved')+'.'):t('saving')}</p>{!offlineShell&&<span className="caption">{t('shellPending')}</span>}</div>}
 {!ready&&!importing&&<p className="caption">{t('filesHelp')}</p>}
 <section id="manage-documents" hidden={!manage} className="manage-panel" aria-label={t('manage')}><div className="results-heading"><h2>{t('manage')}</h2><button className="text-button" onClick={()=>setManage(false)}>{t('closeManage')}</button></div><p>{t('filesHelp')}</p>
 <section className="sample-loader" aria-label="Load sample documents"><label htmlFor="sample-files">{t('files')}</label><input id="sample-files" type="file" multiple accept=".pdf,.html,.htm,.md,.csv" disabled={importing} onChange={e=>{const files=Array.from(e.target.files??[]);e.target.value='';if(files.length)void chooseFiles(files);}}/><label htmlFor="document-folder">{t('folder')}</label><input id="document-folder" ref={el=>{if(el)el.setAttribute('webkitdirectory','');}} type="file" multiple disabled={importing} onChange={e=>{const files=Array.from(e.target.files??[]);e.target.value='';if(files.length)void chooseFiles(files);}}/>
 <p className="caption">PDF/HTML + optional Markdown + one CSV (id,genre,language). Text extraction runs locally. CSV entries without files are reported, not invented.</p></section>
 {pack&&<><CollectionSummary pack={pack}/><details className="storage-status"><summary>{t('moreDetails')}</summary><p>{storageMessage}</p><p>{t('storageHelp')}</p><p>{offlineShell?'App shell cache was checked.':'Offline app shell is not verified. Use the production build on localhost or HTTPS; development mode does not install the offline shell.'}</p><div className="source-actions"><button className="secondary" onClick={()=>void(async()=>{++loadGeneration.current;try{activate(await loadPack());}catch(e){setError((e as Error).message);}})()}>{t('reload')}</button><button className="secondary" onClick={()=>void(async()=>{try{const granted=await navigator.storage?.persist?.();setStorageMessage(granted?'Durable browser storage granted; manual deletion can still remove it.':'Durable storage was not granted. Saved data works but may be evicted under storage pressure.');}catch(e){setStorageMessage(`Storage permission failed: ${(e as Error).message}`);}})()}>{t('durable')}</button><button className="secondary" onClick={()=>void(async()=>{if(!window.confirm('Remove the saved browser copy? Original files in documents/ are unchanged. The prepared folder can be loaded again.'))return;try{++saveGeneration.current;await forgetPack();setSaved(false);setStorageMessage('Not saved: browser copy removed. Current tab still has the collection.');}catch(e){setStorageMessage(`Removal failed: ${(e as Error).message}`);}})()}>{t('remove')}</button><button className="secondary" onClick={()=>void downloadReport()}>{t('report')}</button></div><ul>{pack.notices.map(n=><li key={n}>{n}</li>)}</ul></details></>}
 {locale!=='en'&&<p className="caption">{t('translationNote')}</p>}</section>
 <section aria-label="Search results"><div className="results-heading"><h2>{searched?t('results'):t('start')}</h2><p aria-live="polite" aria-atomic="true">{busy?'…':searched?`${results.length} ${t('found')}`:''}</p></div>
 {searched?(results.length?<><ResultsList results={results.slice(0,count)} query={submittedQuery} onOpen={open}/>{count<results.length&&<button className="secondary more" onClick={()=>setCount(c=>c+3)}>{t('more')} ({results.length-count})</button>}</>:<div className="empty"><h3>{t('noResults')}</h3><p>{t('noResultsHelp')}</p>{pack?.stats?.missingSources? <p>{pack.stats.missingSources} {t('missing')}. Only indexed originals can appear in search.</p>:null}</div>):<p className="lead">{t('startHelp')}</p>}
 </section></main>}
 <footer><span>FieldFind / Build 0.2.0</span><span>{t('help')}</span></footer></I18nContext.Provider>;
}
