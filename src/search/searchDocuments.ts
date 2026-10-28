import MiniSearch from 'minisearch';
import type {Corpus, SearchFilters, SearchResult} from '../types/corpus';
export const normalize=(text:string)=>text.normalize('NFKC').toLowerCase().replace(/[\u064B-\u065F\u0670\u0640]/g,'');
export function createSearchService(corpus:Corpus){
  const documents=new Map(corpus.documents.map(d=>[d.id,d]));
  const passages=new Map(corpus.passages.map(p=>[p.id,p]));
  const index=new MiniSearch({fields:['title','heading','text'],storeFields:['documentId'],tokenize:text=>normalize(text).match(/[\p{L}\p{N}]+/gu)??[],processTerm:term=>normalize(term)});
  index.addAll(corpus.passages.map(p=>({...p,title:documents.get(p.documentId)!.title,heading:p.heading??''})));
  async function searchDocuments(query:string,filters:SearchFilters={}):Promise<SearchResult[]>{
    if(!query.trim()) return [];
    const grouped=new Map<string,SearchResult>();
    const hits=index.search(query,{boost:{title:2,heading:1.5},combineWith:'AND',prefix:term=>term.length>=4,fuzzy:false});
    for(const hit of hits){
      const p=passages.get(String(hit.id))!; const d=documents.get(p.documentId)!;
      if(filters.types?.length&&!filters.types.includes(d.type)||filters.languages?.length&&!filters.languages.includes(d.language)||filters.publicationYear!==undefined&&d.publicationYear!==filters.publicationYear) continue;
      const current=grouped.get(d.id);
      if(current) current.matchingPassageIds.push(p.id);
      else grouped.set(d.id,{document:d,bestPassage:p,score:hit.score,matchingPassageIds:[p.id]});
    }
    return [...grouped.values()].sort((a,b)=>b.score-a.score||a.document.id.localeCompare(b.document.id));
  }
  return {searchDocuments};
}
