# Cabeçalhos, rodapés e paginação

Cada regra define uma área, um conjunto de páginas e uma posição. Use `@header[escopo][posição] Texto` ou `@footer[escopo][posição] Texto` em uma linha própria.

```carbon
@header[all][left] Notas de pesquisa
@header[first][left] Apresentação
@header[even][right] Verso
@header[2][left] Demonstração
@footer[all][right] Página {page} de {pages}
```

As posições são `left`, `center` e `right`. Os escopos são `all`, `first`, `odd`, `even` e um número de página. Para a mesma área e posição, um número específico tem prioridade sobre a primeira página, a paridade e a regra geral. A última declaração ganha quando repete o mesmo escopo e posição. Use `none` como texto para deixar um campo vazio.

| Texto da regra | Exemplo no PDF |
| --- | --- |
| `Página {page}` | Página 2 |
| `Página {page} de {pages}` | Página 2 de 5 |
| `{page}` | 2 |
| `{page} de {pages}` | 2 de 5 |
| `{page}/{pages}` | 2/5 |

O Studio usa referências LaTeX para o total de páginas. A compilação resolve o total e as referências automaticamente.
