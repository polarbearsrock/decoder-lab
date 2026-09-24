/* Pedagogical uniform-growth Union-Find model; unit edge costs, one error type.
 * Snapshots favor inspection over optimized decoder runtime.
 * Based on the two-stage construction of Delfosse & Nickerson (2021).
 */
(() => {
  'use strict';
  const presets = {
    pair: { name:'Pair two defects', defects:[[3,1],[5,1]], boundary:false },
    reactivate: { name:'An even cluster grows again', defects:[[2,1],[3,1],[5,1]], boundary:true },
    boundary: { name:'Reach a boundary', defects:[[1,1]], boundary:true },
    forest: {name:'The forest changes the answer',defects:[[1,0],[3,0],[3,1],[4,1]],boundary:false},
    clustering: {name:'A limit of cluster growth',defects:[[1,0],[2,0],[4,0],[6,0],[2,1],[4,2]],boundary:false},
    custom: {name:'Your own syndrome',defects:[[2,1],[5,1]],boundary:true}
  };

  function makeGraph(key, customDefects, boundaryOverride) {
    const preset={...presets[key]};
    if(boundaryOverride!==undefined) preset.boundary=boundaryOverride;
    const defects=customDefects || preset.defects;
    const nodes=[], edges=[], ids=new Map();
    for(let row=0;row<3;row++) {
      for(let col=1;col<=7;col++) {
        const labelIndex=defects.findIndex(p=>p[0]===col && p[1]===row);
        const id=nodes.length;
        ids.set(`${col},${row}`,id);
        nodes.push({id,col,row,boundary:false,syndrome:labelIndex>=0?1:0,label:labelIndex>=0?String.fromCharCode(65+labelIndex):'',name:`(${col},${row+1})`});
      }
    }
    if(preset.boundary) {
      for(let row=0;row<3;row++) {
        const id=nodes.length;
        ids.set(`0,${row}`,id);
        nodes.push({id,col:0,row,boundary:true,syndrome:0,label:'',name:`boundary ${row+1}`});
      }
    }
    const add=(a,b)=>edges.push({id:edges.length,a:ids.get(a),b:ids.get(b)});
    for(let row=0;row<3;row++) {
      for(let col=1;col<7;col++) add(`${col},${row}`,`${col+1},${row}`);
      if(preset.boundary) add(`0,${row}`,`1,${row}`);
    }
    for(let row=0;row<2;row++) for(let col=1;col<=7;col++) add(`${col},${row}`,`${col},${row+1}`);
    return {nodes,edges,key,preset,cols:7,rows:3};
  }

  function run(graph, options = {}) {
    const forestStrategy = options.forestStrategy || 'bfs';
    if (!['bfs', 'reverse-bfs', 'dfs'].includes(forestStrategy)) {
      throw new Error('Unknown forest strategy: ' + forestStrategy);
    }
    const {nodes,edges}=graph, n=nodes.length;
    const parent=nodes.map(v=>v.id), size=nodes.map(()=>1), count=nodes.map(v=>v.syndrome), atBoundary=nodes.map(v=>v.boundary);
    const support=edges.map(()=>[0,0]);
    let bits=nodes.map(v=>v.syndrome), forest=[], remaining=[], removed=[], correction=[], tick=0,operations=[],peelRoots=[],roundFullEdges=[];
    const frames=[];
    const peek=v=>{while(parent[v]!==v)v=parent[v];return v;};
    function find(v) {
      let r=v;
      while(parent[r]!==r) r=parent[r];
      while(parent[v]!==v) { const next=parent[v]; parent[v]=r; v=next; }
      return r;
    }
    const active=r=>(count[r]%2===1 && !atBoundary[r]);
    function members(r) { return nodes.filter(v=>peek(v.id)===r); }
    function name(r) { return members(r).filter(v=>v.label).map(v=>v.label).sort().join(''); }
    function union(a,b) {
      let ra=find(a), rb=find(b);
      if(ra===rb) return ra;
      if(size[ra]<size[rb] || (size[ra]===size[rb] && ra>rb)) [ra,rb]=[rb,ra];
      parent[rb]=ra; size[ra]+=size[rb]; count[ra]+=count[rb]; atBoundary[ra]=atBoundary[ra]||atBoundary[rb];
      return ra;
    }
    function snapshot(phase,title,note,focus={}) {
      const roots=[...new Set(nodes.map(v=>peek(v.id)))];
      const groups=roots.filter(r=>count[r]>0).map(r=>({root:r,members:members(r).map(v=>v.id),label:name(r),count:count[r],boundary:atBoundary[r],active:active(r)}));
      const nodeGroups=nodes.map(v=>groups.findIndex(g=>g.root===peek(v.id)));
      frames.push({phase,title,note,tick,groups,nodeGroups,support:support.map(p=>p.slice()),bits:bits.slice(),forest:forest.slice(),remaining:remaining.slice(),removed:removed.slice(),correction:correction.slice(),focusNodes:focus.nodes||[],focusEdges:focus.edges||[],action:focus.action||'',reactivated:focus.reactivated||false,parents:parent.slice(),sizes:size.slice(),operations:operations.map(o=>({...o})),roundFullEdges:roundFullEdges.slice(),forestStrategy,peelRoots:peelRoots.slice(),micro:!!focus.micro,raw:frames.length});
    }
    const totalDefects=count.reduce((a,b)=>a+b,0);
    snapshot('seed','Seed the defects',totalDefects===0?'No defects: the empty correction already matches this syndrome.':graph.preset.boundary && totalDefects===1 ? 'A seeds one odd cluster; square vertices mark an allowed boundary.' : 'Each defect seeds an odd cluster; parity counts defects, not all vertices.');
    if(totalDefects%2 && !graph.preset.boundary) return {frames,valid:false,error:'An odd number of defects needs a boundary or another defect.',correction:[],forest:[],fullEdges:[],forestStrategy};
    while([...new Set(nodes.map(v=>peek(v.id)))].some(active)) {
      if(++tick>100) throw new Error('Growth failed to terminate.');
      operations=[];
      const changed=[], full=[];
      for(const e of edges) {
        const ra=peek(e.a), rb=peek(e.b), s=support[e.id], total=s[0]+s[1];
        if(total>=1-1e-9) continue;
        const da=active(ra)?0.5:0, db=active(rb)?0.5:0;
        if(da+db===0) continue;
        const scale=Math.min(1,(1-total)/(da+db));
        s[0]+=da*scale; s[1]+=db*scale;
        changed.push(e.id);
        if(s[0]+s[1]>=1-1e-9) full.push(e.id);
      }
      if(!changed.length) throw new Error('An odd cluster cannot grow on this graph.');
      roundFullEdges=full.slice();
      snapshot('grow','Grow by half an edge',full.length ? 'Growth completes edges; clusters connected by them will now merge.' : 'Only active odd clusters extend; two half-edges complete a connection.',{edges:changed,action:'growth'});
      if(full.length) {
        const events=[];
        let reactivated=false;
        for(const eid of full) {
          const e=edges[eid];
          const before=parent.slice();
          const oldPath=v=>{const path=[v];while(before[v]!==v){v=before[v];path.push(v);}return path;};
          const pathA=oldPath(e.a),pathB=oldPath(e.b);
          const ra=find(e.a),rb=find(e.b);
          const compressed=parent.reduce((sum,p,i)=>sum+(p!==before[i]?1:0),0);
          const operation={edge:eid,a:e.a,b:e.b,ra,rb,sa:size[ra],sb:size[rb],ca:count[ra],cb:count[rb],compressed,pathA,pathB,parentsBefore:before,parentsAfterFind:parent.slice(),result:ra,same:ra===rb};
          operations.push(operation);
          snapshot('grow','Find the endpoint roots',`Find(v${e.a}) = v${ra}; Find(v${e.b}) = v${rb}.`,{nodes:[e.a,e.b],edges:[eid],action:'find',micro:true});
          if(ra===rb) {
            snapshot('grow','Already one cluster','Both endpoints already share a root; no Union is needed.',{edges:[eid],action:'same',micro:true});
            continue;
          }
          const ca=count[ra],cb=count[rb], ba=atBoundary[ra],bb=atBoundary[rb];
          const na=name(ra),nb=name(rb);
          const wasEven=(ca>0 && ca%2===0 && !ba) || (cb>0 && cb%2===0 && !bb);
          const r=union(ra,rb);
          operation.result=r;
          if(atBoundary[r] && !(ba&&bb) && ca+cb>0 && (ba!==bb)) events.push(`${name(r)} reaches the boundary; the cluster stops even with odd parity.`);
          else if(ca>0 && cb>0) {
            if(active(r) && wasEven) { reactivated=true; events.push(`${na} and ${nb} merge: ${count[r]} defects make the cluster odd, so growth resumes.`); }
            else if(!active(r)) events.push(`${na} and ${nb} merge: ${count[r]} defects make the cluster even, so growth pauses.`);
            else events.push(`${na} and ${nb} merge; the combined cluster is still odd and keeps growing.`);
          }
          snapshot('grow','Union by tree size',`Attach the smaller set to root v${r}; the merged set has ${size[r]} vertices and ${count[r]} defects.`,{nodes:[ra,rb,r],edges:[eid],action:'union',micro:true});
        }
        snapshot('grow',reactivated?'An even cluster grows again':'Merge and update parity',events.length?events[events.length-1]:'New vertices join through full edges; the defect counts stay the same.',{edges:full,action:'merge',reactivated});
      }
    }
    operations=[];
    roundFullEdges=[];
    const fullEdges=edges.filter(e=>support[e.id][0]+support[e.id][1]>=1-1e-9);
    const adj=nodes.map(()=>[]);
    for(const e of fullEdges) {adj[e.a].push([e.b,e.id]);adj[e.b].push([e.a,e.id]);}
    const seen=new Set(), roots=new Set();
    for(const r of [...new Set(nodes.map(v=>peek(v.id)))]) {
      if(count[r]===0) continue;
      const component=members(r);
      let seeds=component.filter(v=>v.boundary).map(v=>v.id);
      if(!seeds.length) seeds=[component.find(v=>v.syndrome).id];
      // Every allowed boundary vertex is a root. Mark all roots before
      // traversal so no selected tree can join two unconstrained roots.
      for(const s of seeds) {seen.add(s);roots.add(s);}
      const neighbors = v => forestStrategy === 'reverse-bfs'
        ? adj[v].slice().reverse() : adj[v];
      if(forestStrategy === 'dfs') {
        // Iterative recursive-style DFS: descend immediately after discovery.
        for(const seed of seeds) {
          const stack=[{vertex:seed,next:0}];
          while(stack.length) {
            const top=stack[stack.length-1], list=neighbors(top.vertex);
            if(top.next>=list.length) {stack.pop();continue;}
            const [v,eid]=list[top.next++];
            if(seen.has(v)) continue;
            seen.add(v);forest.push(eid);stack.push({vertex:v,next:0});
          }
        }
      } else {
        const queue=seeds.slice();
        for(let qi=0;qi<queue.length;qi++) {
          for(const [v,eid] of neighbors(queue[qi])) {
            if(seen.has(v)) continue;
            seen.add(v);queue.push(v);forest.push(eid);
          }
        }
      }
    }
    remaining=forest.slice();
    peelRoots=[...roots];
    const cut=fullEdges.length-forest.length;
    snapshot('forest','Choose a spanning forest',cut>0 ? `Use a forest of full edges; ${cut} redundant connection${cut===1?' is':'s are'} omitted.` : 'Use a tree of full edges; unfinished half-edges are excluded.');
    let peelGuard=0;
    while(remaining.length) {
      if(++peelGuard>n*3) throw new Error('Peeling failed to terminate.');
      const degree=nodes.map(()=>0), leafEdge=nodes.map(()=>-1);
      for(const eid of remaining) {const e=edges[eid];degree[e.a]++;degree[e.b]++;leafEdge[e.a]=eid;leafEdge[e.b]=eid;}
      const leaves=nodes.filter(v=>degree[v.id]===1 && !roots.has(v.id));
      if(!leaves.length) throw new Error('No non-root leaf in a forest.');
      const zero=leaves.filter(v=>bits[v.id]===0);
      if(zero.length) {
        const dropped=[...new Set(zero.map(v=>leafEdge[v.id]))];
        remaining=remaining.filter(eid=>!dropped.includes(eid));
        removed.push(...zero.map(v=>v.id));
        snapshot('peel','Discard zero-bit leaves',`${zero.length} leaf bit${zero.length===1?' is':'s are'} 0; drop ${zero.length===1?'its':'their'} tree edge${zero.length===1?'':'s'} without choosing a correction.`,{nodes:zero.map(v=>v.id),edges:dropped,action:'discard'});
      } else {
        const v=leaves[0],eid=leafEdge[v.id],e=edges[eid],other=e.a===v.id?e.b:e.a;
        const label=v.label||'The highlighted leaf';
        snapshot('peel','Inspect a one-bit leaf',`${label} has bit 1; its only remaining tree edge must enter the correction.`,{nodes:[v.id],edges:[eid],action:'inspect'});
        correction.push(eid);
        bits[v.id]^=1;
        if(!nodes[other].boundary) bits[other]^=1;
        remaining=remaining.filter(id=>id!==eid);removed.push(v.id);
        snapshot('peel','Keep the edge and update bits',nodes[other].boundary ? 'Keep this edge; its boundary endpoint has no syndrome constraint.' : 'Keep this edge; flip both endpoint bits and remove the cleared leaf.',{nodes:[v.id,other],edges:[eid],action:'keep'});
      }
    }
    const reproduced=nodes.map(()=>0);
    for(const eid of correction) {const e=edges[eid];if(!nodes[e.a].boundary)reproduced[e.a]^=1;if(!nodes[e.b].boundary)reproduced[e.b]^=1;}
    const valid=nodes.every(v=>v.boundary || (reproduced[v.id]===v.syndrome && bits[v.id]===0));
    if(!valid) throw new Error('Correction failed the syndrome check.');
    snapshot('done','Syndrome matched','The correction matches the observed syndrome; logical success also depends on the actual error.');
    return {frames,valid,reproduced,correction,forest,fullEdges:fullEdges.map(e=>e.id),forestStrategy};
  }

  function minimumCorrection(graph,allowedEdges) {
    const {nodes,edges}=graph,defects=nodes.filter(v=>v.syndrome).map(v=>v.id);
    if(defects.length>12)return {available:false,reason:'Exact comparison is available for up to 12 defects.'};
    const included=new Set(allowedEdges||edges.map(e=>e.id)),adj=nodes.map(()=>[]),boundary=nodes.filter(v=>v.boundary).map(v=>v.id);
    for(const e of edges)if(included.has(e.id)){adj[e.a].push([e.b,e.id]);adj[e.b].push([e.a,e.id]);}
    const routes=defects.map(start=>{
      const distance=nodes.map(()=>Infinity),prev=nodes.map(()=>null),q=[start];distance[start]=0;
      for(let h=0;h<q.length;h++)for(const [v,eid]of adj[q[h]])if(distance[v]===Infinity){distance[v]=distance[q[h]]+1;prev[v]=[q[h],eid];q.push(v);}
      const path=end=>{const result=[];if(!Number.isFinite(distance[end]))return result;while(end!==start){result.push(prev[end][1]);end=prev[end][0];}return result;};
      return {distance,path};
    });
    const nearest=routes.map(r=>boundary.reduce((best,v)=>best===null||r.distance[v]<r.distance[best]?v:best,null));
    const memo=new Map(),choices=new Map();
    function solve(mask){
      if(!mask)return 0;if(memo.has(mask))return memo.get(mask);
      let i=0;while(!(mask&(1<<i)))i++;
      const rest=mask^(1<<i);let best=Infinity,choice=null;
      if(nearest[i]!==null){const cost=routes[i].distance[nearest[i]]+solve(rest);if(cost<best){best=cost;choice={i,boundary:nearest[i],rest};}}
      for(let j=i+1;j<defects.length;j++)if(rest&(1<<j)){const next=rest^(1<<j),cost=routes[i].distance[defects[j]]+solve(next);if(cost<best){best=cost;choice={i,j,rest:next};}}
      memo.set(mask,best);choices.set(mask,choice);return best;
    }
    let mask=(1<<defects.length)-1;
    const cost=solve(mask),selected=new Set(),pairs=[];
    if(!Number.isFinite(cost))return {available:false,reason:'No syndrome-consistent correction exists in this edge set.'};
    while(mask){const c=choices.get(mask),end=c.j===undefined?c.boundary:defects[c.j],path=routes[c.i].path(end);for(const eid of path){if(selected.has(eid))selected.delete(eid);else selected.add(eid);}pairs.push([defects[c.i],end]);mask=c.rest;}
    const check=nodes.map(()=>0);for(const eid of selected){const e=edges[eid];if(!nodes[e.a].boundary)check[e.a]^=1;if(!nodes[e.b].boundary)check[e.b]^=1;}
    if(selected.size!==cost || !nodes.every(v=>v.boundary||check[v.id]===v.syndrome))throw new Error('Minimum correction validation failed.');
    return {available:true,cost,edges:[...selected],pairs};
  }

  globalThis.__ufLessonModel={makeGraph,run,presets,minimumCorrection,forestStrategies:['bfs','reverse-bfs','dfs']};
})();
