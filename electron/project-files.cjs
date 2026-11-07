'use strict';

const fs = require('node:fs/promises');
const {constants} = require('node:fs');
const path = require('node:path');
const {inside} = require('./projects.cjs');

const imageTypes = new Map([
  ['.png','image/png'], ['.jpg','image/jpeg'], ['.jpeg','image/jpeg'],
  ['.gif','image/gif'], ['.webp','image/webp'], ['.bmp','image/bmp'],
  ['.avif','image/avif'], ['.ico','image/x-icon'], ['.svg','image/svg+xml'],
]);
const imageType = file => imageTypes.get(path.extname(file).toLowerCase());

async function projectImage(root, relative) {
  if (typeof relative !== 'string' || path.isAbsolute(relative) || !imageType(relative)) {
    throw new Error('Selecione uma imagem do projeto.');
  }
  const file = path.resolve(root, relative);
  if (!inside(root, file) || await fs.realpath(file) !== file || !(await fs.lstat(file)).isFile()) {
    throw new Error('Selecione um arquivo de imagem dentro do projeto.');
  }
  return file;
}

async function readProjectImage(file) {
  const handle = await fs.open(file, 'r');
  try {
    const limit = 32 * 1024 * 1024;
    const size = (await handle.stat()).size;
    if (size > limit) throw new Error('A imagem excede o limite de visualização de 32 MiB.');
    const bytes = Buffer.alloc(size);
    const {bytesRead} = await handle.read(bytes, 0, size, 0);
    return 'data:' + imageType(file) + ';base64,' + bytes.subarray(0, bytesRead).toString('base64');
  } finally {
    await handle.close();
  }
}

async function relocateImage(root, file, folder, name) {
  const target = await destination(root, folder, name);
  if (target === file) return target;
  if (process.platform === 'win32' && target.toLowerCase() === file.toLowerCase() &&
      await fs.realpath(target).catch(() => null) === file) {
    await fs.rename(file, target);
    return target;
  }
  await fs.copyFile(file, target, constants.COPYFILE_EXCL);
  try {
    await fs.unlink(file);
  } catch (error) {
    await fs.unlink(target).catch(() => {});
    throw error;
  }
  return target;
}

async function destination(root, folder, name) {
  if (typeof folder !== 'string' || path.isAbsolute(folder)) throw new Error('Pasta de destino inválida.');
  const directory = await fs.realpath(path.resolve(root, folder));
  if (!inside(root, directory) || !(await fs.stat(directory)).isDirectory()) throw new Error('Selecione uma pasta do projeto.');
  if (typeof name !== 'string' || !name.trim() || name.length > 160 || /[<>:"/\\|?*\x00-\x1f]|[. ]$/.test(name) ||
      /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name) || name.startsWith('.')) {
    throw new Error('Nome de arquivo ou pasta inválido.');
  }
  return path.join(directory, name);
}

async function importProjectItem(root, folder, source, directory) {
  const target = await destination(root, folder, path.basename(source));
  if (!directory) {
    await fs.copyFile(source, target, constants.COPYFILE_EXCL);
    return;
  }
  const input = await fs.realpath(source);
  if (inside(input, target)) throw new Error('A pasta de destino fica dentro da origem.');
  const stage = await fs.mkdtemp(path.join(path.dirname(target), '.carbon-import-'));
  try {
    const payload = path.join(stage, 'payload');
    await fs.cp(input, payload, {
      recursive:true, force:false, errorOnExist:true,
      filter:async file => !(await fs.lstat(file)).isSymbolicLink(),
    });
    await fs.lstat(target).then(() => { throw new Error('Já existe um item com esse nome.'); }, error => {
      if (error.code !== 'ENOENT') throw error;
    });
    await fs.rename(payload, target);
  } finally {
    if (inside(root, stage) && path.basename(stage).startsWith('.carbon-import-')) {
      await fs.rm(stage, {recursive:true, force:true}).catch(() => {});
    }
  }
}

async function downloadImage(link) {
  const url = new URL(link);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Use um endereço HTTP ou HTTPS de uma imagem.');
  }
  const response = await fetch(url, {signal:AbortSignal.timeout(15000)});
  if (!response.ok || !response.body) throw new Error('A imagem não pôde ser baixada (' + response.status + ').');
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > 12 * 1024 * 1024) throw new Error('A imagem excede o limite de 12 MiB.');
    chunks.push(chunk);
  }
  const bytes = Buffer.concat(chunks);
  const png = bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'));
  const jpeg = bytes.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex'));
  if (!png && !jpeg) throw new Error('O endereço precisa fornecer um PNG ou JPEG.');
  return {bytes, extension:png ? '.png' : '.jpg', mime:png ? 'image/png' : 'image/jpeg'};
}

module.exports = {destination, importProjectItem, downloadImage, imageType, projectImage, readProjectImage, relocateImage};
