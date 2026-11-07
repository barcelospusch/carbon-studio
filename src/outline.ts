import type {editor as MonacoEditor} from 'monaco-editor/editor/editor.api.js';

export function installOutline(editor: MonacoEditor.IStandaloneCodeEditor) {
  const list = document.getElementById('document-outline')!;
  let pending: ReturnType<typeof setTimeout>;
  function refresh() {
    list.replaceChildren();
    let fenced = false;
    let displayMath = false;
    const lines = editor.getModel()?.getLinesContent() || [];
    lines.forEach((line, index) => {
      if (/^\s*~~~|^\s*\x60{3}/.test(line)) { fenced = !fenced; return; }
      if (fenced) return;
      if (/^\s*\$\$/.test(line)) {
        if (!/^\s*\$\$.+\$\$\s*$/.test(line)) displayMath = !displayMath;
        return;
      }
      const match = !displayMath && line.match(/^(#{1,3})\s+(.+)$/);
      if (!match) return;
      const button = document.createElement('button');
      button.className = 'outline-heading';
      button.style.paddingInlineStart = 10 + (match[1].length - 1) * 16 + 'px';
      button.textContent = match[2];
      button.title = match[2];
      button.onclick = () => {
        editor.setPosition({lineNumber:index + 1,column:1});
        editor.revealLineInCenter(index + 1);
        editor.focus();
      };
      list.append(button);
    });
    if (!list.childElementCount) list.textContent = 'Sem títulos';
  }
  editor.onDidChangeModelContent(() => {
    clearTimeout(pending);
    pending = setTimeout(refresh, 100);
  });
  refresh();
}
