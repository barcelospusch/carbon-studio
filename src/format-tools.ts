const symbols: Record<string, [string,string][]> = {
  Gregas:[['α','alpha'],['β','beta'],['γ','gamma'],['δ','delta'],['ε','epsilon'],['θ','theta'],['λ','lambda'],['μ','mu'],['π','pi'],['ρ','rho'],['σ','sigma'],['φ','phi'],['ω','omega'],['Γ','Gamma'],['Δ','Delta'],['Σ','Sigma'],['Ω','Omega']],
  Setas:[['→','rightarrow'],['←','leftarrow'],['↔','leftrightarrow'],['⇒','Rightarrow'],['⇐','Leftarrow'],['⇔','Leftrightarrow'],['↦','mapsto'],['↑','uparrow'],['↓','downarrow']],
  Operadores:[['±','pm'],['×','times'],['÷','div'],['·','cdot'],['∑','sum'],['∏','prod'],['∫','int'],['√','sqrt{}'],['∪','cup'],['∩','cap']],
  Relações:[['≤','leq'],['≥','geq'],['≠','neq'],['≈','approx'],['≡','equiv'],['∝','propto'],['∈','in'],['∉','notin'],['⊂','subset'],['⊆','subseteq']],
  Miscelânea:[['∞','infty'],['∂','partial'],['∇','nabla'],['∀','forall'],['∃','exists'],['∅','emptyset'],['ℏ','hbar'],['⊥','perp'],['…','ldots']],
};

export function isMathContext(prefix: string) {
  const lines = prefix.split(/\r?\n/);
  const current = lines.pop() || '';
  let block: 'code'|'display'|'science'|null = null;
  for (const line of lines) {
    const text = line.trim();
    if (block === 'code') {
      if (/^\x60{3}$/.test(text)) block = null;
    } else if (block === 'display') {
      if (text.endsWith('$$')) block = null;
    } else if (block === 'science') {
      if (text === ']') block = null;
    } else if (/^\x60{3}/.test(text)) block = 'code';
    else if (/^@(matrix|equation)\[[^\]]*\]\[$/.test(text)) block = 'science';
    else if (text.startsWith('$$') && !text.slice(2).endsWith('$$')) block = 'display';
  }
  if (block) return block !== 'code';
  const dollars = current.match(/(?<!\\)\$\$|(?<!\\)\$/g) || [];
  return dollars.length % 2 === 1;
}

export function installSymbols(insert: (value: string) => void, inMath: () => boolean) {
  const select = document.getElementById('math-symbol') as HTMLSelectElement;
  for (const [category, values] of Object.entries(symbols)) {
    const group = document.createElement('optgroup');
    group.label = category;
    for (const [symbol, command] of values) group.append(new Option(symbol + '  \\' + command, '\\' + command));
    select.append(group);
  }
  select.onchange = () => {
    if (select.value) insert(inMath() ? select.value + ' ' : '$' + select.value + '$');
    select.selectedIndex = 0;
  };
}
