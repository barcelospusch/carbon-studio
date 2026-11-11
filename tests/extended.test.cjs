'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {transpile,compileCarbon}=require('../electron/carbon.cjs');
const {stripComments}=require('../electron/source.cjs');
const {readDocument}=require('../electron/core.cjs');
const {compilationRoot}=require('../electron/compilation-project.cjs');
const {readDocumentOptions,applyDocumentOptions}=require('../electron/document-options.cjs');
async function options(t){const directory=await fs.mkdtemp(path.join(os.tmpdir(),'carbon-extended-'));t.after(()=>fs.rm(directory,{recursive:true,force:true}));return {base:directory,directory,file:path.join(directory,'main.cb')};}
test('comments retain source positions, strings, URLs, headings and literal code',()=>{
 const source='# Heading\n// comment\n"// literal" https://example.com\n/* multi\nline */ Text\n```js\n// code\n```\n@code[language=javascript][\n/* code */\n]\n';
 const stripped=stripComments(source);assert.equal(stripped.split('\n').length,source.split('\n').length);assert.equal(stripped.split('\n')[1].length,source.split('\n')[1].length);assert.match(stripped,/# Heading/);assert.match(stripped,/"\/\/ literal" https:\/\/example.com/);assert.match(stripped,/\/\/ code/);assert.match(stripped,/\/\* code \*\//);assert.doesNotMatch(stripped,/multi|line \*\//);assert.equal(stripComments('$$x // y$$ // comment').trim(),'$$x // y$$');assert.match(stripComments('@code[\n$$\n]\n// comment'),/\]\n +$/);assert.throws(()=>stripComments('Text\n/* missing'),/Linha 2/);
});
test('nested includes preserve origins, asset bases, ordering, warnings and cross references',async t=>{
 const o=await options(t);await fs.mkdir(path.join(o.base,'chapters'));await fs.copyFile(path.resolve(__dirname,'../logo.png'),path.join(o.base,'chapters','image.png'));
 const chapter=path.join(o.base,'chapters','one.cb');await fs.writeFile(chapter,'# One\n@include two.cb\n![Caption](image.png){#fig:one}\n![Missing](missing.png)');await fs.writeFile(path.join(o.base,'chapters','two.cb'),'## Two\n@eq[label=eq:two][\nx=2\n]');
 const source='@include chapters/one.cb\n# Last\n@eqref(eq:two) @autoref(fig:one)';await fs.writeFile(o.file,source);
 const result=await transpile(source,o);assert.ok(result.tex.indexOf('{One}')<result.tex.indexOf('{Two}'));assert.ok(result.tex.indexOf('{Two}')<result.tex.indexOf('{Last}'));assert.match(result.tex,/\\eqref\{eq:two\}/);assert.equal(result.diagnostics.length,1);assert.equal(result.diagnostics[0].file.toLowerCase(),chapter.toLowerCase());assert.equal(result.diagnostics[0].line,4);assert.equal(result.diagnostics[0].severity,'warning');assert.doesNotMatch(result.tex,/Missing|missing\.png/);assert.ok(result.sourceMap.some(item=>item.file.toLowerCase()===chapter.toLowerCase()&&item.line===3));
 assert.equal((await compilationRoot(o.base,['main.cb','chapters/one.cb','chapters/two.cb'],chapter,await fs.readFile(chapter,'utf8'))).file.toLowerCase(),o.file.toLowerCase());
 await fs.writeFile(path.join(o.base,'chapters','two.cb'),'@include ../main.cb\nStill valid.');const cycle=await transpile(source,o);assert.ok(cycle.diagnostics.some(item=>/circular/.test(item.message)));assert.match(cycle.tex,/Still valid/);
});
test('comments and directives stay literal in code, and malformed structures fail with origins',async t=>{
 const o=await options(t);const result=await transpile('@code[language=text caption="Literal code"][\n@page {size: A5}\n@include absent.cb\n// literal\n]\n@eq[\nx=1\n]',o);assert.match(result.tex,/@include absent.cb/);assert.match(result.tex,/@page \{size: A5\}/);assert.match(result.tex,/\/\/ literal/);assert.deepEqual(result.diagnostics,[]);
 await assert.rejects(transpile('@eq[\nx=1',o),error=>error.diagnostics[0].file===o.file&&error.diagnostics[0].line===1);
 await assert.rejects(transpile('@eq[number=none label=eq:bad][\nx=1\n]',o),/sem numeração/);
});
test('paragraphs, equations, semantic blocks, variables, styles and counters integrate',async t=>{
 const o=await options(t);const {tex}=await transpile('@language en\n@paragraph {indent-first: 1.25cm, indent-after-heading: true, spacing-before: 2pt, spacing-after: 6pt}\n@let energy = **Energy**\n@style emphasis {weight: bold, italic: true, indent: 1cm}\n@abstract[\nAbstract @var(energy).\n]\n@keywords energy, science\n@theorem[label=th:one title="Identity"][\n$x=x$\n]\n@proof[\nImmediate.\n]\n@definition[\nA definition.\n]\n@warning[\nWarning.\n]\n@note[\nA note.\n]\n@style[emphasis][\nStyled.\n]\n@paragraph[indent=0pt][\n**Inline** $x$ @var(energy).\n]\n@numbering[figure=Roman equation=arabic]\n@setcounter[figure=3]\n@keep[\nKept.\n]\n@keep-with-next\n@eq[number=none][\nx=2\n]\n@equations[number=7 label=eq:system][\nx+y=10\nx-y=2\n]',o);
 for(const fragment of ['\\usepackage[english]{babel}','\\setlength{\\parindent}{1.25cm}','\\usepackage{indentfirst}','\\textbf{Energy}','\\begin{theorem}[{Identity}]\\label{th:one}','\\begin{proof}','\\textbf{Keywords:}','\\setcounter{figure}{3}','\\begin{samepage}','\\begin{equation*}','\\tag{7}\\label{eq:system}'])assert.ok(tex.includes(fragment),fragment);
 await assert.rejects(transpile('@let a = @var(b)\n@let b = @var(a)\n@var(a)',o),/circular/);
});
test('caption settings apply to exactly the next image; subfigure references retain labels',async t=>{
 const o=await options(t);await fs.copyFile(path.resolve(__dirname,'../logo.png'),path.join(o.base,'image.png'));
 const source='@caption[position=right align=left width=30% gap=0.5cm]\n@source Adaptado de $x$.\n@note Supplemental.\n![Image text](image.png){#fig:first}\n![Second](image.png)\n@caption[position=top]\nUnrelated paragraph.\n![Third](image.png)\n@figure[group=horizontal gap=0.5cm label=fig:group][\n@subfigure[label=fig:a width=50%][\n@caption[position=bottom]\n![A](image.png)\n]\n@subfigure[label=fig:b width=50%][\n![B](image.png)\n]\n@group-caption Comparison.\n]\n@refs(fig:a,fig:b) @autoref(fig:group)';
 const figureOnly=await transpile('@caption[position=top] Table-only caption.\n![](image.png)',o);assert.doesNotMatch(figureOnly.tex,/Table-only caption/);
 const {tex}=await transpile(source,o);assert.match(tex,/\\caption\{Image text\}/);assert.match(tex,/Fonte: Adaptado/);assert.match(tex,/Nota: Supplemental/);assert.match(tex,/\\begin\{subfigure\}/);assert.match(tex,/\\label\{fig:a\}/);assert.match(tex,/\\label\{fig:b\}/);assert.match(tex,/\\label\{fig:group\}/);assert.equal((tex.match(/\\begin\{figure\}/g)||[]).length,4);assert.ok(tex.indexOf('\\caption{Third}')>tex.indexOf('asset-3.png'));
});
test('columns and links validate, persist in source, and reject unsafe options',async t=>{
 const o=await options(t);const source='@columns {count: 2, divider: true, balance: false}\n@links {color: "#0066CC", underline: true}\n@links[internal][\ncolor: "#333333", underline: false\n]\n# Text\n[External](https://example.com) @ref(fig:test)\n@columnbreak\nOther column.';
 const {tex}=await transpile(source,o);assert.match(tex,/\\begin\{multicols\*\}\{2\}/);assert.match(tex,/\\columnbreak/);assert.match(tex,/textcolor\[HTML\]\{0066CC\}/);assert.match(tex,/textcolor\[HTML\]\{333333\}/);
 const parsed=readDocumentOptions(source),config={columns:parsed.columns,links:parsed.links},edited=applyDocumentOptions(source,config);assert.equal(applyDocumentOptions(edited,config),edited);assert.match(edited,/# Text/);
 await assert.rejects(transpile('@columns {count: 1}',o),/2 e 10/);await assert.rejects(transpile('@links {color: "red\\input"}',o),/cor inválida/);
});
test('large UTF-8 documents are read and transpiled in a cancellable worker',async t=>{
 const o=await options(t),source='// '+'x'.repeat(9*1024*1024)+'\n# Large document\nValid content.';await fs.writeFile(o.file,source);assert.equal((await readDocument(o.file)).text,source);
 const {isolatedTranspile}=require('../electron/isolated-transpile.cjs');const result=await isolatedTranspile(source,o);assert.match(result.tex,/Large document/);
 const controller=new AbortController(),promise=isolatedTranspile(source,{...o,signal:controller.signal});setTimeout(()=>controller.abort(),10);await assert.rejects(promise,/cancelada/);
});
test('new scientific document produces a real PDF',{skip:!process.env.CARBON_TEST_PDF,timeout:180000},async t=>{
 const o=await options(t);o.tectonic=path.resolve(__dirname,'../build/tectonic.exe');await fs.mkdir(path.join(o.base,'figures'));await fs.copyFile(path.resolve(__dirname,'../logo.png'),path.join(o.base,'figures','logo.png'));
 const source=await fs.readFile(path.resolve(__dirname,'../examples/novos-recursos.cb'),'utf8');const result=await compileCarbon(source,o);assert.deepEqual(result.diagnostics,[]);assert.equal((await fs.readFile(path.join(o.directory,'preview.pdf'))).subarray(0,5).toString(),'%PDF-');
 const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs'),task=pdfjs.getDocument({data:new Uint8Array(await fs.readFile(path.join(o.directory,'preview.pdf')))}),pdf=await task.promise;
 try{assert.ok(pdf.numPages>=3);const dimensions=[];let allText='';for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i);dimensions.push(page.view.slice(2));allText+=(await page.getTextContent()).items.map(item=>item.str||'').join(' ');}assert.match(allText,/2\(a\)/);assert.match(allText,/2\(b\)/);assert.ok(dimensions.some(([w,h])=>w>h),'Trecho em paisagem');assert.ok(dimensions.some(([w,h])=>h>w),'Trecho em retrato');}finally{await task.destroy();}
});
test('real PDF accepts a source over 8 MiB and twelve chapters with figures',{skip:!process.env.CARBON_TEST_PDF,timeout:180000},async t=>{
 const o=await options(t);o.tectonic=path.resolve(__dirname,'../build/tectonic.exe');o.isolate=true;
 await fs.mkdir(path.join(o.base,'chapters'));await fs.copyFile(path.resolve(__dirname,'../logo.png'),path.join(o.base,'chapters','image.png'));
 const includes=[];for(let i=1;i<=12;i++){const name='chapter-'+i+'.cb';await fs.writeFile(path.join(o.base,'chapters',name),'# Chapter '+i+'\nA measurement with $E=mc^2$.\n![Measurement '+i+'](image.png){#fig:chapter-'+i+' width=20% pos=[here]}\n');includes.push('@include chapters/'+name);}
 const source='// '+'x'.repeat(9*1024*1024)+'\n@title Large modular source\n'+includes.join('\n')+'\nSee @refs(fig:chapter-1,fig:chapter-12).';await fs.writeFile(o.file,source);
 const result=await compileCarbon((await readDocument(o.file)).text,o);assert.deepEqual(result.diagnostics,[]);assert.equal(result.dependencies.filter(file=>file.endsWith('.cb')).length,12);assert.equal((await fs.readFile(path.join(o.directory,'preview.pdf'))).subarray(0,5).toString(),'%PDF-');
});

test('grouped citations, divider variants, table captions and local page validation',async t=>{
 const o=await options(t);
 const bibliography='@entry #a {author: "Silva", title: "One", year: 2026}\n@entry #b {author: "Souza", title: "Two", year: 2025}\n';
 const cited=await transpile(bibliography+'Grouped @cites(a,b).\n@print_bibliography',o);assert.equal(cited.citations,2);assert.match(cited.tex,/hyperlink\{bib:a\}/);assert.match(cited.tex,/hyperlink\{bib:b\}/);
 for(const style of ['solid','dashed','dotted']){const {tex}=await transpile('@columns[count=2 divider=true divider-style='+style+'][\nText.\n]',o);assert.match(tex,new RegExp('line-style='+style));}
 for(const position of ['top','bottom','left','right','overlay-top','overlay-bottom']){const {tex}=await transpile('@caption[position='+position+'] Table caption.\n@source Source.\n| A | B |\n| --- | --- |\n| 1 | 2 |',o);assert.match(tex,/\\caption\{Table caption\.\}/);assert.match(tex,/Fonte: Source/);}
 await assert.rejects(transpile('@page[size=A3][\nText.\n]',o),/papel ou orientação/);
 const {readLayout}=require('../electron/layout.cjs');assert.equal(readLayout('/*\n@page {size: A5}\n*/\n# Text').layout.page.size,'A4');
});

test('labels and math cannot inject file-reading TeX commands',async t=>{
 const o=await options(t);
 for(const source of ['@figure[group=horizontal label="x}\\input{secret}"][\n]','@figure[group=horizontal][\n@subfigure[label="x}\\input{secret}"][\n]\n]','$$\\includegraphics{../secret.png}$$'])await assert.rejects(transpile(source,o),/inválido|não permitido/);
});
test('all six image and table caption positions produce a real PDF',{skip:!process.env.CARBON_TEST_PDF,timeout:180000},async t=>{
 const o=await options(t);o.tectonic=path.resolve(__dirname,'../build/tectonic.exe');await fs.copyFile(path.resolve(__dirname,'../logo.png'),path.join(o.base,'image.png'));
 const positions=['top','bottom','left','right','overlay-top','overlay-bottom'];
 const source=positions.map(position=>'@caption[position='+position+' align=left]\n![Image '+position+'](image.png){width=40% pos=[here]}\n@caption[position='+position+'] Table '+position+'.\n| A | B |\n| --- | --- |\n| 1 | 2 |\n@clearpage').join('\n');
 await compileCarbon(source,o);const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs'),task=pdfjs.getDocument({data:new Uint8Array(await fs.readFile(path.join(o.directory,'preview.pdf')))}),pdf=await task.promise;
 try{let text='';for(let i=1;i<=pdf.numPages;i++)text+=(await (await pdf.getPage(i)).getTextContent()).items.map(item=>item.str||'').join(' ');for(const position of positions){assert.ok(text.includes('Image '+position),position);assert.ok(text.includes('Table '+position),position);}}finally{await task.destroy();}
});

test('an invalid imported bibliography does not consume the main document',async t=>{
 const o=await options(t);await fs.writeFile(path.join(o.base,'invalid.cb'),'@entry #broken {\n author: "Missing closing brace"');
 const result=await transpile('@import invalid.cb\n# Valid chapter\nStill present.\n@cite(broken)',o);assert.match(result.tex,/Valid chapter/);assert.match(result.tex,/Still present/);assert.ok(result.diagnostics.some(item=>item.file.endsWith('invalid.cb')&&/fechamento/.test(item.message)));assert.ok(result.diagnostics.some(item=>/não encontrada/.test(item.message)));
});

test('including a chapter with many lines does not hit JavaScript argument limits',async t=>{
 const o=await options(t);await fs.writeFile(path.join(o.base,'long.cb'),'\n'.repeat(150000)+'# Last section\nValid final text.');const result=await transpile('@include long.cb',o);assert.deepEqual(result.diagnostics,[]);assert.match(result.tex,/Last section/);assert.match(result.tex,/Valid final text/);assert.ok(result.sourceMap.some(item=>item.line===150002));assert.ok(result.tex.length<20000,'Repeated blank source lines need not inflate TeX output.');
});

test('bibliography directives inside comments and code do not change compilation style',async t=>{
 const o=await options(t);const result=await transpile('// @print_bibliography[style=invalid]\n```carbon\n@print_bibliography[style=invalid]\n```\nValid text.',o);assert.equal(result.style,'abnt');assert.deepEqual(result.diagnostics,[]);
});
