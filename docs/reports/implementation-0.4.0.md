# Atualização do Carbon Studio

> Registro histórico. O estado atual de distribuição e os comandos estão em [Publicação](../PUBLISHING.md); a referência vigente está em [LANGUAGE.md](../../LANGUAGE.md).

## Implementação

As alterações foram feitas na aplicação existente em `DOCS/studio-app`, preservando Electron, TypeScript, Monaco, PDF.js, Mermaid e o fluxo Carbon → LaTeX → Tectonic. Não houve migração para React nem substituição do aplicativo.

- Linguagem: comentários, parágrafos globais/locais, aliases de equações e sistemas, numeração opcional/manual, colunas e divisórias sólidas/tracejadas/pontilhadas, legendas nas seis posições, subfiguras e referências individuais/coletivas, fontes e notas, estilos de links, resumo, palavras-chave, teoremas, demonstrações, definições, avisos, referências agrupadas, contadores, trechos de página, controles de paginação, código com realce/legenda, variáveis, estilos reutilizáveis e idioma.
- Projetos: `@include` relativo/aninhado, detecção de ciclos, bases de recursos por capítulo, referências entre arquivos, seleção do principal, monitoramento de dependências e preservação das importações antigas.
- Compilação: remoção do limite de 8 MiB e do teto artificial da prévia PDF; worker cancelável, reutilização do PDF para estados idênticos, manutenção da última prévia válida e mapeamento de linhas Carbon/LaTeX.
- Recursos: arquivos ausentes, bibliografias malformadas, imagens corrompidas, PDFs inválidos e páginas inexistentes podem ser omitidos com warnings, sem placeholders. Imagens e PDFs são decodificados antes da composição no aplicativo. Caminhos canônicos são limitados ao projeto.
- Interface: compilação automática ao abrir Carbon, quatro modos persistentes, separadores redimensionáveis, barra lateral recolhível, abertura nativa de PDFs, edição e salvamento Markdown/Mermaid, prévia Markdown sanitizada com KaTeX e diagramas, ação acessível para revelar arquivos externos, botões Abrir/Salvar com os mesmos tokens e guia pesquisável com inserção de exemplos.
- Documentação: `LANGUAGE.md`, README e Wiki atualizados. O guia integrado lê a mesma referência da linguagem. Exemplos científicos e modulares foram adicionados.

## Arquivos principais

| Área | Arquivos |
| --- | --- |
| Transpilador | `electron/carbon.cjs`, `source.cjs`, `science.cjs`, `captions.cjs`, `document-options.cjs`, `semantic.cjs` |
| Worker/projetos | `electron/isolated-transpile.cjs`, `transpile-worker.cjs`, `compilation-project.cjs`, `projects.cjs` |
| Aplicação/segurança | `electron/main.cjs`, `core.cjs`, `preload.cjs`, `mermaid.cjs` |
| Editor/visualização | `src/main.ts`, `editor.ts`, `workspace-view.ts`, `markdown.ts`, `pdf.ts`, `mermaid-renderer.ts` |
| Painéis/guia | `src/layout-panel.ts`, `document-options-panel.ts`, `syntax-guide.ts`, `style.css`, `theme.css` |
| Verificação | `tests/extended.test.cjs`, `workspace-extended-e2e.test.cjs`, `resources-e2e.test.cjs` |
| Exemplos | `examples/novos-recursos.cb`, `examples/modular/main.cb` e seus capítulos/bibliografia |

## Decisões de arquitetura

O transpilador mantém o formato existente, acrescentando módulos de configuração e apresentação. Comentários são substituídos por espaços e entradas expandidas carregam arquivo, linha e diretório de origem. O mapa da saída associa linhas LaTeX ao trecho original.

No Studio, a transpilação roda em worker; o processo Tectonic permanece sob um AbortController para cancelamento da árvore de processos. Validação durante a edição usa um worker separado, sem gerar PDF. Recursos são verificados no renderizador isolado reutilizado de Mermaid; PDFs usam PDF.js. O protocolo de recursos valida o caminho canônico e o tipo de arquivo.

O Monaco permanece montado durante mudanças de layout. Preferências de disposição ficam no armazenamento local. PDFs externos mantêm estado separado do resultado exportável. Markdown utiliza Marked, DOMPurify e KaTeX sem habilitar recursos confiáveis do conteúdo.

As divisórias usam o pacote TeX [multicolrule](https://ctan.org/pkg/multicolrule), mantendo paginação e balanceamento do multicol.

## Validação executada

- `npm run build`: concluído, incluindo TypeScript e Vite.
- Suíte com `CARBON_TEST_PDF=1`: **49 testes aprovados, sem falhas ou testes ignorados**.
- Suíte Electron existente e espaço de trabalho: **5 testes de ponta a ponta aprovados**.
- Verificação adicional do build final: **2 testes aprovados**, cobrindo matemática Markdown, imagens corrompidas, PDFs inválidos, páginas inexistentes, retorno ao rascunho e persistência.
- PDF real de uma fonte de **9 MiB**, com **12 capítulos e figuras**, gerado corretamente.
- Inclusão com **150.000 linhas** validada sem atingir o limite de argumentos do JavaScript.
- As **seis posições de legenda**, referências como **2(a)/2(b)** e trechos com dimensões/orientações diferentes foram verificados em PDFs reais.

Os testes reais de PDF exigiram acesso ao cache/download de pacotes TeX fora da restrição de rede do sandbox. Os testes não usam um compilador simulado.

## Limites documentados

- Colunas usam a capacidade de 2 a 10 do multicol; blocos de colunas não são aninháveis.
- Trechos `@page[...]` ficam fora de outros blocos e de colunas globais; podem conter colunas locais.
- Em projetos com várias publicações compartilhando capítulos, uma raiz única ou `main.cb` permite seleção automática; nos casos ambíguos, abra explicitamente o principal desejado.
- O realce de `@code` usa listings. Unicode não suportado por esse ambiente pode exigir o bloco verbatim tradicional, preservado.
- A recuperação de recursos não transforma erros estruturais ou matemática inválida em documentos válidos. Esses erros continuam fatais e mantêm a última prévia.
- O limite artificial de tamanho foi removido; memória, disco, capacidade real do TeX e timeout continuam sendo restrições físicas/operacionais.
- Não foram gerados novos instaladores ou publicada uma release. O build local é executável com `npm start`.
