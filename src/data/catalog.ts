import Papa from 'papaparse';
export interface CatalogRow {id:string;genre:string;language:string;[key:string]:string}
export function parseCatalog(csv:string):CatalogRow[]{
 const parsed=Papa.parse<Record<string,string>>(csv.replace(/^\uFEFF/,''),{header:true,skipEmptyLines:'greedy'});
 if(parsed.errors.length)throw new Error(`CSV could not be read: ${parsed.errors[0].message}`);
 for(const field of ['id','genre','language'])if(!parsed.meta.fields?.includes(field))throw new Error(`CSV needs an ${field} column (expected id,genre,language).`);
 const seen=new Set<string>();
 for(const row of parsed.data){if(!/^[A-Za-z0-9_-]+$/.test(row.id))throw new Error(`CSV ID is empty or unsafe: ${row.id}`);if(seen.has(row.id.toLowerCase()))throw new Error(`Duplicate CSV ID: ${row.id}`);seen.add(row.id.toLowerCase());}
 return parsed.data as CatalogRow[];
}
