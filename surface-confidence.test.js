/* Run with: node surface-confidence.test.js
 * Independent enumerations test the complete spectra, including all weights.
 */
'use strict';
const assert=require('node:assert/strict');
require('./surface-model.js');require('./surface-confidence.js');
const M=globalThis.__surfaceModel,F=globalThis.__surfaceConfidence;
const pop32=value=>{value-=((value>>>1)&0x55555555);value=(value&0x33333333)+((value>>>2)&0x33333333);return (((value+(value>>>4))&0x0f0f0f0f)*0x01010101)>>>24;};
const near=(actual,expected,tolerance=1e-12)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} != ${expected}`);
const counts=n=>Array.from({length:2},()=>Array(n+1).fill(0));

// Enumerate every physical error independently, grouping by measured check
// incidence and cut intersection. This covers all 64 possible d=3 syndromes.
const p3=M.makePatch(3),bySyndrome=Array.from({length:64},()=>counts(p3.n));
const incidence=p3.edges.map(edge=>[edge.a,edge.b].reduce((bits,id)=>p3.nodes[id].boundary?bits:bits^(1<<id),0));
for(let error=0;error<2**p3.n;error++) {
  let syndrome=0,parity=0;
  for(let q=0;q<p3.n;q++) if(error&(1<<q)) {syndrome^=incidence[q];parity^=p3.logicalX.includes(q)?1:0;}
  bySyndrome[syndrome][parity][pop32(error)]++;
}
for(let mask=0;mask<64;mask++) {
  const bits=p3.nodes.map(node=>node.boundary?0:(mask>>node.id)&1),s=F.spectrum(p3,bits);
  assert.deepEqual(s.sectors.map(sector=>sector.counts),bySyndrome[mask]);
  for(const sector of s.sectors) assert.equal(sector.total,64);
  // A direct probability sum provides a separate numerical posterior check.
  for(const p of [.01,.1,.3]) {
    const masses=bySyndrome[mask].map(histogram=>histogram.reduce((sum,count,weight)=>sum+count*p**weight*(1-p)**(p3.n-weight),0));
    for(const reference of [0,1]) {
      const post=F.posterior(s,p,reference),total=masses[0]+masses[1];
      near(post.syndromeProbability,total);
      near(post.ufFailureProbability,masses[reference^1]/total);
      near(post.logLikelihoodRatio,Math.log(masses[reference]/masses[reference^1]));
    }
  }
}

const p5=M.makePatch(5);
for(const example of M.examples(p5)) {
  const syndrome=M.syndrome(p5,example.error),s=F.spectrum(p5,syndrome),reference=M.minimumCorrections(p5,syndrome);
  for(const sector of s.sectors) {
    assert.equal(sector.total,1048576);
    assert.equal(sector.minimumWeight,reference.sectors[sector.parity].weight);
    assert.equal(String(sector.minimumCount),reference.sectors[sector.parity].count);
  }
}

// Enumerate an entire d=5 affine stabilizer coset and its logical partner.
// Gray-code updates toggle one face per step. Two 32-bit words represent each
// 41-qubit chain; this enumerator shares no frontier recurrence with the solver.
const error=[7,10,12,14,19,37,40];
const words=ids=>ids.reduce(([low,high],q)=>q<32?[low^(1<<q),high]:[low,high^(1<<(q-32))],[0,0]);
const generators=p5.faces.map(face=>words(face.edges)),logical=words(p5.logicalZ);
let [low,high]=words(error);
const histograms=counts(p5.n),baseParity=error.filter(q=>p5.logicalX.includes(q)).length%2;
for(let i=0;i<2**p5.faces.length;i++) {
  if(i){const face=31-Math.clz32(i&-i);low^=generators[face][0];high^=generators[face][1];}
  histograms[baseParity][pop32(low)+pop32(high)]++;
  histograms[baseParity^1][pop32(low^logical[0])+pop32(high^logical[1])]++;
}
const full=F.spectrum(p5,M.syndrome(p5,error));
assert.deepEqual(full.sectors.map(sector=>sector.counts),histograms);
assert.ok(F.posterior(full,.1,1).ufFailureProbability<.5);
assert.ok(F.posterior(full,.15,1).ufFailureProbability>.5,'class likelihood reverses as higher-weight chains contribute');
for(const p of [.01,.1,.15,.3]) {
  const masses=histograms.map(histogram=>histogram.reduce((sum,count,weight)=>sum+count*p**weight*(1-p)**(p5.n-weight),0));
  near(F.posterior(full,p,1).ufFailureProbability,masses[0]/(masses[0]+masses[1]));
}

const zero=F.spectrum(p5,M.syndrome(p5,[])),nonzero=F.spectrum(p5,M.syndrome(p5,[12]));
for(const reference of [0,1]) {
  const absent=F.posterior(nonzero,0,reference);
  assert.equal(absent.available,false);assert.equal(absent.ufFailureProbability,null);assert.equal(absent.logLikelihoodRatio,null);
  const certain=F.posterior(zero,0,reference);
  assert.equal(certain.available,true);assert.equal(certain.ufFailureProbability,reference);assert.equal(certain.logLikelihoodRatio,null);
  for(const s of [zero,nonzero,full]) {
    const half=F.posterior(s,.5,reference);
    assert.deepEqual(half.sectors.map(sector=>sector.probability),[.5,.5]);
    assert.equal(half.ufFailureProbability,.5);assert.equal(half.logLikelihoodRatio,0);assert.equal(half.syndromeProbability,2**-20);
    for(const p of [Number.MIN_VALUE,1e-50,1e-10,.01,.2,.49999999999999994]) {
      const post=F.posterior(s,p,reference);
      near(post.sectors.reduce((total,sector)=>total+sector.probability,0),1);
      assert.ok(Number.isFinite(post.logLikelihoodRatio));
      assert.ok(Number.isFinite(post.logSyndromeProbability));
      const requireJsonSafe=value=>{
        if(typeof value==='number')assert.ok(Number.isFinite(value));
        else if(value&&typeof value==='object')Object.values(value).forEach(requireJsonSafe);
      };
      requireJsonSafe(post);
      assert.deepEqual(JSON.parse(JSON.stringify(post)),post);
    }
  }
}
// The most likely class can be affected by ALL weights, not only its shortest
// representatives. Its posterior must be unaffected by the unknown shot truth.
const same=M.xor(error,p5.logicalZ);
assert.deepEqual(F.spectrum(p5,M.syndrome(p5,same)),full);
const a=F.posterior(full,.1,0),b=F.posterior(full,.1,1);
near(a.ufFailureProbability+b.ufFailureProbability,1);near(a.logLikelihoodRatio,-b.logLikelihoodRatio);

assert.throws(()=>F.spectrum(M.makePatch(7),[]),/distance 3 or 5/);
assert.throws(()=>F.spectrum(p5,[]),/syndrome entry/);
assert.throws(()=>F.spectrum(p5,p5.nodes.map(()=>.5)),/binary/);
const invalidBoundary=p5.nodes.map(()=>0);invalidBoundary[20]=1;
assert.throws(()=>F.spectrum(p5,invalidBoundary),/boundary/);
assert.throws(()=>F.spectrum({...p5,logicalX:p5.logicalZ},zero.syndrome),/logical X cut/);
assert.throws(()=>F.spectrum({...p5,edges:p5.edges.slice().reverse()},zero.syndrome),/edge ordering/);
for(const p of [-1,.51,Infinity,NaN,'0.1']) assert.throws(()=>F.posterior(full,p,0),/probability/);
for(const parity of [-1,2,null,undefined]) assert.throws(()=>F.posterior(full,.1,parity),/parity/);
assert.throws(()=>F.posterior({...full,sectors:[]},.1,0),/spectrum/);
const invalidCounts=JSON.parse(JSON.stringify(full));invalidCounts.sectors[0].counts[0]++;
assert.throws(()=>F.posterior(invalidCounts,.1,0),/counts/);
console.log('Passed exact confidence: all 8,192 distance-3 errors and all 64 syndromes; distance-5 example minima and multiplicities; all 2,097,152 representatives of a complex distance-5 syndrome; iid posterior sums, endpoints, underflow, JSON safety, and input validation.');
