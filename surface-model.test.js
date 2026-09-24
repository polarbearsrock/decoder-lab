/* Run with: node surface-model.test.js */
'use strict';
const assert=require('node:assert/strict');
require('./model.js');require('./surface-model.js');
const M=globalThis.__surfaceModel;
const bitmask=ids=>ids.reduce((a,i)=>a|(1n<<BigInt(i)),0n);
const parity=ids=>ids.length%2;
function rank(rows,n){
  rows=rows.map(bitmask);let r=0;
  for(let c=0;c<n;c++){
    const i=rows.findIndex((v,i)=>i>=r&&(v&(1n<<BigInt(c))));
    if(i<0)continue;[rows[i],rows[r]]=[rows[r],rows[i]];
    for(let j=r+1;j<rows.length;j++)if(rows[j]&(1n<<BigInt(c)))rows[j]^=rows[r];
    r++;
  }return r;
}
// Independent unit-capacity max-flow: the smallest dual logical X cut has d edges.
function minCut(p){
  const n=p.nodes.length+2,s=n-2,t=n-1,cap=Array.from({length:n},()=>Array(n).fill(0));
  for(const e of p.edges)cap[e.a][e.b]=cap[e.b][e.a]=1;
  for(const v of p.nodes.filter(v=>v.boundary))if(v.col===0)cap[s][v.id]=p.n;else cap[v.id][t]=p.n;
  let flow=0;
  while(true){
    const prev=Array(n).fill(-1),queue=[s];prev[s]=s;
    for(let h=0;h<queue.length&&prev[t]<0;h++)for(let v=0;v<n;v++)if(cap[queue[h]][v]>0&&prev[v]<0){prev[v]=queue[h];queue.push(v);}
    if(prev[t]<0)return flow;
    let amount=p.n;for(let v=t;v!==s;v=prev[v])amount=Math.min(amount,cap[prev[v]][v]);
    for(let v=t;v!==s;v=prev[v]){cap[prev[v]][v]-=amount;cap[v][prev[v]]+=amount;}flow+=amount;
  }
}
for(const d of [3,5,7,9]){
  const p=M.makePatch(d),checks=p.nodes.filter(v=>!v.boundary).map(v=>p.edges.filter(e=>e.a===v.id||e.b===v.id).map(e=>e.id));
  assert.equal(p.n,d*d+(d-1)*(d-1));
  assert.equal(rank(checks,p.n),d*(d-1));assert.equal(rank(p.faces.map(f=>f.edges),p.n),d*(d-1));
  assert.equal(p.n-rank(checks,p.n)-rank(p.faces.map(f=>f.edges),p.n),1);
  for(const x of checks)for(const z of p.faces)assert.equal(parity(x.filter(q=>z.edges.includes(q))),0,'HX HZ^T');
  for(const f of p.faces){assert.equal(M.syndrome(p,f.edges).some(Boolean),false);assert.equal(parity(f.edges.filter(q=>p.logicalX.includes(q))),0);}
  assert.equal(M.syndrome(p,p.logicalZ).some(Boolean),false);
  assert.equal(parity(p.logicalZ.filter(q=>p.logicalX.includes(q))),1);
  assert.equal(minCut(p),d);
  const distances=p.nodes.map(()=>Infinity),queue=p.nodes.filter(v=>v.col===0).map(v=>v.id);
  queue.forEach(v=>distances[v]=0);
  for(let h=0;h<queue.length;h++)for(const e of p.edges){const v=e.a===queue[h]?e.b:e.b===queue[h]?e.a:-1;if(v>=0&&distances[v]===Infinity){distances[v]=distances[queue[h]]+1;queue.push(v);}}
  assert.equal(Math.min(...p.nodes.filter(v=>v.col===d).map(v=>distances[v.id])),d,'Z distance');
}
const p=M.makePatch(5),expected={exact:[0,0,1],stabilizer:[0,1,1],logical:[1,0,2],dressed:[1,1,2],invisible:[1,0,0],boundary:[0,1,0]};
let count=0;
function check(error){
  const decoded=M.decode(p,error);count++;
  assert.deepEqual(M.syndrome(p,decoded.correction),M.syndrome(p,error));
  assert.equal(decoded.result.verified,true);
  assert.deepEqual(M.xor(decoded.result.logical?p.logicalZ:[],...decoded.result.stabilizers.map(i=>p.faces[i].edges)),decoded.residual);
  // All partial peeling corrections must retain the correct residual syndrome.
  for(const frame of decoded.trace.frames.filter(f=>!f.micro)){
    assert.deepEqual(M.syndrome(p,M.xor(error,frame.correction)),frame.bits);
  }
  return decoded;
}
for(const e of M.examples(p)){
  const r=check(e.error);assert.deepEqual([r.result.logical,r.result.stabilizers.length,r.correction.length],expected[e.id]);
  const alternate=check(M.xor(e.error,p.logicalZ));
  assert.deepEqual(alternate.observed,r.observed);assert.deepEqual(alternate.correction,r.correction);assert.equal(alternate.result.logical,r.result.logical^1);
  for(const f of p.faces){const shifted=check(M.xor(e.error,f.edges));assert.deepEqual(shifted.observed,r.observed);assert.deepEqual(shifted.correction,r.correction);assert.equal(shifted.result.logical,r.result.logical);}
}
assert.equal(check([]).result.logical,0);
for(let a=0;a<p.n;a++){
  assert.equal(check([a]).result.logical,0,'all single-qubit errors recover');
  for(let b=a+1;b<p.n;b++)assert.equal(check([a,b]).result.logical,0,'all weight-2 errors recover at distance 5');
}
let seed=20260924;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
for(let i=0;i<80;i++)check(p.edges.filter(()=>random()<.1+(i%5)*.1).map(e=>e.id));
assert.equal(M.decompose(p,[p.edge('h',2,2)]).closed,false,'an open chain cannot be assigned a logical class');
console.log(`Passed: CSS commutation/ranks and X/Z distances 3, 5, 7, 9; ${count} decoder runs; every distance-5 error of weight ≤ 2; exact stabilizer witnesses; logical/stabilizer equivalence; per-frame residuals.`);
