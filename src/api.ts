export interface DocumentState { path: string | null; text: string; savedText: string; dirty: boolean; active:boolean; workspace:string|null; documents:string[]; project: {name:string;kind:string}[] }
export interface Settings { paper:'letter'|'a4'|'legal'|'a5';theme:string;defaultAuthor:string;defaultInstitution:string }
export interface StudioTheme {id:string;label:string;appearance:'dark'|'light';ui:Record<string,string>;editor:import('monaco-editor/editor/editor.api.js').editor.IStandaloneThemeData}
export interface DocumentLayout { margins:{top:string;bottom:string;left:string;right:string};page:{size:string;orientation:string};typography:{font:string;fontsize:string;lineheight:number} }
export interface TextRange {startLineNumber:number;startColumn:number;endLineNumber:number;endColumn:number}
export type Result<T> = {ok:true;data:T} | {ok:false;error:string};
export interface CompileResult { bytes:Uint8Array;duration:number;stale:boolean }
export interface StudioEvent { type:string;document?:DocumentState;replaceText?:boolean;action?:string;message?:string;stream?:string;text?:string;duration?:number;stale?:boolean }
export interface Api {
  bootstrap():Promise<Result<{document:DocumentState;settings:Settings;themes:StudioTheme[];themesDirectory:string;version:string;platform:string}>>;
  newDocument():Promise<Result<DocumentState|null>>; openDocument():Promise<Result<DocumentState|null>>;
  selectDocument(relative:string):Promise<Result<DocumentState|null>>;refreshProject():Promise<Result<DocumentState>>;
  saveDocument(saveAs:boolean):Promise<Result<DocumentState|null>>; updateText(text:string):void;
  compile():Promise<Result<CompileResult|null>>; cancelCompile():Promise<Result<null>>;
  exportPdf():Promise<Result<string|null>>; chooseImage():Promise<Result<string|null>>;
  getSettings():Promise<Result<Settings>>;saveSettings(settings:Settings):Promise<Result<Settings>>;
  getThemes():Promise<Result<{themes:StudioTheme[];directory:string;errors:string[]}>>;
  openRepository():Promise<Result<void>>;openThemesFolder():Promise<Result<null>>;
  getLayout(source:string):Promise<Result<DocumentLayout>>;
  applyLayout(source:string,layout:DocumentLayout):Promise<Result<string>>;
  alignText(source:string,selection:TextRange,target:'block'|'column'|'cell',mode:string):Promise<Result<{range:TextRange;text:string}>>;
  chooseTool():Promise<Result<string|null>>;onEvent(callback:(event:StudioEvent)=>void):()=>void;
}
declare global { interface Window { carbonStudio:Api;MonacoEnvironment?:{getWorker:()=>Worker} } }
