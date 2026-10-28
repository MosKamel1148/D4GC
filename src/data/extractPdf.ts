import {getDocument,GlobalWorkerOptions} from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
GlobalWorkerOptions.workerSrc=workerUrl;
export async function extractPdf(bytes:ArrayBuffer,onProgress:(message:string)=>void){
 const assets=new URL(`${import.meta.env.BASE_URL}pdfjs-assets/`,location.origin).href;
 // Copy first: the worker transfers/detaches its input; originals must stay intact.
 const task=getDocument({data:new Uint8Array(bytes.slice(0)),cMapUrl:assets+'cmaps/',cMapPacked:true,standardFontDataUrl:assets+'standard_fonts/',wasmUrl:assets+'wasm/',iccUrl:assets+'iccs/'});
 const timeout=setTimeout(()=>void task.destroy(),30000);
 try{
  const pdf=await task.promise;
  const units:{text:string;heading:null;page:number}[]=[];const warnings:string[]=[];
  for(let page=1;page<=pdf.numPages;page++){
   onProgress(`Extracting PDF page ${page} of ${pdf.numPages}…`);
   const p=await pdf.getPage(page);const content=await p.getTextContent();
   const text=content.items.map(item=>'str' in item?item.str+(item.hasEOL?'\n':' '):'').join('').trim();
   if(text.length<80)warnings.push(`Sparse extracted text on physical page ${page}; check the original. OCR may be needed.`);
   if(text)units.push({text,heading:null,page});p.cleanup();
  }
  if(!units.length)throw new Error('This PDF has no extractable text. Select its Markdown companion or preprocess it with OCR locally.');
  return {units,pageCount:pdf.numPages,warnings};
 }finally{clearTimeout(timeout);await task.destroy();}
}
