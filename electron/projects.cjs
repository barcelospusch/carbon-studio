'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const IGNORED=new Set(['node_modules','target','dist','release','build','profile','profiles']);
function inside(root,file){const relative=path.relative(root,file);return relative===''||(!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative));}
async function scanProject(folder){
 const root=await fs.realpath(folder),stat=await fs.stat(root);
 if(!stat.isDirectory())throw new Error('Selecione uma pasta de projeto.');
 const entries=[],documents=[];let visited=0;
 async function walk(directory,depth){
  if(depth>32)throw new Error('O projeto excede 32 níveis de pastas. Selecione uma pasta mais específica.');
  for(const entry of (await fs.readdir(directory,{withFileTypes:true})).sort((a,b)=>Number(b.isDirectory())-Number(a.isDirectory())||a.name.localeCompare(b.name,'pt-BR',{numeric:true}))){
   if(entry.name.startsWith('.')||IGNORED.has(entry.name)||entry.isSymbolicLink())continue;
   if(++visited>10000)throw new Error('A pasta contém mais de 10.000 itens. Selecione uma pasta de documentos mais específica.');
   const file=path.join(directory,entry.name),name=path.relative(root,file).replaceAll('\\','/');
   if(entry.isDirectory()){entries.push({name,kind:'folder'});await walk(file,depth+1);}
   else if(entry.isFile()){
    const kind=path.extname(entry.name).slice(1).toLowerCase()||'file';
    entries.push({name,kind});
    if(kind==='cb')documents.push(name);
   }
  }
 }
 await walk(root,0);return {root,entries,documents};
}
async function projectDocument(root,relative){
 if(typeof relative!=='string'||path.isAbsolute(relative)||path.extname(relative).toLowerCase()!=='.cb')throw new Error('Selecione um arquivo Carbon do projeto.');
 const file=await fs.realpath(path.resolve(root,relative));
 if(!inside(root,file))throw new Error('O documento está fora da pasta do projeto.');
 return file;
}
module.exports={scanProject,projectDocument,inside};
