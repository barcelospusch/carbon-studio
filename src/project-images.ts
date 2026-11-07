import {icon} from './icons';
import {projectFolders} from './project-tools';
import type {DocumentState, Result} from './api';

const imageExtensions = new Set(['png','jpg','jpeg','gif','webp','bmp','avif','ico','svg']);
export const isProjectImage = (kind: string) => imageExtensions.has(kind);

const actions = {rename:'Renomear', move:'Mover', delete:'Excluir'};
type ImageAction = keyof typeof actions;
type Image = {root:string; relative:string};
const filename = (relative: string) => relative.split('/').at(-1)!;

export function installProjectImages(current: () => DocumentState|null, notify: (message: string) => void) {
  const api = window.carbonStudio;
  const workspace = document.querySelector('.workspace')!;
  const sidebar = document.querySelector('.sidebar')!;
  const buttons = (compact: boolean) => Object.entries(actions).map(([action,label]) =>
    `<button type="button" data-image-action="${action}" title="${label} imagem" aria-label="${label} imagem" class="${compact?'icon-only':''}">${icon(action)}${compact?'':label}</button>`).join('');
  workspace.insertAdjacentHTML('beforeend', `
    <section class="image-view hidden" aria-label="Visualizador de imagem">
      <header class="workspace-toolbar image-toolbar">
        <button type="button" id="close-image-view" class="icon-only" title="Voltar" aria-label="Voltar">${icon('arrowLeft')}</button>
        <strong id="project-image-title"></strong><div>${buttons(false)}</div>
      </header>
      <div class="image-stage"><img id="project-image-content" alt=""><p id="project-image-status" role="status"></p></div>
    </section>`);
  document.getElementById('project-actions')!.insertAdjacentHTML('afterend',
    `<div id="sidebar-image-actions" class="project-actions hidden" aria-label="Ações da imagem">${buttons(true)}</div>`);
  document.body.insertAdjacentHTML('beforeend', `
    <div class="image-hover hidden" aria-hidden="true"><img alt=""></div>
    <dialog id="manage-image-dialog"><form>
      <header><h2 id="manage-image-title"></h2></header>
      <p id="manage-image-description"></p>
      <label id="manage-image-name-label">Nome do arquivo <span id="manage-image-extension"></span><input name="name" maxlength="150"></label>
      <label id="manage-image-folder-label">Pasta de destino<select name="folder"></select></label>
      <p id="manage-image-error" class="form-error" role="alert"></p>
      <footer><button type="button" id="cancel-image-action">Cancelar</button><button type="submit" class="primary" id="submit-image-action"></button></footer>
    </form></dialog>`);
  const get = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
  const view = workspace.querySelector<HTMLElement>('.image-view')!;
  const picture = get<HTMLImageElement>('project-image-content');
  const status = get('project-image-status');
  const sidebarActions = get('sidebar-image-actions');
  const popup = document.querySelector<HTMLElement>('.image-hover')!;
  const thumbnail = popup.querySelector('img')!;
  const dialog = get<HTMLDialogElement>('manage-image-dialog');
  const form = dialog.querySelector('form')!;
  const input = form.querySelector('input')!;
  const folder = form.querySelector('select')!;
  const submit = get<HTMLButtonElement>('submit-image-action');
  const cancel = get<HTMLButtonElement>('cancel-image-action');
  let active: Image|null = null;
  let action: ImageAction;
  let hoverTimer: ReturnType<typeof setTimeout>;
  let hoverGeneration = 0;
  let pointer = {x:0,y:0};

  function unwrap<T>(result: Result<T>) {
    if (!result.ok) throw new Error(result.error);
    return result.data;
  }
  function highlight() {
    document.querySelectorAll<HTMLButtonElement>('[data-project-image]').forEach(row => {
      const selected = row.dataset.projectImage === active?.relative;
      row.classList.toggle('active', selected);
      row.setAttribute('aria-pressed', String(selected));
    });
  }
  function hideHover() {
    ++hoverGeneration;
    clearTimeout(hoverTimer);
    popup.classList.add('hidden');
    thumbnail.removeAttribute('src');
  }
  function close() {
    const previous = active;
    active = null;
    picture.removeAttribute('src');
    workspace.classList.remove('show-image');
    sidebar.classList.remove('show-image');
    view.classList.add('hidden');
    sidebarActions.classList.add('hidden');
    highlight();
    if (previous) Array.from(document.querySelectorAll<HTMLButtonElement>('[data-project-image]'))
      .find(row => row.dataset.projectImage === previous.relative)?.focus();
  }
  async function open(image: Image) {
    hideHover();
    active = image;
    highlight();
    picture.removeAttribute('src');
    picture.alt = filename(image.relative);
    get('project-image-title').textContent = image.relative;
    status.textContent = 'Carregando imagem…';
    workspace.classList.add('show-image');
    sidebar.classList.add('show-image');
    view.classList.remove('hidden');
    sidebarActions.classList.remove('hidden');
    try {
      const url = unwrap(await api.projectImage(image));
      if (active !== image) return;
      picture.src = url;
      await picture.decode();
      if (active === image) status.textContent = '';
    } catch (error) {
      if (active !== image) return;
      picture.removeAttribute('src');
      status.textContent = error instanceof Error ? error.message : String(error);
    }
  }
  function placePopup() {
    const {width,height} = popup.getBoundingClientRect();
    popup.style.left = Math.max(8,Math.min(pointer.x+12,innerWidth-width-8))+'px';
    popup.style.top = (pointer.y-height-12>=8 ? pointer.y-height-12 : Math.min(pointer.y+16,innerHeight-height-8))+'px';
  }
  function bind(row: HTMLButtonElement, image: Image) {
    row.dataset.projectImage = image.relative;
    row.onclick = () => void open(image);
    row.onpointermove = event => {
      pointer = {x:event.clientX,y:event.clientY};
      if (!popup.classList.contains('hidden')) placePopup();
    };
    row.onpointerleave = hideHover;
    row.onpointerenter = event => {
      if (event.pointerType === 'touch') return;
      hideHover();
      pointer = {x:event.clientX,y:event.clientY};
      const generation = hoverGeneration;
      hoverTimer = setTimeout(async () => {
        try {
          const url = unwrap(await api.projectImage(image));
          if (generation !== hoverGeneration || !row.isConnected) return;
          thumbnail.src = url;
          await thumbnail.decode();
          if (generation !== hoverGeneration || !row.isConnected) return;
          popup.classList.remove('hidden');
          placePopup();
        } catch { /* The full viewer reports unreadable images. */ }
      }, 180);
    };
  }
  get('close-image-view').onclick = close;
  cancel.onclick = () => dialog.close();
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-image-action]')) {
    button.onclick = () => {
      const project = current();
      if (!active || !project || project.workspace !== active.root) return;
      action = button.dataset.imageAction as ImageAction;
      const name = filename(active.relative);
      const dot = name.lastIndexOf('.');
      form.reset();
      folder.replaceChildren(...projectFolders(project));
      folder.value = active.relative.slice(0,Math.max(0,active.relative.lastIndexOf('/')));
      input.value = name.slice(0,dot);
      input.required = action === 'rename';
      get('manage-image-extension').textContent = '('+name.slice(dot)+')';
      get('manage-image-name-label').classList.toggle('hidden',action !== 'rename');
      get('manage-image-folder-label').classList.toggle('hidden',action !== 'move');
      get('manage-image-title').textContent = actions[action]+' imagem';
      get('manage-image-description').textContent = action === 'delete' ? 'Enviar '+active.relative+' para a Lixeira?' : active.relative;
      get('manage-image-error').textContent = '';
      submit.textContent = actions[action];
      dialog.showModal();
      (action === 'rename' ? input : action === 'move' ? folder : cancel).focus();
      if (action === 'rename') input.select();
    };
  }
  dialog.addEventListener('cancel', event => { if (submit.disabled) event.preventDefault(); });
  form.onsubmit = async event => {
    event.preventDefault();
    if (!active || submit.disabled) return;
    const image = active;
    submit.disabled = cancel.disabled = true;
    get('manage-image-error').textContent = '';
    try {
      const result = unwrap(await api.manageImage({...image,action,value:action === 'rename' ? input.value.trim() : folder.value}));
      if (!result) throw new Error('Há outra operação de projeto em andamento. Tente novamente.');
      dialog.close();
      if (active === image) {
        if (result.relative) void open({...image,relative:result.relative});
        else close();
      }
      notify(action === 'delete' ? 'Imagem enviada para a Lixeira.' : 'Imagem atualizada.');
    } catch (error) {
      get('manage-image-error').textContent = error instanceof Error ? error.message : String(error);
    } finally {
      submit.disabled = cancel.disabled = false;
    }
  };
  return {bind,close,highlight,hideHover};
}
