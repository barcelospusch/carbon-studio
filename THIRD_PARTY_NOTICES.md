# Componentes de terceiros

A interface e o compilador Carbon deste aplicativo derivam da base Carbon existente neste workspace, sob licença MIT (LICENSE).

O aplicativo incorpora Electron (MIT) e Chromium. Seus arquivos LICENSE e LICENSES.chromium.html acompanham a distribuição gerada pelo Electron Builder. Monaco Editor (MIT) e PDF.js (Apache-2.0) têm seus avisos copiados para resources/licenses.

O motor Tectonic 0.17.0 é distribuído em resources/compiler/tectonic.exe. Projeto e avisos dos componentes: https://github.com/tectonic-typesetting/tectonic. Os pacotes TeX, fontes e demais componentes mantêm suas respectivas licenças.

Mermaid é incorporado à interface de renderização e usa o Chromium do Electron. A licença acompanha a distribuição em resources/licenses/mermaid-LICENSE.txt. Projeto: https://github.com/mermaid-js/mermaid.

As versões das ferramentas JavaScript estão fixadas em package-lock.json.

A prévia Markdown incorpora Marked (MIT), DOMPurify (Apache-2.0) e KaTeX (MIT). Suas licenças acompanham a distribuição em resources/licenses. A renderização das divisórias de colunas utiliza o pacote TeX multicolrule (LPPL), obtido pelo motor Tectonic.
