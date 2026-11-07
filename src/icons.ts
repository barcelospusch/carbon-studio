const files=import.meta.glob('../assets/icons/*.svg',{query:'?raw',import:'default',eager:true}) as Record<string,string>;
const aliases:Record<string,string>={arrowLeft:'arrow-left',arrowRight:'arrow-right',chevron:'chevron-right',chevronDown:'chevron-down',pageBreak:'page-break'};
function normalize(svg:string){return svg.trim().replace(/<svg\b([^>]*)>/,(_,attributes:string)=>'<svg'+attributes.replace(/\s(?:width|height)=["'][^"']*["']/g,'')+' class="app-svg" aria-hidden="true" focusable="false">').replace(/(fill|stroke)=["'](?:#000000|#000|black)["']/gi,'$1="currentColor"');}
export const icons:Record<string,string>=Object.fromEntries(Object.entries(files).map(([file,svg])=>[file.split('/').pop()!.replace('.svg',''),normalize(svg)]));
export const icon=(name:string)=>icons[aliases[name]||name]||icons.file;
