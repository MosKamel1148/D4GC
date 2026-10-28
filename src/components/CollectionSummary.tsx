import {useI18n} from '../i18n';
import type {LoadedPack} from '../data/loadCorpus';
export default function CollectionSummary({pack}:{pack:LoadedPack}){
 const {t}=useI18n();const docs=pack.corpus.documents;const count=(field:'language'|'genre')=>Object.entries(docs.reduce<Record<string,number>>((a,d)=>{a[d[field]]=(a[d[field]]??0)+1;return a;},{}));
 const skipped=pack.notices.filter(n=>n.startsWith('Not indexed'));
 return <section className="collection-summary" aria-label="Understand your collection"><h2>{t('summary')}</h2>
 <dl className="summary-grid">{(['csvEntries','matchedDocuments','indexedDocuments','missingSources','failedExtraction'] as const).map((key,i)=><div key={key}><dt>{t((['csvEntries','matchedDocs','indexedDocs','missing','failed'] as const)[i])}</dt><dd>{pack.stats?.[key]??'—'}</dd></div>)}</dl><p className="caption">Missing sources means CSV entries with no corresponding original in this collection. Failed extraction means a selected original could not yield searchable text. These are separate counts. Indexed documents can exceed matched documents when some originals have no CSV entry.</p>
 <p className="caption">{pack.notices.find(n=>n.startsWith('Metadata:'))}</p>
 <p><strong>{t('languages')}:</strong> {count('language').map(([name,n])=>`${name==='und'?'Unknown':name}: ${n}`).join(' · ')}</p><p><strong>{t('genres')}:</strong> {count('genre').map(([name,n])=>`${name}: ${n}`).join(' · ')}</p>
 <p className="caption">A passage is a searchable piece of source text. Genre and language come from your CSV where available. A document’s date or genre does not establish current clinical validity.</p>
 <details><summary>{t('inventory')}</summary><div className="inventory"><table><thead><tr><th>Document</th><th>Metadata</th><th>Text & notes</th></tr></thead><tbody>{docs.map(d=><tr key={d.id}><td><strong>{d.title}</strong><br/>{d.filename}<br/>{d.id}</td><td>{d.genre}<br/>{d.language} · {d.publicationYear??'Year unknown'}</td><td>{d.textSource}<br/>{d.pageCount?`${d.pageCount} physical PDF pages`:'No verified page count'}<details><summary>{d.warnings.length} extraction notes</summary><ul>{d.warnings.map(w=><li key={w}>{w}</li>)}</ul></details></td></tr>)}</tbody></table></div></details>
 {skipped.length>0&&<details open><summary>Files needing attention</summary><ul>{skipped.map(s=><li key={s}>{s}</li>)}</ul></details>}
 </section>;
}
