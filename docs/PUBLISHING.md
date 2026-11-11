# Publicar Carbon Studio 0.4.0

Este guia usa **PowerShell**, Git e GitHub CLI (`gh`). O repositório já existe; não execute `git init` novamente. A raiz local é `D:\CARBON\DOCS\studio-app`, e o remoto é [barcelospusch/carbon-studio](https://github.com/barcelospusch/carbon-studio).

Os comandos abaixo são executados manualmente. Preparar a distribuição não cria commits, branches, tags ou releases no GitHub.

## 1. Conferir a distribuição

Na raiz do projeto:

```powershell
Set-Location 'D:\CARBON\DOCS\studio-app'
node -p "require('./package.json').version"
Get-ChildItem 'release/Carbon-Studio-0.4.0*'
git status --short
git remote -v
```

A versão deve ser `0.4.0`. Os anexos desta release são:

- `release/Carbon-Studio-0.4.0-x64-Setup.exe`
- `release/Carbon-Studio-0.4.0-x64-Portable.exe`
- `release/Carbon-Studio-0.4.0-SHA256SUMS.txt`

Se precisar gerar novamente:

```powershell
npm ci
npm run docs:sync
npm test
npm run dist:win
npm run test:packaged
$artifacts = @('release/Carbon-Studio-0.4.0-x64-Setup.exe', 'release/Carbon-Studio-0.4.0-x64-Portable.exe')
$artifacts | ForEach-Object { $hash = Get-FileHash -Algorithm SHA256 -LiteralPath $_; '{0}  {1}' -f $hash.Hash.ToLowerInvariant(), (Split-Path $_ -Leaf) } | Set-Content -Encoding ascii 'release/Carbon-Studio-0.4.0-SHA256SUMS.txt'
```

Mantenha o código estável entre o build e a criação da tag. Se alterar o aplicativo, atualize o build antes de publicar.

## 2. Publicar a branch

A cópia de trabalho estava na branch `release/0.3.1` antes desta preparação. Crie a nova branch a partir do estado atual, preservando as alterações locais:

```powershell
Set-Location 'D:\CARBON\DOCS\studio-app'
git switch -c release/0.4.0
git add -A
git diff --cached --stat
git commit -m "Release Carbon Studio 0.4.0"
git push -u origin release/0.4.0
```

Revise o resumo antes do commit. Inclua os novos SVGs, fontes, documentação, scripts e `package-lock.json`. As pastas de artefatos são ignoradas pelo Git; os `.exe` serão enviados somente na release.

Se a branch já existir localmente, use `git switch release/0.4.0` em vez de criá-la. Se o Git pedir identidade, configure `user.name` e `user.email` neste repositório antes do commit. A autenticação do Git pode ser concluída pelo gerenciador de credenciais.

## 3. Publicar a versão

Confira a autenticação do GitHub CLI:

```powershell
gh auth status
```

Se ainda não estiver autenticado, execute `gh auth login`. Depois de publicar a branch, crie a tag no mesmo commit e envie os anexos:

```powershell
git switch release/0.4.0
git status --short
git log -1 --oneline
git tag -a v0.4.0 -m "Carbon Studio 0.4.0"
git push origin v0.4.0
gh release create v0.4.0 'release/Carbon-Studio-0.4.0-x64-Setup.exe' 'release/Carbon-Studio-0.4.0-x64-Portable.exe' 'release/Carbon-Studio-0.4.0-SHA256SUMS.txt' --repo barcelospusch/carbon-studio --verify-tag --latest --title 'Carbon Studio 0.4.0' --notes-file 'docs/releases/0.4.0.md'
```

O estado de trabalho deve estar limpo antes da tag. `--verify-tag` exige que a tag já esteja no remoto; não cria uma tag implicitamente a partir de outra branch. `--notes-file` utiliza as notas preparadas no repositório. Essas opções estão documentadas no [manual oficial do GitHub CLI](https://cli.github.com/manual/gh_release_create).

Se a tag ou a release já existir, confira o que foi publicado. Não substitua uma tag de versão por push forçado.

## 4. Conferir no GitHub

```powershell
gh release view v0.4.0 --repo barcelospusch/carbon-studio --web
```

Confira o título, as notas e os três anexos. Teste o instalador ou o portátil baixado na página da versão.

## Integração opcional em main

Publicar uma release a partir da branch de versão não integra suas alterações em `main`. Para abrir um pull request, quando essa for a branch principal do projeto:

```powershell
gh pr create --repo barcelospusch/carbon-studio --base main --head release/0.4.0 --title 'Carbon Studio 0.4.0' --body-file 'docs/releases/0.4.0.md'
```

O comando segue o [manual oficial de criação de pull requests](https://cli.github.com/manual/gh_pr_create). Revise e faça o merge no GitHub conforme o fluxo do projeto. A tag publicada continua apontando para o commit utilizado na distribuição.

## Próximas versões

1. Atualize `version` em `package.json` e no pacote raiz do `package-lock.json`.
2. Crie `docs/releases/X.Y.Z.md` e acrescente a entrada no `CHANGELOG.md`.
3. Atualize os nomes dos downloads no README e neste guia.
4. Execute `npm run docs:sync`, os testes e `npm run dist:win`.
5. Gere os hashes e publique a branch, a tag e os anexos correspondentes.
