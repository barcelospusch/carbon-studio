# Currículos

Use o botão **Currículo** da tela inicial ou declare `@type cv` antes dos campos do currículo. Informe o nome em `@title`, a área de atuação em `@headline` e cada meio de contato em um `@contact`. Os títulos de seção usam a mesma sintaxe do Carbon e aparecem sem numeração no PDF.

```carbon
@type cv
@title Ana Silva
@headline Engenheira de software
@contact São Paulo, Brasil
@contact ana@example.com
@contact [Portfólio](https://example.com)

# Experiência
@cv-entry[2024 — atual][São Paulo] Engenheira | Empresa Exemplo
- Automatizei a validação dos resultados de pesquisa.

# Formação
@cv-entry[2020 — 2024][São Paulo] Engenharia | Universidade Exemplo
```

`@cv-entry[período][local] Título | Organização` alinha período e local à direita. Os campos entre colchetes podem ficar vazios. O template usa o autor padrão como nome e a instituição padrão como contato.

O formato usa a organização por contatos, seções e entradas datadas do [RenderCV](https://github.com/rendercv/rendercv) como referência. A fonte é Carbon e a saída é composta pelo Tectonic.
