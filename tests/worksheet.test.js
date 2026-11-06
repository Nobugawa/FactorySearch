const W=require('../worksheet.js');let f=0,n=0;const ok=(c,m)=>{n++;if(!c){f++;console.log('FAIL',m)}};
ok(W.GATES.map(g=>g.id).join()==='drawing,certs,customs,fa,audit,commercial,pilot','7 original gate ids preserved');
// blank defaults: selects start at first option (Unknown / None yet / Undecided), text blank, no invented data
W.GATES.forEach(g=>{const b=W.blank(g);W.fieldsOf(g).forEach(x=>{if(x.t==='sel')ok(['Unknown','None yet','Undecided'].includes(b[x.k]),'default unknown '+g.id+'.'+x.k);else if(x.t==='urls')ok(Array.isArray(b[x.k])&&!b[x.k].length,'urls empty');else ok(b[x.k]==='','blank '+x.k);});});
const com=W.GATES.find(g=>g.id==='commercial').f.map(x=>x.k);['small_ok','moq','min_spend','batch','nre','currency','incoterm','lead_prod','lead_transit','payment','tool_owner'].forEach(k=>ok(com.includes(k),'commercial has '+k));
// legacy rows (status/evidence only, no details) load without loss
let d=W.deserialize('certs',{status:'In progress',evidence:'old note',updated_by:'a@b',updated_at:'2026-11-06T00:00:00Z'});
ok(d.status==='In progress'&&d.evidence==='old note'&&d.details.verified==='Unknown','legacy row preserved');
ok(W.deserialize('fa').status==='Not started','missing row default');
// round trip
const form={supplier_id:'B2',status:'Passed',evidence:'note',details:{standard:'ISO 9001',scope:'Yes',expiry:'2027-05-01',verified:'Copy received',urls:'https://a.example/x\njavascript:alert(1)\nnot a url',owner:'Philos',due:'2026-11-20',next:'Ask for scope page'}};
const row=W.serialize('certs',form,'p@x','2026-11-06T10:00:00Z');
ok(row.gate_id==='certs'&&row.status==='Passed'&&row.evidence==='note'&&row.details.v===1,'serialize basics');
ok(JSON.stringify(row.details.urls)==='["https://a.example/x"]','only http(s) urls kept');
const back=W.deserialize('certs',JSON.parse(JSON.stringify(row)));ok(back.details.standard==='ISO 9001'&&back.details.expiry==='2027-05-01'&&back.details.owner==='Philos','roundtrip');
// validation
ok(W.serialize('certs',{status:'Bogus',details:{scope:'Maybe',expiry:'5/1/27'}},'u','t').status==='Not started','bad status -> Not started');
const r2=W.serialize('certs',{details:{scope:'Maybe',expiry:'5/1/27'}},'u','t');ok(r2.details.scope==='Unknown'&&r2.details.expiry==='','bad enum/date cleaned');
ok(W.serialize('drawing',{details:{part:'x'.repeat(999)}},'u','t').details.part.length===120,'maxlength enforced');
ok(Object.keys(W.serialize('certs',{details:{evil:'x'}},'u','t').details).indexOf('evil')<0,'unknown keys dropped');
// size
let big={};W.fieldsOf(W.DECISION).forEach(x=>big[x.k]='y'.repeat(5000));ok(JSON.stringify(W.serialize('decision',{details:big},'u','t').details).length<W.MAX_BYTES,'decision within limit after truncation');
// legacy save strips details (no opaque JSON in evidence)
const lr=W.legacyRow(row);ok(!('details' in lr)&&lr.evidence==='note','legacy row has no details and evidence untouched');
// missing column detection
ok(W.missingDetailsColumn({code:'42703',message:'column fs_worksheet.details does not exist'}),'42703');
ok(W.missingDetailsColumn({code:'PGRST204',message:"Could not find the 'details' column of 'fs_worksheet' in the schema cache"}),'PGRST204');
ok(!W.missingDetailsColumn({code:'42501',message:'permission denied'}),'other errors not treated as missing column');ok(!W.missingDetailsColumn(null),'null');
// readiness never auto-passes
let forms={};W.GATES.forEach(g=>forms[g.id]=W.deserialize(g.id));forms.decision=W.deserialize('decision');
let r=W.readiness(forms);ok(r.counts.Passed===0&&r.gaps.length===7&&r.orderSize==='Unknown'&&!r.moqEntered&&!r.allPassed&&r.decision==='Undecided','blank readiness');
forms.commercial.details.moq='SKU1: 50';forms.commercial.details.small_ok='Yes';forms.certs.status='Passed';forms.drawing.status='N/A';
r=W.readiness(forms);ok(r.counts.Passed===1&&r.na===1&&r.gaps.length===5&&r.moqEntered&&r.orderSize==='Yes','readiness counts');
console.log(n,'checks',f,'failures');process.exit(f?1:0);
