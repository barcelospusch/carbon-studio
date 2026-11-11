'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs/promises');const path=require('node:path');const {_electron:electron}=require('playwright');
const root=path.resolve(__dirname,'..');
for(const document of [{name:'layout.cb',pages:2,landscape:true},{name:'alinhamento.cb',pages:1,landscape:false}])test(`Packaged Windows executable compiles ${document.name} with its bundled PDF engine`,{timeout:240000},async t=>{
 await fs.mkdir(path.join(root,'tmp'),{recursive:true});await fs.mkdir(path.join(root,'output'),{recursive:true});
 const dir=await fs.mkdtemp(path.join(root,'tmp/studio-packaged-'));
 const executable=path.join(root,'release/win-unpacked/Carbon Studio.exe');
 const env={...process.env,CARBON_STUDIO_E2E:'1',CARBON_STUDIO_DATA_DIR:path.join(dir,'profile')};delete env.CARBON_STUDIO_COMPILER;
 const runtime=await electron.launch({executablePath:executable,args:[path.join(root,'examples',document.name)],env,timeout:60000});
 t.after(async()=>{await runtime.evaluate(({app})=>app.exit(0)).catch(()=>{});await runtime.close().catch(()=>{});});
 const page=await runtime.firstWindow();const errors=[];page.on('pageerror',error=>errors.push(error.message));
 assert.equal(await runtime.evaluate(({app})=>app.isPackaged),true);
 assert.equal(await runtime.evaluate(({app})=>app.getVersion()),require('../package.json').version,'A distribuição deve usar a versão atual do projeto.');
 await page.waitForFunction(name=>document.getElementById('tab-name')?.textContent===name,document.name);
 assert.ok(await page.locator('svg.app-svg').count()>15,'Os SVGs personalizados devem estar integrados.');
 const folderSvg=await fs.readFile(path.join(root,'assets/icons/folder.svg'),'utf8');
 assert.equal(await page.locator('#open svg path').first().getAttribute('d'),folderSvg.match(/<path[^>]*\bd="([^"]+)"/)[1]);
 const settings=await page.evaluate(()=>window.carbonStudio.getSettings());assert.equal(settings.ok,true);assert.equal(settings.data.tectonic,undefined);
 await page.click('#compile');await page.waitForFunction(()=>document.getElementById('compile-status')?.textContent?.includes('PDF atualizado'),{},{timeout:180000});
 await page.waitForSelector('.pdf-page canvas',{timeout:30000});assert.ok(await page.locator('.pdf-page canvas').count());
 assert.equal(await page.locator('#page-total').innerText(),`/ ${document.pages}`);
 assert.equal(await page.locator('.pdf-page canvas').first().evaluate(canvas=>canvas.width>canvas.height),document.landscape);
 assert.equal(await page.locator('#text-alignment').count(),1);
 const painted=await page.evaluate(()=>{const canvas=document.querySelector('.pdf-page canvas');if(!canvas||canvas.width<300)return false;const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;for(let i=0;i<pixels.length;i+=44)if(pixels[i+3]&&pixels[i]<220&&pixels[i+1]<220&&pixels[i+2]<220)return true;return false;});
 assert.equal(painted,true,'A prévia deve conter o texto do PDF, não apenas um canvas vazio.');assert.deepEqual(errors,[]);
 if(document.name==='alinhamento.cb'){
  await page.click('#find');const next=page.locator('.monaco-editor .codicon-find-next-match').first();await next.waitFor({state:'visible'});
  assert.match(await next.evaluate(element=>getComputedStyle(element,'::before').maskImage),/svg|data:image/);await page.keyboard.press('Escape');
  await runtime.evaluate(({dialog},selected)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[selected]});},path.join(root,'examples'));
  await page.click('#open');await page.waitForSelector('#start-screen',{state:'visible'});assert.ok(await page.locator('.document-card').count()>1);
  await page.screenshot({path:path.join(root,'output/studio-0.2.0-projects.png'),fullPage:true,timeout:5000}).catch(()=>console.warn('Captura opcional indisponível em janela oculta.'));
  await page.click('#preferences');await page.waitForFunction(()=>document.getElementById('settings-dialog').open);assert.equal(await page.locator('#theme-select option').count(),7);
  await page.screenshot({path:path.join(root,'output/studio-0.2.0-settings.png'),fullPage:true,timeout:5000}).catch(()=>console.warn('Captura opcional indisponível em janela oculta.'));
 }
});
