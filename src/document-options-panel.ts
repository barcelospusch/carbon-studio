import {icon} from './icons';
import type {editor as MonacoEditor} from 'monaco-editor/editor/editor.api.js';
import type {DocumentOptions,Result} from './api';
export function installDocumentOptionsPanel(editor:MonacoEditor.IStandaloneCodeEditor,toast:(message:string)=>void){
  const api=window.carbonStudio;
  const unwrap=<T>(result:Result<T>):T=>{if(!result.ok)throw new Error(result.error);return result.data;};
  const button=document.createElement('button');button.id='document-options';button.innerHTML=icon('layout')+'<span>Colunas e links</span>';document.getElementById('format-tools')!.append(button);
  const dialog=document.createElement('dialog');dialog.id='document-options-dialog';
  const check=(name:string,label:string)=>`<label class="option-check"><input name="${name}" type="checkbox"/>${label}</label>`;
  dialog.innerHTML=`<form><header><h2>Colunas e links</h2><button type="button" data-close aria-label="Fechar">${icon('close')}</button></header>
    ${check('columns-enabled','Usar colunas no documento inteiro')}
    <fieldset><legend>Colunas</legend><div class="layout-grid">
    <label>Quantidade<input name="count" type="number" min="2" max="10" value="2"/></label><label>Espaço entre colunas<input name="gap" value="0.8cm"/></label>
    <label>Espessura da divisória<input name="divider-width" value="0.4pt"/></label><label>Cor da divisória<input name="divider-color" type="color" value="#666666"/></label>
    <label>Padding da divisória<input name="divider-padding" value="0.25cm"/></label><label>Estilo<select name="divider-style"><option value="solid">Sólido</option><option value="dashed">Tracejado</option><option value="dotted">Pontilhado</option></select></label>
    </div>${check('divider','Mostrar divisória')}${check('balance','Balancear colunas')}</fieldset>
    ${check('links-enabled','Personalizar links')}
    ${['external','internal'].map(scope=>`<fieldset><legend>Links ${scope==='external'?'externos':'internos'}</legend><div class="layout-grid">
    <label>Cor do texto<input type="color" name="${scope}-color" value="#2563eb"/></label><label>Cor do sublinhado<input type="color" name="${scope}-underline-color" value="#2563eb"/></label>
    <label>Sublinhado<select name="${scope}-underline-style"><option value="solid">Sólido</option><option value="dashed">Tracejado</option><option value="dotted">Pontilhado</option></select></label><label>Peso<select name="${scope}-weight"><option value="normal">Normal</option><option value="bold">Negrito</option></select></label>
    </div>${check(scope+'-underline','Sublinhar')}${check(scope+'-italic','Itálico')}${check(scope+'-border','Borda')}${check(scope+'-breakable','Permitir quebra de linha')}
    <a class="link-style-preview" data-preview="${scope}">Pré-visualização do link</a></fieldset>`).join('')}
    <p class="form-error" role="alert"></p><footer><button type="button" data-close>Cancelar</button><button type="submit" class="primary">Aplicar ao documento</button></footer></form>`;
  document.body.append(dialog);const form=dialog.querySelector('form')!;
  const field=(name:string)=>form.elements.namedItem(name) as HTMLInputElement|HTMLSelectElement;
  const checked=(name:string)=>(field(name) as HTMLInputElement).checked;
  const updatePreview=()=>{for(const scope of ['external','internal']){const link=dialog.querySelector<HTMLElement>(`[data-preview=${scope}]`)!;link.style.color=field(scope+'-color').value;link.style.textDecoration=checked(scope+'-underline')?`underline ${field(scope+'-underline-style').value} ${field(scope+'-underline-color').value}`:'none';link.style.fontWeight=field(scope+'-weight').value;link.style.fontStyle=checked(scope+'-italic')?'italic':'normal';link.style.border=checked(scope+'-border')?'1px solid currentColor':'none';}};
  form.oninput=updatePreview;
  const linkDefaults={color:'#2563eb',underline:'false','underline-color':'#2563eb','underline-style':'solid',weight:'normal',italic:'false',border:'false',breakable:'true'};
  button.onclick=async()=>{try{
    const options=unwrap(await api.getDocumentOptions(editor.getValue()));
    (field('columns-enabled') as HTMLInputElement).checked=!!options.columns;(field('links-enabled') as HTMLInputElement).checked=Object.keys(options.links).length>0;
    const set=(name:string,value:string)=>{const input=field(name);if(input instanceof HTMLInputElement&&input.type==='checkbox')input.checked=value==='true';else input.value=value;};
    for(const [key,value] of Object.entries({count:'2',gap:'0.8cm',divider:'false','divider-width':'0.4pt','divider-color':'#666666','divider-style':'solid','divider-padding':'0.25cm',balance:'true',...options.columns}))set(key,value);
    for(const scope of ['external','internal'] as const)for(const [key,value] of Object.entries({...linkDefaults,...options.links.all,...options.links[scope]}))set(scope+'-'+key,value);
    dialog.querySelector('.form-error')!.textContent='';updatePreview();dialog.showModal();
  }catch(error){toast(String(error));}};
  dialog.querySelectorAll<HTMLButtonElement>('[data-close]').forEach(button=>button.onclick=()=>dialog.close());
  form.onsubmit=async event=>{event.preventDefault();const source=editor.getValue();try{
    const get=(name:string)=>{const input=field(name);return input instanceof HTMLInputElement&&input.type==='checkbox'?String(input.checked):input.value;};
    const options:DocumentOptions={columns:checked('columns-enabled')?Object.fromEntries(['count','gap','divider','divider-width','divider-color','divider-style','divider-padding','balance'].map(key=>[key,get(key)])):null,links:{}};
    if(checked('links-enabled'))for(const scope of ['external','internal'] as const)options.links[scope]=Object.fromEntries(Object.keys(linkDefaults).map(key=>[key,get(scope+'-'+key)]));
    const replacement=unwrap(await api.applyDocumentOptions(source,options));if(editor.getValue()!==source)throw new Error('O documento mudou. Aplique novamente.');
    editor.pushUndoStop();editor.executeEdits('document-options',[{range:editor.getModel()!.getFullModelRange(),text:replacement}]);editor.pushUndoStop();dialog.close();editor.focus();
  }catch(error){dialog.querySelector('.form-error')!.textContent=error instanceof Error?error.message:String(error);}};
}
