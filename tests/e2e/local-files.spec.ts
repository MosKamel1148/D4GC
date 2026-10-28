import {test,expect} from '@playwright/test';
import {readdirSync,existsSync} from 'node:fs';
import path from 'node:path';
const sample=(existsSync('documents')?readdirSync('documents'):[]).filter(name=>/^(P(25|26|27|28|32|33|34)|Df98e297b5f|Dfa9c0c7a37|Df5738d956a)\.(md|pdf|html)$/.test(name)).map(name=>path.resolve('documents',name));
test.skip(!sample.length,'These real-file browser checks need the privately supplied originals in documents/.');
test.beforeEach(async({page})=>{await page.route('**/packs/demo/manifest.json',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><div>Vite fallback</div>'}));});
test('fresh GitHub download: select sample → search → filters → original, without uploads',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await expect(page.getByRole('status')).toContainText('No sample documents are loaded');
 await expect(page.getByLabel('Source language')).toBeDisabled();await expect(page.getByLabel('Document genre')).toBeDisabled();
 let requests=0;page.on('request',()=>requests++);
 await page.getByLabel('Choose sample files',{exact:true}).setInputFiles(sample);
 await expect(page.getByRole('button',{name:'Search',exact:true})).toBeEnabled();await expect(page.getByRole('status').filter({hasText:'10 local documents'})).toBeVisible();
 await page.getByLabel('What are you looking for?').fill('protected persons');await page.getByRole('button',{name:'Search',exact:true}).click();await expect(page.getByRole('heading',{name:'Protected Persons',exact:true})).toBeVisible();
 await page.getByText('Narrow results',{exact:true}).click();await page.getByLabel('Source language').selectOption('ar');await expect(page.getByRole('heading',{name:'No matching documents'})).toBeVisible();await page.getByRole('button',{name:'Clear filters'}).click();
 await page.getByLabel('What are you looking for?').fill('unsubmitted gibberish');
 await page.getByLabel('Document genre').selectOption('Legal Encyclopedia Entry');await expect(page.locator('article')).toHaveCount(2);
 const card=page.locator('article').filter({has:page.getByRole('heading',{name:'Protected Persons',exact:true})});await card.getByRole('button',{name:'Open document'}).click();await expect(page.frameLocator('iframe').locator('body')).toContainText('Geneva');
 await page.getByRole('button',{name:'Back to results'}).click();await expect(page.getByLabel('Document genre')).toHaveValue('Legal Encyclopedia Entry');
 expect(requests).toBe(0);expect(errors).toEqual([]);
 // A failed replacement must preserve the loaded collection and filters.
 await page.getByText('Choose a different sample',{exact:true}).click();await page.getByLabel('Choose sample files',{exact:true}).setInputFiles(path.resolve('documents/P34.pdf'));
 await expect(page.getByRole('status').filter({hasText:'needs P34.md'})).toBeVisible();await expect(page.getByRole('button',{name:'Search',exact:true})).toBeEnabled();await expect(page.getByLabel('Document genre')).toHaveValue('Legal Encyclopedia Entry');
 await page.reload();await expect(page.getByRole('status')).toContainText('No sample documents are loaded');
});
test('local Markdown/PDF pairing opens original PDF bytes without invented page references',async({page})=>{
 await page.goto('/');await expect(page.getByRole('status')).toContainText('No sample documents are loaded');await page.getByLabel('Choose sample files',{exact:true}).setInputFiles(['P34.pdf','P34.md'].map(n=>path.resolve('documents',n)));
 await expect(page.getByRole('button',{name:'Search',exact:true})).toBeEnabled();await page.getByLabel('What are you looking for?').fill('bedaquiline');await page.getByRole('button',{name:'Search',exact:true}).click();await page.getByRole('button',{name:'Open document'}).click();await expect(page.getByRole('heading',{name:'Original PDF'})).toBeVisible();await expect(page.getByRole('link',{name:/Download original/})).toHaveAttribute('download','P34.pdf');await expect(page.getByText('Page reference unavailable. No page number inferred from Markdown.')).toBeVisible();
});
test('orphan Markdown, duplicate names and unrelated files have clear errors',async({page})=>{
 await page.goto('/');await expect(page.getByRole('status')).toContainText('No sample documents are loaded');const input=page.getByLabel('Choose sample files',{exact:true});
 await input.setInputFiles(path.resolve('documents/P34.md'));await expect(page.getByRole('status')).toContainText('select the original PDF or HTML too');
 await input.setInputFiles([{name:'notes.md',mimeType:'text/markdown',buffer:Buffer.from('Synthetic unrelated fixture')}]);await expect(page.getByRole('status')).toContainText('No supplied sample originals found');
 await input.setInputFiles([{name:'P34.md',mimeType:'text/markdown',buffer:Buffer.from('Synthetic test A')},{name:'P34.md',mimeType:'text/markdown',buffer:Buffer.from('Synthetic test B')}]);await expect(page.getByRole('status')).toContainText('Duplicate filename');
});
test('untrusted local HTML stays passive and supplied metadata wins with a discrepancy warning',async({page})=>{
 await page.goto('/');await expect(page.getByRole('status')).toContainText('No sample documents are loaded');
 const fixture=`<!doctype html><html lang="ar"><main><article><div class="anchor-links-js"><h1>Synthetic security fixture</h1><p>Synthetic protected persons test passage.</p><script>window.pwned=true</script><img src="https://example.invalid/secret" onerror="window.pwned=true"><iframe src="https://example.invalid/frame"></iframe><a href="javascript:alert(1)">Unsafe link</a><table><tr><td>Test table</td></tr></table></div></article></main></html>`;
 let external=0;page.on('request',r=>{if(r.url().includes('example.invalid'))external++;});
 await page.getByLabel('Choose sample files',{exact:true}).setInputFiles([{name:'P26.html',mimeType:'text/html',buffer:Buffer.from(fixture)}]);await expect(page.getByRole('button',{name:'Search',exact:true})).toBeEnabled();await page.getByLabel('What are you looking for?').fill('protected persons');await page.getByRole('button',{name:'Search',exact:true}).click();await page.getByRole('button',{name:'Open document'}).click();
 await page.getByText('Extraction notes & supplied metadata').click();await expect(page.getByText(/Metadata discrepancy: HTML declares ar/)).toBeVisible();await expect(page.getByText(/CSV: ID P26; genre Legal Encyclopedia Entry; language en/)).toBeVisible();
 const frame=page.frameLocator('iframe');await expect(frame.locator('body')).toContainText('Test table');await expect(frame.locator('script,img,iframe,form,a')).toHaveCount(0);expect(external).toBe(0);expect(await page.evaluate(()=>('pwned' in window))).toBe(false);
});
