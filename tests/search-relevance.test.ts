import {it,expect} from 'vitest';
import synthetic from './fixtures/synthetic.json';
import {validateCorpus} from '../src/data/validateCorpus';
import {createSearchService} from '../src/search/searchDocuments';
function service(records:{id:string;title:string;genre:string;type?:string;text:string}[]){
 return createSearchService(validateCorpus({...synthetic,documents:records.map(r=>({...synthetic.documents[0],id:r.id,title:r.title,genre:r.genre,type:r.type??'reference',sourcePath:`sources/${r.id}.html.txt`,suppliedMetadata:{id:r.id,genre:r.genre,language:'en'}})),passages:records.map(r=>({...synthetic.passages[0],id:r.id+':0',documentId:r.id,text:r.text}))}));
}
it('annual report finds a financial report without relabelling pricing reports as annual reports',async()=>{
 const search=service([{id:'financial',title:'Synthetic International Financial Report 2021',genre:'Financial Report',type:'financial_report',text:'Synthetic financial statements and accounts for 2021.'},{id:'pricing',title:'Synthetic vaccine pricing report',genre:'Advocacy Brief',type:'pricing_report',text:'Synthetic medicine pricing report.'}]);
 const results=await search.searchDocuments('annual report 2021');expect(results.map(r=>r.document.id)).toEqual(['financial']);expect(results[0].matchType).toBe('related');expect((await search.searchDocuments('yearly reports 2021'))[0].document.id).toBe('financial');expect(await search.searchDocuments('annual report 2020')).toEqual([]);
});
it('occupation prioritises relevant matches without hiding other documents',async()=>{
 const search=service([{id:'clinical',title:'Water supply clinical report',genre:'Reference',text:'Synthetic water supply fixture.'},{id:'engineering',title:'Water supply engineering report',genre:'Reference',text:'Synthetic water supply fixture.'}]);
 expect((await search.searchDocuments('water supply',{},'medical'))[0].document.id).toBe('clinical');const engineer=await search.searchDocuments('water supply',{},'engineering');expect(engineer[0].document.id).toBe('engineering');expect(engineer).toHaveLength(2);
});
it('common question words do not block a match and unrelated questions remain empty',async()=>{
 const search=service([{id:'law',title:'Protected persons',genre:'Legal Encyclopedia Entry',text:'Synthetic protected persons source fixture.'}]);expect((await search.searchDocuments('Who are protected persons?'))[0].document.id).toBe('law');expect(await search.searchDocuments('quantum superconducting qubit')).toEqual([]);
});
