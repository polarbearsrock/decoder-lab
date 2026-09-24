/* Reproducible case records. Computation uses only the shared mathematical
 * modules; the browser reads the verified build artifact for fast filtering.
 */
(() => {
  'use strict';
  const version='2026-09-24.200';
  const rates=[.01,.05,.10,.15];
  const errorKey=ids=>ids.reduce((mask,id)=>mask|(1n<<BigInt(id)),0n).toString(16).padStart(11,'0');
  const syndromeKey=bits=>bits.slice(0,20).reduce((mask,bit,i)=>mask|(bit<<i),0).toString(16).padStart(5,'0');
  // Canonical geometry under the four symmetries preserving boundary types.
  // Rotations by 90 degrees exchange rough/smooth boundaries and are excluded.
  function syndromeOrbitKey(bits){
    const keys=[];
    for(const flipRows of [false,true])for(const flipColumns of [false,true]){
      let key=0;
      for(let row=0;row<5;row++)for(let col=0;col<4;col++)if(bits[row*4+col])key|=1<<((flipRows?4-row:row)*4+(flipColumns?3-col:col));
      keys.push(key);
    }
    return Math.min(...keys).toString(16).padStart(5,'0');
  }
  function summarize(patch,example,number){
    const M=globalThis.__surfaceModel,F=globalThis.__surfaceConfidence;
    const data=M.decode(patch,example.error,'bfs'),a=M.analyze(patch,data,'bfs'),s=F.spectrum(patch,data.observed);
    const probabilities=rates.map(p=>({p,failure:F.posterior(s,p,a.parity).ufFailureProbability}));
    const forestSensitive=new Set(a.variants.map(v=>v.logical)).size>1;
    const tags=new Set(example.tags||[]);
    if(!a.correctClassInGrowth)tags.add('growth-trap');
    if(forestSensitive)tags.add('forest-sensitive');
    if(a.peelingExcess>0)tags.add('peeling-overhead');
    if(a.growthPenalty>0)tags.add('growth-penalty');
    if(a.gap===0)tags.add('tied-minima');
    if(a.reactivations)tags.add('reactivation');
    if(example.partner)tags.add('paired-study');
    if(data.observed.filter(Boolean).length===0)tags.add('zero-syndrome');
    if(probabilities.some(v=>v.failure>.5+1e-10)&&probabilities.some(v=>v.failure<.5-1e-10))tags.add('prior-reversal');
    if(probabilities.some(v=>(a.gap>0&&v.failure>.5+1e-10)||(a.gap<0&&v.failure<.5-1e-10)))tags.add('weight-likelihood-conflict');
    if(data.result.logical&&probabilities[0].failure<.1)tags.add('confident-failure');
    return {
      id:example.id,number,name:example.name,title:example.title,note:example.note,group:example.group,
      tags:[...tags].sort(),partner:example.partner||null,partnerNote:example.partnerNote||null,pair:example.pair||null,
      provenance:example.provenance||{method:'worked construction',criterion:example.title},
      errorKey:errorKey(data.error),syndromeKey:syndromeKey(data.observed),syndromeOrbitKey:syndromeOrbitKey(data.observed),study:example.study||null,error:data.error,syndrome:data.observed.slice(0,20),
      metrics:{errorWeight:data.error.length,defects:data.observed.filter(Boolean).length,correctionWeight:data.correction.length,
        residualWeight:data.residual.length,logical:data.result.logical,rounds:a.rounds,reactivations:a.reactivations,
        gap:a.gap,peelingExcess:a.peelingExcess,growthPenalty:a.growthPenalty,correctClassInGrowth:a.correctClassInGrowth,
        forestSensitive,unions:a.unions,grownEdges:data.trace.fullEdges.length},
      bfs:{correction:data.correction,residual:data.residual,logical:data.result.logical,parity:a.parity,stabilizers:data.result.stabilizers},
      forests:a.variants,minimumClasses:a.exact.sectors,grownClasses:a.grown.sectors,fullyGrownEdges:data.trace.fullEdges,
      conditionalFailure:probabilities,weightSpectrum:s.sectors.map(sector=>({parity:sector.parity,counts:sector.counts,total:sector.total}))
    };
  }
  function build(patch,examples){
    if(patch.d!==5)throw new Error('The research catalog is defined on the distance-5 patch.');
    const records=examples.map((example,i)=>summarize(patch,example,i+1));
    const groups=[...new Set(records.map(r=>r.group))];
    const pairs=new Set(records.filter(r=>r.partner).map(r=>[r.id,r.partner].sort().join(':')));
    return {format:'decoder-lab.catalog.v1',catalogVersion:version,
      model:{distance:5,dataQubits:41,checks:20,logicalQubits:1,noise:'Z only; perfect syndrome; one round',growth:'uniform unit edges',defaultForest:'bfs'},
      selection:'Curated, mechanism-selected regression cases. Frequencies and success fractions in this catalog do not estimate logical error rates or comparative decoder performance.',
      convention:'Qubits and stabilizer indices are zero-based. Displayed S_i uses index+1. Class parity is intersection with the fixed logical-X cut. Gap is opposite-class minimum minus BFS-class minimum. All operator products are symmetric differences. Reactivations counts merge batches containing an even-to-odd cluster transition; it does not count clusters paused for a full tick.',
      geometry:{qubits:patch.edges,checks:patch.nodes.filter(n=>!n.boundary),stabilizers:patch.faces,logicalZ:patch.logicalZ,logicalX:patch.logicalX},
      distinctness:'Cases 101–200 each introduce a syndrome geometry absent from cases 1–100 and the other additions, modulo left/right reflection, top/bottom reflection, and half-turn. The earlier catalog retains deliberate same-syndrome and symmetry pairs. syndromeOrbitKey is the minimum 20-bit check mask under those four maps.',
      summary:{cases:records.length,uniqueErrors:new Set(records.map(r=>r.errorKey)).size,uniqueSyndromes:new Set(records.map(r=>r.syndromeKey)).size,uniqueSyndromeOrbits:new Set(records.map(r=>r.syndromeOrbitKey)).size,pairedStudies:pairs.size,groups:groups.length},
      cases:records};
  }
  function csv(records){
    const header=['catalog_version','case_id','number','name','group','tags','error_key','syndrome_key','error_qubits','syndrome_bits','bfs_correction','bfs_residual','logical','error_weight','defects','correction_weight','residual_weight','growth_rounds','reactivations','signed_gap','peeling_excess','growth_penalty','successful_class_in_growth','forest_sensitive','bfs_class_parity','min_weight_parity0','min_count_parity0','min_weight_parity1','min_count_parity1','pfail_p001','pfail_p005','pfail_p010','pfail_p015','partner','selection_method','selection_criterion','syndrome_orbit_key','study_kind'];
    const cell=value=>{let text=String(value??'');if(/^[=+@\t\r]/.test(text))text="'"+text;return '"'+text.replace(/"/g,'""')+'"';};
    const rows=records.map(r=>{const m=r.metrics;return [version,r.id,r.number,r.name,r.group,r.tags.join(';'),r.errorKey,r.syndromeKey,r.error.join(';'),r.syndrome.join(''),r.bfs.correction.join(';'),r.bfs.residual.join(';'),m.logical,m.errorWeight,m.defects,m.correctionWeight,m.residualWeight,m.rounds,m.reactivations,m.gap,m.peelingExcess,m.growthPenalty,m.correctClassInGrowth,m.forestSensitive,r.bfs.parity,...r.minimumClasses.flatMap(c=>[c.weight,c.count]),...r.conditionalFailure.map(p=>p.failure),r.partner,r.provenance.method,r.provenance.criterion,r.syndromeOrbitKey,r.study?.kind];});
    return [header,...rows].map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n';
  }
  const api={version,rates,errorKey,syndromeKey,syndromeOrbitKey,summarize,build,csv};
  globalThis.__surfaceCatalog=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})();
