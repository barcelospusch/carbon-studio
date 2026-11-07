# Ícones para a próxima revisão visual

Salve seus SVGs nesta pasta: `D:\CARBON\DOCS\studio-app\assets\icons`. Os 35 SVGs fornecidos foram integrados ao código para a versão 0.2.0, junto dos 12 SVGs opcionais do Monaco, após autorização do usuário.

Foram encontrados 22 registros SVG originais, símbolos tipográficos e dois SVGs inline personalizados. A lista abaixo organiza 35 nomes semânticos para a troca, incluindo três slots adicionais e os registros atualmente sem uso. Um único arquivo pode atender a várias ocorrências da mesma ação.

| Arquivo | Uso e localização |
| --- | --- |
| `plus.svg` | Adicionar / começar template — `src/icons.ts` |
| `folder.svg` | Abrir pasta, projeto e pastas na árvore — `src/icons.ts` |
| `save.svg` | Salvar documento — `src/icons.ts` |
| `play.svg` | Compilar e recompilar — `src/icons.ts` |
| `stop.svg` | Cancelar compilação — `src/icons.ts` |
| `download.svg` | Exportar PDF — `src/icons.ts` |
| `settings.svg` | Preferências — `src/icons.ts` |
| `code.svg` | Código genérico (disponível no registro) — `src/icons.ts` |
| `file.svg` | Documento Carbon e prévia PDF — `src/icons.ts` |
| `image.svg` | Inserir figura e arquivos de imagem — `src/icons.ts` |
| `chevron-right.svg` | Seta de expansão (registrada, sem chamada direta) — `src/icons.ts` |
| `chevron-down.svg` | Seta para baixo (registrada, sem chamada direta) — `src/icons.ts` |
| `check.svg` | Confirmar (registrado, sem chamada direta) — `src/icons.ts` |
| `alert.svg` | Alerta (registrado, sem chamada direta) — `src/icons.ts` |
| `close.svg` | Fechar painéis e modais; substitui também ✕ — `src/icons.ts; src/layout-panel.ts; src/text-panel.ts` |
| `terminal.svg` | Saída da compilação — `src/icons.ts` |
| `book.svg` | Guia de sintaxe — `src/icons.ts` |
| `split.svg` | Editor e prévia divididos; hoje também tabela — `src/icons.ts` |
| `arrow-left.svg` | Página anterior — `src/icons.ts` |
| `arrow-right.svg` | Página seguinte e guia — `src/icons.ts` |
| `refresh.svg` | Atualizar lista do projeto — `src/icons.ts` |
| `clock.svg` | Prévia desatualizada — `src/icons.ts` |
| `heading.svg` | Título de seção — `src/main.ts` |
| `math.svg` | Inserir equação — `src/main.ts` |
| `table.svg` | Inserir tabela — `src/main.ts` |
| `mermaid.svg` | Inserir diagrama Mermaid — `src/main.ts` |
| `bold.svg` | Negrito — `src/main.ts` |
| `italic.svg` | Itálico — `src/main.ts` |
| `layout.svg` | Layout do documento — `src/layout-panel.ts` |
| `page-break.svg` | Quebra de página — `src/layout-panel.ts` |
| `position.svg` | Posicionar figura / tabela — `src/layout-panel.ts` |
| `alignment.svg` | Alinhamento de texto — `src/text-panel.ts` |
| `github.svg` | Link GitHub no rodapé — `src/main.ts; src/icons.ts` |
| `template.svg` | Começar do template — `src/start-screen.ts; src/icons.ts` |
| `theme.svg` | Tema nas preferências — `src/icons.ts` |

Prefira SVG com `viewBox`, sem largura fixa, e cores `currentColor` para acompanhar os temas. Como os exemplos já inseridos usam viewBox 256, esse tamanho também é aceito; não é obrigatório usar 24. O logotipo PNG, o ícone da janela/instalador, os pontos de status, o spinner CSS e a ilustração de papel vazio não são ícones SVG deste inventário.

## Ícones internos do editor Monaco

O Monaco usa uma fonte de ícones própria, separada dos ícones do aplicativo. Para a busca/substituição e o recolhimento de código carregados pelo Studio, os arquivos opcionais estão descritos em `monaco/README.md`. Não é necessário copiar toda a biblioteca de ícones do Monaco. As setas nativas de select/input e os ícones dos diálogos do Windows também são fornecidos pelo sistema, não por SVGs do Studio.
