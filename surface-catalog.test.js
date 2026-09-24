/* Catalog regression checks: independently form incidence/cut/witness bitmasks,
 * check the documented pair constructions, and reproduce the published data.
 * This is a curated regression corpus, not a logical-error-rate experiment. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
require('./model.js');
require('./surface-model.js');
require('./surface-confidence.js');
require('./surface-catalog.js');
const M=globalThis.__surfaceModel,C=globalThis.__surfaceCatalog;
const patch=M.makePatch(5),examples=M.examples(patch);
const fixtures=JSON.parse(fs.readFileSync(path.join(__dirname,'surface-cases.json'),'utf8'));
const stored=JSON.parse(fs.readFileSync(path.join(__dirname,'catalog-reference.json'),'utf8'));
const stableIds=['exact','stabilizer','logical','dressed','invisible','boundary','independent','two-strings','three-strings','islands','reactivation','forest-choice','growth-trap','uf-wins','dense','likelihood-crossover','likelihood-companion','perturb-before','perturb-after','all-checks','boundary-fronts','delayed-reactivation','equal-weight-success','equal-weight-failure',
  ...Array.from({length:20},(_,i)=>`growth-${i+25}`),...Array.from({length:20},(_,i)=>`likelihood-${i+45}`),...Array.from({length:20},(_,i)=>`perturbation-${i+65}`),...Array.from({length:16},(_,i)=>`topology-${i+85}`)];
assert.equal(examples.length,100,'The catalog must contain exactly 100 cases.');
assert.equal(fixtures.length,76,'The 24 original cases must have 76 additions.');
assert.deepEqual(examples.map(e=>e.id),stableIds,'Case URLs and number order are stable.');
assert.deepEqual(fixtures.map(e=>e.number),Array.from({length:76},(_,i)=>i+25));
assert.equal(new Set(examples.map(e=>e.id)).size,100);

const bit=q=>1n<<BigInt(q);
const mask=ids=>ids.reduce((m,q)=>m^bit(q),0n);
const ids=m=>Array.from({length:41},(_,q)=>q).filter(q=>(m&bit(q))!==0n);
const h=(row,col)=>row*5+col;
const v=(row,col)=>25+row*4+col-1;
const check=(row,col)=>row*4+col-1;
const incidence=Array.from({length:41},(_,q)=>{
  let m=0n;
  if(q<25){const row=Math.floor(q/5),col=q%5;if(col>0)m^=bit(check(row,col));if(col<4)m^=bit(check(row,col+1));}
  else {const row=Math.floor((q-25)/4),col=(q-25)%4+1;m=bit(check(row,col))^bit(check(row+1,col));}
  return m;
});
const syndrome=m=>ids(m).reduce((s,q)=>s^incidence[q],0n);
const cut=mask([2,7,12,17,22]);
const logicalZ=mask([10,11,12,13,14]);
const parity=m=>{let n=0;for(let r=m&cut;r;r&=r-1n)n^=1;return n;};
const faceMasks=Array.from({length:20},(_,i)=>{const row=Math.floor(i/5),col=i%5;let m=bit(h(row,col))^bit(h(row+1,col));if(col>0)m^=bit(v(row,col));if(col<4)m^=bit(v(row,col+1));return m;});
const witness=(logical,stabilizers)=>stabilizers.reduce((m,i)=>{assert(Number.isInteger(i)&&i>=0&&i<20);return m^faceMasks[i];},logical?logicalZ:0n);
const observedMask=bits=>bits.reduce((m,b,i)=>{assert(b===0||b===1);return b?m^bit(i):m;},0n);
const eqClose=(a,b,label)=>assert(Math.abs(a-b)<=1e-12,`${label}: ${a} versus ${b}`);
const validateSupport=(support,label)=>{assert(Array.isArray(support),label);assert.deepEqual(support,[...new Set(support)].sort((a,b)=>a-b),`${label}: canonical support`);assert(support.every(q=>Number.isInteger(q)&&q>=0&&q<41),label);};
for(const face of faceMasks){assert.equal(syndrome(face),0n);assert.equal(parity(face),0);}
assert.equal(syndrome(logicalZ),0n);assert.equal(parity(logicalZ),1);
for(const example of examples){validateSupport(example.error,example.id);assert(example.name.startsWith(`${stableIds.indexOf(example.id)+1} · `));}
assert.equal(new Set(examples.map(e=>mask(e.error).toString())).size,100,'Every support is distinct.');

const rebuilt=C.build(patch,examples);
assert.deepEqual(stored,rebuilt,'catalog-reference.json is stale; run node build_catalog.js.');
assert.equal(stored.summary.cases,100);assert.equal(stored.summary.uniqueErrors,100);
const records=new Map(stored.cases.map(r=>[r.id,r]));
const source=new Map(examples.map(e=>[e.id,e]));
const traces=new Map();let decoded=0,expectedChecks=0,seedChecks=0,pairChecks=0;
for(const record of stored.cases){
  const E=mask(record.error),s=syndrome(E);
  assert.equal(observedMask(record.syndrome),s,`${record.id}: independent syndrome`);
  assert.equal(record.errorKey,E.toString(16).padStart(11,'0'));
  assert.equal(record.syndromeKey,s.toString(16).padStart(5,'0'));
  const variants=new Map();
  for(const strategy of ['bfs','reverse-bfs','dfs']){
    const data=M.decode(patch,record.error,strategy),correction=mask(data.correction),residual=E^correction;
    const exported=record.forests.find(f=>f.strategy===strategy);
    assert.equal(observedMask(data.observed),s,`${record.id}/${strategy}: input incidence`);
    assert.equal(syndrome(correction),s,`${record.id}/${strategy}: correction incidence`);
    assert.equal(syndrome(residual),0n,`${record.id}/${strategy}: closed residual`);
    assert.equal(mask(data.residual),residual);
    assert.equal(data.result.logical,parity(residual),`${record.id}/${strategy}: independent cut parity`);
    assert.equal(witness(data.result.logical,data.result.stabilizers),residual,`${record.id}/${strategy}: reconstructed residual`);
    assert.equal(exported.logical,parity(residual));assert.equal(exported.parity,parity(correction));
    assert.deepEqual(exported.correction,data.correction);assert.deepEqual(exported.residual,data.residual);
    assert.deepEqual(data.trace.fullEdges,record.fullyGrownEdges,'Changing the forest must preserve growth.');
    assert.equal(correction&~mask(record.fullyGrownEdges),0n,'Every selected edge must be fully grown.');
    variants.set(strategy,data);decoded++;
  }
  traces.set(record.id,variants);
  assert.equal(record.metrics.forestSensitive,new Set([...variants.values()].map(d=>d.result.logical)).size>1);
  assert.equal(witness(record.bfs.logical,record.bfs.stabilizers),mask(record.bfs.residual));
  for(const minimum of record.minimumClasses){
    const spectrum=record.weightSpectrum.find(s=>s.parity===minimum.parity);
    assert.equal(spectrum.counts.length,42);assert(spectrum.counts.every(n=>Number.isSafeInteger(n)&&n>=0));
    assert.equal(spectrum.counts.reduce((a,b)=>a+b,0),2**20);
    assert.equal(Number(spectrum.total),2**20);
    assert.equal(spectrum.counts.findIndex(n=>n>0),minimum.weight);
    assert.equal(String(spectrum.counts[minimum.weight]),minimum.count);
    assert.equal(syndrome(mask(minimum.correction)),s);assert.equal(parity(mask(minimum.correction)),minimum.parity);
    assert.equal(minimum.correction.length,minimum.weight);
  }
  for(const minimum of record.grownClasses){
    if(minimum.weight===null){assert.equal(minimum.count,'0');assert.deepEqual(minimum.correction,[]);continue;}
    assert.equal(syndrome(mask(minimum.correction)),s);assert.equal(parity(mask(minimum.correction)),minimum.parity);
    assert.equal(mask(minimum.correction)&~mask(record.fullyGrownEdges),0n);assert.equal(minimum.correction.length,minimum.weight);
  }
  for(const probability of record.conditionalFailure){
    const p=probability.p,masses=record.weightSpectrum.map(sector=>sector.counts.reduce((sum,n,k)=>sum+n*p**k*(1-p)**(41-k),0));
    eqClose(probability.failure,masses[record.bfs.parity^1]/(masses[0]+masses[1]),`${record.id}: independently summed posterior`);
  }
}

const expectedRates={pFailure01:.01,pFailure05:.05,pFailure10:.10,pFailure15:.15};
for(const fixture of fixtures){
  const record=records.get(fixture.id);assert(record);
  assert(fixture.provenance?.method&&fixture.provenance?.criterion,`${fixture.id}: documented selection`);
  assert(fixture.tags?.length,`${fixture.id}: mechanism tags`);
  for(const [key,value] of Object.entries(fixture.expected)){
    if(key in record.metrics)assert.deepEqual(record.metrics[key],value,`${fixture.id}: ${key}`);
    else if(key in expectedRates)eqClose(record.conditionalFailure.find(p=>p.p===expectedRates[key]).failure,value,`${fixture.id}: ${key}`);
    else if(key==='correction')assert.deepEqual(record.bfs.correction,value);
    else if(key==='stabilizers')assert.deepEqual(record.bfs.stabilizers,value);
    else if(key==='residualWitness'){assert.equal(value.logical,record.bfs.logical);assert.equal(witness(value.logical,value.stabilizers),mask(record.bfs.residual));}
    else if(key==='forests'||key==='forestOutcomes')for(const expected of value){const actual=record.forests.find(f=>f.strategy===expected.strategy);assert.equal(actual.logical,expected.logical);assert.equal(actual.correction.length,expected.weight??expected.correctionWeight);}
    else assert.fail(`Unhandled expected field ${fixture.id}.${key}`);
    expectedChecks++;
  }
}

// BigInt LCG arithmetic independently reproduces the documented seeded inputs.
function seededFixed(seed,weight){
  let state=BigInt(seed),remaining=Array.from({length:41},(_,i)=>i);
  for(let i=40;i>0;i--){state=(1664525n*state+1013904223n)&0xffffffffn;const j=Math.floor(Number(state)*((i+1)/4294967296));[remaining[i],remaining[j]]=[remaining[j],remaining[i]];}
  return remaining.slice(0,weight).sort((a,b)=>a-b);
}
for(const fixture of fixtures){
  const provenance=fixture.provenance;
  assert(Number.isInteger(provenance.seed)&&provenance.seed>=0&&provenance.seed<=0xffffffff);
  if(provenance.baseErrorWeight!==undefined){
    const base=source.get(fixture.pair.base);assert(base);
    assert.deepEqual(seededFixed(provenance.seed,provenance.baseErrorWeight),base.error,`${fixture.id}: constructed base seed`);
  }else{
    const weight=provenance.weight??Number(provenance.criterion.match(/Fixed-weight sample of (\d+) errors/)?.[1]);
    assert(Number.isInteger(weight),`${fixture.id}: reproducible sample weight`);
    const sampled=mask(seededFixed(provenance.seed,weight))^mask(provenance.toggledQubits??[]);
    assert.equal(sampled,mask(fixture.error),`${fixture.id}: seeded support`);
  }
  seedChecks++;
}

function transform(support,relation){
  const flipX=relation==='horizontal-reflection'||relation==='rotation-180',flipY=relation==='vertical-reflection'||relation==='rotation-180';
  return support.map(q=>{
    if(q<25){let row=Math.floor(q/5),col=q%5;if(flipY)row=4-row;if(flipX)col=4-col;return h(row,col);}
    let row=Math.floor((q-25)/4),col=(q-25)%4+1;if(flipY)row=3-row;if(flipX)col=5-col;return v(row,col);
  }).sort((a,b)=>a-b);
}
const visitedPairs=new Set();
for(const example of examples){
  if(!example.partner)continue;
  const partner=source.get(example.partner);assert(partner,`${example.id}: partner exists`);
  assert.equal(partner.partner,example.id,`${example.id}: reciprocal partner`);assert(example.partnerNote?.length);
  const key=[example.id,partner.id].sort().join(':');if(visitedPairs.has(key))continue;visitedPairs.add(key);
  const meta=example.pair??partner.pair;
  const a=records.get(meta?.base??example.id),b=records.get(meta?.transformed??partner.id);
  const deltaE=mask(a.error)^mask(b.error),deltaC=mask(a.bfs.correction)^mask(b.bfs.correction),deltaR=deltaE^deltaC;
  assert.equal(syndrome(deltaR),0n);assert.equal(parity(deltaR),a.bfs.logical^b.bfs.logical);
  if(meta){
    assert.deepEqual(example.pair,partner.pair,`${example.id}: paired metadata`);
    if(meta.relation==='single-qubit'){
      assert.equal(deltaE,bit(meta.qubit));assert.equal(ids(deltaC).length,meta.changedCorrection);
      assert.deepEqual(ids(deltaC),meta.changedCorrectionEdges);assert.deepEqual(ids(deltaR),meta.residualChange);
    }else if(['logical','stabilizer'].includes(meta.relation)){
      assert.equal(deltaE,mask(meta.support));assert.equal(deltaE,witness(meta.logical,meta.stabilizers));
      assert.equal(syndrome(deltaE),0n);assert.equal(parity(deltaE),meta.logical);
      assert.equal(meta.syndromeUnchanged,true);assert.deepEqual(a.weightSpectrum,b.weightSpectrum);
      for(const strategy of ['bfs','reverse-bfs','dfs']){
        const da=traces.get(a.id).get(strategy),db=traces.get(b.id).get(strategy);
        assert.deepEqual(da.correction,db.correction);assert.deepEqual(da.trace.frames,db.trace.frames);
        assert.equal(da.result.logical^db.result.logical,meta.logical);
      }
    }else if(meta.relation==='complement'){
      assert.equal(deltaE,(1n<<41n)-1n);assert.equal(deltaE,mask(meta.support));
      assert.equal(a.error.length+b.error.length,41);assert.equal(parity(deltaE),meta.classParityDifference);
      assert.equal(syndrome(deltaE),mask(meta.syndromeDifference));assert.deepEqual(meta.syndromeDifference,[0,1,2,3,16,17,18,19]);
      for(let parity=0;parity<2;parity++)for(let k=0;k<=41;k++)assert.equal(a.weightSpectrum[parity].counts[k],b.weightSpectrum[parity^1].counts[41-k]);
    }else if(['horizontal-reflection','vertical-reflection','rotation-180'].includes(meta.relation)){
      assert.deepEqual(transform(a.error,meta.relation),b.error);assert.equal(meta.boundaryTypesPreserved,true);
      assert.deepEqual(a.weightSpectrum,b.weightSpectrum);assert.equal(meta.grownSupportEquivariant,true);
      for(const strategy of ['bfs','reverse-bfs','dfs']){
        const da=traces.get(a.id).get(strategy),db=traces.get(b.id).get(strategy);
        assert.deepEqual(transform(da.trace.fullEdges,meta.relation),[...db.trace.fullEdges].sort((a,b)=>a-b));
        const difference=mask(transform(da.correction,meta.relation))^mask(db.correction);
        assert.equal(syndrome(difference),0n);assert.equal(parity(difference),da.result.logical^db.result.logical);
        if(strategy==='bfs'){
          assert.equal(difference,mask(meta.defaultCorrectionDifference));assert.equal(parity(difference),meta.defaultDifferenceLogical);
          assert.equal(difference,witness(meta.defaultDifferenceLogical,meta.defaultDifferenceStabilizers));
        }
      }
    }else assert.fail(`Unhandled paired relation ${meta.relation}`);
  }else if(key==='likelihood-63:likelihood-64'){
    for(const metric of ['errorWeight','correctionWeight','defects'])assert.equal(a.metrics[metric],b.metrics[metric]);
    for(const relative of [0,1]){
      const ma=a.minimumClasses[a.bfs.parity^relative],mb=b.minimumClasses[b.bfs.parity^relative];
      assert.equal(ma.weight,mb.weight);assert.equal(ma.count,mb.count);
    }
    const pa=a.conditionalFailure.find(v=>v.p===.10).failure,pb=b.conditionalFailure.find(v=>v.p===.10).failure;
    assert(Math.abs(pa-pb)>.22);assert.notEqual(a.syndromeKey,b.syndromeKey);
  }else if(key==='perturb-after:perturb-before')assert.equal(deltaE,bit(16));
  else {
    assert(['likelihood-companion:likelihood-crossover','equal-weight-failure:equal-weight-success'].includes(key),`Undocumented partner ${key}`);
    assert.deepEqual(a.syndrome,b.syndrome);assert.deepEqual(a.bfs.correction,b.bfs.correction);assert.equal(a.bfs.logical^b.bfs.logical,1);
    if(key.startsWith('equal-weight'))assert.equal(a.error.length,b.error.length);
  }
  pairChecks++;
}
assert.equal(stored.summary.pairedStudies,visitedPairs.size);

// RFC-style quoted fields: commas, quotes and embedded newlines must round-trip.
function parseCsv(text){
  const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else quoted=false;}else cell+=c;}
    else if(c==='"'){assert.equal(cell,'');quoted=true;}
    else if(c===','){row.push(cell);cell='';}
    else if(c==='\r'||c==='\n'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);rows.push(row);row=[];cell='';}
    else cell+=c;
  }
  assert(!quoted,'CSV contains an unterminated quoted cell.');if(cell!==''||row.length){row.push(cell);rows.push(row);}return rows;
}
const csv=parseCsv(C.csv(stored.cases)),header=csv[0];assert.equal(csv.length,101);assert.equal(new Set(header).size,header.length);
for(let i=1;i<csv.length;i++){
  const row=csv[i],r=stored.cases[i-1];assert.equal(row.length,header.length);const cell=name=>row[header.indexOf(name)];
  assert.equal(cell('case_id'),r.id);assert.equal(cell('number'),String(i));assert.equal(cell('error_key'),r.errorKey);
  assert.equal(cell('logical'),String(r.bfs.logical));assert.equal(cell('signed_gap'),String(r.metrics.gap));
  assert.equal(cell('selection_criterion'),r.provenance.criterion);
}
const quotedName='Study "A", first line\r\nsecond line';
const synthetic={...stored.cases[0],name:quotedName,provenance:{method:'+formula',criterion:'=1+1'}};
const escaped=parseCsv(C.csv([synthetic]));assert.equal(escaped.length,2);
assert.equal(escaped[1][header.indexOf('name')],quotedName);
assert.equal(escaped[1][header.indexOf('selection_method')],"'+formula");
assert.equal(escaped[1][header.indexOf('selection_criterion')],"'=1+1");
console.log(`Catalog verified: 100 unique cases, ${decoded} independent incidence/cut/witness checks, ${expectedChecks} expected fields, ${seedChecks} seeded constructions, ${pairChecks} paired studies, exact spectrum totals/minima/posteriors, deterministic dataset, and 100 CSV records.`);
