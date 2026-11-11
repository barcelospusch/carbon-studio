'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const {sourceLines}=require('./source.cjs');
const {projectFile}=require('./projects.cjs');
async function compilationRoot(root,documents,current,source){
  current=await fs.realpath(current);
  const graph=new Map();
  for(const relative of documents){
    try{
      const file=await projectFile(root,relative),text=file===current?source:await fs.readFile(file,'utf8');
      const dependencies=[];let fenced=false;
      for(const entry of sourceLines(text)){if(entry.literal)continue;const line=entry.text;
        if(/^\s*```/.test(line))fenced=!fenced;
        const m=!fenced&&line.match(/^\s*@(?:include|import)\s+(.+?)\s*$/);
        if(m){try{dependencies.push(await projectFile(root,path.relative(root,path.resolve(path.dirname(file),m[1].replace(/^['"]|['"]$/g,'')))));}catch{/* Compiler reports missing resources. */}}
      }
      graph.set(file,dependencies);
    }catch{/* Inaccessible project files cannot select a main document. */}
  }
  const childSet=new Set([...graph.values()].flat());
  function reaches(file,target,visited=new Set()){
    if(file===target)return true;if(visited.has(file))return false;visited.add(file);
    return (graph.get(file)||[]).some(child=>reaches(child,target,visited));
  }
  const candidates=[...graph.keys()].filter(file=>!childSet.has(file)&&reaches(file,current));
  const selected=candidates.find(file=>path.basename(file).toLowerCase()==='main.cb')||(candidates.length===1?candidates[0]:current);
  return {file:selected,source:selected===current?source:await fs.readFile(selected,'utf8')};
}
module.exports={compilationRoot};
