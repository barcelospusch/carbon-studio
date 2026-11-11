import mermaid from 'mermaid';
import {getDocument,GlobalWorkerOptions} from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
GlobalWorkerOptions.workerSrc=pdfWorker;

mermaid.initialize({
  startOnLoad: false,
  securityLevel: 'strict',
  htmlLabels: false,
  maxTextSize: 50_000,
  maxEdges: 500,
  suppressErrorRendering: true,
  secure: ['secure', 'securityLevel', 'startOnLoad', 'maxTextSize', 'maxEdges', 'htmlLabels', 'flowchart'],
});

Object.assign(window, {
  async validateCarbonAsset(url:string,extension:string,page:number){
    if(extension==='.pdf'){
      const task=getDocument({url,disableRange:true,disableStream:true,enableXfa:false});
      try{const pdf=await task.promise;if(page>pdf.numPages)throw new Error('Página '+page+' ausente no PDF ('+pdf.numPages+' páginas).');await pdf.getPage(page);}finally{await task.destroy();}
    }else{const image=new Image();image.src=url;try{await image.decode();}catch{throw new Error('Imagem corrompida ou impossível de decodificar.');}if(!image.naturalWidth||!image.naturalHeight)throw new Error('Imagem sem dimensões válidas.');image.src='';}
  },
  async renderCarbonDiagram(source: string) {
    const {svg} = await mermaid.render('carbon-diagram', source);
    const graphic = new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement;
    const [, , width, height] = (graphic.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
    if (!(width > 0 && height > 0)) throw new Error('Dimensões inválidas no diagrama.');
    const scale = Math.min(2, 4096 / Math.max(width, height));
    graphic.setAttribute('width', String(width));
    graphic.setAttribute('height', String(height));
    graphic.removeAttribute('style');
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(graphic)], {type:'image/svg+xml'}));
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.ceil(width * scale));
      canvas.height = Math.max(1, Math.ceil(height * scale));
      const context = canvas.getContext('2d')!;
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/png').split(',')[1];
    } finally {
      URL.revokeObjectURL(url);
    }
  },
});
