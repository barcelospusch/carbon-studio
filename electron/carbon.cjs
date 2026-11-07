'use strict';
// Carbon -> LaTeX. PDF composition is performed exclusively by Tectonic.
const fs = require('node:fs/promises');
const path = require('node:path');
const {runCompiler} = require('./core.cjs');
const {extractLayout,placement} = require('./layout.cjs');
const {fontPreamble} = require('./fonts.cjs');
const {alignment,COMMANDS,alignedCell,parseTable} = require('./alignment.cjs');
const {matrix,expandMatrices,equation} = require('./science.cjs');
const {pageStyle} = require('./page-style.cjs');
const {cvHeader,cvEntry} = require('./cv.cjs');
const escape = text => String(text).replace(/[\\{}%&#_$~^]/g, c => ({'\\':'\\textbackslash{}','{':'\\{','}':'\\}','%':'\\%','&':'\\&','#':'\\#','_':'\\_','$':'\\$','~':'\\textasciitilde{}','^':'\\textasciicircum{}'}[c]));
function math(text) {
  if (/\\(?:input|include|openout|openin|write|read|catcode|csname|def|newcommand|usepackage|special|directlua|immediate|endlinechar|scantokens|loop)\b/.test(text)) throw new Error('Comando não permitido em matemática (unsupported math command).');
  return expandMatrices(text.trim().replace(/\n\s*\n/g,'\n'));
}
function attributes(text='',fallback={}) {
  const width=text.match(/width=(\d+(?:\.\d+)?)%/)?.[1];
  return {id: text.match(/#([\w:.-]+)/)?.[1]||fallback.id, width:width?Math.min(100,Math.max(1,Number(width)))/100:(fallback.width||.8), page:Math.max(1,Number(text.match(/page=(\d+)/)?.[1]||fallback.page||1)), placement:/\bpos\s*=/.test(text)?placement(text):(fallback.placement||'htbp')};
}
function inline(text, context, slots=[]) {
  const hold=value=>`\u0000${slots.push(value)-1}\u0000`;
  text=text.replace(/\$([^$\n]+)\$/g,(_,value)=>hold(`$${math(value)}$`));
  text=text.replace(/\\\|/g,'|');
  text=text.replace(/@(ref|autoref|pageref|eqref)\(([\w:.-]+)\)/g,(_,kind,id)=>hold(`\\${kind}{${id}}`));
  text=text.replace(/@cite\(([\w:., -]+)\)/g,(_,keys)=>hold(context.cite(keys)));
  text=text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,(_,label,url)=>hold(`\\href{${escape(url)}}{${inline(label,context)}}`));
  text=text.replace(/\*\*(.+?)\*\*|__(.+?)__/g,(_,a,b)=>hold(`\\textbf{${inline(a||b,context,slots)}}`)).replace(/\*([^*]+)\*|_([^_]+)_/g,(_,a,b)=>hold(`\\textit{${inline(a||b,context,slots)}}`)).replace(/~~(.+?)~~/g,(_,value)=>hold(`\\sout{${inline(value,context,slots)}}`));
  let output=escape(text);
  for(let i=0;i<slots.length+1&&/\u0000\d+\u0000/.test(output);i++)output=output.replace(/\u0000(\d+)\u0000/g,(_,index)=>slots[Number(index)]);
  return output;
}
async function expand(source,base,context,stack=[]) {
  if (stack.length>16) throw new Error('Limite de 16 níveis de importação excedido.');
  const lines=source.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').split('\n'), result=[];
  let fenced=false;
  for(let index=0;index<lines.length;index++) {
    const line=lines[index];
    if(line.startsWith('```')) fenced=!fenced;
    const imported=!fenced&&line.match(/^@import\s+(.+?)\s*$/);
    if(!imported) { result.push({text:line,base,line:index+1}); continue; }
    const file=path.resolve(base,imported[1].replace(/^['"]|['"]$/g,''));
    if(stack.includes(file)) throw new Error(`Importação circular: ${file}`);
    const stat=await fs.stat(file).catch(()=>null);
    if(!stat?.isFile()||stat.size>8*1024*1024) throw new Error(`Importação ausente ou maior que 8 MiB: ${file}`);
    const contents=await fs.readFile(file,'utf8');
    if(path.extname(file).toLowerCase()==='.mmd') {
      const pattern=/#([\w:.-]+)\s*\{\s*\n([\s\S]*?)^\}\s*$/gm;
      let match,count=0;while((match=pattern.exec(contents))) { context.diagrams.set(match[1],match[2]);count++; }
      if(!count) throw new Error(`Biblioteca Mermaid sem blocos #id{ ... }: ${file}`);
    } else result.push(...await expand(contents,path.dirname(file),context,[...stack,file]));
  }
  return result;
}
async function transpile(source,{base,directory,paper='a4',mermaid='',node='',renderMermaid,signal,timeout=180000,onLog=()=>{}}) {
  const entries=new Map(),diagrams=new Map(),cited=[];
  const style=source.match(/@print_bibliography\[style=(\w+)\]/)?.[1]||'abnt';
  if(!['abnt','ieee','apa','mla','vancouver','chicago'].includes(style)) throw new Error(`Estilo bibliográfico desconhecido: ${style}`);
  const context={diagrams,cite(keys) { return keys.split(',').map(key=>{
    key=key.trim();const entry=entries.get(key);if(!entry) throw new Error(`Referência bibliográfica não encontrada: ${key}`);
    if(!cited.includes(key))cited.push(key);
    const author=entry.author?.split(';')[0]?.split(',')[0]||key;
    const label=['ieee','vancouver'].includes(style)?`[${cited.indexOf(key)+1}]`:style==='mla'?`(${author})`:style==='chicago'?`(${author} ${entry.year||'s.d.'})`:`(${author}, ${entry.year||'s.d.'})`;
    return `\\hyperlink{bib:${key}}{${escape(label)}}`;
  }).join('; ');}};
  const expanded=await expand(source,base,context), lines=[];
  const {layout,remaining}=extractLayout(expanded,paper);
  let inCode=false;
  for(let i=0;i<remaining.length;i++) {
    const current=remaining[i];if(current.text.startsWith('```'))inCode=!inCode;
    const entry=!inCode&&current.text.match(/^@entry\s+#([\w.-]+)\s*\{/);
    if(!entry){lines.push(current);continue;}
    let block=current.text.slice(current.text.indexOf('{')+1),closed=false;
    if(block.trim().endsWith('}'))closed=true;
    while(!closed&&++i<remaining.length){block+='\n'+remaining[i].text;if(/^\s*}\s*$/.test(remaining[i].text))closed=true;}
    if(!closed)throw new Error(`Entrada bibliográfica sem fechamento: ${entry[1]}`);
    const fields={};for(const match of block.matchAll(/(\w+)\s*:\s*(?:"([^"\n]*)"|'([^'\n]*)'|([^,\n}]+))\s*,?/g))fields[match[1]]=match[2]??match[3]??match[4].trim();
    if(entries.has(entry[1]))throw new Error(`Referência duplicada: ${entry[1]}`);
    entries.set(entry[1],fields);
  }
  let title='',date='',type='article',authors=[],body=[],caption='',captionAttrs={},figure=0;
  let headline='';
  const contacts=[], pageRules=[];
  const lists=[];
  const alignments=[];
  const closeLists=(depth=0)=>{while(lists.length>depth)body.push(`\\end{${lists.pop().environment}}`);};
  async function asset(file,origin) {
    const absolute=path.resolve(origin,file),extension=path.extname(absolute).toLowerCase();
    if(!['.png','.jpg','.jpeg','.pdf'].includes(extension))throw new Error(`Formato de figura não suportado: ${file}`);
    const target=`asset-${++figure}${extension}`;
    await fs.copyFile(absolute,path.join(directory,target)).catch(()=>{throw new Error(`Figura não encontrada: ${absolute}`);});return target;
  }
  async function diagram(code,attrs) {
    if(renderMermaid){
      const output='diagram-'+(++figure)+'.png';
      await renderMermaid(code,path.join(directory,output),{signal,timeout});
      const rendered=image(output,attrs,caption);
      caption='';captionAttrs={};
      return rendered;
    }
    if(!mermaid)throw new Error('Este documento usa Mermaid. Instale Mermaid CLI na pasta tools/mermaid do projeto: npm install --prefix tools/mermaid @mermaid-js/mermaid-cli.');
    const input=path.join(directory,`diagram-${++figure}.mmd`),output=input+'.png';await fs.writeFile(input,code);
    const executable=/\.[cm]?js$/i.test(mermaid)?(node||'node'):mermaid;
    const args=/\.[cm]?js$/i.test(mermaid)?[mermaid]:[];
    const run=await runCompiler(executable,[...args,'-i',input,'-o',output,'-b','white','-s','2'],{cwd:directory,signal,timeout,onLog});
    if(run.code!==0)throw new Error(run.stderr||'Falha ao renderizar Mermaid.');
    const rendered=image(path.basename(output),attrs,caption);caption='';captionAttrs={};return rendered;
  }
  function image(file,attrs,label) {
    return `\\begin{figure}[${attrs.placement||'htbp'}]\n\\centering\n\\includegraphics[width=${attrs.width||.8}\\linewidth${file.endsWith('.pdf')?`,page=${attrs.page||1}`:''}]{${file}}\n${label?`\\caption{${inline(label,context)}}`:attrs.id?'\\refstepcounter{figure}':''}\n${attrs.id?`\\label{${attrs.id}}`:''}\n\\end{figure}`;
  }
  for(let i=0;i<lines.length;i++) {
    if(signal?.aborted)throw new Error('Compilação cancelada.');
    const {text:line,base:origin,line:number}=lines[i],trim=line.trim();let match;
    try {
      if((match=trim.match(/^@(header|footer)\[(all|first|odd|even|[1-9]\d{0,5})\]\[(left|center|right)\]\s+(.+)$/))){
        closeLists();
        pageRules.push({kind:match[1],scope:match[2],position:match[3],text:match[4]==='none'?'':match[4]});
        continue;
      }
      if((match=trim.match(/^@(headline|contact)\s+(.+)$/))){
        if(type!=='cv')throw new Error('@'+match[1]+' requer @type cv.');
        if(match[1]==='headline')headline=match[2];else contacts.push(match[2]);
        continue;
      }
      if((match=trim.match(/^@cv-entry\[([^\]]*)\]\[([^\]]*)\]\s+(.+)$/))){
        if(type!=='cv')throw new Error('@cv-entry requer @type cv.');
        closeLists();
        const [role,...organization]=match[3].split(' | ');
        body.push(cvEntry(role,organization.join(' | '),match[1],match[2],value=>inline(value,context)));
        continue;
      }
      if((match=trim.match(/^@(matrix|equation)\[([^\]]*)\]\[\s*$/))){
        closeLists();
        const rows=[];
        while(++i<lines.length && lines[i].text.trim()!==']')rows.push(lines[i].text);
        if(i===lines.length)throw new Error('@'+match[1]+' sem ] de fechamento.');
        body.push(match[1]==='matrix'?'\\[\n'+math(matrix(match[2],rows.join('\n')))+'\n\\]':equation(match[2],rows,math));
        continue;
      }
      if((match=line.match(/^@(title|author|date|type)\s+(.+)$/))) {
        closeLists();const value=match[2].replace(/\s+#\s+.*$/,'').trim();
        if(match[1]==='title')title=value;else if(match[1]==='date')date=value;else if(match[1]==='author')authors.push(value);else {if(!['article','report','cv'].includes(value))throw new Error('@type deve ser article, report ou cv.');type=value;}continue;
      }
      if((match=line.match(/^(\s*)([-*]|\d+[.)]|[a-zA-Z]+[.)])\s+(.+)$/))) {
        const indent=match[1].replace(/\t/g,'    ').length,marker=match[2];
        const environment=/^[-*]$/.test(marker)?'itemize':'enumerate';
        while(lists.length&&(lists.at(-1).indent>indent||(lists.at(-1).indent===indent&&lists.at(-1).environment!==environment)))closeLists(lists.length-1);
        if(!lists.length||lists.at(-1).indent<indent){
          if(lists.length>=4)throw new Error('Listas aceitam até quatro níveis.');
          const kind=/^\d/.test(marker)?'arabic':/^[ivxlcdm]+[.)]$/.test(marker)?'roman':/^[IVXLCDM]+[.)]$/.test(marker)?'Roman':/^[A-Z]/.test(marker)?'Alph':'alph';
          body.push(`\\begin{${environment}}${environment==='enumerate'?`[label=\\${kind}*${marker.endsWith(')')?')':'.'}]`:''}`);lists.push({indent,environment});
        }
        const task=environment==='itemize'&&match[3].match(/^\[([ xX])\]\s+(.+)$/);
        if(task)body.push('\\item[$'+(task[1]===' '?'\\square':'\\boxtimes')+'$] '+inline(task[2],context));
        else body.push(`\\item ${inline(match[3],context)}`);
        continue;
      }
      if(!trim){body.push('');continue;}closeLists();
      if((match=trim.match(/^@align\(([^)]*)\)\[\s*$/))){
        if(alignments.length>=16)throw new Error('Blocos @align aceitam até 16 níveis.');
        const mode=alignment(match[1]);alignments.push({mode,line:number});body.push(`\\par\\begingroup\n${COMMANDS[mode]}\n`);continue;
      }
      if(trim.startsWith('@align')){
        const cell=alignedCell(trim);if(!cell)throw new Error('Use @align(center)[conteúdo] ou um bloco com ] em uma linha própria.');
        body.push(`\\par\\begingroup\n${COMMANDS[cell.mode]}\n${inline(cell.content,context)}\\par\n\\endgroup`);continue;
      }
      if(trim===']'){
        if(!alignments.length)throw new Error('Fechamento ] sem um bloco @align aberto.');
        alignments.pop();body.push('\\par\n\\endgroup');continue;
      }
      if(/^@newpage\s*(?:#.*)?$/.test(line)){body.push('\\newpage');continue;}
      if((match=line.match(/^```([\w-]*)\s*(.*)$/))) {
        const block=[];let closed=false;while(++i<lines.length){if(/^```\s*$/.test(lines[i].text)){closed=true;break;}block.push(lines[i].text);}
        if(!closed)throw new Error('Bloco de código sem fechamento.');
        body.push(match[1]==='mermaid'?await diagram(block.join('\n'),attributes(match[2],captionAttrs)):`\\begin{verbatim}\n${block.join('\n')}\n\\end{verbatim}`);continue;
      }
      if(trim.startsWith('$$')) {
        let equation=trim.slice(2),closed=equation.endsWith('$$');if(closed)equation=equation.slice(0,-2);
        while(!closed&&++i<lines.length){if(lines[i].text.trim().endsWith('$$')){equation+='\n'+lines[i].text.trim().slice(0,-2);closed=true;}else equation+='\n'+lines[i].text;}
        if(!closed)throw new Error('Expressão matemática sem $$ de fechamento.');body.push(`\\[\n${math(equation)}\n\\]`);continue;
      }
      if((match=line.match(/^@(toc|tableofcontents)(?:\[title="([^"]*)"\])?\s*$/))){body.push(`${match[2]?`\\renewcommand{\\contentsname}{${inline(match[2],context)}}\n`:''}\\tableofcontents`);continue;}
      if((match=line.match(/^@caption\s+(.+?)(?:\s*\{([^}]+)\})?$/))){caption=match[1];captionAttrs=attributes(match[2]);continue;}
      if((match=line.match(/^!\[([^\]]*)\]\((.+?)\)(?:\{([^}]+)\})?\s*$/))){body.push(image(await asset(match[2],origin),attributes(match[3],captionAttrs),match[1]||caption));caption='';captionAttrs={};continue;}
      if((match=line.match(/^@mermaid\s+(.+)$/))){const attrs=attributes(match[1],captionAttrs);if(!diagrams.has(attrs.id))throw new Error(`Diagrama não encontrado: ${attrs.id}`);body.push(await diagram(diagrams.get(attrs.id),attrs));continue;}
      if(/^\s*\|/.test(line)) {
        const rows=[line];while(i+1<lines.length&&(!lines[i+1].text.trim()||/^\s*\|/.test(lines[i+1].text))){i++;if(lines[i].text.trim())rows.push(lines[i].text);}
        const table=parseTable(rows),count=table.count;
        const columns=table.modes.map(mode=>`>{${COMMANDS[mode]}\\arraybackslash}X`).join('');
        const content=table.rows.map((row,index)=>row.map(({value})=>{
          const cell=alignedCell(value);
          return cell?`\\multicolumn{1}{>{${COMMANDS[cell.mode]}\\arraybackslash}p{\\carboncellwidth}}{${inline(cell.content,context)}}`:inline(value,context);
        }).join(' & ')+` \\\\${index===0?' \\midrule':''}`).join('\n');
        body.push(`\\begin{table}[${captionAttrs.placement||'htbp'}]\n\\centering\n${caption?`\\caption{${inline(caption,context)}}`:captionAttrs.id?'\\refstepcounter{table}':''}\n${captionAttrs.id?`\\label{${captionAttrs.id}}`:''}\n\\setlength{\\JustifyingParindent}{0pt}\n\\setlength{\\carboncellwidth}{\\dimexpr${captionAttrs.width||1}\\linewidth/${count}-2\\tabcolsep\\relax}\n\\begin{tabularx}{${captionAttrs.width||1}\\linewidth}{${columns}}\n\\toprule\n${content}\n\\bottomrule\n\\end{tabularx}\n\\end{table}`);caption='';captionAttrs={};continue;
      }
      if((match=line.match(/^(#{1,3})\s+(.+)$/))){body.push(`\\${(type==='report'?['chapter','section','subsection']:['section','subsection','subsubsection'])[match[1].length-1]}{${inline(match[2],context)}}`);continue;}
      if(/^@print_bibliography(?:\[style=\w+\])?\s*$/.test(line)){body.push('\u0001BIBLIOGRAPHY\u0001');continue;}
      if(/^@\w+/.test(line)&&!/^@(cite|ref|autoref|pageref|eqref)\(/.test(line))throw new Error(`Diretiva desconhecida: ${line.split(/\s/)[0]}`);
      body.push(inline(line,context));
    }catch(error){throw new Error(`Linha ${number}: ${error.message}`);}
  }
  closeLists();
  if(alignments.length)throw new Error(`Linha ${alignments.at(-1).line}: bloco @align sem ] de fechamento.`);
  const bibliography=cited.map((key,index)=>{
    const e=entries.get(key),numeric=['ieee','vancouver'].includes(style);
    const author=style==='abnt'?(e.author||'').toLocaleUpperCase('pt-BR'):e.author||'';
    const name=escape(author),title=escape(e.title||''),venue=escape(e.journal||e.publisher||''),year=escape(e.year||'s.d.');
    const formatted={
      abnt:`${name}. \\textbf{${title}}. ${venue?venue+', ':''}${year}`,
      apa:`${name} (${year}). \\textit{${title}}${venue?'. '+venue:''}`,
      ieee:`${name}, “${title},” ${venue?`\\textit{${venue}}, `:''}${year}`,
      vancouver:`${name}. ${title}. ${venue?venue+'. ':''}${year}`,
      mla:`${name}. “${title}.” ${venue?`\\textit{${venue}}, `:''}${year}`,
      chicago:`${name}. ${year}. “${title}.” ${venue?`\\textit{${venue}}`:''}`
    };
    const fields=formatted[style];
    return `\\par\\noindent\\hypertarget{bib:${key}}{}${numeric?`[${index+1}] `:''}${fields}.${e.url?` \\url{${escape(e.url)}}`:''}\\par\\medskip`;
  }).join('\n');
  const formattedAuthors=authors.map(author=>{const a=author.match(/^\[(.+)\]\{(.+)\}$/);return a?`${inline(a[1],context)}\\\\{\\small ${inline(a[2],context)}}`:inline(author,context);}).join(' \\and ');
  const fontsize=layout.typography.fontsize;
  const classSize=['10pt','11pt','12pt'].includes(fontsize)?fontsize:'12pt';
  const geometry=[layout.page.size.toLowerCase()+'paper',layout.page.orientation,...Object.entries(layout.margins).map(([key,value])=>`${key}=${value}`)].join(',');
  const fonts=await fontPreamble(layout.typography.font,directory);
  const format=value=>inline(value,context);
  const stationery=pageStyle(pageRules,format,type==='report');
  const opening=type==='cv'?cvHeader(title||authors[0]||'Currículo',headline,contacts,format):(title?'\\maketitle':'');
  const tex=`\\documentclass[${classSize},${layout.page.size.toLowerCase()}paper]{${type==='cv'?'article':type}}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
${fonts}
${classSize!==fontsize?`\\usepackage[fontsize=${fontsize}]{scrextend}`:''}
\\usepackage{amsmath,amssymb,graphicx,booktabs,tabularx,enumitem,float}
\\usepackage{ragged2e}
\\newlength{\\carboncellwidth}
\\usepackage[normalem]{ulem}
\\usepackage[${geometry}]{geometry}
\\usepackage{setspace}
\\setstretch{${layout.typography.lineheight}}
\\usepackage[unicode,hidelinks]{hyperref}
\\renewcommand{\\contentsname}{Conteúdo}
\\renewcommand{\\figurename}{Figura}
\\renewcommand{\\tablename}{Tabela}
\\providecommand{\\figureautorefname}{Figura}
\\providecommand{\\tableautorefname}{Tabela}
${stationery}
${type==='cv'?'\\setcounter{secnumdepth}{0}\n\\setlength{\\parindent}{0pt}':''}
\\title{${inline(title,context)}}
\\author{${formattedAuthors}}
\\date{${date==='@today'?'\\today':inline(date,context)}}
\\begin{document}
${opening}
${body.join('\n').replaceAll('\u0001BIBLIOGRAPHY\u0001',bibliography)}
\\end{document}
`;
  return {tex,citations:cited.length,style,layout};
}
async function compileCarbon(source,options) {
  const result=await transpile(source,options);
  const file=path.join(options.directory,'preview.tex');await fs.writeFile(file,result.tex);
  options.onLog?.('stdout','Carbon → LaTeX concluído. Compondo PDF com Tectonic…\n');
  const run=await runCompiler(options.tectonic,['--untrusted','--keep-logs','--keep-intermediates','--outdir',options.directory,file],{cwd:options.directory,timeout:options.timeout,signal:options.signal,onLog:options.onLog});
  if(run.code!==0)throw new Error(run.stderr||run.stdout||'Falha no motor LaTeX.');
  return result;
}
module.exports={transpile,compileCarbon,escape,math};
