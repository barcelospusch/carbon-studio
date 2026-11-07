'use strict';
const PAPERS=['a4','letter','legal','a5'];
function publicSettings(value={},previous={}){
 const result={paper:previous.paper||'a4',theme:previous.theme||'dark-plus',defaultAuthor:previous.defaultAuthor||'',defaultInstitution:previous.defaultInstitution||''};
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Preferências inválidas.');
 if(value.paper!==undefined){if(!PAPERS.includes(value.paper))throw new Error('Papel inválido.');result.paper=value.paper;}
 if(value.theme!==undefined){if(typeof value.theme!=='string'||!/^[-a-z0-9]{1,60}$/.test(value.theme))throw new Error('Tema inválido.');result.theme=value.theme;}
 for(const key of ['defaultAuthor','defaultInstitution'])if(value[key]!==undefined){
  if(typeof value[key]!=='string'||value[key].length>300||/[\r\n\[\]{}]/.test(value[key]))throw new Error('Autor e instituição devem usar uma única linha, sem colchetes ou chaves.');
  result[key]=value[key].trim();
 }
 return result;
}
function authorDirective(settings){
 const author=settings.defaultAuthor||'Seu nome',institution=settings.defaultInstitution||'';
 return institution?`@author [${author}]{${institution}}`:`@author ${author}`;
}
module.exports={publicSettings,authorDirective};
