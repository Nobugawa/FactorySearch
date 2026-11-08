// Public references checked 8 Nov 2026. Not a supplier cost and not a classification.
// Column 1 rates are the USITC HTS search rows. Chapter 99 duties were not in those rows.
// Freight is Drewry's own 5 Nov 2026 assessment, port to port, per 40-ft container.
(function(root){
const checked='8 Nov 2026';
const hts=[
  {code:'7326.19.00',lineDescription:'Other',general:'2.9%',special:'Free (A, AU, B, BH, CL, CO, D, E, IL, JO, KR, MA, OM, P, PA, PE, S, SG)',column2:'45%',additional:'not returned'},
  {code:'8413.50.00',lineDescription:'Other reciprocating positive displacement pumps',general:'Free',special:'',column2:'35%',additional:'not returned'},
  {code:'8481.20.00',lineDescription:'Valves for oleohydraulic or pneumatic transmissions',general:'2%',special:'Free (A*, AU, B, BH, CL, CO, D, E, IL, JO, KR, MA, OM, P, PA, PE, S, SG)',column2:'35%',additional:'not returned'}
];
const freight={
  assessed:'Thursday, 5 Nov 2026',
  source:'https://www.drewry.co.uk/supply-chain-advisors/supply-chain-expertise/world-container-index-assessed-by-drewry',
  note:'Spot assessment, US dollars per 40-ft container, port to port. Not per piece, not inland, and not a quote for a HYTORC part. Rotterdam to New York was not in this assessment text, so it is not listed.',
  lanes:[
    {id:'composite',name:'World Container Index, composite',usd40ft:4389,note:'Down 1% that week'},
    {id:'sha-ny',name:'Shanghai to New York',usd40ft:9303,note:'Down 3% that week'},
    {id:'sha-la',name:'Shanghai to Los Angeles',usd40ft:7539,note:'Unchanged that week'},
    {id:'sha-rtm',name:'Shanghai to Rotterdam',usd40ft:3615,note:'Down 2% that week'},
    {id:'sha-goa',name:'Shanghai to Genoa',usd40ft:4166,note:'Unchanged that week'}
  ]
};
const intro='Checked 8 Nov 2026. These are public references for discussion. They are not a duty or a freight cost for any supplier on the scorecard, and they are not filled into the comparison. No HYTORC part has been classified.';
const htsNote='Column 1 rates were read from the USITC HTS search (hts.usitc.gov) on 8 Nov 2026. USITC’s announcement list shows 2026 HTS Revision 22 published on 30 Oct 2026 as the latest edition on that list. The search row itself did not carry a revision number, and its additional-duty field was empty. The line description is only the text on that row. A parent heading was not loaded, so this is not a full tariff title and not a classification. The special column is printed as published. It is not a ruling that a shipment qualifies.';
const unconfirmed='Not shown, and not treated as zero: Section 232, Section 301, and any other Chapter 99 duty; list membership; Japan, Korea, and Switzerland additional rates; a country-wide tariff; and Rotterdam to New York. A blank comparison field above is still unknown.';
function perPiece(containerUsd,pieces){
  const s=String(pieces==null?'':pieces).trim();
  if(!/^[1-9]\d*$/.test(s)) return null;
  const n=Number(s);
  if(!Number.isSafeInteger(n)||n<=0) return null;
  return {pieces:n,perPiece:Math.round((containerUsd/n+Number.EPSILON)*100)/100};
}
const api={checked,hts,freight,intro,htsNote,unconfirmed,perPiece};
if(typeof module!=='undefined'&&module.exports) module.exports=api; else root.FSR=api;
})(typeof window!=='undefined'?window:globalThis);
