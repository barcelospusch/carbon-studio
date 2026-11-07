'use strict';
const { app, BrowserWindow, Menu, dialog, ipcMain, protocol, net, shell } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { pathToFileURL } = require('node:url');
const core = require('./core.cjs');
const {compileCarbon} = require('./carbon.cjs');
const {readLayout,applyLayout} = require('./layout.cjs');
const {alignmentEdit} = require('./alignment.cjs');
const {scanProject,projectDocument,inside}=require('./projects.cjs');
const {publicSettings,authorDirective}=require('./preferences.cjs');
const {loadThemes}=require('./themes.cjs');
const {mermaidRenderer}=require('./mermaid.cjs');
const {destination,importProjectItem,downloadImage,projectImage,readProjectImage,relocateImage}=require('./project-files.cjs');
const {checkUpdate,repository}=require('./updates.cjs');
const root = path.resolve(__dirname, '..');
const TEMPLATE = '@title Novo documento\n@author Seu nome\n@date @today\n\n# Introdução\nEscreva suas ideias com **clareza**, *ênfase* e matemática $E = mc^2$.\n\nO Carbon organiza o conteúdo e cuida da composição do documento.\n\n## Uma linguagem para suas ideias\nEdite este documento e clique em Recompilar para atualizar a prévia.\n\n$$\nf(x) = \\frac{\\alpha x^2 + \\beta}{\\sqrt{1 + x^2}}\n$$\n\n# Resultados\n@caption Comparação dos resultados.\n| Método | Amostras | Resultado |\n| --- | --- | --- |\n| Carbon | 120 | **Aprovado** |\n| Referência | 120 | *Comparável* |\n\n# Conclusão\nUm espaço para transformar ideias em documentos bem compostos.\n';
let window, current = { path: null, text: '', savedText: '', fingerprint: null };
let workspace=null, projectSnapshot={entries:[],documents:[]}, active=false, themeStore;
let imagePreview;
let availableUpdate;
const template=()=>TEMPLATE.replace('@author Seu nome',()=>authorDirective(preferences));
function cvTemplate(){
  return [
    '@type cv',
    '@title '+(preferences.defaultAuthor||'Seu nome'),
    '@headline Sua área de atuação',
    ...(preferences.defaultInstitution?['@contact '+preferences.defaultInstitution]:[]),
    '@contact Cidade, País',
    '',
    '# Experiência',
    '@cv-entry[2024 — atual][Cidade] Seu cargo | Organização',
    '- Descreva um resultado concreto do seu trabalho.',
    '',
    '# Formação',
    '@cv-entry[2020 — 2024][Cidade] Curso | Instituição',
    '',
    '# Habilidades',
    '- Suas principais competências',
    '',
  ].join('\n');
}
let preferences = {}, preview = null, busy = false, controller = null, allowClose = false, recoveryTimer;
let cache, settingsFile, recoveryFile, mutation = false;
let persistence = Promise.resolve();
if (process.env.CARBON_STUDIO_DATA_DIR) app.setPath('userData', path.resolve(process.env.CARBON_STUDIO_DATA_DIR));
protocol.registerSchemesAsPrivileged([{ scheme: 'carbon-studio', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);
const dirty = () => active && current.text !== current.savedText;
const send = data => { if (window && !window.isDestroyed()) window.webContents.send('studio:event', data); };
const errorMessage = error => error instanceof Error ? error.message : String(error);
function title() { if (window) window.setTitle(!active?'Carbon Studio':`${dirty() ? '● ' : ''}${current.path ? path.basename(current.path) : 'Sem título.cb'} — Carbon Studio`); }
async function refreshProject(){if(workspace)projectSnapshot=await scanProject(workspace);return projectSnapshot;}
async function state() { return { path: current.path, text: current.text, savedText: current.savedText, dirty: dirty(), active, workspace, documents:projectSnapshot.documents, project:projectSnapshot.entries }; }
async function announce(replaceText = true) { title(); const value = await state(); send({ type: 'document', document: value, replaceText }); return value; }
function persistRecovery() {
  clearTimeout(recoveryTimer);
  const data = dirty() ? JSON.stringify({...current,workspace}) : null;
  persistence = persistence.catch(() => {}).then(async () => {
    if (data) await core.atomicWrite(recoveryFile, data); else await fs.unlink(recoveryFile).catch(() => {});
  }).catch(error => send({ type: 'notice', message: `Não foi possível salvar a recuperação: ${errorMessage(error)}` }));
  return persistence;
}
async function load(file,selectedRoot=workspace) {
  const value = await core.readDocument(file);
  const nextRoot=selectedRoot&&inside(selectedRoot,value.path)?selectedRoot:path.dirname(value.path);
  const scanned=await scanProject(nextRoot);workspace=scanned.root;projectSnapshot=scanned;
  current = { ...value, savedText: value.text }; preview = null;active=true;
  await persistRecovery(); return announce();
}
async function openFolder(folder){
 const scanned=await scanProject(folder);
 if(scanned.documents.length===1)return load(await projectDocument(scanned.root,scanned.documents[0]),scanned.root);
 workspace=scanned.root;projectSnapshot=scanned;
 current={path:null,text:'',savedText:'',fingerprint:null};active=false;preview=null;
 await persistRecovery();return announce();
}
async function save(saveAs = false) {
  if(!active)throw new Error('Abra um documento ou comece do template.');
  let file = current.path;
  if (saveAs || !file) {
    const choice = await dialog.showSaveDialog(window, { title: 'Salvar documento Carbon', defaultPath: file || path.join(workspace||app.getPath('documents'),'documento.cb'), filters: [{ name: 'Documento Carbon', extensions: ['cb'] }] });
    if (choice.canceled || !choice.filePath) return null;
    file = choice.filePath.toLowerCase().endsWith('.cb') ? choice.filePath : choice.filePath + '.cb';
  } else if (await core.fingerprint(file) !== current.fingerprint) {
    const choice = await dialog.showMessageBox(window, { type: 'warning', title: 'Arquivo alterado fora do editor', message: 'Este arquivo mudou em outro aplicativo.', detail: 'Salve uma cópia para manter as duas versões, ou substitua a versão no disco.', buttons: ['Salvar como…', 'Sobrescrever', 'Cancelar'], defaultId: 0, cancelId: 2 });
    if (choice.response === 2) return null;
    if (choice.response === 0) return save(true);
  }
  const text = current.text;
  await core.atomicWrite(file, text);
  current.path = path.resolve(file); current.savedText = text; current.fingerprint = core.hash(Buffer.from(text));
  if(!workspace||!inside(workspace,current.path))workspace=path.dirname(current.path);
  await refreshProject();
  await persistRecovery(); return announce(false);
}
async function confirmDiscard() {
  if (!dirty()) return true;
  const choice = await dialog.showMessageBox(window, { type: 'question', title: 'Alterações não salvas', message: 'Deseja salvar as alterações do documento?', buttons: ['Salvar', 'Descartar alterações', 'Cancelar'], defaultId: 0, cancelId: 2 });
  if (choice.response === 2) return false;
  if (choice.response === 0) return !!await save();
  return true;
}
async function changeDocument(action) {
  if (busy) throw new Error('Aguarde ou cancele a compilação antes de trocar de documento.');
  if (mutation) return null;
  mutation = true;
  try { return await action(); } finally { mutation = false; }
}
function defaults() {
  const bundled = app.isPackaged ? path.join(process.resourcesPath, 'compiler') : path.join(root, 'build');
  return { compiler: process.env.CARBON_STUDIO_COMPILER || path.join(bundled, process.platform === 'win32' ? 'carbon.exe' : 'carbon'),
    tectonic: path.join(bundled, 'tectonic.exe'),
    mermaid: '', node: '', backend: 'latex', paper: 'a4', timeout: 180000, theme:'dark-plus',defaultAuthor:'',defaultInstitution:'' };
}
function sanitizeSettings(value) {
  if (!value || typeof value !== 'object') throw new Error('Preferências inválidas.');
  const output = {};
  for (const key of ['compiler','tectonic','mermaid','node']) {
    if (typeof value[key] !== 'string' || value[key].length > 4096) throw new Error('Caminho de ferramenta inválido.');
    output[key] = value[key].trim();
  }
  output.backend = 'latex'; output.paper = ['a4','letter','legal','a5'].includes(value.paper) ? value.paper : 'a4';
  output.timeout = Math.max(1000, Math.min(600000, Number(value.timeout) || 180000));
  Object.assign(output,publicSettings(value));
  return output;
}
async function compile() {
  if(!active)throw new Error('Abra um documento ou comece do template.');
  if (busy) throw new Error('Já existe uma compilação em andamento.');
  if (mutation) throw new Error('Aguarde a operação atual do documento.');
  if (!current.path && !await save()) return null;
  busy = true; controller = new AbortController();
  const started = Date.now(), source = current.text, documentPath = current.path, options = { ...preferences };
  const renderer=mermaidRenderer(new URL('mermaid.html',process.env.CARBON_STUDIO_DEV_URL||'carbon-studio://app/').href,serveApp);
  let directory;
  send({ type: 'compile-start' });
  try {
    if (!await fs.stat(options.tectonic).then(s => s.isFile()).catch(() => false)) throw new Error('O motor PDF incluído no aplicativo não foi encontrado. Reinstale o Carbon Studio ou prepare o ambiente de desenvolvimento.');
    directory = await fs.mkdtemp(path.join(cache, 'compile-'));
    const snapshot = path.join(directory, 'documento.cb'), output = path.join(directory, 'preview.pdf');
    await fs.writeFile(snapshot, source);
    await compileCarbon(source, { ...options, renderMermaid:renderer.render, base:path.dirname(documentPath), directory, signal:controller.signal, onLog:(stream,text)=>send({type:'compile-log',stream,text}) });
    const bytes = await fs.readFile(output);
    if (!bytes.subarray(0,5).equals(Buffer.from('%PDF-'))) throw new Error('O compilador não produziu um PDF válido.');
    if (bytes.length > 128*1024*1024) throw new Error('O PDF excede o limite de prévia de 128 MiB.');
    const previous = preview;
    preview = { path: output, source, directory, documentPath };
    if (previous) await fs.rm(previous.directory, { recursive: true, force: true }).catch(() => {});
    directory = null;
    const response = { bytes: new Uint8Array(bytes), duration: Date.now()-started, stale: current.text !== source };
    send({ type: 'compile-success', duration: response.duration, stale: response.stale });
    return response;
  } finally {
    renderer.close();
    if (directory) await fs.rm(directory, { recursive: true, force: true }).catch(() => {});
    busy = false; controller = null; send({ type: 'compile-end' });
  }
}
function serveApp(request){
      try {
        const url=new URL(request.url);
        if(url.hostname!=='app')return new Response('Forbidden',{status:403});
        const base=path.resolve(__dirname,'../dist');
        const file=path.resolve(base,'.'+decodeURIComponent(url.pathname));
        if(!file.startsWith(base+path.sep))return new Response('Forbidden',{status:403});
        return net.fetch(pathToFileURL(file).href);
      } catch { return new Response('Not found',{status:404}); }
    }
function trusted(event) {
  if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) throw new Error('Solicitação não autorizada.');
  const url = new URL(event.senderFrame.url);
  if (!(url.protocol === 'carbon-studio:' && url.hostname === 'app') && url.origin !== 'http://127.0.0.1:5173') throw new Error('Origem inválida.');
}
function handle(name, callback) {
  ipcMain.handle(name, async (event, payload) => {
    try { trusted(event); return { ok: true, data: await callback(payload) }; }
    catch (error) { return { ok: false, error: errorMessage(error) }; }
  });
}
function registerIpc() {
  handle('studio:bootstrap', async () => {
    try {
      const recovered = JSON.parse(await fs.readFile(recoveryFile, 'utf8'));
      core.validateSource(recovered.text);
      if (recovered.text !== recovered.savedText) {
        const choice = await dialog.showMessageBox(window, { type:'question', title:'Recuperar documento', message:'Há alterações de uma sessão anterior.', buttons:['Recuperar','Descartar'], defaultId:0 });
        if (choice.response === 0) {
          current = { path: typeof recovered.path === 'string' ? recovered.path : null, text: recovered.text, savedText: typeof recovered.savedText === 'string' ? recovered.savedText : '', fingerprint: typeof recovered.fingerprint === 'string' ? recovered.fingerprint : null };active=true;
          workspace=typeof recovered.workspace==='string'?recovered.workspace:(current.path?path.dirname(current.path):null);
          try{await refreshProject();}catch{workspace=null;projectSnapshot={entries:[],documents:[]};}
        }
        else await fs.unlink(recoveryFile).catch(() => {});
      }
    } catch { /* Missing recovery is normal. */ }
    title(); return { document: await state(), settings:publicSettings(preferences), themes:themeStore.themes, themesDirectory:themeStore.directory, version: app.getVersion(), platform: process.platform };
  });
  handle('studio:new', type => changeDocument(async () => { if (!await confirmDiscard()) return null; current = { path:null, text:type==='cv'?cvTemplate():template(), savedText:'', fingerprint:null };active=true; preview=null; await persistRecovery(); return announce(); }));
  handle('studio:open', () => changeDocument(async () => {
    if (!await confirmDiscard()) return null;
    const choice = await dialog.showOpenDialog(window, { title:'Selecionar pasta Carbon', properties:['openDirectory'] });
    return choice.canceled ? null : openFolder(choice.filePaths[0]);
  }));
  handle('studio:select-document', relative=>changeDocument(async()=>{if(!workspace)throw new Error('Selecione uma pasta primeiro.');if(!await confirmDiscard())return null;return load(await projectDocument(workspace,relative));}));
  handle('studio:refresh-project', async()=>{await refreshProject();return announce(false);});
  handle('studio:project-item', ({kind,folder='',name=''})=>changeDocument(async()=>{
    if(!workspace)throw new Error('Abra uma pasta de projeto primeiro.');
    if(kind==='file'){
      if(!await confirmDiscard())return null;
      const file=await destination(workspace,folder,/\.cb$/i.test(name)?name:name+'.cb');
      await fs.writeFile(file,'',{flag:'wx'});
      return load(file);
    }
    if(kind==='folder')await fs.mkdir(await destination(workspace,folder,name));
    else if(kind==='import-file'||kind==='import-folder'){
      const directory=kind==='import-folder';
      const choice=await dialog.showOpenDialog(window,{title:directory?'Importar pasta':'Importar arquivo',properties:[directory?'openDirectory':'openFile']});
      if(choice.canceled)return null;
      await importProjectItem(workspace,folder,choice.filePaths[0],directory);
    }else throw new Error('Operação de projeto desconhecida.');
    await refreshProject();
    return announce(false);
  }));
  handle('studio:image-preview', async link=>{
    if(!workspace)throw new Error('Abra uma pasta de projeto primeiro.');
    const root=workspace;
    const result=await downloadImage(link);
    imagePreview={...result,link,root};
    return {url:'data:'+result.mime+';base64,'+result.bytes.toString('base64'),extension:result.extension};
  });
  handle('studio:image-import', ({link,folder,name})=>changeDocument(async()=>{
    if(!workspace||imagePreview?.root!==workspace||imagePreview.link!==link)throw new Error('Carregue a prévia da imagem primeiro.');
    const preview=imagePreview;
    const extension=preview.extension;
    const finalName=name.replace(/\.(?:png|jpe?g)$/i,'')+extension;
    await fs.writeFile(await destination(workspace,folder,finalName),preview.bytes,{flag:'wx'});
    imagePreview=null;
    await refreshProject();
    return announce(false);
  }));
  handle('studio:project-image', async ({root,relative})=>{
    if (!workspace || workspace !== root) throw new Error('O projeto foi alterado.');
    return readProjectImage(await projectImage(workspace,relative));
  });
  handle('studio:manage-image', ({root,relative,action,value})=>changeDocument(async()=>{
    if (!workspace || workspace !== root) throw new Error('O projeto foi alterado.');
    const file = await projectImage(workspace,relative);
    let next = null;
    if (action === 'delete') {
      await shell.trashItem(file);
    } else if (action === 'rename' || action === 'move') {
      const extension = path.extname(file);
      if (action === 'rename' && (typeof value !== 'string' || !value.trim())) throw new Error('Informe o novo nome da imagem.');
      const target = action === 'rename'
        ? await relocateImage(workspace,file,path.relative(workspace,path.dirname(file)),value.trim()+extension)
        : await relocateImage(workspace,file,value,path.basename(file));
      next = path.relative(workspace,target).replaceAll('\\','/');
    } else {
      throw new Error('Operação de imagem desconhecida.');
    }
    await refreshProject();
    await announce(false);
    return {relative:next};
  }));
  handle('studio:save', ({saveAs} = {}) => changeDocument(() => save(!!saveAs)));
  ipcMain.on('studio:edit', (event, text) => {
    try { trusted(event); if(!active)return;current.text = core.validateSource(text); title(); clearTimeout(recoveryTimer); recoveryTimer=setTimeout(persistRecovery,750); }
    catch (error) { send({type:'notice',message:errorMessage(error)}); }
  });
  handle('studio:compile', compile);
  handle('studio:cancel', () => { controller?.abort(); return null; });
  handle('studio:export', async () => {
    if (!preview) throw new Error('Compile o documento antes de exportar.');
    const choice = await dialog.showSaveDialog(window, { title:'Exportar PDF', defaultPath:current.path?.replace(/\.cb$/i,'.pdf') || 'documento.pdf', filters:[{name:'Documento PDF',extensions:['pdf']}] });
    if (choice.canceled || !choice.filePath) return null;
    const file = choice.filePath.toLowerCase().endsWith('.pdf') ? choice.filePath : choice.filePath+'.pdf';
    await core.atomicWrite(file, await fs.readFile(preview.path)); return file;
  });
  handle('studio:image', async () => {
    if (!current.path && !await save()) return null;
    const choice = await dialog.showOpenDialog(window, { title:'Inserir figura', filters:[{name:'Imagem ou PDF',extensions:['png','jpg','jpeg','pdf']}], properties:['openFile'] });
    if (choice.canceled) return null;
    const relative = path.relative(path.dirname(current.path),choice.filePaths[0]).replaceAll('\\','/');
    let identifier='fig:imagem', counter=2; while(current.text.includes(identifier)) identifier=`fig:imagem-${counter++}`;
    return `![Descrição da figura](${relative}){#${identifier} width=80%}`;
  });
  handle('studio:settings', () => publicSettings(preferences));
  handle('studio:themes', async()=>{themeStore=await loadThemes(app.isPackaged?path.join(process.resourcesPath,'themes'):path.join(root,'assets/themes'),path.join(app.getPath('userData'),'themes'));return themeStore;});
  handle('studio:repository', ()=>shell.openExternal(repository));
  handle('studio:check-update', async()=> (availableUpdate=await checkUpdate(app.getVersion()))?.version ?? null);
  handle('studio:open-update', ()=>availableUpdate ? shell.openExternal(availableUpdate.url) : null);
  handle('studio:themes-folder', async()=>{const error=await shell.openPath(themeStore.directory);if(error)throw new Error(error);return null;});
  handle('studio:layout', source => readLayout(core.validateSource(source),preferences.paper).layout);
  handle('studio:layout-apply', ({source,layout}) => applyLayout(core.validateSource(source),layout,preferences.paper));
  handle('studio:alignment', ({source,selection,target,mode}) => alignmentEdit(core.validateSource(source),{...selection,target,mode}));
  handle('studio:settings-save', async value => { const next=publicSettings(value,preferences);if(!themeStore.themes.some(theme=>theme.id===next.theme))throw new Error('Tema local não encontrado.');preferences={...preferences,...next};await core.atomicWrite(settingsFile,JSON.stringify(preferences,null,2));return publicSettings(preferences); });
  handle('studio:choose-tool', async () => { const value=await dialog.showOpenDialog(window,{title:'Selecionar ferramenta',properties:['openFile']}); return value.canceled ? null : value.filePaths[0]; });
}
function menu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label:'Arquivo', submenu:[
      { label:'Começar do template',accelerator:'CmdOrCtrl+N',click:()=>send({type:'action',action:'new'}) },
      { label:'Abrir pasta…',accelerator:'CmdOrCtrl+O',click:()=>send({type:'action',action:'open'}) },
      { label:'Salvar',accelerator:'CmdOrCtrl+S',click:()=>send({type:'action',action:'save'}) },
      { label:'Salvar como…',accelerator:'CmdOrCtrl+Shift+S',click:()=>send({type:'action',action:'save-as'}) },
      { type:'separator' }, { label:'Recompilar',accelerator:'CmdOrCtrl+Enter',click:()=>send({type:'action',action:'compile'}) },
      { label:'Exportar PDF…',accelerator:'CmdOrCtrl+Shift+E',click:()=>send({type:'action',action:'export'}) },
      { type:'separator' },{role:'quit',label:'Sair'}
    ]},
    { label:'Editar',submenu:[{role:'undo',label:'Desfazer'},{role:'redo',label:'Refazer'},{type:'separator'},{role:'cut',label:'Recortar'},{role:'copy',label:'Copiar'},{role:'paste',label:'Colar'},{role:'selectAll',label:'Selecionar tudo'}]},
    {label:'Visualizar',submenu:[{role:'togglefullscreen',label:'Tela cheia'}, ...(!app.isPackaged ? [{role:'toggleDevTools',label:'Ferramentas de desenvolvimento'}] : [])]}
  ]));
}
function createWindow() {
  window=new BrowserWindow({width:1500,height:960,minWidth:1060,minHeight:680,title:'Carbon Studio',backgroundColor:themeStore.themes.find(theme=>theme.id===preferences.theme)?.ui.background||'#1e1e1e',show:!process.env.CARBON_STUDIO_E2E,
    icon:path.join(__dirname,'../build/icon.png'),autoHideMenuBar:true,
    webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:false,webviewTag:false}});
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  window.webContents.on('will-navigate',event=>event.preventDefault());
  window.webContents.session.setPermissionRequestHandler((_webContents,_permission,callback)=>callback(false));
  window.on('close',event=>{
    if (allowClose) return; event.preventDefault();
    if (mutation) return;
    mutation=true;
    (async()=>{ try { if (!await confirmDiscard()) return; controller?.abort(); clearTimeout(recoveryTimer); if(dirty()){await persistence; await fs.unlink(recoveryFile).catch(()=>{});}else{await persistRecovery();} allowClose=true; window.close(); } finally { mutation=false; } })().catch(error=>dialog.showErrorBox('Carbon Studio',errorMessage(error)));
  });
  const dev=process.env.CARBON_STUDIO_DEV_URL;
  if (dev) { if (new URL(dev).origin !== 'http://127.0.0.1:5173') throw new Error('URL de desenvolvimento inválida.'); window.loadURL(dev); }
  else window.loadURL('carbon-studio://app/index.html');
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance',async (_event,args)=>{ window?.show(); window?.focus(); const file=args.find(v=>v.toLowerCase().endsWith('.cb')); if (file) await changeDocument(async()=>{if(await confirmDiscard())return load(file);}).catch(error=>dialog.showErrorBox('Carbon Studio',errorMessage(error))); });
  app.whenReady().then(async()=>{
    await fs.mkdir(app.getPath('userData'),{recursive:true});
    cache=await fs.mkdtemp(path.join(os.tmpdir(),'carbon-studio-'));
    settingsFile=path.join(app.getPath('userData'),'settings.json'); recoveryFile=path.join(app.getPath('userData'),'recovery.json');
    preferences=defaults();
    try { preferences=sanitizeSettings({...preferences,...JSON.parse(await fs.readFile(settingsFile,'utf8'))}); } catch { /* Start with defaults. */ }
    themeStore=await loadThemes(app.isPackaged?path.join(process.resourcesPath,'themes'):path.join(root,'assets/themes'),path.join(app.getPath('userData'),'themes'));
    if(!themeStore.themes.some(theme=>theme.id===preferences.theme))preferences.theme=themeStore.themes.find(theme=>theme.id==='dark-plus')?.id||themeStore.themes[0].id;
    protocol.handle('carbon-studio',serveApp);
    const incoming=process.argv.slice(1).find(v=>v.toLowerCase().endsWith('.cb'));
    if(incoming){ const value=await core.readDocument(incoming); current={...value,savedText:value.text};active=true;workspace=path.dirname(value.path);await refreshProject(); }
    registerIpc(); menu(); createWindow();
  }).catch(error=>{ dialog.showErrorBox('Falha ao iniciar Carbon Studio',errorMessage(error)); app.quit(); });
  app.on('window-all-closed',()=>app.quit());
  app.on('will-quit',()=>{ if(cache)fs.rm(cache,{recursive:true,force:true}).catch(()=>{}); });
}
