/* Exact logical-class weight spectra for the canonical unrotated planar patch.
 * Supported geometry: __surfaceModel.makePatch(3) or makePatch(5), with the
 * canonical middle-column Xbar cut. This is a bounded teaching/reference solver,
 * not a scalable decoder or a calibrated confidence for circuit-level noise.
 *
 * A_b[w] counts ALL Z chains of weight w with the supplied measured syndrome
 * and absolute cut parity b. Each class contains exactly 2^(d(d-1)) chains.
 * Counts are exact integers <= 2^20; no actual error or UF trace is consulted.
 * posterior() assumes independent, identically distributed data-qubit Z errors
 * and perfect checks. Its referenceParity is the UF correction's cut parity;
 * matching that parity means CE is a stabilizer, regardless of its weight.
 */
(() => {
  'use strict';
  const MODEL='iid-z-perfect-syndrome';
  const METHOD='exact row-frontier weight-enumerator dynamic programming';

  function validatePatch(patch) {
    if(!patch || ![3,5].includes(patch.d)) throw new Error('Exact spectra support canonical planar patches of distance 3 or 5.');
    const d=patch.d,m=d*(d-1),n=d*d+(d-1)*(d-1);
    if(patch.n!==n || !Array.isArray(patch.nodes) || patch.nodes.length!==m+2*d || !Array.isArray(patch.edges) || patch.edges.length!==n) throw new Error('Invalid planar-patch geometry.');
    const node=(col,row)=>col===0?m+row:col===d?m+d+row:row*(d-1)+col-1;
    for(let row=0;row<d;row++) for(let col=0;col<=d;col++) {
      const id=node(col,row),v=patch.nodes[id];
      if(!v || v.id!==id || v.col!==col || v.row!==row || v.boundary!==(col===0||col===d)) throw new Error('Spectra require canonical planar-patch node ordering.');
    }
    const checkEdge=(id,kind,col,row,a,b)=>{
      const e=patch.edges[id];
      if(!e || e.id!==id || e.kind!==kind || e.col!==col || e.row!==row || !((e.a===a&&e.b===b)||(e.a===b&&e.b===a))) throw new Error('Spectra require canonical planar-patch edge ordering.');
    };
    for(let row=0;row<d;row++) for(let col=0;col<d;col++) checkEdge(row*d+col,'h',col,row,node(col,row),node(col+1,row));
    for(let row=0;row<d-1;row++) for(let col=1;col<d;col++) checkEdge(d*d+row*(d-1)+col-1,'v',col,row,node(col,row),node(col,row+1));
    const cut=Array.from({length:d},(_,row)=>row*d+Math.floor(d/2));
    if(!Array.isArray(patch.logicalX) || patch.logicalX.length!==d || new Set(patch.logicalX).size!==d || !cut.every(id=>patch.logicalX.includes(id))) throw new Error('Spectra require the canonical middle-column logical X cut.');
    return {d,m,n};
  }

  function spectrum(patch,bits) {
    const {d,m,n}=validatePatch(patch);
    if((!Array.isArray(bits)&&!ArrayBuffer.isView(bits)) || bits.length!==patch.nodes.length) throw new Error('Supply one binary syndrome entry per patch node.');
    const syndrome=Array.from(bits);
    if(syndrome.some(b=>b!==0&&b!==1) || syndrome.slice(m).some(Boolean)) throw new Error('Measured syndrome entries must be binary; virtual boundary entries must be zero.');
    const width=1<<(d-1),states=2*width,allH=(1<<d)-1;
    const pop=Array.from({length:1<<d},(_,value)=>{let count=0;for(;value;value&=value-1)count++;return count;});
    // h_0=0 fixes one of two horizontal solutions. The other complements all
    // d horizontal edges. At check j: h_(j-1) + h_j = s_j + up_j + down_j.
    const horizontal=Array.from({length:width},(_,check)=>{
      let h=0,bit=0;
      for(let col=1;col<d;col++){bit^=(check>>(col-1))&1;h|=bit<<col;}
      return h;
    });
    let polynomials=Array.from({length:states},()=>new Float64Array(n+1));
    polynomials[0][0]=1;
    let previousMax=0;
    for(let row=0;row<d;row++) {
      let rowSyndrome=0;
      for(let col=0;col<d-1;col++) rowSyndrome|=syndrome[row*(d-1)+col]<<col;
      const next=Array.from({length:states},()=>new Float64Array(n+1));
      const downLimit=row===d-1?1:width;
      for(let up=0;up<width;up++) for(let down=0;down<downLimit;down++) {
        const base=horizontal[rowSyndrome^up^down];
        for(const h of [base,base^allH]) {
          const added=pop[h]+pop[down],cross=(h>>Math.floor(d/2))&1;
          for(let parity=0;parity<2;parity++) {
            const source=polynomials[2*up+parity],target=next[2*down+(parity^cross)];
            for(let weight=0;weight<=previousMax;weight++) if(source[weight]) target[weight+added]+=source[weight];
          }
        }
      }
      previousMax+=d+(row===d-1?0:d-1);
      polynomials=next;
    }
    const totalPerSector=2**m;
    const sectors=[0,1].map(parity=>{
      const counts=Array.from(polynomials[parity]),total=counts.reduce((a,b)=>a+b,0);
      if(total!==totalPerSector || counts.some(c=>!Number.isSafeInteger(c)||c<0)) throw new Error('Exact spectrum failed its class-size invariant.');
      const minimumWeight=counts.findIndex(Boolean);
      return {parity,counts,total,minimumWeight,minimumCount:counts[minimumWeight]};
    });
    return {schemaVersion:1,model:MODEL,method:METHOD,d,n,syndrome,syndromeWeight:syndrome.reduce((a,b)=>a+b,0),totalPerSector,sectors};
  }

  function validateSpectrum(result) {
    if(!result || result.schemaVersion!==1 || result.model!==MODEL || ![3,5].includes(result.d) || result.n!==result.d**2+(result.d-1)**2 || result.totalPerSector!==2**(result.d*(result.d-1)) || !Array.isArray(result.sectors) || result.sectors.length!==2) throw new Error('Supply a supported exact logical-class spectrum.');
    const m=result.d*(result.d-1);
    if(!Array.isArray(result.syndrome) || result.syndrome.length!==m+2*result.d || Array.from(result.syndrome).some(b=>b!==0&&b!==1) || result.syndrome.slice(m).some(Boolean) || result.syndromeWeight!==result.syndrome.reduce((a,b)=>a+b,0)) throw new Error('Invalid spectrum syndrome.');
    for(let parity=0;parity<2;parity++) {
      const sector=result.sectors[parity];
      if(!sector || sector.parity!==parity || !Array.isArray(sector.counts) || sector.counts.length!==result.n+1 || Array.from(sector.counts).some(c=>!Number.isSafeInteger(c)||c<0) || sector.total!==result.totalPerSector || sector.counts.reduce((a,b)=>a+b,0)!==result.totalPerSector) throw new Error('Invalid exact spectrum counts.');
    }
  }

  // log(sum(exp(x))) avoids underflow when a rare observed syndrome has an
  // extremely small unconditional probability. Return null for true log(0),
  // so the result remains valid and unambiguous in exported JSON.
  function logSum(values) {
    if(!values.length) return null;
    const maximum=Math.max(...values);
    return maximum+Math.log(values.reduce((sum,value)=>sum+Math.exp(value-maximum),0));
  }

  // sector.logMass = ln P(syndrome, absolute parity), before normalization.
  // logLikelihoodRatio = ln P(UF succeeds | s) / P(UF fails | s).
  // Positive LLR favors the UF class. This is conditional model confidence,
  // never a claim that the known simulated error in this shot was corrected.
  function posterior(result,p,referenceParity) {
    validateSpectrum(result);
    if(!Number.isFinite(p) || p<0 || p>.5) throw new Error('Use an iid Z-error probability from 0 to 0.5.');
    if(referenceParity!==0&&referenceParity!==1) throw new Error('The reference correction parity must be 0 or 1.');
    const notes=[];
    if(p===0&&result.syndromeWeight>0) {
      return {available:false,p,referenceParity,sectors:[0,1].map(parity=>({parity,probability:null,logMass:null})),ufSuccessProbability:null,ufFailureProbability:null,logLikelihoodRatio:null,syndromeProbability:0,logSyndromeProbability:null,notes:['This nonzero syndrome has probability zero at p = 0, so conditioning on it is undefined. Null log masses represent log(0).']};
    }
    if(p===0) {
      return {available:true,p,referenceParity,sectors:[{parity:0,probability:1,logMass:0},{parity:1,probability:0,logMass:null}],ufSuccessProbability:referenceParity===0?1:0,ufFailureProbability:referenceParity===0?0:1,logLikelihoodRatio:null,syndromeProbability:1,logSyndromeProbability:0,notes:[`At p = 0 only the identity error occurs. The log-likelihood ratio is ${referenceParity===0?'positive':'negative'} infinity; it is exported as null. The null sector log mass represents log(0).`]};
    }
    if(p===.5) {
      const logSyndromeProbability=-result.d*(result.d-1)*Math.LN2;
      return {available:true,p,referenceParity,sectors:[0,1].map(parity=>({parity,probability:.5,logMass:logSyndromeProbability-Math.LN2})),ufSuccessProbability:.5,ufFailureProbability:.5,logLikelihoodRatio:0,syndromeProbability:2**(-result.d*(result.d-1)),logSyndromeProbability,notes:['At p = 0.5 every error chain is equally likely. The two logical classes have equal size and equal posterior probability.']};
    }
    const logP=Math.log(p),logQ=Math.log1p(-p);
    const masses=result.sectors.map(sector=>logSum(sector.counts.flatMap((count,weight)=>count?[Math.log(count)+weight*logP+(result.n-weight)*logQ]:[])));
    const logSyndromeProbability=logSum(masses);
    // Normalize by a two-term logistic expression. This retains the smaller
    // probability when the larger one rounds to one in floating-point output.
    const delta=masses[1]-masses[0],ratio=Math.exp(-Math.abs(delta));
    const smaller=ratio/(1+ratio),larger=1/(1+ratio);
    const probabilities=delta>=0?[smaller,larger]:[larger,smaller];
    const syndromeProbability=Math.exp(logSyndromeProbability);
    if(syndromeProbability===0) notes.push('The syndrome probability underflows floating-point output; its finite log probability is retained.');
    if(probabilities.some(value=>value===0)) notes.push('A positive class probability underflows floating-point output; finite log masses and the log-likelihood ratio are retained.');
    return {available:true,p,referenceParity,sectors:[0,1].map(parity=>({parity,probability:probabilities[parity],logMass:masses[parity]})),ufSuccessProbability:probabilities[referenceParity],ufFailureProbability:probabilities[referenceParity^1],logLikelihoodRatio:masses[referenceParity]-masses[referenceParity^1],syndromeProbability,logSyndromeProbability,notes};
  }

  globalThis.__surfaceConfidence={spectrum,posterior};
})();
