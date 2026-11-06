// DOM render test with a stubbed Supabase client. Run: NODE_PATH=/path/to/node_modules node tests/dom.test.js (needs jsdom)
const {JSDOM}=require('jsdom');const fs=require('fs');const R=__dirname+'/../';
const html=fs.readFileSync(R+'index.html','utf8').replace(/<script[^>]*src=[^>]*><\/script>/g,'');
const rows=JSON.parse(fs.readFileSync(process.env.FS_ROWS||'/workspace/fs_suppliers_seed.json','utf8'));
let f=0,n=0;const ok=(c,m)=>{n++;if(!c){f++;console.log('FAIL',m)}};const tick=()=>new Promise(r=>setTimeout(r,30));
function mk(session,hash){const dom=new JSDOM(html,{url:'https://factorysearch.netlify.app/'+(hash||''),runScripts:'outside-only'});const w=dom.window;const logged=[];
  const q=(data)=>{const o={select:()=>o,eq:()=>o,maybeSingle:()=>Promise.resolve({data:null}),insert:(x)=>{logged.push(x);return Promise.resolve({})},upsert:()=>Promise.resolve({}),then:(res)=>res({data,error:null})};return o;};
  w.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session}}),signOut:async()=>{},signInWithPassword:async()=>({error:{message:'bad'}}),updateUser:async()=>({}),onAuthStateChange:()=>{}},
    from:(t)=>q(t==='fs_suppliers'?rows:t==='fs_meta'?[{key:'data_as_of',value:'2026-11-02'}]:[])})};
  w.history.replaceState=()=>{};w.eval(fs.readFileSync(R+'config.js','utf8'));w.eval(fs.readFileSync(R+'app.js','utf8'));return {w,logged};}
(async()=>{
 // login view + toggle
 let {w}=mk(null);await tick();const d=w.document;const pw=d.getElementById('pw'),tg=d.querySelector('.pwtog[data-for="pw"]');
 ok(pw&&pw.type==='password','pw masked by default');ok(tg&&tg.type==='button','toggle is type=button');ok(tg.getAttribute('aria-pressed')==='false','aria-pressed false');
 ok(d.querySelector('label[for="pw"]')&&d.querySelector('label[for="em"]'),'labels');
 tg.click();ok(pw.type==='text'&&tg.getAttribute('aria-pressed')==='true'&&tg.textContent==='Hide'&&/^Hide/.test(tg.getAttribute('aria-label')),'toggle shows');
 tg.click();ok(pw.type==='password'&&tg.getAttribute('aria-pressed')==='false','toggle hides');
 // setup view toggles
 ({w}=mk({user:{email:'philos@greymatterfusion.com'}},'?setup=1'));await tick();
 ok(w.document.getElementById('p1')&&w.document.querySelectorAll('.pwtog').length===2,'setup has 2 toggles');
 // scorecard
 let L;({w,logged:L}=mk({user:{email:'thume@hytorc.com'}}));await tick();await tick();let D=w.document;const tb=D.getElementById('tb');
 ok(tb.tHead&&tb.tHead.rows.length===1,'thead present');ok(tb.tBodies[0].rows.length===34,'34 body rows');
 ok(tb.firstElementChild.tagName==='THEAD','thead before tbody');ok(!tb.tBodies[0].querySelector('th'),'no header cells in body');
 ok(/not qualified or interchangeable/.test(D.body.textContent),'alternatives heading');ok(D.querySelectorAll('.alt').length===3,'3 alt cards');
 ok(!/Dual-source pairs:/.test(D.body.textContent),'old shorthand removed');ok(D.getElementById('ver').textContent==='v1.2.0','version');
 ok(!L.some(x=>JSON.stringify(x).toLowerCase().includes('password')),'no password in events');
 w.location.hash='#/study';await tick();D=w.document;const st=D.body.textContent;
 ok(/Capability is catalog fit, not an audit/.test(st),'capability vs audit');ok(/Private label/.test(st)&&/Questions for discussion/.test(st)&&/Qualification method/.test(st),'study sections');
 ok(!/not a lecture/i.test(st)&&!/\$100|\$135|\$120|~25%|20 to 30%/.test(st),'removed unsupported numbers/phrasing');ok(!D.querySelector('#app input[type=range]'),'no duplicate controls');
 w.location.hash='#/sources';await tick();D=w.document;const sr=D.body.textContent;
 ok(/Used in this screening/.test(sr)&&/Planned research channels \(not yet checked\)/.test(sr),'sources split');
 ['importyeti.com','panjiva.com','timtos.com.tw','buykorea.org','ptc-asia.com','emo-hannover.de'].forEach(h=>ok([...D.querySelectorAll('a')].some(a=>a.href.includes(h)),'link '+h));
 ok(D.querySelectorAll('.tblwrap tbody tr').length===34,'34 supplier source rows');
 console.log(n,'checks',f,'failures');process.exit(f?1:0);})();
