/* A planar CSS surface code, with qubits on edges and perfect X checks.
 * Horizontal Z strings end on the left/right rough boundaries.
 * n = d^2 + (d-1)^2, rank(H_X) = rank(H_Z) = d(d-1), k = 1.
 * The decoder receives only the measured syndrome, never the actual error.
 */
(() => {
  'use strict';
  const xor = (...sets) => {
    const result = new Set();
    for (const values of sets) for (const value of values) {
      if (result.has(value)) result.delete(value); else result.add(value);
    }
    return [...result].sort((a,b) => a-b);
  };
  const mask = ids => ids.reduce((bits,id) => bits ^ (1n << BigInt(id)),0n);

  function makePatch(d = 5) {
    if (!Number.isInteger(d) || d < 3 || d > 9 || d % 2 === 0) throw new Error('Use an odd distance from 3 to 9.');
    const nodes=[], edges=[], faces=[], nodeIds=new Map(), edgeIds=new Map();
    const addNode=(col,row,boundary) => {
      const id=nodes.length;
      nodes.push({id,col,row,boundary,syndrome:0,label:'',name:boundary?`${col===0?'Left':'Right'} boundary ${row+1}`:`X check ${id+1}`});
      nodeIds.set(`${col},${row}`,id);
    };
    for(let row=0;row<d;row++) for(let col=1;col<d;col++) addNode(col,row,false);
    for(const col of [0,d]) for(let row=0;row<d;row++) addNode(col,row,true);
    const addEdge=(kind,col,row,a,b) => {
      const id=edges.length;
      edges.push({id,kind,col,row,a:nodeIds.get(a),b:nodeIds.get(b)});
      edgeIds.set(`${kind}${col},${row}`,id);
    };
    for(let row=0;row<d;row++) for(let col=0;col<d;col++) addEdge('h',col,row,`${col},${row}`,`${col+1},${row}`);
    for(let row=0;row<d-1;row++) for(let col=1;col<d;col++) addEdge('v',col,row,`${col},${row}`,`${col},${row+1}`);
    const edge=(kind,col,row) => {
      const id=edgeIds.get(`${kind}${col},${row}`);
      if(id===undefined) throw new Error('Edge outside this patch.');
      return id;
    };
    for(let row=0;row<d-1;row++) for(let col=0;col<d;col++) {
      const ids=[edge('h',col,row),edge('h',col,row+1)];
      if(col>0) ids.push(edge('v',col,row));
      if(col<d-1) ids.push(edge('v',col+1,row));
      faces.push({id:faces.length,col,row,edges:ids.sort((a,b)=>a-b)});
    }
    const middle=Math.floor(d/2);
    const logicalZ=Array.from({length:d},(_,col)=>edge('h',col,middle));
    const logicalX=Array.from({length:d},(_,row)=>edge('h',middle,row));
    return {d,n:edges.length,nodes,edges,faces,logicalZ,logicalX,edge,key:'surface',cols:d,rows:d,preset:{boundary:true,name:'Planar surface code'}};
  }

  function syndrome(patch,chain) {
    const bits=patch.nodes.map(()=>0);
    for(const id of chain) {
      const e=patch.edges[id];
      if(!e) throw new Error('Invalid data qubit.');
      if(!patch.nodes[e.a].boundary) bits[e.a]^=1;
      if(!patch.nodes[e.b].boundary) bits[e.b]^=1;
    }
    return bits;
  }

  function decompose(patch,chain) {
    const violations=syndrome(patch,chain).reduce((a,b)=>a+b,0);
    if(violations) return {closed:false,violations,logical:null,stabilizers:[],verified:false};
    // Solve chain = sum_i a_i S_i + ell * Zbar over GF(2), retaining witnesses.
    const basis=new Map(), generators=[...patch.faces.map(f=>f.edges),patch.logicalZ];
    for(let i=0;i<generators.length;i++) {
      let vector=mask(generators[i]), combination=1n<<BigInt(i);
      for(let pivot=patch.n-1;pivot>=0;pivot--) {
        if(!(vector&(1n<<BigInt(pivot)))) continue;
        if(basis.has(pivot)) {
          const row=basis.get(pivot);vector^=row.vector;combination^=row.combination;
        } else {basis.set(pivot,{vector,combination});break;}
      }
      if(!vector) throw new Error('Dependent stabilizer/logical generators.');
    }
    let rest=mask(chain), witness=0n;
    for(let pivot=patch.n-1;pivot>=0;pivot--) {
      if(!(rest&(1n<<BigInt(pivot)))) continue;
      const row=basis.get(pivot);
      if(!row) throw new Error('Zero-syndrome chain outside the code normalizer basis.');
      rest^=row.vector;witness^=row.combination;
    }
    const stabilizers=patch.faces.filter(f=>witness&(1n<<BigInt(f.id))).map(f=>f.id);
    const logical=Number((witness>>BigInt(patch.faces.length))&1n);
    const stabilizerEdges=xor(...stabilizers.map(id=>patch.faces[id].edges));
    const reconstructed=xor(logical?patch.logicalZ:[],stabilizerEdges);
    const cutCrossings=chain.filter(id=>patch.logicalX.includes(id));
    const verified=mask(reconstructed)===mask(chain) && cutCrossings.length%2===logical;
    if(!verified) throw new Error('Logical witness failed verification.');
    return {closed:true,violations:0,logical,stabilizers,stabilizerEdges,reconstructed,cutCrossings,verified};
  }

  function decode(patch,error,forestStrategy='bfs') {
    error=xor(error);
    const observed=syndrome(patch,error);
    let defect=0;
    const graph={...patch,nodes:patch.nodes.map(v=>({...v,syndrome:observed[v.id],label:observed[v.id]?String.fromCharCode(65+defect++):''}))};
    const trace=globalThis.__ufLessonModel.run(graph,{forestStrategy});
    const correction=trace.correction.slice().sort((a,b)=>a-b),residual=xor(error,correction);
    const result=decompose(patch,residual);
    if(!trace.valid || !result.closed) throw new Error('The completed correction leaves a syndrome.');
    return {graph,error,observed,trace,correction,residual,result};
  }

  // Exact unit-weight reference. Transfer one horizontal row at a time, keeping
  // the vertical frontier and the intersection parity with the fixed Xbar cut.
  // For each frontier pair, the check equations allow two horizontal strings.
  // This minimizes over every syndrome-consistent correction, not just paths
  // chosen by UF. An optional edge set restricts the same solve to its growth.
  function minimumCorrections(patch,bits,allowedEdges) {
    if(bits.length!==patch.nodes.length || bits.some(b=>b!==0&&b!==1)) throw new Error('Invalid syndrome.');
    const d=patch.d,width=1<<(d-1),states=width*2,allH=(1<<d)-1;
    const pop=Array.from({length:1<<d},(_,i)=>{let n=0;for(;i;i&=i-1)n++;return n;});
    const allowed=allowedEdges===undefined?null:new Set(allowedEdges);
    let costs=Array(states).fill(Infinity),counts=Array(states).fill(0n);
    costs[0]=0;counts[0]=1n;
    const history=[];
    for(let row=0;row<d;row++) {
      let s=0,allowH=0,allowV=0;
      for(let j=0;j<d-1;j++)s|=bits[row*(d-1)+j]<<j;
      for(let j=0;j<d;j++)if(!allowed||allowed.has(patch.edge('h',j,row)))allowH|=1<<j;
      if(row<d-1)for(let j=0;j<d-1;j++)if(!allowed||allowed.has(patch.edge('v',j+1,row)))allowV|=1<<j;
      const horizontal=Array.from({length:width},(_,t)=>{let h=0,b=0;for(let j=1;j<d;j++){b^=(t>>(j-1))&1;h|=b<<j;}return h;});
      const next=Array(states).fill(Infinity),ways=Array(states).fill(0n),previous=Array(states).fill(-1),hs=Array(states).fill(0);
      for(let up=0;up<width;up++)for(let down=0;down<(row===d-1?1:width);down++) {
        if(down&~allowV)continue;
        const base=horizontal[s^up^down];
        for(const h of [base,base^allH]) {
          if(h&~allowH)continue;
          const weight=pop[h]+pop[down],cross=(h>>Math.floor(d/2))&1;
          for(let parity=0;parity<2;parity++) {
            const old=up*2+parity;if(!Number.isFinite(costs[old]))continue;
            const state=down*2+(parity^cross),cost=costs[old]+weight;
            if(cost<next[state]){next[state]=cost;ways[state]=counts[old];previous[state]=old;hs[state]=h;}
            else if(cost===next[state])ways[state]+=counts[old];
          }
        }
      }
      history.push({previous,hs});costs=next;counts=ways;
    }
    const sectors=[0,1].map(parity=>{
      if(!Number.isFinite(costs[parity]))return {parity,weight:null,count:'0',correction:[]};
      let state=parity;const correction=[];
      for(let row=d-1;row>=0;row--) {
        const h=history[row].hs[state],down=state>>1;
        for(let j=0;j<d;j++)if(h&(1<<j))correction.push(patch.edge('h',j,row));
        if(row<d-1)for(let j=0;j<d-1;j++)if(down&(1<<j))correction.push(patch.edge('v',j+1,row));
        state=history[row].previous[state];
      }
      correction.sort((a,b)=>a-b);
      if(correction.length!==costs[parity] || syndrome(patch,correction).some((v,i)=>v!==bits[i]) || cutParity(patch,correction)!==parity)throw new Error('Exact reference witness failed.');
      return {parity,weight:costs[parity],count:counts[parity].toString(),correction};
    });
    return {sectors,restricted:!!allowed,method:'row-frontier dynamic programming',unitWeights:true};
  }

  const cutParity=(patch,chain)=>chain.filter(id=>patch.logicalX.includes(id)).length%2;

  function analyze(patch,data,forestStrategy='bfs') {
    const exact=minimumCorrections(patch,data.observed),grown=minimumCorrections(patch,data.observed,data.trace.fullEdges);
    const parity=cutParity(patch,data.correction),truth=cutParity(patch,data.error);
    const variants=['bfs','reverse-bfs','dfs'].map(strategy=>{
      const d=strategy===forestStrategy?data:decode(patch,data.error,strategy);
      if(d.trace.fullEdges.join(',')!==data.trace.fullEdges.join(','))throw new Error('Forest changed grown support.');
      return {strategy,correction:d.correction,residual:d.residual,logical:d.result.logical,parity:cutParity(patch,d.correction),forest:d.trace.forest};
    });
    const frames=data.trace.frames.filter(f=>!f.micro);
    return {exact,grown,parity,truth,variants,gap:exact.sectors[parity^1].weight-exact.sectors[parity].weight,
      peelingExcess:data.correction.length-grown.sectors[parity].weight,
      growthPenalty:grown.sectors[parity].weight-exact.sectors[parity].weight,
      correctClassInGrowth:grown.sectors[truth].weight!==null,
      rounds:Math.max(...frames.map(f=>f.tick)),reactivations:frames.filter(f=>f.reactivated).length,
      unions:frames.filter(f=>f.action==='merge').reduce((n,f)=>n+f.operations.filter(o=>!o.same).length,0)};
  }

  function sample(patch,{seed=1,mode='iid',p=.1,weight=5}={}) {
    if(!Number.isInteger(seed)||seed<0||seed>4294967295)throw new Error('Seed must be an integer from 0 to 4294967295.');
    let state=seed>>>0;
    const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
    if(mode==='iid'){
      if(!Number.isFinite(p)||p<0||p>1)throw new Error('Use a probability between 0 and 1.');
      return patch.edges.filter(()=>random()<p).map(e=>e.id);
    }
    if(mode!=='fixed'||!Number.isInteger(weight)||weight<0||weight>patch.n)throw new Error('Use a valid fixed error weight.');
    const ids=patch.edges.map(e=>e.id);
    for(let i=ids.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]];}
    return ids.slice(0,weight).sort((a,b)=>a-b);
  }

  // Counterfactual single-qubit toggles. These are an exhaustive local probe,
  // not a stochastic sample or an error-rate estimate. UF sees only the new s.
  function neighbors(patch,data,forestStrategy='bfs') {
    return patch.edges.map(edge=>{
      const error=xor(data.error,[edge.id]),next=decode(patch,error,forestStrategy);
      const changedCorrection=xor(data.correction,next.correction);
      const residualChange=xor([edge.id],changedCorrection),difference=decompose(patch,residualChange);
      if(!difference.closed||difference.logical!==(data.result.logical^next.result.logical))throw new Error('Neighbor residual identity failed.');
      return {qubit:edge.id,operation:data.error.includes(edge.id)?'remove':'add',error,correction:next.correction,
        residual:next.residual,logical:next.result.logical,changedCorrection,residualChange,
        outcomeChanged:next.result.logical!==data.result.logical,defects:next.observed.reduce((a,b)=>a+b,0)};
    });
  }

  function examples(patch) {
    const h=(x,y)=>patch.edge('h',x,y),v=(x,y)=>patch.edge('v',x,y);
    const m=Math.floor(patch.d/2),right=Array.from({length:patch.d-m},(_,i)=>h(m+i,m));
    const detourFace=patch.faces.find(f=>f.col===m+1 && f.row===m-1);
    const successFace=patch.faces.find(f=>f.col===m && f.row===m-1);
    const boundaryFace=patch.faces.find(f=>f.col===0 && f.row===m-1);
    const basic=[
      {id:'exact',name:'1 · Exact recovery: CE = I',error:[h(m,m)],title:'The correction cancels the error.',note:'One Z error creates two neighboring X-check defects. UF returns the same single-qubit Z, so both copies cancel.'},
      {id:'stabilizer',name:'2 · Different paths: CE = S',error:xor([h(m,m)],successFace.edges),title:'Different physical paths can recover the same logical state.',note:'The actual error takes a three-edge detour. The one-edge correction leaves a plaquette stabilizer, which acts as identity on the code space.'},
      {id:'logical',name:'3 · Wrong boundary: CE = Z̄',error:right,title:'A shorter correction can leave a logical error.',note:'The error reaches the right rough boundary, but its defect is closer to the left. UF chooses the left path; together they span the patch.'},
      {id:'dressed',name:'4 · Deformed logical path: CE = Z̄S',error:xor(right,detourFace.edges),title:'A logical operator remains, even after removing a stabilizer.',note:'The error detours around one plaquette. After UF clears the syndrome, the remaining path is a logical Z multiplied by that plaquette stabilizer.'},
      {id:'invisible',name:'5 · Zero syndrome, nontrivial logical Z̄',error:patch.logicalZ.slice(),title:'A logical error can produce no detection events.',note:'A complete rough-to-rough Z string flips no measured X check. UF receives an empty syndrome and returns C = I.'},
      {id:'boundary',name:'6 · Boundary stabilizer: CE = S',error:boundaryFace.edges.slice(),title:'Touching a boundary does not by itself imply failure.',note:'This three-qubit chain returns to the same rough boundary. It is a boundary Z stabilizer, with zero syndrome and no logical effect.'}
    ].map(e=>({...e,group:'Foundations'}));
    if(patch.d!==5)return basic;
    const row=y=>Array.from({length:patch.d},(_,x)=>h(x,y));
    return [...basic,
      {id:'independent',group:'Multiple chains',name:'7 · Three separated error chains',error:[h(1,0),h(3,4),v(2,2)],title:'Several clusters can finish independently.',note:'Three isolated Z errors create six defects. Each neighboring pair becomes even without a global merger. Inspect the live cluster table to see each pair stop growing.'},
      {id:'two-strings',group:'Topological composition',name:'8 · Two logical strings cancel',error:xor(row(1),row(3),[h(2,2)]),title:'Two nontrivial strings can have a trivial combined effect.',note:'Two complete rough-to-rough strings are hidden from the syndrome. UF corrects the one visible central error. The two remaining strings multiply to ten face stabilizers: Z̄² = I, so the logical state is recovered despite a weight-10 residual.'},
      {id:'three-strings',group:'Topological composition',name:'9 · Three logical strings survive',error:xor(row(0),row(2),row(4),[h(2,1)]),title:'Logical parity counts strings modulo two.',note:'The three full horizontal strings create no defects. After UF removes the extra visible error, CE crosses the X̄ cut three times. Its exact witness is one logical Z̄ multiplied by all 20 face stabilizers.'},
      {id:'islands',group:'Topological composition',name:'10 · Four stabilizer islands',error:xor([h(2,2)],... [1,3,16,18].map(i=>patch.faces[i].edges)),title:'A heavy physical error can still be logically harmless.',note:'Four disjoint plaquette loops surround a single visible error. The 17-qubit error has the same syndrome as one Z error. UF removes that one edge, leaving only the four stabilizers. Error weight alone does not determine a particular shot’s outcome.'},
      {id:'reactivation',group:'Growth and peeling',name:'11 · Reactivation and peeling cost',error:[22,31,32,35],title:'An even cluster can resume growth after a merger.',note:'Six initial defects cause an even cluster to absorb an odd one and become active again. Default BFS peeling returns six correction edges; reverse BFS and DFS need four on exactly the same grown support. All three recover this error logically.'},
      {id:'forest-choice',group:'Growth and peeling',name:'12 · Forest choice changes the logical class',error:[3,16,27,29,30,33,38],title:'The same grown region can support both logical outcomes.',note:'Default BFS and reverse BFS fail on this error; DFS succeeds. Both logical classes have a global minimum correction of weight five, but with different numbers of minimum-weight representatives. A zero weight gap does not specify a probability of logical failure.'},
      {id:'growth-trap',group:'Growth and peeling',name:'13 · Growth excludes the correct class',error:[1,3,10,13,23,30,39],title:'Changing the peeling forest cannot repair this grown region.',note:'Eleven defects lead UF to a weight-eight correction in the wrong logical class. The full patch admits successful weight-seven corrections, but none in that class fit inside the fully grown edges. Every correction confined to this grown region therefore fails for this E.'},
      {id:'uf-wins',group:'Decoder disagreements',name:'14 · UF succeeds, minimum weight fails',error:[9,13,15,23,34,40],title:'Minimum weight is a decision rule, not a guarantee for each shot.',note:'Default BFS UF succeeds using six edges. Every globally minimum-weight correction has five edges and fails for this particular E. This selected counterexample says nothing about which decoder has the better average logical error rate.'},
      {id:'dense',group:'Decoder disagreements',name:'15 · Dense syndrome and degenerate minima',error:[3,8,11,16,20,35,39],title:'Many shortest representatives can share a logical class.',note:'Eleven defects interact through repeated mergers. Both classes have minimum weight seven, with 16 and 4 distinct minimum-weight corrections. Default BFS fails while DFS succeeds. Compare their residuals, and distinguish minimum-weight multiplicity from a full class likelihood.'},
      {"id":"likelihood-crossover","group":"Likelihood and confidence","name":"16 · Minimum weight and likelihood disagree","error":[7,10,12,14,19,37,40],"title":"The more likely logical class can change with the noise model.","note":"UF returns the unique weight-five correction, but this error leaves CE = Z̄S20. The opposite class starts at weight six with eight representatives. Summing every syndrome-consistent chain changes the preferred class near p = 0.11052: UF’s class has probability 52.27% at p = 0.10, but 44.61% at p = 0.15. These are conditional probabilities under independent Z errors, not an observed failure flag.","partner":"likelihood-companion","partnerNote":"The paired case has the same syndrome, correction, and confidence, but the opposite actual outcome."},
      {"id":"likelihood-companion","group":"Likelihood and confidence","name":"17 · Same syndrome and confidence, exact recovery","error":[7,11,13,24,37],"title":"Identical decoder information can accompany opposite actual outcomes.","note":"This error equals the correction from Example 16, so CE = I. Both examples have exactly the same measured syndrome, UF trace, correction, class weights, and conditional likelihoods. Only the ground-truth error changes. A confidence estimate does not reveal which error actually occurred.","partner":"likelihood-crossover","partnerNote":"The paired case has the same syndrome, correction, and confidence, but the opposite actual outcome."},
      {"id":"perturb-before","group":"One-qubit perturbation","name":"18 · Before one added error: logical failure","error":[19,21,38,39],"title":"A four-error configuration sits at a decoder decision boundary.","note":"UF returns C = {q17, q18, q20, q39}, leaving a nontrivial logical operator. Both global correction classes have minimum weight four, but only the failing class is available inside the grown support. Compare Example 19, which adds only q16.","partner":"perturb-after","partnerNote":"The paired case changes only q16. Watch how the selected correction changes on five edges."},
      {"id":"perturb-after","group":"One-qubit perturbation","name":"19 · Add q16: recovery becomes successful","error":[16,19,21,38,39],"title":"Adding one error can change the selected correction on several qubits.","note":"Relative to Example 18, adding q16 leaves the error’s fixed-cut parity unchanged but changes the syndrome. UF now returns {q19, q37, q39}; five correction edges change, its weight falls from four to three, and CE = S17. This selected pair demonstrates a nonmonotonic per-shot outcome, not an improvement from adding noise.","partner":"perturb-before","partnerNote":"The paired case changes only q16. Watch how the selected correction changes on five edges."},
      {"id":"all-checks","group":"Boundary and dense syndromes","name":"20 · Every measured check is violated","error":[1,3,6,8,11,13,16,18,21,23],"title":"A dense syndrome can finish growth in a single round.","note":"All 20 X checks are defects, so neighboring active clusters rapidly join and become even. Growth ends after one half-edge tick. UF succeeds with a weight-ten correction. Its class contains 95 weight-ten minima; the opposite class starts at weight eleven with 323 minima. Defect count and minimum-representative count are each incomplete descriptions of confidence or decoder work."},
      {"id":"boundary-fronts","group":"Boundary and dense syndromes","name":"21 · Ten rough-boundary contacts","error":[0,4,5,9,10,14,15,19,20,24],"title":"The same boundary roots can produce different correction costs.","note":"Five defects lie beside each rough boundary. The default multi-source BFS forest uses ten boundary edges; DFS pairs some defects internally and uses six correction edges on the same grown support. Both yield logical success. Compare the forests to see why touching opposite rough boundaries in separate components does not make a logical crossing."},
      {"id":"delayed-reactivation","group":"Growth and peeling","name":"22 · Delayed reactivation across four growth ticks","error":[7,8,18,19,22,26,29],"title":"An even cluster can wait before a later odd merger restarts it.","note":"The BD cluster becomes even at tick one and stays inactive through tick two. It absorbs A at tick three, becomes odd, and resumes growth. The full trace ends growth at tick four. Default BFS uses eleven correction edges although both global classes have weight-seven minima; DFS selects the opposite logical class and fails for this E."},
      {"id":"equal-weight-success","group":"Indistinguishable errors","name":"23 · Equal-weight pair: logical success","error":[9,13,16,21,26,33],"title":"The syndrome and error weight do not determine the actual outcome.","note":"This six-qubit error and Example 24 create exactly the same nine defects. UF returns the same six-qubit correction for both. Here CE = S12 and recovery succeeds. Both classes have weight-six minima, with four representatives in UF’s class and three in the opposite class.","partner":"equal-weight-failure","partnerNote":"The paired error has the same weight and syndrome. UF cannot distinguish the two actual logical outcomes."},
      {"id":"equal-weight-failure","group":"Indistinguishable errors","name":"24 · Equal-weight pair: logical failure","error":[10,12,21,26,32,34],"title":"An equally heavy, indistinguishable error changes CE to a logical operator.","note":"This error has the same weight and syndrome as Example 23. The decoder and its confidence cannot distinguish the pair. The identical UF correction now leaves CE = Z̄S10. Switching to DFS reverses which member of this pair is recovered successfully.","partner":"equal-weight-success","partnerNote":"The paired error has the same weight and syndrome. UF cannot distinguish the two actual logical outcomes."}
    ];
  }
  globalThis.__surfaceModel={makePatch,syndrome,decompose,decode,examples,xor,cutParity,minimumCorrections,analyze,sample,neighbors};
})();
