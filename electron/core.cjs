'use strict';
const { promises: fs } = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
function validateSource(source) {
  if (typeof source !== 'string') throw new Error('O documento deve ser texto UTF-8.');
  return source;
}
async function readDocument(file) {
  if (!['.cb','.md','.markdown','.mmd'].includes(path.extname(file).toLowerCase())) throw new Error('Selecione um documento de texto suportado.');
  const stat = await fs.stat(file);
  if (!stat.isFile()) throw new Error('Documento inválido.');
  const bytes = await fs.readFile(file);
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^\uFEFF/, '');
  return { path: await fs.realpath(file), text, fingerprint: hash(bytes) };
}
async function fingerprint(file) { try { return hash(await fs.readFile(file)); } catch (e) { if (e.code === 'ENOENT') return null; throw e; } }
async function atomicWrite(file, data) {
  const temporary = path.join(path.dirname(file), `.${path.basename(file)}.${crypto.randomUUID()}.tmp`);
  try {
    await fs.writeFile(temporary, data, { flag: 'wx' });
    await fs.rename(temporary, file);
  } finally { await fs.unlink(temporary).catch(() => {}); }
}
function compileArguments(snapshot, output, assetBase, settings) {
  const args = [snapshot, '--output', output, '--asset-base', assetBase, '--backend', settings.backend === 'native' ? 'native' : 'latex'];
  if (settings.backend !== 'native') {
    args.push('--paper', settings.paper === 'a4' ? 'a4' : 'letter');
    if (settings.tectonic) args.push('--tectonic', settings.tectonic);
    if (settings.mermaid) args.push('--mermaid-cli', settings.mermaid);
  }
  return args;
}
function killTree(child) {
  if (!child.pid) return;
  if (process.platform === 'win32') {
    const killer = spawn(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'taskkill.exe'), ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    // Restricted environments may deny taskkill even for a child process.
    // Keep cancellation responsive by falling back to the owned process handle.
    const fallback = setTimeout(() => child.kill(), 1000);
    fallback.unref();
    killer.once('error', () => { clearTimeout(fallback); child.kill(); });
    killer.once('close', code => { clearTimeout(fallback); if (code !== 0) child.kill(); });
  } else { try { process.kill(-child.pid, 'SIGTERM'); } catch { child.kill(); } }
}
function runCompiler(executable, args, { cwd, timeout = 180000, node, signal, onLog = () => {} } = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('Compilação cancelada.'));
    const env = { ...process.env };
    if (node) { const original = env.PATH || env.Path || ''; for (const key of Object.keys(env)) if (key.toUpperCase() === 'PATH') delete env[key]; env.PATH = path.dirname(node) + path.delimiter + original; }
    const child = spawn(executable, args, { cwd, env, windowsHide: true, shell: false, detached: process.platform !== 'win32' });
    let stdout = '', stderr = '', cancelled = false, timedOut = false, settled = false;
    const append = (kind, data) => {
      const text = data.toString('utf8');
      if (kind === 'stdout') stdout = (stdout + text).slice(-262144); else stderr = (stderr + text).slice(-262144);
      onLog(kind, text.slice(-16384));
    };
    child.stdout.on('data', b => append('stdout', b)); child.stderr.on('data', b => append('stderr', b));
    const abort = () => { cancelled = true; killTree(child); };
    signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(() => { timedOut = true; killTree(child); }, timeout);
    const finish = (error, code) => {
      if (settled) return; settled = true; clearTimeout(timer); signal?.removeEventListener('abort', abort);
      if (error) return reject(new Error(`Não foi possível iniciar o compilador: ${error.message}`));
      if (cancelled) return reject(new Error('Compilação cancelada.'));
      if (timedOut) return reject(new Error(`Tempo limite de ${Math.round(timeout/1000)} s excedido. A primeira compilação LaTeX pode baixar pacotes; confira a conexão e tente novamente.`));
      resolve({ code, stdout, stderr });
    };
    child.on('error', error => finish(error)); child.on('close', code => finish(null, code));
  });
}
module.exports = { hash, validateSource, readDocument, fingerprint, atomicWrite, compileArguments, runCompiler };
