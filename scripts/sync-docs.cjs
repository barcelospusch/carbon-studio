'use strict';
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'LANGUAGE.md'),'utf8');
fs.writeFileSync(path.join(root,'wiki/Linguagem.md'),'<!-- Gerado de LANGUAGE.md por npm run docs:sync. Edite a referência na raiz. -->\n\n'+source);
console.log('Wiki sincronizada com LANGUAGE.md.');
