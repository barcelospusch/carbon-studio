import {icon} from './icons';
import type {DocumentState, Result} from './api';

type Item = 'folder'|'file'|'import-folder'|'import-file'|'image';
const actions: [Item,string,string][] = [
  ['folder','Criar pasta','create-folder'],
  ['file','Criar arquivo .cb','plus'],
  ['import-folder','Importar pasta','upload-folder'],
  ['import-file','Importar arquivo','upload-file'],
  ['image','Importar imagem por URL','image'],
];

export function projectFolders(project: DocumentState) {
  return [new Option('Pasta principal',''), ...project.project.filter(entry => entry.kind === 'folder').map(entry => new Option(entry.name,entry.name))];
}

export function installProjectTools(current: () => DocumentState|null) {
  const toolbar = document.getElementById('project-actions')!;
  const markup = actions.map(([kind,label,symbol]) =>
    '<button class="icon-only" data-project-item="'+kind+'" title="'+label+'" aria-label="'+label+'">'+icon(symbol)+'</button>');
  toolbar.innerHTML = markup.join('');
  document.body.insertAdjacentHTML('beforeend', [
    '<dialog id="project-item-dialog"><form id="project-item-form">',
    '<header><h2 id="project-item-title"></h2><button type="button" class="icon-only" id="project-item-close" aria-label="Fechar">'+icon('close')+'</button></header>',
    '<label>Pasta de destino<select name="folder"></select></label>',
    '<label id="project-item-name">Nome<input name="name" maxlength="150"></label>',
    '<div id="project-item-image" class="hidden">',
    '<label>URL da imagem<input name="link" type="url" placeholder="https://..."></label>',
    '<button id="project-image-preview" type="button">Carregar prévia</button>',
    '<img id="project-image-result" class="hidden" alt="Prévia da imagem">',
    '</div><p id="project-item-error" class="form-error" role="alert"></p>',
    '<footer><button type="submit" class="primary" id="project-item-submit">Confirmar</button></footer></form></dialog>',
  ].join(''));
  const dialog = document.getElementById('project-item-dialog') as HTMLDialogElement;
  const form = document.getElementById('project-item-form') as HTMLFormElement;
  const field = (name:string) => form.elements.namedItem(name) as HTMLInputElement;
  const folder = form.elements.namedItem('folder') as HTMLSelectElement;
  const preview = document.getElementById('project-image-result') as HTMLImageElement;
  const error = document.getElementById('project-item-error')!;
  const submit = document.getElementById('project-item-submit') as HTMLButtonElement;
  const previewButton = document.getElementById('project-image-preview') as HTMLButtonElement;
  const unwrap = <T,>(result:Result<T>) => {
    if (!result.ok) throw new Error(result.error);
    return result.data;
  };
  let kind: Item;
  let root: string|null;
  let loadedLink = '';
  for (const button of toolbar.querySelectorAll<HTMLButtonElement>('button')) {
    button.onclick = () => {
      const project = current();
      if (!project?.workspace) return;
      root = project.workspace;
      kind = button.dataset.projectItem as Item;
      form.reset();
      loadedLink = '';
      error.textContent = '';
      preview.classList.add('hidden');
      preview.removeAttribute('src');
      folder.replaceChildren(...projectFolders(project));
      document.getElementById('project-item-title')!.textContent = button.title;
      const requiresName = !kind.startsWith('import-');
      document.getElementById('project-item-name')!.classList.toggle('hidden', !requiresName);
      document.getElementById('project-item-image')!.classList.toggle('hidden', kind !== 'image');
      field('name').required = requiresName;
      field('link').required = kind === 'image';
      submit.disabled = kind === 'image';
      dialog.showModal();
    };
  }
  document.getElementById('project-item-close')!.onclick = () => dialog.close();
  field('link').oninput = () => {
    loadedLink = '';
    preview.classList.add('hidden');
    submit.disabled = true;
  };
  previewButton.onclick = async () => {
    error.textContent = '';
    const link = field('link').value.trim();
    previewButton.disabled = true;
    submit.disabled = true;
    try {
      const result = unwrap(await window.carbonStudio.imagePreview(link));
      if (!dialog.open || kind !== 'image' || field('link').value.trim() !== link) return;
      preview.src = result.url;
      await preview.decode();
      preview.classList.remove('hidden');
      field('name').placeholder = 'imagem' + result.extension;
      if (!field('name').value) field('name').value = 'imagem' + result.extension;
      loadedLink = link;
    } catch (problem) {
      error.textContent = problem instanceof Error ? problem.message : String(problem);
    } finally {
      previewButton.disabled = false;
      submit.disabled = kind === 'image' && !loadedLink;
    }
  };
  form.onsubmit = async event => {
    event.preventDefault();
    error.textContent = '';
    submit.disabled = true;
    try {
      if (current()?.workspace !== root) throw new Error('A pasta do projeto mudou. Abra o formulário novamente.');
      const fields = {folder:folder.value,name:field('name').value.trim()};
      const result = kind === 'image'
        ? unwrap(await window.carbonStudio.imageImport({...fields,link:loadedLink}))
        : unwrap(await window.carbonStudio.projectItem({...fields,kind}));
      if (result) {
        dialog.close();
      }
    } catch (problem) {
      error.textContent = problem instanceof Error ? problem.message : String(problem);
    } finally {
      submit.disabled = kind === 'image' && !loadedLink;
    }
  };
}
