"""Local, sample-only ingestion. Source documents are data, never instructions."""
import argparse, csv, hashlib, html, json, re, shutil
from datetime import datetime, timezone
from pathlib import Path
from bs4 import BeautifulSoup
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
IDS = ['P25','P26','P27','P28','P32','P33','P34','Df98e297b5f','Dfa9c0c7a37','Df5738d956a']
def sha(b): return hashlib.sha256(b).hexdigest()
def chunks(text, size=1600):
    # Contiguous slices preserve the supplied text, including punctuation and line breaks.
    start = 0
    while start < len(text):
        end = min(start+size,len(text))
        if end < len(text):
            cut = text.rfind('\n',start+size//2,end)
            if cut < 0: cut = text.rfind(' ',start+size//2,end)
            if cut > start: end = cut
        piece=text[start:end].strip()
        if piece: yield piece
        start=end

def ingest(source, out):
    out.mkdir(parents=True,exist_ok=True); (out/'sources').mkdir(exist_ok=True)
    rows=list(csv.DictReader((ROOT/'metadata/documentation.csv').open(encoding='utf-8-sig')))
    overrides=json.loads((ROOT/'metadata/overrides.json').read_text())
    documents=[]; passages=[]; excluded=[]
    for id in IDS:
        originals=[p for p in source.glob(id+'.*') if p.suffix in ('.pdf','.html')]
        if len(originals)!=1: raise ValueError(f'{id}: expected exactly one original')
        p=originals[0]; raw=p.read_bytes(); fmt=p.suffix[1:]; md=source/(id+'.md')
        matching=[r for r in rows if r['id']==id]
        if len(matching)!=1: raise ValueError(f'{id}: missing or duplicate CSV metadata')
        metadata=matching[0]; warnings=[]; page_count=None; title=id; url=None; viewer=None
        if fmt=='html':
            soup=BeautifulSoup(raw,'html.parser'); h=soup.find('h1')
            title=h.get_text(' ',strip=True) if h else soup.title.get_text(' ',strip=True)
            canonical=soup.select_one('link[rel="canonical"]')
            if canonical and re.match(r'^https://[^\s]+$',canonical.get('href','')): url=canonical['href']
            if id.startswith('P'):
                body=soup.select_one('main article .anchor-links-js')
                selector='main article .anchor-links-js'
            else:
                body=soup.select_one('main .main-content'); selector='main .main-content'
            if body is None: raise ValueError(f'{id}: reviewed article selector missing')
            for x in body.select('script,style,nav,aside,form,footer,iframe,object,embed,.related-block,.carousel,.share,.breadcrumb,.toolkit--share'): x.decompose()
            extraction_body=BeautifulSoup(str(body),'html.parser')
            # Allowlist a passive standalone view. No scripts, forms, remote resources or links.
            allowed={'div','section','article','p','h1','h2','h3','h4','h5','h6','ul','ol','li','table','thead','tbody','tr','th','td','blockquote','strong','em','b','i','br','sup','sub','figure','figcaption','span','a','img'}
            for x in list(body.find_all(True)):
                if x.name not in allowed: x.unwrap(); continue
                attrs={}
                if x.name in ('th','td'):
                    for key in ('colspan','rowspan'):
                        if str(x.get(key,'')).isdigit(): attrs[key]=x[key]
                if x.name=='img':
                    src=x.get('src','')
                    if re.match(r'^data:image/(png|jpeg|gif|webp);base64,',src): attrs={'src':src,'alt':x.get('alt','')}
                    else:
                        x.replace_with(soup.new_string('[External image omitted from safe view; see downloaded original.]')); continue
                x.attrs=attrs
            for n,x in enumerate(body.select('h1,h2,h3,h4,h5,h6')): x['id']=f'section-{n+1}'
            viewer=f'sources/{id}.view.html'
            safe='<!doctype html><html lang="'+html.escape(metadata['language'])+'" dir="auto"><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data:; style-src \'unsafe-inline\'; base-uri \'none\'; form-action \'none\'"><title>'+html.escape(title)+'</title><style>body{font:20px/1.7 system-ui;max-width:80ch;margin:24px auto;padding:16px}img,table{max-width:100%}table{border-collapse:collapse}td,th{border:1px solid;padding:8px}</style><h1>'+html.escape(title)+'</h1>'+str(body)+'</html>'
            (out/viewer).write_text(safe)
            warnings.append('HTML safe view removes executable content, links and remote assets. Download preserves original bytes; external pictures may require their original website.')
            extraction_selector=selector
        else:
            reader=PdfReader(p); page_count=len(reader.pages); title=overrides.get(id,{}).get('title',id)
            extraction_selector=None
        title=overrides.get(id,{}).get('title',title)
        source_path=f'sources/{id}.pdf' if fmt=='pdf' else f'sources/{id}.html.txt'
        (out/source_path).write_bytes(raw)
        units=[]
        if md.exists():
            # Markdown wins. Do not infer physical pages from prose or printed page numbers.
            text=md.read_text(encoding='utf-8'); heading=None; buffer=[]
            for line in text.splitlines(keepends=True):
                if re.match(r'^#{1,6} ',line):
                    if buffer: units.append((''.join(buffer),heading,None,None))
                    heading=line.strip().lstrip('#').strip(); buffer=[]
                else: buffer.append(line)
            if buffer: units.append((''.join(buffer),heading,None,None))
            warnings.append('Search uses supplied Markdown. Physical page/section mapping is unverified; no page links are inferred. Check original for tables and reading order.')
            text_source=md.name
        elif fmt=='pdf':
            for n,page in enumerate(reader.pages,1):
                text=page.extract_text() or ''
                if len(text.strip())<80: warnings.append(f'Sparse extracted text on physical page {n}; review visually.')
                units.append((text,None,n,None))
            text_source='pypdf'
        else:
            if id.startswith('P'): blocks=extraction_body.select('p,li,h1,h2,h3,h4,h5,h6,table')
            else: blocks=[b for c in extraction_body.select('.text-block__content') for b in c.select('p,li,h2,h3,table')]
            heading=None; section=None
            for block in blocks:
                if block.find_parent(['li','table']): continue
                if re.match(r'h[1-6]',block.name): heading=block.get_text(' ',strip=True); section=None; continue
                text=block.get_text(' ',strip=True)
                if text: units.append((text,heading,None,section))
            text_source=f'HTML: {extraction_selector}'
        for text,heading,page,section in units:
            for piece in chunks(text):
                ordinal=sum(1 for x in passages if x['documentId']==id)
                passages.append(dict(id=f'{id}:{ordinal}',documentId=id,heading=heading,text=piece,page=page,sectionId=section,ordinal=ordinal))
        if not any(x['documentId']==id for x in passages): raise ValueError(f'{id}: empty extraction')
        typ=overrides.get(id,{}).get('type','humanitarian_law' if id.startswith('P2') else 'news')
        documents.append(dict(id=id,title=title,filename=p.name,format=fmt,type=typ,language=metadata['language'],genre=metadata['genre'],suppliedMetadata=metadata,publicationYear=overrides.get(id,{}).get('publicationYear'),sourceUrl=url,sourcePath=source_path,sourceSha256=sha(raw),sourceBytes=len(raw),pageCount=page_count,extractionStatus='partial' if warnings else 'ok',warnings=warnings,textSource=text_source,viewerPath=viewer))
    discrepancies=['The data.md observed 14-file list describes a different sample. Only the 10 originals actually supplied are indexed.','Markdown/PDF/HTML pairs share the CSV ID and are counted once.','CSV genre and language are preserved verbatim; normalized type is a separate field. No clinical-guidance classification inferred.','Challenge PDF is a project brief, not a searchable corpus document.']
    corpus=dict(schemaVersion=1,packId='fieldfind-sample',version='sample-v1',createdAt=datetime.now(timezone.utc).isoformat(),documents=documents,passages=passages)
    corpus['version']='sample-'+sha(json.dumps(corpus,ensure_ascii=False,sort_keys=True).encode())[:16]
    (out/'corpus.json').write_text(json.dumps(corpus,ensure_ascii=False))
    (out/'ingestion-report.json').write_text(json.dumps(dict(documentCount=len(documents),passageCount=len(passages),discrepancies=discrepancies,documents=documents),ensure_ascii=False,indent=2))
    files=[dict(path=str(p.relative_to(out)),bytes=p.stat().st_size,sha256=sha(p.read_bytes())) for p in sorted(out.rglob('*')) if p.is_file() and p.name!='manifest.json']
    manifest=dict(schemaVersion=1,packId=corpus['packId'],version=corpus['version'],corpusPath='corpus.json',files=files,totalBytes=sum(f['bytes'] for f in files))
    (out/'manifest.json').write_text(json.dumps(manifest,indent=2))
    print(f'Prepared {len(documents)} documents, {len(passages)} passages, {manifest["totalBytes"]:,} bytes. Originals retained at {source}.')

if __name__=='__main__':
    parser=argparse.ArgumentParser(); parser.add_argument('--source',type=Path,default=ROOT/'documents'); parser.add_argument('--out',type=Path,default=ROOT/'public/packs/demo'); args=parser.parse_args(); ingest(args.source,args.out)
