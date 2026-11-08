// Static snapshot checks plus live anon calls with the publishable key. No service-role key.
const fs=require('fs'),crypto=require('crypto'),path=require('path');
const R=path.join(__dirname,'..');
let f=0,n=0;const ok=(c,m)=>{n++;if(!c){f++;console.log('FAIL',m);}};
const app=fs.readFileSync(R+'/app.js','utf8');
const config=fs.readFileSync(R+'/config.js','utf8');
const html=fs.readFileSync(R+'/index.html','utf8');
const sql=fs.readFileSync(R+'/migration_fs_v1_5_china_candidates.sql','utf8');
const cat=JSON.parse(fs.readFileSync(R+'/catalog.js','utf8').replace(/^window\.FS_CATALOG\s*=\s*/,'').replace(/;\s*$/,''));
const archive=JSON.parse(fs.readFileSync(R+'/archive_cost_historical.json','utf8'));
const costById=Object.fromEntries(archive.suppliers.map(r=>[r.id,r.cost]));
const keys=['id','category','name','country','region','what_they_make','us_presence','certs_note','url','url_check','cap','cert','scale','usexp','cost','lead','geo'];
ok(!cat.suppliers.some(r=>Object.prototype.hasOwnProperty.call(r,'cost')),'public catalog does not carry cost integers');
const core=cat.suppliers.filter(r=>r.pass==='2026-11-02').map(r=>{const o={};keys.forEach(k=>{o[k]=k==='cost'?costById[r.id]:(r[k]??null);});return o;}).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
ok(crypto.createHash('sha256').update(JSON.stringify(core)).digest('hex')==='96e51d23034cc6de859856f89d2e05a86064af200206d2328a63ba73fd92db0d','original 34 rows unchanged, with cost kept only in the archive');
ok(cat.suppliers.length===38&&cat.suppliers.filter(r=>r.pass==='2026-11-06').map(r=>r.id).join()==='C13,C14,D10,D11','four Nov 6 additions');
ok(!cat.suppliers.some(r=>r.id==='B14'||r.id==='B15'),'Huade and Taifeng are not scored suppliers');
ok(cat.watchlist.map(w=>w.id).join()==='B14,B15,WL-TZ','watchlist is separate');
const def=[25,15,10,10,20,10,10];
for(const [id,exp] of [['C13',3.35],['C14',3.1],['D10',3.5],['D11',3.3]]){
  const r=cat.suppliers.find(x=>x.id===id);
  const sc=['cap','cert','scale','usexp','cost','lead','geo'].reduce((a,k,i)=>a+(k==='cost'?costById[r.id]:r[k])*def[i],0)/100;
  ok(Math.abs(sc-exp)<1e-9, id+' archived historical score '+sc);
}
ok((cat.discovery||[]).length===6&&(cat.discovery||[]).every(r=>r.scored===false&&r.cap==null),'six leads have no fabricated scores');
const blob=JSON.stringify(cat);
for(const bad of ['user_email','fs_events','fs_worksheet','fs_weight_prefs','service_role','sb_secret','@gmail','thume@','philos']) ok(!blob.includes(bad),'catalog has no '+bad);
ok(/GA4_MEASUREMENT_ID:\s*""/.test(config),'GA4 disabled');
ok(!/googletagmanager|gtag\(/.test(html),'no analytics tag in the page');
ok(!/sendBeacon|posthog|plausible|umami/.test(app),'no extra telemetry');
ok(!/service_role|sb_secret/.test(app+config+html),'no secret key in the client');
const froms=[...app.matchAll(/\.from\('([^']+)'\)/g)].map(m=>m[1]);
ok(froms.length>0&&froms.every(t=>['fs_events','fs_weight_prefs','fs_worksheet'].includes(t)),'client only names private tables it still uses: '+froms.join(','));
const logFn=app.slice(app.indexOf('function log('), app.indexOf('function secs'));
ok(logFn.indexOf('if(!S.user)return')>=0&&logFn.indexOf('if(!S.user)return')<logFn.indexOf(".from('fs_events')"),'events are not written without a user');
const save=app.slice(app.indexOf('function savePrefs'), app.indexOf('const score='));
ok(save.indexOf('if(!S.user)')>=0&&save.indexOf('return')<save.indexOf("fs_weight_prefs"),'anonymous weights return before the prefs write');
ok(!/grant\s+[^;]*\bto\s+anon\b/i.test(sql),'migration does not grant anon');
ok(/on conflict \(id\) do nothing/i.test(sql),'migration does not overwrite supplier ids');
ok(!/create or replace function public\.fs_allowed/i.test(sql),'migration does not replace the editor function');
ok(!/public\.(applications|contacts|companies|user_notes|action_items|activities|interactions|portal_actions|app_meta)/.test(sql),'migration does not name job-portal tables');
ok(!/auth\.config|site_url/i.test(sql),'migration does not touch auth site URL');

const url=config.match(/SUPABASE_URL:\s*"([^"]+)"/)[1];
const key=config.match(/SUPABASE_PUBLISHABLE_KEY:\s*"([^"]+)"/)[1];
ok(key.startsWith('sb_publishable_'),'client key is the publishable key');
const tables=['fs_suppliers','fs_meta','fs_events','fs_worksheet','fs_weight_prefs','fs_usage_summary','applications','companies','contacts','user_notes','app_meta','action_items','activities','interactions','portal_actions'];
(async()=>{
  const headers={apikey:key,Authorization:'Bearer '+key,Accept:'application/json','Content-Type':'application/json',Prefer:'return=representation'};
  async function call(method, p, body){
    const res=await fetch(url+'/rest/v1/'+p,{method,headers,body:body?JSON.stringify(body):undefined});
    const text=await res.text();
    let code=''; try{code=JSON.parse(text).code||'';}catch(e){}
    return {status:res.status, code, leaked:/Bosch Rexroth|user_email|evidence/.test(text)&&res.status<400};
  }
  for(const t of tables){
    const r=await call('GET', t+'?select=*&limit=2');
    ok(r.status>=400&&!r.leaked, 'anon read '+t+' denied ('+r.status+' '+r.code+')');
  }
  const writes=[
    ['POST','fs_suppliers',{id:'ZZZ_FS_SECURITY_PROBE',name:'nope',category:'Hydraulics'}],
    ['POST','fs_events',{user_email:'fs-security-probe@invalid.test',event_type:'session_start',detail:{}}],
    ['POST','fs_worksheet',{supplier_id:'B1',gate_id:'drawing',status:'Passed',evidence:'probe'}],
    ['POST','fs_weight_prefs',{user_email:'fs-security-probe@invalid.test',weights:[25,15,10,10,20,10,10],locked:[false,false,false,false,false,false,false]}],
    ['PATCH','fs_suppliers?id=eq.B1',{cap:1}],
    ['DELETE','fs_suppliers?id=eq.B1',null],
    ['POST','applications',{id:'ZZZ_FS_SECURITY_PROBE'}]
  ];
  for(const [method,p,body] of writes){
    const r=await call(method,p,body);
    ok(r.status>=400&&!r.leaked, 'anon '+method+' '+p.split('?')[0]+' denied ('+r.status+' '+r.code+')');
  }
  console.log(n,'checks',f,'failures');
  process.exit(f?1:0);
})().catch(e=>{console.log('FAIL', e.message); process.exit(1);});
