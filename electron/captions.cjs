'use strict';
const {length}=require('./document-options.cjs');
function captionOptions(input={}){
  const defaults={position:'bottom',align:'center',width:'30%',gap:'0.5cm',font:'small',style:'normal'};
  for(const key of Object.keys(input))if(!Object.hasOwn(defaults,key))throw new Error('@caption: opção desconhecida '+key);
  const c={...defaults,...input};
  if(!['top','bottom','left','right','overlay-top','overlay-bottom'].includes(c.position))throw new Error('@caption position inválida.');
  if(!['left','right','center','justify'].includes(c.align))throw new Error('@caption align inválido.');
  if(!/^\d+(?:\.\d+)?%$/.test(c.width)||parseFloat(c.width)<=0||parseFloat(c.width)>=100)throw new Error('@caption width: use uma porcentagem entre 0 e 100.');
  length(c.gap);
  if(!['tiny','scriptsize','footnotesize','small','normalsize','large'].includes(c.font)||!['normal','bold','italic'].includes(c.style))throw new Error('@caption font/style inválido.');
  return c;
}
function presentFigure({file,attrs,label,config,notes=[],inline,subfigure=false}){
  const c=captionOptions(config),side=['left','right'].includes(c.position),width=attrs.width||.8;
  const justification={left:'raggedright',right:'raggedleft',center:'centering',justify:'justified'}[c.align];
  const setup=`\\captionsetup{justification=${justification},singlelinecheck=false,font={${c.font}${c.style==='bold'?',bf':c.style==='italic'?',it':''}},skip=${c.gap}}`;
  const cap=label?`\\caption{${inline(label)}}`:attrs.id?'\\refstepcounter{'+(subfigure?'subfigure':'figure')+'}':'';
  const caption=cap+(attrs.id?`\\label{${attrs.id}}`:'');
  const imageWidth=side?'\\linewidth':width+'\\linewidth';
  const graphic=`\\includegraphics[width=${imageWidth}${file.endsWith('.pdf')?`,page=${attrs.page||1}`:''}]{${file}}`;
  let content;
  if(side){
    const fraction=parseFloat(c.width)/100;
    const captionBox=`\\begin{minipage}[c]{${fraction}\\dimexpr\\linewidth-${c.gap}\\relax}\n${caption}\n\\end{minipage}`;
    const pictureBox=`\\begin{minipage}[c]{${1-fraction}\\dimexpr\\linewidth-${c.gap}\\relax}\n${graphic}\n\\end{minipage}`;
    content=(c.position==='left'?captionBox:pictureBox)+`\\hspace{${c.gap}}`+(c.position==='left'?pictureBox:captionBox);
  }else if(c.position.startsWith('overlay')){
    const top=c.position==='overlay-top';
    content=`\\begin{overpic}[width=${width}\\linewidth${file.endsWith('.pdf')?`,page=${attrs.page||1}`:''}]{${file}}\n\\put(2,${top?98:2}){\\makebox(0,0)[${top?'lt':'lb'}]{\\begin{minipage}{${width*.96}\\linewidth}${caption}\\end{minipage}}}\n\\end{overpic}`;
  }else content=c.position==='top'?caption+'\n'+graphic:graphic+'\n'+caption;
  const supplementary=notes.map(note=>`\\par{\\footnotesize\\noindent ${inline(note)}}`).join('\n');
  return (subfigure?'':`\\begin{figure}[${attrs.placement||'htbp'}]\n`)+`\\centering\n${setup}\n${content}\n${supplementary}\n`+(subfigure?'':'\\end{figure}');
}
function presentTable({content,label,attrs,config,notes=[],inline}){
  const c=captionOptions(config||{position:'top'}),side=['left','right'].includes(c.position);
  const caption=(label?'\\caption{'+inline(label)+'}':attrs.id?'\\refstepcounter{table}':'')+(attrs.id?'\\label{'+attrs.id+'}':'');
  const justification={left:'raggedright',right:'raggedleft',center:'centering',justify:'justified'}[c.align];
  const setup=`\\captionsetup{justification=${justification},singlelinecheck=false,font={${c.font}${c.style==='bold'?',bf':c.style==='italic'?',it':''}},skip=${c.gap}}`;
  let body;
  if(side){
    const fraction=parseFloat(c.width)/100;
    const cap=`\\begin{minipage}[c]{${fraction}\\dimexpr\\linewidth-${c.gap}\\relax}${caption}\\end{minipage}`;
    const table=`\\begin{minipage}[c]{${1-fraction}\\dimexpr\\linewidth-${c.gap}\\relax}${content}\\end{minipage}`;
    body=(c.position==='left'?cap:table)+`\\hspace{${c.gap}}`+(c.position==='left'?table:cap);
  }else if(c.position.startsWith('overlay')){
    body=`\\sbox{\\carbonmediabox}{\\begin{minipage}{\\linewidth}${content}\\end{minipage}}\\usebox{\\carbonmediabox}\\llap{\\raisebox{${c.position==='overlay-top'?'\\ht\\carbonmediabox':'0pt'}}[0pt][0pt]{\\parbox[${c.position==='overlay-top'?'t':'b'}]{\\linewidth}{${c.position==='overlay-top'?'\\vspace{0pt}':''}${caption}}}}`;
  }else body=c.position==='top'?caption+'\n'+content:content+'\n'+caption;
  return `\\begin{table}[${attrs.placement||'htbp'}]\\centering\n${setup}\n${body}\n${notes.map(note=>'\\par{\\footnotesize '+inline(note)+'}').join('\n')}\n\\end{table}`;
}
module.exports={captionOptions,presentFigure,presentTable};
