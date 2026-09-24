(() => {
  'use strict';
  const M=globalThis.__surfaceModel, patch=M.makePatch(5), presets=M.examples(patch);
  const root=document.getElementById('logical-lab'), $=id=>document.getElementById('sc-'+id);
  const NS='http://www.w3.org/2000/svg';
  let selected='dressed',error=presets.find(p=>p.id===selected).error.slice(),data;
  let view='decomposition',editing=false,traceIndex=0,timer=null,frames=[];
  const viewButtons=[...root.querySelectorAll('[data-sc-view]')];
  const colors={error:'var(--sc-error)',correction:'var(--viz-series-3)',residual:'var(--viz-series-5)',logical:'var(--muted-foreground)',stabilizer:'var(--viz-series-1)',cut:'var(--viz-series-2)'};
  const views={
    error:['Actual error E','Orange edges carry physical Z errors. Filled circles are the X checks they violate. E is known to the simulation; it is not given to UF.'],
    syndrome:['Syndrome seen by UF','Only the violated X checks are revealed. Many physical error patterns, including different logical classes, produce exactly these same bits.'],
    trace:['Uniform-growth UF','Follow the same UF engine on this surface-code graph. The actual error is hidden: growth and peeling use only the syndrome and allowed boundaries.'],
    correction:['Decoder correction C','Green edges are the Z correction returned by UF. They reproduce the observed syndrome. Matching those check bits does not guarantee logical recovery.'],
    residual:['Product CE = E ⊕ C','Combine the two supports modulo 2. A qubit hit by both E and C cancels because Z² = I. The remaining operator has no measured syndrome.'],
    decomposition:['CE = logical × stabilizer','Purple is the remaining operator. The dashed middle-row Z̄ and the shaded stabilizers multiply to it; shared edges cancel.']
  };
  function svgEl(parent,tag,attrs={},text) {
    const e=document.createElementNS(NS,tag);
    for(const [k,v] of Object.entries(attrs)) e.setAttribute(k,v);
    if(text!==undefined) e.textContent=text;
    parent.append(e);return e;
  }
  const supportText=ids=>ids.length?ids.map(id=>'q'+id).join(', '):'∅';
  const stabilizerHTML=ids=>ids.length?ids.map(id=>`S<sub>${id+1}</sub>`).join(' '):'I';
  function stop(){if(timer!==null)clearInterval(timer);timer=null;$('trace-play').textContent='Play';$('trace-play').setAttribute('aria-pressed','false');}

  function geometry(svg,mini=false) {
    const width=Math.max(mini?240:260,svg.getBoundingClientRect().width||600),narrow=width<420;
    const margin=mini?26:(narrow?35:45),top=mini?20:67,dy=mini?38:(narrow?46:56);
    const dx=(width-2*margin)/patch.d,height=top+(patch.d-1)*dy+(mini?28:49);
    svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.setAttribute('height',height);
    return {width,margin,top,dy,dx,height,narrow,pos:v=>({x:margin+v.col*dx,y:top+v.row*dy})};
  }
  function drawPatch(svg,{chain=[],color='var(--foreground)',bits=[],faces=[],logical=false,cut=false,ids=false,edit=false,trace=null,mini=false}={}) {
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
    for(const id of chain) edgeLine(id,{stroke:color,'stroke-width':mini?4:5.5});
    // Small ticks mark the data qubits; vertices are parity checks, not data qubits.
    for(const e of patch.edges) {
      const a=nodePos(e.a),b=nodePos(e.b),x=(a.x+b.x)/2,y=(a.y+b.y)/2,on=chain.includes(e.id);
      if(!mini) svgEl(drawing,'circle',{cx:x,cy:y,r:edit?3.4:2.3,fill:on?color:'var(--muted-foreground)',opacity:on?1:.6});
      if(ids&&!mini) text(x+(e.kind==='v'?6:0),y+(e.kind==='v'?4:15),`q${e.id}`,{'text-anchor':e.kind==='v'?'start':'middle','font-size':11});
    }
    for(const v of patch.nodes) {
      const p=nodePos(v.id);
      if(v.boundary) svgEl(drawing,'rect',{x:p.x-3,y:p.y-4,width:6,height:8,rx:1,fill:'var(--background)',stroke:'var(--muted-foreground)','stroke-width':1});
      else {
        const c=svgEl(drawing,'circle',{cx:p.x,cy:p.y,r:bits[v.id]?5.3:(mini?2.5:3.3),fill:bits[v.id]?'var(--foreground)':'var(--background)',stroke:'var(--muted-foreground)','stroke-width':1});
        svgEl(c,'title',{},`X${v.id+1}: ${bits[v.id]?'−1, defect':'+1, satisfied'}`);
      }
    }
    if(!mini) for(const e of patch.edges) {
      const a=nodePos(e.a),b=nodePos(e.b),horizontal=e.kind==='h';
      const hit=svgEl(drawing,'rect',{x:horizontal?a.x+7:a.x-9,y:horizontal?a.y-9:a.y+7,width:horizontal?b.x-a.x-14:18,height:horizontal?18:b.y-a.y-14,rx:3,fill:'transparent',...(edit?{class:'sc-edge-hit',role:'button',tabindex:0,'aria-label':`Toggle Z error on q${e.id}`,'aria-pressed':String(data.error.includes(e.id))}:{})});
      svgEl(hit,'title',{},`q${e.id}${edit?': click to toggle a Z error':chain.includes(e.id)?': selected operator acts here':''}`);
      if(edit){hit.addEventListener('click',()=>toggleQubit(e.id));hit.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleQubit(e.id);const replacement=$('drawing').querySelector(`[aria-label="Toggle Z error on q${e.id}"]`);replacement?.focus();}});}
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
    const frame=frames[traceIndex],params={cut:$('cut').checked&&view!=='syndrome',ids:$('ids').checked};
    let items=[];
    if(view==='error'){Object.assign(params,{chain:data.error,color:colors.error,bits:data.observed,edit:editing});items=[['Z error E',colors.error],['Violated X check',null,'dot']];}
    if(view==='syndrome'){params.bits=data.observed;items=[['Violated X check',null,'dot'],['Data-qubit edge','var(--graph-grid)']];}
    if(view==='correction'){Object.assign(params,{chain:data.correction,color:colors.correction,bits:data.observed});items=[['Correction C',colors.correction],['Input syndrome',null,'dot']];}
    if(view==='residual'){Object.assign(params,{chain:data.residual,color:colors.residual});items=[['Remaining CE',colors.residual]];}
    if(view==='decomposition'){Object.assign(params,{chain:data.residual,color:colors.residual,faces:data.result.stabilizers,logical:!!data.result.logical});items=[['CE',colors.residual],['Logical L',colors.logical,'dashed'],['Z stabilizer S',colors.stabilizer]];}
    if(view==='trace'){Object.assign(params,{chain:frame.correction,color:colors.correction,bits:frame.bits,trace:frame,cut:false});items=[['Grown region','var(--viz-series-1)'],['Remaining forest','var(--foreground)','dashed'],['Correction C',colors.correction]];}
    if(params.cut)items.push(['X̄ reference',colors.cut,'dashed']);
    drawPatch($('graph'),params);legend(items);
    $('view-title').textContent=views[view][0];
    $('view-meta').textContent=view==='trace'?`${frame.phase.toUpperCase()} · round ${frame.tick}`:view==='syndrome'?`${data.observed.reduce((a,b)=>a+b,0)} defects`:view==='decomposition'?`ℓ = ${data.result.logical}`:`${params.chain?.length||0} qubits`;
    $('view-note').textContent=view==='trace'?frame.note:views[view][1];
    $('graph-desc').textContent=`${views[view][0]}. ${$('view-meta').textContent}. ${views[view][1]} Left and right boundaries are rough. Top and bottom boundaries are smooth.`;
    $('trace-controls').hidden=view!=='trace';
    $('trace-title').textContent=frame.title;$('trace-count').textContent=`${traceIndex+1} / ${frames.length}`;
    $('trace-scrub').max=frames.length-1;$('trace-scrub').value=traceIndex;
    $('trace-back').disabled=$('trace-start').disabled=traceIndex===0;
    $('trace-next').disabled=$('trace-end').disabled=traceIndex===frames.length-1;
    $('trace-play').disabled=traceIndex===frames.length-1;
    $('editor').hidden=!editing;$('edit').setAttribute('aria-pressed',String(editing));$('edit').textContent=editing?'Done editing':'Edit error E';
    viewButtons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.scView===view)));
  }
  function drawFactors(){
    if(root.hidden)return;
    drawPatch($('logical-factor'),{mini:true,chain:data.result.logical?patch.logicalZ:[],color:colors.residual,cut:true});
    drawPatch($('stabilizer-factor'),{mini:true,chain:data.result.stabilizerEdges,color:colors.stabilizer,faces:data.result.stabilizers});
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
    $('s-caption').textContent=r.stabilizers.length?`${r.stabilizers.length} Z stabilizer${r.stabilizers.length===1?'':'s'}; shared edges cancel in their product. Each acts as +1 on the code space.`:'S = I: the empty stabilizer product.';
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
  function recompute({changed=false,message=''}={}) {
    stop();data=M.decode(patch,error);error=data.error;frames=data.trace.frames.filter(f=>!f.micro);traceIndex=0;
    if(changed){$('example').value='custom';$('example-title').textContent='Explore your own error pattern.';$('example-note').textContent='The syndrome, UF correction, and exact logical/stabilizer decomposition update together.';}
    $('equivalence-status').textContent=message||'Try either transformation. Both preserve the syndrome and deterministic correction.';
    renderResult();
  }
  function chooseExample(id){
    const p=presets.find(p=>p.id===id);if(!p)return;
    selected=id;error=p.error.slice();editing=false;$('example').value=id;
    $('example-title').textContent=p.title;$('example-note').textContent=p.note;
    $('reset-example').textContent=`Reset example ${presets.indexOf(p)+1}`;
    recompute();
  }
  function toggleQubit(id){error=M.xor(error,[id]);recompute({changed:true});}
  function transform(chain,isLogical){
    const old=data;error=M.xor(error,chain);recompute({changed:true});
    const sameS=old.observed.every((b,i)=>b===data.observed[i]);
    const sameC=old.correction.join(',')===data.correction.join(',');
    if(!sameS||!sameC||data.result.logical!==(old.result.logical^(isLogical?1:0)))throw new Error('Equivalence transformation failed.');
    $('equivalence-status').textContent=`✓ Same syndrome · same correction C · logical class ${isLogical?'flipped':'unchanged'}.`;
    view='decomposition';editing=false;drawMain();
  }
  function setView(next){stop();view=next;if(next!=='error')editing=false;drawMain();}
  function goTrace(i){stop();traceIndex=Math.max(0,Math.min(frames.length-1,i));drawMain();}
  $('example').replaceChildren(...presets.map(p=>new Option(p.name,p.id)));
  const custom=new Option('Custom / transformed error','custom');custom.disabled=true;$('example').append(custom);
  for(const e of patch.edges)$('qubit').append(new Option(`q${e.id} · ${e.kind==='h'?'horizontal':'vertical'} edge`,String(e.id)));
  for(const f of patch.faces)$('face').append(new Option(`S${f.id+1} · ${f.edges.length}-qubit ${f.edges.length===3?'boundary':'plaquette'} stabilizer`,String(f.id)));
  $('face').value='8';
  $('example').addEventListener('change',()=>chooseExample($('example').value));
  viewButtons.forEach(b=>b.addEventListener('click',()=>setView(b.dataset.scView)));
  $('edit').addEventListener('click',()=>{stop();editing=!editing;view='error';drawMain();});
  $('toggle-qubit').addEventListener('click',()=>toggleQubit(Number($('qubit').value)));
  $('clear').addEventListener('click',()=>{error=[];recompute({changed:true});});
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
    if(root.hidden||/INPUT|SELECT|TEXTAREA|BUTTON|A/.test(event.target.tagName)||event.altKey||event.ctrlKey||event.metaKey)return;
    if(view==='trace'&&['ArrowLeft','ArrowRight',' '].includes(event.key)){
      event.preventDefault();if(event.key===' ')$('trace-play').click();else goTrace(traceIndex+(event.key==='ArrowRight'?1:-1));
    }
  });
  const oldRoot=document.getElementById('uf-decoder-lesson');
  function route(){
    const walkthrough=['#walkthrough','#structures','#field-guide','#sources','#uf-decoder-lesson'].includes(location.hash);
    root.hidden=walkthrough;oldRoot.hidden=!walkthrough;
    document.querySelectorAll('[data-lab-mode]').forEach(a=>{if(a.dataset.labMode===(walkthrough?'walkthrough':'logical'))a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
    if(walkthrough)stop();
    else {const play=document.getElementById('uf-play');if(play.getAttribute('aria-pressed')==='true')play.click();drawMain();drawFactors();}
    if(location.hash){const target=location.hash==='#walkthrough'?oldRoot:document.getElementById(location.hash.slice(1));if(target)requestAnimationFrame(()=>target.scrollIntoView({block:'start'}));}
  }
  new ResizeObserver(()=>{drawMain();drawFactors();}).observe(root);
  window.addEventListener('hashchange',route);
  chooseExample(selected);route();
  root.surfaceInspect=()=>({view,editing,selected,error:data.error,correction:data.correction,residual:data.residual,syndrome:data.observed,result:data.result,frame:frames[traceIndex],traceIndex,frames:frames.length});
})();
