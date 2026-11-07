'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { _electron: electron } = require('playwright');
const root = path.resolve(__dirname,'..');

test('Studio compiles embedded Mermaid and CV and manages project resources', {timeout:300000}, async t => {
  await fs.mkdir(path.join(root,'tmp'),{recursive:true});
  const area = await fs.mkdtemp(path.join(root,'tmp/features-'));
  const project = path.join(area,'project');
  await fs.mkdir(project);
  for (const name of ['curriculo.cb','matematica-paginacao.cb']) {
    await fs.copyFile(path.join(root,'examples',name),path.join(project,name));
  }
  const image = await fs.readFile(path.join(root,'logo.png'));
  const server = http.createServer((_request,response) => {
    response.setHeader('content-type','image/png');
    response.end(image);
  });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const runtime = await electron.launch({
    executablePath:process.env.CARBON_STUDIO_TEST_EXE,
    args:[...(process.env.CARBON_STUDIO_TEST_EXE?[]:[root]),path.join(project,'matematica-paginacao.cb')],cwd:root,
    env:{...process.env,CARBON_STUDIO_E2E:'1',CARBON_STUDIO_DATA_DIR:path.join(area,'profile')},
    timeout:60000,
  });
  t.after(async () => {
    await runtime.evaluate(({app}) => app.exit(0)).catch(() => {});
    await runtime.close().catch(() => {});
  });
  const page = await runtime.firstWindow({timeout:60000});
  const errors = [];
  page.on('pageerror',error => errors.push(error.message));
  await page.waitForFunction(() => document.getElementById('tab-name')?.textContent === 'matematica-paginacao.cb');
  const compile = async () => {
    await page.click('#compile');
    await page.waitForFunction(() => /PDF atualizado|Falha na compilação/.test(document.getElementById('compile-status')?.textContent || ''),{},{timeout:90000});
    assert.match(await page.locator('#compile-status').textContent(), /PDF atualizado/, await page.locator('#log-output').textContent());
  };
  const outline = page.locator('#document-outline button');
  await outline.filter({hasText:'Diagrama'}).click();
  assert.match(await page.locator('#cursor-position').textContent(), /Ln \d+, Col 1/);
  assert.equal(await page.locator('#format-tools #bold').count(),1);
  assert.equal(await page.locator('#math-symbol optgroup').count(),5);
  await compile();
  const output = path.join(area,'science.pdf');
  await runtime.evaluate(({dialog},file) => {dialog.showSaveDialog=async()=>({canceled:false,filePath:file});},output);
  await page.click('#export');
  await page.waitForFunction(() => document.getElementById('toast')?.textContent === 'PDF exportado.');
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = pdfjs.getDocument({data:new Uint8Array(await fs.readFile(output)),useSystemFonts:false});
  const pdf = await task.promise;
  try {
    assert.equal(pdf.numPages,2);
    const pageText = async number => (await (await pdf.getPage(number)).getTextContent()).items.map(item=>item.str||'').join(' ');
    assert.match(await pageText(1),/Apresentação/);
    assert.match(await pageText(1),/Página 1 de 2/);
    assert.match(await pageText(2),/Demonstração/);
    assert.match(await pageText(2),/Verso/);
    assert.ok((await (await pdf.getPage(2)).getOperatorList()).fnArray.includes(pdfjs.OPS.paintImageXObject));
  } finally {
    await task.destroy();
  }
  await page.locator('.tree-row[title="curriculo.cb"]').click();
  await page.waitForFunction(() => document.getElementById('tab-name')?.textContent === 'curriculo.cb');
  await compile();
  const openItem = kind => page.locator('[data-project-item="'+kind+'"]').click();
  const submit = async () => {
    await page.click('#project-item-submit');
    await page.waitForFunction(() => !document.getElementById('project-item-dialog').open);
  };
  await openItem('folder');
  await page.locator('#project-item-form [name=name]').fill('figuras');
  await submit();
  await openItem('image');
  await page.locator('#project-item-form [name=folder]').selectOption('figuras');
  await page.locator('#project-item-form [name=link]').fill('http://127.0.0.1:'+server.address().port+'/logo.png');
  await page.click('#project-image-preview');
  await page.waitForSelector('#project-image-result',{state:'visible'});
  await page.locator('#project-item-form [name=name]').fill('logo-local');
  await submit();
  assert.deepEqual(await fs.readFile(path.join(project,'figuras/logo-local.png')),image);
  const imageRow = name => page.locator('[data-project-image="'+name+'"]');
  await imageRow('figuras/logo-local.png').hover();
  await page.waitForSelector('.image-hover:not(.hidden)',{state:'visible'});
  await imageRow('figuras/logo-local.png').click();
  await page.waitForFunction(() => document.getElementById('project-image-content')?.naturalWidth > 0);
  const manage = action => page.locator('.image-toolbar [data-image-action="'+action+'"]').click();
  const finishManagement = async () => {
    await page.click('#submit-image-action');
    await page.waitForFunction(() => !document.getElementById('manage-image-dialog').open);
  };
  await manage('rename');
  await page.locator('#manage-image-dialog input').fill('logo-renomeado');
  await finishManagement();
  await imageRow('figuras/logo-renomeado.png').waitFor();
  await manage('move');
  await page.locator('#manage-image-dialog select').selectOption('');
  await finishManagement();
  await imageRow('logo-renomeado.png').waitFor();
  assert.deepEqual(await fs.readFile(path.join(project,'logo-renomeado.png')),image);
  await runtime.evaluate(({shell}) => {
    shell.trashItem = file => process.getBuiltinModule('node:fs/promises').unlink(file);
  });
  await manage('delete');
  await finishManagement();
  await imageRow('logo-renomeado.png').waitFor({state:'detached'});
  await assert.rejects(fs.stat(path.join(project,'logo-renomeado.png')), {code:'ENOENT'});
  await openItem('file');
  await page.locator('#project-item-form [name=name]').fill('anotacoes');
  await submit();
  await page.waitForFunction(() => document.getElementById('tab-name')?.textContent === 'anotacoes.cb');
  assert.equal(await fs.readFile(path.join(project,'anotacoes.cb'),'utf8'),'');
  assert.deepEqual(errors,[]);
});
