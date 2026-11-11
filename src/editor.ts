import * as monaco from 'monaco-editor/editor/editor.api.js';
import 'monaco-editor/editor/browser/coreCommands.js';
import 'monaco-editor/editor/contrib/find/browser/findController.js';
import 'monaco-editor/editor/contrib/folding/browser/folding.js';
import 'monaco-editor/editor/contrib/comment/browser/comment.js';
import EditorWorker from 'monaco-editor/editor/editor.worker.js?worker';
window.MonacoEnvironment = { getWorker: () => new EditorWorker() };
monaco.languages.register({id:'carbon',extensions:['.cb'],aliases:['Carbon']});
monaco.languages.setMonarchTokensProvider('carbon', {
  tokenizer:{
    root:[
      [/\/\//,'comment','@lineComment'],
      [/\/\*/,'comment','@blockComment'],
      [/https?:\/\/[^\s)]+/,'string.link'],
      [/"[^"]*"|'[^']*'/,'string'],
      [/^@(margins|page|typography|paragraph|columns|links)\s*\{/,{token:'keyword',next:'@configuration'}],
      [/[@]align\((?:left|l|center|c|right|r|justify|j)\)\[/i,'function'],
      [/^@(paragraph|eq|equations|include|title|author|date|type|toc|tableofcontents|import|entry|print_bibliography|mermaid|caption|table|newpage|cv-entry|headline|contact|header|footer|matrix|equation)\b/,'keyword'],
      [/^@[a-z][\w-]*/,'keyword'],
      [/\bpos\s*=\s*\[[^\]]*\]/,'function'],
      [/^#{1,3}\s.*$/,'heading'],
      [/^```mermaid.*$/,{token:'type.identifier',next:'@code'}],
      [/^```.*$/,{token:'string',next:'@code'}],
      [/^\$\$.*$/,{token:'number',next:'@math'}],
      [/!\[[^\]]*\]\([^)]*\)/,'type.identifier'],
      [/@(?:ref|pageref|autoref|cite|eqref)\([^)]+\)/,'function'],
      [/\$[^$]+\$/,'number'],
      [/\*\*[^*]+\*\*/,'strong'],
      [/\*[^*]+\*/,'emphasis'],
      [/\|/,'delimiter'],
    ],
    lineComment:[[/.*/,'comment','@pop']],
    blockComment:[[/\*\//,'comment','@pop'],[/[^*]+/,'comment'],[/\*/,'comment']],
    code:[[/^```\s*$/,{token:'string',next:'@pop'}],[/.+/,'code']],
    configuration:[[/\}/,{token:'delimiter',next:'@pop'}],[/#.*$/,'comment'],[/\b[a-z][\w-]*(?=\s*:)/,'keyword'],[/"[^"]*"|'[^']*'/,'string'],[/\d+(?:\.\d+)?(?:cm|mm|in|pt)?/,'number'],[/[{},:]/,'delimiter']],
    math:[[/^\$\$\s*$/,{token:'number',next:'@pop'}],[/.+/,'number']],
  },
});
monaco.languages.registerCompletionItemProvider('carbon',{
  triggerCharacters:['@'],
  provideCompletionItems(model,position){
    const word=model.getWordUntilPosition(position),range={startLineNumber:position.lineNumber,endLineNumber:position.lineNumber,startColumn:word.startColumn,endColumn:word.endColumn};
    const snippets=[
      ['margins','Margens do documento','margins {\n  top: 2.5cm,\n  bottom: 2.5cm,\n  left: 3cm,\n  right: 2cm\n}'],
      ['page','Papel e orientação','page {\n  size: A4,\n  orientation: portrait\n}'],
      ['typography','Fonte, tamanho e entrelinha','typography {\n  font: "Latin Modern Roman",\n  fontsize: 12pt,\n  lineheight: 1.5\n}'],
      ['paragraph','Recuo e espaçamento','paragraph {\n  indent-first: 1.25cm,\n  indent-after-heading: false,\n  spacing-before: 0pt,\n  spacing-after: 6pt\n}'],
      ['include','Incluir capítulo','include ${1:capitulos/introducao.cb}'],
      ['eq','Equação simplificada','eq[label=${1:eq:energia}][\n${2:E=mc^2}\n]'],
      ['equations','Sistema de equações','equations[label=${1:eq:sistema}][\nx+y=10\nx-y=2\n]'],
      ['columns','Bloco com colunas','columns[count=2 gap=0.8cm divider=true][\n${1:Conteúdo.}\n]'],
      ['columnbreak','Quebra de coluna','columnbreak'],
      ['caption','Apresentação da legenda','caption[position=${1|bottom,top,left,right,overlay-top,overlay-bottom|} align=${2|center,left,right,justify|}]'],
      ['abstract','Resumo científico','abstract[\n${1:Resumo.}\n]'],
      ['keywords','Palavras-chave','keywords ${1:ciência, medição}'],
      ['theorem','Teorema','theorem[label=${1:th:teorema} title="${2:Título}"][\n${3:Enunciado.}\n]'],
      ['proof','Demonstração','proof[\n${1:Demonstração.}\n]'],
      ['definition','Definição','definition[\n${1:Definição.}\n]'],
      ['warning','Bloco de aviso','warning[\n${1:Aviso.}\n]'],
      ['note','Bloco de nota','note[\n${1:Nota.}\n]'],
      ['source','Fonte da figura/tabela','source ${1:Fonte.}'],
      ['links','Aparência dos links','links {\n  color: "#2563EB",\n  underline: true,\n  breakable: true\n}'],
      ['let','Definir variável','let ${1:nome} = ${2:valor}'],
      ['var','Usar variável','var(${1:nome})'],
      ['language','Idioma do documento','language ${1|pt-BR,pt-PT,en,es,fr,de|}'],
      ['code','Código com realce','code[language=${1|text,javascript,typescript,python,c,cpp,java,bash,sql,latex|} caption="${2:Código}"][\n${3:const value = 2;}\n]'],
      ['keep','Manter conteúdo junto','keep[\n${1:Conteúdo.}\n]'],
      ['numbering','Formato dos contadores','numbering[section=Roman figure=arabic equation=arabic]'],
      ['setcounter','Alterar contador','setcounter[${1|figure,table,equation,section,page|}=${2:0}]'],
      ['newpage','Quebra manual de página','newpage'],
      ['align','Bloco de alinhamento','align(${1|left,center,right,justify|})[\n${2:Seu texto aqui.}\n]'],
    ];
    if(/^\s*\|/.test(model.getLineContent(position.lineNumber)))snippets.find(item=>item[0]==='align')![2]='align(${1|left,center,right,justify|})[${2:Conteúdo}]';
    const hasAt=model.getLineContent(position.lineNumber)[word.startColumn-2]==='@';
    return {suggestions:snippets.map(([label,detail,insertText])=>({label:'@'+label,detail,kind:monaco.languages.CompletionItemKind.Snippet,insertText:(hasAt?'':'@')+insertText,insertTextRules:monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,range}))};
  },
});
monaco.languages.setLanguageConfiguration('carbon',{ comments:{lineComment:'//',blockComment:['/*','*/']},brackets:[['{','}'],['[',']'],['(',')']],autoClosingPairs:[{open:'{',close:'}'},{open:'[',close:']'},{open:'(',close:')'}] });
monaco.editor.defineTheme('carbon-dark',{
  base:'vs-dark',inherit:true,
  rules:[{token:'keyword',foreground:'7DD3AF'},{token:'heading',foreground:'E4EBF3',fontStyle:'bold'},{token:'strong',foreground:'E6D3A7',fontStyle:'bold'},{token:'emphasis',foreground:'BFCBE0',fontStyle:'italic'},{token:'number',foreground:'C7A7EF'},{token:'type.identifier',foreground:'8BC4EC'},{token:'function',foreground:'D9BC88'},{token:'code',foreground:'A0B3C9'},{token:'delimiter',foreground:'6C8097'}],
  colors:{'editor.background':'#14212D','editor.foreground':'#CBD5E1','editorLineNumber.foreground':'#4E6479','editorLineNumber.activeForeground':'#B5C9DA','editorCursor.foreground':'#80E0B6','editor.selectionBackground':'#35526988','editor.lineHighlightBackground':'#1A2B3B','editorIndentGuide.background1':'#25394B','editorIndentGuide.activeBackground1':'#47627B','editorOverviewRuler.border':'#14212D','scrollbarSlider.background':'#54708755','scrollbarSlider.hoverBackground':'#54708799'},
});
export function createEditor(element:HTMLElement) {
  return monaco.editor.create(element,{
    value:'',language:'carbon',theme:'carbon-dark',fontFamily:'"Cascadia Code", "Consolas", monospace',fontSize:14,lineHeight:25,
    minimap:{enabled:false},wordWrap:'on',scrollBeyondLastLine:false,automaticLayout:true,padding:{top:25,bottom:25},
    lineNumbersMinChars:4,glyphMargin:true,folding:true,renderLineHighlight:'line',smoothScrolling:true,
    tabSize:4,insertSpaces:true,unicodeHighlight:{ambiguousCharacters:false,invisibleCharacters:true},
    accessibilitySupport:'auto',ariaLabel:'Editor de código Carbon',quickSuggestions:false,editContext:false,
  });
}
export {monaco};
