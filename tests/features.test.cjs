'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const {transpile} = require('../electron/carbon.cjs');
const {destination, importProjectItem} = require('../electron/project-files.cjs');

test('CV, page rules, matrices, equations, tasks and embedded Mermaid compose together', async t => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(),'carbon-features-'));
  t.after(() => fs.rm(base,{recursive:true,force:true}));
  const examples = path.resolve(__dirname,'../examples');
  const cv = await fs.readFile(path.join(examples,'curriculo.cb'),'utf8');
  const science = await fs.readFile(path.join(examples,'matematica-paginacao.cb'),'utf8');
  const curriculum = await transpile(cv,{base,directory:base});
  assert.match(curriculum.tex,/\\setcounter\{secnumdepth\}\{0\}/);
  assert.match(curriculum.tex,/\\textbf\{Engenheira de software\} & 2024/);
  const result = await transpile(science,{
    base,directory:base,
    async renderMermaid(source,output) {
      assert.match(source,/flowchart LR/);
      assert.equal(path.extname(output),'.png');
      await fs.copyFile(path.resolve(__dirname,'../logo.png'),output);
    },
  });
  for (const fragment of [
    '\\begin{pmatrix}', '\\begin{bmatrix}', '\\tag{1}\\label{eq:energia}',
    '\\eqref{eq:energia}', '\\item[$\\square$]', '\\item[$\\boxtimes$]',
    '\\pageref*{LastPage}', '\\ifnum\\value{page}=2', '\\includegraphics',
  ]) assert.ok(result.tex.includes(fragment),fragment);
  await assert.rejects(transpile('@matrix[bars][\n1,2\n3\n]',{base,directory:base}),/mesmo número/);
});

test('project imports reject overwrites and destinations outside the project', async t => {
  const area = await fs.mkdtemp(path.join(os.tmpdir(),'carbon-files-'));
  t.after(() => fs.rm(area,{recursive:true,force:true}));
  const root = path.join(area,'project');
  const source = path.join(area,'source');
  await Promise.all([fs.mkdir(root),fs.mkdir(source)]);
  await fs.writeFile(path.join(source,'novo.cb'),'# Novo');
  await importProjectItem(root,'',source,true);
  assert.equal(await fs.readFile(path.join(root,'source','novo.cb'),'utf8'),'# Novo');
  await assert.rejects(importProjectItem(root,'',source,true),/Já existe/);
  await assert.rejects(destination(root,'..','fora.cb'),/pasta do projeto/);
  await assert.rejects(destination(root,'','CON.cb'),/Nome/);
});
