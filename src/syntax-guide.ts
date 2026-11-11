import source from '../LANGUAGE.md?raw';
import {marked} from 'marked';
import DOMPurify from 'dompurify';
export function installSyntaxGuide(insert:(source:string)=>void){
  const dialog=document.getElementById('help-dialog')!;
  dialog.querySelector('.syntax-grid')?.remove();dialog.querySelector('.dialog-intro')?.remove();
  const search=document.createElement('input');search.type='search';search.placeholder='Pesquisar diretivas, parâmetros ou exemplos';search.setAttribute('aria-label','Pesquisar guia');
  const navigation=document.createElement('nav');navigation.className='guide-navigation';navigation.setAttribute('aria-label','Categorias do guia');
  const content=document.createElement('div');content.className='guide-content';content.innerHTML=DOMPurify.sanitize(marked.parse(source,{async:false}));
  const layout=document.createElement('div');layout.className='guide-layout';layout.append(navigation,content);dialog.append(search,layout);
  const sections:{heading:HTMLElement;section:HTMLElement;button:HTMLButtonElement}[]=[];
  let section=document.createElement('section');
  for(const node of [...content.childNodes]){
    if(node instanceof HTMLElement&&/^H[123]$/.test(node.tagName)){
      section=document.createElement('section');content.append(section);
      const id=(node.textContent||'').toLowerCase().replace(/[^\p{L}\p{N} -]/gu,'').replace(/\s+/g,'-');node.id=id;
      const button=document.createElement('button');button.textContent=node.textContent;button.onclick=()=>node.scrollIntoView({block:'start'});navigation.append(button);sections.push({heading:node,section,button});
    }
    if(!section.parentElement)content.append(section);section.append(node);
  }
  for(const block of content.querySelectorAll<HTMLElement>('pre:has(code.language-carbon)')){
    const button=document.createElement('button');button.className='insert-example';button.textContent='Inserir no editor';button.onclick=()=>{insert('\n'+block.querySelector('code')!.textContent+'\n');(dialog as HTMLDialogElement).close();};block.after(button);
  }
  search.oninput=()=>{const query=search.value.toLocaleLowerCase('pt-BR').trim();for(const item of sections){const match=!query||item.section.textContent?.toLocaleLowerCase('pt-BR').includes(query);item.section.hidden=!match;item.button.hidden=!match;}};
  content.querySelectorAll<HTMLAnchorElement>('a').forEach(link=>link.onclick=event=>{event.preventDefault();const href=link.getAttribute('href')||'';if(href.startsWith('#')){search.value='';search.dispatchEvent(new Event('input'));content.querySelector('#'+CSS.escape(decodeURIComponent(href.slice(1))))?.scrollIntoView();}else if(/^https?:\/\//.test(href))void window.carbonStudio.externalLink(href);});
}
