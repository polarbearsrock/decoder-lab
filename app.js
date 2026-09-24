(() => {
'use strict';
const {makeGraph,run,presets,minimumCorrection}=globalThis.__ufLessonModel;
  const root=document.getElementById('uf-decoder-lesson');
  if(!root) return;
  const select=root.querySelector('#uf-example'),svg=root.querySelector('.uf-graph'),drawing=root.querySelector('#uf-drawing');
  const next=root.querySelector('#uf-next'),back=root.querySelector('#uf-back'),first=root.querySelector('#uf-first'),play=root.querySelector('#uf-play');
  const counter=root.querySelector('#uf-counter'),note=root.querySelector('#uf-note'),clusters=root.querySelector('#uf-clusters'),desc=root.querySelector('#uf-svg-desc');
  const stages=[...root.querySelectorAll('.uf-stage')];
  const NS='http://www.w3.org/2000/svg';
  const $=id=>root.querySelector(`#uf-${id}`);
  let graph,trace,fullTrace,reference,grownReference,index=0,timer=null,animation=null,lastCoordinates=null,lastIndex=-2,editing=false;
  let draft=presets.custom.defects.map(p=>p.slice()),draftBoundary=true;
  const codeLines=[
    'Initialize one cluster per defect; all other vertices are singleton sets.',
    'While an odd cluster has no allowed boundary:',
    '  Grow every active frontier by up to half an edge.',
    '  For each newly completed edge (u, v):',
    '    ru = Find(u); rv = Find(v)  [path compression]',
    '    If ru != rv: Union(ru, rv)  [union by size]',
    '    Update defect count, parity, and boundary flag.',
    'Build the selected spanning forest using only full edges.',
    'While a non-root leaf v remains:',
    '  If bit[v] = 1: choose its edge and flip endpoint bits.',
    '  Remove the leaf and its tree edge.',
    'Return the syndrome-consistent correction.'
  ];
  for(let i=0;i<codeLines.length;i++){
    const li=document.createElement('li'),num=document.createElement('span'),text=document.createElement('span');
    num.className='uf-code-no tabular-nums';num.textContent=i+1;text.className='uf-code-text';text.textContent=codeLines[i];li.append(num,text);$('code').append(li);
  }
  const nodeName=v=>graph.nodes[v].label?`${graph.nodes[v].label} / v${v}`:`v${v}`;
  function tableRows(target,rows){target.replaceChildren();for(const [name,value]of rows){const tr=document.createElement('tr'),th=document.createElement('th'),td=document.createElement('td');th.scope='row';th.textContent=name;td.textContent=value;tr.append(th,td);target.append(tr);}}
  function parentChain(id,s){const chain=[id];let guard=0;while(s.parents[id]!==id){id=s.parents[id];chain.push(id);if(++guard>graph.nodes.length)throw new Error('Parent cycle');}return chain;}
  function inspectTarget(s){const value=$('inspect').value;if(value!=='auto')return {type:value[0],id:Number(value.slice(1))};if(s.focusNodes.length)return {type:'v',id:s.focusNodes[0]};if(s.focusEdges.length)return {type:'e',id:s.focusEdges[0]};const v=graph.nodes.find(v=>v.syndrome);return {type:'v',id:v?v.id:0};}
  function updatePanels(s){
    const fullyGrown=s.support.filter(p=>p[0]+p[1]>=1-1e-9).length;
    const reasons={
      seed:['Each syndrome-1 vertex contributes one defect to its cluster.','An ordinary vertex can join without changing defect parity.'],
      growth:['Only odd clusters without a boundary extend their frontier.','Full edges are processed together before the next growth round.'],
      find:['Find follows parent pointers to the representative and compresses that path.','These parent pointers describe set membership.'],
      same:['Both endpoint searches reached the same representative.','The edge may form a graph cycle; the sets are already joined.'],
      union:['The smaller set attaches to the larger set; defect counts add.','Remaining full edges in this round can trigger further unions.'],
      merge:['Even clusters pause; odd clusters keep growing unless they touch a boundary.','An even cluster can resume growth when an odd cluster joins it.'],
      forest:['A graph forest provides the leaf order needed for peeling.','This graph forest is separate from the Union-Find parent tree.'],
      inspect:['A residual bit of 1 at a leaf forces its only remaining tree edge.','Peeling reads the current bit, which can differ from the original syndrome.'],
      discard:['A zero-bit leaf needs no correction on its only tree edge.','Zero leaves can be removed together without flipping neighbors.'],
      keep:['Selecting an edge toggles the residual bits at its constrained endpoints.','A virtual boundary endpoint has no measured syndrome constraint.'],
      done:['Every measured vertex has zero residual after applying the correction.','A matching syndrome alone does not establish logical success.']
    };
    const action=s.action||s.phase,reason=reasons[action]||reasons[s.phase]||reasons.merge;
    tableRows($('step-details'),[
      ['Why',reason[0]],['Watch',reason[1]],
      ['State',`${s.groups.filter(g=>g.active).length} active clusters · ${fullyGrown} full edges · ${s.correction.length} chosen edges`],
      ['Growth',`Round ${s.tick} · equal half-edge growth budgets`]
    ]);
    const activeLines=s.phase==='seed'?[0]:s.action==='growth'?[1,2]:s.action==='find'?[3,4]:s.action==='union'?[5,6]:s.action==='same'?[4,5]:s.action==='merge'?[6]:s.phase==='forest'?[7]:s.action==='inspect'?[8,9]:s.action==='keep'?[9,10]:s.action==='discard'?[10]:[11];
    [...$('code').children].forEach((li,i)=>{li.classList.toggle('uf-code-active',activeLines.includes(i));if(activeLines.includes(i))li.setAttribute('aria-current','step');else li.removeAttribute('aria-current');});
    const log=$('operation-log');log.replaceChildren();
    if(s.operations.length){
      const table=document.createElement('table');table.className='table table-sm';
      const head=document.createElement('thead');head.innerHTML='<tr><th>Full edge</th><th>Endpoint roots</th><th>Union result</th></tr>';table.append(head);const body=document.createElement('tbody');
      const ops=s.micro?s.operations.slice(-1):s.operations;
      for(const op of ops){const tr=document.createElement('tr');const cells=[`e${op.edge}: v${op.a}–v${op.b}`,`v${op.ra} (${op.sa}) · v${op.rb} (${op.sb})`,op.same?'Already joined':s.action==='find'?'Awaiting Union':`root v${op.result} · ${op.ca+op.cb} defects`];for(const cell of cells){const td=document.createElement('td');td.textContent=cell;tr.append(td);}body.append(tr);}table.append(body);log.append(table);
      const key=document.createElement('div');key.className='text-small text-muted';key.textContent='Parentheses show set size in vertices.';log.append(key);
      if(s.action==='find'){
        const op=s.operations.at(-1),paths=document.createElement('div');paths.className='text-small';
        paths.textContent=`Search paths: ${op.pathA.map(v=>`v${v}`).join(' → ')}; ${op.pathB.map(v=>`v${v}`).join(' → ')}. Parent pointers shortened: ${op.compressed}.`;log.append(paths);
      }
    }
    $('cluster-table').replaceChildren();
    for(const g of s.groups){const tr=document.createElement('tr');const status=g.boundary?`${g.count%2?'Odd':'Even'} · boundary`:g.active?'Odd · growing':`Even · ${['seed','grow'].includes(s.phase)?'paused':'valid'}`;for(const [i,text]of [g.label,`v${g.root}`,String(g.members.length),String(g.count),status].entries()){const td=document.createElement('td');td.textContent=text;if(i===2||i===3)td.className='text-end tabular-nums';tr.append(td);}$('cluster-table').append(tr);}
    $('cluster-summary').textContent='Vertices determine union-by-size; defects determine parity.';
    const target=inspectTarget(s);
    if(target.type==='v'){
      const v=graph.nodes[target.id],g=s.groups[s.nodeGroups[v.id]],chain=parentChain(v.id,s);
      const degree=s.remaining.reduce((n,eid)=>n+(graph.edges[eid].a===v.id||graph.edges[eid].b===v.id?1:0),0);
      tableRows($('inspect-table'),[['Vertex',`${nodeName(v.id)} · ${v.boundary?'virtual boundary':v.name}`],['Input bit',v.boundary?'Unconstrained':String(v.syndrome)],['Working bit',v.boundary?'Unconstrained':String(s.bits[v.id])],['Find path',chain.map(x=>`v${x}`).join(' → ')],['Cluster',g?`${g.label} · ${g.members.length} vertices · ${g.count} defects`:'No defects in this singleton set'],['Peeling',s.peelRoots.includes(v.id)?'Forest root':degree?`${degree} remaining tree edge${degree===1?'':'s'}`:'No remaining tree edge']]);
    }else{
      const e=graph.edges[target.id],p=s.support[e.id],total=p[0]+p[1];
      tableRows($('inspect-table'),[['Edge',`e${e.id} · v${e.a}–v${e.b}`],['Unit cost','1'],['Growth',`${Number(total.toFixed(2))} / 1 · ${total>=1-1e-9?'full':total?'partial':'not grown'}`],['Contributions',`v${e.a}: ${Number(p[0].toFixed(2))} · v${e.b}: ${Number(p[1].toFixed(2))}`],['Endpoint roots',`v${parentChain(e.a,s).at(-1)} · v${parentChain(e.b,s).at(-1)}`],['Role',s.correction.includes(e.id)?'Chosen correction':s.remaining.includes(e.id)?'Remaining forest edge':s.forest.includes(e.id)?'Peeled forest edge':total>=1-1e-9?'Full edge outside the chosen forest':'Outside the peeling forest']]);
    }
    $('reference').disabled=s.phase!=='done'||!reference?.available||editing;
    const comparison=$('comparison');comparison.replaceChildren();
    if(s.phase!=='done'){
      comparison.textContent='Advance to Correction to compare the three edge counts.';
      $('comparison-note').textContent='Global minimum → best inside the grown region → this peeling result.';
    }else if(!reference?.available){comparison.textContent=reference?.reason||'No reference is available.';$('comparison-note').textContent='The Union-Find walkthrough remains available.';}
    else{
      const table=document.createElement('table');table.className='table table-sm';const body=document.createElement('tbody');
      tableRows(body,[['Exact minimum',`${reference.cost} edges`],['Best in grown region',`${grownReference.cost} edges`],['This UF correction',`${s.correction.length} edges`]]);table.append(body);comparison.append(table);
      const regionGap=grownReference.cost-reference.cost,forestGap=s.correction.length-grownReference.cost;
      const message=[];
      if(regionGap)message.push(`Growth excludes all ${reference.cost}-edge solutions; any correction inside its region needs at least ${grownReference.cost} edges.`);
      if(forestGap)message.push(`This selected forest adds ${forestGap} edges beyond the best correction inside the grown region.`);
      if(!regionGap&&!forestGap)message.push('UF attains the minimum edge count for this example.');
      message.push('These costs compare corrections on the toy graph, not logical error rates.');
      $('comparison-note').textContent=message.join(' ');
    }
  }
  function prepareChoices(){
    const inspect=$('inspect');inspect.replaceChildren(new Option('Current operation','auto'));
    const vertices=document.createElement('optgroup');vertices.label='Vertices';
    for(const v of graph.nodes)vertices.append(new Option(`${nodeName(v.id)} · ${v.boundary?'boundary':v.name}`,`v${v.id}`));
    const edgesGroup=document.createElement('optgroup');edgesGroup.label='Edges';for(const e of graph.edges)edgesGroup.append(new Option(`e${e.id} · v${e.a}–v${e.b}`,`e${e.id}`));inspect.append(vertices,edgesGroup);
    const old=$('edit-node').value;$('edit-node').replaceChildren();for(const v of graph.nodes.filter(v=>!v.boundary))$('edit-node').append(new Option(`${v.name} · v${v.id}`,String(v.id)));if([...$('edit-node').options].some(o=>o.value===old))$('edit-node').value=old;
  }
  const reduced=()=>globalThis.matchMedia && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function el(type,attrs,parent=drawing,text) {const v=document.createElementNS(NS,type);for(const [key,value] of Object.entries(attrs||{}))v.setAttribute(key,value);if(text!==undefined)v.textContent=text;if(attrs?.['data-tooltip']){const t=document.createElementNS(NS,'title');t.textContent=attrs['data-tooltip'];v.appendChild(t);}parent.appendChild(v);return v;}
  const statusColor=g=>g && !g.active?'var(--viz-series-2)':'var(--viz-series-1)';
  function pause() { if(timer!==null) clearInterval(timer);timer=null;play.textContent='Play';play.setAttribute('aria-pressed','false'); }
  function draw() {
    if(animation!==null) {cancelAnimationFrame(animation);animation=null;}
    const s=trace.frames[index];
    const width=Math.max(280,svg.getBoundingClientRect().width || root.clientWidth || 736);
    const narrow=width<450,margin=narrow?25:42,minCol=graph.preset.boundary?0:1;
    const dx=(width-2*margin)/(7-minCol),dy=narrow?72:80,top=62,height=top+2*dy+($('ids').checked && s.phase==='done'?73:51);
    const position=id=>({x:margin+(graph.nodes[id].col-minCol)*dx,y:top+graph.nodes[id].row*dy});
    svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.setAttribute('height',height);
    drawing.replaceChildren();
    const growing=['seed','grow'].includes(s.phase),peeling=['peel','done'].includes(s.phase);
    const focusEdges=new Set(s.focusEdges),focusNodes=new Set(s.focusNodes),remaining=new Set(s.remaining),chosen=new Set(s.correction),removed=new Set(s.removed);
    const inspection=inspectTarget(s),inspectOpen=$('tab-inspect').getAttribute('aria-selected')==='true';
    if(inspectOpen && inspection.type==='v')focusNodes.add(inspection.id);
    const segment=(a,b,attrs)=>el('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,'stroke-linecap':'round',...attrs});
    if(graph.preset.boundary) {
      const bp=position(21);
      el('rect',{x:bp.x-8,y:top-22,width:16,height:2*dy+44,rx:4,fill:'var(--muted)',opacity:0.8});
      el('text',{x:bp.x-9,y:26,'text-anchor':'start'},drawing,'Boundary');
    }
    for(const e of graph.edges) {const a=position(e.a),b=position(e.b);segment(a,b,{stroke:'var(--graph-grid)','stroke-width':1.3});}
    const animated=[];
    if(s.phase!=='done') {
      for(const e of graph.edges) {
        const a=position(e.a),b=position(e.b),p=s.support[e.id];
        for(let side=0;side<2;side++) {
          const amount=p[side];if(amount<=0)continue;
          const start=side===0?a:b,end=side===0?b:a,node=side===0?e.a:e.b;
          const group=s.groups[s.nodeGroups[node]],color=statusColor(group);
          const target={x:start.x+(end.x-start.x)*amount,y:start.y+(end.y-start.y)*amount};
          const thick=segment(start,target,{stroke:color,'stroke-width':narrow?15:22,opacity:growing?0.15:0.065});
          const line=segment(start,target,{stroke:color,'stroke-width':growing?3:2,opacity:growing?0.72:0.16});
          if(lastCoordinates && index===lastIndex+1 && s.action==='growth') {
            const old=lastCoordinates[e.id][side];
            if(old<amount) animated.push({thick,line,start,end,old,amount});
          }
        }
      }
      for(const v of graph.nodes) {
        const group=s.groups[s.nodeGroups[v.id]];if(!group)continue;
        const p=position(v.id);
        el('circle',{cx:p.x,cy:p.y,r:narrow?12:16,fill:statusColor(group),opacity:growing?0.12:0.065});
      }
    }
    for(const eid of remaining) {
      const e=graph.edges[eid];segment(position(e.a),position(e.b),{stroke:'var(--foreground)','stroke-width':2,'stroke-dasharray':'5 5',opacity:0.62});
    }
    if(s.action==='discard') {
      for(const eid of s.focusEdges) {const e=graph.edges[eid];segment(position(e.a),position(e.b),{stroke:'var(--foreground)','stroke-width':2,'stroke-dasharray':'2 6',opacity:0.25});}
    }
    for(const eid of chosen) {
      const e=graph.edges[eid];segment(position(e.a),position(e.b),{stroke:'var(--viz-series-3)','stroke-width':5});
    }
    const showReference=$('reference').checked && reference?.available && s.phase==='done' && !editing;
    if(showReference)for(const eid of reference.edges){const e=graph.edges[eid];segment(position(e.a),position(e.b),{stroke:'var(--viz-series-5)','stroke-width':3,'stroke-dasharray':'7 5'});}
    $('reference-legend').style.display=showReference?'inline-flex':'none';
    $('root-legend').hidden=!['forest','peel'].includes(s.phase);
    $('cut-legend').hidden=s.phase!=='forest'||!graph.edges.some(e=>s.support[e.id][0]+s.support[e.id][1]>=1-1e-9&&!s.forest.includes(e.id));
    if(s.phase==='forest')for(const e of graph.edges){if(s.support[e.id][0]+s.support[e.id][1]<1-1e-9||s.forest.includes(e.id))continue;const a=position(e.a),b=position(e.b);el('circle',{cx:(a.x+b.x)/2,cy:(a.y+b.y)/2,r:8,fill:'var(--background)'});el('text',{x:(a.x+b.x)/2,y:(a.y+b.y)/2+4,'text-anchor':'middle'},drawing,'×');}
    if(s.action==='inspect') {
      for(const eid of s.focusEdges) {const e=graph.edges[eid];segment(position(e.a),position(e.b),{stroke:'var(--foreground)','stroke-width':3,'stroke-dasharray':'7 4'});}
    }
    if(inspectOpen && inspection.type==='e'){const e=graph.edges[inspection.id];segment(position(e.a),position(e.b),{stroke:'var(--foreground)','stroke-width':2,'stroke-dasharray':'2 4'});}
    for(const e of graph.edges){const hit=segment(position(e.a),position(e.b),{stroke:'transparent','stroke-width':18,class:'cursor-interaction','data-tooltip':`e${e.id} · v${e.a}–v${e.b} · ${Number((s.support[e.id][0]+s.support[e.id][1]).toFixed(2))}/1 grown`});hit.addEventListener('click',()=>{if(editing)return;$('inspect').value=`e${e.id}`;$('tab-inspect').click();draw();});}
    for(const v of graph.nodes) {
      const p=position(v.id),bit=peeling?s.bits[v.id]:v.syndrome;
      if(['forest','peel'].includes(s.phase)&&s.peelRoots.includes(v.id)){if(v.boundary)el('rect',{x:p.x-8,y:p.y-11,width:16,height:22,rx:2,fill:'none',stroke:'var(--foreground)','stroke-width':1.3});else el('circle',{cx:p.x,cy:p.y,r:narrow?11:13,fill:'none',stroke:'var(--foreground)','stroke-width':1.3});}
      const faded=peeling && removed.has(v.id) && !focusNodes.has(v.id) && !v.syndrome;
      if(focusNodes.has(v.id)) el('circle',{cx:p.x,cy:p.y,r:narrow?15:19,fill:'none',stroke:'var(--foreground)','stroke-width':1.4,'stroke-dasharray':'3 4',opacity:0.7});
      if(v.boundary) {
        el('rect',{x:p.x-4,y:p.y-7,width:8,height:14,fill:'var(--background)',stroke:'var(--muted-foreground)','stroke-width':1.5});
      } else if(bit) {
        el('circle',{cx:p.x,cy:p.y,r:narrow?7:8,fill:'var(--foreground)'});
      } else {
        el('circle',{cx:p.x,cy:p.y,r:narrow?4:5,fill:'var(--background)',stroke:'var(--muted-foreground)','stroke-width':1.2,opacity:faded?0.38:0.85});
      }
      if(v.label) {
        el('text',{x:p.x,y:p.y-(narrow?23:27),'text-anchor':'middle',class:'uf-letter'},drawing,v.label);
      }
      if($('ids').checked)el('text',{x:p.x,y:p.y+27,'text-anchor':'middle'},drawing,`v${v.id}`);
      if(s.action==='inspect' && focusNodes.has(v.id) && !v.label) el('text',{x:p.x,y:p.y-25,'text-anchor':'middle'},drawing,'leaf: 1');
      const hit=el('circle',{cx:p.x,cy:p.y,r:Math.min(21,dx/2-1),fill:'transparent',class:'cursor-interaction','data-tooltip':`${nodeName(v.id)} · ${v.boundary?'boundary':`input ${v.syndrome}, current ${s.bits[v.id]}`}`});
      hit.addEventListener('click',()=>{if(editing){if(!v.boundary)toggleDefect(v.id);}else{$('inspect').value=`v${v.id}`;$('tab-inspect').click();draw();}});
    }
    if(s.phase==='done') {
      el('text',{x:width/2,y:height-8,'text-anchor':'middle'},drawing,`${s.correction.length} edge${s.correction.length===1?'':'s'} · syndrome matched`);
    }
    note.textContent=editing?'Edit the syndrome, then run the decoder.':s.note;
    counter.textContent=`${index+1} / ${trace.frames.length} · ${s.title}`;
    $('scrub').max=trace.frames.length-1;$('scrub').value=index;$('scrub').disabled=editing;
    $('scrub').setAttribute('aria-valuetext',`${index+1} of ${trace.frames.length}: ${s.title}`);
    back.disabled=editing||index===0;first.disabled=editing||index===0;next.disabled=editing||index===trace.frames.length-1;
    play.disabled=editing||index===trace.frames.length-1;
    if(index===trace.frames.length-1)pause();
    for(const stage of stages) {stage.disabled=editing||!trace.frames.some(f=>f.phase===stage.dataset.phase);stage.setAttribute('aria-pressed',String(stage.dataset.phase===s.phase));if(stage.dataset.phase===s.phase)stage.setAttribute('aria-current','step');else stage.removeAttribute('aria-current');}
    clusters.replaceChildren();
    for(const g of s.groups) {
      const item=document.createElement('span');item.className='uf-cluster';
      const swatch=document.createElement('span');swatch.className='uf-swatch';swatch.style.background=statusColor(g);swatch.setAttribute('aria-hidden','true');
      const text=document.createElement('span');
      let status=g.boundary?'boundary · stopped':g.active?'odd · growing':'even · paused';
      if(!growing) status=g.boundary?'boundary-valid':g.count%2===0?'even':'odd · boundary-valid';
      text.textContent=`${g.label}: ${g.count} defect${g.count===1?'':'s'} · ${status}`;
      item.append(swatch,text);clusters.append(item);
    }
    root.querySelector('#uf-bit-key').textContent=['peel','done'].includes(s.phase)?'Residual bit 1':'Observed syndrome 1';
    updatePanels(s);
    document.dispatchEvent(new CustomEvent('uf-state',{detail:{graph,trace,fullTrace,s,index,reference,grownReference,editing}}));
    desc.textContent=`${graph.preset.name}. Step ${index+1} of ${trace.frames.length}. ${s.title}. ${s.note} ${s.groups.map(g=>`${g.label}: ${g.count} defects, ${g.boundary?'boundary reached':g.active?'odd and active':'even and paused'}`).join('. ')}.`;
    if(animated.length && !reduced()) {
      const start=performance.now();
      const animate=now=>{
        const t=Math.min(1,(now-start)/360),ease=1-Math.pow(1-t,3);
        for(const p of animated) {const amount=p.old+(p.amount-p.old)*ease;for(const line of [p.thick,p.line]){line.setAttribute('x2',p.start.x+(p.end.x-p.start.x)*amount);line.setAttribute('y2',p.start.y+(p.end.y-p.start.y)*amount);}}
        if(t<1)animation=requestAnimationFrame(animate);else animation=null;
      };
      animation=requestAnimationFrame(animate);
    }
    lastCoordinates=s.support;lastIndex=index;
  }
  function filterTrace(raw=0){trace={...fullTrace,frames:fullTrace.frames.filter(s=>$('micro').checked||!s.micro)};index=trace.frames.findIndex(s=>s.raw>=raw);if(index<0)index=trace.frames.length-1;lastCoordinates=null;lastIndex=-2;}
  function compile(key,defects,boundary){
    graph=makeGraph(key,defects,boundary);fullTrace=run(graph,{forestStrategy:$('forest-mode').value});reference=fullTrace.valid?minimumCorrection(graph):null;grownReference=fullTrace.valid?minimumCorrection(graph,fullTrace.fullEdges):null;
    filterTrace();prepareChoices();$('reference').checked=false;
  }
  function refreshEditor(){
    compile('custom',draft,draftBoundary);
    $('editor-status').textContent=`${draft.length} defect${draft.length===1?'':'s'} selected`;
    $('editor-error').hidden=fullTrace.valid;$('editor-error').textContent=fullTrace.error||'';$('run').disabled=!fullTrace.valid;
    index=0;draw();
  }
  function toggleDefect(id){const v=graph.nodes[id];if(!v||v.boundary)return;const i=draft.findIndex(p=>p[0]===v.col&&p[1]===v.row);if(i>=0)draft.splice(i,1);else draft.push([v.col,v.row]);draft.sort((a,b)=>a[1]-b[1]||a[0]-b[0]);refreshEditor();}
  function load(key){pause();editing=key==='custom';$('editor').hidden=!editing;$('edit').hidden=editing;if(editing){$('boundary').checked=draftBoundary;refreshEditor();}else{compile(key);draw();}}
  function go(i){pause();index=Math.max(0,Math.min(trace.frames.length-1,i));draw();}
  select.addEventListener('change',()=>load(select.value));
  next.addEventListener('click',()=>{pause();if(index<trace.frames.length-1){index++;draw();}});
  back.addEventListener('click',()=>{pause();if(index>0){index--;draw();}});
  first.addEventListener('click',()=>{pause();index=0;draw();});
  function startPlayback(){
    if(timer!==null){pause();return;}
    if(index>=trace.frames.length-1||editing)return;
    play.textContent='Pause';play.setAttribute('aria-pressed','true');
    index++;draw();
    if(index<trace.frames.length-1)timer=setInterval(()=>{if(index<trace.frames.length-1){index++;draw();}else pause();},Number($('speed').value));
  }
  play.addEventListener('click',startPlayback);
  $('speed').addEventListener('change',()=>{if(timer!==null){pause();startPlayback();}});
  $('scrub').addEventListener('input',()=>go(Number($('scrub').value)));
  $('micro').addEventListener('change',()=>{pause();const raw=trace.frames[index].raw;filterTrace(raw);draw();});
  $('ids').addEventListener('change',()=>draw());
  $('inspect').addEventListener('change',()=>draw());
  $('reference').addEventListener('change',()=>draw());
  for(const stage of stages)stage.addEventListener('click',()=>{const i=trace.frames.findIndex(s=>s.phase===stage.dataset.phase);if(i>=0)go(i);});
  for(const tab of root.querySelectorAll('[role="tab"]'))tab.addEventListener('click',()=>setTimeout(()=>draw(),0));
  $('edit').addEventListener('click',()=>{draft=graph.nodes.filter(v=>v.syndrome).map(v=>[v.col,v.row]);draftBoundary=graph.preset.boundary;select.value='custom';load('custom');});
  $('toggle-defect').addEventListener('click',()=>toggleDefect(Number($('edit-node').value)));
  $('clear').addEventListener('click',()=>{draft=[];refreshEditor();});
  $('boundary').addEventListener('change',()=>{draftBoundary=$('boundary').checked;refreshEditor();});
  $('run').addEventListener('click',()=>{if(!fullTrace.valid)return;editing=false;$('editor').hidden=true;$('edit').hidden=false;index=0;draw();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
  if(typeof ResizeObserver!=='undefined')new ResizeObserver(()=>{lastCoordinates=null;draw();}).observe(svg);
  root.ufInspect=()=>({key:select.value,index,total:trace.frames.length,state:trace.frames[index],valid:trace.valid,graph,trace,fullTrace,reference,grownReference,editing});
  $('forest-mode').addEventListener('change',()=>{pause();const phase=trace.frames[index].phase;compile(graph.key,graph.nodes.filter(v=>v.syndrome).map(v=>[v.col,v.row]),graph.preset.boundary);const i=trace.frames.findIndex(f=>f.phase===phase);index=Math.max(0,i);draw();});
  document.addEventListener('keydown',e=>{if(root.hidden)return;if(e.target.closest('a,button,input,select,textarea,summary,[role="button"],[role="tab"],[contenteditable=""],[contenteditable="true"]')||e.altKey||e.ctrlKey||e.metaKey)return;if(e.key==='ArrowRight'){e.preventDefault();next.click();}if(e.key==='ArrowLeft'){e.preventDefault();back.click();}if(e.code==='Space'){e.preventDefault();play.click();}});
  load('pair');
})();
