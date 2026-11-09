// Public references. Not a supplier cost and not a classification.
// Column 1 rates are the USITC HTS search rows read 8 Nov 2026. Chapter 99 duties were not in those rows.
// Container rates are only lanes into the US East Coast that were printed on the source page.
// Shanghai–Rotterdam and Shanghai–Genoa are Asia-to-Europe and are not listed.
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
  note:'Spot assessment, US dollars per 40-ft container, port to port. Not per piece, not inland to Mahwah, and not a quote. Only the published lane into the US East Coast is listed. Shanghai to Rotterdam and Shanghai to Genoa are Asia-to-Europe, so they are omitted. Ningbo, Hamburg, Antwerp, and Genoa to New York were not in this assessment text.',
  lanes:[
    {id:'sha-ny',name:'Shanghai to New York',usd40ft:9303,note:'Down 3% that week. Drewry’s China-to-US East Coast lane. Ningbo is not a separate figure.'}
  ]
};
const fbx={
  assessed:'week ending 6 Nov 2026',
  source:'https://theedgemalaysia.com/node/824924',
  note:'Freightos Baltic Index, as printed in the Baltic Exchange weekly shipping update. US dollars per FEU. Not per piece and not inland. The update stated Asia to the US East Coast. It did not state a North Europe or Mediterranean rate to the US East Coast.',
  lanes:[
    {id:'fbx03',name:'Asia to US East Coast (FBX03)',usdFeu:9848,note:'Down from 9,900 USD the previous week.'}
  ]
};
const intro='HTS rows checked 8 Nov 2026. Container indexes re-read 9 Nov 2026. These are public references for discussion. They are not a duty or a freight cost for any supplier on the scorecard, and they are not filled into a comparison. No HYTORC part has been classified.';
const htsNote='Column 1 rates were read from the USITC HTS search (hts.usitc.gov) on 8 Nov 2026. USITC’s announcement list shows 2026 HTS Revision 22 published on 30 Oct 2026 as the latest edition on that list. The search row itself did not carry a revision number, and its additional-duty field was empty. The line description is only the text on that row. A parent heading was not loaded, so this is not a full tariff title and not a classification. The special column is printed as published. It is not a ruling that a shipment qualifies.';
const unconfirmed='Not shown, and not treated as zero: Section 232, Section 301, and any other Chapter 99 duty; list membership; Japan, Korea, and Switzerland additional rates; a country-wide tariff; Ningbo as its own lane; and any North Europe or Mediterranean rate to New York. Those Europe-to-US lanes were not in the Drewry assessment text or the Baltic weekly update that were read.';
function perPiece(containerUsd,pieces){
  const s=String(pieces==null?'':pieces).trim();
  if(!/^[1-9]\d*$/.test(s)) return null;
  const n=Number(s);
  if(!Number.isSafeInteger(n)||n<=0) return null;
  return {pieces:n,perPiece:Math.round((containerUsd/n+Number.EPSILON)*100)/100};
}
const api={checked,hts,freight,fbx,intro,htsNote,unconfirmed,perPiece};
if(typeof module!=='undefined'&&module.exports) module.exports=api; else root.FSR=api;
})(typeof window!=='undefined'?window:globalThis);
