(function(){
const C=window.FS_CONFIG, sb=supabase.createClient(C.SUPABASE_URL,C.SUPABASE_PUBLISHABLE_KEY);
const $=s=>document.querySelector(s), app=$('#app'); $('#ver').textContent=C.VERSION;
const allowed=C.ALLOWED_EMAILS.filter(Boolean).map(e=>e.toLowerCase());
const KEYS=['cap','cert','scale','usexp','cost','lead','geo'], LBL=['Capability','Certs','Scale','US exp','Cost','Lead time','Geo risk'];
const DEF=[25,15,10,10,20,10,10];
const GATES=[['drawing','Drawing fit'],['certs','Certificates'],['customs','Customs history'],['fa','First article'],['audit','Plant/audit'],['commercial','Commercial'],['pilot','Pilot to volume']];
let S={user:null,rows:[],w:DEF.slice(),lk:Array(7).fill(false),f:{cat:'',reg:'',min:0,sort:'score'},t0:Date.now()};
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function log(type,sid,detail){ if(!S.user)return; sb.from('fs_events').insert({user_email:S.user,event_type:type,supplier_id:sid||null,detail:detail||{}}).then(()=>{}); }
function secs(){return Math.round((Date.now()-S.t0)/1000);}

function loginView(msg){
  $('#nav').style.display='none';
  app.innerHTML=`<div class="card login"><h1>Sign in</h1><p class="sub">Private supplier study. Authorized users only.</p>
  <input id="em" type="email" placeholder="Email" autocomplete="username"><input id="pw" type="password" placeholder="Password" autocomplete="current-password">
  <button class="btn" id="go">Sign in</button><p class="muted" id="msg">${esc(msg||'')}</p></div>`;
  $('#go').onclick=async()=>{const email=$('#em').value.trim().toLowerCase();
    if(!allowed.includes(email)){$('#msg').textContent='This portal is private.';return;}
    const {error}=await sb.auth.signInWithPassword({email,password:$('#pw').value});
    if(error)$('#msg').textContent=error.message; else boot();};
  $('#pw').onkeydown=e=>{if(e.key==='Enter')$('#go').click();};
}
async function boot(){
  const {data:{session}}=await sb.auth.getSession();
  if(!session)return loginView();
  const em=(session.user.email||'').toLowerCase();
  if(!allowed.includes(em)){await sb.auth.signOut();return loginView('This portal is private. Your account is not authorized.');}
  S.user=em; $('#nav').style.display='';
  const [r,m,p]=await Promise.all([sb.from('fs_suppliers').select('*'),sb.from('fs_meta').select('*'),sb.from('fs_weight_prefs').select('*').eq('user_email',em).maybeSingle()]);
  if(r.error){app.innerHTML=`<div class="card"><h2>Data not available</h2><p class="muted">${esc(r.error.message)}. Has schema_fs_v1.sql been run and seeded?</p></div>`;return;}
  S.rows=r.data||[]; (m.data||[]).forEach(x=>{if(x.key==='data_as_of')$('#asof').textContent=x.value;});
  if(p.data&&p.data.weights?.length===7){S.w=p.data.weights;S.lk=p.data.locked||S.lk;}
  S.t0=Date.now(); log('session_start',null,{ua:navigator.userAgent});
  setInterval(()=>log('session_ping',null,{seconds:secs(),kind:'heartbeat'}),60000);
  route();
}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')log('session_ping',null,{seconds:secs(),kind:'hidden'});});
window.addEventListener('beforeunload',()=>log('session_ping',null,{seconds:secs(),kind:'unload'}));
$('#logout').onclick=async e=>{e.preventDefault();log('session_end',null,{seconds:secs()});await sb.auth.signOut();S.user=null;loginView();};
window.addEventListener('hashchange',()=>S.user&&route());
function route(){const ws=location.hash.startsWith('#/worksheet');
  document.querySelectorAll('nav a[data-v]').forEach(a=>a.classList.toggle('on',a.dataset.v===(ws?'ws':'score')));
  ws?worksheet():scorecard();}

// --- weights: always total 100; locked stay fixed (same rebalance as canvas) ---
function setW(i,v){
  const lockedSum=S.w.reduce((a,x,j)=>a+(S.lk[j]&&j!==i?x:0),0);
  const free=KEYS.map((_,j)=>j).filter(j=>j!==i&&!S.lk[j]);
  v=Math.max(0,Math.min(Math.round(v),100-lockedSum)); if(!free.length)return; // nothing to absorb
  const rem=100-lockedSum-v, cur=free.reduce((a,j)=>a+S.w[j],0);
  free.forEach(j=>S.w[j]=cur>0?S.w[j]*rem/cur:rem/free.length);
  S.w[i]=v; free.forEach(j=>S.w[j]=Math.round(S.w[j]));
  const diff=100-S.w.reduce((a,b)=>a+b,0); if(diff){const j=free.reduce((b,j)=>S.w[j]>S.w[b]?j:b,free[0]);S.w[j]+=diff;}
  savePrefs();
}
let pt; function savePrefs(){clearTimeout(pt);pt=setTimeout(()=>sb.from('fs_weight_prefs').upsert({user_email:S.user,weights:S.w,locked:S.lk,updated_at:new Date().toISOString()}).then(()=>{}),800);}
const score=r=>KEYS.reduce((a,k,i)=>a+(r[k]||0)*S.w[i],0)/100;

function scorecard(){
  const cats=[...new Set(S.rows.map(r=>r.category))].sort(), regs=[...new Set(S.rows.map(r=>r.region))].sort();
  app.innerHTML=`<h1>Supplier scorecard</h1><p class="sub">${S.rows.length} screened candidates · weighted 1–5 scores</p>
  <div class="callout"><b>Dual-source pairs:</b> Hydraulics — HAWE / Yuken · Forgings — Bharat Forge / Hirschvogel · Machined parts — Sansera / Craftsman.</div>
  <div class="card" style="margin-bottom:14px"><h2>Weights</h2><div class="weights" id="wts"></div>
  <div class="wtot"><span id="tot"></span> &nbsp; <button class="btn sec" id="rst">Return to defaults</button></div></div>
  <div class="filters"><select id="fc"><option value="">All categories</option>${cats.map(c=>`<option>${esc(c)}</option>`).join('')}</select>
  <select id="fr"><option value="">All regions</option>${regs.map(c=>`<option>${esc(c)}</option>`).join('')}</select>
  <label>Min score <input id="fm" type="number" step="0.1" min="0" max="5" style="width:70px"></label>
  <select id="fs"><option value="score">Sort: score</option><option value="name">Sort: name</option><option value="country">Sort: country</option><option value="cost">Sort: cost</option></select></div>
  <div class="card wrap"><table class="tbl" id="tb"></table></div><div id="det"></div>`;
  $('#fc').value=S.f.cat;$('#fr').value=S.f.reg;$('#fm').value=S.f.min||'';$('#fs').value=S.f.sort;
  [['#fc','cat'],['#fr','reg'],['#fs','sort']].forEach(([s,k])=>$(s).onchange=e=>{S.f[k]=e.target.value;table();});
  $('#fm').oninput=e=>{S.f.min=+e.target.value||0;table();};
  $('#rst').onclick=()=>{S.w=DEF.slice();S.lk=Array(7).fill(false);savePrefs();weights();table();};
  weights();table();
}
function weights(){
  $('#wts').innerHTML=KEYS.map((k,i)=>`<div class="w"><span>${LBL[i]}</span><input type="range" min="0" max="100" value="${S.w[i]}" data-i="${i}" ${S.lk[i]?'disabled':''}>
  <input type="number" min="0" max="100" value="${S.w[i]}" data-n="${i}" ${S.lk[i]?'disabled':''}><label><input type="checkbox" data-l="${i}" ${S.lk[i]?'checked':''}> Lock</label></div>`).join('');
  $('#tot').textContent='Total: '+S.w.reduce((a,b)=>a+b,0)+'%';
  const sync=()=>{KEYS.forEach((_,j)=>{$(`[data-i="${j}"]`).value=S.w[j];const n=$(`[data-n="${j}"]`);if(document.activeElement!==n)n.value=S.w[j];});table();};
  document.querySelectorAll('[data-i]').forEach(el=>el.oninput=()=>{setW(+el.dataset.i,+el.value);sync();});
  document.querySelectorAll('[data-n]').forEach(el=>el.onchange=()=>{setW(+el.dataset.n,+el.value);el.value=S.w[+el.dataset.n];sync();});
  document.querySelectorAll('[data-l]').forEach(el=>el.onchange=()=>{S.lk[+el.dataset.l]=el.checked;savePrefs();weights();});
}
function table(){
  let rows=S.rows.map(r=>({...r,_s:score(r)})).filter(r=>(!S.f.cat||r.category===S.f.cat)&&(!S.f.reg||r.region===S.f.reg)&&r._s>=S.f.min);
  const so=S.f.sort; rows.sort((a,b)=>so==='score'?b._s-a._s:so==='cost'?(b.cost||0)-(a.cost||0):String(a[so]).localeCompare(b[so]));
  $('#tb').innerHTML=`<tr><th>#</th><th>Supplier</th><th>Cat</th><th>Country</th><th>Makes</th>${['Cap','Cert','Scale','US','Cost','Lead','Geo'].map(h=>`<th>${h}</th>`).join('')}<th>Score</th><th>US presence</th><th>Certs</th><th>Source</th></tr>`+
  rows.map((r,n)=>`<tr class="r" data-id="${esc(r.id)}"><td>${n+1}</td><td><b>${esc(r.name)}</b></td><td>${esc(r.category)}</td><td>${esc(r.country)}</td><td>${esc(r.what_they_make)}</td>${KEYS.map(k=>`<td>${r[k]??''}</td>`).join('')}<td class="sc">${r._s.toFixed(2)}</td><td>${esc(r.us_presence)}</td><td>${esc(r.certs_note)}</td><td>${r.url?`<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.url.replace(/^https?:\/\//,''))}</a>`:''}</td></tr>`).join('');
  document.querySelectorAll('tr.r').forEach(tr=>tr.onclick=e=>{if(e.target.tagName==='A'){log('source_click',tr.dataset.id,{url:e.target.href});return;}detail(tr.dataset.id);});
}
function detail(id){const r=S.rows.find(x=>x.id===id);if(!r)return;log('supplier_open',id,{name:r.name});
  $('#det').innerHTML=`<div class="card detail"><button class="btn sec" style="float:right" id="dx">×</button><h2>${esc(r.name)}</h2>
  <p class="muted">${esc(r.category)} · ${esc(r.country)} (${esc(r.region)})</p><p>${esc(r.what_they_make)}</p><p><b>US:</b> ${esc(r.us_presence)}</p><p><b>Certs:</b> ${esc(r.certs_note)}</p>
  <p>${KEYS.map((k,i)=>`${LBL[i]}: <b>${r[k]??'–'}</b>`).join(' · ')}</p><p>Weighted score: <b>${score(r).toFixed(2)}</b></p>
  ${r.url?`<p><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.url)}</a></p>`:''}<a class="btn" href="#/worksheet?s=${encodeURIComponent(id)}">Open worksheet</a></div>`;
  $('#dx').onclick=()=>$('#det').innerHTML='';}

async function worksheet(){
  const q=new URLSearchParams(location.hash.split('?')[1]||''); const sel=q.get('s')||(S.rows[0]||{}).id;
  const opts=S.rows.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(r=>`<option value="${esc(r.id)}" ${r.id===sel?'selected':''}>${esc(r.name)} (${esc(r.category)})</option>`).join('');
  app.innerHTML=`<h1>Supplier Qualification Worksheet</h1><p class="sub">Seven gates from short list to volume. Saved to shared worksheet.</p>
  <div class="card"><select id="sup" class="fld" style="max-width:420px">${opts}</select><div id="gates"></div><button class="btn" id="sv">Save</button> <span class="muted" id="st"></span></div>`;
  $('#sup').onchange=e=>location.hash='#/worksheet?s='+encodeURIComponent(e.target.value);
  const {data}=await sb.from('fs_worksheet').select('*').eq('supplier_id',sel); const m={};(data||[]).forEach(x=>m[x.gate_id]=x);
  $('#gates').innerHTML=GATES.map(([g,l])=>{const x=m[g]||{};return `<div class="gate"><b>${l}</b><select class="fld" data-g="${g}">${['Not started','In progress','Passed','Failed','N/A'].map(s=>`<option ${x.status===s?'selected':''}>${s}</option>`).join('')}</select>
  <input class="fld" data-e="${g}" placeholder="Evidence / notes" value="${esc(x.evidence||'')}"></div>`}).join('');
  log('worksheet_open',sel);
  $('#sv').onclick=async()=>{const now=new Date().toISOString();
    const rows=GATES.map(([g])=>({supplier_id:sel,gate_id:g,status:$(`[data-g="${g}"]`).value,evidence:$(`[data-e="${g}"]`).value,updated_by:S.user,updated_at:now}));
    const {error}=await sb.from('fs_worksheet').upsert(rows); $('#st').textContent=error?error.message:'Saved '+new Date().toLocaleTimeString(); if(!error)log('worksheet_save',sel);};
}
if(C.GA4_MEASUREMENT_ID){const s=document.createElement('script');s.async=1;s.src='https://www.googletagmanager.com/gtag/js?id='+C.GA4_MEASUREMENT_ID;document.head.appendChild(s);window.dataLayer=window.dataLayer||[];window.gtag=function(){dataLayer.push(arguments)};gtag('js',new Date());gtag('config',C.GA4_MEASUREMENT_ID);}
sb.auth.onAuthStateChange(ev=>{if(ev==='SIGNED_OUT')S.user=null;});
boot();
})();
