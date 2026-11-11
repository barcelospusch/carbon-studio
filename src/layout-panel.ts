import {icon} from './icons';
import type {editor as MonacoEditor} from 'monaco-editor/editor/editor.api.js';
import type {DocumentLayout,Result} from './api';

export function installLayoutPanel(editor:MonacoEditor.IStandaloneCodeEditor,toast:(message:string)=>void){
  const api=window.carbonStudio;
  const unwrap=<T>(result:Result<T>):T=>{if(!result.ok)throw new Error(result.error);return result.data;};
  const sidebar=document.querySelector('#format-tools')!;
  sidebar.insertAdjacentHTML('beforeend',`<button id="document-layout">${icon('layout')} <span>Layout do documento</span></button><button id="insert-page-break">${icon('pageBreak')} <span>Quebra de página</span></button><button id="element-position">${icon('position')} <span>Posicionar figura / tabela</span></button>`);
  document.body.insertAdjacentHTML('beforeend',`
  <dialog id="layout-dialog"><form id="layout-form">
    <header><div><small>DOCUMENTO ATUAL</small><h2>Layout e tipografia</h2></div><button type="button" data-close-layout aria-label="Fechar layout">${icon('close')}</button></header>
    <p class="dialog-intro">Estas opções são gravadas no código Carbon e acompanham o documento. As diretivas do arquivo prevalecem sobre o papel padrão das preferências.</p>
    <div class="layout-grid">
      <label>Papel<select name="size"><option>A4</option><option>Letter</option><option>Legal</option><option>A5</option></select></label>
      <label>Orientação<select name="orientation"><option value="portrait">Retrato</option><option value="landscape">Paisagem</option></select></label>
    </div>
    <fieldset><legend>Margens · cm, mm ou in</legend><div class="layout-grid">
      <label>Superior<input name="top" required placeholder="2.5cm"/></label><label>Inferior<input name="bottom" required placeholder="2.5cm"/></label>
      <label>Esquerda<input name="left" required placeholder="3cm"/></label><label>Direita<input name="right" required placeholder="2cm"/></label>
    </div></fieldset>
    <label>Família de fontes<input name="font" list="document-fonts" placeholder="Latin Modern padrão" maxlength="100"/></label>
    <datalist id="document-fonts"><option value="Latin Modern Roman"></option><option value="TeX Gyre Heros"></option><option value="TeX Gyre Termes"></option><option value="TeX Gyre Pagella"></option><option value="Arial"></option><option value="Times New Roman"></option><option value="Liberation Sans"></option></datalist>
    <p class="layout-note">Latin Modern e TeX Gyre usam fontes TeX. Outras famílias, como Liberation Sans, precisam estar instaladas no Windows. A fonte das equações continua sendo matemática TeX.</p>
    <div class="layout-grid"><label>Tamanho da fonte<input name="fontsize" required placeholder="12pt"/></label><label>Entrelinha<input name="lineheight" type="number" min="0.01" max="10" step="any" required/></label></div>
    <fieldset><legend>Parágrafos</legend><div class="layout-grid">
    <label>Recuo da primeira linha<input name="indent-first" required placeholder="1.25cm"/></label>
    <label>Recuar após título<select name="indent-after-heading"><option value="false">Não</option><option value="true">Sim</option></select></label>
    <label>Espaço antes<input name="spacing-before" required placeholder="0pt"/></label>
    <label>Espaço depois<input name="spacing-after" required placeholder="6pt"/></label>
    </div></fieldset>
    <button type="button" id="open-column-link-options">Colunas e aparência dos links…</button>
    <p id="layout-error" class="form-error" role="alert"></p>
    <footer><button type="button" data-close-layout>Cancelar</button><button type="submit" class="primary">Aplicar ao documento</button></footer>
  </form></dialog>
  <dialog id="position-dialog"><form id="position-form">
    <header><div><small>ELEMENTO ATUAL</small><h2>Posicionamento</h2></div><button type="button" data-close-position aria-label="Fechar posicionamento">${icon('close')}</button></header>
    <p class="dialog-intro">Coloque o cursor na linha de uma figura, @caption, @mermaid ou na abertura de um bloco Mermaid.</p>
    <label>Posição<select name="position"><option value="here">Aqui · posição fixa</option><option value="top">Topo da página</option><option value="bottom">Parte inferior</option><option value="page">Página de elementos flutuantes</option><option value="top, bottom, page">Automático · topo, inferior ou página</option><option value="override, top">Topo · flexibilizar restrições</option><option value="override">Automático · flexibilizar restrições</option></select></label>
    <p class="layout-note">Aqui usa [H]. As demais posições seguem a paginação do LaTeX. Override (!) flexibiliza restrições; não fixa o elemento.</p>
    <p id="position-error" class="form-error" role="alert"></p>
    <footer><button type="button" data-close-position>Cancelar</button><button type="submit" class="primary">Aplicar posição</button></footer>
  </form></dialog>`);
  const dialog=document.getElementById('layout-dialog') as HTMLDialogElement;
  const form=document.getElementById('layout-form') as HTMLFormElement;
  const error=document.getElementById('layout-error')!;
  const field=(name:string)=>form.elements.namedItem(name) as HTMLInputElement|HTMLSelectElement;
  document.getElementById('document-layout')!.onclick=async()=>{
    try{
      const layout=unwrap(await api.getLayout(editor.getValue()));
      for(const group of Object.values(layout))for(const [key,value] of Object.entries(group))field(key).value=String(value);
      error.textContent='';dialog.showModal();
    }catch(problem){toast(problem instanceof Error?problem.message:String(problem));}
  };
  for(const button of document.querySelectorAll<HTMLButtonElement>('[data-close-layout]'))button.onclick=()=>dialog.close();
  document.getElementById('open-column-link-options')!.onclick=()=>{dialog.close();document.getElementById('document-options')!.click();};
  form.onsubmit=async event=>{
    event.preventDefault();error.textContent='';
    const source=editor.getValue();
    const layout:DocumentLayout={margins:{top:field('top').value,bottom:field('bottom').value,left:field('left').value,right:field('right').value},page:{size:field('size').value,orientation:field('orientation').value},typography:{font:field('font').value,fontsize:field('fontsize').value,lineheight:Number(field('lineheight').value)},paragraph:{'indent-first':field('indent-first').value,'indent-after-heading':field('indent-after-heading').value,'spacing-before':field('spacing-before').value,'spacing-after':field('spacing-after').value}};
    try{
      const replacement=unwrap(await api.applyLayout(source,layout));
      if(editor.getValue()!==source)throw new Error('O documento mudou. Aplique o layout novamente.');
      const model=editor.getModel();if(!model)return;
      editor.pushUndoStop();editor.executeEdits('document-layout',[{range:model.getFullModelRange(),text:replacement}]);editor.pushUndoStop();
      dialog.close();editor.focus();toast('Layout aplicado ao código. Recompile para atualizar o PDF.');
    }catch(problem){error.textContent=problem instanceof Error?problem.message:String(problem);}
  };
  document.getElementById('insert-page-break')!.onclick=()=>{
    const selection=editor.getSelection();if(!selection)return;
    const model=editor.getModel()!;const before=model.getLineContent(selection.startLineNumber).slice(0,selection.startColumn-1);
    editor.pushUndoStop();editor.executeEdits('page-break',[{range:selection,text:`${before?'\n':''}@newpage\n\n`}]);editor.pushUndoStop();editor.focus();
  };
  const positionDialog=document.getElementById('position-dialog') as HTMLDialogElement;
  const positionForm=document.getElementById('position-form') as HTMLFormElement;
  const positionError=document.getElementById('position-error')!;
  let elementLine=1,originalLine='';
  document.getElementById('element-position')!.onclick=()=>{
    elementLine=editor.getPosition()?.lineNumber||1;originalLine=editor.getModel()!.getLineContent(elementLine);
    if(!/^\s*(?:!\[|@caption\b|@mermaid\b|```mermaid\b)/.test(originalLine)){toast('Coloque o cursor na linha da figura, legenda da tabela ou diagrama.');return;}
    const existing=originalLine.match(/\bpos\s*=\s*\[([^\]]*)\]/)?.[1]||'here';
    const select=positionForm.elements.namedItem('position') as HTMLSelectElement;
    select.value=[...select.options].some(option=>option.value===existing)?existing:'here';
    positionError.textContent='';positionDialog.showModal();
  };
  for(const button of document.querySelectorAll<HTMLButtonElement>('[data-close-position]'))button.onclick=()=>positionDialog.close();
  positionForm.onsubmit=event=>{
    event.preventDefault();const model=editor.getModel()!;
    if(model.getLineContent(elementLine)!==originalLine){positionError.textContent='O elemento mudou. Feche e selecione a linha novamente.';return;}
    const placement=`pos=[${(positionForm.elements.namedItem('position') as HTMLSelectElement).value}]`;
    let replacement=originalLine;
    if(/\bpos\s*=\s*\[[^\]]*\]/.test(replacement))replacement=replacement.replace(/\bpos\s*=\s*\[[^\]]*\]/,placement);
    else if(/\{[^{}]*\}\s*$/.test(replacement))replacement=replacement.replace(/\}\s*$/,` ${placement}}`);
    else if(/^\s*@mermaid\b/.test(replacement))replacement+=` ${placement}`;
    else replacement+=` {${placement}}`;
    editor.pushUndoStop();editor.executeEdits('element-placement',[{range:{startLineNumber:elementLine,endLineNumber:elementLine,startColumn:1,endColumn:model.getLineMaxColumn(elementLine)},text:replacement}]);editor.pushUndoStop();
    positionDialog.close();editor.focus();toast('Posição aplicada. Recompile para atualizar o PDF.');
  };
}
