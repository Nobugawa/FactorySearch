// Column sort. Unknown values stay last in both directions. Ties keep the original order.
(function(root){
function isUnknown(v){
  if(typeof v==='number') return !Number.isFinite(v);
  if(v==null) return true;
  const s=String(v).trim();
  return !s||/^(unknown|—|–|-|n\/a)$/i.test(s);
}
function sortRows(rows,key,dir,valueOf){
  const mul=dir==='asc'?1:-1;
  return rows.map((r,i)=>({r,i})).sort((a,b)=>{
    const va=valueOf(a.r,key), vb=valueOf(b.r,key);
    const ua=isUnknown(va), ub=isUnknown(vb);
    if(ua||ub){if(ua&&ub) return a.i-b.i; return ua?1:-1;}
    let c=0;
    if(typeof va==='number'&&typeof vb==='number') c=va-vb;
    else c=String(va).localeCompare(String(vb),undefined,{numeric:true,sensitivity:'base'});
    if(!c) return a.i-b.i;
    return c*mul;
  }).map(x=>x.r);
}
function migrateSort(saved,allowed){
  const ok=k=>!allowed||allowed.indexOf(k)>=0;
  if(saved&&typeof saved==='object'){
    const key=String(saved.key||''), dir=saved.dir==='asc'?'asc':saved.dir==='desc'?'desc':'';
    if(ok(key)&&dir) return {key,dir};
  }
  if(saved==='name'&&ok('name')) return {key:'name',dir:'asc'};
  if(saved==='country'&&ok('country')) return {key:'country',dir:'asc'};
  if(saved==='score'&&ok('score')) return {key:'score',dir:'desc'};
  if(saved==='cost'&&ok('cost')) return {key:'cost',dir:'desc'};
  return {key:ok('score')?'score':'name', dir:ok('score')?'desc':'asc'};
}
function nextSort(current,key,preferDesc){
  if(key==='status') return current;
  if(current&&current.key===key) return {key,dir:current.dir==='asc'?'desc':'asc'};
  return {key,dir:preferDesc?'desc':'asc'};
}
const api={isUnknown,sortRows,migrateSort,nextSort};
if(typeof module!=='undefined'&&module.exports) module.exports=api; else root.FSS=api;
})(typeof window!=='undefined'?window:globalThis);
