/*!
 * @license MPL-2.0-no-copyleft-exception
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * This Source Code Form is "Incompatible With Secondary Licenses", as
 * defined by the Mozilla Public License, v. 2.0.
 */
const version=/* VERSION */"20211231"/* VERSION */,resourceList=["./help/about.html","./help/credits.html","./help/en.html","./help/zh_cn.html","./css/icons.woff","./css/index.css","./css/normalize-8.0.1.css","./data/han/s2t.json","./data/han/t2s.json","./js/main.js","./icon/icon.png","./icon/icon.svg","./icon/icon.ico","./icon/maskable.png","./icon/monochrome.png","./manifest.webmanifest","./"],cacheKey="page-cache-20211231",cacheFiles=async function(){const e=await caches.open(cacheKey);await e.addAll(resourceList);const t=await caches.keys();await Promise.all(t.map(async e=>{e!==cacheKey&&await caches.delete(e)}))};self.addEventListener("install",function(e){e.waitUntil(cacheFiles())}),self.addEventListener("fetch",function(e){const t=new URL(e.request.url);if("GET"!==e.request.method){if("POST"===e.request.method&&"/import"===t.pathname)return e.respondWith(Response.redirect(new URL("/#!/",location.href))),void e.waitUntil(e.request.formData().then(async t=>{const s=t.get("text");(await self.clients.get(e.resultingClientId)).postMessage({action:"import",file:s})}));e.respondWith(Response.error())}else if(t.href===new URL("?version",location.href).href){const t=`/* VERSION */${JSON.stringify(version)}/* VERSION */`,s={status:200,headers:{"Content-Type":"text/plain"}};e.respondWith(new Response(t,s))}else e.respondWith(caches.match(e.request))});
