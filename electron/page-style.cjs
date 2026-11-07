'use strict';

const positions = { left: 'L', center: 'C', right: 'R' };
const conditions = {
  first: '\\ifnum\\value{page}=1\\relax ',
  odd: '\\ifodd\\value{page} ',
  even: '\\ifodd\\numexpr\\value{page}+1\\relax ',
};

function pageStyle(rules, render, report) {
  if (!rules.length) return '';
  const commands = [];
  for (const kind of ['header', 'footer']) {
    for (const [position, code] of Object.entries(positions)) {
      const selected = new Map(rules.filter(rule => rule.kind === kind && rule.position === position).map(rule => [rule.scope, rule.text]));
      if (!selected.size) continue;
      const format = text => text.split(/(\{pages?\})/).map(part => part === '{page}' ? '\\thepage{}' : part === '{pages}' ? '\\pageref*{LastPage}' : render(part)).join('');
      let text = format(selected.get('all') || '');
      for (const scope of ['even', 'odd', 'first', ...[...selected.keys()].filter(key => /^\d+$/.test(key))]) {
        if (!selected.has(scope)) continue;
        const condition = conditions[scope] || '\\ifnum\\value{page}=' + scope + '\\relax ';
        text = condition + format(selected.get(scope)) + '\\else ' + text + '\\fi ';
      }
      commands.push('\\fancy' + (kind === 'header' ? 'head' : 'foot') + '[' + code + ']{' + text + '}');
    }
  }
  if (!rules.some(rule => rule.kind === 'footer')) commands.push('\\fancyfoot[C]{\\thepage}');
  return [
    '\\usepackage{fancyhdr,lastpage}',
    '\\setlength{\\headheight}{16pt}',
    '\\fancypagestyle{plain}{',
    '\\fancyhf{}',
    '\\renewcommand{\\headrulewidth}{0pt}',
    ...commands,
    '}',
    '\\pagestyle{plain}',
    ...(report ? [
      '\\makeatletter\\let\\ps@empty\\ps@plain\\makeatother',
      '\\AddToHook{env/titlepage/after}{\\setcounter{page}{2}}',
    ] : []),
  ].join('\n');
}

module.exports = {pageStyle};
