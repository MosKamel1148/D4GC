import {existsSync} from 'node:fs';
import {test,expect} from '@playwright/test';
test.skip(!existsSync('public/packs/demo/corpus.json'),'Prepare the supplied sample for pack regression checks.');
test('local query → grouped excerpt → original → Back',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await expect(page.getByRole('button',{name:'Search',exact:true})).toBeEnabled();
 await page.getByLabel('What are you looking for?').fill('protected persons');
 await expect(page.getByRole('status').filter({hasText:'Saved on this browser.'})).toBeVisible();
 let requests=0;page.on('request',()=>requests++);
 await page.getByRole('button',{name:'Search',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Protected Persons',exact:true})).toBeVisible();
 expect(requests).toBe(0); // Index and queries remain local after initial pack load.
 const card=page.locator('article').filter({has:page.getByRole('heading',{name:'Protected Persons',exact:true})});
 await expect(card.locator('blockquote')).toContainText(/protected/i);
 await card.getByRole('button',{name:'Open document'}).click();
 await expect(page.getByRole('heading',{name:'Safe view of original HTML'})).toBeVisible();
 await expect(page.getByRole('link',{name:/Download original/})).toHaveAttribute('href',/^blob:/);
 const frame=page.frameLocator('iframe');await expect(frame.getByRole('heading',{name:'Protected Persons',exact:true})).toBeVisible();
 await expect(frame.locator('body')).toContainText(/Geneva/);
 await page.getByRole('button',{name:'Back to results'}).click();
 await expect(page.getByLabel('What are you looking for?')).toHaveValue('protected persons');
 await expect(page.getByRole('heading',{name:'Protected Persons',exact:true})).toBeVisible();
 await expect(page.locator('[data-document-id="P26"]')).toBeFocused();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(errors).toEqual([]);
});
test('PDF download preserves supplied bytes and Arabic has direction',async({page})=>{
 await page.goto('/');await expect(page.getByRole('button',{name:'Search',exact:true})).toBeEnabled();
 await page.getByLabel('What are you looking for?').fill('bedaquiline');await page.getByRole('button',{name:'Search',exact:true}).click();
 await page.getByRole('button',{name:'Open document'}).first().click();
 await expect(page.getByRole('heading',{name:'Original PDF'})).toBeVisible();
 const download=page.getByRole('link',{name:/Download original/});await expect(download).toHaveAttribute('download','P34.pdf');
 const bytes=await download.evaluate(async(a:HTMLAnchorElement)=>{const b=await(await fetch(a.href)).arrayBuffer();return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('');});
 const corpus=await(await page.request.get('/packs/demo/corpus.json')).json();expect(bytes).toBe(corpus.documents.find((d:any)=>d.id==='P34').sourceSha256);
 await page.goBack();await page.getByRole('button',{name:'الكوليرا',exact:true}).click();
 await expect(page.locator('article blockquote').first()).toHaveAttribute('lang','ar');
 await expect(page.locator('article blockquote').first()).toHaveAttribute('dir','auto');
});
test('empty results, filters, and enlarged narrow layout',async({page})=>{
 await page.goto('/');await expect(page.getByRole('button',{name:'Search',exact:true})).toBeEnabled();
 await page.getByLabel('What are you looking for?').fill('quantum superconducting qubit');await page.getByRole('button',{name:'Search',exact:true}).click();
 await expect(page.getByRole('heading',{name:'No matching documents'})).toBeVisible();
 await page.getByRole('button',{name:'الكوليرا',exact:true}).click();await expect(page.locator('article')).toHaveCount(1);
 await page.getByText('Narrow results',{exact:true}).click();await page.getByLabel('Source language').selectOption('en');
 await expect(page.getByRole('heading',{name:'No matching documents'})).toBeVisible();await page.getByRole('button',{name:'Clear filters'}).click();await expect(page.locator('article')).toHaveCount(1);
 await page.evaluate(()=>document.documentElement.style.fontSize='36px');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('three initial cards, show more, and keyboard search',async({page})=>{
 await page.goto('/');const input=page.getByLabel('What are you looking for?');await expect(page.getByRole('button',{name:'Search',exact:true})).toBeEnabled();await input.fill('humanitarian');await input.press('Enter');
 await expect(page.locator('article')).toHaveCount(3);
 await page.getByRole('button',{name:/Show more documents/}).click();await expect(page.locator('article')).toHaveCount(6);
});
test('corrupt pack stops search with an honest error',async({page})=>{
 await page.route('**/packs/demo/corpus.json',route=>route.fulfill({contentType:'application/json',body:'{"schemaVersion":99}'}));
 await page.goto('/');await expect(page.getByRole('status')).toContainText('size mismatch');await expect(page.getByRole('button',{name:'Search',exact:true})).toBeDisabled();await expect(page.locator('article')).toHaveCount(0);
});
