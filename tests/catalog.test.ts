import {it,expect} from 'vitest';
import {parseCatalog} from '../src/data/catalog';
it('preserves BOM CSV, quoted commas and extra supplied fields',()=>{
 expect(parseCatalog('\uFEFFid,genre,language,notes\r\nP01,"Research, review",en,"Keep this"\r\n')).toEqual([{id:'P01',genre:'Research, review',language:'en',notes:'Keep this'}]);
});
it.each(['id,genre\nP01,Research','id,genre,language\nP01,A,en\np01,B,fr','id,genre,language\n../bad,A,en'])('rejects missing columns, ambiguous identities and unsafe IDs',csv=>expect(()=>parseCatalog(csv)).toThrow());
it('keeps blank supplied metadata for review rather than inventing it',()=>expect(parseCatalog('id,genre,language\nP01,,')[0]).toEqual({id:'P01',genre:'',language:''}));
