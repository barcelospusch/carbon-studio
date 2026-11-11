import {icon,icons} from './icons';
export type ViewMode='editor'|'preview'|'vertical'|'horizontal';
// Layout assets are configured here independently of button behavior.
const modes:{mode:ViewMode;label:string;asset:string;fallback:string}[]=[
  {mode:'editor',label:'Somente editor',asset:'view-editor',fallback:'file'},
  {mode:'preview',label:'Somente prévia',asset:'view-preview',fallback:'book'},
  {mode:'vertical',label:'Divisão vertical',asset:'split-horizontal',fallback:'split'},
  {mode:'horizontal',label:'Divisão horizontal',asset:'split-vertical',fallback:'layout'},
];
export function installWorkspaceView(){
  const panels=document.getElementById('panels')!,sidebar=document.querySelector<HTMLElement>('.sidebar')!;
  const storageKey='carbon.workspace.v1';
  let saved:{mode?:ViewMode;width?:number;visible?:boolean;ratio?:number}={};
  try{saved=JSON.parse(localStorage.getItem(storageKey)||'{}')||{};}catch{/* Defaults for damaged preferences. */}
  let mode:ViewMode=modes.some(item=>item.mode===saved.mode)?saved.mode!:'vertical';
  let width=Number.isFinite(saved.width)?Math.max(160,Math.min(480,saved.width!)):224;
  let visible=saved.visible!==false,ratio=Number.isFinite(saved.ratio)?Math.max(20,Math.min(80,saved.ratio!)):50;
  function persist(){try{localStorage.setItem(storageKey,JSON.stringify({mode,width,visible,ratio}));}catch{/* Storage can be unavailable. */}}
  const controls=document.createElement('div');controls.className='view-modes';controls.setAttribute('aria-label','Modos de visualização');
  const toggle=document.createElement('button');toggle.id='toggle-sidebar';toggle.innerHTML=icon('folder');toggle.title='Ocultar / exibir barra lateral';toggle.setAttribute('aria-label',toggle.title);
  toggle.onclick=()=>{visible=!visible;apply();};controls.append(toggle);
  for(const item of modes){const button=document.createElement('button');button.dataset.view=item.mode;button.title=item.label;button.setAttribute('aria-label',item.label);button.innerHTML=icons[item.asset]||icon(item.fallback);button.onclick=()=>{mode=item.mode;apply();};controls.append(button);}
  document.querySelector('.top-actions')!.prepend(controls);
  const resize=document.createElement('div');resize.id='sidebar-divider';resize.className='sidebar-divider';resize.tabIndex=0;resize.setAttribute('role','separator');resize.setAttribute('aria-label','Largura da barra lateral');resize.setAttribute('aria-orientation','vertical');sidebar.after(resize);
  function apply(){
    panels.dataset.view=mode;panels.style.setProperty('--editor-width',ratio+'%');
    controls.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.view===mode)));
    sidebar.style.width=`${Math.min(width,window.innerWidth*.4)}px`;sidebar.hidden=!visible;resize.hidden=!visible;toggle.setAttribute('aria-expanded',String(visible));
    const divider=document.getElementById('divider')!;divider.setAttribute('aria-orientation',mode==='horizontal'?'horizontal':'vertical');divider.setAttribute('aria-valuenow',String(ratio));
    resize.setAttribute('aria-valuenow',String(Math.round(width)));persist();
  }
  const divider=document.getElementById('divider')!;
  function drag(element:HTMLElement,move:(event:PointerEvent)=>void){
    element.onpointerdown=event=>{element.setPointerCapture(event.pointerId);};
    element.onpointermove=event=>{if(element.hasPointerCapture(event.pointerId))move(event);};
    element.onpointerup=event=>{element.releasePointerCapture(event.pointerId);persist();};
    element.onlostpointercapture=()=>persist();
  }
  drag(resize,event=>{width=Math.max(160,Math.min(480,window.innerWidth*.4,event.clientX));apply();});
  resize.onkeydown=event=>{if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();width=Math.max(160,Math.min(480,width+(event.key==='ArrowLeft'?-16:16)));apply();}};
  drag(divider,event=>{const box=panels.getBoundingClientRect();ratio=Math.max(20,Math.min(80,100*(mode==='horizontal'?(event.clientY-box.top)/box.height:(event.clientX-box.left)/box.width)));apply();});
  divider.onkeydown=event=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();ratio=Math.max(20,Math.min(80,ratio+(['ArrowLeft','ArrowUp'].includes(event.key)?-2:2)));apply();}};
  window.addEventListener('resize',apply);apply();
}
