import MiniSearch from 'minisearch';
import type {Corpus,DocumentRecord,SearchFilters,SearchResult} from '../types/corpus';
export type Occupation='all'|'medical'|'engineering'|'coordination';
export const normalize=(text:string)=>text.normalize('NFKC').toLowerCase().replace(/[\u064B-\u065F\u0670\u0640]/g,'');
const tokens=(text:string)=>normalize(text).match(/[\p{L}\p{N}]+/gu)??[];
const noise=new Set(['the','a','an','for','of','in','to','and','what','is','are','who','how','do','does','can','i','find','about','please']);
const expanded=(t:string)=>t==='tb'?['tb','tuberculosis']:t==='tuberculosis'?['tuberculosis','tb']:t==='reports'?['reports','report']:t==='report'?['report','reports']:t==='yearly'?['yearly','annual']:t==='annual'?['annual','yearly']:[t];
function roleBoost(d:DocumentRecord,role:Occupation){
 const text=normalize(`${d.title} ${d.genre} ${d.type}`);
 if(role==='medical'&&/clinical|research|drug|vaccine|tuberculosis|medical|cholera|peer.review/.test(text))return 1.5;
 if(role==='engineering'&&/engineer|logistic|infrastructure|construction|shelter|technical/.test(text))return 1.5;
 if(role==='engineering'&&/water|sanitation/.test(text))return 1.15;
 if(role==='coordination'&&/financial|annual|evaluation|activity report|protection|humanitarian|legal/.test(text))return 1.5;
 return 1;
}
export function createSearchService(corpus:Corpus){
 const documents=new Map(corpus.documents.map(d=>[d.id,d]));const passages=new Map(corpus.passages.map(p=>[p.id,p]));
 const index=new MiniSearch({fields:['title','heading','genre','text'],storeFields:['documentId'],tokenize:tokens,processTerm:term=>normalize(term)});
 index.addAll(corpus.passages.map(p=>({...p,title:documents.get(p.documentId)!.title,genre:documents.get(p.documentId)!.genre,heading:p.heading??''})));
 async function searchDocuments(query:string,filters:SearchFilters={},role:Occupation='all'):Promise<SearchResult[]>{
  const terms=[...new Set(tokens(query).filter(t=>!noise.has(t)))];if(!terms.length)return [];
  const candidates=new Map<string,{score:number;coverage:number;related:boolean}>();
  const options={boost:{title:3,heading:1.8,genre:1.2},prefix:(term:string)=>term.length>=4,fuzzy:false};
  const tree={combineWith:'AND' as const,queries:terms.map(t=>({combineWith:'OR' as const,queries:expanded(t)}))};
  const exact=index.search(tree,options);
  for(const hit of exact)candidates.set(String(hit.id),{score:hit.score,coverage:1,related:false});
  // Narrow, inspectable synonym: annual reports may be catalogued as financial reports.
  if((terms.includes('annual')||terms.includes('yearly'))&&(terms.includes('report')||terms.includes('reports'))){
   const other=terms.filter(t=>t!=='annual'&&t!=='yearly');
   for(const hit of index.search({combineWith:'AND',queries:other.map(t=>({combineWith:'OR',queries:expanded(t)}))},options)){
    const p=passages.get(String(hit.id))!;const d=documents.get(p.documentId)!;
    if((d.type==='financial_report'||/financial report/i.test(d.genre))&&!candidates.has(p.id))candidates.set(p.id,{score:hit.score,coverage:.85,related:true});
   }
  }
  // If no passage matches the whole question, require at least half its meaningful terms.
  if(!candidates.size&&terms.length>=3){
   for(const hit of index.search({combineWith:'OR',queries:terms.flatMap(expanded)},options)){
    const p=passages.get(String(hit.id))!;const d=documents.get(p.documentId)!;const searchable=tokens(`${d.title} ${d.genre} ${p.heading??''} ${p.text}`);const set=new Set(searchable);
    const coverage=terms.filter(t=>expanded(t).some(alias=>set.has(alias))).length/terms.length;
    if(coverage>=.6)candidates.set(p.id,{score:hit.score,coverage,related:true});
   }
  }
  const grouped=new Map<string,SearchResult>();
  for(const [id,hit] of candidates){const p=passages.get(id)!;const d=documents.get(p.documentId)!;
   if(filters.types?.length&&!filters.types.includes(d.type)||filters.languages?.length&&!filters.languages.includes(d.language)||filters.publicationYear!==undefined&&d.publicationYear!==filters.publicationYear)continue;
   const title=normalize(d.title);const phrase=normalize(query.trim());
   const score=(hit.score*hit.coverage+(phrase&&title.includes(phrase)?10:0))*roleBoost(d,role)*(hit.related?.65:1);
   const result:SearchResult={document:d,bestPassage:p,score,matchingPassageIds:[id],matchType:hit.related?'related':'all_terms'};
   const current=grouped.get(d.id);
   if(!current)grouped.set(d.id,result);else if((current.matchType==='related'&&result.matchType==='all_terms')||(current.matchType===result.matchType&&score>current.score)){result.matchingPassageIds=[...current.matchingPassageIds,id];grouped.set(d.id,result);}else current.matchingPassageIds.push(id);
  }
  return [...grouped.values()].sort((a,b)=>(a.matchType==='related'?1:0)-(b.matchType==='related'?1:0)||b.score-a.score||a.document.id.localeCompare(b.document.id));
 }
 return {searchDocuments};
}
