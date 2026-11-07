'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const run=promisify(execFile);
const BUNDLED={
  'Latin Modern Roman':'lmroman10',
  'TeX Gyre Heros':'texgyreheros',
  'TeX Gyre Termes':'texgyretermes',
  'TeX Gyre Pagella':'texgyrepagella',
};
async function fontPreamble(family,directory){
  if(!family)return '\\usepackage{lmodern}';
  if(Object.hasOwn(BUNDLED,family)){
    const prefix=BUNDLED[family];
    const variants=['regular','bold','italic','bolditalic'];
    return `\\usepackage{fontspec}\n\\setmainfont[BoldFont=${prefix}-${variants[1]}.otf,ItalicFont=${prefix}-${variants[2]}.otf,BoldItalicFont=${prefix}-${variants[3]}.otf]{${prefix}-${variants[0]}.otf}`;
  }
  if(process.platform!=='win32')return `\\usepackage{fontspec}\n\\setmainfont{${family}}`;
  const entries=[];
  const executable=path.join(process.env.SystemRoot||'C:\\Windows','System32','reg.exe');
  for(const hive of ['HKCU','HKLM']){
    try{
      const {stdout}=await run(executable,['query',`${hive}\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts`],{encoding:'utf8',windowsHide:true,timeout:5000,maxBuffer:2*1024*1024});
      for(const line of stdout.split(/\r?\n/)){
        const match=line.match(/^\s*(.+?)\s+REG_SZ\s+(.+?)\s*$/);if(!match)continue;
        const label=match[1].replace(/\s*\((?:TrueType|OpenType)\)$/i,'');
        const file=path.isAbsolute(match[2])?match[2]:path.join(process.env.SystemRoot||'C:\\Windows','Fonts',match[2]);
        entries.push({label,file});
      }
    }catch{ /* A missing user font registry is normal. */ }
  }
  const variants=[['regular',''],['bold',' Bold'],['italic',' Italic'],['bolditalic',' Bold Italic']];
  const installed=[];
  for(const [style,suffix] of variants){
    const entry=entries.find(entry=>entry.label.toLowerCase()===(family+suffix).toLowerCase());
    if(!entry){if(style==='regular')throw new Error(`Fonte não encontrada: ${family}. Instale a família no Windows ou escolha Latin Modern Roman / TeX Gyre Heros.`);continue;}
    const extension=path.extname(entry.file).toLowerCase();
    if(!['.ttf','.otf'].includes(extension))throw new Error(`Fonte ${family}: use uma família TrueType ou OpenType com arquivos TTF/OTF individuais.`);
    const target=`document-font-${style}${extension}`;
    await fs.copyFile(entry.file,path.join(directory,target));installed.push({style,file:target});
  }
  const regular=installed.find(entry=>entry.style==='regular').file;
  const options=['Path=./'];
  for(const [style,key] of [['bold','BoldFont'],['italic','ItalicFont'],['bolditalic','BoldItalicFont']]){
    const variant=installed.find(entry=>entry.style===style);if(variant)options.push(`${key}=${variant.file}`);
  }
  return `\\usepackage{fontspec}\n\\setmainfont[${options.join(',')}]{${regular}}`;
}
module.exports={fontPreamble};
