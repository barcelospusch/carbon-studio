'use strict';
const {Worker}=require('node:worker_threads');
function isolatedTranspile(source,options){
  return new Promise((resolve,reject)=>{
    if(options.signal?.aborted)return reject(new Error('Compilação cancelada.'));
    const {signal,onLog,renderMermaid,validateAsset,isolate,...serializable}=options;
    const worker=new Worker(require.resolve('./transpile-worker.cjs'),{workerData:{source,options:serializable}});
    let settled=false;
    const finish=(error,result)=>{if(settled)return;settled=true;signal?.removeEventListener('abort',abort);void worker.terminate();error?reject(error):resolve(result);};
    const abort=()=>finish(new Error('Compilação cancelada.'));signal?.addEventListener('abort',abort,{once:true});
    worker.on('error',error=>finish(error));worker.on('exit',code=>{if(!settled)finish(new Error('O processo de transpilação foi encerrado (código '+code+').'));});
    worker.on('message',async message=>{
      if(message.type==='result')finish(null,message.result);
      else if(message.type==='error'){const error=new Error(message.message);error.diagnostics=message.diagnostics;finish(error);}
      else if(message.type==='log')onLog?.(message.stream,message.text);
      else if(message.type==='asset'){try{if(validateAsset)await validateAsset(message.file,message.extension,message.page,{signal,timeout:options.timeout});if(!settled)worker.postMessage({id:message.id});}catch(error){if(!settled)worker.postMessage({id:message.id,error:String(error?.message||error?.name||error||'Falha ao carregar recurso.')});}}
      else if(message.type==='mermaid'){
        try{if(!renderMermaid)throw new Error('Renderizador Mermaid indisponível.');await renderMermaid(message.source,message.output,{signal,timeout:options.timeout});if(!settled)worker.postMessage({id:message.id});}
        catch(error){if(!settled)worker.postMessage({id:message.id,error:String(error?.message||error?.name||error||'Falha ao carregar recurso.')});}
      }
    });
  });
}
module.exports={isolatedTranspile};
