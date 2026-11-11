'use strict';
const {parentPort,workerData}=require('node:worker_threads');
const {transpile}=require('./carbon.cjs');
let sequence=0;const pending=new Map();
parentPort.on('message',message=>{const task=pending.get(message.id);if(!task)return;pending.delete(message.id);Object.hasOwn(message,'error')?task.reject(new Error(String(message.error||'Falha ao carregar recurso.'))):task.resolve();});
transpile(workerData.source,{
  ...workerData.options,
  onLog:(stream,text)=>parentPort.postMessage({type:'log',stream,text}),
  validateAsset:(file,extension,page)=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});parentPort.postMessage({type:'asset',id,file,extension,page});}),
  renderMermaid:(source,output)=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});parentPort.postMessage({type:'mermaid',id,source,output});}),
}).then(result=>parentPort.postMessage({type:'result',result}),error=>parentPort.postMessage({type:'error',message:error.message,diagnostics:error.diagnostics}));
