/* Independent checks of the research reference: node surface-reference.test.js */
'use strict';
const assert=require('node:assert/strict');
require('./model.js');require('./surface-model.js');
const M=globalThis.__surfaceModel;
const equal=(a,b)=>assert.deepEqual(a,b);
let oracleCases=0;
// Enumerate every physical correction on the 13-qubit distance-3 patch.
// Build all 64 syndrome tables, independently of the frontier recurrence.
const small=M.makePatch(3),checks=6;
for(const allowed of [small.edges.map(e=>e.id),small.edges.filter(e=>e.id%4!==1).map(e=>e.id),[]]){
  const allowedSet=new Set(allowed),oracle=Array.from({length:1<<checks},()=>[0,1].map(()=>({weight:null,count:'0'})));
  for(let mask=0;mask<1<<small.n;mask++){
    const support=small.edges.filter(e=>mask&(1<<e.id)).map(e=>e.id);if(support.some(id=>!allowedSet.has(id)))continue;
    const s=M.syndrome(small,support).slice(0,checks).reduce((v,b,i)=>v|(b<<i),0),parity=M.cutParity(small,support),entry=oracle[s][parity];
    if(entry.weight===null||support.length<entry.weight){entry.weight=support.length;entry.count='1';}
    else if(support.length===entry.weight)entry.count=String(Number(entry.count)+1);
  }
  for(let s=0;s<1<<checks;s++){
    const bits=small.nodes.map(v=>v.boundary?0:(s>>v.id)&1),actual=M.minimumCorrections(small,bits,allowed);
    actual.sectors.forEach((r,p)=>equal({weight:r.weight,count:r.count},oracle[s][p]));oracleCases++;
  }
}
// Enumerate both complete stabilizer cosets on distance 5 (2^20 each).
// Two 32-bit words and a Gray-code walk are independent of the row-frontier DP.
const p=M.makePatch(5),word=ids=>ids.reduce((v,id)=>{v[id<32?0:1]^=1<<(id%32);return v;},[0,0]);
const pop=x=>{x-=(x>>>1)&0x55555555;x=(x&0x33333333)+((x>>>2)&0x33333333);return (((x+(x>>>4))&0x0f0f0f0f)*0x01010101)>>>24;};
const generators=p.faces.map(f=>word(f.edges));
for(const id of ['growth-trap','forest-choice']){
  const E=M.examples(p).find(e=>e.id===id).error,d=M.decode(p,E),a=M.analyze(p,d),allowed=word(d.trace.fullEdges);
  for(const toggle of [0,1]){
    const start=M.xor(E,toggle?p.logicalZ:[]),parity=M.cutParity(p,start);let [lo,hi]=word(start),best=Infinity,count=0,restricted=Infinity,restrictedCount=0;
    for(let i=0;i<1<<p.faces.length;i++){
      if(i){const g=generators[31-Math.clz32(i&-i)];lo^=g[0];hi^=g[1];}
      const w=pop(lo)+pop(hi);
      if(w<best){best=w;count=1;}else if(w===best)count++;
      if((lo&~allowed[0])||(hi&~allowed[1]))continue;
      if(w<restricted){restricted=w;restrictedCount=1;}else if(w===restricted)restrictedCount++;
    }
    equal({weight:a.exact.sectors[parity].weight,count:a.exact.sectors[parity].count},{weight:best,count:String(count)});
    equal({weight:a.grown.sectors[parity].weight,count:a.grown.sectors[parity].count},{weight:Number.isFinite(restricted)?restricted:null,count:String(restrictedCount)});
  }
}
// Assert the actual mechanism advertised for every advanced case.
const runs=Object.fromEntries(M.examples(p).map(e=>{const d=M.decode(p,e.error);return[e.id,{d,a:M.analyze(p,d)}];}));
for(const {d,a}of Object.values(runs)){
  assert.ok(a.peelingExcess>=0&&a.growthPenalty>=0);
  assert.equal(a.grown.sectors[a.parity].weight!==null,true);
  for(const ref of a.exact.sectors){equal(M.syndrome(p,ref.correction),d.observed);assert.equal(M.decompose(p,M.xor(d.error,ref.correction)).logical,ref.parity^a.truth);}
  for(const ref of a.grown.sectors)if(ref.weight!==null)assert.ok(ref.correction.every(q=>d.trace.fullEdges.includes(q)));
  for(const v of a.variants){equal(M.syndrome(p,v.correction),d.observed);assert.equal(M.decompose(p,v.residual).logical,v.logical);}
}
assert.equal(runs['two-strings'].d.result.logical,0);assert.equal(runs['two-strings'].d.residual.length,10);
assert.equal(runs['three-strings'].d.result.logical,1);assert.equal(runs['three-strings'].d.result.cutCrossings.length,3);
assert.equal(runs.islands.d.error.length,17);assert.equal(runs.islands.d.result.logical,0);
assert.ok(runs.reactivation.a.reactivations>0);assert.equal(runs.reactivation.a.peelingExcess,2);
assert.equal(runs['forest-choice'].a.gap,0);equal(runs['forest-choice'].a.variants.map(v=>v.logical),[1,1,0]);
assert.equal(runs['growth-trap'].a.correctClassInGrowth,false);assert.equal(runs['growth-trap'].a.gap,-1);
equal(runs['growth-trap'].a.variants.map(v=>v.logical),[1,1,1]);
assert.equal(runs['uf-wins'].d.result.logical,0);assert.ok(runs['uf-wins'].a.gap<0);
equal(runs.dense.a.exact.sectors.map(x=>x.count),['16','4']);
for(const distance of [3,5,7,9]){
  const patch=M.makePatch(distance),E=M.sample(patch,{seed:89,mode:'fixed',weight:distance}),s=M.syndrome(patch,E),r=M.minimumCorrections(patch,s);
  for(const ref of r.sectors){equal(M.syndrome(patch,ref.correction),s);assert.equal(M.cutParity(patch,ref.correction),ref.parity);}
  equal(M.sample(patch,{seed:42,mode:'iid',p:.2}),M.sample(patch,{seed:42,mode:'iid',p:.2}));
  assert.equal(M.sample(patch,{seed:0,mode:'fixed',weight:patch.n}).length,patch.n);
  equal(M.sample(patch,{seed:0,mode:'iid',p:0}),[]);
  assert.equal(M.sample(patch,{seed:0,mode:'iid',p:1}).length,patch.n);
}
equal(M.sample(p,{seed:89,mode:'fixed',weight:7}),runs['growth-trap'].d.error);
assert.throws(()=>M.sample(p,{seed:-1}));assert.throws(()=>M.sample(p,{seed:1,mode:'fixed',weight:42}));
console.log(`Passed: all ${oracleCases} distance-3 syndrome/support problems; exhaustive 4,194,304 distance-5 coset representatives and restricted minima; 15 case mechanisms; three forests; deterministic sampling; reference witnesses through distance 9.`);
