import {validateCorpus,validateManifest,verifyBytes} from './validateCorpus';
const base = `${import.meta.env.BASE_URL}packs/demo/`;
export async function loadPack(){
  const response=await fetch(base+'manifest.json');
  if(!response.ok) throw new Error('Sample pack is missing. Run the local ingestion command first.');
  const manifest=validateManifest(await response.json());
  async function read(path:string){
    const entry=manifest.files.find(f=>f.path===path);
    if(!entry) throw new Error('File is not registered in the manifest');
    const res=await fetch(base+path);
    if(!res.ok) throw new Error('Source file could not be loaded');
    const bytes=await res.arrayBuffer(); await verifyBytes(bytes,entry); return bytes;
  }
  const corpus=validateCorpus(JSON.parse(new TextDecoder().decode(await read('corpus.json'))));
  if(corpus.packId!==manifest.packId||corpus.version!==manifest.version) throw new Error('Pack version mismatch');
  for(const d of corpus.documents){
    const f=manifest.files.find(f=>f.path===d.sourcePath);
    if(!f||f.sha256!==d.sourceSha256||f.bytes!==d.sourceBytes|| (d.viewerPath&&!manifest.files.some(f=>f.path===d.viewerPath))) throw new Error('Source metadata mismatch');
  }
  return {corpus,read};
}
export type LoadedPack=Awaited<ReturnType<typeof loadPack>>;
