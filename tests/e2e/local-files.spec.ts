import {test,expect} from '@playwright/test';
import {readdirSync,existsSync,readFileSync} from 'node:fs';
import path from 'node:path';
const sample=(existsSync('documents')?readdirSync('documents'):[]).filter(name=>/^(P(25|26|27|28|32|33|34)|Df98e297b5f|Dfa9c0c7a37|Df5738d956a)\.(md|pdf|html)$/.test(name)).map(name=>path.resolve('documents',name));
test.skip(!sample.length,'These real-file browser checks need the privately supplied originals in documents/.');
test.beforeEach(async({page})=>{await page.route('**/packs/demo/manifest.json',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><div>Vite fallback</div>'}));});
test('fresh GitHub download: select sample → search → filters → original, without uploads',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await expect(page.getByRole('status')).toContainText('No sample documents are loaded');
 await expect(page.getByLabel('Source language')).toBeDisabled();await expect(page.getByLabel('Document genre')).toBeDisabled();
 let requests=0;page.on('request',()=>requests++);
 await page.getByLabel('Choose documents',{exact:true}).setInputFiles(sample);
 await expect(page.getByRole('button',{name:'Search',exact:true})).toBeEnabled();await expect(page.getByRole('status').filter({hasText:'10 local documents'})).toBeVisible();
 await page.getByLabel('What are you looking for?').fill('protected persons');await page.getByRole('button',{name:'Search',exact:true}).click();await expect(page.getByRole('heading',{name:'Protected Persons',exact:true})).toBeVisible();
 await page.getByText('Narrow results',{exact:true}).click();await page.getByLabel('Source language').selectOption('ar');await expect(page.getByRole('heading',{name:'No matching documents'})).toBeVisible();await page.getByRole('button',{name:'Clear filters'}).click();
 await page.getByLabel('What are you looking for?').fill('unsubmitted gibberish');
 await page.getByLabel('Document genre').selectOption('Legal Encyclopedia Entry');await expect(page.locator('article')).toHaveCount(2);
 const card=page.locator('article').filter({has:page.getByRole('heading',{name:'Protected Persons',exact:true})});await card.getByRole('button',{name:'Open document'}).click();await expect(page.frameLocator('iframe').locator('body')).toContainText('Geneva');
 await page.getByRole('button',{name:'Back to results'}).click();await expect(page.getByLabel('Document genre')).toHaveValue('Legal Encyclopedia Entry');
 expect(requests).toBe(0);expect(errors).toEqual([]);
 // A failed replacement must preserve the loaded collection and filters.
 await page.getByRole('button',{name:'Manage documents',exact:true}).click();await page.getByLabel('Choose documents',{exact:true}).setInputFiles([{name:'P34.pdf',mimeType:'application/pdf',buffer:Buffer.from('Synthetic invalid PDF fixture')}]);
 await expect(page.getByRole('status').filter({hasText:'Not indexed P34.pdf'})).toBeVisible();await expect(page.getByRole('button',{name:'Search',exact:true})).toBeEnabled();await expect(page.getByLabel('Document genre')).toHaveValue('Legal Encyclopedia Entry');
 await expect(page.getByRole('status').filter({hasText:'Saved on this browser.'})).toBeVisible();await page.reload();await expect(page.getByRole('status').filter({hasText:'Restored saved collection'})).toBeVisible();await expect(page.getByRole('button',{name:'Search',exact:true})).toBeEnabled();
});
test('local Markdown/PDF pairing opens original PDF bytes without invented page references',async({page})=>{
 await page.goto('/');await expect(page.getByRole('status')).toContainText('No sample documents are loaded');await page.getByLabel('Choose documents',{exact:true}).setInputFiles(['P34.pdf','P34.md'].map(n=>path.resolve('documents',n)));
 await expect(page.getByRole('button',{name:'Search',exact:true})).toBeEnabled();await page.getByLabel('What are you looking for?').fill('bedaquiline');await page.getByRole('button',{name:'Search',exact:true}).click();await page.getByRole('button',{name:'Open document'}).click();await expect(page.getByRole('heading',{name:'Original PDF'})).toBeVisible();await expect(page.getByRole('link',{name:/Download original/})).toHaveAttribute('download','P34.pdf');await expect(page.getByText('Page reference unavailable. No page number inferred from Markdown.')).toBeVisible();
});
test('orphan Markdown, duplicate names and unrelated files have clear errors',async({page})=>{
 await page.goto('/');await expect(page.getByRole('status')).toContainText('No sample documents are loaded');const input=page.getByLabel('Choose documents',{exact:true});
 await input.setInputFiles(path.resolve('documents/P34.md'));await expect(page.getByRole('status')).toContainText('select the original PDF or HTML too');
 await input.setInputFiles([{name:'notes.md',mimeType:'text/markdown',buffer:Buffer.from('Synthetic unrelated fixture')}]);await expect(page.getByRole('status')).toContainText('No readable PDF or HTML originals found');
 await input.setInputFiles([{name:'P34.md',mimeType:'text/markdown',buffer:Buffer.from('Synthetic test A')},{name:'P34.md',mimeType:'text/markdown',buffer:Buffer.from('Synthetic test B')}]);await expect(page.getByRole('status')).toContainText('Duplicate filename');
});
test('untrusted local HTML stays passive and supplied metadata wins with a discrepancy warning',async({page})=>{
 await page.goto('/');await expect(page.getByRole('status')).toContainText('No sample documents are loaded');
 const fixture=`<!doctype html><html lang="ar"><main><article><div class="anchor-links-js"><h1>Synthetic security fixture</h1><p>Synthetic protected persons test passage.</p><script>window.pwned=true</script><img src="https://example.invalid/secret" onerror="window.pwned=true"><iframe src="https://example.invalid/frame"></iframe><a href="javascript:alert(1)">Unsafe link</a><table><tr><td>Test table</td></tr></table></div></article></main></html>`;
 let external=0;page.on('request',r=>{if(r.url().includes('example.invalid'))external++;});
 await page.getByLabel('Choose documents',{exact:true}).setInputFiles([{name:'P26.html',mimeType:'text/html',buffer:Buffer.from(fixture)}]);await expect(page.getByRole('button',{name:'Search',exact:true})).toBeEnabled();await page.getByLabel('What are you looking for?').fill('protected persons');await page.getByRole('button',{name:'Search',exact:true}).click();await page.getByRole('button',{name:'Open document'}).click();
 await page.getByText('Extraction notes & supplied metadata').click();await expect(page.getByText(/Metadata discrepancy: HTML declares ar/)).toBeVisible();await expect(page.getByText(/CSV: ID P26; genre Legal Encyclopedia Entry; language en/)).toBeVisible();
 const frame=page.frameLocator('iframe');await expect(frame.locator('body')).toContainText('Test table');await expect(frame.locator('script,img,iframe,form,a')).toHaveCount(0);expect(external).toBe(0);expect(await page.evaluate(()=>('pwned' in window))).toBe(false);
});
test('original PDF alone is extracted locally, keeps physical pages and original bytes',async({page})=>{
 await page.goto('/');await expect(page.getByLabel('Choose documents',{exact:true})).toBeEnabled();
 const original=readFileSync('documents/P34.pdf');
 await page.getByLabel('Choose documents',{exact:true}).setInputFiles([{name:'P34 (2).PDF',mimeType:'application/pdf',buffer:original}]);await expect(page.getByRole('status').filter({hasText:'1 local documents'})).toBeVisible({timeout:30000});
 await page.getByLabel('What are you looking for?').fill('bedaquiline');let requests=0;page.on('request',()=>requests++);await page.getByRole('button',{name:'Search',exact:true}).click();await expect(page.locator('article')).toHaveCount(1);expect(requests).toBe(0);await expect(page.locator('article .caption')).toContainText('PDF file page');await expect(page.locator('article .caption')).toContainText('Extracted PDF');
 await page.getByRole('button',{name:'Open document'}).click();const download=page.getByRole('link',{name:/Download original/});await expect(download).toHaveAttribute('download','P34 (2).PDF');
 const actual=await download.evaluate(async(a:HTMLAnchorElement)=>{const b=await(await fetch(a.href)).arrayBuffer();return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),b=>b.toString(16).padStart(2,'0')).join('');});const {createHash}=await import('node:crypto');expect(actual).toBe(createHash('sha256').update(original).digest('hex'));
 await page.getByText('Extraction notes & supplied metadata').click();await expect(page.getByText(/20 physical PDF pages/)).toBeVisible();await expect(page.getByText(/Filename variation:/)).toBeVisible();
});
test('one broken document no longer discards good documents; download suffixes are accepted',async({page})=>{
 await page.goto('/');await page.getByLabel('Choose documents',{exact:true}).setInputFiles([{name:'P26 (1).html',mimeType:'text/html',buffer:readFileSync('documents/P26.html')},{name:'P34.pdf',mimeType:'application/pdf',buffer:Buffer.from('Synthetic invalid PDF fixture')}]);await expect(page.getByRole('status').filter({hasText:'1 local documents'})).toBeVisible({timeout:30000});await page.getByRole('button',{name:'Manage documents',exact:true}).click();await expect(page.getByText(/Not indexed P34.pdf/).first()).toBeVisible();
 await page.getByLabel('What are you looking for?').fill('protected persons');await page.getByRole('button',{name:'Search',exact:true}).click();await expect(page.getByRole('heading',{name:'Protected Persons',exact:true})).toBeVisible();
});
test('a pending default pack cannot block local selection or overwrite it later',async({page})=>{
 let release:(()=>Promise<void>)|undefined;
 await page.route('**/packs/demo/manifest.json',route=>{release=()=>route.fulfill({contentType:'text/html',body:'<!doctype html>missing'});});
 await page.goto('/');await expect(page.getByLabel('Choose documents',{exact:true})).toBeEnabled();await expect(page.getByLabel('What are you looking for?')).toBeEnabled();await page.getByLabel('Choose documents',{exact:true}).setInputFiles(path.resolve('documents/P26.html'));await expect(page.getByRole('button',{name:'Search',exact:true})).toBeEnabled();await release!();
 await expect(page.getByRole('status').filter({hasText:'1 local documents'})).toBeVisible();await expect(page.getByRole('status').filter({hasText:'No sample documents are loaded'})).toHaveCount(0);
});
test('documents beyond the ten-file sample use the full CSV; unknown originals are flagged, not discarded',async({page})=>{
 await page.goto('/');const csvDoc='<html lang="en"><main><h1>Synthetic catalog extension fixture</h1><p>syntheticxyz legal local fixture text</p></main></html>';
 await page.getByLabel('Choose documents',{exact:true}).setInputFiles([{name:'P01.html',mimeType:'text/html',buffer:Buffer.from(csvDoc)},{name:'my-notes.html',mimeType:'text/html',buffer:Buffer.from('<main><h1>Synthetic unknown fixture</h1><p>syntheticxyz uncatalogued document text</p></main>')}]);await expect(page.getByRole('button',{name:'Search',exact:true})).toBeEnabled();await page.getByLabel('What are you looking for?').fill('syntheticxyz');await page.getByRole('button',{name:'Search',exact:true}).click();await expect(page.locator('article')).toHaveCount(2);await expect(page.locator('article').filter({hasText:'Synthetic catalog extension fixture'})).toContainText('Press Release');await expect(page.locator('article').filter({hasText:'Synthetic unknown fixture'})).toContainText('Unknown');await expect(page.locator('#document-folder')).toHaveAttribute('webkitdirectory','');
});
