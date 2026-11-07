'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const {atomicWrite}=require('./core.cjs');
const UI_KEYS=['background','foreground','surface','surfaceAlt','raised','border','muted','accent','accentForeground','header','headerForeground','preview'];
function validateTheme(theme){
 if(!theme||typeof theme!=='object'||typeof theme.id!=='string'||!/^[-a-z0-9]{1,60}$/.test(theme.id)||typeof theme.label!=='string'||!theme.label.trim()||theme.label.length>80||!['dark','light'].includes(theme.appearance))throw new Error('Definição de tema inválida.');
 for(const key of UI_KEYS)if(!/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(theme.ui?.[key]))throw new Error(`Cor inválida no tema ${theme.id}: ${key}`);
 if(!theme.editor||!['vs','vs-dark'].includes(theme.editor.base)||typeof theme.editor.inherit!=='boolean'||!Array.isArray(theme.editor.rules)||!theme.editor.colors||typeof theme.editor.colors!=='object'||Array.isArray(theme.editor.colors))throw new Error(`Editor inválido no tema ${theme.id}.`);
 for(const [key,value] of Object.entries(theme.editor.colors))if(!/^[\w.]+$/.test(key)||typeof value!=='string'||!/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(value))throw new Error('Cor inválida para o editor.');
 for(const rule of theme.editor.rules)if(!rule||typeof rule.token!=='string'||rule.token.length>100||(rule.foreground!==undefined&&(typeof rule.foreground!=='string'||!/^[0-9a-f]{6}$/i.test(rule.foreground)))||(rule.fontStyle!==undefined&&(typeof rule.fontStyle!=='string'||!/^(?:(?:bold|italic|underline)\s*)*$/.test(rule.fontStyle))))throw new Error('Realce inválido no tema.');
 return theme;
}
async function loadThemes(bundled,directory){
 await fs.mkdir(directory,{recursive:true});
 for(const file of (await fs.readdir(bundled)).filter(file=>file.endsWith('.json'))){
  const theme=validateTheme(JSON.parse(await fs.readFile(path.join(bundled,file),'utf8'))),destination=path.join(directory,theme.id+'.json');
  try{await fs.access(destination);}catch{await atomicWrite(destination,JSON.stringify(theme,null,2));}
 }
 const themes=[],errors=[];
 for(const file of (await fs.readdir(directory)).filter(file=>file.endsWith('.json'))){
  try{const stat=await fs.stat(path.join(directory,file));if(stat.size>512*1024)throw new Error('Arquivo maior que 512 KiB.');const theme=validateTheme(JSON.parse(await fs.readFile(path.join(directory,file),'utf8')));if(themes.some(existing=>existing.id===theme.id))throw new Error('Identificador duplicado.');themes.push(theme);}
  catch(error){errors.push(`${file}: ${error.message}`);}
 }
 if(!themes.length)throw new Error('Nenhuma definição local de tema válida.');
 return {themes:themes.sort((a,b)=>a.label.localeCompare(b.label)),errors,directory};
}
module.exports={loadThemes,validateTheme};
