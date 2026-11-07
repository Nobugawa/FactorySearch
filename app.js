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
const KEYS=['cap','cert','scale','usexp','cost','lead','geo'], LBL=['Capability','Certs','Scale','US exp','Cost','Lead time','Geo risk'];
const DEF=[25,15,10,10,20,10,10];
const LOCAL_W='fs_local_weights_v1';
let S={user:null,rows:[],w:DEF.slice(),lk:Array(7).fill(false),f:{cat:'',reg:'',min:0,sort:'score'},t0:Date.now(),open:null,banner:'',logging:false,ping:null};
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
  try{const o=JSON.parse(localStorage.getItem(LOCAL_W)||''); if(validW(o.w,o.lk)){S.w=o.w; S.lk=o.lk.map(Boolean);}}catch(e){}
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
  if(asof) asof.textContent='Desk research dated '+cat.original_as_of+' and '+cat.china_as_of;
  return true;
}
async function boot(){
  if(!applyCatalog()){app.innerHTML='<div class="card"><h2>Research snapshot missing</h2><p class="muted">catalog.js did not load. The public pages do not read supplier rows from the database.</p></div>';return;}
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
    if(p.data&&validW(p.data.weights,p.data.locked)){S.w=p.data.weights; S.lk=p.data.locked.map(Boolean);}
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
function route(){const h=location.hash, v=h.startsWith('#/worksheet')?'ws':h.startsWith('#/sources')?'src':h.startsWith('#/study')?'study':'score';
  if(v!=='score') closePop();
  document.querySelectorAll('nav a[data-v]').forEach(a=>a.classList.toggle('on',a.dataset.v===v));
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
  ['Known US subsidiaries / sales offices','Used as the US-export signal in the "US" score.','A US office shows US presence. It does not verify customs volume, which parts ship, or to whom.']],
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
  app.innerHTML=`<h1>Sources</h1><p class="sub">Research channels for this short list, and what each link does and does not prove. Source dates are Nov 2, 2026 and Nov 6, 2026. See <a href="#/study">Study</a> for the method.</p>
  ${bannerHtml()}
  <div class="card" style="margin-bottom:14px"><h2>Channels used in the desk research</h2>
  <table class="tbl"><thead><tr><th>Channel</th><th>How it was used</th><th>Limitation</th></tr></thead><tbody>
  ${CHANNELS.used.map(c=>`<tr><td><b>${esc(c[0])}</b></td><td>${esc(c[1])}</td><td>${esc(c[2])}</td></tr>`).join('')}</tbody></table>
  <p class="muted" style="font-size:12px">No supplier was contacted, no quote requested, and no certificate pulled. Which reference first surfaced each individual supplier was not recorded. Cost, lead time, and geography scores are indicative assumptions, not quotes or measured results.</p></div>
  <div class="card" style="margin-bottom:14px"><h2>Planned research channels (not yet checked)</h2>
  <p class="muted" style="margin-top:-6px">Named in the study as the next research step. Customs-data platforms can both find new candidates and screen or validate existing ones; exhibitor lists mainly add candidates. None of these has been searched for any supplier yet. Links are to the public service or event site (opened Nov 6, 2026).</p>
  <table class="tbl"><thead><tr><th>Channel</th><th>What would be checked</th><th>Limitation</th></tr></thead><tbody>
  ${CHANNELS.planned.map(c=>`<tr><td><b>${esc(c[0])}</b><br><a href="${esc(c[1])}" target="_blank" rel="noopener">${esc(c[1])}</a></td><td>${c[2]}</td><td>${esc(c[3])}</td></tr>`).join('')}</tbody></table></div>
  <div class="card tblwrap"><h2>Per-supplier sources</h2><table class="tbl"><thead><tr><th>Supplier</th><th>Source date</th><th>Found via</th><th>Company URL</th><th>URL check</th><th>Re-check (${esc(rc.checked||'—')}, automated)</th><th>What the URL supports</th></tr></thead><tbody>
  ${S.rows.slice().sort((a,b)=>a.id.localeCompare(b.id,undefined,{numeric:true})).map(r=>{const x=rc.results[r.url]||''; const china=r.pass==='2026-11-06';
    const check=r.url_check===200?(china?'Opened Nov 6, 2026 (HTTP 200)':'Site responded'):(r.url_check==null?'not recorded':esc(r.url_check));
    return `<tr><td><b>${esc(r.name)}</b><br><span class="muted">${esc(r.id)}</span></td><td>${esc(r.pass||'')}</td>
  <td>${china?evidenceHtml(r)+'<p class="muted">Sources dated Nov 6, 2026.</p>':'Known industry name + company website. Specific discovery trail was not recorded. Source date Nov 2, 2026.'}</td>
  <td class="u">${safeUrl(r.url)?`<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.url)}</a>`:'—'}</td>
  <td>${check}</td><td>${china?'Not part of the Nov 5 recheck.':esc(x?(x.split(' ')[0]==='200'?'Site responded':'HTTP '+x.split(' ')[0]+' (likely blocks scripts)'):'not rechecked')}</td>
  <td>${china?'Pages opened on Nov 6, 2026 support the product family and the claims in the evidence column. They do not prove price, MOQ, volume willingness, customs shipments, or a current certificate.':'Company exists; product family. Homepage only. Not a product, certificate, or customs record.'}</td></tr>`;}).join('')}</tbody></table>
  <p class="muted" style="font-size:12px">The Nov 5 recheck is a scripted page load of homepages whose source date is Nov 2, 2026. It shows whether those sites responded. Names whose own sources are dated Nov 6, 2026 were not in that recheck. Each row keeps its own source date.</p></div>
  <div class="card watchcard"><h2>Watchlist sources, not scored</h2>
  ${(cat.watchlist||[]).map(w=>`<article class="watchitem"><h3>${esc(w.name)} <span class="tag alt2">${esc(w.id)}</span></h3><p>${esc(w.why)}</p><p class="muted">${esc(w.checked)}</p>${safeUrl(w.url)?`<p class="u"><a href="${esc(w.url)}" target="_blank" rel="noopener">${esc(w.url)}</a></p>`:''}</article>`).join('')}
  </div>`;
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
  const ncat=(rows,c)=>rows.filter(r=>r.category===c).length;
  app.innerHTML=`<h1>HYTORC supplier sourcing study</h1><p class="sub">Prepared for Teddy Hume by Philos Kim. Desk research dated Nov 2, 2026 and Nov 6, 2026. Live controls are on <a href="#/">Scorecard</a>. The <a href="#/worksheet">worksheet</a> is a blank qualification template. Channels are on <a href="#/sources">Sources</a>.</p>
  ${bannerHtml()}
  <div class="card study">
  <h2>Purpose and scope</h2><p>A starting short list for a sourcing review: real manufacturers, a scorecard that can be re-weighted, and alternative candidates per part family rather than a single low-cost bet. Three part families that are usually spec-critical for hydraulic bolting tools: hydraulics (pumps, valves, power packs, hoses), forgings and castings, and precision machining. Sockets and fasteners were left out because they are more standardized.</p>
  <p>The scorecard is one list of ${S.rows.length} manufacturers (${ncat(S.rows,'Hydraulics')} hydraulics, ${ncat(S.rows,'Forgings/Castings')} forgings and castings, ${ncat(S.rows,'Precision machining')} precision machining) in China, Taiwan, Korea, Japan, India, and Europe (Germany, Austria, Italy, Poland, the Czech Republic, and Israel). Chinese and non-Chinese factories are scored the same way. The practical question is where a second source could sit if HYTORC does not want China to be the only source. China stays in the comparison. The scores do not pick a winning country.</p>
  <p>This is not an exhaustive search, and it is not an evenly balanced survey of every producing country. It is a preliminary desk list of manufacturers already visible in these part families. Desk research is dated Nov 2, 2026 and Nov 6, 2026. Each name keeps its own source date on <a href="#/sources">Sources</a> and in its detail card.</p>
  <h2>How to read cost, lead time, and geography</h2>
  <p>This is a preliminary desk assessment across those geographies. Cost, lead time, and geography are indicative assumptions: expected tariffs and landed cost, typical freight time, and concentration in one country. They are not quotations, measured door-to-door times, or a finding that manufacturers in one country are a better source than manufacturers in another. Drawing fit, verified quality, US shipment history, MOQ, and willingness to take HYTORC volumes are still open. Changing the weights reorders these assumptions. It does not add factory evidence.</p>
  <p>A US office, a US manufacturing claim, or an export sentence is not verified US shipment history. A certificate named on a website, or a registrar row whose expiry was not checked, is not a verified certificate. Price, MOQ, and willingness to take HYTORC volumes were not found.</p>
  <p>Beijing Huade, Shandong Taifeng, and TZ Yuci are on the watchlist, not in the ranked list. A ~700 bar bolting-pump line was not confirmed for Huade or Taifeng, so they are not qualified bolting-pump matches. TZ Yuci's profile page was not opened.</p>
  <h2>How scores were set</h2><p>Each of the seven scores is a 1-5 desk judgment from public websites only: no quotes, plant visits, or certificate downloads. Default weights total 100 and can be changed on the Scorecard. A certificate score of 5 means a named standard was found in the sources. It does not mean the certificate was verified.</p>
  <div class="wrap"><table class="tbl"><thead><tr><th>Criterion</th><th>Default weight</th><th>5 (strong)</th><th>3 (mixed)</th><th>1 (weak)</th></tr></thead><tbody>${RUBRIC.map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
  <div class="callout" style="margin-top:10px"><b>Capability is catalog fit, not an audit.</b> It reflects product and process fit from public material, not plant quality. Certifications are expected from public text, not verified. Quality is established through the qualification steps below.</div>
  <h2>Landed cost assumption</h2><p>The Cost score is meant to reflect expected landed cost, not factory price alone:</p>
  <p class="eq">Landed cost ≈ unit price + freight + insurance + duties and any additional tariffs (e.g. Section 301 / 232 where applicable) + broker fees</p>
  ${li(['Tariff treatment varies by HTS line, origin and date, and has changed often. Rates were not verified line by line; each Cost cell is a starting flag, not a quote.','Europe often scores lower on Cost, on the assumption of a higher unit price, and higher on Capability and Geo risk. The weights can change that mix. These scores are not measured prices or transit times.','Steel and aluminum content can shift forging and casting costs where metal tariffs apply.'])}
  <h2>Proposed sourcing alternatives</h2><p>Summarized on the Scorecard. Lead and alternative candidates per part family are a starting point. They are not qualified and not interchangeable until drawings, specs and trials confirm fit.</p>
  <h2>Beyond factories: private label and agents</h2>
  ${li(['<b>Private label / white label:</b> buying a ready-made or lightly adapted product under the HYTORC name. Private label usually implies some exclusivity or customization; white label is a generic product many brands rebrand.','<b>Where it fits:</b> standard or near-standard items (hoses, fittings, some valves, C-parts, packaging) more than housings, reaction arms, or compact high-pressure pumps that must match tool geometry.','<b>Industrial distributors</b> with private-label programs can cover the standardized slice; they are a weaker fit for unique hydraulic power packs.','<b>Sourcing agents / trading companies:</b> useful for mapping an industrial district; the risks are markup and an obscured factory. Best used once the part family is defined, with factory identity, capability evidence, and a path to direct dual sourcing.'])}
  <h2>Qualification method</h2><p>Desk scores only produce a short list. Each candidate then moves through seven gates. The <a href="#/worksheet">worksheet</a> shows those fields as a blank template:</p>
  <ol><li><b>Drawing fit</b>: capability vs drawings, alloys, pressure class, annual volumes</li><li><b>Certificates</b>: pull and verify ISO / IATF / AS9100</li><li><b>Customs history</b>: ImportYeti / Panjiva shipment records cross-checked against the supplier\'s claimed US customers and export history (not yet done). The same data can also be used earlier, to find and screen candidates; see <a href="#/sources">Sources</a>.</li><li><b>First article</b>: sample parts; critical dimensions and material certs before a production PO</li><li><b>Plant / audit</b>: visit or third-party audit: process control, capacity, hidden subcontracting</li><li><b>Commercial</b>: MOQ, tooling ownership, lead time under load, payment terms, dual-source plan</li><li><b>Pilot to volume</b>: pilot lot, then PPAP or equivalent, then volume, with an exit if quality or lead time slips</li></ol>
  <h2>Questions for discussion</h2>
  ${li(['Which category (hydraulics, forgings/castings, machining) is the biggest drag today on quality, lead time, or cost?','Which part numbers, volumes, and alloy grades should drive the next pass?','Are there factories already trusted or ruled out, so the list does not duplicate them?'])}
  <h2>Limitations and next checks</h2>
  ${li(['All scores are preliminary desk judgments, not qualifications or quotes. Certifications and customs history are unverified. A named certificate, including a registrar row whose expiry was not checked, is not a verified certificate. A US office is not verified US shipment history.','No supplier was contacted and no quote requested. Price, MOQ, volume willingness, drawing fit, and verified quality are unknown across the list.','Cost, lead time, and geography are indicative assumptions, not quotations or measured outcomes. They do not establish that suppliers in one country are a better fit than suppliers in another.','Customs records (ImportYeti, Panjiva) and trade-show exhibitor lists (TIMTOS, KOTRA, PTC ASIA, EMO) have not been checked. Customs data can widen the candidate list and give an early read on US export experience, then support validation; it cannot by itself qualify a supplier for quality, drawing fit, or MOQ. See <a href="#/sources">Sources</a>.','The list is not an exhaustive world search. Vietnam and Thailand are not yet covered; Taiwan and Korea are thin.','HYTORC part lists, volumes and alloy grades are not in the model; scores should change once those are known.'])}
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
let pt; function savePrefs(){
  if(!S.user){
    try{localStorage.setItem(LOCAL_W, JSON.stringify({w:S.w,lk:S.lk}));}catch(e){}
    return;
  }
  clearTimeout(pt);pt=setTimeout(()=>sb.from('fs_weight_prefs').upsert({user_email:S.user,weights:S.w,locked:S.lk,updated_at:new Date().toISOString()}).then(()=>{}),800);
}
const score=r=>KEYS.reduce((a,k,i)=>a+(r[k]||0)*S.w[i],0)/100;
const COLS=['n','name','cat','country','makes','num','num','num','num','num','num','num','num','uspres','certs','src'];
const WIDTHS=['3%','10.5%','7%','6.5%','13%','3.4%','3.4%','3.6%','3.2%','3.4%','3.4%','3.3%','4.3%','10.5%','11.2%','10.3%'];

function scorecard(){
  const cats=[...new Set(S.rows.map(r=>r.category))].sort(), regs=[...new Set(S.rows.map(r=>r.region))].sort();
  app.innerHTML=`<h1>Supplier scorecard</h1><p class="sub">${S.rows.length} manufacturers in one list, in China and in other countries. The comparison is for alternatives to relying on China alone. China stays in the set, and the scores do not pick a winning country. Desk research dated Nov 2, 2026 and Nov 6, 2026. Suggested 1-5 scores are preliminary judgments, not qualifications or quotes. <a href="#/study">How to read the scores</a></p>
  ${bannerHtml()}
  <div class="callout"><b>Assumptions, not measured results.</b> Cost, lead time, and geography are indicative assumptions about tariffs, freight, and concentration. They are not quotes or measured transit times, and they do not show that one country is a better source than another. Drawing fit, certificates, US shipment history, price, MOQ, and volume willingness are still unverified.</div>
  ${altCards()}
  <div class="card" style="margin-bottom:14px"><h2>Weights</h2><p class="muted" style="margin-top:-6px">Weight changes stay in this browser only. They do not change the supplier scores.</p><div class="weights" id="wts"></div>
  <div class="wtot"><span id="tot"></span> &nbsp; <button class="btn sec" id="rst">Return to defaults</button></div>
  <div class="wlocks"><span class="muted">Locks:</span> <button type="button" class="btn sec sm" id="lkall">Select all</button> <button type="button" class="btn sec sm" id="lknone">Unselect all</button> <span class="muted" style="font-size:12px">These buttons only check or uncheck the Lock boxes. Weights stay as they are and still total 100%.</span></div></div>
  <div class="filters"><label for="fc">Category <select id="fc"><option value="">All categories</option>${cats.map(c=>`<option>${esc(c)}</option>`).join('')}</select></label>
  <label for="fr">Region <select id="fr"><option value="">All regions</option>${regs.map(c=>`<option>${esc(c)}</option>`).join('')}</select></label>
  <label for="fm">Min score <input id="fm" type="number" inputmode="decimal" step="0.1" min="0" max="5" aria-describedby="fmhint"></label>
  <span id="fmhint">0 to 5. Leave blank to show every row at or above 0.</span>
  <label for="fs">Sort <select id="fs"><option value="score">Sort: score</option><option value="name">Sort: name</option><option value="country">Sort: country</option><option value="cost">Sort: cost</option></select></label></div>
  <div class="card scorewrap"><table class="tbl" id="tb"></table></div>${watchlistHtml()}`;
  $('#fc').value=S.f.cat;$('#fr').value=S.f.reg;$('#fm').value=S.f.min||'';$('#fs').value=S.f.sort;
  [['#fc','cat'],['#fr','reg'],['#fs','sort']].forEach(([s,k])=>$(s).onchange=e=>{S.f[k]=e.target.value;table();});
  $('#fm').oninput=e=>{S.f.min=+e.target.value||0;table();};
  $('#rst').onclick=()=>{S.w=DEF.slice();S.lk=Array(7).fill(false);savePrefs();weights();table();};
  const setAllLocks=v=>{S.lk=setLocks(S.lk,v);savePrefs();weights();};$('#lkall').onclick=()=>setAllLocks(true);$('#lknone').onclick=()=>setAllLocks(false);
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
  $('#wts').innerHTML=KEYS.map((k,i)=>`<div class="w"><span>${LBL[i]}</span><input type="range" min="0" max="100" value="${S.w[i]}" data-i="${i}" ${S.lk[i]?'disabled':''}>
  <input type="number" min="0" max="100" value="${S.w[i]}" data-n="${i}" ${S.lk[i]?'disabled':''}><label><input type="checkbox" data-l="${i}" ${S.lk[i]?'checked':''}> Lock</label></div>`).join('');
  $('#tot').textContent='Total: '+S.w.reduce((a,b)=>a+b,0)+'%';
  const sync=()=>{KEYS.forEach((_,j)=>{$(`[data-i="${j}"]`).value=S.w[j];const n=$(`[data-n="${j}"]`);if(document.activeElement!==n)n.value=S.w[j];});table();};
  document.querySelectorAll('[data-i]').forEach(el=>el.oninput=()=>{setW(+el.dataset.i,+el.value);sync();});
  document.querySelectorAll('[data-n]').forEach(el=>el.onchange=()=>{setW(+el.dataset.n,+el.value);el.value=S.w[+el.dataset.n];sync();});
  document.querySelectorAll('[data-l]').forEach(el=>el.onchange=()=>{S.lk[+el.dataset.l]=el.checked;savePrefs();weights();});
}
function detailInner(r){
  const china=r.pass==='2026-11-06';
  const ev=evidenceHtml(r), flags=(r.flags||[]).map(f=>`<li>${esc(f)}</li>`).join('');
  return `<div class="detail"><div class="detailhead"><h2>${esc(r.name)} <span class="tag">${china?'Researched Nov 6, 2026':'Researched Nov 2, 2026'}</span></h2><button type="button" class="btn sec" id="dx">Close</button></div>
  <p class="muted">${esc(r.id)} · ${esc(r.category)} · ${esc(r.country)} (${esc(r.region)})${r.manufacturer?' · '+esc(r.manufacturer):''}</p>
  <p>${esc(r.what_they_make)}</p>
  ${r.relevance?`<p><b>Why it is listed:</b> ${esc(r.relevance)}</p>`:''}
  <p><b>US presence:</b> ${esc(r.us_presence)}</p><p><b>Certs:</b> ${esc(r.certs_note)}</p>
  <p>${KEYS.map((k,i)=>`${LBL[i]}: <b>${r[k]??'–'}</b>`).join(' · ')}</p>
  <p>Weighted score at the current weights: <b>${score(r).toFixed(2)}</b></p>
  <p class="callout">${esc(r.scores_status||'Preliminary 1-5 desk judgment from public pages. Not a qualification or a quote.')} Cost, lead time, and geo risk are indicative assumptions. They are not quotations, measured shipments, or a finding that one country is a better source.</p>
  ${china?'<p><b>Not found in the Nov 6, 2026 sources:</b> price, MOQ, and willingness to take HYTORC volumes.</p>':'<p class="muted">Per-supplier discovery trail was not recorded. Source date Nov 2, 2026.</p>'}
  ${flags?`<ul class="flags">${flags}</ul>`:''}
  ${ev?`<div class="ev">${ev}</div>`:''}
  ${safeUrl(r.url)?`<p class="u"><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.url)}</a></p>`:''}
  <a class="btn" href="#/worksheet?s=${encodeURIComponent(r.id)}">Open blank worksheet</a></div>`;
}
function table(){
  let rows=S.rows.map(r=>({...r,_s:score(r)})).filter(r=>(!S.f.cat||r.category===S.f.cat)&&(!S.f.reg||r.region===S.f.reg)&&r._s>=S.f.min);
  const so=S.f.sort; rows.sort((a,b)=>so==='score'?b._s-a._s:so==='cost'?(b.cost||0)-(a.cost||0):String(a[so]).localeCompare(b[so]));
  const heads=['#','Supplier','Cat','Country','Makes','Cap','Cert','Scale','US','Cost','Lead','Geo','Score','US presence','Certs','Source'];
  $('#tb').innerHTML=`<colgroup>${WIDTHS.map(w=>`<col style="width:${w}">`).join('')}</colgroup><thead><tr>${heads.map((h,i)=>`<th class="${COLS[i]}">${h}</th>`).join('')}</tr></thead><tbody>`+
  (rows.length?rows.map((r,n)=>`<tr class="r${r.id===S.open?' on':''}" data-id="${esc(r.id)}"><td class="n">${n+1}</td><td class="name"><b>${esc(r.name)}</b></td><td class="cat">${esc(r.category).replace(/\//g,'/<wbr>')}</td><td>${esc(r.country)}</td><td class="makes">${esc(r.what_they_make)}</td>${KEYS.map(k=>`<td class="num">${r[k]??''}</td>`).join('')}<td class="num sc">${r._s.toFixed(2)}</td><td class="uspres">${esc(r.us_presence)}</td><td class="certs">${esc(r.certs_note)}</td><td class="u">${safeUrl(r.url)?`<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.url)}</a>`:''}</td></tr>`).join(''):`<tr><td class="muted" colspan="${heads.length}">No suppliers match these filters.</td></tr>`)+'</tbody>';
  document.querySelectorAll('#tb tr.r').forEach(tr=>tr.onclick=e=>{
    const a=e.target.closest('a'); if(a){log('source_click',tr.dataset.id,{url:a.href});return;}
    if(e.target.closest('button'))return;
    e.stopPropagation();
    openDetail(tr.dataset.id);
  });
  if(S.open && ![...document.querySelectorAll('#tb tr.r')].some(t=>t.dataset.id===S.open)) closePop();
  else if(S.open) positionPop();
}
function closePop(){
  S.open=null;
  const p=document.getElementById('fspop'); if(p) p.remove();
  document.querySelectorAll('#tb tr.r.on').forEach(tr=>tr.classList.remove('on'));
}
function positionPop(){
  const p=document.getElementById('fspop'), row=document.querySelector('#tb tr.r.on');
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
  const r=S.rows.find(x=>x.id===id); if(!r) return;
  S.open=id;
  log('supplier_open', id, {name:r.name});
  document.querySelectorAll('#tb tr.r').forEach(tr=>tr.classList.toggle('on', tr.dataset.id===id));
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
  app.innerHTML=`<h1>Supplier qualification worksheet</h1><p class="sub">Blank template of the fields a qualification review would fill in. Nothing on this page is loaded from saved notes.</p>
  <div class="card wstop"><label for="sup" class="fl">Supplier</label><select id="sup" class="fld" style="max-width:420px">${opts}</select>
  <p class="muted" style="font-size:12px">${esc(sup.category)} · ${esc(sup.country)} · every field below starts empty. This is an illustration, not a saved record.</p></div>
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

if(C.GA4_MEASUREMENT_ID){const s=document.createElement('script');s.async=1;s.src='https://www.googletagmanager.com/gtag/js?id='+C.GA4_MEASUREMENT_ID;document.head.appendChild(s);window.dataLayer=window.dataLayer||[];window.gtag=function(){dataLayer.push(arguments)};gtag('js',new Date());gtag('config',C.GA4_MEASUREMENT_ID);}
sb.auth.onAuthStateChange(ev=>{if(ev==='SIGNED_OUT')S.user=null; if(ev==='PASSWORD_RECOVERY')pwSetup=true;});
boot();
})();
