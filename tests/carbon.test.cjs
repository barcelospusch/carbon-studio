'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {transpile,compileCarbon}=require('../electron/carbon.cjs');
async function options(t){const directory=await fs.mkdtemp(path.join(os.tmpdir(),'carbon-language-'));t.after(()=>fs.rm(directory,{recursive:true,force:true}));return {base:directory,directory};}
test('report, affiliations, toc, preserved math, lists, tables and formatting',async t=>{
 const o=await options(t);const {tex}=await transpile('@title Artigo\n@type report # capa\n@author [Ana]{Instituto}\n@date @today\n@toc[title="Índice"]\n# Introdução\n**Texto $x_i$** e __forte__, _itálico_, ~~riscado~~, 20% & 2.\n\n1. Primeiro\n   a) Filho\n2. Segundo\n\n$$\n\\frac{1}{2}\n$$\n@caption Dados {#table:dados width=100%}\n| A | B |\n| --- | --- |\n| 1 | 2 |\nVeja @ref(table:dados).',o);
 assert.match(tex,/\\documentclass\[12pt,a4paper\]\{report\}/);assert.match(tex,/\\tableofcontents/);assert.match(tex,/\\small Instituto/);assert.match(tex,/\\textbf\{Texto \$x_i\$\}/);assert.match(tex,/\\textbf\{forte\}/);assert.match(tex,/\\textit\{itálico\}/);assert.ok(tex.includes('20\\% \\&'));assert.match(tex,/\\label\{table:dados\}/);assert.match(tex,/\\frac\{1\}\{2\}/);assert.equal((tex.match(/\\begin\{enumerate\}/g)||[]).length,2);
});
test('imports, bibliography and six citation styles',async t=>{
 const o=await options(t);await fs.writeFile(path.join(o.base,'refs.cb'),'@entry #ana {\n type: article,\n author: "Silva, Ana",\n title: "Pesquisa",\n journal: "Ciência",\n year: 2026\n}\n');
 for(const style of ['abnt','ieee','apa','mla','vancouver','chicago']){const {tex,citations}=await transpile(`@import refs.cb\n@title Teste\nCitação @cite(ana).\n@print_bibliography[style=${style}]`,o);assert.equal(citations,1);assert.match(tex,/hypertarget\{bib:ana\}/);assert.match(tex,/Pesquisa/);assert.doesNotMatch(tex,/@entry/);}
});
test('actionable errors for circular imports, missing references and unfinished math',async t=>{
 const o=await options(t);await fs.writeFile(path.join(o.base,'cycle.cb'),'@import cycle.cb');await assert.rejects(transpile('@import cycle.cb',o),/circular/);await assert.rejects(transpile('@cite(missing)',o),/não encontrada/);await assert.rejects(transpile('$$\nx+1',o),/fechamento/);await assert.rejects(transpile('$$\\input{secret}$$',o),/não permitido/);await assert.rejects(transpile('@mermaid #fig:missing',o),/não encontrado/);
});
test('external Mermaid library resolves ids and requests configured renderer',async t=>{
 const o=await options(t);await fs.writeFile(path.join(o.base,'graphs.mmd'),'#fig:flow{\ngraph LR\nA --> B\n}\n');await assert.rejects(transpile('@import graphs.mmd\n@mermaid #fig:flow width=80%',o),/Mermaid CLI/);
});
test('real Carbon to LaTeX to PDF pipeline',{skip:!process.env.CARBON_TEST_PDF,timeout:180000},async t=>{
 const o=await options(t);o.tectonic=path.resolve(__dirname,'../build/tectonic.exe');o.timeout=170000;o.onLog=()=>{};await compileCarbon(await fs.readFile(path.resolve(__dirname,'../examples/primeiro-artigo.cb'),'utf8'),o);const pdf=await fs.readFile(path.join(o.directory,'preview.pdf'));assert.equal(pdf.subarray(0,5).toString(),'%PDF-');assert.ok(pdf.length>10000);
});

test('real report with imported bibliography and cross references',{skip:!process.env.CARBON_TEST_PDF,timeout:180000},async t=>{
const o=await options(t);o.base=path.resolve(__dirname,'../examples');o.tectonic=path.resolve(__dirname,'../build/tectonic.exe');o.timeout=170000;await compileCarbon(await fs.readFile(path.join(o.base,'relatorio.cb'),'utf8'),o);assert.equal((await fs.readFile(path.join(o.directory,'preview.pdf'))).subarray(0,5).toString(),'%PDF-');
});
