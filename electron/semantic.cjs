'use strict';
const {length,boolean}=require('./document-options.cjs');
const languages={
  'pt-BR':{babel:'brazil',figure:'Figura',table:'Tabela',contents:'Conteúdo',abstract:'Resumo',keywords:'Palavras-chave',theorem:'Teorema',definition:'Definição',proof:'Demonstração'},
  'pt-PT':{babel:'portuguese',figure:'Figura',table:'Tabela',contents:'Índice',abstract:'Resumo',keywords:'Palavras-chave',theorem:'Teorema',definition:'Definição',proof:'Demonstração'},
  en:{babel:'english',figure:'Figure',table:'Table',contents:'Contents',abstract:'Abstract',keywords:'Keywords',theorem:'Theorem',definition:'Definition',proof:'Proof'},
  es:{babel:'spanish',figure:'Figura',table:'Tabla',contents:'Contenido',abstract:'Resumen',keywords:'Palabras clave',theorem:'Teorema',definition:'Definición',proof:'Demostración'},
  fr:{babel:'french',figure:'Figure',table:'Tableau',contents:'Sommaire',abstract:'Résumé',keywords:'Mots-clés',theorem:'Théorème',definition:'Définition',proof:'Démonstration'},
  de:{babel:'ngerman',figure:'Abbildung',table:'Tabelle',contents:'Inhalt',abstract:'Zusammenfassung',keywords:'Schlüsselwörter',theorem:'Satz',definition:'Definition',proof:'Beweis'},
};
function style(input){
  for(const key of Object.keys(input))if(!['align','font','weight','italic','indent'].includes(key))throw new Error('@style: propriedade inválida '+key);
  const c={align:'justify',font:'normalsize',weight:'normal',italic:'false',indent:'0pt',...input};
  if(!['left','right','center','justify'].includes(c.align)||!['tiny','scriptsize','footnotesize','small','normalsize','large','Large'].includes(c.font)||!['normal','bold'].includes(c.weight))throw new Error('@style: valor inválido.');
  length(c.indent);boolean(c.italic);
  return `\\par\\begingroup\\${{left:'RaggedRight',right:'RaggedLeft',center:'Centering',justify:'justifying'}[c.align]}\\${c.font}\\${c.weight==='bold'?'bfseries':'mdseries'}\\${boolean(c.italic)?'itshape':'upshape'}\\setlength{\\parindent}{${c.indent}}`;
}
function extractSemantic(entries){
  const remaining=[],styles=new Map();let language=null,fenced=false;
  for(let i=0;i<entries.length;i++){
    const entry=entries[i];if(entry.literal){remaining.push(entry);continue;}if(/^\s*```/.test(entry.text))fenced=!fenced;
    let m=!fenced&&entry.text.match(/^@language\s+([\w-]+)\s*$/);
    if(m){if(!languages[m[1]])throw new Error('@language não suportado: '+m[1]);if(language)throw new Error('@language duplicado.');language=languages[m[1]];continue;}
    m=!fenced&&entry.text.match(/^@style\s+([\w.-]+)\s*\{(.*)$/);
    if(!m){remaining.push(entry);continue;}
    let text=m[2];while(!text.includes('}')&&++i<entries.length)text+='\n'+entries[i].text;
    if(!text.includes('}'))throw new Error('@style sem } de fechamento.');
    if(styles.has(m[1]))throw new Error('@style duplicado: '+m[1]);
    const fields={};for(const part of text.slice(0,text.indexOf('}')).split(/[,\n]/).map(x=>x.trim()).filter(Boolean)){
      const field=part.match(/^([\w-]+)\s*:\s*(.+)$/);if(!field||Object.hasOwn(fields,field[1]))throw new Error('@style: propriedade inválida ou duplicada.');fields[field[1]]=field[2].replace(/^(['"])(.*)\1$/,'$2');
    }
    styles.set(m[1],style(fields));
  }
  return {remaining,styles,language};
}
module.exports={extractSemantic,languages,style};
