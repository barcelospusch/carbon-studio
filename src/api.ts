export interface DocumentState { path: string | null; text: string; savedText: string; dirty: boolean; active:boolean; workspace:string|null; documents:string[]; project: {name:string;kind:string}[] }
export interface Settings { paper:'letter'|'a4'|'legal'|'a5';theme:string;defaultAuthor:string;defaultInstitution:string }
export interface StudioTheme {id:string;label:string;appearance:'dark'|'light';ui:Record<string,string>;editor:import('monaco-editor/editor/editor.api.js').editor.IStandaloneThemeData}
export interface DocumentLayout { margins:{top:string;bottom:string;left:string;right:string};page:{size:string;orientation:string};typography:{font:string;fontsize:string;lineheight:number};paragraph:{'indent-first':string;'indent-after-heading':string;'spacing-before':string;'spacing-after':string} }
export interface TextRange {startLineNumber:number;startColumn:number;endLineNumber:number;endColumn:number}
export type Result<T> = {ok:true;data:T} | {ok:false;error:string};
export interface Diagnostic {severity:'warning'|'error';file:string;line:number;column:number;message:string}
export interface CompileResult { bytes:Uint8Array;duration:number;stale:boolean;diagnostics:Diagnostic[];dependencies:string[] }
export interface StudioEvent { diagnostics?:Diagnostic[]; type:string;document?:DocumentState;replaceText?:boolean;action?:string;message?:string;stream?:string;text?:string;duration?:number;stale?:boolean }
export interface DocumentOptions {columns:Record<string,string>|null;links:Partial<Record<'all'|'external'|'internal',Record<string,string>>>}
export interface Api {
  bootstrap():Promise<Result<{document:DocumentState;settings:Settings;themes:StudioTheme[];themesDirectory:string;version:string;platform:string}>>;
  newDocument(type?:'article'|'cv'):Promise<Result<DocumentState|null>>; openDocument():Promise<Result<DocumentState|null>>;
  selectDocument(relative:string):Promise<Result<DocumentState|null>>;refreshProject():Promise<Result<DocumentState>>;
  projectFile(item:{relative:string;action:'pdf'|'reveal'}):Promise<Result<Uint8Array|null>>;
  externalLink(url:string):Promise<Result<null>>;
  localImage(relative:string):Promise<Result<string>>;
  projectItem(item:{kind:'folder'|'file'|'import-folder'|'import-file';folder:string;name?:string}):Promise<Result<DocumentState|null>>;
  imagePreview(link:string):Promise<Result<{url:string;extension:string}>>;
  imageImport(item:{link:string;folder:string;name:string}):Promise<Result<DocumentState>>;
  projectImage(item:{root:string;relative:string}):Promise<Result<string>>;
  manageImage(item:{root:string;relative:string;action:'rename'|'move'|'delete';value:string}):Promise<Result<{relative:string|null}|null>>;
  saveDocument(saveAs:boolean):Promise<Result<DocumentState|null>>; updateText(text:string):void;
  validate():Promise<Result<Diagnostic[]|null>>;
  compile():Promise<Result<CompileResult|null>>; cancelCompile():Promise<Result<null>>;
  exportPdf():Promise<Result<string|null>>; chooseImage():Promise<Result<string|null>>;
  getSettings():Promise<Result<Settings>>;saveSettings(settings:Settings):Promise<Result<Settings>>;
  getThemes():Promise<Result<{themes:StudioTheme[];directory:string;errors:string[]}>>;
  openRepository():Promise<Result<void>>;openThemesFolder():Promise<Result<null>>;
  checkUpdate():Promise<Result<string|null>>;openUpdate():Promise<Result<void|null>>;
  getDocumentOptions(source:string):Promise<Result<DocumentOptions>>;
  applyDocumentOptions(source:string,options:DocumentOptions):Promise<Result<string>>;
  getLayout(source:string):Promise<Result<DocumentLayout>>;
  applyLayout(source:string,layout:DocumentLayout):Promise<Result<string>>;
  alignText(source:string,selection:TextRange,target:'block'|'column'|'cell',mode:string):Promise<Result<{range:TextRange;text:string}>>;
  chooseTool():Promise<Result<string|null>>;onEvent(callback:(event:StudioEvent)=>void):()=>void;
}
declare global { interface Window { carbonStudio:Api;MonacoEnvironment?:{getWorker:()=>Worker} } }
