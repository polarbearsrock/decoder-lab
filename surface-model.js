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

  function examples(patch) {
    const h=(x,y)=>patch.edge('h',x,y),v=(x,y)=>patch.edge('v',x,y);
    const m=Math.floor(patch.d/2),right=Array.from({length:patch.d-m},(_,i)=>h(m+i,m));
    const detourFace=patch.faces.find(f=>f.col===m+1 && f.row===m-1);
    const successFace=patch.faces.find(f=>f.col===m && f.row===m-1);
    const boundaryFace=patch.faces.find(f=>f.col===0 && f.row===m-1);
    return [
      {id:'exact',name:'1 · Exact recovery: CE = I',error:[h(m,m)],title:'The correction cancels the error.',note:'One Z error creates two neighboring X-check defects. UF returns the same single-qubit Z, so both copies cancel.'},
      {id:'stabilizer',name:'2 · Different paths: CE = S',error:xor([h(m,m)],successFace.edges),title:'Different physical paths can recover the same logical state.',note:'The actual error takes a three-edge detour. The one-edge correction leaves a plaquette stabilizer, which acts as identity on the code space.'},
      {id:'logical',name:'3 · Wrong boundary: CE = Z̄',error:right,title:'A shorter correction can leave a logical error.',note:'The error reaches the right rough boundary, but its defect is closer to the left. UF chooses the left path; together they span the patch.'},
      {id:'dressed',name:'4 · Deformed logical path: CE = Z̄S',error:xor(right,detourFace.edges),title:'A logical operator remains, even after removing a stabilizer.',note:'The error detours around one plaquette. After UF clears the syndrome, the remaining path is a logical Z multiplied by that plaquette stabilizer.'},
      {id:'invisible',name:'5 · Zero syndrome, nontrivial logical Z̄',error:patch.logicalZ.slice(),title:'A logical error can produce no detection events.',note:'A complete rough-to-rough Z string flips no measured X check. UF receives an empty syndrome and returns C = I.'},
      {id:'boundary',name:'6 · Boundary stabilizer: CE = S',error:boundaryFace.edges.slice(),title:'Touching a boundary does not by itself imply failure.',note:'This three-qubit chain returns to the same rough boundary. It is a boundary Z stabilizer, with zero syndrome and no logical effect.'}
    ];
  }
  globalThis.__surfaceModel={makePatch,syndrome,decompose,decode,examples,xor};
})();
