(function(){
const C=window.FS_CONFIG;
// Password setup: admin-generated recovery links use the implicit flow (tokens in URL hash). Read flags BEFORE the client consumes them; never log tokens.
function authUrlState(hash,search){const h=new URLSearchParams((hash||'').replace(/^#/,'')), q=new URLSearchParams(search||'');
  return {recovery:h.get('type')==='recovery'||q.has('setup'), error:h.get('error_description')||q.get('error_description')||'', hasTokens:h.has('access_token')||h.has('refresh_token')||q.has('code')};}
const AUTH0=authUrlState(location.hash,location.search);
const sb=supabase.createClient(C.SUPABASE_URL,C.SUPABASE_PUBLISHABLE_KEY,{auth:{flowType:'implicit',detectSessionInUrl:true,persistSession:true}});
const cleanUrl=()=>history.replaceState(null,'',location.pathname);
const $=s=>document.querySelector(s), app=$('#app'); $('#ver').textContent=C.VERSION;
const allowed=C.ALLOWED_EMAILS.filter(Boolean).map(e=>e.toLowerCase());
const KEYS=['cap','cert','scale','usexp','cost','lead','geo'], LBL=['Capability','Certs','Scale','US exp','Cost','Lead time','Geo risk'];
const DEF=[25,15,10,10,20,10,10];
const GATES=[['drawing','Drawing fit'],['certs','Certificates'],['customs','Customs history'],['fa','First article'],['audit','Plant/audit'],['commercial','Commercial'],['pilot','Pilot to volume']];
let S={user:null,rows:[],w:DEF.slice(),lk:Array(7).fill(false),f:{cat:'',reg:'',min:0,sort:'score'},t0:Date.now()};
const safeUrl=u=>/^https?:\/\//i.test(u||'')?u:'';
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function log(type,sid,detail){ if(!S.user)return; sb.from('fs_events').insert({user_email:S.user,event_type:type,supplier_id:sid||null,detail:detail||{}}).then(()=>{}); }
function secs(){return Math.round((Date.now()-S.t0)/1000);}

function pwField(id,label,ac,ph){return `<label class="fl" for="${id}">${label}</label><div class="pwwrap"><input id="${id}" type="password" placeholder="${ph}" autocomplete="${ac}" autocapitalize="off" spellcheck="false"><button type="button" class="pwtog" data-for="${id}" aria-controls="${id}" aria-pressed="false" aria-label="Show ${label.toLowerCase()}">Show</button></div>`;}
function wirePwToggles(){document.querySelectorAll('.pwtog').forEach(b=>b.onclick=()=>{const i=document.getElementById(b.dataset.for),show=i.type==='password';
  i.type=show?'text':'password'; b.setAttribute('aria-pressed',String(show)); b.textContent=show?'Hide':'Show';
  b.setAttribute('aria-label',(show?'Hide ':'Show ')+b.getAttribute('aria-label').replace(/^(Show|Hide) /,'')); i.focus();});}
function setPasswordView(em){
  $('#nav').style.display='none';
  app.innerHTML=`<div class="card login"><h1>Set your password</h1><p class="sub">${esc(em)}</p>
  ${pwField('p1','New password','new-password','12+ characters')}${pwField('p2','Repeat password','new-password','Repeat password')}
  <button class="btn" id="setpw">Save password</button><p class="muted" id="msg" role="status"></p></div>`; wirePwToggles();
  $('#setpw').onclick=async()=>{const a=$('#p1').value,b=$('#p2').value;
    if(a.length<12){$('#msg').textContent='Use at least 12 characters.';return;} if(a!==b){$('#msg').textContent='Passwords do not match.';return;}
    $('#setpw').disabled=true; const {error}=await sb.auth.updateUser({password:a}); $('#p1').value='';$('#p2').value='';$('#p1').type=$('#p2').type='password';
    if(error){$('#setpw').disabled=false;$('#msg').textContent=error.message;return;}
    pwSetup=false; boot();};
}
function loginView(msg){
  $('#nav').style.display='none';
  app.innerHTML=`<div class="card login"><h1>Sign in</h1><p class="sub">Private supplier study. Authorized users only.</p><p class="muted" style="font-size:12px">Usage notice: this portal records sign-in sessions, time on site, supplier rows opened, source links clicked and worksheet saves, linked to your email. The portal owner (Philos Kim) can review this activity.</p>
  <label class="fl" for="em">Email</label><input id="em" type="email" placeholder="Email" autocomplete="username">${pwField('pw','Password','current-password','Password')}
  <button class="btn" id="go">Sign in</button><p class="muted" id="msg" role="status">${esc(msg||'')}</p></div>`; wirePwToggles();
  $('#go').onclick=async()=>{const email=$('#em').value.trim().toLowerCase();
    if(!allowed.includes(email)){$('#msg').textContent='This portal is private.';return;}
    const {error}=await sb.auth.signInWithPassword({email,password:$('#pw').value});
    if(error)$('#msg').textContent=error.message; else {$('#pw').value='';boot();}};
  $('#pw').onkeydown=e=>{if(e.key==='Enter')$('#go').click();};
}
let pwSetup=AUTH0.recovery;
async function boot(){
  const {data:{session}}=await sb.auth.getSession();
  if(AUTH0.hasTokens||AUTH0.error||AUTH0.recovery)cleanUrl(); AUTH0.hasTokens=false;
  if(AUTH0.error){const m=AUTH0.error;AUTH0.error='';pwSetup=false;return loginView('Link problem: '+m+'. Ask the owner for a new setup link.');}
  if(!session){pwSetup=false;return loginView();}
  const em=(session.user.email||'').toLowerCase();
  if(!allowed.includes(em)){await sb.auth.signOut();return loginView('This portal is private. Your account is not authorized.');}
  if(pwSetup)return setPasswordView(em);
  S.user=em; $('#nav').style.display='';
  const [r,m,p]=await Promise.all([sb.from('fs_suppliers').select('*'),sb.from('fs_meta').select('*'),sb.from('fs_weight_prefs').select('*').eq('user_email',em).maybeSingle()]);
  if(r.error){app.innerHTML=`<div class="card"><h2>Data not available</h2><p class="muted">${esc(r.error.message)}. Has schema_fs_v1.sql been run and seeded?</p></div>`;return;}
  S.rows=r.data||[]; (m.data||[]).forEach(x=>{if(x.key==='data_as_of')$('#asof').textContent=x.value; if(x.key==='homepage_recheck'){try{S.recheck=JSON.parse(x.value);}catch(e){}}});
  if(p.data&&validW(p.data.weights,p.data.locked)){S.w=p.data.weights;S.lk=p.data.locked.map(Boolean);}
  S.t0=Date.now(); log('session_start',null,{ua:navigator.userAgent});
  setInterval(()=>log('session_ping',null,{seconds:secs(),kind:'heartbeat'}),60000);
  route();
}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')log('session_ping',null,{seconds:secs(),kind:'hidden'});});
window.addEventListener('beforeunload',()=>log('session_ping',null,{seconds:secs(),kind:'unload'}));
$('#logout').onclick=async e=>{e.preventDefault();log('session_end',null,{seconds:secs()});await sb.auth.signOut();S.user=null;loginView();};
let lastHash=location.hash;
window.addEventListener('hashchange',()=>{if(!S.user)return; if(S.wsDirty&&!confirm('You have unsaved worksheet changes. Leave without saving?')){history.replaceState(null,'',lastHash||'#/worksheet');return;} S.wsDirty=false; lastHash=location.hash; route();});
window.addEventListener('beforeunload',e=>{if(S.wsDirty){e.preventDefault();e.returnValue='';}});
function route(){const h=location.hash, v=h.startsWith('#/worksheet')?'ws':h.startsWith('#/sources')?'src':h.startsWith('#/study')?'study':'score';
  document.querySelectorAll('nav a[data-v]').forEach(a=>a.classList.toggle('on',a.dataset.v===v));
  v==='ws'?worksheet():v==='src'?sources():v==='study'?study():scorecard();}
const ALTS=[
 {fam:'Hydraulics (pumps, power packs, valves)',lead:'HAWE Hydraulik (Germany)',leadWhy:'Public catalog shows compact high-pressure pumps and power packs up to 700 bar, the closest catalog fit to bolting-tool pumps among the 34. US entity: HAWE North America.',
  alt:'Yuken Kogyo or Kawasaki Precision Machinery (Japan)',altWhy:'Established pump and valve makers outside China with US offices (Yuken America, KPM USA). Considered for geographic spread, not because their parts are known to match HAWE units.',
  note:'Bosch Rexroth scores highest overall but is broader than this need. Jiangsu Hengli (China) is an option for cylinders, with tariff exposure to be checked.'},
 {fam:'Forgings / castings',lead:'Bharat Forge (India)',leadWhy:'Large closed-die forging and machining group with a US sales arm (Bharat Forge America). Considered as a non-China option for volume forgings.',
  alt:'Hirschvogel (Germany) or voestalpine BÖHLER (Austria)',altWhy:'European options for high-alloy or critical grades (for example reaction-arm material), at an expected higher unit price.',note:''},
 {fam:'Precision machining',lead:'Sansera Engineering or Craftsman Automation (India)',leadWhy:'Precision machining groups with automotive/aerospace work on their public sites. Considered for cost and to pair with Indian forging where practical.',
  alt:'Hirschvogel (machining) or Zollern (Germany)',altWhy:'Forge-plus-machine or cast-plus-machine in one supplier, which can cut handoffs. Ashot Ashkelon (Israel) noted for the tightest tolerances.',note:''}];
function altCards(){return `<div class="card" style="margin-bottom:14px"><h2>Proposed sourcing alternatives (not qualified or interchangeable yet)</h2>
 <p class="muted" style="margin-top:-6px">For each part family: a proposed lead candidate and an alternative to look at second, so the short list does not depend on one supplier or one country. These are starting points from desk research. No supplier here has been shown to make the same part as another. HYTORC drawings, pressure class, material grade and trial results may change the picks.</p>
 <div class="alts">${ALTS.map(x=>`<div class="alt"><h3>${esc(x.fam)}</h3>
  <p><span class="tag">Lead candidate</span> <b>${esc(x.lead)}</b><br><span class="muted">${esc(x.leadWhy)}</span></p>
  <p><span class="tag alt2">Alternative</span> <b>${esc(x.alt)}</b><br><span class="muted">${esc(x.altWhy)}</span></p>
  ${x.note?`<p class="muted" style="font-size:12px">${esc(x.note)}</p>`:''}
  <p style="font-size:12px"><b>Before treating it as a second source:</b> drawing and spec fit for the specific part, material/pressure class, verified certificates, first-article samples, and a pilot lot. <a href="#/worksheet">Worksheet</a></p></div>`).join('')}</div></div>`;}

const CHANNELS={
 used:[
  ['Known industry names','Desk research from manufacturers known in each part family (hydraulics, forgings/castings, precision machining).','Not a systematic search; the list can miss smaller or regional suppliers.'],
  ['Public company websites and product pages','What each supplier makes, footprint, and certification claims. Homepage linked per supplier on the Sources table below.','Marketing content. Certifications are listed as expected, not verified.'],
  ['Known US subsidiaries / sales offices','Used as the US-export signal in the "US" score.','A US office shows US presence. It does not verify customs volume, which parts ship, or to whom.']],
 planned:[
  ['ImportYeti','https://www.importyeti.com/','US customs bill-of-lading records, useful at three stages. <b>Discovery:</b> search by product description or by the suppliers of similar US buyers to find candidates not on this list. <b>Screening:</b> shipment patterns (frequency, volume, recency) and US customers as an early read on real US export experience. <b>Validation:</b> cross-check a supplier\'s claimed US customers and export history.','Records can be incomplete, delayed, or filed under a parent company, trading company, or forwarder. Shipment data does not prove quality, drawing fit, capacity, MOQ, or pricing.'],
  ['Panjiva (S&P Global)','https://panjiva.com/','Same discovery, screening and validation uses with broader coverage and filters (subscription service).','Paid; same limitations as above.'],
  ['TIMTOS exhibitor list (Taiwan machine tools)','https://www.timtos.com.tw/en/exhibitor/company-name-data/index.html','Taiwan machining and component makers to deepen the thin Taiwan list.','Exhibiting is not an audit of capability or quality.'],
  ['KOTRA / buyKOREA (Korea)','https://buykorea.org/','Korean manufacturers by category to deepen the thin Korea list. KOTRA main site: kotra.or.kr.','Directory listing is self-reported, not verified capability.'],
  ['PTC ASIA (Shanghai, power transmission & hydraulics)','https://www.ptc-asia.com/index-en.html','Hydraulics and transmission exhibitors in China and Asia.','Exhibitor list not yet located on the site; same directory caveat.'],
  ['EMO Hannover (metalworking)','https://emo-hannover.de/en/','European and global machining and machine-tool exhibitors.','Same directory caveat.']]};
function sources(){
  const rc=S.recheck||{results:{}}; log('sources_open');
  app.innerHTML=`<h1>Sources</h1><p class="sub">Research channels for this short list, and what each link does and does not prove. See <a href="#/study">Study</a> for the full method.</p>
  <div class="card" style="margin-bottom:14px"><h2>Used in this screening (desk pass, Nov 2, 2026)</h2>
  <table class="tbl"><thead><tr><th>Channel</th><th>How it was used</th><th>Limitation</th></tr></thead><tbody>
  ${CHANNELS.used.map(c=>`<tr><td><b>${esc(c[0])}</b></td><td>${esc(c[1])}</td><td>${esc(c[2])}</td></tr>`).join('')}</tbody></table>
  <p class="muted" style="font-size:12px">No supplier was contacted, no quote requested, and no certificate pulled. Which reference first surfaced each individual supplier was not recorded.</p></div>
  <div class="card" style="margin-bottom:14px"><h2>Planned research channels (not yet checked)</h2>
  <p class="muted" style="margin-top:-6px">Named in the study as the next research step. Customs-data platforms can both find new candidates and screen or validate existing ones; exhibitor lists mainly add candidates. None of these has been searched for any supplier yet. Links are to the public service or event site (opened Nov 6, 2026).</p>
  <table class="tbl"><thead><tr><th>Channel</th><th>What would be checked</th><th>Limitation</th></tr></thead><tbody>
  ${CHANNELS.planned.map(c=>`<tr><td><b>${esc(c[0])}</b><br><a href="${esc(c[1])}" target="_blank" rel="noopener">${esc(c[1].replace(/^https?:\/\//,''))}</a></td><td>${c[2]}</td><td>${esc(c[3])}</td></tr>`).join('')}</tbody></table></div>
  <div class="card wrap tblwrap"><h2>Per-supplier sources</h2><table class="tbl"><thead><tr><th>Supplier</th><th>Found via</th><th>Company URL</th><th>Original check (Nov 2)</th><th>Re-check (${esc(rc.checked||'—')}, automated)</th><th>What the URL supports</th></tr></thead><tbody>
  ${S.rows.slice().sort((a,b)=>a.id.localeCompare(b.id,undefined,{numeric:true})).map(r=>{const x=rc.results[r.url]||'';return `<tr><td><b>${esc(r.name)}</b><br><span class="muted">${esc(r.id)}</span></td>
  <td>Known industry name + company website. Specific discovery trail not recorded.</td>
  <td class="u">${safeUrl(r.url)?`<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.url.replace(/^https?:\/\//,''))}</a>`:'—'}</td>
  <td>${esc(r.url_check===200?'Site responded':(r.url_check??'not recorded'))}</td><td>${esc(x?(x.split(' ')[0]==='200'?'Site responded':'HTTP '+x.split(' ')[0]+' (likely blocks scripts)'):'not rechecked')}</td>
  <td>Company exists; product family. Homepage only. Not a product, certificate, or customs record.</td></tr>`}).join('')}</tbody></table>
  <p class="muted" style="font-size:12px">Re-check is a later scripted page load showing the site responded. It was not part of the original discovery.</p></div>`;
}
const RUBRIC=[['Capability','25%','Clear public fit to the part family (e.g. HAWE compact ~700 bar packs)','Makes related products; fit to HYTORC geometry unproven from the site','Wrong category or no public evidence of the process'],
 ['Certs','15%','ISO / IATF / AS9100 named on site for the relevant scope (still unverified)','Quality system mentioned without a named standard','Nothing found'],
 ['Scale','10%','Multi-plant / global footprint visible','Single solid plant or mid-size group','Small or unclear capacity'],
 ['US export','10%','Named US subsidiary or sales office','US presence claimed without a clear office','No US footprint found'],
 ['Landed cost','20%','Lower expected total landed cost','Mid; Europe often here on unit price','Higher expected landed cost (EU precision, or higher-tariff origins)'],
 ['Lead time','10%','Shorter expected door-to-door','Typical ocean from Asia or Europe','Longer or congested lanes expected'],
 ['Geo risk','10%','Lower concentration / tariff / disruption risk','Moderate','Higher; single-country exposure']];
function study(){ log('study_open');
  const li=a=>`<ul>${a.map(x=>`<li>${x}</li>`).join('')}</ul>`;
  app.innerHTML=`<h1>HYTORC supplier sourcing study</h1><p class="sub">Prepared for Teddy Hume by Philos Kim. Desk research pass, Nov 2, 2026. Live controls are on <a href="#/">Scorecard</a> and <a href="#/worksheet">Worksheet</a>; channels on <a href="#/sources">Sources</a>.</p>
  <div class="card study">
  <h2>Purpose and scope</h2><p>A starting short list for a sourcing review: real manufacturers, a scorecard that can be re-weighted, and alternative candidates per part family rather than a single low-cost bet. Three part families that are usually spec-critical for hydraulic bolting tools: hydraulics (pumps, valves, power packs, hoses), forgings and castings, and precision machining. Sockets and fasteners were left out because they are more standardized.</p>
  <p>Geography: China, Taiwan, Korea, Japan, India and Europe (Germany, Austria, Italy, Poland, Czech Republic, Israel), chosen for where each part family is strong rather than lowest cost alone. 34 suppliers: 13 hydraulics, 12 forgings/castings, 9 precision machining.</p>
  <h2>How scores were set</h2><p>Each of the seven scores is a 1–5 desk judgment from public websites only: no quotes, plant visits, or certificate downloads. Default weights total 100 and can be changed on the Scorecard.</p>
  <div class="wrap"><table class="tbl"><thead><tr><th>Criterion</th><th>Default weight</th><th>5 (strong)</th><th>3 (mixed)</th><th>1 (weak)</th></tr></thead><tbody>${RUBRIC.map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
  <div class="callout" style="margin-top:10px"><b>Capability is catalog fit, not an audit.</b> It reflects product and process fit from public material, not plant quality. Certifications are expected from public text, not verified. Quality is established through the qualification steps below.</div>
  <h2>Landed cost assumption</h2><p>The Cost score is meant to reflect expected landed cost, not factory price alone:</p>
  <p class="eq">Landed cost ≈ unit price + freight + insurance + duties and any additional tariffs (e.g. Section 301 / 232 where applicable) + broker fees</p>
  ${li(['Tariff treatment varies by HTS line, origin and date, and has changed often. Rates were not verified line by line in this pass; each Cost cell is a starting flag, not a quote.','Europe tends to score lower on Cost (higher unit price) and higher on Capability and Geo risk. That tradeoff is intentional and adjustable with the weights.','Steel and aluminum content can shift forging and casting costs where metal tariffs apply.'])}
  <h2>Proposed sourcing alternatives</h2><p>Summarized on the Scorecard. Lead and alternative candidates per part family are a starting point. They are not qualified and not interchangeable until drawings, specs and trials confirm fit.</p>
  <h2>Beyond factories: private label and agents</h2>
  ${li(['<b>Private label / white label:</b> buying a ready-made or lightly adapted product under the HYTORC name. Private label usually implies some exclusivity or customization; white label is a generic product many brands rebrand.','<b>Where it fits:</b> standard or near-standard items (hoses, fittings, some valves, C-parts, packaging) more than housings, reaction arms, or compact high-pressure pumps that must match tool geometry.','<b>Industrial distributors</b> with private-label programs can cover the standardized slice; they are a weaker fit for unique hydraulic power packs.','<b>Sourcing agents / trading companies:</b> useful for mapping an industrial district; the risks are markup and an obscured factory. Best used once the part family is defined, with factory identity, capability evidence, and a path to direct dual sourcing.'])}
  <h2>Qualification method</h2><p>Desk scores only produce a short list. Each candidate then moves through seven gates, tracked on the <a href="#/worksheet">Worksheet</a>:</p>
  <ol><li><b>Drawing fit</b>: capability vs drawings, alloys, pressure class, annual volumes</li><li><b>Certificates</b>: pull and verify ISO / IATF / AS9100</li><li><b>Customs history</b>: ImportYeti / Panjiva shipment records cross-checked against the supplier\'s claimed US customers and export history (not yet done). The same data can also be used earlier, to find and screen candidates; see <a href="#/sources">Sources</a>.</li><li><b>First article</b>: sample parts; critical dimensions and material certs before a production PO</li><li><b>Plant / audit</b>: visit or third-party audit: process control, capacity, hidden subcontracting</li><li><b>Commercial</b>: MOQ, tooling ownership, lead time under load, payment terms, dual-source plan</li><li><b>Pilot to volume</b>: pilot lot, then PPAP or equivalent, then volume, with an exit if quality or lead time slips</li></ol>
  <h2>Questions for discussion</h2>
  ${li(['Which category (hydraulics, forgings/castings, machining) is the biggest drag today on quality, lead time, or cost?','Which part numbers, volumes, and alloy grades should drive the next pass?','Are there factories already trusted or ruled out, so the list does not duplicate them?'])}
  <h2>Limitations and next checks</h2>
  ${li(['All scores are preliminary desk judgments; certifications and customs history are unverified for all 34 suppliers.','No supplier was contacted and no quote requested.','Customs records (ImportYeti, Panjiva) and trade-show exhibitor lists (TIMTOS, KOTRA, PTC ASIA, EMO) have not been checked. Customs data can widen the candidate list and give an early read on US export experience, then support validation; it cannot by itself qualify a supplier for quality, drawing fit, or MOQ. See <a href="#/sources">Sources</a>.','Vietnam and Thailand are not yet covered; Taiwan and Korea are thin.','HYTORC part lists, volumes and alloy grades are not in the model; scores should change once those are known.'])}
  </div>`;
}


// --- weights: always total 100; locked stay fixed (same rebalance as canvas) ---
function rebalance(w,lk,i,v){ // pure: returns new weights summing to 100; locked fixed
  w=w.slice(); v=Number(v); if(!Number.isFinite(v))return w;
  const lockedSum=w.reduce((a,x,j)=>a+(lk[j]&&j!==i?x:0),0);
  const free=w.map((_,j)=>j).filter(j=>j!==i&&!lk[j]);
  if(lk[i]||!free.length)return w; // nothing can absorb the change
  v=Math.max(0,Math.min(Math.round(v),100-lockedSum));
  const rem=100-lockedSum-v, cur=free.reduce((a,j)=>a+w[j],0);
  free.forEach(j=>w[j]=cur>0?w[j]*rem/cur:rem/free.length);
  w[i]=v; free.forEach(j=>w[j]=Math.round(w[j]));
  let diff=100-w.reduce((a,b)=>a+b,0);
  while(diff){const j=diff>0?free.reduce((b,j)=>w[j]>w[b]?j:b,free[0]):free.filter(j=>w[j]>0).reduce((b,j)=>w[j]>w[b]?j:b);const d=diff>0?diff:Math.max(diff,-w[j]);w[j]+=d;diff-=d;}
  return w;
}
const setLocks=(lk,v)=>lk.map(()=>!!v); // lock state only; never touches weights
const validW=(w,lk)=>Array.isArray(w)&&w.length===7&&w.every(x=>Number.isInteger(x)&&x>=0&&x<=100)&&w.reduce((a,b)=>a+b,0)===100&&Array.isArray(lk)&&lk.length===7;
function setW(i,v){S.w=rebalance(S.w,S.lk,i,v);savePrefs();}
let pt; function savePrefs(){clearTimeout(pt);pt=setTimeout(()=>sb.from('fs_weight_prefs').upsert({user_email:S.user,weights:S.w,locked:S.lk,updated_at:new Date().toISOString()}).then(()=>{}),800);}
const score=r=>KEYS.reduce((a,k,i)=>a+(r[k]||0)*S.w[i],0)/100;

function scorecard(){
  const cats=[...new Set(S.rows.map(r=>r.category))].sort(), regs=[...new Set(S.rows.map(r=>r.region))].sort();
  app.innerHTML=`<h1>Supplier scorecard</h1><p class="sub">${S.rows.length} screened candidates · preliminary 1–5 desk scores from public information (Nov 2, 2026), not audits or quotes · <a href="#/study">method</a></p>
  ${altCards()}
  <div class="card" style="margin-bottom:14px"><h2>Weights</h2><div class="weights" id="wts"></div>
  <div class="wtot"><span id="tot"></span> &nbsp; <button class="btn sec" id="rst">Return to defaults</button></div>
  <div class="wlocks"><span class="muted">Locks:</span> <button type="button" class="btn sec sm" id="lkall">Select all</button> <button type="button" class="btn sec sm" id="lknone">Unselect all</button> <span class="muted" style="font-size:12px">These buttons only check or uncheck the Lock boxes. Weights stay as they are and still total 100%.</span></div></div>
  <div class="filters"><select id="fc"><option value="">All categories</option>${cats.map(c=>`<option>${esc(c)}</option>`).join('')}</select>
  <select id="fr"><option value="">All regions</option>${regs.map(c=>`<option>${esc(c)}</option>`).join('')}</select>
  <label>Min score <input id="fm" type="number" step="0.1" min="0" max="5" style="width:70px"></label>
  <select id="fs"><option value="score">Sort: score</option><option value="name">Sort: name</option><option value="country">Sort: country</option><option value="cost">Sort: cost</option></select></div>
  <div class="card wrap tblwrap"><table class="tbl" id="tb"></table></div><div id="det"></div>`;
  $('#fc').value=S.f.cat;$('#fr').value=S.f.reg;$('#fm').value=S.f.min||'';$('#fs').value=S.f.sort;
  [['#fc','cat'],['#fr','reg'],['#fs','sort']].forEach(([s,k])=>$(s).onchange=e=>{S.f[k]=e.target.value;table();});
  $('#fm').oninput=e=>{S.f.min=+e.target.value||0;table();};
  $('#rst').onclick=()=>{S.w=DEF.slice();S.lk=Array(7).fill(false);savePrefs();weights();table();};
  const setAllLocks=v=>{S.lk=setLocks(S.lk,v);savePrefs();weights();};$('#lkall').onclick=()=>setAllLocks(true);$('#lknone').onclick=()=>setAllLocks(false);
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
  $('#tb').innerHTML=`<thead><tr><th>#</th><th>Supplier</th><th>Cat</th><th>Country</th><th>Makes</th>${['Cap','Cert','Scale','US','Cost','Lead','Geo'].map(h=>`<th>${h}</th>`).join('')}<th>Score</th><th>US presence</th><th>Certs</th><th>Source</th></tr></thead><tbody>`+
  rows.map((r,n)=>`<tr class="r" data-id="${esc(r.id)}"><td>${n+1}</td><td><b>${esc(r.name)}</b></td><td>${esc(r.category)}</td><td>${esc(r.country)}</td><td>${esc(r.what_they_make)}</td>${KEYS.map(k=>`<td>${r[k]??''}</td>`).join('')}<td class="sc">${r._s.toFixed(2)}</td><td>${esc(r.us_presence)}</td><td>${esc(r.certs_note)}</td><td class="u">${safeUrl(r.url)?`<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.url.replace(/^https?:\/\//,''))}</a>`:''}</td></tr>`).join('')+'</tbody>';
  document.querySelectorAll('tr.r').forEach(tr=>tr.onclick=e=>{if(e.target.tagName==='A'){log('source_click',tr.dataset.id,{url:e.target.href});return;}detail(tr.dataset.id);});
}
function detail(id){const r=S.rows.find(x=>x.id===id);if(!r)return;log('supplier_open',id,{name:r.name});
  $('#det').innerHTML=`<div class="card detail"><button class="btn sec" style="float:right" id="dx">×</button><h2>${esc(r.name)}</h2>
  <p class="muted">${esc(r.category)} · ${esc(r.country)} (${esc(r.region)})</p><p>${esc(r.what_they_make)}</p><p><b>US:</b> ${esc(r.us_presence)}</p><p><b>Certs:</b> ${esc(r.certs_note)}</p>
  <p>${KEYS.map((k,i)=>`${LBL[i]}: <b>${r[k]??'–'}</b>`).join(' · ')}</p><p>Weighted score: <b>${score(r).toFixed(2)}</b></p>
  ${safeUrl(r.url)?`<p><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.url)}</a></p>`:''}<a class="btn" href="#/worksheet?s=${encodeURIComponent(id)}">Open worksheet</a></div>`;
  $('#dx').onclick=()=>$('#det').innerHTML='';}

let WS={sel:null,forms:{},loadedAt:{},dirty:false,hasDetails:null};
function wsSetDirty(v){WS.dirty=v;S.wsDirty=v;const d=$('#wsdirty');if(d){d.textContent=v?'Unsaved changes':'';d.className=v?'dirty':'';}}
function fieldHtml(gid,f,val,disabled){const id=`f_${gid}_${f.k}`,dis=disabled?'disabled':'';
  let ctl;
  if(f.t==='sel')ctl=`<select id="${id}" class="fld" data-gid="${gid}" data-k="${f.k}" ${dis}>${f.o.map(o=>`<option ${o===val?'selected':''}>${esc(o)}</option>`).join('')}</select>`;
  else if(f.t==='area'||f.t==='urls')ctl=`<textarea id="${id}" class="fld" rows="3" data-gid="${gid}" data-k="${f.k}" ${dis} ${f.max?`maxlength="${f.max}"`:''}>${esc(f.t==='urls'?(val||[]).join('\n'):val)}</textarea>`;
  else ctl=`<input id="${id}" class="fld" type="${f.t==='date'?'date':'text'}" data-gid="${gid}" data-k="${f.k}" value="${esc(val)}" ${f.max?`maxlength="${f.max}"`:''} ${f.ph?`placeholder="${esc(f.ph)}"`:''} ${dis}>`;
  const wide=f.t==='area'||f.t==='urls'||f.k==='next'||f.k==='tests';
  return `<div class="wf${wide?' wide':''}"><label for="${id}">${esc(f.l)}</label>${ctl}${f.t==='urls'&&val&&val.length?`<div class="urls">${val.map(u=>`<a href="${esc(u)}" target="_blank" rel="noopener">${esc(u)}</a>`).join('')}</div>`:''}</div>`;}
function stamp(f){return f.updated_at?`Last saved by ${esc(f.updated_by||'unknown')} · ${esc(new Date(f.updated_at).toLocaleString())}`:'Not saved yet';}
function summaryHtml(){const r=FSW.readiness(WS.forms),c=r.counts;
  return `<h2>Readiness summary</h2><p class="muted" style="margin-top:-6px">Summarizes what has been entered. It is not a qualification decision, and no gate passes automatically.</p>
  <div class="rsum"><div><b>${c.Passed}</b> of 7 passed</div><div><b>${c['In progress']}</b> in progress</div><div><b>${c['Not started']}</b> not started</div><div><b>${c.Failed}</b> failed</div><div><b>${c['N/A']}</b> marked N/A</div></div>
  <ul class="rlist"><li>Order-size fit (Commercial): <b>${esc(r.orderSize)}</b>${r.orderSize==='Unknown'?' (to confirm with the supplier; not assumed from company size)':''}</li>
  <li>MOQ per SKU: ${r.moqEntered?'entered':'<b>not yet entered</b>'}</li>
  <li>Open gates: ${r.gaps.length?esc(r.gaps.join(', ')):'none'}</li>${r.na?'<li>N/A gates should carry a reason in notes.</li>':''}
  <li>Current recommendation: <b>${esc(r.decision)}</b></li></ul>`;}
function readForm(){document.querySelectorAll('#wsform [data-gid][data-k]').forEach(el=>{const gid=el.dataset.gid,f=WS.forms[gid];
  if(el.dataset.k==='_status')f.status=el.value;else if(el.dataset.k==='_evidence')f.evidence=el.value;
  else{const def=FSW.fieldsOf(gid==='decision'?FSW.DECISION:FSW.GATES.find(g=>g.id===gid)).find(x=>x.k===el.dataset.k);f.details[el.dataset.k]=def.t==='urls'?FSW.cleanUrls(el.value):el.value;}});}
async function worksheet(){
  const q=new URLSearchParams(location.hash.split('?')[1]||''); let sel=q.get('s'); if(!S.rows.some(r=>r.id===sel))sel=(S.rows[0]||{}).id;
  if(!sel){app.innerHTML='<div class="card"><p class="muted">No suppliers loaded yet.</p></div>';return;}
  const sup=S.rows.find(r=>r.id===sel);
  const opts=S.rows.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(r=>`<option value="${esc(r.id)}" ${r.id===sel?'selected':''}>${esc(r.name)} (${esc(r.category)})</option>`).join('');
  app.innerHTML=`<h1>Supplier Qualification Worksheet</h1><p class="sub">Seven gates from short list to volume, per supplier. This is a shared worksheet: everyone with access sees and can edit the same records, and each gate shows who saved it last.</p>
  <div class="card wstop"><label for="sup" class="fl">Supplier</label><select id="sup" class="fld" style="max-width:420px">${opts}</select>
  <p class="muted" style="font-size:12px">${esc(sup.category)} · ${esc(sup.country)} · desk scores are preliminary. New fields start as Unknown or blank; nothing is pre-filled from public data.</p></div>
  <div id="wsbanner"></div><div class="card" id="wssum" style="margin:14px 0"></div><div id="wsform"><p class="muted">Loading…</p></div>
  <div class="wsbar"><button class="btn" id="sv">Save worksheet</button> <span id="wsdirty"></span> <span class="muted" id="st" role="status"></span></div>`;
  WS={sel,forms:{},loadedAt:{},dirty:false,hasDetails:null}; S.wsDirty=false;
  $('#sup').onchange=e=>{if(WS.dirty&&!confirm('You have unsaved changes for this supplier. Discard them and switch?')){e.target.value=sel;return;}wsSetDirty(false);location.hash='#/worksheet?s='+encodeURIComponent(e.target.value);};
  let res=await sb.from('fs_worksheet').select('supplier_id,gate_id,status,evidence,updated_by,updated_at,details').eq('supplier_id',sel);
  if(res.error&&FSW.missingDetailsColumn(res.error)){WS.hasDetails=false;res=await sb.from('fs_worksheet').select('supplier_id,gate_id,status,evidence,updated_by,updated_at').eq('supplier_id',sel);}
  else WS.hasDetails=!res.error;
  if(res.error){$('#wsform').innerHTML=`<div class="card"><p class="muted">Could not load the worksheet: ${esc(res.error.message)}</p></div>`;$('#sv').disabled=true;return;}
  const m={};(res.data||[]).forEach(x=>m[x.gate_id]=x);
  FSW.GATES.concat([FSW.DECISION]).forEach(g=>{WS.forms[g.id]=FSW.deserialize(g.id,m[g.id]);WS.loadedAt[g.id]=(m[g.id]||{}).updated_at||null;});
  const off=!WS.hasDetails;
  if(off)$('#wsbanner').innerHTML=`<div class="callout warn">Expanded fields are read-only until the database update <code>migration_fs_v1_4_worksheet_details.sql</code> is run. Gate status and notes still save normally.</div>`;
  $('#wsform').innerHTML=FSW.GATES.map(g=>{const f=WS.forms[g.id];return `<details class="card gatecard" ${f.status!=='Not started'||!FSW.isBlank(g,f.details)?'open':''}><summary><span class="gn">${g.n}</span> <b>${esc(g.l)}</b> <span class="gs s-${esc(f.status.replace(/\W/g,''))}">${esc(f.status)}</span><span class="muted gst" data-gid="${g.id}">${stamp(f)}</span></summary>
    <p class="muted hint">${esc(g.hint)}</p>
    <div class="wgrid"><div class="wf"><label for="st_${g.id}">Gate status (required checkpoint)</label><select id="st_${g.id}" class="fld" data-gid="${g.id}" data-k="_status">${FSW.STATUSES.map(s=>`<option ${s===f.status?'selected':''}>${s}</option>`).join('')}</select></div>
    ${g.f.map(x=>fieldHtml(g.id,x,f.details[x.k],off)).join('')}</div>
    <h4>Follow-up</h4><div class="wgrid">${FSW.COMMON.map(x=>fieldHtml(g.id,x,f.details[x.k],off)).join('')}
    <div class="wf wide"><label for="ev_${g.id}">Notes / evidence summary</label><textarea id="ev_${g.id}" class="fld" rows="2" maxlength="4000" data-gid="${g.id}" data-k="_evidence">${esc(f.evidence)}</textarea></div></div></details>`;}).join('')+
   `<div class="card gatecard"><h2>Open risks and recommendation</h2><div class="wgrid">${FSW.DECISION.f.map(x=>fieldHtml('decision',x,WS.forms.decision.details[x.k],off)).join('')}</div><p class="muted gst" data-gid="decision">${stamp(WS.forms.decision)}</p></div>`;
  $('#wssum').innerHTML=summaryHtml();
  $('#wsform').addEventListener('input',()=>{wsSetDirty(true);readForm();$('#wssum').innerHTML=summaryHtml();$('#st').textContent='';});
  $('#wsform').addEventListener('change',()=>{wsSetDirty(true);readForm();$('#wssum').innerHTML=summaryHtml();});
  log('worksheet_open',sel);
  $('#sv').onclick=async()=>{readForm();$('#sv').disabled=true;$('#st').textContent='Saving…';
    try{
      const cur=await sb.from('fs_worksheet').select('gate_id,updated_by,updated_at').eq('supplier_id',sel);
      if(cur.error)throw cur.error;
      const changed=(cur.data||[]).filter(x=>x.updated_at!==WS.loadedAt[x.gate_id]&&x.updated_by!==S.user);
      if(changed.length&&!confirm(`Someone else saved this supplier's worksheet after you opened it (${[...new Set(changed.map(x=>x.updated_by))].join(', ')}). Save anyway and overwrite their changes?`)){$('#st').textContent='Not saved. Reload the page to see the latest version.';$('#sv').disabled=false;return;}
      const now=new Date().toISOString();
      const ids=FSW.GATES.map(g=>g.id).concat(WS.hasDetails?['decision']:[]);
      let rows=ids.map(id=>FSW.serialize(id,Object.assign({supplier_id:sel},WS.forms[id]),S.user,now));
      if(!WS.hasDetails)rows=rows.map(FSW.legacyRow);
      const {error}=await sb.from('fs_worksheet').upsert(rows);
      if(error)throw error;
      ids.forEach(id=>{WS.loadedAt[id]=now;WS.forms[id].updated_at=now;WS.forms[id].updated_by=S.user;});
      wsSetDirty(false);
      $('#st').textContent=(WS.hasDetails?'Saved all gates':'Saved gate status and notes only (expanded fields await the database update)')+' · '+new Date().toLocaleTimeString();
      document.querySelectorAll('.gst[data-gid]').forEach(el=>{el.textContent=stamp(WS.forms[el.dataset.gid]).replace(/&amp;/g,'&');});log('worksheet_save',sel,{expanded:!!WS.hasDetails});
    }catch(e){$('#st').textContent='Not saved: '+(e.message||e);}
    $('#sv').disabled=false;};
}

if(C.GA4_MEASUREMENT_ID){const s=document.createElement('script');s.async=1;s.src='https://www.googletagmanager.com/gtag/js?id='+C.GA4_MEASUREMENT_ID;document.head.appendChild(s);window.dataLayer=window.dataLayer||[];window.gtag=function(){dataLayer.push(arguments)};gtag('js',new Date());gtag('config',C.GA4_MEASUREMENT_ID);}
sb.auth.onAuthStateChange(ev=>{if(ev==='SIGNED_OUT')S.user=null; if(ev==='PASSWORD_RECOVERY')pwSetup=true;});
boot();
})();

