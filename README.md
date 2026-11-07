<p align="center">
  <img src="logo.png" alt="Carbon Studio" width="100" />
</p>

<h1 align="center">Carbon Studio</h1>

<p align="center">Escreva em Carbon. Gere documentos com a composição tipográfica do LaTeX.</p>

<p align="center">
  <a href="https://github.com/barcelospusch/carbon-studio/releases">Downloads</a> ·
  <a href="LANGUAGE.md">Documentação da linguagem</a> ·
  <a href="examples">Exemplos</a> ·
  <a href="PUBLICAR_GITHUB.md">Publicação no GitHub</a>
</p>

Carbon Studio é um editor para Windows que transforma documentos `.cb` em PDFs por meio do fluxo **Carbon → LaTeX → PDF**. A linguagem simplifica a escrita de artigos e relatórios, enquanto o Tectonic realiza a composição do documento.

A prévia e o arquivo exportado usam o mesmo PDF gerado pelo motor LaTeX.

## Funcionalidades

- Projetos organizados por pasta, com seleção do documento quando houver vários arquivos `.cb`.
- Tela inicial com abertura de pasta ou criação a partir de um template.
- Editor Monaco com realce de sintaxe, sugestões, busca e substituição.
- Prévia PDF com navegação, zoom e referências internas clicáveis.
- Metadados, sumário, títulos, listas, tabelas, figuras e matemática LaTeX.
- Controle de margens, papel, orientação, tipografia e quebras de página.
- Alinhamento de parágrafos, colunas e células.
- Diagramas Mermaid integrados, importações e referências bibliográficas.
- Currículos, barra de formatação, estrutura de títulos e controles de arquivos.
- Cabeçalhos e rodapés por página, tarefas, matrizes e equações numeradas.
- Sete temas locais: Dark+, Light+, Monokai, Dracula, Solarized Dark, GitHub Dark e Carbon Original.
- Autor e instituição padrão, recuperação de alterações e detecção de mudanças externas nos arquivos.
- Ícones SVG personalizados na interface e nos controles de busca e recolhimento do editor.

## Instalar no Windows

Baixe um executável na página de [Releases](https://github.com/barcelospusch/carbon-studio/releases):

| Arquivo | Utilização |
| --- | --- |
| `Carbon-Studio-0.3.1-x64-Setup.exe` | Instalador com atalhos e associação de arquivos `.cb`. |
| `Carbon-Studio-0.3.1-x64-Portable.exe` | Versão portátil. |

O aplicativo é distribuído para **Windows 10/11 x64**. O motor PDF acompanha a distribuição; a primeira compilação pode precisar de internet para preparar fontes e pacotes TeX. Não é necessário instalar Rust nem uma distribuição completa de LaTeX.

Os executáveis ficam em Releases, separados do código-fonte.

## Começar a escrever

1. Abra uma pasta de projeto ou escolha **Começar do template**.
2. Se houver um único arquivo Carbon, ele será aberto automaticamente. Com vários arquivos, escolha um na página de seleção.
3. Escreva no editor e pressione **Ctrl+Enter** para compilar.
4. Confira a prévia e use **Ctrl+Shift+E** para exportar o PDF.

**Ctrl+S** salva o documento. A compilação usa o conteúdo atual do editor, inclusive alterações ainda não salvas, sem substituir o arquivo original.

### Exemplo Carbon

```carbon
@title Meu primeiro documento Carbon
@type article
@author [Ana Silva]{Instituto de Pesquisa}
@date @today

@page {size: A4, orientation: portrait}
@margins {top: 2.5cm, bottom: 2.5cm, left: 3cm, right: 2cm}

# Introdução
Escreva com **clareza**, *ênfase* e matemática $E = mc^2$.

@align(center)[
Um bloco de texto centralizado.
]

@caption Resultados do experimento. {#table:resultados width=100% pos=[here]}
| Método | Amostras | Resultado |
| :--- | :---: | ---: |
| Carbon | 120 | 99.4% |

Veja a @autoref(table:resultados).
```

Consulte [LANGUAGE.md](LANGUAGE.md) para a sintaxe completa. Exemplos prontos:

- [Primeiro artigo](examples/primeiro-artigo.cb)
- [Relatório com bibliografia](examples/relatorio.cb)
- [Layout e tipografia](examples/layout.cb)
- [Alinhamento de texto e tabelas](examples/alinhamento.cb)
- [Currículo](examples/curriculo.cb)
- [Matemática, paginação e Mermaid](examples/matematica-paginacao.cb)

A [Wiki](wiki/Home.md) organiza as instruções de uso. Veja também a [descrição do repositório](DESCRICAO_REPOSITORIO.md) e as [notas da versão](RELEASE_0.3.1.md).

## Desenvolver localmente

Pré-requisitos: Windows x64, Git e **Node.js 22.13 ou superior**, com npm.

Execute no **CMD**:

```cmd
git clone https://github.com/barcelospusch/carbon-studio.git
cd carbon-studio
npm ci
npm run prepare:compiler
npm run dev
```

`prepare:compiler` prepara o Tectonic e verifica o executável. O script de instalação confere o SHA-256 do arquivo baixado.

O modo de desenvolvimento usa o Vite em `http://127.0.0.1:5173` e abre o Electron. Se a instalação do npm estiver configurada para ignorar scripts, execute `node node_modules\electron\install.js` após `npm ci`.

Para executar a interface compilada:

```cmd
npm run build
npm start
```

## Gerar os executáveis

Na pasta do projeto:

```cmd
npm run dist:win
```

Os arquivos são gerados em `release`. Para gerar somente a pasta executável, use:

```cmd
npm run pack:win
```

O processo de distribuição valida os tipos, usa cache da interface, reaproveita o ícone Windows quando ele não mudou e utiliza o Electron instalado localmente. Instalador e portátil são configurados para compartilhar o pacote comprimido. Não há atualizador automático configurado; a atualização é feita por uma nova distribuição.

Os executáveis gerados não possuem assinatura digital de publicação.

## Testes

```cmd
npm run typecheck
npm test
npm run test:workspace:dev
```

Para incluir os testes que geram PDFs reais:

```cmd
set CARBON_TEST_PDF=1
npm test
```

Após compilar a interface, os testes adicionais podem ser executados com:

```cmd
npm run test:e2e
```

Após gerar a distribuição:

```cmd
npm run test:packaged
```

## Temas e preferências

As paletas iniciais ficam em [`assets/themes`](assets/themes). São definições locais inspiradas nesses estilos e não exigem o VS Code.

Na primeira inicialização, as definições são copiadas para a pasta `themes` do perfil local do aplicativo. O modal de preferências mostra o caminho e oferece **Abrir pasta dos temas**. Edições locais válidas são preservadas.

Tema, papel padrão, autor e instituição são salvos no dispositivo. A autoria padrão só é aplicada a novos templates. Os temas mudam a interface e o editor, sem alterar o PDF.

## Diagramas Mermaid

Escreva um bloco Mermaid no documento ou importe uma biblioteca .mmd. O Studio renderiza o diagrama localmente com o Chromium já incluído no Electron. Consulte a [Wiki](wiki/Home.md) para os exemplos.

## Estrutura do projeto

| Pasta ou arquivo | Responsabilidade |
| --- | --- |
| `src/` | Interface, editor, temas e visualizador PDF. |
| `electron/` | Compilador Carbon, arquivos, projetos, preferências e IPC. |
| `assets/icons/` | SVGs personalizados e inventário de ícones. |
| `assets/themes/` | Definições iniciais dos temas. |
| `logo.png` | Logotipo da interface e fonte dos ícones Windows. |
| `examples/` | Documentos de exemplo e recursos utilizados por eles. |
| `scripts/` | Preparação do motor PDF, ícone e build Windows. |
| `tests/` | Testes do compilador, arquivos, preferências e interface. |
| `LANGUAGE.md` | Referência da linguagem Carbon. |
| `PUBLICAR_GITHUB.md` | Comandos de publicação do código e dos executáveis. |

`node_modules`, `dist`, `build`, `release`, `tmp` e `output` são gerados localmente e não fazem parte do código versionado.

## Limites atuais

A aparência corresponde ao LaTeX gerado pelo compilador. Reproduzir um documento LaTeX externo exige os mesmos parâmetros, fontes, pacotes e macros.

Os estilos bibliográficos ABNT, IEEE, APA, MLA, Vancouver e Chicago possuem formatação básica para os campos documentados. Não implementam integralmente as normas editoriais nem todos os recursos de BibLaTeX/CSL; bibliografias para submissão formal precisam de revisão.

`examples/documentation.cb` preserva exemplos e caminhos ilustrativos da documentação recebida; não é um documento autocontido para compilação. Use os demais exemplos para começar.

## Contribuir

Sugestões e problemas podem ser registrados em [Issues](https://github.com/barcelospusch/carbon-studio/issues). Para propor mudanças, crie uma branch, execute as verificações relevantes e abra um pull request descrevendo o comportamento alterado.

## Licença

Consulte [LICENSE](LICENSE) e os [avisos de componentes de terceiros](THIRD_PARTY_NOTICES.md).
