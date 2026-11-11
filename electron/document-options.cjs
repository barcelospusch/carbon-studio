'use strict';
const length=value=>{
  if(!/^\d+(?:\.\d+)?(?:cm|mm|pt|in)$/.test(String(value)))throw new Error('Dimensão inválida: '+value+'. Use cm, mm, pt ou in.');
  return String(value);
};
function options(text){
  const result={};let end=0;
  const pattern=/([a-z][\w-]*)\s*=\s*("[^"]*"|'[^']*'|[^\s]+)\s*/gi;
  for(const match of text.matchAll(pattern)){
    if(text.slice(end,match.index).trim()||Object.hasOwn(result,match[1]))throw new Error('Opção inválida ou duplicada: '+text);
    result[match[1]]=match[2].replace(/^(['"])(.*)\1$/,'$2');end=match.index+match[0].length;
  }
  if(text.slice(end).trim())throw new Error('Opção inválida: '+text);
  return result;
}
function boolean(value){if(!['true','false'].includes(String(value)))throw new Error('Use true ou false.');return String(value)==='true';}
function columns(input={}){
  const result={count:'2',gap:'0.8cm',divider:'false','divider-width':'0.4pt','divider-color':'#666666','divider-style':'solid','divider-padding':'0cm',balance:'true',...input};
  for(const key of Object.keys(input))if(!['count','gap','divider','divider-width','divider-color','divider-style','divider-padding','balance'].includes(key))throw new Error('@columns: opção desconhecida '+key);
  if(!/^\d+$/.test(result.count)||Number(result.count)<2||Number(result.count)>10)throw new Error('@columns count: use entre 2 e 10 (limite do multicol).');
  for(const key of ['gap','divider-width','divider-padding'])length(result[key]);
  for(const key of ['divider','balance'])boolean(result[key]);
  if(!/^#[0-9a-f]{6}$/i.test(result['divider-color']))throw new Error('Cor de divisória inválida.');
  if(!['solid','dashed','dotted'].includes(result['divider-style']))throw new Error('@columns divider-style: use solid, dashed ou dotted.');
  return result;
}
function columnOpening(config){
  const c=columns(config),environment=boolean(c.balance)?'multicols':'multicols*';
  return {environment,tex:`\\par\\begingroup\n\\setlength{\\columnsep}{\\dimexpr${c.gap}+2\\dimexpr${c['divider-padding']}\\relax\\relax}\n\\setlength{\\columnseprule}{${boolean(c.divider)?c['divider-width']:'0pt'}}\n\\definecolor{carboncolumnrule}{HTML}{${c['divider-color'].slice(1)}}\n\\SetMCRule{color=carboncolumnrule,width=${boolean(c.divider)?c['divider-width']:'0pt'},line-style=${c['divider-style']}}\n\\begin{${environment}}{${c.count}}`};
}
function linkStyle(input={}){
  const defaults={color:'#2563EB',underline:'false','underline-color':'#2563EB','underline-style':'solid',weight:'normal',italic:'false',border:'false',breakable:'true'};
  for(const key of Object.keys(input))if(!Object.hasOwn(defaults,key))throw new Error('@links: propriedade desconhecida '+key);
  const result={...defaults,...input};
  for(const key of ['color','underline-color'])if(!/^#[0-9a-f]{6}$/i.test(result[key]))throw new Error('@links: cor inválida.');
  for(const key of ['underline','italic','border','breakable'])boolean(result[key]);
  if(!['normal','bold'].includes(result.weight)||!['solid','dashed','dotted'].includes(result['underline-style']))throw new Error('@links: estilo inválido.');
  return result;
}
function styledLink(content,input){
  if(!input)return content;
  const c=linkStyle(input);
  if(c.weight==='bold')content=`\\textbf{${content}}`;
  if(boolean(c.italic))content=`\\textit{${content}}`;
  if(boolean(c.underline)){
    const command={solid:'uline',dashed:'dashuline',dotted:'dotuline'}[c['underline-style']];
    content=`\\textcolor[HTML]{${c['underline-color'].slice(1)}}{\\${command}{\\textcolor[HTML]{${c.color.slice(1)}}{${content}}}}`;
  }else content=`\\textcolor[HTML]{${c.color.slice(1)}}{${content}}`;
  if(boolean(c.border))content=`\\fbox{${content}}`;
  if(!boolean(c.breakable))content=`\\mbox{${content}}`;
  return content;
}
function extractOptions(entries){
  const remaining=[],links={},global={},ranges=[];let fenced=false;
  for(let i=0;i<entries.length;i++){
    const entry=entries[i];if(entry.literal){remaining.push(entry);continue;}if(/^\s*```/.test(entry.text))fenced=!fenced;
    const match=!fenced&&entry.text.match(/^@(columns|links)(?:\[(external|internal)\])?\s*(\{|\[)\s*(.*)$/);
    if(!match){remaining.push(entry);continue;}
    if(match[1]==='columns'&&match[3]==='['){remaining.push(entry);continue;}
    const start=i;
    let text=match[4],close=match[3]==='{'?'}':']';
    while(!text.includes(close)&&++i<entries.length)text+='\n'+entries[i].text;
    if(!text.includes(close))throw new Error(`${entry.file}: Linha ${entry.line}: @${match[1]} sem ${close}.`);
    ranges.push({start,end:i});
    const fields={};
    for(const part of text.slice(0,text.indexOf(close)).split(/[,\n]/).map(x=>x.trim()).filter(Boolean)){
      const m=part.match(/^([\w-]+)\s*:\s*(.*?)\s*$/);if(!m||Object.hasOwn(fields,m[1]))throw new Error('Propriedade inválida ou duplicada: '+part);
      fields[m[1]]=m[2].replace(/^(['"])(.*)\1$/,'$2');
    }
    if(match[1]==='columns'){if(global.columns)throw new Error('@columns global duplicado.');global.columns=columns(fields);}
    else {const scope=match[2]||'all';if(links[scope])throw new Error('@links duplicado para '+scope);links[scope]=fields;linkStyle(fields);}
  }
  return {remaining,columns:global.columns,links,ranges};
}
function readDocumentOptions(source){return extractOptions(require('./source.cjs').sourceLines(source));}
function applyDocumentOptions(source,value){
  const parsed=readDocumentOptions(source),omit=new Set();for(const range of parsed.ranges)for(let i=range.start;i<=range.end;i++)omit.add(i);
  const blocks=[];const block=(name,properties)=>name+' {\n'+Object.entries(properties).map(([key,value])=>'  '+key+': '+(String(value).startsWith('#')?JSON.stringify(value):value)).join(',\n')+'\n}';
  if(value.columns)blocks.push(block('@columns',columns(value.columns)));
  for(const scope of ['all','external','internal'])if(value.links?.[scope])blocks.push(block('@links'+(scope==='all'?'':'['+scope+']'),linkStyle(value.links[scope])));
  return (blocks.length?blocks.join('\n\n')+'\n\n':'')+source.replace(/\r\n?/g,'\n').split('\n').filter((_,index)=>!omit.has(index)).join('\n').replace(/^\n+/,'');
}
module.exports={readDocumentOptions,applyDocumentOptions,length,options,boolean,columns,columnOpening,linkStyle,styledLink,extractOptions};
