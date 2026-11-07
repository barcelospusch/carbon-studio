'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const engine=path.resolve(__dirname,'../build/tectonic.exe');
if(!fs.existsSync(engine)){const run=spawnSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'install-tectonic.ps1')],{stdio:'inherit',windowsHide:true});if(run.status!==0)throw new Error('Não foi possível preparar Tectonic.');}
const run=spawnSync(engine,['--version'],{stdio:'inherit',windowsHide:true});if(run.status!==0)throw new Error('Tectonic não executou.');
