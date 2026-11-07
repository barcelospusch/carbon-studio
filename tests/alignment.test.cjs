'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {alignment,alignedCell,tableCells,parseTable,alignmentEdit}=require('../electron/alignment.cjs');
const {transpile,compileCarbon}=require('../electron/carbon.cjs');
async function temporary(t){const directory=await fs.mkdtemp(path.join(os.tmpdir(),'carbon-align-'));t.after(()=>fs.rm(directory,{recursive:true,force:true}));return {base:directory,directory};}
test('alignment aliases and bracketed content are parsed without losing links or math',()=>{
 for(const [mode,aliases] of Object.entries({left:['left','l','L'],center:['center','c','C'],right:['right','r','R'],justify:['justify','j','J']}))for(const alias of aliases)assert.equal(alignment(alias),mode);
 assert.deepEqual(alignedCell('@align(C)[**OK** e [link](https://example.com) $[x,y]$]'),{mode:'center',content:'**OK** e [link](https://example.com) $[x,y]$'});
 assert.equal(alignedCell('@align(r)[R$ 15,00]').content,'R$ 15,00');
 assert.throws(()=>alignment('middle'),/Alinhamento inválido/);assert.throws(()=>alignedCell('@align(c)[sem fim'),/fechamento/);assert.throws(()=>alignedCell('@align(c)[ok] resto'),/todo o conteúdo/);
});
test('table parser handles four column modes, currency, escaped pipes and mathematical pipes',()=>{
 const table=parseTable(['| Esquerda | Centro | Direita | Justificado |','| :--- | :---: | ---: | :---= |','| R$ 15,00 | @align(c)[A | B] | $|x|$ | a\\|b |']);
 assert.deepEqual(table.modes,['left','center','right','justify']);assert.equal(table.rows.length,2);assert.equal(table.rows[1][0].value,'R$ 15,00');assert.equal(table.rows[1][1].value,'@align(c)[A | B]');assert.equal(table.rows[1][2].value,'$|x|$');assert.equal(table.rows[1][3].value,'a\\|b');
 assert.deepEqual(parseTable(['| A | B |','| --- | --- |']).modes,['left','left']);
 assert.throws(()=>parseTable(['| A | B |','| --- | wrong |']),/divisória/);assert.throws(()=>parseTable(['| A | B |','| --- |']),/mesmo número/);
});
test('scoped text alignment, nested blocks and cell overrides produce safe LaTeX',async t=>{
 const options=await temporary(t);const {tex}=await transpile('@align(right)[\nExterior\n@align(l)[\nInterior **forte** $x_i$\n]\nExterior novamente\n]\nTexto normal.\n\n| A | B | C | D |\n| --- | :---: | ---: | :---= |\n| @align(right)[OK] | Centro | 10 | Texto justificado. |',options);
 assert.equal((tex.match(/\\begingroup/g)||[]).length,2);assert.equal((tex.match(/\\endgroup/g)||[]).length,2);assert.match(tex,/\\par\\begingroup\n\\RaggedLeft/);assert.match(tex,/\\textbf\{forte\} \$x_i\$/);assert.match(tex,/>\{\\RaggedRight\\arraybackslash\}X>\{\\Centering\\arraybackslash\}X>\{\\RaggedLeft\\arraybackslash\}X>\{\\justifying\\arraybackslash\}X/);assert.match(tex,/\\multicolumn\{1\}.*CELL|\\multicolumn\{1\}.*\{OK\}/);assert.doesNotMatch(tex,/:---=/);
});
test('alignment errors have source lines and code samples stay literal',async t=>{
 const options=await temporary(t);await assert.rejects(transpile('@align(c)[\nTexto',options),/Linha 1: bloco @align sem/);await assert.rejects(transpile('@align(nope)[\nTexto\n]',options),/Linha 1: Alinhamento inválido/);await assert.rejects(transpile(']',options),/sem um bloco/);
 const {tex}=await transpile('```carbon\n@align(center)[\nAmostra\n]\n```',options);assert.match(tex,/@align\(center\)\[/);
});
test('editor transforms selections, columns and individual cells while preserving content',()=>{
 const selected=alignmentEdit('Texto simples.',{target:'block',mode:'c',startLineNumber:1,startColumn:1,endLineNumber:1,endColumn:15});assert.equal(selected.text,'@align(center)[\nTexto simples.\n]');
 const source='| A | B |\n| --- | ---: |\n| Um | @align(c)[Dois] |';
 const column=alignmentEdit(source,{target:'column',mode:'j',startLineNumber:3,startColumn:10});assert.equal(column.text,':---=');assert.equal(column.range.startLineNumber,2);
 const cell=alignmentEdit(source,{target:'cell',mode:'r',startLineNumber:3,startColumn:10});assert.equal(cell.text,'@align(right)[Dois]');assert.equal(cell.range.startLineNumber,3);
 const added=alignmentEdit('| A | B |\n| Um | Dois |',{target:'column',mode:'center',startLineNumber:2,startColumn:9});assert.equal(added.text,'\n| --- | :---: |');
 const blank=alignmentEdit('|   | B |',{target:'cell',mode:'left',startLineNumber:1,startColumn:2});assert.ok(blank.range.endColumn>=blank.range.startColumn);
 assert.throws(()=>alignmentEdit(source,{target:'cell',mode:'l',startLineNumber:2,startColumn:3}),/divisória/);assert.throws(()=>alignmentEdit('Texto',{target:'column',mode:'l',startLineNumber:1,startColumn:1}),/tabela/);
});
test('real PDF places paragraphs, columns and the cell override at the expected coordinates',{skip:!process.env.CARBON_TEST_PDF,timeout:180000},async t=>{
 const options=await temporary(t);options.base=path.resolve(__dirname,'../examples');options.tectonic=path.resolve(__dirname,'../build/tectonic.exe');options.timeout=170000;
 await compileCarbon(await fs.readFile(path.join(options.base,'alinhamento.cb'),'utf8'),options);
 const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs'),bytes=await fs.readFile(path.join(options.directory,'preview.pdf'));
 const task=pdfjs.getDocument({data:new Uint8Array(bytes),useSystemFonts:false}),pdf=await task.promise;
 try{
  assert.equal(pdf.numPages,1);const page=await pdf.getPage(1),items=(await page.getTextContent()).items;
  const item=text=>{const found=items.find(item=>item.str===text);assert.ok(found,`Texto ausente: ${text}`);return found;};
  const width=page.view[2],left=20/25.4*72,right=width-left,usable=right-left,tab=6*72/72.27;
  assert.ok(Math.abs(item('Alinhado à esquerda.').transform[4]-left)<1);
  assert.ok(Math.abs(item('Texto centralizado.').transform[4]+item('Texto centralizado.').width/2-width/2)<1);
  assert.ok(Math.abs(item('Alinhado à direita.').transform[4]+item('Alinhado à direita.').width-right)<1);
  assert.ok(Math.abs(item('Bloco interno à esquerda.').transform[4]-left)<1);
  assert.ok(Math.abs(item('Retorno ao alinhamento externo.').transform[4]+item('Retorno ao alinhamento externo.').width-right)<1);
  assert.ok(item('Texto fora dos blocos.').transform[4]<width/2,'O alinhamento não pode vazar após o bloco.');
  assert.ok(Math.abs(item('Item A').transform[4]-(left+tab))<1);
  assert.ok(Math.abs(item('100').transform[4]+item('100').width/2-(left+usable*3/8))<1);
  assert.ok(Math.abs(item('15,00').transform[4]+item('15,00').width-(left+usable*3/4-tab))<1);
  assert.ok(Math.abs(item('Exceção').transform[4]+item('Exceção').width-(left+usable/4-tab))<1,'A célula direita deve usar a mesma largura da coluna.');
  assert.ok(Math.abs(item('250').transform[4]+item('250').width/2-(left+usable*3/8))<1,'A célula seguinte mantém a centralização da coluna.');
  const paragraph=items.find(item=>item.str?.startsWith('O Carbon permite escrever'));
  const paragraphLine=items.filter(item=>item.str?.trim()&&Math.abs(item.transform[5]-paragraph.transform[5])<.1);
  assert.ok(Math.abs(Math.max(...paragraphLine.map(item=>item.transform[4]+item.width))-right)<1,'O parágrafo justificado deve preencher a margem direita.');
  const justified=items.filter(entry=>entry.str?.trim()&&entry.transform[4]>=left+usable*3/4+tab-1&&Math.abs(entry.transform[5]-item('Item A').transform[5])<.1);
  assert.ok(Math.abs(Math.min(...justified.map(item=>item.transform[4]))-(left+usable*3/4+tab))<1,'A célula justificada não deve herdar o recuo do parágrafo.');
  assert.ok(Math.abs(Math.max(...justified.map(item=>item.transform[4]+item.width))-(right-tab))<1,'A linha justificada da célula deve preencher sua largura.');
 }finally{await task.destroy();}
 if(process.env.CARBON_ALIGNMENT_OUTPUT){await fs.mkdir(process.env.CARBON_ALIGNMENT_OUTPUT,{recursive:true});await fs.copyFile(path.join(options.directory,'preview.pdf'),path.join(process.env.CARBON_ALIGNMENT_OUTPUT,'alinhamento.pdf'));}
});
