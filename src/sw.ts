/// <reference lib="webworker" />
import {cleanupOutdatedCaches,precacheAndRoute,createHandlerBoundToURL,matchPrecache} from 'workbox-precaching';
import {registerRoute,NavigationRoute} from 'workbox-routing';
declare const self:ServiceWorkerGlobalScope & {__WB_MANIFEST:Array<{url:string;revision:string|null}>};
const manifest=self.__WB_MANIFEST;
precacheAndRoute(manifest);cleanupOutdatedCaches();
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html'),{denylist:[/\/packs\//]}));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('message',event=>{
 if(event.data?.type==='SKIP_WAITING')void self.skipWaiting();
 if(event.data?.type==='CHECK_SHELL')event.waitUntil((async()=>{const present=await Promise.all(manifest.map(f=>matchPrecache(typeof f==='string'?f:f.url)));event.ports[0]?.postMessage({ready:present.length>0&&present.every(Boolean)});})());
});
