(function(){
const C=window.FS_CONFIG;
// Password setup: admin-generated recovery links use the implicit flow (tokens in URL hash). Read flags BEFORE the client consumes them; never log tokens.
function authUrlState(hash,search){const h=new URLSearchParams((hash||'').replace(/^#/,'')), q=new URLSearchParams(search||'');
  return {recovery:h.get('type')==='recovery'||q.has('setup'), error:h.get('error_description')||q.get('error_description')||'', hasTokens:h.has('access_token')||h.has('refresh_token')||q.has('code')};}
const AUTH0=authUrlState(location.hash,location.search);
const sb=supabase.createClient(C.SUPABASE_URL,C.SUPABASE_PUBLISHABLE_KEY,{auth:{flowType:'implicit',detectSessionInUrl:true,persistSession:true}});
const cleanUrl=()=>history.replaceState(null,'',location.pathname+(location.hash||'').split('?')[0].replace(/^#access_token.*$/,'').replace(/^#error.*$/,''));
const $=s=>document.querySelector(s), app=$('#app'); if($('#ver')) $('#ver').textContent=C.VERSION;
const allowed=C.ALLOWED_EMAILS.filter(Boolean).map(e=>e.toLowerCase());
const KEYS=['cap','cert','scale','usexp','cost','lead','geo'], LBL=['Capability','Certs','Scale','US footprint','Cost','Lead time','Geo risk'];
const DEF=[25,15,10,10,20,10,10];
const LOCAL_W='fs_local_weights_v1';
let S={user:null,rows:[],w:[29,19,13,13,0,13,13],lk:[false,false,false,false,true,false,false],f:{cat:'',reg:'',min:0,sort:'score',dsort:{key:'name',dir:'asc'}},t0:Date.now(),open:null,banner:'',logging:false,ping:null};
const safeUrl=u=>/^https?:\/\//i.test(u||'')?u:'';
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function log(type,sid,detail){ if(!S.user)return; sb.from('fs_events').insert({user_email:S.user,event_type:type,supplier_id:sid||null,detail:detail||{}}).then(()=>{}); }
function secs(){return Math.round((Date.now()-S.t0)/1000);}
function syncTopbar(){const el=document.querySelector('.top'); if(el&&el.offsetHeight) document.documentElement.style.setProperty('--topbar', el.offsetHeight+'px');}
function paintChrome(){
  $('#ver').textContent=C.VERSION;
  const nav=$('#nav'); if(nav) nav.style.display='';
  const n=$('#notice'); if(n) n.textContent='';
  syncTopbar();
}
function bannerHtml(){return S.banner?`<div class="callout warn" role="status">${esc(S.banner)}</div>`:'';}
function loadLocalW(){
  let raw=null; try{raw=JSON.parse(localStorage.getItem(LOCAL_W)||'null');}catch(e){raw=null;}
  const m=migrateWeights(raw&&raw.w, raw&&raw.lk);
  S.w=m.w; S.lk=m.lk;
}
function startSessionLog(){
  if(S.logging||!S.user) return;
  S.logging=true; S.t0=Date.now();
  log('session_start',null,{ua:navigator.userAgent});
  S.ping=setInterval(()=>{if(S.user)log('session_ping',null,{seconds:secs(),kind:'heartbeat'});},60000);
}
function stopSessionLog(){if(S.ping){clearInterval(S.ping); S.ping=null;} S.logging=false;}

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
function signInView(msg, lead){
  if($('#nav')) $('#nav').style.display='';
  app.innerHTML=`<div class="card login"><h1>Sign in</h1>
  <p class="sub">Sign in to save shared worksheet notes and progress to the project database, and to save your scorecard weights to your account. Weights changed while signed out stay in this browser only.</p>
  ${lead?`<div class="callout">${esc(lead)}</div>`:''}
  <p class="muted" style="font-size:12px">After you sign in, this portal records session time, supplier rows opened, source links clicked, and worksheet saves, linked to your email. The portal owner (Philos Kim) can review that signed-in activity. Browsing while signed out is not tied to an account and is not written to the shared database.</p>
  ${bannerHtml()}
  <label class="fl" for="em">Email</label><input id="em" type="email" placeholder="Email" autocomplete="username">${pwField('pw','Password','current-password','Password')}
  <button class="btn" id="go">Sign in</button><p class="muted" id="msg" role="status">${esc(msg||'')}</p></div>`; wirePwToggles();
  $('#go').onclick=async()=>{const email=$('#em').value.trim().toLowerCase();
    if(!allowed.includes(email)){$('#msg').textContent='This account is not an editor.';return;}
    $('#go').disabled=true;
    const {error}=await sb.auth.signInWithPassword({email,password:$('#pw').value});
    if(error){$('#go').disabled=false;$('#msg').textContent=error.message;return;}
    $('#pw').value=''; pwSetup=false; boot();};
  $('#pw').onkeydown=e=>{if(e.key==='Enter')$('#go').click();};
}
let pwSetup=AUTH0.recovery;
function applyCatalog(){
  const cat=window.FS_CATALOG;
  if(!cat||!Array.isArray(cat.suppliers)||!cat.suppliers.length) return false;
  S.rows=cat.suppliers.slice();
  S.recheck=cat.recheck||{results:{}};
  const asof=$('#asof');
  if(asof) asof.textContent='Desk research dated '+cat.original_as_of+', '+cat.china_as_of+', and '+(cat.discovery_as_of||'2026-11-07');
  S.discovery=Array.isArray(cat.discovery)?cat.discovery:[];
  return true;
}
async function boot(){
  if(!applyCatalog()){app.innerHTML='<div class="card"><h2>Research snapshot missing</h2><p class="muted">catalog.js did not load. The public pages do not read supplier rows from the database.</p></div>';return;}
  const fresh=weightsForSaved(null); S.w=fresh.w; S.lk=fresh.lk;
  const authEntry=AUTH0.hasTokens||AUTH0.error||AUTH0.recovery;
  if(!authEntry){S.user=null; stopSessionLog(); loadLocalW(); paintChrome(); route(); return;}
  const {data:{session}}=await sb.auth.getSession();
  if(AUTH0.hasTokens||AUTH0.error||AUTH0.recovery){cleanUrl(); AUTH0.hasTokens=false;}
  if(AUTH0.error){S.banner='Link problem: '+AUTH0.error+'. Ask the owner for a new setup link.'; AUTH0.error=''; pwSetup=false;}
  let sessionUser=null;
  if(session){
    const em=(session.user.email||'').toLowerCase();
    if(!allowed.includes(em)){await sb.auth.signOut(); S.banner=(S.banner?S.banner+' ':'')+'That account is not authorized to edit. The research pages stay available.';}
    else sessionUser=em;
  }
  if(sessionUser&&pwSetup) return setPasswordView(sessionUser);
  pwSetup=false;
  if(sessionUser){
    S.user=sessionUser;
    const p=await sb.from('fs_weight_prefs').select('*').eq('user_email',sessionUser).maybeSingle();
    const m=weightsForSaved(p&&p.data); S.w=m.w; S.lk=m.lk;
    startSessionLog();
  }else{
    S.user=null; stopSessionLog(); loadLocalW();
  }
  paintChrome();
  route();
}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')log('session_ping',null,{seconds:secs(),kind:'hidden'});});
window.addEventListener('beforeunload',()=>log('session_ping',null,{seconds:secs(),kind:'unload'}));
window.addEventListener('resize',syncTopbar);
const logoutBtn=$('#logout'); if(logoutBtn) logoutBtn.onclick=async e=>{e.preventDefault();
  if(S.wsDirty&&!confirm('You have unsaved worksheet changes. Sign out without saving?'))return;
  log('session_end',null,{seconds:secs()});
  await sb.auth.signOut();
  S.user=null; S.wsDirty=false; stopSessionLog(); loadLocalW(); paintChrome();
  if(location.hash.startsWith('#/worksheet')||location.hash.startsWith('#/signin')) history.replaceState(null,'',location.pathname+'#/');
  lastHash=location.hash; route();};
let lastHash=location.hash;
window.addEventListener('hashchange',()=>{if(S.wsDirty&&!confirm('You have unsaved worksheet changes. Leave without saving?')){history.replaceState(null,'',lastHash||'#/worksheet');return;} S.wsDirty=false; lastHash=location.hash; route();});
window.addEventListener('beforeunload',e=>{if(S.wsDirty){e.preventDefault();e.returnValue='';}});
function route(){const h=location.hash, v=h.startsWith('#/sensitivity')?'sens':h.startsWith('#/quotes')?'q':h.startsWith('#/worksheet')?'ws':h.startsWith('#/sources')?'src':h.startsWith('#/study')?'study':'score';
  if(v!=='score') closePop();
  document.querySelectorAll('nav a[data-v]').forEach(a=>a.classList.toggle('on',a.dataset.v===v));
  if(v==='sens') return sensitivity();
  if(v==='q') return quotes();
  if(v==='ws') return worksheet();
  if(v==='src') return sources();
  if(v==='study') return study();
  scorecard();
}
const ALTS=[
 {fam:'Hydraulics (pumps, power packs, valves)',lead:'HAWE Hydraulik (Germany)',leadWhy:'Public catalog shows compact high-pressure pumps and power packs up to 700 bar, the closest catalog fit to bolting-tool pumps in this set. US entity: HAWE North America. Huade and Taifeng are on the watchlist because a ~700 bar line was not confirmed.',
  alt:'Yuken Kogyo or Kawasaki Precision Machinery (Japan)',altWhy:'Established pump and valve makers outside China with US offices (Yuken America, KPM USA). Considered for geographic spread, not because their parts are known to match HAWE units.',
  note:'Bosch Rexroth scores highest overall but is broader than this need. Jiangsu Hengli, in China, is scored in the same hydraulics set. Tariff exposure is an assumption to check, not a measured cost.'},
 {fam:'Forgings / castings',lead:'Bharat Forge (India)',leadWhy:'Large closed-die forging and machining group with a US sales arm (Bharat Forge America). Included for volume forgings. A country or a sales office does not show that price, lead time, or part fit will be better than another region.',
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
  ['Known US subsidiaries / sales offices','Used as the US footprint score: a named US office or a claimed US presence on a public page.','A US office is not verified shipment history. It does not show customs volume, which parts ship, or to whom.']],
 planned:[
  ['ImportYeti','https://www.importyeti.com/','US customs bill-of-lading records, useful at three stages. <b>Discovery:</b> search by product description or by the suppliers of similar US buyers to find candidates not on this list. <b>Screening:</b> shipment patterns (frequency, volume, recency) and US customers as an early read on real US export experience. <b>Validation:</b> cross-check a supplier\'s claimed US customers and export history.','Records can be incomplete, delayed, or filed under a parent company, trading company, or forwarder. Shipment data does not prove quality, drawing fit, capacity, MOQ, or pricing.'],
  ['Panjiva (S&P Global)','https://panjiva.com/','Same discovery, screening and validation uses with broader coverage and filters (subscription service).','Paid; same limitations as above.'],
  ['TIMTOS exhibitor list (Taiwan machine tools)','https://www.timtos.com.tw/en/exhibitor/company-name-data/index.html','Taiwan machining and component makers to deepen the thin Taiwan list.','Exhibiting is not an audit of capability or quality.'],
  ['KOTRA / buyKOREA (Korea)','https://buykorea.org/','Korean manufacturers by category to deepen the thin Korea list. KOTRA main site: kotra.or.kr.','Directory listing is self-reported, not verified capability.'],
  ['PTC ASIA (Shanghai, power transmission & hydraulics)','https://www.ptc-asia.com/index-en.html','Hydraulics and transmission exhibitors in China and Asia.','Exhibitor list not yet located on the site; same directory caveat.'],
  ['EMO Hannover (metalworking)','https://emo-hannover.de/en/','European and global machining and machine-tool exhibitors.','Same directory caveat.']]};
function evidenceHtml(r){return (r.evidence||[]).map(e=>safeUrl(e[0])?`<div class="evitem"><a href="${esc(e[0])}" target="_blank" rel="noopener">${esc(e[0])}</a><div>${esc(e[1])}</div><div class="muted">${esc(e[2])}</div></div>`:'').join('');}
function sources(){
  const rc=S.recheck||{results:{}}; log('sources_open');
  const cat=window.FS_CATALOG||{};
  app.innerHTML=`<h1>Sources</h1><p class="sub">Research channels for this short list, and what each link does and does not prove. Source dates are Nov 2, 2026, Nov 6, 2026, and Nov 7, 2026. See <a href="#/study">Study</a> for the method.</p>
  ${bannerHtml()}
  <div class="card" style="margin-bottom:14px"><h2>Channels used in the desk research</h2>
  <table class="tbl"><thead><tr><th>Channel</th><th>How it was used</th><th>Limitation</th></tr></thead><tbody>
  ${CHANNELS.used.map(c=>`<tr><td><b>${esc(c[0])}</b></td><td>${esc(c[1])}</td><td>${esc(c[2])}</td></tr>`).join('')}</tbody></table>
  <p class="muted" style="font-size:12px">No supplier was contacted, no quote requested, and no certificate pulled. The reference that first surfaced each supplier was not recorded. Cost is unknown and is not a score. Lead time and geography are indicative assumptions, not quotes or measured results.</p></div>
  <div class="card" style="margin-bottom:14px"><h2>Planned research channels (not yet checked)</h2>
  <p class="muted" style="margin-top:-6px">These are the next checks, not sources already used for the scores. None of these has been searched as a full pass. On Nov 7, 2026 the visible names on ImportYeti’s public HYTORC page were reviewed (CBP sea data synced 2026-11-04). That page lists only some top sea-freight names. Forwarder-masked, air, and other-name shipments are not covered. Links are the public service or event sites, opened Nov 6, 2026.</p>
  <table class="tbl"><thead><tr><th>Channel</th><th>What would be checked</th><th>Limitation</th></tr></thead><tbody>
  ${CHANNELS.planned.map(c=>`<tr><td><b>${esc(c[0])}</b><br><a href="${esc(c[1])}" target="_blank" rel="noopener">${esc(c[1])}</a></td><td>${c[2]}</td><td>${esc(c[3])}</td></tr>`).join('')}</tbody></table></div>
  <div class="card tblwrap"><h2>Per-supplier sources</h2><table class="tbl"><thead><tr><th>Supplier</th><th>Source date</th><th>Found via</th><th>Company URL</th><th>URL check</th><th>Homepage check (${esc(rc.checked||'—')})</th><th>What the URL supports</th></tr></thead><tbody>
  ${S.rows.slice().sort((a,b)=>a.id.localeCompare(b.id,undefined,{numeric:true})).map(r=>{const x=rc.results[r.url]||''; const china=r.pass==='2026-11-06';
    const check=r.url_check===200?(china?'Opened Nov 6, 2026 (HTTP 200)':'Site responded'):(r.url_check==null?'not recorded':esc(r.url_check));
    return `<tr><td><b>${esc(r.name)}</b><br><span class="muted">${esc(r.id)}</span></td><td>${esc(r.pass||'')}</td>
  <td>${china?evidenceHtml(r)+'<p class="muted">Sources dated Nov 6, 2026.</p>':'Known industry name and company website. The reference that first surfaced this supplier was not recorded. Source date Nov 2, 2026.'}</td>
  <td class="u">${safeUrl(r.url)?`<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.url)}</a>`:'—'}</td>
  <td>${check}</td><td>${china?'Opened on Nov 6, 2026, outside the Nov 2 homepage check.':esc(x?(x.split(' ')[0]==='200'?'Site responded':'Did not return a normal page response'):'not checked')}</td>
  <td>${china?'Pages opened on Nov 6, 2026 support the product family and the claims in the evidence column. They do not prove price, MOQ, volume willingness, customs shipments, or a current certificate.':'Company exists; product family. Homepage only. Not a product, certificate, or customs record.'}</td></tr>`;}).join('')}</tbody></table>
  <p class="muted" style="font-size:12px">The homepage check shows whether Nov 2 source sites still responded. It is not a qualification. Sources dated Nov 6, 2026 and Nov 7, 2026 were opened on those dates. Each supplier keeps its own source date.</p></div>
  <div class="card"><h2>Nov 7, 2026 leads, not scored</h2><p class="muted">These six names are in the same candidate list and are not ranked. Claims below are what the pages said. They were not verified, and no 1–5 score was assigned.</p>
  <table class="tbl"><thead><tr><th>Name</th><th>Source date</th><th>What the page supports</th><th>URL</th></tr></thead><tbody>
  ${(S.discovery||[]).map(r=>`<tr><td><b>${esc(r.name)}</b><br><span class="muted">${esc(r.id)} · not scored</span></td><td>${esc(r.pass||'')}</td><td>${evidenceHtml(r)||'—'}</td><td class="u">${safeUrl(r.url)?`<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.url)}</a>`:'—'}</td></tr>`).join('')}
  </tbody></table></div>
  <div class="card watchcard"><h2>Watchlist sources, not scored</h2>
  ${(cat.watchlist||[]).map(w=>`<article class="watchitem"><h3>${esc(w.name)} <span class="tag alt2">${esc(w.id)}</span></h3><p>${esc(w.why)}</p><p class="muted">${esc(w.checked)}</p>${safeUrl(w.url)?`<p class="u"><a href="${esc(w.url)}" target="_blank" rel="noopener">${esc(w.url)}</a></p>`:''}</article>`).join('')}
  </div>`;
}
const RUBRIC=[ ['Capability','29%','Clear public fit to the part family (e.g. HAWE compact ~700 bar packs)','Makes related products; fit to HYTORC geometry unproven from the site','Wrong category or no public evidence of the process'],
 ['Certs','19%','ISO / IATF / AS9100 named on site for the relevant scope (still unverified)','Quality system mentioned without a named standard','Nothing found'],
 ['Scale','13%','Multi-plant / global footprint visible','Single solid plant or mid-size group','Small or unclear capacity'],
 ['US footprint','13%','Named US subsidiary or sales office on a public page','US presence claimed without a clear office','No US footprint found'],
 ['Cost','Excluded','Not scored.','Not scored.','Not scored.'],
 ['Lead time','13%','Shorter expected door-to-door','Typical ocean from Asia or Europe','Longer or congested lanes expected'],
 ['Geo risk','13%','Lower concentration / tariff / disruption risk','Moderate','Higher; single-country exposure']];
function study(){ log('study_open');
  const li=a=>`<ul>${a.map(x=>`<li>${x}</li>`).join('')}</ul>`;
  const ncat=(rows,c)=>rows.filter(r=>r.category===c).length;
  app.innerHTML=`<h1>HYTORC supplier sourcing study</h1><p class="sub">Prepared for Teddy Hume by Philos Kim. Desk research dated Nov 2, 2026, Nov 6, 2026, and Nov 7, 2026. Live controls are on <a href="#/">Scorecard</a>. The <a href="#/worksheet">worksheet</a> is a blank qualification template. Channels are on <a href="#/sources">Sources</a>.</p>
  ${bannerHtml()}
  <div class="card study">
  <div class="callout">${esc(window.FSN?FSN.COPY.intro:'')}</div>
  <h2>Purpose and scope</h2><p>A starting short list for a sourcing review: manufacturers with a public record in the part family, a scorecard that can be re-weighted, and a lead and an alternative in each family. Three families are usually spec-critical for hydraulic bolting tools: hydraulics (pumps, valves, power packs, hoses), forgings and castings, and precision machining. Sockets and fasteners were left out because they are more standardized. Landed cost is discussed below. It is not part of the weighted score.</p>
  <p>The scored list has ${S.rows.length} manufacturers (${ncat(S.rows,'Hydraulics')} hydraulics, ${ncat(S.rows,'Forgings/Castings')} forgings and castings, ${ncat(S.rows,'Precision machining')} precision machining) in China, Taiwan, Korea, Japan, India, and Europe (Germany, Austria, Italy, Poland, the Czech Republic, and Israel), plus ${(S.discovery||[]).length} names dated Nov 7, 2026 that are not scored. Scored names use the same criteria. The Nov 7 names are leads for follow-up, not a ranked result.</p>
  <p>This is not an exhaustive search, and it is not an evenly balanced survey of every producing country. It is a preliminary desk list of manufacturers already visible in these part families. Desk research is dated Nov 2, 2026, Nov 6, 2026, and Nov 7, 2026. Each name keeps its own source date on <a href="#/sources">Sources</a> and in its detail card.</p>
  <h2>How to read cost, lead time, and geography</h2>
  <p>Cost is unknown and is not part of the weighted score. No supplier purchase price was collected. Lead time and geography remain in the score only as assumptions: typical freight time and concentration in one country. They are not measured transit times. Capability is catalog fit, not proven quality. Drawing fit, verified quality, US shipment history, MOQ, and willingness to take HYTORC volumes are still open.</p>
  <p>A US office, a US manufacturing claim, or an export sentence is not verified US shipment history. A certificate named on a website, or a registrar row whose expiry was not checked, is not a verified certificate. Price, MOQ, and willingness to take HYTORC volumes were not found.</p>
  <p>Beijing Huade, Shandong Taifeng, and TZ Yuci are on the watchlist, not in the ranked list. A ~700 bar bolting-pump line was not confirmed for Huade or Taifeng, so they are not qualified bolting-pump matches. TZ Yuci's profile page was not opened.</p>
  <h2>How scores were set</h2><p>Six criteria are 1-5 desk judgments from public websites only: no quotes, plant visits, or certificate downloads. Cost is not one of them. Default weights total 100 (capability 29, certs 19, scale 13, US footprint 13, lead time 13, geography 13) and can be changed on the Scorecard. US footprint scores a named US office or a claimed US presence. It is not verified shipment history, and customs records were not used to set it. A certificate score of 5 means a named standard was found in the sources. It does not mean the certificate was verified. A capability score is catalog fit, not proven quality.</p>
  <div class="wrap"><table class="tbl"><thead><tr><th>Criterion</th><th>Default weight</th><th>5 (strong)</th><th>3 (mixed)</th><th>1 (weak)</th></tr></thead><tbody>${RUBRIC.map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
  <div class="callout" style="margin-top:10px"><b>Capability is catalog fit, not an audit.</b> It reflects product and process fit from public material, not plant quality. Certifications are expected from public text, not verified. Quality is established through the qualification steps below.</div>
  <h2>Score is not a cost</h2>
  <p>The weighted score is an ordinal screening rank. It orders candidates by how favorable they look on public evidence. A higher score is more favorable. The gaps between scores are not proportional and do not measure money. The score is not a landed cost and it contains no price. On the scorecard the same point is stated as: 1–5 screening scores: higher is more favorable; differences are not proportional.</p>
  <p>A landed cost is the seller’s price for one drawing and one quantity, plus freight, duty, and the other charges to the same ship-to. Those amounts are not in the score. A blank is missing, not zero. Nothing here is a quote.</p>
  <p>Break-even, without a worksheet: for the same item, the same quantity, and the same destination, a candidate’s price can be higher only by as much as its freight, duty, and other charges are lower. When those charges are unknown, there is no break-even and no landed-cost rank.</p>
  ${freightStudyHtml()}
  <h2>Proposed sourcing alternatives</h2><p>Summarized on the Scorecard. Lead and alternative candidates per part family are a starting point. They are not qualified and not interchangeable until drawings, specs and trials confirm fit.</p>
  <h2>Beyond factories: private label and agents</h2>
  ${li(['<b>Private label / white label:</b> buying a ready-made or lightly adapted product under the HYTORC name. Private label usually implies some exclusivity or customization; white label is a generic product many brands rebrand.','<b>Where it fits:</b> standard or near-standard items (hoses, fittings, some valves, C-parts, packaging) more than housings, reaction arms, or compact high-pressure pumps that must match tool geometry.','<b>Industrial distributors</b> with private-label programs can cover the standardized slice; they are a weaker fit for unique hydraulic power packs.','<b>Sourcing agents / trading companies:</b> useful for mapping an industrial district; the risks are markup and an obscured factory. Best used once the part family is defined, with factory identity, capability evidence, and a path to direct dual sourcing.'])}
  <h2>Qualification method</h2><p>Desk scores only produce a short list. Each candidate then moves through seven gates. The <a href="#/worksheet">worksheet</a> shows those fields as a blank template:</p>
  <ol><li><b>Drawing fit</b>: capability vs drawings, alloys, pressure class, annual volumes</li><li><b>Certificates</b>: pull and verify ISO / IATF / AS9100</li><li><b>Customs history</b>: ImportYeti / Panjiva shipment records cross-checked against the supplier\'s claimed US customers and export history (not yet done). The same data can also be used earlier, to find and screen candidates; see <a href="#/sources">Sources</a>.</li><li><b>First article</b>: sample parts; critical dimensions and material certs before a production PO</li><li><b>Plant / audit</b>: visit or third-party audit: process control, capacity, hidden subcontracting</li><li><b>Commercial</b>: MOQ, tooling ownership, lead time under load, payment terms, dual-source plan</li><li><b>Pilot to volume</b>: pilot lot, then PPAP or equivalent, then volume, with an exit if quality or lead time slips</li></ol>
  <h2>Questions for discussion</h2>
  ${li(['Which category (hydraulics, forgings/castings, machining) is the biggest drag today on quality, lead time, or cost?','Which part numbers, volumes, and alloy grades should drive the next pass?','Are there factories already trusted or ruled out, so the list does not duplicate them?'])}
  <h2>Limitations and next checks</h2>
  ${li(['All scores are preliminary desk judgments, not qualifications or quotes. Certifications and customs history are unverified. A named certificate, including a registrar row whose expiry was not checked, is not a verified certificate. A US office is not verified US shipment history.','No supplier was contacted and no quote requested. Price, MOQ, volume willingness, drawing fit, and verified quality are unknown across the list.','Cost is unknown and is not in the score. Lead time and geography are indicative assumptions, not quotations or measured outcomes. They do not establish that suppliers in one country are a better fit than suppliers in another.','On Nov 7, 2026 the visible names on ImportYeti’s public HYTORC page were reviewed. The page lists some sea-freight names only. Panjiva and the trade-show exhibitor lists (TIMTOS, KOTRA, PTC ASIA, EMO) have not been checked. Customs data can widen the candidate list and give an early read on US export experience, then support validation; it cannot by itself qualify a supplier for quality, drawing fit, or MOQ. See <a href="#/sources">Sources</a>.','The list is not an exhaustive world search. Vietnam and Thailand are not yet covered; Taiwan and Korea are thin. The Nov 7 names are not scored.','HYTORC part lists, volumes, and alloy grades are not in this review. Scores should be revisited once those are known.'])}
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
function setW(i,v){if(i===4)return; S.lk[4]=true; S.w[4]=0; S.w=rebalance(S.w,S.lk,i,v); S.w[4]=0; S.lk[4]=true; if(S.w.reduce((a,b)=>a+b,0)!==100){const m=migrateWeights(S.w,S.lk); S.w=m.w; S.lk=m.lk;} savePrefs();}
function fixSum(w,idxs){let diff=100-w.reduce((a,b)=>a+b,0),g=0; while(diff&&g<200){const pool=diff>0?idxs:idxs.filter(j=>w[j]>0); if(!pool.length)break; const j=pool.reduce((b,k)=>w[k]>w[b]?k:b,pool[0]); const step=diff>0?1:-1; w[j]+=step; diff-=step; g++;}}
function migrateWeights(w,lk){
  const base=[25,15,10,10,20,10,10];
  w=(Array.isArray(w)&&w.length===7)?w.map(Number):base.slice();
  lk=(Array.isArray(lk)&&lk.length===7)?lk.map(Boolean):Array(7).fill(false);
  if(w.some(x=>!Number.isInteger(x)||x<0||x>100)||w.reduce((a,b)=>a+b,0)!==100){w=base.slice(); lk=Array(7).fill(false);}
  const nw=w.slice(), nl=lk.slice(); nl[4]=true;
  if(w[4]===0){nw[4]=0; return {w:nw,lk:nl};}
  const retired=w[4]; nw[4]=0;
  const locked=nw.map((_,j)=>j).filter(j=>j!==4&&nl[j]);
  const free=nw.map((_,j)=>j).filter(j=>j!==4&&!nl[j]);
  const lockedSum=locked.reduce((a,j)=>a+w[j],0);
  if(!free.length||lockedSum>100){
    const idxs=nw.map((_,j)=>j).filter(j=>j!==4);
    const s=idxs.reduce((a,j)=>a+w[j],0);
    idxs.forEach(j=>{nw[j]=s>0?Math.round(w[j]*100/s):0;});
    fixSum(nw,idxs); nw[4]=0; return {w:nw,lk:nl};
  }
  const freeCur=free.reduce((a,j)=>a+w[j],0), room=100-lockedSum;
  free.forEach(j=>{nw[j]=freeCur>0?Math.round(w[j]*room/freeCur):Math.round(room/free.length);});
  locked.forEach(j=>{nw[j]=w[j];});
  nw[4]=0; fixSum(nw,free); return {w:nw,lk:nl};
}
function weightsForSaved(data){
  const w=data&&data.weights, lk=data&&data.locked;
  const ok=Array.isArray(w)&&w.length===7&&w.every(x=>Number.isInteger(x)&&x>=0&&x<=100)&&w.reduce((a,b)=>a+b,0)===100&&Array.isArray(lk)&&lk.length===7;
  if(ok) return migrateWeights(w,lk);
  return migrateWeights([25,15,10,10,20,10,10], Array(7).fill(false));
}
let pt; function savePrefs(){
  if(!S.user){
    try{localStorage.setItem(LOCAL_W, JSON.stringify({w:S.w,lk:S.lk}));}catch(e){}
    return;
  }
  clearTimeout(pt);pt=setTimeout(()=>sb.from('fs_weight_prefs').upsert({user_email:S.user,weights:S.w,locked:S.lk,updated_at:new Date().toISOString()}).then(()=>{}),800);
}
const score=r=>{if(!r||r.scored===false||r.cap==null)return null; return KEYS.reduce((a,k,i)=>a+(k==='cost'?0:(Number(r[k])||0)*S.w[i]),0)/100;};
const COLS=['n','name','cat','country','makes','num','num','num','num','num','num','num','uspres','certs','src'];
const WIDTHS=['3%','11%','7%','6.5%','12%','3.6%','3.6%','3.8%','7.2%','3.6%','3.6%','4.6%','11%','10.5%','9%'];

function scorecard(){
  const cats=[...new Set(S.rows.map(r=>r.category))].sort(), regs=[...new Set(S.rows.map(r=>r.region))].sort();
  app.innerHTML=`<h1>Supplier scorecard</h1>
  <div class="callout">${esc(window.FSN?FSN.COPY.intro:'')}</div>
  <p class="sub">${S.rows.length} scored manufacturers, plus ${(S.discovery||[]).length} names that are not scored. Desk research dated Nov 2, 2026, Nov 6, 2026, and Nov 7, 2026. The 1–5 scores are preliminary judgments from public pages, not qualifications or quotes. <a href="#/study">How the scores were set</a></p>
  ${bannerHtml()}
  <div class="callout"><b>Cost is unknown and is not in the score.</b> No purchase price, FOB, freight rate, or duty was collected, so cost is not a rank and it is not a column. <a href="#/study">The study</a> says what a landed cost is, and which container indexes were read. Those indexes are not a supplier cost. Lead time and geography stay in the score as assumptions, not measured transit or a proven result. Capability is catalog fit, not proven quality. Drawing fit, certificates, US shipment history, price, MOQ, and volume willingness are still unverified.</div>
  ${altCards()}
  <div class="card" style="margin-bottom:14px"><h2>Weights</h2><p class="muted" style="margin-top:-6px">Weight changes stay in this browser only. They do not change the supplier scores.</p><div class="weights" id="wts"></div>
  <div class="wtot"><span id="tot"></span> &nbsp; <button class="btn sec" id="rst">Return to defaults</button></div>
  <div class="wlocks"><span class="muted">Locks:</span> <button type="button" class="btn sec sm" id="lkall">Select all</button> <button type="button" class="btn sec sm" id="lknone">Unselect all</button> <span class="muted" style="font-size:12px">These buttons only check or uncheck the Lock boxes. Weights stay as they are and still total 100%.</span></div></div>
  <div class="filters"><label for="fc">Category <select id="fc"><option value="">All categories</option>${cats.map(c=>`<option>${esc(c)}</option>`).join('')}</select></label>
  <label for="fr">Region <select id="fr"><option value="">All regions</option>${regs.map(c=>`<option>${esc(c)}</option>`).join('')}</select></label>
  <label for="fm">Min score <input id="fm" type="number" inputmode="decimal" step="0.1" min="0" max="5" aria-describedby="fmhint"></label>
  <span id="fmhint">0 to 5. Leave blank to show every row at or above 0.</span></div>
  <p class="sortnote" id="sortnote">Click any column heading to sort; click again to reverse. The rank number stays the weighted-score rank.</p>
  <p class="uslegend" id="uslegend"><b>US footprint</b> is a 1–5 desk score for a US office, subsidiary, or claimed US presence on a public page. A named office is the strong end of the scale. A claim without a clear office is the middle. No US footprint found is the weak end. It is not verified shipment history, and customs records were not used. <b>US note</b> is the sentence kept with that score. For many names dated Nov 2, 2026 the sentence was not recorded, so the note says unknown even though a score is shown.</p>
  <p class="muted" id="counts"></p>
  <p class="callout" id="scalescale">1–5 screening scores: higher is more favorable; differences are not proportional.</p>
  <div class="card scorewrap"><table class="tbl" id="tb"></table></div>
  <div class="card" id="discover"></div>
  ${watchlistHtml()}`;
  $('#fc').value=S.f.cat;$('#fr').value=S.f.reg;$('#fm').value=S.f.min||'';
  [['#fc','cat'],['#fr','reg']].forEach(([s,k])=>$(s).onchange=e=>{S.f[k]=e.target.value;table();});
  $('#fm').oninput=e=>{S.f.min=+e.target.value||0;table();};
  $('#rst').onclick=()=>{const m=migrateWeights(DEF,Array(7).fill(false)); S.w=m.w; S.lk=m.lk; savePrefs(); weights(); table();};
  const setAllLocks=v=>{S.lk=setLocks(S.lk,v); S.lk[4]=true; S.w[4]=0; savePrefs(); weights();};$('#lkall').onclick=()=>setAllLocks(true);$('#lknone').onclick=()=>setAllLocks(false);
  weights();table();syncTopbar();
}
function watchlistHtml(){
  const items=(window.FS_CATALOG&&window.FS_CATALOG.watchlist)||[];
  return `<div class="card watchcard"><h2>Watchlist, not scored</h2>
  <p class="muted">These names are not in the ranked list. Huade and Taifeng do not have a confirmed ~700 bar line, so they are not treated as bolting-pump matches. Suggested numbers from the notes are not shown here.</p>
  ${items.map(w=>`<article class="watchitem"><h3>${esc(w.name)} <span class="tag alt2">${esc(w.id)}</span></h3><p>${esc(w.why)}</p><p class="muted">${esc(w.checked)}</p>${safeUrl(w.url)?`<p class="u"><a href="${esc(w.url)}" target="_blank" rel="noopener">${esc(w.url)}</a></p>`:''}</article>`).join('')}
  </div>`;
}
function weights(){
  $('#wts').innerHTML=KEYS.map((k,i)=>{const cost=k==='cost', proxy=k==='lead'||k==='geo';
    return `<div class="w"><span>${LBL[i]}${cost?' — unknown':''}${proxy?' *':''}</span><input type="range" min="0" max="100" value="${S.w[i]}" data-i="${i}" ${S.lk[i]||cost?'disabled':''}>
  <input type="number" min="0" max="100" value="${S.w[i]}" data-n="${i}" ${S.lk[i]||cost?'disabled':''}><label><input type="checkbox" data-l="${i}" ${S.lk[i]?'checked':''} ${cost?'disabled':''}> ${cost?'Excluded':'Lock'}</label></div>`;}).join('')+'<p class="muted" style="margin:8px 0 0">* Lead and Geo are assumptions, not a measured transit time or a proven risk score. Cost is excluded. The weights still total 100.</p>';
  $('#tot').textContent='Total: '+S.w.reduce((a,b)=>a+b,0)+'%';
  const sync=()=>{KEYS.forEach((_,j)=>{$(`[data-i="${j}"]`).value=S.w[j];const n=$(`[data-n="${j}"]`);if(document.activeElement!==n)n.value=S.w[j];});table();};
  document.querySelectorAll('[data-i]').forEach(el=>el.oninput=()=>{setW(+el.dataset.i,+el.value);sync();});
  document.querySelectorAll('[data-n]').forEach(el=>el.onchange=()=>{setW(+el.dataset.n,+el.value);el.value=S.w[+el.dataset.n];sync();});
  document.querySelectorAll('[data-l]').forEach(el=>el.onchange=()=>{if(+el.dataset.l===4){el.checked=true;return;} S.lk[+el.dataset.l]=el.checked; S.lk[4]=true; S.w[4]=0; savePrefs(); weights();});
}
function dateLabel(r){return r.pass==='2026-11-07'?'Researched Nov 7, 2026':r.pass==='2026-11-06'?'Researched Nov 6, 2026':'Researched Nov 2, 2026';}
function findAny(id){return S.rows.find(x=>x.id===id)||(S.discovery||[]).find(x=>x.id===id);}
function detailInner(r){
  const ev=evidenceHtml(r), flags=(r.flags||[]).map(f=>`<li>${esc(f)}</li>`).join('');
  const scored=r.cap!=null&&r.scored!==false;
  const sc=score(r);
  return `<div class="detail"><div class="detailhead"><h2>${esc(r.name)} <span class="tag">${dateLabel(r)}</span></h2><button type="button" class="btn sec" id="dx">Close</button></div>
  <p class="muted">${esc(r.id)} · ${esc(r.category)} · ${esc(r.country)} (${esc(r.region)})${r.supplier_type?' · '+esc(r.supplier_type):''}</p>
  <p>${esc(r.what_they_make)}</p>
  ${r.relevance?`<p><b>Why it is listed:</b> ${esc(r.relevance)}</p>`:''}
  ${r.claims?`<p><b>Claims, not verified:</b> ${esc(r.claims)}</p>`:''}
  <p><b>US presence:</b> ${esc(r.us_presence||'Unknown')}</p><p><b>Certs:</b> ${esc(r.certs_note||'Unknown')}</p>
  <p><b>HYTORC relationship:</b> ${esc(r.hytorc_relationship||'Unknown. Customs history has not been matched to this name.')}</p>
  <p><b>Cost:</b> Unknown. Not a quote and not part of the score.</p>
  ${scored?`<p>${KEYS.filter(k=>k!=='cost').map((k,i)=>`${LBL[KEYS.indexOf(k)]}: <b>${r[k]??'–'}</b>`).join(' · ')}</p>
  <p>Weighted score, cost excluded: <b>${sc==null?'—':sc.toFixed(2)}</b></p>
  <p class="callout">${esc(r.scores_status||'Preliminary 1-5 desk judgment from public pages. Not a qualification or a quote.')} Lead and Geo are assumptions. Capability is catalog fit, not proven quality. The score does not include a cost.</p>`:`<p class="callout">Not scored. No 1–5 technical scores were assigned, so this name is not ranked against the scored list. Cost is unknown.</p>`}
  ${r.pass==='2026-11-02'?'<p class="muted">Per-supplier discovery trail was not recorded. Source date Nov 2, 2026.</p>':''}
  ${r.price_note?`<p><b>Public price note, not a quote:</b> ${esc(r.price_note)}</p>`:''}
  ${flags?`<ul class="flags">${flags}</ul>`:''}
  ${ev?`<div class="ev">${ev}</div>`:''}
  ${safeUrl(r.url)?`<p class="u"><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.url)}</a></p>`:''}
  <a class="btn" href="#/study">Score is not a cost</a></div>`;
}
const SCORE_KEYS=['rank','name','category','country','makes','cap','cert','scale','usexp','lead','geo','score','uspres','certs','source'];
const SCORE_LABELS=['#','Supplier','Cat','Country','Makes','Cap','Cert','Scale','US footprint','Lead','Geo','Score','US note','Certs','Source'];
const SCORE_TIPS={usexp:'US footprint: 1–5 desk score for a public US office or claimed US presence. Not verified shipment history.'};
const DISC_KEYS=['name','category','country','status','source'];
const DISC_LABELS=['Name','Category','Country','Status','Source'];
function rowValue(row,key){
  if(key==='rank') return row._rank;
  if(key==='score') return row._s;
  if(key==='name') return row.name;
  if(key==='category') return row.category;
  if(key==='country') return row.country;
  if(key==='makes') return row.what_they_make;
  if(key==='cap'||key==='cert'||key==='scale'||key==='usexp'||key==='lead'||key==='geo') return row[key];
  if(key==='uspres') return row.us_presence;
  if(key==='certs') return row.certs_note;
  if(key==='source') return row.url||'';
  if(key==='status') return 'Not scored';
  return null;
}
function sortLabel(name,on,dir,off){
  if(off) return name+'. '+off;
  if(!on) return 'Sort by '+name;
  const now=dir==='asc'?'ascending':'descending', next=dir==='asc'?'descending':'ascending';
  return name+', sorted '+now+'. Activate to sort '+next;
}
function sortHeads(tableId,keys,labels,classes){
  const cur=tableId==='disc'?FSS.migrateSort(S.f.dsort,keys):FSS.migrateSort(S.f.sort,keys);
  if(tableId==='disc') S.f.dsort=cur; else S.f.sort=cur;
  const numeric={'cap':1,'cert':1,'scale':1,'usexp':1,'lead':1,'geo':1,'score':1};
  return keys.map((key,i)=>{
    const on=cur.key===key;
    const aria=on?(cur.dir==='asc'?'ascending':'descending'):'none';
    const prefer=!!numeric[key]&&key!=='rank';
    const nextWord=on?(cur.dir==='asc'?'descending':'ascending'):(prefer?'descending':'ascending');
    const now=on?(cur.dir==='asc'?'ascending':'descending'):'';
    const action=on?(labels[i]+', sorted '+now+'. Activate to sort '+nextWord+'.'):('Sort by '+labels[i]);
    const tip=SCORE_TIPS[key]||'';
    return `<th class="${classes[i]||''}" aria-sort="${aria}"><button type="button" class="sorthead" data-sort="${key}" data-table="${tableId}" title="${esc(tip||action)}" aria-label="${esc(tip?tip+' '+action:action)}"><span class="thlab">${labels[i]}</span><span class="tri" aria-hidden="true"><i class="up${on&&cur.dir==='asc'?' on':''}"></i><i class="dn${on&&cur.dir==='desc'?' on':''}"></i></span></button></th>`;
  }).join('');
}
function bindSort(tableId){
  document.querySelectorAll('#'+tableId+' .sorthead').forEach(btn=>btn.onclick=e=>{
    e.stopPropagation();
    const key=btn.dataset.sort;
    const prefer=key!=='rank'&&['cap','cert','scale','usexp','lead','geo','score'].indexOf(key)>=0;
    const cur=tableId==='disc'?S.f.dsort:S.f.sort;
    const next=FSS.nextSort(cur,key,prefer);
    if(tableId==='disc') S.f.dsort=next; else S.f.sort=next;
    table();
  });
}
function table(){
  if(!window.FSS) return;
  const ranked=S.rows.map(r=>({...r,_s:score(r)})).filter(r=>r._s!=null);
  FSS.sortRows(ranked,'score','desc',rowValue).forEach((r,i)=>{r._rank=i+1;});
  const cur=FSS.migrateSort(S.f.sort,SCORE_KEYS);
  S.f.sort=cur;
  let rows=ranked.filter(r=>(!S.f.cat||r.category===S.f.cat)&&(!S.f.reg||r.region===S.f.reg)&&r._s>=S.f.min);
  rows=FSS.sortRows(rows,cur.key,cur.dir,rowValue);
  const shown=KEYS.filter(k=>k!=='cost');
  $('#tb').innerHTML=`<colgroup>${WIDTHS.map(w=>`<col style="width:${w}">`).join('')}</colgroup><thead><tr>${sortHeads('tb',SCORE_KEYS,SCORE_LABELS,COLS)}</tr></thead><tbody>`+
  (rows.length?rows.map(r=>`<tr class="r${r.id===S.open?' on':''}" data-id="${esc(r.id)}"><td class="n">${r._rank}</td><td class="name"><b>${esc(r.name)}</b></td><td class="cat">${esc(r.category).replace(/\//g,'/<wbr>')}</td><td>${esc(r.country)}</td><td class="makes">${esc(r.what_they_make)}</td>${shown.map(k=>`<td class="num">${r[k]??''}</td>`).join('')}<td class="num sc">${r._s.toFixed(2)}</td><td class="uspres">${esc(r.us_presence)}</td><td class="certs">${esc(r.certs_note)}</td><td class="u">${safeUrl(r.url)?`<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.url)}</a>`:''}</td></tr>`).join(''):`<tr><td class="muted" colspan="${SCORE_KEYS.length}">No scored suppliers match these filters.</td></tr>`)+'</tbody>';
  paintDiscovery();
  bindSort('tb'); bindSort('disc');
  document.querySelectorAll('#tb tr.r').forEach(tr=>tr.onclick=e=>{
    const a=e.target.closest('a'); if(a){log('source_click',tr.dataset.id,{url:a.href});return;}
    if(e.target.closest('button'))return;
    e.stopPropagation();
    openDetail(tr.dataset.id);
  });
  if(S.open && ![...document.querySelectorAll('#tb tr.r, #discover tr.r')].some(t=>t.dataset.id===S.open)) closePop();
  else if(S.open) positionPop();
}
function closePop(){
  S.open=null;
  const p=document.getElementById('fspop'); if(p) p.remove();
  document.querySelectorAll('#tb tr.r.on, #discover tr.r.on').forEach(tr=>tr.classList.remove('on'));
}
function paintDiscovery(){
  const box=$('#discover'); if(!box) return;
  let rows=(S.discovery||[]).filter(r=>(!S.f.cat||r.category===S.f.cat)&&(!S.f.reg||r.region===S.f.reg));
  if(window.FSS){const cur=FSS.migrateSort(S.f.dsort,['name','category','country','source']); S.f.dsort=cur; rows=FSS.sortRows(rows,cur.key,cur.dir,rowValue);}
  const scored=document.querySelectorAll('#tb tbody tr.r').length;
  const c=$('#counts'); if(c) c.textContent=scored+' scored in this view · '+rows.length+' not scored in this view. Min score applies only to scored rows. Not-scored names have no rank.';
  box.innerHTML=`<h2>Not scored</h2><p class="muted">Public pages reviewed Nov 7, 2026. No 1–5 scores were assigned, so these names are not ranked with the scored list. Cost is unknown and is not a column here either. Where a customs check was made, it used only the visible names on ImportYeti’s public HYTORC page.</p>
  <div class="scorewrap"><table class="tbl" id="disc"><thead><tr>${sortHeads('disc',DISC_KEYS,DISC_LABELS,DISC_KEYS.map(()=>''))}</tr></thead><tbody>`+
  (rows.length?rows.map(r=>`<tr class="r${r.id===S.open?' on':''}" data-id="${esc(r.id)}"><td><b>${esc(r.name)}</b><br><span class="muted">${esc(r.id)}</span></td><td>${esc(r.category)}</td><td>${esc(r.country)}</td><td>Not scored</td><td class="u">${safeUrl(r.url)?`<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.url)}</a>`:''}</td></tr>`).join(''):'<tr><td colspan="5">No unscored names match this category and region.</td></tr>')+
  '</tbody></table></div>';
  box.querySelectorAll('tr.r').forEach(tr=>tr.onclick=e=>{if(e.target.closest('a'))return; e.stopPropagation(); openDetail(tr.dataset.id);});
}
function positionPop(){
  const p=document.getElementById('fspop'), row=document.querySelector('#tb tr.r.on, #discover tr.r.on');
  if(!p||!row) return;
  const margin=8, width=Math.min(460, window.innerWidth-margin*2);
  p.style.width=width+'px';
  const rect=row.getBoundingClientRect();
  const below=window.innerHeight-margin-(rect.bottom+6), above=rect.top-margin-6;
  const room=below>=160||below>=above?below:above;
  p.style.maxHeight=Math.max(160, Math.min(room, Math.round(window.innerHeight*0.7)))+'px';
  const popH=p.offsetHeight;
  let left=Math.round(rect.left);
  if(left+width>window.innerWidth-margin) left=window.innerWidth-margin-width;
  if(left<margin) left=margin;
  let top;
  if(below>=160||below>=above) top=Math.round(rect.bottom+6);
  else top=Math.max(margin, Math.round(rect.top-6-popH));
  p.style.left=left+'px'; p.style.top=top+'px';
}
function openDetail(id){
  if(S.open===id){closePop(); return;}
  const r=findAny(id); if(!r) return;
  S.open=id;
  log('supplier_open', id, {name:r.name});
  document.querySelectorAll('#tb tr.r, #discover tr.r').forEach(tr=>tr.classList.toggle('on', tr.dataset.id===id));
  let p=document.getElementById('fspop');
  if(!p){p=document.createElement('div'); p.id='fspop'; p.className='fspop'; p.setAttribute('role','dialog'); p.setAttribute('aria-label','Supplier detail'); document.body.appendChild(p);}
  p.innerHTML=detailInner(r);
  p.querySelectorAll('a[href^="http"]').forEach(a=>a.addEventListener('click',()=>log('source_click', r.id, {url:a.href})));
  const dx=p.querySelector('#dx');
  if(dx){dx.onclick=ev=>{ev.stopPropagation(); closePop();}; try{dx.focus({preventScroll:true});}catch(e){}}
  positionPop();
}
document.addEventListener('click',e=>{
  const p=document.getElementById('fspop'); if(!p) return;
  if(p.contains(e.target)) return;
  closePop();
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&S.open) closePop();});
window.addEventListener('scroll',()=>{if(S.open) positionPop();},true);
window.addEventListener('resize',()=>{if(S.open) positionPop();});

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
function worksheet(){
  closePop();
  const q=new URLSearchParams(location.hash.split('?')[1]||''); let sel=q.get('s'); if(!S.rows.some(r=>r.id===sel))sel=(S.rows[0]||{}).id;
  if(!sel){app.innerHTML='<div class="card"><p class="muted">No suppliers loaded yet.</p></div>';return;}
  const sup=S.rows.find(r=>r.id===sel);
  const opts=S.rows.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(r=>`<option value="${esc(r.id)}" ${r.id===sel?'selected':''}>${esc(r.name)} (${esc(r.category)})</option>`).join('');
  const forms={}; FSW.GATES.concat([FSW.DECISION]).forEach(g=>{forms[g.id]=FSW.deserialize(g.id);});
  WS={sel,forms,loadedAt:{},dirty:false,hasDetails:false}; S.wsDirty=false;
  app.innerHTML=`<h1>Supplier qualification worksheet</h1><p class="sub">Blank template. These are the fields a qualification review would fill in after a drawing, a quote, and a certificate check. Nothing on this page is loaded from saved notes.</p>
  <div class="card wstop"><label for="sup" class="fl">Supplier</label><select id="sup" class="fld" style="max-width:420px">${opts}</select>
  <p class="muted" style="font-size:12px">${esc(sup.category)} · ${esc(sup.country)} · every field below starts empty. This is not a completed qualification.</p></div>
  <div class="card" id="wssum" style="margin:14px 0"></div><div id="wsform"></div>`;
  $('#sup').onchange=e=>{location.hash='#/worksheet?s='+encodeURIComponent(e.target.value);};
  $('#wssum').innerHTML=summaryHtml();
  $('#wsform').innerHTML=FSW.GATES.map(g=>{const f=forms[g.id];return `<details class="card gatecard" open><summary><span class="gn">${g.n}</span> <b>${esc(g.l)}</b> <span class="gs">${esc(f.status)}</span></summary>
    <p class="muted hint">${esc(g.hint)}</p>
    <div class="wgrid"><div class="wf"><label for="st_${g.id}">Gate status (required checkpoint)</label><select id="st_${g.id}" class="fld" disabled>${FSW.STATUSES.map(s=>`<option ${s===f.status?'selected':''}>${s}</option>`).join('')}</select></div>
    ${g.f.map(x=>fieldHtml(g.id,x,f.details[x.k],true)).join('')}</div>
    <h4>Follow-up</h4><div class="wgrid">${FSW.COMMON.map(x=>fieldHtml(g.id,x,f.details[x.k],true)).join('')}
    <div class="wf wide"><label for="ev_${g.id}">Notes / evidence summary</label><textarea id="ev_${g.id}" class="fld" rows="2" disabled></textarea></div></div></details>`;}).join('')+
   `<div class="card gatecard"><h2>Open risks and recommendation</h2><div class="wgrid">${FSW.DECISION.f.map(x=>fieldHtml('decision',x,forms.decision.details[x.k],true)).join('')}</div></div>`;
}
// Kept for a future signed-in editor. The public page does not call this, and it is not reachable from the navigation.
async function worksheetStored(){
  if(!S.user)return;
  const q=new URLSearchParams(location.hash.split('?')[1]||''); let sel=q.get('s'); if(!S.rows.some(r=>r.id===sel))sel=(S.rows[0]||{}).id;
  if(!sel){app.innerHTML='<div class="card"><p class="muted">No suppliers loaded yet.</p></div>';return;}
  const sup=S.rows.find(r=>r.id===sel);
  const opts=S.rows.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(r=>`<option value="${esc(r.id)}" ${r.id===sel?'selected':''}>${esc(r.name)} (${esc(r.category)})</option>`).join('');
  app.innerHTML=`<h1>Supplier Qualification Worksheet</h1><p class="sub">Seven gates from short list to volume, per supplier. Notes and progress are stored in the shared project database for every editor, not in this browser. Each gate shows who saved it last.</p>
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

function partyFields(prefix,title){
  const basis='<option value="">Basis</option><option value="unit">Per piece</option><option value="shipment">Per shipment</option>';
  const scope='<option value="">Which base</option><option value="fob">FOB only</option><option value="fob_freight">FOB + freight</option><option value="fob_freight_insurance">FOB + freight + insurance</option>';
  return `<div class="card"><h2>${title}</h2><p class="muted">Your assumption for this side. Type 0 when a charge is none. Leave a box blank when you do not know it. Blank is not zero.</p><div class="wgrid">
    <div class="wf"><label for="${prefix}fob">FOB unit price</label><input id="${prefix}fob" class="fld" inputmode="decimal" placeholder="In the price currency"></div>
    <div class="wf"><label for="${prefix}ccy">Price currency</label><input id="${prefix}ccy" class="fld" maxlength="8" placeholder="Code"></div>
    <div class="wf"><label for="${prefix}fx" id="${prefix}fxl">1 price currency = this many comparison currency</label><input id="${prefix}fx" class="fld" inputmode="decimal" placeholder="Rate"></div>
    <div class="wf"><label for="${prefix}fr">Freight, in the comparison currency</label><input id="${prefix}fr" class="fld" inputmode="decimal"></div>
    <div class="wf"><label for="${prefix}frb">Freight basis</label><select id="${prefix}frb" class="fld">${basis}</select></div>
    <div class="wf"><label for="${prefix}in">Insurance, in the comparison currency</label><input id="${prefix}in" class="fld" inputmode="decimal"></div>
    <div class="wf"><label for="${prefix}inb">Insurance basis</label><select id="${prefix}inb" class="fld">${basis}</select></div>
    <div class="wf"><label for="${prefix}ot">Other quantified charges, in the comparison currency</label><input id="${prefix}ot" class="fld" inputmode="decimal"></div>
    <div class="wf"><label for="${prefix}otb">Other-charges basis</label><select id="${prefix}otb" class="fld">${basis}</select></div>
    <div class="wf"><label for="${prefix}du">Duty percent</label><input id="${prefix}du" class="fld" inputmode="decimal" placeholder="Your percent, not a tariff schedule"></div>
    <div class="wf"><label for="${prefix}ds">Duty applies to</label><select id="${prefix}ds" class="fld">${scope}</select></div>
  </div></div>`;
}
function readParty(prefix){
  const v=id=>{const el=$('#'+id); return el?el.value:'';};
  return {fob:v(prefix+'fob'),currency:v(prefix+'ccy'),fx:v(prefix+'fx'),freight:v(prefix+'fr'),freightBasis:v(prefix+'frb'),insurance:v(prefix+'in'),insuranceBasis:v(prefix+'inb'),other:v(prefix+'ot'),otherBasis:v(prefix+'otb'),dutyPercent:v(prefix+'du'),dutyScope:v(prefix+'ds'),fobLow:v(prefix+'lo'),fobHigh:v(prefix+'hi')};
}
function freightRateLabel(l){
  return (l.approx?'~':'')+'$'+l.usd40ft.toLocaleString('en-US')+', '+l.move;
}
function freightComparisonHtml(){
  if(!window.FSR) return '';
  const c=FSR.comparison, later=FSR.laterChina;
  const rows=c.lanes.map(l=>`<tr><td>${esc(l.name)}</td><td>${esc(freightRateLabel(l))}</td><td>${esc(l.date)}</td><td><a href="${esc(c.source)}" target="_blank" rel="noopener">Drewry WCI</a></td></tr>`).join('');
  return `<div class="scorewrap"><table class="tbl"><thead><tr><th>Lane</th><th>Latest spot rate (per 40ft)</th><th>Date</th><th>Source</th></tr></thead><tbody>${rows}</tbody></table></div>
  <p>Shanghai is about $6,450 more per 40-ft container than Rotterdam (9,631 − 3,181 = 6,450). The dates differ by one week.</p>
  <p>Supplier prices quoted FOB cover delivery to the port of loading. Ocean freight to the US is paid on top, so this gap belongs in landed cost, not in the screening score.</p>
  <p class="muted">More recent China reading: Drewry, ${esc(later.drewry.date)}, ${esc(later.drewry.name)} ${later.drewry.usd40ft.toLocaleString('en-US')} USD per 40-ft container; Freightos Baltic ${esc(later.fbx.name)}, ${esc(later.fbx.date)}, ${later.fbx.usdFeu.toLocaleString('en-US')} USD per FEU.</p>`;
}
function freightStudyHtml(){
  if(!window.FSR) return '';
  return `<h3>Container spot rates into the US East Coast</h3>
  <p>HYTORC’s address is Mahwah, New Jersey, so the ocean leg that matters is into the Port of New York and New Jersey. These are Drewry World Container Index spot rates, US dollars per 40-ft container, port to port. They are not a per-piece cost, not inland delivery to Mahwah, and not a quote.</p>
  ${freightComparisonHtml()}`;
}
function referenceHtml(){
  if(!window.FSR) return '';
  const R=FSR;
  const lines=R.hts.map(h=>`<tr><td>${esc(h.code)}</td><td>${esc(h.lineDescription)}</td><td>${esc(h.general)}</td><td>${esc(h.special)}</td><td>${esc(h.column2)}</td><td>Not returned. Not zero.</td></tr>`).join('');
  return `<div class="card" id="pubref"><h2>Public references, not a supplier cost</h2>
  <p>${esc(R.intro)}</p>
  <h3>Column 1 of the HTS, example lines only</h3>
  <p class="muted">${esc(R.htsNote)}</p>
  <div class="scorewrap"><table class="tbl"><thead><tr><th>HTS</th><th>Line description returned</th><th>General</th><th>Special column</th><th>Column 2</th><th>Chapter 99 / 232 / 301</th></tr></thead><tbody>${lines}</tbody></table></div>
  <p class="muted">${esc(R.unconfirmed)}</p>
  <h3>Drewry World Container Index</h3>
  ${freightComparisonHtml()}
  <p class="muted">Source: <a href="${esc(R.comparison.source)}" target="_blank" rel="noopener">${esc(R.comparison.source)}</a>.</p>
  </div>`;
}
function paintFeu(){
  const el=$('#feuresult'); if(!el||!window.FSR) return;
  const raw=$('#feupieces')&&$('#feupieces').value;
  const lane=FSR.freight.lanes.find(l=>l.id==='sha-ny');
  const n=FSR.perPiece(lane&&lane.usd40ft, raw);
  el.textContent=n==null?'No per-piece figure until that number is entered. Inland freight is not in this index.':('Shanghai to New York, '+lane.usd40ft.toLocaleString('en-US')+' USD divided by '+n.pieces+' pieces = '+n.perPiece.toFixed(2)+' USD per piece, port to port only. This is not written into the comparison above.');
}
function sensitivity(){
  closePop();
  if(!window.FSN){app.innerHTML='<div class="card"><p>Sensitivity calculator missing.</p></div>';return;}
  app.innerHTML=`<h1>Landed-cost drivers and sensitivity</h1>
  <div class="callout"><p>${esc(FSN.COPY.purpose)}</p><p>${esc(FSN.COPY.intro)}</p></div>
  <div class="card"><h2>What this can and cannot show</h2>
  <p>${esc(FSN.COPY.noCurve)}</p>
  <p>${esc(FSN.COPY.qualitative)}</p>
  <p>${esc(FSN.COPY.noRate)}</p>
  <p class="eq">${esc(FSN.formulaText())}</p>
  <p class="muted">Example of the rate direction, not a number filled in for you: 1 EUR = 1.08 USD. Do not enter the inverse. Same currency uses a rate of 1. The short form of this note is on <a href="#/study">Study</a>. No worksheet is shown on this page.</p></div>
  ${referenceHtml()}`;
}
// Preserved assumption worksheet. Not rendered: the public pages do not ask anyone to fill it in.
function sensitivityWorksheetMarkup(){
  return `<div class="card"><h2>Same item, quantity, and destination</h2><div class="wgrid">
    <div class="wf"><label for="syitem">Item label</label><input id="syitem" class="fld" placeholder="Optional. Not a drawing number"></div>
    <div class="wf"><label for="sydest">Destination</label><input id="sydest" class="fld" placeholder="Final destination"></div>
    <div class="wf"><label for="syccy">Comparison currency</label><input id="syccy" class="fld" maxlength="8" placeholder="Code"></div>
    <div class="wf"><label for="syqty">Quantity, pieces</label><input id="syqty" class="fld" inputmode="numeric" placeholder="One whole number"></div>
  </div></div>
  <div class="sensgrid">${partyFields('sb','Baseline assumption')}${partyFields('sc','Candidate assumption')}</div>
  <div class="card"><h2>Optional candidate FOB range</h2><p class="muted">Only if you want to test a low and a high you are assuming, in the candidate’s price currency. This is not an observed range and it is not a curve.</p><div class="wgrid">
    <div class="wf"><label for="sclo">Assumed low FOB</label><input id="sclo" class="fld" inputmode="decimal"></div>
    <div class="wf"><label for="schi">Assumed high FOB</label><input id="schi" class="fld" inputmode="decimal"></div>
  </div></div>
  <div id="syout"></div>`;
}
function paintSensitivity(){
  const out=$('#syout'); if(!out||!window.FSN) return;
  const cmp=($('#syccy').value||'').trim().toUpperCase();
  ['sb','sc'].forEach(p=>{const q=($('#'+p+'ccy').value||'').trim().toUpperCase(); const lab=$('#'+p+'fxl'); if(lab) lab.textContent='1 '+(q||'price currency')+' = this many '+(cmp||'comparison currency');});
  const common={item:$('#syitem').value,destination:$('#sydest').value,currency:$('#syccy').value,quantity:$('#syqty').value};
  const res=FSN.evaluateSensitivity(common,readParty('sb'),readParty('sc'));
  const money=v=>v==null?'—':v.toFixed(2);
  const line=(name,a,b)=>`<tr><td>${name}</td><td class="num">${money(a)}</td><td class="num">${money(b)}</td></tr>`;
  const b=res.baseline, c=res.candidate;
  const be=res.breakEven;
  let verdict='Enter the baseline and the candidate charges to see a break-even. Nothing is assumed for you.';
  if(be){
    const room=be.feasible?(be.premiumComparison>0?`The candidate FOB can be ${be.premiumComparison.toFixed(2)} ${esc(cmp||'')} higher per piece and still match the baseline landed cost.`:(be.premiumComparison<0?`No higher-FOB room. The candidate FOB would need to be ${Math.abs(be.premiumComparison).toFixed(2)} ${esc(cmp||'')} lower per piece to match. That negative premium is not reset to zero.`:'The FOB prices match once the other charges are included. The premium is zero.')):`No feasible FOB. The solved candidate FOB is ${be.fobComparison.toFixed(2)} ${esc(cmp||'')} per piece, which is below zero, so it is not a price. It is not reset to zero.`;
    const who={freight:'freight',insurance:'insurance',other:'other charges',dutyRate:'the duty percent',none:'no non-FOB difference'}[be.driver]||be.driver;
    verdict=room+` The largest effect on that premium is ${who}. Break-even candidate FOB is ${be.fobComparison.toFixed(2)} in the comparison currency (${be.fobPriceCurrency.toFixed(2)} in the candidate price currency).`;
  }
  const range=res.range?`Your assumed candidate range is ${res.range.lowCmp.toFixed(2)} to ${res.range.highCmp.toFixed(2)} in the comparison currency. This is your assumption, not an observed distribution. It ${res.range.overlapsBreakEven?'reaches':'does not reach'} the break-even FOB. That statement is only about the numbers typed here.`:'No assumed FOB range is entered.';
  out.innerHTML=`<div class="card"><h2>Result, assumptions only</h2><p>${verdict}</p><p>${range}</p><p class="muted">${res.gaps.length?('Still open: '+esc(res.gaps.join('; '))):'The required assumption fields are filled. This is still not a supplier quote.'}</p>
  <div class="scorewrap"><table class="tbl"><thead><tr><th>Per piece, comparison currency</th><th class="num">Baseline</th><th class="num">Candidate</th></tr></thead><tbody>
  ${line('FOB',b&&b.fob,c&&c.fob)}${line('Freight',b&&b.freight,c&&c.freight)}${line('Insurance',b&&b.insurance,c&&c.insurance)}${line('Other charges',b&&b.other,c&&c.other)}${line('Duty',b&&b.duty,c&&c.duty)}${line('Landed unit',b&&b.landed,c&&c.landed)}
  </tbody></table></div></div>`;
}
function quotes(){
  closePop();
  if(!window.FSQ){app.innerHTML='<div class="card"><p>Quote calculator missing.</p></div>';return;}
  const names=S.rows.concat(S.discovery||[]);
  const opts='<option value="">Choose a supplier</option>'+names.map(r=>`<option value="${esc(r.id)}">${esc(r.name)} (${esc(r.country)})</option>`).join('');
  const incos=FSQ.TERMS.map(k=>`<option>${k}</option>`).join('');
  const statusOpts='<option value="">Unknown</option><option value="included">Included in the seller price</option><option value="na">Not applicable</option><option value="buyer">Buyer pays</option>';
  const basisOpts='<option value="">Basis</option><option value="unit">Per piece</option><option value="shipment">Per shipment</option>';
  const unitOpts='<option value="">Unit</option><option value="days">Days</option><option value="weeks">Weeks</option>';
  const legRow=(i,key,label)=>`<div class="leg"><label for="ql${i}${key}">${label}</label><select id="ql${i}${key}" class="fld">${statusOpts}</select><input id="qa${i}${key}" class="fld" inputmode="decimal" placeholder="Buyer amount" aria-label="${label} amount in the comparison currency"><select id="qb${i}${key}" class="fld" aria-label="${label} basis">${basisOpts}</select></div>`;
  const block=(i)=>`<div class="card qcard"><h2>Supplier ${i+1}</h2><div class="wgrid">
    <div class="wf"><label for="qs${i}">Supplier</label><select id="qs${i}" class="fld">${opts}</select></div>
    <div class="wf"><label for="qk${i}">What you are typing</label><select id="qk${i}" class="fld"><option value="">Choose</option><option value="estimate">My estimate, not a quote</option><option value="quote">A quote the supplier gave</option></select></div>
    <div class="wf"><label for="qi${i}">Incoterm</label><select id="qi${i}" class="fld"><option value="">Choose</option>${incos}</select></div>
    <div class="wf"><label for="qp${i}">Named place in that Incoterm</label><input id="qp${i}" class="fld" placeholder="The place the term names"></div>
    <div class="wf"><label for="qc${i}">Price currency</label><input id="qc${i}" class="fld" maxlength="8" placeholder="Code"></div>
    <div class="wf"><label for="qx${i}" id="qxl${i}">1 quote currency = this many comparison currency</label><input id="qx${i}" class="fld" inputmode="decimal" placeholder="Rate"></div>
    <div class="wf"><label for="qu${i}">Unit price for this quantity</label><input id="qu${i}" class="fld" inputmode="decimal" placeholder="Per piece, in the price currency"></div>
    <div class="wf"><label for="qt${i}">Tooling, one-time, in the price currency</label><input id="qt${i}" class="fld" inputmode="decimal" placeholder="Blank, not 0"></div>
    <div class="wf"><label for="qts${i}"><input id="qts${i}" type="checkbox"> Spread tooling across this order quantity</label></div>
    <div class="wf"><label for="qmoq${i}">MOQ, pieces</label><input id="qmoq${i}" class="fld" inputmode="numeric"></div>
    <div class="wf"><label for="qdate${i}">Quote date</label><input id="qdate${i}" class="fld" type="date"></div>
    <div class="wf"><label for="qval${i}">Valid until</label><input id="qval${i}" class="fld" type="date"></div>
    <div class="wf"><label for="qprod${i}">Production lead</label><input id="qprod${i}" class="fld" inputmode="decimal" placeholder="Number"></div>
    <div class="wf"><label for="qprodu${i}">Production unit</label><select id="qprodu${i}" class="fld">${unitOpts}</select></div>
    <div class="wf"><label for="qtr${i}">Transit lead</label><input id="qtr${i}" class="fld" inputmode="decimal" placeholder="Number"></div>
    <div class="wf"><label for="qtru${i}">Transit unit</label><select id="qtru${i}" class="fld">${unitOpts}</select></div>
  </div>
  <p class="muted">Example of the rate direction, not a number filled in for you: 1 EUR = 1.08 USD means one euro is 1.08 of the comparison currency. Do not enter the inverse. Buyer-paid amounts below are in the comparison currency. The Incoterm does not fill any of them in. Unknown stays blank and blocks the total. There is no built-in rate.</p>
  <div class="legs">${FSQ.LEGS.map(([key,label])=>legRow(i,key,label)).join('')}</div></div>`;
  app.innerHTML=`<h1>Quote entry</h1><p class="sub">For a quote a supplier has given, or for an estimate kept separate from a quote. One drawing, one quantity, one ship-to. No drawing number or volume is on file, so the fields start empty. Nothing here is sent or saved.</p>
  <div class="card"><h2>Common request</h2><p class="muted">Leave these blank until the drawing and the quantity are known. One quantity. A unit price is not reused at a second quantity.</p><div class="wgrid">
    <div class="wf"><label for="qdraw">Drawing</label><input id="qdraw" class="fld"></div>
    <div class="wf"><label for="qrev">Revision</label><input id="qrev" class="fld"></div>
    <div class="wf"><label for="qspec">Spec</label><input id="qspec" class="fld"></div>
    <div class="wf"><label for="qmat">Material</label><input id="qmat" class="fld"></div>
    <div class="wf"><label for="qtol">Tolerances</label><input id="qtol" class="fld"></div>
    <div class="wf"><label for="qfin">Finish</label><input id="qfin" class="fld"></div>
    <div class="wf"><label for="qins">Inspection</label><input id="qins" class="fld"></div>
    <div class="wf"><label for="qship">Ship to</label><input id="qship" class="fld" placeholder="Final destination"></div>
    <div class="wf"><label for="qccy">Comparison currency</label><input id="qccy" class="fld" maxlength="8" placeholder="Code"></div>
    <div class="wf"><label for="qqty">Quantity, pieces</label><input id="qqty" class="fld" inputmode="numeric" placeholder="One whole number"></div>
  </div></div>
  ${block(0)}${block(1)}
  <div id="qout"></div>`;
  app.querySelectorAll('input,select').forEach(el=>{el.addEventListener('input',paintQuoteOut); el.addEventListener('change',paintQuoteOut);});
  paintQuoteOut();
}
function readSupplierQuote(i){
  const g=id=>{const el=$('#'+id); return el?el.value:'';};
  const legs={};
  FSQ.LEGS.forEach(([key])=>{legs[key]={status:g('ql'+i+key),amount:g('qa'+i+key),basis:g('qb'+i+key)};});
  return {id:g('qs'+i),kind:g('qk'+i),incoterm:g('qi'+i),namedPlace:g('qp'+i),currency:g('qc'+i),fx:g('qx'+i),unitPrice:g('qu'+i),tooling:g('qt'+i),spreadTooling:!!$('#qts'+i)&&$('#qts'+i).checked,moq:g('qmoq'+i),quoteDate:g('qdate'+i),validity:g('qval'+i),prodValue:g('qprod'+i),prodUnit:g('qprodu'+i),transitValue:g('qtr'+i),transitUnit:g('qtru'+i),legs};
}
function paintQuoteOut(){
  const out=$('#qout'); if(!out||!window.FSQ) return;
  const cmp=($('#qccy').value||'').trim().toUpperCase();
  [0,1].forEach(i=>{const q=($('#qc'+i).value||'').trim().toUpperCase(); const lab=$('#qxl'+i); if(lab) lab.textContent='1 '+(q||'quote currency')+' = this many '+(cmp||'comparison currency');});
  const common={drawing:$('#qdraw').value,revision:$('#qrev').value,spec:$('#qspec').value,material:$('#qmat').value,tolerances:$('#qtol').value,finish:$('#qfin').value,inspection:$('#qins').value,shipTo:$('#qship').value,currency:$('#qccy').value};
  const qty=$('#qqty').value;
  const sups=[0,1].map(readSupplierQuote);
  const today=(()=>{const n=new Date(),z=x=>String(x).padStart(2,'0'); return n.getFullYear()+'-'+z(n.getMonth()+1)+'-'+z(n.getDate());})();
  const evals=sups.map(s=>FSQ.evaluateQuote(common,s,qty,{today}));
  const cmpSet=FSQ.compareSet(evals);
  const money=v=>v==null?'—':v.toFixed(2);
  const rows=evals.map((r,i)=>{const nm=findAny(sups[i].id); const kind=sups[i].kind==='estimate'?'Estimate, not a quote':sups[i].kind==='quote'?'Supplier quote':'—';
    const state=r.complete?('Cost complete. '+(r.flags||[]).join('; ')):(('Cost incomplete: '+((r.gaps||[]).join('; ')||'missing'))+((r.flags||[]).length?'. '+r.flags.join('; '):''));
    return `<tr><td>${esc(nm?nm.name:(sups[i].id||'Not chosen'))}</td><td>${esc(kind)}</td><td class="num">${money(r.unitRecurring)}</td><td class="num">${money(r.oneTime)}</td><td class="num">${money(r.shipmentPerUnit)}</td><td class="num">${money(r.landedUnit)}</td><td>${esc(state)}</td></tr>`;}).join('');
  const request=['drawing '+($('#qdraw').value||'—'),'rev '+($('#qrev').value||'—'),'spec '+($('#qspec').value||'—'),'material '+($('#qmat').value||'—'),'finish '+($('#qfin').value||'—'),'inspection '+($('#qins').value||'—'),'quantity '+($('#qqty').value||'—'),'ship to '+($('#qship').value||'—'),'currency '+(cmp||'—')].join(' · ');
  out.innerHTML=`<div class="card"><h2>Result</h2><p class="muted">A dash is missing, not zero. There is no built-in rate. A per-shipment amount is divided by this order quantity. A per-piece amount is not. Tooling stays one-time unless you spread it across this quantity. Nothing here is sent or saved.</p><p>${esc(request)}</p><p class="muted">${esc(cmpSet.reason)}</p><table class="tbl"><thead><tr><th>Supplier</th><th>Kind</th><th>Unit price</th><th>One-time tooling</th><th>Other charges per piece</th><th>Landed unit</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
if(C.GA4_MEASUREMENT_ID){const s=document.createElement('script');s.async=1;s.src='https://www.googletagmanager.com/gtag/js?id='+C.GA4_MEASUREMENT_ID;document.head.appendChild(s);window.dataLayer=window.dataLayer||[];window.gtag=function(){dataLayer.push(arguments)};gtag('js',new Date());gtag('config',C.GA4_MEASUREMENT_ID);}
sb.auth.onAuthStateChange(ev=>{if(ev==='SIGNED_OUT')S.user=null; if(ev==='PASSWORD_RECOVERY')pwSetup=true;});
{const m=weightsForSaved(null); S.w=m.w; S.lk=m.lk;}
boot();
})();
