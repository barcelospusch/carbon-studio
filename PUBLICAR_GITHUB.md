# Publicar o Carbon Studio no GitHub

Este guia publica **somente a pasta `studio-app` como raiz do repositório**, sem as demais pastas de `D:\CARBON`. Os comandos são para o CMD do Windows.

Endereço utilizado: https://github.com/barcelospusch/carbon-studio

## 1. Preparar o repositório remoto

Instale o Git para Windows, se necessário. Crie no GitHub um repositório chamado `carbon-studio`, na conta `barcelospusch`, com a visibilidade desejada.

Para usar a sequência de primeira publicação abaixo, o repositório remoto deve estar **vazio**: não inicialize README, licença ou `.gitignore` no GitHub, pois esses arquivos já existem localmente. Se o repositório já existe e está vazio, use o mesmo endereço.

## 2. Primeira publicação

```cmd
cd /d D:\CARBON\DOCS\studio-app
git init -b main
git add .
git status --short
git diff --cached --stat
git commit -m "Publica Carbon Studio 0.2.0"
git remote add origin https://github.com/barcelospusch/carbon-studio.git
git push -u origin main
```

Os dois comandos de inspeção mostram o que será enviado. `node_modules`, `dist`, `build`, `release`, `tmp`, `output` e os dados locais são excluídos pelo `.gitignore`. O `package-lock.json`, os SVGs, os temas, os exemplos e os scripts de build devem ser enviados.

Se o Git solicitar nome e e-mail para criar o commit, configure a identidade apenas neste repositório:

```cmd
git config user.name "SEU NOME"
git config user.email "SEU EMAIL DO GITHUB"
```

Depois retome a sequência de publicação a partir de `git commit`, incluindo a configuração de `origin` antes do push, caso ela ainda não tenha sido feita.

Conclua a autenticação do GitHub quando ela for solicitada pelo Git ou pelo gerenciador de credenciais. Não coloque senhas ou tokens nos arquivos do projeto nem na URL do remoto.

Se `origin` já estiver configurado, confira o endereço antes de continuar:

```cmd
git remote -v
```

Caso precise ajustar esse endereço, use `git remote set-url origin https://github.com/barcelospusch/carbon-studio.git` em vez de `git remote add origin`.

## 3. Publicações seguintes

Depois da primeira publicação, execute na pasta `studio-app`:

```cmd
git status
git add .
git diff --cached --stat
git commit -m "Descreve as alterações desta atualização"
git push
```

Se houver alterações feitas diretamente no GitHub ou por outra pessoa, sincronize a branch antes de começar a editar. Não use push forçado para substituir o histórico remoto.

## Se o remoto já contém arquivos ou commits

A sequência de primeira publicação pressupõe um remoto vazio. Se já existe histórico, uma alternativa é clonar o repositório em **outra pasta**, copiar o conteúdo do `studio-app` para essa cópia de trabalho e fazer um commit normal.

Exemplo de clone, usando uma pasta nova:

```cmd
cd /d D:\CARBON\DOCS
git clone https://github.com/barcelospusch/carbon-studio.git carbon-studio-github
```

Copie para `carbon-studio-github` o código e os arquivos de documentação de `studio-app`, incluindo `.gitignore`. Preserve a pasta `.git` criada pelo clone. Não copie `node_modules`, `dist`, `build`, `release`, `tmp` ou `output`. Revise o que já existia no remoto antes de substituir arquivos.

Depois da cópia:

```cmd
cd /d D:\CARBON\DOCS\carbon-studio-github
git status
git add .
git diff --cached --stat
git commit -m "Atualiza Carbon Studio para 0.2.0"
git push
```

## 4. Publicar os executáveis em Releases

Os instaladores não entram nos commits. Depois de enviar o código, crie uma Release no GitHub com a tag `v0.2.0` e anexe:

- `release\Carbon-Studio-0.2.0-x64-Setup.exe`
- `release\Carbon-Studio-0.2.0-x64-Portable.exe`

Isso também pode ser feito pelo CMD se o **GitHub CLI (`gh`)** estiver instalado:

```cmd
cd /d D:\CARBON\DOCS\studio-app
gh auth login
gh release create v0.2.0 "release\Carbon-Studio-0.2.0-x64-Setup.exe" "release\Carbon-Studio-0.2.0-x64-Portable.exe" --repo barcelospusch/carbon-studio --target main --title "Carbon Studio 0.2.0" --notes "Projetos por pasta, temas locais, autoria padrão e ícones SVG personalizados."
```

Use esse comando depois de o código correspondente estar em `main`, com os executáveis gerados a partir dele. O exemplo cria uma nova Release; se a tag ou Release já existir, utilize a existente.

Nenhum comando de publicação é executado automaticamente por este guia.
