'use strict';
// Cache only the frontend build. Installer packaging always runs against current files.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');process.chdir(root);
function run(file,args=[]){const result=spawnSync(process.execPath,[file,...args],{cwd:root,stdio:'inherit',windowsHide:true});if(result.status!==0)process.exit(result.status||1);}
function files(directory){return fs.readdirSync(directory,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(entry=>entry.isDirectory()?files(path.join(directory,entry.name)):[path.join(directory,entry.name)]);}
const tracked=[...files('src'),...files('assets'),'LANGUAGE.md','logo.png','index.html','mermaid.html','tsconfig.json','vite.config.mjs','package-lock.json','package.json'];
const hash=crypto.createHash('sha256');for(const file of tracked)hash.update(file).update(fs.readFileSync(file));const fingerprint=hash.digest('hex');
const cache='build/frontend-fingerprint.txt';
run('node_modules/typescript/bin/tsc',['--noEmit']);
if(!fs.existsSync('dist/index.html')||!fs.existsSync('dist/mermaid.html')||!fs.existsSync(cache)||fs.readFileSync(cache,'utf8')!==fingerprint){
 run('node_modules/vite/bin/vite.js',['build']);fs.mkdirSync('build',{recursive:true});fs.writeFileSync(cache,fingerprint);
}else console.log('Interface inalterada: reutilizando dist validado.');
run('scripts/prepare-compiler.cjs');
const iconReady=['build/icon.png','build/icon.ico'].every(file=>fs.existsSync(file)&&fs.statSync(file).mtimeMs>=Math.max(fs.statSync('logo.png').mtimeMs,fs.statSync('scripts/create-icon.cjs').mtimeMs));
if(!iconReady){const result=spawnSync(require('electron'),['scripts/create-icon.cjs'],{cwd:root,stdio:'inherit',windowsHide:true});if(result.status!==0)process.exit(result.status||1);}else console.log('Ícone Windows inalterado: reutilizado.');
run('node_modules/electron-builder/out/cli/cli.js',['--win',...(process.argv.includes('--dir')?['dir']:['nsis','portable']),'--x64','--publish','never']);
