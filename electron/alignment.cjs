'use strict';
const MODES={left:'left',l:'left',center:'center',c:'center',right:'right',r:'right',justify:'justify',j:'justify'};
const COMMANDS={left:'\\RaggedRight',center:'\\Centering',right:'\\RaggedLeft',justify:'\\justifying'};
const MARKERS={left:':---',center:':---:',right:'---:',justify:':---='};
function alignment(value){
  const key=String(value).trim().toLowerCase();
  if(!Object.hasOwn(MODES,key))throw new Error(`Alinhamento inválido: ${value}. Use left/l, center/c, right/r ou justify/j.`);
  return MODES[key];
}
function closingBracket(text,start){
  let depth=1,math=false;
  for(let i=start;i<text.length;i++){
    if(text[i]==='\\'){i++;continue;}
    if(text[i]==='$'&&(math||(!/[\p{L}\p{N}]/u.test(text[i-1]||' ')&&/(?<!\\)\$/.test(text.slice(i+1))))){math=!math;continue;}
    if(math)continue;
    if(text[i]==='[')depth++;
    if(text[i]===']'&&!--depth)return i;
  }
  throw new Error('@align sem ] de fechamento.');
}
function alignedCell(text){
  const trimmed=text.trim(),match=trimmed.match(/^@align\(([^)]*)\)\[/);
  if(!match){if(trimmed.startsWith('@align'))throw new Error('Use @align(center)[conteúdo] envolvendo toda a célula.');return null;}
  const mode=alignment(match[1]),end=closingBracket(trimmed,match[0].length);
  if(trimmed.slice(end+1).trim())throw new Error('@align deve envolver todo o conteúdo da célula ou do parágrafo.');
  const content=trimmed.slice(match[0].length,end);
  if(/@align\(/.test(content))throw new Error('Use um único @align por célula. Blocos de texto podem ser aninhados.');
  return {mode,content};
}
function tableCells(row){
  const segments=[];let begin=0,math=false,code=false;
  for(let i=0;i<row.length;i++){
    const char=row[i];
    if(char==='\\'){i++;continue;}
    if(char==='`'&&!math){code=!code;continue;}
    if(code)continue;
    if(char==='$'&&(math||(!/[\p{L}\p{N}]/u.test(row[i-1]||' ')&&/(?<!\\)\$/.test(row.slice(i+1))))){math=!math;continue;}
    if(math)continue;
    if(row.startsWith('@align(',i)){
      const match=row.slice(i).match(/^@align\([^)]*\)\[/);
      if(match){i=closingBracket(row,i+match[0].length);continue;}
    }
    if(char==='|'){segments.push({begin,end:i});begin=i+1;}
  }
  segments.push({begin,end:row.length});
  if(/^\s*\|/.test(row))segments.shift();
  if(/(?<!\\)\|\s*$/.test(row))segments.pop();
  return segments.map(({begin,end})=>{
    const raw=row.slice(begin,end),left=raw.length-raw.trimStart().length,right=raw.trimEnd().length;
    return {value:raw.trim(),begin,end,start:begin+left,finish:begin+Math.max(left,right)};
  });
}
function separator(cells){
  if(!cells.every(cell=>/^(?:-+|:-+|-+:|:-+:|:-+=)$/.test(cell.value)))return null;
  return cells.map(({value})=>value.endsWith('=')?'justify':value.startsWith(':')&&value.endsWith(':')?'center':value.endsWith(':')?'right':'left');
}
function parseTable(rows){
  const parsed=rows.map(tableCells),count=parsed[0]?.length||0;
  if(!count||parsed.some(row=>row.length!==count))throw new Error('Todas as linhas da tabela devem ter o mesmo número de colunas.');
  const modes=parsed[1]?separator(parsed[1]):null;
  if(!modes&&parsed[1]?.some(cell=>/^:?-+[:=]?$/.test(cell.value)))throw new Error('Linha divisória de tabela inválida. Use ---, :---, :---:, ---: ou :---=.');
  const data=parsed.filter((row,index)=>{
    if(index===1&&modes)return false;
    if(index>1&&separator(row))throw new Error('A linha divisória deve aparecer apenas após o cabeçalho.');
    return true;
  });
  return {modes:modes||Array(count).fill('left'),rows:data,count};
}
function alignmentEdit(source,{target,mode,startLineNumber,startColumn,endLineNumber=startLineNumber,endColumn=startColumn}){
  mode=alignment(mode);
  const lines=source.replace(/\r\n?/g,'\n').split('\n');
  for(const [name,value] of Object.entries({startLineNumber,endLineNumber,startColumn,endColumn}))if(!Number.isInteger(value)||value<1)throw new Error(`Seleção inválida: ${name}`);
  if(endLineNumber<startLineNumber||endLineNumber>lines.length||startColumn>lines[startLineNumber-1].length+1||endColumn>lines[endLineNumber-1].length+1||(startLineNumber===endLineNumber&&endColumn<startColumn))throw new Error('Seleção de texto inválida.');
  const range=(start,end,startCol=1,endCol=lines[end-1].length+1)=>({startLineNumber:start,endLineNumber:end,startColumn:startCol,endColumn:endCol});
  if(target==='block'){
    const empty=startLineNumber===endLineNumber&&startColumn===endColumn;
    if(empty){startColumn=1;endColumn=lines[startLineNumber-1].length+1;}
    const selected=lines.slice(startLineNumber-1,endLineNumber).map((line,index,array)=>line.slice(index===0?startColumn-1:0,index===array.length-1?endColumn-1:undefined)).join('\n');
    const prefix=startColumn>1?'\n':'',suffix=endColumn<=lines[endLineNumber-1].length?'\n':'';
    return {range:range(startLineNumber,endLineNumber,startColumn,endColumn),text:`${prefix}@align(${mode})[\n${selected||'Seu texto aqui.'}\n]${suffix}`};
  }
  const row=lines[startLineNumber-1];
  if(!/^\s*\|/.test(row))throw new Error('Coloque o cursor em uma linha de tabela iniciada por |.');
  const cells=tableCells(row),offset=startColumn-1;
  if(!cells.length)throw new Error('A linha da tabela precisa conter ao menos uma célula.');
  let column=cells.findIndex(cell=>offset>=cell.begin&&offset<=cell.end);if(column<0)column=offset<cells[0].begin?0:cells.length-1;
  if(target==='cell'){
    if(separator(cells))throw new Error('Selecione uma célula de conteúdo, não a linha divisória.');
    const cell=cells[column],existing=alignedCell(cell.value);
    return {range:range(startLineNumber,startLineNumber,cell.start+1,cell.finish+1),text:`@align(${mode})[${existing?existing.content:cell.value}]`};
  }
  if(target==='column'){
    let first=startLineNumber-1;
    while(first>0&&(/^\s*\|/.test(lines[first-1])||!lines[first-1].trim()))first--;
    while(!lines[first].trim())first++;
    let second=first+1;while(second<lines.length&&!lines[second].trim())second++;
    const header=tableCells(lines[first]);
    if(column>=header.length)throw new Error('A célula não corresponde às colunas do cabeçalho.');
    const existing=second<lines.length&&/^\s*\|/.test(lines[second])?tableCells(lines[second]):null;
    const modes=existing?separator(existing):null;
    if(modes){
      if(existing.length!==header.length)throw new Error('A linha divisória e o cabeçalho têm números diferentes de colunas.');
      const cell=existing[column];return {range:range(second+1,second+1,cell.start+1,cell.finish+1),text:MARKERS[mode]};
    }
    const markers=header.map((_,index)=>index===column?MARKERS[mode]:'---');
    return {range:range(first+1,first+1,lines[first].length+1,lines[first].length+1),text:'\n| '+markers.join(' | ')+' |'};
  }
  throw new Error('Escolha bloco, coluna ou célula.');
}
module.exports={alignment,COMMANDS,alignedCell,tableCells,separator,parseTable,alignmentEdit};
