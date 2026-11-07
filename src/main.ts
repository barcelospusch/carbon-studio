import './api';
import './style.css';
import './theme.css';
import {applyStudioTheme} from './themes';
import {installStartScreen} from './start-screen';
import {createEditor,monaco} from './editor';
import {PdfPreview} from './pdf';
import {icon} from './icons';
import './monaco-icons';
import {installLayoutPanel} from './layout-panel';
import {installTextPanel} from './text-panel';
import type {DocumentState,Settings,Result,CompileResult,StudioTheme} from './api';
const api=window.carbonStudio;
const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const button=(id:string,label:string,symbol:string,css='')=>`<button id="${id}" class="${css}" title="${label}" aria-label="${label}">${icon(symbol)}<span>${label}</span></button>`;
$('app').innerHTML=`
<header class="topbar"><div class="brand"><img class="brand-logo" src="./logo.png" alt="Carbon Studio"/><span>carbon<span class="brand-light">studio</span></span></div><div class="document-heading"><span id="header-name">Sem título.cb</span><span id="save-label" class="save-label">Novo documento</span></div><div class="top-actions">${button('open','Abrir pasta','folder','top-button')}${button('save','Salvar','save','top-button')}${button('preferences','Preferências','settings','icon-only top-button')}</div></header>
<div class="app-body"><aside class="sidebar"><div class="workspace-label">ESPAÇO DE TRABALHO<button id="new" class="icon-only subtle" title="Começar do template" aria-label="Começar do template">${icon('plus')}</button></div><div class="project-title">${icon('folder')}<span id="project-name">Meu documento</span></div><div id="project-tree" class="project-tree"></div><div class="sidebar-section"><span>INSERIR NO DOCUMENTO</span><button data-snippet="heading">${icon('heading')}Título de seção</button><button data-snippet="math">${icon('math')}Equação</button><button id="insert-image">${icon('image')}Figura</button><button data-snippet="table">${icon('table')}Tabela</button><button data-snippet="mermaid">${icon('mermaid')}Diagrama Mermaid</button></div><div class="sidebar-bottom"><div class="workspace-tip"><span class="tip-icon">${icon('book')}</span><strong>Da ideia ao artigo.</strong><p>Escreva em Carbon.<br>Veja seu documento ganhar forma.</p><button id="syntax-help">Guia de sintaxe ${icon('arrowRight')}</button></div><div class="version"><span>CARBON STUDIO</span><span id="version">0.2.0</span><a id="repository-link" class="repository-link" href="https://github.com/barcelospusch/carbon-studio">${icon('github')}GitHub</a></div></div></aside>
<main class="workspace show-start"><div class="workspace-toolbar"><div class="view-label">${icon('split')}Editor & prévia<span class="pill">.cb</span></div><div class="compile-actions"><span id="compile-status" class="compile-status"><i></i>Pronto para compilar</span>${button('compile','Recompilar','play','primary')}<button id="cancel" class="cancel hidden">${icon('stop')}Cancelar</button>${button('export','Exportar PDF','download','export-button')}</div></div>
<div class="panels" id="panels"><section class="editor-panel"><div class="panel-header editor-tab"><span>${icon('file')}<strong id="tab-name">Sem título.cb</strong><i id="dirty-dot" class="dirty-dot hidden"></i></span><span class="editor-language">CARBON</span></div><div class="editor-tools"><span class="breadcrumbs" id="breadcrumbs">documento / sem-título.cb</span><div><button id="bold" title="Negrito" aria-label="Negrito">${icon('bold')}</button><button id="italic" title="Itálico" aria-label="Itálico">${icon('italic')}</button><span class="tools-divider"></span><button id="find" title="Buscar no documento" aria-label="Buscar no documento">Buscar <kbd>Ctrl F</kbd></button></div></div><div id="editor" class="code-editor"></div><div class="editor-footer"><span id="cursor-position">Ln 1, Col 1</span><span id="word-count">0 palavras</span><span>UTF-8</span><span>Carbon</span></div></section>
<div id="divider" class="divider" role="separator" tabindex="0" aria-label="Ajustar largura do editor" aria-orientation="vertical"></div>
<section class="preview-panel"><div class="panel-header preview-tab"><span>${icon('file')}<strong>Prévia do documento</strong></span><span class="pdf-badge">PDF</span></div><div class="preview-tools"><div class="page-navigation"><button id="previous-page" class="icon-only" title="Página anterior" aria-label="Página anterior">${icon('arrowLeft')}</button><span><input id="page-number" type="number" min="1" value="1" aria-label="Número da página"/> <span id="page-total">/ —</span></span><button id="next-page" class="icon-only" title="Próxima página" aria-label="Próxima página">${icon('arrowRight')}</button></div><select id="zoom" aria-label="Zoom do PDF"><option value="fit">Ajustar à largura</option><option value="0.75">75%</option><option value="1">100%</option><option value="1.25">125%</option><option value="1.5">150%</option></select></div><div id="stale-banner" class="stale-banner hidden">${icon('clock')}A prévia mostra uma versão anterior. Recompile para atualizar.</div><div id="pdf-host" class="pdf-host"></div><div id="empty-preview" class="empty-preview"><div class="empty-paper"><span></span><b></b><i></i><i></i><i></i><em>α + β = γ</em><i></i><i></i></div><h1>Seu próximo artigo<br>começa aqui.</h1><p>Edite o código à esquerda e recompile<br>para visualizar seu PDF neste espaço.</p><button id="empty-compile">${icon('play')}Compilar documento <kbd>Ctrl ↵</kbd></button><span class="empty-footnote">Tipografia acadêmica. Foco nas suas ideias.</span></div><div id="preview-loading" class="preview-loading hidden"><div class="spinner"></div><strong>Compondo seu documento</strong><span id="loading-detail">Na primeira execução, o motor pode preparar fontes e pacotes.</span></div></section></div>
<section id="diagnostics" class="diagnostics hidden"><header><span>${icon('terminal')}Saída da compilação</span><button id="close-diagnostics" class="icon-only" title="Fechar saída" aria-label="Fechar saída">${icon('close')}</button></header><pre id="log-output" tabindex="0"></pre></section>
<footer class="workspace-statusbar"><button id="toggle-diagnostics">${icon('terminal')}Saída <span id="error-count"></span></button><span id="document-location">Documento local</span><span id="last-compile">Nenhuma compilação ainda</span></footer></main></div><div id="toast" class="toast hidden" role="status"></div>
<dialog id="settings-dialog"><form id="settings-form"><header><div><small>ESTE DISPOSITIVO</small><h2>Preferências</h2></div><button type="button" id="close-settings" class="icon-only" aria-label="Fechar preferências">${icon('close')}</button></header><p class="dialog-intro">Personalize seu ambiente e os dados usados ao começar um documento do template.</p><label><span class="label-heading">${icon('theme')}Tema</span><select name="theme" id="theme-select"></select></label><p class="theme-description">Definições salvas localmente neste dispositivo. Edite os arquivos JSON para personalizar suas cores.</p><button type="button" id="open-themes-folder">Abrir pasta dos temas</button><p id="themes-location" class="themes-location"></p><label>Papel padrão<select name="paper"><option value="a4">A4</option><option value="letter">Letter</option><option value="legal">Legal</option><option value="a5">A5</option></select></label><label>Autor padrão<input name="defaultAuthor" maxlength="300" placeholder="Seu nome"/></label><label>Instituição do autor padrão<input name="defaultInstitution" maxlength="300" placeholder="Universidade ou instituição"/></label><p id="settings-error" class="form-error" role="alert"></p><footer><button type="button" id="cancel-settings">Cancelar</button><button type="submit" class="primary">Salvar preferências</button></footer></form></dialog>
<dialog id="help-dialog"><header><div><small>REFERÊNCIA RÁPIDA</small><h2>Escreva em Carbon</h2></div><button id="close-help" class="icon-only" aria-label="Fechar guia">${icon('close')}</button></header><div class="syntax-grid"><code>@title Título<br>@author Autor<br>@date Novembro de 2026</code><p>Metadados vêm antes do conteúdo.</p><code>@type article ou report<br>@toc[title="Conteúdo"]<br># Seção<br>## Subseção<br>### Tópico</code><p>Artigo ou relatório com capa, sumário e três níveis de títulos.</p><code>**negrito** · *itálico*<br>$E = mc^2$<br>$$\frac{α}{β}$$</code><p>Formatação e matemática TeX/AMS.</p><code>@align(center)[<br>Texto centralizado.<br>]<br>@align(right)[Uma célula]</code><p>Use Alinhamento de texto para blocos, colunas e células. Nas tabelas: :---, :---:, ---: e :---=.</p><code>![Legenda](figuras/imagem.png)<br>{#fig:exemplo width=80%}</code><p>Escreva imagem e atributos na mesma linha.<br>Referencie com @ref(fig:exemplo).</p><code>@newpage<br>{#fig:exemplo pos=[here]}<br>pos=[override, top]</code><p>Quebra manual e posicionamento de elementos.<br>Use Layout do documento para margens, papel e tipografia.</p></div><p class="dialog-intro">Ctrl+S salva · Ctrl+Enter recompila · Ctrl+Shift+E exporta o PDF.<br>Figuras são resolvidas pela pasta do documento. A prévia usa o conteúdo atual do editor, mesmo antes de salvar alterações.</p></dialog>
`;
const editor=createEditor($('editor'));
let current:DocumentState|null=null,settings:Settings,busy=false,applying=false,pages=0,lastCompiled:string|null=null;
const preview=new PdfPreview($('pdf-host'),count=>{pages=count;$('page-total').textContent=`/ ${count||'—'}`;($('page-number') as HTMLInputElement).max=String(count||1);});
function toast(message:string){$('toast').textContent=message;$('toast').classList.remove('hidden');setTimeout(()=>$('toast').classList.add('hidden'),4500);}
installLayoutPanel(editor,toast);
installTextPanel(editor,toast);
let themes:StudioTheme[]=[];
const renderStart=installStartScreen({open:()=>void safe(()=>action('open')),template:()=>void safe(()=>action('new')),select:relative=>void selectDocument(relative),refresh:()=>void safe(async()=>applyDocument(unwrap(await api.refreshProject()),false))});
function text(){return editor.getValue();}
function unwrap<T>(value:Result<T>):T{if(!value.ok)throw new Error(value.error);return value.data;}
async function safe(action:()=>Promise<unknown>){try{await action();}catch(error){toast(error instanceof Error?error.message:String(error));}}
function name(file:string|null){return file?.split(/[\\/]/).pop()??'Sem título.cb';}
function updateStatus(){
  if(!current)return;const dirty=current.active!==false&&text()!==current.savedText;
  $('dirty-dot').classList.toggle('hidden',!dirty);$('save-label').textContent=current.active===false?'Selecione uma pasta':dirty?'Alterações não salvas':current.path?'Salvo no computador':'Novo documento';
  $('save-label').classList.toggle('is-dirty',dirty);
  const stale=lastCompiled!==null&&text()!==lastCompiled;$('stale-banner').classList.toggle('hidden',!stale);
  $('word-count').textContent=`${text().trim()?text().trim().split(/\s+/u).length:0} palavras`;
}
async function selectDocument(relative:string){await safe(async()=>{const doc=unwrap(await api.selectDocument(relative));if(doc)applyDocument(doc);});}
function project(doc:DocumentState){
 $('project-name').textContent=doc.workspace?.split(/[\\/]/).pop()??'Nenhuma pasta selecionada';const tree=$('project-tree');tree.replaceChildren();
 const relative=doc.path&&doc.workspace?doc.path.replaceAll('\\','/').slice(doc.workspace.replaceAll('\\','/').length+1):null;
 for(const entry of doc.project){
  const row=document.createElement(entry.kind==='cb'?'button':'div');row.className='tree-row'+(entry.name===relative?' active':'');row.style.paddingLeft=`${14+Math.min(entry.name.split(/[\\/]/).length-1,5)*12}px`;
  const symbol=document.createElement('span');symbol.innerHTML=icon(entry.kind==='folder'?'folder':entry.kind==='cb'?'file':'image');const label=document.createElement('span');label.textContent=entry.name.split(/[\\/]/).pop()??entry.name;row.title=entry.name;row.append(symbol,label);tree.append(row);if(entry.kind==='cb')row.onclick=()=>void selectDocument(entry.name);
 }
}
function availability(){
 const active=!!current&&current.active!==false;
 for(const id of ['save','compile','empty-compile','bold','italic','find','document-layout','insert-page-break','element-position','text-alignment','insert-image'])($(id) as HTMLButtonElement).disabled=busy||!active;
 for(const button of document.querySelectorAll<HTMLButtonElement>('[data-snippet]'))button.disabled=busy||!active;
 for(const id of ['new','open','preferences'])($(id) as HTMLButtonElement).disabled=busy;
 ($('export') as HTMLButtonElement).disabled=busy||!active||lastCompiled===null;
}
function applyDocument(doc:DocumentState,replaceText=true){
  const same=current?.path===doc.path&&text()===doc.text;
  const changedFile=current?.path!==doc.path||current?.active!==doc.active;
  current=replaceText?doc:{...doc,text:text()};
  if(!same&&replaceText){applying=true;editor.setValue(doc.text);applying=false;editor.setPosition({lineNumber:1,column:1});}
  for(const id of ['header-name','tab-name'])$(id).textContent=doc.active===false?'Carbon Studio':name(doc.path);
  $('breadcrumbs').textContent=doc.path?`${doc.path.split(/[\\/]/).slice(-2).join(' / ')}`:'documento / sem-título.cb';
  $('document-location').textContent=doc.path?doc.path.split(/[\\/]/).slice(-2).join(' / '):'Documento local · ainda não salvo';$('document-location').title=doc.path??'';
  if(changedFile){lastCompiled=null;void preview.clear();$('empty-preview').classList.remove('hidden');($('export') as HTMLButtonElement).disabled=true;}
  project(doc);renderStart(doc);updateStatus();availability();
}
function status(label:string,kind='ready'){$('compile-status').className=`compile-status ${kind}`;const dot=document.createElement('i');$('compile-status').replaceChildren(dot,document.createTextNode(label));}
function setBusy(value:boolean){busy=value;$('cancel').classList.toggle('hidden',!value);$('preview-loading').classList.toggle('hidden',!value);availability();}
function log(message:string){const area=$('log-output');area.textContent=(area.textContent+message).slice(-262144);area.scrollTop=area.scrollHeight;}
async function compile(){
  if(busy||!current||current.active===false)return;api.updateText(text());const snapshot=text();setBusy(true);$('log-output').textContent='';$('error-count').textContent='';status('Compilando…','compiling');
  try{
    const result=unwrap(await api.compile());if(!result){status('Compilação cancelada');return;}
    $('empty-preview').classList.add('hidden');await preview.load(result.bytes);
    lastCompiled=snapshot;updateStatus();($('export') as HTMLButtonElement).disabled=false;
    const duration=(result.duration/1000).toFixed(1).replace('.',',');status(`PDF atualizado · ${duration} s`,'success');$('last-compile').textContent=`${pages} ${pages===1?'página':'páginas'} · última compilação ${new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}`;
    $('diagnostics').classList.add('hidden');
  }catch(error){const message=error instanceof Error?error.message:String(error);log('\n'+message+'\n');$('diagnostics').classList.remove('hidden');$('error-count').textContent='1';status(message.includes('cancelada')?'Compilação cancelada':'Falha na compilação','error');}
  finally{setBusy(false);}
}
async function action(id:string){
  switch(id){
    case'new':{const doc=unwrap(await api.newDocument());if(doc)applyDocument(doc);break;}
    case'open':{const doc=unwrap(await api.openDocument());if(doc)applyDocument(doc);break;}
    case'save':case'save-as':{api.updateText(text());const doc=unwrap(await api.saveDocument(id==='save-as'));if(doc){applyDocument(doc,false);toast('Documento salvo.');}break;}
    case'compile':await compile();break;
    case'export':{const path=unwrap(await api.exportPdf());if(path)toast('PDF exportado.');break;}
  }
}
for(const id of ['new','open','save','compile','export'])$(id).addEventListener('click',()=>void safe(()=>action(id)));
$('empty-compile').onclick=()=>void compile();$('cancel').onclick=()=>void safe(()=>api.cancelCompile());
($('export') as HTMLButtonElement).disabled=true;
editor.onDidChangeModelContent(()=>{if(applying)return;api.updateText(text());updateStatus();});
editor.onDidChangeCursorPosition(event=>{$('cursor-position').textContent=`Ln ${event.position.lineNumber}, Col ${event.position.column}`;});
function insert(value:string){const selection=editor.getSelection();if(!selection)return;editor.executeEdits('carbon-studio',[{range:selection,text:value,forceMoveMarkers:true}]);editor.focus();}
function wrap(marker:string){const selected=editor.getModel()?.getValueInRange(editor.getSelection()!)??'';insert(`${marker}${selected||'texto'}${marker}`);}
$('bold').onclick=()=>wrap('**');$('italic').onclick=()=>wrap('*');$('find').onclick=()=>{editor.focus();void editor.getAction('actions.find')?.run();};
const snippets:Record<string,string>={heading:'\n# Nova seção\n',math:'\n$$\nf(x) = \\frac{\\alpha x + \\beta}{\\sqrt{1+x^2}}\n$$\n',table:'\n@caption Descrição da tabela.\n| Coluna A | Coluna B |\n| --- | --- |\n| Valor | Resultado |\n',mermaid:'\n@caption Fluxo de processamento.\n```mermaid {#fig:fluxo width=90%}\nflowchart LR\n    A[Entrada] --> B[Processamento]\n    B --> C[Resultado]\n```\n\nVeja a Figura @ref(fig:fluxo).\n'};
for(const button of document.querySelectorAll<HTMLButtonElement>('[data-snippet]'))button.onclick=()=>insert(snippets[button.dataset.snippet!]);
$('insert-image').onclick=()=>void safe(async()=>{const value=unwrap(await api.chooseImage());if(value)insert('\n'+value+'\n');});
$('toggle-diagnostics').onclick=()=>$('diagnostics').classList.toggle('hidden');$('close-diagnostics').onclick=()=>$('diagnostics').classList.add('hidden');
const pageInput=$<HTMLInputElement>('page-number');pageInput.onchange=()=>preview.goTo(Number(pageInput.value));
$('previous-page').onclick=()=>preview.goTo(preview.currentPage()-1);$('next-page').onclick=()=>preview.goTo(preview.currentPage()+1);
$('pdf-host').onscroll=()=>{pageInput.value=String(preview.currentPage());};
$<HTMLSelectElement>('zoom').onchange=()=>void safe(()=>preview.setZoom($<HTMLSelectElement>('zoom').value==='fit'?null:Number($<HTMLSelectElement>('zoom').value)));
let resizeTimer:ReturnType<typeof setTimeout>;new ResizeObserver(()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>void safe(()=>preview.render()),200);}).observe($('preview-panel')??document.querySelector('.preview-panel')!);
const divider=$('divider');divider.onpointerdown=event=>{divider.setPointerCapture(event.pointerId);document.body.classList.add('resizing');};divider.onpointermove=event=>{if(!divider.hasPointerCapture(event.pointerId))return;const box=$('panels').getBoundingClientRect();const pct=Math.max(30,Math.min(70,(event.clientX-box.left)/box.width*100));$('panels').style.setProperty('--editor-width',`${pct}%`);};divider.onpointerup=event=>{divider.releasePointerCapture(event.pointerId);document.body.classList.remove('resizing');};divider.onkeydown=event=>{if(event.key!=='ArrowLeft'&&event.key!=='ArrowRight')return;const currentWidth=parseFloat($('panels').style.getPropertyValue('--editor-width')||'50');$('panels').style.setProperty('--editor-width',`${Math.max(30,Math.min(70,currentWidth+(event.key==='ArrowLeft'?-2:2)))}%`);};
const settingsDialog=$<HTMLDialogElement>('settings-dialog');const settingsForm=$<HTMLFormElement>('settings-form');
function settingsField(name:string){return settingsForm.elements.namedItem(name) as HTMLInputElement|HTMLSelectElement;}
function applySelectedTheme(id:string){const theme=themes.find(theme=>theme.id===id)||themes[0];if(theme)applyStudioTheme(theme);}
function themeOptions(){const select=settingsField('theme') as HTMLSelectElement;select.replaceChildren(...themes.map(theme=>new Option(theme.label,theme.id)));}
$('preferences').onclick=()=>void safe(async()=>{settings=unwrap(await api.getSettings());const stored=unwrap(await api.getThemes());themes=stored.themes;themeOptions();$('themes-location').textContent=stored.directory;for(const[key,value]of Object.entries(settings))settingsField(key).value=String(value);$('settings-error').textContent=stored.errors.length?'Alguns temas locais não puderam ser carregados. Confira os arquivos JSON.':'';settingsDialog.showModal();});
for(const id of ['close-settings','cancel-settings'])$(id).onclick=()=>{applySelectedTheme(settings.theme);settingsDialog.close();};
settingsDialog.addEventListener('cancel',()=>applySelectedTheme(settings.theme));settingsField('theme').addEventListener('change',()=>applySelectedTheme(settingsField('theme').value));
$('open-themes-folder').onclick=()=>void safe(()=>api.openThemesFolder());$('repository-link').onclick=event=>{event.preventDefault();void safe(()=>api.openRepository());};
settingsForm.onsubmit=event=>{event.preventDefault();$('settings-error').textContent='';void(async()=>{try{const data=Object.fromEntries(new FormData(settingsForm)) as unknown as Settings;settings=unwrap(await api.saveSettings(data));applySelectedTheme(settings.theme);settingsDialog.close();toast('Preferências salvas neste dispositivo.');}catch(error){$('settings-error').textContent=error instanceof Error?error.message:String(error);}})();};
const help=$<HTMLDialogElement>('help-dialog');$('syntax-help').onclick=()=>help.showModal();$('close-help').onclick=()=>help.close();
api.onEvent(event=>{
  if(event.type==='document'&&event.document)applyDocument(event.document,event.replaceText!==false);
  else if(event.type==='action'&&event.action)void safe(()=>action(event.action!));
  else if(event.type==='notice'&&event.message)toast(event.message);
  else if(event.type==='compile-log'&&event.text)log(event.text);
});
editor.addCommand(monaco.KeyMod.CtrlCmd|monaco.KeyCode.Enter,()=>void compile());
void safe(async()=>{if(!api)throw new Error('Abra este editor pelo aplicativo Carbon Studio.');const result=unwrap(await api.bootstrap());settings=result.settings;themes=result.themes;applySelectedTheme(settings.theme);applyDocument(result.document);$('version').textContent=result.version;if(result.document.active)editor.focus();else $('start-open').focus();});
