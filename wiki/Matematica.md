# Matemática

Use `$...$` em um parágrafo e `$$...$$` para fórmulas em destaque. A lista **Símbolos** da barra agrupa comandos LaTeX em gregas, setas, operadores, relações e miscelânea.

## Matrizes

Uma matriz inline usa `@matrix[delimitador]{células}` dentro de `$...$`. Separe colunas com vírgulas e linhas com ponto e vírgula.

```carbon
A identidade é $I = @matrix[parentheses]{1, 0; 0, 1}$.
```

Em bloco, use uma linha por linha da matriz e feche com `]`.

```carbon
@matrix[brackets][
1, 2
3, \frac{1}{2}
]
```

Delimitadores disponíveis. `none`, `parentheses`, `brackets`, `braces`, `bars` e `double-bars`. Todas as linhas devem ter o mesmo número de células. Use ponto decimal, já que a vírgula separa colunas.

## Equações alinhadas e referências

```carbon
@equation[align=equals label=eq:energia number=1][
E = mc^2
m = \frac{E}{c^2}
]

Veja a equação @eqref(eq:energia).
```

- `align=equals` alinha no primeiro sinal de igualdade fora de grupos LaTeX. É o padrão.
- `align=left`, `align=right` e `align=center` posicionam as linhas na área de texto.
- `number=auto` usa o contador do LaTeX. Um inteiro define o número exibido entre parênteses.
- `label=eq:nome` cria uma referência. Com label e sem number, a numeração é automática.

Use `@eqref(eq:nome)` para obter o número entre parênteses.
