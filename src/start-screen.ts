import {icon} from './icons';
import logo from '../logo.png';
import type {DocumentState} from './api';
export function installStartScreen(actions:{open:()=>void;template:()=>void;cv:()=>void;select:(name:string)=>void;refresh:()=>void}){
 const host=document.createElement('section');host.id='start-screen';host.className='start-screen';
 host.innerHTML=`<img class="start-logo" src="${logo}" alt="Carbon Studio"/><h1 id="start-title">Seu próximo documento começa aqui.</h1><p id="start-description">Selecione uma pasta para começar ou comece do template.</p><div id="start-path" class="start-path hidden"></div><div id="document-picker" class="document-picker"></div><div class="start-actions"><button id="start-open" class="primary">${icon('folder')}Selecionar pasta</button><button id="start-template">${icon('template')}Começar do template</button><button id="start-cv">Currículo</button><button id="refresh-project" class="hidden">${icon('refresh')}Atualizar lista</button></div>`;
 document.querySelector('.workspace')!.prepend(host);
 host.querySelector<HTMLButtonElement>('#start-open')!.onclick=actions.open;
 host.querySelector<HTMLButtonElement>('#start-template')!.onclick=actions.template;
 host.querySelector<HTMLButtonElement>('#start-cv')!.onclick=actions.cv;
 host.querySelector<HTMLButtonElement>('#refresh-project')!.onclick=actions.refresh;
 return (document:DocumentState)=>{
  const active=document.active!==false;host.classList.toggle('hidden',active);host.parentElement!.classList.toggle('show-start',!active);
  window.document.querySelector('.sidebar')!.classList.toggle('no-document',!active);
  if(active)return;
  const folder=document.workspace,files=document.documents||[];
  host.querySelector('#start-title')!.textContent=folder?(files.length?'Selecione um arquivo Carbon para começar:':'Nenhum arquivo Carbon nesta pasta.'):'Seu próximo documento começa aqui.';
  host.querySelector('#start-description')!.textContent=folder?(files.length?'Escolha o documento que deseja editar nesta pasta.':'Comece do template para criar seu primeiro arquivo .cb nesta pasta.'):'Selecione uma pasta para começar ou comece do template.';
  const location=host.querySelector('#start-path')!;location.textContent=folder||'';location.classList.toggle('hidden',!folder);
  host.querySelector('#refresh-project')!.classList.toggle('hidden',!folder);
  const picker=host.querySelector('#document-picker')!;picker.replaceChildren();
  for(const name of files){
   const button=window.document.createElement('button');button.className='document-card';button.dataset.document=name;
   const symbol=window.document.createElement('span');symbol.innerHTML=icon('file');
   const content=window.document.createElement('span'),title=window.document.createElement('strong'),directory=window.document.createElement('small');
   title.textContent=name.split('/').pop()||name;directory.textContent=name.includes('/')?name.slice(0,name.lastIndexOf('/')):'Pasta principal';content.append(title,directory);button.append(symbol,content);button.onclick=()=>actions.select(name);picker.append(button);
  }
 };
}
