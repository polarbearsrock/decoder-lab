(() => {
  'use strict';
  const M=globalThis.__surfaceModel, F=globalThis.__surfaceConfidence, R=globalThis.__surfaceCatalog, dataset=globalThis.__surfaceCatalogReference, patch=M.makePatch(5), presets=M.examples(patch);
  const root=document.getElementById('logical-lab'), $=id=>document.getElementById('sc-'+id);
  const NS='http://www.w3.org/2000/svg';
  let selected='likelihood-crossover',error=presets.find(p=>p.id===selected).error.slice(),data,analysis;
  let confidenceP=.1,spectrum=null,spectrumKey='',posterior=null,neighborRows=null,neighborOrigin=null;
  let posteriorSpectrum=null,confidencePlot=null,confidenceTable=null;
  const confidenceCurveSamples=new WeakMap();
  let forestStrategy='bfs',referenceView='correction',sampleOrigin=null;
  let view='decomposition',editing=false,traceIndex=0,timer=null,frames=[];
  let focusedQubit=0;
  const viewButtons=[...root.querySelectorAll('[data-sc-view]')];
  const colors={error:'var(--sc-error)',correction:'var(--viz-series-3)',residual:'var(--viz-series-5)',logical:'var(--muted-foreground)',stabilizer:'var(--viz-series-1)',cut:'var(--viz-series-2)'};
  const views={
    error:['Actual error E','Orange edges carry physical Z errors. Filled circles are the X checks they violate. E is known to the simulation; it is not given to UF.'],
    syndrome:['Syndrome seen by UF','Only the violated X checks are revealed. Many physical error patterns, including different logical classes, produce exactly these same bits.'],
    trace:['Uniform-growth UF','Follow the same UF engine on this surface-code graph. The actual error is hidden: growth and peeling use only the syndrome and allowed boundaries.'],
    correction:['Decoder correction C','Green edges are the Z correction returned by UF. They reproduce the observed syndrome. Matching those check bits does not guarantee logical recovery.'],
    residual:['Product CE = E ⊕ C','Combine the two supports modulo 2. A qubit hit by both E and C cancels because Z² = I. The remaining operator has no measured syndrome.'],
    decomposition:['CE = logical × stabilizer','Purple is the remaining operator. The dashed middle-row Z̄ and the shaded stabilizers multiply to it; shared edges cancel.'],
    overlay:['Error and correction together','Orange is E only; green is C only. Dashed edges marked × are hit by both operators and cancel because Z² = I. The remaining orange and green edges form CE.']
  };
  function svgEl(parent,tag,attrs={},text) {
    const e=document.createElementNS(NS,tag);
    for(const [k,v] of Object.entries(attrs)) e.setAttribute(k,v);
    if(text!==undefined) e.textContent=text;
    parent.append(e);return e;
  }
  const supportText=ids=>ids.length?ids.map(id=>'q'+id).join(', '):'∅';
  const stabilizerHTML=ids=>ids.length>5?'∏<sub>i∈A</sub> S<sub>i</sub>':ids.length?ids.map(id=>`S<sub>${id+1}</sub>`).join(' '):'I';
  function stop(){if(timer!==null)clearInterval(timer);timer=null;$('trace-play').textContent='Play';$('trace-play').setAttribute('aria-pressed','false');}
  function invalidateShare(){for(const id of ['share-url','share-label','copy-link'])$(id).hidden=true;}
  function focusWorkspace(){ $('workspace-title').focus({preventScroll:true});root.scrollIntoView({block:'start'}); }
  function updateQubitState(){
    const id=Number($('qubit').value),present=data.error.includes(id);
    $('qubit-state').textContent=`q${id}: ${present?'Z error present':'no Z error'}.`;
    $('toggle-qubit').textContent=present?'Remove Z':'Add Z';
  }

  function geometry(svg,mini=false) {
    const width=Math.max(mini?240:260,svg.getBoundingClientRect().width||600),narrow=width<420;
    const margin=mini?26:(narrow?35:45),top=mini?20:67,dy=mini?38:(narrow?46:56);
    const dx=(width-2*margin)/patch.d,height=top+(patch.d-1)*dy+(mini?28:49);
    svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.setAttribute('height',height);
    return {width,margin,top,dy,dx,height,narrow,pos:v=>({x:margin+v.col*dx,y:top+v.row*dy})};
  }
  function drawPatch(svg,{chain=[],color='var(--foreground)',bits=[],faces=[],logical=false,cut=false,ids=false,edit=false,trace=null,mini=false,edgeColors={},cancelled=[]}={}) {
    let drawing;
    if(svg===$('graph')) {drawing=$('drawing');drawing.replaceChildren();}
    else {svg.replaceChildren();drawing=svg;}
    const g=geometry(svg,mini),nodePos=id=>g.pos(patch.nodes[id]);
    const line=(a,b,attrs)=>svgEl(drawing,'line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,'stroke-linecap':'round',...attrs});
    const edgeLine=(id,attrs,offset=0)=>{const e=patch.edges[id],a=nodePos(e.a),b=nodePos(e.b);return line({x:a.x,y:a.y+offset},{x:b.x,y:b.y+offset},attrs);};
    const text=(x,y,value,attrs={})=>svgEl(drawing,'text',{x,y,fill:'var(--muted-foreground)','font-size':mini?11:12,'text-anchor':'middle',...attrs},value);
    for(const col of [0,patch.d]) {
      const p=g.pos({col,row:0});svgEl(drawing,'rect',{x:p.x-8,y:p.y-12,width:16,height:4*g.dy+24,rx:5,fill:'var(--muted)'});
    }
    if(!mini) {
      text(g.width/2,23,'Smooth boundary');text(g.width/2,g.height-7,'Smooth boundary');
      text(13,g.top+2*g.dy,'Rough boundary',{transform:`rotate(-90 13 ${g.top+2*g.dy})`});
      text(g.width-13,g.top+2*g.dy,'Rough boundary',{transform:`rotate(90 ${g.width-13} ${g.top+2*g.dy})`});
    }
    for(const fid of faces) {
      const f=patch.faces[fid],p=g.pos(f);
      svgEl(drawing,'rect',{x:p.x+2,y:p.y+2,width:g.dx-4,height:g.dy-4,rx:3,fill:'var(--viz-series-1)',opacity:.12});
      for(const eid of f.edges) edgeLine(eid,{stroke:'var(--viz-series-1)','stroke-width':1.5,'stroke-dasharray':'3 4',opacity:.75});
      text(p.x+g.dx/2,p.y+g.dy/2+4,`S${fid+1}`,{fill:'var(--viz-series-1)','font-size':mini?11:12});
    }
    for(const e of patch.edges) edgeLine(e.id,{stroke:'var(--graph-grid)','stroke-width':mini?1:1.3});
    if(cut) {
      const x=g.margin+(Math.floor(patch.d/2)+.5)*g.dx;
      line({x,y:g.top-18},{x,y:g.top+4*g.dy+20},{stroke:colors.cut,'stroke-width':1.6,'stroke-dasharray':'4 5',opacity:.85});
      if(!mini) text(x+8,g.top-26,'X̄',{fill:colors.cut,'text-anchor':'start','font-size':14});
    }
    if(trace) {
      for(const e of patch.edges) {
        const a=nodePos(e.a),b=nodePos(e.b);
        for(const side of [0,1]) {
          const amount=trace.support[e.id][side];if(!amount)continue;
          const start=side?b:a,end=side?a:b,group=trace.groups[trace.nodeGroups[side?e.b:e.a]];
          const c=group?.active?'var(--viz-series-1)':'var(--viz-series-2)';
          const target={x:start.x+(end.x-start.x)*amount,y:start.y+(end.y-start.y)*amount};
          line(start,target,{stroke:c,'stroke-width':12,opacity:.22});
          line(start,target,{stroke:c,'stroke-width':2,opacity:.75});
        }
      }
      if(['forest','peel'].includes(trace.phase)) for(const id of trace.remaining) edgeLine(id,{stroke:'var(--foreground)','stroke-width':2,'stroke-dasharray':'5 4'});
    }
    if(logical) for(const id of patch.logicalZ) edgeLine(id,{stroke:colors.logical,'stroke-width':2,'stroke-dasharray':'5 4'},-5);
    for(const id of chain) edgeLine(id,{stroke:edgeColors[id]||color,'stroke-width':mini?4:5.5,...(cancelled.includes(id)?{'stroke-dasharray':'3 5','stroke-width':2}:{} )});
    // Small ticks mark the data qubits; vertices are parity checks, not data qubits.
    for(const e of patch.edges) {
      const a=nodePos(e.a),b=nodePos(e.b),x=(a.x+b.x)/2,y=(a.y+b.y)/2,on=chain.includes(e.id);
      if(cancelled.includes(e.id)){
        svgEl(drawing,'circle',{cx:x,cy:y,r:7,fill:'var(--background)'});
        line({x:x-3,y:y-3},{x:x+3,y:y+3},{stroke:'var(--muted-foreground)','stroke-width':1.5});
        line({x:x-3,y:y+3},{x:x+3,y:y-3},{stroke:'var(--muted-foreground)','stroke-width':1.5});
      }else if(!mini) svgEl(drawing,'circle',{cx:x,cy:y,r:edit?3.4:2.3,fill:on?(edgeColors[e.id]||color):'var(--muted-foreground)',opacity:on?1:.6});
      if(ids&&!mini) text(x+(e.kind==='v'?6:0),y+(e.kind==='v'?4:15),`q${e.id}`,{'text-anchor':e.kind==='v'?'start':'middle','font-size':11});
    }
    for(const v of patch.nodes) {
      const p=nodePos(v.id);
      if(v.boundary) svgEl(drawing,'rect',{x:p.x-3,y:p.y-4,width:6,height:8,rx:1,fill:'var(--background)',stroke:'var(--muted-foreground)','stroke-width':1});
      else {
        const c=svgEl(drawing,'circle',{cx:p.x,cy:p.y,r:bits[v.id]?5.3:(mini?2.5:3.3),fill:bits[v.id]?'var(--foreground)':'var(--background)',stroke:'var(--muted-foreground)','stroke-width':1});
        svgEl(c,'title',{},`X${v.id+1}: ${bits[v.id]?'−1, defect':'+1, satisfied'}`);
        if(trace&&data.graph.nodes[v.id].label)text(p.x+8,p.y-8,data.graph.nodes[v.id].label,{'text-anchor':'start','font-size':11,fill:'var(--foreground)'});
      }
    }
    if(!mini) for(const e of patch.edges) {
      const a=nodePos(e.a),b=nodePos(e.b),horizontal=e.kind==='h';
      const hit=svgEl(drawing,'rect',{x:horizontal?a.x+7:a.x-9,y:horizontal?a.y-9:a.y+7,width:horizontal?b.x-a.x-14:18,height:horizontal?18:b.y-a.y-14,rx:3,fill:'transparent',...(edit?{class:'sc-edge-hit',role:'button',tabindex:e.id===focusedQubit?0:-1,'data-qubit':e.id,'aria-label':`Toggle Z error on q${e.id}`,'aria-pressed':String(data.error.includes(e.id))}:{})});
      svgEl(hit,'title',{},`q${e.id}${edit?': click to toggle a Z error':cancelled.includes(e.id)?': E and C both act; the two Z operators cancel':chain.includes(e.id)?': selected operator acts here':''}`);
      if(edit){
        hit.addEventListener('focus',()=>{focusedQubit=e.id;$('qubit').value=String(e.id);updateQubitState();$('drawing').querySelectorAll('.sc-edge-hit').forEach(q=>q.setAttribute('tabindex',q===hit?'0':'-1'));});
        hit.addEventListener('click',()=>{focusedQubit=e.id;toggleQubit(e.id);});
        hit.addEventListener('keydown',event=>{
          if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();toggleQubit(e.id);}
          else if(['ArrowRight','ArrowDown','ArrowLeft','ArrowUp','Home','End'].includes(event.key)){
            event.preventDefault();event.stopPropagation();
            const next=event.key==='Home'?0:event.key==='End'?patch.n-1:(e.id+(['ArrowRight','ArrowDown'].includes(event.key)?1:patch.n-1))%patch.n;
            $('drawing').querySelector(`[data-qubit="${next}"]`)?.focus();
          }
        });
      }
    }
  }

  function legend(items) {
    $('legend').replaceChildren();
    for(const [label,color,style] of items) {
      const span=document.createElement('span'),mark=document.createElement('i');mark.setAttribute('aria-hidden','true');
      if(color)mark.style.borderColor=color;if(style)mark.className=style;
      span.append(mark,document.createTextNode(label));$('legend').append(span);
    }
  }
  function drawMain(){
    if(root.hidden)return;
    const activeQubit=document.activeElement?.getAttribute('data-qubit');
    const frame=frames[traceIndex],params={cut:$('cut').checked&&view!=='syndrome',ids:$('ids').checked};
    let items=[];
    if(view==='error'){Object.assign(params,{chain:data.error,color:colors.error,bits:data.observed,edit:editing});items=[['Z error E',colors.error],['Violated X check',null,'dot']];}
    if(view==='syndrome'){params.bits=data.observed;items=[['Violated X check',null,'dot'],['Data-qubit edge','var(--graph-grid)']];}
    if(view==='correction'){Object.assign(params,{chain:data.correction,color:colors.correction,bits:data.observed});items=[['Correction C',colors.correction],['Input syndrome',null,'dot']];}
    if(view==='residual'){Object.assign(params,{chain:data.residual,color:colors.residual});items=[['Remaining CE',colors.residual]];}
    if(view==='decomposition'){Object.assign(params,{chain:data.residual,color:colors.residual,faces:data.result.stabilizers,logical:!!data.result.logical});items=[['CE',colors.residual],['Logical L',colors.logical,'dashed'],['Z stabilizer S',colors.stabilizer]];}
    if(view==='overlay'){
      const both=data.error.filter(q=>data.correction.includes(q)),chain=[...new Set([...data.error,...data.correction])];
      Object.assign(params,{chain,bits:data.observed,cancelled:both,edgeColors:Object.fromEntries(chain.map(q=>[q,both.includes(q)?'var(--muted-foreground)':data.error.includes(q)?colors.error:colors.correction]))});
      items=[['E only',colors.error],['C only',colors.correction],['Both · cancel','var(--muted-foreground)','dashed']];
    }
    if(view==='trace'){Object.assign(params,{chain:frame.correction,color:colors.correction,bits:frame.bits,trace:frame,cut:false});items=[['Grown region','var(--viz-series-1)'],['Remaining forest','var(--foreground)','dashed'],['Correction C',colors.correction]];}
    if(params.cut)items.push(['X̄ reference',colors.cut,'dashed']);
    drawPatch($('graph'),params);legend(items);
    $('graph').setAttribute('role',editing?'group':'img');
    if(editing&&activeQubit!==null)$('drawing').querySelector(`[data-qubit="${activeQubit}"]`)?.focus({preventScroll:true});
    $('view-title').textContent=views[view][0];
    $('view-meta').textContent=view==='trace'?`${frame.phase.toUpperCase()} · round ${frame.tick}`:view==='syndrome'?`${data.observed.reduce((a,b)=>a+b,0)} defects`:view==='decomposition'?`ℓ = ${data.result.logical}`:`${params.chain?.length||0} qubits`;
    $('view-note').textContent=view==='trace'?frame.note:views[view][1];
    $('graph-desc').textContent=`${views[view][0]}. ${$('view-meta').textContent}. ${views[view][1]} Left and right boundaries are rough. Top and bottom boundaries are smooth.`;
    $('trace-controls').hidden=view!=='trace';
    $('trace-title').textContent=frame.title;$('trace-count').textContent=`${traceIndex+1} / ${frames.length}`;
    $('trace-scrub').max=frames.length-1;$('trace-scrub').value=traceIndex;
    $('trace-scrub').setAttribute('aria-valuetext',`Step ${traceIndex+1} of ${frames.length}: ${frame.title}`);
    $('trace-back').disabled=$('trace-start').disabled=traceIndex===0;
    $('trace-next').disabled=$('trace-end').disabled=traceIndex===frames.length-1;
    $('trace-play').disabled=traceIndex===frames.length-1;
    $('editor').hidden=!editing;$('edit').setAttribute('aria-pressed',String(editing));$('edit').textContent=editing?'Done editing':'Edit error E';
    const cutHidden=view==='syndrome'||view==='trace';$('cut').disabled=cutHidden;
    $('cut').parentElement.title=cutHidden?'The logical reference is hidden while showing the decoder’s syndrome information.':'';
    if(editing)updateQubitState();
    viewButtons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.scView===view)));
    if(view==='trace')renderClusters(frame);
  }
  function drawFactors(){
    if(root.hidden)return;
    drawPatch($('logical-factor'),{mini:true,chain:data.result.logical?patch.logicalZ:[],color:colors.residual,cut:true});
    drawPatch($('stabilizer-factor'),{mini:true,chain:data.result.stabilizerEdges,color:colors.stabilizer,faces:data.result.stabilizers});
    drawReferences();
    drawConfidenceCurve();
  }
  function renderResult(){
    const r=data.result,sHTML=stabilizerHTML(r.stabilizers),logical=r.logical?'Z̄':'I';
    const rhs=r.logical?(r.stabilizers.length?'Z̄ '+sHTML:'Z̄'):sHTML;
    $('equation').innerHTML='CE = '+rhs;
    $('result-badge').textContent=r.logical?'Logical Z error':'Logical success';$('result-badge').classList.toggle('failure',!!r.logical);
    $('outcome-note').textContent=r.logical?'Every measured check is satisfied, but a nontrivial logical Z remains. The encoded phase is not recovered.':data.residual.length?'The correction differs from the error by a stabilizer. Their product acts as identity on the encoded state.':'The correction cancels the error exactly. No residual physical or logical operator remains.';
    $('syndrome-result').textContent='0 / 20 violated';$('logical-result').textContent=r.logical?'1 · nontrivial':'0 · trivial';
    $('error-weight').textContent=data.error.length;$('correction-weight').textContent=data.correction.length;$('residual-weight').textContent=data.residual.length;
    $('l-factor').textContent=logical;$('s-factor').innerHTML=sHTML;
    $('l-caption').textContent=r.logical?'The fixed middle-row Z̄ joins the two rough boundaries. It anticommutes with the vertical X̄ reference.':'L = I. No logical operator is needed to reconstruct CE.';
    $('s-caption').textContent=r.stabilizers.length?`${r.stabilizers.length} Z stabilizer${r.stabilizers.length===1?'':'s'}; shared edges cancel. Each acts as +1 on the code space.${r.stabilizers.length>5?' A = {'+r.stabilizers.map(i=>i+1).join(', ')+'}.':''}`:'S = I: the empty stabilizer product.';
    const n=r.cutCrossings.length;
    $('crossings').textContent=n?`${n} residual qubit${n===1?'':'s'} overlap${n===1?'s':''} the X̄ representative: ${supportText(r.cutCrossings)}.`:'No residual qubits overlap the X̄ representative.';
    $('parity-readout').textContent=`${n} mod 2 = ${r.logical}`;$('verified').textContent='✓ Exact stabilizer reconstruction verified.';
    const supports=$('supports');supports.replaceChildren();
    for(const [label,ids] of [['E',data.error],['C',data.correction],['CE',data.residual],['L',r.logical?patch.logicalZ:[]],['S',r.stabilizerEdges],['X̄',patch.logicalX]]) {
      const p=document.createElement('p');p.textContent=label+' = {'+supportText(ids)+'}';supports.append(p);
    }
    for(const id of r.stabilizers){const p=document.createElement('p');p.textContent=`S${id+1} = {${supportText(patch.faces[id].edges)}}`;supports.append(p);}
    drawMain();drawFactors();
  }
  const forestNames={bfs:'BFS','reverse-bfs':'Reverse BFS',dfs:'DFS'};
  function badge(logical){const span=document.createElement('span');span.className='sc-badge'+(logical?' failure':'');span.textContent=logical?'Logical failure':'Success';return span;}
  function tableRow(parent,values){const tr=document.createElement('tr');for(const value of values){const td=document.createElement('td');if(value instanceof Node)td.append(value);else td.textContent=String(value);tr.append(td);}parent.append(tr);return tr;}
  function renderClusters(frame){
    $('trace-metrics').replaceChildren();
    for(const [value,label]of [[frame.groups.filter(g=>g.active).length,'active clusters'],[frame.support.filter(s=>s[0]+s[1]>=1).length,'fully grown edges'],[frame.bits.reduce((a,b)=>a+b,0),'residual defects']]){
      const div=document.createElement('div'),strong=document.createElement('strong'),span=document.createElement('span');strong.textContent=value;span.textContent=label;div.append(strong,span);$('trace-metrics').append(div);
    }
    $('cluster-rows').replaceChildren();
    for(const g of frame.groups)tableRow($('cluster-rows'),[g.label||'—',g.count,g.members.length,g.active?'Active · odd':g.boundary?'Stopped · boundary':'Stopped · even']);
    if(!frame.groups.length)tableRow($('cluster-rows'),['No defect clusters',0,0,'No growth needed']);
    $('jump-merge').disabled=!frames.some(f=>f.action==='merge');$('jump-reactivate').disabled=!frames.some(f=>f.reactivated);
  }
  function drawReferences(){
    if(!analysis||root.hidden)return;
    for(const i of [0,1]){
      const ref=analysis.exact.sectors[analysis.parity^i],chain=referenceView==='correction'?ref.correction:M.xor(data.error,ref.correction);
      drawPatch($(`ref-${i}-graph`),{mini:true,chain,color:referenceView==='correction'?colors.correction:colors.residual,bits:referenceView==='correction'?data.observed:[],cut:true});
      $(`ref-${i}-graph`).setAttribute('aria-label',`${referenceView==='correction'?'Correction':'Residual'} for ${i?'the opposite class':'UF’s class'}: ${chain.length} qubits`);
      $(`ref-${i}-caption`).textContent=referenceView==='correction'?`One of ${ref.count} minimum-weight representatives. Filled checks show the common input syndrome.`:`C${i?'₁':'₀'}E has ${chain.length} qubits and ${M.cutParity(patch,chain)} mod-2 intersection with X̄. All measured checks are satisfied.`;
    }
    root.querySelectorAll('[data-sc-reference]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.scReference===referenceView)));
  }
  function renderResearch(){
    const focusedForest=$('forest-rows').contains(document.activeElement)?document.activeElement.getAttribute('aria-label'):null;
    for(const i of [0,1]){
      const ref=analysis.exact.sectors[analysis.parity^i],logical=ref.parity^analysis.truth;
      $(`ref-${i}-weight`).textContent=ref.weight;$(`ref-${i}-count`).textContent=ref.count;
      const b=$(`ref-${i}-outcome`);b.textContent=logical?'Logical failure for E':'Success for E';b.classList.toggle('failure',!!logical);
    }
    const w0=analysis.exact.sectors[analysis.parity].weight,w1=analysis.exact.sectors[analysis.parity^1].weight;
    $('gap-equation').textContent=`Δ = ${w1} − ${w0} = ${analysis.gap}`;
    $('gap-note').textContent=analysis.gap===0?'The classes tie in minimum weight. Weight alone cannot select a unique logical class.':analysis.gap>0?`UF’s class has a lower minimum weight by ${analysis.gap}. This favors that class under a minimum-weight rule; it does not certify recovery.`:`The opposite class has a lower minimum weight by ${-analysis.gap}. UF has not selected the globally minimum-weight class.`;
    $('reference-check').textContent='Verified: both witnesses reproduce the syndrome and differ by logical Z̄ times a stabilizer. Each count refers to distinct qubit supports.';
    $('growth-title').textContent=!analysis.correctClassInGrowth?'Growth excludes every successful correction for this E.':data.result.logical?'Successful recovery is possible inside this grown region.':'UF selects a successful correction inside its grown region.';
    $('growth-note').textContent=!analysis.correctClassInGrowth?'The successful logical class is infeasible when correction edges are restricted to UF’s fully grown support. No change confined to peeling that support can recover this E. Growth decisions must change.':data.result.logical?'The exact restricted solve finds a correction in the successful class. This UF forest selects the other class. Compare the forests below; a different correction inside the same support can recover E.':'Compare the weights below to see whether a different forest can shorten C. Extra physical correction edges do not themselves imply a logical error.';
    $('growth-rows').replaceChildren();
    for(const i of [0,1]){const parity=analysis.parity^i;tableRow($('growth-rows'),[i?'C₁ · opposite class':'C₀ · UF’s class',analysis.exact.sectors[parity].weight,analysis.grown.sectors[parity].weight??'Impossible']);}
    const grownWeight=analysis.grown.sectors[analysis.parity].weight;
    $('cost-note').textContent=`Within UF’s class: |C| = ${data.correction.length}; minimum on grown edges = ${grownWeight}; full-patch minimum = ${w0}. Peeling adds ${analysis.peelingExcess} edge${analysis.peelingExcess===1?'':'s'} above the grown-region minimum; restricting growth adds ${analysis.growthPenalty} above the full-patch minimum.`;
    $('forest-rows').replaceChildren();
    for(const variant of analysis.variants){
      const chosen=variant.strategy===forestStrategy,button=document.createElement('button');button.className='btn btn-ghost';button.textContent=chosen?'Selected':'Use '+forestNames[variant.strategy];button.setAttribute('aria-pressed',String(chosen));button.setAttribute('aria-label','Use '+forestNames[variant.strategy]+' forest');button.addEventListener('click',()=>{if(variant.strategy!==forestStrategy)changeForest(variant.strategy);});
      tableRow($('forest-rows'),[forestNames[variant.strategy],variant.correction.length,badge(variant.logical),button]).classList.toggle('sc-forest-selected',chosen);
      if(focusedForest===button.getAttribute('aria-label'))button.focus({preventScroll:true});
    }
    $('run-metrics').textContent=`${analysis.rounds} half-edge growth rounds · ${analysis.unions} unions · ${analysis.reactivations} merge batch${analysis.reactivations===1?'':'es'} with an even-to-odd transition · ${data.trace.fullEdges.length} fully grown edges.`;
  }
  const percent=value=>value===null?'—':value>0&&value<.000001?(value*100).toExponential(2)+'%':(value*100).toFixed(2)+'%';
  function drawConfidenceCurve(){
    if(!spectrum||root.hidden)return;
    const svg=$('confidence-curve'),g=$('confidence-curve-drawing');
    const width=Math.max(250,svg.getBoundingClientRect().width||520),height=260,left=44,right=16,top=29,bottom=42;
    if(!confidencePlot||confidencePlot.spectrum!==spectrum||confidencePlot.parity!==analysis.parity||confidencePlot.width!==width){
      // A prior changes the marker, not the fixed-syndrome curve. Keep both
      // parity curves so switching forests back does not repeat their solves.
      let cached=confidenceCurveSamples.get(spectrum);
      if(!cached){cached=[null,null];confidenceCurveSamples.set(spectrum,cached);}
      if(!cached[analysis.parity])cached[analysis.parity]=Array.from({length:101},(_,i)=>{
        const result=F.posterior(spectrum,i/200,analysis.parity);
        return result.available?result.ufFailureProbability:null;
      });
      g.replaceChildren();svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.setAttribute('height',height);
      const x=p=>left+p/.5*(width-left-right),y=p=>height-bottom-p*(height-top-bottom);
      const label=(px,py,value,anchor='middle')=>svgEl(g,'text',{x:px,y:py,'text-anchor':anchor,fill:'var(--muted-foreground)','font-size':12},value);
      for(const value of [0,.5,1]){svgEl(g,'line',{x1:left,y1:y(value),x2:width-right,y2:y(value),stroke:'var(--border)','stroke-dasharray':value===.5?'4 4':''});label(left-8,y(value)+4,Math.round(value*100)+'%','end');}
      for(const p of [0,.1,.2,.3,.4,.5])label(x(p),height-bottom+20,Math.round(p*100)+'%');
      label(left,15,'P(UF failure | s, p)','start');label((left+width-right)/2,height-3,'Assumed per-qubit Z error probability');
      let path='',started=false;
      cached[analysis.parity].forEach((probability,i)=>{
        if(probability===null){started=false;return;}
        path+=(started?' L ':'M ')+x(i/200).toFixed(2)+' '+y(probability).toFixed(2);started=true;
      });
      svgEl(g,'path',{d:path,fill:'none',stroke:'var(--viz-series-5)','stroke-width':2.5,'stroke-linejoin':'round'});
      const marker=svgEl(g,'g',{'data-confidence-marker':''});
      const guide=svgEl(marker,'line',{y1:top,y2:height-bottom,stroke:'var(--muted-foreground)','stroke-dasharray':'3 5',opacity:.7});
      const point=svgEl(marker,'circle',{r:5,fill:'var(--viz-series-5)',stroke:'var(--background)','stroke-width':2});
      const title=svgEl(point,'title');
      confidencePlot={spectrum,parity:analysis.parity,width,marker,guide,point,title,x,y};
    }
    // renderResult can request a resize before renderConfidence has updated the
    // readout. Never draw the previous syndrome's marker on this new curve.
    const current=posteriorSpectrum===spectrum&&posterior?.referenceParity===analysis.parity&&posterior.p===confidenceP;
    const plot=confidencePlot;
    plot.marker.setAttribute('display',current&&posterior.available?'inline':'none');
    if(current&&posterior.available){
      const px=plot.x(confidenceP);plot.guide.setAttribute('x1',px);plot.guide.setAttribute('x2',px);
      plot.point.setAttribute('cx',px);plot.point.setAttribute('cy',plot.y(posterior.ufFailureProbability));
      plot.title.textContent=`p = ${percent(confidenceP)}: conditional failure probability ${percent(posterior.ufFailureProbability)}`;
    }
    if(current)$('confidence-curve-desc').textContent=`The input syndrome and UF correction are fixed. At assumed p = ${percent(confidenceP)}, conditional UF failure is ${posterior.available?percent(posterior.ufFailureProbability):'undefined because the syndrome has zero probability'}. The horizontal dashed line marks 50%.`;
  }
  function renderConfidence(){
    if(posteriorSpectrum!==spectrum||!posterior||posterior.p!==confidenceP||posterior.referenceParity!==analysis.parity){
      posterior=F.posterior(spectrum,confidenceP,analysis.parity);posteriorSpectrum=spectrum;
    }
    $('confidence-p').value=confidenceP*100;$('confidence-number').value=Number((confidenceP*100).toPrecision(12));
    $('confidence-p').setAttribute('aria-valuetext',`${Number((confidenceP*100).toPrecision(12))}% assumed per-qubit Z error probability (p = ${confidenceP})`);
    root.querySelectorAll('[data-sc-prior]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.scPrior)===confidenceP)));
    $('confidence-zero').textContent=percent(posterior.ufSuccessProbability);$('confidence-one').textContent=percent(posterior.ufFailureProbability);
    $('confidence-bar-zero').style.width=(posterior.available?posterior.ufSuccessProbability*100:50)+'%';
    $('confidence-bar-one').style.width=(posterior.available?posterior.ufFailureProbability*100:50)+'%';
    $('confidence-bar-zero').parentElement.classList.toggle('unavailable',!posterior.available);
    const failure=posterior.ufFailureProbability;
    $('confidence-decision').textContent=!posterior.available?'Undefined at p = 0: this nonzero syndrome has probability zero.':Math.abs(failure-.5)<1e-12?'The two logical classes are equally likely at this precision.':failure>.5?'The opposite class C₁ is more likely under this noise model.':'UF’s class C₀ is more likely under this noise model.';
    $('confidence-truth').textContent=`For the displayed E, UF ${data.result.logical?'has a logical failure':'recovers successfully'}. This definite outcome does not change when the assumed p changes.`;
    $('confidence-llr').textContent=!posterior.available?'Conditional log-likelihood ratio: undefined.':`ln[P(C₀ | s) / P(C₁ | s)] = ${posterior.logLikelihoodRatio===null?(posterior.ufSuccessProbability===1?'+∞':'−∞'):posterior.logLikelihoodRatio.toFixed(5)}. Positive values favor UF’s class.`;
    $('confidence-status').textContent=!posterior.available?'Select p > 0 to condition on this syndrome.':analysis.gap>0&&failure>.5?'Minimum weight favors C₀, but the full probability sum favors C₁. The combined probability of higher-weight errors reverses the preference.':analysis.gap<0&&failure<.5?'Minimum weight favors C₁, but the full probability sum favors C₀. The most likely class need not contain the lightest individual error.':analysis.gap===0&&Math.abs(failure-.5)>1e-12?'The minimum weights tie, but the full class probabilities differ. Degeneracy at all weights resolves this likelihood comparison.':'All 2,097,152 syndrome-compatible error patterns are included. Higher p values illustrate the limits of inferring the logical class from this syndrome.';
    if(!confidenceTable||confidenceTable.spectrum!==spectrum||confidenceTable.parity!==analysis.parity){
      const tbody=$('spectrum-rows'),rows=[];tbody.replaceChildren();
      for(let k=0;k<=patch.n;k++){
        const counts=[0,1].map(i=>spectrum.sectors[analysis.parity^i].counts[k]);if(!counts[0]&&!counts[1])continue;
        tableRow(tbody,[k,counts[0].toLocaleString('en-US'),counts[1].toLocaleString('en-US'),'','']);
        rows.push({weight:k,counts,cells:[tbody.lastElementChild.children[3],tbody.lastElementChild.children[4]]});
      }
      confidenceTable={spectrum,parity:analysis.parity,rows};
    }
    for(const row of confidenceTable.rows){
      const k=row.weight;
      const masses=row.counts.map((count,i)=>!posterior.available?null:confidenceP===0?(k===0&&(analysis.parity^i)===0?1:0):count?Math.exp(Math.log(count)+k*Math.log(confidenceP)+(patch.n-k)*Math.log1p(-confidenceP)-posterior.logSyndromeProbability):0);
      row.cells.forEach((cell,i)=>{cell.textContent=percent(masses[i]);});
    }
    drawConfidenceCurve();
  }
  function setPrior(p){
    if(!Number.isFinite(p)||p<0||p>.5)return;
    confidenceP=p;invalidateShare();renderConfidence();
  }
  function renderNeighbors(){
    $('neighbor-results').hidden=!neighborRows;if(!neighborRows)return;
    const flips=neighborRows.filter(r=>r.outcomeChanged),largest=Math.max(...neighborRows.map(r=>r.changedCorrection.length));
    $('neighbor-summary').textContent=`${flips.length} of 41 toggles change the logical outcome. The largest correction change spans ${largest} edges.`;
    $('neighbor-rows').replaceChildren();
    const rows=neighborRows.filter(r=>$('neighbor-filter').value==='all'||r.outcomeChanged).slice().sort((a,b)=>b.changedCorrection.length-a.changedCorrection.length||a.qubit-b.qubit);
    for(const row of rows){
      const button=document.createElement('button');button.className='btn btn-ghost';button.textContent='Open';button.setAttribute('aria-label','Open neighbor q'+row.qubit);
      button.addEventListener('click',()=>{
        neighborOrigin={error:data.error.slice(),selected,forestStrategy,view,custom:$('example').value==='custom',sampleOrigin};
        error=row.error.slice();sampleOrigin=null;view='overlay';editing=false;recompute({changed:true});
        $('neighbor-status').textContent=`Opened ${row.operation} Z on q${row.qubit}. ${row.changedCorrection.length} correction edges changed; the logical outcome ${row.outcomeChanged?'flipped':'stayed the same'}.`;
        $('restore-neighbor').hidden=false;focusWorkspace();
      });
      tableRow($('neighbor-rows'),[`${row.operation==='add'?'Add':'Remove'} q${row.qubit}`,row.error.length,row.correction.length,row.changedCorrection.length,badge(row.logical),button]);
    }
    if(!rows.length)tableRow($('neighbor-rows'),['No outcome-changing neighbors','—','—','—','Try “All 41 toggles”.','—']);
  }
  function changeForest(strategy){neighborOrigin=null;forestStrategy=strategy;$('forest').value=strategy;recompute({changed:$('example').value==='custom'});}
  const catalog=dataset.cases,caseById=new Map(catalog.map(c=>[c.id,c])),pageSize=25;
  let catalogPage=0;
  const catalogRisk=c=>c.conditionalFailure.find(v=>v.p===.1).failure;
  function catalogFilters(){return {query:$('search').value.trim().toLowerCase(),category:$('category').value,outcome:$('outcome-filter').value,mechanism:$('mechanism').value,sort:$('catalog-sort').value};}
  function catalogMatches(){
    const f=catalogFilters();
    const matches=catalog.filter(c=>(f.category==='all'||c.group===f.category)&&(f.outcome==='all'||!!c.metrics.logical===(f.outcome==='failure'))&&(f.mechanism==='all'||c.tags.includes(f.mechanism))&&(!f.query||(/^\d+$/.test(f.query)?c.number===Number(f.query):[c.id,c.name,c.group,c.title,c.note,...c.tags].join(' ').toLowerCase().includes(f.query))));
    const score=c=>({number:c.number,correction:-c.metrics.correctionWeight,peeling:-c.metrics.peelingExcess,defects:-c.metrics.defects,ambiguity:Math.abs(catalogRisk(c)-.5),gap:c.metrics.gap}[f.sort]);
    return matches.sort((a,b)=>score(a)-score(b)||a.number-b.number);
  }
  function renderCatalog(){
    $('catalog-rows').replaceChildren();
    $('catalog-rows').closest('.sc-table-scroll').scrollTop=0;
    const matches=catalogMatches(),f=catalogFilters(),pages=Math.max(1,Math.ceil(matches.length/pageSize));
    catalogPage=Math.min(catalogPage,pages-1);
    for(const c of matches.slice(catalogPage*pageSize,(catalogPage+1)*pageSize)){
      const button=document.createElement('button');button.className='btn btn-ghost';button.textContent='Open';button.setAttribute('aria-label','Open example '+c.number);
      button.addEventListener('click',()=>{forestStrategy='bfs';$('forest').value=forestStrategy;chooseExample(c.id);focusWorkspace();});
      const concept=document.createElement('div'),name=document.createElement('strong'),group=document.createElement('small');
      name.textContent=c.name;group.textContent=c.group;concept.append(name,group);
      const forests=document.createElement('span');forests.textContent=c.forests.map(v=>v.logical?'F':'S').join(' / ');
      forests.setAttribute('aria-label',c.forests.map(v=>`${forestNames[v.strategy]}: ${v.logical?'failure':'success'}`).join('; '));
      forests.title='BFS / Reverse BFS / DFS · S = success, F = failure';
      tableRow($('catalog-rows'),[concept,c.metrics.errorWeight,c.metrics.defects,c.metrics.correctionWeight,c.metrics.gap>0?'+'+c.metrics.gap:c.metrics.gap,percent(catalogRisk(c)),forests,badge(c.metrics.logical),button]);
    }
    if(!matches.length){const row=document.createElement('tr'),cell=document.createElement('td');cell.colSpan=9;cell.textContent='No matching examples. Try a broader search or clear the filters.';row.append(cell);$('catalog-rows').append(row);}
    $('catalog-status').textContent=`${matches.length} of ${catalog.length} examples${f.query?' match your search':''}.`;
    $('catalog-page').textContent=matches.length?`Page ${catalogPage+1} of ${pages} · ${catalogPage*pageSize+1}–${Math.min((catalogPage+1)*pageSize,matches.length)} of ${matches.length}`:'No matching cases';
    $('catalog-prev').disabled=catalogPage===0;$('catalog-next').disabled=catalogPage===pages-1;
    $('catalog-csv').disabled=$('catalog-json').disabled=!matches.length;
    $('clear-filters').disabled=!f.query&&f.outcome==='all'&&f.category==='all'&&f.mechanism==='all'&&f.sort==='number';
  }
  function resetCatalog(){catalogPage=0;renderCatalog();$('catalog-export-status').textContent='Exports include every matching case across all pages. JSON includes geometry, exact spectra, all three forests, and provenance.';}
  function renderCaseRecord(changed){
    const c=changed?null:caseById.get(selected);$('case-record').hidden=!c;if(!c)return;
    $('record-id').textContent=`${c.id} · catalog ${dataset.catalogVersion}`;
    $('record-keys').textContent=`E ${c.errorKey} / s ${c.syndromeKey}`;
    $('record-criterion').textContent=c.provenance.criterion;
    $('record-method').textContent=`Selection: ${c.provenance.method}${c.provenance.seed===undefined?'':` · source seed ${c.provenance.seed}`}. Full construction details are included in JSON exports.`;
    $('record-tags').replaceChildren(...c.tags.map(tag=>{const span=document.createElement('span');span.textContent=tag.replace(/-/g,' ');return span;}));
  }
  function downloadRecord(content,type,filename){
    const url=URL.createObjectURL(new Blob([content],{type})),link=document.createElement('a');
    link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function exportCatalog(format){
    const matches=catalogMatches();if(!matches.length)return;
    const ids=new Set(matches.map(c=>c.id));
    const filtered={...dataset,sourceSummary:dataset.summary,summary:{cases:matches.length,uniqueErrors:new Set(matches.map(c=>c.errorKey)).size,uniqueSyndromes:new Set(matches.map(c=>c.syndromeKey)).size,pairedStudies:new Set(matches.filter(c=>c.partner&&ids.has(c.partner)).map(c=>[c.id,c.partner].sort().join(':'))).size,groups:new Set(matches.map(c=>c.group)).size},filters:catalogFilters(),cases:matches};
    downloadRecord(format==='csv'?R.csv(matches):JSON.stringify(filtered,null,2)+'\n',format==='csv'?'text/csv;charset=utf-8':'application/json',`decoder-lab-catalog-${dataset.catalogVersion}-${matches.length}-cases.${format}`);
    $('catalog-export-status').textContent=`Exported ${matches.length} matching cases across all pages as ${format.toUpperCase()}. Reference metrics use BFS; probabilities use the four documented priors.`;
  }
  function experimentRecord(){return {
    format:'decoder-lab.surface-code.v3',model:{distance:5,dataQubits:41,logicalQubits:1,noise:'Z only; perfect syndrome; one round',edgeWeights:'uniform unit weights'},
    example:$('example').value==='custom'?null:selected,sampling:sampleOrigin,forestStrategy,view,error:data.error,syndrome:data.observed,correction:data.correction,residual:data.residual,
    catalog:$('example').value==='custom'?null:{version:dataset.catalogVersion,caseId:selected,provenance:caseById.get(selected).provenance,tags:caseById.get(selected).tags,errorKey:R.errorKey(data.error),syndromeKey:R.syndromeKey(data.observed)},
    decomposition:data.result,reference:analysis,fullyGrownEdges:data.trace.fullEdges,
    confidence:{assumedNoise:'iid Z, independent of how this displayed E was selected',p:confidenceP,spectrum,posterior},localSensitivity:neighborRows,
    geometry:{qubits:patch.edges,checks:patch.nodes.filter(v=>!v.boundary),stabilizers:patch.faces,logicalZ:patch.logicalZ,logicalX:patch.logicalX},
    convention:'All supports multiply by symmetric difference. Reference sector parity is intersection with the fixed logical-X cut; reference.parity identifies UF’s class. Success labels use the simulated error only after decoding.'
  };}
  function generateSample(){
    if(!$('sample-form').reportValidity())return;
    try{
      const params={seed:Number($('seed').value),mode:$('sample-mode').value};
      if(params.mode==='iid')params.p=Number($('probability').value);else params.weight=Number($('sample-weight').value);
      error=M.sample(patch,params);sampleOrigin=params;neighborOrigin=null;editing=false;view='error';recompute({changed:true});
      $('example-title').textContent=`Seed ${params.seed} · ${params.mode==='iid'?'independent Z errors':'fixed-weight Z errors'}`;
      $('example-note').textContent=`${error.length} physical errors generated deterministically. Compare the observed syndrome, the UF correction, and the two logical classes.`;
      $('sample-status').textContent=`Generated seed ${params.seed}: ${error.length} errors, ${data.observed.reduce((a,b)=>a+b,0)} defects, ${data.result.logical?'logical failure':'successful recovery'} with ${forestNames[forestStrategy]}.`;
    }catch(e){$('sample-status').textContent=e.message;}
  }
  function recompute({changed=false,message=''}={}) {
    stop();data=M.decode(patch,error,forestStrategy);analysis=M.analyze(patch,data,forestStrategy);error=data.error;frames=data.trace.frames.filter(f=>!f.micro);traceIndex=0;
    const key=data.observed.join('');if(key!==spectrumKey||!spectrum){spectrum=F.spectrum(patch,data.observed);spectrumKey=key;}
    neighborRows=null;$('neighbor-results').hidden=true;$('restore-neighbor').hidden=!neighborOrigin;
    $('neighbor-status').textContent='The scan exhausts the 41 neighbors of the current E. These are controlled cases, not probability-weighted samples.';
    if(changed){$('example').value='custom';$('example-title').textContent='Explore your own error pattern.';$('example-note').textContent='The syndrome, UF correction, and exact logical/stabilizer decomposition update together.';}
    if(changed&&!sampleOrigin)$('sample-status').textContent='Custom error pattern. Export or create a case link to preserve it exactly.';
    $('equivalence-status').textContent=message||'Try either transformation. Both preserve the syndrome and deterministic correction.';
    invalidateShare();
    $('case-position').textContent=changed?'Custom pattern':`${presets.findIndex(p=>p.id===selected)+1} / ${presets.length}`;
    $('previous-example').disabled=changed||presets.findIndex(p=>p.id===selected)===0;
    $('next-example').disabled=changed||presets.findIndex(p=>p.id===selected)===presets.length-1;
    $('story-kind').textContent=changed?(sampleOrigin?'GENERATED EXPERIMENT':'CUSTOM ERROR PATTERN'):'WORKED EXPLANATION · DEFAULT BFS';
    $('forest-note').hidden=changed||forestStrategy==='bfs';
    const preset=presets.find(p=>p.id===selected);$('companion').hidden=changed||!preset?.partner;
    if(!changed&&preset?.partner){$('companion-note').textContent=preset.partnerNote;$('open-companion').textContent='Open paired example '+(presets.findIndex(p=>p.id===preset.partner)+1);}
    renderCaseRecord(changed);renderResult();renderResearch();renderConfidence();
  }
  function chooseExample(id){
    const p=presets.find(p=>p.id===id);if(!p)return;
    selected=id;error=p.error.slice();editing=false;sampleOrigin=null;neighborOrigin=null;$('example').value=id;
    $('sample-status').textContent='Seeds produce the same error pattern on every device. Each generation is one shot; this is not a logical-error-rate estimate.';
    $('example-title').textContent=p.title;$('example-note').textContent=p.note;
    $('reset-example').textContent=`Reset example ${presets.indexOf(p)+1}`;
    recompute();
  }
  function toggleQubit(id){sampleOrigin=null;neighborOrigin=null;error=M.xor(error,[id]);recompute({changed:true});}
  function transform(chain,isLogical){
    const old=data;sampleOrigin=null;neighborOrigin=null;error=M.xor(error,chain);recompute({changed:true});
    const sameS=old.observed.every((b,i)=>b===data.observed[i]);
    const sameC=old.correction.join(',')===data.correction.join(',');
    if(!sameS||!sameC||data.result.logical!==(old.result.logical^(isLogical?1:0)))throw new Error('Equivalence transformation failed.');
    $('equivalence-status').textContent=`✓ Same syndrome · same correction C · logical class ${isLogical?'flipped':'unchanged'}.`;
    view='decomposition';editing=false;drawMain();
  }
  function setView(next){stop();invalidateShare();view=next;if(next!=='error')editing=false;drawMain();}
  function goTrace(i){stop();traceIndex=Math.max(0,Math.min(frames.length-1,i));drawMain();}
  for(const group of [...new Set(presets.map(p=>p.group))]){
    const optgroup=document.createElement('optgroup');optgroup.label=group;
    optgroup.append(...presets.filter(p=>p.group===group).map(p=>new Option(p.name,p.id)));$('example').append(optgroup);
    $('category').append(new Option(group,group));
  }
  const custom=new Option('Custom / transformed error','custom');custom.disabled=true;$('example').append(custom);
  $('catalog-count').textContent=`${presets.length} WORKED CASES`;$('catalog-link').textContent=`All ${presets.length} examples`;
  for(const [count,label] of [[catalog.length,'distinct error patterns'],[dataset.summary.uniqueSyndromes,'syndromes'],[dataset.summary.pairedStudies,'paired studies'],[catalog.filter(c=>c.metrics.forestSensitive).length,'forest-sensitive cases']]){
    const item=document.createElement('div'),value=document.createElement('strong'),caption=document.createElement('span');value.textContent=count;caption.textContent=label;item.append(value,caption);$('catalog-stats').append(item);
  }
  for(const e of patch.edges)$('qubit').append(new Option(`q${e.id} · ${e.kind==='h'?'horizontal':'vertical'} edge`,String(e.id)));
  for(const f of patch.faces)$('face').append(new Option(`S${f.id+1} · ${f.edges.length}-qubit ${f.edges.length===3?'boundary':'plaquette'} stabilizer`,String(f.id)));
  $('face').value='8';
  $('example').addEventListener('change',()=>chooseExample($('example').value));
  $('open-companion').addEventListener('click',()=>{chooseExample(presets.find(p=>p.id===selected)?.partner);focusWorkspace();});
  $('confidence-p').addEventListener('input',()=>setPrior(Number($('confidence-p').value)/100));
  $('confidence-number').addEventListener('change',()=>{if($('confidence-number').value!==''&&$('confidence-number').reportValidity())setPrior(Number($('confidence-number').value)/100);else $('confidence-number').value=Number((confidenceP*100).toPrecision(12));});
  root.querySelectorAll('[data-sc-prior]').forEach(b=>b.addEventListener('click',()=>setPrior(Number(b.dataset.scPrior))));
  $('scan-neighbors').addEventListener('click',()=>{stop();neighborOrigin=null;$('restore-neighbor').hidden=true;neighborRows=M.neighbors(patch,data,forestStrategy);renderNeighbors();$('neighbor-status').textContent=`Scanned all 41 physical-qubit toggles with ${forestNames[forestStrategy]}. Each correction matches its new syndrome.`;});
  $('neighbor-filter').addEventListener('change',renderNeighbors);
  $('restore-neighbor').addEventListener('click',()=>{
    if(!neighborOrigin)return;const old=neighborOrigin;neighborOrigin=null;forestStrategy=old.forestStrategy;$('forest').value=forestStrategy;view=old.view;
    if(!old.custom)chooseExample(old.selected);else{selected=old.selected;error=old.error.slice();sampleOrigin=old.sampleOrigin;recompute({changed:true});}
    $('neighbor-status').textContent='Restored the scan’s original error and forest.';focusWorkspace();
  });
  $('forest').addEventListener('change',()=>changeForest($('forest').value));
  $('previous-example').addEventListener('click',()=>chooseExample(presets[presets.findIndex(p=>p.id===selected)-1]?.id));
  $('next-example').addEventListener('click',()=>chooseExample(presets[presets.findIndex(p=>p.id===selected)+1]?.id));
  for(const id of ['category','outcome-filter','mechanism','catalog-sort'])$(id).addEventListener('change',resetCatalog);
  $('search').addEventListener('input',resetCatalog);
  $('clear-filters').addEventListener('click',()=>{$('search').value='';for(const id of ['outcome-filter','category','mechanism'])$(id).value='all';$('catalog-sort').value='number';resetCatalog();$('search').focus();});
  $('catalog-prev').addEventListener('click',()=>{catalogPage--;renderCatalog();});
  $('catalog-next').addEventListener('click',()=>{catalogPage++;renderCatalog();});
  for(const format of ['csv','json'])$('catalog-'+format).addEventListener('click',()=>exportCatalog(format));
  root.querySelectorAll('[data-sc-reference]').forEach(b=>b.addEventListener('click',()=>{referenceView=b.dataset.scReference;drawReferences();}));
  for(const [id,predicate] of [['jump-merge',f=>f.action==='merge'],['jump-forest',f=>f.phase==='forest']])$(id).addEventListener('click',()=>goTrace(frames.findIndex(predicate)));
  $('jump-reactivate').addEventListener('click',()=>{const next=frames.findIndex((f,i)=>i>traceIndex&&f.reactivated);goTrace(next<0?frames.findIndex(f=>f.reactivated):next);});
  $('inspect-growth').addEventListener('click',()=>{setView('trace');goTrace(frames.findIndex(f=>f.phase==='forest'));$('view-title').focus({preventScroll:true});$('view-title').scrollIntoView({block:'start'});});
  $('sample-mode').addEventListener('change',()=>{const fixed=$('sample-mode').value==='fixed';$('probability-field').hidden=fixed;$('probability').disabled=fixed;$('weight-field').hidden=!fixed;$('sample-weight').disabled=!fixed;});
  $('sample-form').addEventListener('submit',event=>{event.preventDefault();generateSample();});
  $('next-seed').addEventListener('click',()=>{if(!$('sample-form').reportValidity())return;$('seed').value=(Number($('seed').value)+1)>>>0;generateSample();});
  $('export').addEventListener('click',()=>{
    downloadRecord(JSON.stringify(experimentRecord(),null,2)+'\n','application/json',`surface-code-d5-${$('example').value}.json`);
    $('sample-status').textContent='Exported the current experiment, exact references, and geometry as JSON.';
  });
  $('share').addEventListener('click',()=>{
    const url=new URL(location.href);url.search='';url.hash='';url.searchParams.set('sc','2');url.searchParams.set('e',data.error.join(','));url.searchParams.set('forest',forestStrategy);url.searchParams.set('view',view);
    url.searchParams.set('prior',String(confidenceP));
    if($('example').value!=='custom')url.searchParams.set('example',selected);
    $('share-url').value=url.href;$('share-url').hidden=$('share-label').hidden=$('copy-link').hidden=false;$('share-url').focus();$('share-url').select();
    $('sample-status').textContent='Case link ready. It preserves the exact error, forest, diagram view, and assumed confidence prior; select and copy it.';
  });
  $('copy-link').addEventListener('click',async()=>{
    const text=$('share-url').value;
    try{await navigator.clipboard.writeText(text);if(!$('share-url').hidden&&$('share-url').value===text)$('sample-status').textContent='Case link copied. It restores the exact error, forest, view, and confidence prior.';}
    catch{if(!$('share-url').hidden){$('share-url').focus();$('share-url').select();$('sample-status').textContent='Automatic copying is unavailable. The case link is selected; copy it with your keyboard or device menu.';}}
  });
  viewButtons.forEach(b=>b.addEventListener('click',()=>setView(b.dataset.scView)));
  $('edit').addEventListener('click',()=>{editing=!editing;setView('error');});
  $('qubit').addEventListener('change',()=>{focusedQubit=Number($('qubit').value);updateQubitState();drawMain();});
  $('toggle-qubit').addEventListener('click',()=>toggleQubit(Number($('qubit').value)));
  $('clear').addEventListener('click',()=>{sampleOrigin=null;neighborOrigin=null;error=[];recompute({changed:true});});
  $('cut').addEventListener('change',drawMain);$('ids').addEventListener('change',drawMain);
  $('reset-example').addEventListener('click',()=>chooseExample(selected));
  $('add-logical').addEventListener('click',()=>transform(patch.logicalZ,true));
  $('add-stabilizer').addEventListener('click',()=>transform(patch.faces[Number($('face').value)].edges,false));
  $('trace-start').addEventListener('click',()=>goTrace(0));$('trace-back').addEventListener('click',()=>goTrace(traceIndex-1));
  $('trace-next').addEventListener('click',()=>goTrace(traceIndex+1));$('trace-end').addEventListener('click',()=>goTrace(frames.length-1));
  $('trace-scrub').addEventListener('input',()=>goTrace(Number($('trace-scrub').value)));
  $('trace-play').addEventListener('click',()=>{
    if(timer!==null){stop();return;}if(traceIndex>=frames.length-1)return;
    $('trace-play').textContent='Pause';$('trace-play').setAttribute('aria-pressed','true');
    timer=setInterval(()=>{traceIndex++;drawMain();if(traceIndex===frames.length-1)stop();},900);
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
  document.addEventListener('keydown',event=>{
    if(root.hidden||event.target.closest('a,button,input,select,textarea,summary,[role="button"],[role="tab"],[contenteditable=""],[contenteditable="true"]')||event.altKey||event.ctrlKey||event.metaKey)return;
    if(view==='trace'&&['ArrowLeft','ArrowRight',' '].includes(event.key)){
      event.preventDefault();if(event.key===' ')$('trace-play').click();else goTrace(traceIndex+(event.key==='ArrowRight'?1:-1));
    }
  });
  const oldRoot=document.getElementById('uf-decoder-lesson');
  const sectionLinks=[...$('section-nav').querySelectorAll('a')];
  function markSection(){
    if(root.hidden)return;
    let active=sectionLinks[0];
    for(const link of sectionLinks.slice(1)){
      const target=document.getElementById(link.hash.slice(1));
      if(target&&target.getBoundingClientRect().top<=150)active=link;
    }
    for(const link of sectionLinks){if(link===active)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');}
  }
  let scrollQueued=false;
  window.addEventListener('scroll',()=>{if(scrollQueued)return;scrollQueued=true;requestAnimationFrame(()=>{scrollQueued=false;markSection();});},{passive:true});
  function route(){
    const walkthrough=['#walkthrough','#structures','#field-guide','#sources','#uf-decoder-lesson'].includes(location.hash);
    const changed=root.hidden!==walkthrough;
    root.hidden=walkthrough;oldRoot.hidden=!walkthrough;
    document.querySelectorAll('[data-lab-mode]').forEach(a=>{if(a.dataset.labMode===(walkthrough?'walkthrough':'logical'))a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
    if(walkthrough)stop();
    else if(changed){const play=document.getElementById('uf-play');if(play.getAttribute('aria-pressed')==='true')play.click();drawMain();drawFactors();}
    if(location.hash){const target=location.hash==='#walkthrough'?oldRoot:document.getElementById(location.hash.slice(1));if(target)requestAnimationFrame(()=>target.scrollIntoView({block:'start'}));}
  }
  let previousWidth=-1,resizeFrame=null;
  if(typeof ResizeObserver==='function')new ResizeObserver(entries=>{
    const width=entries[0].contentRect.width;if(root.hidden||Math.abs(width-previousWidth)<.5)return;previousWidth=width;
    if(resizeFrame!==null)cancelAnimationFrame(resizeFrame);
    resizeFrame=requestAnimationFrame(()=>{resizeFrame=null;drawMain();drawFactors();});
  }).observe(root);
  else window.addEventListener('resize',()=>{drawMain();drawFactors();});
  window.addEventListener('hashchange',route);
  chooseExample(selected);
  const query=new URLSearchParams(location.search);
  if(query.has('sc')){
    try{
      const raw=query.get('e'),strategy=query.get('forest'),nextView=query.get('view');
      if(['sc','e','forest','view','prior','example'].some(key=>query.getAll(key).length>1))throw new Error('Ambiguous shared case');
      if(query.get('sc')!=='2'||raw===null||raw.length>160||!/^(?:\d+(?:,\d+)*)?$/.test(raw)||!Object.hasOwn(forestNames,strategy)||!Object.hasOwn(views,nextView))throw new Error('Invalid shared case');
      const ids=raw===''?[]:raw.split(',').map(Number);
      if(ids.some(id=>!Number.isInteger(id)||id<0||id>=patch.n)||new Set(ids).size!==ids.length)throw new Error('Invalid qubit support');
      const prior=query.has('prior')?Number(query.get('prior')):.1;
      if((query.has('prior')&&query.get('prior').trim()==='')||!Number.isFinite(prior)||prior<0||prior>.5)throw new Error('Invalid confidence prior');
      confidenceP=prior;
      forestStrategy=strategy;$('forest').value=strategy;view=nextView;
      const preset=presets.find(p=>p.id===query.get('example')&&p.error.slice().sort((a,b)=>a-b).join(',')===ids.slice().sort((a,b)=>a-b).join(','));
      if(preset)chooseExample(preset.id);else{error=ids;recompute({changed:true});$('example-title').textContent='Shared error pattern';}
      $('sample-status').textContent='Shared case restored: exact error, forest, diagram view, and confidence prior.';
    }catch(e){$('sample-status').textContent='This case link is invalid or uses an unsupported version. The default example is shown.';$('load-notice').hidden=false;$('load-notice').textContent=$('sample-status').textContent;}
  }
  renderCatalog();route();markSection();
  root.surfaceInspect=()=>({view,editing,selected,forestStrategy,referenceView,confidenceP,posterior,neighbors:neighborRows,error:data.error,correction:data.correction,residual:data.residual,syndrome:data.observed,result:data.result,analysis,frame:frames[traceIndex],traceIndex,frames:frames.length});
  root.surfaceExport=experimentRecord;
})();
