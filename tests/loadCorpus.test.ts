import {afterEach,expect,it,vi} from 'vitest';
import {loadPack} from '../src/data/loadCorpus';
afterEach(()=>vi.unstubAllGlobals());
it('explains Vite HTML fallback for a missing manifest instead of throwing a JSON syntax error',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('<!doctype html><div id="root"></div>',{status:200,headers:{'content-type':'text/html'}})));
 await expect(loadPack()).rejects.toThrow('Choose your supplied sample files');
});
it('explains an actually missing manifest',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('Not found',{status:404})));
 await expect(loadPack()).rejects.toThrow('No sample documents are loaded');
});
it('explains malformed JSON independently of content type',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('{broken json',{status:200,headers:{'content-type':'application/json'}})));
 await expect(loadPack()).rejects.toThrow('manifest is not valid JSON');
});
