import {monaco} from './editor';
import type {StudioTheme} from './api';
export function applyStudioTheme(theme:StudioTheme){
 for(const [key,value] of Object.entries(theme.ui))document.documentElement.style.setProperty('--studio-'+key,value);
 document.documentElement.dataset.theme=theme.id;
 document.documentElement.style.colorScheme=theme.appearance;
 monaco.editor.defineTheme('local-'+theme.id,theme.editor);
 monaco.editor.setTheme('local-'+theme.id);
}
