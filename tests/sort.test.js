const {sortRows,migrateSort,nextSort,isUnknown}=require('../sort.js');
let f=0,n=0;const ok=(c,m)=>{n++;if(!c){f++;console.log('FAIL',m);}};
const rows=[
  {id:'a',name:'Bravo',country:'Germany',score:3,us:'Unknown',source:''},
  {id:'b',name:'alpha',country:'China',score:3,us:'HAWE North America',source:'https://a.example'},
  {id:'c',name:'Charlie',country:'China',score:4,us:'unknown',source:'https://c.example'}
];
const val=(row,key)=>key==='name'?row.name:key==='country'?row.country:key==='score'?row.score:key==='us'?row.us:key==='source'?row.source:key==='rank'?row.rank:null;
let s=sortRows(rows,'name','asc',val).map(r=>r.id);
ok(s.join()==='b,a,c','text sort is alphabetical and case-insensitive');
s=sortRows(rows,'name','desc',val).map(r=>r.id);
ok(s.join()==='c,a,b','text sort reverses known values only');
s=sortRows(rows,'score','asc',val).map(r=>r.id);
ok(s.join()==='a,b,c','equal scores keep the original order');
s=sortRows(rows,'score','desc',val).map(r=>r.id);
ok(s.join()==='c,a,b','a higher score sorts first, and the tie stays stable');
s=sortRows(rows,'us','asc',val).map(r=>r.id);
ok(s.join()==='b,a,c','unknown text sorts last ascending');
s=sortRows(rows,'us','desc',val).map(r=>r.id);
ok(s[s.length-1]!=='b'&&s.join()==='b,a,c','unknown text stays last descending');
s=sortRows(rows,'source','desc',val).map(r=>r.id);
ok(s[s.length-1]==='a','a blank source stays last');
ok(isUnknown(0)===false&&isUnknown(null)&&isUnknown('Unknown'),'zero is a value and unknown is not');
ok(JSON.stringify(migrateSort('score'))==='{"key":"score","dir":"desc"}','an old score choice becomes score descending');
ok(JSON.stringify(migrateSort('name'))==='{"key":"name","dir":"asc"}'&&JSON.stringify(migrateSort('country'))==='{"key":"country","dir":"asc"}','old name and country choices stay A to Z');
ok(JSON.stringify(migrateSort('cost'))==='{"key":"score","dir":"desc"}','a saved cost sort is not used');
ok(JSON.stringify(migrateSort({key:'country',dir:'desc'}))==='{"key":"country","dir":"desc"}','a current sort is kept');
ok(JSON.stringify(nextSort({key:'name',dir:'asc'},'name',false))==='{"key":"name","dir":"desc"}','the same column toggles direction');
ok(JSON.stringify(nextSort({key:'name',dir:'asc'},'score',true))==='{"key":"score","dir":"desc"}','a numeric column starts high to low');
ok(nextSort({key:'score',dir:'desc'},'cost',true).key==='score','cost is not given an order');
const ranked=rows.map((r,i)=>({...r,rank:i+1}));
const view=sortRows(ranked,'name','asc',val);
ok(view.map(r=>r.rank).join()==='2,1,3','sorting another column does not rewrite rank');
console.log(n,'checks',f,'failures');process.exit(f?1:0);
