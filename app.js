/* Nobel & Thesis · Dashboard GitHub Pages (sin backend).
   Los datos reales se generan con build_data.py a partir de los CSV locales. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const E = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = new Intl.NumberFormat('es-AR');
  const COLORS = {navy:'#215196',orange:'#2d70ba',pale:'#cbd9e9',muted:'#627997'};
  const state = {collection:'all',from:'',to:'',annualMetric:'count',rankingMetric:'theses',nobelId:null,limit:15};
  let theses=[], nobels=[], mentions=[], meta={}, thesisMap=new Map(), countsByNobel=new Map();

  async function loadJson(name){
    const res=await fetch(`./data/${name}.json`,{cache:'no-store'});
    if(!res.ok) throw new Error(`No se pudo cargar data/${name}.json (${res.status})`);
    return res.json();
  }
  function showMessage(message,type){const el=$('dataMessage');el.textContent=message;el.className='data-message'+(type?' '+type:'');}
  const percent=(num,den)=>den?`${(100*num/den).toFixed(1)}%`:'—';
  function safeLink(url){try{const u=new URL(url);return u.protocol==='https:'&&u.hostname==='repositorio.udesa.edu.ar'?u.href:'#';}catch{return '#';}}

  function initControls(){
    const collections=[...new Map(theses.map(t=>[t.collection,t.collectionLabel||t.collection])).entries()];
    collections.sort((a,b)=>a[1].localeCompare(b[1],'es'));
    $('collectionFilter').innerHTML='<option value="all">Todas las colecciones de Economía</option>'+collections.map(([id,label])=>`<option value="${E(id)}">${E(label)}</option>`).join('');
    const years=[...new Set(theses.map(t=>t.year).filter(Number.isInteger))].sort((a,b)=>a-b);
    const options=years.map(y=>`<option value="${y}">${y}</option>`).join('');
    $('fromYear').innerHTML='<option value="">Todos los años</option>'+options;
    $('toYear').innerHTML='<option value="">Todos los años</option>'+options;
    $('collectionFilter').addEventListener('change',e=>{state.collection=e.target.value;state.limit=15;render();});
    $('fromYear').addEventListener('change',e=>{state.from=e.target.value;state.limit=15;render();});
    $('toYear').addEventListener('change',e=>{state.to=e.target.value;state.limit=15;render();});
    $('resetFilters').addEventListener('click',()=>{
      state.collection='all';state.from='';state.to='';
      ['collectionFilter','fromYear','toYear'].forEach(id=>$(id).value=id==='collectionFilter'?'all':'');
      state.limit=15;render();
    });
    for(const [id,value] of [['metricCount','count'],['metricShare','share']]){
      $(id).addEventListener('click',()=>{state.annualMetric=value;setSelected('metricCount','metricShare',value==='count');renderAnnual();});
    }
    for(const [id,value] of [['rankTheses','theses'],['rankOccurrences','occurrences']]){
      $(id).addEventListener('click',()=>{state.rankingMetric=value;setSelected('rankTheses','rankOccurrences',value==='theses');renderRanking();});
    }
    $('laureateSearch').addEventListener('input',()=>renderSearch());
    $('laureateSearch').addEventListener('keydown',e=>{
      if(e.key==='Enter'){const items=filteredNobels();if(items.length){setLaureate(items[0].id);e.preventDefault();}}
    });
    $('showMore').addEventListener('click',()=>{state.limit+=20;renderTable();});
  }
  function setSelected(first,second,firstSelected){
    for(const [id,on] of [[first,firstSelected],[second,!firstSelected]]){$(id).classList.toggle('selected',on);$(id).setAttribute('aria-pressed',String(on));}
  }

  function filteredTheses(){
    const low=state.from===''?-Infinity:Number(state.from),high=state.to===''?Infinity:Number(state.to);
    return theses.filter(t=>
      (state.collection==='all'||t.collection===state.collection)&&
      (t.year==null ? (state.from===''&&state.to==='') : (t.year>=low&&t.year<=high)));
  }
  function mentionStats(filtered){
    const keys=new Set(filtered.map(t=>t.id));
    const result=new Map(nobels.map(n=>[n.id,{nobel:n,theses:0,occurrences:0}]));
    for(const m of mentions){if(!keys.has(m.thesisId))continue;const st=result.get(m.nobelId);if(st){st.theses++;st.occurrences+=m.count;}}
    return result;
  }
  function renderStats(){
    const all=filteredTheses();const readable=all.filter(t=>t.hasText);
    const mentioning=readable.filter(t=>t.mentionsAny);
    $('statTotal').textContent=fmt.format(all.length);
    $('statAnalyzed').textContent=fmt.format(readable.length);
    $('statCoverage').textContent=`${percent(readable.length,all.length)} del total de tesis`;
    $('statMentioning').textContent=fmt.format(mentioning.length);
    $('statShare').textContent=`${percent(mentioning.length,readable.length)} de las tesis con texto`;
    $('statLaureates').textContent=fmt.format([...mentionStats(all).values()].filter(x=>x.theses>0).length);
  }
  function emptyPlot(id,message){$(id).innerHTML=`<div class="chart-empty">${E(message)}</div>`;}
  function basePlotLayout(more={}){
    return {
      font:{family:'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',size:11,color:COLORS.navy},
      paper_bgcolor:'#ffffff',plot_bgcolor:'#ffffff',margin:{l:56,r:25,t:22,b:52},showlegend:false,
      hoverlabel:{bgcolor:'#fff',bordercolor:'#dde4e7',font:{color:COLORS.navy,size:12}},
      ...more,
    };
  }
  const plotConfig={responsive:true,displaylogo:false,modeBarButtonsToRemove:['lasso2d','select2d','autoScale2d','zoom2d','pan2d','toImage']};
  function renderAnnual(){
    const all=filteredTheses().filter(t=>t.hasText && Number.isInteger(t.year));
    const yearly=new Map();
    for(const t of all){const d=yearly.get(t.year)||{total:0,yes:0};d.total++;if(t.mentionsAny)d.yes++;yearly.set(t.year,d);}
    const years=[...yearly.keys()].sort((a,b)=>a-b);
    if(!years.length){emptyPlot('annualChart','No hay tesis con texto analizable y año de publicación para los filtros seleccionados.');return;}
    if(typeof Plotly==='undefined'){emptyPlot('annualChart','No se pudo cargar la biblioteca de gráficos. Conectate a internet para visualizar los gráficos.');return;}
    const y=years.map(x=>String(x));
    let traces,layout;
    if(state.annualMetric==='count'){
      traces=[
        {x:y,y:years.map(k=>yearly.get(k).total),type:'bar',name:'Tesis con texto analizable',marker:{color:'#c9d9ea'},width:.73,hovertemplate:'%{x}<br>Tesis con texto analizable: %{y}<extra></extra>'},
        {x:y,y:years.map(k=>yearly.get(k).yes),type:'bar',name:'Tesis que mencionan un Nobel',marker:{color:COLORS.orange},width:.46,hovertemplate:'%{x}<br>Tesis que mencionan un apellido Nobel: %{y}<extra></extra>'}
      ];
      layout=basePlotLayout({barmode:'overlay',xaxis:{type:'category',tickangle:years.length>24?-55:0,showgrid:false,tickfont:{color:COLORS.muted}},yaxis:{title:{text:'Cantidad de tesis',standoff:12},rangemode:'tozero',gridcolor:'#edf0f1',zeroline:false}});
      $('comparisonLegend').hidden=false;
    }else{
      traces=[{x:y,y:years.map(k=>yearly.get(k).yes/yearly.get(k).total*100),type:'scatter',mode:'lines+markers',line:{color:COLORS.orange,width:3},marker:{size:7,color:COLORS.orange},fill:'tozeroy',fillcolor:'rgba(45,112,186,.10)',customdata:years.map(k=>[yearly.get(k).yes,yearly.get(k).total]),hovertemplate:'%{x}<br>%{y:.1f}% de las tesis con texto<br>%{customdata[0]} de %{customdata[1]} tesis<extra></extra>'}];
      layout=basePlotLayout({xaxis:{type:'category',tickangle:years.length>24?-55:0,showgrid:false,tickfont:{color:COLORS.muted}},yaxis:{title:{text:'Porcentaje de tesis (%)',standoff:12},range:[0,100],ticksuffix:'%',gridcolor:'#edf0f1',zeroline:false}});
      $('comparisonLegend').hidden=true;
    }
    Plotly.react('annualChart',traces,layout,plotConfig);
  }
  function renderRanking(){
    const stats=[...mentionStats(filteredTheses()).values()].sort((a,b)=>b[state.rankingMetric]-a[state.rankingMetric]||a.nobel.name.localeCompare(b.nobel.name));
    const top=stats.filter(x=>x[state.rankingMetric]>0).slice(0,12).reverse();
    $('rankingSubtitle').textContent=state.rankingMetric==='theses'?'Ordenados por cantidad de tesis que mencionan su apellido.':'Ordenados por cantidad total de apariciones del apellido.';
    if(!top.length){emptyPlot('rankingChart','No hay menciones a apellidos de premios Nobel con los filtros seleccionados.');return;}
    if(typeof Plotly==='undefined'){emptyPlot('rankingChart','No se pudo cargar la biblioteca de gráficos. Conectate a internet para visualizar los gráficos.');return;}
    const trace={type:'bar',orientation:'h',y:top.map(x=>x.nobel.name),x:top.map(x=>x[state.rankingMetric]),customdata:top.map(x=>x.nobel.id),marker:{color:top.map((_,i)=>i===top.length-1?COLORS.orange:'#9ebbdc')},hovertemplate:'%{y}<br>%{x} '+(state.rankingMetric==='theses'?'tesis':'menciones')+'<extra>Hacé clic para explorar</extra>'};
    const layout=basePlotLayout({margin:{l:174,r:38,t:18,b:35},height:Math.max(390,top.length*34+60),xaxis:{rangemode:'tozero',gridcolor:'#edf0f1',zeroline:false,title:{text:state.rankingMetric==='theses'?'Cantidad de tesis':'Apariciones del apellido',font:{size:11}}},yaxis:{showgrid:false,automargin:true,tickfont:{size:11,color:COLORS.navy}}});
    const plot=$('rankingChart');
    Plotly.react(plot,[trace],layout,plotConfig).then(()=>{
      if(typeof plot.removeAllListeners==='function')plot.removeAllListeners('plotly_click');
      if(typeof plot.on === 'function') plot.on('plotly_click',evt=>{const id=evt.points?.[0]?.customdata;if(id){setLaureate(id);document.getElementById('explore').scrollIntoView({behavior:'smooth'});}});
    });
  }
  function filteredNobels(){
    const query=$('laureateSearch').value.trim().toLocaleLowerCase('es');
    const stats=mentionStats(filteredTheses());
    const result=nobels.filter(n=>!query||(`${n.name} ${n.surname} ${n.awardYear}`).toLocaleLowerCase('es').includes(query));
    if(!query){return result.sort((a,b)=>(stats.get(b.id)?.theses||0)-(stats.get(a.id)?.theses||0)||a.name.localeCompare(b.name)).slice(0,10);}
    return result.sort((a,b)=>(stats.get(b.id)?.theses||0)-(stats.get(a.id)?.theses||0)||a.name.localeCompare(b.name)).slice(0,25);
  }
  function renderSearch(){
    const stats=mentionStats(filteredTheses());const list=filteredNobels();
    $('laureateOptions').innerHTML=list.length?list.map(n=>`<button type="button" class="laureate-option ${n.id===state.nobelId?'active':''}" data-nobel="${E(n.id)}" role="option" aria-selected="${n.id===state.nobelId}"><span>${E(n.name)}</span><small>${n.awardYear} · ${stats.get(n.id)?.theses||0} tesis</small></button>`).join(''):'<div class="empty-row">No se encontraron premios Nobel.</div>';
    $('laureateOptions').querySelectorAll('[data-nobel]').forEach(b=>b.addEventListener('click',()=>setLaureate(b.dataset.nobel)));
  }
  function setLaureate(id){
    if(!nobels.some(n=>n.id===id))return;
    state.nobelId=id;state.limit=15;
    // Deep-link permite compartir un economista específico.
    try{const u=new URL(window.location.href);u.searchParams.set('nobel',id);window.history.replaceState({},'',u);}catch{}
    renderSearch();renderDetail();renderTable();
  }
  function selectedPairs(){
    const keys=new Set(filteredTheses().map(t=>t.id));
    return (countsByNobel.get(state.nobelId)||[]).filter(m=>keys.has(m.thesisId));
  }
  function renderDetail(){
    const n=nobels.find(x=>x.id===state.nobelId);
    if(!n){$('laureateDetail').innerHTML='<p class="empty-detail">Seleccioná un premio Nobel para ver sus resultados.</p>';return;}
    const rows=selectedPairs();const count=rows.reduce((a,r)=>a+r.count,0);
    $('laureateDetail').innerHTML=`<div class="detail-overline">PREMIO NOBEL · ${E(n.awardYear)}</div><h3>${E(n.name)}</h3><p class="detail-meta">Premio Nobel de Economía · Año ${n.awardYear}</p><div class="detail-stats"><div><strong>${fmt.format(rows.length)}</strong><small>Tesis que mencionan el apellido</small></div><div><strong>${fmt.format(count)}</strong><small>Menciones en las tesis</small></div><div><strong>${fmt.format(n.awardYear)}</strong><small>Año del premio Nobel</small></div></div><div class="detail-note">Conteo simple de apellidos · Se aplican los filtros de colección y año de tesis.</div>`;
  }
  function renderTable(){
    const n=nobels.find(x=>x.id===state.nobelId);
    $('thesisTableTitle').textContent=n?`Tesis que mencionan ${n.surname}`:'Tesis que mencionan al Nobel seleccionado';
    if(!n){$('thesisTableBody').innerHTML='<tr><td colspan="5">Elegí un premio Nobel arriba.</td></tr>';return;}
    const pairs=selectedPairs().map(m=>({m,t:thesisMap.get(m.thesisId)})).filter(x=>x.t).sort((a,b)=>b.m.count-a.m.count||(b.t.year||0)-(a.t.year||0));
    $('tableCount').textContent=`${fmt.format(pairs.length)} tesis`;
    const shown=pairs.slice(0,state.limit);
    $('thesisTableBody').innerHTML=shown.length?shown.map(({m,t})=>`<tr><td><a class="title-link" href="${E(safeLink(t.url))}" target="_blank" rel="noopener noreferrer">${E(t.title)}</a><div class="author">${E(t.author||'Autor no informado')}</div></td><td>${t.year??'—'}</td><td>${E(t.collectionLabel)}</td><td class="mono-num">${fmt.format(m.count)}</td><td><a class="source-link" href="${E(safeLink(t.url))}" target="_blank" rel="noopener noreferrer">Abrir ↗</a></td></tr>`).join(''):'<tr><td colspan="5">No hay tesis para los filtros seleccionados.</td></tr>';
    $('tableShowing').textContent=pairs.length?`Mostrando ${Math.min(state.limit,pairs.length)} de ${fmt.format(pairs.length)} tesis`:'No hay tesis para mostrar';
    $('showMore').hidden=pairs.length<=state.limit;
  }
  function render(){renderStats();renderAnnual();renderRanking();renderSearch();renderDetail();renderTable();}
  async function boot(){
    try{
      [theses,nobels,mentions,meta]=await Promise.all(['tesis','nobeles','menciones','metadata'].map(loadJson));
      if(!Array.isArray(theses)||!Array.isArray(nobels)||!Array.isArray(mentions))throw new Error('Formato de datos JSON no válido');
      thesisMap=new Map(theses.map(t=>[t.id,t]));
      countsByNobel=new Map(nobels.map(n=>[n.id,[]]));
      for(const m of mentions){if(countsByNobel.has(m.nobelId))countsByNobel.get(m.nobelId).push(m);}
      initControls();
      if(!meta.ready||!theses.length){
        showMessage('No hay datos reales publicados todavía. Ejecutá build_data.py con tus CSV para generar data/*.json; después volvé a abrir la web.','');
        ['annualChart','rankingChart'].forEach(id=>emptyPlot(id,'Esperando los datos de las tesis.'));
        $('statTotal').textContent='0';$('statAnalyzed').textContent='0';$('statMentioning').textContent='0';$('statLaureates').textContent='0';
        $('statCoverage').textContent='—';$('statShare').textContent='—';
        return;
      }
      const published = meta.updatedAt?new Date(meta.updatedAt):null;
      $('updatedTag').textContent=published&&!isNaN(published)?`Actualizado el ${published.toLocaleDateString('es-AR',{day:'numeric',month:'short',year:'numeric'})}`:'Datos cargados';
      $('heroLatestNobel').textContent=Math.max(...nobels.map(n=>n.awardYear));
      const missing=meta.missingPublicationYear||0;
      const extra=missing?` ${missing} tesis no tienen año de publicación identificable.`:'';
      showMessage(`Se muestran ${fmt.format(theses.length)} registros de tesis de ${new Set(theses.map(t=>t.collection)).size} colecciones de Economía. ${fmt.format(meta.withText)} tienen texto analizable.${extra}`,'ok');
      let initial=null;
      try{initial=new URL(window.location.href).searchParams.get('nobel');}catch{}
      if(!nobels.some(n=>n.id===initial)){
        const counts=mentionStats(theses);
        initial=[...nobels].sort((a,b)=>(counts.get(b.id)?.theses||0)-(counts.get(a.id)?.theses||0))[0]?.id||null;
      }
      state.nobelId=initial;
      render();
    }catch(err){console.error(err);showMessage(`No fue posible cargar los datos: ${err.message}. Para probar la página localmente, iniciá un servidor con python -m http.server 8000.`, 'error');}
  }
  boot();
})();
