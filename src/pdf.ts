import {getDocument,GlobalWorkerOptions,type PDFDocumentProxy,type PDFPageProxy} from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
GlobalWorkerOptions.workerSrc=pdfWorker;
export class PdfPreview {
  private pdf:PDFDocumentProxy|null=null;
  private generation=0;
  private scale:number|null=null;
  private activeTasks=new Set<{cancel:()=>void}>();
  private observer:IntersectionObserver|null=null;
  private queue:Promise<void>=Promise.resolve();
  private rendered=new WeakSet<HTMLElement>();
  private queued=new WeakSet<HTMLElement>();
  constructor(private host:HTMLElement,private onPages:(count:number)=>void){}
  get count(){return this.pdf?.numPages??0;}
  async load(bytes:Uint8Array){
    const pdf=await getDocument({data:new Uint8Array(bytes),enableXfa:false}).promise;
    const previous=this.pdf;this.pdf=pdf;this.onPages(pdf.numPages);
    await this.render();await previous?.loadingTask.destroy();
  }
  setZoom(value:number|null){this.scale=value;return this.render();}
  private cancel(){++this.generation;this.observer?.disconnect();this.observer=null;for(const task of this.activeTasks)task.cancel();}
  private async draw(wrapper:HTMLElement,page:PDFPageProxy,scale:number,token:number){
    if(token!==this.generation||this.rendered.has(wrapper))return;
    const isNearby=()=>{const bounds=this.host.getBoundingClientRect(),rect=wrapper.getBoundingClientRect();return rect.bottom>=bounds.top-700&&rect.top<=bounds.bottom+700;};
    if(!isNearby())return;
    const viewport=page.getViewport({scale});const ratio=Math.min(window.devicePixelRatio||1,2);
    const canvas=document.createElement('canvas');canvas.style.width=`${viewport.width}px`;canvas.style.height=`${viewport.height}px`;
    canvas.width=Math.floor(viewport.width*ratio);canvas.height=Math.floor(viewport.height*ratio);
    const context=canvas.getContext('2d');if(!context)throw new Error('Canvas não disponível.');
    wrapper.replaceChildren(canvas);
    const task=page.render({canvas,canvasContext:context,viewport,transform:ratio!==1?[ratio,0,0,ratio,0,0]:undefined});this.activeTasks.add(task);
    try{await task.promise;}catch(error){if(token===this.generation&&!(error instanceof Error&&error.name==='RenderingCancelledException'))throw error;return;}finally{this.activeTasks.delete(task);}
    if(token!==this.generation)return;
    if(!isNearby()){canvas.width=1;canvas.height=1;wrapper.replaceChildren();page.cleanup();return;}
    const label=document.createElement('span');label.className='page-label';label.textContent=wrapper.dataset.page??'';wrapper.append(label);
    this.rendered.add(wrapper);
    for(const annotation of await page.getAnnotations()){
      if(token!==this.generation)return;
      if(annotation.subtype!=='Link'||!annotation.dest||!annotation.rect)continue;
      const rect=[...viewport.convertToViewportPoint(annotation.rect[0],annotation.rect[1]),...viewport.convertToViewportPoint(annotation.rect[2],annotation.rect[3])];
      const link=document.createElement('button');link.className='pdf-reference';link.title='Ir para a referência';link.setAttribute('aria-label','Ir para a referência');
      link.style.left=`${Math.min(rect[0],rect[2])}px`;link.style.top=`${Math.min(rect[1],rect[3])}px`;link.style.width=`${Math.abs(rect[2]-rect[0])}px`;link.style.height=`${Math.abs(rect[3]-rect[1])}px`;
      link.onclick=()=>void(async()=>{const pdf=this.pdf;if(!pdf)return;const dest=typeof annotation.dest==='string'?await pdf.getDestination(annotation.dest):annotation.dest;if(!dest)return;const index=typeof dest[0]==='number'?dest[0]:await pdf.getPageIndex(dest[0]);this.goTo(index+1);})().catch(()=>{});
      wrapper.append(link);
    }
  }
  async render(){
    this.cancel();const token=this.generation,pdf=this.pdf;if(!pdf)return;
    const previousPage=this.currentPage();await this.queue.catch(()=>{});if(token!==this.generation)return;
    this.rendered=new WeakSet();this.queued=new WeakSet();this.host.replaceChildren();
    const available=Math.max(240,this.host.clientWidth-74);
    const pages=new Map<HTMLElement,{page:PDFPageProxy;scale:number}>();
    const observer=new IntersectionObserver(entries=>{
      for(const entry of entries){
        if(token!==this.generation)return;
        const wrapper=entry.target as HTMLElement;
        if(entry.isIntersecting&&!this.rendered.has(wrapper)&&!this.queued.has(wrapper)){
          const item=pages.get(wrapper);if(!item)continue;this.queued.add(wrapper);
          this.queue=this.queue.catch(()=>{}).then(async()=>{if(token===this.generation)await this.draw(wrapper,item.page,item.scale,token);}).finally(()=>this.queued.delete(wrapper));
        }else if(!entry.isIntersecting&&this.rendered.has(wrapper)){
          wrapper.querySelectorAll('canvas').forEach(canvas=>{canvas.width=1;canvas.height=1;});wrapper.replaceChildren();this.rendered.delete(wrapper);
        }
      }
    },{root:this.host,rootMargin:'600px 0px'});this.observer=observer;
    for(let number=1;number<=pdf.numPages;number++){
      if(token!==this.generation)return;const page=await pdf.getPage(number);if(token!==this.generation)return;
      const baseline=page.getViewport({scale:1});const scale=this.scale??Math.min(2,available/baseline.width);const viewport=page.getViewport({scale});
      const wrapper=document.createElement('section');wrapper.className='pdf-page';wrapper.dataset.page=String(number);wrapper.style.width=`${viewport.width}px`;wrapper.style.height=`${viewport.height}px`;wrapper.setAttribute('aria-label',`Página ${number} do PDF`);
      this.host.append(wrapper);pages.set(wrapper,{page,scale});observer.observe(wrapper);
    }
    const selected=Array.from(pages.entries()).find(([wrapper])=>Number(wrapper.dataset.page)===Math.min(previousPage,pdf.numPages))??Array.from(pages.entries())[0];
    if(selected){const [wrapper,item]=selected;this.queued.add(wrapper);this.queue=this.queue.catch(()=>{}).then(()=>this.draw(wrapper,item.page,item.scale,token)).finally(()=>this.queued.delete(wrapper));await this.queue;}
  }
  async clear(){this.cancel();const pdf=this.pdf;this.pdf=null;await this.queue.catch(()=>{});await pdf?.loadingTask.destroy();this.host.replaceChildren();this.onPages(0);}
  currentPage(){const bounds=this.host.getBoundingClientRect();const nodes=Array.from(this.host.querySelectorAll<HTMLElement>('.pdf-page'));return Number(nodes.find(p=>p.getBoundingClientRect().bottom>bounds.top+70)?.dataset.page??1);}
  goTo(page:number){this.host.querySelector(`[data-page="${Math.max(1,Math.min(this.count,page))}"]`)?.scrollIntoView({behavior:'smooth',block:'start'});}
}
