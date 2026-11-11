<p align="center">
  <img src="logo.png" alt="Carbon Studio" width="100" />
</p>

<h1 align="center">Carbon Studio</h1>

<p align="center">Escreva em Carbon. Gere documentos com a composição tipográfica do LaTeX.</p>

<p align="center">
  <a href="https://github.com/barcelospusch/carbon-studio/releases">Downloads</a> ·
  <a href="LANGUAGE.md">Linguagem</a> ·
  <a href="docs/README.md">Documentação</a> ·
  <a href="examples">Exemplos</a>
</p>

Carbon Studio é um aplicativo para Windows que transforma documentos `.cb` em PDFs pelo fluxo **Carbon → LaTeX → Tectonic**. O mesmo espaço de trabalho permite editar Markdown e Mermaid e abrir PDFs e imagens locais.

**Versão 0.4.0.** Consulte as [novidades](docs/releases/0.4.0.md) e o [histórico de versões](CHANGELOG.md).

## Recursos

- Editor Monaco com realce, sugestões, busca, estrutura do documento e atalhos.
- Compilação automática ao abrir Carbon, cancelamento e manutenção do último PDF válido.
- Tipografia científica: matemática, matrizes, equações, tabelas, figuras, subfiguras e bibliografia.
- Parágrafos, colunas, legendas, estilos de links, cabeçalhos, rodapés e paginação configuráveis.
- Capítulos com `@include`, caminhos relativos, referências entre arquivos e avisos de dependências.
- Prévia Markdown sanitizada, fórmulas KaTeX e diagramas Mermaid.
- Quatro modos de visualização e barra lateral ajustável, com preferências persistentes.
- Sete temas, autoria padrão, recuperação de alterações e gerenciamento de imagens.
- Guia de sintaxe com pesquisa e exemplos que podem ser inseridos no editor.

As restrições e combinações de cada diretiva estão na [referência da linguagem](LANGUAGE.md). Não há limite artificial de 8 MiB para fontes Carbon; memória, disco e capacidade do motor TeX continuam se aplicando.

## Instalar e começar

Na página de [Releases](https://github.com/barcelospusch/carbon-studio/releases), escolha o instalador ou o portátil da versão desejada. Para a versão 0.4.0, os arquivos são:

| Arquivo | Uso |
| --- | --- |
| `Carbon-Studio-0.4.0-x64-Setup.exe` | Instalação, atalhos e associação de `.cb`. |
| `Carbon-Studio-0.4.0-x64-Portable.exe` | Execução sem instalação. |
| `Carbon-Studio-0.4.0-SHA256SUMS.txt` | Verificação SHA-256 dos executáveis. |

Requisitos: **Windows 10/11 x64**. O Tectonic acompanha a distribuição; a primeira compilação pode precisar de internet para obter fontes e pacotes TeX. Não é necessário instalar Rust nem uma distribuição completa de LaTeX. Os executáveis não possuem assinatura digital de publicação.

1. Abra a pasta do projeto ou comece por um template.
2. Escolha um arquivo na árvore. Carbon compila automaticamente; Markdown tem prévia independente.
3. Edite e salve com **Ctrl+S**. Use **Ctrl+Enter** para recompilar Carbon.
4. Confira a prévia e exporte o PDF com **Ctrl+Shift+E**.

A compilação considera o rascunho atual, sem sobrescrever o documento original. PDFs abertos diretamente ficam separados do resultado exportável do compilador.

## Exemplo Carbon

```carbon
@title Meu artigo
@author [Ana Silva]{Instituto de Pesquisa}
@date @today
@paragraph {indent-first: 1.25cm, spacing-after: 6pt}

# Introdução
Texto com **clareza**, *ênfase* e matemática $E=mc^2$.

@eq[label=eq:energia][
E=mc^2
]

Veja a equação @eqref(eq:energia).
```

Exemplos completos:

- [Primeiro artigo](examples/primeiro-artigo.cb)
- [Relatório com bibliografia](examples/relatorio.cb)
- [Layout e tipografia](examples/layout.cb)
- [Alinhamento](examples/alinhamento.cb)
- [Recursos científicos da versão 0.4.0](examples/novos-recursos.cb)
- [Projeto modular com capítulos](examples/modular/main.cb)
- [Currículo](examples/curriculo.cb)
- [Matemática, paginação e Mermaid](examples/matematica-paginacao.cb)

`examples/documentation.cb` contém caminhos ilustrativos e não é um exemplo autocontido. Os estilos bibliográficos implementam a formatação básica dos campos documentados; submissões editoriais exigem revisão das normas aplicáveis.

## Desenvolver

Pré-requisitos: Windows x64, Git e **Node.js 22.13 ou superior**, com npm. Comandos para PowerShell:

```powershell
git clone https://github.com/barcelospusch/carbon-studio.git
Set-Location carbon-studio
npm ci
npm run prepare:compiler
npm run dev
```

O modo de desenvolvimento usa `http://127.0.0.1:5173`. Se a instalação estiver configurada para ignorar scripts, execute `node node_modules/electron/install.js` depois de `npm ci`.

Para usar a interface compilada:

```powershell
npm run build
npm start
```

## Verificar e distribuir

```powershell
npm test
npm run build
npm run test:e2e
npm run dist:win
npm run test:packaged
```

Para incluir os testes que geram PDFs reais:

```powershell
$env:CARBON_TEST_PDF = '1'
npm test
Remove-Item Env:CARBON_TEST_PDF
```

`npm run dist:win` gera instalador e portátil em `release/`. `npm run pack:win` gera somente a pasta executável. O build reutiliza a interface apenas quando as fontes, ícones, referência da linguagem e dependências não mudaram.

A sequência de publicação da branch, tag e executáveis está em [docs/PUBLISHING.md](docs/PUBLISHING.md).

## Documentação e estrutura

| Local | Conteúdo |
| --- | --- |
| [LANGUAGE.md](LANGUAGE.md) | Referência principal, usada pelo guia integrado. |
| [docs/](docs/README.md) | Publicação, notas de versões e relatórios históricos. |
| [wiki/](wiki/Home.md) | Instruções por assunto; `npm run docs:sync` sincroniza a referência. |
| `src/` | Interface, Monaco, Markdown, Mermaid e PDF.js. |
| `electron/` | Compilação, workers, projetos, arquivos e IPC. |
| `assets/` | Ícones e temas locais. |
| `examples/` | Documentos e recursos de exemplo. |
| `scripts/` e `tests/` | Preparação, build e verificações. |

`node_modules/`, `dist/`, `build/`, `release/`, `tmp/` e `output/` são gerados localmente e ignorados pelo Git. Publique os executáveis como anexos da release.

## Contribuir e licença

Registre problemas em [Issues](https://github.com/barcelospusch/carbon-studio/issues). Para propor alterações, use uma branch e descreva o comportamento e as verificações no pull request.

Consulte [LICENSE](LICENSE) e os [avisos de terceiros](THIRD_PARTY_NOTICES.md).
