from pathlib import Path
import subprocess
p=Path(__file__).parent
subprocess.run(['node', str(p/'build_catalog.js')], check=True)
source=p.joinpath('source.html').read_text()
markup=source[:source.index('<script>')]
style=markup[markup.index('<style>')+7:markup.index('</style>')]
markup=markup[:markup.index('<style>')]+markup[markup.index('</style>')+8:]
ui=source[source.index("  const root=document.getElementById('uf-decoder-lesson');"):source.rindex('</script>')]
ui="(() => {\n'use strict';\nconst {makeGraph,run,presets,minimumCorrection}=globalThis.__ufLessonModel;\n"+ui
ui=ui.replace("stroke:'var(--border)','stroke-width':1.3", "stroke:'var(--graph-grid)','stroke-width':1.3")
ui=ui.replace("fullTrace=run(graph);", "fullTrace=run(graph,{forestStrategy:$('forest-mode').value});")
ui=ui.replace("Build a breadth-first spanning forest of the full edges.","Build the selected spanning forest using only full edges.")
ui=ui.replace("This breadth-first forest is separate from the Union-Find parent tree.","This graph forest is separate from the Union-Find parent tree.")
ui=ui.replace("This breadth-first forest adds", "This selected forest adds")
ui=ui.replace("bit=s.phase==='done'?v.syndrome:(peeling?s.bits[v.id]:v.syndrome)","bit=peeling?s.bits[v.id]:v.syndrome")
ui=ui.replace("s.phase==='peel'?'Working bit 1':'Observed syndrome 1'","['peel','done'].includes(s.phase)?'Residual bit 1':'Observed syndrome 1'")
ui=ui.replace("    updatePanels(s);","    updatePanels(s);\n    document.dispatchEvent(new CustomEvent('uf-state',{detail:{graph,trace,fullTrace,s,index,reference,grownReference,editing}}));")
ui=ui.replace("parent.appendChild(v);return v;", "if(attrs?.['data-tooltip']){const t=document.createElementNS(NS,'title');t.textContent=attrs['data-tooltip'];v.appendChild(t);}parent.appendChild(v);return v;")
ui=ui.replace("const faded=peeling", "if(['forest','peel'].includes(s.phase)&&s.peelRoots.includes(v.id)){if(v.boundary)el('rect',{x:p.x-8,y:p.y-11,width:16,height:22,rx:2,fill:'none',stroke:'var(--foreground)','stroke-width':1.3});else el('circle',{cx:p.x,cy:p.y,r:narrow?11:13,fill:'none',stroke:'var(--foreground)','stroke-width':1.3});}\n      const faded=peeling")
ui=ui.replace("$('cut-legend').hidden=", "$('root-legend').hidden=!['forest','peel'].includes(s.phase);\n    $('cut-legend').hidden=")
ui=ui.replace("height=top+2*dy+43", "height=top+2*dy+($('ids').checked && s.phase==='done'?73:51)")
ui=ui.replace("correction edge${s.correction.length===1?'':'s'} · syndrome matched", "edge${s.correction.length===1?'':'s'} · syndrome matched")
ui=ui.replace("  load('pair');", """  $('forest-mode').addEventListener('change',()=>{pause();const phase=trace.frames[index].phase;compile(graph.key,graph.nodes.filter(v=>v.syndrome).map(v=>[v.col,v.row]),graph.preset.boundary);const i=trace.frames.findIndex(f=>f.phase===phase);index=Math.max(0,i);draw();});
  document.addEventListener('keydown',e=>{if(root.hidden)return;if(e.target.closest('a,button,input,select,textarea,summary,[role="button"],[role="tab"],[contenteditable=""],[contenteditable="true"]')||e.altKey||e.ctrlKey||e.metaKey)return;if(e.key==='ArrowRight'){e.preventDefault();next.click();}if(e.key==='ArrowLeft'){e.preventDefault();back.click();}if(e.code==='Space'){e.preventDefault();play.click();}});
  load('pair');""")
p.joinpath('app.js').write_text(ui)
markup=markup.replace('<h2>Inside the Union-Find decoder</h2>','<div class="eyebrow">QUANTUM ERROR CORRECTION</div><h1>Union-Find decoder</h1>')
markup=markup.replace('Uniform growth · unit costs · one error type','Uniform growth · unit edge costs · one error type')
markup=markup.replace('<label class="form-label" for="uf-example">Example</label>','<label class="form-label" for="uf-example">Syndrome configuration</label>')
markup=markup.replace('<div class="uf-stage-row text-small"','<div class="lab-layout"><section class="simulation" aria-label="Decoder simulation"><div class="surface-heading"><span>DECODING GRAPH</span><span class="model-tag"><span id="graph-size">21 vertices · 32 edges</span></span></div><div class="uf-stage-row text-small"')
markup=markup.replace('  <figure class="uf-figure">','  <div class="example-intro"><strong id="lesson-title">Pair two defects</strong><span id="lesson-goal"></span></div><figure class="uf-figure">')
markup=markup.replace('  <div class="nav nav-pills uf-detail-tabs"','  </section><aside class="detail-sidebar" aria-label="Live explanation"><div class="surface-heading"><span>ALGORITHM STATE</span><span id="current-round"></span></div><div class="live-summary"><span class="eyebrow" id="phase-name">SEED</span><h2 id="step-title">Seed the defects</h2><p id="step-intro" hidden></p><div class="live-metrics"><div><strong id="metric-active">2</strong><span>active clusters</span></div><div><strong id="metric-residual">2</strong><span>residual bits</span></div><div><strong id="metric-cost">0</strong><span>chosen edges</span></div></div></div><div class="nav nav-pills uf-detail-tabs"')
# Replace final root closing with sidebar close; additional sections within same root.

markup=markup.replace('id="uf-ids"', 'id="uf-ids" checked')
markup=markup.replace('<span class="uf-key" id="uf-cut-legend" hidden>', '<span class="uf-key" id="uf-root-legend" hidden><span aria-hidden="true">◎</span> Forest root</span><span class="uf-key" id="uf-cut-legend" hidden>')

markup=markup.replace('<div id="uf-decoder-lesson">','<div id="uf-decoder-lesson" hidden>')
end=markup.rfind('</div>')
markup=markup[:end]+ '</aside></div>\n' + p.joinpath('details.html').read_text() + '\n</div>'
head='''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="Explore Union-Find decoding on a planar surface code: physical errors, corrections, stabilizers, logical failures, growth and peeling."><meta name="theme-color" content="#f6f8fa"><title>Union-Find Decoder Lab</title><link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%2324344c'/%3E%3Cpath d='M16 18L32 34L48 18M32 34V48' stroke='%23ffffff' stroke-width='5' fill='none'/%3E%3Ccircle cx='16' cy='18' r='6' fill='%23ffffff'/%3E%3Ccircle cx='48' cy='18' r='6' fill='%23ffffff'/%3E%3Ccircle cx='32' cy='48' r='6' fill='%23ffffff'/%3E%3C/svg%3E"><style>'''
nav='''</style></head><body><a class="skip-link" href="#main-content">Skip to decoder</a><header class="site-header"><a class="brand" href="#"><span class="brand-symbol">∪</span> Decoder lab</a><div class="header-actions"><nav aria-label="Page"><a href="#structures">Structures</a><a href="#field-guide">Field guide</a><a href="#sources">Sources</a></nav><div class="theme-control"><label for="theme-select">Theme</label><select id="theme-select"><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></div></div></header><noscript><div class="no-script" role="alert">This interactive decoder requires JavaScript. Enable it and reload the page. <a href="https://github.com/polarbearsrock/decoder-lab#readme">Read the model and source documentation</a>.</div></noscript><main id="main-content" tabindex="-1"><nav class="lab-switch" aria-label="Choose a lab"><a href="#logical-lab" data-lab-mode="logical" aria-current="page">Surface code · logical errors</a><a href="#walkthrough" data-lab-mode="walkthrough">UF mechanics</a></nav>'''
foot='''</main><footer class="site-footer"><span>Decoder lab / Union-Find · <a href="https://github.com/polarbearsrock/decoder-lab">Source &amp; documentation</a></span><span>Deterministic educational model · not a decoder performance benchmark</span></footer>'''
styles=style+'\n'+p.joinpath('site.css').read_text()+'\n'+p.joinpath('surface.css').read_text()
# Self-contained index supports local download and GitHub Pages without a build step.
catalog_data='<script>globalThis.__surfaceExtraCases='+p.joinpath('surface-cases.json').read_text().replace('</','<\\/')+';globalThis.__surfaceCatalogReference='+p.joinpath('catalog-reference.json').read_text().replace('</','<\\/')+';</script>'
scripts=catalog_data+'\n'+'\n'.join('<script>\n'+p.joinpath(f).read_text()+'\n</script>' for f in ['model.js','extras.js','app.js','surface-model.js','surface-confidence.js','surface-catalog.js','surface-app.js'])
theme_script='<script>\n'+p.joinpath('theme.js').read_text()+'\n</script>'
p.joinpath('index.html').write_text(head.replace('<style>',theme_script+'<style>')+styles+nav+p.joinpath('surface.html').read_text()+markup+foot+scripts+'</body></html>')
print('Built',p/'index.html')
