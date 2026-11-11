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
const {expandSource} = require('./source.cjs');
const {extractOptions,columnOpening,options,styledLink} = require('./document-options.cjs');
const {extractSemantic,languages}=require('./semantic.cjs');
const {captionOptions,presentFigure,presentTable} = require('./captions.cjs');
const escape = text => String(text).replace(/[\\{}%&#_$~^]/g, c => ({'\\':'\\textbackslash{}','{':'\\{','}':'\\}','%':'\\%','&':'\\&','#':'\\#','_':'\\_','$':'\\$','~':'\\textasciitilde{}','^':'\\textasciicircum{}'}[c]));
function math(text) {
  if (/\\(?:input|include|includegraphics|graphicspath|bibliography|addbibresource|pdfximage|XeTeXpicfile|font|openout|openin|write|read|catcode|csname|def|newcommand|usepackage|special|directlua|immediate|endlinechar|scantokens|loop)\b/.test(text)) throw new Error('Comando não permitido em matemática (unsupported math command).');
  return expandMatrices(text.trim().replace(/\n\s*\n/g,'\n'));
}
function attributes(text='',fallback={}) {
  const width=text.match(/width=(\d+(?:\.\d+)?)%/)?.[1];
  return {id: text.match(/#([\w:.-]+)/)?.[1]||fallback.id, width:width?Math.min(100,Math.max(1,Number(width)))/100:(fallback.width||.8), page:Math.max(1,Number(text.match(/page=(\d+)/)?.[1]||fallback.page||1)), placement:/\bpos\s*=/.test(text)?placement(text):(fallback.placement||'htbp')};
}
function inline(text, context, slots=[]) {
  const hold=value=>`\u0000${slots.push(value)-1}\u0000`;
  text=text.replace(/@var\(([\w.-]+)\)/g,(_,name)=>{if(!context.variables?.has(name))throw new Error('Variável desconhecida: '+name);if(context.resolving?.has(name))throw new Error('Variável circular: '+name);context.resolving.add(name);try{return hold(inline(context.variables.get(name),context));}finally{context.resolving.delete(name);}});
  text=text.replace(/\$([^$\n]+)\$/g,(_,value)=>hold(`$${math(value)}$`));
  text=text.replace(/\\\|/g,'|');
  text=text.replace(/@(ref|autoref|pageref|eqref)\(([\w:.-]+)\)/g,(_,kind,id)=>hold(styledLink(`\\${kind}{${id}}`,context.links&&(context.links.all||context.links.internal)?{...context.links.all,...context.links.internal}:null)));
  text=text.replace(/@(refs|cites)\(([^)]+)\)/g,(_,kind,keys)=>hold(kind==='cites'?context.cite(keys):keys.split(',').map(id=>inline('@ref('+id.trim()+')',context)).join(', ')));
  text=text.replace(/@cite\(([\w:., -]+)\)/g,(_,keys)=>hold(context.cite(keys)));
  text=text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,(_,label,url)=>hold(styledLink(`\\href{${escape(url)}}{${label===url?`\\nolinkurl{${escape(url)}}`:inline(label,context)}}`,context.links&&(context.links.all||context.links.external)?{...context.links.all,...context.links.external}:null)));
  text=text.replace(/\*\*(.+?)\*\*|__(.+?)__/g,(_,a,b)=>hold(`\\textbf{${inline(a||b,context,slots)}}`)).replace(/\*([^*]+)\*|_([^_]+)_/g,(_,a,b)=>hold(`\\textit{${inline(a||b,context,slots)}}`)).replace(/~~(.+?)~~/g,(_,value)=>hold(`\\sout{${inline(value,context,slots)}}`));
  let output=escape(text);
  for(let i=0;i<slots.length+1&&/\u0000\d+\u0000/.test(output);i++)output=output.replace(/\u0000(\d+)\u0000/g,(_,index)=>slots[Number(index)]);
  return output;
}
async function transpile(source,{base,directory,file=path.join(base,'documento.cb'),root=base,buffers={},validateOnly=false,paper='a4',mermaid='',node='',renderMermaid,validateAsset,signal,timeout=180000,onLog=()=>{}}) {
  const entries=new Map(),diagrams=new Map(),cited=[];
  let style='abnt';
  const diagnostics=[],dependencies=new Set();
  const context={variables:new Map(),resolving:new Set(),diagrams,signal,buffers,dependencies,warn(entry,message){const diagnostic={severity:'warning',file:entry.file,line:entry.line,column:1,message};diagnostics.push(diagnostic);onLog('stderr',`${entry.file}:${entry.line}: warning: ${message}\n`);},cite(keys) { return keys.split(',').map(key=>{
    key=key.trim();const entry=entries.get(key);if(!entry){context.warn(context.current||{file,line:1},`Referência bibliográfica não encontrada: ${key}`);return '';}
    if(!cited.includes(key))cited.push(key);
    const author=entry.author?.split(';')[0]?.split(',')[0]||key;
    const label=['ieee','vancouver'].includes(style)?`[${cited.indexOf(key)+1}]`:style==='mla'?`(${author})`:style==='chicago'?`(${author} ${entry.year||'s.d.'})`:`(${author}, ${entry.year||'s.d.'})`;
    return styledLink(`\\hyperlink{bib:${key}}{${escape(label)}}`,context.links&&(context.links.all||context.links.internal)?{...context.links.all,...context.links.internal}:null);
  }).join('; ');}};
  const expanded=await expandSource(source,base,context,{file,root}), lines=[];
  let bibliographyFence=false,bibliographyStyle=null;for(const entry of expanded){if(entry.literal)continue;if(/^\s*```/.test(entry.text))bibliographyFence=!bibliographyFence;const match=!bibliographyFence&&entry.text.trim().match(/^@print_bibliography(?:\[style=(\w+)\])?\s*$/);if(match){const value=match[1]||'abnt';if(!['abnt','ieee','apa','mla','vancouver','chicago'].includes(value))throw new Error(`Estilo bibliográfico desconhecido: ${value}`);if(bibliographyStyle&&bibliographyStyle!==value)throw new Error('O documento deve usar um único estilo bibliográfico.');style=bibliographyStyle=value;}}
  const semantic=extractSemantic(expanded);const localized=semantic.language||languages['pt-BR'];
  const documentOptions=extractOptions(semantic.remaining);context.links=documentOptions.links;
  const {layout,remaining,explicit}=extractLayout(documentOptions.remaining,paper);
  let inCode=false;
  for(let i=0;i<remaining.length;i++) {
    const current=remaining[i];if(/^\s*```/.test(current.text))inCode=!inCode;
    const entry=!inCode&&!current.literal&&current.text.match(/^@entry\s+#([\w.-]+)\s*\{/);
    if(!entry){lines.push(current);continue;}
    let block=current.text.slice(current.text.indexOf('{')+1),closed=false;
    if(block.trim().endsWith('}'))closed=true;
    while(!closed&&i+1<remaining.length&&remaining[i+1].file===current.file){i++;block+='\n'+remaining[i].text;if(/^\s*}\s*$/.test(remaining[i].text))closed=true;}
    if(!closed){context.warn(current,`Entrada bibliográfica sem fechamento: ${entry[1]}`);continue;}
    const fields={};for(const match of block.matchAll(/(\w+)\s*:\s*(?:"([^"\n]*)"|'([^'\n]*)'|([^,\n}]+))\s*,?/g))fields[match[1]]=match[2]??match[3]??match[4].trim();
    if(entries.has(entry[1])){context.warn(current,`Referência duplicada omitida: ${entry[1]}`);continue;}
    entries.set(entry[1],fields);
  }
  let title='',date='',type='article',authors=[],body=[],caption='',captionAttrs={},figure=0;
  const validatedAssets=new Map();
  const bodyOrigins=[];const pushBody=body.push.bind(body);body.push=(...items)=>{for(const item of items){bodyOrigins.push(context.current?{file:context.current.file,line:context.current.line}: {file,line:1});pushBody(item);}return body.length;};
  let headline='',captionConfig=null,figureNotes=[],group=null;
  const scopes=[];const pushScope=scopes.push.bind(scopes);scopes.push=scope=>{scope.origin={file:context.current.file,line:context.current.line};return pushScope(scope);};let columnDepth=0;
  const contacts=[], pageRules=[];
  const lists=[];
  const alignments=[];
  const closeLists=(depth=0)=>{while(lists.length>depth)body.push(`\\end{${lists.pop().environment}}`);};
  async function asset(file,origin,page=1) {
    const absolute=path.resolve(origin,file),extension=path.extname(absolute).toLowerCase();
    if(!['.png','.jpg','.jpeg','.pdf'].includes(extension))throw new Error(`Formato de figura não suportado: ${file}`);
    if(require('./projects.cjs').inside(path.resolve(root),absolute))dependencies.add(absolute);
    const canonical=await fs.realpath(absolute);
    if(!require('./projects.cjs').inside(await fs.realpath(root),canonical))throw new Error('Figura fora da pasta permitida: '+file);
    dependencies.add(canonical);
    const handle=await fs.open(canonical,'r');const signature=Buffer.alloc(8);try{await handle.read(signature,0,8,0);}finally{await handle.close();}
    const valid=extension==='.pdf'?signature.subarray(0,5).toString()==='%PDF-':extension==='.png'?signature.equals(Buffer.from([137,80,78,71,13,10,26,10])):signature[0]===255&&signature[1]===216;
    if(!valid)throw new Error('Recurso de imagem/PDF inválido: '+file);
    if(validateAsset){const key=canonical+':'+page;if(!validatedAssets.has(key))validatedAssets.set(key,validateAsset(canonical,extension,page,{signal,timeout}));try{await validatedAssets.get(key);}catch(error){throw new Error('Recurso inválido '+file+': '+error.message);}}
    const target=`asset-${++figure}${extension}`;
    if(!validateOnly)await fs.copyFile(absolute,path.join(directory,target)).catch(()=>{throw new Error(`Figura não encontrada: ${absolute}`);});return target;
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
    if(columnDepth||documentOptions.columns)attrs={...attrs,placement:'H'};
    const subfigure=scopes.at(-1)?.kind==='subfigure'?scopes.at(-1):null;if(subfigure){if(subfigure.images)throw new Error('@subfigure aceita exatamente uma imagem.');subfigure.images=1;group.validFigures++;}
    const output=presentFigure({file,attrs,label,config:captionConfig||{},notes:figureNotes,inline:value=>inline(value,context),subfigure:scopes.at(-1)?.kind==='subfigure'});
    captionConfig=null;figureNotes=[];return output;
  }
  for(let i=0;i<lines.length;i++) {
    if(signal?.aborted)throw new Error('Compilação cancelada.');
    if(i%2048===0)await new Promise(resolve=>setImmediate(resolve));
    const {text:line,base:origin,line:number,file:sourceFile}=lines[i],trim=line.trim();let match;
    try {
      context.current=lines[i];
      if((captionConfig||figureNotes.length)&&trim&&!/^(@(?:caption|source|note)\b|!\[|@mermaid\b|```mermaid|\|)/.test(trim)){captionConfig=null;figureNotes=[];}
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
      if((match=trim.match(/^@style\[([\w.-]+)\]\[\s*$/))){
        if(!semantic.styles.has(match[1]))throw new Error('Estilo desconhecido: '+match[1]);closeLists();body.push(semantic.styles.get(match[1]));scopes.push({kind:'style',close:'\\par\\endgroup'});continue;
      }
      if((match=trim.match(/^@page\[([^\]]+)\]\[\s*$/))){
        if(scopes.length||documentOptions.columns)throw new Error('@page local deve ficar fora de outros blocos e colunas globais.');
        const opts=options(match[1]);for(const key of Object.keys(opts))if(!['size','orientation'].includes(key))throw new Error('@page: opção desconhecida '+key);
        const paper=require('./layout.cjs').PAPERS[(opts.size||layout.page.size).toLowerCase()],orientation=opts.orientation||layout.page.orientation;
        if(!paper||!['portrait','landscape'].includes(orientation))throw new Error('@page: papel ou orientação inválido.');
        const dims=(sheet,mode)=>mode==='landscape'?[sheet.height,sheet.width]:[sheet.width,sheet.height];
        const [w,h]=dims(paper,orientation),[ow,oh]=dims(require('./layout.cjs').PAPERS[layout.page.size.toLowerCase()],layout.page.orientation);
        if(w<=require('./layout.cjs').dimension(layout.margins.left)+require('./layout.cjs').dimension(layout.margins.right)||h<=require('./layout.cjs').dimension(layout.margins.top)+require('./layout.cjs').dimension(layout.margins.bottom))throw new Error('@page: margens não deixam área útil.');
        closeLists();body.push(`\\clearpage\\newgeometry{layoutwidth=${w}mm,layoutheight=${h}mm,${Object.entries(layout.margins).map(([key,value])=>key+'='+value).join(',')}}\\carbonpapersize{${w}mm}{${h}mm}`);
        scopes.push({kind:'page',close:`\\clearpage\\restoregeometry\\carbonpapersize{${ow}mm}{${oh}mm}`});continue;
      }
      if((match=trim.match(/^@let\s+([\w.-]+)\s*=\s*(.*)$/))){context.variables.set(match[1],match[2]);continue;}
      if((match=trim.match(/^@(abstract|theorem|proof|definition|warning|note|keep)(?:\[([^\]]*)\])?\[\s*$/))){
        closeLists();const kind=match[1],opts=options(match[2]||'');
        const allowed=['theorem','definition'].includes(kind)?['label','title']:['proof','warning','note'].includes(kind)?['title']:[];
        for(const key of Object.keys(opts))if(!allowed.includes(key))throw new Error('@'+kind+': opção inválida '+key);
        if(opts.label&&!/^[\w:.-]+$/.test(opts.label))throw new Error('Label inválido.');
        const env={warning:'quote',note:'quote',keep:'samepage'}[kind]||kind;
        body.push('\\begin{'+env+'}'+(['theorem','definition','proof'].includes(kind)&&opts.title?'[{'+inline(opts.title,context)+'}]':'')+(opts.label?'\\label{'+opts.label+'}':'')+(['warning','note'].includes(kind)?'\\textbf{'+(opts.title?inline(opts.title,context):kind==='warning'?'Aviso':'Nota')+'}\\par':'') );
        scopes.push({kind,close:'\\end{'+env+'}'});continue;
      }
      if((match=trim.match(/^@keywords\s+(.+)$/))){body.push('\\par\\noindent\\textbf{'+localized.keywords+':} '+inline(match[1],context)+'\\par');continue;}
      if((match=trim.match(/^@setcounter\[([a-z]+)=(-?\d+)\]\s*$/))){
        if(!['chapter','section','subsection','figure','table','equation','page','theorem','definition'].includes(match[1]))throw new Error('Contador desconhecido.');
        if(match[1]==='chapter'&&type!=='report')throw new Error('chapter requer @type report.');
        body.push('\\setcounter{'+match[1]+'}{'+match[2]+'}');continue;
      }
      if((match=trim.match(/^@numbering\[([^\]]+)\]\s*$/))){
        for(const [counter,format] of Object.entries(options(match[1]))){if(!['section','subsection','figure','table','equation'].includes(counter)||!['arabic','roman','Roman','alph','Alph'].includes(format))throw new Error('@numbering: contador ou formato inválido.');body.push(`\\renewcommand{\\the${counter}}{\\${format}{${counter}}}`);}continue;
      }
      if(trim==='@keep-with-next'){body.push('\\par\\needspace{4\\baselineskip}');continue;}
      if(trim==='@pagebreak'||trim==='@clearpage'||trim==='@nopagebreak'){body.push('\\'+trim.slice(1));continue;}
      if((match=trim.match(/^@code(?:\[([^\]]*)\])?\[\s*$/))){
        closeLists();const opts=options(match[1]||''),code=[];
        for(const key of Object.keys(opts))if(!['language','caption','label'].includes(key))throw new Error('@code: opção inválida '+key);
        const languages={text:'',javascript:'JavaScript',typescript:'JavaScript',python:'Python',c:'C',cpp:'C++',java:'Java',bash:'bash',sql:'SQL',latex:'[LaTeX]TeX'};
        if(!Object.hasOwn(languages,opts.language||'text'))throw new Error('@code: linguagem não suportada.');
        if(opts.label&&!/^[\w:.-]+$/.test(opts.label))throw new Error('@code label inválido.');
        while(++i<lines.length&&lines[i].text.trim()!==']')code.push(lines[i].text);
        if(i===lines.length)throw new Error('@code sem ] de fechamento.');
        if(code.some(line=>line.includes('\\end{lstlisting}')))throw new Error('Fechamento de ambiente reservado no código.');
        body.push(`\\begin{lstlisting}[language={${languages[opts.language||'text']}},${opts.caption?'caption={'+escape(opts.caption)+'},':''}${opts.label?'label={'+opts.label+'},':''}breaklines=true,basicstyle=\\ttfamily\\small,keywordstyle=\\color{blue},commentstyle=\\color{gray}]\n${code.join('\n')}\n\\end{lstlisting}`);continue;
      }
      if((match=trim.match(/^@columns\[([^\]]+)\]\[\s*$/))){
        if(columnDepth||documentOptions.columns)throw new Error('Blocos @columns não podem ser aninhados.');
        closeLists();const opening=columnOpening(options(match[1]));columnDepth++;
        scopes.push({kind:'columns',close:'\\end{'+opening.environment+'}\\endgroup'});body.push(opening.tex);continue;
      }
      if(trim==='@columnbreak'){if(!columnDepth&&!documentOptions.columns)throw new Error('@columnbreak requer @columns.');closeLists();body.push('\\columnbreak');continue;}
      if((match=trim.match(/^@figure\[([^\]]+)\]\[\s*$/))){
        if(group)throw new Error('Grupos de figuras não podem ser aninhados.');
        const opts=options(match[1]);for(const key of Object.keys(opts))if(!['group','gap','label'].includes(key))throw new Error('@figure: opção inválida '+key);
        if(opts.label&&!/^[\w:.-]+$/.test(opts.label))throw new Error('@figure label inválido.');
        if(!['horizontal','vertical'].includes(opts.group))throw new Error('@figure group: use horizontal ou vertical.');
        const gap=require('./document-options.cjs').length(opts.gap||'0.5cm');
        let total=0,depth=1;for(let j=i+1;j<lines.length&&depth;j++){if(/^\s*@subfigure.*\[\s*$/.test(lines[j].text)){total++;depth++;}if(lines[j].text.trim()===']')depth--;}
        if(!total)throw new Error('@figure requer subfiguras.');
        group={...opts,gap,start:body.length,validFigures:0};closeLists();body.push(`\\begin{figure}[${columnDepth||documentOptions.columns?'H':'htbp'}]\\centering\n\\setlength{\\carbongroupwidth}{\\dimexpr\\linewidth-${opts.group==='horizontal'?total-1:0}\\dimexpr${gap}\\relax\\relax}`);
        scopes.push({kind:'figure',close:'\\end{figure}'});continue;
      }
      if((match=trim.match(/^@subfigure\[([^\]]+)\]\[\s*$/))){
        if(!group||scopes.at(-1)?.kind!=='figure')throw new Error('@subfigure requer um grupo @figure.');
        const opts=options(match[1]);for(const key of Object.keys(opts))if(!['label','width'].includes(key))throw new Error('@subfigure: opção inválida '+key);
        if(opts.label&&!/^[\w:.-]+$/.test(opts.label))throw new Error('@subfigure label inválido.');
        if(!/^\d+(?:\.\d+)?%$/.test(opts.width||'50%')||parseFloat(opts.width||'50')<=0||parseFloat(opts.width||'50')>100)throw new Error('@subfigure width inválido.');
        body.push(`\\begin{subfigure}[t]{${parseFloat(opts.width||'50')/100}\\carbongroupwidth}`);
        scopes.push({kind:'subfigure',label:opts.label,start:body.length-1,images:0,close:'\\end{subfigure}'+(group.group==='vertical'?'\\par\\vspace{'+group.gap+'}':'\\hspace{'+group.gap+'}')});continue;
      }
      if((match=trim.match(/^@group-caption\s+(.+)$/))){if(!group||scopes.at(-1)?.kind!=='figure')throw new Error('@group-caption requer o nível principal de @figure.');if(group.caption)throw new Error('@group-caption duplicado.');group.caption=true;body.push('\\caption{'+inline(match[1],context)+'}'+(group.label?'\\label{'+group.label+'}':''));continue;}
      if((match=trim.match(/^@caption\[([^\]]*)\](?:\s+(.+))?$/))){captionConfig=captionOptions(options(match[1]));caption=match[2]||'';continue;}
      if((match=trim.match(/^@(source|note)\s+(.+)$/))){figureNotes.push((match[1]==='source'?'Fonte: ':'Nota: ')+match[2]);continue;}
      if((match=trim.match(/^@paragraph\[indent=(\d+(?:\.\d+)?(?:cm|mm|pt|in))\]\[\s*$/))){
        closeLists();const content=[];while(++i<lines.length&&lines[i].text.trim()!==']')content.push(lines[i].text);
        if(i===lines.length)throw new Error('@paragraph sem ] de fechamento.');
        body.push(`\\par\\begingroup\\setlength{\\parindent}{${match[1]}}\\indent ${inline(content.join('\n'),context)}\\par\\endgroup`);continue;
      }
      if((match=trim.match(/^@(eq|equations)(?:\[([^\]]*)\])?\[\s*$/))){
        closeLists();const rows=[];while(++i<lines.length&&lines[i].text.trim()!==']')rows.push(lines[i].text);
        if(i===lines.length)throw new Error('@'+match[1]+' sem ] de fechamento.');
        body.push(equation(match[2]||'',rows,math,match[1]==='equations'));continue;
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
      if(!trim){if(body.at(-1)!=='')body.push('');continue;}closeLists();
      if((match=trim.match(/^@align\(([^)]*)\)\[\s*$/))){
        if(alignments.length>=16)throw new Error('Blocos @align aceitam até 16 níveis.');
        const mode=alignment(match[1]);alignments.push({mode,line:number});scopes.push({kind:'align',close:'\\par\n\\endgroup'});body.push(`\\par\\begingroup\n${COMMANDS[mode]}\n`);continue;
      }
      if(trim.startsWith('@align')){
        const cell=alignedCell(trim);if(!cell)throw new Error('Use @align(center)[conteúdo] ou um bloco com ] em uma linha própria.');
        body.push(`\\par\\begingroup\n${COMMANDS[cell.mode]}\n${inline(cell.content,context)}\\par\n\\endgroup`);continue;
      }
      if(trim===']'){
        if(!scopes.length)throw new Error('Fechamento ] sem um bloco aberto.');
        const scope=scopes.pop();if(scope.kind==='align')alignments.pop();if(scope.kind==='columns')columnDepth--;if(scope.kind==='subfigure'&&!scope.images){body.splice(scope.start);bodyOrigins.splice(scope.start);continue;}if(scope.kind==='figure'){if(!group.validFigures){body.splice(group.start);bodyOrigins.splice(group.start);group=null;continue;}if(!group.caption&&group.label)body.push('\\phantomcaption\\label{'+group.label+'}');group=null;}body.push(scope.close);continue;
      }
      if(/^@newpage\s*(?:#.*)?$/.test(line)){body.push('\\newpage');continue;}
      if((match=trim.match(/^```([\w-]*)\s*(.*)$/))) {
        const block=[];let closed=false;while(++i<lines.length){if(/^\s*```\s*$/.test(lines[i].text)){closed=true;break;}block.push(lines[i].text);}
        if(!closed)throw new Error('Bloco de código sem fechamento.');
        if(match[1]==='mermaid'){try{body.push(await diagram(block.join('\n'),attributes(match[2],captionAttrs)));}catch(error){if(signal?.aborted)throw error;context.warn(lines[i-block.length-1],error.message);caption='';captionAttrs={};}}else body.push(`\\begin{verbatim}\n${block.join('\n')}\n\\end{verbatim}`);continue;
      }
      if(trim.startsWith('$$')) {
        let equation=trim.slice(2),closed=equation.endsWith('$$');if(closed)equation=equation.slice(0,-2);
        while(!closed&&++i<lines.length){if(lines[i].text.trim().endsWith('$$')){equation+='\n'+lines[i].text.trim().slice(0,-2);closed=true;}else equation+='\n'+lines[i].text;}
        if(!closed)throw new Error('Expressão matemática sem $$ de fechamento.');body.push(`\\[\n${math(equation)}\n\\]`);continue;
      }
      if((match=line.match(/^@(toc|tableofcontents)(?:\[title="([^"]*)"\])?\s*$/))){body.push(`${match[2]?`\\renewcommand{\\contentsname}{${inline(match[2],context)}}\n`:''}\\tableofcontents`);continue;}
      if((match=trim.match(/^@caption\s+(.+?)(?:\s*\{([^}]+)\})?$/))){caption=match[1];captionAttrs=attributes(match[2]);continue;}
      if((match=trim.match(/^!\[([^\]]*)\]\((.+?)\)(?:\{([^}]+)\})?\s*$/))){try{body.push(image(await asset(match[2],origin,attributes(match[3],captionAttrs).page),attributes(match[3],{...captionAttrs,id:captionAttrs.id||scopes.at(-1)?.label,width:scopes.at(-1)?.kind==='subfigure'?1:captionAttrs.width}),match[1]||(captionConfig?'':caption)));}catch(error){if(signal?.aborted)throw error;context.warn(lines[i],error.message);}caption='';captionAttrs={};captionConfig=null;figureNotes=[];continue;}
      if((match=trim.match(/^@mermaid\s+(.+)$/))){const attrs=attributes(match[1],captionAttrs);try{if(!diagrams.has(attrs.id))throw new Error(`Diagrama não encontrado: ${attrs.id}`);body.push(await diagram(diagrams.get(attrs.id),attrs));}catch(error){if(signal?.aborted)throw error;context.warn(lines[i],error.message);caption='';captionAttrs={};}continue;}
      if(/^\s*\|/.test(line)) {
        const rows=[line];while(i+1<lines.length&&(!lines[i+1].text.trim()||/^\s*\|/.test(lines[i+1].text))){i++;if(lines[i].text.trim())rows.push(lines[i].text);}
        const table=parseTable(rows),count=table.count;
        const columns=table.modes.map(mode=>`>{${COMMANDS[mode]}\\arraybackslash}X`).join('');
        const content=table.rows.map((row,index)=>row.map(({value})=>{
          const cell=alignedCell(value);
          return cell?`\\multicolumn{1}{>{${COMMANDS[cell.mode]}\\arraybackslash}p{\\carboncellwidth}}{${inline(cell.content,context)}}`:inline(value,context);
        }).join(' & ')+` \\\\${index===0?' \\midrule':''}`).join('\n');
        const tableBody=`\\setlength{\\JustifyingParindent}{0pt}\n\\setlength{\\carboncellwidth}{\\dimexpr${captionAttrs.width||1}\\linewidth/${count}-2\\tabcolsep\\relax}\n\\begin{tabularx}{${captionAttrs.width||1}\\linewidth}{${columns}}\n\\toprule\n${content}\n\\bottomrule\n\\end{tabularx}`;
        body.push(presentTable({content:tableBody,label:caption,attrs:{...captionAttrs,placement:columnDepth||documentOptions.columns?'H':captionAttrs.placement},config:captionConfig,notes:figureNotes,inline:value=>inline(value,context)}));caption='';captionAttrs={};captionConfig=null;figureNotes=[];continue;
      }
      if((match=line.match(/^(#{1,3})\s+(.+)$/))){body.push(`\\${(type==='report'?['chapter','section','subsection']:['section','subsection','subsubsection'])[match[1].length-1]}{${inline(match[2],context)}}`);continue;}
      if(/^@print_bibliography(?:\[style=\w+\])?\s*$/.test(line)){body.push('\u0001BIBLIOGRAPHY\u0001');continue;}
      if(/^@\w+/.test(line)&&!/^@(cite|cites|refs|var|ref|autoref|pageref|eqref)\(/.test(line))throw new Error(`Diretiva desconhecida: ${line.split(/\s/)[0]}`);
      body.push(inline(line,context));
    }catch(error){const diagnostic={severity:'error',file:sourceFile||file,line:number,column:1,message:error.message};const failure=new Error(`${diagnostic.file}: Linha ${number}: ${error.message}`);failure.diagnostics=[...diagnostics,diagnostic];throw failure;}
  }
  closeLists();
  if(scopes.length){const scope=scopes.at(-1),message='bloco @'+scope.kind+' sem ] de fechamento.',error=new Error(`${scope.origin.file}: Linha ${scope.origin.line}: ${message}`);error.diagnostics=[...diagnostics,{severity:'error',...scope.origin,column:1,message}];throw error;}
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
    return `\\par\\noindent\\hypertarget{bib:${key}}{}${numeric?`[${index+1}] `:''}${fields}.${e.url?' '+styledLink(`\\url{${escape(e.url)}}`,context.links&&(context.links.all||context.links.external)?{...context.links.all,...context.links.external}:null):''}\\par\\medskip`;
  }).join('\n');
  const formattedAuthors=authors.map(author=>{const a=author.match(/^\[(.+)\]\{(.+)\}$/);return a?`${inline(a[1],context)}\\\\{\\small ${inline(a[2],context)}}`:inline(author,context);}).join(' \\and ');
  const fontsize=layout.typography.fontsize;
  const classSize=['10pt','11pt','12pt'].includes(fontsize)?fontsize:'12pt';
  const geometry=[layout.page.size.toLowerCase()+'paper',layout.page.orientation,...Object.entries(layout.margins).map(([key,value])=>`${key}=${value}`)].join(',');
  const fonts=await fontPreamble(layout.typography.font,directory);
  const format=value=>inline(value,context);
  const stationery=pageStyle(pageRules,format,type==='report');
  const opening=type==='cv'?cvHeader(title||authors[0]||'Currículo',headline,contacts,format):(title?'\\maketitle':'');
  const renderedBody=body.map(item=>item.replaceAll('\u0001BIBLIOGRAPHY\u0001',bibliography));
  const tex=`\\documentclass[${classSize},${layout.page.size.toLowerCase()}paper]{${type==='cv'?'article':type}}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
${semantic.language?"\\usepackage["+localized.babel+"]{babel}":""}
${fonts}
${classSize!==fontsize?`\\usepackage[fontsize=${fontsize}]{scrextend}`:''}
\\usepackage{amsmath,amssymb,graphicx,booktabs,tabularx,enumitem,float}
\\usepackage{ragged2e}
\\usepackage{xcolor,multicol,caption,subcaption,overpic,xurl,amsthm,needspace,listings}
${documentOptions.columns||lines.some(entry=>/^\s*@columns\[/.test(entry.text))?"\\usepackage[tikz]{multicolrule}":""}
\\lstdefinelanguage{JavaScript}{keywords={const,let,var,function,return,if,else,class,new,async,await,throw,try,catch,import,export},sensitive=true,morecomment=[l]{//},morecomment=[s]{/*}{*/},morestring=[b]"}
\\newtheorem{theorem}{${localized.theorem}}
\\newtheorem{definition}{${localized.definition}}
\\renewcommand{\\proofname}{${localized.proof}}
\\providecommand{\\abstractname}{${localized.abstract}}
\\renewcommand{\\abstractname}{${localized.abstract}}
\\renewcommand{\\thesubfigure}{(\\alph{subfigure})}
\\captionsetup[subfigure]{labelformat=simple}
\\newlength{\\carbongroupwidth}
\\newsavebox{\\carbonmediabox}
\\newcommand{\\carbonpapersize}[2]{\\global\\paperwidth=#1\\relax\\global\\paperheight=#2\\relax\\ifdefined\\pdfpagewidth\\global\\pdfpagewidth=#1\\relax\\global\\pdfpageheight=#2\\relax\\else\\special{papersize=#1,#2}\\fi}
\\newlength{\\carboncellwidth}
\\usepackage[normalem]{ulem}
\\usepackage[${geometry}]{geometry}
${layout.paragraph['indent-after-heading']==='true'?'\\usepackage{indentfirst}':''}
\\setlength{\\parindent}{${layout.paragraph['indent-first']}}
\\setlength{\\parskip}{${layout.paragraph['spacing-after']}}
\\usepackage{etoolbox}
\\AtBeginEnvironment{document}{\\AddToHook{para/before}{\\vspace{${layout.paragraph['spacing-before']}}}}
\\usepackage{setspace}
\\setstretch{${layout.typography.lineheight}}
\\usepackage[unicode,hidelinks]{hyperref}
\\renewcommand{\\contentsname}{${localized.contents}}
\\renewcommand{\\figurename}{${localized.figure}}
\\renewcommand{\\tablename}{${localized.table}}
\\def\\figureautorefname{${localized.figure}}
\\def\\subfigureautorefname{${localized.figure}}
\\def\\tableautorefname{${localized.table}}
${stationery}
${type==='cv'?'\\setcounter{secnumdepth}{0}'+(!explicit.includes('paragraph')?'\n\\setlength{\\parindent}{0pt}':''):''}
\\title{${inline(title,context)}}
\\author{${formattedAuthors}}
\\date{${date==='@today'?'\\today':inline(date,context)}}
\\begin{document}
${opening}
${documentOptions.columns?columnOpening(documentOptions.columns).tex:''}
% carbon:begin-body
${renderedBody.join('\n')}
${documentOptions.columns?'\\end{'+columnOpening(documentOptions.columns).environment+'}\\endgroup':''}
\\end{document}
`;
  const sourceMap=[];let generatedLine=tex.slice(0,tex.indexOf('% carbon:begin-body')).split('\n').length+1;
  for(let index=0;index<renderedBody.length;index++){const count=renderedBody[index].split('\n').length;for(let offset=0;offset<count;offset++)sourceMap.push({generatedLine:generatedLine+offset,...bodyOrigins[index]});generatedLine+=count;}
  return {tex,citations:cited.length,style,layout,diagnostics,dependencies:[...dependencies],sourceMap};
}
async function compileCarbon(source,options) {
  const result=await (options.isolate?require('./isolated-transpile.cjs').isolatedTranspile(source,options):transpile(source,options));
  const file=path.join(options.directory,'preview.tex');await fs.writeFile(file,result.tex);
  options.onLog?.('stdout','Carbon → LaTeX concluído. Compondo PDF com Tectonic…\n');
  const run=await runCompiler(options.tectonic,['--untrusted','--keep-logs','--keep-intermediates','--outdir',options.directory,file],{cwd:options.directory,timeout:options.timeout,signal:options.signal,onLog:options.onLog});
  if(run.code!==0){const message=run.stderr||run.stdout||'Falha no motor LaTeX.';const generated=Number(message.match(/(?:preview\.tex:|l\.)(\d+)/)?.[1]);const origin=result.sourceMap.find(entry=>entry.generatedLine===generated)||{file:options.file||path.join(options.base,'documento.cb'),line:1};const error=new Error(message);error.diagnostics=[...result.diagnostics,{severity:'error',file:origin.file,line:origin.line,column:1,message}];throw error;}
  return result;
}
module.exports={transpile,compileCarbon,escape,math};
