'use strict';

function cvHeader(name, headline, contacts, render) {
  return [
    '\\begin{center}',
    '{\\LARGE\\bfseries ' + render(name) + '}\\par',
    headline && '\\smallskip {' + render(headline) + '}\\par',
    contacts.length && '\\smallskip {\\small ' + contacts.map(render).join(' \\quad\\textbar\\quad ') + '}\\par',
    '\\end{center}',
  ].filter(Boolean).join('\n');
}

function cvEntry(title, organization, period, location, render) {
  return [
    '\\par\\medskip\\noindent',
    '\\begin{tabularx}{\\linewidth}{@{}X>{\\raggedleft\\arraybackslash}p{.3\\linewidth}@{}}',
    '\\textbf{' + render(title) + '} & ' + render(period) + ' \\\\',
    render(organization) + ' & ' + render(location) + ' \\\\',
    '\\end{tabularx}\\par\\nobreak',
  ].join('\n');
}

module.exports = {cvHeader, cvEntry};
