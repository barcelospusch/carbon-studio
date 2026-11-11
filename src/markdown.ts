import {marked} from 'marked';
import DOMPurify from 'dompurify';
import {monaco} from './editor';
import katex from 'katex';
import 'katex/dist/katex.min.css';

export class MarkdownPreview {
  private generation=0;
  constructor(private host:HTMLElement){}
  cancel(){this.generation++;}
  async render(source:string,diagram=false){
    const token=++this.generation;
    const html=await marked.parse(diagram?'```mermaid\n'+source+'\n```':source,{gfm:true,breaks:false});
    if(token!==this.generation)return;
    const scroll=this.host.scrollTop;
    this.host.innerHTML=DOMPurify.sanitize(html,{FORBID_TAGS:['style','iframe','object','embed','form'],FORBID_ATTR:['style'],ALLOW_DATA_ATTR:false});
    const walker=document.createTreeWalker(this.host,NodeFilter.SHOW_TEXT),mathNodes:Text[]=[];
    while(walker.nextNode()){const node=walker.currentNode as Text;if(!node.parentElement?.closest('pre,code')&&node.textContent?.includes('$'))mathNodes.push(node);}
    for(const node of mathNodes){
      const text=node.textContent||'',fragment=document.createDocumentFragment();let offset=0;
      for(const match of text.matchAll(/\$\$([\s\S]+?)\$\$|\$([^\n$]+?)\$/g)){
        fragment.append(document.createTextNode(text.slice(offset,match.index)));
        const math=document.createElement('span');math.innerHTML=DOMPurify.sanitize(katex.renderToString(match[1]??match[2],{displayMode:match[1]!==undefined,throwOnError:false,trust:false,output:'htmlAndMathml'}));fragment.append(math);offset=match.index!+match[0].length;
      }
      if(offset){fragment.append(document.createTextNode(text.slice(offset)));node.replaceWith(fragment);}
    }
    for(const heading of this.host.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6'))heading.id=(heading.textContent||'').toLowerCase().replace(/[^\p{L}\p{N} -]/gu,'').replace(/\s+/g,'-');
    this.host.querySelectorAll('a').forEach(link=>{link.removeAttribute('target');link.onclick=event=>{event.preventDefault();const href=link.getAttribute('href')||'';if(/^https?:\/\//i.test(href))void window.carbonStudio.externalLink(href);else if(href.startsWith('#'))this.host.querySelector('#'+CSS.escape(decodeURIComponent(href.slice(1))))?.scrollIntoView();};});
    await Promise.all([...this.host.querySelectorAll('img')].map(async image=>{
      const src=image.getAttribute('src')||'';image.removeAttribute('src');
      // Local images pass through the same canonical project path checks as Carbon assets.
      if(!src||/^(?:[a-z]+:|\/\/)/i.test(src)){image.remove();return;}
      const result=await window.carbonStudio.localImage(decodeURIComponent(src)).catch(()=>null);
      if(token!==this.generation)return;
      if(result?.ok)image.src=result.data;else image.replaceWith(document.createTextNode(image.alt));
    }));
    for(const code of this.host.querySelectorAll<HTMLElement>('pre code:not(.language-mermaid)')){const language=[...code.classList].find(value=>value.startsWith('language-'))?.slice(9)||'plaintext';try{const colored=await monaco.editor.colorize(code.textContent||'',language,{});if(token!==this.generation)return;code.innerHTML=DOMPurify.sanitize(colored);}catch{/* Unknown languages remain plain text. */}}
    const diagrams=[...this.host.querySelectorAll<HTMLElement>('code.language-mermaid')];
    if(diagrams.length){
      const {default:mermaid}=await import('mermaid');mermaid.initialize({startOnLoad:false,securityLevel:'strict',suppressErrorRendering:true});
      for(let i=0;i<diagrams.length;i++){
        if(token!==this.generation)return;
        try{const {svg}=await mermaid.render(`md-diagram-${token}-${i}`,diagrams[i].textContent||'');if(token!==this.generation)return;const graphic=document.createElement('div');graphic.innerHTML=DOMPurify.sanitize(svg,{USE_PROFILES:{svg:true,svgFilters:true}});diagrams[i].parentElement!.replaceWith(graphic);}
        catch{if(token===this.generation)diagrams[i].parentElement!.setAttribute('title','Diagrama Mermaid inválido.');}
      }
    }
    if(token===this.generation)this.host.scrollTop=scroll;
  }
}
