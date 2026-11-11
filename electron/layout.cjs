'use strict';

const PAPERS = {
  a4: {name:'A4', width:210, height:297},
  letter: {name:'Letter', width:215.9, height:279.4},
  legal: {name:'Legal', width:215.9, height:355.6},
  a5: {name:'A5', width:148, height:210},
};
const FIELDS = {margins:['top','bottom','left','right'], page:['size','orientation'], typography:['font','fontsize','lineheight'], paragraph:['indent-first','indent-after-heading','spacing-before','spacing-after']};
function defaults(paper='a4') {
  return {margins:{top:'1in',bottom:'1in',left:'1in',right:'1in'},page:{size:Object.hasOwn(PAPERS,paper.toLowerCase())?PAPERS[paper.toLowerCase()].name:'A4',orientation:'portrait'},typography:{font:'',fontsize:'12pt',lineheight:1},paragraph:{'indent-first':'15pt','indent-after-heading':'false','spacing-before':'0pt','spacing-after':'0pt'}};
}
// Split fields and strip comments outside quoted strings; never evaluate input.
function fields(block, kind) {
  const parts=[];let part='',quote='',comment=false;
  for(const character of block+'\n') {
    if(comment){if(character!=='\n')continue;comment=false;}
    if(quote){part+=character;if(character===quote)quote='';continue;}
    if(character==='"'||character==="'"){quote=character;part+=character;continue;}
    if(character==='#'){comment=true;continue;}
    if(character===','||character==='\n'){if(part.trim())parts.push(part.trim());part='';}else part+=character;
  }
  if(quote)throw new Error(`@${kind}: texto entre aspas sem fechamento.`);
  const result={};
  for(const token of parts){
    const match=token.match(/^([a-z-]+)\s*:\s*(.+)$/i);
    if(!match||!FIELDS[kind].includes(match[1]))throw new Error(`@${kind}: propriedade inválida: ${token}`);
    if(Object.hasOwn(result,match[1]))throw new Error(`@${kind}: propriedade duplicada: ${match[1]}`);
    result[match[1]]=match[2].trim().replace(/^(["'])(.*)\1$/,'$2');
  }
  if(!parts.length)throw new Error(`@${kind}: informe ao menos uma propriedade.`);
  return result;
}
function dimension(value) {
  const match=String(value).match(/^(\d+(?:\.\d+)?)(cm|mm|in)$/);
  if(!match)throw new Error(`Margem inválida: ${value}. Use cm, mm ou in, por exemplo 2.5cm.`);
  return Number(match[1])*({cm:10,mm:1,in:25.4}[match[2]]);
}
function validateLayout(input,paper='a4') {
  const config=defaults(paper);
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Configuração de layout inválida.');
  for(const kind of Object.keys(input)){
    if(!Object.hasOwn(FIELDS,kind)||!input[kind]||typeof input[kind]!=='object'||Array.isArray(input[kind]))throw new Error(`Grupo de layout inválido: ${kind}`);
    for(const [key,value] of Object.entries(input[kind])){
      if(!FIELDS[kind].includes(key))throw new Error(`@${kind}: propriedade inválida: ${key}`);
      if(!['string','number'].includes(typeof value))throw new Error(`@${kind}: valor inválido para ${key}`);
      config[kind][key]=String(value).trim();
    }
  }
  const sheet=Object.hasOwn(PAPERS,config.page.size.toLowerCase())?PAPERS[config.page.size.toLowerCase()]:null;
  if(!sheet)throw new Error('@page size: escolha A4, Letter, Legal ou A5.');
  config.page.size=sheet.name;
  if(!['portrait','landscape'].includes(config.page.orientation))throw new Error('@page orientation: escolha portrait ou landscape.');
  const landscape=config.page.orientation==='landscape',width=landscape?sheet.height:sheet.width,height=landscape?sheet.width:sheet.height;
  const margins=Object.fromEntries(Object.entries(config.margins).map(([key,value])=>[key,dimension(value)]));
  if(margins.left+margins.right>=width||margins.top+margins.bottom>=height)throw new Error('As margens não deixam área útil no tamanho e orientação de papel escolhidos.');
  const size=config.typography.fontsize.match(/^(\d+(?:\.\d+)?)pt$/);
  if(!size||Number(size[1])<1||Number(size[1])>200)throw new Error('@typography fontsize: use entre 1pt e 200pt.');
  const spacing=Number(config.typography.lineheight);
  if(!Number.isFinite(spacing)||spacing<=0||spacing>10)throw new Error('@typography lineheight: use um número maior que zero e até 10.');
  config.typography.lineheight=spacing;
  if(config.typography.font&&!/^[\p{L}\p{N} .,'()_-]{1,100}$/u.test(config.typography.font))throw new Error('@typography font: informe apenas o nome da família de fontes.');
  for(const key of ['indent-first','spacing-before','spacing-after'])if(!/^(?:\d+(?:\.\d+)?)(?:cm|mm|in|pt)$/.test(config.paragraph[key]))throw new Error('@paragraph '+key+': use cm, mm, in ou pt.');
  if(!['true','false'].includes(config.paragraph['indent-after-heading']))throw new Error('@paragraph indent-after-heading: use true ou false.');
  return config;
}
function extractLayout(lines,paper='a4') {
  const values={},ranges=[],remaining=[];let fenced=false,math=false;
  for(let i=0;i<lines.length;i++){
    const current=lines[i],text=current.text,trim=text.trim();
    if(current.literal){remaining.push(current);continue;}
    if(/^\s*```/.test(text)){fenced=!fenced;remaining.push(current);continue;}
    if(!fenced&&trim.startsWith('$$')){if(trim==='$$'||!trim.slice(2).endsWith('$$'))math=!math;remaining.push(current);continue;}
    const match=!fenced&&!math&&!/^@(paragraph|page)\[/.test(text)&&text.match(/^@(margins|page|typography|paragraph)\b(.*)$/);
    if(!match){remaining.push(current);continue;}
    const start=i,kind=match[1];
    try{
      if(values[kind])throw new Error(`@${kind} duplicado. Mantenha um bloco por documento.`);
      if(!/^\s*\{/.test(match[2]))throw new Error(`@${kind} deve iniciar com {.`);
      let content=match[2].replace(/^\s*\{/,'');
      while(!content.includes('}')&&++i<lines.length)content+='\n'+lines[i].text;
      const end=content.indexOf('}');
      if(end<0)throw new Error(`@${kind} sem } de fechamento.`);
      if(!/^\s*(?:#.*)?$/.test(content.slice(end+1)))throw new Error(`@${kind}: conteúdo inesperado após }.`);
      values[kind]=fields(content.slice(0,end),kind);ranges.push({start,end:i,kind,origin:{file:current.file,line:current.line}});
    }catch(error){const failure=new Error(`Linha ${current.line}: ${error.message}`);failure.diagnostics=[{severity:'error',file:current.file,line:current.line,column:1,message:error.message}];throw failure;}
  }
  let layout;try{layout=validateLayout(values,paper);}catch(error){const kind=error.message.match(/^@(\w+)/)?.[1]||(/margem|margens/i.test(error.message)?'margins':'page'),origin=ranges.find(range=>range.kind===kind)?.origin||{file:lines[0]?.file,line:1};error.diagnostics=[{severity:'error',...origin,column:1,message:error.message}];throw error;}
  return {layout,remaining,ranges,explicit:Object.keys(values)};
}
function readLayout(source,paper='a4'){return extractLayout(require('./source.cjs').sourceLines(source),paper);}
function applyLayout(source,values,paper='a4'){
  const config=validateLayout(values,paper),parsed=readLayout(source,paper);
  const lines=source.replace(/\r\n?/g,'\n').split('\n'),omit=new Set();
  for(const range of parsed.ranges)for(let i=range.start;i<=range.end;i++)omit.add(i);
  const body=lines.filter((_,index)=>!omit.has(index)).join('\n').replace(/^\n+/,'');
  const block=Object.entries(config).map(([kind,properties])=>{
    const entries=Object.entries(properties).filter(([key,value])=>key!=='font'||value).map(([key,value])=>`  ${key}: ${key==='font'?JSON.stringify(value):value}`);
    return `@${kind} {\n${entries.join(',\n')}\n}`;
  }).join('\n\n');
  return `${block}\n\n${body}`;
}
function placement(text=''){
  const match=text.match(/\bpos\s*=\s*\[([^\]]*)\]/);
  if(!match){if(/\bpos\s*=/.test(text))throw new Error('Posição inválida. Use pos=[here], pos=[top] ou outra lista de posições.');return 'htbp';}
  const aliases={here:'h',h:'h',top:'t',t:'t',bottom:'b',b:'b',page:'p',p:'p',override:'!','!':'!'};
  const tokens=match[1].split(',').map(token=>token.trim().toLowerCase());
  if(tokens.some(token=>!Object.hasOwn(aliases,token)))throw new Error(`Posição inválida: ${match[1]}. Use here, top, bottom, page ou override.`);
  const positions=[...new Set(tokens.map(token=>aliases[token]))];
  // Exact placement has precedence over floating hints in Carbon.
  if(positions.includes('h'))return 'H';
  const hints=positions.filter(value=>value!=='!').join('')||'htbp';
  return (positions.includes('!')?'!':'')+hints;
}
module.exports={PAPERS,dimension,defaults,validateLayout,extractLayout,readLayout,applyLayout,placement};
