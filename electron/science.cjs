'use strict';

const delimiters = new Map([
  ['none', 'matrix'], ['parentheses', 'pmatrix'], ['brackets', 'bmatrix'],
  ['braces', 'Bmatrix'], ['bars', 'vmatrix'], ['double-bars', 'Vmatrix'],
]);

function splitMath(text, separators) {
  const parts = [];
  let start = 0;
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\\') { i++; continue; }
    if ('{(['.includes(text[i])) depth++;
    if ('})]'.includes(text[i])) depth--;
    if (depth === 0 && separators.includes(text[i])) {
      parts.push(text.slice(start, i).trim());
      start = i + 1;
    }
  }
  return [...parts, text.slice(start).trim()];
}

function matrix(delimiter, text) {
  const environment = delimiters.get(delimiter);
  if (!environment) throw new Error('Delimitador de matriz desconhecido.');
  const rows = splitMath(text, ';\n').filter(Boolean).map(row => splitMath(row, ','));
  if (!rows.length || rows.some(row => row.length !== rows[0].length || row.some(cell => !cell))) {
    throw new Error('A matriz precisa de linhas com o mesmo número de células preenchidas.');
  }
  return '\\begin{' + environment + '}' + rows.map(row => row.join(' & ')).join(' \\\\ ') + '\\end{' + environment + '}';
}

function expandMatrices(text) {
  const opening = /@matrix\[([\w-]+)\]\{/g;
  let output = '';
  let cursor = 0;
  for (let match; (match = opening.exec(text));) {
    const start = opening.lastIndex;
    let end = start;
    let depth = 1;
    for (; end < text.length; end++) {
      if (text[end] === '\\') { end++; continue; }
      if (text[end] === '{') depth++;
      if (text[end] === '}' && --depth === 0) break;
    }
    if (depth !== 0) throw new Error('Matriz inline sem chave de fechamento.');
    output += text.slice(cursor, match.index) + matrix(match[1], text.slice(start, end));
    cursor = opening.lastIndex = end + 1;
  }
  return output + text.slice(cursor);
}

function equation(attributes, lines, math, system=false) {
  const options = new Map();
  for (const part of attributes.trim().split(/\s+/).filter(Boolean)) {
    const match = part.match(/^(align|label|number)=([\w:.-]+)$/);
    if (!match || options.has(match[1])) throw new Error('Opção de equação inválida ou duplicada: ' + part);
    options.set(match[1], match[2]);
  }
  const align = options.get('align') || 'equals';
  const label = options.get('label');
  const number = options.get('number');
  if (!['equals', 'left', 'right', 'center'].includes(align) || (number && !/^(auto|none|\d+)$/.test(number))) {
    throw new Error('Use align=equals/left/right/center e number=auto, none ou um inteiro.');
  }
  if(number==='none'&&label)throw new Error('Uma equação sem numeração não pode ter label.');
  const rows = lines.filter(line => line.trim()).map(line=>math(line.replace(/\\\\\s*$/,'')));
  if (!rows.length) throw new Error('Equação vazia.');
  const side = align === 'left' || align === 'right';
  const environment = (side ? 'flalign' : 'equation') + (number==='none' ? '*' : label || number ? '' : '*');
  let contents;
  if (align === 'equals') {
    contents = '\\begin{aligned}' + rows.map(row => {
      if(splitMath(row,'&').length>1)return row;
      const parts = splitMath(row, '=');
      return parts.length > 1 ? parts.shift() + '&=' + parts.join('=') : '&' + row;
    }).join(' \\\\ ') + '\\end{aligned}';
  } else {
    const column = {left:'l', right:'r', center:'c'}[align];
    const array = '\\begin{array}{@{}' + column + '@{}}' + rows.map(row => '\\displaystyle ' + row).join(' \\\\ ') + '\\end{array}';
    contents = align === 'left' ? '&' + array + '&&' : align === 'right' ? '&&' + array + '&' : array;
  }
  if(system){if(side)throw new Error('@equations aceita align=equals ou center.');contents='\\left\\{'+contents+'\\right.';}
  const tag = number && !['auto','none'].includes(number) ? '\\tag{' + number + '}' : '';
  return '\\begin{' + environment + '}\n' + contents + tag + (label ? '\\label{' + label + '}' : '') + '\n\\end{' + environment + '}';
}

module.exports = {matrix, expandMatrices, equation};
