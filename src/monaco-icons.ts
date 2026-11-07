const files=import.meta.glob('../assets/icons/monaco/*.svg',{query:'?url',import:'default',eager:true}) as Record<string,string>;
const aliases:Record<string,string[]>={
 'chevron-right':['chevron-right','find-collapsed','folding-collapsed','folding-manual-collapsed'],
 'chevron-down':['chevron-down','find-expanded','folding-expanded','folding-manual-expanded'],
 close:['close','widget-close'],selection:['selection','find-selection'],replace:['replace','find-replace'],
 'replace-all':['replace-all','find-replace-all'],'arrow-up':['arrow-up','find-previous-match'],'arrow-down':['arrow-down','find-next-match'],
 'case-sensitive':['case-sensitive'],'whole-word':['whole-word'],regex:['regex'],'preserve-case':['preserve-case'],
};
const style=document.createElement('style');style.id='carbon-monaco-svg-icons';
style.textContent=Object.entries(aliases).map(([name,classes])=>{
 const url=files[`../assets/icons/monaco/${name}.svg`];if(!url)return '';
 return classes.map(name=>`.monaco-editor .codicon-${name}::before`).join(',')+`{content:""!important;display:inline-block;width:16px;height:16px;background-color:currentColor;-webkit-mask:url(${JSON.stringify(url)}) center/contain no-repeat;mask:url(${JSON.stringify(url)}) center/contain no-repeat;}`;
}).join('\n');document.head.append(style);
