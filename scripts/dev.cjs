'use strict';
const {spawn}=require('node:child_process');const path=require('node:path');
const cwd=path.resolve(__dirname,'..');
(async()=>{
 const {createServer}=await import('vite');const server=await createServer({root:cwd});await server.listen();
 const electron=require('electron');const child=spawn(electron,[cwd],{cwd,stdio:'inherit',env:{...process.env,CARBON_STUDIO_DEV_URL:'http://127.0.0.1:5173'}});
 child.on('exit',async code=>{await server.close();process.exit(code??0);});
 process.on('SIGINT',()=>child.kill());
})().catch(error=>{console.error(error);process.exitCode=1;});
