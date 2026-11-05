const {rebalance,validW}=(()=>{const s=require('fs').readFileSync(__dirname+'/../app.js','utf8');const a=s.indexOf('function rebalance'),b=s.indexOf('function setW(');return new Function(s.slice(a,b)+';return {rebalance,validW};')();})();const D=[25,15,10,10,20,10,10];let fails=0,n=0;
const ok=(c,m)=>{n++;if(!c){fails++;console.log('FAIL',m);}};
const sum=w=>w.reduce((a,b)=>a+b,0);
ok(sum(rebalance(D,Array(7).fill(false),0,50))===100,'basic');
ok(rebalance(D,Array(7).fill(false),0,50)[0]===50,'target');
let L=[false,true,false,false,true,false,false];let w=rebalance(D,L,0,90);ok(w[1]===15&&w[4]===20&&sum(w)===100&&w[0]===65,'locks clamp '+w);
ok(sum(rebalance(D,Array(7).fill(false),3,100))===100,'100');
ok(rebalance([100,0,0,0,0,0,0],Array(7).fill(false),0,40).slice(1).every(x=>x===10),'zero-sum spread');
ok(JSON.stringify(rebalance(D,[false,true,true,true,true,true,true],0,40))===JSON.stringify(D),'no free');
ok(JSON.stringify(rebalance(D,[true,false,false,false,false,false,false],0,40))===JSON.stringify(D),'locked target');
ok(JSON.stringify(rebalance(D,Array(7).fill(false),0,NaN))===JSON.stringify(D),'NaN typed');
ok(rebalance(D,Array(7).fill(false),0,-5)[0]===0&&rebalance(D,Array(7).fill(false),0,250)[0]===100,'clamp');
ok(rebalance(D,Array(7).fill(false),0,'33.6')[0]===34,'typed string');
for(let k=0;k<20000;k++){const lk=Array.from({length:7},()=>Math.random()<.3);let ww=D.slice();for(let s=0;s<5;s++)ww=rebalance(ww,lk,Math.floor(Math.random()*7),Math.random()*130-15);
 ok(sum(ww)===100&&ww.every(x=>Number.isInteger(x)&&x>=0)&&D.every((x,j)=>!lk[j]||ww[j]===x),'fuzz '+ww+' '+lk);if(fails>3)break;}
ok(validW(D,Array(7).fill(false))&&!validW([1,2],[])&&!validW([50,50,50,0,0,0,0],Array(7).fill(0)),'validW');
console.log(n,'checks',fails,'failures');
