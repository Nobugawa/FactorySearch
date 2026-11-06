// FactorySearch qualification worksheet model (pure; no DOM, no network). Shared by app.js and node tests.
(function(root){
const U='Unknown';
const STATUSES=['Not started','In progress','Passed','Failed','N/A'];
const COMMON=[ // every gate
  {k:'urls',l:'Evidence URLs (one per line)',t:'urls'},
  {k:'owner',l:'Follow-up owner',t:'text',max:80},
  {k:'due',l:'Follow-up date',t:'date'},
  {k:'next',l:'Next action',t:'text',max:300}];
const GATES=[
 {id:'drawing',n:1,l:'Drawing fit',hint:'Technical fit for a specific HYTORC part: process, material, tolerance, pressure class.',f:[
  {k:'part',l:'Part / drawing reference',t:'text',max:120},
  {k:'process_fit',l:'Process fit',t:'sel',o:[U,'Likely','Confirmed','Not a fit']},
  {k:'material',l:'Material / alloy grade',t:'text',max:120},
  {k:'tolerance',l:'Tolerance capability vs drawing',t:'text',max:160},
  {k:'pressure',l:'Pressure class / rating',t:'text',max:80},
  {k:'volume',l:'Annual volume assumed',t:'text',max:80}]},
 {id:'certs',n:2,l:'Certificates',hint:'Public claims are not verification. Record scope, issuer and expiry from the certificate itself.',f:[
  {k:'standard',l:'Standard(s)',t:'text',max:120,ph:'e.g. ISO 9001, IATF 16949, AS9100'},
  {k:'scope',l:'Scope covers this part / site',t:'sel',o:[U,'Yes','Partly','No']},
  {k:'issuer',l:'Issuer / registrar',t:'text',max:120},
  {k:'cert_no',l:'Certificate number',t:'text',max:80},
  {k:'expiry',l:'Expiry date',t:'date'},
  {k:'verified',l:'Verification',t:'sel',o:[U,'Claimed on website','Copy received','Verified with registrar']}]},
 {id:'customs',n:3,l:'Customs history',hint:'ImportYeti / Panjiva can find and screen candidates and validate claims. Records can be incomplete or filed under a parent, trader or forwarder; they do not prove quality, drawing fit or MOQ.',f:[
  {k:'platform',l:'Source checked',t:'sel',o:['None yet','ImportYeti','Panjiva','Both','Other']},
  {k:'us_shipments',l:'US shipments found',t:'sel',o:[U,'Yes','No','Under parent / trader']},
  {k:'pattern',l:'Frequency / recency / volume',t:'text',max:200},
  {k:'customers',l:'US customers seen',t:'text',max:200},
  {k:'products',l:'Product descriptions on records',t:'text',max:200},
  {k:'matches_claims',l:'Matches supplier claims',t:'sel',o:[U,'Yes','Partly','No']}]},
 {id:'fa',n:4,l:'First article',hint:'Samples and test results before any production order.',f:[
  {k:'sample_qty',l:'Sample quantity',t:'text',max:40},
  {k:'tests',l:'Tests performed',t:'text',max:200,ph:'Dimensional, material cert, hardness, pressure / leak'},
  {k:'result',l:'Result',t:'sel',o:[U,'Pass','Conditional','Fail']},
  {k:'report',l:'Report reference',t:'text',max:120},
  {k:'deviations',l:'Deviations / corrective actions',t:'text',max:300}]},
 {id:'audit',n:5,l:'Plant / audit',hint:'Process control, capacity, hidden subcontracting, traceability.',f:[
  {k:'audit_type',l:'Audit type',t:'sel',o:['None yet','Remote','On-site','Third-party']},
  {k:'audit_date',l:'Audit date',t:'date'},
  {k:'capacity',l:'Capacity available for this part',t:'text',max:160},
  {k:'subcontract',l:'Subcontracting',t:'sel',o:[U,'None','Disclosed','Undisclosed found']},
  {k:'traceability',l:'Traceability',t:'sel',o:[U,'Heat / lot','Serial','None']},
  {k:'findings',l:'Key findings',t:'text',max:300}]},
 {id:'commercial',n:6,l:'Commercial',hint:'Order-size fit is a gate: confirm willingness to supply HYTORC volumes. Leave Unknown until the supplier confirms; do not assume from company size.',f:[
  {k:'small_ok',l:'Willing to supply at HYTORC volumes',t:'sel',o:[U,'Yes','Conditional','No']},
  {k:'moq',l:'MOQ per SKU (one per line: SKU: qty)',t:'area',max:600},
  {k:'min_spend',l:'Minimum annual spend',t:'text',max:60},
  {k:'batch',l:'Economic batch size',t:'text',max:60},
  {k:'nre',l:'Tooling / setup / NRE fees',t:'text',max:120},
  {k:'currency',l:'Quote currency',t:'text',max:12},
  {k:'incoterm',l:'Incoterm',t:'sel',o:[U,'EXW','FCA','FOB','CIF','CPT','DAP','DDP']},
  {k:'lead_prod',l:'Production lead time',t:'text',max:60},
  {k:'lead_transit',l:'Transit lead time',t:'text',max:60},
  {k:'payment',l:'Payment terms',t:'text',max:80},
  {k:'tool_owner',l:'Tooling ownership',t:'sel',o:[U,'HYTORC','Supplier','Shared']}]},
 {id:'pilot',n:7,l:'Pilot to volume',hint:'Pilot lot, PPAP or equivalent, then volume, with exit criteria.',f:[
  {k:'pilot_qty',l:'Pilot quantity',t:'text',max:40},
  {k:'ppap',l:'PPAP / equivalent level',t:'text',max:60},
  {k:'exit',l:'Exit criteria (quality / lead time)',t:'text',max:200},
  {k:'readiness',l:'Order readiness',t:'sel',o:[U,'Not ready','Ready for pilot','Ready for volume']}]}];
const DECISION={id:'decision',f:[
  {k:'risks',l:'Open risks',t:'area',max:1000},
  {k:'decision',l:'Current recommendation',t:'sel',o:['Undecided','Continue','Hold','Drop']},
  {k:'rationale',l:'Rationale',t:'area',max:1000}]};
const MAX_BYTES=16000;
function fieldsOf(g){return (g.id==='decision'?DECISION.f:g.f.concat(COMMON));}
function blank(g){const d={};fieldsOf(g).forEach(f=>{d[f.k]=f.t==='sel'?f.o[0]:f.t==='urls'?[]:'';});return d;}
function cleanUrls(v){const a=Array.isArray(v)?v:String(v||'').split(/\r?\n/);return a.map(s=>String(s).trim()).filter(s=>/^https?:\/\/\S+$/i.test(s)&&s.length<=500).slice(0,10);}
function cleanDetails(g,raw){const out=blank(g);raw=raw&&typeof raw==='object'?raw:{};
  fieldsOf(g).forEach(f=>{const v=raw[f.k];if(v==null)return;
    if(f.t==='sel')out[f.k]=f.o.includes(v)?v:f.o[0];
    else if(f.t==='urls')out[f.k]=cleanUrls(v);
    else if(f.t==='date')out[f.k]=/^\d{4}-\d{2}-\d{2}$/.test(v)?v:'';
    else out[f.k]=String(v).slice(0,f.max||300);});
  return out;}
function isBlank(g,d){const b=blank(g);return fieldsOf(g).every(f=>JSON.stringify(d[f.k])===JSON.stringify(b[f.k]));}
// row <-> form
function serialize(gid,form,user,now){const g=gid==='decision'?DECISION:GATES.find(x=>x.id===gid);
  const details=Object.assign({v:1},cleanDetails(g,form.details));
  if(JSON.stringify(details).length>MAX_BYTES)throw new Error('Too much text in '+(g.l||'decision')+'; shorten some fields.');
  const status=gid==='decision'?details.decision:(STATUSES.includes(form.status)?form.status:'Not started');
  return {supplier_id:form.supplier_id,gate_id:gid,status,evidence:String(form.evidence||'').slice(0,4000),details,updated_by:user,updated_at:now};}
function legacyRow(row){const {details,...rest}=row;return rest;} // used when the details column does not exist yet
function deserialize(gid,row){const g=gid==='decision'?DECISION:GATES.find(x=>x.id===gid);row=row||{};
  return {status:row.status||(gid==='decision'?'Undecided':'Not started'),evidence:row.evidence||'',details:cleanDetails(g,row.details),updated_by:row.updated_by||'',updated_at:row.updated_at||''};}
function missingDetailsColumn(err){if(!err)return false;const m=(err.message||'')+' '+(err.code||'');return /PGRST204|42703/.test(m)||/details/.test(err.message||'')&&/column/i.test(err.message||'');}
// readiness: describes entered records only; never auto-passes a gate
function readiness(forms){const c={Passed:0,Failed:0,'In progress':0,'Not started':0,'N/A':0};const gaps=[];
  GATES.forEach(g=>{const f=forms[g.id]||deserialize(g.id);c[f.status]=(c[f.status]||0)+1;
    if(f.status!=='Passed'&&f.status!=='N/A')gaps.push(g.l);});
  const com=(forms.commercial||deserialize('commercial')).details;
  return {counts:c,gaps,orderSize:com.small_ok,moqEntered:!!String(com.moq||'').trim(),
    decision:(forms.decision||deserialize('decision')).details.decision,
    allPassed:c.Passed===GATES.length,na:c['N/A']};}
const api={GATES,DECISION,COMMON,STATUSES,MAX_BYTES,blank,cleanDetails,cleanUrls,serialize,deserialize,legacyRow,missingDetailsColumn,readiness,isBlank,fieldsOf};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.FSW=api;
})(typeof window!=='undefined'?window:globalThis);
