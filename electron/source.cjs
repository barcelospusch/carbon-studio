'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const {inside} = require('./projects.cjs');

// Replace comments with spaces so every UTF-16 column and source line survives.
function stripComments(source) {
  const lines = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
  let block = false, fence = null, raw = false, displayMath = false, blockLine = 1;
  const output=lines.map((line,index) => {
    if(raw){if(line.trim()===']')raw=false;return line;}
    let start=0,prefix='';
    if(displayMath){const close=line.indexOf('$$');if(close<0)return line;start=close+2;prefix=line.slice(0,start);displayMath=false;}
    const marker = !start&&line.match(/^\s*(`{3,}|~{3,})/);
    if (!block && marker) {
      if (!fence) fence = marker[1];
      else if (marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = null;
      return line;
    }
    if (fence) return line;
    if (!start&&!block && /^\s*@code(?:\[[^\]]*\])?\[\s*$/.test(line)) { raw = true; return line; }
    let result = prefix, quote = null, ticks = false, inlineMath = false;
    for (let i = start; i < line.length; i++) {
      const c = line[i], next = line[i+1];
      if (block) {
        if (c === '*' && next === '/') { result += '  '; i++; block = false; }
        else result += ' ';
      } else if (c === '\\') { result += c + (next || ''); i++; }
      else if (quote) { result += c; if (c === quote) quote = null; }
      else if(c==='$'&&next==='$'&&!ticks){const close=line.indexOf('$$',i+2);if(close<0){displayMath=true;result+=line.slice(i);break;}result+=line.slice(i,close+2);i=close+1;}
      else if(c==='$'&&!ticks){inlineMath=!inlineMath;result+=c;}
      else if(inlineMath){result+=c;}
      else if (c === '`') { ticks = !ticks; result += c; }
      else if (!ticks && (c === '"' || c === "'") && (i === 0 || /[\s:=([{]/.test(line[i-1]))) { quote = c; result += c; }
      else if (!ticks && c === '/' && next === '*') { block = true;blockLine=index+1; result += '  '; i++; }
      else if (!ticks && c === '/' && next === '/' && (i === 0 || /\s/.test(line[i-1]))) { result += ' '.repeat(line.length-i); break; }
      else result += c;
    }
    return result;
  }).join('\n');
  if(block){const error=new Error('Linha '+blockLine+': comentário /* sem */ de fechamento.');error.line=blockLine;throw error;}
  return output;
}

async function expandSource(source, base, context, {file = path.join(base,'documento.cb'), root = base, stack = []} = {}) {
  let normalized;try{normalized=stripComments(source);}catch(error){error.diagnostics=[{severity:'error',file,line:error.line||1,column:1,message:error.message}];throw error;}
  const result = [], lines = normalized.split('\n');
  let fenced = false, raw = false;
  for (let i = 0; i < lines.length; i++) {
    if (context.signal?.aborted) throw new Error('Compilação cancelada.');
    // Yield even when the document has no I/O, allowing cancellation of large sources.
    if (i % 2048 === 0) await new Promise(resolve => setImmediate(resolve));
    const entry = {text:lines[i],base,line:i+1,file,literal:raw};
    if(raw){result.push(entry);if(entry.text.trim()===']')raw=false;continue;}
    if(!fenced&&/^\s*@code(?:\[[^\]]*\])?\[\s*$/.test(entry.text))raw=true;
    if (/^\s*```/.test(entry.text)) fenced = !fenced;
    const match = !fenced && entry.text.match(/^\s*@(import|include)\s+(.+?)\s*$/);
    if (!match) { result.push(entry); continue; }
    try {
      const requested=path.resolve(base,match[2].replace(/^['"]|['"]$/g,''));
      if(inside(path.resolve(root),requested))context.dependencies.add(requested);
      const dependency = await fs.realpath(requested);
      const allowed = await fs.realpath(root);
      if (!inside(allowed,dependency)) throw new Error('Recurso fora da pasta permitida.');
      context.dependencies.add(dependency);
      if (dependency === file || stack.includes(dependency)) throw new Error('Inclusão circular: '+[...stack,file,dependency].join(' → '));
      if (match[1] === 'include' && path.extname(dependency).toLowerCase() !== '.cb') throw new Error('@include requer um arquivo .cb.');
      const contents = context.buffers?.[dependency] ?? await fs.readFile(dependency,'utf8');
      if (path.extname(dependency).toLowerCase() === '.mmd') {
        let count = 0;
        for (const m of contents.matchAll(/#([\w:.-]+)\s*\{\s*\n([\s\S]*?)^\}\s*$/gm)) { context.diagrams.set(m[1],m[2]); count++; }
        if (!count) throw new Error('Biblioteca Mermaid sem blocos #id{ ... }.');
      } else for(const included of await expandSource(contents,path.dirname(dependency),context,{file:dependency,root,stack:[...stack,file]}))result.push(included);
    } catch (error) { context.warn(entry,error.message); }
  }
  return result;
}
function sourceLines(source){
  let raw=false,fenced=false;
  return stripComments(source).split('\n').map((text,index)=>{
    const entry={text,line:index+1,literal:raw};
    if(raw){if(text.trim()===']')raw=false;return entry;}
    if(/^\s*```/.test(text))fenced=!fenced;
    if(!fenced&&/^\s*@code(?:\[[^\]]*\])?\[\s*$/.test(text))raw=true;
    return entry;
  });
}
module.exports = {stripComments,sourceLines,expandSource};
