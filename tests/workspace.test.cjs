'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {scanProject,projectDocument}=require('../electron/projects.cjs');
const {publicSettings,authorDirective}=require('../electron/preferences.cjs');
const {loadThemes,validateTheme}=require('../electron/themes.cjs');
async function temporary(t){const folder=await fs.mkdtemp(path.join(os.tmpdir(),'carbon-project-'));t.after(()=>fs.rm(folder,{recursive:true,force:true}));return folder;}
test('projects list nested Carbon files and ignore generated files',async t=>{
 const root=await temporary(t);await fs.mkdir(path.join(root,'capitulos'));await fs.mkdir(path.join(root,'node_modules'));await fs.mkdir(path.join(root,'.git'));
 await fs.writeFile(path.join(root,'artigo.cb'),'# Artigo');await fs.writeFile(path.join(root,'capitulos','outro.CB'),'# Outro');await fs.writeFile(path.join(root,'node_modules','oculto.cb'),'');await fs.writeFile(path.join(root,'.git','interno.cb'),'');
 const project=await scanProject(root);assert.deepEqual(project.documents,['capitulos/outro.CB','artigo.cb']);assert.equal(await projectDocument(project.root,'artigo.cb'),path.join(project.root,'artigo.cb'));assert.ok(project.entries.some(entry=>entry.kind==='folder'));
 await assert.rejects(scanProject(path.join(root,'artigo.cb')),/pasta/);
});
test('project selection cannot escape the opened folder',async t=>{
 const directory=await temporary(t),root=path.join(directory,'projeto');await fs.mkdir(root);await fs.writeFile(path.join(directory,'fora.cb'),'# Fora');
 await assert.rejects(projectDocument(root,'../fora.cb'),/fora da pasta/);await assert.rejects(projectDocument(root,path.join(directory,'fora.cb')),/Selecione/);
 assert.deepEqual((await scanProject(root)).documents,[]);
});
test('default author and institution generate linked Carbon metadata',()=>{
 const settings=publicSettings({paper:'a5',theme:'dracula',defaultAuthor:' Ana Silva ',defaultInstitution:' Instituto Carbon '});assert.equal(authorDirective(settings),'@author [Ana Silva]{Instituto Carbon}');
 assert.equal(authorDirective(publicSettings({defaultAuthor:'Ana'})),'@author Ana');assert.equal(authorDirective(publicSettings({})),'@author Seu nome');
 assert.throws(()=>publicSettings({defaultAuthor:'Ana\n@title Outro'}),/única linha/);assert.throws(()=>publicSettings({defaultInstitution:'{Instituto}'}),/colchetes/);
 assert.deepEqual(Object.keys(settings).sort(),['defaultAuthor','defaultInstitution','paper','theme']);
});
test('public settings preserve unspecified values and do not expose tool paths',()=>{
 const settings=publicSettings({paper:'legal'},{paper:'a4',theme:'monokai',defaultAuthor:'Autor',defaultInstitution:'Instituto',tectonic:'private-engine.exe'});
 assert.equal(settings.theme,'monokai');assert.equal(settings.defaultAuthor,'Autor');assert.equal(settings.paper,'legal');assert.equal(settings.tectonic,undefined);
 assert.throws(()=>publicSettings({theme:'../invalid'}),/Tema inválido/);
});
test('theme definitions are saved locally and user edits survive startup',async t=>{
 const folder=await temporary(t),bundled=path.resolve(__dirname,'../assets/themes');let store=await loadThemes(bundled,folder);assert.equal(store.themes.length,7);assert.deepEqual(store.errors,[]);
 const theme=store.themes.find(theme=>theme.id==='dracula');theme.ui.accent='#abcdef';await fs.writeFile(path.join(folder,'dracula.json'),JSON.stringify(theme));
 await fs.writeFile(path.join(folder,'invalid.json'),'{ invalid');store=await loadThemes(bundled,folder);assert.equal(store.themes.find(theme=>theme.id==='dracula').ui.accent,'#abcdef');assert.equal(store.errors.length,1);assert.equal(store.themes.length,7);
});
test('theme validation rejects non-colors and invalid editor data',async t=>{
 const theme=JSON.parse(await fs.readFile(path.resolve(__dirname,'../assets/themes/dark-plus.json'),'utf8'));theme.ui.background='url(https://invalid)';assert.throws(()=>validateTheme(theme),/Cor inválida/);
});
