# Revisão visual e alterações aguardando SVGs

## Ícones encontrados

- 22 entradas SVG originais no registro de src/icons.ts; cinco não têm chamada direta na interface atual (stop, chevron, chevronDown, check, alert).
- Símbolos e letras usados como ícones: #, ∑, +, ⊞, ↗, B, I, ↕, ≡ e ✕. Alguns repetem a mesma função dos SVGs e poderão compartilhar arquivos.
- Dois SVGs inline personalizados já presentes em src/layout-panel.ts, para layout e quebra de página. As geometrias desses SVGs foram preservadas. A cor preta recebe currentColor por CSS para manter contraste nos temas escuros.
- Três slots nomeados para a próxima revisão: GitHub, template e tema; por enquanto usam desenhos existentes como fallback. O slot de tema está reservado.
- Os 35 nomes semânticos e suas localizações estão em assets/icons/README.md e manifest.json.
- O Monaco usa Codicons como fonte, não os SVGs do registro. Os 12 desenhos de busca/substituição/folding estão listados em assets/icons/monaco/README.md. O catálogo completo da fonte da dependência também foi documentado, sem solicitar centenas de arquivos.
- O logotipo PNG, o ícone da janela/instalador, pontos de estado, spinner e controles nativos do Windows não foram tratados como SVGs substituíveis nesta lista.

## Leitura do visual

O aplicativo já separa editor e PDF claramente, mas o uso de um mesmo desenho de código para seção, equação e Mermaid enfraquece a identificação das ações. A mistura de SVGs, letras e símbolos cria pesos visuais diferentes. A pasta criada permite trocar cada ação por um desenho consistente sem mexer no logotipo.

A tela inicial agora concentra as duas ações iniciais: selecionar pasta e começar do template. Os controles de inserção só aparecem com documento ativo. A seleção de vários documentos usa cartões com nome e subpasta, e a árvore do projeto permite alternar arquivos.

Os temas aplicam cores à interface e ao editor, mantendo o papel do PDF branco conforme o arquivo gerado. O modal de preferências ficou concentrado em tema, papel e identificação do autor.

## Arquivos principais para revisar

- electron/main.cjs: início sem documento, abertura de pastas, seleção de arquivos, preferências e link externo fixo.
- electron/projects.cjs: varredura das pastas e resolução dos documentos.
- electron/preferences.cjs: preferências públicas e metadados de autoria.
- electron/themes.cjs e assets/themes: definições locais e persistência.
- src/start-screen.ts: tela inicial e seleção de documentos.
- src/themes.ts e src/theme.css: aplicação das paletas.
- src/main.ts e src/api.ts: integração dos fluxos e do novo modal.
- assets/icons: inventário e local para os SVGs a fornecer.

## Integração da versão 0.2.0

Os 35 SVGs da interface e os 12 SVGs do Monaco foram integrados conforme autorização do usuário. Os desenhos originais ficam em assets/icons, normalizados somente na renderização para dimensão e cor do tema. Os símbolos substituídos agora usam funções semânticas distintas. A próxima versão foi autorizada para build.
