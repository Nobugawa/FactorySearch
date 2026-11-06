// DOM render test with a stubbed Supabase client. Run: NODE_PATH=/path/to/node_modules node tests/dom.test.js (needs jsdom)
const {JSDOM}=require('jsdom');const fs=require('fs');const R=__dirname+'/../';
const html=fs.readFileSync(R+'index.html','utf8').replace(/<script[^>]*src=[^>]*><\/script>/g,'');
let f=0,n=0;const ok=(c,m)=>{n++;if(!c){f++;console.log('FAIL',m)}};const tick=()=>new Promise(r=>setTimeout(r,40));
async function waitFor(w,sel){for(let i=0;i<25;i++){if(w.document.querySelector(sel))return true;await tick();}return false;}
function mk(session,hash){const dom=new JSDOM(html,{url:'https://factorysearch.netlify.app/'+(hash||''),runScripts:'outside-only'});const w=dom.window;const logged=[];
  w.__from=[];w.__ups=[];
  const q=(data)=>{const o={select:()=>o,eq:()=>o,maybeSingle:()=>Promise.resolve({data:null}),insert:(x)=>{logged.push(x);return Promise.resolve({})},upsert:(x)=>{w.__ups.push(x);return Promise.resolve({})},then:(res)=>res({data,error:null})};return o;};
  w.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session}}),signOut:async()=>{},signInWithPassword:async()=>({error:{message:'bad'}}),updateUser:async()=>({}),onAuthStateChange:()=>{}},
    from:(t)=>{w.__from.push(t);return q([]);}})};
  w.history.replaceState=()=>{};w.eval(fs.readFileSync(R+'config.js','utf8'));w.eval(fs.readFileSync(R+'catalog.js','utf8'));w.eval(fs.readFileSync(R+'worksheet.js','utf8'));w.eval(fs.readFileSync(R+'app.js','utf8'));return {w,logged};}
(async()=>{
 // public scorecard, no login wall
 let {w,logged}=mk(null);ok(await waitFor(w,'#tb'),'anon scorecard rendered');let D=w.document;let tb=D.getElementById('tb');
 ok(!D.getElementById('pw'),'no password field while viewing');
 ok(tb.tHead&&tb.tHead.rows.length===1,'thead present');
 ok([...tb.tBodies[0].rows].filter(r=>r.classList.contains('r')).length===38,'38 scored rows');
 ok(tb.querySelectorAll('tr.china').length===4,'4 Nov 6 rows');
 ok(![...tb.querySelectorAll('tr.r')].some(tr=>tr.dataset.id==='B14'||tr.dataset.id==='B15'),'Huade and Taifeng are not ranked');
 ok(/not scored/.test(D.querySelector('.watchcard').textContent)&&/Huade/.test(D.querySelector('.watchcard').textContent)&&/700 bar/.test(D.querySelector('.watchcard').textContent),'watchlist is separate and unscored');
 ok(/not proof that a non-China supplier is a better fit/.test(D.body.textContent),'diversification caveat on the scorecard');
 ok(tb.firstElementChild.tagName==='COLGROUP'&&tb.querySelector('thead')&&!tb.tBodies[0].querySelector('th'),'header above body rows');
 ok(/not qualified or interchangeable/.test(D.body.textContent),'alternatives heading');ok(D.querySelectorAll('.alt').length===3,'3 alt cards');
 ok(!/Dual-source pairs:/.test(D.body.textContent),'old shorthand removed');ok(D.getElementById('ver').textContent==='v1.4.0','version');
 ok(!/Authorized users only/.test(D.body.textContent)&&!/Private supplier study/.test(D.body.textContent),'mandatory-login warning removed');
 ok(/does not require an account/.test(D.getElementById('notice').textContent),'signed-out notice does not claim viewing is logged');
 ok(tb.querySelectorAll('td.u').length===38&&[...tb.querySelectorAll('td.u a')].every(a=>a.textContent===a.getAttribute('href')&&/^https?:\/\//.test(a.textContent)&&!a.textContent.includes('…')),'full URL text in source cells');
 tb.querySelector('tr.r').click();
 const sel=tb.querySelector('tr.r.on');
 ok(sel&&sel.nextElementSibling&&sel.nextElementSibling.classList.contains('detailrow'),'detail row is directly below the selected row');
 ok(sel.nextElementSibling.querySelector('.detail')&&sel.nextElementSibling.cells[0].colSpan===sel.cells.length,'detail spans the table');
 ok(!logged.length&&w.__from.length===0&&!(w.__ups||[]).length,'anon open does not read or write');
 D.getElementById('lkall').click();
 const stored=JSON.parse(w.localStorage.getItem('fs_local_weights_v1'));
 ok(stored&&stored.lk.every(Boolean)&&stored.w.reduce((a,b)=>a+b,0)===100,'anon weights stay local and total 100');
 await new Promise(r=>setTimeout(r,900));
 ok(!(w.__ups||[]).length&&w.__from.length===0,'anon lock does not upsert shared prefs');
 // sign-in form still available, with an accurate notice
 w.location.hash='#/signin';ok(await waitFor(w,'#pw'),'sign-in form');D=w.document;
 const pw=D.getElementById('pw'),tg=D.querySelector('.pwtog[data-for="pw"]');
 ok(pw&&pw.type==='password','pw masked by default');ok(tg&&tg.type==='button','toggle is type=button');ok(tg.getAttribute('aria-pressed')==='false','aria-pressed false');
 ok(D.querySelector('label[for="pw"]')&&D.querySelector('label[for="em"]'),'labels');
 ok(/After you sign in/.test(D.body.textContent)&&/not written to the shared database/.test(D.body.textContent),'sign-in notice matches email-linked activity');
 tg.click();ok(pw.type==='text'&&tg.getAttribute('aria-pressed')==='true'&&tg.textContent==='Hide'&&/^Hide/.test(tg.getAttribute('aria-label')),'toggle shows');
 tg.click();ok(pw.type==='password'&&tg.getAttribute('aria-pressed')==='false','toggle hides');
 w.location.hash='#/worksheet';await tick();await tick();
 ok(/Nothing on that worksheet is in the public snapshot/.test(w.document.body.textContent)&&!w.__from.includes('fs_worksheet'),'anon worksheet does not query private rows');
 // setup view toggles
 ({w}=mk({user:{email:'philos@greymatterfusion.com'}},'?setup=1'));ok(await waitFor(w,'#p1'),'setup view');
 ok(w.document.getElementById('p1')&&w.document.querySelectorAll('.pwtog').length===2,'setup has 2 toggles');
 // signed-in scorecard still saves that user's weights only
 let L;({w,logged:L}=mk({user:{email:'thume@hytorc.com'}}));ok(await waitFor(w,'#tb'),'signed-in scorecard');D=w.document;tb=D.getElementById('tb');
 ok([...tb.tBodies[0].rows].filter(r=>r.classList.contains('r')).length===38,'signed-in sees the same 38');
 ok(w.__from.includes('fs_weight_prefs')&&w.__from.includes('fs_events'),'signed-in loads own weights and logs the session');
 ok(!w.__from.includes('fs_suppliers')&&!w.__from.includes('fs_meta')&&!w.__from.includes('fs_worksheet'),'signed-in scorecard does not fetch suppliers, meta, or worksheet');
 ok(/linked to this email/.test(D.getElementById('notice').textContent),'signed-in notice names email-linked activity');
 ok(!L.some(x=>JSON.stringify(x).toLowerCase().includes('password')),'no password in events');
 const css=fs.readFileSync(R+'style.css','utf8');
 ok(/footer\{position:static/.test(css)&&/overflow-wrap:anywhere/.test(css),'css: footer in flow, urls wrap');
 ok(!/#tb\{min-width:1480px\}/.test(css)&&/max-width:none/.test(css)&&/tr\.detailrow/.test(css),'css: full width, detail under the row');
 ok(/@media\(max-width:1100px\)\{[\s\S]*overflow-x:auto/.test(css),'css: narrow screens may scroll sideways');
 ok(!/\.detail\{[^}]*position:\s*fixed/.test(css),'css: detail is not a fixed side panel');
 ok(!/table td\{display:none/.test(css),'no mobile rule hiding table cells');
 {const boxes=()=>[...D.querySelectorAll('[data-l]')],wts=()=>[...D.querySelectorAll('[data-n]')].map(e=>+e.value);const before=wts();
  ok(/only check or uncheck the Lock boxes/.test(D.body.textContent),'lock buttons explained');
  D.getElementById('lkall').click();ok(boxes().length===7&&boxes().every(b=>b.checked),'select all locks');ok(JSON.stringify(wts())===JSON.stringify(before)&&wts().reduce((a,b)=>a+b,0)===100,'weights unchanged after select all');
  ok([...D.querySelectorAll('[data-i]')].every(e=>e.disabled),'sliders disabled when all locked');
  await new Promise(r=>setTimeout(r,900));const lastUp=(w.__ups||[]).filter(x=>x&&x.locked).pop();ok(lastUp&&lastUp.locked.every(Boolean)&&JSON.stringify(lastUp.weights)===JSON.stringify(before),'locks persisted to prefs');
  D.getElementById('lknone').click();ok(boxes().every(b=>!b.checked)&&JSON.stringify(wts())===JSON.stringify(before),'unselect all; weights unchanged');
  D.getElementById('lkall').click();D.getElementById('rst').click();ok(boxes().every(b=>!b.checked)&&JSON.stringify(wts())==='[25,15,10,10,20,10,10]','return to defaults unlocks all');
  const vs=new Set([...fs.readFileSync(R+'index.html','utf8').matchAll(/\?v=([0-9.]+)/g)].map(m=>m[1]));ok(vs.size===1&&('v'+[...vs][0])===w.FS_CONFIG.VERSION,'asset cache-bust version matches config');}
 w.location.hash='#/study';await tick();await tick();D=w.document;const st=D.body.textContent;
 ok(/Capability is catalog fit, not an audit/.test(st),'capability vs audit');ok(/Private label/.test(st)&&/Questions for discussion/.test(st)&&/Qualification method/.test(st),'study sections');
 ok(/cannot by itself qualify a supplier/.test(st)&&/used earlier, to find and screen candidates/.test(st)&&!/next deepening step/.test(st),'study customs wording');
 ok(/diversification-biased/.test(st)&&/not proof that a non-China supplier is a better fit/.test(st),'study explains the original bias');
 ok(/not a verified certificate/.test(st)&&/not verified US shipment history/.test(st),'study keeps certificate and shipment caveats');
 ok(!/not a lecture/i.test(st)&&!/\$100|\$135|\$120|~25%|20 to 30%/.test(st),'removed unsupported numbers/phrasing');ok(!D.querySelector('#app input[type=range]'),'no duplicate controls');
 w.location.hash='#/sources';await tick();await tick();D=w.document;const sr=D.body.textContent;
 ok(/Used in this screening/.test(sr)&&/Planned research channels \(not yet checked\)/.test(sr),'sources split');
 ok(/China pass \(Nov 6, 2026\)/.test(sr),'Nov 6 pass is labeled separately');
 ['importyeti.com','panjiva.com','timtos.com.tw','buykorea.org','ptc-asia.com','emo-hannover.de'].forEach(h=>ok([...D.querySelectorAll('a')].some(a=>a.href.includes(h)),'link '+h));
 ok(/Discovery:/.test(sr)&&/Screening:/.test(sr)&&/Validation:/.test(sr)&&/None of these has been searched/.test(sr),'customs data: discovery/screening/validation + not searched');ok(/does not prove quality, drawing fit, capacity, MOQ/.test(sr),'customs limitations');
 ok(D.querySelectorAll('.tblwrap tbody tr').length===38,'38 supplier source rows');
 ok([...D.querySelectorAll('.tblwrap td.u a')].every(a=>a.textContent===a.getAttribute('href')),'source urls are complete');
 ok(/ppforging\.com/.test(sr)&&/gearsnet\.com/.test(sr)&&/leapmachine\.com/.test(sr)&&/nbxus\.com/.test(sr),'Nov 6 evidence links');
 ok(/not the Nov 2 discovery trail/.test(sr),'Nov 6 evidence is not labeled as the original pass');
 console.log(n,'checks',f,'failures');process.exit(f?1:0);})();
