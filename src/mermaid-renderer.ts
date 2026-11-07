import mermaid from 'mermaid';

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
