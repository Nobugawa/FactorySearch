// Assumption-only landed-cost sensitivity for one quantity. Blank is missing, not zero.
// No tariff schedule, no freight rate, and no observed country price distribution.
(function(root){
const Q=(typeof window!=='undefined'&&window.FSQ)?window.FSQ:require('./quote.js');
const SCOPES={
  fob:'FOB only',
  fob_freight:'FOB + freight',
  fob_freight_insurance:'FOB + freight + insurance'
};
const COPY={
  intro:'China’s established manufacturing clusters offer significant advantages in component availability, specialist processes and supplier coordination. This study explores where manufacturers in other regions could complement those strengths through competitive landed costs, technical capabilities or supply resilience. The objective is to identify promising suppliers for further qualification, with commercial comparisons ultimately based on equivalent specifications and quoted terms.',
  purpose:'This page shows how much higher a candidate FOB can be before the freight, duty, and other charges you enter stop offsetting a baseline. Every figure is an assumption for the same item, the same quantity, and the same destination. It is not a supplier quote and not a factory price.',
  noCurve:'Public import records that were reviewed give customs unit values, which mix products in a shipment. They are not comparable factory FOB prices, and this page does not turn them into a price curve. A low and a high you type are your assumed range only. Overlap with the break-even price is conditional on those assumptions. It is not a result for the factories on the scorecard.',
  qualitative:'Capability, a nearby manufacturing ecosystem, and reliability are not converted into dollars here. A landed-cost gap is not a verdict on a factory.',
  noRate:'No freight rate or tariff for these parts is on file. A published figure belongs in the fields only when you enter it with the product, origin, destination, and date it applies to. A country name is not a duty rate, and a blank is not zero.'
};
function cents(n){return Math.round((n+Number.EPSILON)*100)/100;}
function money(v){
  if(Q.blank(v)) return {ok:false,missing:true};
  const n=Q.num(v);
  if(!n.ok) return n;
  if(n.n<0) return {ok:false,invalid:true};
  return n;
}
function perUnit(amount,basis,qty,gaps,label){
  const m=money(amount);
  if(m.missing){gaps.push(label); return null;}
  if(!m.ok){gaps.push(label+' is negative or not a number'); return null;}
  if(basis!=='unit'&&basis!=='shipment'){gaps.push(label+' basis'); return null;}
  if(!qty) return null;
  return basis==='unit'?m.n:m.n/qty;
}
function side(party,common,qty,label){
  const gaps=[];
  const rate=Q.fxRate(party&&party.currency, common&&common.currency, party&&party.fx);
  if(!rate.ok) gaps.push(label+' '+(rate.gap==='currency'?'currency':'FX rate'));
  const fob=money(party&&party.fob);
  let fobCmp=null;
  if(fob.missing) gaps.push(label+' FOB');
  else if(!fob.ok) gaps.push(label+' FOB is negative or not a number');
  else if(rate.ok) fobCmp=fob.n*rate.rate;
  const freight=perUnit(party&&party.freight, party&&party.freightBasis, qty, gaps, label+' freight');
  const insurance=perUnit(party&&party.insurance, party&&party.insuranceBasis, qty, gaps, label+' insurance');
  const other=perUnit(party&&party.other, party&&party.otherBasis, qty, gaps, label+' other charges');
  const dutyPct=money(party&&party.dutyPercent);
  const scope=String((party&&party.dutyScope)||'');
  if(dutyPct.missing) gaps.push(label+' duty percent');
  else if(!dutyPct.ok) gaps.push(label+' duty percent is negative or not a number');
  if(!SCOPES[scope]) gaps.push(label+' duty scope');
  let duty=null, landed=null, freightPart=null, insurancePart=null, otherPart=null, fobPart=null;
  if(!gaps.length && fobCmp!=null && freight!=null && insurance!=null && other!=null && dutyPct.ok){
    const r=dutyPct.n/100;
    const base=scope==='fob'?fobCmp:scope==='fob_freight'?fobCmp+freight:fobCmp+freight+insurance;
    duty=base*r;
    fobPart=fobCmp;
    freightPart=freight;
    insurancePart=insurance;
    otherPart=other;
    landed=fobCmp+freight+insurance+other+duty;
  }
  return {gaps,rate:rate.ok?rate.rate:null,fobCmp,freight,insurance,other,dutyPercent:dutyPct.ok?dutyPct.n:null,scope:SCOPES[scope]?scope:null,duty,fobPart,freightPart,insurancePart,otherPart,landed};
}
function multipliers(scope,r){
  return {
    fob:1+r,
    freight:scope==='fob'?1:(1+r),
    insurance:scope==='fob_freight_insurance'?(1+r):1,
    other:1
  };
}
function evaluateSensitivity(common,baseline,candidate){
  const gaps=[];
  if(Q.blank(common&&common.destination)) gaps.push('destination');
  const q=Q.posInt(common&&common.quantity);
  if(!q.ok) gaps.push('quantity must be one positive whole number');
  if(Q.blank(common&&common.currency)) gaps.push('comparison currency');
  const b=side(baseline,common,q.ok?q.n:0,'baseline');
  const cIn=Object.assign({},candidate);
  const cFobMissing=Q.blank(candidate&&candidate.fob);
  if(cFobMissing) cIn.fob='0';
  const c=side(cIn,common,q.ok?q.n:0,'candidate');
  const cGaps=c.gaps.filter(g=>!(cFobMissing&&g==='candidate FOB'));
  const hard=gaps.concat(b.gaps,cGaps);
  const range=readRange(candidate,c.rate);
  let result={mode:'assumption',ok:false,gaps:hard.concat(range.gap?[range.gap]:[]),baseline:null,candidate:null,breakEven:null,range:null,formula:formulaText()};
  if(hard.length||b.landed==null||!c.rate) return pack(result,b,c,cFobMissing);
  const rb=(b.dutyPercent||0)/100, rc=(c.dutyPercent||0)/100;
  const mb=multipliers(b.scope,rb), mc=multipliers(c.scope,rc);
  const fixed=s=>s.freight*multipliers(s.scope,s.dutyPercent/100).freight+s.insurance*multipliers(s.scope,s.dutyPercent/100).insurance+s.other;
  const fixedB=fixed(b), fixedC=fixed(c);
  const fobC=(b.landed-fixedC)/mc.fob;
  const premium=fobC-b.fobCmp;
  const contributions={
    freight:cents((b.freight*mb.freight-c.freight*mc.freight)/mc.fob),
    insurance:cents((b.insurance*mb.insurance-c.insurance*mc.insurance)/mc.fob),
    other:cents((b.other-c.other)/mc.fob),
    dutyRate:cents(b.fobCmp*((1+rb)/(1+rc)-1))
  };
  const driver=Object.entries(contributions).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1])||(a[0]<b[0]?-1:1))[0];
  result.ok=true;
  result.baseline=view(b);
  result.candidate=cFobMissing?view(Object.assign({},c,{fobCmp:null,landed:null,duty:null,fobPart:null})):view(c);
  result.breakEven={
    fobComparison:cents(fobC),
    fobPriceCurrency:cents(fobC/c.rate),
    premiumComparison:cents(premium),
    premiumPercent:b.fobCmp>0?cents(premium/b.fobCmp*100):null,
    feasible:fobC>=0,
    driver:Math.abs(driver[1])<0.005?'none':driver[0],
    contributions
  };
  if(range.value){
    result.range=Object.assign({observed:false,overlapsBreakEven:range.value.lowCmp<=result.breakEven.fobComparison&&range.value.highCmp>=result.breakEven.fobComparison},range.value);
  }
  return result;
}
function view(s){
  return {
    fob:s.fobCmp==null?null:cents(s.fobCmp),
    freight:s.freight==null?null:cents(s.freight),
    insurance:s.insurance==null?null:cents(s.insurance),
    other:s.other==null?null:cents(s.other),
    duty:s.duty==null?null:cents(s.duty),
    landed:s.landed==null?null:cents(s.landed),
    dutyScope:s.scope
  };
}
function pack(result,b,c,cFobMissing){
  if(!b.gaps.length&&b.landed!=null) result.baseline=view(b);
  if(!c.gaps.length&&!cFobMissing&&c.landed!=null) result.candidate=view(c);
  return result;
}
function readRange(candidate,rate){
  const lo=candidate&&candidate.fobLow, hi=candidate&&candidate.fobHigh;
  const loB=Q.blank(lo), hiB=Q.blank(hi);
  if(loB&&hiB) return {value:null};
  if(loB||hiB) return {gap:'assumed FOB range is incomplete', value:null};
  const a=money(lo), b=money(hi);
  if(!a.ok||!b.ok) return {gap:'assumed FOB range is negative or not a number', value:null};
  if(a.n>b.n) return {gap:'assumed FOB range is reversed', value:null};
  if(!rate) return {value:null};
  return {value:{low:a.n,high:b.n,lowCmp:cents(a.n*rate),highCmp:cents(b.n*rate),assumed:true,observed:false}};
}
function formulaText(){
  return 'Landed unit = FOB in the comparison currency + freight per piece + insurance per piece + other charges per piece + duty. Duty = your percent × the base you name (FOB, FOB + freight, or FOB + freight + insurance). A per-shipment amount is divided by this quantity. Break-even candidate FOB solves landed(candidate) = landed(baseline). The premium is that FOB minus the baseline FOB. A negative premium is left negative. A negative solved FOB is not a feasible price and is not reset to zero.';
}
const api={SCOPES,COPY,evaluateSensitivity,formulaText};
if(typeof module!=='undefined'&&module.exports) module.exports=api; else root.FSN=api;
})(typeof window!=='undefined'?window:globalThis);
