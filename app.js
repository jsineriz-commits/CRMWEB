// ---------------------------------------------------------
// IMPORTANTE: PEGÁ AQUÍ LA URL DE IMPLEMENTACIÓN DE APPS SCRIPT
// ---------------------------------------------------------
const GAS_API_URL = "https://script.google.com/macros/s/SU_ID_AQUI/exec";

let todosLosLeads = [];
let leadsFiltradosActuales = [];
let chartEstados = null, chartActividad = null, chartEvolucion = null, chartFuente = null;
let userRole = "comercial";
let colorSemaforoActual = 'red';

const ordenPipeline = ['EN REVISION','NUEVO','ABIERTO','CONVERTIDO','EN AGENDA','ACTIVO','OPERANDO','NO HABILITADO'];
const colorMap = {
  'EN REVISION': { bg:'#F3E8FF', text:'#9333EA', border:'#A855F7' },
  'NUEVO':       { bg:'#FEF3C7', text:'#D97706', border:'#F59E0B' },
  'ABIERTO':     { bg:'#DBEAFE', text:'#2563EB', border:'#3B82F6' },
  'CONVERTIDO':  { bg:'#D1FAE5', text:'#059669', border:'#10B981' },
  'EN AGENDA':   { bg:'#EFF6FF', text:'#2563EB', border:'#93C5FD' },
  'ACTIVO':      { bg:'#DCFCE7', text:'#16A34A', border:'#22C55E' },
  'OPERANDO':    { bg:'#CCFBF1', text:'#0F766E', border:'#14B8A6' },
  'NO HABILITADO':{ bg:'#F1F5F9', text:'#475569', border:'#64748B' },
  'DESCARTADO':  { bg:'#FFE4E6', text:'#E11D48', border:'#F43F5E' }
};
const paletaActividades = {
  'CRÍA':'#00428A','RECRÍA':'#007BB8','ENGORDE / INVERNADA':'#00A3E0','CICLO COMPLETO':'#7DD3FC','OTROS':'#CBD5E1'
};
const coloresFuente = ['#14B8A6','#F59E0B','#8B5CF6','#EC4899','#3B82F6','#64748B'];

function toggleDropdownActividad() { document.getElementById('dropdownActividad').classList.toggle('d-none'); }
document.addEventListener('click', function(event) {
  const contenedor = document.getElementById('contenedorMultiSelect');
  if (contenedor && !contenedor.contains(event.target)) {
    const drop = document.getElementById('dropdownActividad');
    if (drop && !drop.classList.contains('d-none')) drop.classList.add('d-none');
  }
});
function formatDisplayDate(ts) {
  if (!ts) return "-";
  let d = new Date(ts);
  return ("0"+d.getDate()).slice(-2)+"/"+("0"+(d.getMonth()+1)).slice(-2)+"/"+d.getFullYear();
}
function calcularDias(ts) {
  if (!ts) return 0;
  let hoy = new Date(); hoy.setHours(0,0,0,0);
  let d = new Date(ts); d.setHours(0,0,0,0);
  let diff = Math.floor((hoy - d)/(1000*60*60*24));
  return diff >= 0 ? diff : 0;
}

window.onload = function() {
  const mailGuardado = localStorage.getItem('crm_user_email');
  if (mailGuardado) { document.getElementById('emailInput').value = mailGuardado; procesarIngreso(); }
};

function procesarIngreso() {
  const email = document.getElementById('emailInput').value.trim();
  if (!email) return alert("Por favor, ingresá un email válido.");
  const dataCache = localStorage.getItem('crm_cache_leads_' + email);
  if (dataCache) iniciarApp(JSON.parse(dataCache), email, true);
  else {
    document.getElementById('btnIngresar').disabled = true;
    document.getElementById('btnIngresar').innerText = "Verificando...";
    document.getElementById('login-screen').classList.add('d-none');
    document.getElementById('main-app').classList.remove('d-none');
    document.getElementById('loader').classList.remove('d-none');
  }
  fetch(GAS_API_URL + "?action=getLeads&email=" + encodeURIComponent(email))
    .then(response => response.json())
    .then(data => { if (data.error) mostrarError(new Error(data.error)); else procesarDatosNuevos(data, email); })
    .catch(err => mostrarError(err));
}

function iniciarApp(respuesta, email, desdeCache) {
  const leads = respuesta.leads; userRole = respuesta.rol;
  if (!leads || leads.length === 0) {
    if (!desdeCache) document.getElementById('login-screen').classList.remove('d-none');
    document.getElementById('main-app').classList.add('d-none');
    localStorage.removeItem('crm_user_email'); return;
  }
  localStorage.setItem('crm_user_email', email);
  document.getElementById('login-screen').classList.add('d-none');
  document.getElementById('main-app').classList.remove('d-none');
  document.getElementById('loader').classList.add('d-none');
  document.getElementById('buscadorGlobal').classList.remove('d-none');
  document.getElementById('filtrosGlobales').classList.remove('d-none');
  if (userRole === "admin") document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('d-none'));
  if (window.innerWidth < 768) document.getElementById('mobile-tabs').style.display = 'flex';
  switchTab('dash'); todosLosLeads = leads; cargarOpcionesFiltros(leads); aplicarFiltros();
}

function procesarDatosNuevos(respuesta, email) {
  localStorage.setItem('crm_cache_leads_' + email, JSON.stringify(respuesta));
  if (JSON.stringify(todosLosLeads) !== JSON.stringify(respuesta.leads)) {
    if (todosLosLeads.length === 0) iniciarApp(respuesta, email, false);
    else { todosLosLeads = respuesta.leads; cargarOpcionesFiltros(respuesta.leads); aplicarFiltros(); }
  }
}

function cerrarSesion() {
  localStorage.removeItem('crm_user_email');
  document.getElementById('emailInput').value = '';
  document.getElementById('main-app').classList.add('d-none');
  document.getElementById('login-screen').classList.remove('d-none');
  todosLosLeads = [];
}

function mostrarError(error) {
  document.getElementById('loader').innerHTML = `<div class="alert alert-danger m-3"><strong>Error de Servidor:</strong><br>${error.message}<br><button class="btn btn-outline-danger mt-2" onclick="cerrarSesion()">Volver</button></div>`;
}

function switchTab(tabId) {
  ['dash','lista','ranking','insights'].forEach(id => document.getElementById('view-'+id).classList.add('d-none'));
  document.getElementById('view-'+tabId).classList.remove('d-none');
  document.querySelectorAll('#pc-tabs button').forEach(b => b.classList.remove('active'));
  let pcBtn = document.querySelector(`#pc-tabs button[onclick="switchTab('${tabId}')"]`);
  if (pcBtn) pcBtn.classList.add('active');
  if (document.getElementById('mobile-tabs')) {
    document.querySelectorAll('.mobile-nav button').forEach(b => b.classList.remove('active'));
    let mobBtn = document.getElementById('btn-mob-'+tabId);
    if (mobBtn) mobBtn.classList.add('active');
  }
}

function limpiarOtrasActividades() {
  const chkTodas = document.getElementById('chkActTodas');
  if (chkTodas.checked) document.querySelectorAll('.chk-act-item').forEach(cb => cb.checked = false);
  aplicarFiltros();
}
function desmarcarTodasActividades() { document.getElementById('chkActTodas').checked = false; aplicarFiltros(); }

function cargarOpcionesFiltros(leads) {
  const estados=new Set(),provincias=new Set(),partidos=new Set(),actividades=new Set(),comerciales=new Set(),fuentes=new Set(),mesesSet=new Set(),aniosSet=new Set();
  const nombresMeses=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  leads.forEach(lead => {
    if(lead.mesNum) mesesSet.add(lead.mesNum);
    if(lead.anioFiltro) aniosSet.add(lead.anioFiltro);
    if(lead.estado) estados.add(lead.estado.toUpperCase());
    if(lead.provincia && lead.provincia!=='S/D') provincias.add(lead.provincia);
    if(lead.partido && lead.partido!=='S/D') partidos.add(lead.partido);
    if(lead.actividad && lead.actividad!=='S/D') actividades.add(lead.actividad);
    if(lead.ac && lead.ac!=='Sin Asignar') comerciales.add(lead.ac);
    if(lead.fuente && lead.fuente!=='-') fuentes.add(lead.fuente);
  });
  let mesesOrdenados = Array.from(mesesSet).sort((a,b)=>a-b).map(num=>nombresMeses[num-1]);
  let aniosOrdenados = Array.from(aniosSet).sort((a,b)=>b-a);
  const selIds=['filtroMesNombre','filtroAnio','filtroEstado','filtroProvincia','filtroPartido','filtroFuente','filtroComercial'];
  selIds.forEach(id => { if(document.getElementById(id)) document.getElementById(id).innerHTML=`<option value="">${id.replace('filtro','')} (Todos)</option>`; });
  llenarSelect('filtroMesNombre',mesesOrdenados);
  llenarSelect('filtroAnio',aniosOrdenados);
  llenarSelect('filtroEstado',Array.from(estados).sort());
  llenarSelect('filtroFuente',Array.from(fuentes).sort());
  llenarSelect('filtroProvincia',Array.from(provincias).sort());
  llenarSelect('filtroPartido',Array.from(partidos).sort());
  if (userRole==="admin") llenarSelect('filtroComercial',Array.from(comerciales).sort());
  const listaActs = document.getElementById('dropdownActividad');
  listaActs.innerHTML = `<div class="form-check mb-2 pb-2 border-bottom"><input class="form-check-input" type="checkbox" id="chkActTodas" checked onchange="limpiarOtrasActividades()"><label class="form-check-label fw-bold w-100" for="chkActTodas" style="cursor:pointer;font-size:0.85rem;color:#00428A;">Todas las Actividades</label></div>`;
  Array.from(actividades).sort().forEach((act, index) => {
    listaActs.innerHTML += `<div class="form-check mb-1"><input class="form-check-input chk-act-item" type="checkbox" value="${act}" id="chkAct_${index}" onchange="desmarcarTodasActividades()"><label class="form-check-label w-100 text-truncate" for="chkAct_${index}" style="cursor:pointer;font-size:0.85rem;">${act}</label></div>`;
  });
}

function llenarSelect(id, opciones) {
  const select = document.getElementById(id);
  if (select) opciones.forEach(op => { let o=document.createElement("option"); o.value=op; o.text=op; select.add(o); });
}

function actualizarDashboard(leads) {
  let estadosCount={},actividadCount={},fuenteCount={},evolucionCount={},total=leads.length,exitos=0,trabajables=0;
  leads.forEach(lead => {
    let est=(lead.estado||'SIN ESTADO').toUpperCase().trim();
    estadosCount[est]=(estadosCount[est]||0)+1;
    if(['NUEVO','ABIERTO','CONVERTIDO','ACTIVO','OPERANDO','EN AGENDA'].includes(est)){trabajables++;if(est==='ACTIVO'||est==='OPERANDO')exitos++;}
    let rawAct=lead.actividad||'S/D';
    if(rawAct!=='S/D'){rawAct.toUpperCase().replace(/ Y /g,',').split(',').forEach(item=>{let act=item.trim();if(act.includes('CICLO COMPLETO'))act='CICLO COMPLETO';else if(act.includes('ENGORDE')||act.includes('INVERNADA'))act='ENGORDE / INVERNADA';else if(act==='CRÍA'||act==='CRIA')act='CRÍA';else if(act==='RECRÍA'||act==='RECRIA')act='RECRÍA';else if(act!=='')act='OTROS';if(act!=='')actividadCount[act]=(actividadCount[act]||0)+1;});}
    let fuente=lead.fuente||'S/D';if(fuente!=='-')fuenteCount[fuente]=(fuenteCount[fuente]||0)+1;
    if(lead.anioFiltro&&lead.mesNum){let clave=lead.mesAnioSort;if(!evolucionCount[clave])evolucionCount[clave]={label:`${lead.mesFiltro.substring(0,3)} ${lead.anioFiltro}`,count:0};evolucionCount[clave].count++;}
  });
  let estadosOrdenados=Object.keys(estadosCount).sort((a,b)=>{let ia=ordenPipeline.indexOf(a),ib=ordenPipeline.indexOf(b);if(ia!==-1&&ib!==-1)return ia-ib;if(ia!==-1)return -1;if(ib!==-1)return 1;return estadosCount[b]-estadosCount[a];});
  let winRate=trabajables>0?((exitos/trabajables)*100).toFixed(1):0;
  let kpiHtml=`<div class="col-12 col-md-4"><div class="kpi-card" style="background:linear-gradient(135deg,#00428A,#00A3E0);color:white;border:none;" onclick="abrirDesplegable('TOTAL')"><div class="d-flex justify-content-between align-items-center"><div><div class="kpi-title" style="color:rgba(255,255,255,0.8);">CUENTAS AGREGADAS</div><div class="kpi-value" style="color:white;font-size:2.2rem;">${total}</div></div><div class="text-end"><div class="kpi-title" style="color:rgba(255,255,255,0.8);">TASA DE ÉXITO</div><div class="kpi-value" style="color:white;font-size:1.8rem;">${winRate}%</div></div></div></div></div>`;
  estadosOrdenados.forEach(estado=>{let conf=colorMap[estado]||{text:'#64748B',border:'#CBD5E1'};kpiHtml+=`<div class="col-6 col-md-4"><div class="kpi-card" style="border-left:4px solid ${conf.border};" onclick="abrirDesplegable('${estado}')"><div class="kpi-title">${estado}</div><div class="kpi-value" style="color:${conf.text};">${estadosCount[estado]}</div></div></div>`;});
  document.getElementById('kpi-cards-container').innerHTML=kpiHtml;
  Chart.defaults.font.family='-apple-system,BlinkMacSystemFont,"Segoe UI",Arial';Chart.defaults.color='#64748B';
  let keysEv=Object.keys(evolucionCount).sort((a,b)=>a-b),labelsEv=keysEv.map(k=>evolucionCount[k].label),dataEv=keysEv.map(k=>evolucionCount[k].count);
  if(chartEvolucion)chartEvolucion.destroy();chartEvolucion=new Chart(document.getElementById('chartEvolucion').getContext('2d'),{type:'bar',data:{labels:labelsEv,datasets:[{label:'Cuentas agregadas',data:dataEv,backgroundColor:'#00A3E0',borderRadius:4}]},options:{maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{display:false}},y:{beginAtZero:true,border:{display:false}}}}});
  if(chartEstados)chartEstados.destroy();chartEstados=new Chart(document.getElementById('chartEstados').getContext('2d'),{type:'bar',data:{labels:estadosOrdenados,datasets:[{data:estadosOrdenados.map(e=>estadosCount[e]),backgroundColor:estadosOrdenados.map(e=>colorMap[e]?colorMap[e].border:'#94A3B8'),borderRadius:4}]},options:{indexAxis:'y',maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{display:false},y:{border:{display:false},grid:{display:false},ticks:{font:{weight:'600',size:10}}}}}});
  let acts=Object.keys(actividadCount).sort((a,b)=>actividadCount[b]-actividadCount[a]),actsColors=acts.map(a=>paletaActividades[a]||'#94A3B8');
  if(chartActividad)chartActividad.destroy();chartActividad=new Chart(document.getElementById('chartActividad').getContext('2d'),{type:'doughnut',data:{labels:acts,datasets:[{data:acts.map(a=>actividadCount[a]),backgroundColor:actsColors,borderWidth:1,borderColor:'#FFF'}]},options:{maintainAspectRatio:false,cutout:'65%',plugins:{legend:{position:'right',labels:{usePointStyle:true,boxWidth:6,padding:10,font:{size:10}}}}}});
  let fts=Object.keys(fuenteCount).sort((a,b)=>fuenteCount[b]-fuenteCount[a]),ftsColors=fts.map((f,i)=>coloresFuente[i%coloresFuente.length]);
  if(chartFuente)chartFuente.destroy();chartFuente=new Chart(document.getElementById('chartFuente').getContext('2d'),{type:'doughnut',data:{labels:fts,datasets:[{data:fts.map(f=>fuenteCount[f]),backgroundColor:ftsColors,borderWidth:1,borderColor:'#FFF'}]},options:{maintainAspectRatio:false,cutout:'65%',plugins:{legend:{position:'right',labels:{usePointStyle:true,boxWidth:6,padding:10,font:{size:10}}}}}});
}

function obtenerGrupoDeColor(estado) {
  let e=(estado||'').toUpperCase();
  if(e==='NUEVO')return 'red';
  if(['ABIERTO','CONVERTIDO'].includes(e))return 'yellow';
  if(['EN AGENDA'].includes(e))return 'blue';
  if(['ACTIVO','OPERANDO'].includes(e))return 'green';
  return 'otro';
}

function renderizarSemaforo(leads) {
  let conteos={red:0,yellow:0,blue:0,green:0};
  leads.forEach(l=>{let g=obtenerGrupoDeColor(l.estado);if(conteos[g]!==undefined)conteos[g]++;});
  document.getElementById('count-red').innerText=conteos.red;
  document.getElementById('count-yellow').innerText=conteos.yellow;
  document.getElementById('count-blue').innerText=conteos.blue;
  document.getElementById('count-green').innerText=conteos.green;
  seleccionarSemoforo(colorSemaforoActual);
}

function seleccionarSemoforo(color) {
  colorSemaforoActual=color;
  ['red','yellow','blue','green'].forEach(c=>document.getElementById('card-insight-'+c).classList.remove('active-card'));
  document.getElementById('card-insight-'+color).classList.add('active-card');
  let titulos={red:'🔴 Leads Nuevos',yellow:'🟡 Leads en Gestión (Abiertos / Convertidos)',blue:'🔵 Leads en Agenda',green:'🟢 Leads Operando (Activos / Operando)'};
  document.getElementById('titulo-lista-semaforo').innerText=titulos[color];
  let leadsDelColor=leadsFiltradosActuales.filter(l=>obtenerGrupoDeColor(l.estado)===color);
  let contenedor=document.getElementById('contenedor-lista-semaforo');
  if(leadsDelColor.length===0){contenedor.innerHTML=`<div class="text-muted text-center py-4">No hay cuentas en esta carpeta.</div>`;return;}
  let html='';
  leadsDelColor.forEach(lead=>{
    let selectClass=color==='red'?'select-red':(color==='yellow'?'select-yellow':(color==='blue'?'select-blue':'select-green'));
    let kpiHtml=lead.qTotal&&Number(lead.qTotal)>0?`<span class="badge bg-dark ms-2">Q: ${Number(lead.qTotal).toLocaleString('es-AR')}</span>`:'';
    let acName=userRole==='admin'?`<div class="text-micro text-muted mt-1">👤 AC: ${lead.ac}</div>`:'';
    html+=`<div class="lead-insight-card d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3"><div onclick="abrirModalLead('${lead.id}')" style="cursor:pointer;flex-grow:1;"><div class="fw-bold" style="font-size:1rem;color:#00428A;">${lead.titulo} <span class="text-muted fw-normal" style="font-size:0.75rem;">#${lead.id}</span></div><div class="text-muted" style="font-size:0.85rem;">${lead.razonSocial||'Sin Razón Social'} ${kpiHtml}</div>${acName}</div><div style="min-width:220px;"><select onchange="cambiarCarpetaColor('${lead.id}',this.value)" class="form-select color-select ${selectClass}"><option value="red" ${color==='red'?'selected':''}>🔴 Mover a Nuevos</option><option value="yellow" ${color==='yellow'?'selected':''}>🟡 Mover a En Gestión</option><option value="blue" ${color==='blue'?'selected':''}>🔵 Mover a En Agenda</option><option value="green" ${color==='green'?'selected':''}>🟢 Mover a Operando</option></select></div></div>`;
  });
  contenedor.innerHTML=html;
}

function cambiarCarpetaColor(idLead, nuevoColor) {
  let nuevoEstado='';
  if(nuevoColor==='red')nuevoEstado='NUEVO';else if(nuevoColor==='yellow')nuevoEstado='ABIERTO';else if(nuevoColor==='blue')nuevoEstado='EN AGENDA';else if(nuevoColor==='green')nuevoEstado='OPERANDO';
  document.getElementById('savingBadge').classList.remove('d-none');document.getElementById('savingBadge').classList.add('d-flex');
  let leadGlobal=todosLosLeads.find(l=>String(l.id)===String(idLead));
  if(leadGlobal){leadGlobal.estado=nuevoEstado;leadGlobal.tsUltimo=new Date().getTime();}
  aplicarFiltros();
  fetch(GAS_API_URL,{method:'POST',body:JSON.stringify({action:'actualizarEstado',leadId:idLead,nuevoEstado:nuevoEstado})})
    .then(res=>res.json())
    .then(res=>{document.getElementById('savingBadge').classList.add('d-none');document.getElementById('savingBadge').classList.remove('d-flex');if(!res.success)alert("Aviso al guardar: "+res.message);})
    .catch(err=>{document.getElementById('savingBadge').classList.add('d-none');document.getElementById('savingBadge').classList.remove('d-flex');alert("Error al comunicar: "+err.message);});
}

function renderizarTablaPlana(leads) {
  const tbody=document.getElementById('leadsContainerTable');document.getElementById('contadorLista').innerText=`${leads.length} registros`;
  if(leads.length===0){tbody.innerHTML=`<tr><td colspan="${userRole==='admin'?6:5}" class="text-center text-muted py-4">No se encontraron leads.</td></tr>`;return;}
  let filasHTML='';
  leads.forEach(lead=>{
    let estadoLabel=(lead.estado||'NUEVO').toUpperCase(),colors=colorMap[estadoLabel]||{bg:'#F1F5F9',text:'#475569'};
    let acColumn=userRole==='admin'?`<td class="d-none d-md-table-cell"><span class="text-micro text-truncate d-block" style="max-width:120px;">${lead.ac}</span></td>`:'';
    let leadTimeHtml='';if(['NUEVO','ABIERTO','CONVERTIDO','EN AGENDA'].includes(estadoLabel)){let dias=calcularDias(lead.tsUltimo),colorAlerta=dias>14?'#DC2626':(dias>7?'#D97706':'#059669');leadTimeHtml=`<span style="font-size:0.65rem;font-weight:700;color:${colorAlerta};display:block;margin-top:4px;">⏳ ${dias} días</span>`;}
    filasHTML+=`<tr onclick="abrirModalLead('${lead.id}')"><td class="text-muted fw-bold">#${lead.id}</td><td><div style="font-weight:600;">${lead.titulo}</div><div class="text-micro text-truncate" style="max-width:250px;">${lead.razonSocial}</div><div class="text-micro text-muted text-truncate" style="max-width:250px;margin-top:3px;"><span style="color:#0077A3;font-weight:600;">🌐 ${lead.fuente}</span>${lead.comentario?` | 💬 ${lead.comentario}`:''}</div></td>${acColumn}<td class="d-none d-md-table-cell"><span class="text-micro fw-bold" style="color:#00428A;">🐄 ${lead.actividad}</span></td><td class="d-none d-md-table-cell"><div style="line-height:1.1;">${lead.provincia}</div><div class="text-micro text-truncate">${lead.partido}</div></td><td class="text-center"><span class="badge-status" style="background-color:${colors.bg};color:${colors.text};border:1px solid ${colors.bg};display:block;">${estadoLabel}</span>${leadTimeHtml}</td></tr>`;
  });
  tbody.innerHTML=filasHTML;
}

function renderizarRanking(leads) {
  const stats={};
  leads.forEach(l=>{let ac=(l.ac&&l.ac!=='')?l.ac.trim():'Sin Asignar';if(!stats[ac])stats[ac]={total:0,trabajables:0,win:0};stats[ac].total++;let est=(l.estado||'').toUpperCase();if(['NUEVO','ABIERTO','CONVERTIDO','ACTIVO','OPERANDO','EN AGENDA'].includes(est)){stats[ac].trabajables++;if(['ACTIVO','OPERANDO'].includes(est))stats[ac].win++;}});
  let arr=Object.keys(stats).map(ac=>({ac,total:stats[ac].total,win:stats[ac].win,rate:stats[ac].trabajables>0?((stats[ac].win/stats[ac].trabajables)*100).toFixed(1):0})).sort((a,b)=>b.win-a.win);
  const tbody=document.getElementById('rankingContainerTable');tbody.innerHTML='';
  arr.forEach((item,index)=>{let m=index===0?'🥇':(index===1?'🥈':(index===2?'🥉':''));tbody.innerHTML+=`<tr><td class="fw-bold">${m} ${item.ac}</td><td class="text-center">${item.total}</td><td class="text-center fw-bold" style="color:#059669;">${item.win}</td><td class="text-center"><span class="badge" style="background:#E0F2FE;color:#0284C7;">${item.rate}%</span></td></tr>`;});
}

function abrirDesplegable(est) {
  let lds=est==='TOTAL'?leadsFiltradosActuales:leadsFiltradosActuales.filter(l=>(l.estado||'SIN ESTADO').toUpperCase()===est);
  document.getElementById('desplegableTitle').innerText=est==='TOTAL'?`Leads Filtrados`:`Estado: ${est} (${lds.length})`;
  const b=document.getElementById('desplegableBody');b.innerHTML='';
  if(lds.length===0)b.innerHTML='<div class="p-3 text-muted">No hay leads.</div>';
  else lds.forEach(l=>{b.innerHTML+=`<a href="javascript:void(0)" class="list-group-item list-group-item-action py-2" onclick="abrirModalLead('${l.id}')"><div class="d-flex justify-content-between"><h6>${l.titulo}</h6><small>#${l.id}</small></div><small>📍 ${l.provincia}</small></a>`;});
  new bootstrap.Offcanvas(document.getElementById('desplegableKPI')).show();
}

function copiarTexto(t) {
  navigator.clipboard.writeText(t).then(()=>{const btn=document.getElementById('btnCopiar');if(btn){const o=btn.innerHTML;btn.innerHTML='✅ ¡Copiado!';btn.classList.replace('btn-outline-secondary','btn-success');setTimeout(()=>{btn.innerHTML=o;btn.classList.replace('btn-success','btn-outline-secondary');},2000);}});
}

function abrirModalLead(id) {
  const lead=todosLosLeads.find(l=>String(l.id)===String(id));if(!lead)return;
  let eLab=(lead.estado||'NUEVO').toUpperCase(),col=colorMap[eLab]||{bg:'#F1F5F9',text:'#475569'};
  document.getElementById('modalTitle').innerText=lead.titulo;
  document.getElementById('modalIdSub').innerHTML=`ID #${lead.id} &nbsp;|&nbsp; <span style="color:${col.text};font-weight:700;">${eLab}</span>`;
  let tHtml='';
  if(['NUEVO','ABIERTO','CONVERTIDO','EN AGENDA'].includes(eLab)){let ds=calcularDias(lead.tsUltimo),da=calcularDias(lead.tsAsig),c=ds>14?'#DC2626':(ds>7?'#D97706':'#059669'),bg=ds>14?'#FEF2F2':(ds>7?'#FFFBEB':'#ECFDF5');tHtml=`<div class="col-12 mb-2"><div class="p-2 text-center" style="background-color:${bg};border:1px solid ${c};border-radius:8px;"><span style="color:${c};font-weight:800;">⏳ TIEMPO SIN GESTIÓN: ${ds} DÍAS</span><br><span style="color:#6B7280;font-size:0.7rem;">(Asignado hace ${da} días)</span></div></div>`;}
  let kpi=lead.qTotal&&Number(lead.qTotal)>0?`<div class="col-12 mt-2 border-top pt-3"><div class="data-label mb-2" style="color:#D97706;">🌟 KPI</div><div class="row g-2"><div class="col-4"><div class="data-block m-0"><div class="data-label">Q Total</div><div class="data-value">${Number(lead.qTotal).toLocaleString('es-AR')}</div></div></div><div class="col-4"><div class="data-block m-0"><div class="data-label">Cabezas Op.</div><div class="data-value">${Number(lead.cabOp||0).toLocaleString('es-AR')}</div></div></div><div class="col-4"><div class="data-block m-0"><div class="data-label">KPI Score</div><div class="data-value">${lead.kpiScore}</div></div></div></div></div>`:'';
  let tel='';if(lead.telefono){tel=lead.telefono.replace(/\D/g,'');if(tel.startsWith('0'))tel='549'+tel.substring(1);else if(!tel.startsWith('54')&&tel.length>=10)tel='549'+tel;}
  document.getElementById('modalBody').innerHTML=`<div class="row g-2">${tHtml}${userRole==='admin'?`<div class="col-12"><div class="data-block"><div class="data-label">Comercial</div><div class="data-value" style="color:#00A3E0;">${lead.ac}</div></div></div>`:''}<div class="col-12"><div class="data-block"><div class="data-label">Razón Social</div><div class="data-value">${lead.razonSocial}</div></div></div><div class="col-6"><div class="data-block"><div class="data-label">CUIT</div><div class="data-value">${lead.cuit}</div></div></div><div class="col-6"><div class="data-block"><div class="data-label">Fuente</div><div class="data-value">🌐 ${lead.fuente}</div></div></div><div class="col-6"><div class="data-block"><div class="data-label">Provincia</div><div class="data-value">${lead.provincia}</div></div></div><div class="col-6"><div class="data-block"><div class="data-label">Partido</div><div class="data-value">${lead.partido}</div></div></div><div class="col-6"><div class="data-block"><div class="data-label">Asignado el</div><div class="data-value">📅 ${formatDisplayDate(lead.tsAsig)}</div></div></div><div class="col-6"><div class="data-block"><div class="data-label">Último Cambio</div><div class="data-value">⏱️ ${formatDisplayDate(lead.tsUltimo)}</div></div></div>${kpi}</div><div class="row g-2 mt-3 border-top pt-3"><div class="col-12"><div class="data-label mb-2">Acciones</div></div>${lead.telefono?`<div class="col-6"><a href="tel:${tel}" class="btn btn-primary w-100 fw-bold">📞 Llamar</a></div><div class="col-6"><a href="https://wa.me/${tel}" target="_blank" class="btn btn-success w-100 fw-bold">💬 WhatsApp</a></div><div class="col-6"><button onclick="copiarTexto('${lead.telefono}')" id="btnCopiar" class="btn btn-outline-secondary w-100 fw-bold">📋 Copiar Nro</button></div>`:'<div class="col-12 text-muted">No hay teléfono.</div>'}${lead.email?`<div class="col-6"><a href="mailto:${lead.email}" class="btn btn-outline-dark w-100 fw-bold">✉️ Email</a></div>`:''}</div><div class="mt-4 border-top pt-3"><div class="data-label">Último Comentario</div><div>${lead.comentario||'<i>Sin comentarios.</i>'}</div></div>`;
  let off=document.getElementById('desplegableKPI');if(off.classList.contains('show'))bootstrap.Offcanvas.getInstance(off).hide();
  new bootstrap.Modal(document.getElementById('modalLead')).show();
}

function aplicarFiltros() {
  const tx=document.getElementById('searchInput').value.toLowerCase(),ms=document.getElementById('filtroMesNombre').value,an=document.getElementById('filtroAnio').value,es=document.getElementById('filtroEstado').value.toUpperCase(),fu=document.getElementById('filtroFuente').value,pr=document.getElementById('filtroProvincia').value,pa=document.getElementById('filtroPartido').value,co=document.getElementById('filtroComercial')?document.getElementById('filtroComercial').value:"";
  const cb=document.querySelectorAll('.chk-act-item:checked'),sa=Array.from(cb).map(c=>c.value);
  const btn=document.getElementById('textoActividadBtn');
  if(sa.length===0||(document.getElementById('chkActTodas')&&document.getElementById('chkActTodas').checked)){btn.innerText="Actividad (Todas)";if(document.getElementById('chkActTodas'))document.getElementById('chkActTodas').checked=true;}else{btn.innerText=`Actividad (${sa.length})`;}
  leadsFiltradosActuales=todosLosLeads.filter(l=>{
    return(l.titulo.toLowerCase().includes(tx)||l.razonSocial.toLowerCase().includes(tx)||l.cuit.toString().includes(tx)||l.id.toString().includes(tx)||l.comentario.toLowerCase().includes(tx)||l.telefono.toLowerCase().includes(tx))
    &&(ms===""||l.mesFiltro===ms)&&(an===""||l.anioFiltro===an)&&(es===""||l.estado.toUpperCase()===es)
    &&(fu===""||l.fuente===fu)&&(pr===""||l.provincia===pr)&&(pa===""||l.partido===pa)&&(co===""||l.ac===co)
    &&((document.getElementById('chkActTodas')&&document.getElementById('chkActTodas').checked)||sa.includes(l.actividad));
  });
  actualizarDashboard(leadsFiltradosActuales);
  renderizarSemaforo(leadsFiltradosActuales);
  if(userRole==="admin")renderizarRanking(leadsFiltradosActuales);
  renderizarTablaPlana(leadsFiltradosActuales);
}

function descargarExcel() {
  const dx=leadsFiltradosActuales.map(l=>{
    let f={"ID Lead":l.id,"Empresa":l.titulo,"Razón Social":l.razonSocial,"CUIT":l.cuit};
    if(userRole==="admin")f["Comercial"]=l.ac;
    f["Actividad"]=l.actividad;f["Fuente"]=l.fuente;f["Provincia"]=l.provincia;f["Partido"]=l.partido;
    f["Teléfono"]=l.telefono;f["Email"]=l.email;f["Estado"]=l.estado;
    f["Asignado"]=formatDisplayDate(l.tsAsig);f["Último Cambio"]=formatDisplayDate(l.tsUltimo);f["Último Comentario"]=l.comentario;
    return f;
  });
  XLSX.writeFile(XLSX.utils.book_append_sheet(XLSX.utils.book_new(),XLSX.utils.json_to_sheet(dx),"Leads_CRM"),"Reporte_Leads.xlsx");
}
