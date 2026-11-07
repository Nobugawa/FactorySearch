// Local quote comparison for one quantity. Blank is missing, not zero.
// Incoterm names do not fill in freight, insurance, duty, brokerage, or packaging.
(function(root){
const TERMS=['EXW','FCA','FOB','CFR','CIF','CPT','CIP','DAP','DDP'];
const LEGS=[
  ['carriage','Carriage in the seller price'],
  ['insurance','Insurance'],
  ['duties','Duties and tariffs'],
  ['broker','Brokerage'],
  ['packaging','Packaging'],
  ['destination','Charges after the named place, through the ship-to']
];
function blank(v){return v==null||String(v).trim()==='';}
function num(v){
  if(blank(v)) return {ok:false,missing:true};
  const n=typeof v==='number'?v:Number(String(v).trim());
  if(!Number.isFinite(n)) return {ok:false,invalid:true};
  return {ok:true,n:n};
}
function posInt(v){
  if(blank(v)) return {ok:false,missing:true};
  const s=String(v).trim();
  if(!/^[1-9]\d*$/.test(s)) return {ok:false,invalid:true};
  const n=Number(s);
  if(!Number.isSafeInteger(n)||n<=0) return {ok:false,invalid:true};
  return {ok:true,n:n};
}
function nonneg(v){
  if(blank(v)) return {ok:false,missing:true};
  const n=typeof v==='number'?v:Number(String(v).trim());
  if(!Number.isFinite(n)||n<0) return {ok:false,invalid:true};
  return {ok:true,n:n};
}
function cents(n){return Math.round((n+Number.EPSILON)*100)/100;}
function isoDate(v){
  const s=String(v||'').trim();
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if(!m) return null;
  const y=+m[1], mo=+m[2], d=+m[3];
  const dt=new Date(Date.UTC(y,mo-1,d));
  if(dt.getUTCFullYear()!==y||dt.getUTCMonth()!==mo-1||dt.getUTCDate()!==d) return null;
  return s;
}
function todayISO(v){
  if(!blank(v)) return String(v).slice(0,10);
  const n=new Date(), z=x=>String(x).padStart(2,'0');
  return n.getFullYear()+'-'+z(n.getMonth()+1)+'-'+z(n.getDate());
}
function fxRate(quoteCurrency,comparisonCurrency,fx){
  const q=String(quoteCurrency||'').trim().toUpperCase(), c=String(comparisonCurrency||'').trim().toUpperCase();
  if(!q||!c) return {ok:false,missing:true,gap:'currency'};
  if(q===c) return {ok:true,rate:1,same:true};
  const r=num(fx);
  if(r.missing) return {ok:false,missing:true,gap:'fx'};
  if(r.invalid||r.n<=0) return {ok:false,invalid:true,gap:'fx'};
  return {ok:true,rate:r.n};
}
function legAdd(leg,qty,gaps,flags,name){
  const status=String(leg&&leg.status||'').trim();
  if(status!=='included'&&status!=='na'&&status!=='buyer'){gaps.push(name+' is unknown'); return null;}
  if(status==='included'||status==='na'){
    if(!blank(leg&&leg.amount)){gaps.push('double-count '+name); return null;}
    flags.push(name+' marked '+(status==='included'?'included in the seller price':'not applicable'));
    return 0;
  }
  const amt=num(leg.amount);
  if(amt.missing){gaps.push(name+' amount'); return null;}
  if(amt.invalid||amt.n<0){gaps.push(name+' amount is negative or not a number'); return null;}
  const basis=String(leg.basis||'').trim();
  if(basis!=='unit'&&basis!=='shipment'){gaps.push(name+' basis'); return null;}
  if(!qty) return null;
  flags.push(name+' is a buyer charge in the comparison currency, '+(basis==='unit'?'per piece':'per shipment divided by '+qty));
  return basis==='unit'?amt.n:amt.n/qty;
}
function evaluateQuote(common,supplier,qty,opts){
  const gaps=[], flags=[], today=todayISO(opts&&opts.today);
  const inco=String((supplier&&supplier.incoterm)||'').trim().toUpperCase();
  const qn=posInt(qty);
  if(qn.missing||qn.invalid) gaps.push('quantity must be one positive whole number');
  const price=num(supplier&&supplier.unitPrice);
  if(price.missing) gaps.push('unit price');
  else if(price.invalid||price.n<0) gaps.push('unit price is negative or not a number');
  const rate=fxRate(supplier&&supplier.currency, common&&common.currency, supplier&&supplier.fx);
  if(!rate.ok) gaps.push(rate.gap==='currency'?'currency':'FX rate');
  if(!TERMS.includes(inco)) gaps.push('Incoterm');
  if(blank(supplier&&supplier.namedPlace)) gaps.push('named place');
  const legs=(supplier&&supplier.legs)||{};
  const perUnit={};
  LEGS.forEach(([key,name])=>{perUnit[key]=legAdd(legs[key], qn.ok?qn.n:0, gaps, flags, name);});
  const tool=num(supplier&&supplier.tooling);
  let oneTime=null, toolingPerUnit=null;
  if(tool.missing) oneTime=null;
  else if(tool.invalid||tool.n<0) gaps.push('tooling is negative or not a number');
  else if(!rate.ok) oneTime=null;
  else {
    oneTime=cents(tool.n*rate.rate);
    if(supplier&&supplier.spreadTooling){
      if(!qn.ok) gaps.push('tooling spread needs one order quantity');
      else toolingPerUnit=oneTime/qn.n;
    } else flags.push('tooling is one-time, in the price currency, and is not in the landed unit');
  }
  const req=[['drawing','drawing'],['revision','revision'],['spec','spec'],['material','material'],['finish','finish'],['inspection','inspection'],['shipTo','ship-to']];
  req.forEach(([k,label])=>{if(blank(common&&common[k])) gaps.push(label);});
  const kind=String((supplier&&supplier.kind)||'');
  if(kind!=='estimate'&&kind!=='quote') gaps.push('estimate or quote');
  const moq=posInt(supplier&&supplier.moq);
  if(moq.missing||moq.invalid) gaps.push('MOQ must be a positive whole number');
  else if(qn.ok&&qn.n<moq.n) gaps.push('quantity is below MOQ');
  [['prodValue','prodUnit','production lead'],['transitValue','transitUnit','transit']].forEach(([val,unit,label])=>{
    const n=nonneg(supplier&&supplier[val]);
    const u=String((supplier&&supplier[unit])||'').trim();
    if(n.missing) gaps.push(label);
    else if(!n.ok) gaps.push(label+' must be a nonnegative number');
    if(u!=='days'&&u!=='weeks') gaps.push(label+' unit');
  });
  if(kind==='quote'){
    const qd=isoDate(supplier&&supplier.quoteDate), vd=isoDate(supplier&&supplier.validity);
    if(!qd) gaps.push('quote date');
    else if(qd>today) gaps.push('quote date is after today');
    if(!vd) gaps.push('validity');
    else {
      if(qd&&vd<qd) gaps.push('validity is before the quote date');
      if(vd<today) gaps.push('quote expired');
    }
  }
  let unitRecurring=null, landedUnit=null, shipmentPerUnit=null;
  if(price.ok&&price.n>=0&&rate.ok) unitRecurring=cents(price.n*rate.rate);
  const legsOk=LEGS.every(([key])=>typeof perUnit[key]==='number');
  if(gaps.length===0&&unitRecurring!=null&&legsOk&&qn.ok){
    shipmentPerUnit=cents(LEGS.reduce((a,[key])=>a+perUnit[key],0));
    landedUnit=cents(unitRecurring+shipmentPerUnit+(toolingPerUnit||0));
  }
  const coversShipTo=perUnit.destination!=null&&!blank(common&&common.shipTo)&&!blank(supplier&&supplier.namedPlace);
  const complete=landedUnit!=null&&coversShipTo&&gaps.length===0;
  return {
    kind:kind==='quote'||kind==='estimate'?kind:null,
    incoterm:TERMS.includes(inco)?inco:null,
    namedPlace:blank(supplier&&supplier.namedPlace)?'':String(supplier.namedPlace).trim(),
    shipTo:blank(common&&common.shipTo)?'':String(common.shipTo).trim(),
    drawing:blank(common&&common.drawing)?'':String(common.drawing).trim(),
    revision:blank(common&&common.revision)?'':String(common.revision).trim(),
    spec:blank(common&&common.spec)?'':String(common.spec).trim(),
    material:blank(common&&common.material)?'':String(common.material).trim(),
    finish:blank(common&&common.finish)?'':String(common.finish).trim(),
    inspection:blank(common&&common.inspection)?'':String(common.inspection).trim(),
    qty:qn.ok?qn.n:null,
    comparisonCurrency:String((common&&common.currency)||'').trim().toUpperCase(),
    coversShipTo, unitRecurring, oneTime, shipmentPerUnit, landedUnit, complete, gaps, flags
  };
}
function norm(s){return String(s||'').trim().toLowerCase().replace(/\s+/g,' ');}
function compareSet(rows){
  const list=(rows||[]).filter(Boolean);
  const ready=list.filter(r=>r.complete&&r.landedUnit!=null);
  if(ready.length<2) return {ok:false,mode:null,reason:'Fewer than two complete landed costs. A blank field is missing, not zero, and one unit price is not reused at another quantity.'};
  const kinds=new Set(ready.map(r=>r.kind));
  if(kinds.size!==1) return {ok:false,mode:null,reason:'An estimate and a supplier quote stay in separate comparisons.'};
  const mode=[...kinds][0];
  const inc=norm(ready[0].incoterm), place=norm(ready[0].namedPlace), ship=norm(ready[0].shipTo);
  if(!ready.every(r=>norm(r.incoterm)===inc&&norm(r.namedPlace)===place))
    return {ok:false,mode:mode,reason:'Incoterm and named place both have to match. The same Incoterm code is not enough, and both have to reach this ship-to.'};
  if(!ship||!ready.every(r=>norm(r.shipTo)===ship&&r.coversShipTo))
    return {ok:false,mode:mode,reason:'Freight coverage has to reach the same ship-to. Matching the Incoterm does not do that.'};
  const id=r=>[r.drawing,r.revision,r.spec,r.material,r.finish,r.inspection,r.qty,r.shipTo,r.comparisonCurrency].map(norm).join('|');
  if(!ready.every(r=>id(r)===id(ready[0])))
    return {ok:false,mode:mode,reason:'Drawing, revision, spec, material, finish, inspection, quantity, ship-to, and comparison currency have to be the same request.'};
  const where=ready[0].incoterm+' '+ready[0].namedPlace+', through '+ready[0].shipTo;
  const reason=mode==='quote'
    ? 'Supplier-quote comparison on '+where+'.'
    : 'Estimate scenario only. These are not supplier quotes. Same request, '+where+'.';
  return {ok:true,mode:mode,incoterm:ready[0].incoterm,namedPlace:ready[0].namedPlace,reason:reason};
}
const api={TERMS,LEGS,evaluateQuote,compareSet,blank,num,fxRate,posInt,isoDate};
if(typeof module!=='undefined'&&module.exports) module.exports=api; else root.FSQ=api;
})(typeof window!=='undefined'?window:globalThis);
