import {validateCorpus,validateManifest,verifyBytes} from './validateCorpus';
import type {Corpus} from '../types/corpus';
const base = `${import.meta.env.BASE_URL}packs/demo/`;
export interface LoadedPack {corpus:Corpus; read:(path:string)=>Promise<ArrayBuffer>; mode:'served'|'local'; notices:string[]}
export async function loadPack():Promise<LoadedPack>{
  const response=await fetch(base+'manifest.json',{signal:AbortSignal.timeout(15000)}).catch(()=>{throw new Error('The sample pack could not be reached. Choose your local files above to start searching.');});
  const text=await response.text();
  if(!response.ok||/^\s*</.test(text)) throw new Error('No sample documents are loaded. Choose your supplied sample files below to enable search and filters.');
  let parsed:unknown;
  try {parsed=JSON.parse(text);}catch{throw new Error('The sample manifest is not valid JSON. Choose your sample files below, or regenerate the local pack.');}
  const manifest=validateManifest(parsed);
  async function read(path:string){
    const entry=manifest.files.find(f=>f.path===path);
    if(!entry) throw new Error('File is not registered in the manifest');
    const res=await fetch(base+path,{signal:AbortSignal.timeout(30000)});
    if(!res.ok) throw new Error('Source file could not be loaded');
    const bytes=await res.arrayBuffer(); await verifyBytes(bytes,entry); return bytes;
  }
  let json:unknown;
  try{json=JSON.parse(new TextDecoder().decode(await read('corpus.json')));}catch(e){
    if(e instanceof SyntaxError)throw new Error('The searchable text file is not valid JSON. Reload the sample files or regenerate the pack.');throw e;
  }
  const corpus=validateCorpus(json);
  if(corpus.packId!==manifest.packId||corpus.version!==manifest.version) throw new Error('Pack version mismatch');
  for(const d of corpus.documents){
    const f=manifest.files.find(f=>f.path===d.sourcePath);
    if(!f||f.sha256!==d.sourceSha256||f.bytes!==d.sourceBytes|| (d.viewerPath&&!manifest.files.some(f=>f.path===d.viewerPath))) throw new Error('Source metadata mismatch');
  }
  return {corpus,read,mode:'served',notices:[]};
}
