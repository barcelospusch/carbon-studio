import {icon} from './icons';
import type {editor as MonacoEditor} from 'monaco-editor/editor/editor.api.js';

export function installTextPanel(editor:MonacoEditor.IStandaloneCodeEditor,toast:(message:string)=>void){
  document.querySelector('.sidebar-section')!.insertAdjacentHTML('beforeend',`<button id="text-alignment">${icon('alignment')} <span>Alinhamento de texto</span></button>`);
  document.body.insertAdjacentHTML('beforeend',`
  <dialog id="alignment-dialog"><form id="alignment-form">
    <header><div><small>FORMATAÇÃO DO CONTEÚDO</small><h2>Alinhamento de texto</h2></div><button type="button" data-close-alignment aria-label="Fechar alinhamento">${icon('close')}</button></header>
    <label>Aplicar a<select name="target"><option value="block">Bloco de texto selecionado</option><option value="column">Coluna da tabela no cursor</option><option value="cell">Somente a célula no cursor</option></select></label>
    <label>Alinhamento<select name="mode"><option value="left">Esquerda</option><option value="center">Centralizado</option><option value="right">Direita</option><option value="justify">Justificado</option></select></label>
    <p class="dialog-intro">Para um bloco, selecione o texto; sem seleção, a linha atual será envolvida por @align. Para coluna ou célula, coloque o cursor na tabela antes de abrir este painel.</p>
    <p class="layout-note">O alinhamento da coluna é gravado na linha divisória. Uma célula com @align tem prioridade sobre o alinhamento da coluna.</p>
    <p id="alignment-error" class="form-error" role="alert"></p>
    <footer><button type="button" data-close-alignment>Cancelar</button><button type="submit" class="primary">Aplicar alinhamento</button></footer>
  </form></dialog>`);
  const dialog=document.getElementById('alignment-dialog') as HTMLDialogElement;
  const form=document.getElementById('alignment-form') as HTMLFormElement;
  const error=document.getElementById('alignment-error')!;
  let selection=editor.getSelection()!,source='';
  document.getElementById('text-alignment')!.onclick=()=>{selection=editor.getSelection()!;source=editor.getValue();error.textContent='';dialog.showModal();};
  for(const button of document.querySelectorAll<HTMLButtonElement>('[data-close-alignment]'))button.onclick=()=>dialog.close();
  form.onsubmit=async event=>{
    event.preventDefault();error.textContent='';
    try{
      if(editor.getValue()!==source)throw new Error('O documento mudou. Feche o painel e selecione o conteúdo novamente.');
      const target=(form.elements.namedItem('target') as HTMLSelectElement).value as 'block'|'column'|'cell';
      const mode=(form.elements.namedItem('mode') as HTMLSelectElement).value;
      const result=await window.carbonStudio.alignText(source,selection,target,mode);
      if(!result.ok)throw new Error(result.error);
      if(editor.getValue()!==source)throw new Error('O documento mudou. Aplique o alinhamento novamente.');
      editor.pushUndoStop();editor.executeEdits('text-alignment',[result.data]);editor.pushUndoStop();
      dialog.close();editor.focus();toast('Alinhamento aplicado ao código. Recompile para atualizar o PDF.');
    }catch(problem){error.textContent=problem instanceof Error?problem.message:String(problem);}
  };
}
