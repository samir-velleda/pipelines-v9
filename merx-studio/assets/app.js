import { CATALOG, TEMPLATES, DOCS, createProject, validateProject, buildManifest, generateRust, generateFlow, interpretPrompt, buildExecutableSpec, clampTargetFps, displayStatus, statusTone, nextProjectStatus, showDwellField, triggerKey, loginArrival, buildTestPayload } from './domain.js?v=20261102a';
import { t, localeTag, getLocale, setLocale, initLocale, persistLocale, formatDate, formatPrice, contentFor, LOCALE_NAMES, SUPPORTED_LOCALES } from './i18n.js?v=20261102a';
initLocale(localStorage, globalThis.navigator?.language);
const localeLabel = () => LOCALE_NAMES[getLocale()];

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const clamp = (n, min, max) => Math.min(max, Math.max(min, Number(n) || 0));
const fmt = date => formatDate(date);
const uid = () => crypto.randomUUID();
const STORAGE = 'merx.studio.workspace.v1';
const MAX_LOCAL_PROJECTS = 200;
const workspaceKeyFor = sub => sub ? `${STORAGE}.${sub}` : STORAGE;
const storedAuthSub = () => { try { const a = JSON.parse(sessionStorage.getItem('merx.studio.auth')); return typeof a?.sub === 'string' ? a.sub : null; } catch { return null; } };
const MODES = {presence:'Presença em área',dwell:'Tempo de permanência',line_crossing:'Cruzamento de linha'};
const CLASSES = {person:'Pessoas',car:'Carros',motorcycle:'Motos',bicycle:'Bicicletas',truck:'Caminhões',bus:'Ônibus',dog:'Cães',cat:'Gatos',backpack:'Mochilas',handbag:'Bolsas',suitcase:'Malas'};
const STARTERS = [
  {icon:'person',label:'Detectar uma pessoa',prompt:'Quando uma pessoa entrar na área da câmera, identifique a presença e gere um evento.'},
  {icon:'clock',label:'Monitorar permanência',prompt:'Quero detectar quando uma pessoa permanecer na área do caixa por mais de 10 segundos.'},
  {icon:'crossing',label:'Contar entradas e saídas',prompt:'Conte pessoas que cruzarem uma linha na entrada da loja, nos dois sentidos.'},
  {icon:'car',label:'Observar veículos',prompt:'Identifique carros que entrarem na área de acesso e gere um evento de presença.'}
];
const paths = {
  plus:'M12 5v14M5 12h14', arrow:'M12 19V5m-6 6 6-6 6 6', arrowRight:'M5 12h14m-6-6 6 6-6 6',
  chevron:'m9 5 7 7-7 7', down:'m6 9 6 6 6-6', check:'m5 12 4 4L19 6', x:'m6 6 12 12M6 18 18 6',
  spark:'m12 3 2.6 6.4L21 12l-6.4 2.6L12 21l-2.6-6.4L3 12l6.4-2.6Z',
  person:'M8 6a4 4 0 1 0 8 0 4 4 0 1 0-8 0M5 22v-4a7 7 0 0 1 14 0v4',
  people:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87M5 7a4 4 0 1 0 8 0 4 4 0 1 0-8 0',
  clock:'M12 8v5l3 2M22 12A10 10 0 1 1 2 12a10 10 0 0 1 20 0',
  camera:'M14 4h-4L8 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-4l-2-3M8 13a4 4 0 1 0 8 0 4 4 0 1 0-8 0',
  video:'m16 10 5-3v10l-5-3M3 5h11a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2',
  code:'m8 7-5 5 5 5m8-10 5 5-5 5m-3-14-2 18',
  grid:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  folder:'M3 5h6l2 2h10v13H3z', play:'m8 5 11 7-11 7Z', stop:'M6 6h12v12H6z',
  store:'m3 4-1 5a3 3 0 0 0 5 2 3 3 0 0 0 5 0 3 3 0 0 0 5 0 3 3 0 0 0 5-2l-1-5ZM4 12v9h16v-9M9 21v-6h6v6',
  flow:'M3 3h6v6H3zM15 15h6v6h-6zM3 15h6v6H3zM6 9v6m3 3h6M6 12h12v3',
  lab:'M9 3h6M10 3v7l-6 9a1.3 1.3 0 0 0 1 2h14a1.3 1.3 0 0 0 1-2l-6-9V3M8 15h8',
  upload:'M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5', download:'M12 3v13m-5-5 5 5 5-5M4 16v5h16v-5',
  copy:'M8 8h13v13H8zM16 4V2H2v14h2', edit:'m15 4 5 5M3 21l5-1L21 7a2 2 0 0 0-5-5L3 15Z',
  undo:'M3 10h11a7 7 0 0 1 0 14M3 10l5-5M3 10l5 5', more:'M5 12h.01M12 12h.01M19 12h.01',
  trash:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7', search:'M15.5 15.5 5 5M3 10a7 7 0 1 0 14 0 7 7 0 1 0-14 0',
  shield:'m12 2 9 4v6c0 6-9 10-9 10S3 18 3 12V6ZM8 12l3 3 5-6',
  book:'M12 5v16M3 3c4 0 7 0 9 2 2-2 5-2 9-2v16c-4 0-7 0-9 2-2-2-5-2-9-2Z',
  settings:'M4 7h16M4 17h16M8 4v6m8 4v6', logout:'M9 3H3v18h6M9 12h12m-4-4 4 4-4 4',
  external:'M14 3h7v7m0-7L10 14M10 3H3v18h18v-7', menu:'M4 6h16M4 12h16M4 18h16',
  info:'M12 11v6m0-10h.01M22 12A10 10 0 1 1 2 12a10 10 0 0 1 20 0',
  link:'m10 13 4-4M8 16l-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m0 2 1-1a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0',
  chip:'M6 6h12v12H6zM9 9h6v6H9zM9 2v4m6-4v4M9 18v4m6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4',
  cloud:'M6 18a5 5 0 0 1-1-10 7 7 0 0 1 13-1 5.5 5.5 0 0 1 0 11Z',
  checkCircle:'m8 12 3 3 5-6M22 12A10 10 0 1 1 2 12a10 10 0 0 1 20 0',
  crossing:'M12 2v20M3 8h6m-3-3 3 3-3 3m15 5h-6m3-3-3 3 3 3',
  car:'m5 9 2-5h10l2 5M3 9h18v9H3zM5 18v3m14-3v3M6 13h2m8 0h2',
  bell:'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',
  target:'M12 2v4m0 12v4M2 12h4m12 0h4M5 12a7 7 0 1 0 14 0 7 7 0 1 0-14 0M9 12a3 3 0 1 0 6 0 3 3 0 1 0-6 0',
  chat:'M21 3H3v14h4v4l6-4h8Z', image:'M3 3h18v18H3zM3 17l6-6 4 4 3-3 5 5M14 7h.01',
  lock:'M5 10h14v11H5zM8 10V6a4 4 0 1 1 8 0v4M12 14v3', refresh:'M20 7V2l-4 4a9 9 0 1 0 4 11M20 7h-5'
};
function icon(name, size=20) { return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.spark}"/></svg>`; }
const mark = (small=false) => `<span class="${small?'message-avatar':'brand-mark'}" aria-hidden="true"><svg viewBox="0 0 32 32" width="23" height="23" fill="currentColor"><path d="M4 25V7h5l7 10 7-10h5v18h-6V16l-6 8-6-8v9Z"/></svg></span>`;
const button = (label,action,style='secondary',ico='',extra='') => `<button class="btn ${style}" data-action="${action}" ${extra}>${ico?icon(ico,17):''}${label}</button>`;
const badge = (label,tone='draft') => `<span class="status ${tone}">${label}</span>`;
function loadWorkspace(key = workspaceKeyFor(storedAuthSub())) {
  try { const parsed=JSON.parse(localStorage.getItem(key)); return {projects:Array.isArray(parsed?.projects)?parsed.projects.filter(p=>p.id&&p.configuration&&p.name):[]}; }
  catch { return {projects:[]}; }
}
let workspaceStorageKey = workspaceKeyFor(storedAuthSub());
const workspace=loadWorkspace(workspaceStorageKey);
(function migrateNeutralNames(){const P={['n'+'pu_required']:'accelerated',['n'+'pu_preferred']:'accelerated_preferred',['cp'+'u_only']:'standard'},V={['hai'+'lo8l']:'merx-standard',['hai'+'lo8']:'merx-pro'};let changed=false;
  const legacy=new RegExp(['hai'+'lo','\\bn'+'pu','\\bhe'+'f\\b'].join('|'),'i');
  for(const p of workspace.projects||[]){const c=p&&p.configuration;if(!c)continue;if(P[c.backendPolicy]){c.backendPolicy=P[c.backendPolicy];changed=true;}if(V[c.targetVariant]){c.targetVariant=V[c.targetVariant];changed=true;}
    if(typeof p.source==='string'&&legacy.test(p.source)){p.source=generateRust(p);changed=true;}
    if(typeof p.customSource==='string'&&legacy.test(p.customSource)){p.customSource=p.customSource.replace(new RegExp('hai'+'lo8l','gi'),'merx-standard').replace(new RegExp('hai'+'lo8','gi'),'merx-pro').replace(new RegExp('n'+'pu_required','g'),'accelerated').replace(new RegExp('\\bN'+'PU\\b','g'),'Merx');changed=true;}}
  if(changed){try{save();}catch{}}})();
function switchWorkspaceForAuth() {
  const key = workspaceKeyFor(ui.auth?.sub || null);
  if (key === workspaceStorageKey) return;
  workspaceStorageKey = key;
  workspace.projects = loadWorkspace(key).projects;
}
function workspaceLimitReached() {
  if (workspace.projects.length >= MAX_LOCAL_PROJECTS) { toast(`Limite de ${MAX_LOCAL_PROJECTS} projetos neste navegador. Exporte ou remova rascunhos antes de criar outro.`,'warning'); return true; }
  return false;
}
const ui = {tab:'analytic',mobile:'chat',storeFilter:'Todos',query:'',thinking:false,busyProject:null,codeFile:'rust',doc:'',sourceUrl:null,sourceType:null,sourceName:'',stream:null,detector:null,running:false,detections:[],events:[],testResult:null,drawZone:false,scenario:null,modal:null,auth:null,authMode:'login',lastFocus:null,undo:{},storageError:false,config:{apiBase:null},connection:null,license:null,licenseLoading:false};
try { const auth=JSON.parse(sessionStorage.getItem('merx.studio.auth')); if(auth&&(auth.expiresAt>Date.now()||auth.refreshToken))ui.auth=auth; } catch {}
function save() {
  try {localStorage.setItem(workspaceStorageKey,JSON.stringify(workspace));ui.storageError=false;}
  catch {if(!ui.storageError)toast(t('toast.storageFull'),'warning');ui.storageError=true;}
  const indicator=$('.save-indicator'); if(indicator) indicator.innerHTML = ui.storageError ? t('builder.notSaved') : `${icon('check',12)} ${t('builder.saved')}`;
}
function getProject(id = currentId()) {return workspace.projects.find(p=>p.id===id);}
function currentId() {return route().parts[1] || null;}
function route() {const raw=decodeURIComponent(location.hash.replace(/^#\/?/,''));const [pathPart,queryPart='']=raw.split('?');const parts=pathPart.split('/').filter(Boolean);return {name:parts[0]||'home',parts,query:new URLSearchParams(queryPart)};}
function go(path) {location.hash='/'+path;}
function touch(project, options={}) {project.localRevision=(project.localRevision||0)+1;if(ui.runContext?.projectId===project.id&&JSON.stringify(ui.runContext.configuration)!==JSON.stringify(project.configuration)){stopTest();ui.events=[];ui.detections=[];ui.runContext=null;ui.testResult=null;}project.updatedAt=new Date().toISOString();project.source=generateRust(project);project.status=nextProjectStatus(project, options);save();}
function checkpoint(project) {const list=ui.undo[project.id] ||= [];list.push(structuredClone(project));if(list.length>20)list.shift();}
function toast(message,tone='success') {const node=document.createElement('div');node.className=`toast ${tone}`;node.innerHTML=`${icon(tone==='success'?'checkCircle':'info',18)}<span>${esc(message)}</span>`;$('#toast-root').append(node);setTimeout(()=>node.remove(),5000);}
function download(name,content,type='application/json') {const url=URL.createObjectURL(new Blob([content],{type}));const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
const projectFileName = p => p.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'merx-analytic';
function persistProject(project) {const index=workspace.projects.findIndex(p=>p.id===project.id);if(index<0)workspace.projects.unshift(project);else workspace.projects[index]=project;save();}
function ensureMessages(project) {if(!Array.isArray(project.messages))project.messages=[];return project.messages;}
function newProject(prompt='',templateId) {
  if(!requireStudioAccess())return null;
  if(workspaceLimitReached())return null;
  const project=createProject({name:'Novo analítico',description:'',templateId:templateId||'presence-zone'});
  project.messages=[];persistProject(project);ui.tab='analytic';ui.mobile=prompt?'preview':'chat';go(`builder/${project.id}`);
  if(prompt)setTimeout(()=>sendPrompt(prompt,project.id),0);
  return project;
}
function statusText(project) {const key=displayStatus(project);return t('status.'+key)||key;}
function statusBadge(project) {const key=displayStatus(project);return badge(statusText(project), statusTone(key));}

function header(active='home',compact=false) {
  return `<header class="site-header"><a href="#/" class="brand" aria-label="Merx Studio — início">${mark()}<span class="brand-name">Merx <span>Studio</span><i class="brand-dot">.</i></span></a>
    <nav class="site-nav" aria-label="Navegação principal">${[['home',t('nav.create'),''],['projects',t('nav.projects'),'projects'],['lab',t('nav.lab'),'lab'],['store',t('nav.store'),'store']].map(([id,label,path])=>`<a href="#/${path}" class="${active===id?'active':''}" ${active===id?'aria-current="page"':''}>${label}</a>`).join('')}</nav>
    <div class="header-actions"><a class="header-docs" href="#/docs" aria-label="Documentação">${icon('book',18)}</a><span class="preview-badge">${t('preview')}</span><span class="langsw" role="group" aria-label="${esc(t('lang.label'))}">${SUPPORTED_LOCALES.map(code=>`<button type="button" data-action="set-locale" data-locale="${code}" aria-label="${esc(LOCALE_NAMES[code])}" aria-pressed="${getLocale()===code}" class="${getLocale()===code?'active':''}">${code.toUpperCase()}</button>`).join('')}</span>${ui.auth?`<button class="profile-button" data-action="account" aria-label="Minha conta">${esc((ui.auth.email||'M')[0].toUpperCase())}</button>`:button('Entrar','login','ghost small')}
    <button class="mobile-menu-btn" data-action="mobile-menu" aria-label="Abrir menu">${icon('menu')}</button></div></header>`;
}
function footer() {return `<footer class="site-footer container"><a href="https://bemerx.com" target="_blank" rel="noopener noreferrer" class="footer-brand">BeMerx<span>.</span></a><p>${t('footer.tagline')}</p><div><a href="#/docs">Documentação</a><a href="#/submissions">Revisão e publicação</a><span>Merx Studio · 2026</span></div></footer>`;}
function starterChips() {return STARTERS.map((s,i)=>`<button class="suggestion" data-action="starter" data-index="${i}">${icon(s.icon,16)}${t('starter.'+i)}</button>`).join('');}
function promptForm(variant='hero') {
  const isHero=variant==='hero';
  return `<form class="${isHero?'prompt-card':'chat-composer'}" id="${isHero?'hero-form':'chat-form'}">
    <label class="sr-only" for="${isHero?'hero-prompt':'chat-prompt'}">${isHero?t('home.describe'):t('builder.describeChange')}</label>
    <textarea class="composer-input" id="${isHero?'hero-prompt':'chat-prompt'}" name="prompt" required rows="${isHero?3:2}" maxlength="4000" placeholder="${isHero?t('home.promptPh'):t('builder.promptPh')}" ${ui.thinking?'disabled':''}></textarea>
    <div class="composer-footer"><div class="composer-options">${button('','attach-video','ghost icon-btn','plus','type="button" aria-label="Adicionar vídeo ou imagem ao projeto"')}<span>${icon('spark',14)}${ui.auth&&ui.config.apiBase?t('home.composerAi'):t('home.composerLocal')}</span></div><button type="submit" class="send-button" ${ui.thinking?'disabled':''} aria-label="${isHero?t('builder.create'):t('builder.send')}">${icon(isHero?'arrowRight':'arrow',20)}</button></div>
  </form>`;
}
function miniIllustration(type='presence',wide=false) {
  const line=type==='line_crossing', dwell=type==='dwell';
  return `<svg class="analytic-illustration" viewBox="0 0 400 210" role="img" aria-label="Ilustração de ${line?'contagem por linha':dwell?'permanência em uma área':'detecção de presença'}"><defs><pattern id="grid-${type}-${wide}" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="#dce6f0" stroke-width=".6"/></pattern></defs><rect width="400" height="210" fill="${dwell?'#f5f4fb':line?'#eef6f4':'#edf4fc'}"/><rect x="0" y="0" width="400" height="210" fill="url(#grid-${type}-${wide})"/><path d="M50 162V51h104m86 0h107v111H50" fill="none" stroke="#afc1d1" stroke-width="2"/><path d="M77 69h57v27H77zm190 0h57v27h-57z" fill="#fff" stroke="#d6e1eb"/>
    ${line?'<path d="M201 29v157" stroke="#007f70" stroke-width="2" stroke-dasharray="5 5"/><path d="M225 108h55m-8-7 8 7-8 7M122 108h55m-8-7 8 7-8 7" fill="none" stroke="#007f70" stroke-width="2"/>':'<rect x="152" y="69" width="96" height="100" rx="8" fill="'+(dwell?'#9a85d21b':'#0071e30b')+'" stroke="'+(dwell?'#8c70bf':'#0071e3')+'" stroke-dasharray="5 4"/>'}
    <g transform="translate(${line?160:200},112)"><circle cy="-14" r="9" fill="#7d91a8"/><path d="M-15 23V9a15 15 0 0 1 30 0v14" fill="#7d91a8"/><rect x="-25" y="-32" width="50" height="67" rx="3" fill="none" stroke="${line?'#007f70':dwell?'#8c70bf':'#0071e3'}" stroke-width="1.5"/></g>
    <rect x="${line?135:175}" y="${dwell?49:62}" width="${dwell?71:54}" height="18" rx="4" fill="${line?'#007f70':dwell?'#8c70bf':'#0071e3'}"/><text x="${line?141:181}" y="${dwell?61:74}" fill="white" font-family="Arial,sans-serif" font-size="9">${dwell?'permanência':'pessoa'}</text><circle cx="58" cy="184" r="3" fill="${line?'#007f70':dwell?'#8c70bf':'#0071e3'}"/><text x="69" y="188" fill="#64778b" font-family="Arial,sans-serif" font-size="9">${line?'Cruzamento de linha':dwell?'Tempo em área':'Presença em área'} · ilustração</text></svg>`;
}
function home() {
  const recent=workspace.projects.slice().sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt)).slice(0,3);
  return `${header('home')}<main id="main-content"><section class="prompt-hero container"><div class="hero-eyebrow"><span class="eyebrow-dot"></span> ${t('home.eyebrow')}</div><h1 class="hero-title">${t('home.title1')}<br><span>${t('home.title2')}</span></h1><p class="hero-subtitle">${t('home.subtitle')}</p>${promptForm()}<div class="suggestion-chips">${starterChips()}</div><p class="hero-note">${icon('lock',13)} Seus rascunhos ficam salvos neste navegador.</p></section>
    <section class="inspiration-section container"><div class="section-heading"><div><span class="section-eyebrow">${t('insp.eyebrow')}</span><h2>${t('insp.title')}</h2></div><a class="text-link" href="#/store">${t('insp.explore')} ${icon('arrowRight',16)}</a></div><div class="inspiration-grid">${[
      ['presence','person',t('insp.0t'),t('insp.0d'),0],
      ['dwell','clock',t('insp.1t'),t('insp.1d'),1],
      ['line_crossing','crossing',t('insp.2t'),t('insp.2d'),2]
    ].map(([type,ico,title,desc,i])=>`<button class="inspiration-card" data-action="starter" data-index="${i}"><div class="inspiration-art">${miniIllustration(type)}</div><div class="inspiration-body"><div><h3>${title}</h3><p>${desc}</p></div><span class="card-arrow">${icon('arrowRight',19)}</span></div></button>`).join('')}</div></section>
    ${recent.length?`<section class="recent-section container"><div class="section-heading"><div><span class="section-eyebrow">${t('recent.eyebrow')}</span><h2>${t('recent.title')}</h2></div><a class="text-link" href="#/projects">${t('recent.view')} ${icon('arrowRight',16)}</a></div><div class="grid cols-3">${recent.map(projectCard).join('')}</div></section>`:''}
    <section class="journey-section container"><div class="journey-copy"><span class="section-eyebrow">${t('journey.eyebrow')}</span><h2>${t('journey.title')}</h2><p>${t('journey.body')}</p><a href="#/docs" class="text-link">${t('journey.link')} ${icon('arrowRight',17)}</a></div><div class="journey-steps">${[['chat','Descreva','Conte o que a câmera deve observar.'],['settings','Personalize','Edite as regras e acompanhe o código.'],['camera','Experimente','Use vídeo ou a câmera do navegador.'],['shield','Prepare a publicação','Organize seu pacote para revisão.']].map(([ico,title,desc],i)=>`<div class="journey-step"><span class="journey-icon">${icon(ico,22)}</span><div><small>0${i+1}</small><h3>${title}</h3><p>${desc}</p></div></div>`).join('')}</div></section>
  </main>${footer()}`;
}

function projectCard(project) {
  return `<article class="project-card"><a href="#/builder/${esc(project.id)}" class="project-card-main"><div class="row"><span class="project-icon">${icon(project.configuration.mode==='dwell'?'clock':project.configuration.mode==='line_crossing'?'crossing':'target',22)}</span>${statusBadge(project)}</div><h3>${esc(project.name)}</h3><p>${esc(project.description||'Abra o construtor e descreva o que deseja observar.')}</p><div class="project-card-footer"><span>Alterado ${fmt(project.updatedAt)}</span>${icon('arrowRight',17)}</div></a><button class="project-menu" data-action="project-options" data-id="${esc(project.id)}" aria-label="Opções de ${esc(project.name)}">${icon('more',18)}</button></article>`;
}
function workspaceNav(active) {
  return `<aside class="sidebar"><div class="sidebar-nav"><span class="nav-label">WORKSPACE</span>${[['projects','Meus projetos','folder'],['lab','Laboratório','lab'],['submissions','Publicações','shield'],['store','Merx Store','store'],['docs','Documentação','book']].map(([path,label,ico])=>`<a class="nav-item ${active===path?'active':''}" href="#/${path}">${icon(ico,18)}${label}</a>`).join('')}</div><div class="sidebar-bottom"><span class="workspace-avatar">M</span><div><strong>Meu workspace</strong><small>${ui.auth?'Conectado à sua conta':'Rascunhos locais'}</small></div></div></aside>`;
}
function pageShell(active,body) {return `${header(active)}<div class="app-shell">${workspaceNav(active)}<main class="workspace-main" id="main-content"><div class="workspace-content">${body}</div></main></div>`;}
function pageHeading(eyebrow,title,desc,actions='') {return `<div class="page-header"><div><span class="section-eyebrow">${eyebrow}</span><h1 class="page-title">${title}</h1><p class="page-subtitle">${desc}</p></div><div class="page-actions">${actions}</div></div>`;}
function projectsPage() {
  const projects=workspace.projects.filter(p=>`${p.name} ${p.description}`.toLocaleLowerCase('pt').includes(ui.query.toLocaleLowerCase('pt'))).sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt));
  return pageShell('projects',`${pageHeading(t('projects.eyebrow'),t('projects.title'),t('projects.subtitle'),(ui.auth?button(t('projects.fromAccount'),'cloud-load','secondary','cloud'):'')+button(t('projects.import'),'import-project','secondary','upload')+button(t('projects.new'),'new-project','primary','plus'))}<div class="filter-bar"><label class="search-field">${icon('search',18)}<input type="search" id="project-search" class="input" placeholder="${t('projects.searchPh')}" value="${esc(ui.query)}" aria-label="Buscar projetos"></label><span class="muted small-text">${projects.length} projeto${projects.length===1?'':'s'} · ${ui.auth?'Conta conectada':'Neste navegador'}</span></div><div id="projects-grid" class="grid cols-3">${projects.map(projectCard).join('')}</div>${!projects.length?`<div class="empty-state"><span class="empty-icon">${icon('folder',30)}</span><h2>${ui.query?'Nenhum projeto encontrado':'Sua próxima ideia começa aqui.'}</h2><p>${ui.query?'Experimente outro termo de busca.':'Descreva o que você quer observar e veja seu primeiro analítico ganhar forma.'}</p>${button('Criar meu primeiro analítico','new-project','primary','plus')}</div>`:''}<div class="local-storage-note">${icon('info',16)}<span>Rascunhos são preservados neste navegador. Exporte uma cópia do projeto para levar seu trabalho com você.</span></div>`);
}

function messagesHtml(project) {
  const messages=ensureMessages(project);
  if(!messages.length)return `<div class="builder-empty">${mark()}<h2>${t('builder.chatEmptyT')}</h2><p>${t('builder.chatEmptyB')}</p><div class="chat-starters">${STARTERS.slice(0,3).map((s,i)=>`<button class="suggestion" data-action="starter" data-index="${i}">${icon(s.icon,16)}${s.label}${icon('arrowRight',15)}</button>`).join('')}</div></div>`;
  return messages.map(message=>`<article class="chat-message ${message.role}">${message.role==='assistant'?mark(true):'<span class="user-message-label">Você</span>'}<div class="message-content"><div class="message-text">${esc(message.text).replace(/\n/g,'<br>')}</div>${message.changes?.length?`<div class="change-list">${message.changes.map(c=>`<div>${icon('check',13)}<span>${esc(c)}</span></div>`).join('')}</div>`:''}${message.role==='assistant'&&message.engine==='local'?'<span class="message-footnote">Alterações de configuração · assistente local</span>':''}${message.role==='assistant'&&message.engine==='cloud'?'<span class="message-footnote">Merx Intelligence</span>':''}</div></article>`).join('');
}
function builderPage(project) {
  if(!project)return notFound();
  return `${header('builder',true)}<main class="builder" id="main-content"><div class="builder-header"><div class="builder-title-area"><a href="#/projects" class="back-button" aria-label="${t('builder.back')}">${icon('chevron',17)}</a><div><button class="builder-project-title" data-action="rename-project">${esc(project.name)}${icon('down',14)}</button><span class="save-indicator">${ui.storageError?t('builder.notSaved'):`${icon('check',12)} ${t('builder.saved')}`}</span></div>${statusBadge(project)}</div><div class="builder-header-actions">${button('','undo','ghost icon-btn','undo','aria-label="Desfazer última alteração" '+(!ui.undo[project.id]?.length?'disabled':''))}${ui.auth?button('Salvar na conta','cloud-save','secondary small','cloud'):''}${button('Exportar','export-project','secondary small','download')}${button('Publicar','publish-tab','primary small','upload')}</div></div>
    <div class="mobile-builder-tabs" role="tablist" aria-label="Área do construtor"><button data-action="mobile-chat" class="${ui.mobile==='chat'?'active':''}" role="tab" aria-selected="${ui.mobile==='chat'}">${icon('chat',16)} ${t('builder.conversar')}</button><button data-action="mobile-preview" class="${ui.mobile==='preview'?'active':''}" role="tab" aria-selected="${ui.mobile==='preview'}">${icon('grid',16)} ${t('builder.tab.analytic')}</button></div>
    <div class="builder-layout" data-mobile-view="${ui.mobile}"><section class="chat-panel" aria-label="Conversa com o construtor"><div class="chat-header"><div>${icon('spark',17)}<strong>${t('builder.chatTitle')}</strong></div><span class="chat-mode-dot" title="${ui.auth&&ui.config.apiBase?'Assistente conectado':'Assistente de configuração local'}"></span></div><div class="chat-messages" id="chat-messages" aria-live="polite" aria-relevant="additions">${messagesHtml(project)}${ui.thinking&&ui.busyProject===project.id?`<div class="assistant-thinking">${mark(true)}<span>Organizando seu analítico<i></i><i></i><i></i></span></div>`:''}</div><div class="chat-bottom"><div class="context-strip">${icon('folder',13)} <span>${esc(project.name)}</span><span>·</span><span>v${esc(project.version||'0.1.0')}</span></div>${promptForm('chat')}<p class="composer-hint">Enter para enviar · Shift + Enter para nova linha</p></div></section>
    <section class="preview-panel" aria-label="Construtor do analítico"><nav class="preview-tabs" role="tablist" aria-label="Etapas do analítico">${[['analytic',t('builder.tab.analytic'),'grid'],['flow',t('builder.tab.flow'),'flow'],['code',t('builder.tab.code'),'code'],['test',t('builder.tab.test'),'play'],['publish',t('builder.tab.publish'),'store']].map(([id,label,ico])=>`<button class="tab ${ui.tab===id?'active':''}" data-action="builder-tab" data-tab="${id}" role="tab" aria-selected="${ui.tab===id}">${icon(ico,16)}${label}</button>`).join('')}</nav><div class="preview-content" id="preview-content">${previewContent(project)}</div></section></div></main>`;
}
function previewContent(project) {return ui.tab==='flow'?flowPanel(project):ui.tab==='code'?codePanel(project):ui.tab==='test'?testPanel(project):ui.tab==='publish'?publishPanel(project):analyticPanel(project);}
function configLabels(project) {
  const c=project.configuration;
  const duration=c.mode==='dwell'?t('rule.whenDwell',{n:c.minDurationSeconds}):t(triggerKey(c.mode));
  return {kind:MODES[c.mode]||'Regra personalizada',classes:(c.classNames||['person']).map(name=>CLASSES[name]||name).join(', '),confidence:Math.round(c.confidence*100)+'%',duration,showDwell:showDwellField(c.mode),cooldown:`${c.cooldownSeconds} segundos`};
}
const VEHICLE_CLASSES=['car','truck','bus','motorcycle','bicycle'];
function overlaySvg(c,zx,zy,zw,zh){
  if(c.mode!=='line_crossing')return `<rect x="${zx}" y="${zy}" width="${Math.min(800-zx,zw)}" height="${Math.min(440-zy,zh)}" rx="5" fill="#0071e30a" stroke="#0071e3" stroke-width="2" stroke-dasharray="8 5"/>`;
  const x1=clamp(c.line?.start?.x??.15,0,1)*800,y1=clamp(c.line?.start?.y??.5,0,1)*440,x2=clamp(c.line?.end?.x??.85,0,1)*800,y2=clamp(c.line?.end?.y??.5,0,1)*440,mx=(x1+x2)/2,my=(y1+y2)/2;
  const v={left_to_right:[1,0],right_to_left:[-1,0],top_to_bottom:[0,1],bottom_to_top:[0,-1]}[c.direction];
  const arrow=(dx,dy)=>`<path d="M${mx-dx*28} ${my-dy*28}L${mx+dx*28} ${my+dy*28}" stroke="#0071e3" stroke-width="3" marker-end="url(#arrowhead)"/>`;
  const arrows=v?arrow(...v):(()=>{const nx=-(y2-y1),ny=x2-x1,l=Math.hypot(nx,ny)||1;return arrow(nx/l,ny/l)+arrow(-nx/l,-ny/l);})();
  return `<defs><marker id="arrowhead" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0 0L8 4L0 8Z" fill="#0071e3"/></marker></defs><path d="M${x1} ${y1}L${x2} ${y2}" stroke="#0071e3" stroke-width="3" stroke-dasharray="9 6"/>${arrows}<rect x="${Math.min(690,x2+6)}" y="${Math.max(8,y2-30)}" width="100" height="24" rx="12" fill="#0071e3"/><text x="${Math.min(690,x2+6)+50}" y="${Math.max(8,y2-30)+16}" text-anchor="middle" fill="#fff" font-family="Arial,sans-serif" font-size="11">${esc(t('scene.counter'))}: 0</text>`;
}
function vehicleSceneSvg(project,zx,zy,zw,zh){
  const c=project.configuration,classes=(c.classNames||[]).filter(id=>VEHICLE_CLASSES.includes(id));
  const shapes={car:(x,y)=>`<g transform="translate(${x} ${y})"><rect x="-46" y="-18" width="92" height="30" rx="9" fill="#5b7088"/><path d="M-28-18-16-36h34l14 18Z" fill="#7d93ab"/><circle cx="-26" cy="14" r="9" fill="#2b3644"/><circle cx="26" cy="14" r="9" fill="#2b3644"/></g>`,
    motorcycle:(x,y)=>`<g transform="translate(${x} ${y})"><circle cx="-24" cy="10" r="13" fill="none" stroke="#2b3644" stroke-width="5"/><circle cx="24" cy="10" r="13" fill="none" stroke="#2b3644" stroke-width="5"/><path d="M-24 10-4-10h22l6 20" stroke="#5b7088" stroke-width="6" fill="none"/><circle cx="2" cy="-28" r="9" fill="#7d93ab"/></g>`,
    truck:(x,y)=>`<g transform="translate(${x} ${y})"><rect x="-60" y="-44" width="80" height="56" rx="4" fill="#6d8299"/><rect x="20" y="-26" width="36" height="38" rx="5" fill="#5b7088"/><circle cx="-36" cy="16" r="10" fill="#2b3644"/><circle cx="36" cy="16" r="10" fill="#2b3644"/></g>`,
    bus:(x,y)=>`<g transform="translate(${x} ${y})"><rect x="-70" y="-40" width="140" height="52" rx="8" fill="#6d8299"/><rect x="-60" y="-32" width="120" height="16" fill="#c9d6e2"/><circle cx="-42" cy="16" r="10" fill="#2b3644"/><circle cx="42" cy="16" r="10" fill="#2b3644"/></g>`,
    bicycle:(x,y)=>`<g transform="translate(${x} ${y})"><circle cx="-20" cy="8" r="12" fill="none" stroke="#2b3644" stroke-width="4"/><circle cx="20" cy="8" r="12" fill="none" stroke="#2b3644" stroke-width="4"/><path d="M-20 8-4-12h18l6 20" stroke="#5b7088" stroke-width="4" fill="none"/></g>`};
  const slots=[[220,300],[560,250],[380,370],[680,350],[120,250]];
  const objects=classes.slice(0,5).map((id,i)=>{const[x,y]=slots[i];return `${shapes[id](x,y)}<rect x="${x-56}" y="${y-70}" width="112" height="${id==='bus'?96:90}" rx="4" stroke="#0071e3" stroke-width="2" fill="none"/><rect x="${x-56}" y="${y-92}" width="112" height="22" rx="4" fill="#0071e3"/><text x="${x-48}" y="${y-77}" fill="#fff" font-family="Arial,sans-serif" font-size="11">${esc(t('class.'+id))}</text>`;}).join('');
  return `<svg class="studio-scene" viewBox="0 0 800 440" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(t('scene.roadAria'))}"><rect width="800" height="440" fill="#dfe6ee"/><path d="M0 170H800V440H0Z" fill="#9aa6b4"/><path d="M0 300H800" stroke="#f4f6f8" stroke-width="5" stroke-dasharray="40 30"/><path d="M0 172H800M0 438H800" stroke="#eef2f6" stroke-width="4"/><rect x="40" y="40" width="160" height="110" fill="#c6d2de"/><rect x="560" y="30" width="200" height="120" fill="#cdd8e3"/>${overlaySvg(c,zx,zy,zw,zh)}${objects}</svg>`;
}
function sceneSvg(project) {
  if((project.configuration.classNames||[]).some(id=>VEHICLE_CLASSES.includes(id))){const c=project.configuration,zone=Array.isArray(c.zone)?{x:.15,y:.15,width:.7,height:.7}:c.zone;return vehicleSceneSvg(project,clamp(zone?.x,.01,.98)*800,clamp(zone?.y,.01,.98)*440,clamp(zone?.width,.02,.98)*800,clamp(zone?.height,.02,.98)*440);}
  const c=project.configuration, zone=Array.isArray(c.zone)?{x:.15,y:.15,width:.7,height:.7}:c.zone;
  const zx=clamp(zone?.x,.01,.98)*800,zy=clamp(zone?.y,.01,.98)*440,zw=clamp(zone?.width,.02,.98)*800,zh=clamp(zone?.height,.02,.98)*440;
  return `<svg class="studio-scene" viewBox="0 0 800 440" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(t('scene.indoorAria'))}"><defs><linearGradient id="scene-wall" x2="0" y2="1"><stop stop-color="#f9fafb"/><stop offset="1" stop-color="#edf0f4"/></linearGradient><linearGradient id="scene-floor" x2=".4" y2="1"><stop stop-color="#e6eaf0"/><stop offset="1" stop-color="#d9dee6"/></linearGradient><pattern id="scene-tile" width="100" height="100" patternUnits="userSpaceOnUse" patternTransform="matrix(1 .12 -.7 .55 400 135)"><rect width="100" height="100" fill="none" stroke="#c7cfda" stroke-width="1.1"/></pattern></defs>
  <rect width="800" height="440" fill="url(#scene-wall)"/><path d="M0 200 410 140 800 205V440H0Z" fill="url(#scene-floor)"/><path d="M0 200 410 140 800 205V440H0Z" fill="url(#scene-tile)"/><path d="M0 200 410 140 800 205M410 140V0" fill="none" stroke="#c9d0da"/>
  <path d="m470 30 188 24v160l-188-30Z" fill="#c8d5df" stroke="#becad6"/><path d="m479 39 169 21v140l-169-25Z" fill="#f5f9fc"/><path d="m562 49 0 138" stroke="#c3ced8" stroke-width="4"/><path d="m477 141 171 23" stroke="#cad6df" stroke-width="3"/><path d="m501 56 18 2-32 110-7-1Zm45 7 8 1-27 110-8-1Z" fill="#fff" opacity=".8"/>
  <g fill="#fff" stroke="#d5dbe3"><path d="m61 137 178-29 0 92-178 34Z"/><path d="m64 157 175-31m-175 48 175-30m-175 46 175-31"/><path d="m72 120 164-27 4 15-178 29Z" fill="#dce2e9"/></g><g fill="#b8c8d3"><path d="m78 145 20-3v10l-20 3Zm33-5 18-3v10l-18 3Zm31-5 24-4v10l-24 4Zm38-6 24-4v10l-24 4Z"/><path d="m79 185 23-4v12l-23 4Zm35-5 21-4v12l-21 4Zm36-6 21-4v12l-21 4Z"/></g>
  <path d="m576 263 154-35 65 36-146 44Z" fill="#fbfcfd" stroke="#d6dde5"/><path d="m576 263 73 45v59l-73-46Z" fill="#c8d3df"/><path d="m649 308 146-44v57l-146 46Z" fill="#dce3eb"/><path d="m640 252 32-8 15 9-33 9Z" fill="#40536b"/><path d="m639 251 2-26 31-7v26Z" fill="#52667e"/>
  <g transform="translate(404 231)"><ellipse cy="85" rx="27" ry="9" fill="#8b9aac" opacity=".2"/><path d="m-12 46-6 37 11 3L4 52l7 33 11-4-9-38Z" fill="#596d85"/><path d="M-22 7Q0-1 23 8l-5 47h-36Z" fill="#7188a2"/><path d="M-21 9-31 43l7 3L-9 18m31-7 15 26-6 5-17-23" fill="#7188a2"/><circle cy="-11" r="15" fill="#b2bdc9"/></g>
  ${overlaySvg(c,zx,zy,zw,zh)}
  <rect x="367" y="196" width="77" height="129" rx="4" stroke="#0071e3" stroke-width="2" fill="none"/><rect x="367" y="173" width="100" height="23" rx="4" fill="#0071e3"/><text x="377" y="189" fill="white" font-family="Arial,sans-serif" font-size="11">${esc(t('class.'+((c.classNames||['person'])[0])))}</text></svg>`;
}
function analyticPanel(project) {
  const c=project.configuration, labels=configLabels(project);
  return `<div class="preview-toolbar"><div><span class="section-eyebrow">SEU ANALÍTICO</span><h2>${esc(project.name)}</h2></div>${badge('Em construção','blue')}</div><div class="analytic-stage"><div class="stage-caption"><span>${icon('camera',14)} Prévia da regra</span><span>Ilustração</span></div>${sceneSvg(project)}<div class="stage-bottom"><span>${icon('target',14)} ${c.mode==='line_crossing'?'Linha de contagem':'Área de interesse'}</span><button class="stage-link" data-action="builder-tab" data-tab="test">Usar minha câmera ${icon('arrowRight',14)}</button></div></div>
    <div class="live-characteristics"><div class="section-heading small-heading"><h3>O que ele vai observar</h3>${button(t('builder.personalize'),'edit-config','ghost small','settings')}</div><div class="spec-grid"><div class="spec-item"><span>${icon('person',17)} Identificar</span><strong>${esc(labels.classes)}</strong></div><div class="spec-item"><span>${icon('target',17)} Regra</span><strong>${esc(labels.kind)}</strong></div><div class="spec-item"><span>${icon('clock',17)} Quando agir</span><strong>${esc(labels.duration)}</strong></div><div class="spec-item"><span>${icon('bell',17)} Intervalo dos eventos</span><strong>${esc(labels.cooldown)}</strong></div></div></div>
    <div class="analytic-summary"><span class="summary-icon">${icon('spark',19)}</span><p>${esc(ruleSentence(project))}</p></div><div class="builder-next"><div>${icon('code',18)}<span>Regras e código acompanham suas alterações.</span></div><button class="text-link" data-action="builder-tab" data-tab="code">Ver código ${icon('arrowRight',15)}</button></div>`;
}
function ruleSentence(project) {
  const c=project.configuration,classes=(c.classNames||['person']).map(x=>CLASSES[x]||x).join(' ou ').toLowerCase();
  if(c.mode==='line_crossing')return `Observar ${classes} com confiança mínima de ${Math.round(c.confidence*100)}%, acompanhar o cruzamento da linha e gerar eventos respeitando um intervalo de ${c.cooldownSeconds} segundos.`;
  return `Identificar ${classes} na área selecionada${c.mode==='dwell'?`, aguardar ${c.minDurationSeconds} segundos de permanência`:''} e gerar um evento. Confiança mínima de ${Math.round(c.confidence*100)}%, com intervalo de ${c.cooldownSeconds} segundos entre eventos.`;
}
function flowPanel(project) {
  const c=project.configuration;
  const steps=[['camera','Entrada de vídeo','Câmera ou arquivo','source'],['chip','Preparar imagem','Redimensionamento e normalização · processamento padrão','std'],['spark','Detectar objetos',c.backendPolicy==='standard'?'Modelo de visão · processamento padrão no Merx':'Modelo de visão · aceleração Merx no Merx',c.backendPolicy==='standard'?'std':'accel'],['people','Acompanhar objetos','Associação temporal · processamento padrão','std'],[c.mode==='line_crossing'?'crossing':'target',MODES[c.mode],c.mode==='dwell'?`Permanência de ${c.minDurationSeconds}s`:`Confiança mínima de ${Math.round(c.confidence*100)}%`,'rule'],['bell','Gerar evento',`Intervalo mínimo de ${c.cooldownSeconds}s`,'event']];
  return `<div class="preview-toolbar"><div><span class="section-eyebrow">COMO FUNCIONA</span><h2>Da imagem ao evento.</h2></div>${button('Editar regras','edit-config','secondary small','settings')}</div><div class="flow-intro"><p>${c.backendPolicy==='standard'?'O processamento principal organiza os frames e executa o modelo no perfil processamento padrão.':'O processamento principal organiza os frames. A aceleração Merx executa o modelo no perfil acelerado.'} As regras transformam detecções em eventos úteis.</p></div><div class="flow-canvas"><div class="flow-grid-background"></div><div class="flow-nodes">${steps.map(([ico,title,detail,kind],i)=>`${i?'<div class="flow-connector"><span></span></div>':''}<div class="flow-node ${kind}"><span class="flow-node-icon">${icon(ico,22)}</span><div><small>0${i+1}</small><strong>${title}</strong><p>${detail}</p></div><span class="flow-node-tag">${kind==='accel'?'aceleração Merx':kind==='std'?'processamento padrão':kind==='source'?'INPUT':kind==='event'?'OUTPUT':'REGRA'}</span></div>`).join('')}</div></div><div class="notice">${icon('info',17)}<div><strong>Fluxo de execução planejado</strong><p>A execução na aceleração Merx requer modelo compilado e integração com o runtime MNM. O teste no navegador usa o processamento disponível no seu computador.</p></div></div>`;
}
function currentCode(project) {return ui.codeFile==='spec'?JSON.stringify(buildExecutableSpec(project),null,2):ui.codeFile==='manifest'?JSON.stringify(buildManifest(project),null,2):ui.codeFile==='config'?JSON.stringify(project.configuration,null,2):(project.customSource||generateRust(project));}
function codePanel(project) {
  return `<div class="preview-toolbar"><div><span class="section-eyebrow">POR DENTRO DO ANALÍTICO</span><h2>Você também tem o controle.</h2></div><div class="row">${button('Copiar','copy-code','ghost small','copy')}${button('Baixar','download-code','secondary small','download')}</div></div><div class="code-workbench"><div class="code-file-tabs">${[['spec','spec.json'],['rust','analytic.rs'],['config','config.json'],['manifest','manifest.json']].map(([id,label])=>`<button class="${ui.codeFile===id?'active':''}" data-action="code-file" data-file="${id}">${icon(id==='rust'?'code':'folder',14)}${label}${id==='rust'&&project.customSource?'<span class="edited-dot" title="Código personalizado"></span>':''}</button>`).join('')}</div><div class="code-editor-header"><span>${ui.codeFile==='rust'?'Rust · código de referência':ui.codeFile==='config'?'Configuração do analítico':'Manifesto de integração proposto'}</span><span>${ui.codeFile==='manifest'?'Somente leitura':'Editável'}</span></div><label class="sr-only" for="source-editor">Código ${ui.codeFile}</label><textarea id="source-editor" class="source-editor" spellcheck="false" wrap="off" ${ui.codeFile==='manifest'?'readonly':''}>${esc(currentCode(project))}</textarea><div class="code-editor-footer"><span id="code-state">${ui.codeFile==='rust'&&project.customSource?'Versão editada manualmente':'Sincronizado com as regras'}</span><div>${ui.codeFile==='rust'&&project.customSource?button('Restaurar gerado','reset-code','ghost small','refresh'):''}${ui.codeFile!=='manifest'?button('Salvar alterações','save-code','primary small','check'):''}</div></div></div><div class="notice">${icon('info',17)}<div><strong>${ui.codeFile==='rust'?'Código aberto para personalização':'Configuração versionada'}</strong><p>${ui.codeFile==='rust'?'O código é uma referência de integração com o MNM. Salvar não compila nem executa Rust no navegador. Alterações manuais são preservadas e ficam separadas do código gerado pelas regras.':'Edite os parâmetros do projeto e valide os limites antes de testar. O manifesto não é um pacote assinado para instalação.'}</p></div></div>${button('Validar configuração','validate-project','secondary','checkCircle')}`;
}


// --- Merx pairing (same verified e-mail as the App) ---
async function checkMerxAccount(){if(!ui.auth||!ui.config.apiBase)return;try{ui.merxAccount=await api('/merx/account');if(ui.merxAccount.linked&&!ui.merxAccountToasted){ui.merxAccountToasted=true;toast(t('merx.recognized',{n:ui.merxAccount.deviceCount}));if(ui.license&&!ui.licenseLoading&&!licenseObject()?.active&&route().name!=='license')go('license');}}catch{ui.merxAccount={linked:false};}render();}
async function loadMerxDevices(){if(ui.merxLoading)return;ui.merxLoading=true;try{ui.merxDevices=await api('/merx/devices');}catch(e){ui.merxDevices={error:e.message,devices:[]};}finally{ui.merxLoading=false;render();}}
function merxSyncStep(){const d=ui.merxDevices;if(!d){queueMicrotask(loadMerxDevices);return `<div class="card"><div class="card-body"><p>${t('merx.loading')}</p></div></div>`;}
  queueMicrotask(()=>fillMerxThumbs(document.getElementById('merx-sync-form')||document));
  return `<form id="merx-sync-form" class="card merx-sync"><div class="card-body"><span class="section-eyebrow">MERX</span><h3>${t('merx.syncT')}</h3><p class="muted">${t('merx.syncB')}</p><div class="merx-list">${merxCamList(d,{select:true})||`<p>${t('merx.noDevices')}</p>`}</div><div class="action-row">${button(t('merx.syncSave'),'merx-sync-save','primary','check','type="button"')}${button(t('merx.syncSkip'),'merx-sync-skip','secondary','arrowRight','type="button"')}</div></div></form>`;}
function merxTestSection(project){
  if(!ui.auth)return '';const acc=ui.merxAccount;
  if(!acc)return `<div class="notice">${icon('info',18)}<div><p>${t('merx.loading')}</p></div></div>`;
  if(!acc.linked)return `<div class="notice">${icon('info',18)}<div><strong>${t('merx.mineT')}</strong><p>${t('merx.notLinked')}</p></div></div>`;
  const d=ui.merxDevices;if(!d){queueMicrotask(loadMerxDevices);return `<p class="muted">${t('merx.loading')}</p>`;}
  const synced=d.synced||[];const cams=[];for(const dev of d.devices||[])for(const c of dev.cameras)if(!synced.length||synced.some(x=>x.deviceId===dev.id&&x.cameraId===c.id))cams.push({dev,c});
  const test=ui.merxTest;
  return `<section class="card merx-tests"><div class="card-body"><span class="section-eyebrow">${t('merx.testMode')}</span><h3>${t('merx.mineT')}</h3><p class="small-text muted">${t('merx.testB')}</p>${cams.length?`<ul class="merx-cams">${cams.map(({dev,c})=>`<li><span><strong>${esc(dev.name)}</strong> · ${esc(c.name)} · ${dev.testReady?t('merx.ready'):dev.online?t('merx.updateNeeded'):t('merx.offline')}${dev.testReady&&!dev.geometryReady?` · <em class="muted">${t('merx.geometryPending')}</em>`:''}</span>${button(t('merx.sendTest'),'merx-send-test','secondary small','upload',`data-device="${esc(dev.id)}" data-camera="${esc(c.id)}" ${dev.testReady?'':'disabled'}`)}</li>`).join('')}</ul>`:`<p>${t('merx.noCameras')}</p>`}
  ${test?`<div class="notice ${test.device?.accepted?'success':''}">${icon('chip',18)}<div><strong>${t('merx.testLabel')} · ${esc(test.analyticId)}</strong><p>${test.device?(test.device.accepted===true?t('merx.accepted'):test.device.accepted===false?t('merx.refused',{s:esc(test.device.status)}):t('merx.waiting')):t('merx.queued')}</p><p class="small-text muted">${t('merx.removeNote')}</p>${button(t('merx.check'),'merx-test-status','ghost small','refresh')}</div></div>`:''}</div></section>`;}
function testPanel(project) {return testPanelBase(project)+merxTestSection(project);}
function testPanelBase(project) {
  const hasSource=Boolean(ui.sourceUrl||ui.stream);
  return `<div class="preview-toolbar"><div><span class="section-eyebrow">LABORATÓRIO</span><h2>Da ideia à imagem real.</h2></div>${badge(hasSource?'Fonte selecionada':'Escolha uma fonte',hasSource?'success':'draft')}</div><div class="test-source-tabs">${button(t('lab.camera'),'start-camera','secondary small','camera')}${button(t('lab.file'),'attach-video','secondary small','upload')}${button(t('lab.connect'),'connect-merx','secondary small','chip')}</div>
    <div class="lab-stage ${hasSource?'has-source':''}">${hasSource?`<div class="lab-source-bar"><span>${icon(ui.stream?'camera':ui.sourceType==='image'?'image':'video',14)}${esc(ui.sourceName)}</span>${button('','close-source','ghost icon-btn','x','aria-label="Fechar fonte de imagem"')}</div><div class="media-inner" id="media-inner">${ui.sourceType==='image'?'<img id="lab-image" alt="Imagem selecionada para teste">':'<video id="lab-video" autoplay muted playsinline '+(!ui.stream?'controls':'')+'></video>'}<canvas id="detection-canvas" aria-label="Sobreposição das detecções e área de interesse"></canvas></div>`:`<div class="lab-empty"><span>${icon('camera',35)}</span><h3>Seu analítico, no seu cenário.</h3><p>Conecte a câmera deste computador ou escolha um vídeo para experimentar as regras.</p>${button('Abrir câmera','start-camera','primary','camera')}<button class="text-link" data-action="attach-video">Ou selecionar um arquivo ${icon('arrowRight',15)}</button></div>`}</div>
    <div class="lab-controls"><div>${button(ui.running?t('lab.stop'):t('lab.start'),'toggle-test',ui.running?'secondary':'primary',ui.running?'stop':'play',(!hasSource?'disabled ':'')+(ui.loadingModel?'disabled':''))}${button(project.configuration.mode==='line_crossing'?'Desenhar linha':'Desenhar área','draw-zone','secondary','target',!hasSource?'disabled':'')}</div><span id="lab-run-status" class="small-text muted">${ui.running?'Executando no navegador':ui.loadingModel?'Carregando modelo…':'Pronto para configurar'}</span></div>
    <div class="metric-grid test-metrics"><div class="metric"><span>${t('lab.objects')}</span><strong id="metric-objects">—</strong></div><div class="metric"><span>${t('lab.inference')}</span><strong id="metric-latency">—<small> ms</small></strong></div><div class="metric"><span>${t('lab.sessionEvents')}</span><strong id="metric-events">${ui.events.length}</strong></div><div class="metric"><span>${t('lab.processing')}</span><strong class="text-metric" id="metric-backend">${ui.sourceMerx?'Merx':'Navegador'}</strong></div></div>
    <div class="lab-detail-row"><p>${icon('lock',14)} As imagens desta fonte são processadas no seu navegador.</p><button class="text-link" data-action="validate-project">Validar regras ${icon('checkCircle',15)}</button></div>
    <div class="card event-card"><div class="card-header"><div><h3>${t('lab.events')}</h3><p>Somente eventos observados durante esta sessão.</p></div>${button(t('lab.export'),'export-events','ghost small','download',!ui.events.length?'disabled':'')}</div><div id="event-list">${eventsHtml()}</div></div><div class="notice"><span>${icon('info',17)}</span><div><strong>Teste de visão no navegador</strong><p>O primeiro teste baixa um modelo de referência. Desempenho, detecção e rastreamento precisam ser medidos novamente no Merx antes da publicação. Este teste não executa o código Rust editado nem homologa a aceleração Merx.</p></div></div>${ui.testResult?validationHtml(ui.testResult):''}`;
}
function eventsHtml() {
  return ui.events.length?`<div class="events-list">${ui.events.slice(-30).reverse().map(event=>`<div class="lab-event"><span class="event-icon">${icon('bell',15)}</span><div><strong>${esc(event.label)}</strong><small>${esc(CLASSES[event.className]||event.className)} · trajetória ${esc(event.trackId)}${event.duration?` · ${event.duration.toFixed(1)}s`:''}</small></div><time>${new Date(event.at).toLocaleTimeString('pt-BR')}</time></div>`).join('')}</div>`:'<div class="events-empty">Os eventos aparecerão aqui quando a regra for atendida.</div>';
}
function validationHtml(result) {
  return `<div class="card validation-card"><div class="card-header"><h3>Validação da configuração</h3>${badge(result.valid?'Configuração consistente':'Ajustes necessários',result.valid?'success':'warning')}</div><div class="card-body stack">${result.checks.map(check=>`<div class="review-check ${check.status}"><span>${icon(check.status==='passed'?'checkCircle':'info',18)}</span><div><strong>${esc(check.label)}</strong><p>${esc(check.detail)}</p></div></div>`).join('')}</div></div>`;
}
function publishPanel(project) {
  const check=validateProject(project),submission=project.submission,commercial=project.commercial&&project.commercial.currency==='BRL'?project.commercial:{};
  return `<div class="preview-toolbar"><div><span class="section-eyebrow">MERX STORE</span><h2>${t('pub.title')}</h2></div>${badge(submission?t('pub.sent'):t('status.draft'),submission?'blue':'draft')}</div><div class="publish-intro"><span class="publish-icon">${icon('store',32)}</span><div><h3>${t('pub.introT')}</h3><p>${t('pub.introB')}</p></div></div><div class="publish-progress"><div class="complete"><span>1</span><strong>${t('pub.step1')}</strong></div><i></i><div class="${check.valid?'complete':''}"><span>2</span><strong>${t('pub.step2')}</strong></div><i></i><div class="${submission?'complete':''}"><span>3</span><strong>${t('pub.step3')}</strong></div><i></i><div><span>4</span><strong>Merx Store</strong></div></div>
    <form id="publication-form" class="card publication-form" novalidate><div class="card-body">${pricingBlock(commercial)}<h3>${t('pub.presentation')}</h3><div class="form-grid"><label class="field"><span>${t('pub.name')}</span><input class="input" name="name" required minlength="3" maxlength="120" value="${esc(project.name)}"></label><label class="field"><span>${t('pub.version')}</span><input class="input" name="version" required pattern="[0-9]+\.[0-9]+\.[0-9]+" placeholder="0.1.0" value="${esc(project.version||'0.1.0')}"></label><label class="field full-width"><span>${t('pub.description')}</span><textarea class="textarea" name="description" rows="3" required maxlength="2000" placeholder="${t('pub.descriptionPh')}">${esc(project.description)}</textarea></label><label class="field full-width"><span>${t('pub.notes')}</span><textarea class="textarea" name="notes" rows="3" maxlength="3000" placeholder="${t('pub.notesPh')}">${esc(project.reviewNotes||'')}</textarea></label></div><div class="publication-checks"><label><input type="checkbox" name="rights" required> ${t('pub.rights')}</label><label><input type="checkbox" name="privacy" required> ${t('pub.privacy')}</label><label><input type="checkbox" name="tests" required> ${t('pub.tests')}</label></div><div class="publication-actions">${button(t('pub.save'),'save-presentation','secondary','check','type="button"')}<button class="btn primary" type="submit">${icon('upload',17)}${ui.auth&&ui.config.apiBase?t('pub.submit'):t('pub.signinToSubmit')}</button></div></div></form>${submission?`<div class="notice success">${icon('checkCircle',19)}<div><strong>${t('pub.received')}</strong><p>${t('pub.protocol')} ${esc(submission.id)} · ${esc(t('status.'+(submission.status||'submitted')))}. ${t('pub.receivedB')}</p></div></div>`:''}<div class="review-explainer"><div>${icon('lock',20)}<h4>${t('pub.ex1T')}</h4><p>${t('pub.ex1B')}</p></div><div>${icon('shield',20)}<h4>${t('pub.ex2T')}</h4><p>${t('pub.ex2B')}</p></div><div>${icon('chip',20)}<h4>${t('pub.ex3T')}</h4><p>${t('pub.ex3B')}</p></div></div>`;
}
function labPage() {
  return pageShell('lab',`${pageHeading(t('lab.eyebrow'),t('lab.title'),t('lab.sub'),button(t('projects.new'),'new-project','primary','plus'))}<div class="lab-welcome"><div><span class="section-eyebrow">SEU AMBIENTE DE TESTE</span><h2>Uma ideia fica melhor<br>quando encontra a realidade.</h2><p>Abra a câmera do navegador, carregue um vídeo ou prepare a conexão de um Merx ao seu workspace.</p></div><div class="lab-welcome-art">${icon('camera',80)}<span class="lab-orbit orbit-one"></span><span class="lab-orbit orbit-two"></span><span class="lab-art-dot"></span></div></div><div class="section-heading"><h2>Selecione um analítico</h2><span class="muted small-text">${workspace.projects.length} projeto${workspace.projects.length===1?'':'s'}</span></div><div class="grid cols-3">${workspace.projects.map(project=>`<button class="lab-project-card card" data-action="open-lab" data-id="${esc(project.id)}"><span class="project-icon">${icon('lab',22)}</span><h3>${esc(project.name)}</h3><p>${esc(MODES[project.configuration.mode])}</p><span class="text-link">Abrir laboratório ${icon('arrowRight',16)}</span></button>`).join('')||`<div class="empty-state full-width"><h3>Crie um analítico para começar a testar.</h3>${button('Criar analítico','new-project','primary','plus')}</div>`}</div><div class="notice">${icon('info',18)}<div><strong>Navegador e Merx têm ambientes distintos</strong><p>As fontes locais estão disponíveis para experimentação. O pareamento remoto de um Merx exige a integração autenticada do dispositivo ao Studio.</p></div></div>`);
}
function storePage() {
  const categories=['Todos',...new Set(CATALOG.map(item=>item.category))];
  const catalog=CATALOG.filter(item=>(ui.storeFilter==='Todos'||item.category===ui.storeFilter)&&`${item.title} ${item.description} ${item.tags.join(' ')}`.toLocaleLowerCase('pt').includes(ui.query.toLocaleLowerCase('pt')));
  const publishedApps=Array.isArray(ui.storeApps)?ui.storeApps:[];
  const publishedSection=publishedApps.length?`<div class="store-catalog-heading"><div><h2>${t('store.publishedTitle')}</h2><p>${t('store.publishedSub')}</p></div></div><div class="catalog-grid">${publishedApps.map(item=>`<article class="analytic-card"><div class="analytic-card-content"><div class="analytic-card-meta"><span>${esc(catLabel(item.category))}</span><span class="concept-badge">${t('status.published')}</span></div><h3>${esc(item.title)}</h3><p>${esc(item.summary)}</p><div class="analytic-card-bottom"><span class="merx-author">${mark(true)} ${esc(item.developer?.name||'Merx Studio')}</span><span>${esc(priceLabel(item))}</span></div></div></article>`).join('')}</div>`:'';
  return `${header('store')}<main id="main-content" class="store-main container">${publishedSection}<div class="store-hero"><div class="store-hero-copy"><span class="hero-eyebrow">${t('store.heroEyebrow')}</span><h1>${t('store.heroTitle')}</h1><p>${t('store.heroBody')}</p><div class="row"><a href="#/" class="btn primary">${t('store.create')} ${icon('plus',17)}</a><a href="#/submissions" class="text-link">${t('store.publish')} ${icon('arrowRight',17)}</a></div></div><div class="store-hero-art"><div class="store-art-grid">${[['person','tile-blue'],['crossing','tile-mint'],['camera','tile-slate'],['clock','tile-violet']].map(([ico,style])=>`<div class="store-art-tile ${style}">${icon(ico,40)}</div>`).join('')}</div><span class="store-art-caption">Uma nova habilidade para cada ideia.</span></div></div><div class="store-catalog-heading"><div><h2>Explore os primeiros conceitos.</h2><p>Modelos de projeto para você começar. O catálogo comercial está em preparação.</p></div><label class="search-field">${icon('search',18)}<input type="search" id="store-search" placeholder="Buscar analíticos" value="${esc(ui.query)}" aria-label="Buscar analíticos"></label></div><div class="store-filters" aria-label="Categorias">${categories.map(c=>`<button class="filter-chip ${ui.storeFilter===c?'active':''}" data-action="store-filter" data-category="${esc(c)}">${esc(c)}</button>`).join('')}</div><div class="catalog-grid" id="catalog-grid">${catalog.map(catalogCard).join('')}</div>${!catalog.length?'<div class="empty-state"><h3>Nenhum conceito nessa busca.</h3><p>Experimente outro termo ou categoria.</p></div>':''}<div class="store-developer-banner"><span class="developer-icon">${icon('code',32)}</span><div><h2>O próximo analítico pode ser seu.</h2><p>Converse com o Studio, refine sua ideia e prepare uma submissão.</p></div><a href="#/" class="btn secondary">Começar a criar ${icon('arrowRight',18)}</a></div></main>${footer()}`;
}
const catLabel = c => t('cat.'+c) || c;
function catalogCard(item) { const tr = contentFor('catalog', item.id); item = tr ? {...item, ...tr} : item;
  const mode=item.id==='dwell-time'?'dwell':item.id==='line-crossing'?'line_crossing':'presence';
  return `<a href="#/store/${esc(item.id)}" class="analytic-card"><div class="analytic-cover ${esc(item.coverClass)}">${miniIllustration(mode)}<span class="concept-badge">${t('store.concept')}</span></div><div class="analytic-card-content"><div class="analytic-card-meta"><span>${esc(catLabel(item.category))}</span>${icon('arrowRight',17)}</div><h3>${esc(item.title)}</h3><p>${esc(item.description)}</p><div class="analytic-card-bottom"><span class="merx-author">${mark(true)} Merx</span><span>Personalizável</span></div></div></a>`;
}
function storeDetail(item) {
  if(!item)return notFound(); const tr = contentFor('catalog', item.id); if(tr) item = {...item, ...tr};
  return `${header('store')}<main id="main-content" class="container store-detail-main"><a class="text-link back-link" href="#/store">${icon('chevron',15)} Voltar à Merx Store</a><div class="analytic-detail"><div class="analytic-detail-copy"><span class="section-eyebrow">${esc(item.category.toUpperCase())} · CONCEITO</span><h1>${esc(item.title)}</h1><p class="detail-lead">${esc(item.description)}</p><div class="analytic-detail-author">${mark(true)}<div><strong>Merx</strong><span>Base de projeto para personalização</span></div></div>${button('Usar como ponto de partida','use-concept','primary','plus',`data-id="${esc(item.id)}"`)}<p class="small-text muted detail-availability">${esc(item.availability)} · Compra e instalação ainda indisponíveis.</p></div><div class="analytic-detail-art">${miniIllustration(item.id==='dwell-time'?'dwell':item.id==='line-crossing'?'line_crossing':'presence',true)}</div></div><div class="detail-sections"><div><h2>Sobre este analítico</h2><p>${esc(item.longDescription)}</p><h2>O que você pode personalizar</h2><div class="capability-list">${item.capabilities.map(c=>`<div>${icon('checkCircle',18)}${esc(c)}</div>`).join('')}</div><h2>Limites deste conceito</h2><ul class="plain-list">${item.limitations.map(c=>`<li>${esc(c)}</li>`).join('')}</ul></div><aside class="card detail-sidebar"><h3>Antes de executar</h3><div class="compat-list">${item.requirements.map(c=>`<div>${icon('chip',17)}<span>${esc(c)}</span></div>`).join('')}</div><div class="divider"></div><span class="section-eyebrow">MODELO</span><p>${esc(item.model)}</p><div class="detail-tags">${item.tags.map(t=>`<span class="chip">${esc(t)}</span>`).join('')}</div><a class="text-link" href="#/docs">Requisitos para publicação ${icon('arrowRight',16)}</a></aside></div></main>${footer()}`;
}
function submissionsPage() {
  const projects=workspace.projects.filter(p=>p.submission&&(!ui.auth||!p.submissionOwner||p.submissionOwner===ui.auth.sub));
  return pageShell('submissions',`${pageHeading(t('subs.eyebrow'),t('subs.title'),t('subs.sub'),button(t('subs.refresh'),'refresh-submissions','secondary','refresh')+button(t('subs.myProjects'),'go-projects','secondary','folder'))}<div class="review-flow-banner"><div>${icon('code',24)}<strong>Seu projeto</strong><span>Regras, modelo e descrição</span></div>${icon('arrowRight',20)}<div>${icon('shield',24)}<strong>Revisão da equipe</strong><span>Qualidade e experiência</span></div>${icon('arrowRight',20)}<div>${icon('chip',24)}<strong>Qualificação</strong><span>Teste no runtime do Merx</span></div>${icon('arrowRight',20)}<div>${icon('store',24)}<strong>Publicação</strong><span>Disponível na Merx Store</span></div></div>${projects.length?`<div class="table-wrap"><table class="data-table"><thead><tr><th>Analítico</th><th>Versão</th><th>Status</th><th>Enviado em</th><th></th></tr></thead><tbody>${projects.map(p=>`<tr><td><strong>${esc(p.name)}</strong><small>${esc(p.submission.id)}</small></td><td>${esc(p.version||'0.1.0')}</td><td>${badge(statusText(p),'blue')}${p.submission.review?.notes?`<small>${esc(p.submission.review.notes)}</small>`:''}</td><td>${fmt(p.submission.createdAt||p.updatedAt)}</td><td><button class="text-link" data-action="open-publication" data-id="${esc(p.id)}">Abrir ${icon('arrowRight',15)}</button></td></tr>`).join('')}</tbody></table></div>`:`<div class="empty-state"><span class="empty-icon">${icon('shield',34)}</span><h2>Sua primeira publicação começa com um projeto.</h2><p>Quando estiver pronto, abra a aba Publicar no construtor. Seu pacote será preservado para a revisão.</p><a href="#/projects" class="btn primary">Escolher um projeto ${icon('arrowRight',17)}</a></div>`}<div class="review-explainer"><div><h4>Receba orientações</h4><p>A equipe pode solicitar ajustes de comportamento, descrição ou compatibilidade.</p></div><div><h4>Preserve suas versões</h4><p>Uma alteração posterior cria um novo rascunho, sem modificar o pacote enviado.</p></div><div><h4>Publique com confiança</h4><p>A disponibilidade comercial depende da revisão e dos testes de qualificação.</p></div></div>`);
}
function docsPage() {
  const docs=DOCS,selected=docs.find(d=>d.id===route().parts[1])||docs[0];
  return pageShell('docs',`${pageHeading(t('docs.eyebrow'),t('docs.title'),t('docs.sub'))}<div class="docs-layout"><nav class="docs-nav" aria-label="${t('docs.topics')}">${docs.map(d=>`<a href="#/docs/${esc(d.id)}" class="${d.id===selected.id?'active':''}">${esc(d.title)}</a>`).join('')}<a href="https://bemerx.com" target="_blank" rel="noopener noreferrer">Conhecer o Merx ${icon('external',14)}</a></nav><article class="docs-article"><span class="section-eyebrow">${esc(selected.eyebrow)}</span><h2>${esc(selected.title)}</h2>${selected.sections.map(section=>`<section><h3>${esc(section.heading)}</h3><p>${esc(section.body).replace(/\n/g,'<br>')}</p>${section.code?`<pre class="code-block"><code>${esc(section.code)}</code></pre>`:''}</section>`).join('')}<section><h3>Recursos desta versão do portal</h3><p>O laboratório utiliza um detector de referência no navegador para experimentar presença, permanência e cruzamento. A execução Rust e a homologação da aceleração Merx acontecem em outro ambiente. Com uma conta do Studio, a conversa utiliza IA para organizar a configuração e os pacotes podem ser enviados à revisão.</p></section></article></div>`);
}
function notFound() {return `${header()}<main id="main-content" class="not-found"><span class="section-eyebrow">MERX STUDIO</span><h1>Não encontramos este projeto.</h1><p>Ele pode ter sido removido ou estar salvo em outro navegador.</p><a class="btn primary" href="#/projects">Abrir meus projetos ${icon('arrowRight',17)}</a></main>`;}


function licensePage(){
  if(!ui.auth)return pageShell('license',`${pageHeading(t('license.eyebrow'),t('license.title'),t('license.annualAccess'))}<div class="empty-state">${icon('lock',32)}<h2>${t('license.signinT')}</h2><p>${t('license.signinB')}</p>${button(t('header.signin'),'login','primary','arrowRight')}</div>`);
  const lic=licenseObject();
  const checkoutState=route().query.get('checkout');
  if(ui.licenseLoading||!lic)return pageShell('license',`${pageHeading(t('license.eyebrow'),t('license.title'),t('license.checkingSub'))}<div class="empty-state"><h2>${t('license.checking')}</h2><p>${t('license.checkingBody')}</p></div>`);
  if(lic.active)return pageShell('license',`${pageHeading(t('license.eyebrow'),t('license.activeTitle'),t('license.activeSub'))}${ui.merxAccount?.linked&&!ui.merxAccount.syncDecided?merxSyncStep():''}<div class="notice success">${icon('checkCircle',19)}<div><strong>${t('license.released')}</strong><p>${t('license.status',{status:esc(lic.status)})}${lic.currentPeriodEnd?` · ${t('license.validUntil',{date:esc(fmt(lic.currentPeriodEnd))})}`:''}</p></div></div><div class="action-row">${button(t('license.manage'),'license-manage','primary','settings')}${button(t('license.recheck'),'license-refresh','secondary','refresh')}</div>`);
  const pay=lic.payments||{};
  const returnNotice=checkoutState==='success'?`<div class="notice"><span>${icon('refresh',17)}</span><div><strong>${t('license.confirmingT')}</strong><p>${t('license.confirmingB')}</p></div></div>`:checkoutState==='cancel'?`<div class="notice"><span>${icon('info',17)}</span><div><strong>${t('license.canceledT')}</strong><p>${t('license.canceledB')}</p></div></div>`:'';
  const errorNotice=lic.error?`<div class="notice"><span>${icon('info',17)}</span><div><strong>${t('license.errorT')}</strong><p>${esc(lic.error)}</p></div></div>`:'';
  return pageShell('license',`${pageHeading(t('license.eyebrow'),t('license.neededTitle'),t('license.neededSub'))}${ui.merxAccount?.linked?`<div class="notice success">${icon('checkCircle',19)}<div><strong>${t('merx.recognizedT')}</strong><p>${t('merx.recognized',{n:ui.merxAccount.deviceCount})}</p></div></div>`:''}${returnNotice}${errorNotice}<div class="empty-state">${icon('lock',32)}<h2>${formatPrice(89.9)}${t('license.priceLaunch')}</h2><p>${t('license.priceBody',{price:formatPrice(119.9)})}</p>${pay.checkoutAvailable?button(t('license.subscribe'),'license-checkout','primary','arrowRight'):`<p><strong>${t('license.unavailable')}</strong> ${t('license.unavailableBody')}</p>`}<div class="row">${button(t('license.recheck'),'license-refresh','secondary','refresh')}</div></div>`);
}
let licenseRequest=null;
async function refreshLicense(reconcile=false){
  if(!ui.auth)return null;
  if(licenseRequest&&!reconcile)return licenseRequest;
  if(licenseRequest&&reconcile)await licenseRequest;
  ui.licenseLoading=true;
  const run=(async()=>{
    try{
      if(reconcile){try{ui.license=await api('/license/reconcile','POST',{});}catch{ui.license=await api('/license');}}
      else ui.license=await api('/license');
    }
    catch(error){ui.license={license:{status:'unknown',active:false,payments:{configured:false},error:error.message}};}
    finally{ui.licenseLoading=false;if(licenseRequest===run)licenseRequest=null;}
    render();
    return ui.license;
  })();
  licenseRequest=run;
  return run;
}
async function pollLicenseAfterCheckout(){
  for(let attempt=0;attempt<6;attempt++){
    await new Promise(resolve=>setTimeout(resolve,2500));
    if(route().name!=='license'||licenseObject()?.active)return;
    await refreshLicense(attempt===2);
    if(licenseObject()?.active){toast(t('toast.paymentConfirmed'));return;}
  }
}
function licenseObject(){return ui.license?.license||ui.license||null;}
function hasStudioAccess(){return Boolean(ui.auth&&licenseObject()?.active);}
function requireStudioAccess(){
  if(!ui.auth){loginModal('login');toast(t('toast.signinCreate'),'warning');return false;}
  if(!ui.license&&!ui.licenseLoading){refreshLicense();toast(t('toast.checkingLicense'),'warning');return false;}
  if(ui.licenseLoading){toast(t('toast.checkingLicense'),'warning');return false;}
  if(!licenseObject()?.active){go('license');toast(t('toast.licenseNeeded'),'warning');return false;}
  return true;
}
function accessGatePage(project){
  if(!ui.auth)return pageShell('projects',`${pageHeading('MERX STUDIO',t('gate.signinTitle'),t('gate.signinSub'))}<div class="empty-state">${icon('lock',32)}<h2>${t('gate.signinH')}</h2><p>${t('gate.signinB')}</p>${button(t('header.signin'),'login','primary','arrowRight')}</div>`);
  if(!ui.license||ui.licenseLoading)return pageShell('projects',`${pageHeading('MERX STUDIO',t('gate.checkingTitle'),t('gate.checkingSub'))}<div class="empty-state"><h2>Consultando…</h2><p>${t('gate.checkingB')}</p>${button(t('gate.viewLicense'),'license-open','secondary','shield')}</div>`);
  return pageShell('license',`${pageHeading(t('license.eyebrow'),t('license.neededTitle'),t('gate.preserved'))}<div class="empty-state">${icon('lock',32)}<h2>${t('gate.neededH')}</h2><p>${t('gate.neededB')}</p>${button(t('gate.viewSubscribe'),'license-open','primary','arrowRight')}</div>`);
}
function isReviewer(){return Array.isArray(ui.auth?.groups)&&ui.auth.groups.includes('MerxReviewers');}
function reviewQueuePage() {
  if(!ui.auth)return pageShell('reviews',`${pageHeading(t('reviews.eyebrow'),t('reviews.title'),'Analíticos enviados para avaliação da equipe.')}<div class="empty-state">${icon('lock',32)}<h2>${t('reviews.signinH')}</h2><p>O acesso à fila é reservado à equipe de revisão Merx.</p>${button(t('header.signin'),'login','primary','arrowRight')}</div>`);
  if(!isReviewer())return pageShell('reviews',`${pageHeading('EQUIPE MERX','Central de revisão','Este espaço exige uma conta com acesso de revisor.')}<div class="empty-state">${icon('shield',32)}<h2>${t('reviews.reservedH')}</h2><p>Você pode acompanhar seus próprios envios na página de publicações.</p><a href="#/submissions" class="btn primary">Minhas publicações</a></div>`);
  const reviews=ui.reviews||[];
  return pageShell('reviews',`${pageHeading('EQUIPE MERX','Central de revisão','Avalie a proposta, registre o parecer e preserve o histórico.',button(t('reviews.refresh'),'refresh-reviews','secondary','refresh'))}<div class="notice">${icon('info',18)}<div><strong>Revisão da proposta de configuração</strong><p>Aprovar publica o analítico no catálogo da Merx Store (com o preço definido pelo autor), mas não o torna instalável nem vendável nesta etapa. A qualificação do modelo e da aceleração Merx precisa de evidências de execução no Merx.</p></div></div>${reviews.length?`<div class="table-wrap"><table class="data-table"><thead><tr><th>Analítico</th><th>Versão</th><th>Status</th><th>Enviado</th><th></th></tr></thead><tbody>${reviews.map(item=>`<tr><td><strong>${esc(item.name)}</strong><small>${esc(item.id)}</small></td><td>${esc(item.version)}</td><td>${statusBadge(item)}</td><td>${fmt(item.createdAt)}</td><td>${button('Revisar','review-detail','secondary small','shield',`data-id="${esc(item.id)}"`)}</td></tr>`).join('')}</tbody></table></div>`:`<div class="empty-state"><span class="empty-icon">${icon('shield',30)}</span><h2>${ui.reviewsLoading?'Carregando a fila…':'Nenhuma proposta carregada.'}</h2><p>${esc(ui.reviewsError||'Atualize a fila para consultar os candidatos enviados.')}</p>${button('Consultar fila','refresh-reviews','primary','refresh')}</div>`}`);
}
async function refreshReviews(){
  if(!isReviewer())return;
  ui.reviewsLoading=true;ui.reviewsError=null;
  try{let result=await api('/reviews');ui.reviews=result.reviews||[];let pages=0;while(result.nextCursor&&pages<20){result=await api('/reviews?'+new URLSearchParams({cursor:result.nextCursor}));ui.reviews.push(...(result.reviews||[]));pages++;}}
  catch(error){ui.reviewsError=error.message;throw error;}
  finally{ui.reviewsLoading=false;if(route().name==='reviews')render();}
}
function reviewModal(item){
  if(!item)return;
  const project=item.snapshot?.project;
  openModal('Revisar proposta',`<div class="stack"><div><span class="section-eyebrow">${esc(item.version)} · ${esc(item.reviewScope)}</span><h3>${esc(item.name)}</h3><p class="muted">${esc(project?.description||'')}</p></div><div><h4>${t('publish.model')}</h4><p>${item.snapshot?.commercial?esc(item.snapshot.commercial.model==='free'?t('publish.free'):(item.snapshot.commercial.model==='recurring'?t('publish.recurring'):t('publish.oneTime'))+' · $'+(item.snapshot.commercial.amountMinor/100).toFixed(2)+' USD'+(item.snapshot.commercial.interval?' / '+item.snapshot.commercial.interval:'')):t('publish.noPrice')}</p></div><div><h4>Notas do desenvolvedor</h4><p>${esc(item.snapshot?.notes||'Sem notas adicionais.')}</p></div><details><summary>Configuração e código do pacote enviado</summary><pre class="code-block">${esc(JSON.stringify(project?.configuration,null,2))}</pre><pre class="code-block">${esc(project?.customSource||project?.source||'Código não anexado.')}</pre></details><div class="field"><span>Identificação imutável do pacote</span><code class="digest-text">${esc(item.snapshotSha256)}</code></div>${item.status==='submitted'?`<form id="review-form" data-id="${esc(item.id)}"><div class="form-grid"><label class="field full-width"><span>Parecer</span><select class="select" name="status"><option value="changes_requested">Solicitar ajustes</option><option value="approved">Aprovar a proposta de configuração</option><option value="rejected">Rejeitar a proposta</option></select></label><label class="field full-width"><span>Orientações para o desenvolvedor</span><textarea name="notes" class="textarea" required minlength="10" maxlength="4000" rows="4" placeholder="Explique os pontos avaliados e os próximos passos."></textarea></label></div><div class="form-actions">${button('Cancelar','close-modal','secondary','','type="button"')}<button type="submit" class="btn primary">${icon('shield',17)} Registrar parecer</button></div></form>`:`<div class="notice"><div><strong>Parecer já registrado</strong><p>${esc(item.review?.notes||statusText(item))}</p></div></div>`}</div>`,'',true);
}
async function refreshSubmissions(){
  if(!ui.auth){loginModal();return;}
  let result=await api('/submissions');const allSubs=[...(result.submissions||[])];let subPages=0;
  while(result.nextCursor&&subPages<20){result=await api('/submissions?'+new URLSearchParams({cursor:result.nextCursor}));allSubs.push(...(result.submissions||[]));subPages++;}
  const sortedSubs=allSubs.slice().sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0));
  for(const submission of sortedSubs){
    let project=getProject(submission.projectId);
    if(!project&&submission.snapshot?.project){project={...submission.snapshot.project,version:submission.version,versions:[{version:submission.version,status:'draft'}],createdAt:submission.createdAt,updatedAt:submission.updatedAt,messages:[]};persistProject(project);}
    if(project){project.submission=submission;project.submissionOwner=ui.auth.sub;project.status=submission.status;}
  }
  save();render();toast('Andamento das suas submissões atualizado.');
}
let lastRoute='';
function render() {queueMicrotask(()=>{try{syncPricing(document.querySelector?.('#publication-form'));}catch{}});
  let r;try {r=route();}catch {location.hash='/';r=route();}
  const routeKey=r.parts.join('/');
  if(lastRoute!==routeKey){stopMedia();ui.testResult=null;ui.query='';window.scrollTo(0,0);}
  lastRoute=routeKey;
  document.body.classList.toggle('is-builder',r.name==='builder');
  if(document.documentElement) document.documentElement.lang = {pt:'pt-BR',en:'en-US',es:'es-ES'}[getLocale()] || 'pt-BR';
  const project=r.name==='builder'?getProject():null;
  document.title=project?`${project.name} — Merx Studio`:r.name==='store'?'Merx Store — Uma nova habilidade para cada ideia':'Merx Studio — Sua ideia. Um analítico inteligente.';
  $('#app').innerHTML=r.name==='home'?home():r.name==='builder'?(hasStudioAccess()?builderPage(project):accessGatePage(project)):r.name==='projects'?projectsPage():r.name==='lab'?labPage():r.name==='store'?(r.parts[1]?storeDetail(CATALOG.find(item=>item.id===r.parts[1])):storePage()):r.name==='license'?licensePage():r.name==='submissions'?submissionsPage():r.name==='docs'?docsPage():r.name==='reviews'?reviewQueuePage():notFound();
  afterRender();
}
let subsAutoKey='',storeAutoKey='';
async function refreshStoreCatalog(){
  try{const result=await api('/catalog','GET',undefined,!ui.auth);ui.storeApps=result.items||[];}
  catch{ui.storeApps=[];}
  if(route().name==='store'&&!route().parts[1])render();
}
function priceLabel(item){
  if(!item?.pricing||item.pricing.kind==='free')return t('publish.free');
  const value='$'+(item.pricing.amount_minor/100).toFixed(2);
  if(item.billing?.model==='recurring')return value+'/'+(item.billing.interval==='year'?t('publish.yearly'):t('publish.monthly'));
  return value;
}
function afterRender() {
  if(ui.auth&&ui.config.apiBase&&!ui.license&&!ui.licenseLoading)refreshLicense();
  if(route().name==='submissions'&&ui.auth&&ui.config.apiBase){const key='submissions';if(subsAutoKey!==key){subsAutoKey=key;refreshSubmissions().catch(()=>{});}}else if(route().name!=='submissions')subsAutoKey='';
  if(route().name==='store'&&!route().parts[1]&&ui.config.apiBase){const key='store';if(storeAutoKey!==key){storeAutoKey=key;ui.storeApps=undefined;refreshStoreCatalog();}}else if(route().name!=='store')storeAutoKey='';
  if(route().name==='license'&&route().query.get('checkout')==='success'&&ui.auth&&!licenseObject()?.active&&!ui.licensePolling){ui.licensePolling=true;pollLicenseAfterCheckout().finally(()=>{ui.licensePolling=false;});}
  if(route().name==='builder'){
    const messages=$('#chat-messages');if(messages)messages.scrollTop=messages.scrollHeight;
    if(ui.tab==='test')attachMedia();
  }
}
function refreshPreview() {const project=getProject();if(project&&$('#preview-content')){$('#preview-content').innerHTML=previewContent(project);if(ui.tab==='test')attachMedia();}}
function setTab(tab) {
  if(ui.tab==='code'&&!saveCode(false))return;
  if(ui.tab==='test'&&tab!=='test')stopMedia();
  ui.tab=tab;ui.mobile='preview';render();
}
function openModal(title,body,footer='',wide=false) {
  ui.lastFocus=document.activeElement;ui.modal=true;
  $('#modal-root').innerHTML=`<div class="modal-backdrop"><section class="modal ${wide?'wide':''}" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-header"><h2 id="modal-title">${title}</h2><button class="btn ghost icon-btn" data-action="close-modal" aria-label="Fechar janela">${icon('x',20)}</button></div><div class="modal-body">${body}</div>${footer?`<div class="modal-footer">${footer}</div>`:''}</section></div>`;
  document.body.classList.add('modal-open');setTimeout(()=>$('.modal input:not([type=checkbox]),.modal textarea,.modal button')?.focus(),0);
}
function closeModal() {$('#modal-root').innerHTML='';ui.modal=null;document.body.classList.remove('modal-open');ui.lastFocus?.focus?.();}
function formError(form,message) {let error=$('.form-error',form);if(!error){error=document.createElement('div');error.className='form-error';error.setAttribute('role','alert');form.append(error);}error.textContent=message;}
function configModal(project) {
  const c=project.configuration;
  openModal(t('config.title'),`<form id="config-form"><p class="modal-intro">Altere os parâmetros diretamente. O fluxo, a prévia e o código gerado acompanham suas escolhas.</p><div class="form-grid"><label class="field full-width"><span>Tipo de observação</span><select class="select" name="mode">${Object.entries(MODES).map(([key,value])=>`<option value="${key}" ${c.mode===key?'selected':''}>${value}</option>`).join('')}</select></label><fieldset class="class-fieldset full-width"><legend>O que identificar</legend><div class="class-choices">${Object.entries(CLASSES).map(([key,value])=>`<label class="class-choice"><input type="checkbox" name="classes" value="${key}" ${(c.classNames||[]).includes(key)?'checked':''}><span>${value}</span></label>`).join('')}</div></fieldset><label class="field full-width"><span>Confiança mínima <strong id="confidence-value">${Math.round(c.confidence*100)}%</strong></span><input type="range" min="10" max="99" step="1" name="confidence" value="${Math.round(c.confidence*100)}" aria-label="Confiança mínima"><small class="help">Um limite maior exige mais confiança do detector.</small></label><label class="field" data-dwell-field ${showDwellField(c.mode)?'':'hidden'}><span>${t('config.dwell')}</span><input type="number" class="input" name="minDurationSeconds" min="1" max="86400" step="0.1" ${showDwellField(c.mode)?'required':''} value="${c.minDurationSeconds}"><small class="help">${t('config.dwellHint')}</small></label><label class="field"><span>Intervalo entre eventos (s)</span><input type="number" class="input" name="cooldownSeconds" min="0" max="86400" step="1" required value="${c.cooldownSeconds}"></label><label class="field"><span>Frames para confirmar</span><input type="number" class="input" name="minFrames" min="1" max="60" required value="${c.minFrames}"></label><label class="field"><span>${t('config.fps')}</span><input type="number" class="input" name="targetFps" min="1" max="10" step="1" required value="${clampTargetFps(c.targetFps)}"><small class="help">${t('config.fpsHint')}</small></label><label class="field"><span>Área de interesse</span><select class="select" name="zonePreset"><option value="current">${t('config.zone.current')}</option><option value="full">${t('config.zone.full')}</option><option value="center">${t('config.zone.center')}</option><option value="left">${t('config.zone.left')}</option><option value="right">${t('config.zone.right')}</option></select></label><label class="field"><span>Direção do cruzamento</span><select class="select" name="direction">${[['both','Nos dois sentidos'],['left_to_right','Esquerda para direita'],['right_to_left','Direita para esquerda'],['top_to_bottom','Cima para baixo'],['bottom_to_top','Baixo para cima']].map(([key,value])=>`<option value="${key}" ${c.direction===key?'selected':''}>${value}</option>`).join('')}</select></label></div><div class="form-actions">${button('Cancelar','close-modal','secondary','','type="button"')}<button class="btn primary" type="submit">${icon('check',17)} Aplicar alterações</button></div></form>`,'',true);
}
function projectOptions(project) {
  openModal(esc(project.name),`<div class="project-option-list">${button('Abrir no construtor','open-project','ghost','code',`data-id="${esc(project.id)}"`)}${button('Duplicar projeto','duplicate-project','ghost','copy',`data-id="${esc(project.id)}"`)}${button('Exportar arquivo do projeto','export-project','ghost','download',`data-id="${esc(project.id)}"`)}${button('Remover deste navegador','confirm-delete','ghost danger','trash',`data-id="${esc(project.id)}"`)}</div>`);
}
function useConcept(id) {
  if(!requireStudioAccess())return;
  if(workspaceLimitReached())return;
  const item=CATALOG.find(c=>c.id===id);if(!item)return;
  const templateId=TEMPLATES.find(t=>t.id===id)?.id||'presence-zone';
  const project=createProject({name:item.title,description:item.description,templateId});
  if(id==='vehicle-zone')project.configuration.classNames=['car','motorcycle','truck'];
  if(id==='animal-zone')project.configuration.classNames=['dog','cat'];
  if(id==='abandoned-object'){project.configuration.classNames=['backpack','handbag','suitcase'];project.configuration.mode='dwell';project.configuration.minDurationSeconds=60;}
  project.messages=[{id:uid(),role:'assistant',text:id==='abandoned-object'?'Preparei uma base de permanência de objetos. Detectar abandono exige contexto adicional, além da presença de um objeto; essa capacidade ainda precisa ser desenvolvida.':'Preparei um ponto de partida para você personalizar. Conte o que deseja mudar ou ajuste os parâmetros diretamente.',changes:[MODES[project.configuration.mode],`Classes: ${project.configuration.classNames.join(', ')}`],engine:'local'}];
  touch(project);persistProject(project);ui.tab='analytic';ui.mobile='preview';go(`builder/${project.id}`);
}
async function sendPrompt(text,projectId=currentId()) {
  text=String(text||'').trim();if(!text||ui.thinking)return;
  let project=getProject(projectId);if(!project)return;
  if(ui.tab==='code'&&!saveCode(false))return;
  stopTest();
  checkpoint(project);
  ensureMessages(project).push({id:uid(),role:'user',text,createdAt:new Date().toISOString()});
  ui.thinking=true;ui.busyProject=project.id;touch(project);const requestRevision=project.localRevision;render();
  let result,engine='local',cloudError;
  try {
    if(ui.auth&&ui.config.apiBase){
      try {result=await api('/chat','POST',{locale:getLocale(),project:{id:project.id,name:project.name,description:project.description,configuration:project.configuration},message:text,history:project.messages.slice(-13,-1).map(m=>({role:m.role,text:m.text}))});engine='cloud';}
      catch(error){if(error.status===402||error.code==='LICENSE_REQUIRED'){ui.license=null;ensureMessages(project).push({id:uid(),role:'assistant',text:'Sua licença não está ativa para usar o assistente conectado. Seu rascunho foi preservado neste navegador.',engine:'local'});save();go('license');toast('Licença necessária. Seu rascunho foi preservado.','warning');return;}cloudError=error.message;}
    }
    if(!result)result=ui.auth?interpretPrompt(project,text):interpretPrompt(project,text);
    const candidate=structuredClone(project);
    if(result.project){candidate.name=result.project.name||candidate.name;candidate.description=result.project.description??candidate.description;candidate.configuration=result.project.configuration||candidate.configuration;}
    if(candidate.name==='Novo analítico'&&!candidate.description){candidate.name=candidate.configuration.mode==='dwell'?'Permanência inteligente':candidate.configuration.mode==='line_crossing'?'Entradas e saídas':candidate.configuration.classNames?.includes('car')?'Presença de veículos':'Presença inteligente';candidate.description=text.slice(0,500);}
    if(candidate.name==='Novo analítico')candidate.name=candidate.configuration.mode==='dwell'?'Permanência inteligente':candidate.configuration.mode==='line_crossing'?'Entradas e saídas':'Presença inteligente';
    const validation=validateProject(candidate);
    if(!validation.valid)throw new Error('A sugestão retornou parâmetros inconsistentes. Seu projeto foi preservado; tente descrever o ajuste de outra forma.');
    const current=getProject(projectId);if(!current)return;
    if(current.localRevision!==requestRevision){ensureMessages(current).push({id:uid(),role:'assistant',text:'Você editou o projeto enquanto eu organizava a resposta. Mantive sua edição mais recente. Envie novamente o ajuste que deseja aplicar.',engine});save();return;}
    current.name=candidate.name;current.description=candidate.description;current.configuration=candidate.configuration;
    const summary=String(result.summary||'Organizei as regras do seu analítico. Você pode ajustar os parâmetros ao lado.');
    ensureMessages(current).push({id:uid(),role:'assistant',text:summary+(result.needsClarification?`\n\n${String(result.needsClarification)}`:''),changes:Array.isArray(result.changes)?result.changes.map(String).slice(0,12):[],engine,createdAt:new Date().toISOString()});
    touch(current);
    if(cloudError)toast(`A IA está indisponível: ${cloudError} As instruções reconhecidas foram tratadas pelo assistente local.`,'warning');
  } catch(error) {
    project=getProject(projectId);if(project){ensureMessages(project).push({id:uid(),role:'assistant',text:error.message,engine:'local'});save();}
  } finally {ui.thinking=false;ui.busyProject=null;if(route().name==='builder'&&currentId()===projectId){render();$('#chat-prompt')?.focus();}}
}
function saveCode(notify=true) {
  const project=getProject(),editor=$('#source-editor');if(!project||!editor||ui.codeFile==='manifest')return true;
  if(editor.value===currentCode(project))return true;
  try {
    if(ui.codeFile==='config'){
      const configuration=JSON.parse(editor.value),candidate={...project,configuration};const result=validateProject(candidate);
      if(!result.valid)throw new Error(result.errors.join(' '));
      checkpoint(project);project.configuration=configuration;
    }else{if(editor.value.length>32000)throw new Error('O código deve ter até 32 mil caracteres nesta versão.');checkpoint(project);project.customSource=editor.value;}
    touch(project);if(notify){toast('Alterações salvas.');render();}return true;
  }catch(error){toast(`Não foi possível salvar: ${error.message}`,'warning');return false;}
}
function projectPayload(project,history=true) {
  const result={};for(const key of ['id','name','description','configuration','source','customSource','templateId','version','versions'])if(project[key]!==undefined)result[key]=structuredClone(project[key]);
  if(result.configuration)result.configuration.targetFps=clampTargetFps(result.configuration.targetFps);
  result.messages=history?(project.messages||[]).slice(-12).map(m=>({role:m.role,text:String(m.text).slice(0,3000),engine:m.engine,changes:Array.isArray(m.changes)?m.changes.slice(0,12).map(c=>String(c).slice(0,300)):[]})):[];
  return result;
}
function exportProject(project=getProject()) {
  if(!project)return;
  if(currentId()===project.id&&!saveCode(false))return;
  const copy=structuredClone(project);delete copy.cloudOwner;delete copy.cloudRevision;delete copy.syncedAt;
  download(`${projectFileName(project)}.merx.json`,JSON.stringify({format:'merx-studio-project',schemaVersion:1,exportedAt:new Date().toISOString(),project:copy},null,2));toast('Projeto exportado com regras, conversa e código.');
}
function merxCamList(d,{select=false}={}){
  const synced=d.synced||[];const isSynced=(dev,c)=>synced.some(x=>x.deviceId===dev.id&&x.cameraId===c.id);
  return (d.devices||[]).map(dev=>{const cams=[...dev.cameras].sort((a,b)=>isSynced(dev,b)-isSynced(dev,a));
    return `<article class="merx-card"><header class="merx-card-head"><span class="merx-card-icon">${icon('chip',18)}</span><strong>${esc(dev.name)}</strong>${badge(dev.online?t('merx.online'):t('merx.offline'),dev.online?'success':'draft')}${dev.online&&!dev.testReady?`<span class="small-text muted">${t('merx.updateNeeded')}</span>`:''}</header>
    ${cams.length?`<div class="merx-cam-grid">${cams.map(c=>{const thumb=c.hasImage?`<img class="merx-thumb" data-thumb-device="${esc(dev.id)}" data-thumb-camera="${esc(c.id)}" alt="">`:`<span class="merx-thumb merx-thumb-empty">${icon('camera',20)}</span>`;
      const meta=`<span class="merx-cam-text"><strong>${esc(c.name)}</strong><small>${isSynced(dev,c)?t('merx.syncedTag'):''}${!c.hasImage?(isSynced(dev,c)?' · ':'')+t('merx.noSnapshot'):''}</small></span>`;
      return select?`<label class="merx-cam selectable"><input type="checkbox" name="sync" value="${esc(dev.id)}|${esc(c.id)}" ${isSynced(dev,c)?'checked':''}><span class="merx-check" aria-hidden="true">${icon('check',14)}</span>${thumb}${meta}</label>`
        :`<div class="merx-cam">${thumb}${meta}${button(t('merx.useInLab'),'merx-use-camera','secondary small','image',`data-device="${esc(dev.id)}" data-camera="${esc(c.id)}" data-name="${esc(c.name)}" ${c.hasImage?'':'disabled'}`)}</div>`;}).join('')}</div>`:`<p class="small-text muted">${t('merx.noCameras')}</p>`}</article>`;}).join('');
}
async function fillMerxThumbs(root=document){for(const img of root.querySelectorAll('img[data-thumb-device]')){try{const r=await api(`/merx/snapshot/${img.dataset.thumbDevice}/${img.dataset.thumbCamera}`);if(r.snapshot?.url)img.src=r.snapshot.url;}catch{}}}
async function connectMerxModal() {
  const body=html=>openModal(t('merx.modalT'),`<div class="merx-modal">${html}</div>`,'',true);
  if(!ui.auth){body(`<div class="notice"><span>${icon('info',18)}</span><div><strong>${t('merx.mineT')}</strong><p>${t('merx.signin')}</p></div></div>`);return;}
  body(`<p class="muted">${t('merx.loading')}</p>`);
  if(!ui.merxAccount||!ui.merxAccount.linked){try{ui.merxAccount=await api('/merx/account');}catch{ui.merxAccount={linked:false};}}
  if(!ui.merxAccount.linked){body(`<div class="notice"><span>${icon('info',18)}</span><div><strong>${t('merx.stateNotLinked')}</strong><p>${t('merx.notLinked')}</p></div></div>`);return;}
  if(!licenseObject()?.active){body(`<div class="notice"><span>${icon('lock',18)}</span><div><strong>${t('merx.stateNoLicense')}</strong><p>${t('merx.noLicense')}</p></div></div><div class="action-row">${button(t('merx.toLicense'),'merx-go-license','primary','arrowRight')}</div>`);return;}
  try{ui.merxDevices=await api('/merx/devices');}catch(e){body(`<div class="notice"><span>${icon('info',18)}</span><div><p>${esc(e.message)}</p></div></div>`);return;}
  const d=ui.merxDevices;
  body(`<div class="notice success"><span>${icon('checkCircle',18)}</span><div><strong>${t('merx.recognizedT')}</strong><p>${t('merx.modalB')}</p></div></div>${(d.devices||[]).length?merxCamList(d):`<p>${t('merx.noDevices')}</p>`}`);
  fillMerxThumbs($('#modal-root'));
}
async function useMerxCamera(deviceId,cameraId,name){
  // Bytes come through the Studio API (already allowed origin), so the canvas is never tainted and no storage CORS is involved.
  const r=await api(`/merx/snapshot-image/${deviceId}/${cameraId}`);
  if(!r.image?.data){toast(r.reason==='offline'?t('merx.stateOffline'):t('merx.noSnapshot'));return;}
  let blob;try{const bin=atob(r.image.data),buf=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)buf[i]=bin.charCodeAt(i);blob=new Blob([buf],{type:r.image.contentType||'image/jpeg'});}catch{toast(t('merx.snapshotError'));return;} // in memory only
  stopMedia();ui.sourceUrl=URL.createObjectURL(blob);ui.sourceType='image';ui.sourceMerx=true;ui.sourceName=`Merx · ${name}${r.online?'':' · '+t('merx.offline')}`;ui.events=[];ui.tab='test';ui.mobile='preview';
  closeModal();render();toast(t('merx.snapshotLoaded'));
}

async function cog(action,payload) {
  const response=await fetch(`https://cognito-idp.${ui.config.region||'us-east-1'}.amazonaws.com/`,{method:'POST',headers:{'Content-Type':'application/x-amz-json-1.1','X-Amz-Target':`AWSCognitoIdentityProviderService.${action}`},body:JSON.stringify(payload),signal:AbortSignal.timeout(25000)});
  const data=await response.json();if(!response.ok){const error=new Error(data.message||data.Message||'Não foi possível acessar sua conta.');error.code=data.__type?.split('#').pop();throw error;}return data;
}
function authError(error) {
  return ({NotAuthorizedException:t('auth.err.credentials'),UserNotFoundException:t('auth.err.notfound'),UsernameExistsException:t('auth.err.exists'),CodeMismatchException:t('auth.err.codemismatch'),ExpiredCodeException:t('auth.err.codeexpired'),InvalidPasswordException:t('auth.err.password'),LimitExceededException:t('auth.err.many'),TooManyRequestsException:t('auth.err.many')})[error.code]||error.message;
}
function loginModal(mode='login',email='') {
  ui.authMode=mode;ui.authEmail=email||ui.authEmail||'';
  if(!ui.config.cognitoClientId){openModal('Sua conta no Studio',`<div class="device-connect-intro">${mark()}<h3>O workspace está em preparação.</h3><p>Você pode criar, editar, testar e exportar seus projetos neste navegador. A entrada na conta será habilitada quando o serviço de autenticação estiver disponível.</p></div>`,button('Continuar criando','close-modal','primary','arrowRight'));return;}
  const titles={login:'Bem-vindo ao seu Studio.',signup:'Uma conta. Novas possibilidades.',confirm:'Confirme seu e-mail.',forgot:'Vamos recuperar seu acesso.',reset:'Defina uma nova senha.',mfa:'Confirme o código de acesso.'};
  openModal('Merx Studio',`<div class="auth-intro">${mark()}<h3>${titles[mode]}</h3><p>${mode==='login'?'Entre com sua conta do Studio para criar com IA e enviar para revisão. Nesta prévia, o cadastro é separado do App Merx AI.':mode==='signup'?'Crie seu acesso ao Merx Studio com seu e-mail.':mode==='confirm'?`Digite o código enviado para ${esc(ui.authEmail)}.`:mode==='forgot'?'Enviaremos um código de recuperação para o seu e-mail.':mode==='mfa'?'Use o código atual do seu aplicativo autenticador.':'Informe o código recebido e sua nova senha.'}</p></div><form id="auth-form"><div class="stack">${mode==='signup'?'<label class="field"><span>Nome</span><input class="input" type="text" name="name" autocomplete="name" maxlength="120" placeholder="Seu nome"></label>':''}${!['confirm','reset','mfa'].includes(mode)?`<label class="field"><span>E-mail</span><input class="input" type="email" name="email" autocomplete="email" required maxlength="254" value="${esc(ui.authEmail)}" placeholder="voce@empresa.com"></label>`:''}${['confirm','reset','mfa'].includes(mode)?'<label class="field"><span>Código de confirmação</span><input class="input confirmation-input" name="code" inputmode="numeric" autocomplete="one-time-code" required maxlength="12" placeholder="000000"></label>':''}${['login','signup','reset'].includes(mode)?`<label class="field"><span>${mode==='reset'?'Nova senha':'Senha'}</span><input class="input" type="password" name="password" autocomplete="${mode==='login'?'current-password':'new-password'}" required ${mode!=='login'?'minlength="12"':''} maxlength="128" placeholder="Sua senha">${mode!=='login'?'<small class="help">${t("auth.passwordHint")}</small>':''}</label>`:''}${mode==='login'?'<button type="button" class="text-link auth-forgot" data-action="forgot-password">Esqueci minha senha</button>':''}<button class="btn primary full-width" type="submit">${mode==='login'?'Entrar no Studio':mode==='signup'?'Criar minha conta':mode==='confirm'?'Confirmar e-mail':mode==='forgot'?'Enviar código':mode==='mfa'?'Verificar código':'Salvar nova senha'} ${icon('arrowRight',17)}</button></div></form><div class="auth-footer">${mode==='login'?'<span>Primeira vez por aqui?</span><button class="text-link" data-action="signup">Criar uma conta</button>':mode==='signup'?'<span>Já tem uma conta?</span><button class="text-link" data-action="login">Entrar</button>':mode==='confirm'?'<button class="text-link" data-action="resend-code">Reenviar código</button><button class="text-link" data-action="login">Voltar para entrar</button>':'<button class="text-link" data-action="login">Voltar para entrar</button>'}</div>`);
}
function acceptAuth(result,email) {
  ui.auth={email:email||ui.authEmail,accessToken:result.AccessToken,idToken:result.IdToken,refreshToken:result.RefreshToken||ui.auth?.refreshToken,expiresAt:Date.now()+result.ExpiresIn*1000-30000};queueMicrotask(()=>checkMerxAccount());
  try {const claims=JSON.parse(atob(result.AccessToken.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));ui.auth.sub=claims.sub;ui.auth.groups=claims['cognito:groups']||[];} catch {}
  sessionStorage.setItem('merx.studio.auth',JSON.stringify(ui.auth));
}
async function refreshAuth() {
  if(!ui.auth)throw new Error('Entre na sua conta para continuar.');
  if(ui.auth.expiresAt>Date.now())return;
  try {const result=await cog('InitiateAuth',{AuthFlow:'REFRESH_TOKEN_AUTH',ClientId:ui.config.cognitoClientId,AuthParameters:{REFRESH_TOKEN:ui.auth.refreshToken}});acceptAuth(result.AuthenticationResult,ui.auth.email);}
  catch{ui.auth=null;sessionStorage.removeItem('merx.studio.auth');throw new Error('Sua sessão expirou. Entre novamente.');}
}
async function api(path,method='GET',body,publicCall=false) {
  if(!ui.config.apiBase)throw new Error('O serviço do Studio está em preparação.');
  if(!publicCall)await refreshAuth();
  if(body!==undefined&&new TextEncoder().encode(JSON.stringify(body)).byteLength>131072)throw new Error('O pacote excede 128 KiB. Reduza o código ou o histórico antes de enviar. Seu rascunho permanece salvo.');
  const response=await fetch(ui.config.apiBase+path,{method,headers:{'Content-Type':'application/json',...(!publicCall?{'Authorization':`Bearer ${ui.auth.accessToken}`}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(35000)});
  let data;try{data=await response.json();}catch{throw new Error('O serviço retornou uma resposta inesperada.');}
  if(!response.ok){const error=new Error(typeof data.error==='string'?data.error:data.error?.message||data.message||`Não foi possível concluir (${response.status}).`);error.status=response.status;error.code=data.error?.code||data.code;if(data.license)ui.license={license:data.license};throw error;}return data;
}
async function cloudSave(project) {
  if(!ui.auth){loginModal();return;}
  if(!project)return;
  if(currentId()===project.id&&ui.tab==='code'&&!saveCode(false))return false;
  const clean=projectPayload(project);
  let result;try {result=await api(`/projects/${encodeURIComponent(project.id)}`,'PUT',{project:clean,expectedRevision:project.cloudOwner===ui.auth.sub?(project.cloudRevision||0):0});} catch(error){if(error.status===409){openModal('Existe uma versão mais recente',`<p>Este projeto mudou na sua conta. Preserve sua edição como uma cópia local e carregue a versão atual antes de continuar.</p>`,button('Cancelar','close-modal','secondary')+button('Preservar cópia e carregar','resolve-conflict','primary','copy',`data-id="${esc(project.id)}"`));return false;}throw error;}
  project.cloudRevision=result.revision||result.project?.revision;project.cloudOwner=ui.auth.sub;project.syncedAt=new Date().toISOString();save();toast('Projeto salvo na sua conta.');return true;
}
async function loadCloudProjects({quiet=false}={}) {
  if(!ui.auth){if(!quiet)loginModal();return {count:0};}
  let data=await api('/projects'),count=0;const all=[...(data.projects||[])];
  let pages=0;
  while(data.nextCursor&&pages<20){data=await api('/projects?'+new URLSearchParams({cursor:data.nextCursor}));all.push(...(data.projects||[]));pages++;}
  for(const remote of all){const p=remote.project||remote;const local=getProject(p.id);if(!p.id||!p.configuration)continue;p.configuration.targetFps=clampTargetFps(p.configuration.targetFps);const valid=validateProject(p);if(!valid.valid)continue;if(!local){persistProject({...p,cloudRevision:remote.revision||p.revision,cloudOwner:ui.auth.sub,syncedAt:new Date().toISOString()});count++;}else if(!local.cloudRevision){local.cloudRevision=remote.revision||p.revision;local.cloudOwner=ui.auth.sub;if(local.configuration)local.configuration.targetFps=clampTargetFps(local.configuration.targetFps);save();}}
  if(!quiet)toast(count?`${count} projeto${count===1?'':'s'} da conta carregado${count===1?'':'s'}.`:'Seus rascunhos locais foram preservados. Nenhum novo projeto na conta.');
  render();
  return {count};
}
export const PLATFORM_FEE_BPS=989; // 9,89% — single source in the client; server enforces the same constant.
export function creatorNetMinor(amountMinor){return Math.max(0,amountMinor-Math.round(amountMinor*PLATFORM_FEE_BPS/10000));}
export function parseBRL(raw){const v=String(raw||'').trim().replace(/^R\$\s*/,'').replace(/\.(?=\d{3}(\D|$))/g,'').replace(',','.');const m=/^(\d{1,7})(?:\.(\d{1,2}))?$/.exec(v);return m?Number(m[1])*100+Number((m[2]||'').padEnd(2,'0')):0;}
function brl(minor){return new Intl.NumberFormat(localeTag(),{style:'currency',currency:'BRL'}).format(minor/100);}
function pricingBlock(c){const paid=c.model==='one_time'||c.model==='recurring',kind=c.model==='free'?'free':paid?'paid':'';
  return `<fieldset class="pricing-choice full-width" id="pricing-block"><legend><h3>${t('pub.pricingT')}</h3><p class="small-text muted">${t('pub.pricingB')}</p></legend>
  <div class="segmented" role="radiogroup"><label><input type="radio" name="priceKind" value="free" ${kind==='free'?'checked':''} required> ${t('publish.free')}</label><label><input type="radio" name="priceKind" value="paid" ${kind==='paid'?'checked':''}> ${t('pub.paid')}</label></div>
  <div class="pricing-paid" ${kind==='paid'?'':'hidden'}><div class="segmented" role="radiogroup"><label><input type="radio" name="billingModel" value="one_time" ${c.model==='one_time'?'checked':''}> ${t('publish.oneTime')}</label><label><input type="radio" name="billingModel" value="recurring" ${c.model==='recurring'?'checked':''}> ${t('publish.recurring')}</label></div>
  <label class="field pricing-interval" ${c.model==='recurring'?'':'hidden'}><span>${t('publish.interval')}</span><select class="select" name="billingInterval"><option value="month" ${c.interval!=='year'?'selected':''}>${t('publish.monthly')}</option><option value="year" ${c.interval==='year'?'selected':''}>${t('publish.yearly')}</option></select></label>
  <label class="field"><span>${t('publish.price')}</span><input class="input" name="price" inputmode="decimal" placeholder="${t('publish.pricePh')}" value="${c.amountMinor?esc((c.amountMinor/100).toFixed(2).replace('.',',')):''}"></label>
  <p class="small-text muted" id="creator-net">${c.amountMinor?t('pub.net',{net:brl(creatorNetMinor(c.amountMinor)),fee:'9,89%'}):t('publish.priceHint')}</p></div>
  <p class="field-error" id="pricing-error" hidden></p></fieldset>`;}
function readCommercial(form) {
  const data=new FormData(form),kind=String(data.get('priceKind')||'');
  if(kind==='free')return {model:'free',interval:null,amountMinor:0,currency:'BRL'};
  if(kind!=='paid')throw new Error(t('pub.err.kind'));
  const model=String(data.get('billingModel')||'');
  if(model!=='one_time'&&model!=='recurring')throw new Error(t('pub.err.model'));
  const amountMinor=parseBRL(data.get('price'));
  if(amountMinor<1)throw new Error(t('publish.priceRequired'));
  return {model,interval:model==='recurring'?(String(data.get('billingInterval'))==='year'?'year':'month'):null,amountMinor,currency:'BRL'};
}
function syncPricing(form){if(!form||typeof FormData==='undefined'||!form.querySelector)return;const d=new FormData(form),kind=d.get('priceKind'),model=d.get('billingModel');const paid=form.querySelector('.pricing-paid');if(paid)paid.hidden=kind!=='paid';const iv=form.querySelector('.pricing-interval');if(iv)iv.hidden=model!=='recurring';const net=form.querySelector('#creator-net'),amt=parseBRL(d.get('price'));if(net)net.textContent=amt?t('pub.net',{net:brl(creatorNetMinor(amt)),fee:'9,89%'}):t('publish.priceHint');let ok=false;try{readCommercial(form);ok=true;}catch{}const sb=form.querySelector('button[type=submit]');if(sb)sb.disabled=!ok;}
async function submitPublication(form) {
  const project=getProject(),data=new FormData(form);if(!project)return;
  project.name=String(data.get('name')).trim();project.description=String(data.get('description')).trim();project.version=String(data.get('version')).trim();project.reviewNotes=String(data.get('notes')).trim();touch(project);
  if(!ui.auth){loginModal();toast('Apresentação salva. Entre e confirme o envio na aba Publicar.');return;}
  const check=validateProject(project);if(!check.valid)throw new Error(check.errors.join(' '));
  const commercial=readCommercial(form);project.commercial=commercial;
  const result=await api('/submissions','POST',{project:projectPayload(project,false),notes:project.reviewNotes,version:project.version,commercial,attestations:{rights:data.get('rights')==='on',privacy:data.get('privacy')==='on',tests:data.get('tests')==='on'}});
  project.submission=result.submission;project.submissionOwner=ui.auth.sub;project.status='submitted';save();toast(t('pub.sentToast'));render();
}

let visionModule,loopTimer,runGeneration=0,mediaGeneration=0;
async function getVision(){return visionModule ||= await import('./vision.js?v=20261102a');}
function sourceElement(){return $('#lab-video')||$('#lab-image');}
function stopTest() {
  ui.running=false;runGeneration++;clearTimeout(loopTimer);
  const status=$('#lab-run-status');if(status)status.textContent='Teste parado';
  const btn=$('[data-action="toggle-test"]');if(btn){btn.innerHTML=icon('play',17)+'Iniciar teste';btn.classList.add('primary');}
}
function stopMedia() {
  mediaGeneration++;ui.events=[];ui.runContext=null;
  stopTest();if(ui.stream)ui.stream.getTracks().forEach(track=>track.stop());ui.stream=null;
  if(ui.sourceUrl)URL.revokeObjectURL(ui.sourceUrl);ui.sourceUrl=null;ui.sourceMerx=false;ui.sourceType=null;ui.sourceName='';ui.drawZone=false;ui.detections=[];
}
function fitMedia(element) {
  const width=element.videoWidth||element.naturalWidth,height=element.videoHeight||element.naturalHeight;
  if(!width||!height)return;
  const inner=$('#media-inner');if(inner)inner.style.aspectRatio=String(width/height);
  getVision().then(v=>v.drawOverlay($('#detection-canvas'),element,getProject()?.configuration||{},ui.detections)).catch(()=>{});
}
function attachMedia() {
  const video=$('#lab-video'),image=$('#lab-image');
  if(video){video.onloadedmetadata=()=>fitMedia(video);video.onseeked=()=>{ui.ruleEngine?.reset();fitMedia(video);};if(ui.stream){video.srcObject=ui.stream;video.play().catch(()=>{});}else if(ui.sourceUrl)video.src=ui.sourceUrl;}
  if(image&&ui.sourceUrl){image.onload=()=>fitMedia(image);image.src=ui.sourceUrl;}
  setupZoneDrawing();
}
async function startCamera() {
  if(!navigator.mediaDevices?.getUserMedia){toast('Este navegador não oferece acesso à câmera. Use um arquivo de vídeo.','warning');return;}
  let project=getProject();if(!project){project=newProject();await new Promise(resolve=>setTimeout(resolve,50));}
  stopMedia();ui.tab='test';ui.mobile='preview';render();
  try {
    const generation=lastRoute,mediaRequest=mediaGeneration;
    const stream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280},height:{ideal:720},facingMode:'environment'},audio:false});
    if(lastRoute!==generation||mediaRequest!==mediaGeneration||ui.tab!=='test'){stream.getTracks().forEach(track=>track.stop());return;}
    ui.stream=stream;ui.sourceType='camera';ui.sourceName='Câmera deste navegador';ui.events=[];refreshPreview();toast('Câmera conectada. Você pode desenhar a área e iniciar o teste.');
  }catch(error){const messages={NotAllowedError:'O acesso à câmera não foi autorizado. Você pode permitir o acesso no navegador ou usar um vídeo.',NotFoundError:'Nenhuma câmera foi encontrada neste computador.',NotReadableError:'A câmera está ocupada ou indisponível. Feche o outro aplicativo e tente novamente.'};toast(messages[error.name]||'Não foi possível abrir a câmera. Use um vídeo ou tente novamente.','warning');}
}
async function loadVideoFile(file) {
  if(!file)return;if(!/^(video|image)\//.test(file.type)){toast('Selecione um vídeo ou uma imagem compatível.','warning');return;}
  if(!getProject()){const project=newProject();await new Promise(resolve=>setTimeout(resolve,60));if(!getProject(project.id))return;}
  stopMedia();ui.sourceUrl=URL.createObjectURL(file);ui.sourceType=file.type.startsWith('image/')?'image':'video';ui.sourceName=file.name;ui.events=[];ui.tab='test';ui.mobile='preview';render();
  toast(ui.sourceType==='image'?'Imagem carregada. O teste de permanência e cruzamento precisa de vídeo.':'Vídeo carregado. Ajuste a área e inicie o teste.');
}
async function startTest() {
  if(ui.running){stopTest();return;}
  const project=getProject(),source=sourceElement();if(!project||!source)return;
  const validation=validateProject(project);if(!validation.valid){toast(validation.errors.join(' '),'warning');return;}
  if(!(source.videoWidth||source.naturalWidth)){toast('Aguarde a imagem terminar de carregar.','warning');return;}
  const generation=++runGeneration;ui.loadingModel=true;
  const runButton=$('[data-action="toggle-test"]');if(runButton)runButton.disabled=true;
  try {
    const vision=await getVision();const detector=await vision.loadDetector(message=>{const status=$('#lab-run-status');if(status)status.textContent=message;});
    if(generation!==runGeneration||ui.tab!=='test')return;
    ui.detector=detector;ui.ruleEngine=new vision.RuleEngine(project.configuration);ui.running=true;ui.drawZone=false;ui.events=[];ui.detections=[];ui.runContext={projectId:project.id,projectName:project.name,version:project.version||'0.1.0',configuration:structuredClone(project.configuration),source:ui.sourceName,startedAt:new Date().toISOString()};if($('#event-list'))$('#event-list').innerHTML=eventsHtml();
    if(source.tagName==='VIDEO'&&source.paused)await source.play();
    const canvas=$('#detection-canvas');if(canvas)canvas.style.pointerEvents='none';
    const run=async()=>{
      if(!ui.running||generation!==runGeneration)return;
      const currentSource=sourceElement();if(!currentSource){stopTest();return;}
      if(currentSource.tagName==='VIDEO'&&(currentSource.paused||currentSource.ended)){loopTimer=setTimeout(run,250);return;}
      const started=performance.now();
      try {
        const predictions=await detector.model.detect(currentSource,50,Math.max(.1,project.configuration.confidence));
        if(!ui.running||generation!==runGeneration)return;
        const inferenceMs=performance.now()-started,w=currentSource.videoWidth||currentSource.naturalWidth,h=currentSource.videoHeight||currentSource.naturalHeight;
        const at=ui.stream?performance.now():currentSource.tagName==='VIDEO'?currentSource.currentTime*1000:0;
        const result=currentSource.tagName==='IMG'?{detections:predictions.filter(d=>project.configuration.classNames.includes(d.class)),events:[]}:ui.ruleEngine.process(predictions,w,h,at);
        ui.detections=result.detections;ui.events.push(...result.events);if(ui.events.length>1000)ui.events=ui.events.slice(-1000);
        vision.drawOverlay($('#detection-canvas'),currentSource,project.configuration,result.detections);
        if($('#metric-objects'))$('#metric-objects').textContent=String(result.detections.length);
        if($('#metric-latency'))$('#metric-latency').innerHTML=Math.round(inferenceMs)+'<small> ms</small>';
        if($('#metric-events'))$('#metric-events').textContent=String(ui.events.length);
        if($('#metric-backend'))$('#metric-backend').textContent=ui.sourceMerx?`Merx · ${detector.backend}`:detector.backend;
        if($('#lab-run-status'))$('#lab-run-status').textContent=currentSource.tagName==='IMG'?'Detecção concluída nesta imagem':'Teste em execução · navegador';
        if(result.events.length){$('#event-list').innerHTML=eventsHtml();$('[data-action="export-events"]')?.removeAttribute('disabled');}
        if(currentSource.tagName==='IMG'){stopTest();if($('#lab-run-status'))$('#lab-run-status').textContent='Detecção concluída · imagem estática';return;}
        loopTimer=setTimeout(run,Math.max(30,1000/clampTargetFps(project.configuration.targetFps)-inferenceMs));
      }catch(error){stopTest();toast(`O teste foi interrompido: ${error.message}`,'warning');}
    };
    if(runButton){runButton.innerHTML=icon('stop',17)+'Parar teste';runButton.classList.remove('primary');runButton.classList.add('secondary');}run();
  }catch(error){toast(error.message,'warning');stopTest();}
  finally{ui.loadingModel=false;const currentButton=$('[data-action="toggle-test"]');if(currentButton)currentButton.disabled=false;}
}
function setupZoneDrawing() {
  const canvas=$('#detection-canvas');if(!canvas)return;
  canvas.style.pointerEvents=ui.drawZone?'auto':'none';canvas.style.cursor=ui.drawZone?'crosshair':'default';
  let start=null;
  const point=event=>{const rect=canvas.getBoundingClientRect();return {x:clamp((event.clientX-rect.left)/rect.width,0,1),y:clamp((event.clientY-rect.top)/rect.height,0,1)};};
  const draft=end=>getProject().configuration.mode==='line_crossing'?{line:{start,end}}:{zone:{x:Math.min(start.x,end.x),y:Math.min(start.y,end.y),width:Math.abs(start.x-end.x),height:Math.abs(start.y-end.y)}};
  canvas.onpointerdown=event=>{if(!ui.drawZone)return;event.preventDefault();start=point(event);canvas.setPointerCapture(event.pointerId);};
  canvas.onpointermove=async event=>{if(!start)return;const v=await getVision();v.drawOverlay(canvas,sourceElement(),getProject().configuration,[],draft(point(event)));};
  canvas.onpointerup=event=>{if(!start)return;const project=getProject(),change=draft(point(event));start=null;canvas.releasePointerCapture(event.pointerId);const candidate={...project,configuration:{...project.configuration,...change}},check=validateProject(candidate);if(check.valid){checkpoint(project);project.configuration=candidate.configuration;touch(project,{geometry:true});toast(change.line?'Linha atualizada.':'Área atualizada.');}else toast('Desenhe uma área maior ou uma linha com dois pontos diferentes.','warning');ui.drawZone=false;canvas.style.pointerEvents='none';fitMedia(sourceElement());};
  canvas.onpointercancel=()=>{start=null;};
}

document.addEventListener('click',async event=>{
  const anchor=event.target.closest('a[href^="#/"]');
  if(anchor&&anchor.hash!==location.hash&&ui.tab==='code'&&route().name==='builder'&&!saveCode(false)){event.preventDefault();return;}
  const target=event.target.closest('[data-action]');if(!target)return;
  const action=target.dataset.action,project=getProject(target.dataset.id||currentId());
  try {
    switch(action){
      case 'set-locale': { if(route().name==='builder'&&ui.tab==='code'&&!saveCode(false)){toast(t('toast.storageFull'),'warning');break;} setLocale(target.dataset.locale); persistLocale(localStorage,getLocale()); render(); break; }
      case 'new-project': ui.tab='analytic';ui.mobile='chat';newProject();break;
      case 'starter': {const prompt=STARTERS[Number(target.dataset.index)]?.prompt;if(route().name==='builder'&&getProject())sendPrompt(prompt);else newProject(prompt);break;}
      case 'builder-tab': setTab(target.dataset.tab);break;
      case 'publish-tab': setTab('publish');break;
      case 'mobile-chat':ui.mobile='chat';$('.builder-layout')?.setAttribute('data-mobile-view','chat');$$('.mobile-builder-tabs button').forEach(el=>el.classList.toggle('active',el.dataset.action==='mobile-chat'));break;
      case 'mobile-preview':ui.mobile='preview';$('.builder-layout')?.setAttribute('data-mobile-view','preview');$$('.mobile-builder-tabs button').forEach(el=>el.classList.toggle('active',el.dataset.action==='mobile-preview'));break;
      case 'mobile-menu':$('.site-nav')?.classList.toggle('mobile-open');break;
      case 'edit-config':configModal(project);break;
      case 'rename-project':openModal('Nome do projeto',`<form id="rename-form"><label class="field"><span>Escolha um nome para seu analítico</span><input class="input" name="name" required minlength="3" maxlength="120" value="${esc(project.name)}"></label><div class="form-actions">${button('Cancelar','close-modal','secondary','','type="button"')}<button class="btn primary" type="submit">Salvar nome</button></div></form>`);break;
      case 'undo':{const history=ui.undo[project.id];if(history?.length){const old=history.pop();persistProject(old);ui.testResult=null;render();toast('Última alteração desfeita.');}break;}
      case 'project-options':projectOptions(project);break;
      case 'open-project':closeModal();go(`builder/${project.id}`);break;
      case 'go-projects':go('projects');break;
      case 'duplicate-project':{if(!requireStudioAccess())break;if(workspaceLimitReached())break;const copy=structuredClone(project);copy.id=uid();copy.name=project.name+' — cópia';copy.createdAt=copy.updatedAt=new Date().toISOString();copy.status='draft';delete copy.submission;delete copy.cloudRevision;delete copy.syncedAt;persistProject(copy);closeModal();go(`builder/${copy.id}`);toast('Cópia criada.');break;}
      case 'confirm-delete':openModal('Remover projeto deste navegador?',`<p>O rascunho <strong>${esc(project.name)}</strong> será removido deste navegador. Arquivos exportados e pacotes já enviados à revisão permanecem disponíveis.</p>`,button('Cancelar','close-modal','secondary')+button('Remover rascunho','delete-project','danger','trash',`data-id="${esc(project.id)}"`));break;
      case 'delete-project':workspace.projects=workspace.projects.filter(p=>p.id!==project.id);save();closeModal();if(route().name==='builder')go('projects');else render();toast('Rascunho removido deste navegador.');break;
      case 'export-project':exportProject(project);break;
      case 'import-project':$('#project-import').click();break;
      case 'code-file':if(saveCode(false)){ui.codeFile=target.dataset.file;refreshPreview();}break;
      case 'save-code':saveCode();break;
      case 'reset-code':checkpoint(project);delete project.customSource;touch(project);refreshPreview();toast('Código gerado restaurado.');break;
      case 'copy-code':{const text=$('#source-editor')?.value||currentCode(project);await navigator.clipboard.writeText(text);toast('Código copiado.');break;}
      case 'download-code':download(ui.codeFile==='spec'?'spec.json':ui.codeFile==='rust'?'analytic.rs':ui.codeFile==='config'?'config.json':'manifest.json',$('#source-editor')?.value||currentCode(project),'text/plain');break;
      case 'validate-project':if(!saveCode(false))break;ui.testResult=validateProject(project);openModal('Validação da configuração',validationHtml(ui.testResult),button('Continuar','close-modal','primary','check'),true);break;
      case 'open-lab':ui.tab='test';ui.mobile='preview';go(`builder/${project.id}`);break;
      case 'attach-video':$('#video-upload').click();break;
      case 'start-camera':await startCamera();break;
      case 'modal-camera':closeModal();await startCamera();break;
      case 'connect-merx':connectMerxModal();break;
      case 'merx-use-camera':{target.disabled=true;try{await useMerxCamera(target.dataset.device,target.dataset.camera,target.dataset.name);}catch(e){toast(/fetch|network/i.test(String(e?.message))?t('merx.snapshotError'):e.message);}finally{target.disabled=false;}break;}
      case 'merx-go-license':closeModal();go('license');break;
      case 'close-source':stopMedia();refreshPreview();break;
      case 'toggle-test':await startTest();break;
      case 'draw-zone':stopTest();ui.drawZone=true;setupZoneDrawing();toast(project.configuration.mode==='line_crossing'?'Arraste sobre a imagem para definir a linha.':'Arraste sobre a imagem para desenhar a área.');break;
      case 'export-events':download(`${projectFileName(project)}-eventos.json`,JSON.stringify({environment:'browser-reference',deviceQualified:false,...ui.runContext,events:ui.events},null,2));break;
      case 'mnm-docs':closeModal();go('docs');break;
      case 'store-filter':ui.storeFilter=target.dataset.category;render();break;
      case 'use-concept':useConcept(target.dataset.id);break;
      case 'open-publication':ui.tab='publish';ui.mobile='preview';go(`builder/${project.id}`);break;
      case 'save-presentation':{const form=$('#publication-form');if(!['name','version','description'].every(name=>form.elements[name].reportValidity()))break;const data=new FormData(form);project.name=String(data.get('name')).trim();project.description=String(data.get('description')).trim();project.version=String(data.get('version')).trim();project.reviewNotes=String(data.get('notes')).trim();try{project.commercial=readCommercial(form);}catch(error){toast(error.message,'warning');break;}touch(project);toast('Apresentação salva.');break;}
      case 'close-modal':closeModal();break;
      case 'login':loginModal('login');break;
      case 'signup':loginModal('signup');break;
      case 'forgot-password':ui.authEmail=$('[name="email"]')?.value||ui.authEmail;loginModal('forgot');break;
      case 'resend-code':await cog('ResendConfirmationCode',{ClientId:ui.config.cognitoClientId,Username:ui.authEmail});toast('Novo código enviado.');break;
      case 'refresh-submissions':target.disabled=true;await refreshSubmissions();break;
      case 'review-queue':closeModal();go('reviews');break;
      case 'refresh-reviews':target.disabled=true;await refreshReviews();break;
      case 'review-detail':reviewModal(ui.reviews?.find(item=>item.id===target.dataset.id));break;
      case 'license-open':closeModal();go('license');break;
      case 'merx-sync-save':case 'merx-sync-skip':{const items=action==='merx-sync-skip'?[]:[...document.querySelectorAll('#merx-sync-form input[name=sync]:checked')].map(i=>{const[deviceId,cameraId]=i.value.split('|');return{deviceId,cameraId};});const r=await api('/merx/synced-cameras','PUT',{items});ui.merxAccount={...ui.merxAccount,syncDecided:true,synced:r.synced};ui.merxDevices={...(ui.merxDevices||{}),synced:r.synced};toast(items.length?t('merx.synced',{n:items.length}):t('merx.skipped'));render();break;}
      case 'merx-send-test':{const project=getProject();if(!project)break;target.disabled=true;const spec=buildTestPayload(project,{deviceId:target.dataset.device,cameraId:target.dataset.camera});const body=projectPayload(project,false);body.configuration.targetFps=spec.fps;const r=await api('/merx/tests','POST',{project:body,deviceId:spec.deviceId,cameraId:spec.cameraId,fps:spec.fps});ui.merxTest=r.test;toast(t('merx.queued'));render();break;}
      case 'merx-test-status':{const x=ui.merxTest;if(!x)break;const r=await api(`/merx/tests/${encodeURIComponent(x.deviceId)}/${encodeURIComponent(x.analyticId)}?requestId=${encodeURIComponent(x.requestId)}`);ui.merxTest={...x,device:r.device};render();break;}
      case 'license-checkout':{target.disabled=true;const result=await api('/license/checkout','POST',{});if(result.alreadyActive){ui.license=null;await refreshLicense();toast(result.message||'Você já possui uma licença ativa.');render();}else if(result.checkoutUrl)location.assign(result.checkoutUrl);break;}
      case 'license-refresh':{target.disabled=true;await refreshLicense(true);if(licenseObject()?.active)toast(t('toast.licenseActive'));else toast(t('toast.licenseNotYet'),'warning');break;}
      case 'license-manage':{target.disabled=true;const result=await api('/license/portal','POST',{});if(result.portalUrl)location.assign(result.portalUrl);break;}
      case 'import-anon-drafts':{const anon=loadWorkspace(workspaceKeyFor(null));let added=0;for(const draft of anon.projects){if(!getProject(draft.id)&&!workspaceLimitReached()){workspace.projects.unshift(draft);added++;}}save();closeModal();render();toast(added?`${added} rascunho(s) importado(s) para esta conta neste navegador.`:'Nenhum rascunho novo para importar.');break;}
      case 'account':{const anonDrafts=loadWorkspace(workspaceKeyFor(null)).projects.filter(draft=>!getProject(draft.id));openModal('Seu workspace',`<div class="account-summary"><span class="avatar">${esc((ui.auth.email||'M')[0].toUpperCase())}</span><div><h3>${esc(ui.auth.email)}</h3><p>Conta do Merx Studio</p></div></div><div class="project-option-list">${anonDrafts.length?button(`Importar ${anonDrafts.length} rascunho(s) deste navegador`,'import-anon-drafts','ghost','upload'):''}${getProject()?button('Salvar este projeto na conta','cloud-save','ghost','cloud'):''}${button('Licença do Studio','license-open','ghost','shield')}${button('Carregar projetos da conta','cloud-load','ghost','download')}${isReviewer()?button('Central de revisão','review-queue','ghost','shield'):''}${button('Sair desta conta','logout','ghost','logout')}</div><p class="small-text muted">Os rascunhos locais ficam neste navegador. Sair encerra o acesso aos serviços da conta.</p>`);break;}
      case 'cloud-save':target.disabled=true;if(await cloudSave(project||getProject())){closeModal();render();}target.disabled=false;break;
      case 'resolve-conflict':{target.disabled=true;const result=await api(`/projects/${encodeURIComponent(project.id)}`);const backup=structuredClone(project);backup.id=uid();backup.name=project.name+' — cópia local';delete backup.cloudOwner;delete backup.cloudRevision;delete backup.submission;backup.status='draft';persistProject(backup);persistProject({...result.project,cloudOwner:ui.auth.sub,cloudRevision:result.revision,syncedAt:new Date().toISOString(),localRevision:(project.localRevision||0)+1});closeModal();render();toast('Sua edição foi preservada em uma cópia. Versão da conta carregada.');break;}
      case 'cloud-load':target.disabled=true;await loadCloudProjects();closeModal();break;
      case 'logout':{const old=ui.auth;ui.auth=null;ui.license=null;ui.reviews=null;ui.reviewsError=null;sessionStorage.removeItem('merx.studio.auth');switchWorkspaceForAuth();closeModal();render();if(old?.refreshToken)cog('RevokeToken',{ClientId:ui.config.cognitoClientId,Token:old.refreshToken}).catch(()=>{});toast('Sessão encerrada.');break;}
    }
  }catch(error){toast(error.message||'Não foi possível concluir esta ação.','warning');target.disabled=false;}
});

document.addEventListener('submit',async event=>{
  event.preventDefault();const form=event.target;
  if(!form.reportValidity())return;
  const data=new FormData(form),submit=$('button[type="submit"]',form);if(submit)submit.disabled=true;
  try {
    if(form.id==='hero-form'){newProject(data.get('prompt'));}
    if(form.id==='chat-form'){await sendPrompt(data.get('prompt'));}
    if(form.id==='rename-form'){const project=getProject();checkpoint(project);project.name=String(data.get('name')).trim();touch(project);closeModal();render();toast('Nome atualizado.');}
    if(form.id==='config-form'){
      const project=getProject(),configuration=structuredClone(project.configuration);
      for(const key of ['mode','direction'])configuration[key]=String(data.get(key));
      for(const key of ['minDurationSeconds','cooldownSeconds','minFrames'])configuration[key]=Number(data.get(key));
      configuration.targetFps=clampTargetFps(data.get('targetFps'));
      configuration.confidence=Number(data.get('confidence'))/100;configuration.classNames=data.getAll('classes');
      const presets={full:{x:0,y:0,width:1,height:1},center:{x:.25,y:.15,width:.5,height:.7},left:{x:0,y:0,width:.5,height:1},right:{x:.5,y:0,width:.5,height:1}};
      if(presets[data.get('zonePreset')])configuration.zone=presets[data.get('zonePreset')];
      const validation=validateProject({...project,configuration});if(!validation.valid)throw new Error(validation.errors.join(' '));
      checkpoint(project);project.configuration=configuration;ensureMessages(project).push({id:uid(),role:'assistant',text:'Atualizei o analítico com os ajustes que você fez no painel.',changes:[MODES[configuration.mode],`${configuration.classNames.map(c=>CLASSES[c]).join(', ')} · confiança ${Math.round(configuration.confidence*100)}%`],engine:'local'});const geometry=data.get('zonePreset')&&data.get('zonePreset')!=='current';touch(project,{geometry});stopTest();closeModal();render();toast('Regras atualizadas.');
    }
    if(form.id==='publication-form')await submitPublication(form);
    if(form.id==='review-form'){const candidate=ui.reviews?.find(item=>item.id===form.dataset.id);if(!candidate)throw new Error('Atualize a fila antes de registrar o parecer.');await api(`/reviews/${encodeURIComponent(candidate.id)}`,'POST',{status:String(data.get('status')),notes:String(data.get('notes')),expectedRevision:candidate.reviewRevision,snapshotSha256:candidate.snapshotSha256});closeModal();await refreshReviews();toast('Parecer registrado sobre esta versão da proposta.');}
    if(form.id==='auth-form'){
      const mode=ui.authMode,email=String(data.get('email')||ui.authEmail).trim(),password=String(data.get('password')||''),code=String(data.get('code')||'').trim();ui.authEmail=email;
      if(mode==='signup'){const displayName=String(data.get('name')||'').trim();await cog('SignUp',{ClientId:ui.config.cognitoClientId,Username:email,Password:password,UserAttributes:[{Name:'email',Value:email},...(displayName?[{Name:'name',Value:displayName}]:[])]});loginModal('confirm',email);}
      else if(mode==='confirm'){await cog('ConfirmSignUp',{ClientId:ui.config.cognitoClientId,Username:email,ConfirmationCode:code});loginModal('login',email);toast('E-mail confirmado. Entre com sua senha.');}
      else if(mode==='forgot'){await cog('ForgotPassword',{ClientId:ui.config.cognitoClientId,Username:email});loginModal('reset',email);}
      else if(mode==='reset'){await cog('ConfirmForgotPassword',{ClientId:ui.config.cognitoClientId,Username:email,ConfirmationCode:code,Password:password});loginModal('login',email);toast('Senha atualizada.');}
      else {
        let result;
        try {result=mode==='mfa'?await cog('RespondToAuthChallenge',{ClientId:ui.config.cognitoClientId,ChallengeName:'SOFTWARE_TOKEN_MFA',Session:ui.mfaSession,ChallengeResponses:{USERNAME:email,SOFTWARE_TOKEN_MFA_CODE:code}}):await cog('InitiateAuth',{ClientId:ui.config.cognitoClientId,AuthFlow:'USER_PASSWORD_AUTH',AuthParameters:{USERNAME:email,PASSWORD:password}});}
        catch(error){if(error.code==='UserNotConfirmedException'){loginModal('confirm',email);return;}throw error;}
        if(result.ChallengeName==='SOFTWARE_TOKEN_MFA'){ui.mfaSession=result.Session;loginModal('mfa',email);return;}
        if(!result.AuthenticationResult)throw new Error('Sua conta exige uma etapa de autenticação ainda não suportada nesta versão.');
        acceptAuth(result.AuthenticationResult,email);switchWorkspaceForAuth();ui.license=null;closeModal();const licensePromise=refreshLicense();const projectsPromise=loadCloudProjects({quiet:true}).catch(error=>({error}));await licensePromise;const projectsResult=await projectsPromise;const plan=loginArrival({licenseLoaded:Boolean(ui.license),licenseActive:Boolean(licenseObject()?.active)});if(plan.showLicenseToast){go('license');toast(t('toast.signedInLicense'),'warning');}else toast(t('toast.signedIn'));if(projectsResult?.error)toast(projectsResult.error.message,'warning');
      }
    }
  }catch(error){formError(form,form.id==='auth-form'?authError(error):error.message);}
  finally{if(submit)submit.disabled=false;}
});

document.addEventListener('change',event=>{if(event.target.form?.id==='publication-form')syncPricing(event.target.form);
  if(event.target.form?.id==='config-form'&&event.target.name==='mode'){const field=event.target.form.querySelector('[data-dwell-field]');const input=field?.querySelector('input');const show=showDwellField(event.target.value);if(field)field.hidden=!show;if(input)input.required=show;}
});
document.addEventListener('input',event=>{if(event.target.form?.id==='publication-form')syncPricing(event.target.form);
  const target=event.target;
  if(target.name==='confidence'&&$('#confidence-value'))$('#confidence-value').textContent=target.value+'%';
  if(target.id==='source-editor'&&$('#code-state'))$('#code-state').textContent='Alterações ainda não salvas';
  if(target.id==='project-search'){
    ui.query=target.value;const projects=workspace.projects.filter(p=>`${p.name} ${p.description}`.toLocaleLowerCase('pt').includes(ui.query.toLocaleLowerCase('pt')));
    $('#projects-grid').innerHTML=projects.map(projectCard).join('')||'<div class="empty-state full-width"><h3>Nenhum projeto encontrado.</h3></div>';
  }
  if(target.id==='store-search'){
    ui.query=target.value;const catalog=CATALOG.filter(item=>(ui.storeFilter==='Todos'||item.category===ui.storeFilter)&&`${item.title} ${item.description} ${item.tags.join(' ')}`.toLocaleLowerCase('pt').includes(ui.query.toLocaleLowerCase('pt')));
    $('#catalog-grid').innerHTML=catalog.map(catalogCard).join('')||'<div class="empty-state full-width"><h3>Nenhum conceito encontrado.</h3></div>';
  }
});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&ui.modal){closeModal();return;}
  if(ui.modal&&event.key==='Tab'){
    const controls=$$('button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]',$('.modal'));const first=controls[0],last=controls.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  }
  if(['hero-prompt','chat-prompt'].includes(event.target.id)&&event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();event.target.closest('form').requestSubmit();}
});
$('#project-import').addEventListener('change',async event=>{
  const file=event.target.files[0];event.target.value='';if(!file)return;
  try{if(!requireStudioAccess())return;if(workspaceLimitReached())return;if(file.size>2_000_000)throw new Error('Use um projeto com até 2 MB.');const content=JSON.parse(await file.text());if(content.format!=='merx-studio-project'||content.schemaVersion!==1||!content.project)throw new Error('O arquivo não é um projeto Merx Studio compatível.');const project=content.project;const check=validateProject(project);if(!check.valid)throw new Error(check.errors.join(' '));project.id=uid();project.name=String(project.name).slice(0,120);project.messages=Array.isArray(project.messages)?project.messages.slice(-100).filter(m=>['assistant','user'].includes(m.role)&&typeof m.text==='string').map(m=>({id:uid(),role:m.role,text:m.text.slice(0,8000),engine:'local'})):[];project.status='draft';project.createdAt=project.updatedAt=new Date().toISOString();delete project.submission;delete project.cloudRevision;delete project.syncedAt;persistProject(project);go(`builder/${project.id}`);toast('Projeto importado como um novo rascunho.');}catch(error){toast(error.message,'warning');}
});
$('#video-upload').addEventListener('change',event=>{const file=event.target.files[0];event.target.value='';loadVideoFile(file).catch(error=>toast(error.message,'warning'));});
window.addEventListener('hashchange',()=>{closeModal();render();});
window.addEventListener('pagehide',()=>{stopMedia();save();});
render();
fetch('/config.json',{cache:'no-store'}).then(response=>response.ok?response.json():null).then(async config=>{if(config){ui.config=config;if(ui.auth&&ui.auth.expiresAt<=Date.now()&&ui.auth.refreshToken){try{await refreshAuth();}catch{ui.auth=null;sessionStorage.removeItem('merx.studio.auth');switchWorkspaceForAuth();}}if(ui.auth){queueMicrotask(()=>checkMerxAccount());try{await refreshLicense();}catch{}try{await loadCloudProjects({quiet:true});}catch{}}render();}}).catch(()=>{});
