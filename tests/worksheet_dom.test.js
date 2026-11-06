// Worksheet UI with stubbed Supabase, in "legacy" (details column missing) and "expanded" modes. Needs jsdom on NODE_PATH.
const {JSDOM}=require('jsdom');const fs=require('fs');const R=__dirname+'/../';
const html=fs.readFileSync(R+'index.html','utf8').replace(/<script[^>]*src=[^>]*><\/script>/g,'');
const rows=JSON.parse(fs.readFileSync(process.env.FS_ROWS||'/workspace/fs_suppliers_seed.json','utf8'));
let f=0,n=0;const ok=(c,m)=>{n++;if(!c){f++;console.log('FAIL',m)}};const tick=(ms)=>new Promise(r=>setTimeout(r,ms||40));
function mk(mode,existing){const dom=new JSDOM(html,{url:'https://factorysearch.netlify.app/#/worksheet?s=B2',runScripts:'outside-only'});const w=dom.window;const up=[];const confirms=[];
  w.confirm=(m)=>{confirms.push(m);return false;};
  const q=(t)=>{let cols='*';const o={select:(c)=>{cols=c||'*';return o},eq:()=>o,maybeSingle:()=>Promise.resolve({data:null}),insert:()=>Promise.resolve({}),
    upsert:(x)=>{up.push(x);if(mode==='legacy'&&x.some(r=>'details' in r))return Promise.resolve({error:{code:'PGRST204',message:"Could not find the 'details' column"}});return Promise.resolve({error:null});},
    then:(res)=>{if(t==='fs_suppliers')return res({data:rows});if(t==='fs_meta')return res({data:[]});
      if(t==='fs_worksheet'){if(mode==='legacy'&&/details/.test(cols))return res({data:null,error:{code:'42703',message:'column fs_worksheet.details does not exist'}});
        return res({data:existing.map(r=>{const c=Object.assign({},r);if(mode==='legacy')delete c.details;return c;}),error:null});}
      return res({data:[]});}};return o;};
  w.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{user:{email:'philos@greymatterfusion.com'}}}}),signOut:async()=>{},onAuthStateChange:()=>{}},from:q})};
  w.history.replaceState=()=>{};w.eval(fs.readFileSync(R+'config.js','utf8'));w.eval(fs.readFileSync(R+'worksheet.js','utf8'));w.eval(fs.readFileSync(R+'app.js','utf8'));return {w,up,confirms};}
const old=[{supplier_id:'B2',gate_id:'certs',status:'In progress',evidence:'Legacy note kept',updated_by:'philoskim990@gmail.com',updated_at:'2026-11-05T12:00:00Z'}];
(async()=>{
 // legacy mode
 let {w,up}=mk('legacy',old);await tick(80);let D=w.document;
 ok(D.querySelectorAll('.gatecard').length===8,'7 gates + decision card');ok(/read-only until the database update/.test(D.getElementById('wsbanner').textContent),'migration banner');
 ok(D.getElementById('ev_certs').value==='Legacy note kept'&&D.getElementById('st_certs').value==='In progress','legacy evidence/status loaded');
 ok(D.getElementById('f_commercial_moq').disabled&&!D.getElementById('st_certs').disabled&&!D.getElementById('ev_certs').disabled,'expanded fields disabled, legacy editable');
 ok(D.getElementById('f_commercial_small_ok').value==='Unknown','order-size Unknown by default');
 ok(/not a qualification decision/.test(D.getElementById('wssum').textContent)&&/0<\/b> of 7 passed|0 of 7 passed/.test(D.getElementById('wssum').textContent),'summary honest');
 const ev=D.getElementById('ev_certs');ev.value='Legacy note edited';ev.dispatchEvent(new w.Event('input',{bubbles:true}));await tick();
 ok(D.getElementById('wsdirty').textContent==='Unsaved changes','dirty indicator');
 // supplier switch blocked when dirty (confirm returns false)
 const sup=D.getElementById('sup');sup.value='B1';sup.dispatchEvent(new w.Event('change'));await tick();ok(sup.value==='B2'&&!w.location.hash.includes('B1'),'switch blocked when dirty');
 D.getElementById('sv').click();await tick(80);
 ok(up.length===1&&up[0].length===7&&up[0].every(r=>!('details' in r)),'legacy save: 7 rows, no details key');
 ok(up[0].find(r=>r.gate_id==='certs').evidence==='Legacy note edited','evidence saved as plain text');
 ok(/Saved gate status and notes only/.test(D.getElementById('st').textContent),'honest legacy save message');ok(D.getElementById('wsdirty').textContent==='','dirty cleared');
 // expanded mode
 ({w,up}=mk('expanded',[Object.assign({},old[0],{details:{v:1,standard:'ISO 9001',urls:['https://example.com/cert']}})]));await tick(80);D=w.document;
 ok(!D.getElementById('wsbanner').textContent.trim(),'no banner when column exists');ok(D.getElementById('f_certs_standard').value==='ISO 9001','details loaded');
 ok(D.querySelector('.urls a')&&D.querySelector('.urls a').href==='https://example.com/cert','evidence url link');
 const moq=D.getElementById('f_commercial_moq');moq.value='HX-1: 25\nHX-2: 10';moq.dispatchEvent(new w.Event('input',{bubbles:true}));
 const so=D.getElementById('f_commercial_small_ok');so.value='Conditional';so.dispatchEvent(new w.Event('change',{bubbles:true}));await tick();
 ok(/MOQ per SKU: entered/.test(D.getElementById('wssum').textContent)&&/Conditional/.test(D.getElementById('wssum').textContent),'summary updates live');
 D.getElementById('sv').click();await tick(80);
 const saved=up[0];ok(saved.length===8&&saved.some(r=>r.gate_id==='decision'),'expanded save: 8 rows incl decision');
 const c=saved.find(r=>r.gate_id==='commercial');ok(c.details.moq==='HX-1: 25\nHX-2: 10'&&c.details.small_ok==='Conditional'&&c.details.v===1,'commercial details saved');
 ok(saved.find(r=>r.gate_id==='certs').evidence==='Legacy note kept','old evidence preserved on expanded save');
 ok(saved.find(r=>r.gate_id==='drawing').details.process_fit==='Unknown','untouched fields stay Unknown');
 ok(/Saved all gates/.test(D.getElementById('st').textContent),'expanded save message');
 console.log(n,'checks',f,'failures');process.exit(f?1:0);})();
