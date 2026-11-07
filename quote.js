// Local quote comparison. Blank is missing, not zero. No default duty, freight, or FX.
(function(root){
const INCO={
  EXW:{freight:false,insurance:false,duties:false},
  FCA:{freight:false,insurance:false,duties:false},
  FOB:{freight:false,insurance:false,duties:false},
  CFR:{freight:true,insurance:false,duties:false},
  CIF:{freight:true,insurance:true,duties:false},
  CPT:{freight:true,insurance:false,duties:false},
  CIP:{freight:true,insurance:true,duties:false},
  DAP:{freight:true,insurance:true,duties:false},
  DDP:{freight:true,insurance:true,duties:true}
};
const EXTRAS=['freight','insurance','broker','packaging','duties'];
function blank(v){return v==null||String(v).trim()==='';}
function num(v){
  if(blank(v)) return {ok:false,missing:true};
  const n=typeof v==='number'?v:Number(String(v).trim());
  if(!Number.isFinite(n)) return {ok:false,invalid:true};
  return {ok:true,n:n};
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
function evaluateQuote(common,supplier,qty){
  const gaps=[], flags=[];
  const inco=String((supplier&&supplier.incoterm)||'').trim().toUpperCase();
  const rule=INCO[inco];
  const qn=num(qty);
  if(qn.missing||qn.invalid||qn.n<=0) gaps.push('quantity');
  const price=num(supplier&&supplier.unitPrice);
  if(price.missing) gaps.push('unit price');
  else if(price.invalid||price.n<0) gaps.push('unit price is negative or not a number');
  const rate=fxRate(supplier&&supplier.currency, common&&common.currency, supplier&&supplier.fx);
  if(!rate.ok) gaps.push(rate.gap==='currency'?'currency':'FX rate');
  if(!rule) gaps.push('Incoterm');
  if(blank(supplier&&supplier.namedPlace)) gaps.push('named place');
  const extra={};
  EXTRAS.forEach(k=>{
    const included=!!(rule&&(k==='freight'?rule.freight:k==='insurance'?rule.insurance:k==='duties'?rule.duties:false));
    const v=num(supplier&&supplier[k]);
    if(included){
      if(!v.missing){flags.push(k+' is already inside '+inco+' and is not added again'); gaps.push('double-count '+k);}
      extra[k]=0;
    }else if(v.missing){gaps.push(k); extra[k]=null;}
    else if(v.invalid||v.n<0){gaps.push(k+' is negative or not a number'); extra[k]=null;}
    else extra[k]=v.n;
  });
  const tool=num(supplier&&supplier.tooling);
  let oneTime=null;
  if(tool.missing) oneTime=null;
  else if(tool.invalid||tool.n<0){gaps.push('tooling is negative or not a number');}
  else oneTime=tool.n;
  const amort=num(supplier&&supplier.amortQty);
  let toolingPerUnit=null;
  if(oneTime!=null){
    if(amort.missing) flags.push('tooling is one-time and is not in the unit landed cost');
    else if(amort.invalid||amort.n<=0) gaps.push('amortization quantity');
    else toolingPerUnit=oneTime/amort.n;
  }
  const drawingOk=!blank(common&&common.drawing)&&!blank(common&&common.revision);
  const shipOk=!blank(common&&common.shipTo);
  if(!drawingOk) flags.push('no drawing and revision yet');
  if(!shipOk) gaps.push('ship-to');
  const kind=String((supplier&&supplier.kind)||'');
  if(kind!=='estimate'&&kind!=='quote') gaps.push('estimate or quote');
  if(kind==='quote'&&blank(supplier&&supplier.quoteDate)) gaps.push('quote date');
  const rfqGaps=[];
  if(blank(supplier&&supplier.moq)) rfqGaps.push('MOQ');
  if(blank(supplier&&supplier.prod)) rfqGaps.push('production lead');
  if(blank(supplier&&supplier.transit)) rfqGaps.push('transit');
  if(kind==='quote'&&blank(supplier&&supplier.validity)) rfqGaps.push('validity');
  const blocked=gaps.length>0||!price.ok||price.n<0||!rate.ok;
  let unitRecurring=null, landedUnit=null;
  if(!blocked && extra.freight!=null && extra.insurance!=null && extra.duties!=null && extra.broker!=null && extra.packaging!=null){
    unitRecurring=price.n*rate.rate;
    landedUnit=unitRecurring+extra.freight+extra.insurance+extra.duties+extra.broker+extra.packaging;
    if(toolingPerUnit!=null) landedUnit+=toolingPerUnit;
  }
  const complete=landedUnit!=null && drawingOk && shipOk && qn.ok && qn.n>0;
  return {incoterm:inco||null,unitRecurring,oneTime,landedUnit,complete,gaps,flags,rfqGaps,comparable:complete&&rfqGaps.length===0};
}
function compareSet(rows){
  const ready=(rows||[]).filter(r=>r&&r.complete&&r.landedUnit!=null);
  if(ready.length<2) return {ok:false,reason:'Fewer than two complete landed costs.'};
  if(ready.some(r=>(r.rfqGaps||[]).length)) return {ok:false,reason:'RFQ status is incomplete, so these landed costs are not compared as a set.'};
  const inc=ready[0].incoterm;
  if(!ready.every(r=>r.incoterm===inc)) return {ok:false,reason:'Incoterms differ, so the landed totals are not comparable.'};
  return {ok:true,incoterm:inc};
}
const api={INCO,evaluateQuote,compareSet,blank,num,fxRate};
if(typeof module!=='undefined'&&module.exports) module.exports=api; else root.FSQ=api;
})(typeof window!=='undefined'?window:globalThis);
