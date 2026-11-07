'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {readLayout,applyLayout,placement}=require('../electron/layout.cjs');
const {transpile,compileCarbon}=require('../electron/carbon.cjs');
async function temporary(t){const directory=await fs.mkdtemp(path.join(os.tmpdir(),'carbon-layout-'));t.after(()=>fs.rm(directory,{recursive:true,force:true}));return {base:directory,directory};}
test('document settings accept comments, partial defaults and all supported paper sizes',()=>{
 const input='@margins {\n top: 2.5cm, # superior\n bottom: 25mm,\n left: 1in,\n right: 2cm\n}\n@page {size: Legal, orientation: landscape}\n@typography {font: "Liberation Sans", fontsize: 14pt, lineheight: 1.5}\n# Conteúdo';
 const {layout,remaining}=readLayout(input,'letter');assert.equal(layout.page.size,'Legal');assert.equal(layout.page.orientation,'landscape');assert.equal(layout.typography.font,'Liberation Sans');assert.equal(layout.margins.bottom,'25mm');assert.equal(remaining.length,1);
 for(const size of ['A4','Letter','Legal','A5'])assert.equal(readLayout(`@page {size: ${size}}`).layout.page.size,size);
 assert.equal(readLayout('', 'legal').layout.page.size,'Legal');
});
test('layout validation rejects malformed blocks, impossible margins and injected values',()=>{
 for(const [source,message] of [
  ['@page {size: A3}',/A4, Letter/],['@page {orientation: sideways}',/orientation/],
  ['@margins {left: -2cm}',/Margem inválida/],['@margins {top: 2px}',/cm, mm ou in/],['@margins {left: 20cm, right: 10cm}',/área útil/],
  ['@typography {fontsize: 12}',/fontsize/],['@typography {lineheight: 0}',/lineheight/],['@typography {font: "Arial\\input"}',/família/],
  ['@page {size: A4, size: A5}',/duplicada/],['@page {size: A4}\n@page {size: A5}',/duplicado/],
  ['@page {size: A4',/fechamento/],['@page {unknown: A4}',/propriedade inválida/],['@page {size: A4} trailing',/inesperado/],
 ])assert.throws(()=>readLayout(source),message,source);
});
test('applying layout preserves literal examples and the body, and is idempotent',()=>{
 const source='@title Preservar\n@page {size: A5}\n\n```carbon\n@page {size: Legal}\n```\n\n# Corpo\nTexto.\n';
 const config=readLayout('@margins {top: 2cm}\n@page {size: Letter}\n@typography {lineheight: 1.5}').layout;
 const updated=applyLayout(source,config);assert.equal(updated.match(/@page/g).length,2);assert.ok(updated.includes('```carbon\n@page {size: Legal}\n```'));assert.ok(updated.includes('# Corpo\nTexto.\n'));assert.equal(readLayout(updated).layout.page.size,'Letter');assert.equal(applyLayout(updated,config),updated);
});
test('float aliases have precise placement and override semantics',()=>{
 for(const token of ['here','h','here, top','h, t'])assert.equal(placement(`pos=[${token}]`),'H');
 for(const [token,value] of [['top','t'],['t','t'],['bottom','b'],['b','b'],['page','p'],['p','p'],['override','!htbp'],['!','!htbp'],['override, top','!t'],['top, bottom, page','tbp']])assert.equal(placement(`pos=[${token}]`),value);
 assert.throws(()=>placement('pos=[middle]'),/Posição inválida/);assert.throws(()=>placement('pos=top'),/Posição inválida/);assert.throws(()=>placement('pos=[]'),/Posição inválida/);
});
test('layout translates to geometry, real type size, spacing, floats and page breaks',async t=>{
 const options=await temporary(t);await fs.copyFile(path.resolve(__dirname,'../logo.png'),path.join(options.base,'logo.png'));
 const {tex,layout}=await transpile('@title Layout\n@page {size: A5, orientation: landscape}\n@margins {top: 12mm, bottom: 12mm, left: 12mm, right: 12mm}\n@typography {fontsize: 14pt, lineheight: 1.5}\n![Marca](logo.png){#fig:logo pos=[here, top] width=20%}\n@caption Dados {#table:dados pos=[override, top]}\n| A | B |\n| --- | --- |\n| 1 | 2 |\n@newpage\nSegunda página.',options);
 assert.equal(layout.page.size,'A5');assert.match(tex,/a5paper,landscape,top=12mm/);assert.match(tex,/fontsize=14pt/);assert.match(tex,/\\setstretch\{1.5\}/);assert.match(tex,/\\begin\{figure\}\[H\]/);assert.match(tex,/\\begin\{table\}\[!t\]/);assert.match(tex,/\\newpage/);assert.doesNotMatch(tex,/@newpage/);
});
test('layout commands remain literal inside code fences',async t=>{
 const options=await temporary(t);const {tex,layout}=await transpile('```carbon\n@page {size: Legal}\n@newpage\n```',options);assert.equal(layout.page.size,'A4');assert.match(tex,/@page \{size: Legal\}/);assert.match(tex,/@newpage/);
});
test('caption placement propagates to images and Mermaid without leaking to the next element',async t=>{
 const options=await temporary(t);await fs.copyFile(path.resolve(__dirname,'../logo.png'),path.join(options.base,'logo.png'));
 const cli=path.join(options.base,'mermaid.cjs');await fs.writeFile(cli,`require('node:fs').copyFileSync(${JSON.stringify(path.join(options.base,'logo.png'))},process.argv[process.argv.indexOf('-o')+1]);`);
 options.mermaid=cli;options.node=process.execPath;
 const {tex}=await transpile('@caption Marca {#fig:marca pos=[bottom]}\n![](logo.png)\n@caption Diagrama {#fig:fluxo pos=[page]}\n```mermaid\ngraph LR\nA --> B\n```\n@caption Dados\n| A | B |\n| --- | --- |\n| 1 | 2 |',options);
 assert.match(tex,/\\begin\{figure\}\[b\]/);assert.match(tex,/\\label\{fig:marca\}/);assert.match(tex,/\\begin\{figure\}\[p\]/);assert.match(tex,/\\label\{fig:fluxo\}/);assert.match(tex,/\\begin\{table\}\[htbp\]/);
});
test('real layout PDF with fixed floats, page break, custom font and nonstandard size',{skip:!process.env.CARBON_TEST_PDF,timeout:180000},async t=>{
 const options=await temporary(t);options.base=path.resolve(__dirname,'../examples');options.tectonic=path.resolve(__dirname,'../build/tectonic.exe');options.timeout=170000;
 await compileCarbon(await fs.readFile(path.join(options.base,'layout.cb'),'utf8'),options);
 const bytes=await fs.readFile(path.join(options.directory,'preview.pdf'));assert.equal(bytes.subarray(0,5).toString(),'%PDF-');
 const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
 const task=pdfjs.getDocument({data:new Uint8Array(bytes),useSystemFonts:false}),pdf=await task.promise;
 try{
   assert.equal(pdf.numPages,2,'A quebra manual deve separar as duas páginas do exemplo.');
   const first=await pdf.getPage(1),second=await pdf.getPage(2);
   assert.ok(Math.abs(first.view[2]-210/25.4*72)<1,'Largura A5 em paisagem');
   assert.ok(Math.abs(first.view[3]-148/25.4*72)<1,'Altura A5 em paisagem');
   const items=(await first.getTextContent()).items;
   const body=items.find(item=>item.str?.startsWith('Este documento usa'));
   assert.ok(body,'Texto inicial presente na primeira página');
   assert.ok(Math.abs(body.height-14*72/72.27)<.1,'O texto normal deve ter 14pt reais');
   assert.ok(Math.abs(body.transform[4]-20/25.4*72)<1,'Margem esquerda de 2cm');
   const next=items.find(item=>item.str?.startsWith('sem serifa'));
   assert.ok(next&&Math.abs(body.transform[5]-next.transform[5]-25.1)<1,'Entrelinha 1.5 aplicada ao texto');
   assert.ok(items.some(item=>item.str?.includes('Marca Carbon')),'Figura fixa antes da quebra');
   const secondText=(await second.getTextContent()).items.map(item=>item.str||'').join(' ');
   assert.match(secondText,/Uma nova página/);assert.match(secondText,/Resultados/);
 }finally{await task.destroy();}
 const saved=process.env.CARBON_LAYOUT_OUTPUT;if(saved){await fs.mkdir(saved,{recursive:true});await fs.copyFile(path.join(options.directory,'preview.pdf'),path.join(saved,'layout.pdf'));await fs.copyFile(path.join(options.directory,'preview.tex'),path.join(saved,'layout.tex'));}
});
test('real Windows font family is copied locally for Tectonic',{skip:!process.env.CARBON_TEST_PDF||process.platform!=='win32',timeout:180000},async t=>{
 const options=await temporary(t);options.tectonic=path.resolve(__dirname,'../build/tectonic.exe');options.timeout=170000;
 const result=await compileCarbon('@title Fonte Windows\n@typography {font: "Arial", fontsize: 11pt, lineheight: 1.2}\nTexto com **negrito**, *itálico* e $E=mc^2$.',options);assert.match(result.tex,/document-font-regular\.ttf/);assert.equal((await fs.readFile(path.join(options.directory,'preview.pdf'))).subarray(0,5).toString(),'%PDF-');
});
