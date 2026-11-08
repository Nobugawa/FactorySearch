// Public worksheet is a blank read-only template. It must not show or save stored notes.
const {JSDOM}=require('jsdom');const fs=require('fs');const R=__dirname+'/../';
const html=fs.readFileSync(R+'index.html','utf8').replace(/<script[^>]*src=[^>]*><\/script>/g,'');
let f=0,n=0;const ok=(c,m)=>{n++;if(!c){f++;console.log('FAIL',m)}};const tick=()=>new Promise(r=>setTimeout(r,40));
function mk(){const dom=new JSDOM(html,{url:'https://factorysearch.netlify.app/#/worksheet?s=B2',runScripts:'outside-only'});const w=dom.window;w.__from=[];
  const q=()=>{const o={select:()=>o,eq:()=>o,maybeSingle:()=>Promise.resolve({data:null}),insert:()=>Promise.resolve({}),upsert:()=>Promise.resolve({error:null}),then:(res)=>res({data:[{supplier_id:'B2',gate_id:'certs',status:'In progress',evidence:'Legacy note kept',updated_by:'philoskim990@gmail.com',updated_at:'2026-11-05T12:00:00Z',details:{v:1,standard:'ISO 9001'}}],error:null})};return o;};
  w.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{user:{email:'philos@greymatterfusion.com'}}}}),signOut:async()=>{},onAuthStateChange:()=>{}},from:(t)=>{w.__from.push(t);return q();}})};
  w.history.replaceState=()=>{};w.eval(fs.readFileSync(R+'config.js','utf8'));w.eval(fs.readFileSync(R+'catalog.js','utf8'));w.eval(fs.readFileSync(R+'worksheet.js','utf8'));w.eval(fs.readFileSync(R+'quote.js','utf8'));w.eval(fs.readFileSync(R+'sort.js','utf8'));w.eval(fs.readFileSync(R+'sensitivity.js','utf8'));w.eval(fs.readFileSync(R+'reference.js','utf8'));w.eval(fs.readFileSync(R+'app.js','utf8'));return w;}
(async()=>{
 const w=mk();await tick();await tick();const D=w.document;
 ok(/Blank template/.test(D.body.textContent),'blank template heading');
 ok(D.querySelectorAll('.gatecard').length===8,'7 gates plus decision');
 ok(D.getElementById('st_certs').disabled&&D.getElementById('st_certs').value==='Not started','status is blank and locked');
 ok(D.getElementById('ev_certs').disabled&&D.getElementById('ev_certs').value==='','notes field is empty');
 ok(D.getElementById('f_commercial_small_ok').value==='Unknown'&&D.getElementById('f_commercial_moq').disabled,'order size stays unknown');
 ok(!D.getElementById('sv')&&!/Legacy note kept|philoskim990@gmail.com|Last saved by/.test(D.body.textContent),'stored notes and accounts are not shown');
 ok(!w.__from.includes('fs_worksheet')&&!w.__from.includes('fs_events'),'worksheet view makes no private table calls');
 const sup=D.getElementById('sup');sup.value='B1';sup.dispatchEvent(new w.Event('change'));await tick();
 ok(w.location.hash.includes('B1'),'supplier switch updates the template address');
 console.log(n,'checks',f,'failures');process.exit(f?1:0);})();
