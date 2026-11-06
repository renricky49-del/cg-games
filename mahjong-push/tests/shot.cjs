// usage: node tests/shot.cjs <url> <out.png> [w] [h]
const { chromium } = require('playwright');
(async()=>{const [url,out,w,h]=process.argv.slice(2);
const b=await chromium.launch();const p=await b.newPage({viewport:{width:+w||1280,height:+h||720}});
p.on('console',m=>console.log('console:',m.type(),m.text()));p.on('pageerror',e=>console.log('pageerror',e.message));
await p.goto(url);await p.waitForTimeout(1500);await p.screenshot({path:out});await b.close();})();
