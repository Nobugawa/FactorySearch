// Public references. Not a supplier cost and not a classification.
// Column 1 rates are the USITC HTS search rows read 8 Nov 2026. Chapter 99 duties were not in those rows.
// The Shanghai and Rotterdam to New York comparison is the Drewry WCI pair supplied for this page.
// A later China-only reading (Drewry 5 Nov 2026 and FBX03) is kept separate and is not the comparison.
(function(root){
const checked='8 Nov 2026';
const hts=[
  {code:'7326.19.00',lineDescription:'Other',general:'2.9%',special:'Free (A, AU, B, BH, CL, CO, D, E, IL, JO, KR, MA, OM, P, PA, PE, S, SG)',column2:'45%',additional:'not returned'},
  {code:'8413.50.00',lineDescription:'Other reciprocating positive displacement pumps',general:'Free',special:'',column2:'35%',additional:'not returned'},
  {code:'8481.20.00',lineDescription:'Valves for oleohydraulic or pneumatic transmissions',general:'2%',special:'Free (A*, AU, B, BH, CL, CO, D, E, IL, JO, KR, MA, OM, P, PA, PE, S, SG)',column2:'35%',additional:'not returned'}
];
const drewrySource='https://www.drewry.co.uk/supply-chain-advisors/supply-chain-expertise/world-container-index-assessed-by-drewry';
const comparison={
  source:drewrySource,
  sourceName:'Drewry World Container Index',
  lanes:[
    {id:'sha-ny',name:'Shanghai to New York',usd40ft:9631,approx:false,move:'down 5% on the week',date:'Oct 29, 2026'},
    {id:'rtm-ny',name:'Rotterdam to New York',usd40ft:3181,approx:true,move:'up 3% on the week',date:'Oct 22, 2026'}
  ],
  gapUsd:6450
};
const laterChina={
  drewry:{date:'Thursday, 5 Nov 2026',name:'Shanghai to New York',usd40ft:9303,source:drewrySource},
  fbx:{date:'week ending 6 Nov 2026',name:'Asia to US East Coast (FBX03)',usdFeu:9848,source:'https://theedgemalaysia.com/node/824924'}
};
const freight={assessed:laterChina.drewry.date,source:drewrySource,lanes:[{id:'sha-ny',name:laterChina.drewry.name,usd40ft:laterChina.drewry.usd40ft}]};
const fbx={assessed:laterChina.fbx.date,source:laterChina.fbx.source,lanes:[{id:'fbx03',name:laterChina.fbx.name,usdFeu:laterChina.fbx.usdFeu}]};
const intro='HTS rows checked 8 Nov 2026. The container comparison is the Drewry World Container Index pair for Shanghai to New York on Oct 29, 2026 and Rotterdam to New York on Oct 22, 2026. These are not a duty or a freight cost for any supplier on the scorecard, and they are not filled into a supplier total. No HYTORC part has been classified.';
const htsNote='Column 1 rates were read from the USITC HTS search (hts.usitc.gov) on 8 Nov 2026. USITC’s announcement list shows 2026 HTS Revision 22 published on 30 Oct 2026 as the latest edition on that list. The search row itself did not carry a revision number, and its additional-duty field was empty. The line description is only the text on that row. A parent heading was not loaded, so this is not a full tariff title and not a classification. The special column is printed as published. It is not a ruling that a shipment qualifies.';
const unconfirmed='Not shown on this card, and not treated as zero: Section 232 list membership for a named part; Japan, Korea, and Switzerland additional rates; a country-wide tariff; and Ningbo, Hamburg, Antwerp, or Genoa to New York as their own lanes. The China Section 301 exposure used in the score is on the Study page.';
function perPiece(containerUsd,pieces){
  const s=String(pieces==null?'':pieces).trim();
  if(!/^[1-9]\d*$/.test(s)) return null;
  const n=Number(s);
  if(!Number.isSafeInteger(n)||n<=0) return null;
  return {pieces:n,perPiece:Math.round((containerUsd/n+Number.EPSILON)*100)/100};
}
const api={checked,hts,comparison,laterChina,freight,fbx,intro,htsNote,unconfirmed,perPiece};
if(typeof module!=='undefined'&&module.exports) module.exports=api; else root.FSR=api;
})(typeof window!=='undefined'?window:globalThis);
