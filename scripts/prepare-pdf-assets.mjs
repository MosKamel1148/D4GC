import {cpSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const source=path.dirname(fileURLToPath(import.meta.resolve('pdfjs-dist/package.json')));
const target=path.join(root,'public/pdfjs-assets');mkdirSync(target,{recursive:true});
for(const name of ['cmaps','standard_fonts','wasm','iccs','LICENSE'])cpSync(path.join(source,name),path.join(target,name),{recursive:true});
console.log('Prepared local PDF.js fonts, character maps and codecs.');
